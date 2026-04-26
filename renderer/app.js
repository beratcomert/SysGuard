// ─── Durum ───────────────────────────────────────────────────────────────────
let lastScanData       = null;
let ecosystemState     = 'initializing'; // critical | medium | optimal
let ecoAnimFrame       = null;
let ecoParticles       = [];
let lastNetworkData    = null;
let chainRunning       = false;

// ─── IPC Dinleyiciler (Ana Süreçten Gelen Olaylar) ───────────────────────────
if (window.electronAPI?.onUiEvent) {
    window.electronAPI.onUiEvent((ev) => {
        if (ev?.type === 'ecosystem_restore') {
            triggerEcosystemRestore(ev.level);
        }
    });
}

if (window.electronAPI?.onChainStepProgress) {
    window.electronAPI.onChainStepProgress((step) => {
        updateChainStepUI(step);
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODÜL 2 — Ekosistem Durum Makinesi
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sistem sağlığına göre ekosistem durumunu güncelle
 * @param {number} healthScore - 0..100 (100 = mükemmel)
 */
function updateEcosystemState(healthScore) {
    const fill       = document.getElementById('eco-health-fill');
    const pct        = document.getElementById('eco-health-pct');
    const label      = document.getElementById('eco-state-label');
    const wrapper    = document.getElementById('eco-health-wrapper');
    const dot        = document.getElementById('eco-dot');
    const statusText = document.getElementById('eco-status-text');

    if (!fill) return;

    // Skor → durum eşleme
    let state, stateLabel, dotClass, statusMsg;
    if (healthScore < 40) {
        state      = 'critical';
        stateLabel = '⚠ Kritik — Sistem optimizasyon gerektiriyor';
        dotClass   = 'critical';
        statusMsg  = 'Sistem kritik durumda';
    } else if (healthScore < 75) {
        state      = 'medium';
        stateLabel = '◆ Orta Seviye — Bazı iyileştirmeler mevcut';
        dotClass   = 'medium';
        statusMsg  = 'Sistem iyileştirilebilir';
    } else {
        state      = 'optimal';
        stateLabel = '✦ Optimize — Dijital ekosistem sağlıklı';
        dotClass   = 'optimal';
        statusMsg  = 'Sistem nefes alıyor';
    }

    ecosystemState = state;

    // Yüzde barı güncelle
    fill.style.width = `${Math.min(healthScore, 100)}%`;
    fill.className   = 'ecosystem-health-fill' +
        (healthScore >= 75 ? ' optimal' : healthScore >= 40 ? ' good' : '');

    if (pct) pct.textContent = `%${Math.round(healthScore)}`;

    // Etiket ve wrapper durum sınıfı
    if (label) {
        label.textContent  = stateLabel;
        label.className    = `ecosystem-state-label state-${state}`;
    }
    if (wrapper) {
        wrapper.className = `ecosystem-health-bar-wrapper state-${state}`;
    }

    // Başlık çubuğu göstergesi
    if (dot)        { dot.className   = `eco-dot ${dotClass}`; }
    if (statusText) { statusText.textContent = statusMsg; }
}

/**
 * Sistem sağlık puanını tarama verisinden hesapla (0-100)
 */
function calcHealthScore(scanData) {
    if (!scanData?.system) return 50;
    const ram  = scanData.system.ram?.usagePercent || 50;
    const disk = scanData.system.disk?.drives?.find(d => d.name === 'C')?.usagePercent || 50;
    const high = (scanData.suggestions || []).filter(s => s.priority === 'high').length;
    const med  = (scanData.suggestions || []).filter(s => s.priority === 'medium').length;

    // Gerçekçi eğri: %40 RAM altı = tam puan, %100'de sıfır
    const ramScore  = Math.max(0, 100 - Math.max(0, ram  - 40) * (100 / 60));
    // Disk: %50 altı = tam puan, %100'de sıfır
    const diskScore = Math.max(0, 100 - Math.max(0, disk - 50) * (100 / 50));
    // Uyarılar: her yüksek -12, her orta -5
    const warnScore = Math.max(0, 100 - (high * 12) - (med * 5));

    return Math.round(ramScore * 0.45 + diskScore * 0.30 + warnScore * 0.25);
}

// ─── Canvas Parçacık Animasyonu ───────────────────────────────────────────────
function initEcoCanvas() {
    const canvas = document.getElementById('ecosystem-canvas');
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx     = canvas.getContext('2d');

    // Parçacık havuzu temizle
    ecoParticles = Array.from({ length: 80 }, () => createParticle(canvas));

    function loop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ecoParticles.forEach(p => {
            p.y  -= p.vy;
            p.x  += Math.sin(p.t) * 0.5;
            p.t  += 0.02;
            p.life -= 0.005;
            if (p.life <= 0) Object.assign(p, createParticle(canvas));

            ctx.save();
            ctx.globalAlpha = p.life * 0.8;
            ctx.fillStyle   = p.color;
            ctx.shadowBlur  = 12;
            ctx.shadowColor = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
        ecoAnimFrame = requestAnimationFrame(loop);
    }
    loop();
}

function createParticle(canvas) {
    const colors = ['#06b6d4', '#818cf8', '#34d399', '#a5f3fc', '#c7d2fe'];
    return {
        x:     Math.random() * canvas.width,
        y:     canvas.height + 10,
        vy:    0.5 + Math.random() * 2,
        r:     1 + Math.random() * 3,
        t:     Math.random() * Math.PI * 2,
        life:  0.3 + Math.random() * 0.7,
        color: colors[Math.floor(Math.random() * colors.length)],
    };
}

function stopEcoCanvas() {
    if (ecoAnimFrame) { cancelAnimationFrame(ecoAnimFrame); ecoAnimFrame = null; }
    ecoParticles = [];
}

/**
 * Ekosistem restorasyon overlay'ini göster
 * @param {Object} opts - { freedMB, closedPorts, subtitle }
 */
function triggerEcosystemRestore(levelOrOpts) {
    const overlay  = document.getElementById('ecosystem-overlay');
    const statsEl  = document.getElementById('ecosystem-stats');
    const subtitle = document.getElementById('ecosystem-subtitle');
    if (!overlay) return;

    // Seçenekleri çözümle
    const opts = (typeof levelOrOpts === 'object' && levelOrOpts !== null)
        ? levelOrOpts
        : {};
    const freedMB     = opts.freedMB     || 0;
    const closedPorts = opts.closedPorts || 0;
    const chainSteps  = opts.chainSteps  || 0;

    // Alt başlık
    if (subtitle) {
        subtitle.textContent = opts.subtitle || 'Dijital ekosistem başarıyla restore edildi';
    }

    // İstatistik kutucukları
    if (statsEl) {
        statsEl.innerHTML = `
            <div class="eco-stat">
                <div class="eco-stat-val">${freedMB > 0 ? freedMB.toFixed(0) + ' MB' : '—'}</div>
                <div class="eco-stat-label">Boşaltıldı</div>
            </div>
            <div class="eco-stat">
                <div class="eco-stat-val">${closedPorts > 0 ? closedPorts : '—'}</div>
                <div class="eco-stat-label">Kapatılan Port</div>
            </div>
            <div class="eco-stat">
                <div class="eco-stat-val">${chainSteps > 0 ? chainSteps : '—'}</div>
                <div class="eco-stat-label">Tamamlanan Adım</div>
            </div>`;
    }

    overlay.classList.add('active');
    initEcoCanvas();
    updateEcosystemState(90); // Restore sonrası optimal göster
}

function closeEcosystemOverlay() {
    const overlay = document.getElementById('ecosystem-overlay');
    if (overlay) overlay.classList.remove('active');
    stopEcoCanvas();
    if (lastScanData) updateEcosystemState(calcHealthScore(lastScanData));
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODÜL 1 — NetGuard UI
// ═══════════════════════════════════════════════════════════════════════════════

async function runNetworkScan() {
    const btn     = document.getElementById('btn-scan-network');
    const content = document.getElementById('netguard-content');
    if (!content) return;

    if (btn) { btn.disabled = true; btn.textContent = 'Taranıyor...'; }

    content.innerHTML = `
        <div class="agent-scanning">
            <div class="scan-animation">
                <div class="scan-ring r1"></div>
                <div class="scan-ring r2"></div>
                <div class="scan-ring r3"></div>
                <div class="scan-icon">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="url(#ng2)" stroke-width="1.5"/><defs><linearGradient id="ng2"><stop stop-color="#06b6d4"/><stop offset="1" stop-color="#818cf8"/></linearGradient></defs></svg>
                </div>
            </div>
            <p class="scan-text">Ağ bağlantıları taranıyor...</p>
            <p class="scan-sub">TCP/UDP bağlantıları ve şüpheli portlar analiz ediliyor</p>
        </div>`;

    try {
        const data = await window.electronAPI.scanNetwork();
        lastNetworkData = data;
        renderNetworkResults(data);
        updateNetguardBadge(data);
    } catch (err) {
        content.innerHTML = `<div class="empty-state"><p style="color:var(--priority-high)">Ağ tarama hatası: ${err.message}</p></div>`;
        toast('Ağ taraması başarısız.', 'error');
    }

    if (btn) {
        btn.disabled    = false;
        btn.innerHTML   = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Ağı Tara`;
    }
}

function renderNetworkResults(data) {
    const content = document.getElementById('netguard-content');
    if (!content) return;

    const totalAlerts   = (data.alerts?.length   || 0) + (data.suspicious?.length || 0);
    const hasDataLeak   = !!data.dataLeakAlert;
    const connections   = data.totalConnections || 0;
    const sentMB        = data.netUsage?.totalSentMB || '—';
    const recvMB        = data.netUsage?.totalReceivedMB || '—';

    // Özet kartlar
    let html = `
    <div class="netguard-summary">
        <div class="netguard-stat-card ${totalAlerts > 0 ? 'alert' : 'ok'}">
            <div class="ng-stat-label">Uyarı Sayısı</div>
            <div class="ng-stat-value">${totalAlerts}</div>
            <div class="ng-stat-sub">${totalAlerts === 0 ? 'Şüpheli bağlantı yok' : 'İnceleme gerekiyor'}</div>
        </div>
        <div class="netguard-stat-card info">
            <div class="ng-stat-label">Aktif Bağlantı</div>
            <div class="ng-stat-value">${connections}</div>
            <div class="ng-stat-sub">TCP/UDP toplam</div>
        </div>
        <div class="netguard-stat-card ${hasDataLeak ? 'alert' : 'ok'}">
            <div class="ng-stat-label">Gönderilen Veri</div>
            <div class="ng-stat-value" style="font-size:20px">${sentMB} MB</div>
            <div class="ng-stat-sub">Alınan: ${recvMB} MB</div>
        </div>
    </div>`;

    // Anormal veri sızıntısı uyarısı
    if (hasDataLeak) {
        const dl = data.dataLeakAlert;
        html += `
        <div class="ng-data-leak">
            <svg viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            <div class="ng-data-leak-text">
                <h4>⚠ Anormal Veri Sızıntısı Tespit Edildi</h4>
                <p>${dl.message}</p>
            </div>
        </div>`;
        toast('Anormal veri çıkışı tespit edildi!', 'error');
    }

    // Kritik uyarılar
    const allAlerts = [...(data.alerts || []), ...(data.suspicious || [])];
    if (allAlerts.length > 0) {
        html += `<div class="netguard-section-title">Şüpheli Bağlantılar</div>
                 <div class="netguard-alert-list">`;
        allAlerts.forEach((a, i) => {
            const iconLevel = a.level === 'critical' ? 'critical' : 'warning';
            const icon = a.level === 'critical'
                ? `<svg viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`
                : `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

            html += `
            <div class="ng-alert-card level-${a.level}" style="animation-delay:${i*60}ms">
                <div class="ng-alert-header">
                    <div class="ng-alert-icon ${iconLevel}">${icon}</div>
                    <div class="ng-alert-title">${a.message}</div>
                    <span class="priority-chip ${a.level === 'critical' ? 'high' : 'medium'}">
                        ${a.level === 'critical' ? '⚠ Kritik' : '◆ Şüpheli'}
                    </span>
                </div>
                <div class="ng-alert-action-text">💬 ${a.action}</div>
                <div class="ng-alert-actions">
                    ${a.pid ? `<button class="btn-danger" onclick="killNetProcess(${a.pid}, this)">
                        <svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                        Bağlantıyı Kes
                    </button>` : ''}
                    ${a.type === 'high_risk_port' && a.port ? `<button class="btn-action" onclick="blockNetPort(${a.port}, this)">
                        <svg viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                        Portu Engelle
                    </button>` : ''}
                    <button class="btn-action" onclick="toast('Bağlantı izleniyor.', 'info')">
                        Gözle
                    </button>
                </div>
            </div>`;
        });
        html += `</div>`;
    } else {
        html += `
        <div class="empty-state" style="padding:32px 0">
            <svg viewBox="0 0 24 24" fill="none" width="40" height="40">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="var(--accent-green)" stroke-width="1.8"/>
            </svg>
            <h3>Şüpheli Bağlantı Yok</h3>
            <p>Tüm ağ bağlantıları güvenli görünüyor.</p>
        </div>`;
    }

    content.innerHTML = html;
    toast(`NetGuard taraması tamamlandı — ${totalAlerts} uyarı`, totalAlerts > 0 ? 'error' : 'success');
}

function updateNetguardBadge(data) {
    const badge  = document.getElementById('netguard-badge');
    const alerts = (data?.alerts?.length || 0) + (data?.suspicious?.length || 0);
    if (!badge) return;
    if (alerts > 0 || data?.dataLeakAlert) {
        badge.style.display = 'flex';
        badge.textContent   = '!';
    } else {
        badge.style.display = 'none';
    }
}

async function killNetProcess(pid, btn) {
    if (!pid) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Kesiliyor...'; }
    try {
        const res = await window.electronAPI.killNetworkProcess(pid);
        if (res.success) {
            toast('Bağlantı kesildi — işlem sonlandırıldı.', 'success');
            if (btn) {
                btn.textContent = '✓ Kesildi';
                const card = btn.closest('.ng-alert-card');
                if (card) card.style.opacity = '0.4';
                // Başarılı kesimden sonra butonu kalıcı devre dışı bırak
            }
        } else {
            toast('Bağlantı kesilemedi — yetki yetersiz olabilir.', 'error');
            if (btn) btn.disabled = false;
        }
    } catch (_) {
        toast('İşlem sonlandırılamadı.', 'error');
        if (btn) btn.disabled = false;
    }
}

async function blockNetPort(port, btn) {
    if (!port) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Engelleniyor...'; }
    try {
        const res = await window.electronAPI.blockPort(port);
        if (res.success) {
            toast(`Port ${port} güvenlik duvarı kuralıyla engellendi.`, 'success');
            if (btn) { btn.textContent = '✓ Engellendi'; }
        } else {
            toast(`Port ${port} engellenemedi — yönetici yetkisi gerekebilir.`, 'error');
            if (btn) btn.disabled = false;
        }
    } catch (_) {
        toast('Port engellenemedi.', 'error');
        if (btn) btn.disabled = false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODÜL 3 — TaskChain (Otomasyon) UI
// ═══════════════════════════════════════════════════════════════════════════════

let chainStepStatusMap = {}; // step_order → { status, freedMB }

async function runOneClickOptimize() {
    if (chainRunning) { toast('Zincir zaten çalışıyor.', 'info'); return; }
    chainRunning = true;

    // Tüm "Tek Tıkla" butonlarını devre dışı bırak
    ['btn-run-chain', 'btn-one-click-dashboard', 'btn-scan-dashboard'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = true;
    });

    // Chain sekmesine geç
    showTab('chain');

    // Adım durumlarını sıfırla
    chainStepStatusMap = {};
    [1, 2, 3, 4, 5].forEach(i => {
        const el = document.getElementById(`cstep-${i}`);
        if (el) el.textContent = 'Bekliyor';
        const item = document.querySelector(`.chain-step-item[data-step="${i}"]`);
        if (item) item.className = 'chain-step-item';
    });

    // Progress göster
    const runDiv   = document.getElementById('chain-running');
    const resultEl = document.getElementById('chain-result');
    const logEl    = document.getElementById('chain-log');
    const barEl    = document.getElementById('chain-progress-bar');
    const progText = document.getElementById('chain-progress-text');

    if (runDiv)   runDiv.style.display   = 'block';
    if (resultEl) resultEl.style.display = 'none';
    if (logEl)    logEl.innerHTML        = '';
    if (barEl)    barEl.style.width      = '5%';
    if (progText) progText.textContent   = 'Zincir başlatılıyor...';

    try {
        const chain  = await window.electronAPI.getOneClickChain();
        const result = await window.electronAPI.runTaskChain(chain);

        // Sonuç göster
        if (runDiv)   runDiv.style.display   = 'none';
        if (resultEl) resultEl.style.display = 'block';
        renderChainResult(result);

        // Ekosistem animasyonunu tetikle
        const freedMB = result.totalFreedMB || 0;
        const closedPorts = (lastNetworkData?.alerts?.length || 0);

        if (result.completedSteps >= 3 || freedMB > 0) {
            setTimeout(() => {
                triggerEcosystemRestore({
                    freedMB,
                    closedPorts,
                    chainSteps: result.completedSteps,
                    subtitle: 'Görev zinciri başarıyla tamamlandı — Sistem nefes aldı',
                });
            }, 600);
        }

        toast(`Zincir tamamlandı: ${result.completedSteps}/${result.totalSteps} adım başarılı`, 'success');
        refreshScanDataSilent();
    } catch (err) {
        if (runDiv) runDiv.style.display = 'none';
        toast('Zincir çalıştırılamadı: ' + err.message, 'error');
    }

    chainRunning = false;
    ['btn-run-chain', 'btn-one-click-dashboard', 'btn-scan-dashboard'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = false;
    });
}

/** IPC callback — her adım tamamlandığında çağrılır */
function updateChainStepUI(step) {
    chainStepStatusMap[step.step_order] = step;

    const totalSteps = 5;
    const done       = Object.values(chainStepStatusMap).filter(s => s.status !== 'running').length;
    const pct        = Math.round((done / totalSteps) * 100);

    // Progress bar
    const barEl    = document.getElementById('chain-progress-bar');
    const progText = document.getElementById('chain-progress-text');
    if (barEl)    barEl.style.width    = `${Math.max(pct, 5)}%`;
    if (progText) progText.textContent = `Adım ${done}/${totalSteps} tamamlandı...`;

    // Adım durum etiketi
    const stepEl = document.getElementById(`cstep-${step.step_order}`);
    const item   = document.querySelector(`.chain-step-item[data-step="${step.step_order}"]`);

    if (stepEl) {
        stepEl.textContent = step.status === 'completed' ? '✓ Tamam'
            : step.status === 'failed'    ? '✗ Hata'
            : step.status === 'skipped'   ? '→ Atlandı'
            : '⟳ Çalışıyor';
    }
    if (item) {
        item.className = `chain-step-item ${
            step.status === 'completed' ? 'done'
            : step.status === 'failed'  ? 'failed'
            : step.status === 'skipped' ? 'skipped'
            : 'running'
        }`;
    }

    // Log
    const logEl = document.getElementById('chain-log');
    if (logEl) {
        const entry = document.createElement('div');
        entry.className = `chain-log-entry ${step.status}`;
        entry.innerHTML = `<div class="chain-log-dot"></div>
            <span>[${step.action}]</span>
            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${step.detail || ''}</span>
            <span style="color:var(--text-muted);font-size:10px">${new Date(step.timestamp).toLocaleTimeString('tr-TR')}</span>`;
        logEl.appendChild(entry);
        logEl.scrollTop = logEl.scrollHeight;
    }
}

function renderChainResult(result) {
    const el = document.getElementById('chain-result');
    if (!el) return;

    const hasErrors = result.failedSteps > 0;
    const elapsedSec = (result.elapsedMs / 1000).toFixed(1);

    const logRows = (result.log || []).map(l => `
        <div class="chain-log-entry ${l.status}" style="font-size:11px">
            <div class="chain-log-dot"></div>
            <span style="color:var(--text-muted)">[${l.action}]</span>
            <span style="flex:1">${l.detail}</span>
        </div>`).join('');

    el.innerHTML = `
    <div class="chain-result-card ${hasErrors ? 'has-errors' : ''}">
        <div class="chain-result-header">
            <div class="chain-result-icon">
                <svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="1.8"/></svg>
            </div>
            <div>
                <div class="chain-result-title">${hasErrors ? 'Zincir Kısmen Tamamlandı' : 'Zincir Başarıyla Tamamlandı'}</div>
                <div class="chain-result-sub">${result.chain_id} · ${elapsedSec}s sürdü</div>
            </div>
        </div>
        <div class="chain-result-stats">
            <div class="cr-stat">
                <div class="cr-stat-val">${result.completedSteps}</div>
                <div class="cr-stat-label">Tamamlanan</div>
            </div>
            <div class="cr-stat">
                <div class="cr-stat-val">${result.failedSteps}</div>
                <div class="cr-stat-label">Başarısız</div>
            </div>
            <div class="cr-stat">
                <div class="cr-stat-val">${result.totalFreedMB} MB</div>
                <div class="cr-stat-label">Boşaltıldı</div>
            </div>
            <div class="cr-stat">
                <div class="cr-stat-val">${elapsedSec}s</div>
                <div class="cr-stat-label">Süre</div>
            </div>
        </div>
        <div class="chain-result-log">${logRows}</div>
        <div style="margin-top:16px;display:flex;gap:10px">
            <button class="btn-primary" onclick="runOneClickOptimize()">
                <svg viewBox="0 0 24 24" fill="none"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                Tekrar Çalıştır
            </button>
            <button class="btn-ghost" onclick="showTab('dashboard')">Dashboard'a Dön</button>
        </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEVCUT KOD (Önceki modüllerden korundu + Ekosistem entegrasyonu eklendi)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Arkaplan Tarama Yenileme ─────────────────────────────────────────────────
async function refreshScanDataSilent() {
    try {
        const data = await window.electronAPI.quickScan();
        lastScanData = data;
        updateDashboardMetrics(data.system);
        updateDashboardSuggestions(data.suggestions);
        updateBadge(data.suggestions.filter(s => s.priority === 'high').length);
        const score = calcHealthScore(data);
        updateEcosystemState(score);
    } catch (_) {}
}

// ─── Toast Bildirimleri ───────────────────────────────────────────────────────
function toast(message, type = 'info') {
    const icons = {
        success: `<svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
        error:   `<svg viewBox="0 0 24 24" fill="none"><path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="1.8"/></svg>`,
        info:    `<svg viewBox="0 0 24 24" fill="none"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="1.8"/></svg>`
    };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `${icons[type]}<span>${message}</span>`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => {
        el.classList.add('toast-out');
        setTimeout(() => el.remove(), 200);
    }, 3500);
}

// ─── Halka İlerleme ──────────────────────────────────────────────────────────
function setRingProgress(ringId, percent) {
    const ring = document.getElementById(ringId);
    if (!ring) return;
    const offset = 125.66 - (Math.min(Math.max(percent, 0), 100) / 100) * 125.66;
    ring.style.strokeDashoffset = offset;
}

// ─── Bar Rengi ───────────────────────────────────────────────────────────────
function barColorClass(pct, type) {
    if (type === 'disk') return pct > 85 ? 'bar-pink' : pct > 70 ? 'bar-yellow' : 'bar-green';
    return pct > 85 ? 'bar-pink' : pct > 60 ? 'bar-yellow' : 'bar-purple';
}

// ─── Sekme Geçişleri ─────────────────────────────────────────────────────────
function showTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`tab-${name}`)?.classList.add('active');
    document.getElementById(`nav-${name}`)?.classList.add('active');
    if (name === 'health') refreshHealth();
    if (name === 'antivirus') avAutoStatus();
}

// ─── Kategori Simgesi ─────────────────────────────────────────────────────────
function categoryIcon(cat) {
    const icons = {
        performance: `<svg viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        disk_space:  `<svg viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="7" rx="9" ry="3" stroke="currentColor" stroke-width="1.8"/><path d="M3 7v10c0 1.657 4.03 3 9 3s9-1.343 9-3V7" stroke="currentColor" stroke-width="1.8"/></svg>`,
        security:    `<svg viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
        hardware:    `<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/><rect x="9" y="9" width="6" height="6" fill="currentColor" opacity="0.4"/></svg>`,
        privacy:     `<svg viewBox="0 0 24 24" fill="none"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" stroke-width="1.8"/><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" stroke="currentColor" stroke-width="1.8"/></svg>`
    };
    return icons[cat] || icons.performance;
}

function categoryLabel(cat) {
    return { performance: 'Performans', disk_space: 'Disk Alanı', security: 'Güvenlik', hardware: 'Donanım', privacy: 'Gizlilik' }[cat] || cat;
}

// ─── Context Render ───────────────────────────────────────────────────────────
function renderContext(ctx) {
    if (!ctx || !Object.keys(ctx).length) return '';
    const items = Object.entries(ctx)
        .filter(([, v]) => typeof v !== 'object' || Array.isArray(v))
        .slice(0, 4)
        .map(([k, v]) => {
            const val = Array.isArray(v) ? v.join(', ') : v;
            return `<span class="context-item"><span class="context-key">${k.replace(/_/g, ' ')}:</span><span class="context-val">${val}</span></span>`;
        }).join('');
    return items ? `<div class="suggestion-context">${items}</div>` : '';
}

// ─── Öneri Kartı ──────────────────────────────────────────────────────────────
function buildSuggestionCard(s, index) {
    const actions = (s.suggested_actions || []).map(a => {
        const payload = JSON.stringify({ type: a.action_type, payload: a.action_payload });
        return `<button class="btn-action" onclick='handleAction(${payload})'>${a.label}</button>`;
    }).join('');
    return `
    <div class="suggestion-card priority-${s.priority}" style="animation-delay:${index * 50}ms">
        <div class="suggestion-header">
            <div class="suggestion-icon ${s.category}">${categoryIcon(s.category)}</div>
            <div class="suggestion-title-row">
                <div class="suggestion-title">${s.title}</div>
                <span class="priority-chip ${s.priority}">${s.priority === 'high' ? '⚠ Yüksek' : s.priority === 'medium' ? '◆ Orta' : '● Düşük'}</span>
            </div>
        </div>
        <p class="suggestion-desc">${s.description}</p>
        ${renderContext(s.analysis_context)}
        <div class="suggestion-actions">${actions}</div>
    </div>`;
}

// ─── Dashboard Özet Kartı ─────────────────────────────────────────────────────
function buildPreviewCard(s) {
    return `
    <div class="preview-card priority-${s.priority}" onclick="showTab('agent')">
        <div class="preview-dot"></div>
        <div class="preview-info">
            <div class="preview-title">${s.title}</div>
            <div class="preview-cat">${categoryLabel(s.category)}</div>
        </div>
        <div class="preview-arrow"><svg viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div>
    </div>`;
}

// ─── Eylem İşleyici ──────────────────────────────────────────────────────────
async function handleAction({ type, payload }) {
    try {
        if (type === 'background_process') {
            if (payload === 'clean_temp')  { await doCleanTemp(); return; }
            if (payload === 'clean_ram')   { toast('Bellek için gereksiz uygulamaları kapatın.', 'info'); return; }
            if (payload === 'security_scan') { await window.electronAPI.openSettings('security'); return; }
        }
        if (type === 'open_folder') {
            await window.electronAPI.openFolder(payload);
            toast('Klasör açıldı.', 'success');
            return;
        }
        if (type === 'open_settings') {
            await window.electronAPI.openSettings(payload);
            toast('Sistem ayarları açıldı.', 'success');
            return;
        }
        if (type === 'open_section') {
            showTab(payload === 'processes' ? 'health' : payload);
        }
    } catch (e) {
        toast('İşlem gerçekleştirilemedi.', 'error');
    }
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function updateBadge(count) {
    const badge = document.getElementById('agent-badge');
    if (count > 0) { badge.style.display = 'flex'; badge.textContent = count; }
    else             badge.style.display = 'none';
}

// ─── Dashboard Metrikleri ─────────────────────────────────────────────────────
function updateDashboardMetrics(sys) {
    if (!sys) return;
    const toGB = b => b ? (b / 1024 ** 3).toFixed(1) : '?';

    const ramPct = sys.ram?.usagePercent || 0;
    document.getElementById('ram-value').textContent = `%${ramPct}`;
    document.getElementById('ram-sub').textContent   = `${toGB(sys.ram?.used)} / ${toGB(sys.ram?.total)} GB`;
    setRingProgress('ram-ring', ramPct);

    const cDrive = sys.disk?.drives?.find(d => d.name === 'C');
    if (cDrive) {
        document.getElementById('disk-value').textContent = `%${cDrive.usagePercent}`;
        document.getElementById('disk-sub').textContent   = `${toGB(cDrive.free)} GB boş`;
        setRingProgress('disk-ring', cDrive.usagePercent);
    }

    const upH = parseFloat(sys.uptime_hours) || 0;
    document.getElementById('uptime-value').textContent = upH > 24 ? `${(upH / 24).toFixed(1)}g` : `${upH}s`;

    document.getElementById('cpu-value').textContent = sys.cpu?.cores ? `${sys.cpu.cores} Çekirdek` : 'Aktif';
    document.getElementById('cpu-sub').textContent   = sys.hostname || 'Windows';
    setRingProgress('cpu-ring', 35);
}

// ─── Dashboard Önerileri ──────────────────────────────────────────────────────
function updateDashboardSuggestions(suggestions) {
    const c = document.getElementById('dashboard-suggestions');
    if (!suggestions?.length) {
        c.innerHTML = `<div class="empty-state"><span class="chip-ok"><svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>Tüm sistemler sağlıklı</span></div>`;
        return;
    }
    c.innerHTML = suggestions.slice(0, 3).map(buildPreviewCard).join('');
}

// ─── Sonuçları Render Et ──────────────────────────────────────────────────────
function renderScanResults(data) {
    const results = document.getElementById('agent-results');
    results.style.display = 'block';

    updateDashboardMetrics(data.system);
    updateDashboardSuggestions(data.suggestions);

    // Ekosistem durumunu güncelle (Modül 2)
    const score = calcHealthScore(data);
    updateEcosystemState(score);

    const isDeep   = data.scanType === 'deep';
    const typeChip = `<span class="scan-type-chip ${isDeep ? 'deep' : 'quick'}">${isDeep ? '⬛ Detaylı' : '⚡ Hızlı'}</span>`;
    const time     = new Date(data.timestamp).toLocaleTimeString('tr-TR');
    const highCount = (data.suggestions || []).filter(s => s.priority === 'high').length;

    if (!data.suggestions?.length) {
        results.innerHTML = `
            <div class="all-clear">
                <div class="all-clear-icon">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="1.8"/></svg>
                </div>
                <h3>Sistem Sağlıklı! ${typeChip}</h3>
                <p>Tespit edilen herhangi bir sorun yok. Sisteminiz sorunsuz çalışıyor.</p>
            </div>`;
        updateBadge(0);
        return;
    }

    const cards = data.suggestions.map((s, i) => buildSuggestionCard(s, i)).join('');
    results.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
            <div style="font-size:13px;color:var(--text-secondary)">
                ${data.suggestions.length} öneri bulundu ${typeChip}
                &nbsp;·&nbsp;
                <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted)">${time}</span>
            </div>
            ${!isDeep ? `<button class="btn-ghost" onclick="runDeepScanUI()" style="font-size:12px">
                <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.8"/><path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                Detaylı tara
            </button>` : ''}
        </div>
        ${cards}`;
    updateBadge(highCount);
}

// ─── HIZLI TARAMA ─────────────────────────────────────────────────────────────
async function runQuickScanUI() {
    const qBtn     = document.getElementById('btn-quick-scan');
    const dBtn     = document.getElementById('btn-deep-scan');
    const dDashBtn = document.getElementById('btn-scan-dashboard');
    const loading  = document.getElementById('agent-loading');
    const results  = document.getElementById('agent-results');

    [qBtn, dBtn, dDashBtn].forEach(b => b && (b.disabled = true));
    loading.style.display = 'block';
    results.style.display = 'none';

    const scanText = document.querySelector('.scan-text');
    const scanSub  = document.querySelector('.scan-sub');
    if (scanText) scanText.textContent = 'Hızlı tarama yapılıyor...';
    if (scanSub)  scanSub.textContent  = 'Bu yalnızca 1-2 saniye sürer';

    try {
        const data = await window.electronAPI.quickScan();
        lastScanData = data;
        loading.style.display = 'none';
        renderScanResults(data);
        toast(`Hızlı tarama tamamlandı — ${data.suggestions.length} öneri`, 'success');
    } catch (err) {
        loading.style.display = 'none';
        results.style.display = 'block';
        results.innerHTML = `<div class="empty-state"><p style="color:var(--priority-high)">Hata: ${err.message}</p></div>`;
        toast('Tarama başarısız oldu.', 'error');
    }

    [qBtn, dBtn, dDashBtn].forEach(b => b && (b.disabled = false));
}

// ─── DETAYLI TARAMA ───────────────────────────────────────────────────────────
async function runDeepScanUI() {
    const qBtn    = document.getElementById('btn-quick-scan');
    const dBtn    = document.getElementById('btn-deep-scan');
    const loading = document.getElementById('agent-loading');
    const results = document.getElementById('agent-results');

    [qBtn, dBtn].forEach(b => b && (b.disabled = true));
    if (dBtn) dBtn.innerHTML = `<div class="spinner" style="width:14px;height:14px;border-width:2px"></div> Analiz ediliyor... <span class="scan-badge secondary">~10s</span>`;

    loading.style.display = 'block';
    results.style.display = 'none';

    const scanText = document.querySelector('.scan-text');
    const scanSub  = document.querySelector('.scan-sub');
    if (scanText) scanText.textContent = 'Derin sistem analizi yapılıyor...';
    if (scanSub)  scanSub.textContent  = 'PowerShell ile işlem, disk ve güvenlik analizi...';

    const agentLoading = document.getElementById('agent-loading');
    const progressBar  = document.createElement('div');
    progressBar.className = 'deep-scan-progress';
    progressBar.innerHTML = '<div class="deep-scan-bar"></div>';
    agentLoading.querySelector('.agent-scanning')?.appendChild(progressBar);

    try {
        const data = await window.electronAPI.deepScan();
        lastScanData = data;
        loading.style.display = 'none';
        progressBar.remove();
        renderScanResults(data);
        toast(`Detaylı tarama tamamlandı — ${data.suggestions.length} öneri`, 'success');
        if (document.getElementById('tab-health').classList.contains('active')) refreshHealth();
    } catch (err) {
        loading.style.display = 'none';
        progressBar.remove();
        results.style.display = 'block';
        results.innerHTML = `<div class="empty-state"><p style="color:var(--priority-high)">Hata: ${err.message}</p></div>`;
        toast('Detaylı tarama başarısız.', 'error');
    }

    [qBtn, dBtn].forEach(b => b && (b.disabled = false));
    if (dBtn) dBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.8"/><path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Detaylı Tara <span class="scan-badge secondary">~10s</span>`;
}

// ─── Sistem Sağlığı ───────────────────────────────────────────────────────────
async function refreshHealth() {
    const container = document.getElementById('health-content');
    container.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>Yükleniyor...</p></div>`;

    try {
        const data  = await window.electronAPI.quickScan();
        const sys   = data.system;
        const ram   = sys.ram || {};
        const ramPct = parseFloat(ram.usagePercent || 0);
        const drives = sys.disk?.drives || [];
        const toGB  = b => b ? (b / 1024 ** 3).toFixed(1) : '?';

        const diskBars = drives.map(d => `
            <div class="health-bar-row">
                <span class="health-bar-label">${d.name}:</span>
                <div class="health-bar-track">
                    <div class="health-bar-fill ${barColorClass(d.usagePercent, 'disk')}" style="width:${d.usagePercent}%"></div>
                </div>
                <span class="health-bar-val">${d.usagePercent}%</span>
            </div>`).join('') || '<p style="color:var(--text-muted);font-size:12px">Disk verisi yok</p>';

        const procs = lastScanData?.system?.topProcesses || [];
        const procRows = procs.length
            ? procs.map(p => `
                <div class="process-row">
                    <span class="process-name">${p.name}</span>
                    <span class="process-cpu">${p.cpu.toFixed(1)}s CPU</span>
                </div>`).join('')
            : `<div class="process-row" style="justify-content:center">
                   <button class="btn-ghost" style="font-size:11px" onclick="runDeepScanUI();showTab('agent')">⚡ Detaylı tarama yap</button>
               </div>`;

        container.innerHTML = `
        <div class="health-grid">
            <div class="health-card">
                <h3>Bellek (RAM)</h3>
                <div class="health-bar-row">
                    <span class="health-bar-label">Kullanım</span>
                    <div class="health-bar-track">
                        <div class="health-bar-fill ${barColorClass(ramPct, 'ram')}" style="width:${ramPct}%"></div>
                    </div>
                    <span class="health-bar-val">${ramPct}%</span>
                </div>
                <div style="margin-top:12px">
                    <div class="info-row"><span class="info-key">Toplam</span><span class="info-val">${toGB(ram.total)} GB</span></div>
                    <div class="info-row"><span class="info-key">Kullanılan</span><span class="info-val">${toGB(ram.used)} GB</span></div>
                    <div class="info-row"><span class="info-key">Boş</span><span class="info-val">${toGB(ram.free)} GB</span></div>
                </div>
            </div>
            <div class="health-card">
                <h3>Disk Kullanımı</h3>
                ${diskBars}
            </div>
            <div class="health-card">
                <h3>Sistem Bilgileri</h3>
                <div class="info-row"><span class="info-key">Bilgisayar Adı</span><span class="info-val">${sys.hostname || '—'}</span></div>
                <div class="info-row"><span class="info-key">Platform</span><span class="info-val">${sys.platform || '—'}</span></div>
                <div class="info-row"><span class="info-key">Mimari</span><span class="info-val">${sys.arch || '—'}</span></div>
                <div class="info-row"><span class="info-key">Çalışma Süresi</span><span class="info-val">${sys.uptime_hours} saat</span></div>
                <div class="info-row"><span class="info-key">İşlemci</span><span class="info-val">${sys.cpu?.model?.split('@')[0]?.trim() || '—'}</span></div>
                <div class="info-row"><span class="info-key">Çekirdek Sayısı</span><span class="info-val">${sys.cpu?.cores || '—'}</span></div>
            </div>
            <div class="health-card">
                <h3>Yüksek CPU İşlemleri</h3>
                ${procRows}
            </div>
        </div>`;

        updateDashboardMetrics(sys);
        updateEcosystemState(calcHealthScore(data));
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><p style="color:var(--priority-high)">Veri alınamadı.</p></div>`;
    }
}

// ─── Temp Temizle ─────────────────────────────────────────────────────────────
async function doCleanTemp() {
    const btn    = document.getElementById('btn-clean-temp');
    const status = document.getElementById('temp-status');
    if (btn) { btn.disabled = true; btn.textContent = 'Temizleniyor...'; }
    if (status) status.textContent = 'İşlemde...';
    try {
        const res = await window.electronAPI.cleanTemp();
        const mb  = res.freedMB || 0;
        if (status) status.textContent = res.status === 'cleaned'
            ? `✓ Temizlendi — ${mb} MB boşaltıldı`
            : '⚠ Kısmen temizlendi';
        const panel   = document.getElementById('clean-result');
        const content = document.getElementById('clean-result-content');
        if (panel && content) {
            panel.style.display = 'block';
            content.innerHTML = `
                <div class="result-success">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="1.8"/></svg>
                    <span>Geçici dosyalar temizlendi!${mb > 0 ? ` ${mb} MB boşaltıldı, ${res.deletedCount || 0} dosya silindi.` : ''}</span>
                </div>`;
        }
        toast(`Temp temizliği tamamlandı — ${mb} MB boşaltıldı!`, 'success');
        triggerEcosystemRestore({ freedMB: mb, subtitle: 'Sistem temizliği tamamlandı — Disk alanı boşaltıldı' });
        refreshScanDataSilent();
    } catch (e) {
        if (status) status.textContent = '✗ Hata';
        toast('Temizleme başarısız.', 'error');
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Temp Dosyaları Temizle'; }
}

// ─── Klasör / Ayar Aç ────────────────────────────────────────────────────────
async function openDownloads() {
    try { await window.electronAPI.openFolder('downloads'); toast('İndirilenler klasörü açıldı.', 'success'); }
    catch (_) { toast('Klasör açılamadı.', 'error'); }
}

async function openStartupApps() {
    try { await window.electronAPI.openSettings('startup_apps'); toast('Başlangıç ayarları açıldı.', 'info'); }
    catch (_) { toast('Ayarlar açılamadı.', 'error'); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODÜL 4 — Antivirüs UI
// ═══════════════════════════════════════════════════════════════════════════════

let avScanning = false;

// Register scan progress listener once
if (window.electronAPI?.onAvScanProgress) {
    window.electronAPI.onAvScanProgress((prog) => {
        const bar  = document.getElementById('av-progress-bar');
        const pct  = document.getElementById('av-progress-pct');
        const text = document.getElementById('av-scan-text');
        const sub  = document.getElementById('av-scan-sub');
        if (bar) bar.style.width = `${prog.percent}%`;
        if (pct) pct.textContent = `%${prog.percent}`;
        const phaseMap = {
            starting:   ['Windows Defender başlatılıyor...', 'Tarama motoru hazırlanıyor'],
            scanning:   ['Sistem taranıyor...', 'Dosyalar virüs imzalarıyla karşılaştırılıyor'],
            collecting: ['Sonuçlar toplanıyor...', 'Tehdit bilgileri alınıyor'],
            checking:   ['Mevcut tehditler kontrol ediliyor...', 'Defender veritabanı sorgulanıyor'],
            done:       ['Tarama tamamlandı', 'Sonuçlar hazırlanıyor...'],
        };
        const [t, s] = phaseMap[prog.phase] || ['Taranıyor...', ''];
        if (text) text.textContent = t;
        if (sub)  sub.textContent  = s;
    });
}

function avSetBusy(busy) {
    avScanning = busy;
    ['btn-av-scan', 'btn-av-status'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = busy;
    });
    const scanEl    = document.getElementById('av-scanning');
    const contentEl = document.getElementById('av-content');
    if (scanEl)    scanEl.style.display    = busy ? 'block' : 'none';
    if (contentEl) contentEl.style.display = busy ? 'none'  : 'block';
}

async function checkAvStatus() {
    if (avScanning) return;
    avSetBusy(true);
    try {
        const data = await window.electronAPI.avGetStatus();
        renderAvResults(data, 'status');
    } catch (err) {
        document.getElementById('av-content').innerHTML =
            `<div class="empty-state"><p style="color:var(--priority-high)">Durum alınamadı: ${err.message}</p></div>`;
    }
    avSetBusy(false);
}

async function runAvScanUI() {
    if (avScanning) { toast('Tarama zaten devam ediyor.', 'info'); return; }
    avSetBusy(true);
    const bar = document.getElementById('av-progress-bar');
    const pct = document.getElementById('av-progress-pct');
    if (bar) bar.style.width = '5%';
    if (pct) pct.textContent = '%5';
    try {
        toast('Windows Defender taraması başlatıldı — bu birkaç dakika sürebilir.', 'info');
        const data = await window.electronAPI.avQuickScan();
        renderAvResults(data, 'scan');
        const msg = data.threatCount > 0
            ? `Tarama tamamlandı — ${data.threatCount} tehdit bulundu!`
            : 'Tarama tamamlandı — Tehdit tespit edilmedi';
        toast(msg, data.threatCount > 0 ? 'error' : 'success');
    } catch (err) {
        document.getElementById('av-content').innerHTML =
            `<div class="empty-state"><p style="color:var(--priority-high)">Tarama hatası: ${err.message}</p></div>`;
        toast('Antivirüs taraması başarısız.', 'error');
    }
    avSetBusy(false);
}

async function doAvCleanThreats() {
    const btn = document.getElementById('btn-av-clean');
    if (btn) { btn.disabled = true; btn.textContent = 'Temizleniyor...'; }
    try {
        const res = await window.electronAPI.avCleanThreats();
        if (res.remainingThreats === 0) {
            toast('Tüm tehditler başarıyla temizlendi!', 'success');
            triggerEcosystemRestore({ subtitle: 'Antivirüs taraması tamamlandı — Sistem temizlendi' });
        } else {
            toast(`Temizleme tamamlandı — ${res.remainingThreats} tehdit kaldı (yönetici yetkisi gerekebilir).`, 'error');
        }
        renderAvResults(res, 'status');
    } catch (err) {
        toast('Tehdit temizleme başarısız: ' + err.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Tehditleri Temizle'; }
    }
}

function avAutoStatus() {
    const content = document.getElementById('av-content');
    if (!content) return;
    if (content.querySelector('.empty-state')) checkAvStatus();
}

function renderAvResults(data, source) {
    const content = document.getElementById('av-content');
    if (!content) return;

    // Update badge
    const badge = document.getElementById('av-badge');
    if (badge) {
        badge.style.display = data.threatCount > 0 ? 'flex' : 'none';
        badge.textContent = data.threatCount > 0 ? data.threatCount : '!';
    }

    const statusColor = data.enabled ? 'var(--accent-green)' : 'var(--priority-high)';
    const rtpColor    = data.realTimeProtection ? 'var(--accent-green)' : 'var(--priority-high)';
    const scanAge     = data.quickScanAgeDays != null ? `${data.quickScanAgeDays} gün önce` : '—';

    let html = `
    <div class="health-grid" style="margin-bottom:20px">
        <div class="health-card">
            <h3>Defender Durumu</h3>
            <div class="info-row"><span class="info-key">Antivirüs</span>
                <span class="info-val" style="color:${statusColor}">${data.enabled ? '✓ Etkin' : '✗ Devre Dışı'}</span></div>
            <div class="info-row"><span class="info-key">Gerçek Zamanlı Koruma</span>
                <span class="info-val" style="color:${rtpColor}">${data.realTimeProtection ? '✓ Açık' : '✗ Kapalı'}</span></div>
            <div class="info-row"><span class="info-key">Son Hızlı Tarama</span>
                <span class="info-val">${scanAge}</span></div>
            <div class="info-row"><span class="info-key">Aktif Tehdit</span>
                <span class="info-val" style="color:${data.threatCount > 0 ? 'var(--priority-high)' : 'var(--accent-green)'}">${data.threatCount}</span></div>
        </div>
        <div class="health-card" style="grid-column:span 2">
            <h3>Tarama Özeti${source === 'scan' ? ' <span class="scan-type-chip deep">⬛ Hızlı Tarama</span>' : ''}</h3>
            ${data.threatCount === 0
                ? `<div style="display:flex;align-items:center;gap:10px;padding:8px 0">
                       <svg viewBox="0 0 24 24" fill="none" width="28" height="28"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="var(--accent-green)" stroke-width="1.8"/></svg>
                       <span style="color:var(--accent-green);font-weight:500">Tehdit tespit edilmedi — Sistem temiz</span>
                   </div>`
                : `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                       <span style="color:var(--priority-high);font-weight:500">⚠ ${data.threatCount} aktif tehdit bulundu</span>
                       <button class="btn-danger" id="btn-av-clean" onclick="doAvCleanThreats()">
                           <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                           Tehditleri Temizle
                       </button>
                   </div>`
            }
        </div>
    </div>`;

    if (data.threats && data.threats.length > 0) {
        html += `<div class="netguard-section-title">Aktif Tehditler</div>
                 <div class="netguard-alert-list">`;
        data.threats.forEach((t, i) => {
            const sevClass = t.severityId >= 4 ? 'high' : t.severityId >= 2 ? 'medium' : 'low';
            html += `
            <div class="ng-alert-card level-${t.severityId >= 4 ? 'critical' : 'warning'}" style="animation-delay:${i*60}ms">
                <div class="ng-alert-header">
                    <div class="ng-alert-icon ${t.severityId >= 4 ? 'critical' : 'warning'}">
                        <svg viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    </div>
                    <div class="ng-alert-title">${t.name}</div>
                    <span class="priority-chip ${sevClass}">${t.severity}</span>
                </div>
                <div class="ng-alert-action-text">📁 Kategori: ${t.category}</div>
                ${t.resources?.length > 0 ? `<div class="ng-alert-action-text" style="font-size:10px;color:var(--text-muted);word-break:break-all">📍 ${Array.isArray(t.resources) ? t.resources.slice(0,2).join(', ') : t.resources}</div>` : ''}
            </div>`;
        });
        html += `</div>`;
    }

    if (data.detections && data.detections.length > 0) {
        html += `<div class="netguard-section-title" style="margin-top:20px">Tespit Geçmişi (Son 10)</div>
                 <div class="netguard-alert-list">`;
        data.detections.forEach((d, i) => {
            const dt = d.time ? new Date(d.time).toLocaleString('tr-TR') : '—';
            html += `
            <div class="ng-alert-card" style="animation-delay:${i*40}ms">
                <div class="ng-alert-header">
                    <div class="ng-alert-icon ${d.success ? 'warning' : 'critical'}">
                        <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                    </div>
                    <div class="ng-alert-title">${d.name}</div>
                    <span class="priority-chip ${d.success ? 'low' : 'medium'}">${d.success ? '✓ Temizlendi' : '⚠ Bekliyor'}</span>
                </div>
                <div class="ng-alert-action-text" style="font-size:11px">🕐 ${dt}</div>
            </div>`;
        });
        html += `</div>`;
    }

    if (!data.threats?.length && !data.detections?.length) {
        html += `
        <div class="empty-state" style="padding:32px 0">
            <svg viewBox="0 0 24 24" fill="none" width="40" height="40">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="var(--accent-green)" stroke-width="1.8"/>
            </svg>
            <h3>Tehdit Bulunamadı</h3>
            <p>Sistem temiz görünüyor. Daha kapsamlı analiz için "Hızlı Tarama" butonunu kullanın.</p>
        </div>`;
    }

    content.innerHTML = html;
}

// ─── İlk Yükleme ─────────────────────────────────────────────────────────────
(async function init() {
    try {
        const data = await window.electronAPI.quickScan();
        lastScanData = data;
        updateDashboardMetrics(data.system);
        updateDashboardSuggestions(data.suggestions);
        updateBadge(data.suggestions.filter(s => s.priority === 'high').length);
        updateEcosystemState(calcHealthScore(data));
    } catch (_) {
        try {
            const h = await window.electronAPI.getHealth();
            document.getElementById('ram-value').textContent = `%${parseFloat(h.ram || 0)}`;
            setRingProgress('ram-ring', parseFloat(h.ram || 0));
            updateEcosystemState(50);
        } catch (__) { updateEcosystemState(50); }
    }
})();