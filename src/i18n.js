// GEST uses English as the single interface language. Keep t(key) support
// so existing EJS templates remain compatible without locale selection.
const path = require('node:path');
const fs = require('node:fs');
const en = Object.freeze(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', 'en.json'), 'utf8')));
const locales = Object.freeze({ en });
function translate(langOrKey, optionalKey) {
  const key = optionalKey === undefined ? langOrKey : optionalKey;
  if (typeof key !== 'string') return '';
  const value = key.split('.').reduce((item, segment) => item?.[segment], en);
  return typeof value === 'string' ? value : key;
}
module.exports = { translate, locales };
