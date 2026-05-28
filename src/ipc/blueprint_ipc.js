const { ipcMain } = require('electron');

const ESI_BASE = 'https://esi.evetech.net';

/**
 * registerBlueprintHandlers
 *
 * @param {object} deps
 * @param {function} deps.getValidToken - returns a valid ESI access token for a characterId
 * @param {function} deps.httpGet       - unauthenticated HTTP GET helper
 * @param {function} deps.resolveNames  - resolves an array of ids -> { id: name } map
 * @param {function} deps.loadDB        - loads the local JSON database
 * @param {function} deps.saveDB        - saves the local JSON database
 * @param {object}   deps.charInfoDb    - character info DB module (for get-all-blueprints-from-db)
 */
function registerBlueprintHandlers({
  ipcHandle,
  getValidToken,
  httpGet,
  resolveNames,
  loadDB,
  saveDB,
  charInfoDb,
}) {

  // ─── IPC: Fetch & sync blueprints for a character ──────────────────────────
  ipcHandle('sync-blueprints', async (_, characterId) => {
    const token = await getValidToken(characterId);
    const db    = loadDB();

    // Fetch character blueprints (paginated)
    let allBPs = [];
    let page = 1;
    while (true) {
      const data = await httpGet(
        `${ESI_BASE}/v3/characters/${characterId}/blueprints/?page=${page}&datasource=tranquility`,
        { Authorization: `Bearer ${token}` }
      );
      allBPs = allBPs.concat(data);
      if (data.length < 1000) break;
      page++;
    }

    // Resolve type names for all BPs
    const typeIds = [...new Set(allBPs.map(b => b.type_id))];
    const nameMap = await resolveNames(typeIds);

    const blueprints = allBPs.map(bp => ({
      item_id:       bp.item_id,
      type_id:       bp.type_id,
      name:          nameMap[bp.type_id] || `Type ${bp.type_id}`,
      location_id:   bp.location_id,
      location_flag: bp.location_flag,
      quantity:      bp.quantity,      // -1 = BPO, -2 = BPC
      runs:          bp.runs,          // -1 = BPO, >0 = BPC runs remaining
      me:            bp.material_efficiency,
      te:            bp.time_efficiency,
      isBPC:         bp.quantity === -2,
    }));

    db.blueprints[characterId] = {
      updatedAt: Date.now(),
      items: blueprints,
    };
    saveDB(db);

    return { count: blueprints.length, blueprints };
  });

  // ─── IPC: Get saved blueprints for a single character (from JSON DB) ───────
  ipcHandle('get-blueprints', (_, characterId) => {
    const db = loadDB();
    return db.blueprints[characterId] || null;
  });

  // ─── IPC: Get all blueprints across all characters (from JSON DB) ──────────
  ipcHandle('get-all-blueprints', () => {
    const db  = loadDB();
    const all = [];
    for (const [charId, data] of Object.entries(db.blueprints)) {
      const account = db.accounts[charId];
      if (data && data.items) {
        data.items.forEach(bp => all.push({
          ...bp,
          characterId,
          characterName: account?.characterName || 'Unknown',
        }));
      }
    }
    return all;
  });

  // ─── IPC: Get all blueprints from SQLite (character_information.db) ────────
  // Used by the blueprint library / industry pages which read from CharDB
  // rather than the legacy JSON file.
  ipcHandle('get-all-blueprints-from-db', async () => {
    try {
      return await charInfoDb.getAllBlueprints();
    } catch (e) {
      console.warn('[blueprint_ipc] get-all-blueprints-from-db failed:', e.message);
      return [];
    }
  });
}

module.exports = { registerBlueprintHandlers };