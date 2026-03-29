const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Backend modüllerini içe aktarıyoruz
const { scanSystem } = require('./system/scan');
const { getHealth } = require('./system/health');
const { cleanTemp } = require('./system/temp');

// Pencere oluşturma fonksiyonu
function createWindow() {
    const win = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js') // frontend ile köprü
        }
    });

    win.loadFile('renderer/index.html'); // UI buradan açılır
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