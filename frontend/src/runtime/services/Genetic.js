const serviceId = 'hookup.to/service/genetic';
const serviceName = 'Genetic';

class Genetic {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure(config) {
    const { targetShape, genomeShape } = config || {};
    if (targetShape) {
      this.targetShape = targetShape;
    }

    if (genomeShape) {
      this.genomeShape = genomeShape;
    }
  }

  process(params) {
    const rd = ceil => Math.floor(Math.random() * ceil);
    const n = rd(50);
    const population = [...Array(n)].map(g => ({
      x: rd(2000),  y: rd(400),  width: 10, height: 10 
    }));

    return [this.targetShape].concat(
      population.map(genome => ({
        ...this.genomeShape,
        ...genome
      })
    ));
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Genetic(app, board, descriptor, id),
};

export default descriptor;
