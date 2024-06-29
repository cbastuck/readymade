import GroupByDescriptor from "hkp-services/GroupBy";

import { AppImpl, ServiceClass } from "@/types";

const descriptor = {
  serviceName: GroupByDescriptor.serviceName,
  serviceId: GroupByDescriptor.serviceId,
  create: (app: AppImpl, board: string, descriptor: ServiceClass, id: string) =>
    new GroupByDescriptor.service(app, board, descriptor, id),
  createUI: undefined,
};

export default descriptor;
