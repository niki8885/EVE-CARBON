// theme_ipc.js — palette / theme management IPC handlers
// Built-in themes live in themes/ (app bundle).
// User-created themes live in userData/themes/ as simplified YAML.

const fs   = require('fs');
const path = require('path');

function registerThemeHandlers({ ipcHandle, app, loadConfig, saveConfig, userThemesDir }) {

  const builtinDir = path.join(path.dirname(path.dirname(__dirname)), 'themes');

  function resolveThemePath(id) {
    if (id.startsWith('user:')) {
      const file = id.slice(5);
      return path.join(userThemesDir, file);
    }
    // Built-in: id is filename without extension
    const candidates = [
      path.join(builtinDir, `${id}.yaml`),
      path.join(builtinDir, `${id}.yml`),
    ];
    return candidates.find(p => fs.existsSync(p)) || null;
  }

  // List all available themes (built-in + user)
  ipcHandle('theme-get-all', () => {
    const jsy   = require('js-yaml');
    const themes = [];

    const scanDir = (dir, source) => {
      if (!fs.existsSync(dir)) return;
      for (const file of fs.readdirSync(dir).filter(f => /\.(yaml|yml)$/.test(f))) {
        try {
          const raw  = fs.readFileSync(path.join(dir, file), 'utf8');
          const data = jsy.load(raw);
          if (!data?.palette) continue;
          const id = source === 'user' ? `user:${file}` : path.basename(file, path.extname(file));
          themes.push({
            id,
            source,
            name:        data.name        || id,
            description: data.description || '',
            author:      data.author      || '',
            version:     data.version     || '',
          });
        } catch {}
      }
    };

    scanDir(builtinDir, 'builtin');
    scanDir(userThemesDir, 'user');
    return themes;
  });

  // Return the full parsed theme object for a given id
  ipcHandle('theme-get', (_, id) => {
    const jsy = require('js-yaml');
    try {
      const p = resolveThemePath(id);
      if (!p || !fs.existsSync(p)) return null;
      return jsy.load(fs.readFileSync(p, 'utf8'));
    } catch { return null; }
  });

  // Get / set the active theme id in config
  ipcHandle('theme-get-active', () => {
    return loadConfig()?.app?.theme || 'Carbon';
  });

  ipcHandle('theme-set-active', (_, id) => {
    const cfg = loadConfig();
    cfg.app = cfg.app || {};
    cfg.app.theme = id;
    saveConfig(cfg);
    return true;
  });

  // Save a user-created theme (simplified 16-swatch format)
  // payload: { name, roles, swatches: { red, teal, … , background, panel, text, border } }
  ipcHandle('theme-save-custom', (_, payload) => {
    const jsy = require('js-yaml');
    if (!payload?.name || !payload?.swatches) return { success: false, error: 'Missing name or swatches' };
    try {
      if (!fs.existsSync(userThemesDir)) fs.mkdirSync(userThemesDir, { recursive: true });
      const safe = payload.name.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'custom';
      const file = `${safe}.yaml`;
      const data = {
        name:    payload.name,
        type:    'custom',
        author:  payload.author || '',
        version: '1.0',
        roles:   payload.roles || { accent: 'red', danger: 'red', success: 'green', warning: 'orange', info: 'blue' },
        swatches: payload.swatches,
      };
      fs.writeFileSync(path.join(userThemesDir, file), jsy.dump(data));
      return { success: true, id: `user:${file}` };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Delete a user-created theme
  ipcHandle('theme-delete-custom', (_, id) => {
    if (!id?.startsWith('user:')) return { success: false, error: 'Cannot delete built-in themes' };
    try {
      const p = resolveThemePath(id);
      if (!p || !fs.existsSync(p)) return { success: false, error: 'File not found' };
      fs.unlinkSync(p);
      // If this was the active theme, fall back to Carbon
      const cfg = loadConfig();
      if (cfg?.app?.theme === id) {
        cfg.app.theme = 'Carbon';
        saveConfig(cfg);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

module.exports = { registerThemeHandlers };
