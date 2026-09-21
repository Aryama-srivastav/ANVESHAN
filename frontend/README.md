# ANVESHAN frontend

React + TypeScript + Vite single-page console for the ANVESHAN evidence registry.
It talks to the FastAPI backend (`../backend`) over `/v1` and is served in
production by nginx (see `nginx.conf`) or Docker (`Dockerfile`).

## Design language — "Court Registry"

Light, paper-and-ink theme defined once in `src/styles.css` (`@theme` tokens) and
mirrored in `tailwind.config.js`:

| token | value | use |
|---|---|---|
| `parchment` | `#F4EFE4` | app background |
| `paper` | `#FBF8F1` | panels / cards |
| `ink` | `#1B2A4A` | primary text |
| `registry` | `#24407A` | primary actions |
| `seal` | `#7A1F2B` | destructive / tamper states |
| `brass` (`cybergold`) | `#9A7B2E` | accents, active nav |
| `ledger` | `#1E6B4A` | verified / intact states |
| `fileline` | `#D8CFB8` | borders and dividers |

Legacy dark-theme token names (`obsidian-*`, `cybergold`, `biometric`,
`cyberalert`) are remapped onto this palette, so old class names keep working.
`glass-panel`, `glow-border*` and `seal-ring` are local utilities; `scan-line`
is a deliberate no-op left over from the retired cyber theme.

## Screens

`src/App.tsx` holds the shell (gate, login, sidebar, overview, case list/detail,
modals); `src/panels.tsx` holds the Evidence Vault (semantic search + pinned
evidence), audit logs, clearance, settings, departments and the public viewer
dashboard (notices + complaint desk).

Login flow: a steel lock-pad gate is shown first — clicking it dissolves the pad
and reveals the three sign-in modes (role access, officer email + password with
optional TOTP, public viewer with email OTP registration/verification).

## Brand assets

Drop two images into `public/brand/` — `icon.png` (logo) and `bg.png`
(background). The runtime probes for them (`new Image()`) and silently falls
back to the built-in Shield/Fingerprint icon and the default background when a
file is missing, so nothing breaks before they are uploaded.

## Commands

```bash
npm install
npm run dev          # vite dev server on :5173 (proxies /v1 + /health to :8000)
npm run typecheck    # tsc --noEmit
npm run test:unit    # vitest (jsdom) — tests/*.test.js(x)
npm run test:e2e     # playwright — tests/e2e, serves dist/ on :5173
npm run build        # production bundle into dist/
```

`VITE_API_URL` selects the backend origin (default `http://localhost:8000`).

Only synthetic data belongs in local development.