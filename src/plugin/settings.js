const state = require('./state');
const { DEFAULT_SETTINGS } = require('./constants');
const { clamp } = require('./utils');

function hasOwn(settings, key) {
  return Object.prototype.hasOwnProperty.call(settings, key);
}

function normalizeSettings(settings = {}) {
  const normalized = {
    ...DEFAULT_SETTINGS,
  };

  if (typeof settings.pingHost === 'string' && settings.pingHost.trim()) {
    normalized.pingHost = settings.pingHost.trim();
  }

  if (typeof settings.networkInterface === 'string') {
    normalized.networkInterface = settings.networkInterface.trim();
  }

  if (typeof settings.gpuSelector === 'string') {
    const gpuSelector = settings.gpuSelector.trim();
    normalized.gpuSelector = gpuSelector || DEFAULT_SETTINGS.gpuSelector;
  }

  if (typeof settings.batteryDevice === 'string') {
    const batteryDevice = settings.batteryDevice.trim();
    normalized.batteryDevice = batteryDevice || DEFAULT_SETTINGS.batteryDevice;
  }

  if (typeof settings.batteryLabel === 'string') {
    normalized.batteryLabel = settings.batteryLabel.trim();
  }

  if (typeof settings.fanSelector === 'string') {
    const fanSelector = settings.fanSelector.trim();
    normalized.fanSelector = fanSelector || DEFAULT_SETTINGS.fanSelector;
  }

  if (typeof settings.fanLabel === 'string') {
    normalized.fanLabel = settings.fanLabel.trim();
  }

  if (Array.isArray(settings.selectedDisks)) {
    normalized.selectedDisks = settings.selectedDisks
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  }

  if (settings.volumeStep !== undefined) {
    normalized.volumeStep = clamp(Number.parseInt(settings.volumeStep, 10) || DEFAULT_SETTINGS.volumeStep, 1, 20);
  }

  if (settings.brightnessStep !== undefined) {
    normalized.brightnessStep = clamp(Number.parseInt(settings.brightnessStep, 10) || DEFAULT_SETTINGS.brightnessStep, 1, 25);
  }

  if (settings.timerStep !== undefined) {
    normalized.timerStep = clamp(Number.parseInt(settings.timerStep, 10) || DEFAULT_SETTINGS.timerStep, 1, 60);
  }

  if (settings.topMode === 'raw' || settings.topMode === 'grouped') {
    normalized.topMode = settings.topMode;
  }

  if (settings.barMode === 'temp' || settings.barMode === 'load' || settings.barMode === 'power') {
    normalized.barMode = settings.barMode;
  }

  const refresh = Number.parseInt(settings.refreshRate, 10);
  normalized.refreshRate = [1, 3, 5, 10].includes(refresh) ? refresh : DEFAULT_SETTINGS.refreshRate;

  if (settings.pressAction === 'command' || settings.pressAction === 'default') {
    normalized.pressAction = settings.pressAction;
  }

  if (typeof settings.pressCommand === 'string') {
    normalized.pressCommand = settings.pressCommand.trim();
  }

  return normalized;
}

function normalizePluginWideSettings(settings = {}) {
  const refresh = Number.parseInt(settings.refreshRate, 10);

  return {
    refreshRate: [1, 3, 5, 10].includes(refresh) ? refresh : DEFAULT_SETTINGS.refreshRate,
  };
}

function storeSettingsForContext(context, settings = {}) {
  const currentSettings = context ? (state.contextSettings[context] || {}) : {};
  const normalized = normalizeSettings({
    ...currentSettings,
    ...settings,
  });

  if (context) {
    state.contextSettings[context] = normalized;
  }

  return false;
}

function getSettingsForContext(context) {
  return normalizeSettings(state.contextSettings[context] || {});
}

function getPluginWideSettings() {
  return normalizePluginWideSettings(state.globalPluginSettings || {});
}

function getResolvedAction(context, fallbackAction = '') {
  return state.activeContexts[context]?.action || fallbackAction || '';
}

module.exports = {
  normalizeSettings,
  storeSettingsForContext,
  getSettingsForContext,
  getPluginWideSettings,
  getResolvedAction,
};
