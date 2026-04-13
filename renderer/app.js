// ─── Durum ───────────────────────────────────────────────────────────────────
let lastScanData = null;

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
    if (type === 'disk') {
        return pct > 85 ? 'bar-pink' : pct > 70 ? 'bar-yellow' : 'bar-green';
    }
    return pct > 85 ? 'bar-pink' : pct > 60 ? 'bar-yellow' : 'bar-purple';
}

// ─── Sekme Geçişleri ─────────────────────────────────────────────────────────
function showTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`tab-${name}`)?.classList.add('active');
    document.getElementById(`nav-${name}`)?.classList.add('active');
    if (name === 'health') refreshHealth();
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
            const res = await window.electronAPI.openFolder(payload);
            toast(`Klasör açıldı.`, 'success');
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

    // RAM
    const ramPct = sys.ram?.usagePercent || 0;
    document.getElementById('ram-value').textContent = `%${ramPct}`;
    document.getElementById('ram-sub').textContent   = `${toGB(sys.ram?.used)} / ${toGB(sys.ram?.total)} GB`;
    setRingProgress('ram-ring', ramPct);

    // Disk C:
    const cDrive = sys.disk?.drives?.find(d => d.name === 'C');
    if (cDrive) {
        document.getElementById('disk-value').textContent = `%${cDrive.usagePercent}`;
        document.getElementById('disk-sub').textContent   = `${toGB(cDrive.free)} GB boş`;
        setRingProgress('disk-ring', cDrive.usagePercent);
    }

    // Uptime
    const upH = parseFloat(sys.uptime_hours) || 0;
    document.getElementById('uptime-value').textContent = upH > 24 ? `${(upH / 24).toFixed(1)}g` : `${upH}s`;

    // CPU model
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

    const isDeep  = data.scanType === 'deep';
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

// ─── HIZLI TARAMA (~50ms) ─────────────────────────────────────────────────────
async function runQuickScanUI() {
    const qBtn = document.getElementById('btn-quick-scan');
    const dBtn = document.getElementById('btn-deep-scan');
    const dDashBtn = document.getElementById('btn-scan-dashboard');
    const loading  = document.getElementById('agent-loading');
    const results  = document.getElementById('agent-results');

    // Loading göster
    [qBtn, dBtn, dDashBtn].forEach(b => b && (b.disabled = true));
    loading.style.display = 'block';
    results.style.display = 'none';

    // Scan text güncelle
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

// ─── DETAYLI TARAMA (~5-10s) ──────────────────────────────────────────────────
async function runDeepScanUI() {
    const qBtn = document.getElementById('btn-quick-scan');
    const dBtn = document.getElementById('btn-deep-scan');
    const loading  = document.getElementById('agent-loading');
    const results  = document.getElementById('agent-results');

    [qBtn, dBtn].forEach(b => b && (b.disabled = true));
    if (dBtn) {
        dBtn.innerHTML = `<div class="spinner" style="width:14px;height:14px;border-width:2px"></div> Analiz ediliyor... <span class="scan-badge secondary">~10s</span>`;
    }

    loading.style.display = 'block';
    results.style.display = 'none';

    const scanText = document.querySelector('.scan-text');
    const scanSub  = document.querySelector('.scan-sub');
    if (scanText) scanText.textContent = 'Derin sistem analizi yapılıyor...';
    if (scanSub)  scanSub.textContent  = 'PowerShell ile işlem, disk ve güvenlik analizi...';

    // Progress bar ekle
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

        // Sağlık sekmesini de güncelle
        if (document.getElementById('tab-health').classList.contains('active')) {
            refreshHealth();
        }
    } catch (err) {
        loading.style.display = 'none';
        progressBar.remove();
        results.style.display = 'block';
        results.innerHTML = `<div class="empty-state"><p style="color:var(--priority-high)">Hata: ${err.message}</p></div>`;
        toast('Detaylı tarama başarısız.', 'error');
    }

    [qBtn, dBtn].forEach(b => b && (b.disabled = false));
    if (dBtn) {
        dBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.8"/><path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Detaylı Tara <span class="scan-badge secondary">~10s</span>`;
    }
}

// ─── Sistem Sağlığı ───────────────────────────────────────────────────────────
async function refreshHealth() {
    const container = document.getElementById('health-content');
    container.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>Yükleniyor...</p></div>`;

    try {
        // Hızlı taramayı kullan, çok bekleme
        const data = await window.electronAPI.quickScan();
        const sys  = data.system;
        const ram  = sys.ram || {};
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

        // Eğer detaylı tarama verisi varsa işlemleri göster
        const procs = lastScanData?.system?.topProcesses || [];
        const procRows = procs.length
            ? procs.map(p => `
                <div class="process-row">
                    <span class="process-name">${p.name}</span>
                    <span class="process-cpu">${p.cpu.toFixed(1)}s CPU</span>
                </div>`).join('')
            : `<div class="process-row" style="justify-content:center">
                   <button class="btn-ghost" style="font-size:11px" onclick="runDeepScanUI();showTab('agent')">
                       ⚡ Detaylı tarama yap
                   </button>
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
        if (status) status.textContent = res.status === 'cleaned' ? '✓ Temizlendi' : '⚠ Kısmen temizlendi';
        const panel   = document.getElementById('clean-result');
        const content = document.getElementById('clean-result-content');
        if (panel && content) {
            panel.style.display = 'block';
            content.innerHTML = `
                <div class="result-success">
                    <svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="1.8"/></svg>
                    <span>Geçici dosyalar başarıyla temizlendi!</span>
                </div>`;
        }
        toast('Temp dosyaları temizlendi!', 'success');
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

// ─── İlk Yükleme ─────────────────────────────────────────────────────────────
(async function init() {
    try {
        // Anında çalışan hızlı taramayı başlat + dashboard doldur
        const data = await window.electronAPI.quickScan();
        lastScanData = data;
        updateDashboardMetrics(data.system);
        updateDashboardSuggestions(data.suggestions);
        updateBadge(data.suggestions.filter(s => s.priority === 'high').length);
    } catch (_) {
        // Hata olursa sessizce geç
        try {
            const h = await window.electronAPI.getHealth();
            document.getElementById('ram-value').textContent = `%${parseFloat(h.ram || 0)}`;
            setRingProgress('ram-ring', parseFloat(h.ram || 0));
        } catch (__) {}
    }
})();