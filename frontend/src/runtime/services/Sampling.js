const serviceId = 'hookup.to/service/sampling';
const serviceName = 'Sampling';

function erf(x) {
    // constants
    var a1 =  0.254829592;
    var a2 = -0.284496736;
    var a3 =  1.421413741;
    var a4 = -1.453152027;
    var a5 =  1.061405429;
    var p  =  0.3275911;

    // Save the sign of x
    var sign = 1;
    if (x < 0) {
        sign = -1;
    }
    x = Math.abs(x);

    // A&S formula 7.1.26
    var t = 1.0/(1.0 + p*x);
    var y = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-x*x);

    return sign*y;
}

class Sampling {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.mean = [0.5, 0.5];
    this.std = [0.2, 0.2];    
  }

  configure(config) {
  }

  sample(mx, sx) {
    const x = Math.random();
    return 0.5 * (1 + erf((x - mx) / Math.sqrt(2 * sx * sx)));
  }

  process(params) {
    if (!this.mean || !this.std ) {
      return params;
    }

    const n = this.mean.length;
    if (n !== this.std.length) {
      return params;
    }

    const sample = new Array(n).fill(0).map(
      (_, idx) => this.sample(this.mean[idx], this.std[idx])
    );

    return {
      type: 'circle',
      x: `${Math.floor(sample[0] * 100)}%`,
      y: `${Math.floor(sample[1] * 100)}%`,
      radius: '1%',
      color: 'black'
    };
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) =>
    new Sampling(app, board, descriptor, id),
};

export default descriptor;
