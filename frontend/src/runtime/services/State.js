const serviceId = 'hookup.to/service/state';
const serviceName = 'State';

class State {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
    
    this.state = {}; 
  }

  configure(config) {
  }

  process(objectOrArray) {
    if (!objectOrArray) {
      return undefined;
    }

    if (!Array.isArray(objectOrArray)) {
      return this.process([objectOrArray]);
    }

    return objectOrArray.map(item => {
      const id = item && item.id;
      const ref = item && item.ref;
      if (!id && !ref) {
        return item;
      }
      
      if (id) {
        this.state[id] = item;
        return item;
      } 
      
      const state = this.state[ref];
      if (!state) {
        console.error(`Referencing an state that does not exist: ${ref}`);
        return item;
      }

      return Object.keys(item).reduce(
        (all, key) => ({ ...all, [key]: item[key] }), 
        state
      );
    });
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new State(app, board, descriptor, id),
};

export default descriptor;
