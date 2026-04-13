const { contextBridge, ipcRenderer } = require('electron');

// Frontend'e güvenli fonksiyonlar açıyoruz
contextBridge.exposeInMainWorld('electronAPI', {

    // Sistem tarama başlat
    scanSystem: () => ipcRenderer.invoke('scan-system'),

    // CPU & RAM bilgisi al
    getHealth: () => ipcRenderer.invoke('get-health'),

    // Temp temizle
    cleanTemp: () => ipcRenderer.invoke('clean-temp'),

    // Antigravity Agent analizi
    runAgent: () => ipcRenderer.invoke('run-agent'),

    // Klasör aç
    openFolder: (folderType) => ipcRenderer.invoke('open-folder', folderType),

    // Sistem ayarları aç
    openSettings: (settingType) => ipcRenderer.invoke('open-settings', settingType),

    // Pencere kontrolleri
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close')

});