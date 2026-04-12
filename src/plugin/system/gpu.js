const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const state = require('../state');
const { fileExists, readText, warnOnce } = require('../utils');

function unavailableGpuStats() {
  return {
    available: false,
    temp: 0,
    power: 0,
    usage: 0,
    vramUsed: 0,
    vramTotal: 0,
  };
}

function parsePciBusId(value) {
  return /^\d{4}:\d{2}:\d{2}\.\d$/.test(String(value || '').trim()) ? String(value).trim() : '';
}

function getPciBusIdFromDevicePath(devicePath) {
  try {
    return parsePciBusId(path.basename(fs.realpathSync(devicePath)));
  } catch (error) {
    return '';
  }
}

function getPciBusIdFromHwmonDir(gpuDir) {
  return getPciBusIdFromDevicePath(path.join(gpuDir, 'device'));
}

function getPciBusIdFromCardDir(cardDir) {
  return getPciBusIdFromDevicePath(path.join(cardDir, 'device'));
}

function parseLspciDeviceName(output) {
  const matches = String(output || '').match(/"([^"]*)"/g);
  if (!matches || matches.length < 3) {
    return '';
  }

  return matches[2].slice(1, -1).trim();
}

function getPciDeviceName(pciBusId) {
  if (!pciBusId) {
    return '';
  }

  try {
    const output = execFileSync('lspci', ['-s', pciBusId, '-mm'], {
      encoding: 'utf8',
      timeout: 1500,
    }).trim();

    return parseLspciDeviceName(output);
  } catch (error) {
    return '';
  }
}

function stripLeadingVendor(name = '', vendorPrefix = '') {
  const text = String(name || '').trim();
  if (!text || !vendorPrefix) {
    return text;
  }

  const lower = text.toLowerCase();
  const vendor = vendorPrefix.toLowerCase();

  if (lower.startsWith(`${vendor} `)) {
    return text.slice(vendorPrefix.length).trim();
  }

  if (vendor === 'intel' && lower.startsWith('intel corporation ')) {
    return text.slice('Intel Corporation'.length).trim();
  }

  if (vendor === 'nvidia' && lower.startsWith('nvidia corporation ')) {
    return text.slice('NVIDIA Corporation'.length).trim();
  }

  if (vendor === 'amd' && lower.startsWith('advanced micro devices ')) {
    return text.slice('Advanced Micro Devices'.length).trim();
  }

  return text;
}

function buildGpuLabel(vendorPrefix, gpuName, fallbackLabel, pciBusId = '') {
  const normalizedName = stripLeadingVendor(gpuName, vendorPrefix);
  const base = normalizedName ? `${vendorPrefix} ${normalizedName}` : fallbackLabel;
  return pciBusId ? `${base} (${pciBusId})` : base;
}

function readFirstNonEmpty(paths) {
  for (const candidate of paths) {
    if (!fileExists(candidate)) continue;
    const value = readText(candidate).trim();
    if (value) {
      return value;
    }
  }

  return '';
}

function readNumberFromPaths(paths) {
  for (const candidate of paths) {
    if (!fileExists(candidate)) continue;
    const value = Number.parseInt(readText(candidate), 10);
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function scanAmdGpuDirs() {
  try {
    const hwmonRoot = '/sys/class/hwmon';
    const dirs = fs.readdirSync(hwmonRoot);
    const matches = [];

    for (const dir of dirs) {
      const fullPath = path.join(hwmonRoot, dir);
      const namePath = path.join(fullPath, 'name');

      if (!fileExists(namePath)) continue;
      if (readText(namePath) === 'amdgpu') {
        matches.push(fullPath);
      }
    }

    return matches;
  } catch (error) {
    warnOnce('amdgpu-scan-failed', `amdgpu scan failed: ${error.message}`);
    return [];
  }
}

function getAmdGpuNameFromHwmonDir(gpuDir, pciBusId = '') {
  const sysfsName = readFirstNonEmpty([
    path.join(gpuDir, 'device', 'product_name'),
    path.join(gpuDir, 'device', 'product_number'),
  ]);

  if (sysfsName) {
    return sysfsName;
  }

  return getPciDeviceName(pciBusId);
}

function getAmdGpuEntries(force = false) {
  const scanned = scanAmdGpuDirs();
  let ordered = scanned;

  if (!force && state.amdgpuDirCache && fileExists(path.join(state.amdgpuDirCache, 'name')) && scanned.includes(state.amdgpuDirCache)) {
    ordered = [state.amdgpuDirCache, ...scanned.filter((dir) => dir !== state.amdgpuDirCache)];
  }

  state.amdgpuDirCache = ordered[0] || null;

  return ordered.map((gpuDir, index) => {
    const pciBusId = getPciBusIdFromHwmonDir(gpuDir);
    const id = `amd:${pciBusId || index}`;
    const gpuName = getAmdGpuNameFromHwmonDir(gpuDir, pciBusId);

    return {
      kind: 'amd',
      id,
      legacyId: `amd:${index}`,
      pciBusId,
      gpuDir,
      label: buildGpuLabel('AMD', gpuName, `AMD GPU ${index + 1}`, pciBusId),
    };
  });
}

function findAmdGpuDir(force = false) {
  if (state.amdgpuDirCache && !force && fileExists(path.join(state.amdgpuDirCache, 'name'))) {
    return state.amdgpuDirCache;
  }

  const entries = getAmdGpuEntries(force);
  return entries[0]?.gpuDir || null;
}

function getAmdGpuStatsFromDir(gpuDir) {
  if (!gpuDir) {
    return unavailableGpuStats();
  }

  try {
    const tempEdge = readNumberFromPaths([path.join(gpuDir, 'temp1_input')]);
    const power = readNumberFromPaths([
      path.join(gpuDir, 'power1_average'),
      path.join(gpuDir, 'power1_input'),
    ]);
    const usage = readNumberFromPaths([path.join(gpuDir, 'device', 'gpu_busy_percent')]);
    const vramUsed = readNumberFromPaths([path.join(gpuDir, 'device', 'mem_info_vram_used')]);
    const vramTotal = readNumberFromPaths([path.join(gpuDir, 'device', 'mem_info_vram_total')]);

    return {
      available: true,
      temp: tempEdge ? Math.round(tempEdge / 1000) : 0,
      power: power ? Math.round(power / 1000000) : 0,
      usage: Number.isFinite(usage) ? usage : 0,
      vramUsed: Number.isFinite(vramUsed) ? vramUsed : 0,
      vramTotal: Number.isFinite(vramTotal) ? vramTotal : 0,
    };
  } catch (error) {
    state.amdgpuDirCache = null;
    warnOnce('amdgpu-read-failed', `amdgpu read failed: ${error.message}`);
    return unavailableGpuStats();
  }
}

function getAmdGpuStats() {
  return getAmdGpuStatsFromDir(findAmdGpuDir());
}

function getAmdGpuStatsBySelector(selector) {
  const entry = getAmdGpuEntries().find((candidate) => selector === candidate.id || selector === candidate.legacyId);
  return entry ? getAmdGpuStatsFromDir(entry.gpuDir) : unavailableGpuStats();
}

function scanIntelGpuCards() {
  try {
    const drmRoot = '/sys/class/drm';
    return fs.readdirSync(drmRoot)
      .filter((name) => /^card\d+$/.test(name))
      .sort((a, b) => (Number.parseInt(a.slice(4), 10) || 0) - (Number.parseInt(b.slice(4), 10) || 0))
      .map((name) => path.join(drmRoot, name))
      .filter((cardDir) => {
        const vendorPath = path.join(cardDir, 'device', 'vendor');
        return fileExists(vendorPath) && readText(vendorPath).trim().toLowerCase() === '0x8086';
      });
  } catch (error) {
    warnOnce('intel-gpu-scan-failed', `intel gpu scan failed: ${error.message}`);
    return [];
  }
}

function findCardHwmonDir(cardDir) {
  try {
    const hwmonRoot = path.join(cardDir, 'device', 'hwmon');
    if (!fs.existsSync(hwmonRoot)) {
      return null;
    }

    const dirs = fs.readdirSync(hwmonRoot).sort();
    const first = dirs.find((name) => name.startsWith('hwmon'));
    return first ? path.join(hwmonRoot, first) : null;
  } catch (error) {
    return null;
  }
}

function getIntelGpuEntries() {
  const cardDirs = scanIntelGpuCards();

  return cardDirs.map((cardDir, index) => {
    const pciBusId = getPciBusIdFromCardDir(cardDir);
    const id = `intel:${pciBusId || index}`;
    const gpuName = getPciDeviceName(pciBusId);

    return {
      kind: 'intel',
      id,
      legacyId: `intel:${index}`,
      pciBusId,
      cardDir,
      hwmonDir: findCardHwmonDir(cardDir),
      label: buildGpuLabel('Intel', gpuName, `Intel GPU ${index + 1}`, pciBusId),
    };
  });
}

function getIntelGpuStatsFromEntry(entry) {
  if (!entry) {
    return unavailableGpuStats();
  }

  try {
    const tempEdge = entry.hwmonDir ? readNumberFromPaths([path.join(entry.hwmonDir, 'temp1_input')]) : null;
    const power = entry.hwmonDir ? readNumberFromPaths([
      path.join(entry.hwmonDir, 'power1_average'),
      path.join(entry.hwmonDir, 'power1_input'),
    ]) : null;
    const usage = readNumberFromPaths([
      path.join(entry.cardDir, 'gt_busy_percent'),
      path.join(entry.cardDir, 'device', 'gt_busy_percent'),
    ]);
    const vramUsed = readNumberFromPaths([
      path.join(entry.cardDir, 'device', 'mem_info_vram_used'),
      path.join(entry.cardDir, 'device', 'lmem_used_bytes'),
    ]);
    const vramTotal = readNumberFromPaths([
      path.join(entry.cardDir, 'device', 'mem_info_vram_total'),
      path.join(entry.cardDir, 'device', 'lmem_total_bytes'),
    ]);

    return {
      available: true,
      temp: tempEdge ? Math.round(tempEdge / 1000) : 0,
      power: power ? Math.round(power / 1000000) : 0,
      usage: Number.isFinite(usage) ? usage : 0,
      vramUsed: Number.isFinite(vramUsed) ? vramUsed : 0,
      vramTotal: Number.isFinite(vramTotal) ? vramTotal : 0,
    };
  } catch (error) {
    warnOnce('intel-gpu-read-failed', `intel gpu read failed: ${error.message}`);
    return unavailableGpuStats();
  }
}

function getIntelGpuStats() {
  const entry = getIntelGpuEntries()[0];
  return entry ? getIntelGpuStatsFromEntry(entry) : unavailableGpuStats();
}

function getIntelGpuStatsBySelector(selector) {
  const entry = getIntelGpuEntries().find((candidate) => selector === candidate.id || selector === candidate.legacyId);
  return entry ? getIntelGpuStatsFromEntry(entry) : unavailableGpuStats();
}

function parseNvidiaCsvNumber(value) {
  const numeric = Number.parseFloat(String(value || '').trim());
  return Number.isFinite(numeric) ? numeric : 0;
}

function runNvidiaQuery(fields) {
  return execFileSync(
    'nvidia-smi',
    [
      `--query-gpu=${fields.join(',')}`,
      '--format=csv,noheader,nounits',
    ],
    { encoding: 'utf8', timeout: 1500 }
  ).trim();
}

function parseNvidiaCsvLine(line) {
  return String(line || '').split(',').map((part) => part.trim());
}

function getNvidiaGpuName(nameRaw, pciBusId = '', index = 0) {
  const directName = stripLeadingVendor(nameRaw, 'NVIDIA');
  if (directName) {
    return directName;
  }

  const lspciName = stripLeadingVendor(getPciDeviceName(pciBusId), 'NVIDIA');
  if (lspciName) {
    return lspciName;
  }

  return `GPU ${index + 1}`;
}

function getNvidiaGpuStatsFromValues(usageRaw, tempRaw, vramUsedRaw, vramTotalRaw, powerRaw) {
  return {
    available: true,
    temp: Math.round(parseNvidiaCsvNumber(tempRaw)),
    power: Math.round(parseNvidiaCsvNumber(powerRaw)),
    usage: Math.round(parseNvidiaCsvNumber(usageRaw)),
    vramUsed: Math.round(parseNvidiaCsvNumber(vramUsedRaw) * 1024 * 1024),
    vramTotal: Math.round(parseNvidiaCsvNumber(vramTotalRaw) * 1024 * 1024),
  };
}

function getNvidiaGpuEntries() {
  try {
    const output = runNvidiaQuery(['index', 'pci.bus_id', 'name']);

    if (!output) {
      return [];
    }

    return output
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line, position) => {
        const [indexRaw, pciBusIdRaw, nameRaw] = parseNvidiaCsvLine(line);
        const index = String(indexRaw || position).trim();
        const pciBusId = String(pciBusIdRaw || '').trim();
        const gpuName = getNvidiaGpuName(nameRaw, pciBusId, position);

        return {
          kind: 'nvidia',
          id: `nvidia:${pciBusId || index}`,
          legacyId: `nvidia:${index}`,
          index,
          pciBusId,
          label: buildGpuLabel('NVIDIA', gpuName, `NVIDIA GPU ${position + 1}`, pciBusId),
        };
      });
  } catch (error) {
    warnOnce('nvidia-smi-scan-failed', `nvidia-smi scan failed: ${error.message}`);
    return [];
  }
}

function getNvidiaGpuStats() {
  try {
    const output = runNvidiaQuery(['utilization.gpu', 'temperature.gpu', 'memory.used', 'memory.total', 'power.draw']);

    if (!output) {
      return unavailableGpuStats();
    }

    const firstLine = output.split(/\r?\n/).find((line) => line.trim().length > 0);
    if (!firstLine) {
      return unavailableGpuStats();
    }

    const [usageRaw, tempRaw, vramUsedRaw, vramTotalRaw, powerRaw] = parseNvidiaCsvLine(firstLine);
    return getNvidiaGpuStatsFromValues(usageRaw, tempRaw, vramUsedRaw, vramTotalRaw, powerRaw);
  } catch (error) {
    warnOnce('nvidia-smi-read-failed', `nvidia-smi read failed: ${error.message}`);
    return unavailableGpuStats();
  }
}

function getNvidiaGpuStatsBySelector(selector) {
  try {
    const output = runNvidiaQuery(['index', 'pci.bus_id', 'utilization.gpu', 'temperature.gpu', 'memory.used', 'memory.total', 'power.draw']);

    if (!output) {
      return unavailableGpuStats();
    }

    for (const line of output.split(/\r?\n/)) {
      if (!line.trim()) continue;

      const [indexRaw, pciBusIdRaw, usageRaw, tempRaw, vramUsedRaw, vramTotalRaw, powerRaw] = parseNvidiaCsvLine(line);
      const index = String(indexRaw || '').trim();
      const pciBusId = String(pciBusIdRaw || '').trim();

      if (selector === `nvidia:${pciBusId}` || selector === `nvidia:${index}`) {
        return getNvidiaGpuStatsFromValues(usageRaw, tempRaw, vramUsedRaw, vramTotalRaw, powerRaw);
      }
    }

    return unavailableGpuStats();
  } catch (error) {
    warnOnce('nvidia-smi-read-failed', `nvidia-smi read failed: ${error.message}`);
    return unavailableGpuStats();
  }
}

function listAvailableGpus() {
  return [
    ...getAmdGpuEntries(),
    ...getNvidiaGpuEntries(),
    ...getIntelGpuEntries(),
  ].map(({ id, label }) => ({ id, label }));
}

function getGpuStats(selector = 'auto') {
  const normalizedSelector = typeof selector === 'string' ? selector.trim() : '';

  if (!normalizedSelector || normalizedSelector === 'auto') {
    const amdStats = getAmdGpuStats();
    if (amdStats.available) {
      return amdStats;
    }

    const nvidiaStats = getNvidiaGpuStats();
    if (nvidiaStats.available) {
      return nvidiaStats;
    }

    return getIntelGpuStats();
  }

  if (normalizedSelector.startsWith('amd:')) {
    return getAmdGpuStatsBySelector(normalizedSelector);
  }

  if (normalizedSelector.startsWith('nvidia:')) {
    return getNvidiaGpuStatsBySelector(normalizedSelector);
  }

  if (normalizedSelector.startsWith('intel:')) {
    return getIntelGpuStatsBySelector(normalizedSelector);
  }

  return getGpuStats('auto');
}

module.exports = {
  getAmdGpuStats,
  getGpuStats,
  listAvailableGpus,
};
