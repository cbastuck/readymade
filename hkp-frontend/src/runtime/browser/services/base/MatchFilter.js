const serviceId = "hookup.to/service/match-filter";
const serviceName = "MatchFilter";

class MatchFilter {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;
  }

  configure(config) {
    const { filterByTerms } = config;

    if (filterByTerms !== undefined) {
      this.filterByTerms = filterByTerms;
    }
  }

  process(params) {
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
