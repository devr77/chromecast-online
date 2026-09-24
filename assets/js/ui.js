// Generic UI pieces: event log, toasts, theme toggle, tabs, environment checklist.
import { $, h, copyText, download, store } from './utils.js';
import { STORAGE } from './config.js';

/* ---------- Event log ---------- */
const MAX_LOG_LINES = 500;
const entries = [];

export function log(message, level = '') {
  const time = new Date().toLocaleTimeString([], { hour12: false });
  entries.push(`[${time}] ${level ? level.toUpperCase() + ' ' : ''}${message}`);
  if (entries.length > MAX_LOG_LINES) entries.shift();

  const el = $('log');
  const stick = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  el.append(h('div', { class: level }, h('span', { class: 't', text: time }), message));
  while (el.childElementCount > MAX_LOG_LINES) el.firstElementChild.remove();
  if (stick) el.scrollTop = el.scrollHeight;
  $('logCount').textContent = `${entries.length} event${entries.length === 1 ? '' : 's'}`;

  (level === 'err' ? console.warn : console.debug)('[cast]', message);
}

export function initLog() {
  $('clearLog').addEventListener('click', () => {
    entries.length = 0;
    $('log').textContent = '';
    $('logCount').textContent = '0 events';
  });
  $('copyLog').addEventListener('click', async () => {
    toast((await copyText(entries.join('\n'))) ? 'Log copied' : 'Copy failed');
  });
  $('downloadLog').addEventListener('click', () => {
    download(`cast-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`, entries.join('\n'));
  });
}

/* ---------- Toasts ---------- */
export function toast(message, level = '') {
  const el = h('div', { class: `toast ${level}`, role: level === 'err' ? 'alert' : 'status', text: message });
  $('toasts').append(el);
  setTimeout(() => el.remove(), level === 'err' ? 5000 : 2600);
}

/* ---------- Warning banner ---------- */
export function warn(message) {
  const el = $('warn');
  el.textContent = message;
  el.hidden = false;
}

/* ---------- Environment checklist ---------- */
export function setEnv(id, state, label) {
  const li = $(id);
  li.dataset.state = state;
  if (label) li.lastChild.textContent = label;
}

/* ---------- Theme ---------- */
export function initTheme() {
  const root = document.documentElement;
  const dark = matchMedia('(prefers-color-scheme: dark)');
  const effective = () => root.dataset.theme || (dark.matches ? 'dark' : 'light');
  const syncMeta = () => {
    const color = getComputedStyle(root).getPropertyValue('--bg').trim();
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', color));
  };

  $('themeBtn').addEventListener('click', () => {
    const next = effective() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    store.set(STORAGE.theme, next);
    syncMeta();
  });
  if (root.dataset.theme) syncMeta();
}

/* ---------- Tabs (WAI-ARIA tabs pattern) ---------- */
export function initTabs(tablist, onChange) {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];

  function select(tab, focus = false) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
    onChange?.(tab.id);
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (d) select(tabs[(i + d + tabs.length) % tabs.length], true);
      else if (e.key === 'Home') select(tabs[0], true);
      else if (e.key === 'End') select(tabs[tabs.length - 1], true);
      else return;
      e.preventDefault();
    });
  });

  return { select: (id) => select($(id)) };
}
