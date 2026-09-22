// Портфолио рендерится из data/projects.json.
// Проекты с "draft": true скрыты; посмотреть их можно по адресу /?drafts=1.

import { t, getLang } from './i18n.js';

const TYPES = ['mobile', 'backend', 'bot'];
const TYPE_LABEL = { mobile: 'portfolio.typeMobile', backend: 'portfolio.typeBackend', bot: 'portfolio.typeBot' };
const FILTER_LABEL = { all: 'portfolio.all', mobile: 'portfolio.mobile', backend: 'portfolio.backend', bot: 'portfolio.bot' };
const LINKS = ['appstore', 'googleplay', 'github', 'demo'];

let projects = [];
let activeFilter = 'all';

// Поле может быть строкой или объектом { ru, kk, en }
const loc = (value) =>
  typeof value === 'string' ? value : (value?.[getLang()] || value?.ru || '');

const isSafeUrl = (url) => /^https?:\/\//i.test(url || '');

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function renderCard(p) {
  const card = el('article', 'card project');
  card.dataset.type = p.type;

  const media = el('div', 'media media--16x10');
  media.dataset.slot = `projects/${p.id} · 1200×750`;
  if (p.image) {
    const img = el('img');
    img.src = p.image;
    img.width = 1200;
    img.height = 750;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = loc(p.title);
    img.addEventListener('error', () => media.classList.add('is-missing'));
    media.append(img);
  } else {
    media.classList.add('is-missing');
  }

  const body = el('div', 'project__body');
  const type = el('p', 'project__type', t(TYPE_LABEL[p.type]));
  if (p.draft) type.append(el('span', 'project__draft', t('portfolio.draft')));
  body.append(type, el('h3', 'project__title', loc(p.title)), el('p', 'project__text', loc(p.description)));

  if (p.result) {
    const result = el('p', 'project__result');
    result.append(el('strong', null, `${t('portfolio.result')}: `), loc(p.result));
    body.append(result);
  }

  if (Array.isArray(p.stack) && p.stack.length) {
    const tags = el('ul', 'tags');
    tags.setAttribute('aria-label', t('portfolio.stack'));
    p.stack.forEach((name) => tags.append(el('li', 'tag', name)));
    body.append(tags);
  }

  const links = LINKS.filter((k) => isSafeUrl(p.links?.[k]));
  if (links.length) {
    const wrap = el('div', 'project__links');
    links.forEach((k) => {
      const a = el('a', null, t(`portfolio.${k}`));
      a.href = p.links[k];
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.insertAdjacentHTML('beforeend',
        '<svg class="icon" aria-hidden="true"><use href="assets/icons/sprite.svg#i-arrow-up-right"></use></svg>');
      wrap.append(a);
    });
    body.append(wrap);
  }

  card.append(media, body);
  return card;
}

function applyFilter(container) {
  container.querySelectorAll('.project').forEach((card) => {
    card.hidden = activeFilter !== 'all' && card.dataset.type !== activeFilter;
  });
}

function render() {
  const filters = document.querySelector('[data-filters]');
  const container = document.querySelector('[data-projects]');
  if (!filters || !container) return;

  const present = TYPES.filter((type) => projects.some((p) => p.type === type));
  filters.replaceChildren();
  filters.hidden = present.length < 2;
  ['all', ...present].forEach((key) => {
    const btn = el('button', 'filter', t(FILTER_LABEL[key]));
    btn.type = 'button';
    btn.setAttribute('aria-pressed', String(key === activeFilter));
    btn.addEventListener('click', () => {
      activeFilter = key;
      filters.querySelectorAll('.filter').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      applyFilter(container);
    });
    filters.append(btn);
  });

  container.replaceChildren(...projects.map(renderCard));
  applyFilter(container);
}

export async function initPortfolio() {
  try {
    const res = await fetch('data/projects.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const data = await res.json();
    const showDrafts = new URLSearchParams(location.search).has('drafts');
    projects = (Array.isArray(data) ? data : [])
      .filter((p) => p && TYPES.includes(p.type) && (showDrafts || !p.draft));
  } catch (err) {
    console.warn('Портфолио не загружено:', err);
    return;
  }
  if (!projects.length) return;

  document.querySelectorAll('[data-portfolio-only]').forEach((node) => { node.hidden = false; });

  // Вторая кнопка в hero ведёт на работы, когда они есть
  const secondary = document.querySelector('[data-hero-secondary]');
  const label = document.querySelector('[data-hero-secondary-label]');
  if (secondary && label) {
    secondary.href = '#portfolio';
    label.dataset.i18n = 'hero.works';
    label.textContent = t('hero.works');
  }

  render();
  document.addEventListener('langchange', render);
}
