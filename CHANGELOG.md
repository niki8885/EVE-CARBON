# Changelog

All notable changes to EVE Carbon will be documented here.

---


## [0.8.0] - 2026-06-18
### Features
- **Trade hubs in Ore/Ice/Gas/Moon calculators** — choose between Jita, Amarr, Dodixie, Rens and Hek; prices come from the selected hub.
- **Skill- & standing-based market tax** — sales tax (Accounting) and broker fee (Broker Relations + faction/corp standing at the hub owner) are pulled from the character's ESI data instead of a flat number. Adds the `esi-characters.read_standings.v1` scope (re-login required for standings).
- **Sell / Buy / Split price method** — realistic fees: Sell = broker + sales tax, Buy = sales tax only, Split = midpoint.
- **Moon Calculator** — new tab. Values moon ore by its full reprocessing output (all moon materials + minerals) read from the local SDE; falls back to a primary-material estimate with a hint when the SDE isn't downloaded.
- **Character favorites** — star characters to pin them to the top of the list.
- **Current location everywhere** — shown on the Dashboard banner, the selected-character card, and each character card.
- **Jump planner → "Show route on map"** — highlights the plotted route on the galaxy map with start/end markers and auto-fit.
- **Map "You are here"** — marks the selected character's current system.

### Fixes
- **Reaction industry jobs** now show "Reaction" instead of "Activity 9" (Dashboard + Industry).
- **Jump freighter fuel & range** corrected to match Dotlan: added the Jump Freighters skill (−10%/level), fixed JF base fuel (8800 → 10000 isotopes/LY) and JDC range bonus (+25% → +20% per level).
- **Map labels** — region names now show (incl. Security overlay) when zoomed out; system names appear later so mid-zoom is no longer a cluttered mess.
- **CharDB transaction race** — serialized writes (`withTx`) to fix "cannot start a transaction within a transaction".
- **Terminal log mojibake** — main-process logs are ASCII-safe regardless of console code page; dotenv startup tip silenced.

### Security / deps
- Resolved **all 18 npm audit vulnerabilities** (2 critical, 10 high) → 0: electron 28 → 42, sqlite3 5 → 6, removed the deprecated `electron-rebuild`.

### Tooling / CI
- New staged CI pipeline: **lint → tests → coverage → build (win/mac/linux)**.
- Zero-dependency unit tests (`node:test`) for the trade and jump math, with coverage tracking.
- Added GitHub issue forms + PR template; `.env.example`; expanded `.gitignore`.
- New IPC: get-hub-prices, get-hub-meta, get-trade-profile, get-moon-reprocessing, get-skill-levels.

---

## [0.5.4] - 2026-06-03
### Changed
- Automated build and release pipeline via GitHub Actions
- Added CI test build workflow on every push to main
- Added CHANGELOG.md for release notes
- Added Automated updater 

---

## [0.5.3] - 2026-06-03
### Added
- Major Jabber fixes
- Caching layer for SDE lookups
- Tabbed blueprint details views

---

## [0.5.2] - 2026-06-03
### In Development
- Fixed major issues with the Blueprint logic, and design/ calculations
- Added Shopping Lists
- Added draggable widgets to the dashboard

---

## [0.5.1] - 2026-06-03
### In Development
- Fixed major issues with the BP Search functions
- Fixed major issues with the BP Calculations

---

## [0.5.0] - 2026-06-03
### Added
- Secure EVE SSO Integration — authenticate characters via EVE Online SSO
- Blueprint Library Management — sync, browse and organize blueprints from ESI
- Recursive Material Calculator — multi-level manufacturing trees via Fuzzwork
- Asset & Wealth Tracking — liquid wealth, market orders, item locations across character roster
- Built-in Jabber Client — XMPP connection to jabber.eveonline.com with director-only filtering
- Local SDE Database — SQLite EVE Static Data Export for offline item and type lookups
- Dynamic Theming — user-configurable themes saved locally