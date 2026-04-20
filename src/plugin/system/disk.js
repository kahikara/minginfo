function getRawDiskKey(fsPath = '') {
  const value = String(fsPath || '').trim();
  if (!value.startsWith('/dev/')) return '';

  const name = value.slice('/dev/'.length);

  if (/^loop\d+$/.test(name)) return '';
  if (/^nvme\d+n\d+p\d+$/.test(name)) return `/dev/${name.replace(/p\d+$/, '')}`;
  if (/^mmcblk\d+p\d+$/.test(name)) return `/dev/${name.replace(/p\d+$/, '')}`;
  if (/^[a-z]+\d+$/.test(name)) return `/dev/${name.replace(/\d+$/, '')}`;

  return value;
}

function shouldIncludeDisk(disk = {}) {
  const fsPath = String(disk.fs || '').trim();
  const mount = String(disk.mount || '').trim();

  if (!fsPath.startsWith('/dev/')) return false;
  if (/^\/dev\/loop\d+$/.test(fsPath)) return false;
  if (mount === '/boot' || mount === '/boot/efi' || mount.startsWith('/boot/')) return false;
  if (mount.includes('/snap/') || mount.includes('/docker/')) return false;

  return true;
}

function collectRawDisks(diskData) {
  const bestByRawDisk = new Map();

  for (const disk of Array.isArray(diskData) ? diskData : []) {
    if (!shouldIncludeDisk(disk)) continue;

    const rawDiskKey = getRawDiskKey(disk.fs);
    if (!rawDiskKey) continue;

    const current = bestByRawDisk.get(rawDiskKey);
    const currentSize = Number(current?.size || 0);
    const nextSize = Number(disk.size || 0);

    if (!current || nextSize > currentSize) {
      bestByRawDisk.set(rawDiskKey, {
        ...disk,
        rawDiskKey,
      });
    }
  }

  return bestByRawDisk;
}

function listAvailableDisks(diskData) {
  return Array.from(collectRawDisks(diskData).values())
    .sort((a, b) => a.rawDiskKey.localeCompare(b.rawDiskKey))
    .map((disk) => {
      const sizeGb = Number(disk.size || 0) / (1024 ** 3);
      const sizeText = sizeGb > 0 ? ` • ${Math.round(sizeGb)} GB` : '';
      return {
        id: disk.rawDiskKey,
        label: `${disk.rawDiskKey}${sizeText}`,
      };
    });
}

function summarizeDisks(diskData, selectedDisks = []) {
  const selectedSet = new Set(
    (Array.isArray(selectedDisks) ? selectedDisks : [])
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
  );

  const disks = Array.from(collectRawDisks(diskData).values())
    .filter((disk) => selectedSet.size === 0 || selectedSet.has(disk.rawDiskKey));

  let totalSize = 0;
  let totalUsed = 0;

  for (const disk of disks) {
    totalSize += Number(disk.size || 0);
    totalUsed += Number(disk.used || 0);
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
