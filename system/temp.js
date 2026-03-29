const fs = require("fs");
const os = require("os");
const path = require("path");

function cleanTemp() {
    const tempDir = os.tmpdir(); // temp klasörü

    try {
        // klasördeki dosyaları oku
        fs.readdirSync(tempDir).forEach(file => {

            const filePath = path.join(tempDir, file);

            try {
                // dosya veya klasörü sil
                fs.rmSync(filePath, { recursive: true, force: true });
            } catch (err) {
                // silinemeyenleri geç
            }

        });

        return { status: "cleaned" };

    } catch (err) {
        return { status: "error" };
    }
}

module.exports = { cleanTemp };