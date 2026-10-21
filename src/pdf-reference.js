import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';

const MAX_PAGES = 500;
const MAX_PIXELS = 16_000_000;

export async function renderPdfPage(buffer, pageNumber = 1, scale = 1.5) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw Object.assign(new Error('Dosya geçerli bir PDF değil.'), { status: 400, code: 'INVALID_PDF' });
  }
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw Object.assign(new Error('Sayfa numarası 1 veya daha büyük bir tam sayı olmalı.'), { status: 400, code: 'INVALID_PDF_PAGE' });
  }
  if (!Number.isFinite(scale) || scale < 0.5 || scale > 3) {
    throw Object.assign(new Error('Ölçek 0.5 ile 3 arasında olmalı.'), { status: 400, code: 'INVALID_PDF_SCALE' });
  }
  let document;
  try {
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, isEvalSupported: false });
    document = await loadingTask.promise;
    if (document.numPages > MAX_PAGES) throw Object.assign(new Error(`PDF en fazla ${MAX_PAGES} sayfa olabilir.`), { status: 413, code: 'PDF_PAGE_LIMIT' });
    if (pageNumber > document.numPages) throw Object.assign(new Error(`PDF ${document.numPages} sayfa; istenen sayfa aralık dışında.`), { status: 400, code: 'PDF_PAGE_OUT_OF_RANGE' });
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const width = Math.ceil(viewport.width), height = Math.ceil(viewport.height);
    if (width * height > MAX_PIXELS) throw Object.assign(new Error(`Sayfa çözünürlüğü ${MAX_PIXELS} piksel sınırını aşıyor; ölçeği düşürün.`), { status: 413, code: 'PDF_PAGE_TOO_LARGE' });
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    await page.render({ canvasContext: context, viewport, canvasFactory: {
      create(w, h) { const c = createCanvas(w, h); return { canvas: c, context: c.getContext('2d') }; },
      reset(pair, w, h) { pair.canvas.width = w; pair.canvas.height = h; },
      destroy(pair) { pair.canvas.width = 0; pair.canvas.height = 0; pair.canvas = null; pair.context = null; },
    } }).promise;
    return { png: canvas.toBuffer('image/png'), width, height, pageNumber, pageCount: document.numPages };
  } catch (error) {
    if (error.code) throw error;
    const message = String(error?.message || error);
    const password = /password/i.test(message);
    throw Object.assign(new Error(password ? 'Şifreli PDF desteklenmiyor.' : `PDF sayfası okunamadı: ${message}`), { status: 400, code: password ? 'PDF_PASSWORD_REQUIRED' : 'PDF_RENDER_FAILED' });
  } finally {
    await document?.destroy();
  }
}
