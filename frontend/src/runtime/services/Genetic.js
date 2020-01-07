const serviceId = 'hookup.to/service/genetic';
const serviceName = 'Genetic';

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

class Genetic {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.generation = 0;
    this.population = [];
  }

  configure(config) {
    const { targetShape, genomeShape, initialPopulation } = config || {};
    if (targetShape) {
      this.targetShape = targetShape;
    }

    if (genomeShape) {
      this.genomeShape = genomeShape;
    }

    if (initialPopulation !== undefined) {
      if (Array.isArray(initialPopulation)) {
        this.population = initialPopulation.map(g => [
          percentToRelative(g.x),
          percentToRelative(g.y),
          percentToRelative(g.length),
          g.ttl
        ]);
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
      const alpha = Math.random();
      return (alpha * xa) + (1 - alpha) * b[i];
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
    ++this.generation;
    const population = this.removeDuplicates(this.nextGeneration(this.population));
    const fitness = population.map(this.computeFitness.bind(this));
    const survivors = this.applySelection(population, fitness);
  
    this.population = survivors;
    const toPercent = val => `${Math.floor(val * 100)}%`;

    const populationShapes = survivors.map(
      (genome, idx) => {
        // const fi = (1 - genome[4]) * 255;
        return {
          ...this.genomeShape,
          x: toPercent(genome[0]),
          y: toPercent(genome[1]),
          length: toPercent(genome[2]),
          color: `rgba(0, 0, 0, ${genome[4]})`,
          fitness: genome[4]
          //color: `rgb(255, ${fi}, ${fi})`
          //color: `rgb(${fi}, ${fi}, ${fi})`
        };
      }
    );

    /*  // TODO: add text
        // Diverstity is nature's answer to generic problem solving
        // Explore the space of possibilities
        // Any system is fractal it will always replicate it's own internal structures
        // Let's reconsider
    */

    const statusText = {
      type: 'text',
      text: `Generation ${this.generation} has ${populationShapes.length} unique Genes`,
      y: '90%',
      x: '80%',
      font: 'lighter 1.2em Helvetica Neue'
    };
    return [this.targetShape].concat(populationShapes).concat(statusText);
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Genetic(app, board, descriptor, id),
};

export default descriptor;
