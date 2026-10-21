export function validateParameterValues(schema, supplied = {}) {
  const invalid = (message, parameterPath = null) => { throw Object.assign(new Error(message),{parameterPath}); };
  if (!schema || schema.schemaVersion !== 1 || !Array.isArray(schema.parameters)) invalid('Parametre şeması v1 olmalı.');
  if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) invalid('Parametre değerleri bir nesne olmalı.');
  const definitions = new Map(schema.parameters.map(definition => [definition.id, definition]));
  const unknown = Object.keys(supplied).find(id => !definitions.has(id));
  if (unknown) invalid('Bilinmeyen model parametresi gönderildi.',unknown);
  return Object.fromEntries(schema.parameters.map(definition => {
    const value = supplied[definition.id] ?? definition.default;
    if (definition.type === 'boolean') {
      if (typeof value !== 'boolean') invalid(`${definition.label}: true/false gerekli.`,definition.id);
    } else if (definition.type === 'enum') {
      if (!Array.isArray(definition.options) || !definition.options.includes(value)) invalid(`${definition.label}: seçeneklerden biri gerekli.`,definition.id);
    } else if (definition.type === 'number' || definition.type === 'angle') {
      const { min, max, step } = definition;
      const steps = (value - min) / step;
      if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(step) || step <= 0 || value < min || value > max || Math.abs(steps - Math.round(steps)) > 1e-8) invalid(`${definition.label}: ${min}–${max} ${definition.unit || ''}, ${step} ${definition.unit || ''} adımlarla girilmeli.`,definition.id);
    } else invalid(`${definition.label}: desteklenmeyen parametre türü.`,definition.id);
    return [definition.id, value];
  }));
}
