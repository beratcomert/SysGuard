const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const os = require('os');

// Backend modülleri
const { getHealth } = require('./system/health');
const { cleanTemp } = require('./system/temp');
const { runQuickScan, runDeepScan } = require('./system/agent');

let mainWindow = null;

// ─── Pencere oluştur ──────────────────────────────────────────────────────────
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 650,
        frame: false,          // Custom titlebar
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        backgroundColor: '#0d0f1a',
        show: false            // Hazır olunca göster (beyaz flash yok)
    });

    mainWindow.loadFile('renderer/index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ─── Uygulama hazır ───────────────────────────────────────────────────────────
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// ─── Pencere Kontrolleri ──────────────────────────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
    if (!mainWindow) return;
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());

// ─── IPC: Sistem ─────────────────────────────────────────────────────────────
ipcMain.handle('get-health', async () => getHealth());

ipcMain.handle('clean-temp', async () => cleanTemp());

// Hızlı Tarama — sadece OS modülü, anlık sonuç
ipcMain.handle('quick-scan', async () => runQuickScan());

// Detaylı Tarama — PowerShell sorguları, kapsamlı analiz
ipcMain.handle('deep-scan', async () => runDeepScan());

// ─── IPC: Dosya/Ayar İşlemleri ───────────────────────────────────────────────
ipcMain.handle('open-folder', async (event, folderType) => {
    let folderPath = '';
    if (folderType === 'downloads') folderPath = path.join(os.homedir(), 'Downloads');
    else if (folderType === 'temp')      folderPath = os.tmpdir();
    if (folderPath) await shell.openPath(folderPath);
    return { opened: folderPath };
});

ipcMain.handle('open-settings', async (event, settingType) => {
    if (settingType === 'startup_apps') {
        await shell.openExternal('ms-settings:startupapps');
    }
    return { opened: settingType };
});