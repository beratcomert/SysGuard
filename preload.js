const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

    // Sistem sağlık bilgisi (anlık)
    getHealth: () => ipcRenderer.invoke('get-health'),

    // Temp temizle
    cleanTemp: () => ipcRenderer.invoke('clean-temp'),

    // Hızlı Tarama — ~50ms, sadece OS modülü
    quickScan: () => ipcRenderer.invoke('quick-scan'),

    // Detaylı Tarama — ~5-10s, PowerShell analizi
    deepScan: () => ipcRenderer.invoke('deep-scan'),

    // Klasör aç
    openFolder: (folderType) => ipcRenderer.invoke('open-folder', folderType),

    // Sistem ayarları aç
    openSettings: (settingType) => ipcRenderer.invoke('open-settings', settingType),

    // Pencere kontrolleri
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow:    () => ipcRenderer.send('window-close')

});