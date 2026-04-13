const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const os = require('os');

// Backend modüllerini içe aktarıyoruz
const { scanSystem } = require('./system/scan');
const { getHealth } = require('./system/health');
const { cleanTemp } = require('./system/temp');
const { runAgent } = require('./system/agent');

// Pencere oluşturma fonksiyonu
function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 650,
        frame: false,
        titleBarStyle: 'hidden',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        backgroundColor: '#0d0f1a'
    });

    win.loadFile('renderer/index.html');

    // Pencere kontrol IPC
    ipcMain.on('window-minimize', () => win.minimize());
    ipcMain.on('window-maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize());
    ipcMain.on('window-close', () => win.close());
}

// Uygulama hazır olunca pencereyi başlat
app.whenReady().then(createWindow);


// 🔗 FRONTEND → BACKEND bağlantıları

// Sistem tarama isteği
ipcMain.handle("scan-system", async () => {
    return await scanSystem();
});

// Sistem sağlık bilgisi isteği
ipcMain.handle("get-health", async () => {
    return getHealth();
});

// Temp temizleme isteği
ipcMain.handle("clean-temp", async () => {
    return cleanTemp();
});

// Antigravity Agent analizi
ipcMain.handle("run-agent", async () => {
    return runAgent();
});

// Klasör açma
ipcMain.handle("open-folder", async (event, folderType) => {
    let folderPath = '';
    if (folderType === 'downloads') {
        folderPath = path.join(os.homedir(), 'Downloads');
    } else if (folderType === 'temp') {
        folderPath = os.tmpdir();
    }
    if (folderPath) shell.openPath(folderPath);
    return { opened: folderPath };
});

// Sistem ayarları açma
ipcMain.handle("open-settings", async (event, settingType) => {
    if (settingType === 'startup_apps') {
        shell.openExternal('ms-settings:startupapps');
    }
    return { opened: settingType };
});