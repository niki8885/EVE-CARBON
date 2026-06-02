// ─── Jabber ───────────────────────────────────────────────────────────────────
// jabberMessages holds the merged set of DB history + live incoming messages.
// Each entry is a DB row shape:
//   { id, received_at, from_jid, msg_type, is_director, raw_body,
//     ping_timestamp, who_pinged, hurf,
//     fc_name, formup_location, pap_type, comms, doctrine,
//     sig, gsol_member, target_sig, eve_timecode }
//
// Live messages arriving via IPC are parsed client-side with the same field
// names so they slot in without any special-casing.

// ── Filters ───────────────────────────────────────────────────────────────────
// Both filters removed from UI. Hardcoded to false = show everything.
// jabberFilterDirectorOnly is declared in state.js; force it off here.
jabberFilterDirectorOnly  = false;
var jabberFilterBroadcastOnly = false;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip zero-width / invisible Unicode chars used as EVE field separators. */
function jabberStripInvisible(str) {
  if (!str) return '';
  return str.replace(/[​-‏‪-‮⁠-⁤﻿­�]/g, '').trim();
}

/**
 * Lightweight client-side parser — mirrors jabber_data_db.js parseJabberMessage
 * so live incoming messages have the same shape as DB rows.
 */
function jabberParseMessage(body) {
  const r = {
    ping_timestamp: null, who_pinged: null, hurf: null,
    fc_name: null, formup_location: null, pap_type: null,
    comms: null, doctrine: null,
    sig: null, gsol_member: null, target_sig: null, eve_timecode: null,
  };
  if (!body) return r;

  // First line: "(HH:MM:SS AM/PM) sender: hurf"
  const h = (body.split('\n')[0] || '').match(/^\(([^)]+)\)\s+([^:]+):\s*(.*)$/);
  if (h) {
    r.ping_timestamp = h[1].trim();
    r.who_pinged     = jabberStripInvisible(h[2]);
    r.hurf           = jabberStripInvisible(h[3]);
  }

  const inv = '[\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\uFEFF\\u00AD]*';
  const field = (label) => {
    const m = body.match(new RegExp(`^${label.replace(/ /g, '\\s+')}\\s*:${inv}\\s*(.+)$`, 'mi'));
    return m ? jabberStripInvisible(m[1]) : null;
  };

  r.fc_name         = field('FC Name');
  r.formup_location = field('Formup Location');
  r.pap_type        = field('PAP Type');
  r.comms           = field('Comms');
  r.doctrine        = field('Doctrine');

  const c = body.match(
    /~~~\s*This was a\s+(\S+)\s+broadcast from\s+(\S+)\s+to\s+(\S+)\s+at\s+([\d\-: .]+?)\s+EVE\s*~~~/i
  );
  if (c) {
    r.sig          = c[1].trim();
    r.gsol_member  = c[2].trim();
    r.target_sig   = c[3].trim();
    r.eve_timecode = c[4].trim();
  }
  return r;
}

/** Convert a live IPC message { from, type, body, isDirector } to a DB-row-like object. */
function jabberLiveToRow(msg) {
  const parsed = jabberParseMessage(msg.body || '');
  return {
    id:              null,                          // not yet in DB (DB write is async)
    received_at:     new Date().toISOString(),
    from_jid:        msg.from        || '',
    msg_type:        msg.type        || '',
    is_director:     msg.isDirector  ? 1 : 0,
    raw_body:        msg.body        || '',
    ...parsed,
  };
}

/** Sort key: prefer eve_timecode, fall back to received_at. Newest first. */
function jabberSortKey(row) {
  // eve_timecode: "2026-05-22 16:34:42.764243"  → ISO-sortable as-is
  return row.eve_timecode || row.received_at || '';
}

// ── PAP badge ─────────────────────────────────────────────────────────────────

function jabberPapBadge(papType) {
  if (!papType) return '';
  const clean = papType.trim();
  const lower = clean.toLowerCase();
  const cls = /stratop/.test(lower)   ? 'jpap-stratop'
            : /peacetime/.test(lower) ? 'jpap-peacetime'
            : 'jpap-sig';
  return `<span class="jpap-badge ${cls}">${escHtml(clean.toUpperCase())}</span>`;
}

// ── Column visibility ─────────────────────────────────────────────────────────

const JABBER_COL_NAMES = ['EVE Time','FC Name','Formup','PAP Type','Doctrine','SIG','Comms','Pinged By','Target','Message'];

function jabberGetColVisibility() {
  try {
    const s = localStorage.getItem('jabberColVisibility');
    if (s) {
      const v = JSON.parse(s);
      if (Array.isArray(v) && v.length === JABBER_COL_NAMES.length) return v;
    }
  } catch(e) {}
  return JABBER_COL_NAMES.map(() => true);
}

function jabberApplyColVisibility(visible) {
  const style = document.getElementById('jabberColVisStyle');
  if (!style) return;
  style.textContent = visible.map((v, i) => v ? '' :
    `#jabberTable th:nth-child(${i+1}),#jabberTable td:nth-child(${i+1}){display:none}`
  ).join('\n');
}

function jabberSaveColVisibility(visible) {
  localStorage.setItem('jabberColVisibility', JSON.stringify(visible));
  jabberApplyColVisibility(visible);
}

function jabberBuildColsDropdown() {
  const dd = document.getElementById('jabberColsDropdown');
  if (!dd) return;
  const visible = jabberGetColVisibility();
  dd.innerHTML = JABBER_COL_NAMES.map((name, i) => `
    <label style="display:flex;align-items:center;gap:7px;padding:3px 0;cursor:pointer;
                  font-family:var(--mono);font-size:10px;color:var(--text-3);white-space:nowrap;user-select:none;">
      <input type="checkbox" ${visible[i] ? 'checked' : ''} data-col-idx="${i}"
             style="accent-color:var(--accent);cursor:pointer;">
      ${escHtml(name)}
    </label>`).join('');
  dd.querySelectorAll('input[data-col-idx]').forEach(cb => {
    cb.addEventListener('change', () => {
      const v = jabberGetColVisibility();
      v[parseInt(cb.dataset.colIdx, 10)] = cb.checked;
      jabberSaveColVisibility(v);
    });
  });
}

function initJabberColsToggle() {
  const btn = document.getElementById('jabberColsBtn');
  const dd  = document.getElementById('jabberColsDropdown');
  if (!btn || !dd) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = dd.style.display !== 'none';
    dd.style.display = open ? 'none' : 'block';
    btn.classList.toggle('active', !open);
    if (!open) jabberBuildColsDropdown();
  });

  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !dd.contains(e.target)) {
      dd.style.display = 'none';
      btn.classList.remove('active');
    }
  });

  jabberApplyColVisibility(jabberGetColVisibility());
}

// ── Column resizing ───────────────────────────────────────────────────────────

const JABBER_DEFAULT_WIDTHS = [160,100,120,80,110,60,110,90,70,280,62];

function jabberGetColWidths() {
  try {
    const s = localStorage.getItem('jabberColWidths');
    if (s) {
      const w = JSON.parse(s);
      if (Array.isArray(w) && w.length === 11) return w;
    }
  } catch(e) {}
  return null;
}

function jabberSaveColWidths() {
  const ths = document.querySelectorAll('#jabberTable thead th');
  const widths = Array.from(ths).map(th => Math.round(th.getBoundingClientRect().width));
  const table  = document.getElementById('jabberTable');
  localStorage.setItem('jabberColWidths', JSON.stringify(widths));
  if (table) localStorage.setItem('jabberTableWidth', table.style.width);
}

function jabberApplyColWidths(widths) {
  widths.forEach((w, i) => {
    const col = document.getElementById(`jcol-${i}`);
    if (col && w > 0) col.style.width = w + 'px';
  });
  const savedTableW = localStorage.getItem('jabberTableWidth');
  const table = document.getElementById('jabberTable');
  if (table && savedTableW) table.style.width = savedTableW;
}

function initJabberColResize() {
  const saved = jabberGetColWidths();
  if (saved) jabberApplyColWidths(saved);

  const ths = document.querySelectorAll('#jabberTable thead th');
  ths.forEach((th, idx) => {
    // Last column (View) has no resize handle
    if (idx === ths.length - 1) return;

    const handle = document.createElement('div');
    handle.className = 'col-resize-handle';
    th.appendChild(handle);

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const table       = document.getElementById('jabberTable');
      const startX      = e.clientX;
      const col         = document.getElementById(`jcol-${idx}`);
      const startColW   = th.getBoundingClientRect().width;
      const startTableW = table ? table.offsetWidth : 0;

      // Freeze table to a pixel width — prevents width:100% from rescaling
      // every other column when only one column should change.
      if (table) table.style.width = startTableW + 'px';

      handle.classList.add('dragging');
      document.body.style.cursor    = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMove = (ev) => {
        const delta   = ev.clientX - startX;
        const newColW = Math.max(30, startColW + delta);
        const clampedDelta = newColW - startColW;
        if (col)   col.style.width   = newColW + 'px';
        // Grow/shrink the table by exactly the same delta so no other column shifts
        if (table) table.style.width = (startTableW + clampedDelta) + 'px';
      };
      const onUp = () => {
        handle.classList.remove('dragging');
        document.body.style.cursor    = '';
        document.body.style.userSelect = '';
        jabberSaveColWidths();
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderJabberTable() {
  const tbody = document.querySelector('#jabberTable tbody');
  if (!tbody) return;

  // Sort newest-first — no filters applied, show everything
  const sorted = [...jabberMessages].sort((a, b) => jabberSortKey(b).localeCompare(jabberSortKey(a)));

  if (!sorted.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="loading-row">No messages received yet.</td></tr>`;
    updateJabberSummary(0);
    return;
  }

  tbody.innerHTML = sorted.map(row => {
    // Truncate doctrine to first URL-free segment for display; full text in title
    const docShort = row.doctrine
      ? row.doctrine.replace(/https?:\/\/\S+/g, '').trim().split(/\s+/).slice(0, 4).join(' ')
      : '';

    // Only show View button if the row has a DB id (stored pings)
    const viewBtn = row.id != null
      ? `<button class="ping-view-btn" data-ping-id="${row.id}" title="Re-open ping alert">View</button>`
      : `<button class="ping-view-btn ping-view-btn--live" disabled title="Live ping — not yet stored">View</button>`;

    return `<tr title="${escHtml(row.raw_body || '')}">
      <td style="font-family:var(--mono);font-size:11px;">${escHtml(row.eve_timecode || row.ping_timestamp || '')}</td>
      <td>${escHtml(row.fc_name       || '')}</td>
      <td>${escHtml(row.formup_location || '')}</td>
      <td style="overflow:visible;">${jabberPapBadge(row.pap_type)}</td>
      <td title="${escHtml(row.doctrine || '')}">${escHtml(docShort)}</td>
      <td>${escHtml(row.sig           || '')}</td>
      <td>${escHtml(row.comms         || '')}</td>
      <td>${escHtml(row.gsol_member   || row.who_pinged || '')}</td>
      <td>${escHtml(row.target_sig    || '')}</td>
      <td class="jabber-msg-cell" title="${escHtml(row.hurf || '')}">${escHtml(row.hurf || row.raw_body || '')}</td>
      <td style="text-align:center;">${viewBtn}</td>
    </tr>`;
  }).join('');

  updateJabberSummary(sorted.length);

  // Wire View buttons — delegate on tbody so it survives re-renders
  tbody.querySelectorAll('.ping-view-btn[data-ping-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.pingId, 10);
      if (!isNaN(id)) window.eveAPI.openPingAlert(id);
    });
  });
}

function updateJabberSummary(count) {
  const summary = document.getElementById('jabberSummary');
  if (!summary) return;
  if (count === undefined) count = jabberMessages.length;
  summary.textContent = `${count} ping${count === 1 ? '' : 's'}`;
}

// ── DB load ───────────────────────────────────────────────────────────────────

/**
 * Called once when the Jabber page is opened (or on reconnect).
 * Fetches stored rows from the main process and merges with any
 * live messages already buffered in jabberMessages this session.
 */
async function loadJabberHistory() {
  try {
    const history = await window.eveAPI.getJabberMessages(200);
    if (!Array.isArray(history)) return;

    // Build a Set of DB ids that are already represented in jabberMessages
    const existingIds = new Set(
      jabberMessages.filter(m => m.id != null).map(m => m.id)
    );

    // Prepend DB rows that aren't already in the live list
    const newRows = history.filter(r => !existingIds.has(r.id));
    jabberMessages.unshift(...newRows);

    renderJabberTable();
  } catch (e) {
    console.warn('[Jabber] loadJabberHistory failed:', e.message);
  }
}

// ── Settings ──────────────────────────────────────────────────────────────────

async function populateJabberSettings() {
  const cfg    = await window.eveAPI.getAppConfig();
  const jabber = cfg?.app?.jabber || cfg?.jabber || {};

  jabberSettings = {
    service:      jabber.service      || 'xmpp://jabber.eveonline.com:5222',
    jid:          jabber.jid          || '',
    password:     jabber.password     || '',
    directorOnly: typeof jabber.directorOnly === 'boolean' ? jabber.directorOnly : true,
  };

  const serviceInput  = document.getElementById('jabberService');
  const jidInput      = document.getElementById('jabberJid');
  const passwordInput = document.getElementById('jabberPassword');
  const directorCheck = document.getElementById('jabberDirectorOnly');

  if (serviceInput)  serviceInput.value    = jabberSettings.service;
  if (jidInput)      jidInput.value        = jabberSettings.jid;
  if (passwordInput) passwordInput.value   = jabberSettings.password;
  if (directorCheck) directorCheck.checked = jabberSettings.directorOnly;
}

function gatherJabberSettings() {
  return {
    service:      document.getElementById('jabberService')?.value.trim()   || 'xmpp://jabber.eveonline.com:5222',
    jid:          document.getElementById('jabberJid')?.value.trim()       || '',
    password:     document.getElementById('jabberPassword')?.value         || '',
    directorOnly: document.getElementById('jabberDirectorOnly')?.checked   ?? true,
  };
}

async function autoConnectJabber() {
  const cfg      = await window.eveAPI.getAppConfig();
  const jabber   = cfg?.app?.jabber || cfg?.jabber || {};
  const service  = jabber.service?.trim();
  const jid      = jabber.jid?.trim();
  const password = jabber.password || '';
  const label    = document.getElementById('jabberStatus');

  if (!service || !jid || !password) {
    if (label) label.textContent = 'Jabber credentials missing; set them in Settings.';
    return;
  }

  if (label) label.textContent = 'Auto-connecting to Jabber...';
  try {
    const result = await window.eveAPI.connectJabber({ service, jid, password });
    if (!result.success) {
      showToast(`Jabber auto-connect failed: ${result.message}`, 'error');
      if (label) label.textContent = 'Jabber disconnected.';
    }
  } catch (err) {
    showToast(`Jabber auto-connect error: ${err.message}`, 'error');
    if (label) label.textContent = 'Jabber disconnected.';
  }
}

// ── Event binding ─────────────────────────────────────────────────────────────

function bindJabberEvents() {
  initJabberColsToggle();
  initJabberColResize();

  // Live messages from main process.
  // When the DB insert succeeded, the broadcast is a complete DB row (has
  // raw_body). When it fails, the broadcast is the raw XMPP msg (has body).
  // Handle both so cells always show content regardless of DB state.
  window.eveAPI.on('jabber-message', (payload) => {
    const row = ('raw_body' in payload) ? payload : jabberLiveToRow(payload);
    jabberMessages.unshift(row);
    renderJabberTable();
  });

  // Connection status updates
  window.eveAPI.on('jabber-status', (status) => {
    jabberConnected = status.status === 'online';
    updateNavStatusIndicators();
    const label = document.getElementById('jabberStatus');
    if (label) label.textContent = status.message || '';

    // Always reload history on any status change — catches reconnects AND
    // the initial 'connecting' event which fires once the DB is ready.
    loadJabberHistory();
  });

  // Defer the initial history load by one tick so the DB has time to
  // finish initialising before we query it. This replaces the old
  // immediate call that raced with initJabberDb.
  setTimeout(() => loadJabberHistory(), 500);

  // Wipe jabber DB + settings button (in Settings drawer)
  const wipeBtn = document.getElementById('jabberWipeBtn');
  if (wipeBtn) {
    wipeBtn.addEventListener('click', async () => {
      if (!confirm('Wipe ALL Jabber messages from the database and clear saved credentials? This cannot be undone.')) return;
      try {
        await window.eveAPI.wipeJabberData();
        await window.eveAPI.saveAppConfig({ jabber: { service: '', jid: '', password: '', directorOnly: true } });
        jabberMessages = [];
        renderJabberTable();
        // Clear the settings inputs so they visually reflect the wipe
        const s = document.getElementById('jabberService');
        const j = document.getElementById('jabberJid');
        const p = document.getElementById('jabberPassword');
        if (s) s.value = 'xmpp://jabber.eveonline.com:5222';
        if (j) j.value = '';
        if (p) p.value = '';
        showToast('Jabber database and credentials wiped.', 'success');
      } catch (e) {
        showToast(`Wipe failed: ${e.message}`, 'error');
      }
    });
  }
}
