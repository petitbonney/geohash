import assert from 'node:assert/strict';
import { test } from 'node:test';
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

const near = (actual, expected, tolerance) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} is not within ${tolerance} of ${expected}`,
  );

test('encode matches published reference geohashes', () => {
  assert.equal(encode(57.64911, 10.40744, 11), 'u4pruydqqvj');
  assert.equal(encode(42.605, -5.603, 5), 'ezs42');
});

test('encode honours the requested precision', () => {
  assert.equal(encode(57.64911, 10.40744, 1), 'u');
  assert.equal(encode(57.64911, 10.40744, 12).length, 12);
});

test('encode handles the corners of the world', () => {
  assert.equal(encode(-90, -180, 4), '0000');
  assert.equal(encode(90, 180, 4), 'zzzz');
  assert.equal(encode(0, 0, 4), 's000');
});

test('decode returns the centre of the cell', () => {
  const { lat, lng } = decode('ezs42');
  near(lat, 42.605, 0.001);
  near(lng, -5.603, 0.001);
});

test('decode returns the half-size of the cell as error', () => {
  const { latErr, lngErr } = decode('ezs42');
  near(latErr, 0.02197, 0.00001);
  near(lngErr, 0.02197, 0.00001);
});

test('decode is case-insensitive', () => {
  assert.deepEqual(decode('EZS42'), decode('ezs42'));
});

test('decode rejects characters outside the alphabet', () => {
  assert.throws(() => decode('ezs4a'), /invalid geohash/i);
});

test('a decoded cell re-encodes to the same geohash', () => {
  for (const hash of ['u', 'ezs42', 'u4pruydqqvj', '000000000000', 'zzzzzzzzzzzz']) {
    const { lat, lng } = decode(hash);
    assert.equal(encode(lat, lng, hash.length), hash);
  }
});

test('isGeohash accepts valid hashes in either case', () => {
  assert.equal(isGeohash('u09tun'), true);
  assert.equal(isGeohash('U09TUN'), true);
});

test('isGeohash rejects the excluded letters a, i, l and o', () => {
  for (const hash of ['a', 'i', 'l', 'o']) assert.equal(isGeohash(hash), false);
});

test('isGeohash rejects empty and over-long input', () => {
  assert.equal(isGeohash(''), false);
  assert.equal(isGeohash('s'.repeat(13)), false);
});

test('parseLatLng reads the usual separators', () => {
  const expected = { lat: 48.85837, lng: 2.29448 };
  assert.deepEqual(parseLatLng('48.85837, 2.29448'), expected);
  assert.deepEqual(parseLatLng('48.85837,2.29448'), expected);
  assert.deepEqual(parseLatLng('48.85837 2.29448'), expected);
  assert.deepEqual(parseLatLng('  48.85837 ; 2.29448  '), expected);
});

test('parseLatLng reads negative coordinates', () => {
  assert.deepEqual(parseLatLng('-33.8688, -151.2093'), { lat: -33.8688, lng: -151.2093 });
});

test('parseLatLng accepts the limits of the valid range', () => {
  assert.deepEqual(parseLatLng('90, 180'), { lat: 90, lng: 180 });
  assert.deepEqual(parseLatLng('-90, -180'), { lat: -90, lng: -180 });
});

test('parseLatLng returns null when out of range', () => {
  assert.equal(parseLatLng('90.1, 0'), null);
  assert.equal(parseLatLng('0, 180.1'), null);
});

test('parseLatLng returns null for anything but two numbers', () => {
  for (const text of ['', '48.8', 'paris', '1, 2, 3', '1e2, 3', '48.8, east']) {
    assert.equal(parseLatLng(text), null, `accepted "${text}"`);
  }
});

test('formatLatLng keeps enough decimals to match the cell', () => {
  assert.equal(formatLatLng(48.858371234, 2.294481234, 0.00001), '48.85837, 2.29448');
  assert.equal(formatLatLng(48.858371234, 2.294481234, 0.3), '48.9, 2.3');
});

test('formatLatLng output parses back', () => {
  assert.deepEqual(parseLatLng(formatLatLng(-33.8688, 151.2093, 0.0001)), {
    lat: -33.8688,
    lng: 151.2093,
  });
});

test('cellSize reports the larger side of a cell in metres', () => {
  near(cellSize(0, 1), 5_000_000, 100_000);
  near(cellSize(0, 5), 4_900, 100);
  near(cellSize(0, 8), 38, 1);
});

test('cellSize shrinks as longitude degrees shorten towards the poles', () => {
  near(cellSize(60, 8), 19, 1);
});

test('cellSize never drops below the north-south size of the cell', () => {
  near(cellSize(90, 5), 4_900, 100);
});

test('formatDistance picks a readable unit', () => {
  assert.equal(formatDistance(2_504_000), '2,504 km');
  assert.equal(formatDistance(2_446), '2.4 km');
  assert.equal(formatDistance(19.1), '19 m');
  assert.equal(formatDistance(0.6), '60 cm');
});

test('reverseZoom asks for less detail on larger cells', () => {
  assert.equal(reverseZoom(1), 3);
  assert.equal(reverseZoom(3), 8);
  assert.equal(reverseZoom(5), 12);
  assert.equal(reverseZoom(7), 18);
  assert.equal(reverseZoom(12), 18);
});

test('bitchatUrl links to the location channel', () => {
  assert.equal(bitchatUrl('u09tunqu'), 'bitchat://geohash/u09tunqu');
  assert.equal(bitchatUrl('u0'), 'bitchat://geohash/u0');
  assert.equal(bitchatUrl('u09tunquvwxy'), 'bitchat://geohash/u09tunquvwxy');
});

test('bitchatUrl lowercases the geohash', () => {
  assert.equal(bitchatUrl('U09TUNQU'), 'bitchat://geohash/u09tunqu');
});

test('bitchatUrl has no link for geohashes bitchat rejects', () => {
  assert.equal(bitchatUrl(''), null);
  assert.equal(bitchatUrl('u'), null);
  assert.equal(bitchatUrl('u09tunquvwxyz'), null);
  assert.equal(bitchatUrl('hello'), null);
  assert.equal(bitchatUrl('u09/../x'), null);
});

test('isIos recognises iPhones and iPads only', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
  const oldIpad = 'Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1';
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15';
  const android = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';

  assert.equal(isIos(iphone, 5), true);
  assert.equal(isIos(oldIpad, 5), true);
  assert.equal(isIos(mac, 5), true); // iPadOS Safari reports a Mac user agent.
  assert.equal(isIos(mac, 0), false);
  assert.equal(isIos(android, 5), false);
});

test('bitchatAndroidUrl carries the geohash to the Android app', () => {
  assert.equal(
    bitchatAndroidUrl('u09tunqu'),
    'intent://verify#Intent;scheme=bitchat;package=com.bitchat.droid;B.open_geohash_chat=true;S.geohash=u09tunqu;end',
  );
});

test('bitchatAndroidUrl lowercases the geohash', () => {
  assert.equal(
    bitchatAndroidUrl('U09TU'),
    'intent://verify#Intent;scheme=bitchat;package=com.bitchat.droid;B.open_geohash_chat=true;S.geohash=u09tu;end',
  );
});

test('bitchatAndroidUrl has no link for text that is not a channel', () => {
  assert.equal(bitchatAndroidUrl(''), null);
  assert.equal(bitchatAndroidUrl('u'), null);
  assert.equal(bitchatAndroidUrl('u09;S.x=y'), null);
});

test('isAndroid recognises Android only', () => {
  const pixel = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
  const windows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

  assert.equal(isAndroid(pixel), true);
  assert.equal(isAndroid(iphone), false);
  assert.equal(isAndroid(windows), false);
});
