# F1 25 Setup Manager

Web app for **EA SPORTS F1 25** car setups: edit the same sliders as in-game, load **Matt212** community baselines per track, save your own presets, track laps, and optionally tune setups with **Claude** (Anthropic) through a small local server.

**Repository:** [github.com/benji558/f1-app-](https://github.com/benji558/f1-app-)

---

## What it does

| Area | Description |
|------|-------------|
| **Setup editor** | Front wing, rear wing, diffs, geometry, suspension, ride height, brakes, tyre PSI — same fields as the F1 25 setup screen, with live readouts. |
| **Matt212 baselines** | Per-track starting points aligned with [@matt212racing](https://www.youtube.com/@matt212racing) public F1 25 setup sheet / *Updated* guides (in-app notes cite the source). |
| **My setups** | Save named setups per track; load or delete them. Data lives in the **browser** (`localStorage`). |
| **Export / import** | Download a JSON backup (`f125-setups-backup.json`) or import one. Restores merges **and** overwrites matching keys so re-importing a backup works as expected. |
| **Bundled defaults** | Commit includes `bundled-setups.json` (empty `data` by default). On load, the app also tries `f125-setups-backup.json` if you add an export next to `server.js` — missing `f125_*` keys merge in. API keys are never in these files. |
| **Lap tracker** | Session/lap logging stored under `f125_lt_sessions` in `localStorage` (included in export backup). |
| **AI setup tuner** | Describe handling problems in plain language; the app sends your current setup + context to **Claude** and applies returned slider changes when the response is valid JSON. |

The app does **not** talk to the game executable; you copy values into F1 25 yourself.

---

## Requirements

- **Node.js** 18+ (uses native `fetch` in `server.js`)
- npm
- For AI features: an [Anthropic API key](https://console.anthropic.com/settings/keys)

---

## Quick start

```bash
git clone https://github.com/benji558/f1-app-.git
cd f1-app-
npm install
npm start
```

Open **http://localhost:3456** (or whatever port the terminal prints).

- The server listens on **all interfaces** (`0.0.0.0`) by default, so other devices on the same Wi‑Fi can open the URL shown in the console (e.g. `http://192.168.x.x:3456`).
- **Always use the same host** in the address bar (`localhost` vs `127.0.0.1` are different sites for `localStorage` — pick one and stick to it).

---

## Configuration

### Port and host

Optional environment variables (or entries in `.env`):

| Variable | Default | Meaning |
|----------|---------|---------|
| `PORT` | `3456` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address (`127.0.0.1` only if you want local-only) |

### Anthropic API key (per user)

**AI only works if that person adds their own key** in the app (**🔑 API KEY**). It is saved in **that browser’s** `localStorage` only.

- **No key → no AI** (the server does not ship a shared “house” key).
- **Export / import** of setups does **not** include the API key.
- The Node server **proxies** requests to Anthropic using the key from the request body; it is **not** written to disk.

> Optional: copy `.env.example` to `.env` for `PORT` / `HOST` only — not for Anthropic.

---

## Using the app

1. Choose a **track**, then **Load Matt212 baseline** or adjust sliders manually.
2. Name the setup and **Save** to add it under **My setups**.
3. **Export** periodically to back up `localStorage` (setups + lap data under `f125_*`).
4. **Import** a previously exported JSON file on a new browser or machine.

**PWA:** `manifest.json` is served from the root; you can “install” the app from a supporting browser while the server is running (still needs the Node server for API routes and static files).

---

## Project layout

| File | Role |
|------|------|
| `server.js` | Express static server, `/api/ai-setup` proxy to Anthropic (uses caller’s `apiKey` in JSON body) |
| `f1_setup_manager.html` | Single-page UI (HTML + CSS + JS) |
| `bundled-setups.json` | Optional seed data: `{ "data": { "f125_…": "…" } }` (tracked; empty by default) |
| `f125-setups-backup.json` | Not in the repo — you can add an **Export** file with this name beside `server.js`; it is loaded on top of `bundled-setups.json` if present |
| `manifest.json` | PWA metadata |
| `icon-192.png`, `icon-512.png` | Icons |

---

## API (local)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/ai-setup` | JSON body: `system`, `message`, **`apiKey`** (required), optional `model`, `max_tokens` — forwards to Anthropic; returns messages API JSON |

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| AI errors / “Failed to fetch” | Open the app via **http://** from the dev server, not `file://`. |
| `401` / “No API key” from AI | Use **🔑 API KEY** in the app — the server has no shared key. |
| Setups “missing” after switching clients | Same origin: use the same host (`localhost` **or** `127.0.0.1`) and port. |
| Import seems to do nothing | Use a file produced by **Export**, or JSON whose `data` object (or root) contains `f125_*` string keys. |
| Phone can’t connect | Firewall allowing inbound TCP on `PORT`; phone on same LAN; use the LAN URL from the server log. |

---

## Credits / disclaimer

- **Matt212** baselines and notes reflect community setups for F1 25; see in-app strings and [@matt212racing](https://www.youtube.com/@matt212racing) for originals.
- **F1** and **EA SPORTS F1 25** are trademarks of their owners; this project is an independent helper and is not affiliated with EA or Formula 1.
- **Claude** is a product of Anthropic.

---

## License

See repository files for license if one is added; otherwise treat as personal / local use unless the author specifies otherwise.
