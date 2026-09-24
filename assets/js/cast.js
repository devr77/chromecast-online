// Thin wrapper around the Google Cast Web Sender SDK (CAF).
// Emits events on `castEvents` so the UI never touches the SDK directly:
//   ready, caststate, session, player, queue, message
import { mediaKind, fileName } from './utils.js';
import { MEDIA_NAMESPACE } from './config.js';

export const castEvents = new EventTarget();
const emit = (type, detail) => castEvents.dispatchEvent(new CustomEvent(type, { detail }));

let context = null;
let player = null;
let controller = null;
let boundMedia = null;
const messageNamespaces = new WeakMap(); // CastSession -> Set<namespace>

/* ---------- Setup ---------- */

/** Resolves true once the SDK is ready, false if the browser is unsupported. */
export async function initCast(appId) {
  const available = await window.__castApiReady;
  if (!available || !window.cast?.framework) return false;

  const cf = cast.framework;
  context = cf.CastContext.getInstance();
  context.setOptions({
    receiverApplicationId: appId || chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
    autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
    resumeSavedSession: true,
  });

  context.addEventListener(cf.CastContextEventType.CAST_STATE_CHANGED, (e) => emit('caststate', e.castState));
  context.addEventListener(cf.CastContextEventType.SESSION_STATE_CHANGED, (e) => {
    emit('session', { state: e.sessionState, error: e.errorCode });
    bindMediaSession();
  });

  player = new cf.RemotePlayer();
  controller = new cf.RemotePlayerController(player);
  controller.addEventListener(cf.RemotePlayerEventType.ANY_CHANGE, (e) => {
    if (e.field === 'isMediaLoaded' || e.field === 'mediaInfo') bindMediaSession();
    emit('player', { field: e.field, value: e.value });
  });

  emit('ready', { appId: appId || chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID });
  emit('caststate', context.getCastState());
  return true;
}

/** Listen for queue / track updates on the current media session. */
function bindMediaSession() {
  const media = getSession()?.getMediaSession() || null;
  if (media && media !== boundMedia) {
    boundMedia = media;
    media.addUpdateListener((alive) => {
      if (!alive && boundMedia === media) boundMedia = null;
      emit('queue');
    });
  }
  emit('queue');
}

/* ---------- State getters ---------- */

export const isReady = () => !!context;
export const getPlayer = () => player;
export const getSession = () => context?.getCurrentSession() || null;
export const getCastState = () => context?.getCastState() || null;

export function getQueue() {
  const media = getSession()?.getMediaSession();
  return {
    items: media?.items || [],
    currentItemId: media?.currentItemId ?? null,
  };
}

export function getTextTrackIds() {
  const tracks = player?.mediaInfo?.tracks || [];
  return tracks.filter((t) => t.type === chrome.cast.media.TrackType.TEXT).map((t) => t.trackId);
}

export function getActiveTrackIds() {
  return getSession()?.getMediaSession()?.activeTrackIds || [];
}

/* ---------- Session ---------- */

export async function connect() {
  await context.requestSession(); // rejects with chrome.cast.ErrorCode (e.g. 'cancel')
  return getSession();
}

async function ensureSession() {
  return getSession() || connect();
}

/** @param {boolean} stopApp  true also closes the receiver app on the device */
export function disconnect(stopApp) {
  context?.endCurrentSession(stopApp);
}

/* ---------- Loading media ---------- */

/**
 * @param {object} m  media descriptor from the form:
 *   { url, type, streamType, title, subtitle, poster, startTime, autoplay,
 *     subsUrl, subsLang, hlsSeg, hlsVideoSeg, customData }
 */
function buildMediaInfo(m) {
  const cm = chrome.cast.media;
  const type = m.type || 'video/mp4';
  const info = new cm.MediaInfo(m.url, type);
  info.contentUrl = m.url;
  info.streamType = cm.StreamType[m.streamType] || cm.StreamType.BUFFERED;

  if (/mpegurl/i.test(type)) {
    if (m.hlsSeg) info.hlsSegmentFormat = m.hlsSeg;
    if (m.hlsVideoSeg) info.hlsVideoSegmentFormat = m.hlsVideoSeg;
  }

  const kind = mediaKind(type);
  let meta;
  if (kind === 'image') {
    meta = new cm.PhotoMediaMetadata();
  } else if (kind === 'audio') {
    meta = new cm.MusicTrackMediaMetadata();
    if (m.subtitle) meta.artist = m.subtitle;
  } else {
    meta = new cm.MovieMediaMetadata();
    if (m.subtitle) meta.subtitle = m.subtitle;
  }
  meta.title = m.title || fileName(m.url);
  if (m.poster) meta.images = [new chrome.cast.Image(m.poster)];
  info.metadata = meta;

  if (m.subsUrl) {
    const track = new cm.Track(1, cm.TrackType.TEXT);
    track.trackContentId = m.subsUrl;
    track.trackContentType = 'text/vtt';
    track.subtype = cm.TextTrackType.SUBTITLES;
    track.language = m.subsLang || 'en';
    track.name = (m.subsLang || 'en').toUpperCase();
    info.tracks = [track];
  }
  return info;
}

export async function loadMedia(m) {
  const session = await ensureSession();
  const request = new chrome.cast.media.LoadRequest(buildMediaInfo(m));
  request.autoplay = m.autoplay !== false;
  if (m.startTime > 0) request.currentTime = m.startTime;
  if (m.subsUrl) request.activeTrackIds = [1];
  if (m.customData) request.customData = m.customData;

  const err = await session.loadMedia(request); // resolves undefined on success
  if (err) throw err;
}

/** Appends to the receiver queue, or loads directly when nothing is playing. */
export async function enqueue(m) {
  const session = await ensureSession();
  const media = session.getMediaSession();
  if (!media || !player.isMediaLoaded) {
    await loadMedia(m);
    return 'loaded';
  }
  const item = new chrome.cast.media.QueueItem(buildMediaInfo(m));
  item.autoplay = true;
  item.preloadTime = 20;
  if (m.startTime > 0) item.startTime = m.startTime;
  if (m.subsUrl) item.activeTrackIds = [1];
  if (m.customData) item.customData = m.customData;
  await callbackToPromise((ok, fail) => media.queueAppendItem(item, ok, fail));
  return 'queued';
}

export function queueJump(itemId) {
  const media = getSession()?.getMediaSession();
  return callbackToPromise((ok, fail) => media.queueJumpToItem(itemId, ok, fail));
}

export function queueRemove(itemId) {
  const media = getSession()?.getMediaSession();
  return callbackToPromise((ok, fail) => media.queueRemoveItem(itemId, ok, fail));
}

function callbackToPromise(fn) {
  return new Promise((resolve, reject) => fn(resolve, reject));
}

/* ---------- Transport ---------- */

export const playOrPause = () => controller?.playOrPause();
export const stopMedia = () => controller?.stop();
export const toggleMute = () => controller?.muteOrUnmute();
export const next = () => controller?.queueNext();
export const prev = () => controller?.queuePrev();

export function seekTo(seconds) {
  if (!player?.canSeek) return;
  const max = player.duration || seconds;
  player.currentTime = Math.max(0, Math.min(seconds, max));
  controller.seek();
}

export const seekBy = (delta) => player && seekTo((player.currentTime || 0) + delta);

export function setVolume(level) {
  if (!player) return;
  player.volumeLevel = Math.max(0, Math.min(1, level));
  controller.setVolumeLevel();
}

export function setCaptions(on) {
  const media = getSession()?.getMediaSession();
  const ids = on ? getTextTrackIds().slice(0, 1) : [];
  const req = new chrome.cast.media.EditTracksInfoRequest(ids);
  return callbackToPromise((ok, fail) => media.editTracksInfo(req, ok, fail));
}

/** Uses the standard media namespace; the receiver must support SET_PLAYBACK_RATE. */
export function setPlaybackRate(rate) {
  const session = getSession();
  const media = session?.getMediaSession();
  if (!media) return Promise.reject(new Error('No media loaded'));
  return session.sendMessage(MEDIA_NAMESPACE, {
    type: 'SET_PLAYBACK_RATE',
    playbackRate: rate,
    mediaSessionId: media.mediaSessionId,
    requestId: Math.floor(Math.random() * 1e9),
  });
}

/* ---------- Custom messages ---------- */

export async function sendCustomMessage(namespace, payload) {
  const session = getSession();
  if (!session) throw new Error('Not connected');
  let seen = messageNamespaces.get(session);
  if (!seen) messageNamespaces.set(session, (seen = new Set()));
  if (!seen.has(namespace)) {
    session.addMessageListener(namespace, (ns, message) => emit('message', { namespace: ns, message }));
    seen.add(namespace);
  }
  await session.sendMessage(namespace, payload);
}
