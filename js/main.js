import { SITE, SOCIALS } from './config.js';
import { t, detectLang, setLang } from './i18n.js';
import { initPortfolio } from './portfolio.js';
import { initForm } from './form.js';

const root = document.documentElement;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const DESKTOP_NAV = window.matchMedia('(min-width: 1140px)');

/* ---------- Ссылки из config.js ---------- */
// ?start=site_kk — бот запомнит, что клиент с сайта, и сразу ответит на языке сайта
const botHref = (lang) =>
  SITE.botUrl ? `${SITE.botUrl}?start=${encodeURIComponent(`${SITE.botStart}_${lang}`)}` : '';

function setBotLinks(lang) {
  const href = botHref(lang);
  document.querySelectorAll('[data-link="bot"]').forEach((a) => {
    if (!href) return; // без ссылки на бота кнопки ведут к форме (#contact)
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
  });
}

function initLinks() {
  setBotLinks(detectLang());
  document.addEventListener('langchange', (e) => setBotLinks(e.detail.lang));

  document.querySelectorAll('[data-link="email"]').forEach((a) => {
    if (!SITE.email) { (a.closest('li') || a).remove(); return; }
    a.href = `mailto:${SITE.email}`;
  });
  document.querySelectorAll('[data-link-text="email"]').forEach((node) => { node.textContent = SITE.email; });

  const socials = document.querySelector('[data-socials]');
  const filled = SOCIALS.filter((s) => /^https?:\/\//.test(s.url));
  if (socials && filled.length) {
    filled.forEach((s) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = s.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.setAttribute('aria-label', s.label);
      a.innerHTML = `<svg class="icon" aria-hidden="true"><use href="assets/icons/sprite.svg#${s.icon}"></use></svg>`;
      li.append(a);
      socials.append(li);
    });
    socials.hidden = false;
  }

  document.querySelectorAll('[data-year]').forEach((node) => { node.textContent = new Date().getFullYear(); });
}

/* ---------- Форма заявки: включается, только если задан бэкенд ---------- */
function initLeadMode() {
  const form = document.querySelector('[data-lead-form]');
  if (!SITE.leadEndpoint || !form) return;
  form.action = SITE.leadEndpoint;
  form.hidden = false;
  document.querySelector('#contact')?.classList.remove('contact--no-form');
  // Тексты, которые в режиме формы говорят о заявке через сайт
  document.querySelectorAll('[data-i18n-form]').forEach((el) => {
    el.dataset.i18n = el.dataset.i18nForm;
    el.textContent = t(el.dataset.i18n);
  });
}

/* ---------- Тема ---------- */
function initTheme() {
  const toggle = document.querySelector('[data-theme-toggle]');
  const themeColor = document.querySelector('meta[name="theme-color"]');

  const sync = () => {
    const light = root.dataset.theme === 'light';
    toggle?.setAttribute('aria-label', t(light ? 'ui.themeToDark' : 'ui.themeToLight'));
    themeColor?.setAttribute('content', light ? '#f6f7f9' : '#0b0d10');
  };

  toggle?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('theme', root.dataset.theme); } catch {}
    sync();
  });
  document.addEventListener('langchange', sync);
  sync();
}

/* ---------- Мобильное меню ---------- */
function initMenu() {
  const burger = document.querySelector('[data-burger]');
  const nav = document.querySelector('[data-nav]');
  if (!burger || !nav) return;

  const setOpen = (open, { focusBurger = false } = {}) => {
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', t(open ? 'ui.menuClose' : 'ui.menuOpen'));
    document.body.classList.toggle('menu-open', open);
    if (open) nav.querySelector('a, button')?.focus();
    else if (focusBurger) burger.focus();
  };

  burger.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) setOpen(false, { focusBurger: true });
  });
  DESKTOP_NAV.addEventListener('change', (e) => { if (e.matches) setOpen(false); });
  document.addEventListener('langchange', () => {
    burger.setAttribute('aria-label', t(nav.classList.contains('is-open') ? 'ui.menuClose' : 'ui.menuOpen'));
  });
}

/* ---------- Шапка: тень при скролле и активный пункт меню ---------- */
function initHeader() {
  const header = document.querySelector('[data-header]');
  const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const links = new Map(
    [...document.querySelectorAll('.nav__link')].map((a) => [a.getAttribute('href').slice(1), a]),
  );
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((a) => a.removeAttribute('aria-current'));
      links.get(entry.target.id)?.setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  links.forEach((_, id) => {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  });
}

/* ---------- Появление при скролле ---------- */
function initReveal() {
  const items = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  // Небольшая задержка для соседних карточек, чтобы они появлялись по очереди
  items.forEach((el) => {
    const siblings = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
    const index = siblings.indexOf(el);
    if (siblings.length > 1) el.style.setProperty('--reveal-delay', `${(index % 3) * 90}ms`);
  });
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach((el) => observer.observe(el));
}

/* ---------- Фон секции заявки: грузится, только когда секция близко ---------- */
function initCtaBackground() {
  const section = document.querySelector('[data-cta-bg]');
  if (!section || !('IntersectionObserver' in window)) return;
  const src = 'assets/img/cta-bg.webp';
  const observer = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    observer.disconnect();
    const img = new Image();
    img.onload = () => {
      // Абсолютный адрес: относительный url() в CSS-переменной считался бы от css/style.css
      section.style.setProperty('--cta-bg', `url("${img.src}")`);
      section.classList.add('has-bg');
    };
    img.src = src;
  }, { rootMargin: '400px 0px' });
  observer.observe(section);
}

/* ---------- Переключатель языка ---------- */
async function initLang() {
  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });
  const lang = detectLang();
  try {
    await setLang(lang, { persist: lang !== 'ru' });
  } finally {
    root.classList.remove('i18n-pending');
  }
}

/* ---------- Старт ---------- */
initLinks();
initLeadMode();
initTheme();
initMenu();
initHeader();
initReveal();
initCtaBackground();
initForm();
await initLang();
initPortfolio();
