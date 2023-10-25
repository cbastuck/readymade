const serviceId = "hookup.to/service/select";
const serviceName = "Select";

class Select {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.arrayIndex = undefined;
  }

  configure(config) {
    const { arrayIndex } = config;
    if (arrayIndex !== undefined) {
      this.arrayIndex = arrayIndex;
    }
  }

  process(params) {
    if (Array.isArray(params) && this.arrayIndex !== undefined) {
      return params[this.arrayIndex];
    }
    console.warn("Unsupported input type, can't select");
    return params;
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Select(app, board, descriptor, id),
  createUI: undefined,
};

export default descriptor;
