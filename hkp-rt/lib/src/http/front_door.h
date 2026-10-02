#pragma once

#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <thread>

#include <boost/asio.hpp>

#include <mounts.h>

namespace hkp
{

/**
 * The port a runtime server is reached on, when its services are mounted on it.
 *
 * Every connection arrives here. One whose request is for a mount
 * (`/hosted/<id>…`) is handed, socket and all, to the service that owns the
 * mount. Anything else is the REST api's, and is passed through to it —
 * the api server listens on loopback, on a port nobody is told.
 *
 * A connection carries one request. What is passed through is marked
 * `Connection: close` (a WebSocket upgrade excepted), because the decision of
 * who a connection belongs to is made once, on its first request: a caller
 * reusing one connection for the api and then for a mount would otherwise have
 * its second request answered by whoever got the first.
 *
 * The api server decides whom to trust partly by where a request comes from —
 * the machine's own UI is not asked for a token. Passed through, everything
 * comes from this process, so the caller's address is passed along in a header,
 * beside a secret that only this process knows: `X-Hkp-Client` is believed only
 * together with the right `X-Hkp-Front`, and both are removed from anything a
 * caller sent.
 */
class FrontDoor
{
public:
  static constexpr const char* FRONT_HEADER = "X-Hkp-Front";
  static constexpr const char* CLIENT_HEADER = "X-Hkp-Client";

  explicit FrontDoor(std::string frontSecret);
  ~FrontDoor();

  /** Listens on `bind:port` and passes the api's requests to `upstreamPort`
   *  on loopback. Returns the port bound, or 0 when it could not be. */
  unsigned short start(const std::string& bind, unsigned short port,
                       unsigned short upstreamPort);
  void stop();

  void mount(const std::string& mountId, MountAdopter adopter);
  void unmount(const std::string& mountId);
  /** The adopter for a mount, or nothing. */
  MountAdopter find(const std::string& mountId);

  const std::string& frontSecret() const { return m_frontSecret; }
  unsigned short upstreamPort() const { return m_upstreamPort; }
  boost::asio::io_context& ioContext() { return m_ioc; }

private:
  void accept();

  std::string m_frontSecret;
  boost::asio::io_context m_ioc;
  std::unique_ptr<boost::asio::ip::tcp::acceptor> m_acceptor;
  std::unique_ptr<boost::asio::executor_work_guard<boost::asio::io_context::executor_type>> m_work;
  std::thread m_thread;
  unsigned short m_upstreamPort = 0;

  std::mutex m_mutex;
  std::map<std::string, MountAdopter> m_mounts;
};

/**
 * What a request's first bytes say, and what to do with them. Free functions
 * so the decisions can be checked without a socket.
 */
namespace front_door
{

struct Head
{
  std::string method;
  std::string target;
  /** The mount id when the target is under `/hosted/`, else empty. */
  std::string mountId;
  bool valid = false;
};

Head readHead(const std::string& bytes);

/** The head as the mount's service is given it: its prefix taken off the target. */
std::string forMount(const std::string& bytes, const Head& head);

/** The head as the api server is given it; see FrontDoor. */
std::string forApi(const std::string& bytes, const std::string& frontSecret,
                   const std::string& clientAddress);

}

}
