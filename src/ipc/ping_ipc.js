const { ipcMain, BrowserWindow } = require('electron');
const fs = require('fs');

/**
 * registerPingFileHandlers
 *
 * @param {object} deps
 * @param {object} deps.watcherState - shared object { watcher: null, timer: null }
 *                                     held in main.js so the app-quit handler can
 *                                     still close the watcher without knowing internals.
 */
function registerPingFileHandlers({
  ipcHandle, watcherState }) {

  // ─── IPC: Watch a ping file for changes ───────────────────────────────────
  // Sets up an fs.watch on the given path. When the file changes, debounces
  // 250 ms then broadcasts 'ping-file-updated' to all windows.
  ipcHandle('watch-ping-file', async (_, filePath) => {
    try {
      if (watcherState.watcher) {
        watcherState.watcher.close();
        watcherState.watcher = null;
      }
      if (watcherState.timer) {
        clearTimeout(watcherState.timer);
        watcherState.timer = null;
      }

      watcherState.watcher = fs.watch(filePath, { encoding: 'utf8' }, () => {
        if (watcherState.timer) clearTimeout(watcherState.timer);
        watcherState.timer = setTimeout(async () => {
          try {
            const contents = fs.readFileSync(filePath, 'utf8');
            BrowserWindow.getAllWindows().forEach(win => {
              win.webContents.send('ping-file-updated', contents, filePath);
            });
          } catch (e) {
            console.warn('Failed to read watched ping file:', e.message);
          }
        }, 250);
      });

      return true;
    } catch (e) {
      console.warn('Failed to watch ping file:', e.message);
      return false;
    }
  });

  // ─── IPC: Stop watching the ping file ─────────────────────────────────────
  ipcHandle('unwatch-ping-file', () => {
    if (watcherState.watcher) {
      watcherState.watcher.close();
      watcherState.watcher = null;
    }
    if (watcherState.timer) {
      clearTimeout(watcherState.timer);
      watcherState.timer = null;
    }
    return true;
  });
}

module.exports = { registerPingFileHandlers };