import { parseExpression, evalExpression } from "./eval";

// TODO: do we need this entry point at all?

function createServiceFactory(rt, descriptor) {
  const { serviceId, serviceName, service: Service } = descriptor;
  return {
    serviceId,
    serviceName,
    create: (board, descriptor, id) => new Service(rt, board, descriptor, id),
  };
}

function createRegistry(rt) {
  return [
    createServiceFactory(rt, MapDescriptor),
    createServiceFactory(rt, ReduceDescriptor),
    createServiceFactory(rt, MatchFilterDescriptor),
    createServiceFactory(rt, FilterDescriptor),
    createServiceFactory(rt, TimerDescriptor),
    createServiceFactory(rt, BatcherDescriptor),
    createServiceFactory(rt, MonitorDescriptor),
  ];
}

export default {
  parseExpression,
  evalExpression,
  createRegistry,
};
