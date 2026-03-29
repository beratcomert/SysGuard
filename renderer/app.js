const output = document.getElementById("output");

async function scan() {
    const res = await window.electronAPI.scanSystem();
    output.innerText = JSON.stringify(res, null, 2);
}

async function health() {
    const res = await window.electronAPI.getHealth();
    output.innerText = JSON.stringify(res, null, 2);
}

async function clean() {
    const res = await window.electronAPI.cleanTemp();
    output.innerText = JSON.stringify(res, null, 2);
}