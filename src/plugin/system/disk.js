const path = require('path');

function getFilteredDisks(diskData = []) {
  const uniqueDisks = new Map();

  for (const disk of Array.isArray(diskData) ? diskData : []) {
    if (!disk?.fs || !String(disk.fs).startsWith('/dev/')) continue;
    if (String(disk.fs).includes('loop')) continue;
    if (disk.mount && (String(disk.mount).includes('/snap/') || String(disk.mount).includes('/docker/'))) continue;

    uniqueDisks.set(String(disk.fs), {
      fs: String(disk.fs),
      mount: String(disk.mount || ''),
      size: Number(disk.size || 0),
      used: Number(disk.used || 0),
    });
  }

  return [...uniqueDisks.values()];
}

function formatDiskSize(bytes) {
  const gb = bytes / (1024 ** 3);

  if (gb >= 1024) {
    return `${(gb / 1024).toFixed(1)} TB`;
  }

  return `${Math.round(gb)} GB`;
}

function listAvailableDisks(diskData = []) {
  return getFilteredDisks(diskData)
    .sort((a, b) => a.fs.localeCompare(b.fs))
    .map((disk) => {
      const base = path.basename(disk.fs);
      return {
        id: disk.fs,
        label: `${base} · ${formatDiskSize(disk.size)}`,
      };
    });
}

function summarizeDisks(diskData = [], selectedDisks = []) {
  const allDisks = getFilteredDisks(diskData);
  const selectedSet = new Set(
    (Array.isArray(selectedDisks) ? selectedDisks : [])
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
  );

  const disks = selectedSet.size > 0
    ? allDisks.filter((disk) => selectedSet.has(disk.fs))
    : allDisks;

  let totalSize = 0;
  let totalUsed = 0;

  for (const disk of disks) {
    totalSize += disk.size || 0;
    totalUsed += disk.used || 0;
  }

  if (!totalSize) {
    return { available: false, percent: 0, freeGB: 0 };
  }

  return {
    available: true,
    percent: (totalUsed / totalSize) * 100,
    freeGB: (totalSize - totalUsed) / (1024 ** 3),
  };
}

module.exports = {
  listAvailableDisks,
  summarizeDisks,
};
