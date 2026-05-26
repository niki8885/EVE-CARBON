# `assets.js` — Function Reference

Handles three distinct feature areas that all read from `character_information.db`:
- **Assets page** — loads, filters, and virtually renders the full cross-character asset inventory
- **Wallets page** — renders wallet balance cards and wires the "View Journal" button
- **Wallet Journal modal** — opens the per-character journal/transaction/LP overlay

No function in this file calls ESI directly for assets or wallet balances — all reads go through the local DB first, with ESI only as a fallback for wallet journal data when the DB is empty.

---

## Module-level constants and state

| Symbol | Type | Purpose |
|--------|------|---------|
| `allAssetsCache` | array | Full unfiltered asset list loaded from DB; shared with `state.js` |
| `filteredAssetsCache` | array | Current filtered slice used for rendering |
| `assetsRenderPos` | number | Cursor into `filteredAssetsCache` for virtual scroll chunking |
| `priceCache` | object | `{ typeId: { buy, sell } }` — Jita prices fetched on demand |
| `ASSET_CHUNK` | number | Rows rendered per scroll event (virtual scroll page size) |
| `JOURNAL_CATEGORIES` | object | Maps EVE `ref_type` strings → `'Bounty' \| 'Trade' \| 'Transfers' \| 'Misc'` |
| `CATEGORY_COLORS` | object | Maps category name → hex colour for the ring chart |

---

## Assets — data loading

### `loadAssetsFromDb()`
**Type:** `async function → asset[]`  
**Called by:** `loadAssets()`, `prefetchAssetsBackground()`

Fetches the grouped asset rows for every logged-in character from `character_information.db` in parallel. Normalises the `type_name` field to `.name` so the rest of the render pipeline works without changes. Returns a flat merged array with `characterId` and `characterName` attached to every row.

**Links to:**
- `window.eveAPI.getAccounts()` → `preload.js` → `main.js` IPC `get-accounts`
- `window.eveAPI.getCharacterAssets(characterId)` → `preload.js` → `main.js` IPC `get-character-assets-db` → `character_info_db.getCharacterAssets()`

---

### `loadAssets()`
**Type:** `async function`  
**Called by:** `navigateToPage('assets')` in `ui.js`

Main entry point for the Assets page. Orchestrates the full load-filter-render cycle:

1. Shows a loading placeholder in `#assetTable tbody`
2. Calls `loadAssetsFromDb()` to get all assets
3. Writes to `allAssetsCache`
4. Calls `populateAssetFilters()` to build dropdowns
5. Calls `filterAssets()` to apply any pre-existing filter state and trigger first render
6. Attaches the `assetTableScrollHandler` to `#assetTableWrapper` for virtual scrolling
7. Schedules two background re-polls at **5 s** and **30 s** to pick up location/region names that the locator pipeline resolves asynchronously after a sync. Re-renders only if previously-null `region_name` fields have been filled in

**Links to:**
- `loadAssetsFromDb()` — data source
- `populateAssetFilters()` — dropdown builder
- `filterAssets()` — filter + render trigger
- `assetTableScrollHandler` — scroll listener
- `allAssetsCache` → `state.js`
- `#assetTable tbody`, `#assetSummary`, `#assetTableWrapper` — DOM targets
- `#assetCharFilter`, `#assetRegionFilter`, `#assetCorpFilter`, `#assetSearch` — filter inputs read during background re-poll

---

### `prefetchAssetsBackground()`
**Type:** `async function`  
**Called by:** `DOMContentLoaded` in `app.js`

Silently warms `allAssetsCache` and the filter dropdowns at startup without showing any loading state. No ESI calls. Means the Assets page opens instantly on first navigation instead of showing a loading spinner.

**Links to:**
- `loadAssetsFromDb()` — data source
- `populateAssetFilters()` — warms dropdown state
- `allAssetsCache` → `state.js`

---

## Assets — filtering

### `populateAssetFilters(assets)`
**Type:** `function`  
**Called by:** `loadAssets()`, `prefetchAssetsBackground()`

Rebuilds the three filter dropdowns from the supplied asset array. Preserves the current selection across reloads so a background refresh doesn't reset the user's active filter.

- **Characters** (`#assetCharFilter`) — unique by `characterId`, sorted by name
- **Regions** (`#assetRegionFilter`) — unique `region_name` values; appends an `(Unresolved — N)` option for any rows still missing a region name, so those assets are never invisible
- **Corps** (`#assetCorpFilter`) — unique `owner_name` values

**Links to:**
- `#assetCharFilter`, `#assetRegionFilter`, `#assetCorpFilter` — DOM selects

---

### `filterAssets()`
**Type:** `function`  
**Called by:** `loadAssets()`, filter `onchange` handlers (wired in page HTML), background re-poll inside `loadAssets()`

Reads the current values of all four filter controls and rebuilds `filteredAssetsCache`. The `__unresolved__` sentinel value on the region filter matches rows where `region_name` is null. After filtering, updates the `#assetSummary` count label, resets `assetsRenderPos` to 0, clears the table body, and calls `renderNextAssetChunk()` to paint the first page.

**Links to:**
- `allAssetsCache` → `state.js` — source data
- `filteredAssetsCache` → `state.js` — write target
- `assetsRenderPos` → `state.js`
- `#assetSearch`, `#assetCharFilter`, `#assetRegionFilter`, `#assetCorpFilter` — filter inputs
- `#assetSummary` — count label
- `#assetTable tbody` — cleared before re-render
- `renderNextAssetChunk()` — renders first chunk

---

## Assets — rendering

### `renderNextAssetChunk()`
**Type:** `function`  
**Called by:** `filterAssets()`, `assetTableScrollHandler()`

Virtual scroll renderer. Reads `ASSET_CHUNK` rows from `filteredAssetsCache` starting at `assetsRenderPos`, builds HTML for each row, and appends to `#assetTable tbody`. Advances `assetsRenderPos` by the chunk size.

After inserting rows, collects all unique `type_id` values in the chunk that aren't yet in `priceCache` and fires a single batched `getJitaPrices()` call. On resolution, patches the `.asset-price` cells in-place without re-rendering the whole table. Colour-codes security status using the same thresholds as the EVE client (≥0.5 teal, ≥0.1 yellow, <0.1 red).

**Links to:**
- `filteredAssetsCache` / `allAssetsCache` → `state.js`
- `assetsRenderPos` → `state.js`
- `ASSET_CHUNK` — chunk size constant
- `#assetTable tbody` — DOM append target
- `priceCache` — read and written inline
- `window.eveAPI.getJitaPrices(typeIds)` → `preload.js` → `main.js` IPC `get-jita-prices`

---

### `assetTableScrollHandler(e)`
**Type:** `function`  
**Called by:** `scroll` event on `#assetTableWrapper` (wired in `loadAssets()`)

Triggers `renderNextAssetChunk()` when the user scrolls within 300px of the bottom of the visible area, implementing infinite virtual scroll.

**Links to:**
- `renderNextAssetChunk()` — next page renderer
- `#assetTableWrapper` — scroll container

---

## Wallets

### `renderWallets()`
**Type:** `async function`  
**Called by:** `navigateToPage('wallets')` in `ui.js`

Renders a wallet balance card for every character into `#walletsGrid`. Guarded by `_isLoading` to prevent concurrent calls.

Data priority per character:
1. `getCharacterData(characterId).wallet.balance` — most recent row from `char_X_wallet` in the local DB
2. `dashboard_cache.walletByChar[characterId]` — stale dashboard cache if DB has no row yet
3. `0` — fallback if neither is available

Animates the balance number using `countUp()`. Wires a "View Journal" button on each card that opens the journal modal.

**Links to:**
- `window.eveAPI.getAccounts()` → `preload.js` → IPC `get-accounts`
- `window.eveAPI.getCharacterData(characterId)` → `preload.js` → IPC `get-character-info-db` → `character_info_db.getCharacterData()`
- `window.eveAPI.cacheGet('dashboard_cache')` → `preload.js` → IPC `cache-get`
- `countUp()` → `utils.js`
- `escHtml()` → `utils.js`
- `openWalletJournal()` — wired on each "View Journal" button click
- `#walletsGrid` — DOM target

---

## Wallet Journal modal

### `openWalletJournal(characterId, characterName)`
**Type:** `async function`  
**Called by:** "View Journal" button click handler in `renderWallets()`

Opens `#walletJournalBackdrop`, sets the character portrait and name in the modal header, resets to the Overview tab, then loads journal entries and LP data in parallel. Passes results to the three renderers.

**Links to:**
- `setJournalTab('overview')` — resets tab state on open
- `loadJournalEntries(characterId)` — journal data loader
- `loadLPData(characterId)` — LP data loader
- `renderJournalOverview()` — Overview tab renderer
- `renderJournalTransactions()` — Transactions tab renderer
- `renderJournalLP()` — LP tab renderer
- `#walletJournalBackdrop`, `#journalCharPortrait`, `#journalCharName` — DOM targets

---

### `closeWalletJournal()`
**Type:** `function`  
**Called by:** `✕` close button (`onclick` in `index.html`), backdrop click (wired in `bindJournalTabs` IIFE)

Hides the journal modal and destroys the Chart.js doughnut instance on `#journalRingChart` to free memory.

**Links to:**
- `#walletJournalBackdrop` — hides modal
- `#journalRingChart._chartInstance` — Chart.js instance destroyed on close

---

### `setJournalTab(tab)`
**Type:** `function`  
**Called by:** `openWalletJournal()`, `bindJournalTabs` IIFE click handler

Switches the active journal tab by toggling `.journal-tab-btn` styles and showing/hiding `.journal-tab-content` panels. Tab IDs are `overview`, `transactions`, `lp`.

**Links to:**
- `.journal-tab-btn` — tab buttons in `index.html`
- `#journalTab-overview`, `#journalTab-transactions`, `#journalTab-lp` — content panels

---

### `bindJournalTabs` (IIFE)
**Type:** self-invoking function, runs once at script parse time  
**Called by:** module load (not called manually)

Attaches two `document`-level click handlers using event delegation:
- `.journal-tab-btn` clicks → `setJournalTab()`
- Click directly on `#walletJournalBackdrop` → `closeWalletJournal()`

Using `document`-level delegation means this only needs to run once even though the modal HTML is always in the DOM.

**Links to:**
- `setJournalTab()` — tab switcher
- `closeWalletJournal()` — close handler

---

## Data loaders

### `loadJournalEntries(characterId)`
**Type:** `async function → entry[]`  
**Called by:** `openWalletJournal()`

Two-stage data fetch with fallback:
1. **Primary:** `getWalletJournal(characterId)` from `character_information.db` (synced every 30 min by the core character sync pipeline)
2. **Fallback:** live ESI `v6/characters/{id}/wallet/journal/` page 1 if the DB returns empty (e.g. character has never been synced)

**Links to:**
- `window.eveAPI.getWalletJournal(characterId)` → `preload.js` → IPC `get-wallet-journal` → `character_info_db.getWalletJournal()`
- `window.eveAPI.esiFetch(url)` → `preload.js` → IPC `esi-fetch` (fallback only)

---

### `loadLPData(characterId)`
**Type:** `async function → lpRow[]`  
**Called by:** `openWalletJournal()`

Same two-stage pattern as `loadJournalEntries`:
1. **Primary:** `getLoyaltyPoints(characterId)` from `character_information.db`
2. **Fallback:** live ESI `v1/characters/{id}/loyalty/points/`

**Links to:**
- `window.eveAPI.getLoyaltyPoints(characterId)` → `preload.js` → IPC `get-loyalty-points` → `character_info_db.getLoyaltyPoints()`
- `window.eveAPI.esiFetch(url)` → `preload.js` → IPC `esi-fetch` (fallback only)

---

## Renderers

### `renderJournalOverview(entries)`
**Type:** `function`  
**Called by:** `openWalletJournal()`

Filters entries to the last 30 days, classifies each by `classifyEntry()`, and computes totals per category. Updates three summary DOM elements (`#journalIncomeTotal`, `#journalExpenseTotal`, `#journalRingValue`) and builds the income breakdown legend in `#journalLegend`. Destroys any previous Chart.js instance and creates a new doughnut ring chart on `#journalRingChart`.

**Links to:**
- `classifyEntry()` — per-entry category classifier
- `formatISK()` → `utils.js`
- `CATEGORY_COLORS` — colour map constant
- `Chart` → Chart.js (loaded via CDN in `index.html`)
- `#journalIncomeTotal`, `#journalExpenseTotal`, `#journalRingValue`, `#journalLegend`, `#journalRingChart` — DOM targets

---

### `renderJournalTransactions(entries)`
**Type:** `function`  
**Called by:** `openWalletJournal()`

Renders up to 500 journal entries sorted newest-first into `#journalTransactionBody`. Colours amounts green/red based on sign, humanises `ref_type` snake_case to Title Case, and sanitises description text via `escHtml()`.

**Links to:**
- `formatISK()` → `utils.js`
- `escHtml()` → `utils.js`
- `#journalTransactionBody` — DOM target

---

### `renderJournalLP(lpRows)`
**Type:** `async function`  
**Called by:** `openWalletJournal()`

Sorts LP rows by points descending, resolves corporation names in bulk via `getNames()`, then renders the table into `#journalLPBody`. The "Closest LP Store" column is a placeholder (`—`) — live store lookup is not yet implemented.

**Links to:**
- `window.eveAPI.getNames(ids)` → `preload.js` → IPC `esi-names`
- `escHtml()` → `utils.js`
- `#journalLPBody` — DOM target

---

### `classifyEntry(entry)`
**Type:** `function → string`  
**Called by:** `renderJournalOverview()`

Looks up `entry.ref_type` in `JOURNAL_CATEGORIES` and returns the category string (`'Bounty'`, `'Trade'`, `'Transfers'`, or `'Misc'`).

**Links to:**
- `JOURNAL_CATEGORIES` — lookup table constant

---

## Cross-file dependency map

```
assets.js
├── state.js
│   ├── allAssetsCache
│   ├── filteredAssetsCache
│   ├── assetsRenderPos
│   └── priceCache
├── utils.js
│   ├── formatISK()
│   ├── escHtml()
│   └── countUp()
├── ui.js
│   └── navigateToPage() — triggers loadAssets() / renderWallets()
├── app.js
│   └── prefetchAssetsBackground() called on DOMContentLoaded
└── preload.js (IPC → main.js)
    ├── get-accounts
    ├── get-character-assets-db    → character_info_db.getCharacterAssets()
    ├── get-character-info-db      → character_info_db.getCharacterData()
    ├── get-wallet-journal         → character_info_db.getWalletJournal()
    ├── get-loyalty-points         → character_info_db.getLoyaltyPoints()
    ├── get-jita-prices            → main.js ESI market fetch
    ├── esi-names                  → ESI /v3/universe/names/
    ├── esi-fetch                  → ESI (journal/LP fallback only)
    └── cache-get                  → file cache (wallet fallback)
```