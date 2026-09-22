// Форма заявки → /api/lead (Vercel-функция отправляет заявку в Telegram).

import { t, getLang } from './i18n.js';

const TG_RE = /^@?[a-zA-Z][a-zA-Z0-9_]{3,31}$/;
const TG_LINK_RE = /^(https?:\/\/)?t\.me\/[a-zA-Z][a-zA-Z0-9_]{3,31}\/?$/;

function isValidContact(value) {
  const v = value.trim();
  if (TG_RE.test(v) || TG_LINK_RE.test(v)) return true;
  const digits = v.replace(/[\s()+\-]/g, '');
  return /^\d{10,15}$/.test(digits);
}

// Возвращает ключ ошибки или '' если поле в порядке
function validateField(field) {
  const value = field.value.trim();
  switch (field.name) {
    case 'name':
      if (!value) return 'form.required';
      if (value.length < 2) return 'form.nameInvalid';
      if (value.length > 80) return 'form.tooLong';
      return '';
    case 'contact':
      if (!value) return 'form.required';
      if (value.length > 100 || !isValidContact(value)) return 'form.contactInvalid';
      return '';
    case 'type':
    case 'budget':
      return value ? '' : 'form.required';
    case 'message':
      return value.length > 2000 ? 'form.tooLong' : '';
    default:
      return '';
  }
}

function showFieldError(field, key) {
  const wrap = field.closest('.field');
  const out = document.getElementById(field.getAttribute('aria-describedby'));
  wrap?.classList.toggle('is-invalid', Boolean(key));
  field.setAttribute('aria-invalid', String(Boolean(key)));
  if (out) {
    out.dataset.errKey = key;
    out.textContent = key ? t(key) : '';
  }
}

export function initForm() {
  const form = document.querySelector('[data-lead-form]');
  if (!form) return;

  const fields = [...form.querySelectorAll('input[name]:not([name="website"]), select[name], textarea[name]')];
  const submit = form.querySelector('[data-submit]');
  const submitLabel = form.querySelector('[data-submit-label]');
  const status = form.querySelector('[data-form-status]');
  const startedAt = Date.now();
  let sending = false;

  const setStatus = (key, kind) => {
    status.dataset.statusKey = key || '';
    status.className = `form__status${kind ? ` is-${kind}` : ''}`;
    status.textContent = key ? t(key) : '';
  };

  const setSending = (value) => {
    sending = value;
    form.classList.toggle('is-sending', value);
    submit.disabled = value;
    submitLabel.dataset.i18n = value ? 'form.sending' : 'form.submit';
    submitLabel.textContent = t(submitLabel.dataset.i18n);
  };

  // Ошибку поля пересчитываем, когда пользователь уходит из поля или исправляет его
  fields.forEach((field) => {
    field.addEventListener('blur', () => {
      if (field.value.trim() || field.closest('.field')?.classList.contains('is-invalid')) {
        showFieldError(field, validateField(field));
      }
    });
    field.addEventListener('input', () => {
      if (field.closest('.field')?.classList.contains('is-invalid')) {
        showFieldError(field, validateField(field));
      }
    });
  });

  // При смене языка переводим уже показанные сообщения
  document.addEventListener('langchange', () => {
    form.querySelectorAll('.field__error').forEach((out) => {
      if (out.dataset.errKey) out.textContent = t(out.dataset.errKey);
    });
    if (status.dataset.statusKey) status.textContent = t(status.dataset.statusKey);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sending) return;

    let firstInvalid = null;
    fields.forEach((field) => {
      const key = validateField(field);
      showFieldError(field, key);
      if (key && !firstInvalid) firstInvalid = field;
    });
    if (firstInvalid) {
      setStatus('form.errorInvalid', 'error');
      firstInvalid.focus();
      return;
    }

    const data = Object.fromEntries(new FormData(form));
    const payload = {
      name: data.name.trim(),
      contact: data.contact.trim(),
      type: data.type,
      budget: data.budget,
      message: (data.message || '').trim(),
      website: data.website || '',   // honeypot
      elapsed: Date.now() - startedAt, // слишком быстрая отправка = бот
      lang: getLang(),
      // turnstileToken: ...          // [TODO: Turnstile] токен виджета
    };

    setSending(true);
    setStatus('', '');
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        form.reset();
        fields.forEach((f) => showFieldError(f, ''));
        setStatus('form.success', 'success');
      } else if (res.status === 429) {
        setStatus('form.errorRate', 'error');
      } else if (res.status === 400) {
        setStatus('form.errorInvalid', 'error');
      } else {
        setStatus('form.errorGeneric', 'error');
      }
    } catch {
      setStatus('form.errorGeneric', 'error');
    } finally {
      setSending(false);
    }
  });
}
