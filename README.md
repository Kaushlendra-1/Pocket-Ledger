# Pocket Ledger

A simple, offline-friendly expense and income tracker built with plain HTML, CSS, and JavaScript — using IndexedDB for local storage.

## Current features

- Add a transaction as either an **expense** or **income**
- Choose a category, payment method (cash/online), note, and date — with the ability to **add your own custom categories** on the fly
- All data is saved locally in your browser via **IndexedDB** — works without an internet connection
- Filter by **Today / This week / This month / All time / Custom range**
- Period summary shows Income, Expenses, and Balance for the selected range
- **Total savings** card showing your all-time income minus expenses
- View and delete past transactions (filtered by the selected period)
- **Charts**: spending by category (doughnut) and income vs. expenses over time (bar chart), powered by Chart.js
- **Installable & offline (PWA)**: works fully offline after the first load, and can be installed to your phone's home screen or your computer like a native app
- **Backup & restore**: export all data as a `.json` file, and import it back (replaces current data) — useful for backups or moving to a new device

## Project structure

```
expense-tracker/
├── index.html        # Page structure
├── style.css         # Receipt-style visual design
├── db.js              # IndexedDB helper functions (open, add, get, update, delete)
├── app.js             # App logic: form, filters, rendering, charts
├── manifest.json       # PWA metadata (name, icons, colors)
├── service-worker.js   # Caches files so the app works offline
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── README.md
```

## How to run it locally

IndexedDB and (later) service workers require the page to be served over `http://` or `https://` — opening `index.html` directly via `file://` will not work correctly.

**Option 1 — VS Code Live Server**
1. Open this folder in VS Code
2. Install the "Live Server" extension
3. Right-click `index.html` → "Open with Live Server"

**Option 2 — Python**
```bash
cd expense-tracker
python -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

## Testing offline mode

1. Open the app once with internet on (so the service worker can cache everything).
2. In Chrome/Edge DevTools: Application tab → Service Workers → check "Offline", or just turn off your Wi-Fi/data.
3. Reload the page — it should still load and work fully, including the charts.

**Note**: if you change any files, increase the `CACHE_NAME` version number in `service-worker.js` (e.g. `v1` → `v2`) so users get the updated files instead of an old cached copy.

## Installing on your phone / desktop

Once deployed on `https://` (e.g. GitHub Pages):
- **Android (Chrome)**: open the site → menu (⋮) → "Add to Home screen" / "Install app"
- **iOS (Safari)**: open the site → Share button → "Add to Home Screen"
- **Desktop (Chrome/Edge)**: an install icon appears in the address bar

The app will then open in its own window/icon, without browser tabs, and works offline.

## Deploying to GitHub Pages

This is plain static HTML/CSS/JS, so it deploys for free with **GitHub Pages**:

1. Create a new repository on GitHub (e.g. `pocket-ledger`), public.
2. From your project folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Pocket Ledger expense tracker"
   git branch -M main
   git remote add origin https://github.com/<your-username>/pocket-ledger.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Build and deployment** → Source: "Deploy from a branch", Branch: `main`, Folder: `/ (root)` → Save.
4. After a minute or two, the app is live at `https://<your-username>.github.io/pocket-ledger/`.

For future updates: edit your files, bump `CACHE_NAME` in `service-worker.js` if you changed any cached file, then:
```bash
git add .
git commit -m "Describe your change"
git push
```
GitHub Pages redeploys automatically within a minute or so of each push.

## Possible future additions

- Savings goals (target amount + progress bar per goal)
- Recurring transactions (rent, subscriptions)
- Per-category budget limits with warnings
- Editing existing transactions (currently you can only add/delete)