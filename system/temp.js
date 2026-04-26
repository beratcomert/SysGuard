const fs   = require('fs');
const os   = require('os');
const path = require('path');

function cleanTemp() {
    const dirs = [os.tmpdir()];

    // Windows\Temp klasörünü de temizle (izin varsa)
    const winTemp = path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'Temp');
    if (winTemp.toLowerCase() !== os.tmpdir().toLowerCase()) {
        dirs.push(winTemp);
    }

    let deleted = 0, skipped = 0, freedBytes = 0;

    for (const dir of dirs) {
        try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);
                try {
                    try { freedBytes += fs.statSync(filePath).size || 0; } catch (_) {}
                    fs.rmSync(filePath, { recursive: true, force: true });
                    deleted++;
                } catch (_) {
                    skipped++;
                }
            }
        } catch (_) {
            // Dizine erişilemiyor, atla
        }
    }

    return {
        status: 'cleaned',
        freedMB: parseFloat((freedBytes / 1024 / 1024).toFixed(1)),
        deletedCount: deleted,
        skipped,
    };
}

module.exports = { cleanTemp };
