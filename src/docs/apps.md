# `app.js` — Function Reference

Bootstrap and initialisation file for EVE Carbon. Wires all renderer-side modules together on `DOMContentLoaded`. Feature logic lives in the split files listed below; `app.js` is the entry point that calls into them.

---

## Top-level bootstrap

### `DOMContentLoaded` listener
**Type:** async event handler  
**Trigger:** fires once when the DOM is fully parsed

The main init sequence. Runs in order:

| Step | Call | What it does |
|------|------|--------------|
| 1 | `window.__pagesReady` | Waits for `pageLoader.js` to inject all `pages/*.html` fragments into `#navPagesContainer` before any code queries `#page-*` elements |
| 2 | `loadAccounts()` | Loads saved EVE characters from the main process → `characters.js` |
| 3 | `loadBlueprintLibrary()` | Fetches and renders the blueprint library panel → `blueprints.js` |
| 4 | `buildCategoryBrowse()` | Builds the category tree in the blueprint browser → `blueprints.js` / `categories.js` |
| 5 | `bindEvents()` | Wires all global DOM event listeners → defined below in `app.js` |
| 6 | `bindUISettings()` | Wires the Settings drawer open/close/save → `ui.js` |
| 7 | `bindNavigation()` | Wires sidebar nav buttons and the industry dropdown → `ui.js` |
| 8 | `bindIndustrySubNav()` | Wires the Industry page sub-tabs → defined below in `app.js` |
| 9 | `window.eveAPI.getAccounts()` | Decides initial page: `dashboard` if characters exist, otherwise `characters` → `preload.js` IPC |
| 10 | `autoConnectJabber()` | Attempts to reconnect Jabber using saved credentials → `jabber.js` |
| 11 | `prefetchAssetsBackground()` | Kicks off a background asset pre-fetch so the Assets page loads instantly → `assets.js` |

---

## Functions

### `bindIndustrySubNav()`
**Defined in:** `app.js`  
**Called by:** `DOMContentLoaded`, `navigateToPage('industry')` (in `ui.js`)

Wires click handlers onto every `.industry-sub-btn` element inside the Industry page. Clones each button node before rebinding to avoid duplicate listeners accumulating across page navigations.

Also auto-opens the `blueprints` sub-tab on first entry if `#industryTabContent` is empty, so the Industry page never shows a blank placeholder.

**Links to:**
- `navigateIndustryTab(tab)` → `blueprints.js` — called on each sub-button click and on first entry
- `#industryTabContent` — DOM guard to detect first entry vs re-entry

---

### `closePage(page)`
**Defined in:** `app.js`  
**Called by:** inline `onclick` on the `✕` close buttons in each `pages/*.html` fragment

Clears the active nav state, then redirects to a sensible fallback page rather than exposing the raw blueprint library behind the pages container.

**Logic:** calls `window.eveAPI.getAccounts()` — if characters exist, navigates to `dashboard`; otherwise `characters`. This prevents an infinite loop when there are no accounts.

**Links to:**
- `window.eveAPI.getAccounts()` → `preload.js` → `main.js` IPC `get-accounts`
- `navigateToPage()` → `ui.js`
- `currentPage` → `state.js`

---

### `syncME(value)`
**Defined in:** `app.js`  
**Called by:** `oninput` on ME slider elements injected by `navigateIndustryTab()`

Updates the module-level `selectedME` variable and reflects the value in `#meDisplay`.

**Links to:**
- `selectedME` → `state.js`
- `#meDisplay` — DOM element injected dynamically by `navigateIndustryTab()` in `blueprints.js`

---

### `syncTE(value)`
**Defined in:** `app.js`  
**Called by:** `oninput` on TE slider elements injected by `navigateIndustryTab()`

Same as `syncME` but for Time Efficiency. Updates `selectedTE` and `#teDisplay`.

**Links to:**
- `selectedTE` → `state.js`
- `#teDisplay` — DOM element injected dynamically by `navigateIndustryTab()` in `blueprints.js`

---

### `calculate()`
**Defined in:** `app.js`  
**Called by:** the `CALCULATE` button inside the full calculator tab (injected by `navigateIndustryTab()`)

Guards against no blueprint being selected, then delegates to `openMaterialsInTab()` to fetch and render the materials breakdown.

**Links to:**
- `selectedBpTypeId` → `state.js` — must be set before this is callable
- `openMaterialsInTab(typeId)` → `materials.js`
- `showToast()` → `utils.js`

> **Note:** The "My Blueprints" View button uses `openBlueprintDetail()` directly and does **not** go through `calculate()`.

---

### `bindEvents()`
**Defined in:** `app.js`  
**Called by:** `DOMContentLoaded`

Wires all global event listeners that don't belong to a specific feature module:

| Listener | Element | Action |
|----------|---------|--------|
| `input` | `#charSearch` | Filters `.character-card` elements in `#accountsListNav` by name |
| `click` | `#addCharacterNavBtn` | Triggers EVE SSO login flow |
| `click` | `document` | Closes `#searchDropdown` when clicking outside `.search-wrap` |
| `account-added` | IPC event | Re-runs `loadAccounts()` and `loadBlueprintLibrary()` on new character login |

Also calls `bindJabberEvents()` to attach Jabber-specific listeners.

**Links to:**
- `#accountsListNav` / `.character-card` — DOM elements rendered by `characters.js`
- `window.eveAPI.startSSOLogin()` → `preload.js` → `main.js` IPC `start-sso-login`
- `window.eveAPI.on('account-added', ...)` → `preload.js` IPC event channel
- `loadAccounts()` → `characters.js`
- `loadBlueprintLibrary()` → `blueprints.js`
- `bindJabberEvents()` → `jabber.js`

---

## Cross-file dependency map

```
app.js
├── pageLoader.js       window.__pagesReady — page fragment injection
├── state.js            currentPage, selectedBpTypeId, selectedME, selectedTE
├── utils.js            showToast()
├── ui.js               bindUISettings(), bindNavigation(), navigateToPage()
├── characters.js       loadAccounts()
├── blueprints.js       loadBlueprintLibrary(), buildCategoryBrowse(),
│                       navigateIndustryTab(), openBlueprintDetail()
├── materials.js        openMaterialsInTab()
├── assets.js           prefetchAssetsBackground()
├── jabber.js           autoConnectJabber(), bindJabberEvents()
└── preload.js (IPC)
    ├── get-accounts        → main.js
    ├── start-sso-login     → main.js
    └── on('account-added') → main.js
```