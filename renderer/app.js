// ─── Yardımcı: Toast Bildirimleri ────────────────────────────────────────────
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

// ─── Yardımcı: Halka İlerleme ─────────────────────────────────────────────────
function setRingProgress(ringId, percent) {
    const ring = document.getElementById(ringId);
    if (!ring) return;
    const circumference = 125.66;
    const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
    ring.style.strokeDashoffset = offset;
}

// ─── Yardımcı: Sağlık Bar Rengi ──────────────────────────────────────────────
function barColorClass(percent, metric) {
    if (metric === 'ram' || metric === 'cpu') {
        if (percent > 85) return 'bar-pink';
        if (percent > 60) return 'bar-yellow';
        return 'bar-purple';
    }
    if (metric === 'disk') {
        if (percent > 85) return 'bar-pink';
        if (percent > 70) return 'bar-yellow';
        return 'bar-green';
    }
    return 'bar-purple';
}

// ─── Sekme Geçişleri ─────────────────────────────────────────────────────────
function showTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`tab-${name}`)?.classList.add('active');
    document.getElementById(`nav-${name}`)?.classList.add('active');
    if (name === 'health') refreshHealth();
}

// ─── Kategori İkonu ───────────────────────────────────────────────────────────
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

// ─── Kategori Türkçe ─────────────────────────────────────────────────────────
function categoryLabel(cat) {
    const labels = {
        performance: 'Performans', disk_space: 'Disk Alanı',
        security: 'Güvenlik', hardware: 'Donanım', privacy: 'Gizlilik'
    };
    return labels[cat] || cat;
}

// ─── Context Alanları Render ─────────────────────────────────────────────────
function renderContext(ctx) {
    if (!ctx || !Object.keys(ctx).length) return '';
    const entries = Object.entries(ctx)
        .filter(([, v]) => typeof v !== 'object' || Array.isArray(v))
        .slice(0, 4);
    if (!entries.length) return '';
    const items = entries.map(([k, v]) => {
        const val = Array.isArray(v) ? v.join(', ') : v;
        const label = k.replace(/_/g, ' ');
        return `<span class="context-item"><span class="context-key">${label}:</span><span class="context-val">${val}</span></span>`;
    }).join('');
    return `<div class="suggestion-context">${items}</div>`;
}

// ─── Öneri Kartı HTML Oluştur ─────────────────────────────────────────────────
function buildSuggestionCard(s, index) {
    const actions = (s.suggested_actions || []).map(a => {
        const payload = JSON.stringify({ type: a.action_type, payload: a.action_payload });
        return `<button class="btn-action" onclick='handleAction(${payload})'>${a.label}</button>`;
    }).join('');

    return `
    <div class="suggestion-card priority-${s.priority}" style="animation-delay:${index * 60}ms">
        <div class="suggestion-header">
            <div class="suggestion-icon ${s.category}">
                ${categoryIcon(s.category)}
            </div>
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

// ─── Dashboard Özet Kartı ────────────────────────────────────────────────────
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
    if (type === 'background_process') {
        if (payload === 'clean_temp') {
            await doCleanTemp();
        } else if (payload === 'clean_ram') {
            toast('Bellek optimizasyonu için gereksiz uygulamaları kapatın.', 'info');
        } else if (payload === 'security_scan') {
            toast('Windows Defender güvenlik taraması başlatılıyor...', 'info');
            window.electronAPI.openSettings('security');
        }
    } else if (type === 'open_folder') {
        const res = await window.electronAPI.openFolder(payload);
        toast(`Klasör açıldı: ${res.opened}`, 'success');
    } else if (type === 'open_settings') {
        await window.electronAPI.openSettings(payload);
        toast('Sistem ayarları açıldı.', 'success');
    } else if (type === 'open_section') {
        showTab(payload === 'health' || payload === 'processes' ? 'health' : payload);
    }
}

// ─── Agent Çalıştır ───────────────────────────────────────────────────────────
async function runAgent() {
    const btn = document.getElementById('btn-run-agent');
    const loading = document.getElementById('agent-loading');
    const results = document.getElementById('agent-results');

    btn.disabled = true;
    btn.innerHTML = `<div class="spinner" style="width:14px;height:14px;border-width:2px"></div> Analiz Ediliyor...`;
    loading.style.display = 'block';
    results.style.display = 'none';

    try {
        const data = await window.electronAPI.runAgent();
        loading.style.display = 'none';
        results.style.display = 'block';

        // Dashboard'u da güncelle
        updateDashboardMetrics(data.system);
        updateDashboardSuggestions(data.suggestions);

        if (!data.suggestions || data.suggestions.length === 0) {
            results.innerHTML = `
                <div class="all-clear">
                    <div class="all-clear-icon">
                        <svg viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="1.8"/></svg>
                    </div>
                    <h3>Sistem Sağlıklı!</h3>
                    <p>Tespit edilen herhangi bir sorun yok. Sisteminiz sorunsuz çalışıyor.</p>
                </div>`;
            updateBadge(0);
        } else {
            const cards = data.suggestions.map((s, i) => buildSuggestionCard(s, i)).join('');
            results.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
                    <div style="font-size:13px;color:var(--text-secondary)">${data.suggestions.length} öneri bulundu • <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted)">${new Date(data.timestamp).toLocaleTimeString('tr-TR')}</span></div>
                </div>
                ${cards}`;
            updateBadge(data.suggestions.filter(s => s.priority === 'high').length);
        }

        toast(`Analiz tamamlandı — ${data.suggestions.length} öneri`, 'success');
    } catch (err) {
        loading.style.display = 'none';
        results.style.display = 'block';
        results.innerHTML = `<div class="empty-state"><p style="color:var(--priority-high)">Agent çalıştırılırken hata: ${err.message}</p></div>`;
        toast('Agent analizi başarısız oldu.', 'error');
    }

    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Agent'ı Çalıştır`;
}

// ─── Badge Güncelle ───────────────────────────────────────────────────────────
function updateBadge(count) {
    const badge = document.getElementById('agent-badge');
    if (count > 0) {
        badge.style.display = 'flex';
        badge.textContent = count;
    } else {
        badge.style.display = 'none';
    }
}

// ─── Dashboard Metrikleri Güncelle ────────────────────────────────────────────
function updateDashboardMetrics(sys) {
    if (!sys) return;

    // RAM
    const ramPct = sys.ram?.usagePercent || 0;
    document.getElementById('ram-value').textContent = `%${ramPct}`;
    document.getElementById('ram-sub').textContent = `${sys.ram?.used ? (sys.ram.used / 1024**3).toFixed(1) : '?'} / ${sys.ram?.total ? (sys.ram.total / 1024**3).toFixed(1) : '?'} GB`;
    setRingProgress('ram-ring', ramPct);

    // CPU (uptime baz alarak temsili)
    const upHours = parseFloat(sys.uptime_hours) || 0;
    document.getElementById('uptime-value').textContent = upHours > 24 ? `${(upHours / 24).toFixed(1)}g` : `${upHours}s`;
    document.getElementById('uptime-sub').textContent = 'Sistem açık';

    // Disk
    const cDrive = sys.disk?.drives?.find(d => d.name === 'C');
    if (cDrive) {
        document.getElementById('disk-value').textContent = `%${cDrive.usagePercent}`;
        document.getElementById('disk-sub').textContent = `${(cDrive.free / 1024**3).toFixed(1)} GB boş`;
        setRingProgress('disk-ring', cDrive.usagePercent);
    }

    // CPU placeholder
    document.getElementById('cpu-value').textContent = 'Aktif';
    document.getElementById('cpu-sub').textContent = sys.hostname || '';
    setRingProgress('cpu-ring', 35);
}

// ─── Dashboard Önerileri Güncelle ─────────────────────────────────────────────
function updateDashboardSuggestions(suggestions) {
    const container = document.getElementById('dashboard-suggestions');
    if (!suggestions || !suggestions.length) {
        container.innerHTML = `
            <div class="empty-state">
                <span class="chip-ok">
                    <svg viewBox="0 0 24 24" fill="none" width="12" height="12"><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    Tüm sistemler sağlıklı
                </span>
            </div>`;
        return;
    }
    const preview = suggestions.slice(0, 3).map(buildPreviewCard).join('');
    container.innerHTML = preview;
}

// ─── Tam Tarama (Dashboard butonu) ────────────────────────────────────────────
async function runFullScan() {
    const btn = document.getElementById('btn-scan-dashboard');
    btn.disabled = true;
    btn.innerHTML = `<div class="spinner" style="width:14px;height:14px;border-width:2px"></div> Taranıyor...`;

    await runAgent();
    showTab('agent');

    btn.disabled = false;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="1.8"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg> Sistem Tara`;
}

// ─── Sistem Sağlığı Yenile ────────────────────────────────────────────────────
async function refreshHealth() {
    const container = document.getElementById('health-content');
    container.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>Yükleniyor...</p></div>`;

    try {
        const [health, agentData] = await Promise.all([
            window.electronAPI.getHealth(),
            window.electronAPI.runAgent()
        ]);

        const sys = agentData?.system || {};
        const ram = sys.ram || {};
        const disk = sys.disk || {};
        const ramPct = parseFloat(health.ram || ram.usagePercent || 0);
        const drives = disk.drives || [];

        // Disk barları
        const diskBars = drives.map(d => `
            <div class="health-bar-row">
                <span class="health-bar-label">${d.name}:</span>
                <div class="health-bar-track">
                    <div class="health-bar-fill ${barColorClass(d.usagePercent, 'disk')}"
                         style="width: ${d.usagePercent}%"></div>
                </div>
                <span class="health-bar-val">${d.usagePercent}%</span>
            </div>`).join('') || '<p style="color:var(--text-muted);font-size:12px">Disk verisi alınamadı</p>';

        // İşlemler
        const procs = sys.cpu?.topProcesses || [];
        const procRows = procs.length
            ? procs.map(p => `
                <div class="process-row">
                    <span class="process-name">${p.name}</span>
                    <span class="process-cpu">${p.cpu.toFixed(1)}s CPU</span>
                </div>`).join('')
            : '<div class="process-row"><span style="color:var(--text-muted)">Veri yok</span></div>';

        container.innerHTML = `
        <div class="health-grid">
            <div class="health-card">
                <h3>Bellek</h3>
                <div class="health-bar-row">
                    <span class="health-bar-label">RAM</span>
                    <div class="health-bar-track">
                        <div class="health-bar-fill ${barColorClass(ramPct, 'ram')}" style="width:${ramPct}%"></div>
                    </div>
                    <span class="health-bar-val">${ramPct}%</span>
                </div>
                <div class="health-bar-row">
                    <span class="health-bar-label">Kullanılan</span>
                    <div class="health-bar-track">
                        <div class="health-bar-fill bar-purple" style="width:${ramPct}%"></div>
                    </div>
                    <span class="health-bar-val">${ram.used ? (ram.used/1024**3).toFixed(1) : '?'} GB</span>
                </div>
                <div style="margin-top:12px">
                    <div class="info-row"><span class="info-key">Toplam</span><span class="info-val">${ram.total ? (ram.total/1024**3).toFixed(1) : '?'} GB</span></div>
                    <div class="info-row"><span class="info-key">Boş</span><span class="info-val">${ram.free ? (ram.free/1024**3).toFixed(1) : '?'} GB</span></div>
                </div>
            </div>
            <div class="health-card">
                <h3>Disk</h3>
                ${diskBars}
            </div>
            <div class="health-card">
                <h3>Sistem</h3>
                <div class="info-row"><span class="info-key">Hostname</span><span class="info-val">${sys.hostname || '—'}</span></div>
                <div class="info-row"><span class="info-key">Platform</span><span class="info-val">${sys.platform || '—'}</span></div>
                <div class="info-row"><span class="info-key">Mimari</span><span class="info-val">${sys.arch || '—'}</span></div>
                <div class="info-row"><span class="info-key">Çalışma süresi</span><span class="info-val">${sys.uptime_hours || '—'} saat</span></div>
            </div>
            <div class="health-card">
                <h3>Yüksek CPU İşlemleri</h3>
                ${procRows}
            </div>
        </div>`;

        // Dashboard metrikleri de güncelle
        updateDashboardMetrics(sys);

    } catch (err) {
        container.innerHTML = `<div class="empty-state"><p style="color:var(--priority-high)">Veri alınamadı: ${err.message}</p></div>`;
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
        if (status) status.textContent = res.status === 'cleaned' ? '✓ Temizlendi' : '⚠ Kısmen temizlendi';

        const panel = document.getElementById('clean-result');
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
    } catch (err) {
        if (status) status.textContent = '✗ Hata oluştu';
        toast('Temizleme başarısız.', 'error');
    }

    if (btn) { btn.disabled = false; btn.textContent = 'Temp Dosyaları Temizle'; }
}

// ─── Downloads Aç ─────────────────────────────────────────────────────────────
async function openDownloads() {
    try {
        const res = await window.electronAPI.openFolder('downloads');
        toast('İndirilenler klasörü açıldı.', 'success');
    } catch (e) {
        toast('Klasör açılamadı.', 'error');
    }
}

// ─── Başlangıç Uygulamaları ───────────────────────────────────────────────────
async function openStartupApps() {
    try {
        await window.electronAPI.openSettings('startup_apps');
        toast('Windows başlangıç uygulamaları açıldı.', 'info');
    } catch (e) {
        toast('Ayarlar açılamadı.', 'error');
    }
}

// ─── İlk Yükleme ─────────────────────────────────────────────────────────────
(async function init() {
    // Sağlık verilerini arka planda yükle
    try {
        const health = await window.electronAPI.getHealth();
        const ramPct = parseFloat(health.ram || 0);
        document.getElementById('ram-value').textContent  = `%${ramPct}`;
        document.getElementById('ram-sub').textContent    = 'RAM kullanımı';
        document.getElementById('cpu-value').textContent  = 'Aktif';
        document.getElementById('cpu-sub').textContent    = 'Sistem çalışıyor';
        document.getElementById('disk-value').textContent = '...';
        document.getElementById('disk-sub').textContent   = 'Tarama bekleniyor';
        document.getElementById('uptime-value').textContent = '...';
        setRingProgress('ram-ring', ramPct);
        setRingProgress('cpu-ring', 40);
    } catch (_) {}
})();