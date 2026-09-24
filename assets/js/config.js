// Static configuration: sample media, storage keys and third-party script URLs.
// Every sample was checked to be reachable, and adaptive streams (HLS / DASH) send
// Access-Control-Allow-Origin, which the Cast receiver requires.

const SHAKA_ICONS = 'https://storage.googleapis.com/shaka-asset-icons';

export const SAMPLES = [
  {
    id: 'cloudfront', tag: 'MP4', name: 'Sample video', desc: 'MP4 · CloudFront',
    url: 'https://d2jjpiwbo3e767.cloudfront.net/thumbnails/1790237055659-1790237056237.mp4', type: 'video/mp4',
    thumbVideo: true,
  },
  {
    id: 'sintel', tag: 'MP4', name: 'Sintel', desc: 'Trailer · MP4',
    url: 'https://media.w3.org/2010/05/sintel/trailer.mp4', type: 'video/mp4',
    poster: 'https://media.w3.org/2010/05/sintel/poster.png', subtitle: 'Blender Foundation',
  },
  {
    id: 'bbb-mp4', tag: 'MP4', name: 'Big Buck Bunny', desc: 'Trailer · MP4',
    url: 'https://media.w3.org/2010/05/bunny/trailer.mp4', type: 'video/mp4',
    poster: 'https://media.w3.org/2010/05/bunny/poster.png', subtitle: 'Blender Foundation',
  },
  {
    id: 'oceans', tag: 'MP4', name: 'Oceans', desc: 'Clip · MP4 720p',
    url: 'https://vjs.zencdn.net/v/oceans.mp4', type: 'video/mp4',
    poster: 'https://vjs.zencdn.net/v/oceans.png', subtitle: 'Video.js sample',
  },
  {
    id: 'bbb-hls', tag: 'HLS', name: 'Big Buck Bunny', desc: 'HLS · MPEG-2 TS',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', type: 'application/x-mpegurl',
    poster: `${SHAKA_ICONS}/big_buck_bunny.png`, subtitle: 'Mux test stream',
  },
  {
    id: 'tos-hls', tag: 'HLS', name: 'Tears of Steel', desc: 'HLS · fMP4 / CMAF',
    url: 'https://test-streams.mux.dev/tos_ismc/main.m3u8', type: 'application/x-mpegurl',
    hlsSeg: 'fmp4', hlsVideoSeg: 'fmp4',
    poster: `${SHAKA_ICONS}/tears_of_steel.png`, subtitle: 'Mux test stream',
  },
  {
    id: 'angel-dash', tag: 'DASH', name: 'Angel One', desc: 'MPEG-DASH · multi-audio',
    url: 'https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd', type: 'application/dash+xml',
    poster: `${SHAKA_ICONS}/angel_one.png`, subtitle: 'Shaka Player demo',
  },
  {
    id: 'live', tag: 'LIVE', name: 'Akamai Live', desc: 'Live HLS test stream',
    url: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8', type: 'application/x-mpegurl',
    streamType: 'LIVE', subtitle: 'Akamai test stream',
  },
  {
    id: 'subs', tag: 'CC', name: 'Flower', desc: 'MP4 · WebVTT subtitles',
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', type: 'video/mp4',
    subsUrl: 'https://interactive-examples.mdn.mozilla.net/media/examples/friday.vtt', subsLang: 'en',
    subtitle: 'MDN · CC0',
  },
  {
    id: 'audio', tag: 'AUDIO', name: 'SoundHelix Song 1', desc: 'Audio · MP3',
    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', type: 'audio/mpeg',
    subtitle: 'T. Schürger',
  },
  {
    id: 'image', tag: 'IMAGE', name: 'Grapefruit', desc: 'Image · JPEG',
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-images/grapefruit-slice-332-332.jpg', type: 'image/jpeg',
    poster: 'https://interactive-examples.mdn.mozilla.net/media/cc0-images/grapefruit-slice-332-332.jpg',
  },
];

export const STORAGE = {
  theme: 'cts-theme',
  appId: 'cts-app-id',
  recent: 'cts-recent',
  msgNs: 'cts-msg-ns',
};

export const RECENT_LIMIT = 12;
export const SDK_TIMEOUT_MS = 10000;
export const SEEK_STEP = 10;
export const VOLUME_STEP = 0.05;

// Loaded on demand for local preview of adaptive streams.
export const HLS_JS = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js';
export const DASH_JS = 'https://cdn.jsdelivr.net/npm/dashjs@4/dist/dash.all.min.js';

export const MEDIA_NAMESPACE = 'urn:x-cast:com.google.cast.media';
