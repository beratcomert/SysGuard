/**
 * Antigravity Agent — Sistem Analiz Motoru
 *
 * runQuickScan()  → Sadece Node.js OS modülü, ~50ms, anlık
 * runDeepScan()   → PowerShell sorguları, ~3-8s, kapsamlı
 */

const os   = require('os');
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Yardımcılar ──────────────────────────────────────────────────────────────
const toGB  = b => parseFloat((b / 1024 ** 3).toFixed(2));
const toGBs = b => `${toGB(b)} GB`;

/**
 * PowerShell komutunu güvenli çalıştır (timeout: 8s)
 * Hata olursa null döner.
 */
function runPS(cmd) {
    try {
        return execSync(
            `powershell -NoProfile -NonInteractive -Command "${cmd}"`,
            { encoding: 'utf8', timeout: 8000, windowsHide: true }
        ).trim();
    } catch (_) {
        return null;
    }
}

// ─── Hızlı Veri Toplama (sadece Node.js) ─────────────────────────────────────

function fastRam() {
    const total = os.totalmem();
    const free  = os.freemem();
    const used  = total - free;
    return {
        total, free, used,
        usagePercent: parseFloat(((used / total) * 100).toFixed(1))
    };
}

function fastDisk() {
    const drives = [];
    const letters = ['C', 'D', 'E', 'F', 'G'];

    for (const l of letters) {
        const drivePath = `${l}:\\`;
        try {
            // Node 18+ — statfsSync
            let total, free;
            if (typeof fs.statfsSync === 'function') {
                const stat = fs.statfsSync(drivePath);
                total = stat.blocks * stat.bsize;
                free  = stat.bfree  * stat.bsize;
            } else {
                // Fallback: PowerShell ile tek sürücü hızlıca sorgu
                const raw = runPS(`$d=Get-PSDrive -Name '${l}' -PSProvider FileSystem -EA SilentlyContinue; if($d){"{{\\"used\\":$($d.Used),\\"free\\":$($d.Free)}}"}`);
                if (!raw) continue;
                const parsed = JSON.parse(raw);
                total = (parsed.used || 0) + (parsed.free || 0);
                free  = parsed.free || 0;
            }
            const used = total - free;
            if (total > 0) {
                drives.push({
                    name: l,
                    total, free, used,
                    usagePercent: parseFloat(((used / total) * 100).toFixed(1))
                });
            }
        } catch (_) {
            // Sürücü yok veya erişilemiyor, atla
        }
    }
    return { drives };
}

function fastTempSize() {
    const tmpDir = os.tmpdir();
    let size = 0, count = 0;
    try {
        for (const f of fs.readdirSync(tmpDir)) {
            try { size += fs.statSync(path.join(tmpDir, f)).size; count++; } catch (_) {}
        }
    } catch (_) {}
    return { totalSize: size, fileCount: count, totalSizeGB: toGB(size) };
}

function fastDownloadsSize() {
    const dlPath = path.join(os.homedir(), 'Downloads');
    let size = 0, count = 0;
    try {
        for (const f of fs.readdirSync(dlPath)) {
            try { size += fs.statSync(path.join(dlPath, f)).size; count++; } catch (_) {}
        }
    } catch (_) {}
    return { totalSize: size, fileCount: count, totalSizeGB: toGB(size), path: dlPath };
}

function fastCpuInfo() {
    const cpus = os.cpus();
    return {
        model: cpus[0]?.model || 'Bilinmiyor',
        cores: cpus.length,
        // Windows'ta loadavg anlamlı değil; sadece mevzuat için
        loadAvg: os.loadavg()[0]
    };
}

// ─── Öneri Üretici — Hızlı ───────────────────────────────────────────────────
function buildQuickSuggestions(ram, disk, temp, downloads) {
    const s = [];

    // RAM
    if (ram.usagePercent > 85) {
        s.push({
            agent_id: 'antigravity_v1', priority: 'high', category: 'performance',
            title: 'RAM Kritik Seviyede',
            description: `RAM'in %${ram.usagePercent}'i dolu (${toGBs(ram.used)} / ${toGBs(ram.total)}). Uygulamalar yavaşlayabilir veya çökebilir.`,
            analysis_context: { ram_kullanim: `%${ram.usagePercent}`, bos: toGBs(ram.free) },
            suggested_actions: [
                { label: 'Sistem Sağlığını Gör', action_type: 'open_section', action_payload: 'health' }
            ]
        });
    } else if (ram.usagePercent > 70) {
        s.push({
            agent_id: 'antigravity_v1', priority: 'medium', category: 'performance',
            title: 'RAM Kullanımı Yüksek',
            description: `RAM'in %${ram.usagePercent}'i kullanımda. Ağır uygulamalar açıksa performans düşebilir.`,
            analysis_context: { ram_kullanim: `%${ram.usagePercent}`, bos: toGBs(ram.free) },
            suggested_actions: [
                { label: 'Sistem Sağlığını Gör', action_type: 'open_section', action_payload: 'health' }
            ]
        });
    }

    // Disk
    for (const d of disk.drives) {
        if (d.usagePercent > 90) {
            s.push({
                agent_id: 'antigravity_v1', priority: 'high', category: 'disk_space',
                title: `${d.name}: Diski Neredeyse Dolu`,
                description: `${d.name}: sürücüsü %${d.usagePercent} dolu, yalnızca ${toGBs(d.free)} boş alan kaldı.`,
                analysis_context: { doluluk: `%${d.usagePercent}`, bos: toGBs(d.free), toplam: toGBs(d.total) },
                suggested_actions: [
                    { label: 'Temp Temizle', action_type: 'background_process', action_payload: 'clean_temp' },
                    { label: 'Downloads Aç',  action_type: 'open_folder',        action_payload: 'downloads' }
                ]
            });
        } else if (d.usagePercent > 80) {
            s.push({
                agent_id: 'antigravity_v1', priority: 'medium', category: 'disk_space',
                title: `${d.name}: Disk Alanı Azalıyor`,
                description: `${d.name}: %${d.usagePercent} dolu. ${toGBs(d.free)} boş alan var.`,
                analysis_context: { doluluk: `%${d.usagePercent}`, bos: toGBs(d.free) },
                suggested_actions: [
                    { label: 'Temp Temizle', action_type: 'background_process', action_payload: 'clean_temp' }
                ]
            });
        }
    }

    // Temp
    if (temp.totalSizeGB > 0.5) {
        s.push({
            agent_id: 'antigravity_v1',
            priority: temp.totalSizeGB > 2 ? 'high' : 'low',
            category: 'disk_space',
            title: 'Geçici Dosyalar Yer Kaplıyor',
            description: `Temp klasöründe ${temp.fileCount} dosya, toplam ${temp.totalSizeGB} GB. Güvenle temizlenebilir.`,
            analysis_context: { boyut: `${temp.totalSizeGB} GB`, dosya_sayisi: temp.fileCount },
            suggested_actions: [
                { label: 'Hemen Temizle', action_type: 'background_process', action_payload: 'clean_temp' }
            ]
        });
    }

    // Downloads
    if (downloads.totalSizeGB > 1) {
        s.push({
            agent_id: 'antigravity_v1', priority: 'low', category: 'disk_space',
            title: 'İndirilenler Klasörü Büyük',
            description: `Downloads klasöründe ${downloads.fileCount} dosya, toplam ${downloads.totalSizeGB} GB yer kaplıyor.`,
            analysis_context: { boyut: `${downloads.totalSizeGB} GB`, dosya_sayisi: downloads.fileCount },
            suggested_actions: [
                { label: 'Klasörü Aç', action_type: 'open_folder', action_payload: 'downloads' }
            ]
        });
    }

    // Sırala: high → medium → low
    const order = { high: 0, medium: 1, low: 2 };
    return s.sort((a, b) => order[a.priority] - order[b.priority]);
}

// ─── Öneri Üretici — Detaylı (PS verileri dahil) ─────────────────────────────
function buildDeepSuggestions(quickSuggestions, psData) {
    const s = [...quickSuggestions];

    // Başlangıç uygulamaları
    if (psData.startupCount > 8) {
        s.push({
            agent_id: 'antigravity_v1', priority: 'medium', category: 'performance',
            title: 'Çok Fazla Başlangıç Uygulaması',
            description: `Bilgisayarın açılırken ${psData.startupCount} uygulama otomatik başlıyor. Bu açılış süresini ciddi şekilde uzatır.`,
            analysis_context: {
                baslangic_uygulama_sayisi: psData.startupCount,
                ornekler: psData.startupApps.slice(0, 4).join(', ')
            },
            suggested_actions: [
                { label: 'Başlangıç Yöneticisi', action_type: 'open_settings', action_payload: 'startup_apps' }
            ]
        });
    }

    // Şüpheli yüksek-CPU işlemleri
    if (psData.suspicious.length > 0) {
        s.push({
            agent_id: 'antigravity_v1', priority: 'high', category: 'security',
            title: 'Şüpheli Yüksek CPU İşlemi Tespit Edildi',
            description: `Tanımadığın ${psData.suspicious.length} işlem yüksek CPU kullanıyor: ${psData.suspicious.map(p => p.name).join(', ')}.`,
            analysis_context: {
                islem_sayisi: psData.suspicious.length,
                islemler: psData.suspicious.map(p => `${p.name} (${p.cpu.toFixed(0)}s)`).join(', ')
            },
            suggested_actions: [
                { label: 'Detayları Gör', action_type: 'open_section', action_payload: 'health' },
                { label: 'Güvenlik Ayarları', action_type: 'open_settings', action_payload: 'security' }
            ]
        });
    }

    // Sırala
    const order = { high: 0, medium: 1, low: 2 };
    return s.sort((a, b) => order[a.priority] - order[b.priority]);
}

// ─── PowerShell Veri Toplama (paralel) ───────────────────────────────────────
function collectPSData() {
    // Startup uygulamaları
    let startupCount = 0;
    let startupApps  = [];
    try {
        const raw = runPS("Get-CimInstance Win32_StartupCommand | Select-Object -ExpandProperty Name | ConvertTo-Json");
        if (raw) {
            const parsed = JSON.parse(raw);
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            startupApps  = arr.filter(Boolean);
            startupCount = startupApps.length;
        }
    } catch (_) {}

    // Şüpheli işlemler (CPU > 30s birikmeli kullanım, bilinen güvenli hariç)
    const SAFE = new Set(['svchost','system','chrome','msedge','firefox','explorer','electron','node','powershell','csrss','smss','lsass','winlogon','services','wininit','dwm','taskhostw','searchidle']);
    let suspicious = [];
    try {
        const raw = runPS("Get-Process | Where-Object { $_.CPU -gt 30 } | Select-Object ProcessName,CPU,Id | ConvertTo-Json");
        if (raw) {
            const parsed = JSON.parse(raw);
            const arr    = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
            suspicious   = arr
                .filter(p => p && !SAFE.has((p.ProcessName || '').toLowerCase()))
                .map(p => ({ name: p.ProcessName, cpu: parseFloat(p.CPU || 0), id: p.Id }));
        }
    } catch (_) {}

    // Top CPU işlemleri (dashboard için)
    let topProcesses = [];
    try {
        const raw = runPS("Get-Process | Sort-Object CPU -Descending | Select-Object -First 6 ProcessName,CPU | ConvertTo-Json");
        if (raw) {
            const parsed = JSON.parse(raw);
            const arr    = Array.isArray(parsed) ? parsed : [parsed];
            topProcesses = arr.map(p => ({ name: p.ProcessName, cpu: parseFloat((p.CPU || 0).toFixed(1)) }));
        }
    } catch (_) {}

    return { startupCount, startupApps, suspicious, topProcesses };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * HIZLI TARAMA — ~50-100ms
 * Sadece Node.js modülleri kullanır. Anlık sonuç verir.
 */
function runQuickScan() {
    const ram       = fastRam();
    const disk      = fastDisk();
    const temp      = fastTempSize();
    const downloads = fastDownloadsSize();
    const cpu       = fastCpuInfo();

    const suggestions = buildQuickSuggestions(ram, disk, temp, downloads);

    return {
        scanType: 'quick',
        timestamp: new Date().toISOString(),
        system: {
            hostname:      os.hostname(),
            platform:      os.platform(),
            arch:          os.arch(),
            uptime_hours:  parseFloat((os.uptime() / 3600).toFixed(1)),
            ram,
            disk,
            cpu
        },
        suggestions
    };
}

/**
 * DETAYLı TARAMA — ~3-10s
 * PowerShell ile derin analiz. İşlemler, başlangıç uygulamaları, güvenlik.
 */
function runDeepScan() {
    // Önce hızlı verileri al
    const ram       = fastRam();
    const disk      = fastDisk();
    const temp      = fastTempSize();
    const downloads = fastDownloadsSize();
    const cpu       = fastCpuInfo();

    const quickSuggestions = buildQuickSuggestions(ram, disk, temp, downloads);

    // PowerShell verilerini topla
    const psData = collectPSData();

    const suggestions = buildDeepSuggestions(quickSuggestions, psData);

    return {
        scanType: 'deep',
        timestamp: new Date().toISOString(),
        system: {
            hostname:      os.hostname(),
            platform:      os.platform(),
            arch:          os.arch(),
            uptime_hours:  parseFloat((os.uptime() / 3600).toFixed(1)),
            ram,
            disk,
            cpu,
            topProcesses:  psData.topProcesses,
            startupCount:  psData.startupCount
        },
        suggestions
    };
}

module.exports = { runQuickScan, runDeepScan };
