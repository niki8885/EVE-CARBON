// palette.js — theme loading, CSS variable injection, and palette editor UI

// ── Colour helpers ────────────────────────────────────────────────────────────

function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function hexToHsl(hex) {
  if (!hex?.startsWith('#')) return [0, 0, 50];
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return '#' + [h + 1/3, h, h - 1/3].map(t => {
    const v = Math.round(hue2rgb(p, q, t) * 255);
    return v.toString(16).padStart(2, '0');
  }).join('');
}

function darken(hex, frac) {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.max(0, l - frac * 100));
}

function lighten(hex, frac) {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.min(100, l + frac * 100));
}

// ── Build CSS variable map from a full YAML palette (Carbon / Sirius style) ──

function buildCssVars(palette, roles) {
  const p = palette;
  const a = p[roles?.accent || 'red'];   // the accent slot for this theme

  return {
    // Teal / danger alpha helpers (character sync button states)
    '--teal-success-bg':     hexToRgba(p.teal?.base, 0.18),
    '--teal-success-border': hexToRgba(p.teal?.base, 0.30),
    '--danger-bg':           hexToRgba(p.red?.bright, 0.14),
    '--danger-border':       hexToRgba(p.red?.bright, 0.25),

    // Primary accent (driven by roles.accent)
    '--accent':          a?.base,
    '--accent-dim':      a?.dim,
    '--accent-glow':     a?.glow       || hexToRgba(a?.base, 0.18),
    '--accent-03':       hexToRgba(a?.base, 0.03),
    '--accent-05':       hexToRgba(a?.base, 0.05),
    '--accent-06':       hexToRgba(a?.base, 0.06),
    '--accent-08':       a?.subtle     || hexToRgba(a?.base, 0.08),
    '--accent-10':       hexToRgba(a?.base, 0.10),
    '--accent-12':       hexToRgba(a?.base, 0.12),
    '--accent-15':       hexToRgba(a?.base, 0.15),
    '--accent-20':       hexToRgba(a?.base, 0.20),
    '--accent-25':       a?.border     || hexToRgba(a?.base, 0.25),
    '--accent-30':       hexToRgba(a?.base, 0.30),
    '--accent-40':       hexToRgba(a?.base, 0.40),
    '--accent-50':       hexToRgba(a?.base, 0.50),
    '--glow-color':      hexToRgba(a?.base, 0.22),
    '--glow-color-2':    a?.base,

    // Semantic status
    '--success':         p.green?.base,
    '--danger':          p.red?.bright,
    '--warning':         p.orange?.warning || p.orange?.base,
    '--status-online':   p.green?.bright,
    '--status-offline':  p.red?.bright,

    // Named EVE colours
    '--teal':            p.teal?.base,
    '--teal-glow':       p.teal?.glow,
    '--liquidisk':       p.teal?.base,
    '--assets':          p.purple?.bright,
    '--newbie':          p.teal?.base,
    '--hisec':           p.blue?.hisec    || p.blue?.base,
    '--lowsec':          p.yellow?.lowsec || p.yellow?.base,
    '--nullsec':         p.red?.base,
    '--lawless':         p.indigo?.dim    || p.purple?.dim,

    // Tier rank labels
    '--tier-top':        p.blue?.base,
    '--tier-2':          p.indigo?.base,
    '--tier-1':          p.orange?.base,
    '--tier-0':          p.teal?.base,

    // ESI badge
    '--esi-green':       p.green?.glow,
    '--esi-green-dim':   p.green?.subtle,

    // Nav active bg
    '--nav-active-bg':   p.blue?.nav_active,

    // Backgrounds
    '--bg-body':         p.surface?.body,
    '--bg-deep':         p.surface?.deep,
    '--bg-panel':        p.surface?.panel,
    '--bg-card':         p.surface?.card,
    '--bg-card-deep':    p.surface?.card_deep,
    '--bg-input':        p.surface?.input,
    '--bg-modal':        p.surface?.modal,
    '--bg-hover':        p.surface?.hover,
    '--bg-hover-subtle': p.surface?.hover_subtle,
    '--bg-code':         p.surface?.code,
    '--toast-bg':        p.surface?.toast,
    '--bg-surface':      p.surface?.card,
    '--bg-banner-end':   p.surface?.banner_end,
    '--backdrop':        p.overlay?.backdrop,

    // Text
    '--text-1':          p.text?.primary,
    '--text-2':          p.text?.secondary,
    '--text-3':          p.text?.tertiary,
    '--text-4':          p.text?.header,
    '--text-5':          p.text?.muted,
    '--text-6':          p.text?.dim,
    '--text-7':          p.text?.faint,
    '--text-8':          p.text?.console,
    '--text-9':          p.text?.console,
    '--text-input':      p.text?.input,
    '--text-on-accent':  p.text?.on_accent,
    '--text-name':       p.text?.name,

    // Borders / lines
    '--border':          p.line?.default,
    '--border-b':        p.line?.panel,
    '--border-c':        p.line?.panel,
    '--border-d':        p.line?.outer,
    '--border-e':        p.line?.divider,

    // Shadows
    '--shadow-dark':     p.overlay?.shadow,
    '--shadow-darker':   p.overlay?.shadow_deep,
    '--shadow-black-12': 'rgba(0,0,0,0.12)',
    '--spinner-track':   hexToRgba(a?.base, 0.08),

    // Hatch
    '--hatch-color':     p.overlay?.hatch,
    '--hatch-card-color':p.overlay?.hatch_card,
    '--dot-color':       p.overlay?.dot,

    // Body / concord glows
    '--glow-body-a1':    p.overlay?.glow_a1,
    '--glow-body-a2':    p.overlay?.glow_a2,
    '--glow-body-a3':    p.overlay?.glow_a3,
    '--glow-body-b1':    p.overlay?.glow_b1,
    '--glow-body-b2':    p.overlay?.glow_b2,
    '--glow-main-1':     p.overlay?.concord_1,
    '--glow-main-2':     p.overlay?.concord_2,
    '--glow-main-3':     p.overlay?.concord_3,
    '--glow-sec-1':      p.overlay?.concord_4,
    '--glow-sec-2':      p.overlay?.concord_5,
  };
}

// Build CSS vars from a simplified user theme (16 swatches only)
function buildCssVarsFromCustom(sw, roles) {
  const accent = sw[roles?.accent || 'red'] || sw.red;

  // Derive a minimal full-palette structure from the 16 swatches
  const derived = {
    red:       { base: sw.red,       bright: lighten(sw.red, 0.10),      dim: darken(sw.red, 0.25),      glow: hexToRgba(sw.red, 0.22),       border: hexToRgba(sw.red, 0.25), subtle: hexToRgba(sw.red, 0.08) },
    teal:      { base: sw.teal,      bright: lighten(sw.teal, 0.10),     dim: darken(sw.teal, 0.20),     glow: hexToRgba(sw.teal, 0.30) },
    purple:    { base: sw.purple,    bright: lighten(sw.purple, 0.08),   dim: darken(sw.purple, 0.20) },
    pink:      { base: sw.pink,      bright: lighten(sw.pink, 0.10),     dim: darken(sw.pink, 0.20) },
    baby_blue: { base: sw.baby_blue, bright: lighten(sw.baby_blue, 0.10),dim: darken(sw.baby_blue, 0.15)},
    green:     { base: sw.green,     bright: lighten(sw.green, 0.08),    dim: darken(sw.green, 0.20),    glow: hexToRgba(sw.green, 0.25),   subtle: hexToRgba(sw.green, 0.10) },
    yellow:    { base: sw.yellow,    bright: lighten(sw.yellow, 0.08),   dim: darken(sw.yellow, 0.20),   lowsec: sw.yellow },
    orange:    { base: sw.orange,    bright: lighten(sw.orange, 0.08),   dim: darken(sw.orange, 0.20),   warning: sw.orange },
    gold:      { base: sw.gold,      bright: lighten(sw.gold, 0.08),     dim: darken(sw.gold, 0.20) },
    indigo:    { base: sw.indigo,    bright: lighten(sw.indigo, 0.08),   dim: darken(sw.indigo, 0.25) },
    cyan:      { base: sw.cyan,      bright: lighten(sw.cyan, 0.08),     dim: darken(sw.cyan, 0.20) },
    blue:      { base: sw.blue,      bright: lighten(sw.blue, 0.08),     dim: darken(sw.blue, 0.20),     nav_active: hexToRgba(sw.blue, 0.12), hisec: sw.blue, glow: hexToRgba(sw.blue, 0.22), subtle: hexToRgba(sw.blue, 0.08), border: hexToRgba(sw.blue, 0.25) },
    surface:   {
      body: sw.background, deep: hexToRgba(sw.background, 0.95),
      panel: sw.panel,     card: lighten(sw.panel, 0.03),
      card_deep: darken(sw.panel, 0.03),
      input: sw.panel,     modal: sw.panel,
      toast: sw.panel,     code: darken(sw.background, 0.02),
      hover: hexToRgba(accent, 0.07),
      hover_subtle: hexToRgba(accent, 0.03),
      banner_end: sw.panel,
    },
    text: {
      primary: sw.text,   secondary: lighten(sw.text, 0.05),
      tertiary: lighten(sw.text, 0.20), header: lighten(sw.text, 0.30),
      muted: lighten(sw.text, 0.35),    dim: lighten(sw.text, 0.45),
      faint: lighten(sw.text, 0.55),    console: lighten(sw.text, 0.40),
      input: sw.text,     on_accent: '#ffffff',  name: sw.text,
    },
    line: {
      default: sw.border,
      panel: hexToRgba(accent, 0.30),
      outer: hexToRgba(accent, 0.15),
      divider: lighten(sw.background, 0.10),
      subtle: 'rgba(128,128,128,0.04)',
    },
    overlay: {
      backdrop: 'rgba(0,0,0,0.70)',
      shadow: 'rgba(0,0,0,0.25)',
      shadow_deep: 'rgba(0,0,0,0.60)',
      hatch: 'rgba(255,255,255,0.018)',
      hatch_card: 'rgba(255,255,255,0.010)',
      glow_a1: hexToRgba(accent, 0.30),
      glow_a2: hexToRgba(sw.red, 0.20),
      glow_a3: hexToRgba(sw.red, 0.05),
      glow_b1: hexToRgba(sw.teal, 0.08),
      glow_b2: hexToRgba(accent, 0.10),
      concord_1: hexToRgba(accent, 0.35),
      concord_2: hexToRgba(darken(accent, 0.10), 0.25),
      concord_3: hexToRgba(accent, 0.05),
      concord_4: hexToRgba(accent, 0.06),
      concord_5: hexToRgba(accent, 0.15),
    },
  };

  return buildCssVars(derived, roles);
}

// ── Inject CSS vars into the document ────────────────────────────────────────

function applyThemeCss(themeData) {
  if (!themeData) return;

  let vars;
  if (themeData.type === 'custom' && themeData.swatches) {
    vars = buildCssVarsFromCustom(themeData.swatches, themeData.roles);
  } else if (themeData.palette) {
    vars = buildCssVars(themeData.palette, themeData.roles);
  } else {
    return;
  }

  const css = Object.entries(vars)
    .filter(([, v]) => v != null && v !== undefined)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');

  let el = document.getElementById('eve-theme-vars');
  if (!el) {
    el = document.createElement('style');
    el.id = 'eve-theme-vars';
    document.head.appendChild(el);
  }
  el.textContent = `:root {\n${css}\n}`;

  // Persist so next page open can apply instantly before first paint (no flash)
  try { localStorage.setItem('eve-carbon-theme-vars', el.textContent); } catch {}
}

// ── Apply saved theme at startup ──────────────────────────────────────────────

async function initTheme() {
  try {
    const cfg     = await window.eveAPI.getAppConfig();
    const themeId = cfg?.app?.theme || 'Carbon';
    if (themeId === 'Carbon') return; // Carbon === base.css defaults, no injection needed
    const theme = await window.eveAPI.themeGet(themeId);
    if (theme) applyThemeCss(theme);
  } catch (e) {
    console.warn('[palette] initTheme failed:', e.message);
  }
}

// ── Palette settings tab ──────────────────────────────────────────────────────

const SWATCH_SLOTS = [
  { key: 'red',        label: 'Red' },
  { key: 'teal',       label: 'Teal' },
  { key: 'purple',     label: 'Purple' },
  { key: 'pink',       label: 'Pink' },
  { key: 'baby_blue',  label: 'Baby Blue' },
  { key: 'green',      label: 'Green' },
  { key: 'yellow',     label: 'Yellow' },
  { key: 'orange',     label: 'Orange' },
  { key: 'gold',       label: 'Gold' },
  { key: 'indigo',     label: 'Indigo' },
  { key: 'cyan',       label: 'Cyan' },
  { key: 'blue',       label: 'Blue' },
  { key: 'background', label: 'Background', path: 'surface.body' },
  { key: 'panel',      label: 'Panel',      path: 'surface.card' },
  { key: 'text',       label: 'Text',       path: 'text.primary' },
  { key: 'border',     label: 'Border',     path: 'line.default' },
];

let _allThemes     = [];
let _currentTheme  = null;   // full theme object
let _editSwatches  = null;   // { key: hexColor } — live edits
let _editMode      = false;

function getSwatchColor(themeData, slotKey, path) {
  if (!themeData) return '#888888';
  if (themeData.type === 'custom') {
    return themeData.swatches?.[slotKey] || '#888888';
  }
  // Full theme — resolve dot-path like 'surface.body'
  const parts = (path || `${slotKey}.base`).split('.');
  let v = themeData.palette;
  for (const p of parts) { v = v?.[p]; }
  return typeof v === 'string' && v.startsWith('#') ? v : '#888888';
}

// Returns true if a hex color is perceived as light (use dark overlay text)
function isLightColor(hex) {
  if (!hex?.startsWith('#')) return false;
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 145;
}

function renderSwatches(editable) {
  const grid = document.getElementById('paletteSwatchGrid');
  if (!grid) return;
  grid.innerHTML = '';
  grid.style.cssText = 'display:flex; flex-direction:column; gap:16px;';

  const eveSlots        = SWATCH_SLOTS.slice(0, 12);
  const structuralSlots = SWATCH_SLOTS.slice(12);

  function makePill(slot, isStructural) {
    const { key, label, path } = slot;
    const color   = _editSwatches?.[key] || getSwatchColor(_currentTheme, key, path);
    const isHex   = typeof color === 'string' && color.startsWith('#');
    const textCol = isHex && isLightColor(color) ? 'rgba(0,0,0,0.50)' : 'rgba(255,255,255,0.65)';
    const height  = isStructural ? '52px' : '72px';
    const radius  = '14px';

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex; flex-direction:column; align-items:stretch; gap:5px;';

    const pill = document.createElement('label');
    pill.title = editable ? `Edit ${label}` : label;
    pill.style.cssText = `
      position:relative; display:flex; align-items:flex-end;
      height:${height}; border-radius:${radius};
      background:${color};
      border:1.5px solid rgba(128,128,128,${editable ? '0.30' : '0.12'});
      box-shadow: 0 2px 8px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.14);
      cursor:${editable ? 'pointer' : 'default'};
      overflow:hidden; padding:0 9px 7px;
      transition: transform .12s, box-shadow .12s, border-color .12s;
    `;

    // Hex value inside pill
    if (isHex) {
      const hexEl = document.createElement('span');
      hexEl.dataset.hexEl = key;
      hexEl.textContent = color.toUpperCase();
      hexEl.style.cssText = `font-size:9px; font-family:var(--mono); letter-spacing:.05em; color:${textCol}; pointer-events:none; line-height:1;`;
      pill.appendChild(hexEl);
    }

    if (editable) {
      const inp = document.createElement('input');
      inp.type  = 'color';
      inp.value = isHex ? color : '#888888';
      inp.style.cssText = 'opacity:0; position:absolute; width:0; height:0; pointer-events:none;';

      inp.addEventListener('input', e => {
        const hex = e.target.value;
        pill.style.background = hex;
        const tc = isLightColor(hex) ? 'rgba(0,0,0,0.50)' : 'rgba(255,255,255,0.65)';
        const hexEl = pill.querySelector(`[data-hex-el="${key}"]`);
        if (hexEl) { hexEl.textContent = hex.toUpperCase(); hexEl.style.color = tc; }
        if (!_editSwatches) _editSwatches = {};
        _editSwatches[key] = hex;
        applyThemeCss(buildLivePreviewTheme());
      });

      pill.appendChild(inp);
      pill.addEventListener('click', () => inp.click());
      pill.addEventListener('mouseenter', () => {
        pill.style.transform    = 'translateY(-2px)';
        pill.style.boxShadow    = '0 6px 16px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.14)';
        pill.style.borderColor  = 'var(--accent)';
      });
      pill.addEventListener('mouseleave', () => {
        pill.style.transform    = '';
        pill.style.boxShadow    = '0 2px 8px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.14)';
        pill.style.borderColor  = 'rgba(128,128,128,0.30)';
      });
    }

    const lbl = document.createElement('div');
    lbl.textContent = label;
    lbl.style.cssText = 'font-size:10px; color:var(--text-4); font-family:var(--mono); letter-spacing:.06em; text-align:center; padding-top:1px;';

    wrap.appendChild(pill);
    wrap.appendChild(lbl);
    return wrap;
  }

  function makeRow(slots, isStructural) {
    const row = document.createElement('div');
    row.style.cssText = `display:grid; grid-template-columns:repeat(${slots.length},1fr); gap:8px;`;
    slots.forEach(s => row.appendChild(makePill(s, isStructural)));
    return row;
  }

  // EVE palette — 4 cols × 3 rows
  const eveGrid = document.createElement('div');
  eveGrid.style.cssText = 'display:flex; flex-direction:column; gap:8px;';
  for (let i = 0; i < 12; i += 4) {
    eveGrid.appendChild(makeRow(eveSlots.slice(i, i + 4), false));
  }
  grid.appendChild(eveGrid);

  // Separator + label
  const sep = document.createElement('div');
  sep.style.cssText = 'display:flex; align-items:center; gap:10px;';
  sep.innerHTML = `
    <div style="flex:1; border-top:1px solid var(--border-e);"></div>
    <div style="font-size:9px; letter-spacing:.12em; color:var(--text-4); font-family:var(--mono); flex-shrink:0;">STRUCTURE</div>
    <div style="flex:1; border-top:1px solid var(--border-e);"></div>
  `;
  grid.appendChild(sep);

  // Structural — single row of 4
  grid.appendChild(makeRow(structuralSlots, true));
}

function buildLivePreviewTheme() {
  if (!_currentTheme || !_editSwatches) return _currentTheme;
  if (_currentTheme.type === 'custom') {
    return { ..._currentTheme, swatches: { ..._currentTheme.swatches, ..._editSwatches } };
  }
  // For a built-in theme being edited, create a synthetic custom theme
  const baseSwatches = {};
  SWATCH_SLOTS.forEach(({ key, path }) => {
    baseSwatches[key] = getSwatchColor(_currentTheme, key, path);
  });
  return {
    type:     'custom',
    roles:    _currentTheme.roles,
    swatches: { ...baseSwatches, ..._editSwatches },
  };
}

function setEditMode(active) {
  _editMode = active;
  _editSwatches = active ? {} : null;
  renderSwatches(active);

  const saveRow   = document.getElementById('paletteSaveRow');
  const delBtn    = document.getElementById('paletteDeleteBtn');
  const editBtn   = document.getElementById('paletteEditBtn');
  const cancelBtn = document.getElementById('paletteCancelBtn');

  if (saveRow)   saveRow.style.display   = active ? 'flex' : 'none';
  if (editBtn)   editBtn.style.display   = active ? 'none' : 'inline-block';
  if (cancelBtn) cancelBtn.style.display = active ? 'inline-block' : 'none';

  if (delBtn) {
    const isUser = _currentTheme?.id?.startsWith('user:');
    delBtn.style.display = isUser && active ? 'inline-block' : 'none';
  }

  if (active) {
    const nameInp = document.getElementById('paletteNameInput');
    if (nameInp) nameInp.value = `Copy of ${_currentTheme?.name || 'Theme'}`;
  }
}

async function populatePaletteSettings() {
  const select = document.getElementById('themeSelect');
  if (!select) return;

  try {
    _allThemes = await window.eveAPI.themeGetAll();
    const activeId = await window.eveAPI.themeGetActive();

    select.innerHTML = '';
    for (const t of _allThemes) {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.source === 'user' ? `${t.name} (custom)` : t.name;
      if (t.id === activeId) opt.selected = true;
      select.appendChild(opt);
    }

    await loadTheme(select.value);
  } catch (e) {
    console.warn('[palette] populatePaletteSettings failed:', e.message);
  }
}

async function loadTheme(id) {
  try {
    _currentTheme = await window.eveAPI.themeGet(id);
    if (_currentTheme) _currentTheme.id = id;
    setEditMode(false);
    renderSwatches(false);

    const desc = document.getElementById('themeDescription');
    if (desc) desc.textContent = _currentTheme?.description || '';
  } catch (e) {
    console.warn('[palette] loadTheme failed:', e.message);
  }
}

function bindPaletteEvents() {
  // Theme dropdown change
  const select = document.getElementById('themeSelect');
  if (select) {
    select.addEventListener('change', () => loadTheme(select.value));
  }

  // Apply theme
  document.getElementById('themeApplyBtn')?.addEventListener('click', async () => {
    const id = document.getElementById('themeSelect')?.value;
    if (!id) return;
    await window.eveAPI.themeSetActive(id);
    const theme = await window.eveAPI.themeGet(id);
    if (theme) {
      applyThemeCss(theme);
      showToast(`Theme "${theme.name || id}" applied.`, 'success');
    }
  });

  // Enter edit mode (create custom copy)
  document.getElementById('paletteEditBtn')?.addEventListener('click', () => setEditMode(true));

  // Cancel edits
  document.getElementById('paletteCancelBtn')?.addEventListener('click', () => {
    // Restore original theme
    if (_currentTheme) applyThemeCss(_currentTheme);
    setEditMode(false);
  });

  // Save custom palette
  document.getElementById('paletteSaveBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('paletteNameInput')?.value?.trim();
    if (!name) { showToast('Enter a palette name.', 'error'); return; }

    const baseSwatches = {};
    SWATCH_SLOTS.forEach(({ key, path }) => {
      baseSwatches[key] = getSwatchColor(_currentTheme, key, path);
    });
    const mergedSwatches = { ...baseSwatches, ...(_editSwatches || {}) };

    const result = await window.eveAPI.themeSaveCustom({
      name,
      roles: _currentTheme?.roles || { accent: 'red', danger: 'red', success: 'green', warning: 'orange' },
      swatches: mergedSwatches,
    });

    if (result.success) {
      await populatePaletteSettings();
      // Select and apply the new theme
      const sel = document.getElementById('themeSelect');
      if (sel) sel.value = result.id;
      await window.eveAPI.themeSetActive(result.id);
      showToast(`Palette "${name}" saved.`, 'success');
      setEditMode(false);
    } else {
      showToast(`Save failed: ${result.error}`, 'error');
    }
  });

  // Delete custom palette
  document.getElementById('paletteDeleteBtn')?.addEventListener('click', async () => {
    const id = _currentTheme?.id;
    if (!id?.startsWith('user:')) return;
    if (!confirm(`Delete the palette "${_currentTheme?.name}"?`)) return;
    const result = await window.eveAPI.themeDeleteCustom(id);
    if (result.success) {
      await populatePaletteSettings();
      // Reload Carbon
      const theme = await window.eveAPI.themeGet('Carbon');
      if (theme) applyThemeCss(theme);
      showToast('Palette deleted.', 'success');
    } else {
      showToast(`Delete failed: ${result.error}`, 'error');
    }
  });
}

// Expose for startup init
window.initTheme      = initTheme;
window.applyThemeCss  = applyThemeCss;
