(() => {
  const $ = (id) => document.getElementById(id);

  const fields = {
    pingHost: $('pingHost'),
    networkInterface: $('networkInterface'),
    gpuSelector: $('gpuSelector'),
    barMode: $('barMode'),
    batteryDevice: $('batteryDevice'),
    batteryLabel: $('batteryLabel'),
    fanSelector: $('fanSelector'),
    diskSelectorButton: $('diskSelectorButton'),
    diskSelectorMenu: $('diskSelectorMenu'),
    fanLabel: $('fanLabel'),
    volumeStep: $('volumeStep'),
    brightnessStep: $('brightnessStep'),
    timerStep: $('timerStep'),
    topMode: $('topMode'),
    refreshRate: $('refreshRate'),
    pressAction: $('pressAction'),
    pressCommand: $('pressCommand'),
  };

  const pingHostWrap = $('pingHostWrap');
  const networkInterfaceWrap = $('networkInterfaceWrap');
  const gpuSelectorWrap = $('gpuSelectorWrap');
  const barModeWrap = $('barModeWrap');
  const batterySelectorWrap = $('batterySelectorWrap');
  const batteryLabelWrap = $('batteryLabelWrap');
  const diskSelectorWrap = $('diskSelectorWrap');
  const fanSelectorWrap = $('fanSelectorWrap');
  const fanLabelWrap = $('fanLabelWrap');
  const volumeStepWrap = $('volumeStepWrap');
  const brightnessStepWrap = $('brightnessStepWrap');
  const timerStepWrap = $('timerStepWrap');
  const topModeWrap = $('topModeWrap');
  const pressActionWrap = $('pressActionWrap');
  const pressCommandWrap = $('pressCommandWrap');
  const saveButton = $('saveButton');
  const statusText = $('statusText');

  let websocket = null;
  let actionInfo = null;
  let actionContext = null;
  let currentGpuOptions = [];
  let currentBatteryOptions = [];
  let currentDiskOptions = [];
  let currentFanOptions = [];

  const DEFAULT_SETTINGS = Object.freeze({
    pingHost: '1.1.1.1',
    networkInterface: '',
    gpuSelector: 'auto',
    barMode: 'temp',
    batteryDevice: 'auto',
    batteryLabel: '',
    fanSelector: 'auto',
    fanLabel: '',
    selectedDisks: [],
    volumeStep: 2,
    brightnessStep: 5,
    timerStep: 1,
    topMode: 'grouped',
    refreshRate: 3,
    pressAction: 'default',
    pressCommand: '',
  });

  function setStatus(text) {
    statusText.textContent = text;
  }

  function getActionId() {
    return actionInfo?.action || '';
  }

  function actionUsesPingHost() {
    return getActionId().endsWith('.ping');
  }

  function actionUsesNetworkInterface() {
    return getActionId().endsWith('.net');
  }

  function actionUsesGpuSelector() {
    const actionId = getActionId();
    return actionId.endsWith('.gpu') || actionId.endsWith('.vram');
  }

  function actionUsesBarMode() {
    const actionId = getActionId();
    return actionId.endsWith('.cpu') || actionId.endsWith('.gpu');
  }

  function actionUsesBatterySelector() {
    return getActionId().endsWith('.battery');
  }

  function actionUsesBatteryLabel() {
    return getActionId().endsWith('.battery');
  }

  function actionUsesDiskSelector() {
    return getActionId().endsWith('.disk');
  }

  function actionUsesFanSelector() {
    return getActionId().endsWith('.fan');
  }

  function actionUsesFanLabel() {
    return getActionId().endsWith('.fan');
  }

  function actionUsesVolumeStep() {
    return getActionId().endsWith('.audio');
  }

  function actionUsesBrightnessStep() {
    return getActionId().endsWith('.monbright');
  }

  function actionUsesTimerStep() {
    return getActionId().endsWith('.timer');
  }

  function actionUsesTopMode() {
    return getActionId().endsWith('.top');
  }

  function actionUsesPressAction() {
    return Boolean(getActionId());
  }

  function updatePressCommandVisibility() {
    const showPressCommand = actionUsesPressAction() && fields.pressAction.value === 'command';
    pressCommandWrap.classList.toggle('hidden', !showPressCommand);
  }

  function updateFieldVisibility() {
    pingHostWrap.classList.toggle('hidden', !actionUsesPingHost());
    networkInterfaceWrap.classList.toggle('hidden', !actionUsesNetworkInterface());
    gpuSelectorWrap.classList.toggle('hidden', !actionUsesGpuSelector());
    barModeWrap.classList.toggle('hidden', !actionUsesBarMode());
    batterySelectorWrap.classList.toggle('hidden', !actionUsesBatterySelector());
    batteryLabelWrap.classList.toggle('hidden', !actionUsesBatteryLabel());
    diskSelectorWrap.classList.toggle('hidden', !actionUsesDiskSelector());
    fanSelectorWrap.classList.toggle('hidden', !actionUsesFanSelector());
    fanLabelWrap.classList.toggle('hidden', !actionUsesFanLabel());
    volumeStepWrap.classList.toggle('hidden', !actionUsesVolumeStep());
    brightnessStepWrap.classList.toggle('hidden', !actionUsesBrightnessStep());
    timerStepWrap.classList.toggle('hidden', !actionUsesTimerStep());
    topModeWrap.classList.toggle('hidden', !actionUsesTopMode());
    pressActionWrap.classList.toggle('hidden', !actionUsesPressAction());
    updatePressCommandVisibility();
  }

  function renderSelectOptions(selectNode, options = [], selectedValue = 'auto') {
    const merged = [{ id: 'auto', label: 'Auto' }];

    for (const option of Array.isArray(options) ? options : []) {
      const id = typeof option?.id === 'string' ? option.id.trim() : '';
      if (!id || merged.some((entry) => entry.id === id)) {
        continue;
      }

      const label = typeof option?.label === 'string' && option.label.trim() ? option.label.trim() : id;
      merged.push({ id, label });
    }

    const desiredValue = String(selectedValue || 'auto').trim() || 'auto';
    if (!merged.some((entry) => entry.id === desiredValue)) {
      merged.push({ id: desiredValue, label: `${desiredValue} (missing)` });
    }

    selectNode.innerHTML = '';
    for (const option of merged) {
      const node = document.createElement('option');
      node.value = option.id;
      node.textContent = option.label;
      selectNode.appendChild(node);
    }

    selectNode.value = desiredValue;
  }

  function renderGpuOptions(options = [], selectedValue = DEFAULT_SETTINGS.gpuSelector) {
    renderSelectOptions(fields.gpuSelector, options, selectedValue);
  }

  function renderBatteryOptions(options = [], selectedValue = DEFAULT_SETTINGS.batteryDevice) {
    renderSelectOptions(fields.batteryDevice, options, selectedValue);
  }

  function getSelectedDiskSet(selectedValues = DEFAULT_SETTINGS.selectedDisks) {
    return new Set(
      (Array.isArray(selectedValues) ? selectedValues : [])
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)
    );
  }

  function getDiskOptionLabel(id = '') {
    const match = currentDiskOptions.find((option) => String(option?.id || '').trim() === String(id || '').trim());
    if (!match) {
      return String(id || '').trim();
    }

    return typeof match.label === 'string' && match.label.trim() ? match.label.trim() : String(id || '').trim();
  }

  function closeDiskSelectorMenu() {
    fields.diskSelectorMenu.classList.add('hidden');
  }

  function toggleDiskSelectorMenu() {
    fields.diskSelectorMenu.classList.toggle('hidden');
  }

  function updateDiskSelectorButtonLabel() {
    const selected = getSelectedDisksFromUi();

    if (selected.length === 0) {
      fields.diskSelectorButton.textContent = 'Auto';
      return;
    }

    if (selected.length === 1) {
      fields.diskSelectorButton.textContent = getDiskOptionLabel(selected[0]);
      return;
    }

    fields.diskSelectorButton.textContent = `${selected.length} disks selected`;
  }

  function renderDiskOptions(options = [], selectedValues = DEFAULT_SETTINGS.selectedDisks) {
    currentDiskOptions = Array.isArray(options) ? options : [];
    const selectedSet = getSelectedDiskSet(selectedValues);

    fields.diskSelectorMenu.innerHTML = '';

    const autoRow = document.createElement('label');
    autoRow.className = 'checkListItem';

    const autoCheckbox = document.createElement('input');
    autoCheckbox.type = 'checkbox';
    autoCheckbox.checked = selectedSet.size === 0;
    autoCheckbox.dataset.role = 'auto';

    const autoText = document.createElement('span');
    autoText.textContent = 'Auto';

    autoRow.appendChild(autoCheckbox);
    autoRow.appendChild(autoText);
    fields.diskSelectorMenu.appendChild(autoRow);

    autoCheckbox.addEventListener('change', () => {
      renderDiskOptions(currentDiskOptions, []);
      updateDiskSelectorButtonLabel();
    });

    for (const option of currentDiskOptions) {
      const id = typeof option?.id === 'string' ? option.id.trim() : '';
      if (!id) {
        continue;
      }

      const label = typeof option?.label === 'string' && option.label.trim() ? option.label.trim() : id;
      const row = document.createElement('label');
      row.className = 'checkListItem';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = id;
      checkbox.checked = selectedSet.has(id);
      checkbox.dataset.role = 'disk';
      checkbox.dataset.diskId = id;

      const textNode = document.createElement('span');
      textNode.textContent = label;

      row.appendChild(checkbox);
      row.appendChild(textNode);
      fields.diskSelectorMenu.appendChild(row);

      checkbox.addEventListener('change', () => {
        const selected = [...fields.diskSelectorMenu.querySelectorAll('input[data-role="disk"]:checked')]
          .map((node) => String(node.value || '').trim())
          .filter(Boolean);

        renderDiskOptions(currentDiskOptions, selected);
        updateDiskSelectorButtonLabel();
      });
    }

    updateDiskSelectorButtonLabel();
  }

  function getSelectedDisksFromUi() {
    return [...fields.diskSelectorMenu.querySelectorAll('input[data-role="disk"]:checked')]
      .map((node) => String(node.value || '').trim())
      .filter(Boolean);
  }

  function renderFanOptions(options = [], selectedValue = DEFAULT_SETTINGS.fanSelector) {
    renderSelectOptions(fields.fanSelector, options, selectedValue);
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
      normalized.volumeStep = Math.max(1, Math.min(20, Number.parseInt(settings.volumeStep, 10) || DEFAULT_SETTINGS.volumeStep));
    }

    if (settings.brightnessStep !== undefined) {
      normalized.brightnessStep = Math.max(1, Math.min(25, Number.parseInt(settings.brightnessStep, 10) || DEFAULT_SETTINGS.brightnessStep));
    }

    if (settings.timerStep !== undefined) {
      normalized.timerStep = Math.max(1, Math.min(60, Number.parseInt(settings.timerStep, 10) || DEFAULT_SETTINGS.timerStep));
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

  function applySettings(settings = {}) {
    const normalized = normalizeSettings(settings);

    fields.pingHost.value = normalized.pingHost;
    fields.networkInterface.value = normalized.networkInterface;
    renderGpuOptions(currentGpuOptions, normalized.gpuSelector);
    renderBatteryOptions(currentBatteryOptions, normalized.batteryDevice);
    fields.batteryLabel.value = normalized.batteryLabel;
    renderDiskOptions(currentDiskOptions, normalized.selectedDisks);
    renderFanOptions(currentFanOptions, normalized.fanSelector);
    fields.fanLabel.value = normalized.fanLabel;
    fields.volumeStep.value = String(normalized.volumeStep);
    fields.brightnessStep.value = String(normalized.brightnessStep);
    fields.timerStep.value = String(normalized.timerStep);
    fields.topMode.value = normalized.topMode;
    fields.barMode.value = normalized.barMode;
    fields.refreshRate.value = String(normalized.refreshRate);
    fields.pressAction.value = normalized.pressAction;
    fields.pressCommand.value = normalized.pressCommand;

    updateFieldVisibility();
  }

  function collectSettings() {
    return normalizeSettings({
      pingHost: fields.pingHost.value,
      networkInterface: fields.networkInterface.value,
      gpuSelector: fields.gpuSelector.value,
      batteryDevice: fields.batteryDevice.value,
      batteryLabel: fields.batteryLabel.value,
      selectedDisks: getSelectedDisksFromUi(),
      fanSelector: fields.fanSelector.value,
      fanLabel: fields.fanLabel.value,
      volumeStep: fields.volumeStep.value,
      brightnessStep: fields.brightnessStep.value,
      timerStep: fields.timerStep.value,
      topMode: fields.topMode.value,
      barMode: fields.barMode.value,
      refreshRate: fields.refreshRate.value,
      pressAction: fields.pressAction.value,
      pressCommand: fields.pressCommand.value,
    });
  }

  function send(payload) {
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      return;
    }

    websocket.send(JSON.stringify(payload));
  }

  function extractIncomingSettings(payload = {}) {
    const knownKeys = ['pingHost', 'networkInterface', 'gpuSelector', 'barMode', 'batteryDevice', 'batteryLabel', 'selectedDisks', 'fanSelector', 'fanLabel', 'volumeStep', 'brightnessStep', 'timerStep', 'topMode', 'refreshRate', 'pressAction', 'pressCommand'];

    function visit(value, depth = 0) {
      if (!value || typeof value !== 'object' || depth > 6) {
        return {};
      }

      const direct = {};
      for (const key of knownKeys) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          direct[key] = value[key];
        }
      }

      if (Object.keys(direct).length > 0) {
        return direct;
      }

      if (value.settings && typeof value.settings === 'object') {
        const nestedSettings = visit(value.settings, depth + 1);
        if (Object.keys(nestedSettings).length > 0) {
          return nestedSettings;
        }
      }

      for (const nested of Object.values(value)) {
        const result = visit(nested, depth + 1);
        if (Object.keys(result).length > 0) {
          return result;
        }
      }

      return {};
    }

    return visit(payload);
  }

  function extractGpuOptions(payload = {}) {
    if (Array.isArray(payload.gpuOptions)) {
      return payload.gpuOptions;
    }

    if (payload.settings && Array.isArray(payload.settings.gpuOptions)) {
      return payload.settings.gpuOptions;
    }

    return [];
  }

  function extractBatteryOptions(payload = {}) {
    if (Array.isArray(payload.batteryOptions)) {
      return payload.batteryOptions;
    }

    if (payload.settings && Array.isArray(payload.settings.batteryOptions)) {
      return payload.settings.batteryOptions;
    }

    return [];
  }

  function extractDiskOptions(payload = {}) {
    if (Array.isArray(payload.diskOptions)) {
      return payload.diskOptions;
    }

    if (payload.settings && Array.isArray(payload.settings.diskOptions)) {
      return payload.settings.diskOptions;
    }

    return [];
  }

  function extractFanOptions(payload = {}) {
    if (Array.isArray(payload.fanOptions)) {
      return payload.fanOptions;
    }

    if (payload.settings && Array.isArray(payload.settings.fanOptions)) {
      return payload.settings.fanOptions;
    }

    return [];
  }

  function saveSettings() {
    const settings = collectSettings();

    if (!actionContext) {
      console.log('[Redline PI] local save', settings);
      setStatus('Local preview only');
      return;
    }

    send({
      event: 'setSettings',
      context: actionContext,
      payload: settings,
    });

    if (actionInfo?.action) {
      send({
        event: 'sendToPlugin',
        action: actionInfo.action,
        context: actionContext,
        payload: {
          type: 'saveSettings',
          settings,
        },
      });
    }

    setStatus('Settings saved');
  }

  function requestSettings() {
    if (!actionContext) return;

    send({
      event: 'getSettings',
      context: actionContext,
    });
  }

  window.connectElgatoStreamDeckSocket = function connectElgatoStreamDeckSocket(inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
    try {
      actionInfo = inActionInfo ? JSON.parse(inActionInfo) : null;
    } catch (error) {
      console.error('[Redline PI] Failed to parse action info', error);
      actionInfo = null;
    }

    actionContext = actionInfo?.context || null;
    updateFieldVisibility();

    applySettings(extractIncomingSettings(actionInfo?.payload || {}));
    websocket = new WebSocket(`ws://127.0.0.1:${inPort}`);

    websocket.addEventListener('open', () => {
      send({
        event: inRegisterEvent,
        uuid: inUUID,
      });

      requestSettings();
      setStatus('Connected');
    });

    websocket.addEventListener('message', (event) => {
      let message = null;

      try {
        message = JSON.parse(event.data);
      } catch (error) {
        console.error('[Redline PI] Failed to parse message', error);
        return;
      }

      const incomingSettings = extractIncomingSettings(message.payload);

      if (message.event === 'didReceiveSettings' && message.context === actionContext) {
        applySettings(incomingSettings);
        setStatus('Settings loaded');
      }

      if (message.event === 'sendToPropertyInspector' && message.context === actionContext) {
        if (Array.isArray(message.payload?.gpuOptions)) {
          currentGpuOptions = extractGpuOptions(message.payload);
          renderGpuOptions(currentGpuOptions, fields.gpuSelector.value);
        }

        if (Array.isArray(message.payload?.batteryOptions)) {
          currentBatteryOptions = extractBatteryOptions(message.payload);
          renderBatteryOptions(currentBatteryOptions, fields.batteryDevice.value);
        }

        if (Array.isArray(message.payload?.diskOptions)) {
          currentDiskOptions = extractDiskOptions(message.payload);
          const currentSettings = extractIncomingSettings(message.payload);
          const selectedDisks = Array.isArray(currentSettings.selectedDisks)
            ? currentSettings.selectedDisks
            : getSelectedDisksFromUi();
          renderDiskOptions(currentDiskOptions, selectedDisks);
        }

        if (Array.isArray(message.payload?.fanOptions)) {
          currentFanOptions = extractFanOptions(message.payload);
          renderFanOptions(currentFanOptions, fields.fanSelector.value);
        }

        if (Object.keys(incomingSettings).length > 0) {
          applySettings(incomingSettings);
          setStatus('Settings synced');
        } else if (
          Array.isArray(message.payload?.gpuOptions)
          || Array.isArray(message.payload?.batteryOptions)
          || Array.isArray(message.payload?.diskOptions)
          || Array.isArray(message.payload?.fanOptions)
        ) {
          setStatus('Options updated');
        }
      }
    });

    websocket.addEventListener('close', () => {
      setStatus('Disconnected');
    });

    websocket.addEventListener('error', () => {
      setStatus('Connection error');
    });
  };

  saveButton.addEventListener('click', saveSettings);
  fields.pressAction.addEventListener('change', updatePressCommandVisibility);
  fields.diskSelectorButton.addEventListener('click', (event) => {
    event.preventDefault();
    toggleDiskSelectorMenu();
  });

  document.addEventListener('click', (event) => {
    if (!diskSelectorWrap.contains(event.target)) {
      closeDiskSelectorMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeDiskSelectorMenu();
    }
  });

  applySettings({});
  setStatus('Waiting for OpenDeck');
})();
