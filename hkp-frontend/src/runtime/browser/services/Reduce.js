import ReduceDescriptor from "hkp-services/Reduce";

const descriptor = {
  serviceName: ReduceDescriptor.serviceName,
  serviceId: ReduceDescriptor.serviceId,
  create: (app, board, descriptor, id) =>
    new ReduceDescriptor.service(app, board, descriptor, id),
};

export default descriptor;
