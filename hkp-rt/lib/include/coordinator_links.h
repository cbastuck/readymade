#pragma once

#include <chrono>
#include <map>
#include <memory>
#include <string>
#include <vector>

#include "secrets.h"
#include <types/types.h>

namespace hkp
{

class App;

/**
 * This runtime server's end of a coordinator's connections.
 *
 * A coordinator never dials a runtime server. A person's own client — the one
 * party with a session on both sides — tells this server "connect to that
 * coordinator, with this ticket", and from then on the coordinator builds and
 * drives one runtime here over the connection this server opened. So nothing
 * has to be reachable but the coordinator: a machine behind NAT and a loopback
 * address are not special cases.
 *
 * The ticket is kept and presented again after a restart or a dropped
 * connection, with nobody present. It is all that is kept: the runtime itself
 * is rebuilt by the coordinator, from the board's config, once this server is
 * connected again.
 *
 * The wire format is hkp-node/src/coordinator/participantProtocol.ts, and
 * hkp-node/src/coordinatorLinks.ts is the implementation this follows.
 */

/** What is remembered about one link, and everything a reconnect needs. */
struct LinkRecord
{
  std::string boardName;
  std::string runtimeId;
  std::string coordinatorUrl;
  std::string ticket;
};

class LinkStore
{
public:
  virtual ~LinkStore() = default;
  virtual std::vector<LinkRecord> load() = 0;
  virtual void save(const std::vector<LinkRecord>& records) = 0;
};

std::shared_ptr<LinkStore> createMemoryLinkStore();

/**
 * Links kept in one file, readable by its owner only: a ticket is a bearer
 * credential for one runtime of one board.
 */
std::shared_ptr<LinkStore> createFileLinkStore(const std::string& file);

/**
 * The coordinator's join endpoint for a coordinator's base address.
 * Throws std::invalid_argument for an address that is not http or https.
 */
std::string joinUrlFor(const std::string& coordinatorUrl);

struct CoordinatorLinksOptions
{
  /** First delay before reconnecting; doubles up to `maxReconnectDelay`. */
  std::chrono::milliseconds reconnectDelay{1000};
  std::chrono::milliseconds maxReconnectDelay{30000};
  /** How long an introduction waits to be welcomed. */
  std::chrono::milliseconds introduceTimeout{10000};
  /** How long a connection may sit silent before the coordinator is pinged. */
  std::chrono::milliseconds idleTimeout{30000};
  /** A root certificate (PEM) trusted beside the built-in ones. */
  std::string trustedRootPem;
};

class CoordinatorLinks
{
public:
  CoordinatorLinks(std::shared_ptr<App> app,
                   std::shared_ptr<LinkStore> store = createMemoryLinkStore(),
                   CoordinatorLinksOptions options = {});
  ~CoordinatorLinks();

  /**
   * Connects this server to a coordinator as one runtime of one board.
   *
   * Returns once the coordinator has accepted the ticket — with an empty
   * string — or with the reason it did not, in which case nothing is kept: an
   * introduction is made by somebody waiting to hear whether it worked, so this
   * is the one connection attempt that is not retried.
   *
   * `secrets` are the values for the references that runtime's services carry.
   * They are handed to the runtime when the coordinator builds it, are held in
   * memory only, and are not sent to the coordinator.
   */
  std::string introduce(const LinkRecord& record,
                        std::map<std::string, SecretEntry> secrets = {});

  /** Reconnects with the tickets kept from before this process started. */
  void restore();

  /** The links held, without their tickets. `running` is whether the runtime
   *  a link is for has been built: a board's runtimes are not among those a
   *  client lists, so this is where they are seen. */
  json list() const;

  /** Leaves a board: drops the link and the runtime it was for. */
  bool remove(const std::string& boardName, const std::string& runtimeId);

  /** Closes every connection and keeps every ticket. */
  void stop();

private:
  struct impl;
  std::shared_ptr<impl> m_impl;
};

}
