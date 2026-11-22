/**
 * "Share day": an image of the day menu with portions — e.g. to send to whoever is cooking.
 *
 * Drawn on a canvas and handed straight to the system share sheet. Everything runs synchronously in the
 * tap handler: Safari allows navigator.share() only right after a user gesture.
 */
import { portion, sumNutrition, targetStatus } from './calc.js';
import { fmt0, fmt1 } from './dom.js';
import { productIcon, renderIcon } from './icons.js';

// Preload the logo so it is ready by the time of the tap
const logo = new Image();
logo.src = 'icons/icon-192.png';

const W = 1080;
const PAD = 56;
const CARD_X = PAD;
const CARD_W = W - PAD * 2;
const ROW_H = 118;
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif';
const EMOJI_FONT = '"Apple Color Emoji", "Noto Color Emoji", "Segoe UI Emoji", sans-serif';

// Always light theme: the image must be readable in any messenger
const C = {
  bg: '#f2f2f7', card: '#ffffff', text: '#000000', muted: '#6e6e73', sep: '#e5e5ea', tileBg: '#f2f2f7',
  ok: '#248a3d', bad: '#ff3b30', neutral: '#000000', protein: '#5e5ce6', fat: '#ff9f0a', carbs: '#32ade6',
};

const font = (size, weight = 400) => `${weight} ${size}px ${FONT}`;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Truncate a string with an ellipsis to fit the width */
function fit(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

/** Word-wrap a string into 2 lines to fit the width; the second gets an ellipsis if space runs out */
function wrap2(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return [text];
  const words = text.split(' ');
  let first = '';
  for (const word of words) {
    const next = first ? `${first} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth) break;
    first = next;
  }
  if (!first) return [fit(ctx, text, maxWidth)];
  return [first, fit(ctx, text.slice(first.length).trim(), maxWidth)];
}

/** Quantity in the form convenient for measuring: "3 pcs · 165 g" or "250 g" */
function amountText(item, product) {
  const grams = `${fmt0.format(item.grams)} г`;
  if (item.unit === 'pcs' && product?.pieceGrams > 0) {
    return `${fmt1.format(item.grams / product.pieceGrams)} шт · ${grams}`;
  }
  return grams;
}

const statusColor = (status) => (status === 'ok' ? C.ok : status === 'bad' ? C.bad : C.neutral);

/**
 * Draw the day card.
 * day — { targets, meals }, productsById — Map, date — date label ("Saturday, 22 November 2026").
 */
export function renderDayImage({ day, productsById, date }) {
  const meals = day.meals
    .map((meal, index) => ({ index, items: meal.items.filter((i) => i.grams > 0) }))
    .filter((m) => m.items.length);

  const HEADER_H = 200;
  const SUMMARY_H = 280;
  const MEAL_HEAD_H = 84;
  const FOOTER_H = 110;
  const LINE2_H = 46; // extra row height when the name wraps to 2 lines

  // Lay out rows up front: long names wrap and the row gets taller
  const measure = document.createElement('canvas').getContext('2d');
  for (const meal of meals) {
    meal.rows = meal.items.map((item) => {
      const product = productsById.get(item.productId);
      const amount = amountText(item, product);
      measure.font = font(44, 700);
      const aw = measure.measureText(amount).width;
      measure.font = font(38, 500);
      const textW = CARD_W - 128 - 36 - aw - 24;
      const lines = wrap2(measure, product?.name ?? 'Продукт удалён', textW);
      return { item, product, amount, aw, textW, lines, h: ROW_H + (lines.length - 1) * LINE2_H };
    });
    meal.h = meal.rows.reduce((sum, r) => sum + r.h, 0);
  }
  const mealsH = meals.reduce((sum, m) => sum + MEAL_HEAD_H + m.h + 40, 0);
  const H = HEADER_H + SUMMARY_H + (meals.length ? mealsH : 160) + FOOTER_H;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // --- Header: logo, Plate, date
  let y = PAD;
  if (logo.complete && logo.naturalWidth) {
    ctx.save();
    roundRect(ctx, PAD, y, 88, 88, 20);
    ctx.clip();
    ctx.drawImage(logo, PAD, y, 88, 88);
    ctx.restore();
  }
  ctx.fillStyle = C.text;
  ctx.font = font(46, 700);
  ctx.fillText('Plate', PAD + 112, y + 40);
  ctx.fillStyle = C.muted;
  ctx.font = font(34, 400);
  ctx.fillText(fit(ctx, date, CARD_W - 112), PAD + 112, y + 84);
  y = HEADER_H;

  // --- Day total
  const t = sumNutrition(day.meals.flatMap((m) => m.items), productsById);
  const targets = day.targets ?? {};
  roundRect(ctx, CARD_X, y, CARD_W, SUMMARY_H - 40, 28); // 240
  ctx.fillStyle = C.card;
  ctx.fill();

  ctx.fillStyle = statusColor(targetStatus('kcal', t.kcal, targets.kcal));
  ctx.font = font(76, 700);
  const kcalText = fmt0.format(t.kcal);
  ctx.fillText(kcalText, CARD_X + 40, y + 104);
  const kcalW = ctx.measureText(kcalText).width;
  ctx.fillStyle = C.muted;
  ctx.font = font(36, 400);
  ctx.fillText(targets.kcal ? ` из ${fmt0.format(targets.kcal)} ккал` : ' ккал', CARD_X + 40 + kcalW, y + 104);

  const macros = [['protein', 'Белки'], ['fat', 'Жиры'], ['carbs', 'Углеводы']];
  const colW = (CARD_W - 80) / 3;
  macros.forEach(([key, label], i) => {
    const x = CARD_X + 40 + i * colW;
    ctx.fillStyle = C[key];
    ctx.beginPath();
    ctx.arc(x + 9, y + 160, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.muted;
    ctx.font = font(28, 500);
    ctx.fillText(label, x + 28, y + 170);
    ctx.fillStyle = statusColor(targetStatus(key, t[key], targets[key]));
    ctx.font = font(36, 700);
    const v = fmt0.format(t[key]);
    ctx.fillText(v, x, y + 216);
    if (targets[key]) {
      const vw = ctx.measureText(v).width;
      ctx.fillStyle = C.muted;
      ctx.font = font(28, 400);
      ctx.fillText(` / ${fmt0.format(targets[key])} г`, x + vw, y + 216);
    }
  });
  y += SUMMARY_H;

  // --- Meals
  if (!meals.length) {
    ctx.fillStyle = C.muted;
    ctx.font = font(36, 400);
    ctx.fillText('В этом дне пока нет продуктов', CARD_X + 8, y + 60);
    y += 160;
  }

  for (const meal of meals) {
    const mt = sumNutrition(meal.items, productsById);
    ctx.fillStyle = C.text;
    ctx.font = font(44, 700);
    ctx.fillText(`Приём ${meal.index + 1}`, CARD_X + 8, y + 52);
    ctx.fillStyle = C.muted;
    ctx.font = font(32, 400);
    const mk = `${fmt0.format(mt.kcal)} ккал`;
    ctx.fillText(mk, CARD_X + CARD_W - 8 - ctx.measureText(mk).width, y + 52);
    y += MEAL_HEAD_H;

    const cardH = meal.h;
    roundRect(ctx, CARD_X, y, CARD_W, cardH, 28);
    ctx.fillStyle = C.card;
    ctx.fill();

    let ry = y;
    meal.rows.forEach((row, i) => {
      const { item, product, amount, aw, textW, lines, h } = row;
      const extra = h - ROW_H; // offset for the second line of the name
      if (i) {
        ctx.fillStyle = C.sep;
        ctx.fillRect(CARD_X + 128, ry, CARD_W - 128, 2);
      }
      // icon
      roundRect(ctx, CARD_X + 32, ry + 23 + extra / 2, 72, 72, 18);
      ctx.fillStyle = C.tileBg;
      ctx.fill();
      ctx.font = `44px ${EMOJI_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(renderIcon(productIcon(product ?? { name: '' })), CARD_X + 68, ry + 75 + extra / 2);
      ctx.textAlign = 'left';

      // quantity — large, on the right
      ctx.fillStyle = C.text;
      ctx.font = font(44, 700);
      ctx.fillText(amount, CARD_X + CARD_W - 36 - aw, ry + 74 + extra / 2);

      // name (1–2 lines) and calories
      const textX = CARD_X + 128;
      ctx.fillStyle = C.text;
      ctx.font = font(38, 500);
      lines.forEach((line, li) => ctx.fillText(line, textX, ry + 56 + li * LINE2_H));
      if (product) {
        ctx.fillStyle = C.muted;
        ctx.font = font(28, 400);
        const p = portion(product, item.grams);
        ctx.fillText(fit(ctx, `${fmt0.format(p.kcal)} ккал · Б ${fmt1.format(p.protein)} · Ж ${fmt1.format(p.fat)} · У ${fmt1.format(p.carbs)}`, textW), textX, ry + 94 + extra);
      }
      ry += h;
    });
    y += cardH + 40;
  }

  // --- Footer
  ctx.fillStyle = C.muted;
  ctx.font = font(28, 400);
  ctx.textAlign = 'center';
  ctx.fillText('Plate — граммовки под калораж', W / 2, H - 48);
  ctx.textAlign = 'left';

  return canvas;
}

/** canvas → File synchronously (toBlob is async, but share() must be called right after the tap) */
export function canvasToFile(canvas, name) {
  const dataUrl = canvas.toDataURL('image/png');
  const bytes = atob(dataUrl.split(',')[1]);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
  return new File([buffer], name, { type: 'image/png' });
}

/** System share sheet; if unavailable (desktop), download the file */
export function shareFile(file, title) {
  const download = () => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  if (navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file], title }).catch((e) => {
      if (e.name !== 'AbortError') download();
    });
  } else {
    download();
  }
}
