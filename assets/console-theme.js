/* A local, optional presentation preference. No tracking or network requests. */
(() => {
  'use strict';
  const key = 'iatriko-study-theme';
  const valid = value => value === 'light' || value === 'dark';
  let current = 'dark';
  try { const saved = localStorage.getItem(key); if (valid(saved)) current = saved; } catch { /* Storage can be disabled. */ }
  function set(value, persist = true) {
    if (!valid(value)) return;
    current = value;
    document.documentElement.dataset.theme = value;
    document.querySelectorAll('[data-theme-value]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeValue === value)));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', value === 'light' ? '#f4f7fb' : '#0a101b');
    if (persist) { try { localStorage.setItem(key,value); } catch { /* Choice still works for this visit. */ } }
    document.dispatchEvent(new CustomEvent('console:themechange', {detail:{theme:value}}));
  }
  document.documentElement.dataset.theme = current;
  document.addEventListener('DOMContentLoaded', () => set(current,false));
  document.addEventListener('click', event => { const button = event.target.closest('[data-theme-value]'); if (button) set(button.dataset.themeValue); });
  window.addEventListener('storage', event => { if (event.key === key && valid(event.newValue)) set(event.newValue,false); });
  window.ConsoleTheme = Object.freeze({set,get:()=>current});
})();
