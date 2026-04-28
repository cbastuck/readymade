import MatchFilterDescriptor from "hkp-frontend/src/runtime/browser/services/base/MatchFilter";
import { AppImpl, ServiceClass } from "hkp-frontend/src/types";

const descriptor = {
  serviceName: MatchFilterDescriptor.serviceName,
  serviceId: MatchFilterDescriptor.serviceId,
  create: (app: AppImpl, board: string, service: ServiceClass, id: string) =>
    new MatchFilterDescriptor.service(app, board, service, id),
};

export default descriptor;
