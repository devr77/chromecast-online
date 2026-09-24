// Entry point: wires the Cast wrapper, media picker and UI together.
import { $, fmtTime, errText, isTypingTarget, store, copyText, h, icon } from './utils.js';
import { STORAGE, SDK_TIMEOUT_MS, SEEK_STEP, VOLUME_STEP } from './config.js';
import { log, initLog, toast, warn, setEnv, initTheme, initTabs } from './ui.js';
import * as castApi from './cast.js';
import { initMedia, readForm, fillForm, addRecent, shareUrl, rawFromQuery, preview } from './media.js';

const params = new URLSearchParams(location.search);
const appId = (params.get('appId') || store.get(STORAGE.appId, '') || '').trim();

let tabs;

/* ---------- Environment ---------- */

function checkEnvironment() {
  const secure = window.isSecureContext;
  setEnv('envSecure', secure ? 'ok' : 'err', secure ? 'Secure context' : 'Needs HTTPS');

  const ua = navigator.userAgent;
  const brands = navigator.userAgentData?.brands?.map((b) => b.brand).join(' ') || '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const chromium = !ios && (/Chromium|Google Chrome|Microsoft Edge/.test(brands) || /Chrome\/|Edg\//.test(ua));
  setEnv('envBrowser', chromium ? 'ok' : 'err', chromium ? 'Supported browser' : 'Use Chrome or Edge');

  if (!secure) {
    warn('This page must be served over HTTPS (or http://localhost). The Cast SDK is disabled on insecure pages.');
  } else if (!chromium) {
    warn('Casting from the web only works in Google Chrome or Microsoft Edge on desktop and Android. You can still preview media here.');
  }
}

/* ---------- Cast SDK lifecycle ---------- */

function startCast() {
  const timer = setTimeout(() => {
    setEnv('envSdk', 'err', 'Cast SDK not loaded');
    setEnv('envDevices', 'err', 'Cast devices');
    log('The Cast SDK did not load. Check that gstatic.com is not blocked by an extension or network filter.', 'err');
  }, SDK_TIMEOUT_MS);

  castApi.castEvents.addEventListener('ready', (e) => {
    clearTimeout(timer);
    setEnv('envSdk', 'ok', 'Cast SDK ready');
    log(`Cast SDK ready · receiver ${e.detail.appId}${appId ? ' (custom)' : ' (Default Media Receiver)'}`, 'ok');
  });

  castApi.castEvents.addEventListener('caststate', (e) => {
    const state = e.detail;
    log(`Cast state: ${state}`);
    if (state === 'NO_DEVICES_AVAILABLE') setEnv('envDevices', 'warn', 'No devices found');
    else setEnv('envDevices', 'ok', 'Devices found');
    scheduleRender();
  });

  castApi.castEvents.addEventListener('session', (e) => {
    const { state, error } = e.detail;
    log(`Session: ${state}${error ? ` (${error})` : ''}`, error ? 'err' : state === 'SESSION_STARTED' || state === 'SESSION_RESUMED' ? 'ok' : '');
    if (state === 'SESSION_STARTED' || state === 'SESSION_RESUMED') {
      const name = castApi.getSession()?.getCastDevice().friendlyName;
      toast(`Connected to ${name}`);
    }
    if (state === 'SESSION_START_FAILED') toast('Could not connect to the device', 'err');
    scheduleRender();
  });

  let lastPlayerState = null;
  castApi.castEvents.addEventListener('player', (e) => {
    const p = castApi.getPlayer();
    if (e.detail.field === 'playerState' && p.playerState !== lastPlayerState) {
      lastPlayerState = p.playerState;
      log(`Player: ${p.playerState}`);
    }
    scheduleRender();
  });

  castApi.castEvents.addEventListener('queue', scheduleRender);
  castApi.castEvents.addEventListener('message', (e) => log(`⇠ ${e.detail.namespace}: ${e.detail.message}`, 'out'));

  castApi.initCast(appId).then((ok) => {
    if (ok) return;
    clearTimeout(timer);
    setEnv('envSdk', 'err', 'Cast not supported');
    setEnv('envDevices', 'err', 'Cast devices');
    log('Cast API reported unavailable in this browser.', 'err');
  });
}

/* ---------- Rendering ---------- */

let renderQueued = false;
let seeking = false;

function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}

function render() {
  const ready = castApi.isReady();
  const session = castApi.getSession();
  const connected = !!session;
  const castState = castApi.getCastState();
  const p = castApi.getPlayer();
  const loaded = !!(connected && p?.isMediaLoaded);

  // Device card
  const badge = $('deviceBadge');
  if (connected) setPill(badge, 'ok', 'Connected');
  else if (castState === 'CONNECTING') setPill(badge, 'accent', 'Connecting…');
  else if (castState === 'NO_DEVICES_AVAILABLE') setPill(badge, 'warn', 'No devices');
  else setPill(badge, '', 'Not connected');

  $('connectBtn').disabled = !ready || connected || castState === 'CONNECTING';
  $('disconnectBtn').disabled = !connected;
  $('stopAppBtn').disabled = !connected;
  $('castBtn').disabled = !ready;
  $('queueBtn').disabled = !ready;
  $('msgSend').disabled = !connected;

  const device = session?.getCastDevice();
  $('deviceName').textContent = device?.friendlyName || '—';
  $('receiverName').textContent = session?.getApplicationMetadata()?.name || (appId ? appId : 'Default Media Receiver');
  $('sessionState').textContent = session?.getSessionState() || castState || '—';
  $('deviceHint').textContent = connected
    ? `Casting to ${device?.friendlyName}. Pick media below and press Cast now.`
    : 'Your computer and Cast device must be on the same Wi-Fi network.';

  // Now playing
  const info = loaded ? p.mediaInfo : null;
  const meta = info?.metadata;
  const title = loaded ? (p.title || meta?.title || info?.contentId) : null;
  const sub = meta?.subtitle || meta?.artist || '';
  const image = loaded ? (p.imageUrl || meta?.images?.[0]?.url) : null;
  const live = info?.streamType === 'LIVE';

  $('npTitle').textContent = title || (connected ? 'Ready to cast' : '—');
  $('npSub').textContent = loaded ? sub : (connected ? device?.friendlyName || '' : '');
  const artImg = $('artImg');
  if (image) {
    if (artImg.getAttribute('src') !== image) artImg.src = image;
    artImg.hidden = false;
    $('artEmpty').hidden = true;
  } else {
    artImg.hidden = true;
    artImg.removeAttribute('src');
    $('artEmpty').hidden = false;
    $('artEmpty').lastElementChild.textContent = connected ? 'Connected — nothing playing' : 'Nothing casting yet';
  }
  $('liveTag').hidden = !(loaded && live);

  const state = loaded ? p.playerState : null;
  const pb = $('playerBadge');
  if (!state || state === 'IDLE') setPill(pb, '', loaded ? 'Idle' : connected ? 'Ready' : 'Idle');
  else if (state === 'PLAYING') setPill(pb, 'ok', 'Playing');
  else if (state === 'PAUSED') setPill(pb, 'warn', 'Paused');
  else setPill(pb, 'accent', state.charAt(0) + state.slice(1).toLowerCase() + '…');

  // Transport
  const paused = !loaded || p.isPaused || state !== 'PLAYING';
  $('playIcon').setAttribute('href', paused ? '#i-play' : '#i-pause');
  $('playBtn').setAttribute('aria-label', paused ? 'Play' : 'Pause');
  $('playBtn').disabled = !loaded || (!p.canPause && !paused);
  $('stopBtn').disabled = !loaded;
  $('speed').disabled = !loaded || live;

  const canSeek = loaded && p.canSeek && (p.duration > 0 || !!p.liveSeekableRange);
  ['backBtn', 'fwdBtn'].forEach((id) => { $(id).disabled = !canSeek; });
  const seek = $('seekBar');
  seek.disabled = !canSeek;
  const duration = p?.duration || 0;
  seek.max = String(Math.floor(duration));
  if (!seeking) seek.value = String(Math.floor(loaded ? p.currentTime || 0 : 0));
  if (!seeking) $('curTime').textContent = fmtTime(loaded ? p.currentTime : 0);
  $('durTime').textContent = live ? 'LIVE' : fmtTime(loaded ? duration : 0);
  seek.style.setProperty('--pct', duration ? `${((p.currentTime || 0) / duration) * 100}%` : '0%');

  // Volume
  $('volumeBar').disabled = !connected;
  $('muteBtn').disabled = !connected;
  if (connected && document.activeElement !== $('volumeBar')) $('volumeBar').value = String(p.volumeLevel ?? 1);
  const muted = connected && p.isMuted;
  $('muteIcon').setAttribute('href', muted ? '#i-mute' : '#i-vol');
  $('muteBtn').setAttribute('aria-label', muted ? 'Unmute' : 'Mute');

  // Captions
  const textTracks = loaded ? castApi.getTextTrackIds() : [];
  const ccOn = textTracks.some((id) => castApi.getActiveTrackIds().includes(id));
  $('ccBtn').disabled = textTracks.length === 0;
  $('ccBtn').setAttribute('aria-pressed', String(ccOn));

  renderQueue(loaded);
}

function renderQueue(loaded) {
  const { items, currentItemId } = loaded ? castApi.getQueue() : { items: [], currentItemId: null };
  $('queueCount').textContent = String(items.length);
  $('queueEmpty').hidden = items.length > 0;
  $('prevBtn').disabled = items.length < 2;
  $('nextBtn').disabled = items.length < 2;

  $('queue').replaceChildren(...items.map((item, i) => {
    const m = item.media;
    const label = m?.metadata?.title || m?.contentId || `Item ${item.itemId}`;
    const current = item.itemId === currentItemId;
    const play = h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Play ${label}`, disabled: current }, icon('play'));
    play.addEventListener('click', () => castApi.queueJump(item.itemId).catch((err) => log(`Queue jump failed: ${errText(err)}`, 'err')));
    const remove = h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Remove ${label} from queue` }, icon('x'));
    remove.addEventListener('click', () => castApi.queueRemove(item.itemId).catch((err) => log(`Queue remove failed: ${errText(err)}`, 'err')));
    return h('li', { class: current ? 'current' : '', 'aria-current': current ? 'true' : null },
      h('span', { class: 'q-idx', text: String(i + 1) }),
      h('span', { class: 'q-title', text: label, title: m?.contentId || '' }),
      play, remove);
  }));
}

function setPill(el, cls, text) {
  el.className = `pill ${cls}`.trim();
  el.textContent = text;
}

/* ---------- Receiver app ID ---------- */

function initReceiverForm() {
  $('appId').value = appId;
  $('appIdSummary').textContent = appId || 'Default Media Receiver';
  if (appId) $('receiverDetails').open = true;

  $('applyAppId').addEventListener('click', () => {
    const value = $('appId').value.trim().toUpperCase();
    if (value && !/^[A-Z0-9]{8}$/.test(value)) {
      toast('A receiver app ID is 8 letters or digits, e.g. CC1AD845', 'err');
      $('appId').focus();
      return;
    }
    if (value) { store.set(STORAGE.appId, value); params.set('appId', value); }
    else { store.remove(STORAGE.appId); params.delete('appId'); }
    location.search = params.toString();
  });
  $('appId').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('applyAppId').click(); });
}

/* ---------- Session & media actions ---------- */

function initActions() {
  $('connectBtn').addEventListener('click', () => connect());
  $('disconnectBtn').addEventListener('click', () => { castApi.disconnect(false); log('Disconnected (receiver app left running)'); });
  $('stopAppBtn').addEventListener('click', () => { castApi.disconnect(true); log('Stopped receiver app'); });

  $('mediaForm').addEventListener('submit', (e) => { e.preventDefault(); castSelected(); });
  $('queueBtn').addEventListener('click', () => queueSelected());
  $('editSelected').addEventListener('click', () => { tabs.select('tab-custom'); $('mediaUrl').focus(); });

  $('previewBtn').addEventListener('click', async () => {
    const form = validForm();
    if (!form) return;
    try {
      await preview(form.media);
      log(`Local preview: ${form.media.url}`);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      log(`Local preview failed: ${errText(err)}`, 'err');
      toast('Preview failed. The host may block playback in the browser.', 'err');
    }
  });

  $('shareBtn').addEventListener('click', async () => {
    const form = validForm();
    if (!form) return;
    const link = shareUrl(form.raw, appId);
    toast((await copyText(link)) ? 'Link copied' : 'Copy failed');
    log(`Share link: ${link}`);
  });
}

async function connect() {
  try {
    await castApi.connect();
    return true;
  } catch (err) {
    if (err === 'cancel') log('Device picker closed');
    else { log(`Connect failed: ${errText(err)}`, 'err'); toast(`Connect failed: ${errText(err)}`, 'err'); }
    return false;
  }
}

function validForm() {
  const form = readForm();
  if (!form.ok) {
    if (document.querySelector('[role="tab"][aria-selected="true"]').id !== 'tab-custom') tabs.select('tab-custom');
    form.field.focus();
    return null;
  }
  return form;
}

async function castSelected() {
  const form = validForm();
  if (!form) return;
  const { media, raw } = form;
  if (media.url.startsWith('http:') && /mpegurl|dash|sstr/i.test(media.type)) {
    log('Adaptive streams over plain HTTP are usually blocked by the receiver. Use HTTPS.', 'err');
  }
  if (!castApi.getSession() && !(await connect())) return;
  log(`Loading ${media.type} · ${media.url}`);
  $('castBtn').disabled = true;
  try {
    await castApi.loadMedia(media);
    log('Media loaded on receiver', 'ok');
    toast(`Casting “${media.title || 'media'}”`);
    addRecent(raw);
  } catch (err) {
    const msg = errText(err);
    log(`Load failed: ${msg}. Check the URL, content type, CORS headers and codec support.`, 'err');
    toast(`Load failed: ${msg}`, 'err');
  } finally {
    scheduleRender();
  }
}

async function queueSelected() {
  const form = validForm();
  if (!form) return;
  if (!castApi.getSession() && !(await connect())) return;
  try {
    const result = await castApi.enqueue(form.media);
    log(result === 'queued' ? `Added to queue: ${form.media.url}` : `Nothing was playing, so it loaded directly: ${form.media.url}`, 'ok');
    toast(result === 'queued' ? 'Added to queue' : 'Nothing was playing — started now');
    addRecent(form.raw);
  } catch (err) {
    log(`Queue failed: ${errText(err)}`, 'err');
    toast(`Queue failed: ${errText(err)}`, 'err');
  }
}

/* ---------- Remote controls ---------- */

function initControls() {
  $('playBtn').addEventListener('click', castApi.playOrPause);
  $('stopBtn').addEventListener('click', castApi.stopMedia);
  $('backBtn').addEventListener('click', () => castApi.seekBy(-SEEK_STEP));
  $('fwdBtn').addEventListener('click', () => castApi.seekBy(SEEK_STEP));
  $('prevBtn').addEventListener('click', castApi.prev);
  $('nextBtn').addEventListener('click', castApi.next);
  $('muteBtn').addEventListener('click', castApi.toggleMute);

  const seek = $('seekBar');
  seek.addEventListener('input', () => { seeking = true; $('curTime').textContent = fmtTime(+seek.value); });
  seek.addEventListener('change', () => { seeking = false; castApi.seekTo(+seek.value); });

  $('volumeBar').addEventListener('input', (e) => castApi.setVolume(+e.target.value));

  $('ccBtn').addEventListener('click', () => {
    const on = $('ccBtn').getAttribute('aria-pressed') !== 'true';
    castApi.setCaptions(on)
      .then(() => log(`Subtitles ${on ? 'on' : 'off'}`))
      .catch((err) => log(`Subtitle toggle failed: ${errText(err)}`, 'err'));
  });

  $('speed').addEventListener('change', (e) => {
    const rate = +e.target.value;
    castApi.setPlaybackRate(rate)
      .then(() => log(`Playback speed ${rate}×`))
      .catch((err) => { log(`Speed change failed: ${errText(err)}`, 'err'); e.target.value = '1'; });
  });
}

function initKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
    const p = castApi.getPlayer();
    if (!castApi.getSession() || !p) return;
    const key = e.key.toLowerCase();
    const actions = {
      ' ': () => castApi.playOrPause(),
      k: () => castApi.playOrPause(),
      arrowleft: () => castApi.seekBy(-SEEK_STEP),
      j: () => castApi.seekBy(-SEEK_STEP),
      arrowright: () => castApi.seekBy(SEEK_STEP),
      l: () => castApi.seekBy(SEEK_STEP),
      arrowup: () => castApi.setVolume((p.volumeLevel ?? 1) + VOLUME_STEP),
      arrowdown: () => castApi.setVolume((p.volumeLevel ?? 1) - VOLUME_STEP),
      m: () => castApi.toggleMute(),
      c: () => !$('ccBtn').disabled && $('ccBtn').click(),
    };
    // Space on a focused button should still activate that button.
    if (key === ' ' && e.target.closest('button, summary, a')) return;
    const action = actions[key];
    if (!action) return;
    e.preventDefault();
    action();
  });
}

/* ---------- Custom messages ---------- */

function initMessages() {
  $('msgNs').value = store.get(STORAGE.msgNs, '');
  $('msgSend').addEventListener('click', async () => {
    const ns = $('msgNs').value.trim();
    const body = $('msgBody').value.trim();
    if (!/^urn:x-cast:[\w.\-]+$/.test(ns)) {
      toast('Namespace must look like urn:x-cast:com.example.app', 'err');
      $('msgNs').focus();
      return;
    }
    let payload = body;
    try { payload = body ? JSON.parse(body) : {}; } catch { /* send as plain text */ }
    store.set(STORAGE.msgNs, ns);
    try {
      await castApi.sendCustomMessage(ns, payload);
      log(`⇢ ${ns}: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`, 'out');
    } catch (err) {
      log(`Message failed: ${errText(err)}`, 'err');
    }
  });
}

/* ---------- Share links ---------- */

function applyShareLink() {
  const raw = rawFromQuery(params);
  if (!raw) return;
  fillForm(raw);
  document.querySelectorAll('.sample').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  tabs.select('tab-custom');
  log(`Loaded shared link: ${raw.url}`);
  toast('Shared media loaded. Connect and press Cast now.');
}

/* ---------- Boot ---------- */

initTheme();
initLog();
tabs = initTabs(document.querySelector('.tabs'));
initMedia({});
checkEnvironment();
initReceiverForm();
initActions();
initControls();
initKeyboard();
initMessages();
applyShareLink();
render(); // initial disabled / idle state
startCast();
