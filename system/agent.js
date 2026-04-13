const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Yardımcı Fonksiyonlar ───────────────────────────────────────────────────

function bytesToGB(bytes) {
    return (bytes / (1024 ** 3)).toFixed(2);
}

function runPS(cmd) {
    try {
        return execSync(`powershell -NoProfile -Command "${cmd}"`, {
            encoding: 'utf8',
            timeout: 10000,
            windowsHide: true
        }).trim();
    } catch (e) {
        return null;
    }
}

// ─── Veri Toplama Modülleri ──────────────────────────────────────────────────

function collectRamData() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const usagePercent = ((used / total) * 100).toFixed(1);
    return { total, free, used, usagePercent: parseFloat(usagePercent) };
}

function collectCpuData() {
    // Windows'ta loadavg her zaman 0 döner; processleri say
    const raw = runPS("Get-Process | Sort-Object CPU -Descending | Select-Object -First 5 | ConvertTo-Json -Depth 1");
    let topProcesses = [];
    try {
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        topProcesses = arr.map(p => ({
            name: p.ProcessName || p.Name || 'unknown',
            cpu: parseFloat((p.CPU || 0).toFixed(1)),
            id: p.Id
        }));
    } catch (_) {}
    return { topProcesses };
}

function collectDiskData() {
    const raw = runPS("Get-PSDrive -PSProvider FileSystem | Select-Object Name,Used,Free | ConvertTo-Json");
    let drives = [];
    try {
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        drives = arr.map(d => ({
            name: d.Name,
            used: d.Used || 0,
            free: d.Free || 0,
            total: (d.Used || 0) + (d.Free || 0),
            usagePercent: d.Used && d.Free
                ? parseFloat(((d.Used / (d.Used + d.Free)) * 100).toFixed(1))
                : 0
        })).filter(d => d.total > 0);
    } catch (_) {}
    return { drives };
}

function collectStartupApps() {
    const raw = runPS("Get-CimInstance Win32_StartupCommand | Select-Object Name,Command,Location | ConvertTo-Json");
    let apps = [];
    try {
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        apps = arr.map(a => ({ name: a.Name || 'Unknown', command: a.Command || '', location: a.Location || '' }));
    } catch (_) {}
    return { apps, count: apps.length };
}

function collectTempSize() {
    const tempDir = os.tmpdir();
    let totalSize = 0;
    let fileCount = 0;
    try {
        const files = fs.readdirSync(tempDir);
        files.forEach(f => {
            try {
                const stat = fs.statSync(path.join(tempDir, f));
                totalSize += stat.size;
                fileCount++;
            } catch (_) {}
        });
    } catch (_) {}
    return { totalSize, fileCount, totalSizeGB: parseFloat(bytesToGB(totalSize)) };
}

function collectDownloadsSize() {
    const downloadsPath = path.join(os.homedir(), 'Downloads');
    let totalSize = 0;
    let fileCount = 0;
    try {
        const files = fs.readdirSync(downloadsPath);
        files.forEach(f => {
            try {
                const stat = fs.statSync(path.join(downloadsPath, f));
                totalSize += stat.size;
                fileCount++;
            } catch (_) {}
        });
    } catch (_) {}
    return { totalSize, fileCount, totalSizeGB: parseFloat(bytesToGB(totalSize)), path: downloadsPath };
}

function collectSuspiciousProcesses() {
    const raw = runPS("Get-Process | Where-Object { $_.CPU -gt 50 } | Select-Object ProcessName,CPU,Id | ConvertTo-Json");
    let suspicious = [];
    try {
        const parsed = JSON.parse(raw);
        if (parsed) {
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            // Bilinen güvenli işlemleri filtrele
            const safe = ['svchost', 'System', 'chrome', 'msedge', 'firefox', 'explorer', 'electron', 'node', 'powershell'];
            suspicious = arr.filter(p => {
                const name = (p.ProcessName || '').toLowerCase();
                return !safe.some(s => name.includes(s));
            }).map(p => ({ name: p.ProcessName, cpu: parseFloat((p.CPU || 0).toFixed(1)), id: p.Id }));
        }
    } catch (_) {}
    return { suspicious };
}

// ─── Ana Agent Fonksiyonu ────────────────────────────────────────────────────

function runAgent() {
    const suggestions = [];

    // 1. RAM Analizi
    const ram = collectRamData();
    if (ram.usagePercent > 85) {
        suggestions.push({
            agent_id: 'antigravity_agent_v1',
            priority: 'high',
            category: 'performance',
            title: 'Bellek Kullanımı Kritik Seviyede',
            description: `RAM'inin %${ram.usagePercent}'i kullanımda (${bytesToGB(ram.used)} GB / ${bytesToGB(ram.total)} GB). Bu durum uygulamaların yavaşlamasına veya çökmesine neden olabilir.`,
            analysis_context: {
                ram_usage_percent: ram.usagePercent,
                used_gb: bytesToGB(ram.used),
                total_gb: bytesToGB(ram.total),
                free_gb: bytesToGB(ram.free)
            },
            suggested_actions: [
                { label: 'Çalışan Uygulamaları Gör', action_type: 'open_section', action_payload: 'processes' },
                { label: 'Belleği Temizle', action_type: 'background_process', action_payload: 'clean_ram' }
            ]
        });
    } else if (ram.usagePercent > 70) {
        suggestions.push({
            agent_id: 'antigravity_agent_v1',
            priority: 'medium',
            category: 'performance',
            title: 'Bellek Kullanımı Yüksek',
            description: `RAM'inin %${ram.usagePercent}'i kullanımda. Birden fazla ağır uygulama açıksa performans düşebilir.`,
            analysis_context: {
                ram_usage_percent: ram.usagePercent,
                used_gb: bytesToGB(ram.used),
                total_gb: bytesToGB(ram.total)
            },
            suggested_actions: [
                { label: 'Detayları Gör', action_type: 'open_section', action_payload: 'health' }
            ]
        });
    }

    // 2. Disk Analizi
    const disk = collectDiskData();
    disk.drives.forEach(drive => {
        if (drive.usagePercent > 90) {
            suggestions.push({
                agent_id: 'antigravity_agent_v1',
                priority: 'high',
                category: 'disk_space',
                title: `${drive.name}: Sürücüsü Neredeyse Dolu`,
                description: `${drive.name}: sürücüsünün %${drive.usagePercent}'i dolu. Sadece ${bytesToGB(drive.free)} GB boş alan kaldı. Bu durum sistem performansını ciddi biçimde etkiler.`,
                analysis_context: {
                    drive: drive.name,
                    usage_percent: drive.usagePercent,
                    free_gb: bytesToGB(drive.free),
                    total_gb: bytesToGB(drive.total)
                },
                suggested_actions: [
                    { label: 'Temp Dosyaları Temizle', action_type: 'background_process', action_payload: 'clean_temp' },
                    { label: 'Downloads Klasörünü Aç', action_type: 'open_folder', action_payload: 'downloads' }
                ]
            });
        } else if (drive.usagePercent > 75) {
            suggestions.push({
                agent_id: 'antigravity_agent_v1',
                priority: 'medium',
                category: 'disk_space',
                title: `${drive.name}: Disk Alanı Azalıyor`,
                description: `${drive.name}: sürücüsünün %${drive.usagePercent}'i dolu. ${bytesToGB(drive.free)} GB boş alan var.`,
                analysis_context: {
                    drive: drive.name,
                    usage_percent: drive.usagePercent,
                    free_gb: bytesToGB(drive.free)
                },
                suggested_actions: [
                    { label: 'Temp Dosyaları Temizle', action_type: 'background_process', action_payload: 'clean_temp' }
                ]
            });
        }
    });

    // 3. Temp Dosyaları
    const temp = collectTempSize();
    if (temp.totalSizeGB > 0.5) {
        suggestions.push({
            agent_id: 'antigravity_agent_v1',
            priority: temp.totalSizeGB > 2 ? 'high' : 'low',
            category: 'disk_space',
            title: 'Geçici Dosyalar Yer Kaplıyor',
            description: `Temp klasöründe ${temp.fileCount} dosya var ve toplam ${temp.totalSizeGB} GB yer kaplıyor. Bu dosyalar güvenle silinebilir.`,
            analysis_context: {
                temp_size_gb: temp.totalSizeGB,
                file_count: temp.fileCount
            },
            suggested_actions: [
                { label: 'Hemen Temizle', action_type: 'background_process', action_payload: 'clean_temp' }
            ]
        });
    }

    // 4. Downloads Analizi
    const downloads = collectDownloadsSize();
    if (downloads.totalSizeGB > 1) {
        suggestions.push({
            agent_id: 'antigravity_agent_v1',
            priority: 'low',
            category: 'disk_space',
            title: 'Downloads Klasörü Büyük',
            description: `İndirilenler klasöründe ${downloads.fileCount} dosya var ve ${downloads.totalSizeGB} GB yer kaplıyor. Eski indirmeleri gözden geçirebilirsin.`,
            analysis_context: {
                downloads_size_gb: downloads.totalSizeGB,
                file_count: downloads.fileCount,
                path: downloads.path
            },
            suggested_actions: [
                { label: 'Klasörü Aç', action_type: 'open_folder', action_payload: 'downloads' }
            ]
        });
    }

    // 5. Başlangıç Uygulamaları
    const startup = collectStartupApps();
    if (startup.count > 8) {
        suggestions.push({
            agent_id: 'antigravity_agent_v1',
            priority: 'medium',
            category: 'performance',
            title: 'Çok Fazla Başlangıç Uygulaması',
            description: `Bilgisayarın açılırken ${startup.count} uygulama otomatik başlıyor. Bu açılış süresini uzatır ve sistem kaynaklarını tüketir.`,
            analysis_context: {
                startup_app_count: startup.count,
                apps: startup.apps.slice(0, 5).map(a => a.name)
            },
            suggested_actions: [
                { label: 'Başlangıç Yöneticisini Aç', action_type: 'open_settings', action_payload: 'startup_apps' }
            ]
        });
    }

    // 6. Şüpheli İşlemler
    const security = collectSuspiciousProcesses();
    if (security.suspicious.length > 0) {
        suggestions.push({
            agent_id: 'antigravity_agent_v1',
            priority: 'high',
            category: 'security',
            title: 'Şüpheli Yüksek CPU Kullanan İşlem Tespit Edildi',
            description: `Tanımadığın ${security.suspicious.length} işlem yüksek CPU tüketiyor: ${security.suspicious.map(p => p.name).join(', ')}. Bu bir güvenlik tehdidi olabilir.`,
            analysis_context: {
                suspicious_processes: security.suspicious
            },
            suggested_actions: [
                { label: 'İşlemleri İncele', action_type: 'open_section', action_payload: 'processes' },
                { label: 'Güvenlik Taraması', action_type: 'background_process', action_payload: 'security_scan' }
            ]
        });
    }

    // Önceliğe göre sırala
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return {
        timestamp: new Date().toISOString(),
        system: {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            uptime_hours: (os.uptime() / 3600).toFixed(1),
            ram: ram,
            disk: disk
        },
        suggestions
    };
}

module.exports = { runAgent };
