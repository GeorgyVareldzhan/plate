/**
 * Label photo recognition on the device: Tesseract with the accurate ("best") Russian and
 * English models. Nothing is sent anywhere. The engine (~4 MB) and models (~6 MB) load on
 * the first photo; the service worker keeps them, so later photos work offline.
 */
// Served as is from public/vendor/tesseract (not bundled): the engine loads its own files by URL
const BASE = new URL('vendor/tesseract/', document.baseURI).href;

// Long side of the image given to the recognizer: phone photos are scaled down to it
const MAX_SIDE = 2800;
// Small images are scaled up for the contrast pass so thin print gets thicker
const ENHANCED_MIN_SIDE = 1800;

let workerPromise = null;
let progressHandler = null;

function getWorker() {
  workerPromise ??= (async () => {
    const { default: Tesseract } = await import(/* @vite-ignore */ `${BASE}tesseract.esm.min.js`);
    return Tesseract.createWorker(['rus', 'eng'], Tesseract.OEM.LSTM_ONLY, {
      workerPath: `${BASE}worker.min.js`,
      corePath: BASE,
      langPath: `${BASE}lang`,
      gzip: true,
      workerBlobURL: false,
      cacheMethod: 'none', // the service worker caches the files
      logger: (m) => progressHandler?.(m),
    });
  })().catch((error) => {
    workerPromise = null;
    throw error;
  });
  return workerPromise;
}

/** Free the recognizer's memory (it takes ~100 MB) */
export async function releaseOcr() {
  if (!workerPromise) return;
  const pending = workerPromise;
  workerPromise = null;
  try { (await pending).terminate(); } catch { /* failed to load — nothing to free */ }
}

/** Photo drawn upright (EXIF orientation) with the long side scaled to fit `side` */
function drawPhoto(bitmap, side, allowUpscale) {
  let scale = side / Math.max(bitmap.width, bitmap.height);
  if (!allowUpscale) scale = Math.min(scale, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Grayscale with contrast stretched between the 1st and 99th percentiles — for faded or shadowed labels */
function enhance(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = image.data;
  const histogram = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) {
    const y = Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
    px[i] = y;
    histogram[y]++;
  }
  const total = canvas.width * canvas.height;
  let low = 0;
  let high = 255;
  for (let sum = 0; low < 255 && (sum += histogram[low]) < total * 0.01;) low++;
  for (let sum = 0; high > 0 && (sum += histogram[high]) < total * 0.01;) high--;
  const range = Math.max(high - low, 1);
  for (let i = 0; i < px.length; i += 4) {
    px[i] = px[i + 1] = px[i + 2] = Math.max(0, Math.min(255, ((px[i] - low) * 255) / range));
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/**
 * Black and white by comparing each pixel with the mean of its neighbourhood (Bradley's
 * adaptive threshold): shadows and uneven light across the label stop hiding the print.
 */
function binarize(source) {
  const { width, height } = source;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, width, height);
  const px = image.data;
  // Integral image of luminance
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      row += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + row;
    }
  }
  const half = Math.max(8, Math.round(Math.max(width, height) / 40));
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(height, y + half + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(width, x + half + 1);
      const area = (x1 - x0) * (y1 - y0);
      const sum = integral[y1 * (width + 1) + x1] - integral[y0 * (width + 1) + x1]
        - integral[y1 * (width + 1) + x0] + integral[y0 * (width + 1) + x0];
      const i = (y * width + x) * 4;
      const v = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      px[i] = px[i + 1] = px[i + 2] = v * area < sum * 0.85 ? 0 : 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** The photo as given (only upright and not too large), a contrast-enhanced and a black-and-white copy */
export async function prepareImage(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    .catch(() => createImageBitmap(file));
  const long = Math.max(bitmap.width, bitmap.height);
  const plain = drawPhoto(bitmap, MAX_SIDE, false);
  const enhanced = enhance(drawPhoto(bitmap, Math.min(Math.max(long, ENHANCED_MIN_SIDE), MAX_SIDE), true));
  bitmap.close?.();
  return { plain, enhanced, binary: binarize(enhanced) };
}

const ALL_VALUES = ['kcal', 'protein', 'fat', 'carbs'];

// Calories a label states usually match 4·protein + 9·fat + 4·carbs within this share
const KCAL_MATCH = 0.2;

const kcalMismatch = ({ kcal, protein, fat, carbs }) =>
  Math.abs(kcal - (4 * protein + 9 * fat + 4 * carbs)) / Math.max(kcal, 1);

// Score penalty per step down a candidate list and bonus per extra reading that agrees:
// the calorie balance decides, these only break near-ties
const RANK_PENALTY = 0.04;
const VOTE_BONUS = 0.01;

/**
 * Choose the values from several readings of the same label. Each reading has candidate
 * lists ({ fat: [5.5, 3] … }). A misread digit ("55" for "5,5", "7" for "г") breaks the
 * calorie balance, so the combination whose calories best match 4·P + 9·F + 4·C wins.
 */
export function pickValues(readings) {
  const candidates = {};
  for (const key of ALL_VALUES) {
    const stats = new Map(); // value → { rank, votes }
    for (const reading of readings) {
      (reading[key] ?? []).forEach((value, rank) => {
        const stat = stats.get(value) ?? { rank, votes: 0 };
        stat.rank = Math.min(stat.rank, rank);
        stat.votes++;
        stats.set(value, stat);
      });
    }
    candidates[key] = [...stats].map(([value, { rank, votes }]) => ({ value, weight: rank * RANK_PENALTY - votes * VOTE_BONUS }))
      .sort((a, b) => a.weight - b.weight);
  }
  const result = {};
  for (const key of ALL_VALUES) if (candidates[key].length) result[key] = candidates[key][0].value;
  if (!ALL_VALUES.every((key) => candidates[key].length)) return result;

  let best = result;
  let bestScore = Infinity;
  for (const kcal of candidates.kcal) {
    for (const protein of candidates.protein) {
      for (const fat of candidates.fat) {
        for (const carbs of candidates.carbs) {
          if (protein.value + fat.value + carbs.value > 100) continue;
          const values = { kcal: kcal.value, protein: protein.value, fat: fat.value, carbs: carbs.value };
          const score = kcalMismatch(values) + kcal.weight + protein.weight + fat.weight + carbs.weight;
          if (score < bestScore) {
            best = values;
            bestScore = score;
          }
        }
      }
    }
  }
  return best;
}

/** All four values read and the calories match the macros */
const complete = (values) => ALL_VALUES.every((key) => values[key] != null) && kcalMismatch(values) <= KCAL_MATCH;

/**
 * Recognize a label photo. parse(text) returns candidate values ({ fat: [5.5, 3] … }). Tesseract binarizes the photo
 * itself and usually reads it best as is; while values are missing or the calories don't match
 * the macros, further passes read the black-and-white copy (shadows), as sparse text (tables
 * with wide gaps) and as one block. onProgress({ stage: 'loading' | 'reading', percent }).
 */
export async function readLabelPhoto(file, parse, onProgress) {
  // [image, page layout mode]: 3 — automatic, 11 — sparse text, 6 — one uniform block
  const passes = [['plain', '3'], ['binary', '3'], ['binary', '11'], ['enhanced', '6'], ['plain', '11']];
  let index = 0;
  progressHandler = ({ status, progress }) => {
    if (status === 'recognizing text') {
      // The first pass usually finds everything: give it most of the bar
      const done = index === 0 ? progress * 60 : 60 + ((index - 1 + progress) * 40) / (passes.length - 1);
      onProgress({ stage: 'reading', percent: Math.round(done) });
    } else if (/loading|initializ/.test(status)) {
      onProgress({ stage: 'loading', percent: Math.round(progress * 100) });
    }
  };
  try {
    onProgress({ stage: 'loading', percent: 0 });
    const [worker, images] = await Promise.all([getWorker(), prepareImage(file)]);
    const readings = [];
    for (index = 0; index < passes.length; index++) {
      const [image, layout] = passes[index];
      await worker.setParameters({ tessedit_pageseg_mode: layout, user_defined_dpi: '300' });
      const { data } = await worker.recognize(images[image]);
      readings.push(parse(data.text));
      if (complete(pickValues(readings))) break;
    }
    return pickValues(readings);
  } finally {
    progressHandler = null;
  }
}
