const { spawn, execSync } = require('child_process');
const fs = require('fs');

const DEFENDER_PATH = 'C:\\Program Files\\Windows Defender\\MpCmdRun.exe';

const SEVERITY = { 0: 'Bilinmiyor', 1: 'Düşük', 2: 'Orta', 4: 'Yüksek', 5: 'Kritik' };
const CATEGORY = {
    0: 'Geçersiz', 1: 'Adware', 2: 'Spyware', 3: 'Parola Çalıcı', 5: 'Virus', 6: 'Backdoor',
    8: 'Truva Atı', 11: 'Worm', 19: 'Fidye Yazılımı', 27: 'Potansiyel Tehdit'
};

function runPS(cmd, timeout = 12000) {
    try {
        return execSync(
            `powershell -NoProfile -NonInteractive -Command "${cmd}"`,
            { encoding: 'utf8', timeout, windowsHide: true }
        ).trim();
    } catch (_) {
        return null;
    }
}

function getDefenderStatus() {
    const statusRaw = runPS(
        'Get-MpComputerStatus | Select-Object AntivirusEnabled,RealTimeProtectionEnabled,' +
        'AntivirusSignatureLastUpdated,LastQuickScanEndTime,LastFullScanEndTime,QuickScanAge | ConvertTo-Json'
    );

    let status = {};
    try { if (statusRaw) status = JSON.parse(statusRaw); } catch (_) {}

    const threatsRaw = runPS(
        '$t=Get-MpThreat -EA SilentlyContinue; if($t){$t|Select-Object ThreatID,ThreatName,' +
        'SeverityID,CategoryID,StatusID,Resources|ConvertTo-Json}else{"[]"}'
    );
    let threats = [];
    try {
        if (threatsRaw) {
            const p = JSON.parse(threatsRaw);
            threats = Array.isArray(p) ? p : p ? [p] : [];
        }
    } catch (_) {}

    const detRaw = runPS(
        '$d=Get-MpThreatDetection -EA SilentlyContinue|Select-Object -First 10;' +
        'if($d){$d|Select-Object ThreatName,DetectionTime,ActionSuccess,Resources|ConvertTo-Json}else{"[]"}'
    );
    let detections = [];
    try {
        if (detRaw) {
            const p = JSON.parse(detRaw);
            detections = Array.isArray(p) ? p : p ? [p] : [];
        }
    } catch (_) {}

    const mappedThreats = threats.map(t => ({
        id: t.ThreatID,
        name: t.ThreatName || 'Bilinmiyor',
        severity: SEVERITY[t.SeverityID] || 'Bilinmiyor',
        severityId: t.SeverityID || 0,
        category: CATEGORY[t.CategoryID] || 'Bilinmiyor',
        resources: t.Resources || []
    }));

    const mappedDetections = detections.map(d => ({
        name: d.ThreatName || 'Bilinmiyor',
        time: d.DetectionTime,
        success: d.ActionSuccess,
        resources: d.Resources || []
    }));

    return {
        enabled: status.AntivirusEnabled || false,
        realTimeProtection: status.RealTimeProtectionEnabled || false,
        signatureDate: status.AntivirusSignatureLastUpdated || null,
        lastQuickScan: status.LastQuickScanEndTime || null,
        lastFullScan: status.LastFullScanEndTime || null,
        quickScanAgeDays: status.QuickScanAge ?? null,
        threats: mappedThreats,
        detections: mappedDetections,
        threatCount: mappedThreats.length
    };
}

function runQuickScan(progressCallback) {
    return new Promise((resolve) => {
        const t0 = Date.now();

        if (!fs.existsSync(DEFENDER_PATH)) {
            if (progressCallback) progressCallback({ phase: 'checking', percent: 80 });
            const status = getDefenderStatus();
            if (progressCallback) progressCallback({ phase: 'done', percent: 100 });
            return resolve({ ...status, scanType: 'status_only', elapsed: Date.now() - t0 });
        }

        if (progressCallback) progressCallback({ phase: 'starting', percent: 5 });

        const proc = spawn(DEFENDER_PATH, ['-Scan', '-ScanType', '1'], { windowsHide: true });

        let pct = 5;
        const ticker = setInterval(() => {
            pct = Math.min(pct + 2, 88);
            if (progressCallback) progressCallback({ phase: 'scanning', percent: pct });
        }, 3000);

        proc.on('close', (code) => {
            clearInterval(ticker);
            if (progressCallback) progressCallback({ phase: 'collecting', percent: 95 });
            const status = getDefenderStatus();
            if (progressCallback) progressCallback({ phase: 'done', percent: 100 });
            resolve({ ...status, scanType: 'quick', exitCode: code, elapsed: Date.now() - t0 });
        });

        proc.on('error', () => {
            clearInterval(ticker);
            const status = getDefenderStatus();
            resolve({ ...status, scanType: 'quick', elapsed: Date.now() - t0 });
        });
    });
}

function cleanThreats() {
    runPS('Remove-MpThreat -EA SilentlyContinue', 20000);
    const status = getDefenderStatus();
    return {
        cleaned: true,
        remainingThreats: status.threatCount,
        threats: status.threats,
        detections: status.detections
    };
}

function getDefenderHistory() {
    const detRaw = runPS(
        '$d=Get-MpThreatDetection -EA SilentlyContinue|Select-Object -First 50;' +
        'if($d){$d|Select-Object ThreatID,ThreatName,DetectionTime,ActionTime,ActionSuccess,' +
        'CurrentThreatExecutionStatusID,Resources|ConvertTo-Json -Depth 3}else{"[]"}',
        25000
    );
    let detections = [];
    try {
        if (detRaw) {
            const p = JSON.parse(detRaw);
            detections = Array.isArray(p) ? p : p ? [p] : [];
        }
    } catch (_) {}

    const evRaw = runPS(
        'try{$ev=Get-WinEvent -LogName "Microsoft-Windows-Windows Defender/Operational"' +
        ' -MaxEvents 150 -EA SilentlyContinue|Where-Object{$_.Id -eq 1117}|Select-Object -First 40;' +
        'if($ev){$ev|ForEach-Object{[PSCustomObject]@{Time=$_.TimeCreated;' +
        'Msg=$_.Message.Substring(0,[Math]::Min($_.Message.Length,900))}}|ConvertTo-Json -Depth 2}' +
        'else{"[]"}}catch{"[]"}',
        20000
    );
    let events = [];
    try {
        if (evRaw) {
            const p = JSON.parse(evRaw);
            events = Array.isArray(p) ? p : p ? [p] : [];
        }
    } catch (_) {}

    const mapped = detections.map(d => {
        const res = d.Resources || [];
        const resources = (Array.isArray(res) ? res : [res]).filter(Boolean).slice(0, 5);
        return {
            id: d.ThreatID,
            name: d.ThreatName || 'Bilinmiyor',
            detectionTime: d.DetectionTime,
            actionTime: d.ActionTime,
            success: d.ActionSuccess,
            resources
        };
    });

    const parsedEvents = events.map(e => {
        const msg = e.Msg || '';
        const pick = (key) => { const m = msg.match(new RegExp(`${key}:\\s*(.+)`)); return m?.[1]?.trim() || null; };
        return {
            time: e.Time,
            name: pick('Name') || pick('Ad') || 'Bilinmiyor',
            path: pick('Path') || pick('Yol') || null,
            action: pick('Action') || pick('Eylem') || 'Bilinmiyor',
            severity: pick('Severity') || pick('Önem Derecesi') || null
        };
    });

    return { detections: mapped, events: parsedEvents };
}

module.exports = { getDefenderStatus, runQuickScan, cleanThreats, getDefenderHistory };
