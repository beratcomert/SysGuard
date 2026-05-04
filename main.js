const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const os   = require('os');

// ─── Backend Modülleri ────────────────────────────────────────────────────────
const { getHealth }                          = require('./system/health');
const { cleanTemp }                          = require('./system/temp');
const { runQuickScan, runDeepScan }          = require('./system/agent');
const { scanNetwork, killProcessByPid, blockPort } = require('./system/network');
const { executeChain, buildOneClickOptimizeChain } = require('./system/chain');
const { getDefenderStatus, runQuickScan: avRunQuickScan, cleanThreats, getDefenderHistory } = require('./system/antivirus');
const { runEngineScan, scanSingleFile, quarantineFile, deleteFile, killProcess } = require('./system/virusEngine');
const { getHardwareDiagnostics }             = require('./system/hardware');

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
ipcMain.handle('get-hardware-diagnostics', async () => getHardwareDiagnostics());

// ─── IPC: NetGuard (Modül 1) ─────────────────────────────────────────────────
ipcMain.handle('scan-network', async () => {
    return scanNetwork();
});

ipcMain.handle('kill-network-process', async (event, pid) => {
    return killProcessByPid(pid);
});

ipcMain.handle('block-port', async (event, port) => {
    return blockPort(port);
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

// ─── IPC: Antivirus (Modül 4) ────────────────────────────────────────────────
ipcMain.handle('av-get-status', async () => {
    return getDefenderStatus();
});

ipcMain.handle('av-quick-scan', async () => {
    return avRunQuickScan((progress) => {
        if (mainWindow) mainWindow.webContents.send('av-scan-progress', progress);
    });
});

ipcMain.handle('av-clean-threats', async () => {
    return cleanThreats();
});

ipcMain.handle('av-get-history', async () => {
    return getDefenderHistory();
});

// ─── IPC: SysGuard Virus Engine ──────────────────────────────────────────────
ipcMain.handle('engine-scan', async () => {
    return runEngineScan((progress) => {
        if (mainWindow) mainWindow.webContents.send('engine-scan-progress', progress);
    });
});

ipcMain.handle('engine-quarantine', async (event, filePath) => {
    return quarantineFile(filePath);
});

ipcMain.handle('engine-delete', async (event, filePath) => {
    return deleteFile(filePath);
});

ipcMain.handle('engine-kill-process', async (event, pid) => {
    return killProcess(pid);
});

ipcMain.handle('engine-scan-file', async (event, filePath) => {
    return scanSingleFile(filePath, (progress) => {
        if (mainWindow) mainWindow.webContents.send('engine-scan-progress', progress);
    });
});

ipcMain.handle('show-open-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Taranacak Dosyayı Seçin',
        properties: ['openFile'],
    });
    return result;
});

ipcMain.handle('open-settings', async (event, settingType) => {
    if (settingType === 'startup_apps') {
        await shell.openExternal('ms-settings:startupapps');
    }
    return { opened: settingType };
});