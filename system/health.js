const os = require("os"); // işletim sistemi modülü

function getHealth() {
    const totalMem = os.totalmem(); // toplam RAM
    const freeMem = os.freemem();   // boş RAM

    const usedMem = totalMem - freeMem; // kullanılan RAM

    // yüzde hesaplama
    const ramUsage = ((usedMem / totalMem) * 100).toFixed(2);

    return {
        cpu: os.loadavg()[0], // CPU load (ortalama)
        ram: ramUsage         // RAM kullanım yüzdesi
    };
}

module.exports = { getHealth };