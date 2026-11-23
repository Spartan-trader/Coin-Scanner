# Coin Scanner

Personal coin collection scanner. Photograph the front and back of a coin, record
what it is and what it is worth, press **Save & Next Coin**, repeat.

It is a Progressive Web App: open it in Chrome on Android and choose
**Add to Home screen** to use it like a normal app. It also works on Windows in
Chrome or Edge.

## Where your data lives

Everything (records and photos) is stored **only in the browser on the device you
use**, in IndexedDB. Nothing is uploaded anywhere. To keep it safe or move it to
another device, use **Backup → Download full backup** (a `.zip` with every record
and photo), and **Restore from backup** on the other device.

## Status

| Phase | What | State |
|---|---|---|
| 1 | Camera capture, front/back pairing, Save & Next, local database, collection, edit, backup/restore, CSV | **Done** |
| 2 | AI identification (needs a small server to keep the API key secret) | Not started |
| 3 | Reference catalog and valuation sources | Not started |
| 4 | Multi-coin and grid batch scanning | Not started |
| 5 | Duplicate detection, statistics, alerts | Partly (search/filter/stats done) |
| 6 | Paper money | Not started (data model already allows it) |

Values are never invented: a coin with no value entered shows
**“Value not yet verified”** and is left out of totals, never counted as $0.

## For development

```bash
npm install
npm run dev        # local development server
npm test           # unit tests (database, pairing, backup, CSV, 2,000-record performance)
npm run build      # production build into dist/
npm run test:e2e   # end-to-end test in headless Chromium with a simulated camera (run build first)
```

Pushing to `main` runs the tests and publishes the app to GitHub Pages
(`.github/workflows/deploy.yml`).

### Layout

- `src/db/` – data model (`types.ts`) and IndexedDB access (`db.ts`)
- `src/lib/` – image resizing, backup/restore, CSV export, statistics
- `src/components/` – camera capture, identification form
- `src/screens/` – Scan flow, Collection, Coin detail, Backup
- `tests/` – unit tests; `e2e/` – browser test and icon generator
