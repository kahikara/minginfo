const state = require('./state');
const { TRANSIENT_IMAGE_MS } = require('./constants');

let ws = null;

function setWebSocket(socket) {
  ws = socket;
}

function safeSend(payload) {
  if (!ws || ws.readyState !== ws.OPEN) return;

  try {
    ws.send(JSON.stringify(payload));
  } catch (error) {
    console.warn('[Redline]', 'WebSocket send failed:', error.message);
  }
}

function sendImage(context, image, track = true) {
  if (!image) return;

  safeSend({
    event: 'setImage',
    context,
    payload: {
      image,
      target: 0,
    },
  });

  if (track) {
    state.lastSentImages[context] = image;
  }
}

function sendForceUpdate(context, image, track = false) {
  sendImage(context, image, track);
}

function sendUpdateIfChanged(context, image) {
  if (!image || image === state.lastSentImages[context]) return;
  sendImage(context, image, true);
}

function invalidateContext(context) {
  delete state.lastSentImages[context];
}

function invalidateAllVisible() {
  for (const context of Object.keys(state.activeContexts)) {
    delete state.lastSentImages[context];
  }
}

function clearTransientTimer(context) {
  if (state.transientImageTimers[context]) {
    clearTimeout(state.transientImageTimers[context]);
    delete state.transientImageTimers[context];
  }
}

function showTransientImage(context, image, duration = TRANSIENT_IMAGE_MS) {
  clearTransientTimer(context);
  sendUpdateIfChanged(context, image);

  state.transientImageTimers[context] = setTimeout(() => {
    delete state.lastSentImages[context];
    delete state.transientImageTimers[context];
  }, duration);
}

module.exports = {
  setWebSocket,
  safeSend,
  sendForceUpdate,
  sendUpdateIfChanged,
  invalidateContext,
  invalidateAllVisible,
  clearTransientTimer,
  showTransientImage,
};
