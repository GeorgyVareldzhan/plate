import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const OUT_DIR = 'dist';

/** All files under dir, as paths relative to it with forward slashes */
function listFiles(dir, root = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path, root) : [relative(root, path).split(sep).join('/')];
  });
}

/**
 * Fills the service worker template (public/sw.js) with the list of app files to precache and a
 * version made of their contents: any change to the app yields a new service worker, so phones
 * pick up the update. Tesseract stays out — it is cached on first use (see sw.js).
 */
function serviceWorkerManifest() {
  return {
    name: 'service-worker-manifest',
    apply: 'build',
    closeBundle() {
      const files = listFiles(OUT_DIR)
        .filter((file) => file !== 'sw.js' && !file.startsWith('vendor/tesseract/'))
        .sort();
      const hash = createHash('sha256');
      for (const file of files) hash.update(file).update(readFileSync(join(OUT_DIR, file)));
      const version = hash.digest('hex').slice(0, 12);
      const assets = ['./', ...files];
      const swPath = join(OUT_DIR, 'sw.js');
      const sw = readFileSync(swPath, 'utf8')
        .replace("'__VERSION__'", JSON.stringify(version))
        .replace('[/* __ASSETS__ */]', JSON.stringify(assets, null, 2));
      writeFileSync(swPath, sw);
    },
  };
}

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  // Relative paths: the app lives in a subfolder on GitHub Pages (/plate/)
  base: './',
  build: {
    outDir: `../${OUT_DIR}`,
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000, // kB; most of it is the Firebase SDK
  },
  server: { port: 8080 },
  // Images in templates (icons/…) are static files from public/, not modules to import
  plugins: [vue({ template: { transformAssetUrls: false } }), serviceWorkerManifest()],
});
