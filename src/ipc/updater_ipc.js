// ── updater_ipc.js — SourceForge update checker ───────────────────────────────
// Checks https://sourceforge.net/projects/eve-carbon/best_release.json for a
// newer version than the currently running app. If found, the renderer shows a
// notification and the user can open the SourceForge download page.
//
// User data lives in %AppData%\EVE-Carbon\ and is never touched by the NSIS
// installer, so upgrades are seamless (accounts, databases, settings all survive).

const { shell } = require('electron');

const SF_BEST_RELEASE_URL = 'https://sourceforge.net/projects/eve-carbon/best_release.json';
const SF_PROJECT_URL      = 'https://sourceforge.net/projects/eve-carbon/files/latest/download';

// Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
function compareVersions(v1, v2) {
  const a = v1.split('.').map(Number);
  const b = v2.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

// Fetch JSON from a URL, following up to 5 redirects.
function fetchJson(url, redirectsLeft = 5) {
  const https = require('https');
  const http  = require('http');
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: { 'User-Agent': 'EVE-Carbon-Updater/1.0', 'Accept': 'application/json' },
    }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location && redirectsLeft > 0) {
        return resolve(fetchJson(res.headers.location, redirectsLeft - 1));
      }
      if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function registerUpdaterHandlers({ ipcHandle, app, loadConfig, saveConfig }) {

  // ── Check for update ────────────────────────────────────────────────────────
  // Returns:
  //   { hasUpdate: false }
  //   { hasUpdate: true, latestVersion, currentVersion, downloadUrl }
  ipcHandle('updater-check', async () => {
    try {
      const currentVersion = app.getVersion();
      const data = await fetchJson(SF_BEST_RELEASE_URL);

      // SourceForge returns platform_releases.windows or a generic release object.
      // Try windows-specific first, then fall back to the generic release.
      const release =
        data?.platform_releases?.windows ||
        data?.platform_releases?.bsd     ||
        data?.release                    ||
        null;

      if (!release) return { hasUpdate: false };

      // Extract semver from filename, e.g. "EVE-Carbon Setup 0.5.4.exe" → "0.5.4"
      const filename = release.filename || '';
      const match = filename.match(/(\d+\.\d+\.\d+)/);
      if (!match) return { hasUpdate: false };

      const latestVersion = match[1];

      // Check if this version was previously skipped
      const cfg = loadConfig();
      const skipped = cfg?.app?.updater?.skippedVersion;
      if (skipped === latestVersion) return { hasUpdate: false };

      if (compareVersions(latestVersion, currentVersion) > 0) {
        const downloadUrl = release.url || SF_PROJECT_URL;
        return { hasUpdate: true, latestVersion, currentVersion, downloadUrl };
      }

      return { hasUpdate: false };
    } catch (e) {
      console.warn('[updater] check failed:', e.message);
      return { hasUpdate: false };
    }
  });

  // ── Open download page in browser ──────────────────────────────────────────
  // Opens the SourceForge download (or best-release URL) in the system browser.
  // The NSIS installer handles the upgrade; user data in %AppData% is untouched.
  ipcHandle('updater-open-download', async (_, downloadUrl) => {
    const url = (downloadUrl && /^https?:\/\//.test(downloadUrl))
      ? downloadUrl
      : SF_PROJECT_URL;
    shell.openExternal(url);
    return { success: true };
  });

  // ── Skip a specific version ─────────────────────────────────────────────────
  // Persisted in config so the prompt doesn't reappear for the same version.
  ipcHandle('updater-skip-version', async (_, version) => {
    try {
      const cfg = loadConfig();
      cfg.app = cfg.app || {};
      cfg.app.updater = cfg.app.updater || {};
      cfg.app.updater.skippedVersion = version;
      saveConfig(cfg);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

module.exports = { registerUpdaterHandlers };
