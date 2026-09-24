// Media picker: sample grid, custom-URL form, recent history, share links and local preview.
import { $, h, icon, guessContentType, formatTag, fileName, isHttpUrl, store, loadScript } from './utils.js';
import { SAMPLES, STORAGE, RECENT_LIMIT, HLS_JS, DASH_JS } from './config.js';

// Form field id for each media property (all plain strings in the "raw" form).
const FIELDS = {
  url: 'mediaUrl', type: 'contentType', streamType: 'streamType', title: 'title', subtitle: 'subtitle',
  poster: 'poster', startTime: 'startTime', subsUrl: 'subsUrl', subsLang: 'subsLang',
  hlsSeg: 'hlsSeg', hlsVideoSeg: 'hlsVideoSeg', customData: 'customData',
};
// Short query-string names used in share links.
const QUERY = {
  url: 'src', type: 'type', streamType: 'stream', title: 'title', subtitle: 'sub', poster: 'poster',
  startTime: 't', subsUrl: 'vtt', subsLang: 'lang', hlsSeg: 'hls', hlsVideoSeg: 'hlsv', customData: 'data',
};
const DEFAULTS = { streamType: 'BUFFERED' };

let typeTouched = false;
let selectedSampleId = null;

/* ---------- Raw form values ---------- */

/** Current form values as strings, plus `autoplay` as a boolean. */
export function rawForm() {
  const raw = {};
  for (const [key, id] of Object.entries(FIELDS)) raw[key] = $(id).value.trim();
  raw.autoplay = $('autoplay').checked;
  return raw;
}

export function fillForm(raw = {}) {
  for (const [key, id] of Object.entries(FIELDS)) $(id).value = raw[key] ?? DEFAULTS[key] ?? '';
  $('autoplay').checked = raw.autoplay !== false;
  typeTouched = !!raw.type;
  if (!typeTouched) $('contentType').value = guessContentType(raw.url || '');
  clearErrors();
  updateSelected();
}

/** Validates and converts the form into a media descriptor for cast.js. */
export function readForm() {
  clearErrors();
  const raw = rawForm();
  if (!raw.url) return fail('mediaUrl', 'Enter a media URL, or pick a sample.');
  if (!isHttpUrl(raw.url)) return fail('mediaUrl', 'The media URL must start with https:// or http://');
  for (const key of ['poster', 'subsUrl']) {
    if (raw[key] && !isHttpUrl(raw[key])) return fail(FIELDS[key], `${key === 'poster' ? 'Poster' : 'Subtitles'} URL is not valid.`);
  }
  let customData;
  if (raw.customData) {
    try { customData = JSON.parse(raw.customData); } catch { return fail('customData', 'Custom data must be valid JSON.'); }
  }
  const startTime = Number(raw.startTime) || 0;
  return {
    ok: true,
    raw,
    media: { ...raw, type: raw.type || guessContentType(raw.url) || 'video/mp4', startTime, customData },
  };
}

function fail(fieldId, message) {
  const field = $(fieldId);
  field.setAttribute('aria-invalid', 'true');
  $('formError').textContent = message;
  $('formError').hidden = false;
  return { ok: false, field, message };
}

function clearErrors() {
  $('formError').hidden = true;
  document.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));
}

/* ---------- Selected summary ---------- */

function updateSelected() {
  const raw = rawForm();
  $('selected').hidden = !raw.url;
  if (!raw.url) return;
  const type = raw.type || guessContentType(raw.url);
  $('selectedTag').textContent = formatTag(type, raw.streamType);
  $('selectedTitle').textContent = raw.title || fileName(raw.url);
  $('selectedUrl').textContent = raw.url;
}

/* ---------- Samples ---------- */

function renderSamples(onPick) {
  const list = $('samples');
  list.replaceChildren(...SAMPLES.map((s) => {
    const thumb = h('span', { class: 'thumb' },
      h('span', { class: `tag ${s.tag === 'LIVE' ? 'live' : ''}`, text: s.tag }),
      icon(s.tag === 'AUDIO' ? 'vol' : 'play'));
    if (s.thumbVideo) {
      // No poster available: show the first second of the video itself.
      thumb.append(h('video', { src: `${s.url}#t=1`, preload: 'metadata', muted: true, playsinline: true, 'aria-hidden': 'true' }));
    } else if (s.poster) {
      const img = h('img', { src: s.poster, alt: '', loading: 'lazy', decoding: 'async', width: 320, height: 180, referrerpolicy: 'no-referrer' });
      img.addEventListener('error', () => img.remove());
      thumb.append(img);
    }
    const btn = h('button', { class: 'sample', type: 'button', 'aria-pressed': 'false', 'data-id': s.id, title: s.url },
      thumb,
      h('span', { class: 'meta' }, h('span', { class: 'name', text: s.name }), h('span', { class: 'desc', text: s.desc })));
    btn.addEventListener('click', () => onPick(s));
    return h('li', {}, btn);
  }));
}

function markSample(id) {
  selectedSampleId = id;
  document.querySelectorAll('.sample').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
}

function sampleToRaw(s) {
  return {
    url: s.url, type: s.type, streamType: s.streamType || 'BUFFERED', title: s.name, subtitle: s.subtitle,
    poster: s.poster, subsUrl: s.subsUrl, subsLang: s.subsLang, hlsSeg: s.hlsSeg, hlsVideoSeg: s.hlsVideoSeg,
  };
}

/* ---------- Recent history ---------- */

export function addRecent(raw) {
  const list = store.get(STORAGE.recent, []).filter((r) => r.url !== raw.url);
  list.unshift({ ...raw, at: Date.now() });
  store.set(STORAGE.recent, list.slice(0, RECENT_LIMIT));
  renderRecent();
}

function renderRecent() {
  const list = store.get(STORAGE.recent, []);
  $('recentEmpty').hidden = list.length > 0;
  $('clearRecent').hidden = list.length === 0;
  $('recent').replaceChildren(...list.map((r) => {
    const pick = h('button', { type: 'button', title: r.url },
      h('strong', { text: r.title || fileName(r.url) }),
      h('span', { text: r.url }));
    pick.addEventListener('click', () => { fillForm(r); markSample(null); });
    const remove = h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Remove ${r.title || 'item'} from history` }, icon('x'));
    remove.addEventListener('click', () => {
      store.set(STORAGE.recent, store.get(STORAGE.recent, []).filter((x) => x.url !== r.url));
      renderRecent();
    });
    return h('li', { class: 'recent-item' }, pick, remove);
  }));
}

/* ---------- Share links ---------- */

export function shareUrl(raw, appId) {
  const url = new URL(location.origin + location.pathname);
  for (const [key, param] of Object.entries(QUERY)) {
    if (raw[key] && raw[key] !== DEFAULTS[key]) url.searchParams.set(param, raw[key]);
  }
  if (raw.autoplay === false) url.searchParams.set('autoplay', '0');
  if (appId) url.searchParams.set('appId', appId);
  return url.toString();
}

/** Media from a share link's query string, or null. */
export function rawFromQuery(params) {
  if (!params.get(QUERY.url)) return null;
  const raw = {};
  for (const [key, param] of Object.entries(QUERY)) if (params.has(param)) raw[key] = params.get(param);
  raw.autoplay = params.get('autoplay') !== '0';
  return raw;
}

/* ---------- Local preview ---------- */

let hls = null;
let dash = null;

export function closePreview() {
  hls?.destroy(); hls = null;
  dash?.reset(); dash = null;
  const video = $('preview');
  video.pause();
  video.removeAttribute('src');
  video.replaceChildren();
  video.load();
  $('previewImg').removeAttribute('src');
  $('previewWrap').hidden = true;
}

export async function preview(media) {
  closePreview();
  const video = $('preview');
  const img = $('previewImg');
  $('previewWrap').hidden = false;

  if (media.type.startsWith('image/')) {
    video.hidden = true;
    img.hidden = false;
    img.src = media.url;
    return;
  }
  img.hidden = true;
  video.hidden = false;
  video.poster = media.poster || '';
  // Only request CORS when needed (WebVTT tracks), since many MP4 hosts don't send CORS headers.
  if (media.subsUrl) {
    video.crossOrigin = 'anonymous';
    video.append(h('track', { kind: 'subtitles', src: media.subsUrl, srclang: media.subsLang || 'en', label: (media.subsLang || 'en').toUpperCase(), default: true }));
  } else {
    video.removeAttribute('crossorigin');
  }

  const isHls = /mpegurl/i.test(media.type);
  const isDash = /dash/i.test(media.type);
  if (isHls && !video.canPlayType('application/vnd.apple.mpegurl')) {
    await loadScript(HLS_JS);
    if (!window.Hls?.isSupported()) throw new Error('HLS preview is not supported in this browser');
    hls = new window.Hls();
    hls.loadSource(media.url);
    hls.attachMedia(video);
  } else if (isDash) {
    await loadScript(DASH_JS);
    dash = window.dashjs.MediaPlayer().create();
    dash.initialize(video, media.url, false);
  } else {
    video.src = media.url;
  }
  if (media.startTime) video.currentTime = media.startTime;
  await video.play();
}

/* ---------- Init ---------- */

export function initMedia({ onPickSample }) {
  renderSamples((s) => {
    fillForm(sampleToRaw(s));
    markSample(s.id);
    onPickSample?.(s);
  });
  renderRecent();

  $('mediaUrl').addEventListener('input', () => {
    if (!typeTouched) $('contentType').value = guessContentType($('mediaUrl').value.trim());
    if (selectedSampleId) markSample(null);
  });
  $('contentType').addEventListener('input', (e) => { typeTouched = !!e.target.value.trim(); });
  $('mediaForm').addEventListener('input', (e) => {
    e.target.removeAttribute('aria-invalid');
    updateSelected();
  });
  $('clearRecent').addEventListener('click', () => { store.remove(STORAGE.recent); renderRecent(); });
  $('closePreview').addEventListener('click', closePreview);

  // Start with the first sample selected so "Cast now" works immediately.
  fillForm(sampleToRaw(SAMPLES[0]));
  markSample(SAMPLES[0].id);
}
