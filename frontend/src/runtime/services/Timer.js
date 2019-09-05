const serviceId = 'hookup.to/service/timer';
const serviceName = 'Timer';

class Timer {
  constructor(board, descriptor, id) {
    this.id = id;
    this.board = board;
  }

  configure(config) {
    console.log('Configuring Timer ', config);
  }
}

const descriptor = {  
  serviceName,
  serviceId,
  create: (board, descriptor, id) =>
    new Timer(board, descriptor, id)
};

export default descriptor;
