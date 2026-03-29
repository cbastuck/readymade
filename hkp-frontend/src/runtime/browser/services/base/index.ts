import { parseExpression, evalExpression } from "./eval";
import MapDescriptor from "./Map";
import ReduceDescriptor from "./Reduce";
import MatchFilterDescriptor from "./MatchFilter";
import FilterDescriptor from "./Filter";
import TimerDescriptor from "./Timer";
import BatcherDescriptor from "./Batcher";
import MonitorDescriptor from "./Monitor";

// TODO: do we need this entry point at all?

function createServiceFactory(rt: any, descriptor: any): any {
  const { serviceId, serviceName, service: Service } = descriptor;
  return {
    serviceId,
    serviceName,
    create: (board: any, descriptor: any, id: string) => new Service(rt, board, descriptor, id),
  };
}

function createRegistry(rt: any): any[] {
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
