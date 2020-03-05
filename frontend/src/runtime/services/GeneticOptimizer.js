import GeneticOptimizerUI from './GeneticOptimizerUI';

const serviceId = 'hookup.to/service/genetic-optimizer';
const serviceName = 'Genetic Optimizer';

function rand(upper) {
  return Math.floor(Math.random() * upper);
}

function percentToRelative(value) {
  if (value === undefined) {
    return 0;
  }
  if (typeof value === 'string') {
    const components = value.split('%');
    if (components.length > 1) {
      return Number(components[0]) / 100;
    }
  }
  return value;
}


class GeneticOptimizer {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.generation = 0;
    this.population = [];
    this.dataRoot = undefined;
  }

  configure(config) {
    const { genomeShape, initialPopulation, dataRoot } = config || {};

    if (dataRoot !== undefined) {
      this.dataRoot = dataRoot;
    }
   
    if (genomeShape !== undefined && initialPopulation !== undefined) {
      this.genomeShape = genomeShape;

      if (Array.isArray(initialPopulation)) {
        this.population = initialPopulation.map(
          g => [
            percentToRelative(g.x),
            percentToRelative(g.y),
            percentToRelative(g.length),
            g.ttl
          ]
        );
      } else {
        this.population = [...Array(rand(initialPopulation))]
          .map(g => [
            Math.random(),  // x
            Math.random(),  // y
            percentToRelative(genomeShape ? genomeShape.length : 0.1),  // length
            (genomeShape.ttl && genomeShape) ? genomeShape.ttl : 10,  // ttl
          ]);
      }
    }   
  }

  pickGenome() {
    const idx = rand(this.population.length - 1);
    return { genome: this.population[idx], idx };
  }

  mixGenomes(a, b) {
    return a.map((xa, i) => {
      if (i < 2) { // only mix position
        const alpha = Math.random();
        return (alpha * xa) + (1 - alpha) * b[i];
      }
      return xa;
    });
  }

  applyMutation(genome) {
    const r = Math.random();
    if (r < 0.90) {
      return genome;
    }
    return genome.map((g, idx) => 
      (idx < 2 && Math.random() > 0.3) ?
        Math.random() :
        g
    );
  }

  nextGeneration(population) {
    const { genome: father } = this.pickGenome();
    const { genome: mother } = this.pickGenome();
    if (!father || !mother) {
      return population;
    } 
    const child = this.mixGenomes(father, mother);
    const mutatedChild = this.applyMutation(child);
    return population.concat([mutatedChild]);
  }

  computeFitness(genome) {
    const width = 1000;
    const height = width;

    const targetCenterX = percentToRelative(this.targetShape.x) * width;
    const targetCenterY = percentToRelative(this.targetShape.y) * height;
    const targetRadius = percentToRelative(this.targetShape.radius) * width;

    const upperLeftX = genome[0] * width;   // x
    const upperLeftY = genome[1] * height;  // y
    const length = genome[2] * width;       // length

    const genomeCenterX = upperLeftX + length / 2;
    const genomeCenterY = upperLeftY + length / 2;

    const dx = Math.abs(targetCenterX - genomeCenterX);
    const dy = Math.abs(targetCenterY - genomeCenterY);
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance > targetRadius ? 0 : (1 - distance / targetRadius);
  }

  applySelection(population, fitness) {
    const meanFitness = fitness.reduce(
      (a, c) => a + c, 
      0
    ) / fitness.length;
    const varFitness = fitness.reduce(
      (a, c) => {
        const d = c - meanFitness;
        return a + (d * d);
      }, 
      0
    ) / fitness.length;
    const stdFitness = Math.sqrt(varFitness);
    const minFitness = meanFitness - stdFitness;
    return population.filter((g, idx) => {
      const ttl = g[3] - 1;
      const f = fitness[idx];
      g[4] = f; // fitness
      if (f < minFitness) {
        g[3] = ttl; // set decremented ttl
      }
      return ttl > 0;
    });
  }

  removeDuplicates(population) {
    const deduplicated = [];
    return population.reduce(
      (acc, g) => {
        const quantizePoint = (x, y) => Math.floor(x * 100) * 100 + Math.floor(y * 100);
        const id = quantizePoint(g[0], g[1]);
        if (deduplicated.indexOf(id) === -1) {
          deduplicated.push(id);
          return [...acc, g];
        }
        return acc;
      },
      []
    );
  }

  process(params) {
    if (!this.targetShape) {
      return params;
    }

    ++this.generation;
    const population = this.removeDuplicates(this.nextGeneration(this.population));
    const fitness = population.map(this.computeFitness.bind(this));
    const survivors = this.applySelection(population, fitness);
  
    this.population = survivors;
    const toPercent = val => `${Math.floor(val * 100)}%`;

    const populationShapes = survivors.map(
      (genome, idx) => {
        return {
          ...this.genomeShape,
          x: toPercent(genome[0]),
          y: toPercent(genome[1]),
          length: toPercent(genome[2]),
          color: `rgba(0, 0, 0, ${genome[4]})`,
          fitness: genome[4],
        };
      }
    );

    const statusText = {
      type: 'text',
      text: `generation ${this.generation} has ${populationShapes.length} unique genes`,
      y: '90%',
      x: '80%',
      font: 'lighter 1.2em Helvetica Neue',
      color: '#454f6d'
    };
    
    const res = this.targetShape ? [this.targetShape] : [];
    return res.concat(populationShapes).concat(statusText).concat(params);
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new GeneticOptimizer(app, board, descriptor, id),
  createUI: GeneticOptimizerUI
};

export default descriptor;
