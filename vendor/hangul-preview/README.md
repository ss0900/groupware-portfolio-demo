# Hangul Preview Runtime

Vendored, unmodified rhwptopdf v0.2.2 release assets:
https://github.com/sanguneo/rhwptopdf/releases/tag/v0.2.2

The runtime uses MIT and Apache-2.0 code; retain LICENSE and NOTICE.
Our wrapper is `public/workers/hangulPreview.worker.js`. The wrapper uses only
same-origin assets and registers the bundled OFL fonts without requesting access
to the user's installed fonts. No CDN or external conversion API is used.

Fonts are from google/fonts revision
`bbda7253fc363238b05d97515ca71f8ae49c4fa9`, directories `ofl/nanumgothic`
and `ofl/nanummyeongjo`. Their OFL notices are included alongside the TTFs.

SHA-256 (verify before updating these assets):

| File | SHA-256 |
| --- | --- |
| rhwptopdf.umd.js | 7913400eae742e9f15f320fc377d5961a63216840f290a4c280fbe731ec3c0cd |
| rhwptopdf.umd_bg.wasm | 7a3e1e3e3a8d2a5bea64feac7bd8a2b556687a70874003fcf2aa6677e92f83a7 |
| NanumGothic-Regular.ttf | 76f45ef4a6bcff344c837c95a7dcc26e017e38b5846d5ae0cdcb5b86be2e2d31 |
| NanumMyeongjo-Regular.ttf | 7ed9e8653a8ed04285d51dc343ffea6eb3d9c73afc27383ea8929ee4ffd03205 |

Limits: 50 MiB source, 200 pages, 100 MiB generated PDF, 120 seconds per worker.
Workers are terminated on cancellation, success, failure, or timeout.
Rendering is best-effort: uncommon fonts, embedded objects, or advanced layouts
may differ from Hancom Office. Encrypted/unsupported documents keep the original
download action available. The originals are not modified or persisted as PDFs.
