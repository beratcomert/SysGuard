const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const os   = require('os');

// ─── Backend Modülleri ────────────────────────────────────────────────────────
const { getHealth }                          = require('./system/health');
const { cleanTemp }                          = require('./system/temp');
const { runQuickScan, runDeepScan }          = require('./system/agent');
const { scanNetwork, killProcessByPid }      = require('./system/network');
const { executeChain, buildOneClickOptimizeChain } = require('./system/chain');

let mainWindow = null;

// ─── Pencere Oluştur ──────────────────────────────────────────────────────────
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 960,
        minHeight: 680,
        frame: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        backgroundColor: '#0d0f1a',
        show: false,
    });

    mainWindow.loadFile('renderer/index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ─── Uygulama Hazır ───────────────────────────────────────────────────────────
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
ipcMain.handle('quick-scan', async () => runQuickScan());
ipcMain.handle('deep-scan',  async () => runDeepScan());

// ─── IPC: NetGuard (Modül 1) ─────────────────────────────────────────────────
ipcMain.handle('scan-network', async () => {
    return scanNetwork();
});

ipcMain.handle('kill-network-process', async (event, pid) => {
    return killProcessByPid(pid);
});

// ─── IPC: Görev Zinciri (Modül 3) ────────────────────────────────────────────
ipcMain.handle('run-task-chain', async (event, chainDef) => {
    // Adım tamamlandığında renderer'a event göndereceğiz
    const result = await executeChain(chainDef, (stepResult) => {
        // UI restorasyon olayını ilet
        if (stepResult.uiEvent && mainWindow) {
            mainWindow.webContents.send('ui-event', stepResult.uiEvent);
        }
        // Adım ilerleme bilgisini ilet
        if (mainWindow) {
            mainWindow.webContents.send('chain-step-progress', stepResult);
        }
    });

    // Zincir bitince UI event'lerini toplu gönder
    if (result.uiEvents?.length > 0 && mainWindow) {
        result.uiEvents.forEach(ev => {
            mainWindow.webContents.send('ui-event', ev);
        });
    }

    return result;
});

ipcMain.handle('get-one-click-chain', async () => {
    return buildOneClickOptimizeChain();
});

// ─── IPC: Dosya / Ayar İşlemleri ─────────────────────────────────────────────
ipcMain.handle('open-folder', async (event, folderType) => {
    let folderPath = '';
    if (folderType === 'downloads') folderPath = path.join(os.homedir(), 'Downloads');
    else if (folderType === 'temp') folderPath = os.tmpdir();
    if (folderPath) await shell.openPath(folderPath);
    return { opened: folderPath };
});

ipcMain.handle('open-settings', async (event, settingType) => {
    if (settingType === 'startup_apps') {
        await shell.openExternal('ms-settings:startupapps');
    }
    return { opened: settingType };
});