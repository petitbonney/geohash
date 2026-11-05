const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
const METRES_PER_DEGREE = 111_320;
const MAX_DECIMALS = 7;

// Nominatim detail level for each geohash length: country, state, county,
// city, town, neighbourhood, then building for anything finer.
const ZOOM_BY_PRECISION = [3, 5, 8, 10, 12, 14, 18];

export const MAX_PRECISION = 12;

export function encode(lat, lng, precision) {
  const latRange = [-90, 90];
  const lngRange = [-180, 180];
  let hash = '';
  let value = 0;
  let bits = 0;
  let useLng = true;

  while (hash.length < precision) {
    const range = useLng ? lngRange : latRange;
    const coordinate = useLng ? lng : lat;
    const middle = (range[0] + range[1]) / 2;
    const upperHalf = coordinate >= middle;

    value = value * 2 + (upperHalf ? 1 : 0);
    range[upperHalf ? 0 : 1] = middle;
    useLng = !useLng;

    if (++bits === 5) {
      hash += BASE32[value];
      value = 0;
      bits = 0;
    }
  }
  return hash;
}

export function decode(hash) {
  const latRange = [-90, 90];
  const lngRange = [-180, 180];
  let useLng = true;

  for (const character of hash.toLowerCase()) {
    const value = BASE32.indexOf(character);
    if (value === -1) throw new Error(`Invalid geohash: ${hash}`);

    for (let bit = 4; bit >= 0; bit--) {
      const range = useLng ? lngRange : latRange;
      const middle = (range[0] + range[1]) / 2;
      range[(value >> bit) & 1 ? 0 : 1] = middle;
      useLng = !useLng;
    }
  }

  return {
    lat: (latRange[0] + latRange[1]) / 2,
    lng: (lngRange[0] + lngRange[1]) / 2,
    latErr: (latRange[1] - latRange[0]) / 2,
    lngErr: (lngRange[1] - lngRange[0]) / 2,
  };
}

export function isGeohash(text) {
  return /^[0-9b-hjkmnp-z]{1,12}$/i.test(text);
}

export function parseLatLng(text) {
  const number = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)`;
  const match = text.match(new RegExp(`^\\s*(${number})\\s*[,;\\s]\\s*(${number})\\s*$`));
  if (!match) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export function formatLatLng(lat, lng, error) {
  const decimals = Math.min(MAX_DECIMALS, Math.max(1, Math.ceil(-Math.log10(error))));
  return `${lat.toFixed(decimals)}, ${lng.toFixed(decimals)}`;
}

// Length in metres of the longer side of a cell at this latitude.
export function cellSize(lat, precision) {
  const bits = precision * 5;
  const latDegrees = 180 / 2 ** Math.floor(bits / 2);
  const lngDegrees = 360 / 2 ** Math.ceil(bits / 2);
  const lngShrink = Math.cos((lat * Math.PI) / 180);
  return Math.max(latDegrees, lngDegrees * lngShrink) * METRES_PER_DEGREE;
}

export function formatDistance(metres) {
  if (metres >= 10_000) return `${Math.round(metres / 1000).toLocaleString('en')} km`;
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
  if (metres >= 1) return `${Math.round(metres)} m`;
  return `${Math.round(metres * 100)} cm`;
}

export function reverseZoom(precision) {
  return ZOOM_BY_PRECISION[Math.min(precision, ZOOM_BY_PRECISION.length) - 1];
}
