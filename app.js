import {
  bitchatAndroidUrl,
  bitchatUrl,
  cellSize,
  decode,
  encode,
  formatDistance,
  formatLatLng,
  isAndroid,
  isGeohash,
  isIos,
  parseLatLng,
  reverseZoom,
} from './geohash.js';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const REQUEST_GAP_MS = 1100; // Nominatim allows one request per second.
const COPIED_MS = 1500;
const EXACT_ZOOM = 18;
const EXACT_ERROR = 0.00001; // Five decimals, about one metre.

const field = {
  address: document.getElementById('address'),
  coords: document.getElementById('coords'),
  hash: document.getElementById('hash'),
};
const precision = document.getElementById('precision');
const precisionValue = document.getElementById('precision-value');
const locate = document.getElementById('locate');
const locateLabel = document.getElementById('locate-label');
const mapLink = document.getElementById('map-link');
const bitchatLink = document.getElementById('bitchat-link');

// bitchat is a phone app here: desktop browsers get no link.
function channelUrl(hash) {
  if (isIos(navigator.userAgent, navigator.maxTouchPoints)) return bitchatUrl(hash);
  if (isAndroid(navigator.userAgent)) return bitchatAndroidUrl(hash);
  return null;
}

let point = null;
let lookup = null;
let nextRequestAt = 0;

function setHint(name, message = '', isError = false) {
  const hint = document.getElementById(`${name}-hint`);
  hint.textContent = message;
  hint.classList.toggle('error', isError);
  field[name].toggleAttribute('aria-invalid', false);
  if (isError && name !== 'address') field[name].setAttribute('aria-invalid', 'true');
}

function clearHints() {
  for (const name of Object.keys(field)) setHint(name);
}

function render() {
  const size = cellSize(point?.lat ?? 0, Number(precision.value));
  precisionValue.textContent = `${precision.value} (±${formatDistance(size / 2)})`;

  for (const button of document.querySelectorAll('[data-copy]')) {
    button.disabled = !field[button.dataset.copy].value;
  }

  mapLink.hidden = !point;
  if (point) {
    const { lat, lng } = point;
    const zoom = reverseZoom(Number(precision.value));
    mapLink.href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
  }

  const hash = point ? field.hash.value.toLowerCase() : '';
  const channel = channelUrl(hash);
  bitchatLink.hidden = !channel;
  if (channel) bitchatLink.href = channel;

  history.replaceState(null, '', hash ? `#${hash}` : location.pathname + location.search);
}

// Stores the point and rewrites every field except the one being edited,
// which stays exactly as typed.
function setPoint(next, editing, error = EXACT_ERROR) {
  cancelLookup();
  clearHints();
  point = next;

  if (editing !== 'address') field.address.value = '';
  if (editing !== 'coords') {
    field.coords.value = next ? formatLatLng(next.lat, next.lng, error) : '';
  }
  if (editing !== 'hash') {
    field.hash.value = next ? encode(next.lat, next.lng, Number(precision.value)) : '';
  }
  if (next && editing !== 'address') {
    setHint('address', 'Press Enter or leave the field to look up the address.');
  }
  render();
}

function applyHash(hash) {
  const { lat, lng, latErr, lngErr } = decode(hash);
  precision.value = hash.length;
  setPoint({ lat, lng }, 'hash', Math.min(latErr, lngErr));
}

function cancelLookup() {
  lookup?.abort();
  lookup = null;
}

async function nominatim(path, params) {
  cancelLookup();
  const controller = new AbortController();
  lookup = controller;

  const wait = nextRequestAt - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  controller.signal.throwIfAborted();
  nextRequestAt = Date.now() + REQUEST_GAP_MS;

  const query = new URLSearchParams({ ...params, format: 'jsonv2' });
  const response = await fetch(`${NOMINATIM_URL}/${path}?${query}`, { signal: controller.signal });
  if (!response.ok) throw new Error(`Nominatim returned ${response.status}`);
  return response.json();
}

function lookupFailed(error) {
  if (error.name === 'AbortError') return;
  setHint('address', 'Address lookup is unavailable. Coordinates and geohashes still work.', true);
}

async function reverseGeocode(zoom) {
  if (!point) return;
  setHint('address', 'Looking up…');
  try {
    const place = await nominatim('reverse', { lat: point.lat, lon: point.lng, zoom });
    field.address.value = place.display_name ?? '';
    setHint('address', place.display_name ? '' : 'No address found here.');
    render();
  } catch (error) {
    lookupFailed(error);
  }
}

async function geocode(query) {
  setHint('address', 'Looking up…');
  try {
    const [place] = await nominatim('search', { q: query, limit: 1 });
    if (!place) {
      setHint('address', 'No match found.', true);
      return;
    }
    setPoint({ lat: Number(place.lat), lng: Number(place.lon) }, 'address');
    setHint('address', place.display_name);
  } catch (error) {
    lookupFailed(error);
  }
}

function loadFromUrl() {
  const hash = location.hash.slice(1).toLowerCase();
  if (!isGeohash(hash)) return;
  field.hash.value = hash;
  applyHash(hash);
  reverseGeocode(reverseZoom(hash.length));
}

field.address.addEventListener('input', () => {
  cancelLookup();
  setHint('address');
  render();
});

field.address.addEventListener('change', () => {
  const query = field.address.value.trim();
  if (query) geocode(query);
});

field.coords.addEventListener('input', () => {
  const text = field.coords.value;
  const parsed = parseLatLng(text);
  if (parsed) setPoint(parsed, 'coords');
  else if (!text.trim()) setPoint(null, 'coords');
  else setHint('coords');
});

field.coords.addEventListener('change', () => {
  const text = field.coords.value.trim();
  if (parseLatLng(text)) reverseGeocode(EXACT_ZOOM);
  else if (text) setHint('coords', 'Use decimal degrees: latitude up to ±90, longitude up to ±180.', true);
});

field.hash.addEventListener('input', () => {
  const text = field.hash.value.trim();
  if (isGeohash(text)) applyHash(text);
  else if (!text) setPoint(null, 'hash');
  else setHint('hash', 'Geohashes use 0-9 and b-z, without i, l and o.', true);
});

field.hash.addEventListener('change', () => {
  const text = field.hash.value.trim().toLowerCase();
  if (!isGeohash(text)) return;
  field.hash.value = text;
  render();
  reverseGeocode(reverseZoom(text.length));
});

// Enter commits the field, and closes the keyboard on phones.
for (const input of Object.values(field)) {
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    input.blur();
  });
}

// Precision only changes how the point is encoded, so it never needs a lookup.
precision.addEventListener('input', () => {
  if (point) {
    field.hash.value = encode(point.lat, point.lng, Number(precision.value));
    setHint('hash');
  }
  render();
});

for (const button of document.querySelectorAll('[data-copy]')) {
  const name = button.dataset.copy;
  const label = button.getAttribute('aria-label');
  let timer;

  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(field[name].value);
    } catch {
      setHint(name, 'Could not copy. Select the text and copy it manually.');
      return;
    }
    button.classList.add('copied');
    button.setAttribute('aria-label', 'Copied');
    clearTimeout(timer);
    timer = setTimeout(() => {
      button.classList.remove('copied');
      button.setAttribute('aria-label', label);
    }, COPIED_MS);
  });
}

locate.hidden = !navigator.geolocation;
locate.addEventListener('click', () => {
  const label = locateLabel.textContent;
  locate.disabled = true;
  locateLabel.textContent = 'Locating…';
  const done = () => {
    locate.disabled = false;
    locateLabel.textContent = label;
  };

  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      done();
      setPoint({ lat: coords.latitude, lng: coords.longitude });
      reverseGeocode(EXACT_ZOOM);
    },
    (error) => {
      done();
      const denied = error.code === error.PERMISSION_DENIED;
      setHint('coords', denied ? 'Location access was denied.' : 'Could not get your location.', true);
      field.coords.removeAttribute('aria-invalid');
    },
    { enableHighAccuracy: true, timeout: 10_000 },
  );
});

window.addEventListener('hashchange', loadFromUrl);

loadFromUrl();
render();
