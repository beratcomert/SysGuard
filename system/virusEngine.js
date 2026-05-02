/**
 * SysGuard Virus Engine v1.1
 * Windows Defender'dan bağımsız, tamamen özel tarama motoru.
 *
 * Tespit Yöntemleri:
 *   1. Hash tabanlı  — SHA-256 hashini bilinen zararlı hash listesiyle karşılaştır
 *   2. İmza tarama   — 80+ bilinen zararlı pattern ile dosya içeriği analizi
 *   3. Heuristik     — Entropi, çift uzantı, tehlikeli lokasyon, PE başlığı
 *   4. Süreç analizi — Çalışan süreçlerin yol ve özelliklerinden risk puanı üret
 *
 * Desteklenen Virüs Türleri (18 kategori):
 *   Truva Atı · Fidye Yazılımı · Solucan · Rootkit · Casus Yazılım · Reklam Yazılımı
 *   Tuş Kaydedici · Arka Kapı · Uzaktan Erişim (RAT) · Kripto Madenci
 *   İndirici/Damlalık · Veri Çalıcı · Botnet · Dosyasız Zararlı
 *   İstismar Kodu · Bankacılık Trojanı · Veri Silici · İstenmeyen Uygulama
 */

'use strict';

const crypto       = require('crypto');
const fs           = require('fs');
const path         = require('path');
const os           = require('os');
const { execSync } = require('child_process');

// ═══════════════════════════════════════════════════════════════════════════════
// VİRÜS TÜRÜ METAVERİSİ
// UI'ın her türü doğru renk, ikon ve açıklama ile göstermesi için
// ═══════════════════════════════════════════════════════════════════════════════
const VIRUS_TYPE_META = {
    ransomware: {
        label:  'Fidye Yazılımı',
        emoji:  '🔒',
        color:  '#ef4444',
        desc:   'Dosyalarınızı şifreleyerek fidye talep eden zararlı yazılım. Ödeme yapılmadan şifre çözülmez.',
    },
    trojan: {
        label:  'Truva Atı',
        emoji:  '🐴',
        color:  '#f97316',
        desc:   'Meşru bir program gibi görünen, arka planda gizli zararlı işlemler yürüten yazılım.',
    },
    worm: {
        label:  'Solucan',
        emoji:  '🪱',
        color:  '#f59e0b',
        desc:   'Ağ ve depolama aygıtları üzerinde kendini otomatik çoğaltan, yayılan zararlı.',
    },
    rootkit: {
        label:  'Rootkit',
        emoji:  '🦠',
        color:  '#dc2626',
        desc:   'İşletim sistemi çekirdeğine sızerek varlığını gizleyen, tespit edilmesi çok zor zararlı.',
    },
    spyware: {
        label:  'Casus Yazılım',
        emoji:  '👁️',
        color:  '#8b5cf6',
        desc:   'Kullanıcı faaliyetlerini (ekran, kamera, mikrofon, pano) gizlice kaydeden yazılım.',
    },
    adware: {
        label:  'Reklam Yazılımı',
        emoji:  '📢',
        color:  '#64748b',
        desc:   'İstenmeyen reklamlar gösteren, tarayıcı ayarlarını değiştiren reklam amaçlı yazılım.',
    },
    keylogger: {
        label:  'Tuş Kaydedici',
        emoji:  '⌨️',
        color:  '#ec4899',
        desc:   'Klavye tuş vuruşlarını ve fare tıklamalarını kaydederek şifreleri çalan zararlı.',
    },
    backdoor: {
        label:  'Arka Kapı',
        emoji:  '🚪',
        color:  '#ef4444',
        desc:   'Sisteme yetkisiz uzaktan erişim için açılan gizli bağlantı noktası.',
    },
    rat: {
        label:  'Uzaktan Erişim (RAT)',
        emoji:  '🖥️',
        color:  '#dc2626',
        desc:   'Saldırgana sisteminiz üzerinde tam uzaktan kontrol imkânı sağlayan araç.',
    },
    miner: {
        label:  'Kripto Madenci',
        emoji:  '⛏️',
        color:  '#d97706',
        desc:   'İzinsiz olarak CPU/GPU gücünüzü kripto para madenciliği için kullanan yazılım.',
    },
    dropper: {
        label:  'İndirici / Damlalık',
        emoji:  '📥',
        color:  '#06b6d4',
        desc:   'Sisteme sızdıktan sonra ek zararlı yazılımlar indirip yükleyen program.',
    },
    stealer: {
        label:  'Veri Çalıcı',
        emoji:  '🔑',
        color:  '#a855f7',
        desc:   'Şifreler, tarayıcı çerezleri, kripto cüzdanları ve kimlik bilgilerini çalan zararlı.',
    },
    botnet: {
        label:  'Botnet Ajanı',
        emoji:  '🤖',
        color:  '#6366f1',
        desc:   'Sisteminizi DDoS veya spam saldırısı için kullanılan bot ağına dahil eden zararlı.',
    },
    fileless: {
        label:  'Dosyasız Zararlı',
        emoji:  '👻',
        color:  '#a855f7',
        desc:   'Disk yerine yalnızca bellekte çalışan, meşru sistem araçlarını kötüye kullanan zararlı.',
    },
    exploit: {
        label:  'İstismar Kodu',
        emoji:  '💥',
        color:  '#ef4444',
        desc:   'Yazılım güvenlik açıklarını istismar ederek sisteme sızmaya çalışan kod.',
    },
    banker: {
        label:  'Bankacılık Trojanı',
        emoji:  '💳',
        color:  '#dc2626',
        desc:   'Online bankacılık ve finansal hesap bilgilerini çalmak için tasarlanmış özel trojan.',
    },
    wiper: {
        label:  'Veri Silici',
        emoji:  '🗑️',
        color:  '#1f2937',
        desc:   'Sistemdeki dosyaları ve kritik verileri geri alınamaz şekilde silen zararlı.',
    },
    pua: {
        label:  'İstenmeyen Uygulama',
        emoji:  '⚠️',
        color:  '#64748b',
        desc:   'Kesin zararlı olmasa da istenmeyen davranışlar sergileyen potansiyel riskli yazılım (PUA/PUP).',
    },
    inject: {
        label:  'Kod Enjeksiyonu',
        emoji:  '💉',
        color:  '#f97316',
        desc:   'Başka çalışan süreçlerin belleğine kötü amaçlı kod enjekte eden teknik.',
    },
    persist: {
        label:  'Kalıcılık Mekanizması',
        emoji:  '🔗',
        color:  '#64748b',
        desc:   'Bilgisayar yeniden başlatılsa bile çalışmaya devam etmek için kurulan gizli mekanizma.',
    },
    privesc: {
        label:  'Yetki Yükseltme',
        emoji:  '⬆️',
        color:  '#f97316',
        desc:   'Düşük kullanıcı yetkisinden sistem yöneticisi (root/SYSTEM) yetkisine geçme girişimi.',
    },
    obfusc: {
        label:  'Gizlenmiş Kod',
        emoji:  '🔀',
        color:  '#64748b',
        desc:   'Tespiti zorlaştırmak için kod yapısı karmaşıklaştırılmış ve gizlenmiş zararlı.',
    },
    heuristic: {
        label:  'Heuristik Tehdit',
        emoji:  '🧠',
        color:  '#f59e0b',
        desc:   'Davranış ve özellik analizi sonucu şüpheli bulunan, kesin sınıflandırılamamış dosya.',
    },
    test: {
        label:  'Test Dosyası',
        emoji:  '🧪',
        color:  '#22c55e',
        desc:   'Antivirüs motorlarını test etmek için oluşturulmuş zararsız standart test dosyası (EICAR).',
    },
    unknown: {
        label:  'Bilinmeyen Tehdit',
        emoji:  '❓',
        color:  '#64748b',
        desc:   'Henüz sınıflandırılamamış zararlı yazılım tespit edildi.',
    },
};

// Virüs türü öncelik sırası (en tehlikeliden en az tehlikeliye)
const TYPE_PRIORITY = [
    'ransomware', 'wiper', 'rootkit', 'banker', 'rat', 'backdoor', 'trojan',
    'stealer', 'botnet', 'exploit', 'spyware', 'keylogger', 'miner', 'fileless',
    'dropper', 'worm', 'inject', 'privesc', 'persist', 'adware', 'pua',
    'obfusc', 'heuristic', 'test', 'unknown',
];

// ═══════════════════════════════════════════════════════════════════════════════
// BİLİNEN ZARARLI SHA-256 HASHLERİ
// ═══════════════════════════════════════════════════════════════════════════════
const KNOWN_MALWARE_HASHES = new Map([
    // EICAR Standard Antivirus Test File
    ['275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f',
        { name: 'EICAR.TestFile', virusType: 'test', severity: 'low' }],
    ['2546dcffc5ad854d4ddc64fbf056871cd5a00f2471cb7a5bfd4ac23b6e9eedad',
        { name: 'EICAR.TestFile.Zip', virusType: 'test', severity: 'low' }],

    // Örnek zararlı hashleri — gerçek dünyada MalwareBazaar API'sinden güncellenir
    // WannaCry örnekleri
    ['24d004a104d4d54034dbcffc2a4b19a11f39008a575aa614ea04703480b1022c',
        { name: 'Ransomware.WannaCry', virusType: 'ransomware', severity: 'critical' }],
    // NotPetya
    ['027cc450ef5f8c5f653329641ec1fed91f694e0d229928963b30f6b0d7d3a745',
        { name: 'Ransomware.NotPetya', virusType: 'ransomware', severity: 'critical' }],
    // Emotet (örnek)
    ['9b03ef3cf69cb8a0a3b2afebc1e2d2f0bfc6ba59f8a28c9a1e3b5c7d4f2a1e9',
        { name: 'Trojan.Emotet', virusType: 'trojan', severity: 'critical' }],
]);

// ═══════════════════════════════════════════════════════════════════════════════
// İMZA VERİTABANI — 80+ Pattern
// Her kayıt: { id, pattern, name, virusType, severity, description }
// ═══════════════════════════════════════════════════════════════════════════════
const SIGNATURES = [

    // ══ TEST ══════════════════════════════════════════════════════════════════
    { id: 'EICAR-001',
      pattern: 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE',
      name: 'EICAR.TestFile',
      virusType: 'test', severity: 'low',
      description: 'Standart antivirüs test dosyası (EICAR) — zararsız' },

    // ══ FİDYE YAZILIMI (Ransomware) ══════════════════════════════════════════
    { id: 'RAN-001',
      pattern: 'your files have been encrypted',
      name: 'Ransomware.GenericNote',
      virusType: 'ransomware', severity: 'critical',
      description: 'Dosya şifreleme fidye notu tespit edildi' },
    { id: 'RAN-002',
      pattern: 'pay the ransom',
      name: 'Ransomware.DemandNote',
      virusType: 'ransomware', severity: 'critical',
      description: 'Fidye ödeme talebi içeren metin tespit edildi' },
    { id: 'RAN-003',
      pattern: 'send bitcoins to',
      name: 'Ransomware.BitcoinDemand',
      virusType: 'ransomware', severity: 'critical',
      description: 'Bitcoin fidye ödeme talimatı tespit edildi' },
    { id: 'RAN-004',
      pattern: 'your important files are encrypted',
      name: 'Ransomware.WannaCryLike',
      virusType: 'ransomware', severity: 'critical',
      description: 'WannaCry tarzı fidye mesajı tespit edildi' },
    { id: 'RAN-005',
      pattern: 'shadow copy',
      name: 'Ransomware.ShadowDelete',
      virusType: 'ransomware', severity: 'high',
      description: 'Gölge kopya silme girişimi — fidye yazılımı davranışı' },
    { id: 'RAN-006',
      pattern: 'vssadmin delete shadows',
      name: 'Ransomware.VSSDelete',
      virusType: 'ransomware', severity: 'critical',
      description: 'Windows yedek kopyaları silme komutu (tipik ransomware davranışı)' },
    { id: 'RAN-007',
      pattern: 'all your files belong to us',
      name: 'Ransomware.RyukLike',
      virusType: 'ransomware', severity: 'critical',
      description: 'Ryuk tarzı fidye mesajı tespit edildi' },
    { id: 'RAN-008',
      pattern: 'decrypt your files',
      name: 'Ransomware.DecryptOffer',
      virusType: 'ransomware', severity: 'high',
      description: 'Dosya çözme teklifi içeren fidye notu' },

    // ══ TRUVA ATI (Trojan) ════════════════════════════════════════════════════
    { id: 'TRJ-001',
      pattern: 'software\\microsoft\\windows\\currentversion\\run',
      name: 'Trojan.AutoRun',
      virusType: 'trojan', severity: 'high',
      description: 'Windows başlangıç kaydı ekleme — kalıcılık mekanizması' },
    { id: 'TRJ-002',
      pattern: 'process hollowing',
      name: 'Trojan.Hollow',
      virusType: 'trojan', severity: 'critical',
      description: 'Process hollowing tekniği — meşru süreç yerine zararlı çalıştırma' },
    { id: 'TRJ-003',
      pattern: 'reflective dll',
      name: 'Trojan.ReflectiveDLL',
      virusType: 'trojan', severity: 'high',
      description: 'Yansıtmalı DLL yükleme tekniği tespit edildi' },
    { id: 'TRJ-004',
      pattern: 'dll hijack',
      name: 'Trojan.DLLHijack',
      virusType: 'trojan', severity: 'high',
      description: 'DLL ele geçirme girişimi tespit edildi' },
    { id: 'TRJ-005',
      pattern: 'emotet',
      name: 'Trojan.Emotet',
      virusType: 'trojan', severity: 'critical',
      description: 'Emotet trojanı imzası tespit edildi' },
    { id: 'TRJ-006',
      pattern: 'trickbot',
      name: 'Trojan.TrickBot',
      virusType: 'trojan', severity: 'critical',
      description: 'TrickBot trojanı imzası tespit edildi' },

    // ══ SOLUCAN (Worm) ════════════════════════════════════════════════════════
    { id: 'WRM-001',
      pattern: 'autorun.inf',
      name: 'Worm.AutoRun',
      virusType: 'worm', severity: 'medium',
      description: 'Çıkarılabilir sürücü üzerinden yayılma için AutoRun dosyası oluşturuyor' },
    { id: 'WRM-002',
      pattern: 'net use \\\\',
      name: 'Worm.NetworkSpread',
      virusType: 'worm', severity: 'high',
      description: 'Ağ paylaşımları üzerinden yayılma girişimi' },
    { id: 'WRM-003',
      pattern: 'smtp.sendmail',
      name: 'Worm.EmailSpread',
      virusType: 'worm', severity: 'medium',
      description: 'E-posta yoluyla yayılma — kendi kendine gönderilen e-posta' },
    { id: 'WRM-004',
      pattern: 'ms17-010',
      name: 'Worm.EternalBlue',
      virusType: 'worm', severity: 'critical',
      description: 'EternalBlue (MS17-010) SMB açığı istismarı tespit edildi' },
    { id: 'WRM-005',
      pattern: 'eternalblue',
      name: 'Worm.EternalBlueRef',
      virusType: 'worm', severity: 'critical',
      description: 'EternalBlue exploit referansı tespit edildi' },

    // ══ ROOTKİT ══════════════════════════════════════════════════════════════
    { id: 'RTK-001',
      pattern: 'ntquerysysteminformation',
      name: 'Rootkit.NtQueryHook',
      virusType: 'rootkit', severity: 'high',
      description: 'Sistem süreci sorgulama kancası — rootkit gizleme tekniği' },
    { id: 'RTK-002',
      pattern: 'zwquerysysteminformation',
      name: 'Rootkit.ZwHook',
      virusType: 'rootkit', severity: 'high',
      description: 'Düşük seviyeli sistem çağrısı kancalanması tespit edildi' },
    { id: 'RTK-003',
      pattern: 'driverentry',
      name: 'Rootkit.KernelDriver',
      virusType: 'rootkit', severity: 'critical',
      description: 'Kernel sürücü giriş noktası — sistem çekirdeğine erişim girişimi' },
    { id: 'RTK-004',
      pattern: 'bootrec /fixmbr',
      name: 'Rootkit.MBROverwrite',
      virusType: 'rootkit', severity: 'critical',
      description: 'MBR (Master Boot Record) değiştirme girişimi' },
    { id: 'RTK-005',
      pattern: 'ssdt hook',
      name: 'Rootkit.SSDTHook',
      virusType: 'rootkit', severity: 'critical',
      description: 'Sistem Servis Tanımlayıcı Tablo kancalanması tespit edildi' },

    // ══ CASUS YAZILIM (Spyware) ═══════════════════════════════════════════════
    { id: 'SPY-001',
      pattern: 'bitblt',
      name: 'Spyware.ScreenCapture',
      virusType: 'spyware', severity: 'high',
      description: 'Ekran görüntüsü alma fonksiyonu — casus yazılım davranışı' },
    { id: 'SPY-002',
      pattern: 'capturescreenshot',
      name: 'Spyware.Screenshot',
      virusType: 'spyware', severity: 'high',
      description: 'Ekran kaydı fonksiyon imzası tespit edildi' },
    { id: 'SPY-003',
      pattern: 'getclipboarddata',
      name: 'Spyware.ClipboardSpy',
      virusType: 'spyware', severity: 'medium',
      description: 'Pano içeriğini okuma — kopyalanan şifreler çalınabilir' },
    { id: 'SPY-004',
      pattern: 'openinputdesktop',
      name: 'Spyware.DesktopCapture',
      virusType: 'spyware', severity: 'medium',
      description: 'Masaüstü erişim API kullanımı tespit edildi' },
    { id: 'SPY-005',
      pattern: 'capvideocapturedevice',
      name: 'Spyware.WebcamAccess',
      virusType: 'spyware', severity: 'high',
      description: 'Webcam/kamera erişim girişimi tespit edildi' },
    { id: 'SPY-006',
      pattern: 'captureaudio',
      name: 'Spyware.MicrophoneTap',
      virusType: 'spyware', severity: 'high',
      description: 'Mikrofon erişimi — ses kaydı yapılıyor olabilir' },

    // ══ TUŞ KAYDEDİCİ (Keylogger) ════════════════════════════════════════════
    { id: 'KEY-001',
      pattern: 'getasynckeystate',
      name: 'Keylogger.AsyncKey',
      virusType: 'keylogger', severity: 'high',
      description: 'Klavye tuş durumu asenkron sorgulama — tuş kaydedici' },
    { id: 'KEY-002',
      pattern: 'setwindowshookex',
      name: 'Keylogger.GlobalHook',
      virusType: 'keylogger', severity: 'high',
      description: 'Global klavye kancası kurulumu tespit edildi' },
    { id: 'KEY-003',
      pattern: 'wh_keyboard_ll',
      name: 'Keylogger.LowLevelHook',
      virusType: 'keylogger', severity: 'high',
      description: 'Düşük seviyeli klavye kancası (WH_KEYBOARD_LL) kurulumu' },
    { id: 'KEY-004',
      pattern: 'keylog',
      name: 'Keylogger.Generic',
      virusType: 'keylogger', severity: 'medium',
      description: 'Keylog string referansı tespit edildi' },
    { id: 'KEY-005',
      pattern: 'getforegroundwindow',
      name: 'Keylogger.WindowCapture',
      virusType: 'keylogger', severity: 'medium',
      description: 'Aktif pencere başlığı takibi — bağlam bazlı tuş kaydedici' },

    // ══ ARKA KAPI / RAT (Backdoor/RAT) ═══════════════════════════════════════
    { id: 'BAK-001',
      pattern: 'reverse_tcp',
      name: 'Backdoor.ReverseTCP',
      virusType: 'backdoor', severity: 'critical',
      description: 'Tersine TCP bağlantısı — saldırgan bilgisayara bağlantı açıyor' },
    { id: 'BAK-002',
      pattern: 'meterpreter',
      name: 'Backdoor.Meterpreter',
      virusType: 'rat', severity: 'critical',
      description: 'Metasploit Meterpreter RAT imzası tespit edildi' },
    { id: 'BAK-003',
      pattern: 'nc.exe -e cmd',
      name: 'Backdoor.NetcatShell',
      virusType: 'backdoor', severity: 'critical',
      description: 'Netcat ters kabuk — uzaktan komut satırı erişimi' },
    { id: 'BAK-004',
      pattern: 'njrat',
      name: 'RAT.njRAT',
      virusType: 'rat', severity: 'critical',
      description: 'njRAT uzaktan erişim trojanı imzası tespit edildi' },
    { id: 'BAK-005',
      pattern: 'darkcomet',
      name: 'RAT.DarkComet',
      virusType: 'rat', severity: 'critical',
      description: 'DarkComet RAT imzası tespit edildi' },
    { id: 'BAK-006',
      pattern: 'asyncrat',
      name: 'RAT.AsyncRAT',
      virusType: 'rat', severity: 'critical',
      description: 'AsyncRAT uzaktan erişim trojanı imzası tespit edildi' },
    { id: 'BAK-007',
      pattern: 'net user /add',
      name: 'Backdoor.UserAdd',
      virusType: 'backdoor', severity: 'high',
      description: 'Gizli kullanıcı hesabı oluşturma girişimi' },
    { id: 'BAK-008',
      pattern: 'netsh advfirewall firewall add rule',
      name: 'Backdoor.FirewallOpen',
      virusType: 'backdoor', severity: 'high',
      description: 'Güvenlik duvarı kuralı ekleyerek arka kapı açılıyor' },
    { id: 'BAK-009',
      pattern: 'remcosrat',
      name: 'RAT.Remcos',
      virusType: 'rat', severity: 'critical',
      description: 'Remcos RAT imzası tespit edildi' },
    { id: 'BAK-010',
      pattern: 'quasarrat',
      name: 'RAT.Quasar',
      virusType: 'rat', severity: 'critical',
      description: 'Quasar RAT imzası tespit edildi' },

    // ══ KRİPTO MADENCİ (Miner) ═══════════════════════════════════════════════
    { id: 'MIN-001',
      pattern: 'stratum+tcp://',
      name: 'Miner.StratumPool',
      virusType: 'miner', severity: 'high',
      description: 'Madencilik havuzu bağlantısı (Stratum protokolü)' },
    { id: 'MIN-002',
      pattern: 'xmrig',
      name: 'Miner.XMRig',
      virusType: 'miner', severity: 'high',
      description: 'XMRig Monero madenci yazılımı imzası tespit edildi' },
    { id: 'MIN-003',
      pattern: 'cryptonight',
      name: 'Miner.CryptoNight',
      virusType: 'miner', severity: 'high',
      description: 'CryptoNight madencilik algoritması tespit edildi' },
    { id: 'MIN-004',
      pattern: '--mining-threads',
      name: 'Miner.ThreadConfig',
      virusType: 'miner', severity: 'medium',
      description: 'Madencilik thread yapılandırma parametresi tespit edildi' },
    { id: 'MIN-005',
      pattern: 'monero wallet',
      name: 'Miner.MoneroWallet',
      virusType: 'miner', severity: 'high',
      description: 'Monero cüzdan referansı tespit edildi' },
    { id: 'MIN-006',
      pattern: 'coinhive',
      name: 'Miner.CoinHive',
      virusType: 'miner', severity: 'high',
      description: 'CoinHive tarayıcı madencilik kütüphanesi tespit edildi' },

    // ══ İNDİRİCİ / DAMLALAK (Dropper) ═══════════════════════════════════════
    { id: 'DRP-001',
      pattern: 'invoke-webrequest',
      name: 'Dropper.PSDownload',
      virusType: 'dropper', severity: 'medium',
      description: 'PowerShell ile URL’den dosya indirme girisimi' },
    { id: 'DRP-002',
      pattern: 'downloadstring(',
      name: 'Dropper.WebClientDL',
      virusType: 'dropper', severity: 'medium',
      description: 'WebClient.DownloadString() — uzak içerik indirme ve çalıştırma' },
    { id: 'DRP-003',
      pattern: 'bitsadmin /transfer',
      name: 'Dropper.BITSTransfer',
      virusType: 'dropper', severity: 'medium',
      description: 'BITS servisi üzerinden gizli dosya transferi' },
    { id: 'DRP-004',
      pattern: 'shell.run(',
      name: 'Dropper.VBSRun',
      virusType: 'dropper', severity: 'high',
      description: 'VBScript Shell.Run komutu — gizli süreç başlatma' },
    { id: 'DRP-005',
      pattern: 'wscript.shell',
      name: 'Dropper.WScript',
      virusType: 'dropper', severity: 'medium',
      description: 'WScript.Shell nesnesi — komut çalıştırma' },
    { id: 'DRP-006',
      pattern: 'certutil -decode',
      name: 'Dropper.CertUtil',
      virusType: 'dropper', severity: 'high',
      description: 'CertUtil ile Base64 çözme ve dosya bırakma (LOLBin tekniği)' },
    { id: 'DRP-007',
      pattern: 'cmd.exe /c powershell -encodedcommand',
      name: 'Dropper.EncodedPS',
      virusType: 'dropper', severity: 'high',
      description: 'Şifrelenmiş PowerShell komutu ile zararlı yükleme' },

    // ══ VERİ ÇALICI (Stealer) ════════════════════════════════════════════════
    { id: 'STL-001',
      pattern: 'login data',
      name: 'Stealer.ChromePasswords',
      virusType: 'stealer', severity: 'critical',
      description: 'Chrome şifre veritabanı erişimi (Login Data dosyası)' },
    { id: 'STL-002',
      pattern: 'logins.json',
      name: 'Stealer.FirefoxPasswords',
      virusType: 'stealer', severity: 'critical',
      description: 'Firefox şifre dosyasına erişim tespit edildi' },
    { id: 'STL-003',
      pattern: 'wallet.dat',
      name: 'Stealer.CryptoWallet',
      virusType: 'stealer', severity: 'critical',
      description: 'Kripto para cüzdanı dosyası erişimi (wallet.dat)' },
    { id: 'STL-004',
      pattern: 'filezilla\\recentservers.xml',
      name: 'Stealer.FTPCredentials',
      virusType: 'stealer', severity: 'high',
      description: 'FileZilla FTP kimlik bilgileri çalma girişimi' },
    { id: 'STL-005',
      pattern: 'telegram desktop\\tdata',
      name: 'Stealer.TelegramSession',
      virusType: 'stealer', severity: 'high',
      description: 'Telegram oturum verisi çalma girişimi' },
    { id: 'STL-006',
      pattern: 'redline',
      name: 'Stealer.Redline',
      virusType: 'stealer', severity: 'critical',
      description: 'RedLine Stealer zararlısı imzası tespit edildi' },
    { id: 'STL-007',
      pattern: 'raccoon stealer',
      name: 'Stealer.Raccoon',
      virusType: 'stealer', severity: 'critical',
      description: 'Raccoon Stealer zararlısı imzası tespit edildi' },
    { id: 'STL-008',
      pattern: 'vidar',
      name: 'Stealer.Vidar',
      virusType: 'stealer', severity: 'critical',
      description: 'Vidar Stealer zararlısı imzası tespit edildi' },
    { id: 'STL-009',
      pattern: 'cookies\\chrome',
      name: 'Stealer.ChromeCookies',
      virusType: 'stealer', severity: 'high',
      description: 'Chrome çerez verisi çalma girişimi tespit edildi' },

    // ══ BOTNET ═══════════════════════════════════════════════════════════════
    { id: 'BOT-001',
      pattern: 'irc.freenode',
      name: 'Botnet.IRCCommand',
      virusType: 'botnet', severity: 'high',
      description: 'IRC üzerinden komuta-kontrol (C2) iletişimi tespit edildi' },
    { id: 'BOT-002',
      pattern: 'ddos',
      name: 'Botnet.DDoSAgent',
      virusType: 'botnet', severity: 'high',
      description: 'DDoS saldırı ajanı referansı tespit edildi' },
    { id: 'BOT-003',
      pattern: 'syn flood',
      name: 'Botnet.SYNFlood',
      virusType: 'botnet', severity: 'high',
      description: 'SYN Flood DDoS tekniği tespit edildi' },
    { id: 'BOT-004',
      pattern: 'mirai',
      name: 'Botnet.Mirai',
      virusType: 'botnet', severity: 'critical',
      description: 'Mirai botnet zararlısı imzası tespit edildi' },

    // ══ DOSYASIZ ZARARLI (Fileless) ══════════════════════════════════════════
    { id: 'FLM-001',
      pattern: 'invoke-mimikatz',
      name: 'Fileless.Mimikatz',
      virusType: 'fileless', severity: 'critical',
      description: 'Mimikatz kimlik bilgisi çalma aracı (dosyasız versiyon)' },
    { id: 'FLM-002',
      pattern: 'invoke-shellcode',
      name: 'Fileless.Shellcode',
      virusType: 'fileless', severity: 'critical',
      description: 'Bellek içi shellcode çalıştırma girişimi' },
    { id: 'FLM-003',
      pattern: 'wmi subscription',
      name: 'Fileless.WMIPersist',
      virusType: 'fileless', severity: 'high',
      description: 'WMI aboneliği ile dosyasız kalıcılık mekanizması' },
    { id: 'FLM-004',
      pattern: 'invoke-expression',
      name: 'Fileless.IEXPSX',
      virusType: 'fileless', severity: 'medium',
      description: 'PowerShell IEX (Invoke-Expression) — bellekte kod çalıştırma' },
    { id: 'FLM-005',
      pattern: 'msf.exploit',
      name: 'Fileless.Metasploit',
      virusType: 'fileless', severity: 'critical',
      description: 'Metasploit Framework exploit referansı tespit edildi' },

    // ══ İSTİSMAR KODU (Exploit) ══════════════════════════════════════════════
    { id: 'EXP-001',
      pattern: 'bypassuac',
      name: 'Exploit.UACBypass',
      virusType: 'exploit', severity: 'critical',
      description: 'UAC (Kullanıcı Hesabı Denetimi) atlatma girişimi' },
    { id: 'EXP-002',
      pattern: 'shellcode',
      name: 'Exploit.Shellcode',
      virusType: 'exploit', severity: 'critical',
      description: 'Shellcode referansı — açık istismarı için kullanılır' },
    { id: 'EXP-003',
      pattern: 'cve-2021-',
      name: 'Exploit.CVE2021',
      virusType: 'exploit', severity: 'high',
      description: '2021 yılı CVE güvenlik açığı referansı tespit edildi' },
    { id: 'EXP-004',
      pattern: 'log4shell',
      name: 'Exploit.Log4Shell',
      virusType: 'exploit', severity: 'critical',
      description: 'Log4Shell (CVE-2021-44228) açığı referansı tespit edildi' },
    { id: 'EXP-005',
      pattern: 'printspoofer',
      name: 'Exploit.PrintSpoofer',
      virusType: 'exploit', severity: 'critical',
      description: 'PrintSpoofer yetki yükseltme exploiti tespit edildi' },

    // ══ BANKACILIk TROJANI (Banker) ══════════════════════════════════════════
    { id: 'BNK-001',
      pattern: 'web inject',
      name: 'Banker.WebInject',
      virusType: 'banker', severity: 'critical',
      description: 'Tarayıcıya web inject yaparak bankacılık sayfalarını değiştirme' },
    { id: 'BNK-002',
      pattern: 'form grabbing',
      name: 'Banker.FormGrab',
      virusType: 'banker', severity: 'critical',
      description: 'Form içeriği (şifre, kart bilgisi) yakalama tekniği' },
    { id: 'BNK-003',
      pattern: 'dridex',
      name: 'Banker.Dridex',
      virusType: 'banker', severity: 'critical',
      description: 'Dridex bankacılık trojanı imzası tespit edildi' },
    { id: 'BNK-004',
      pattern: 'zeus',
      name: 'Banker.Zeus',
      virusType: 'banker', severity: 'critical',
      description: 'Zeus bankacılık trojanı imzası tespit edildi' },
    { id: 'BNK-005',
      pattern: 'qakbot',
      name: 'Banker.QakBot',
      virusType: 'banker', severity: 'critical',
      description: 'QakBot bankacılık trojanı imzası tespit edildi' },

    // ══ VERİ SİLİCİ (Wiper) ══════════════════════════════════════════════════
    { id: 'WIP-001',
      pattern: 'overwrite mbr',
      name: 'Wiper.MBROverwrite',
      virusType: 'wiper', severity: 'critical',
      description: 'MBR üzerine yazma — sistem açılışını engelleyen yıkıcı saldırı' },
    { id: 'WIP-002',
      pattern: 'del /f /s /q',
      name: 'Wiper.MassDelete',
      virusType: 'wiper', severity: 'high',
      description: 'Toplu dosya silme komutu tespit edildi' },
    { id: 'WIP-003',
      pattern: 'hermeticwiper',
      name: 'Wiper.HermeticWiper',
      virusType: 'wiper', severity: 'critical',
      description: 'HermeticWiper zararlısı imzası tespit edildi' },
    { id: 'WIP-004',
      pattern: 'formatdrive',
      name: 'Wiper.DriveFormat',
      virusType: 'wiper', severity: 'critical',
      description: 'Sürücü biçimlendirme girişimi tespit edildi' },

    // ══ KOD ENJEKSİYONU (Injection) ══════════════════════════════════════════
    { id: 'INJ-001',
      pattern: 'createremotethread',
      name: 'Inject.RemoteThread',
      virusType: 'inject', severity: 'high',
      description: 'Başka süreçte uzak thread oluşturma — kod enjeksiyonu' },
    { id: 'INJ-002',
      pattern: 'virtualallocex',
      name: 'Inject.VirtualAlloc',
      virusType: 'inject', severity: 'high',
      description: 'Uzak süreçte bellek ayırma — enjeksiyon hazırlığı' },
    { id: 'INJ-003',
      pattern: 'writeprocessmemory',
      name: 'Inject.WriteMemory',
      virusType: 'inject', severity: 'high',
      description: 'Başka sürecin belleğine yazma — kod enjeksiyonu' },
    { id: 'INJ-004',
      pattern: 'ntcreatethread',
      name: 'Inject.NtThread',
      virusType: 'inject', severity: 'high',
      description: 'NT düzeyinde thread oluşturma — gelişmiş enjeksiyon tekniği' },
    { id: 'INJ-005',
      pattern: 'atomicinjection',
      name: 'Inject.AtomicBombing',
      virusType: 'inject', severity: 'high',
      description: 'Atom Bombing enjeksiyon tekniği tespit edildi' },

    // ══ KALICILıK (Persistence) ══════════════════════════════════════════════
    { id: 'PER-001',
      pattern: 'schtasks /create',
      name: 'Persist.ScheduledTask',
      virusType: 'persist', severity: 'medium',
      description: 'Zamanlanmış görev oluşturma — kalıcılık mekanizması' },
    { id: 'PER-002',
      pattern: 'reg add hkcu\\software\\microsoft',
      name: 'Persist.RegAdd',
      virusType: 'persist', severity: 'medium',
      description: 'Registry başlangıç anahtarı ekleme' },
    { id: 'PER-003',
      pattern: 'new-scheduledtask',
      name: 'Persist.PSSchedTask',
      virusType: 'persist', severity: 'medium',
      description: 'PowerShell ile zamanlanmış görev oluşturma' },

    // ══ YETKİ YÜKSELTMESİ (PrivEsc) ═════════════════════════════════════════
    { id: 'PRV-001',
      pattern: 'sedebuggingprivilege',
      name: 'PrivEsc.DebugPriv',
      virusType: 'privesc', severity: 'high',
      description: 'Debug yetkisi talep etme — yetki yükseltme girişimi' },
    { id: 'PRV-002',
      pattern: 'adjusttokenprivileges',
      name: 'PrivEsc.TokenPriv',
      virusType: 'privesc', severity: 'high',
      description: 'Erişim token yetkilerini düzenleme' },
    { id: 'PRV-003',
      pattern: 'impersonateloggedonuser',
      name: 'PrivEsc.Impersonate',
      virusType: 'privesc', severity: 'critical',
      description: 'Başka kullanıcı kimliğine bürünme girişimi' },

    // ══ GİZLEME (Obfuscation) ════════════════════════════════════════════════
    { id: 'OBF-001',
      pattern: '[system.convert]::frombase64string',
      name: 'Obfusc.PSBase64',
      virusType: 'obfusc', severity: 'medium',
      description: 'PowerShell Base64 çözme — gizlenmiş komut çalıştırma' },
    { id: 'OBF-002',
      pattern: '-encodedcommand',
      name: 'Obfusc.PSEncoded',
      virusType: 'obfusc', severity: 'medium',
      description: 'Şifrelenmiş PowerShell komutu tespit edildi' },
    { id: 'OBF-003',
      pattern: 'eval(base64_decode',
      name: 'Obfusc.PHPEval',
      virusType: 'obfusc', severity: 'medium',
      description: 'PHP eval+base64 gizleme tekniği tespit edildi' },
    { id: 'OBF-004',
      pattern: 'char()',
      name: 'Obfusc.CharEncoding',
      virusType: 'obfusc', severity: 'low',
      description: 'Karakter kod gizleme tekniği tespit edildi' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SABITLER
// ═══════════════════════════════════════════════════════════════════════════════
const RISKY_EXTS = new Set([
    '.exe', '.dll', '.bat', '.cmd', '.ps1', '.vbs', '.vbe',
    '.js', '.jse', '.hta', '.scr', '.pif', '.com', '.wsf', '.wsh',
    '.msi', '.jar', '.lnk',
]);

const SAFE_LOCATIONS = [
    'c:\\windows\\system32',
    'c:\\windows\\syswow64',
    'c:\\windows\\winsxs',
    'c:\\program files',
    'c:\\program files (x86)',
];

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

// ═══════════════════════════════════════════════════════════════════════════════
// YARDIMCILAR
// ═══════════════════════════════════════════════════════════════════════════════

function readFileForScan(filePath) {
    try {
        const buf  = fs.readFileSync(filePath);
        const hash = crypto.createHash('sha256').update(buf).digest('hex');
        return { hash, buf };
    } catch (_) { return null; }
}

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

function isPE(buf) {
    return buf.length >= 2 && buf[0] === 0x4D && buf[1] === 0x5A;
}

function maxSeverity(threats) {
    const order = ['critical', 'high', 'medium', 'low'];
    for (const s of order) {
        if (threats.some(t => t.severity === s)) return s;
    }
    return 'low';
}

/** En önemli virüs türünü seç (TYPE_PRIORITY sırasına göre) */
function primaryVirusType(threats) {
    for (const type of TYPE_PRIORITY) {
        if (threats.some(t => t.virusType === type)) return type;
    }
    return 'unknown';
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEK DOSYA ANALİZİ
// ═══════════════════════════════════════════════════════════════════════════════
function analyzeFile(filePath) {
    let stat;
    try { stat = fs.statSync(filePath); } catch (_) { return null; }
    if (!stat.isFile() || stat.size === 0) return null;
    if (stat.size > 50 * 1024 * 1024) return null; // >50MB atla

    const ext         = path.extname(filePath).toLowerCase();
    const skipPattern = stat.size > 20 * 1024 * 1024;

    const raw = readFileForScan(filePath);
    if (!raw) return null;

    const { hash, buf } = raw;
    const threats = [];

    // ── 1. Hash tabanlı tespit ─────────────────────────────────────────────
    if (KNOWN_MALWARE_HASHES.has(hash)) {
        const meta = KNOWN_MALWARE_HASHES.get(hash);
        threats.push({
            type:        'hash',
            id:          'HASH-MATCH',
            name:        meta.name,
            virusType:   meta.virusType,
            severity:    meta.severity,
            description: 'SHA-256 hash veritabanında eşleşme bulundu',
            detail:      `SHA-256: ${hash.substring(0, 24)}…`,
        });
    }

    // ── 2. İmza/Pattern taraması ───────────────────────────────────────────
    if (!skipPattern) {
        const slice   = buf.slice(0, 2 * 1024 * 1024);
        const content = slice.toString('latin1').toLowerCase();

        for (const sig of SIGNATURES) {
            if (content.includes(sig.pattern.toLowerCase())) {
                threats.push({
                    type:        'signature',
                    id:          sig.id,
                    name:        sig.name,
                    virusType:   sig.virusType,
                    severity:    sig.severity,
                    description: sig.description,
                    detail:      `İmza [${sig.id}] eşleşmesi`,
                });
            }
        }
    }

    // ── 3. Heuristik analiz ────────────────────────────────────────────────
    if (RISKY_EXTS.has(ext)) {
        const entropyBuf = buf.slice(0, 512 * 1024);
        const entropy    = calcEntropy(entropyBuf);
        const inSafeLoc  = SAFE_LOCATIONS.some(
            loc => filePath.toLowerCase().startsWith(loc)
        );

        // 3a. Yüksek entropi
        if (entropy > 7.2 && !inSafeLoc) {
            threats.push({
                type:        'heuristic',
                id:          'HEUR-ENTROPY',
                name:        'Heuristic.HighEntropy',
                virusType:   'heuristic',
                severity:    'medium',
                description: 'Yüksek entropi değeri — dosya paketlenmiş veya şifrelenmiş olabilir',
                detail:      `Entropi: ${entropy.toFixed(2)} / 8.0`,
            });
        }

        // 3b. Temp'te PE
        if (isPE(buf)) {
            const fp = filePath.toLowerCase();
            if (fp.includes('\\temp\\') || fp.includes('\\tmp\\') ||
                fp.includes('\\appdata\\local\\temp')) {
                threats.push({
                    type:        'heuristic',
                    id:          'HEUR-EXE-TEMP',
                    name:        'Heuristic.ExeInTemp',
                    virusType:   'trojan',
                    severity:    'high',
                    description: 'Geçici dizinde çalıştırılabilir (PE) dosya — dropper veya trojan belirtisi',
                    detail:      'Konum: Temp klasörü',
                });
            }
        }

        // 3c. Çift uzantı
        const baseName  = path.basename(filePath, ext);
        const fakeExts  = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.mp4', '.txt', '.zip', '.rar'];
        if (fakeExts.some(fe => baseName.toLowerCase().endsWith(fe))) {
            threats.push({
                type:        'heuristic',
                id:          'HEUR-DBL-EXT',
                name:        'Heuristic.DoubleExtension',
                virusType:   'trojan',
                severity:    'high',
                description: 'Çift uzantı — kullanıcıyı aldatmak için dosya adı taklit edilmiş',
                detail:      `Dosya: ${path.basename(filePath)}`,
            });
        }

        // 3d. AppData/Roaming'de bilinmeyen PE
        if (isPE(buf) && !inSafeLoc) {
            const fp = filePath.toLowerCase();
            if (fp.includes('\\appdata\\roaming\\') && !fp.includes('\\microsoft\\')) {
                threats.push({
                    type:        'heuristic',
                    id:          'HEUR-APPDATA',
                    name:        'Heuristic.ExeInAppData',
                    virusType:   'trojan',
                    severity:    'medium',
                    description: 'AppData/Roaming altında bilinmeyen çalıştırılabilir — şüpheli konum',
                    detail:      'Konum: AppData\\Roaming',
                });
            }
        }
    }

    if (threats.length === 0) return null;

    const pType = primaryVirusType(threats);
    return {
        path:           filePath,
        hash,
        size:           stat.size,
        ext,
        threats,
        maxSeverity:    maxSeverity(threats),
        threatCount:    threats.length,
        primaryType:    pType,
        primaryTypeMeta: VIRUS_TYPE_META[pType] || VIRUS_TYPE_META.unknown,
        // Benzersiz virüs türleri
        virusTypes:     [...new Set(threats.map(t => t.virusType))],
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DİZİN TARAMASI
// ═══════════════════════════════════════════════════════════════════════════════
function scanDirectory(dirPath, opts = {}) {
    const { maxDepth = 3, scanLimit = 3000 } = opts;
    const results = [];
    const counter = { scanned: 0 };

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

// ═══════════════════════════════════════════════════════════════════════════════
// TARAMA HEDEFLERİ
// ═══════════════════════════════════════════════════════════════════════════════
function getScanTargets() {
    const home = os.homedir();
    const dirs = [
        // Geçici dizinler
        os.tmpdir(),
        process.env.TEMP,
        process.env.TMP,
        process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Temp') : null,
        'C:\\Windows\\Temp',

        // Kullanıcı dizinleri
        path.join(home, 'Desktop'),
        path.join(home, 'Downloads'),
        path.join(home, 'Documents'),
        path.join(home, 'AppData', 'Local'),
        path.join(home, 'AppData', 'Roaming'),
        process.env.APPDATA ? path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup') : null,

        // Sistem dizinleri
        'C:\\Windows\\System32',
        'C:\\Windows\\SysWOW64',
        'C:\\Windows\\Tasks',
        'C:\\ProgramData',
        'C:\\Program Files',
        'C:\\Program Files (x86)',
    ];

    const unique = [...new Set(dirs.filter(Boolean).map(d => d.toLowerCase()))];
    return unique.filter(d => {
        try { return fs.statSync(d).isDirectory(); } catch (_) { return false; }
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SÜREÇ ANALİZİ
// ═══════════════════════════════════════════════════════════════════════════════
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
    } catch (_) { return suspicious; }

    for (const p of procs) {
        const procPath = (p.Path || '').toLowerCase();
        const procName = (p.Name || '').toLowerCase();
        if (!procPath || KNOWN_SAFE_PROCESSES.has(procName)) continue;

        const risks = [];

        if (procPath.includes('\\temp\\') || procPath.includes('\\tmp\\')) {
            risks.push({ reason: 'Geçici (Temp) dizininden çalışıyor', severity: 'high', virusType: 'trojan' });
        }

        if (procPath.includes('\\appdata\\roaming\\') && procPath.endsWith('.exe')) {
            const known = ['discord', 'slack', 'teams', 'spotify', 'telegram',
                           'whatsapp', 'zoom', 'signal', 'notion'].some(k => procPath.includes(k));
            if (!known) {
                risks.push({ reason: 'AppData/Roaming\'dan bilinmeyen süreç çalışıyor', severity: 'medium', virusType: 'trojan' });
            }
        }

        const nameWithoutExe = procName.replace(/\.exe$/, '');
        if (['.doc', '.pdf', '.jpg', '.txt', '.png'].some(fe => nameWithoutExe.endsWith(fe))) {
            risks.push({ reason: 'Yanıltıcı süreç adı — çift uzantı tekniği', severity: 'high', virusType: 'trojan' });
        }

        if (risks.length === 0) continue;

        const sev   = ['high', 'medium', 'low'].find(s => risks.some(r => r.severity === s)) || 'low';
        const vType = risks[0]?.virusType || 'trojan';
        suspicious.push({
            pid:          p.Id,
            name:         p.Name || 'Bilinmiyor',
            path:         p.Path || '—',
            risks,
            maxSeverity:  sev,
            virusType:    vType,
            virusTypeMeta: VIRUS_TYPE_META[vType] || VIRUS_TYPE_META.unknown,
        });
    }

    return suspicious;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANA TARAMA FONKSİYONU
// ═══════════════════════════════════════════════════════════════════════════════
async function runEngineScan(progressCallback) {
    const t0   = Date.now();
    const emit = (phase, percent, detail) => {
        if (progressCallback) progressCallback({ phase, percent, detail });
    };

    emit('init', 3, 'Tarama dizinleri belirleniyor…');

    const targets      = getScanTargets();
    const infectedFiles = [];
    let   totalScanned  = 0;

    emit('scanning', 8, `${targets.length} dizin taranacak`);

    for (let i = 0; i < targets.length; i++) {
        const dir = targets[i];
        const pct = 10 + Math.round(((i + 1) / targets.length) * 60);
        emit('scanning', pct, `Taranıyor: …\\${path.basename(dir)}`);

        // Sistem dizinleri için daha derin ve geniş tarama
        const isSystemDir = ['system32', 'syswow64', 'program files', 'programdata']
            .some(s => dir.toLowerCase().includes(s));
        const scanOpts = isSystemDir
            ? { maxDepth: 2, scanLimit: 5000 }
            : { maxDepth: 4, scanLimit: 3000 };
        const { hits, scanned } = scanDirectory(dir, scanOpts);
        infectedFiles.push(...hits);
        totalScanned += scanned;

        await new Promise(r => setImmediate(r));
    }

    emit('processes', 75, 'Çalışan süreçler analiz ediliyor…');
    await new Promise(r => setImmediate(r));

    const suspiciousProcesses = analyzeProcesses();

    emit('done', 100, 'Tarama tamamlandı');

    // Virüs türü bazında özet
    const typeBreakdown = {};
    for (const f of infectedFiles) {
        for (const vt of f.virusTypes) {
            typeBreakdown[vt] = (typeBreakdown[vt] || 0) + 1;
        }
    }
    for (const p of suspiciousProcesses) {
        typeBreakdown[p.virusType] = (typeBreakdown[p.virusType] || 0) + 1;
    }

    const criticalCount = infectedFiles.filter(f => f.maxSeverity === 'critical').length;
    const highCount     = infectedFiles.filter(f => f.maxSeverity === 'high').length;

    return {
        engine:              'SysGuard Engine v1.1',
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
        typeBreakdown,       // { ransomware: 2, trojan: 1, ... }
        virusTypeMeta:       VIRUS_TYPE_META,
        status:
            infectedFiles.length === 0 && suspiciousProcesses.length === 0
                ? 'clean' : 'threats_found',
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AKSİYONLAR
// ═══════════════════════════════════════════════════════════════════════════════
function quarantineFile(filePath) {
    try {
        const qDir = path.join(os.homedir(), '.sysguard', 'quarantine');
        if (!fs.existsSync(qDir)) fs.mkdirSync(qDir, { recursive: true });

        const stamp    = Date.now();
        const baseName = path.basename(filePath);
        const dest     = path.join(qDir, `${baseName}.${stamp}.quarantine`);

        fs.renameSync(filePath, dest);
        fs.writeFileSync(dest + '.meta.json', JSON.stringify({
            original: filePath, quarantined: dest, timestamp: new Date().toISOString(),
        }, null, 2), 'utf8');

        return { success: true, quarantinedTo: dest, original: filePath };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function deleteFile(filePath) {
    try {
        fs.unlinkSync(filePath);
        return { success: true, deleted: filePath };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function killProcess(pid) {
    try {
        execSync(`taskkill /F /PID ${pid}`, { windowsHide: true, timeout: 5000 });
        return { success: true, pid };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

function scanSingleFile(filePath, progressCallback) {
    const emit = (phase, percent, detail) => {
        if (progressCallback) progressCallback({ phase, percent, detail });
    };

    const t0 = Date.now();
    emit('scanning', 10, `Dosya okunuyor: ${path.basename(filePath)}`);

    let stat;
    try { stat = require('fs').statSync(filePath); } catch (e) {
        return { error: 'Dosya okunamadı: ' + e.message };
    }

    if (stat.size > 50 * 1024 * 1024) {
        return { error: 'Dosya çok büyük (>50MB), taranamaz.' };
    }

    emit('scanning', 50, 'Hash ve imza analizi yapılıyor…');
    const hit = analyzeFile(filePath);
    emit('done', 100, 'Tarama tamamlandı');

    const infectedFiles = hit ? [hit] : [];
    const typeBreakdown = {};
    for (const f of infectedFiles) {
        for (const vt of f.virusTypes) {
            typeBreakdown[vt] = (typeBreakdown[vt] || 0) + 1;
        }
    }

    return {
        engine:          'SysGuard Engine v1.1',
        scanTime:        new Date().toISOString(),
        elapsed:         Date.now() - t0,
        scannedFile:     filePath,
        totalScanned:    1,
        infectedFiles,
        suspiciousProcesses: [],
        threatCount:     infectedFiles.length,
        criticalCount:   infectedFiles.filter(f => f.maxSeverity === 'critical').length,
        highCount:       infectedFiles.filter(f => f.maxSeverity === 'high').length,
        processRiskCount: 0,
        typeBreakdown,
        virusTypeMeta:   VIRUS_TYPE_META,
        status:          infectedFiles.length === 0 ? 'clean' : 'threats_found',
        singleFile:      true,
    };
}

module.exports = {
    runEngineScan,
    scanSingleFile,
    analyzeFile,
    quarantineFile,
    deleteFile,
    killProcess,
    VIRUS_TYPE_META,
};
