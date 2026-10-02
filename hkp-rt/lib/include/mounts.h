#pragma once

#include <functional>
#include <string>

#include <boost/asio/ip/tcp.hpp>

namespace hkp
{

/**
 * Endpoints a service exposes without binding a port.
 *
 * A service that has to be reachable from outside — an HTTP endpoint, a
 * signalling server — is given a path on the runtime server's own port:
 *
 *   http://<host>:<port>/hosted/<mountId>
 *
 * Ports are one machine-wide namespace, so a service asking for a specific one
 * is a land grab: two hkp-rt processes on one machine collide on whatever port
 * a board names, and in a container each port has to be published separately.
 * A path on the server's port needs neither, and sits behind whatever the
 * server itself sits behind.
 *
 * These endpoints are unauthenticated by design — they exist for outside
 * callers holding no token — so the unguessable id is what gates access. It is
 * **derived, not drawn**: an HMAC of the board, the runtime and what the mount
 * is called, keyed by a secret only the server holds. The address therefore
 * survives reloads, restarts and redeploys, while nothing sensitive enters the
 * board. The derivation is hkp-node's (`src/mounts.ts`), with an empty tenant:
 * hkp-rt has one.
 */

/** Requests under this prefix are served by mounts rather than the REST API. */
inline constexpr const char* MOUNT_PREFIX = "/hosted";

/**
 * A connection a caller opened to a mount, handed whole to the service that
 * owns it. The service reads the request and answers on the socket itself, so
 * a response may be held open, streamed, or upgraded to a WebSocket.
 */
struct MountedConnection
{
  boost::asio::ip::tcp::socket socket;
  /**
   * What was already read from the socket: the request head, with the mount's
   * prefix taken out of its target, and whatever of the body arrived with it.
   */
  std::string prefetched;
  /** The prefix this mount owns, e.g. `/hosted/ab12…`. */
  std::string mountPath;
};

using MountAdopter = std::function<void(MountedConnection)>;

/**
 * A mount, held by the service that asked for it.
 *
 * The mount lasts until it is released, which destroying the handle or
 * assigning another over it does. Releasing gives up this claim and no other:
 * an address is derived from what the mount is called, so a second claim to
 * the same address takes it over, and the handle of the first then releases
 * nothing. A handle may outlive the server that issued it.
 *
 * Empty — false, with no url — when the server serves no mounts.
 */
class MountHandle
{
public:
  MountHandle() = default;
  MountHandle(std::string name, std::string url, std::function<void()> release)
    : m_name(std::move(name)), m_url(std::move(url)), m_release(std::move(release))
  {
  }
  MountHandle(const MountHandle&) = delete;
  MountHandle& operator=(const MountHandle&) = delete;
  MountHandle(MountHandle&& other) noexcept { take(other); }
  MountHandle& operator=(MountHandle&& other) noexcept
  {
    if (this != &other)
    {
      release();
      take(other);
    }
    return *this;
  }
  ~MountHandle() { release(); }

  explicit operator bool() const { return !m_url.empty(); }
  /** What the mount is called; with the board and the runtime, what its
   *  address is derived from. */
  const std::string& name() const { return m_name; }
  /** The address clients are pointed at. */
  const std::string& url() const { return m_url; }

  void release()
  {
    if (m_release)
    {
      m_release();
    }
    m_release = nullptr;
    m_name.clear();
    m_url.clear();
  }

private:
  void take(MountHandle& other)
  {
    m_name = std::move(other.m_name);
    m_url = std::move(other.m_url);
    m_release = std::move(other.m_release);
    other.m_release = nullptr;
    other.m_name.clear();
    other.m_url.clear();
  }

  std::string m_name;
  std::string m_url;
  std::function<void()> m_release;
};

/**
 * The id a mount always gets: the first 32 hex characters of
 * HMAC-SHA256(secret, tenant NUL board NUL runtime NUL name).
 */
/**
 * The secret kept in `file`, drawn and written there (owner-readable only)
 * when the file does not hold one yet. Empty when it can be neither read nor
 * written — a server then draws one for the process, and its addresses do not
 * survive a restart.
 */
std::string loadOrCreateMountSecret(const std::string& file);

std::string deriveMountId(const std::string& secret, const std::string& tenant,
                          const std::string& boardName, const std::string& runtimeId,
                          const std::string& name);

}
