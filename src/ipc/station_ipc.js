const { ipcMain } = require('electron');

// Station data is considered stale after 24 hours
const STATION_SYNC_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * registerStationHandlers
 *
 * @param {object} deps
 * @param {object}   deps.charInfoDb  - character info DB module
 * @param {function} deps.getLocator  - returns the shared locator instance
 * @param {function} deps.httpPost    - HTTP POST helper (passed to locator for station sync)
 */
function registerStationHandlers({
  ipcHandle,
  charInfoDb,
  getLocator,
  httpPost,
}) {

  // ─── IPC: Station / structure database sync ───────────────────────────────
  // Thin wrapper — all sync logic lives in locator.syncStationDatabase() so
  // the locator remains the single authority on station/structure data.
  //
  // Returns { npc, upwell } on success, { skipped: true } if under 24 h old,
  // or { error: string } on failure.
  ipcHandle('sync-station-database', async (_, opts = {}) => {
    const force = opts && opts.force === true;

    // Freshness guard — skip if synced recently and caller didn't force.
    if (!force) {
      const lastSync = await charInfoDb.getStationsLastSync('npc_stations').catch(() => 0);
      if (Date.now() - lastSync < STATION_SYNC_TTL_MS) {
        console.log('[StationSync] Skipped — synced less than 24 h ago.');
        return { skipped: true };
      }
    }

    try {
      await charInfoDb.initStationTables();
      // Delegate entirely to the locator; pass httpPost so the locator can use
      // the same POST helper (with auth headers, retries, etc.) as the rest of main.
      const result = await getLocator().syncStationDatabase({ httpPost });
      console.log(`[StationSync] IPC result: npc=${result.npc}, upwell=${result.upwell}, error=${result.error || 'none'}`);
      return result;
    } catch (e) {
      console.error('[StationSync] Fatal error:', e.message, e.stack);
      return { error: e.message };
    }
  });

  // ─── IPC: Get last station sync timestamp ─────────────────────────────────
  // Returns the ms-epoch timestamp of the last successful station sync, or 0.
  // Accepts optional { key } — defaults to 'npc_stations'.
  ipcHandle('get-station-sync-timestamp', async (_, opts = {}) => {
    const key = (opts && opts.key) || 'npc_stations';
    try {
      return await charInfoDb.getStationsLastSync(key);
    } catch {
      return 0;
    }
  });

  // ─── IPC: Upwell structures sync ─────────────────────────────────────────
  // Upwell structures cannot be bulk-downloaded (ESI removed the public listing
  // endpoint). This handler re-resolves any structures already in the local DB
  // that are missing geo data, and reports how many rows currently exist.
  // New structures are added automatically when characters are synced.
  ipcHandle('sync-upwell-database', async (_, opts = {}) => {
    try {
      // Re-resolve incomplete rows by running the locator's station sync.
      // Part 1 (NPC) will be fast since the TTL guard usually skips it;
      // Part 2 re-resolves Upwell rows with missing geo — always runs.
      const result = await getLocator().syncStationDatabase({ httpPost });

      // Try to get a real count from the DB if the helper exists, otherwise
      // fall back to what the locator reported.
      let upwellCount = result.upwell || 0;
      if (typeof charInfoDb.countUpwellStructures === 'function') {
        upwellCount = await charInfoDb.countUpwellStructures().catch(() => upwellCount);
      }

      console.log(`[UpwellSync] Re-resolve complete. DB has ${upwellCount} Upwell structures.`);
      return { npc: result.npc || 0, upwell: upwellCount };
    } catch (e) {
      console.error('[UpwellSync] Error:', e.message);
      return { error: e.message };
    }
  });
}

module.exports = { registerStationHandlers };