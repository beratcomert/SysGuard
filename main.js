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
const si                                     = require('systeminformation');

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
    
    // 1Hz Termal Monitör Döngüsü
    setInterval(async () => {
        if (!mainWindow) return;

        try {
            const cpu = await si.cpu();
            const cpuSpeed = await si.cpuCurrentSpeed();
            const temp = await si.cpuTemperature();

            const currentMhz = Math.round(cpuSpeed.avg * 1000);
            const maxMhz     = Math.round(cpu.speedMax * 1000);
            const cpuTemp    = Math.round(temp.main || 45); // Fallback to 45 if no data

            // Termal Darboğaz Algoritması
            let performanceLoss = 0;
            if (cpuTemp > 85 && currentMhz < maxMhz) {
                performanceLoss = Math.round(100 - ((currentMhz / maxMhz) * 100));
            }
            performanceLoss = Math.max(0, performanceLoss);

            // Durumu (State) Belirle
            let theme = "normal";
            if (performanceLoss > 5 || cpuTemp > 85) theme = "critical";
            else if (cpuTemp > 70) theme = "warning";

            // Arıza/Bilgi Mesajları
            let title = "Isı Dağılımı Normal";
            let desc = "İşlemciniz stabil sıcaklıklarda çalışıyor ve tam performans sunuyor.";
            if (theme === "critical") {
                title = "Isı Darboğazı Tespit Edildi!";
                desc = `Sisteminiz kritik sıcaklıklara (${cpuTemp}°C) ulaştığı için fiziksel hasarı önlemek amacıyla kendini yavaşlatıyor. İşlemciniz şu an potansiyel performansının %${performanceLoss}'ini kaybediyor.`;
            } else if (theme === "warning") {
                title = "Sıcaklık Yükseliyor";
                desc = `İşlemci sıcaklığı normalin üzerinde (${cpuTemp}°C). Soğutma sistemini kontrol etmenizde fayda var.`;
            }

            mainWindow.webContents.send('termal-guncelleme', {
                cpu_temp: cpuTemp,
                current_mhz: currentMhz,
                max_mhz: maxMhz,
                performance_loss: performanceLoss,
                theme: theme,
                title: title,
                description: desc
            });
        } catch (err) {
            // Sessizce devam et
        }
    }, 1000);

    // 60s Batarya Sağlık Döngüsü
    setInterval(() => updateBatteryHealth(), 60000);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

/**
 * Batarya Sağlık Verilerini Çeker ve Frontend'e Gönderir
 */
async function updateBatteryHealth() {
    if (!mainWindow) return;

    try {
        let battery = await si.battery();
        
        // Eğer si.battery() bulamazsa PowerShell ile zorla (Laptoplarda daha garantidir)
        if (!battery.hasBattery) {
            const psBattery = await new Promise(resolve => {
                const { exec } = require('child_process');
                exec('powershell -Command "Get-CimInstance -ClassName Win32_Battery | Select-Object EstimatedChargeRemaining, DesignCapacity, FullChargeCapacity | ConvertTo-Json"', (err, stdout) => {
                    if (err || !stdout) return resolve(null);
                    try { resolve(JSON.parse(stdout)); } catch (e) { resolve(null); }
                });
            });

            if (psBattery) {
                battery = {
                    hasBattery: true,
                    designedCapacity: psBattery.DesignCapacity,
                    maxCapacity: psBattery.FullChargeCapacity,
                    cycleCount: 0 // PowerShell'den döngü sayısı çekmek zordur
                };
            }
        }

        if (!battery || !battery.hasBattery) {
            mainWindow.webContents.send('battery-health-update', { status: "no_battery" });
            return;
        }

        const designed = battery.designedCapacity || 0;
        const currentMax = battery.maxCapacity || 0;
        const cycles = battery.cycleCount || 0;

        // Sağlık ve Yıpranma Hesaplama
        let healthPercent = 100;
        if (designed > 0) {
            healthPercent = Math.round((currentMax / designed) * 100);
        }
        healthPercent = Math.min(100, Math.max(0, healthPercent));
        const wearLevel = 100 - healthPercent;

        // Durum (State) Belirle
        let theme = "optimum";
        let title = "Batarya Sağlığı Mükemmel";
        let desc = "Piliniz fabrikadan çıktığı günkü kondisyonuna çok yakın.";

        if (healthPercent < 50) {
            theme = "critical";
            title = "Kritik Batarya Yıpranması!";
            desc = "Pil hücreleri ömrünü tamamlamak üzere. Güvenliğiniz için değişim gerekebilir.";
        } else if (healthPercent < 85) {
            theme = "warning";
            title = "Batarya Kondisyonu Azalıyor";
            desc = "Piliniz orijinal kapasitesinin bir kısmını kaybetmiş. Ömrünü uzatmak için %20-%80 aralığında şarj edin.";
        }

        mainWindow.webContents.send('battery-health-update', {
            status: "ok",
            theme: theme,
            title: title,
            description: desc,
            health_percent: healthPercent,
            wear_percent: wearLevel,
            design_cap: designed > 0 ? `${designed} mWh` : "Bilinmiyor",
            max_cap: currentMax > 0 ? `${currentMax} mWh` : "Bilinmiyor",
            cycle_count: cycles
        });

    } catch (err) {
        console.error("Battery health update failed", err);
    }
}

ipcMain.handle('trigger-battery-check', async () => updateBatteryHealth());

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