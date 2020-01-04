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

function toAbsolute(value, upper) {
  if (value === undefined || upper === undefined) {
    return 0;
  }
  if (typeof value === 'string') {
    const components = value.split('%');
    if (components.length > 1) {
      return Number(components[0]) / 100 * upper;
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

  nextGeneration(population) {
    const { genome: father, idx: fatherIdx } = this.pickGenome();
    const { genome: mother, idx: motherIdx } = this.pickGenome();
    if (!father || !mother) {
      return population;
    } 
    const child = this.mixGenomes(father, mother);
    child.parents = { fatherIdx, motherIdx };
    return population.concat([child]);
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
    const meanFitness = fitness.reduce((a, c) => a + c, 0) / fitness.length;
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
      if (fitness[idx] < minFitness) {
        g[3] = g[3] - 1; // decrement ttl
      }
      return g[3] > 0;
    });
  }

  removeDuplicates(population) {
    const deduplicated = [];
    const reduced = population.reduce(
      (acc, g) => {
        const id = `${Math.floor(g[0] * 100)}${Math.floor(g[1] * 100)}`;
        if (deduplicated.indexOf(id) === -1) {
          deduplicated.push(id);
          return [...acc, g];
        }
        return acc;
      },
      []
    );
    return reduced;
  }

  process(params) {
    ++this.generation;
    const population = this.removeDuplicates(this.nextGeneration(this.population));
    const fitness = population.map(this.computeFitness.bind(this));
    const survivors = this.applySelection(population, fitness);
  
    this.population = survivors;
    const toPercent = val => `${Math.floor(val * 100)}%`;

    const populationShapes = survivors.map(
      (genome, idx) => ({
        ...this.genomeShape,
        x: toPercent(genome[0]),
        y: toPercent(genome[1]),
        length: toPercent(genome[2]),
        color: `rgb(${fitness[idx] * 255}, 0, 0)`
      })
    );

    // give parent shapes a color
    /*
    survivors.filter(s => !!s.parents)
      .forEach((child, idx) => {
        populationShapes[child.parents.fatherIdx].color = 'blue';
        populationShapes[child.parents.motherIdx].color = 'blue';
        populationShapes[survivors.indexOf(child)].color = 'green';
        child.parents = undefined;
      });
      */
    return [this.targetShape].concat(populationShapes);
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Genetic(app, board, descriptor, id),
};

export default descriptor;
