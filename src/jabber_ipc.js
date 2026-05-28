// ─── jabber_ipc.js ────────────────────────────────────────────────────────────
// Handles all Jabber/XMPP IPC in the main process.
// Extracted from main.js — register by calling registerJabberHandlers().
// ─────────────────────────────────────────────────────────────────────────────

const { ipcMain, BrowserWindow } = require('electron');

let jabberClient = null;
let jabberConnectionActive = false;

let xmppLibrary = null;
async function getXmppClient() {
  if (!xmppLibrary) xmppLibrary = await import('@xmpp/client');
  return xmppLibrary;
}

function broadcastToRenderers(channel, payload) {
  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  });
}

/**
 * Register all jabber-* IPC handlers.
 * @param {object} deps
 * @param {object} deps.jabberDataDb   - the jabber_data_db module
 * @param {Function} deps.createPingAlertWindow - opens the ping alert window
 */
function registerJabberHandlers({ jabberDataDb, createPingAlertWindow }) {

  ipcMain.handle('jabber-connect', async (_, { service, jid, password }) => {
    try {
      if (!service || !jid || !password) {
        return { success: false, message: 'Service, JID, and password are required.' };
      }
      const [username, domain] = jid.split('@');
      if (!username || !domain) {
        return { success: false, message: 'Invalid JID format. Use user@domain.' };
      }

      if (jabberClient) {
        jabberConnectionActive = false;
        const oldClient = jabberClient;
        jabberClient = null; // Null before stop so stale events don't route through
        try { await oldClient.stop(); } catch (_) {}
      }

      const { client: xmppClient } = await getXmppClient();
      jabberClient = xmppClient({ service, domain, username, password });

      jabberClient.on('error', (err) => {
        // Swallow the null-write race error — it's a benign teardown artifact
        if (err?.message?.includes("reading 'write'")) return;
        broadcastToRenderers('jabber-status', { status: 'error', message: err?.message || String(err) });
      });

      jabberClient.on('offline', () => {
        jabberConnectionActive = false;
        broadcastToRenderers('jabber-status', { status: 'offline', message: 'Disconnected' });
      });

      jabberClient.on('online', (address) => {
        jabberConnectionActive = true;
        broadcastToRenderers('jabber-status', { status: 'online', message: `Connected as ${address.toString()}` });
      });

      jabberClient.on('stanza', async (stanza) => {
        if (!stanza.is('message')) return;
        const body = stanza.getChildText('body');
        if (!body) return;
        const from       = stanza.attrs.from || '';
        const type       = stanza.attrs.type || 'chat';
        const isDirector = /director/i.test(from) || /director/i.test(body);
        const msg        = { from, type, body, isDirector, raw: stanza.toString() };

        // ── Persist to DB first, then broadcast the stored row (with its id) ──
        // This guarantees the renderer always works from DB-backed data so that
        // history loaded on restart matches what was shown live.
        let stored = null;
        try {
          stored = await jabberDataDb.insertJabberMessage(msg);
        } catch (e) {
          console.error('[jabberDataDb] failed to store message:', e.message);
        }

        // Broadcast the enriched stored row if available, else the raw msg.
        broadcastToRenderers('jabber-message', stored || msg);

        // Only open the ping-alert popup for director broadcasts.
        if (isDirector) {
          createPingAlertWindow(stored || msg);
        }
      });

      await jabberClient.start();
      return { success: true, message: 'Connecting...' };
    } catch (err) {
      console.warn('Jabber connect failed:', err.message || err);
      return { success: false, message: err.message || String(err) };
    }
  });

  ipcMain.handle('jabber-disconnect', async () => {
    if (jabberClient) {
      jabberConnectionActive = false;
      const clientToStop = jabberClient;
      jabberClient = null; // Null first so no new events route through
      try { await clientToStop.stop(); } catch (_) {}
    }
    return true;
  });

  ipcMain.handle('jabber-get-messages', async (_, limit = 200) => {
    try {
      return await jabberDataDb.getRecentMessages(limit);
    } catch (e) {
      console.error('[jabberDataDb] jabber-get-messages failed:', e.message);
      return [];
    }
  });

  ipcMain.handle('jabber-wipe-data', async () => {
    try {
      await jabberDataDb.wipeJabberDb();
      return true;
    } catch (e) {
      console.error('[jabberDataDb] jabber-wipe-data failed:', e.message);
      return false;
    }
  });

  ipcMain.handle('jabber-open-ping-alert', async (_, rowId) => {
    try {
      const rows = await jabberDataDb.getRecentMessages(1000);
      const row  = rows.find(r => r.id === rowId);
      if (!row) {
        console.warn('[jabberDataDb] jabber-open-ping-alert: row not found for id', rowId);
        return false;
      }
      createPingAlertWindow(row);
      return true;
    } catch (e) {
      console.error('[jabberDataDb] jabber-open-ping-alert failed:', e.message);
      return false;
    }
  });
}

module.exports = { registerJabberHandlers, broadcastToRenderers };