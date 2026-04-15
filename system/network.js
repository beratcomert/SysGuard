/**
 * NetGuard — Siber Güvenlik ve Ağ Trafiği Monitörü (Modül 1)
 *
 * scanNetwork() → PowerShell ile TCP/UDP bağlantılarını tarar,
 *                 şüpheli portları ve yüksek veri tüketen işlemleri tespit eder.
 */

const { execSync } = require('child_process');

// Bilinen güvenli sistem işlemleri
const SAFE_PROCS = new Set([
    'svchost', 'system', 'chrome', 'msedge', 'firefox', 'opera',
    'explorer', 'electron', 'node', 'powershell', 'csrss', 'smss',
    'lsass', 'winlogon', 'services', 'wininit', 'dwm', 'taskhostw',
    'onedrive', 'dropbox', 'teams', 'slack', 'zoom', 'discord',
    'searchhost', 'sihost', 'ctfmon', 'spoolsv', 'audiodg',
    'nvcontainer', 'nvdisplay', 'igfxem', 'amdow', 'steam',
]);

// Bilinen güvenli portlar (servis adıyla)
const SAFE_PORTS = {
    80: 'HTTP', 443: 'HTTPS', 53: 'DNS', 67: 'DHCP', 68: 'DHCP',
    123: 'NTP', 5353: 'mDNS', 137: 'NetBIOS', 138: 'NetBIOS',
    139: 'NetBIOS', 445: 'SMB', 3389: 'RDP', 22: 'SSH',
    25: 'SMTP', 587: 'SMTP', 993: 'IMAPS', 995: 'POP3S',
    1900: 'SSDP', 5355: 'LLMNR', 8080: 'HTTP-Alt',
};

// Yüksek riskli portlar
const HIGH_RISK_PORTS = new Set([
    4444, 1337, 31337, 12345, 6666, 6667, 6668, 9999, 8888,
    27374, 2049, 3306, 5432, 1433, 27017, 6379, 11211,
]);

function runPS(cmd) {
    try {
        return execSync(
            `powershell -NoProfile -NonInteractive -Command "${cmd}"`,
            { encoding: 'utf8', timeout: 10000, windowsHide: true }
        ).trim();
    } catch (_) {
        return null;
    }
}

/**
 * Aktif TCP/UDP bağlantılarını PowerShell ile tara
 */
function getNetConnections() {
    const connections = [];
    try {
        // netstat çıktısından bağlantıları al
        const raw = runPS(
            `Get-NetTCPConnection -State Established,Listen | ` +
            `Select-Object LocalPort,RemoteAddress,RemotePort,State,OwningProcess | ` +
            `ConvertTo-Json -Compress`
        );
        if (!raw) return connections;
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        return arr.filter(Boolean).map(c => ({
            localPort: c.LocalPort,
            remoteAddr: c.RemoteAddress || '',
            remotePort: c.RemotePort || 0,
            state: c.State,
            pid: c.OwningProcess,
        }));
    } catch (_) {
        return connections;
    }
}

/**
 * PID → İşlem adı eşlemesi
 */
function getPidToProcessMap() {
    const map = {};
    try {
        const raw = runPS(
            `Get-Process | Select-Object Id,ProcessName | ConvertTo-Json -Compress`
        );
        if (!raw) return map;
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        arr.forEach(p => { if (p?.Id) map[p.Id] = (p.ProcessName || 'unknown').toLowerCase(); });
    } catch (_) {}
    return map;
}

/**
 * Dışarıya giden veri (NetAdapterStatistics ile)
 */
function getNetworkUsage() {
    try {
        const raw = runPS(
            `Get-NetAdapterStatistics | Where-Object {$_.ReceivedBytes -gt 0} | ` +
            `Select-Object Name,SentBytes,ReceivedBytes | ConvertTo-Json -Compress`
        );
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        let totalSent = 0, totalReceived = 0;
        arr.forEach(a => {
            totalSent     += (a.SentBytes     || 0);
            totalReceived += (a.ReceivedBytes  || 0);
        });
        return { totalSentMB: (totalSent / 1024 / 1024).toFixed(1), totalReceivedMB: (totalReceived / 1024 / 1024).toFixed(1) };
    } catch (_) {
        return null;
    }
}

/**
 * Ana Tarama Fonksiyonu
 */
function scanNetwork() {
    const connections = getNetConnections();
    const pidMap      = getPidToProcessMap();
    const netUsage    = getNetworkUsage();

    const alerts      = [];
    const suspicious  = [];
    const portMap     = {};   // port → [process names]

    for (const conn of connections) {
        const procName = pidMap[conn.pid] || 'unknown';
        const port     = conn.localPort;

        // Port → proses haritası
        if (!portMap[port]) portMap[port] = new Set();
        portMap[port].add(procName);

        // "İsimsiz" veya bilinmeyen işlem kontrolü
        const isKnownSafe = SAFE_PROCS.has(procName) || procName === 'unknown';
        const isHighRisk  = HIGH_RISK_PORTS.has(port);
        const isOutbound  = conn.remoteAddr && conn.remoteAddr !== '0.0.0.0' && conn.remoteAddr !== '::';
        const isPublicIP  = isOutbound && !isPrivateIP(conn.remoteAddr);

        if (isHighRisk) {
            alerts.push({
                level: 'critical',
                type: 'high_risk_port',
                port,
                process: procName,
                remote: conn.remoteAddr,
                message: `Yüksek riskli port ${port} açık — ${humanReadableProcess(procName)} arka planda bağlantı kuruyor.`,
                action: `Bu bağlantıyı kesmek ister misin? (${procName} → Port ${port})`,
                pid: conn.pid,
            });
        } else if (!isKnownSafe && isOutbound && isPublicIP) {
            suspicious.push({
                level: 'warning',
                type: 'unnamed_outbound',
                port,
                process: procName,
                remote: conn.remoteAddr,
                remotePort: conn.remotePort,
                message: `"${humanReadableProcess(procName)}" adlı bilinmeyen bir arka plan hizmeti dışarıya veri gönderiyor.`,
                action: `Bu arka plan bağlantısını geçici olarak kesmek ister misin?`,
                pid: conn.pid,
            });
        }
    }

    // Anormal veri sızıntısı tespiti (basit eşik: 500MB+ gönderim)
    let dataLeakAlert = null;
    if (netUsage) {
        const sentMB = parseFloat(netUsage.totalSentMB || 0);
        if (sentMB > 500) {
            dataLeakAlert = {
                level: 'critical',
                type: 'data_leak',
                sentMB,
                message: `Anormal Veri Sızıntısı tespit edildi! Sistem bu oturumda ${sentMB} MB dışarıya gönderdi.`,
                action: 'Ağ bağlantılarını incelemek ister misin?',
            };
        }
    }

    // Açık portların insan-dostu özeti
    const openPortsSummary = Object.entries(portMap)
        .filter(([port]) => !SAFE_PORTS[parseInt(port)])
        .slice(0, 10)
        .map(([port, procs]) => ({
            port: parseInt(port),
            processes: [...procs],
            isRisky: HIGH_RISK_PORTS.has(parseInt(port)),
            humanLabel: SAFE_PORTS[parseInt(port)] || `Bilinmeyen Port ${port}`,
        }));

    return {
        scanTime: new Date().toISOString(),
        totalConnections: connections.length,
        alerts,
        suspicious: suspicious.slice(0, 5),
        dataLeakAlert,
        openPortsSummary,
        netUsage,
    };
}

/**
 * Belirli bir PID'yi sonlandır (process kill)
 */
function killProcessByPid(pid) {
    try {
        runPS(`Stop-Process -Id ${parseInt(pid)} -Force`);
        return { success: true, pid };
    } catch (_) {
        return { success: false, pid };
    }
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function isPrivateIP(ip) {
    if (!ip) return true;
    return (
        ip.startsWith('10.')    ||
        ip.startsWith('192.168.') ||
        ip.startsWith('172.16.') || ip.startsWith('172.17.') ||
        ip.startsWith('127.')   ||
        ip === '::1'            ||
        ip === 'localhost'
    );
}

function humanReadableProcess(name) {
    const friendly = {
        chrome: 'Google Chrome', msedge: 'Microsoft Edge', firefox: 'Firefox',
        svchost: 'Windows Sistem Servisi', explorer: 'Windows Gezgini',
        unknown: 'Bilinmeyen Uygulama',
    };
    return friendly[name] || name.charAt(0).toUpperCase() + name.slice(1);
}

module.exports = { scanNetwork, killProcessByPid };
