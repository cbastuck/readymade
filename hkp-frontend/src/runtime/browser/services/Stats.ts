import { AppInstance, ServiceClass } from "../../../types";

/**
 * Service Documentation
 * Service ID: hookup.to/service/stats
 * Service Name: Stats
 * Modes: feature extraction
 * Key Config: property, features.mean, features.std, features.max, copyProps
 * Input: array<object> or single object (normalized to array)
 * Output: [metaStats, ...originalItems]
 * Arrays: native behavior
 * Binary: not intended
 * MixedData: not native in browser runtime
 */

const serviceId = "hookup.to/service/stats";
const serviceName = "Stats";

function square(x: number): number {
  return x * x;
}

interface StatsConfig {
  property?: string;
  features?: {
    mean?: string;
    std?: string;
    max?: string;
  };
  copyProps?: any;
}

class Stats {
  uuid: string;
  board: string;
  app: AppInstance;
  property: string | undefined;
  features: StatsConfig["features"];
  copyProps: any;

  constructor(
    app: AppInstance,
    board: string,
    _descriptor: ServiceClass,
    id: string,
  ) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure(config: StatsConfig): void {
    const { property, features, copyProps } = config;
    if (property !== undefined) {
      this.property = property;
    }

    if (features !== undefined) {
      this.features = features;
    }

    if (copyProps !== undefined) {
      this.copyProps = copyProps;
    }
  }

  process(params: any): any {
    if (!this.property && params) {
      return params;
    }

    if (!Array.isArray(params)) {
      return this.process([params]);
    }

    const stats = params.reduce(
      (
        acc: { type: string; n: number; sum: number; values: number[] },
        cur: any,
      ) => {
        const val = cur[this.property as string];
        if (val === undefined) {
          return acc;
        }
        return {
          ...acc,
          sum: acc.sum + val,
          n: acc.n + 1,
          values: [...acc.values, val],
        };
      },
      {
        type: "meta",
        n: 0,
        sum: 0,
        values: [],
      },
    );

    const result: Record<string, any> = {};
    if (this.features) {
      const meanProperty = this.features.mean;
      if (meanProperty) {
        result[meanProperty] = stats.sum / stats.n;
      }

      const stdProperty = this.features.std;
      if (stdProperty) {
        const mx =
          (stats as any)[meanProperty as string] || stats.sum / stats.n;
        const sx = stats.values.reduce(
          (p: number, c: number) => p + square(c - mx),
          0,
        );
        result[stdProperty] = Math.sqrt(sx / stats.sum);
      }

      const maxProperty = this.features.max;
      if (maxProperty) {
        const mx = params.reduce((p: any, c: any) => {
          const v = c[maxProperty];
          if (p === undefined) {
            return v;
          }
          return v > p ? v : p;
        }, undefined);
        result[maxProperty] = mx;
      }
    }
    result.n = stats.n;
    return [result].concat(params);
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app: AppInstance, board: string, desc: ServiceClass, id: string) =>
    new Stats(app, board, desc, id),
};

export default descriptor;
