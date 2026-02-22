const WebSocket = require('ws');
const si = require('systeminformation');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const args = process.argv.slice(2);
let port, pluginUUID, registerEvent;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '-port') port = args[i + 1];
    else if (args[i] === '-pluginUUID') pluginUUID = args[i + 1];
    else if (args[i] === '-registerEvent') registerEvent = args[i + 1];
}

const ws = new WebSocket(`ws://127.0.0.1:${port}`);
let activeContexts = {}; 
let pollingInterval = null;
let timerInterval = null;
let activeTimers = {}; 
let monitorBrightness = 50;
let ddcutilTimeout = null;
let lastSentImages = {}; 

const coreCount = os.cpus().length;

function getShortProcName(name) {
    let n = name.split(/[/\\]/).pop().replace(/\.(exe|bin|AppImage)$/i, '');
    let lower = n.toLowerCase();
    if (lower.includes('brave')) return 'Brave';
    if (lower.includes('firefox')) return 'Firefox';
    if (lower.includes('discord')) return 'Discord';
    if (lower.includes('steam')) return 'Steam';
    if (lower.includes('wow')) return 'WoW';
    if (lower.includes('plasma')) return 'Plasma';
    if (lower.includes('kwin')) return 'KWin';
    return n.length > 9 ? n.substring(0, 8) + '…' : n;
}

function generateButtonImage(icon, title, line1, line2, percent = -1) {
    let barHtml = '';
    if (percent >= 0) {
        let p = Math.max(0, Math.min(100, percent));
        let r = p > 50 ? 255 : Math.floor((p * 2) * 255 / 100);
        let g = p < 50 ? 255 : Math.floor((100 - p) * 2 * 255 / 100);
        barHtml = `<rect x="15" y="122" width="114" height="8" fill="#333" rx="4"/><rect x="15" y="122" width="${1.14 * p}" height="8" fill="rgb(${r},${g},0)" rx="4"/>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144">
        <rect width="144" height="144" fill="#18181b"/>
        <text x="72" y="32" fill="#a1a1aa" font-family="sans-serif" font-size="22" font-weight="bold" text-anchor="middle">${title}</text>
        <text x="72" y="72" fill="#ffffff" font-family="sans-serif" font-size="30" font-weight="bold" text-anchor="middle">${line1}</text>
        <text x="72" y="105" fill="#a1a1aa" font-family="sans-serif" font-size="20" text-anchor="middle">${line2}</text>
        ${barHtml}
    </svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function generateDialImage(icon, title, valueText, percent = -1, barColor = "rgb(74, 222, 128)") {
    let barHtml = '';
    if (percent >= 0) {
         let p = Math.max(0, Math.min(100, percent));
         barHtml = `<rect x="22" y="115" width="100" height="8" fill="#333" rx="4"/><rect x="22" y="115" width="${1.0 * p}" height="8" fill="${barColor}" rx="4"/>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144">
        <rect width="144" height="144" fill="#18181b"/>
        <text x="72" y="35" fill="#a1a1aa" font-family="sans-serif" font-size="28" text-anchor="middle">${icon}</text>
        <text x="72" y="58" fill="#a1a1aa" font-family="sans-serif" font-size="18" font-weight="bold" text-anchor="middle">${title}</text>
        <text x="72" y="100" fill="#ffffff" font-family="sans-serif" font-size="42" font-weight="bold" text-anchor="middle">${valueText}</text>
        ${barHtml}
    </svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function getAmdGpuStats() { 
    try { 
        const hwmonPath = '/sys/class/hwmon'; const dirs = fs.readdirSync(hwmonPath); 
        for (const dir of dirs) { 
            const namePath = path.join(hwmonPath, dir, 'name'); 
            if (fs.existsSync(namePath) && fs.readFileSync(namePath, 'utf8').trim() === 'amdgpu') { 
                const amdgpuDir = path.join(hwmonPath, dir); 
                const readSensor = (file) => fs.existsSync(path.join(amdgpuDir, file)) ? parseInt(fs.readFileSync(path.join(amdgpuDir, file), 'utf8').trim()) : null; 
                const tempEdge = readSensor('temp1_input'); 
                const power = readSensor('power1_average') || readSensor('power1_input'); 
                const usagePath = path.join(amdgpuDir, 'device', 'gpu_busy_percent'); 
                const usage = fs.existsSync(usagePath) ? parseInt(fs.readFileSync(usagePath, 'utf8').trim()) : null; 
                const vramUsedPath = path.join(amdgpuDir, 'device', 'mem_info_vram_used');
                const vramTotalPath = path.join(amdgpuDir, 'device', 'mem_info_vram_total');
                const vramUsed = fs.existsSync(vramUsedPath) ? parseInt(fs.readFileSync(vramUsedPath, 'utf8').trim()) : 0;
                const vramTotal = fs.existsSync(vramTotalPath) ? parseInt(fs.readFileSync(vramTotalPath, 'utf8').trim()) : 0;
                return { temp: tempEdge ? Math.round(tempEdge / 1000) : 0, power: power ? Math.round(power / 1000000) : 0, usage: usage !== null ? usage : 0, vramUsed: vramUsed, vramTotal: vramTotal }; 
            } 
        } 
    } catch (e) {} 
    return { temp: 0, power: 0, usage: 0, vramUsed: 0, vramTotal: 0 }; 
}

let lastCpuEnergy = null; let lastCpuTime = null; let cpuEnergyFile = null;
function getCpuPower() { 
    try { 
        const hwmonPath = '/sys/class/hwmon'; 
        const dirs = fs.readdirSync(hwmonPath); 
        for (const dir of dirs) { 
            const dirPath = path.join(hwmonPath, dir); const namePath = path.join(dirPath, 'name'); 
            if (!fs.existsSync(namePath)) continue;
            const name = fs.readFileSync(namePath, 'utf8').trim();
            if (['zenpower', 'amd_energy', 'zenergy'].includes(name)) {
                let p = path.join(dirPath, 'power1_average'); if (!fs.existsSync(p)) p = path.join(dirPath, 'power1_input');
                if (fs.existsSync(p)) return Math.round(parseInt(fs.readFileSync(p, 'utf8').trim()) / 1000000);
            }
        }
    } catch (e) {} return 0; 
}

let lastPing = 0;
let failedPings = 0;
let lastPingTime = 0;

// VERBESSERTE PING LOGIK (HIGH PRECISION)
const getPing = (force = false) => new Promise(resolve => { 
    exec("ping -c 1 -W 2 1.1.1.1", (err, stdout) => { 
        if (err || !stdout) {
            failedPings++;
            if (failedPings > 3 || force) lastPing = 0; 
            return resolve(lastPing); 
        }
        failedPings = 0;
        const match = stdout.match(/time=([0-9.]+)/); 
        if (match) {
            const ms = parseFloat(match[1]);
            // Wenn ms > 0 aber < 1 (z.B. 0.4ms), zeige 1ms an. Sonst runden.
            lastPing = (ms > 0 && ms < 1) ? 1 : Math.round(ms);
        }
        resolve(lastPing); 
    }); 
});

const getAudio = () => new Promise(resolve => { exec("wpctl get-volume @DEFAULT_AUDIO_SINK@", (err, stdout) => { if (err || !stdout) return resolve({ vol: 0, muted: false }); const vol = Math.round(parseFloat(stdout.split(' ')[1]) * 100); const muted = stdout.includes('MUTED'); resolve({ vol, muted }); }); });
const adjustVolume = (ticks) => { exec(`wpctl set-mute @DEFAULT_AUDIO_SINK@ 0`); exec(`wpctl set-volume -l 1.0 @DEFAULT_AUDIO_SINK@ ${ticks > 0 ? '2%+' : '2%-'}`); };
const toggleMute = () => exec(`wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle`);

function sendUpdateIfChanged(context, imgData) {
    if (imgData && imgData !== lastSentImages[context]) {
        ws.send(JSON.stringify({ event: 'setImage', context: context, payload: { image: imgData, target: 0 } }));
        lastSentImages[context] = imgData;
    }
}

function updateDialUI(context, action) {
    if (action === 'com.minginfo.monbright') {
        sendUpdateIfChanged(context, generateDialImage('☀️', 'MONITOR', `${monitorBrightness}%`, monitorBrightness, "rgb(250, 204, 21)"));
    }
}

function updateTimerUI(context) {
    const t = activeTimers[context];
    if (!t) return;
    const timeStr = `${Math.floor(t.remaining / 60)}:${(t.remaining % 60).toString().padStart(2, '0')}`;
    let percent = t.total > 0 ? Math.round((t.remaining / t.total) * 100) : 0;
    let color = "rgb(59, 130, 246)"; 
    if (t.state === 'running') color = "rgb(74, 222, 128)"; 
    if (t.state === 'paused') color = "rgb(250, 204, 21)"; 
    let title = 'TIMER'; let icon = '⏱️';
    if (t.state === 'ringing') { color = "rgb(239, 68, 68)"; title = 'ALARM!'; icon = '🔔'; }
    sendUpdateIfChanged(context, generateDialImage(icon, title, timeStr, percent, color));
}

ws.on('open', () => ws.send(JSON.stringify({ event: registerEvent, uuid: pluginUUID })));

ws.on('message', (data) => {
    const msg = JSON.parse(data);
    const { event, action, context } = msg;

    if (event === 'willAppear') {
        activeContexts[context] = { action: action, isEncoder: msg.payload?.controller === 'Encoder' };
        if (action === 'com.minginfo.timer' && !activeTimers[context]) activeTimers[context] = { total: 0, remaining: 0, state: 'stopped' };
        if (action === 'com.minginfo.monbright') updateDialUI(context, action);
        if (action === 'com.minginfo.audio') updateAudioImmediately(context);
        
        if (!pollingInterval) startPolling();
        if (!timerInterval) startTimerLoop();
    }
    
    if (event === 'willDisappear') {
        delete activeContexts[context]; delete lastSentImages[context];
        if (Object.keys(activeContexts).length === 0) { clearInterval(pollingInterval); pollingInterval = null; clearInterval(timerInterval); timerInterval = null; }
    }

    if (event === 'dialRotate') {
        const ticks = msg.payload.ticks;
        if (action === 'com.minginfo.audio') { adjustVolume(ticks); updateAudioImmediately(context); }
        if (action === 'com.minginfo.timer') {
            let t = activeTimers[context];
            if (t.state === 'stopped' || t.state === 'paused') { t.total = Math.max(0, t.total + (ticks * 60)); t.remaining = t.total; updateTimerUI(context); }
        }
        if (action === 'com.minginfo.monbright') {
            monitorBrightness = Math.max(0, Math.min(100, monitorBrightness + (ticks * 5))); updateDialUI(context, action);
            clearTimeout(ddcutilTimeout); ddcutilTimeout = setTimeout(() => { exec(`ddcutil setvcp 10 ${monitorBrightness} --noverify`); }, 300);
        }
    }

    if (event === 'dialDown' || event === 'keyDown') {
        if (!activeContexts[context]?.isEncoder) {
            if (action === 'com.minginfo.cpu') exec("plasma-systemmonitor > /dev/null 2>&1 &");
            if (action === 'com.minginfo.gpu') exec("lact gui > /dev/null 2>&1 &");
            if (action === 'com.minginfo.ping') updatePingImmediately(context);
        }
        if (action === 'com.minginfo.audio') { toggleMute(); setTimeout(() => updateAudioImmediately(context), 100); }
        if (action === 'com.minginfo.timer') {
            let t = activeTimers[context];
            if (t.state === 'ringing') { t.state = 'stopped'; t.remaining = t.total; } 
            else if (t.state === 'stopped' && t.total > 0) t.state = 'running';
            else if (t.state === 'running') t.state = 'paused';
            else if (t.state === 'paused') t.state = 'running';
            updateTimerUI(context);
        }
        if (action === 'com.minginfo.monbright') { monitorBrightness = 50; updateDialUI(context, action); exec(`ddcutil setvcp 10 50 --noverify`); }
    }
});

async function updatePingImmediately(context) {
    let loadingImg = generateButtonImage('⚡', 'PING', `... ms`, `1.1.1.1`, 0);
    sendUpdateIfChanged(context, loadingImg);
    lastPingTime = Date.now(); 
    await getPing(true);
    let finalImg = generateButtonImage('⚡', 'PING', `${lastPing} ms`, `1.1.1.1`, Math.min(100, lastPing));
    sendUpdateIfChanged(context, finalImg);
}

async function updateAudioImmediately(context) {
    const audioData = await getAudio();
    const valText = audioData.muted ? 'MUTED' : `${audioData.vol}%`;
    const imgData = generateDialImage(audioData.muted ? '🔇' : '🔊', 'VOLUME', valText, audioData.vol, audioData.muted ? "rgb(239, 68, 68)" : "rgb(74, 222, 128)");
    sendUpdateIfChanged(context, imgData);
}

function startTimerLoop() {
    timerInterval = setInterval(() => {
        for (const context in activeTimers) {
            let t = activeTimers[context];
            if (t.state === 'running') {
                t.remaining -= 1;
                if (t.remaining <= 0) { 
                    t.remaining = 0; t.state = 'ringing'; 
                    const snd = "paplay /usr/share/sounds/freedesktop/stereo/complete.oga || aplay /usr/share/sounds/alsa/Front_Center.wav";
                    exec(`${snd} ; sleep 0.3 ; ${snd} ; sleep 0.3 ; ${snd}`);
                    setTimeout(() => {
                        if (activeTimers[context] && activeTimers[context].state === 'ringing') {
                            activeTimers[context].state = 'stopped'; activeTimers[context].remaining = activeTimers[context].total;
                            if (activeContexts[context]) updateTimerUI(context);
                        }
                    }, 4000);
                }
                if (activeContexts[context]) updateTimerUI(context);
            }
        }
    }, 1000);
}

function startPolling() {
    pollingInterval = setInterval(async () => {
        try {
            const actionsList = Object.values(activeContexts).map(e => e.action);
            if (actionsList.length === 0) return;

            let cpuData = {}, cpuTemp = {}, memData = {}, netData = [], diskData = [], procData = { list: [] }, audioData = { vol: 0, muted: false };
            const promises = [];

            if (actionsList.includes('com.minginfo.cpu')) { promises.push(si.currentLoad().then(d => cpuData = d).catch(() => {})); promises.push(si.cpuTemperature().then(d => cpuTemp = d).catch(() => {})); }
            if (actionsList.includes('com.minginfo.ram')) promises.push(si.mem().then(d => memData = d).catch(() => {}));
            if (actionsList.includes('com.minginfo.net')) promises.push(si.networkStats('eno1').then(d => netData = d).catch(() => {}));
            if (actionsList.includes('com.minginfo.disk')) promises.push(si.fsSize().then(d => diskData = d).catch(() => {}));
            if (actionsList.includes('com.minginfo.top')) promises.push(si.processes().then(d => procData = d).catch(() => {}));
            if (actionsList.includes('com.minginfo.audio')) promises.push(getAudio().then(d => audioData = d));

            if (actionsList.includes('com.minginfo.ping')) {
                if (Date.now() - lastPingTime >= 5000) {
                    lastPingTime = Date.now();
                    promises.push(getPing());
                } else {
                    promises.push(Promise.resolve(lastPing));
                }
            }

            await Promise.all(promises);

            const gpuStats = (actionsList.includes('com.minginfo.gpu') || actionsList.includes('com.minginfo.vram')) ? getAmdGpuStats() : null;
            const cpuWatts = actionsList.includes('com.minginfo.cpu') ? getCpuPower() : null;

            for (const context in activeContexts) {
                const { action, isEncoder } = activeContexts[context];

                if (isEncoder && action === 'com.minginfo.audio') {
                    const valText = audioData.muted ? 'MUTED' : `${audioData.vol}%`;
                    const imgData = generateDialImage(audioData.muted ? '🔇' : '🔊', 'VOLUME', valText, audioData.vol, audioData.muted ? "rgb(239, 68, 68)" : "rgb(74, 222, 128)");
                    sendUpdateIfChanged(context, imgData);
                } 
                else if (!isEncoder) {
                    let imgData = "";
                    if (action === 'com.minginfo.cpu') imgData = generateButtonImage('💻', 'CPU', `${Math.round(cpuData.currentLoad || 0)}%`, `${cpuWatts}W | ${Math.round(cpuTemp.main || 0)}°C`, cpuData.currentLoad);
                    else if (action === 'com.minginfo.gpu') imgData = generateButtonImage('🎮', 'GPU', `${gpuStats.usage}%`, `${gpuStats.power}W | ${gpuStats.temp}°C`, gpuStats.usage);
                    else if (action === 'com.minginfo.ram') imgData = generateButtonImage('🧠', 'RAM', `${Math.round((memData.active / memData.total) * 100 || 0)}%`, `${(memData.active / (1024 ** 3)).toFixed(1)} GB`, (memData.active / memData.total) * 100);
                    else if (action === 'com.minginfo.vram') {
                        let usedGB = (gpuStats.vramUsed / (1024 ** 3)).toFixed(1);
                        let totalGB = (gpuStats.vramTotal / (1024 ** 3)).toFixed(0);
                        let percent = gpuStats.vramTotal > 0 ? (gpuStats.vramUsed / gpuStats.vramTotal) * 100 : 0;
                        imgData = generateButtonImage('🎞️', 'VRAM', `${Math.round(percent)}%`, `${usedGB} / ${totalGB} GB`, percent);
                    }
                    else if (action === 'com.minginfo.net') {
                        let dl = "0.0", ul = "0.0";
                        if (netData && netData.length > 0) { dl = ((netData[0].rx_sec * 8) / 1000000).toFixed(1); ul = ((netData[0].tx_sec * 8) / 1000000).toFixed(1); }
                        imgData = generateButtonImage('🌐', 'NET', `↓ ${dl}`, `↑ ${ul} Mb/s`, -1);
                    }
                    else if (action === 'com.minginfo.disk') { 
                        let uniqueDisks = {};
                        diskData.forEach(d => {
                            if (d.fs && d.fs.startsWith('/dev/') && !d.fs.includes('loop')) {
                                if (d.mount && !d.mount.includes('/snap/') && !d.mount.includes('/docker/')) {
                                    uniqueDisks[d.fs] = d; 
                                }
                            }
                        });
                        let totalSize = 0; let totalUsed = 0;
                        Object.values(uniqueDisks).forEach(d => { totalSize += d.size; totalUsed += d.used; });
                        let percent = totalSize > 0 ? (totalUsed / totalSize) * 100 : 0;
                        let freeGB = totalSize > 0 ? (totalSize - totalUsed) / (1024 ** 3) : 0;
                        imgData = generateButtonImage('🖴', 'DISKS', `${Math.round(percent)}%`, `${Math.round(freeGB)} GB free`, percent); 
                    }
                    else if (action === 'com.minginfo.ping') {
                        imgData = generateButtonImage('⚡', 'PING', `${lastPing} ms`, `1.1.1.1`, Math.min(100, lastPing));
                    }
                    else if (action === 'com.minginfo.top') { 
                        const top = procData.list?.filter(p => {
                            let n = p.name.toLowerCase();
                            return !n.includes('node') && !n.includes('opendeck') && !n.includes('systemd') && 
                                   !n.includes('kworker') && !n.includes('ananicy') && !n.includes('rtkit') &&
                                   n !== 'top' && n !== 'sh' && n !== 'cat' && n !== 'grep' && !n.includes('bash');
                        }).sort((a, b) => b.cpu - a.cpu)[0]; 
                        if (top) {
                            let cleanName = getShortProcName(top.name);
                            let load = top.cpu > 100 ? (top.cpu / coreCount) : top.cpu;
                            let loadPercent = Math.min(100, Math.round(load));
                            imgData = generateButtonImage('🔥', 'TOP', cleanName, `${loadPercent}% CPU`, loadPercent); 
                        } else {
                            imgData = generateButtonImage('🔥', 'TOP', 'Idle', `0% CPU`, 0); 
                        }
                    }
                    else if (action === 'com.minginfo.time') { const d = new Date(); imgData = generateButtonImage('🕒', 'UHR', d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }), -1); }

                    if (imgData !== "") {
                        sendUpdateIfChanged(context, imgData);
                    }
                }
            }
        } catch (error) { console.error("Fehler im SysInfo-Loop:", error); }
    }, 2000);
}
