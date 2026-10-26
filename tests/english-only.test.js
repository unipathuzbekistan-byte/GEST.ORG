const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const { translate, locales } = require('../src/i18n');

test('English is the only dictionary and fallback language', () => {
  assert.deepEqual(Object.keys(locales), ['en']);
  assert.equal(fs.existsSync(path.join(root,'locales','uz.json')), false);
  assert.equal(fs.existsSync(path.join(root,'locales','ru.json')), false);
  assert.equal(translate('uz','nav.home'), 'Home');
  assert.equal(translate('ru','verify.title'), 'Verify a GEST result');
  assert.equal(translate('nav.home'), 'Home');
});

test('shell does not offer a language switcher', () => {
  const shell = fs.readFileSync(path.join(root,'views','shell.ejs'),'utf8');
  assert.match(shell, /<html lang="en">/);
  assert.doesNotMatch(shell, /language-switch|\/lang\//);
  const css = fs.readFileSync(path.join(root,'public','css','site.css'),'utf8');
  assert.doesNotMatch(css, /language-switch/);
});

test('application always renders English and does not set a non-English preference', () => {
  const app = fs.readFileSync(path.join(root,'src','app.js'),'utf8');
  assert.match(app, /res\.locals\.locale='en'/);
  assert.doesNotMatch(app, /res\.cookie\('gest_lang'/);
  assert.match(app, /res\.clearCookie\('gest_lang'/);
  assert.match(app, /if \(\/\(\?:\^\|;.*gest_lang=/);
});
