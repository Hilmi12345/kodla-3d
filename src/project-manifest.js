import { validateParameterValues } from './parameter-schema.js';

function validReference(ref) {
  if(typeof ref?.path!=='string'||!ref.path||ref.path.startsWith('/')||/^[a-z]+:/i.test(ref.path)||ref.path.split(/[\\/]/).includes('..'))return false;
  if(ref.sha256!==undefined&&!/^[a-f0-9]{64}$/i.test(ref.sha256))return false;
  if(ref.data!==undefined&&(typeof ref.data!=='string'||ref.data.length>36_000_000||!/^data:image\/(?:png|jpeg);base64,/i.test(ref.data)))return false;
  if(ref.camera!==undefined&&!['front','side','top'].includes(ref.camera))return false;
  if(ref.polygon!==undefined){if(!Array.isArray(ref.polygon)||ref.polygon.length>10000)return false;if(ref.polygon.length&&(!Number.isInteger(ref.imageWidth)||!Number.isInteger(ref.imageHeight)||ref.imageWidth<1||ref.imageHeight<1||ref.polygon.some(point=>!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite)||point[0]<0||point[0]>ref.imageWidth||point[1]<0||point[1]>ref.imageHeight)))return false;}
  const measurements=ref.measurements;
  if(measurements!==undefined){if(!measurements||typeof measurements!=='object')return false;for(const key of ['genislikMm','yukseklikMm','derinlikMm'])if(measurements[key]!==undefined&&(!Number.isFinite(measurements[key])||measurements[key]<=0))return false;if(measurements.aciDeg!==undefined&&!Number.isFinite(measurements.aciDeg))return false;}
  return true;
}

export function validateProjectDocument(value, samples) {
  if (!value || value.format !== 'kodla3d-project' || value.projectVersion !== 1 || typeof value.model?.source !== 'string') throw new Error('Bu dosya geçerli Kodla 3D proje manifest’i değil (v1 gerekli).');
  if (value.model.source.length > 100000) throw new Error('Manifest kaynak kodu 100 KB sınırını aşıyor.');
  if (!value.model.source.trim()) throw new Error('Proje kaynak kodu boş olamaz.');
  if (!['cad', 'organic'].includes(value.model.mode) || !['taslak', 'normal', 'ince'].includes(value.model.quality)) throw new Error('Manifest içindeki motor modu veya kalite tanınmıyor.');
  if (value.model.cadMeshQuality !== undefined && !['taslak', 'normal', 'ince'].includes(value.model.cadMeshQuality)) throw new Error('Manifest içindeki CAD ağ ayarı tanınmıyor.');
  if (!value.engine || typeof value.engine.cad !== 'string' || typeof value.engine.organic !== 'string' || !Number.isInteger(value.engine.resultSchemaVersion) || !Number.isInteger(value.engine.apiVersion)) throw new Error('Manifest motor/API sürüm bilgisi eksik.');
  if (!value.metadata || typeof value.metadata.name !== 'string' || !value.metadata.name.trim() || value.metadata.name.length > 64 || /[<>:"/\\|?*\u0000-\u001F]/.test(value.metadata.name)) throw new Error('Proje adı boş, uzun veya dosya adı olarak geçersiz.');
  if (!['iso', 'front', 'back', 'right', 'left', 'top'].includes(value.view?.camera) || !['perspective', 'orthographic'].includes(value.view?.projection)) throw new Error('Manifest içindeki kamera ayarı tanınmıyor.');
  if (!Array.isArray(value.references) || value.references.length > 3 || value.references.some(ref=>!validReference(ref))) throw new Error('En fazla üç referans dosyası; referans yolları proje içindeki göreli dosyalar, SHA-256, görsel verisi, kamera ve ölçüler geçerli olmalı.');
  if (value.model.example && !samples.some(sample => sample.name === value.model.example)) throw new Error(`Örnek “${value.model.example}” bu uygulama sürümünde bulunamadı; dosya açılmadı.`);
  const sample = samples.find(item => item.name === value.model.example);
  if (sample && sample.mode !== value.model.mode) throw new Error('Manifest motor modu seçilen örneğin motoruyla eşleşmiyor.');
  const supplied = value.model.parameters ?? {};
  let normalized = {};
  if (sample?.parameterSchema) normalized = validateParameterValues(sample.parameterSchema, supplied);
  else if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied) || Object.keys(supplied).length) throw new Error('Manifest parametreleri bu örneğin şemasıyla eşleşmiyor.');
  const versions = value.versions ?? [];
  if (!Array.isArray(versions) || versions.length > 10) throw new Error('Başarılı sürüm geçmişi en fazla 10 kayıt içermeli.');
  const cleanVersions = versions.map((version, index) => {
    const model = version?.model;
    if (typeof version?.id !== 'string' || !version.id || version.id.length > 110000 || typeof version.label !== 'string' || version.label.length > 256 || typeof version.savedAt !== 'string' || !Number.isFinite(Date.parse(version.savedAt))) throw new Error(`Sürüm geçmişi ${index + 1}. kayıt metadata bilgisi geçersiz.`);
    if (typeof model?.source !== 'string' || !model.source.trim() || model.source.length > 100000 || !['cad', 'organic'].includes(model.mode) || !['taslak', 'normal', 'ince'].includes(model.quality)) throw new Error(`Sürüm geçmişi ${index + 1}. kayıt kaynak veya motor bilgisi geçersiz.`);
    const priorSample = samples.find(item => item.name === model.example);
    if (model.example && !priorSample) throw new Error(`Sürüm geçmişi ${index + 1}. kayıt örneği bu uygulamada yok.`);
    if (priorSample && priorSample.mode !== model.mode) throw new Error(`Sürüm geçmişi ${index + 1}. kayıt motor modu örnekle uyuşmuyor.`);
    const values = model.parameters ?? {};
    let priorParameters = {};
    if (priorSample?.parameterSchema) priorParameters = validateParameterValues(priorSample.parameterSchema, values);
    else if (!values || typeof values !== 'object' || Array.isArray(values) || Object.keys(values).length) throw new Error(`Sürüm geçmişi ${index + 1}. kayıt parametreleri geçersiz.`);
    const result = version.result ?? {};
    if (result.sourceHash !== undefined && !/^[a-f0-9]{64}$/i.test(result.sourceHash)) throw new Error(`Sürüm geçmişi ${index + 1}. kayıt kaynak hash'i geçersiz.`);
    if (!Array.isArray(result.size) || result.size.length !== 3 || !result.size.every(value => Number.isFinite(value) && value > 0) || !Number.isFinite(result.volume) || result.volume <= 0) throw new Error(`Sürüm geçmişi ${index + 1}. kayıt ölçü/hacim sonucu geçersiz.`);
    if (model.cadMeshQuality !== undefined && !['taslak', 'normal', 'ince'].includes(model.cadMeshQuality)) throw new Error(`Sürüm geçmişi ${index + 1}. kayıt CAD ağ ayarı geçersiz.`);
    return { ...version, model: { ...model, cadMeshQuality: model.cadMeshQuality || 'normal', parameters: priorParameters } };
  });
  if (new TextEncoder().encode(JSON.stringify(cleanVersions)).length > 700000) throw new Error('Başarılı sürüm geçmişi 700 KB sınırını aşıyor.');
  return { ...value, model: { ...value.model, cadMeshQuality: value.model.cadMeshQuality || 'normal', parameters: normalized }, versions: cleanVersions };
}
