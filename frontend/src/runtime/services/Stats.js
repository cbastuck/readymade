const serviceId = "hookup.to/service/stats";
const serviceName = "Stats";

function square(x) {
  return x * x;
}

class Stats {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure(config) {
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

  process(params) {
    if (!this.property && params) {
      return params;
    }

    if (!Array.isArray(params)) {
      return this.process([params]);
    }

    const stats = params.reduce(
      (acc, cur) => {
        const val = cur[this.property];
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
      }
    );

    const result = {};
    if (this.features) {
      const meanProperty = this.features.mean;
      if (meanProperty) {
        result[meanProperty] = stats.sum / stats.n;
      }

      const stdProperty = this.features.std;
      if (stdProperty) {
        const mx = stats[meanProperty] || stats.sum / stats.n;
        const sx = stats.values.reduce((p, c) => p + square(c - mx), 0);
        result[stdProperty] = Math.sqrt(sx / stats.sum);
      }

      const maxProperty = this.features.max;
      if (maxProperty) {
        const mx = params.reduce((p, c) => {
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
  create: (app, board, descriptor, id) => new Stats(app, board, descriptor, id),
};

export default descriptor;
