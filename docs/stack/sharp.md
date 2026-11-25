# Sharp (photo cleaning)

**In one line:** sharp cleans every report photo on the server: it removes the hidden GPS and camera data, shrinks it and saves it as WebP.

## What it is

Sharp is a fast image library for Node.js (built on libvips). Version 0.35.5.

## Why we use it

- Phone photos carry hidden **EXIF** data: GPS location, phone model, time. A photo of a landslide could reveal where someone lives. We remove all of it.
- Smaller photos load faster on a slow network and cost less storage.
- It refuses "decompression bombs": a small file that claims to be a huge image.

## Where it is in our project

| Path | What it does |
| --- | --- |
| `src/server/reports/photo.ts` | `cleanPhoto()`: checks and cleans one photo |
| `config/report-rules.json` | The maximum file size and side length |
| `src/server/reports/photo.test.ts` | Tests that EXIF and GPS are gone and the output is WebP |

## How it works in RouteGuard

1. Refuse the file if it's over the size limit, or its first bytes aren't a real JPEG, PNG or WebP.
2. Refuse anything over 40 million pixels before decoding.
3. `.rotate()` turns the image the right way up using its EXIF, then the EXIF is dropped.
4. `.resize()` shrinks it to fit the maximum side, never enlarging.
5. `.webp({ quality: 80 })` saves it as WebP. Sharp writes no metadata unless asked, so nothing hidden is left.
6. The clean photo goes to the private Supabase Storage bucket `report-photos`. The original is never stored.

## Learn more

- https://sharp.pixelplumbing.com

## Questions you may be asked

**Q: Why clean photos on the server and not on the phone?**
A: The phone can't be trusted: a modified app could skip it. The server cleans every photo before saving, so no unclean photo is ever stored.

**Q: What is EXIF and why remove it?**
A: Hidden data inside a photo: GPS, phone model, time. It could reveal a person's location, so we strip it.

**Q: What is a decompression bomb?**
A: A small file that expands to a gigantic image and uses up the server's memory. We refuse anything over 40 million pixels before decoding.

**Q: Why WebP?**
A: It's usually smaller than JPEG at the same quality, and every modern browser shows it.
