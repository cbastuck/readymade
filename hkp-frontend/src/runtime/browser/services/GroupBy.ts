import GroupByDescriptor from "hkp-frontend/src/runtime/browser/services/base/GroupBy";

import { AppImpl, ServiceClass } from "hkp-frontend/src/types";

const descriptor = {
  serviceName: GroupByDescriptor.serviceName,
  serviceId: GroupByDescriptor.serviceId,
  create: (app: AppImpl, board: string, descriptor: ServiceClass, id: string) =>
    new GroupByDescriptor.service(app, board, descriptor, id),
  createUI: undefined,
};

export default descriptor;
