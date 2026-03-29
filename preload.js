const { contextBridge, ipcRenderer } = require('electron');

// Frontend'e güvenli fonksiyonlar açıyoruz
contextBridge.exposeInMainWorld('electronAPI', {

    // Sistem tarama başlat
    scanSystem: () => ipcRenderer.invoke('scan-system'),

    // CPU & RAM bilgisi al
    getHealth: () => ipcRenderer.invoke('get-health'),

    // Temp temizle
    cleanTemp: () => ipcRenderer.invoke('clean-temp')

});