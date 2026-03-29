const { spawn } = require("child_process");// komut çalıştırma

function scanSystem() {
    return new Promise((resolve, reject) => {

        const process = spawn("sfc", ["/scannow"]);

        let output = "";

        process.stdout.on("data", (data) => {
            // 🔥 EN KRİTİK KISIM (encoding fix)
            output += data.toString("utf16le");
        });

        process.stderr.on("data", (data) => {
            console.error("Error:", data.toString());
        });

        process.on("close", () => {

            // null karakterleri temizle
            output = output.replace(/\u0000/g, "");

            let issues = 0;

            if (output.includes("Windows Resource Protection found corrupt files")) {
                issues = 1;
            }

            resolve({
                status: "done",
                issues: issues,
                raw: output
            });
        });
    });
}

module.exports = { scanSystem };