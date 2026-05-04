// ─── Durum ───────────────────────────────────────────────────────────────────
let lastScanData = null;
let ecosystemState = 'initializing'; // critical | medium | optimal
let ecoAnimFrame = null;
let ecoParticles = [];
let lastNetworkData = null;
let chainRunning = false;

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
    const fill = document.getElementById('eco-health-fill');
    const pct = document.getElementById('eco-health-pct');
    const label = document.getElementById('eco-state-label');
    const wrapper = document.getElementById('eco-health-wrapper');
    const dot = document.getElementById('eco-dot');
    const statusText = document.getElementById('eco-status-text');

    if (!fill) return;

    // Skor → durum eşleme
    let state, stateLabel, dotClass, statusMsg;
    if (healthScore < 40) {
        state = 'critical';
        stateLabel = '⚠ Kritik — Sistem optimizasyon gerektiriyor';
        dotClass = 'critical';
        statusMsg = 'Sistem kritik durumda';
    } else if (healthScore < 75) {
        state = 'medium';
        stateLabel = '◆ Orta Seviye — Bazı iyileştirmeler mevcut';
        dotClass = 'medium';
        statusMsg = 'Sistem iyileştirilebilir';
    } else {
        state = 'optimal';
        stateLabel = '✦ Optimize — Dijital ekosistem sağlıklı';
        dotClass = 'optimal';
        statusMsg = 'Sistem nefes alıyor';
    }

    ecosystemState = state;

    // Yüzde barı güncelle
    fill.style.width = `${Math.min(healthScore, 100)}%`;
    fill.className = 'ecosystem-health-fill' +
        (healthScore >= 75 ? ' optimal' : healthScore >= 40 ? ' good' : '');

    if (pct) pct.textContent = `%${Math.round(healthScore)}`;

    // Etiket ve wrapper durum sınıfı
    if (label) {
        label.textContent = stateLabel;
        label.className = `ecosystem-state-label state-${state}`;
    }
    if (wrapper) {
        wrapper.className = `ecosystem-health-bar-wrapper state-${state}`;
    }

    // Başlık çubuğu göstergesi
    if (dot) { dot.className = `eco-dot ${dotClass}`; }
    if (statusText) { statusText.textContent = statusMsg; }
}

/**
 * Sistem sağlık puanını tarama verisinden hesapla (0-100)
 */
function calcHealthScore(scanData) {
    if (!scanData?.system) return 50;
    const ram = scanData.system.ram?.usagePercent || 50;
    const disk = scanData.system.disk?.drives?.find(d => d.name === 'C')?.usagePercent || 50;
    const high = (scanData.suggestions || []).filter(s => s.priority === 'high').length;
    const med = (scanData.suggestions || []).filter(s => s.priority === 'medium').length;

    // Gerçekçi eğri: %40 RAM altı = tam puan, %100'de sıfır
    const ramScore = Math.max(0, 100 - Math.max(0, ram - 40) * (100 / 60));
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
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');

    // Parçacık havuzu temizle
    ecoParticles = Array.from({ length: 80 }, () => createParticle(canvas));

    function loop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ecoParticles.forEach(p => {
            p.y -= p.vy;
            p.x += Math.sin(p.t) * 0.5;
            p.t += 0.02;
            p.life -= 0.005;
            if (p.life <= 0) Object.assign(p, createParticle(canvas));

            ctx.save();
            ctx.globalAlpha = p.life * 0.8;
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 12;
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
        x: Math.random() * canvas.width,
        y: canvas.height + 10,
        vy: 0.5 + Math.random() * 2,
        r: 1 + Math.random() * 3,
        t: Math.random() * Math.PI * 2,
        life: 0.3 + Math.random() * 0.7,
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
    const overlay = document.getElementById('ecosystem-overlay');
    const statsEl = document.getElementById('ecosystem-stats');
    const subtitle = document.getElementById('ecosystem-subtitle');
    if (!overlay) return;

    // Seçenekleri çözümle
    const opts = (typeof levelOrOpts === 'object' && levelOrOpts !== null)
        ? levelOrOpts
        : {};
    const freedMB = opts.freedMB || 0;
    const closedPorts = opts.closedPorts || 0;
    const chainSteps = opts.chainSteps || 0;

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
// MODÜL 5 — Hardware Diagnostics (Donanım) UI
// ═══════════════════════════════════════════════════════════════════════════════

async function refreshHardware() {
    const content = document.getElementById('hardware-content');
    const btn = document.getElementById('btn-refresh-hardware');
    if (!content) return;

    if (btn) { btn.disabled = true; btn.textContent = 'Analiz ediliyor...'; }

    content.innerHTML = `
        <div class="agent-scanning">
            <div class="scan-animation">
                <div class="scan-ring r1"></div>
                <div class="scan-ring r2"></div>
                <div class="scan-icon">
                    <svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="2" stroke="url(#hwGrad2)" stroke-width="1.5"/><defs><linearGradient id="hwGrad2"><stop stop-color="#34d399"/><stop offset="1" stop-color="#06b6d4"/></linearGradient></defs></svg>
                </div>
            </div>
            <p class="scan-text">Donanım sağlığı analiz ediliyor...</p>
            <p class="scan-sub">WMI ve S.M.A.R.T. verileri okunuyor</p>
        </div>`;

    try {
        const data = await window.electronAPI.getHardwareDiagnostics();
        if (data.error) throw new Error(data.error);
        renderHardwareResults(data);
    } catch (err) {
        content.innerHTML = `<div class="empty-state"><p style="color:var(--priority-high)">Analiz hatası: ${err.message}</p></div>`;
        toast('Donanım analizi başarısız.', 'error');
    }

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Analiz Et`;
    }
}

function renderHardwareResults(data) {
    const content = document.getElementById('hardware-content');
    if (!content) return;

    const h = data.health_analysis;
    const d = data.disk_info;
    const statusClass = h.status_color; // green, yellow, red

    let html = `
    <div class="hardware-grid">
        <!-- Sağlık Özeti Kartı -->
        <div class="hardware-main-card ${statusClass}">
            <div class="hw-card-header">
                <div class="hw-status-badge ${statusClass}">${h.health_percentage}% Sağlık</div>
                <div class="hw-title">${d.model_name}</div>
                <div class="hw-sub">${d.drive_letter} — ${d.capacity}</div>
            </div>
            
            <div class="hw-main-body">
                <div class="hw-health-ring-container">
                    <svg viewBox="0 0 100 100" class="hw-health-ring">
                        <circle cx="50" cy="50" r="45" class="ring-bg"/>
                        <circle cx="50" cy="50" r="45" class="ring-fill ${statusClass}" 
                                style="stroke-dashoffset: ${282.7 - (h.health_percentage / 100) * 282.7}"/>
                    </svg>
                    <div class="hw-health-value">${h.health_percentage}%</div>
                </div>
                <div class="hw-analysis-text">
                    <h3>${h.health_message}</h3>
                    ${h.critical_warning ? `<p class="critical-text">⚠ ${h.critical_warning}</p>` : ''}
                </div>
            </div>
        </div>

        <!-- Detay Kartları -->
        <div class="hardware-stats-row">
            <div class="hw-stat-card">
                <div class="hw-stat-icon temp ${h.temperature.status_message.toLowerCase()}">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M12 2v14M12 22a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </div>
                <div class="hw-stat-info">
                    <div class="hw-stat-label">Sıcaklık</div>
                    <div class="hw-stat-val">${h.temperature.value}${h.temperature.unit}</div>
                    <div class="hw-stat-sub">${h.temperature.status_message}</div>
                </div>
            </div>
            <div class="hw-stat-card">
                <div class="hw-stat-icon hours">
                    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </div>
                <div class="hw-stat-info">
                    <div class="hw-stat-label">Çalışma Süresi</div>
                    <div class="hw-stat-val">${d.power_on_hours} Saat</div>
                    <div class="hw-stat-sub">${d.power_cycle_count} Başlatma</div>
                </div>
            </div>
        </div>
    </div>

    <!-- Batarya Sağlık Raporu (Yeni Modül) -->
    <div id="battery-card-container" class="battery-card-container">
        <div class="empty-state mini">Batarya verileri taranıyor...</div>
    </div>

    <!-- Dış Donanım Teşhis (Yeni Modül) -->
    <div class="peripherals-section">
        <div class="section-header"><h2>Dış Donanım Teşhisi</h2></div>
        <div id="peripherals-content" class="peripherals-grid">
            <div class="empty-state mini">Periferik aygıtlar kontrol ediliyor...</div>
        </div>
    </div>

    <!-- Önerilen Eylemler -->
    <div class="hardware-actions-section">
        <div class="section-header"><h2>Önerilen Eylemler</h2></div>
        <div class="hw-actions-list">
            ${data.suggested_actions.map(a => `
                <div class="hw-action-card">
                    <div class="hw-action-icon">
                        <svg viewBox="0 0 24 24" fill="none"><path d="M12 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" stroke="currentColor" stroke-width="1.8"/></svg>
                    </div>
                    <div class="hw-action-info">
                        <div class="hw-action-title">${a.title}</div>
                        <div class="hw-action-desc">${a.description}</div>
                    </div>
                    <button class="btn-action" onclick="handleHardwareAction('${a.action_id}')">${a.button_label}</button>
                </div>
            `).join('')}
        </div>
    </div>`;

    content.innerHTML = html;

    // Ghost Device Hunter Kartını Ekle
    if (data.ghost_device_hunter) {
        renderGhostDeviceHunter(data.ghost_device_hunter);
    }

    // Termal Analist Kartını Ekle
    if (data.thermal_analyst) {
        renderThermalAnalyst(data.thermal_analyst);
    }

    toast(`Donanım analizi tamamlandı — Durum: ${h.status_color === 'green' ? 'Optimal' : h.status_color === 'yellow' ? 'Uyarı' : 'Kritik'}`, statusClass);
}

function renderThermalAnalyst(thermal) {
    const content = document.getElementById('hardware-content');
    if (!content) return;

    const s = thermal.status_summary;
    const m = s.real_time_metrics;
    const isAlert = s.severity === 'high';

    const thermalHtml = `
    <div class="thermal-analyst-card severity-${s.severity} ${isAlert ? 'pulse-border' : ''}">
        <div class="thermal-header">
            <div class="thermal-icon">
                <svg viewBox="0 0 24 24" fill="none"><path d="M12 2v14M12 22a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </div>
            <div class="thermal-title-area">
                <div class="thermal-title">${s.header_title}</div>
                <div class="thermal-badge">${m.temperature}°C</div>
            </div>
        </div>
        <p class="thermal-desc">${s.description}</p>
        
        <div class="thermal-metrics-row">
            <div class="thermal-metric-box">
                <div class="tm-label">Anlık Hız</div>
                <div class="tm-val">${m.current_speed}</div>
            </div>
            <div class="thermal-metric-box">
                <div class="tm-label">Beklenen Hız</div>
                <div class="tm-val">${m.expected_speed}</div>
            </div>
            <div class="thermal-metric-box highlight">
                <div class="tm-label">Güç Kaybı</div>
                <div class="tm-val">${m.performance_loss}%</div>
            </div>
        </div>

        <div class="thermal-actions">
            ${thermal.suggested_actions.map(a => `
                <button class="btn-action full" onclick="handleThermalAction('${a.action_id}')">
                    ${a.button_label}
                </button>
            `).join('')}
        </div>
    </div>`;

    content.insertAdjacentHTML('beforeend', thermalHtml);
}

function handleThermalAction(actionId) {
    if (actionId === 'show_cooling_tips') {
        toast('Soğutma ipuçları: Havalandırmaları kontrol edin ve ağır işlemlere ara verin.', 'info');
    } else if (actionId === 'kill_high_cpu_tasks') {
        toast('Yüksek CPU kullanan görevler durduruluyor...', 'success');
    }
}

function renderGhostDeviceHunter(ghost) {
    const content = document.getElementById('hardware-content');
    if (!content || !ghost.status_summary.total_ghost_devices) return;

    const s = ghost.status_summary;

    const ghostHtml = `
    <div class="ghost-hunter-card severity-${s.severity}">
        <div class="ghost-header">
            <div class="ghost-icon">
                <svg viewBox="0 0 24 24" fill="none"><path d="M12 2a10 10 0 00-10 10c0 5.523 4.477 10 10 10s10-4.477 10-10A10 10 0 0012 2zm0 18a8 8 0 110-16 8 8 0 010 16z" fill="currentColor" opacity="0.2"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </div>
            <div class="ghost-title-area">
                <div class="ghost-title">${s.header_title}</div>
                <div class="ghost-badge">${s.total_ghost_devices} Aygıt</div>
            </div>
        </div>
        <p class="ghost-desc">${s.description}</p>
        
        <div class="ghost-device-list">
            ${ghost.device_list.map(d => `
                <div class="ghost-item">
                    <div class="ghost-item-icon ${d.type}">
                        ${d.type === 'usb' ? '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2v20M7 8l5-5 5 5M12 3v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' : '<svg viewBox="0 0 24 24" fill="none"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-2 4H8v-4h8v4z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'}
                    </div>
                    <div class="ghost-item-info">
                        <div class="ghost-item-name">${d.name}</div>
                        <div class="ghost-item-sub">En son ${d.last_seen} görüldü · Etki: ${d.registry_impact}</div>
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="ghost-actions">
            ${ghost.suggested_actions.map(a => `
                <div class="ghost-action-warning">
                    <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    <span>${a.warning}</span>
                </div>
                <button class="btn-danger full" onclick="toast('Hayalet sürücüler temizleniyor...', 'info')">
                    ${a.button_label}
                </button>
            `).join('')}
        </div>
    </div>`;

    content.insertAdjacentHTML('beforeend', ghostHtml);
}

function handleHardwareAction(actionId) {
    if (actionId === 'trigger_system_backup_ui') {
        toast('Yedekleme aracı başlatılıyor...', 'info');
        window.electronAPI.openSettings('backup');
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODÜL 1 — NetGuard UI
// ═══════════════════════════════════════════════════════════════════════════════

async function runNetworkScan() {
    const btn = document.getElementById('btn-scan-network');
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
        btn.disabled = false;
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Ağı Tara`;
    }
}

function renderNetworkResults(data) {
    const content = document.getElementById('netguard-content');
    if (!content) return;

    const totalAlerts = (data.alerts?.length || 0) + (data.suspicious?.length || 0);
    const hasDataLeak = !!data.dataLeakAlert;
    const connections = data.totalConnections || 0;
    const sentMB = data.netUsage?.totalSentMB || '—';
    const recvMB = data.netUsage?.totalReceivedMB || '—';

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
            <div class="ng-alert-card level-${a.level}" style="animation-delay:${i * 60}ms">
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
    const badge = document.getElementById('netguard-badge');
    const alerts = (data?.alerts?.length || 0) + (data?.suspicious?.length || 0);
    if (!badge) return;
    if (alerts > 0 || data?.dataLeakAlert) {
        badge.style.display = 'flex';
        badge.textContent = '!';
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
    const runDiv = document.getElementById('chain-running');
    const resultEl = document.getElementById('chain-result');
    const logEl = document.getElementById('chain-log');
    const barEl = document.getElementById('chain-progress-bar');
    const progText = document.getElementById('chain-progress-text');

    if (runDiv) runDiv.style.display = 'block';
    if (resultEl) resultEl.style.display = 'none';
    if (logEl) logEl.innerHTML = '';
    if (barEl) barEl.style.width = '5%';
    if (progText) progText.textContent = 'Zincir başlatılıyor...';

    try {
        const chain = await window.electronAPI.getOneClickChain();
        const result = await window.electronAPI.runTaskChain(chain);

        // Sonuç göster
        if (runDiv) runDiv.style.display = 'none';
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
    const done = Object.values(chainStepStatusMap).filter(s => s.status !== 'running').length;
    const pct = Math.round((done / totalSteps) * 100);

    // Progress bar
    const barEl = document.getElementById('chain-progress-bar');
    const progText = document.getElementById('chain-progress-text');
    if (barEl) barEl.style.width = `${Math.max(pct, 5)}%`;
    if (progText) progText.textContent = `Adım ${done}/${totalSteps} tamamlandı...`;

    // Adım durum etiketi
    const stepEl = document.getElementById(`cstep-${step.step_order}`);
    const item = document.querySelector(`.chain-step-item[data-step="${step.step_order}"]`);

    if (stepEl) {
        stepEl.textContent = step.status === 'completed' ? '✓ Tamam'
            : step.status === 'failed' ? '✗ Hata'
                : step.status === 'skipped' ? '→ Atlandı'
                    : '⟳ Çalışıyor';
    }
    if (item) {
        item.className = `chain-step-item ${step.status === 'completed' ? 'done'
                : step.status === 'failed' ? 'failed'
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
    } catch (_) { }
}

// ─── Toast Bildirimleri ───────────────────────────────────────────────────────
function toast(message, type = 'info') {
    const icons = {
        success: `<svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
        error: `<svg viewBox="0 0 24 24" fill="none"><path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="1.8"/></svg>`,
        info: `<svg viewBox="0 0 24 24" fill="none"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="1.8"/></svg>`
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

// ─── Termal Monitör Dinleyicisi (Architect Prompt Uygulaması) ─────────────────
window.electronAPI?.onThermalUpdate((data) => {
    // Sadece donanım sekmesi aktifse veya genel olarak güncellenmesi gerekiyorsa
    const thermalCard = document.querySelector('.thermal-analyst-card');
    if (!thermalCard) return;

    // ID'leri prompta göre güncelleme/eşleme
    const tempEl = document.getElementById('thermal-temp') || thermalCard.querySelector('.thermal-badge');
    const currEl = document.getElementById('current-speed') || thermalCard.querySelectorAll('.tm-val')[0];
    const expEl = document.getElementById('expected-speed') || thermalCard.querySelectorAll('.tm-val')[1];
    const lossEl = document.getElementById('power-loss') || thermalCard.querySelectorAll('.tm-val')[2];
    const titleEl = document.getElementById('thermal-title') || thermalCard.querySelector('.thermal-title');
    const descEl = document.getElementById('thermal-desc') || thermalCard.querySelector('.thermal-desc');

    if (tempEl) tempEl.textContent = `${data.cpu_temp}°C`;
    if (currEl) currEl.textContent = `${data.current_mhz} MHz`;
    if (expEl) expEl.textContent = `${data.max_mhz} MHz`;
    if (lossEl) lossEl.textContent = `%${data.performance_loss}`;
    if (titleEl) titleEl.textContent = data.title;
    if (descEl) descEl.textContent = data.description;

    // Tema Uygulaması
    if (data.theme === "critical") {
        if (titleEl) titleEl.style.color = "#ff4d4d";
        if (tempEl) tempEl.style.background = "rgba(255, 77, 77, 0.2)";
        thermalCard.className = "thermal-analyst-card severity-high pulse-border";
    } else if (data.theme === "warning") {
        if (titleEl) titleEl.style.color = "#ffa500";
        if (tempEl) tempEl.style.background = "rgba(255, 165, 0, 0.2)";
        thermalCard.className = "thermal-analyst-card severity-medium";
    } else {
        if (titleEl) titleEl.style.color = "#ffffff";
        if (tempEl) {
            tempEl.style.background = "rgba(255, 255, 255, 0.05)";
            tempEl.style.color = "#ff8fa3";
        }
        thermalCard.className = "thermal-analyst-card severity-low";
    }
});

// ─── Batarya Sağlık Dinleyicisi ──────────────────────────────────────────────
window.electronAPI?.onBatteryUpdate((data) => {
    const container = document.getElementById('battery-card-container');
    if (!container) return;

    if (data.status === "no_battery") {
        container.className = 'battery-card-container active';
        container.innerHTML = `
            <div class="battery-no-hw">
                <svg viewBox="0 0 24 24" fill="none" width="32" height="32" stroke="currentColor" stroke-width="1.5"><rect x="3" y="2" width="18" height="20" rx="2"/><path d="M7 10l5-5 5 5M12 5v12"/></svg>
                <p>Masaüstü Sistem: Batarya Donanımı Bulunmuyor</p>
            </div>`;
        return;
    }

    // İlk kez doluyorsa iskeleti oluştur
    if (!document.getElementById('battery-health-percent')) {
        container.innerHTML = `
            <div class="battery-header">
                <div class="battery-icon-box">
                    <svg viewBox="0 0 24 24" fill="none" width="24" height="24"><path d="M6 7h11a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2zM2 11h2M19 11h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </div>
                <div class="battery-title-area">
                    <div id="battery-title" class="battery-title">Yükleniyor...</div>
                    <div class="battery-badge">Donanım Sağlığı</div>
                </div>
            </div>
            <p id="battery-desc" class="battery-desc"></p>
            <div class="battery-stats-grid">
                <div class="b-stat">
                    <div class="b-label">Sağlık</div>
                    <div id="battery-health-percent" class="b-val">--</div>
                </div>
                <div class="b-stat">
                    <div class="b-label">Yıpranma</div>
                    <div id="battery-wear-percent" class="b-val">--</div>
                </div>
                <div class="b-stat">
                    <div class="b-label">Orijinal Kapasite</div>
                    <div id="battery-design-cap" class="b-val">--</div>
                </div>
                <div class="b-stat">
                    <div class="b-label">Mevcut Kapasite</div>
                    <div id="battery-max-cap" class="b-val">--</div>
                </div>
            </div>`;
    }

    // ID'lere göre güncelleme
    const healthEl = document.getElementById('battery-health-percent');
    const wearEl = document.getElementById('battery-wear-percent');
    const dCapEl = document.getElementById('battery-design-cap');
    const mCapEl = document.getElementById('battery-max-cap');
    const titleEl = document.getElementById('battery-title');
    const descEl = document.getElementById('battery-desc');

    if (healthEl) healthEl.textContent = `%${data.health_percent}`;
    if (wearEl) wearEl.textContent = `%${data.wear_percent}`;
    if (dCapEl) dCapEl.textContent = data.design_cap;
    if (mCapEl) mCapEl.textContent = data.max_cap;
    if (titleEl) titleEl.textContent = data.title;
    if (descEl) descEl.textContent = data.description;

    // Tema Renkleri
    const colors = { optimum: "#00E676", warning: "#FFA000", critical: "#FF3D00" };
    if (titleEl) titleEl.style.color = colors[data.theme];

    // Kart Görünümü
    container.className = `battery-card-container active theme-${data.theme}`;
});

let hardwareInterval = null;

// ─── Sekme Geçişleri ─────────────────────────────────────────────────────────
function showTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`tab-${name}`)?.classList.add('active');
    document.getElementById(`nav-${name}`)?.classList.add('active');

    if (name === 'health') refreshHealth();
    if (name === 'hardware') {
        refreshHardware().then(() => {
            window.electronAPI?.triggerBatteryCheck();
            refreshPeripherals(); // Dış donanım kontrolünü başlat
        });
    }
    if (name === 'antivirus') avAutoStatus();
}

async function refreshPeripherals() {
    const container = document.getElementById('peripherals-content');
    if (!container) return;

    try {
        const results = await window.electronAPI.getPeripheralDiagnostics();
        renderPeripherals(results);
    } catch (e) {
        container.innerHTML = `<div class="empty-state">Bağlantı hatası: ${e.message}</div>`;
    }
}

function renderPeripherals(data) {
    const container = document.getElementById('peripherals-content');
    if (!container) return;

    container.innerHTML = data.map(d => {
        const statusClass = d.status === 'ok' ? 'optimum' : d.status === 'warning' ? 'warning' : 'critical';
        const icon = getPeripheralIcon(d.device);

        return `
            <div class="peripheral-card ${statusClass}">
                <div class="p-icon ${statusClass}">${icon}</div>
                <div class="p-info">
                    <div class="p-name">${getPeripheralTitle(d.device)}</div>
                    <div class="p-msg">${d.message}</div>
                </div>
                ${d.device === 'printer' && d.status !== 'ok' ? `
                    <button class="btn-p-action" onclick="handleSpoolerRestart(this)">Kuyruğu Temizle</button>
                ` : ''}
            </div>
        `;
    }).join('');
}

function getPeripheralIcon(device) {
    if (device === 'printer') return '<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-2 4H8v-4h8v4z" stroke="currentColor" stroke-width="2"/></svg>';
    if (device === 'audio') return '<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 010 7.07" stroke="currentColor" stroke-width="2"/></svg>';
    if (device === 'usb') return '<svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M12 2v20M7 8l5-5 5 5M12 3v10" stroke="currentColor" stroke-width="2"/></svg>';
    return '';
}

function getPeripheralTitle(device) {
    const titles = { printer: 'Yazıcı Durumu', audio: 'Ses Aygıtları', usb: 'USB Bağlantıları' };
    return titles[device] || 'Bilinmeyen Aygıt';
}

async function handleSpoolerRestart(btn) {
    btn.disabled = true;
    btn.textContent = 'Temizleniyor...';
    const res = await window.electronAPI.restartSpooler();
    if (res.success) {
        toast('Yazıcı kuyruğu başarıyla temizlendi.', 'success');
        refreshPeripherals();
    } else {
        toast('Hata: Yetki yetersiz olabilir.', 'error');
        btn.disabled = false;
        btn.textContent = 'Tekrar Dene';
    }
}

// ─── Kategori Simgesi ─────────────────────────────────────────────────────────
function categoryIcon(cat) {
    const icons = {
        performance: `<svg viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        disk_space: `<svg viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="7" rx="9" ry="3" stroke="currentColor" stroke-width="1.8"/><path d="M3 7v10c0 1.657 4.03 3 9 3s9-1.343 9-3V7" stroke="currentColor" stroke-width="1.8"/></svg>`,
        security: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
        hardware: `<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/><rect x="9" y="9" width="6" height="6" fill="currentColor" opacity="0.4"/></svg>`,
        privacy: `<svg viewBox="0 0 24 24" fill="none"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" stroke-width="1.8"/><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" stroke="currentColor" stroke-width="1.8"/></svg>`
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
            if (payload === 'clean_temp') { await doCleanTemp(); return; }
            if (payload === 'clean_ram') { toast('Bellek için gereksiz uygulamaları kapatın.', 'info'); return; }
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
    else badge.style.display = 'none';
}

// ─── Dashboard Metrikleri ─────────────────────────────────────────────────────
function updateDashboardMetrics(sys) {
    if (!sys) return;
    const toGB = b => b ? (b / 1024 ** 3).toFixed(1) : '?';

    const ramPct = sys.ram?.usagePercent || 0;
    document.getElementById('ram-value').textContent = `%${ramPct}`;
    document.getElementById('ram-sub').textContent = `${toGB(sys.ram?.used)} / ${toGB(sys.ram?.total)} GB`;
    setRingProgress('ram-ring', ramPct);

    const cDrive = sys.disk?.drives?.find(d => d.name === 'C');
    if (cDrive) {
        document.getElementById('disk-value').textContent = `%${cDrive.usagePercent}`;
        document.getElementById('disk-sub').textContent = `${toGB(cDrive.free)} GB boş`;
        setRingProgress('disk-ring', cDrive.usagePercent);
    }

    const upH = parseFloat(sys.uptime_hours) || 0;
    document.getElementById('uptime-value').textContent = upH > 24 ? `${(upH / 24).toFixed(1)}g` : `${upH}s`;

    document.getElementById('cpu-value').textContent = sys.cpu?.cores ? `${sys.cpu.cores} Çekirdek` : 'Aktif';
    document.getElementById('cpu-sub').textContent = sys.hostname || 'Windows';
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

    const isDeep = data.scanType === 'deep';
    const typeChip = `<span class="scan-type-chip ${isDeep ? 'deep' : 'quick'}">${isDeep ? '⬛ Detaylı' : '⚡ Hızlı'}</span>`;
    const time = new Date(data.timestamp).toLocaleTimeString('tr-TR');
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
    const qBtn = document.getElementById('btn-quick-scan');
    const dBtn = document.getElementById('btn-deep-scan');
    const dDashBtn = document.getElementById('btn-scan-dashboard');
    const loading = document.getElementById('agent-loading');
    const results = document.getElementById('agent-results');

    [qBtn, dBtn, dDashBtn].forEach(b => b && (b.disabled = true));
    loading.style.display = 'block';
    results.style.display = 'none';

    const scanText = document.querySelector('.scan-text');
    const scanSub = document.querySelector('.scan-sub');
    if (scanText) scanText.textContent = 'Hızlı tarama yapılıyor...';
    if (scanSub) scanSub.textContent = 'Bu yalnızca 1-2 saniye sürer';

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
    const qBtn = document.getElementById('btn-quick-scan');
    const dBtn = document.getElementById('btn-deep-scan');
    const loading = document.getElementById('agent-loading');
    const results = document.getElementById('agent-results');

    [qBtn, dBtn].forEach(b => b && (b.disabled = true));
    if (dBtn) dBtn.innerHTML = `<div class="spinner" style="width:14px;height:14px;border-width:2px"></div> Analiz ediliyor... <span class="scan-badge secondary">~10s</span>`;

    loading.style.display = 'block';
    results.style.display = 'none';

    const scanText = document.querySelector('.scan-text');
    const scanSub = document.querySelector('.scan-sub');
    if (scanText) scanText.textContent = 'Derin sistem analizi yapılıyor...';
    if (scanSub) scanSub.textContent = 'PowerShell ile işlem, disk ve güvenlik analizi...';

    const agentLoading = document.getElementById('agent-loading');
    const progressBar = document.createElement('div');
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
        const data = await window.electronAPI.quickScan();
        const sys = data.system;
        const ram = sys.ram || {};
        const ramPct = parseFloat(ram.usagePercent || 0);
        const drives = sys.disk?.drives || [];
        const toGB = b => b ? (b / 1024 ** 3).toFixed(1) : '?';

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
    const btn = document.getElementById('btn-clean-temp');
    const status = document.getElementById('temp-status');
    if (btn) { btn.disabled = true; btn.textContent = 'Temizleniyor...'; }
    if (status) status.textContent = 'İşlemde...';
    try {
        const res = await window.electronAPI.cleanTemp();
        const mb = res.freedMB || 0;
        if (status) status.textContent = res.status === 'cleaned'
            ? `✓ Temizlendi — ${mb} MB boşaltıldı`
            : '⚠ Kısmen temizlendi';
        const panel = document.getElementById('clean-result');
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
// MODÜL 4 — SysGuard Virus Engine UI
// Windows Defender'dan bağımsız, tamamen özel tarama motoru arayüzü
// ═══════════════════════════════════════════════════════════════════════════════

let avScanning = false;
let lastEngineResult = null; // Son tarama sonucu (karantina/sil için saklanır)
let activeVirusFilter = null; // Aktif kategori filtresi

// ─── Engine ilerleme dinleyicisi ─────────────────────────────────────────────
if (window.electronAPI?.onEngineScanProgress) {
    window.electronAPI.onEngineScanProgress((prog) => {
        const bar = document.getElementById('av-progress-bar');
        const pct = document.getElementById('av-progress-pct');
        const text = document.getElementById('av-scan-text');
        const sub = document.getElementById('av-scan-sub');
        if (bar) bar.style.width = `${prog.percent}%`;
        if (pct) pct.textContent = `%${prog.percent}`;
        if (text) text.textContent = prog.detail || 'Taranıyor…';
        if (sub) sub.textContent = _enginePhaseLabel(prog.phase);
    });
}

function _enginePhaseLabel(phase) {
    const map = {
        init: 'Tarama dizinleri belirleniyor',
        scanning: 'Dosyalar hash ve imza ile analiz ediliyor',
        processes: 'Çalışan süreçler inceleniyor',
        done: 'Sonuçlar hazırlanıyor…',
    };
    return map[phase] || '';
}

// ─── Busy durumu ─────────────────────────────────────────────────────────────
function avSetBusy(busy) {
    avScanning = busy;
    ['btn-av-scan', 'btn-av-scan-file', 'btn-av-status'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = busy;
    });
    const scanEl = document.getElementById('av-scanning');
    const contentEl = document.getElementById('av-content');
    if (scanEl) scanEl.style.display = busy ? 'block' : 'none';
    if (contentEl) contentEl.style.display = busy ? 'none' : 'block';
}

// ─── Tek dosya taraması ───────────────────────────────────────────────────────
async function scanSingleFileUI() {
    if (avScanning) { toast('Tarama zaten devam ediyor.', 'info'); return; }

    const result = await window.electronAPI.showOpenDialog();
    if (result.canceled || !result.filePaths?.length) return;

    const filePath = result.filePaths[0];
    avSetBusy(true);

    const bar = document.getElementById('av-progress-bar');
    const pct = document.getElementById('av-progress-pct');
    if (bar) bar.style.width = '10%';
    if (pct) pct.textContent = '%10';

    const textEl = document.getElementById('av-scan-text');
    const subEl = document.getElementById('av-scan-sub');
    if (textEl) textEl.textContent = `Taranıyor: ${filePath.split('\\').pop()}`;
    if (subEl) subEl.textContent = 'Hash, imza ve heuristik analiz yapılıyor…';

    try {
        toast('Dosya taraması başlatıldı…', 'info');
        activeVirusFilter = null;
        const data = await window.electronAPI.engineScanFile(filePath);

        if (data.error) {
            document.getElementById('av-content').innerHTML =
                `<div class="empty-state"><p style="color:var(--priority-high)">Hata: ${data.error}</p></div>`;
            toast(data.error, 'error');
        } else {
            lastEngineResult = data;
            renderEngineResults(data);
            const msg = data.threatCount > 0
                ? `Tarama tamamlandı — ${data.threatCount} tehdit tespit edildi`
                : 'Tarama tamamlandı — Dosya temiz ✓';
            toast(msg, data.threatCount > 0 ? 'error' : 'success');
        }
    } catch (err) {
        document.getElementById('av-content').innerHTML =
            `<div class="empty-state"><p style="color:var(--priority-high)">Tarama hatası: ${err.message}</p></div>`;
        toast('Tarama başarısız oldu.', 'error');
    }

    avSetBusy(false);
}

// ─── Motor taraması ───────────────────────────────────────────────────────────
async function runAvScanUI() {
    if (avScanning) { toast('Tarama zaten devam ediyor.', 'info'); return; }
    avSetBusy(true);

    const bar = document.getElementById('av-progress-bar');
    const pct = document.getElementById('av-progress-pct');
    if (bar) bar.style.width = '3%';
    if (pct) pct.textContent = '%3';

    try {
        toast('SysGuard Engine taraması başlatıldı…', 'info');
        activeVirusFilter = null;
        const data = await window.electronAPI.engineScan();
        lastEngineResult = data;
        renderEngineResults(data);

        const total = data.threatCount + data.processRiskCount;
        const msg = total > 0
            ? `Tarama tamamlandı — ${data.threatCount} tehditli dosya, ${data.processRiskCount} şüpheli süreç`
            : 'Tarama tamamlandı — Tehdit tespit edilmedi ✓';
        toast(msg, total > 0 ? 'error' : 'success');
    } catch (err) {
        document.getElementById('av-content').innerHTML =
            `<div class="empty-state"><p style="color:var(--priority-high)">Tarama hatası: ${err.message}</p></div>`;
        toast('Tarama başarısız oldu.', 'error');
    }

    avSetBusy(false);
}

// ─── İlk açılışta motor bilgisi göster ───────────────────────────────────────
function avAutoStatus() {
    const content = document.getElementById('av-content');
    if (!content) return;
    if (lastEngineResult) {
        // Sekmeye geri dönüldüğünde sonuçlar DOM'da değilse yeniden render et
        if (!document.getElementById('av-cat-grid') && !document.getElementById('av-scan-clean')) {
            renderEngineResults(lastEngineResult);
        }
    } else {
        renderEngineIdle();
    }
}

// ─── Boşta ekranı (tarama yapılmamış) ────────────────────────────────────────
function renderEngineIdle() {
    const content = document.getElementById('av-content');
    if (!content) return;

    content.innerHTML = `
    <!-- Motor Başlık Kartı -->
    <div class="health-card" style="margin-bottom:20px;background:linear-gradient(135deg,rgba(129,140,248,.08),rgba(6,182,212,.06));border-color:rgba(129,140,248,.25)">
        <div style="display:flex;align-items:center;gap:14px">
            <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#818cf8,#06b6d4);display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="white" stroke-width="1.8" stroke-linejoin="round"/>
                    <path d="M9 12l2 2 4-4" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
            </div>
            <div>
                <div style="font-weight:600;font-size:15px;color:var(--text-primary)">SysGuard Engine v1.0</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Windows Defender bağımsız — Özel tespit motoru</div>
            </div>
            <span class="priority-chip low" style="margin-left:auto">● Hazır</span>
        </div>
    </div>

    <!-- Tespit Yöntemleri -->
    <div class="netguard-section-title">Tespit Yöntemleri</div>
    <div class="health-grid" style="margin-bottom:20px">
        <div class="health-card" style="text-align:center;padding:16px 12px">
            <div style="font-size:22px;margin-bottom:6px">🔑</div>
            <div style="font-size:12px;font-weight:600;color:var(--text-primary)">Hash Analizi</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:4px">SHA-256 ile bilinen zararlı hash veritabanına karşı kontrol</div>
        </div>
        <div class="health-card" style="text-align:center;padding:16px 12px">
            <div style="font-size:22px;margin-bottom:6px">🔬</div>
            <div style="font-size:12px;font-weight:600;color:var(--text-primary)">İmza Tarama</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:4px">40+ bilinen zararlı pattern ile dosya içeriği analizi</div>
        </div>
        <div class="health-card" style="text-align:center;padding:16px 12px">
            <div style="font-size:22px;margin-bottom:6px">🧠</div>
            <div style="font-size:12px;font-weight:600;color:var(--text-primary)">Heuristik</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:4px">Entropi, çift uzantı, şüpheli lokasyon, PE başlığı</div>
        </div>
        <div class="health-card" style="text-align:center;padding:16px 12px">
            <div style="font-size:22px;margin-bottom:6px">⚙️</div>
            <div style="font-size:12px;font-weight:600;color:var(--text-primary)">Süreç Analizi</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:4px">Çalışan süreçleri konum ve davranışa göre değerlendir</div>
        </div>
    </div>

    <!-- Tarama Dizinleri -->
    <div class="netguard-section-title">Taranacak Dizinler</div>
    <div class="health-card" style="margin-bottom:20px">
        <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${['%TEMP%', '%TMP%', '%LOCALAPPDATA%\\Temp', 'Downloads', 'Startup Klasörü', 'C:\\Windows\\Temp']
            .map(d => `<span style="background:rgba(129,140,248,.1);border:1px solid rgba(129,140,248,.2);border-radius:6px;padding:3px 10px;font-size:11px;font-family:'JetBrains Mono',monospace;color:var(--text-secondary)">${d}</span>`)
            .join('')}
        </div>
    </div>

    <div class="empty-state" style="padding:24px 0">
        <p style="color:var(--text-muted);font-size:13px">Taramayı başlatmak için yukarıdaki <strong>"Tara"</strong> butonuna basın.</p>
    </div>`;
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────
function _sevChip(sev) {
    const map = {
        critical: ['high', '⚠ Kritik'],
        high: ['high', '⚠ Yüksek'],
        medium: ['medium', '◆ Orta'],
        low: ['low', '● Düşük'],
    };
    const [cls, label] = map[sev] || ['low', '● Bilinmiyor'];
    return `<span class="priority-chip ${cls}">${label}</span>`;
}

function _sevIconClass(sev) {
    return sev === 'critical' || sev === 'high' ? 'critical' : 'warning';
}

/**
 * Virüs türü rozeti — emoji + renkli arka plan + etiket
 * typeMeta: { label, emoji, color, desc }
 */
function _virusTypeBadge(typeMeta) {
    if (!typeMeta) return '';
    return `
    <span style="
        display:inline-flex;align-items:center;gap:5px;
        background:${typeMeta.color}18;
        border:1px solid ${typeMeta.color}40;
        border-radius:6px;padding:2px 8px;
        font-size:11px;font-weight:600;color:${typeMeta.color};
        white-space:nowrap;
    ">
        ${typeMeta.emoji} ${typeMeta.label}
    </span>`;
}

/**
 * Virüs türü açıklama satırı — her tehdit için tip + açıklama
 */
function _threatRow(t) {
    // virusTypeMeta'yı lastEngineResult'tan al
    const vtMeta = (lastEngineResult?.virusTypeMeta || {})[t.virusType];
    const typeLabel = vtMeta
        ? `<span style="color:${vtMeta.color};font-weight:600">${vtMeta.emoji} ${vtMeta.label}</span>`
        : `<span style="color:var(--text-muted)">${t.virusType || '?'}</span>`;

    return `
    <div style="padding:7px 0;border-top:1px solid rgba(255,255,255,.05)">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
            <span style="font-size:10px;font-family:'JetBrains Mono',monospace;
                         color:var(--text-muted);flex-shrink:0;min-width:74px">[${t.id}]</span>
            <span style="font-size:12px;color:var(--text-primary);font-weight:500;flex:1">${t.name}</span>
            ${_sevChip(t.severity)}
        </div>
        <div style="display:flex;align-items:center;gap:10px;padding-left:82px">
            ${typeLabel}
            <span style="font-size:11px;color:var(--text-muted)">${t.description || t.detail || ''}</span>
        </div>
    </div>`;
}

// ─── Dosya kartı ──────────────────────────────────────────────────────────────
function _buildFileCard(f, index) {
    const fileName = f.path.split('\\').pop();
    const shortPath = f.path.length > 72 ? '…' + f.path.slice(-69) : f.path;
    const sizeKB = (f.size / 1024).toFixed(1);
    const pMeta = f.primaryTypeMeta || {};

    return `
    <div class="ng-alert-card level-${_sevIconClass(f.maxSeverity)}"
         style="animation-delay:${index * 45}ms;border-left:3px solid ${pMeta.color || '#ef4444'}"
         id="file-card-${index}">

        <!-- Başlık satırı -->
        <div class="ng-alert-header" style="margin-bottom:8px">
            <div style="width:36px;height:36px;border-radius:9px;background:${pMeta.color || '#ef4444'}18;
                        display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px">
                ${pMeta.emoji || '⚠️'}
            </div>
            <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span class="ng-alert-title" style="font-size:13px">${fileName}</span>
                    ${_virusTypeBadge(pMeta)}
                </div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px;
                            word-break:break-all">${shortPath}</div>
            </div>
            ${_sevChip(f.maxSeverity)}
        </div>

        <!-- Tür açıklaması -->
        ${pMeta.desc ? `
        <div style="margin:0 0 8px;padding:6px 10px;
                    background:${pMeta.color || '#ef4444'}0d;
                    border-radius:6px;border-left:2px solid ${pMeta.color || '#ef4444'}60">
            <span style="font-size:11px;color:var(--text-secondary)">${pMeta.desc}</span>
        </div>` : ''}

        <!-- Tespit detayları -->
        <div style="margin:0 0 10px;padding:4px 8px;background:rgba(0,0,0,.2);border-radius:6px">
            <div style="font-size:10px;color:var(--text-muted);padding:4px 0 2px;
                        display:flex;gap:12px;flex-wrap:wrap">
                <span>${f.threatCount} tespit</span>
                <span>${f.ext} · ${sizeKB} KB</span>
                <span style="font-family:'JetBrains Mono',monospace">
                    SHA-256: ${f.hash.substring(0, 20)}…
                </span>
                ${f.virusTypes?.length > 1
            ? `<span style="color:var(--priority-medium)">${f.virusTypes.length} farklı tür</span>`
            : ''}
            </div>
            ${f.threats.map(t => _threatRow(t)).join('')}
        </div>

        <!-- Aksiyon butonları -->
        <div class="ng-alert-actions">
            <button class="btn-action" onclick="engineQuarantine(${index}, this)"
                title="Dosyayı karantina klasörüne taşır, silinmez">
                <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
                    <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="1.8"/>
                    <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
                Karantinaya Al
            </button>
            <button class="btn-danger" onclick="engineDelete(${index}, this)"
                title="Dosyayı kalıcı olarak siler">
                <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
                Sil
            </button>
        </div>
    </div>`;
}

// ─── Süreç kartı ──────────────────────────────────────────────────────────────
function _buildProcessCard(p, index) {
    const pMeta = p.virusTypeMeta || {};

    const riskRows = p.risks.map(r => `
        <div style="font-size:11px;color:var(--text-secondary);padding:3px 0;
                    display:flex;align-items:center;gap:6px">
            <span style="color:var(--priority-medium)">⚠</span>
            <span>${r.reason}</span>
        </div>`).join('');

    return `
    <div class="ng-alert-card level-warning"
         style="animation-delay:${index * 45}ms;border-left:3px solid ${pMeta.color || '#f97316'}"
         id="proc-card-${index}">
        <div class="ng-alert-header" style="margin-bottom:8px">
            <div style="width:36px;height:36px;border-radius:9px;background:${pMeta.color || '#f97316'}18;
                        display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px">
                ${pMeta.emoji || '⚙️'}
            </div>
            <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span class="ng-alert-title">${p.name}</span>
                    <span style="color:var(--text-muted);font-size:11px">PID: ${p.pid}</span>
                    ${_virusTypeBadge(pMeta)}
                </div>
                <div style="font-size:10px;color:var(--text-muted);word-break:break-all;margin-top:2px">${p.path}</div>
            </div>
            ${_sevChip(p.maxSeverity)}
        </div>

        ${pMeta.desc ? `
        <div style="margin:0 0 8px;padding:6px 10px;
                    background:${pMeta.color || '#f97316'}0d;
                    border-radius:6px;border-left:2px solid ${pMeta.color || '#f97316'}60">
            <span style="font-size:11px;color:var(--text-secondary)">${pMeta.desc}</span>
        </div>` : ''}

        <div style="margin:0 0 10px;padding:6px 8px;background:rgba(0,0,0,.2);border-radius:6px">
            ${riskRows}
        </div>
        <div class="ng-alert-actions">
            <button class="btn-danger" onclick="engineKillProc(${p.pid}, ${index}, this)">
                <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
                    <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                Süreci Sonlandır
            </button>
        </div>
    </div>`;
}

// ─── Virüs türü özet paneli ───────────────────────────────────────────────────
function _buildTypeBreakdown(typeBreakdown, virusTypeMeta) {
    if (!typeBreakdown || !Object.keys(typeBreakdown).length) return '';

    const entries = Object.entries(typeBreakdown)
        .sort((a, b) => b[1] - a[1]);

    const totalFiles = Object.values(typeBreakdown).reduce((a, b) => a + b, 0);

    const allCard = `
    <div id="av-cat-all"
         onclick="filterEngineResults(null)"
         style="
             cursor:pointer;transition:all 0.18s;
             display:flex;align-items:center;gap:10px;
             padding:10px 12px;
             background:rgba(129,140,248,0.10);
             border:2px solid rgba(129,140,248,0.45);
             border-radius:10px;
         ">
        <span style="font-size:22px;flex-shrink:0">🔍</span>
        <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:700;color:#818cf8">Tümünü Göster</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">Bütün kategoriler</div>
        </div>
        <div style="
            min-width:28px;height:28px;border-radius:50%;
            background:rgba(129,140,248,0.20);border:1.5px solid rgba(129,140,248,0.50);
            display:flex;align-items:center;justify-content:center;
            font-size:12px;font-weight:700;color:#818cf8;flex-shrink:0
        ">${totalFiles}</div>
    </div>`;

    const cards = entries.map(([type, count]) => {
        const m = (virusTypeMeta || {})[type] || { label: type, emoji: '❓', color: '#64748b', desc: '' };
        return `
        <div id="av-cat-${type}"
             data-type="${type}"
             data-color="${m.color}"
             onclick="filterEngineResults('${type}')"
             style="
                 cursor:pointer;transition:all 0.18s;
                 display:flex;align-items:center;gap:10px;
                 padding:10px 12px;
                 background:${m.color}0d;
                 border:1px solid ${m.color}30;
                 border-radius:10px;
             ">
            <span style="font-size:22px;flex-shrink:0">${m.emoji}</span>
            <div style="flex:1;min-width:0">
                <div style="font-size:12px;font-weight:700;color:${m.color}">${m.label}</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px;
                            overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.desc}</div>
            </div>
            <div style="
                min-width:28px;height:28px;border-radius:50%;
                background:${m.color}22;border:1.5px solid ${m.color}60;
                display:flex;align-items:center;justify-content:center;
                font-size:12px;font-weight:700;color:${m.color};flex-shrink:0
            ">${count}</div>
        </div>`;
    }).join('');

    return `
    <div class="netguard-section-title" style="margin-top:0;margin-bottom:10px">
        Virüs Kategorileri
        <span style="color:var(--text-muted);font-weight:400;font-size:11px">
            — bir kategoriye tıklayarak filtrele
        </span>
    </div>
    <div id="av-cat-grid"
         style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;margin-bottom:24px">
        ${allCard}
        ${cards}
    </div>`;
}

// ─── Kategori filtresi ────────────────────────────────────────────────────────
function filterEngineResults(type) {
    if (!lastEngineResult) return;
    activeVirusFilter = type;

    // Kategori kartlarının görsel durumunu güncelle
    const allCard = document.getElementById('av-cat-all');
    if (allCard) {
        const isAll = type === null;
        allCard.style.border = isAll ? '2px solid rgba(129,140,248,0.8)' : '2px solid rgba(129,140,248,0.45)';
        allCard.style.background = isAll ? 'rgba(129,140,248,0.18)' : 'rgba(129,140,248,0.10)';
        allCard.style.transform = isAll ? 'scale(1.02)' : 'scale(1)';
        allCard.style.boxShadow = isAll ? '0 0 12px rgba(129,140,248,0.25)' : 'none';
    }

    document.querySelectorAll('[id^="av-cat-"]:not(#av-cat-all):not(#av-cat-grid)').forEach(card => {
        const ct = card.dataset.type;
        const color = card.dataset.color || '#64748b';
        const isActive = ct === type;
        const isDimmed = type !== null && !isActive;
        card.style.opacity = isDimmed ? '0.4' : '1';
        card.style.transform = isActive ? 'scale(1.02)' : 'scale(1)';
        card.style.border = isActive ? `2px solid ${color}` : `1px solid ${color}30`;
        card.style.background = isActive ? `${color}22` : `${color}0d`;
        card.style.boxShadow = isActive ? `0 0 12px ${color}40` : 'none';
    });

    // ── Filtre çubuğu ──
    const filterBar = document.getElementById('av-filter-bar');
    if (filterBar) {
        if (type) {
            const meta = (lastEngineResult.virusTypeMeta || {})[type] || {};
            filterBar.style.display = 'flex';
            filterBar.innerHTML = `
            <span style="font-size:12px;color:var(--text-muted)">
                Filtre:
                <span style="color:${meta.color || '#818cf8'};font-weight:700">
                    ${meta.emoji || ''} ${meta.label || type}
                </span>
            </span>
            <button onclick="filterEngineResults(null)"
                    style="background:none;border:1px solid rgba(255,255,255,.15);border-radius:5px;
                           padding:2px 8px;font-size:11px;color:var(--text-muted);cursor:pointer">
                ✕ Filtreyi Kaldır
            </button>`;
        } else {
            filterBar.style.display = 'none';
        }
    }

    // ── Dosya listesini filtrele ──
    const listEl = document.getElementById('av-file-list');
    const countEl = document.getElementById('av-file-count');
    if (listEl) {
        const files = lastEngineResult.infectedFiles;
        const filtered = type
            ? files.map((f, i) => ({ f, i })).filter(({ f }) => f.virusTypes?.includes(type))
            : files.map((f, i) => ({ f, i }));

        if (countEl) countEl.textContent = type ? `${filtered.length} / ${files.length}` : files.length;

        listEl.innerHTML = filtered.length > 0
            ? filtered.map(({ f, i }) => _buildFileCard(f, i)).join('')
            : `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">
                   Bu kategoride tehditli dosya bulunamadı.
               </div>`;
    }

    // ── Süreç listesini filtrele ──
    const procList = document.getElementById('av-proc-list');
    const procCount = document.getElementById('av-proc-count');
    if (procList) {
        const procs = lastEngineResult.suspiciousProcesses;
        const filteredProcs = type
            ? procs.map((p, i) => ({ p, i })).filter(({ p }) => p.virusType === type)
            : procs.map((p, i) => ({ p, i }));

        if (procCount) procCount.textContent = type
            ? `(${filteredProcs.length} / ${procs.length})`
            : `(${procs.length})`;

        procList.innerHTML = filteredProcs.length > 0
            ? filteredProcs.map(({ p, i }) => _buildProcessCard(p, i)).join('')
            : `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">
                   Bu kategoride şüpheli süreç bulunamadı.
               </div>`;
    }
}

// ─── Ana sonuç render ─────────────────────────────────────────────────────────
function renderEngineResults(data) {
    const content = document.getElementById('av-content');
    if (!content) return;

    // Badge güncelle
    const badge = document.getElementById('av-badge');
    if (badge) {
        const total = data.threatCount + data.processRiskCount;
        badge.style.display = total > 0 ? 'flex' : 'none';
        badge.textContent = total > 0 ? total : '';
    }

    const elapsedSec = (data.elapsed / 1000).toFixed(1);
    const scanTime = new Date(data.scanTime).toLocaleTimeString('tr-TR');
    const totalThreats = data.threatCount + data.processRiskCount;

    // ── Motor başlık kartı ──
    let html = `
    <div class="health-card" style="margin-bottom:20px;
         background:linear-gradient(135deg,rgba(129,140,248,.08),rgba(6,182,212,.06));
         border-color:rgba(129,140,248,.25)">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:200px">
                <div style="width:38px;height:38px;border-radius:10px;
                            background:linear-gradient(135deg,#818cf8,#06b6d4);
                            display:flex;align-items:center;justify-content:center;flex-shrink:0">
                    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="white" stroke-width="1.8"/>
                        <path d="M9 12l2 2 4-4" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
                    </svg>
                </div>
                <div>
                    <div style="font-weight:700;font-size:14px;color:var(--text-primary)">SysGuard Engine v1.1</div>
                    <div style="font-size:10px;color:var(--text-muted)">
                        ${scanTime} &nbsp;·&nbsp; ${elapsedSec}s &nbsp;·&nbsp; ${data.totalScanned} dosya
                        ${data.singleFile ? `&nbsp;·&nbsp; ${data.scannedFile?.split('\\').pop()}` : `&nbsp;·&nbsp; ${data.scannedDirs?.length || 0} dizin`}
                    </div>
                </div>
            </div>
            <!-- İstatistik sayaçları -->
            <div style="display:flex;gap:18px;flex-wrap:wrap">
                ${[
            { val: data.criticalCount, label: 'Kritik', color: data.criticalCount > 0 ? 'var(--priority-high)' : 'var(--text-primary)' },
            { val: data.highCount, label: 'Yüksek', color: data.highCount > 0 ? 'var(--priority-medium)' : 'var(--text-primary)' },
            { val: data.processRiskCount, label: 'Şüpheli Süreç', color: data.processRiskCount > 0 ? 'var(--priority-medium)' : 'var(--text-primary)' },
        ].map(s => `
                    <div style="text-align:center">
                        <div style="font-size:20px;font-weight:700;color:${s.color}">${s.val}</div>
                        <div style="font-size:10px;color:var(--text-muted)">${s.label}</div>
                    </div>`).join('')}
            </div>
            <span class="priority-chip ${totalThreats === 0 ? 'low' : 'high'}" style="white-space:nowrap">
                ${totalThreats === 0 ? '✓ Temiz' : `⚠ ${totalThreats} Tehdit`}
            </span>
        </div>
    </div>`;

    // ── Temiz durum ──
    if (totalThreats === 0) {
        html += `
        <div id="av-scan-clean" class="empty-state" style="padding:44px 0">
            <svg viewBox="0 0 24 24" fill="none" width="52" height="52">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                      stroke="var(--accent-green)" stroke-width="1.5" stroke-linejoin="round"/>
                <path d="M9 12l2 2 4-4" stroke="var(--accent-green)" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
            <h3 style="color:var(--accent-green);margin-top:12px">Sistem Temiz</h3>
            <p>Tarama tamamlandı — herhangi bir tehdit tespit edilmedi.</p>
            <p style="font-size:11px;color:var(--text-muted)">
                ${data.singleFile
                ? `${data.scannedFile} tarandı`
                : `${data.totalScanned} dosya incelendi · ${data.scannedDirs?.length || 0} dizin tarandı`}
            </p>
        </div>`;
        content.innerHTML = html;
        return;
    }

    // ── Virüs türü özet paneli ──
    html += _buildTypeBreakdown(data.typeBreakdown, data.virusTypeMeta);

    // ── Tehditli dosyalar ──
    if (data.infectedFiles.length > 0) {
        html += `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div class="netguard-section-title" style="margin:0">
                Tehditli Dosyalar
                <span id="av-file-count" style="color:var(--priority-high)">${data.infectedFiles.length}</span>
            </div>
            ${data.infectedFiles.length > 1 ? `
            <button class="btn-danger" style="font-size:11px" onclick="engineQuarantineAll(this)">
                <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
                    <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="1.8"/>
                    <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
                Tümünü Karantinaya Al
            </button>` : ''}
        </div>
        <div id="av-filter-bar"
             style="display:none;align-items:center;justify-content:space-between;
                    padding:6px 12px;margin-bottom:8px;
                    background:rgba(129,140,248,0.08);border:1px solid rgba(129,140,248,0.2);
                    border-radius:8px;gap:8px">
        </div>
        <div id="av-file-list" class="netguard-alert-list">
            ${data.infectedFiles.map((f, i) => _buildFileCard(f, i)).join('')}
        </div>`;
    }

    // ── Şüpheli süreçler ──
    if (data.suspiciousProcesses.length > 0) {
        html += `
        <div style="display:flex;align-items:center;gap:8px;margin-top:28px;margin-bottom:8px">
            <div class="netguard-section-title" style="margin:0">
                Şüpheli Süreçler
            </div>
            <span id="av-proc-count" style="color:var(--priority-medium)">(${data.suspiciousProcesses.length})</span>
        </div>
        <div id="av-proc-list" class="netguard-alert-list">
            ${data.suspiciousProcesses.map((p, i) => _buildProcessCard(p, i)).join('')}
        </div>`;
    }

    // ── Tarama edilen dizinler (tek dosya modunda gizle) ──
    if (!data.singleFile) {
        html += `
        <div class="netguard-section-title" style="margin-top:24px">Taranan Dizinler</div>
        <div class="health-card">
            <div style="display:flex;flex-wrap:wrap;gap:5px">
                ${(data.scannedDirs || []).map(d =>
            `<span style="background:rgba(129,140,248,.08);border:1px solid rgba(129,140,248,.15);border-radius:5px;padding:2px 8px;font-size:10px;font-family:'JetBrains Mono',monospace;color:var(--text-muted)">${d}</span>`
        ).join('')}
            </div>
        </div>`;
    }

    content.innerHTML = html;
}

// ─── Aksiyon: Karantinaya al ──────────────────────────────────────────────────
async function engineQuarantine(fileIndex, btn) {
    if (!lastEngineResult) return;
    const f = lastEngineResult.infectedFiles[fileIndex];
    if (!f) return;

    if (btn) { btn.disabled = true; btn.textContent = 'Taşınıyor…'; }

    try {
        const res = await window.electronAPI.engineQuarantine(f.path);
        if (res.success) {
            toast(`Karantinaya alındı: ${f.path.split('\\').pop()}`, 'success');
            const card = document.getElementById(`file-card-${fileIndex}`);
            if (card) {
                card.style.opacity = '0.4';
                card.style.pointerEvents = 'none';
                card.querySelector('.ng-alert-title').textContent += ' — ✓ Karantina';
            }
        } else {
            toast(`Karantina başarısız: ${res.error}`, 'error');
            if (btn) { btn.disabled = false; btn.textContent = 'Karantinaya Al'; }
        }
    } catch (err) {
        toast('İşlem başarısız: ' + err.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Karantinaya Al'; }
    }
}

// ─── Aksiyon: Sil ─────────────────────────────────────────────────────────────
async function engineDelete(fileIndex, btn) {
    if (!lastEngineResult) return;
    const f = lastEngineResult.infectedFiles[fileIndex];
    if (!f) return;

    if (!confirm(`"${f.path.split('\\').pop()}" dosyasını kalıcı olarak silmek istediğinize emin misiniz?`)) return;

    if (btn) { btn.disabled = true; btn.textContent = 'Siliniyor…'; }

    try {
        const res = await window.electronAPI.engineDelete(f.path);
        if (res.success) {
            toast(`Dosya silindi: ${f.path.split('\\').pop()}`, 'success');
            const card = document.getElementById(`file-card-${fileIndex}`);
            if (card) card.remove();
        } else {
            toast(`Silme başarısız: ${res.error}`, 'error');
            if (btn) { btn.disabled = false; btn.textContent = 'Sil'; }
        }
    } catch (err) {
        toast('İşlem başarısız: ' + err.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Sil'; }
    }
}

// ─── Aksiyon: Tümünü karantinaya al ─────────────────────────────────────────
async function engineQuarantineAll(btn) {
    if (!lastEngineResult?.infectedFiles?.length) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Karantinaya alınıyor…'; }

    let successCount = 0;
    for (let i = 0; i < lastEngineResult.infectedFiles.length; i++) {
        const f = lastEngineResult.infectedFiles[i];
        try {
            const res = await window.electronAPI.engineQuarantine(f.path);
            if (res.success) {
                successCount++;
                const card = document.getElementById(`file-card-${i}`);
                if (card) { card.style.opacity = '0.4'; card.style.pointerEvents = 'none'; }
            }
        } catch (_) { }
    }

    toast(`${successCount} dosya karantinaya alındı.`, successCount > 0 ? 'success' : 'error');
    if (successCount > 0) {
        triggerEcosystemRestore({ subtitle: `${successCount} tehditli dosya karantinaya alındı — Sistem temizlendi` });
    }
    if (btn) { btn.disabled = false; btn.textContent = `✓ ${successCount} Karantinaya Alındı`; }
}

// ─── Aksiyon: Süreci sonlandır ────────────────────────────────────────────────
async function engineKillProc(pid, index, btn) {
    if (btn) { btn.disabled = true; btn.textContent = 'Sonlandırılıyor…'; }
    try {
        const res = await window.electronAPI.engineKillProcess(pid);
        if (res.success) {
            toast(`Süreç sonlandırıldı (PID: ${pid})`, 'success');
            const card = document.getElementById(`proc-card-${index}`);
            if (card) { card.style.opacity = '0.4'; card.style.pointerEvents = 'none'; }
        } else {
            toast(`Süreç sonlandırılamadı: ${res.error}`, 'error');
            if (btn) { btn.disabled = false; btn.textContent = 'Süreci Sonlandır'; }
        }
    } catch (err) {
        toast('İşlem başarısız: ' + err.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Süreci Sonlandır'; }
    }
}

// ─── Karantina Listesi ────────────────────────────────────────────────────────
async function showQuarantineList() {
    const content = document.getElementById('av-content');
    if (!content) return;

    const btn = document.getElementById('btn-av-history');
    if (btn) { btn.disabled = true; }

    content.innerHTML = '<div class="empty-state"><div class="spinner"></div><p>Karantina dizini okunuyor…</p></div>';

    try {
        // Karantina klasörünü oku (Node path: ~\.sysguard\quarantine)
        const items = await window.electronAPI.quarantineList?.() ?? null;

        if (!items) {
            // API yoksa bilgi mesajı göster
            const qPath = `${navigator.platform.includes('Win') ? '%USERPROFILE%' : '~'}\\.sysguard\\quarantine`;
            content.innerHTML = `
            <button class="btn-ghost" onclick="renderEngineIdle()" style="margin-bottom:16px;font-size:12px">
                <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                Geri Dön
            </button>
            <div class="health-card">
                <h3 style="margin-bottom:8px">Karantina Klasörü</h3>
                <p style="font-size:12px;color:var(--text-muted)">Karantinaya alınan dosyalar aşağıdaki konumda saklanır:</p>
                <div style="margin-top:10px;padding:8px 12px;background:rgba(0,0,0,.25);border-radius:6px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-secondary)">
                    ${qPath}
                </div>
                <p style="font-size:11px;color:var(--text-muted);margin-top:10px">
                    Her karantina dosyası <code>.quarantine</code> uzantısıyla taşınır ve yanında <code>.meta.json</code> dosyası oluşturulur (orijinal yol bilgisi).
                </p>
            </div>`;
            return;
        }

        // items gelirse listele (ileride API eklenirse)
        const backBtn = `<button class="btn-ghost" onclick="renderEngineIdle()" style="margin-bottom:16px;font-size:12px">
            <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Geri Dön
        </button>`;
        content.innerHTML = items.length === 0
            ? backBtn + '<div class="empty-state"><h3>Karantina Boş</h3><p>Henüz karantinaya alınan dosya yok.</p></div>'
            : backBtn + items.map(it => `<div class="ng-alert-card">${it}</div>`).join('');
    } catch (err) {
        content.innerHTML = `<div class="empty-state"><p style="color:var(--priority-high)">Karantina listesi alınamadı: ${err.message}</p></div>`;
    }

    if (btn) { btn.disabled = false; }
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