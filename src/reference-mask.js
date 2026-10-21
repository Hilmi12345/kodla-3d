import pngjs from 'pngjs';
import jpeg from 'jpeg-js';

const { PNG } = pngjs;
const PNG_SIGNATURE = Buffer.from([137,80,78,71,13,10,26,10]);
const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const DEFAULT_MAX_PIXELS = 16_777_216;

function validateImage(image, maxPixels = DEFAULT_MAX_PIXELS) {
  const { width, height, data } = image || {};
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > maxPixels) {
    throw new Error(`Referans görsel boyutu geçersiz veya ${maxPixels.toLocaleString('tr-TR')} piksel sınırını aşıyor.`);
  }
  if (!(data instanceof Uint8Array) || data.byteLength !== width * height * 4) throw new Error('Referans görseli RGBA piksel verisi tutarsız.');
  return { width, height, data };
}

/** PNG/JPEG dosyasını piksel üst sınırıyla 8-bit RGBA'ya çözer. */
export function decodeReferenceImage(bytes, { maxPixels = DEFAULT_MAX_PIXELS } = {}) {
  const input = Buffer.from(bytes || []);
  if (!input.length || input.length > MAX_INPUT_BYTES) throw new Error(`Referans dosyası boş veya ${MAX_INPUT_BYTES / 1024 / 1024} MiB sınırını aşıyor.`);
  let decoded;
  if (input.length >= 24 && input.subarray(0, 8).equals(PNG_SIGNATURE)) {
    const width = input.readUInt32BE(16), height = input.readUInt32BE(20);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > maxPixels) throw new Error(`PNG referansı ${maxPixels.toLocaleString('tr-TR')} piksel sınırını aşıyor.`);
    decoded = PNG.sync.read(input, { checkCRC: true });
  } else if (input[0] === 0xff && input[1] === 0xd8) {
    decoded = jpeg.decode(input, { useTArray: true, formatAsRGBA: true, tolerantDecoding: false, maxResolutionInMP: maxPixels / 1_000_000, maxMemoryUsageInMB: 128 });
  } else throw new Error('Referans biçimi desteklenmiyor; PNG veya JPEG seçin.');
  return validateImage(decoded, maxPixels);
}

/** Hazır siyah/beyaz maskede varsayılan olarak beyaz piksel modeldir. */
export function maskFromBilevel(image, { threshold = 127, invert = false } = {}) {
  const { width, height, data } = validateImage(image);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 255) throw new Error('Maske eşiği 0–255 arasında olmalı.');
  const mask = new Uint8Array(width * height);
  for (let pixel = 0; pixel < mask.length; pixel++) {
    const offset = pixel * 4, luminance = data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
    const foreground = data[offset + 3] >= 128 && luminance >= threshold;
    mask[pixel] = (invert ? !foreground && data[offset + 3] >= 128 : foreground) ? 1 : 0;
  }
  return mask;
}

/** Dört köşeden arka plan rengini örnekleyip renk farkı üstündeki pikselleri model sayar. */
export function maskFromColorKey(image, { threshold = 48 } = {}) {
  const { width, height, data } = validateImage(image);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 442) throw new Error('Renk anahtarı eşiği 0–442 arasında olmalı.');
  const cornerIndexes = [...new Set([0, width - 1, (height - 1) * width, height * width - 1])];
  const opaqueCorners = cornerIndexes.filter(index => data[index * 4 + 3] >= 128);
  if (!opaqueCorners.length) throw new Error('Arka plan rengi için en az bir köşe pikseli opak olmalı.');
  const medianChannel = channel => {
    const values = opaqueCorners.map(index => data[index * 4 + channel]).sort((a,b)=>a-b);
    const middle = Math.floor(values.length / 2);
    return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  };
  const background = [0,1,2].map(medianChannel),mask = new Uint8Array(width * height);
  for (let pixel = 0; pixel < mask.length; pixel++) {
    const offset = pixel * 4;
    const distance = Math.hypot(data[offset] - background[0], data[offset + 1] - background[1], data[offset + 2] - background[2]);
    mask[pixel] = data[offset + 3] >= 128 && distance > threshold ? 1 : 0;
  }
  return mask;
}

/** Piksel merkezlerinde even-odd testiyle kapalı poligonu ikili maskeye çevirir. */
export function maskFromPolygon(width, height, points) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > DEFAULT_MAX_PIXELS) throw new Error('Poligon maskesi boyutu geçersiz veya piksel sınırını aşıyor.');
  if (!Array.isArray(points) || points.length < 3 || points.length > 10000 || points.some(point => !Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite))) throw new Error('Kapalı poligon en az 3 adet sonlu [x,y] noktası içermeli.');
  if (points.some(([x,y]) => x < 0 || x > width || y < 0 || y > height)) throw new Error('Poligon noktaları görsel sınırları içinde olmalı.');
  const mask = new Uint8Array(width * height),minX=Math.max(0,Math.floor(Math.min(...points.map(point=>point[0])))),maxX=Math.min(width-1,Math.ceil(Math.max(...points.map(point=>point[0])))-1),minY=Math.max(0,Math.floor(Math.min(...points.map(point=>point[1])))),maxY=Math.min(height-1,Math.ceil(Math.max(...points.map(point=>point[1])))-1);
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
    const px=x+0.5,py=y+0.5;let inside=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const [xi,yi]=points[i],[xj,yj]=points[j];
      if((yi>py)!==(yj>py)&&px<(xj-xi)*(py-yi)/(yj-yi)+xi)inside=!inside;
    }
    if(inside)mask[y*width+x]=1;
  }
  return mask;
}

