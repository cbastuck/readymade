import jstat from "jstat";

import GeneticOptimizerUI from "./GeneticOptimizerUI";
import { AppInstance, ServiceClass } from "../../../types";

const serviceId = "hookup.to/service/genetic-optimizer";
const serviceName = "Genetic Optimizer";

type GenomeInternal = { ttl: number; fitness?: number };
type Genome = [GenomeInternal, ...number[]];

function rand(upper: number): number {
  return Math.floor(Math.random() * upper);
}

function deepCopy<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

class GeneticOptimizer {
  uuid: string;
  board: string;
  app: AppInstance;
  generation: number;
  population: Genome[];
  ttl: number;
  dataRoot: string | undefined;
  annotations: any;
  initialPopulation: Genome[] | undefined;

  constructor(
    app: AppInstance,
    board: string,
    _descriptor: ServiceClass,
    id: string
  ) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.generation = 0;
    this.population = [];
    this.ttl = 2;
    this.dataRoot = undefined;
  }

  configure(config: any): void {
    const { initialPopulation, dataRoot, annotations, ttl } = config || {};

    if (dataRoot !== undefined) {
      this.dataRoot = dataRoot;
    }

    if (annotations !== undefined) {
      this.annotations = annotations;
    }

    if (Array.isArray(initialPopulation)) {
      this.population = initialPopulation;
      this.initialPopulation = deepCopy(initialPopulation);
    }

    if (ttl !== undefined) {
      this.ttl = ttl;
    }
  }

  pickGenome(): Genome {
    const idx = rand(this.population.length - 1);
    return this.population[idx];
  }

  mixGenomes(a: Genome, b: Genome): Genome {
    return a.map((xa, i) => {
      if (i === 0) {
        // first item is internal, contains: ttl, fitness, etc.
        return { ttl: this.ttl };
      }
      const alpha = Math.random();
      return alpha * (xa as number) + (1 - alpha) * (b[i] as number);
    }) as Genome;
  }

  applyMutation(genome: Genome): Genome {
    const r = Math.random();
    if (r < 0.9) {
      return genome;
    }
    return genome.map((g, idx) =>
      idx > 0 && Math.random() > 0.3 ? Math.random() : g
    ) as Genome;
  }

  nextGeneration(population: Genome[]): Genome[] {
    const father = this.pickGenome();
    const mother = this.pickGenome();
    if (!father || !mother) {
      return population;
    }
    const child = this.mixGenomes(father, mother);
    const mutatedChild = this.applyMutation(child);
    return population.concat([mutatedChild]);
  }

  computeFitness(targetDistribution: any[], genome: Genome): number {
    const probabilities = targetDistribution.map((sample) => {
      //TODO: std equals 1
      const probX = jstat.normal.pdf(sample[0], genome[1], 1); // [1] = x
      //TODO: std equals 1
      const probY = jstat.normal.pdf(sample[1], genome[2], 1); // [2] = y
      return probX * probY;
    });

    function mean(arr: number[]): number {
      return arr.reduce((a, c) => a + c, 0) / arr.length;
    }

    const meanP = mean(probabilities);
    const pAboveMeanP = probabilities.filter((p) => p > meanP);
    const meanAboveMeanP = mean(pAboveMeanP);

    const ratio = pAboveMeanP.length / probabilities.length;
    console.log(
      "RATIO",
      ratio,
      "partitioned mean",
      meanAboveMeanP,
      probabilities
    );
    return ratio * meanAboveMeanP;
  }

  applySelection(population: Genome[], fitness: number[]): Genome[] {
    const meanFitness = fitness.reduce((a, c) => a + c, 0) / fitness.length;
    const varFitness =
      fitness.reduce((a, c) => {
        const d = c - meanFitness;
        return a + d * d;
      }, 0) / fitness.length;
    const stdFitness = Math.sqrt(varFitness);
    const minFitness = meanFitness - stdFitness;
    return population.filter((g, idx) => {
      const ttl = g[0].ttl - 1;
      const f = fitness[idx];
      g[0].fitness = f; // fitness
      if (f < minFitness) {
        g[0].ttl = ttl; // set decremented ttl
      }
      return ttl > 0;
    });
  }

  removeDuplicates(population: Genome[]): Genome[] {
    const deduplicated: number[] = [];
    return population.reduce<Genome[]>((acc, g) => {
      const quantizePoint = (x: number, y: number) =>
        Math.floor(x * 100) * 100 + Math.floor(y * 100);
      const id = quantizePoint(g[1] as number, g[2] as number);
      if (deduplicated.indexOf(id) === -1) {
        deduplicated.push(id);
        return [...acc, g];
      }
      return acc;
    }, []);
  }

  process(params: any[]): any[] {
    const targetDistribution = this.dataRoot
      ? params.map((x) => x[this.dataRoot as string])
      : params;

    ++this.generation;
    const population = this.removeDuplicates(
      this.nextGeneration(this.population)
    );
    const fitness = population.map(
      this.computeFitness.bind(this, targetDistribution)
    );
    const survivors = this.applySelection(population, fitness);
    this.population = survivors;

    // generate shapes out of population
    const annotations = this.annotations || {};
    return survivors
      .map((genome) => ({
        ...annotations,
        genome,
      }))
      .concat(params);
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppInstance, board: string, desc: ServiceClass, id: string) =>
    new GeneticOptimizer(app, board, desc, id),
  createUI: GeneticOptimizerUI,
};

export default descriptor;
