const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

    // ─── Sistem Sağlık ────────────────────────────────────────────────────────
    getHealth:    () => ipcRenderer.invoke('get-health'),
    cleanTemp:    () => ipcRenderer.invoke('clean-temp'),
    quickScan:    () => ipcRenderer.invoke('quick-scan'),
    deepScan:     () => ipcRenderer.invoke('deep-scan'),
    getHardwareDiagnostics: () => ipcRenderer.invoke('get-hardware-diagnostics'),
    onThermalUpdate: (callback) => ipcRenderer.on('termal-guncelleme', (event, data) => callback(data)),
    triggerBatteryCheck: () => ipcRenderer.invoke('trigger-battery-check'),
    onBatteryUpdate: (callback) => ipcRenderer.on('battery-health-update', (event, data) => callback(data)),
    getPeripheralDiagnostics: () => ipcRenderer.invoke('get-peripheral-diagnostics'),
    restartSpooler: () => ipcRenderer.invoke('restart-spooler'),

    // ─── NetGuard: Ağ Taraması (Modül 1) ─────────────────────────────────────
    scanNetwork:           ()     => ipcRenderer.invoke('scan-network'),
    killNetworkProcess:    (pid)  => ipcRenderer.invoke('kill-network-process', pid),
    blockPort:             (port) => ipcRenderer.invoke('block-port', port),

    // ─── Görev Zinciri (Modül 3) ──────────────────────────────────────────────
    runTaskChain:          (chainDef) => ipcRenderer.invoke('run-task-chain', chainDef),
    getOneClickChain:      ()         => ipcRenderer.invoke('get-one-click-chain'),

    // Adım bazlı ilerleme dinleyici
    onChainStepProgress: (callback) => {
        ipcRenderer.on('chain-step-progress', (_, data) => callback(data));
    },

    // UI olayları dinleyici (ekosistem animasyonu vb.)
    onUiEvent: (callback) => {
        ipcRenderer.on('ui-event', (_, data) => callback(data));
    },

    // ─── Antivirus (Modül 4) ─────────────────────────────────────────────────
    avGetStatus:    () => ipcRenderer.invoke('av-get-status'),
    avQuickScan:    () => ipcRenderer.invoke('av-quick-scan'),
    avCleanThreats: () => ipcRenderer.invoke('av-clean-threats'),
    avGetHistory:   () => ipcRenderer.invoke('av-get-history'),

    onAvScanProgress: (callback) => {
        ipcRenderer.on('av-scan-progress', (_, data) => callback(data));
    },

    // ─── SysGuard Virus Engine ────────────────────────────────────────────────
    engineScan:        ()           => ipcRenderer.invoke('engine-scan'),
    engineScanFile:    (filePath)   => ipcRenderer.invoke('engine-scan-file', filePath),
    showOpenDialog:    ()           => ipcRenderer.invoke('show-open-dialog'),
    engineQuarantine:  (filePath)   => ipcRenderer.invoke('engine-quarantine', filePath),
    engineDelete:      (filePath)   => ipcRenderer.invoke('engine-delete', filePath),
    engineKillProcess: (pid)        => ipcRenderer.invoke('engine-kill-process', pid),

    onEngineScanProgress: (callback) => {
        ipcRenderer.on('engine-scan-progress', (_, data) => callback(data));
    },

    // ─── Klasör / Ayar ────────────────────────────────────────────────────────
    openFolder:    (folderType)   => ipcRenderer.invoke('open-folder',   folderType),
    openSettings:  (settingType)  => ipcRenderer.invoke('open-settings', settingType),

    // ─── Pencere Kontrolleri ──────────────────────────────────────────────────
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow:    () => ipcRenderer.send('window-close'),

});