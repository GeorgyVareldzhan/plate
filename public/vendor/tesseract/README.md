# Tesseract (vendored)

On-device text recognition for label photos. Loaded only when the user takes a photo;
the service worker caches these files on first use, so recognition then works offline.

- `tesseract.esm.min.js`, `worker.min.js` — tesseract.js 7.0.0 (Apache-2.0, see LICENSE)
- `tesseract-core-*-lstm.wasm.js` — tesseract.js-core 7.0.0, LSTM-only builds
  (plain, SIMD and relaxed SIMD; the worker picks the one the device supports)
- `lang/*.traineddata.gz` — Russian and English models, `4.0.0_best_int`
  (the accurate "best" models in integer form)
