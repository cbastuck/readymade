import ReduceDescriptor from "hkp-frontend/src/runtime/browser/services/base/Reduce";

const descriptor = {
  serviceName: ReduceDescriptor.serviceName,
  serviceId: ReduceDescriptor.serviceId,
  create: (app, board, descriptor, id) =>
    new ReduceDescriptor.service(app, board, descriptor, id),
};

export default descriptor;
