// Vercel Serverless Function: заявка с сайта → сообщение в Telegram.
// Переменные окружения: BOT_TOKEN, CHAT_ID (обязательно), TURNSTILE_SECRET и ALLOWED_ORIGINS (по желанию).
// Токен живёт только здесь, на сервере, и никогда не попадает в браузер.

const TYPES = {
  mobile: 'Мобильное приложение',
  backend: 'Backend / API',
  bot: 'Telegram-бот',
  mvp: 'MVP для стартапа',
  support: 'Поддержка и доработка',
  other: 'Другое',
};

// Ключи должны совпадать с value у <option> в index.html
const BUDGETS = {
  lt500k: 'до 500 000 ₸',
  '500k-1.5m': '500 000 – 1 500 000 ₸',
  '1.5m-3m': '1 500 000 – 3 000 000 ₸',
  gt3m: 'от 3 000 000 ₸',
  unknown: 'Пока не знаю',
};

const LANGS = { ru: 'RU', kk: 'KZ', en: 'EN' };

const LIMITS = { name: 80, contact: 100, message: 2000 };
const MIN_FILL_MS = 3000; // быстрее людей не заполняют

// Простое ограничение частоты: не больше RATE_MAX заявок с одного IP за RATE_WINDOW_MS.
// Счётчик живёт в памяти экземпляра функции, поэтому защищает от серийной отправки,
// но не является строгим лимитом. Для строгого — Upstash Redis или Vercel KV.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const hits = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((ts) => now - ts < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // не даём карте разрастись
  return recent.length > RATE_MAX;
}

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const clean = (value, max) =>
  typeof value === 'string'
    ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max)
    : '';

function isValidContact(v) {
  if (/^@?[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(v)) return true;
  if (/^(https?:\/\/)?t\.me\/[a-zA-Z][a-zA-Z0-9_]{3,31}\/?$/.test(v)) return true;
  return /^\d{10,15}$/.test(v.replace(/[\s()+\-]/g, ''));
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return null; }
}

async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return true; // Turnstile не подключён
  if (!token) return false;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  });
  const data = await res.json().catch(() => ({}));
  return data.success === true;
}

// Если сайт живёт на другом домене (например, GitHub Pages), перечислите его в ALLOWED_ORIGINS:
// ALLOWED_ORIGINS=https://easycodehubteam.github.io,https://easycode.kz
function applyCors(req, res) {
  const origin = req.headers.origin;
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const { BOT_TOKEN, CHAT_ID } = process.env;
  if (!BOT_TOKEN || !CHAT_ID) {
    console.error('BOT_TOKEN или CHAT_ID не заданы');
    return res.status(500).json({ ok: false, error: 'not_configured' });
  }

  const body = parseBody(req);
  if (!body) return res.status(400).json({ ok: false, error: 'invalid_json' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0].trim();

  // Honeypot или слишком быстрая отправка: делаем вид, что всё хорошо, и молча выходим
  const elapsed = Number(body.elapsed);
  if (clean(body.website, 200) || (Number.isFinite(elapsed) && elapsed < MIN_FILL_MS)) {
    return res.status(200).json({ ok: true });
  }

  if (isRateLimited(ip)) {
    return res.status(429).json({ ok: false, error: 'rate_limited' });
  }

  if (!(await verifyTurnstile(body.turnstileToken, ip))) {
    return res.status(400).json({ ok: false, error: 'captcha_failed' });
  }

  const name = clean(body.name, LIMITS.name);
  const contact = clean(body.contact, LIMITS.contact);
  const message = clean(body.message, LIMITS.message);
  const type = TYPES[body.type];
  const budget = BUDGETS[body.budget];
  const lang = LANGS[body.lang] || 'RU';

  const fields = [];
  if (name.length < 2) fields.push('name');
  if (!isValidContact(contact)) fields.push('contact');
  if (!type) fields.push('type');
  if (!budget) fields.push('budget');
  if (fields.length) {
    return res.status(400).json({ ok: false, error: 'validation', fields });
  }

  const tgHandle = contact.match(/^@?([a-zA-Z][a-zA-Z0-9_]{3,31})$/)?.[1]
    || contact.match(/t\.me\/([a-zA-Z0-9_]+)/)?.[1];

  const text = [
    '<b>🆕 Новая заявка с сайта</b>',
    '',
    `<b>Имя:</b> ${escapeHtml(name)}`,
    `<b>Контакт:</b> ${tgHandle ? `@${escapeHtml(tgHandle)}` : escapeHtml(contact)}`,
    `<b>Тип:</b> ${escapeHtml(type)}`,
    `<b>Бюджет:</b> ${escapeHtml(budget)}`,
    `<b>Язык сайта:</b> ${lang}`,
    message ? `\n<b>Описание:</b>\n${escapeHtml(message)}` : '',
  ].join('\n').trim();

  try {
    const tg = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!tg.ok) {
      const details = await tg.text().catch(() => '');
      console.error('Telegram API error', tg.status, details);
      return res.status(502).json({ ok: false, error: 'telegram_failed' });
    }
  } catch (err) {
    console.error('Telegram request failed', err);
    return res.status(502).json({ ok: false, error: 'telegram_unreachable' });
  }

  return res.status(200).json({ ok: true });
};
