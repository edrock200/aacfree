import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';
import type { Lang } from '../i18n';
import type { OcrLine, Rect } from './boardimport';

/**
 * On-device text recognition (tesseract.js, Apache-2.0) for "Import a board from a picture".
 * Loaded only through a dynamic import, so it lives in its own chunk.
 *
 * Every file comes from this app's own origin (public/ocr, copied by scripts/copy-ocr.mjs): the
 * worker script, the SIMD LSTM WASM core and the language data. The worker is a plain same-origin
 * script (no blob: URL), nothing is cached in IndexedDB, and nothing is fetched from a CDN, so it
 * works offline on the web and in the Android app. The picture never leaves the device.
 */

/** Tesseract model for each communication language. */
export const OCR_LANG: Record<Lang, string> = { en: 'eng', es: 'spa', fr: 'fra', pt: 'por' };

/** Models to load: the communication language plus English (labels in other apps are often English). */
export const ocrLangs = (lang: Lang): string[] => (lang === 'en' ? ['eng'] : [OCR_LANG[lang] ?? 'eng', 'eng']);

export interface ReadResult { lines: (OcrLine & { box: Rect })[] }

export interface Reader {
  read: (image: HTMLCanvasElement) => Promise<ReadResult>;
  terminate: () => Promise<void>;
}

const local = (file: string) => new URL(`${import.meta.env.BASE_URL}ocr/${file}`, window.location.href).href;

/** Start one OCR worker (reused for every cell; terminate it when done). */
export async function createReader(lang: Lang, onLoading?: (progress: number) => void): Promise<Reader> {
  const worker: Worker = await createWorker(ocrLangs(lang), OEM.LSTM_ONLY, {
    workerPath: local('worker.min.js'),
    corePath: local('tesseract-core-simd-lstm.js'),
    langPath: local('').replace(/\/$/, ''),
    workerBlobURL: false,
    cacheMethod: 'none',
    // The files are named <lang>.traineddata but hold the gzip-compressed data, which tesseract.js
    // detects and inflates (a ".gz" name would not survive the Android build; see copy-ocr.mjs).
    gzip: false,
    logger: (m) => { if (m.status.startsWith('load') && onLoading) onLoading(m.progress); },
  });
  // Sparse text: find the label wherever it is on the tile, without reading the picture as a block
  // of text (on synthetic and real boards this reads labels next to busy pictures far better than
  // SINGLE_BLOCK). No character whitelist, so accents and apostrophes stay.
  // A fixed resolution stops Tesseract estimating one (and logging it) for every cell.
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: '1', user_defined_dpi: '300' });
  return {
    async read(image) {
      const { data } = await worker.recognize(image, {}, { text: true, blocks: true });
      const lines: ReadResult['lines'] = [];
      for (const block of data.blocks ?? []) for (const para of block.paragraphs) for (const line of para.lines) {
        lines.push({
          text: line.text,
          confidence: line.confidence,
          box: { x: line.bbox.x0, y: line.bbox.y0, w: line.bbox.x1 - line.bbox.x0, h: line.bbox.y1 - line.bbox.y0 },
        });
      }
      // Reading order: top to bottom, then left to right.
      lines.sort((a, b) => (Math.abs(a.box.y - b.box.y) > Math.min(a.box.h, b.box.h) / 2 ? a.box.y - b.box.y : a.box.x - b.box.x));
      return { lines };
    },
    terminate: () => worker.terminate().then(() => undefined),
  };
}
