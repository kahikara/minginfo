const path = require('path');

function isRelevantDiskEntry(disk = {}) {
  const fs = String(disk.fs || '');
  const mount = String(disk.mount || '');

  if (!fs.startsWith('/dev/')) return false;
  if (fs.includes('loop')) return false;
  if (mount === '/boot' || mount === '/boot/efi') return false;
  if (mount.includes('/snap/') || mount.includes('/docker/')) return false;

  return true;
}

function getBaseDiskId(fsPath = '') {
  const fs = String(fsPath).trim();

  if (/^\/dev\/nvme\d+n\d+p\d+$/.test(fs)) {
    return fs.replace(/p\d+$/, '');
  }

  if (/^\/dev\/mmcblk\d+p\d+$/.test(fs)) {
    return fs.replace(/p\d+$/, '');
  }

  if (/^\/dev\/sd[a-z]\d+$/.test(fs)) {
    return fs.replace(/\d+$/, '');
  }

  if (/^\/dev\/vd[a-z]\d+$/.test(fs)) {
    return fs.replace(/\d+$/, '');
  }

  if (/^\/dev\/xvd[a-z]\d+$/.test(fs)) {
    return fs.replace(/\d+$/, '');
  }

  return fs;
}

function getFilteredDiskEntries(diskData = []) {
  const uniqueByFs = new Map();

  for (const disk of Array.isArray(diskData) ? diskData : []) {
    if (!isRelevantDiskEntry(disk)) continue;

    const fs = String(disk.fs);
    if (uniqueByFs.has(fs)) continue;

    uniqueByFs.set(fs, {
      fs,
      mount: String(disk.mount || ''),
      size: Number(disk.size || 0),
      used: Number(disk.used || 0),
      diskId: getBaseDiskId(fs),
    });
  }

  return [...uniqueByFs.values()];
}

function groupEntriesByDisk(diskData = []) {
  const groups = new Map();

  for (const entry of getFilteredDiskEntries(diskData)) {
    if (!groups.has(entry.diskId)) {
      groups.set(entry.diskId, {
        id: entry.diskId,
        size: 0,
        used: 0,
        partitions: [],
      });
    }

    const group = groups.get(entry.diskId);
    group.size += entry.size;
    group.used += entry.used;
    group.partitions.push(entry);
  }

  return [...groups.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function formatDiskSize(bytes) {
  const gb = bytes / (1024 ** 3);

  if (gb >= 1024) {
    return `${(gb / 1024).toFixed(1)} TB`;
  }

  return `${Math.round(gb)} GB`;
}

function listAvailableDisks(diskData = []) {
  return groupEntriesByDisk(diskData).map((disk) => ({
    id: disk.id,
    label: `${path.basename(disk.id)} · ${formatDiskSize(disk.size)}`,
  }));
}

function summarizeDisks(diskData = [], selectedDisks = []) {
  const grouped = groupEntriesByDisk(diskData);

  const selectedSet = new Set(
    (Array.isArray(selectedDisks) ? selectedDisks : [])
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
  );

  const disks = selectedSet.size > 0
    ? grouped.filter((disk) => selectedSet.has(disk.id))
    : grouped;

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
