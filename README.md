# geohash

Convert between addresses, latitude/longitude and geohashes. Edit any field and the others follow.

It is a static site with no build step and no dependencies. Coordinates and geohashes are converted in the browser. Only address lookups leave the device, and they go to [Nominatim](https://nominatim.org).

## Usage

- **Latitude, longitude** and **Geohash** update each other as you type.
- **Address** lookups run when you press Enter or leave a field, to respect Nominatim's [usage policy](https://operations.osmfoundation.org/policies/nominatim/).
- **Precision** sets the geohash length, from 1 to 12 characters.
- The page URL carries the geohash, so links can be shared: `.../geohash/#u09tunqu`.
- **Open in bitchat** appears on iPhone and iPad, and opens the geohash's location channel in [bitchat](https://github.com/permissionlesstech/bitchat). It needs at least 2 characters. The Android app doesn't open geohash links yet.

## Develop

ES modules don't load from `file://`, so serve the folder locally:

```sh
python3 -m http.server 8123
```

Run the tests with Node's built-in runner:

```sh
node --test
```

## Deploy

In the repository settings, open **Pages** and choose **Deploy from a branch**, with `master` and `/ (root)`.
