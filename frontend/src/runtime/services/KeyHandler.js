const serviceId = "hookup.to/service/key-handler";
const serviceName = "KeyHandler";

class KeyHandler {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  destroy() {}

  onEvent = (e) => {
    this.app.next(this, { key: e.key, code: e.keyCode });
  };

  configure(config) {
    const { eventType = "keydown" } = config;

    if (this._registered) {
      document.removeEventListener(this._registered);
    }

    this._registered = document.addEventListener(eventType, this.onEvent);
  }

  process(params) {
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new KeyHandler(app, board, descriptor, id),
  createUI: undefined,
};

export default descriptor;
