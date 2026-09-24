// Small, dependency-free helpers shared by every module.

export const $ = (id) => document.getElementById(id);

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...children.filter((c) => c != null));
  return el;
}

export function icon(name, cls = 'ico') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

export function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return (h ? `${h}:${String(m).padStart(2, '0')}` : m) + ':' + String(s).padStart(2, '0');
}

const TYPE_BY_EXT = {
  m3u8: 'application/x-mpegurl', m3u: 'application/x-mpegurl',
  mpd: 'application/dash+xml', ism: 'application/vnd.ms-sstr+xml', isml: 'application/vnd.ms-sstr+xml',
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/mp4', webm: 'video/webm',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg',
  flac: 'audio/flac', wav: 'audio/wav',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
};

/** Best-effort MIME type from a URL's file extension ('' when unknown). */
export function guessContentType(url) {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (/\/manifest$/.test(path) && /\.isml?\//.test(path)) return TYPE_BY_EXT.ism;
    const ext = path.split('.').pop();
    return TYPE_BY_EXT[ext] || '';
  } catch {
    return '';
  }
}

/** 'video' | 'audio' | 'image' */
export function mediaKind(type = '') {
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('audio/')) return 'audio';
  return 'video';
}

/** Short badge label for a content type. */
export function formatTag(type = '', streamType) {
  if (streamType === 'LIVE') return 'LIVE';
  if (/mpegurl/i.test(type)) return 'HLS';
  if (/dash/i.test(type)) return 'DASH';
  if (/sstr/i.test(type)) return 'SMOOTH';
  if (type.startsWith('audio/')) return 'AUDIO';
  if (type.startsWith('image/')) return 'IMAGE';
  const sub = type.split('/')[1];
  return sub ? sub.toUpperCase() : 'MEDIA';
}

export function fileName(url) {
  try {
    const last = new URL(url).pathname.split('/').filter(Boolean).pop() || url;
    return decodeURIComponent(last);
  } catch {
    return url;
  }
}

export function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** localStorage that never throws (private mode, blocked storage, etc.). */
export const store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};

const scriptCache = new Map();
export function loadScript(src) {
  if (!scriptCache.has(src)) {
    scriptCache.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => { scriptCache.delete(src); reject(new Error(`Failed to load ${src}`)); };
      document.head.append(s);
    }));
  }
  return scriptCache.get(src);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { style: 'position:fixed;opacity:0' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function download(filename, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Human-readable text for a Cast SDK error (string code or chrome.cast.Error). */
export function errText(err) {
  if (!err) return 'unknown error';
  if (typeof err === 'string') return err;
  if (err.code) return err.description ? `${err.code}: ${err.description}` : err.code;
  return err.message || String(err);
}

export function isTypingTarget(el) {
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}
