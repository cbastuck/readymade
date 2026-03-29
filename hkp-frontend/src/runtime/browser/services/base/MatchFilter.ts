import { AppInstance, ServiceClass } from "hkp-frontend/src/types";

const serviceId = "hookup.to/service/match-filter";
const serviceName = "MatchFilter";

class MatchFilter {
  uuid: string;
  board: string;
  app: AppInstance;
  filterByTerms: string[] | undefined;

  constructor(
    app: AppInstance,
    board: string,
    _descriptor: ServiceClass,
    id: string
  ) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure(config: any): void {
    const { filterByTerms } = config;

    if (filterByTerms !== undefined) {
      this.filterByTerms = filterByTerms;
    }
  }

  process(params: any): any {
    if (this.filterByTerms) {
      const match = this.filterByTerms.find(
        (term) => params.indexOf(term) !== -1
      );
      if (match) {
        return null;
      }
    }
    return params;
  }
}

export default {
  serviceName,
  serviceId,
  service: MatchFilter,
  MatchFilter,
};
