const { exec } = require("child_process"); // komut çalıştırma

function scanSystem() {
    return new Promise((resolve, reject) => {

        // Windows sistem tarama komutu
        exec("sfc /scannow", (error, stdout, stderr) => {

            // hata olursa
            if (error) {
                return resolve({
                    status: "error",
                    message: "Scan failed"
                });
            }

            let issues = 0;

            // çıktı içinde hata var mı kontrol et
            if (stdout.includes("Windows Resource Protection found corrupt files")) {
                issues = 1;
            }

            // sonucu frontend'e gönder
            resolve({
                status: "done",
                issues: issues,
                raw: stdout // detaylı çıktı
            });

        });
    });
}

module.exports = { scanSystem };