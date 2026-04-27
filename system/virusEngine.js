/**
 * SysGuard Virus Engine v1.0
 * Windows Defender'dan bağımsız, tamamen özel tarama motoru.
 *
 * Tespit Yöntemleri:
 *   1. Hash tabanlı  — SHA-256 hashini bilinen zararlı hash listesiyle karşılaştır
 *   2. İmza tarama   — Dosya içinde bilinen zararlı byte/string pattern'leri ara
 *   3. Heuristik     — Entropi, çift uzantı, tehlikeli lokasyon, PE başlığı
 *   4. Süreç analizi — Çalışan süreçlerin yol ve özelliklerinden risk puanı üret
 */

'use strict';

const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const { execSync } = require('child_process');

// ─── Bilinen Zararlı SHA-256 Hashleri ────────────────────────────────────────
// Gerçek dünyada bu liste indirilebilir bir veritabanına (MalwareBazaar vb.)
// bağlanır. Şimdilik EICAR ve örnek test hashleri gömülü.
const KNOWN_MALWARE_HASHES = new Set([
    // EICAR Standard Antivirus Test File
    '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f',
    // EICAR (ikinci varyant)
    '2546dcffc5ad854d4ddc64fbf056871cd5a00f2471cb7a5bfd4ac23b6e9eedad',
    // Örnek tehdit hashleri (demo amaçlı)
    'd41d8cd98f00b204e9800998ecf8427e', // MD5 boş dosya — test senaryosu
]);

// ─── İmza Veritabanı ──────────────────────────────────────────────────────────
// Her kayıt: { id, pattern (string, case-insensitive aranır), name, category, severity }
// severity: 'critical' | 'high' | 'medium' | 'low'
const SIGNATURES = [
    // ── EICAR test ──────────────────────────────────────────────────────────
    { id: 'EICAR-001', pattern: 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE',
      name: 'EICAR.TestFile',          category: 'Test Dosyası',     severity: 'low'      },

    // ── Fidye Yazılımı ───────────────────────────────────────────────────────
    { id: 'RAN-001', pattern: 'your files have been encrypted',
      name: 'Ransomware.Generic',      category: 'Fidye Yazılımı',   severity: 'critical' },
    { id: 'RAN-002', pattern: 'pay the ransom',
      name: 'Ransomware.DemandNote',   category: 'Fidye Yazılımı',   severity: 'critical' },
    { id: 'RAN-003', pattern: 'bitcoin wallet',
      name: 'Ransomware.BitcoinReq',   category: 'Fidye Yazılımı',   severity: 'high'     },
    { id: 'RAN-004', pattern: '.onion',
      name: 'Ransomware.TorLink',      category: 'Fidye Yazılımı',   severity: 'high'     },

    // ── Backdoor / RAT ───────────────────────────────────────────────────────
    { id: 'BAK-001', pattern: 'cmd.exe /c powershell -encodedcommand',
      name: 'Backdoor.EncodedPS',      category: 'Backdoor',         severity: 'high'     },
    { id: 'BAK-002', pattern: 'net user /add',
      name: 'Backdoor.UserAdd',        category: 'Backdoor',         severity: 'high'     },
    { id: 'BAK-003', pattern: 'netsh advfirewall firewall add rule',
      name: 'Backdoor.FirewallBypass', category: 'Backdoor',         severity: 'high'     },
    { id: 'BAK-004', pattern: 'reverse_tcp',
      name: 'Backdoor.ReverseTCP',     category: 'Backdoor',         severity: 'critical' },
    { id: 'BAK-005', pattern: 'meterpreter',
      name: 'Backdoor.Meterpreter',    category: 'Backdoor',         severity: 'critical' },
    { id: 'BAK-006', pattern: 'nc.exe -e cmd',
      name: 'Backdoor.NetcatShell',    category: 'Backdoor',         severity: 'critical' },

    // ── Kod Enjeksiyonu ──────────────────────────────────────────────────────
    { id: 'INJ-001', pattern: 'createremotethread',
      name: 'Inject.RemoteThread',     category: 'Kod Enjeksiyonu',  severity: 'high'     },
    { id: 'INJ-002', pattern: 'virtualallocex',
      name: 'Inject.VirtualAlloc',     category: 'Kod Enjeksiyonu',  severity: 'medium'   },
    { id: 'INJ-003', pattern: 'writeprocessmemory',
      name: 'Inject.WriteMemory',      category: 'Kod Enjeksiyonu',  severity: 'medium'   },
    { id: 'INJ-004', pattern: 'ntcreatethread',
      name: 'Inject.NtThread',         category: 'Kod Enjeksiyonu',  severity: 'high'     },

    // ── Keylogger ────────────────────────────────────────────────────────────
    { id: 'KEY-001', pattern: 'getasynckeystate',
      name: 'Keylogger.AsyncKey',      category: 'Keylogger',        severity: 'high'     },
    { id: 'KEY-002', pattern: 'setwindowshookex',
      name: 'Keylogger.HookBased',     category: 'Keylogger',        severity: 'high'     },
    { id: 'KEY-003', pattern: 'getforegroundwindow',
      name: 'Keylogger.WindowSpy',     category: 'Keylogger',        severity: 'medium'   },

    // ── Kripto Madenci ───────────────────────────────────────────────────────
    { id: 'MIN-001', pattern: 'stratum+tcp://',
      name: 'Miner.StratumPool',       category: 'Kripto Madenci',   severity: 'high'     },
    { id: 'MIN-002', pattern: 'xmrig',
      name: 'Miner.XMRig',             category: 'Kripto Madenci',   severity: 'high'     },
    { id: 'MIN-003', pattern: '--mining-threads',
      name: 'Miner.ThreadConfig',      category: 'Kripto Madenci',   severity: 'medium'   },
    { id: 'MIN-004', pattern: 'cryptonight',
      name: 'Miner.CryptoNight',       category: 'Kripto Madenci',   severity: 'medium'   },

    // ── İndirici / Dropper ───────────────────────────────────────────────────
    { id: 'DRP-001', pattern: 'invoke-webrequest',
      name: 'Dropper.PSDownload',      category: 'İndirici',         severity: 'medium'   },
    { id: 'DRP-002', pattern: 'downloadstring(',
      name: 'Dropper.WebClient',       category: 'İndirici',         severity: 'medium'   },
    { id: 'DRP-003', pattern: 'bitsadmin /transfer',
      name: 'Dropper.BITS',            category: 'İndirici',         severity: 'medium'   },
    { id: 'DRP-004', pattern: 'shell.run(',
      name: 'Dropper.VBSRun',          category: 'İndirici',         severity: 'high'     },
    { id: 'DRP-005', pattern: 'wscript.shell',
      name: 'Dropper.WScript',         category: 'İndirici',         severity: 'medium'   },

    // ── Gizleme / Obfuscation ────────────────────────────────────────────────
    { id: 'OBF-001', pattern: 'fromcharcode',
      name: 'Obfusc.JSCharCode',       category: 'Gizleme',          severity: 'low'      },
    { id: 'OBF-002', pattern: 'eval(base64_decode',
      name: 'Obfusc.Base64Eval',       category: 'Gizleme',          severity: 'medium'   },
    { id: 'OBF-003', pattern: '[system.convert]::frombase64string',
      name: 'Obfusc.PSBase64',         category: 'Gizleme',          severity: 'medium'   },
    { id: 'OBF-004', pattern: '-encodedcommand',
      name: 'Obfusc.PSEncoded',        category: 'Gizleme',          severity: 'medium'   },

    // ── Kalıcılık (Persistence) ──────────────────────────────────────────────
    { id: 'PER-001', pattern: 'currentversion\\run',
      name: 'Persist.RegRun',          category: 'Kalıcılık',        severity: 'medium'   },
    { id: 'PER-002', pattern: 'schtasks /create',
      name: 'Persist.SchedTask',       category: 'Kalıcılık',        severity: 'medium'   },
    { id: 'PER-003', pattern: 'startup\\',
      name: 'Persist.StartupFolder',   category: 'Kalıcılık',        severity: 'low'      },

    // ── Privilege Escalation ─────────────────────────────────────────────────
    { id: 'PRV-001', pattern: 'bypassuac',
      name: 'Privesc.UACBypass',       category: 'Yetki Yükseltme',  severity: 'critical' },
    { id: 'PRV-002', pattern: 'sedebuggingprivilege',
      name: 'Privesc.DebugPriv',       category: 'Yetki Yükseltme',  severity: 'high'     },
    { id: 'PRV-003', pattern: 'adjusttokenprivileges',
      name: 'Privesc.TokenPriv',       category: 'Yetki Yükseltme',  severity: 'medium'   },
];

// ─── Riskli Uzantılar ─────────────────────────────────────────────────────────
const RISKY_EXTS = new Set([
    '.exe', '.dll', '.bat', '.cmd', '.ps1', '.vbs', '.vbe',
    '.js', '.jse', '.hta', '.scr', '.pif', '.com', '.wsf', '.wsh',
    '.msi', '.jar', '.lnk',
]);

// ─── Güvenli Lokasyonlar (heuristik için) ────────────────────────────────────
const SAFE_LOCATIONS = [
    'c:\\windows\\system32',
    'c:\\windows\\syswow64',
    'c:\\windows\\winsxs',
    'c:\\program files',
    'c:\\program files (x86)',
];

// ─── Bilinen Güvenli Süreçler (süreç analizinde beyaz liste) ─────────────────
const KNOWN_SAFE_PROCESSES = new Set([
    'chrome', 'firefox', 'msedge', 'opera', 'brave',
    'discord', 'slack', 'teams', 'zoom', 'skype', 'telegram', 'whatsapp',
    'spotify', 'steam', 'epicgameslauncher',
    'code', 'rider', 'idea64', 'pycharm64', 'webstorm64', 'clion64',
    'node', 'electron',
    'explorer', 'taskmgr', 'cmd', 'powershell', 'pwsh',
    'svchost', 'lsass', 'winlogon', 'csrss', 'wininit',
    'nvcontainer', 'nvdisplay.container', 'nvspcaps64',
    'amdow', 'igfxem', 'igfxtray',
    'onedrive', 'dropbox', 'googledrivefs',
    'antimalware service executable', 'msmpeng',
]);

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

/** Dosyadan SHA-256 hash ve raw buffer döndür. Başarısızsa null. */
function readFileForScan(filePath) {
    try {
        const buf  = fs.readFileSync(filePath);
        const hash = crypto.createHash('sha256').update(buf).digest('hex');
        return { hash, buf };
    } catch (_) {
        return null;
    }
}

/** Shannon entropi hesapla (0–8 arası, >7.2 şüpheli) */
function calcEntropy(buf) {
    const freq = new Uint32Array(256);
    for (let i = 0; i < buf.length; i++) freq[buf[i]]++;
    let h = 0;
    const n = buf.length;
    for (let i = 0; i < 256; i++) {
        if (freq[i] === 0) continue;
        const p = freq[i] / n;
        h -= p * Math.log2(p);
    }
    return h;
}

/** MZ başlığı kontrolü (Windows PE dosyası) */
function isPE(buf) {
    return buf.length >= 2 && buf[0] === 0x4D && buf[1] === 0x5A;
}

/** En yüksek severity'yi seç */
function maxSeverity(threats) {
    const order = ['critical', 'high', 'medium', 'low'];
    for (const s of order) {
        if (threats.some(t => t.severity === s)) return s;
    }
    return 'low';
}

// ─── Tek Dosya Analiz ─────────────────────────────────────────────────────────
/**
 * Bir dosyayı hash + imza + heuristik ile analiz eder.
 * Temizse null, tehdit varsa { path, hash, size, ext, threats, maxSeverity } döner.
 */
function analyzeFile(filePath) {
    let stat;
    try { stat = fs.statSync(filePath); } catch (_) { return null; }
    if (!stat.isFile() || stat.size === 0) return null;

    const ext = path.extname(filePath).toLowerCase();
    // Büyük dosyaları (>20MB) sadece hash ile kontrol et, pattern için atla
    const skipPattern = stat.size > 20 * 1024 * 1024;
    // 50MB üstünü tamamen atla
    if (stat.size > 50 * 1024 * 1024) return null;

    const raw = readFileForScan(filePath);
    if (!raw) return null;

    const { hash, buf } = raw;
    const threats = [];

    // 1. Hash tabanlı tespit
    if (KNOWN_MALWARE_HASHES.has(hash)) {
        threats.push({
            type: 'hash',
            id:   'HASH-MATCH',
            name: 'KnownMalware.HashMatch',
            category: 'Bilinen Zararlı',
            severity: 'critical',
            detail: `SHA-256 eşleşmesi: ${hash.substring(0, 16)}…`,
        });
    }

    // 2. İmza/Pattern taraması (ilk 2MB)
    if (!skipPattern) {
        const slice   = buf.slice(0, 2 * 1024 * 1024);
        const content = slice.toString('latin1').toLowerCase();

        for (const sig of SIGNATURES) {
            if (content.includes(sig.pattern.toLowerCase())) {
                threats.push({
                    type:     'signature',
                    id:       sig.id,
                    name:     sig.name,
                    category: sig.category,
                    severity: sig.severity,
                    detail:   `İmza [${sig.id}] eşleşmesi — ${sig.name}`,
                });
            }
        }
    }

    // 3. Heuristik analiz (sadece riskli uzantılar veya küçük dosyalar)
    if (RISKY_EXTS.has(ext)) {
        // 3a. Entropi (ilk 512KB üzerinden)
        const entropyBuf = buf.slice(0, 512 * 1024);
        const entropy    = calcEntropy(entropyBuf);
        const inSafeLoc  = SAFE_LOCATIONS.some(
            loc => filePath.toLowerCase().startsWith(loc)
        );

        if (entropy > 7.2 && !inSafeLoc) {
            threats.push({
                type:     'heuristic',
                id:       'HEUR-ENTROPY',
                name:     'Heuristic.HighEntropy',
                category: 'Şüpheli Dosya',
                severity: 'medium',
                detail:   `Yüksek entropi (${entropy.toFixed(2)}/8.0) — Paketlenmiş veya şifrelenmiş`,
            });
        }

        // 3b. Temp klasöründe PE dosyası
        if (isPE(buf)) {
            const fp = filePath.toLowerCase();
            if (
                fp.includes('\\temp\\') ||
                fp.includes('\\tmp\\') ||
                fp.includes('\\appdata\\local\\temp')
            ) {
                threats.push({
                    type:     'heuristic',
                    id:       'HEUR-EXE-TEMP',
                    name:     'Heuristic.ExeInTemp',
                    category: 'Şüpheli Lokasyon',
                    severity: 'high',
                    detail:   'Geçici dizinde çalıştırılabilir (PE) dosya tespit edildi',
                });
            }
        }

        // 3c. Çift uzantı (örn: fatura.pdf.exe, foto.jpg.scr)
        const baseName  = path.basename(filePath, ext);
        const fakeExts  = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.mp4', '.txt', '.zip', '.rar'];
        const hasFakeExt = fakeExts.some(fe => baseName.toLowerCase().endsWith(fe));
        if (hasFakeExt) {
            threats.push({
                type:     'heuristic',
                id:       'HEUR-DBL-EXT',
                name:     'Heuristic.DoubleExtension',
                category: 'Yanıltıcı Dosya',
                severity: 'high',
                detail:   `Çift uzantı tespit edildi: ${path.basename(filePath)}`,
            });
        }

        // 3d. AppData/Roaming'de bilinmeyen PE
        if (isPE(buf)) {
            const fp = filePath.toLowerCase();
            if (fp.includes('\\appdata\\roaming\\') && !fp.includes('\\microsoft\\')) {
                if (!inSafeLoc) {
                    threats.push({
                        type:     'heuristic',
                        id:       'HEUR-APPDATA',
                        name:     'Heuristic.ExeInAppData',
                        category: 'Şüpheli Lokasyon',
                        severity: 'medium',
                        detail:   'AppData/Roaming altında bilinmeyen çalıştırılabilir dosya',
                    });
                }
            }
        }
    }

    if (threats.length === 0) return null;

    return {
        path:        filePath,
        hash,
        size:        stat.size,
        ext,
        threats,
        maxSeverity: maxSeverity(threats),
        threatCount: threats.length,
    };
}

// ─── Dizin Taraması ───────────────────────────────────────────────────────────
/**
 * Bir dizini özyinelemeli tarar, bulunan tehditleri döndürür.
 * maxDepth ile derinlik sınırlanır. scanLimit toplamda taranan dosya sayısını kısar.
 */
function scanDirectory(dirPath, opts = {}) {
    const { maxDepth = 3, scanLimit = 3000 } = opts;
    const results  = [];
    const counter  = { scanned: 0 };

    function walk(dir, depth) {
        if (depth > maxDepth || counter.scanned >= scanLimit) return;
        let entries;
        try { entries = fs.readdirSync(dir); } catch (_) { return; }

        for (const entry of entries) {
            if (counter.scanned >= scanLimit) break;
            const full = path.join(dir, entry);
            let st;
            try { st = fs.statSync(full); } catch (_) { continue; }

            if (st.isDirectory()) {
                walk(full, depth + 1);
            } else if (st.isFile()) {
                const ext = path.extname(entry).toLowerCase();
                // Riskli uzantılar + küçük dosyalar taranır
                if (RISKY_EXTS.has(ext) || st.size < 1024 * 1024) {
                    counter.scanned++;
                    const hit = analyzeFile(full);
                    if (hit) results.push(hit);
                }
            }
        }
    }

    walk(dirPath, 0);
    return { hits: results, scanned: counter.scanned };
}

// ─── Tarama Dizinleri ─────────────────────────────────────────────────────────
function getScanTargets() {
    const dirs = [
        os.tmpdir(),
        process.env.TEMP,
        process.env.TMP,
        process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Temp') : null,
        process.env.APPDATA      ? path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup') : null,
        path.join(os.homedir(), 'Downloads'),
        'C:\\Windows\\Temp',
    ];

    // Tekrarları temizle ve var olanları döndür
    const unique = [...new Set(dirs.filter(Boolean).map(d => d.toLowerCase()))];
    return unique.filter(d => {
        try { return fs.statSync(d).isDirectory(); } catch (_) { return false; }
    });
}

// ─── Süreç Analizi ────────────────────────────────────────────────────────────
/**
 * Çalışan süreçleri PowerShell ile çeker ve şüpheli olanları işaretler.
 */
function analyzeProcesses() {
    const suspicious = [];

    let procs = [];
    try {
        const raw = execSync(
            'powershell -NoProfile -NonInteractive -Command ' +
            '"Get-Process | Select-Object Id,Name,Path | ConvertTo-Json -Depth 2"',
            { encoding: 'utf8', timeout: 10000, windowsHide: true }
        ).trim();
        const parsed = JSON.parse(raw);
        procs = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    } catch (_) {
        return suspicious;
    }

    for (const p of procs) {
        const procPath = (p.Path || '').toLowerCase();
        const procName = (p.Name || '').toLowerCase();
        if (!procPath) continue;

        // Beyaz liste kontrolü
        if (KNOWN_SAFE_PROCESSES.has(procName)) continue;

        const risks = [];

        // Temp'ten çalışıyor
        if (procPath.includes('\\temp\\') || procPath.includes('\\tmp\\')) {
            risks.push({ reason: 'Geçici (Temp) dizininden çalışıyor', severity: 'high' });
        }

        // AppData/Roaming'den bilinmeyen .exe
        if (procPath.includes('\\appdata\\roaming\\') && procPath.endsWith('.exe')) {
            const isKnown = ['discord', 'slack', 'teams', 'spotify', 'telegram',
                             'whatsapp', 'zoom', 'signal', 'notion'].some(k => procPath.includes(k));
            if (!isKnown) {
                risks.push({ reason: 'AppData/Roaming\'dan bilinmeyen süreç', severity: 'medium' });
            }
        }

        // Çift uzantılı süreç adı
        const fakes = ['.doc', '.pdf', '.jpg', '.txt', '.png'];
        const nameWithoutExe = procName.replace(/\.exe$/, '');
        if (fakes.some(fe => nameWithoutExe.endsWith(fe))) {
            risks.push({ reason: 'Yanıltıcı süreç adı (çift uzantı)', severity: 'high' });
        }

        if (risks.length === 0) continue;

        const sev = ['high', 'medium', 'low'].find(s => risks.some(r => r.severity === s)) || 'low';
        suspicious.push({
            pid:         p.Id,
            name:        p.Name || 'Bilinmiyor',
            path:        p.Path || '—',
            risks,
            maxSeverity: sev,
        });
    }

    return suspicious;
}

// ─── ANA TARAMA FONKSİYONU ────────────────────────────────────────────────────
/**
 * Tam motor taraması yapar.
 * @param {function} progressCallback - ({ phase, percent, detail }) çağrılır
 * @returns {Promise<ScanResult>}
 */
async function runEngineScan(progressCallback) {
    const t0 = Date.now();
    const emit = (phase, percent, detail) => {
        if (progressCallback) progressCallback({ phase, percent, detail });
    };

    emit('init', 3, 'Tarama dizinleri belirleniyor…');

    const targets     = getScanTargets();
    const infectedFiles = [];
    let   totalScanned  = 0;

    emit('scanning', 8, `${targets.length} dizin taranacak`);

    for (let i = 0; i < targets.length; i++) {
        const dir = targets[i];
        const pct = 10 + Math.round(((i + 1) / targets.length) * 60);
        emit('scanning', pct, `Taranıyor: …\\${path.basename(dir)}`);

        const { hits, scanned } = scanDirectory(dir, { maxDepth: 3, scanLimit: 2000 });
        infectedFiles.push(...hits);
        totalScanned += scanned;

        // Electron'un UI'ını bloke etmemek için kısa bir yield
        await new Promise(r => setImmediate(r));
    }

    emit('processes', 75, 'Çalışan süreçler analiz ediliyor…');
    await new Promise(r => setImmediate(r));

    const suspiciousProcesses = analyzeProcesses();

    emit('done', 100, 'Tarama tamamlandı');

    const criticalCount = infectedFiles.filter(f => f.maxSeverity === 'critical').length;
    const highCount     = infectedFiles.filter(f => f.maxSeverity === 'high').length;

    return {
        engine:              'SysGuard Engine v1.0',
        scanTime:            new Date().toISOString(),
        elapsed:             Date.now() - t0,
        scannedDirs:         targets,
        totalScanned,
        infectedFiles,
        suspiciousProcesses,
        threatCount:         infectedFiles.length,
        criticalCount,
        highCount,
        processRiskCount:    suspiciousProcesses.length,
        status:
            infectedFiles.length === 0 && suspiciousProcesses.length === 0
                ? 'clean'
                : 'threats_found',
    };
}

// ─── Karantina ────────────────────────────────────────────────────────────────
/**
 * Dosyayı karantinaya taşır (.quarantine uzantısı ekler).
 * Geri alma için orijinal yolu metadata dosyasına kaydeder.
 */
function quarantineFile(filePath) {
    try {
        const qDir = path.join(os.homedir(), '.sysguard', 'quarantine');
        if (!fs.existsSync(qDir)) fs.mkdirSync(qDir, { recursive: true });

        const stamp    = Date.now();
        const baseName = path.basename(filePath);
        const dest     = path.join(qDir, `${baseName}.${stamp}.quarantine`);
        const metaPath = dest + '.meta.json';

        fs.renameSync(filePath, dest);
        fs.writeFileSync(metaPath, JSON.stringify({
            original:     filePath,
            quarantined:  dest,
            timestamp:    new Date().toISOString(),
        }, null, 2), 'utf8');

        return { success: true, quarantinedTo: dest, original: filePath };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ─── Dosya Sil ────────────────────────────────────────────────────────────────
function deleteFile(filePath) {
    try {
        fs.unlinkSync(filePath);
        return { success: true, deleted: filePath };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// ─── Süreç Sonlandır ─────────────────────────────────────────────────────────
function killProcess(pid) {
    try {
        execSync(`taskkill /F /PID ${pid}`, { windowsHide: true, timeout: 5000 });
        return { success: true, pid };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

module.exports = {
    runEngineScan,
    analyzeFile,
    quarantineFile,
    deleteFile,
    killProcess,
};
