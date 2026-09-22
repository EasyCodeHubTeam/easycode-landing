// Контакты и ссылки — в одном месте. Всё, что здесь пусто, на сайте не показывается.

export const SITE = {
  // Ссылка на бота продублирована в index.html (href у data-link="bot") — для поисковиков и
  // браузеров без JS. Сменили бота — замените и там: grep -n easycode_hub_bot index.html
  botUrl: 'https://t.me/easycode_hub_bot',
  // Параметр ?start=... — по нему в боте видно, что клиент пришёл с сайта.
  // К нему добавляется язык сайта: site_ru, site_kk, site_en — бот сразу отвечает на этом языке.
  botStart: 'site',
  // [TODO: проверить email]
  email: 'easycodehub@gmail.com',
  // Адрес бэкенда, который принимает заявки с формы и пересылает их в Telegram
  // (Vercel-функция api/lead.js, Cloudflare Worker и т. п.).
  // Пока пусто — форма скрыта, а блок «Заявка» ведёт в Telegram-бота.
  // Пример: 'https://easycode-lead.vercel.app/api/lead'
  leadEndpoint: '',
};

// Соцсети появятся в футере, как только заполните url.
// icon — id символа из assets/icons/sprite.svg (t-github, t-telegram, t-instagram).
export const SOCIALS = [
  { label: 'GitHub', url: '', icon: 't-github' },     // [TODO: GitHub]
  { label: 'Telegram', url: '', icon: 't-telegram' }, // [TODO: Telegram-канал или личка]
  { label: 'Instagram', url: '', icon: 't-instagram' }, // [TODO: Instagram]
];
