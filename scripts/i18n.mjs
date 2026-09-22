#!/usr/bin/env node
// Проверка переводов (не шаг сборки — сайт работает и без этого скрипта).
//
//   node scripts/i18n.mjs        — проверить, что во всех языках одинаковые ключи,
//                                  а русский текст в index.html совпадает с ru.js
//   node scripts/i18n.mjs --fix  — переписать русский текст в index.html из ru.js
//
// Элементы с data-i18n должны содержать только текст, без вложенных тегов.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Словари — ES-модули без package.json; глушим предупреждение Node о типе модуля
process.removeAllListeners('warning');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fix = process.argv.includes('--fix');
const langs = ['ru', 'kk', 'en'];

const dicts = Object.fromEntries(
  await Promise.all(langs.map(async (l) => [l, (await import(path.join(root, 'js/i18n', `${l}.js`))).default])),
);

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]);

const flat = Object.fromEntries(langs.map((l) => [l, Object.fromEntries(flatten(dicts[l]))]));
const problems = [];

// 1. Одинаковые ключи во всех языках
const ruKeys = Object.keys(flat.ru);
for (const l of langs.slice(1)) {
  for (const k of ruKeys) if (!(k in flat[l])) problems.push(`${l}.js: нет ключа ${k}`);
  for (const k of Object.keys(flat[l])) if (!(k in flat.ru)) problems.push(`${l}.js: лишний ключ ${k}`);
}

// 2. index.html ↔ ru.js
const htmlPath = path.join(root, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const encodeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const encodeAttr = (s) => encodeText(s).replace(/"/g, '&quot;');
let fixed = 0;

html = html.replace(/(data-i18n="([^"]+)"[^>]*>)([^<]*)(<)/g, (m, open, key, text, close) => {
  if (!(key in flat.ru)) { problems.push(`index.html: ключа ${key} нет в ru.js`); return m; }
  if (decode(text) === flat.ru[key]) return m;
  if (fix) { fixed++; return open + encodeText(flat.ru[key]) + close; }
  problems.push(`index.html: текст ${key} отличается от ru.js`);
  return m;
});

html = html.replace(/<[^>]*data-i18n-attr="([^"]+)"[^>]*>/g, (tag, spec) => {
  let out = tag;
  for (const pair of spec.split(';')) {
    const [attr, key] = pair.split(':').map((s) => s.trim());
    if (!(key in flat.ru)) { problems.push(`index.html: ключа ${key} нет в ru.js`); continue; }
    const re = new RegExp(`(\\s${attr}=")([^"]*)(")`);
    const current = out.match(re);
    if (current && decode(current[2]) === flat.ru[key]) continue;
    if (fix && current) { fixed++; out = out.replace(re, `$1${encodeAttr(flat.ru[key])}$3`); continue; }
    problems.push(`index.html: атрибут ${attr} (${key}) отличается от ru.js`);
  }
  return out;
});

if (fix && fixed) {
  fs.writeFileSync(htmlPath, html);
  console.log(`Обновлено в index.html: ${fixed}`);
}

if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`✓ Переводы в порядке (ключей: ${ruKeys.length}, языков: ${langs.length})`);
