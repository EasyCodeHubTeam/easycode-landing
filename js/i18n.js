// Локализация: русский текст уже лежит в HTML, остальные языки
// подгружаются по требованию и подставляются по атрибутам data-i18n.

import ru from './i18n/ru.js';

export const LANGS = ['ru', 'kk', 'en'];
const loaders = {
  kk: () => import('./i18n/kk.js'),
  en: () => import('./i18n/en.js'),
};

let dict = ru;
let current = 'ru';

const lookup = (obj, path) =>
  path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);

export function t(key) {
  const value = lookup(dict, key) ?? lookup(ru, key);
  return typeof value === 'string' ? value : key;
}

export const getLang = () => current;

export function detectLang() {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (LANGS.includes(fromUrl)) return fromUrl;
  try {
    const saved = localStorage.getItem('lang');
    if (LANGS.includes(saved)) return saved;
  } catch {}
  return 'ru';
}

export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(';').forEach((pair) => {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    });
  });
}

function setMeta(selector, value) {
  document.querySelector(selector)?.setAttribute('content', value);
}

function updateHead() {
  document.documentElement.lang = current;
  document.title = t('meta.title');
  setMeta('meta[name="description"]', t('meta.description'));
  setMeta('meta[property="og:title"]', t('meta.title'));
  setMeta('meta[property="og:description"]', t('meta.description'));
  setMeta('meta[property="og:locale"]', t('meta.ogLocale'));
  setMeta('meta[name="twitter:title"]', t('meta.title'));
  setMeta('meta[name="twitter:description"]', t('meta.description'));
}

export async function setLang(lang, { persist = true } = {}) {
  if (!LANGS.includes(lang)) lang = 'ru';
  if (lang !== current) {
    dict = lang === 'ru' ? ru : (await loaders[lang]()).default;
    current = lang;
    applyTranslations();
    updateHead();
  }

  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang));
  });

  if (persist) {
    try { localStorage.setItem('lang', lang); } catch {}
    const url = new URL(location.href);
    if (lang === 'ru') url.searchParams.delete('lang');
    else url.searchParams.set('lang', lang);
    history.replaceState(null, '', url);
  }

  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}
