#pragma once

#include <atomic>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <thread>

#include <boost/asio/executor_work_guard.hpp>
#include <boost/asio/io_context.hpp>

#include <types/types.h>
#include <service.h>

/**
 * Service Documentation
 * Service ID: websocket-writer
 * Service Name: WebsocketWriter
 * Runtime: hkp-rt
 * Modes: none
 * Key Config: url (+ path, __hkpMount), headers, maxQueueBytes; legacy host/port/path
 * IO: in=anything -> out=the same, unchanged; each pass is also sent as one message
 * Arrays: n/a
 * Binary: sent as binary messages; text and JSON as text messages
 * MixedData: its binary is sent
 *
 * **Sends what passes through to a WebSocket somewhere else**, one message per
 * pass, and hands the pass on unchanged. The connection is made *outward*, so a
 * runtime behind a NAT can feed a server that could never reach it — e.g. a
 * stream relayed by an endpoint in the cloud.
 *
 * **Nothing waits on the network.** process() queues and returns; a thread of
 * this service's own connects, writes, and reconnects with backoff when the
 * connection drops. Keep-alive pings notice a connection that died without
 * closing. The queue is bounded by `maxQueueBytes`: past it, the oldest waiting
 * messages are dropped, because for anything live the newest is what matters.
 *
 * **Where it connects:** `url` — `ws://`, `wss://`, or an `http(s)://` address,
 * which is taken to mean the WebSocket at the same place. A `hkp-mount://`
 * reference names a service instead; the board's coordinator writes that
 * service's address into `__hkpMount`, and `path` is appended to it — the
 * pattern http-client follows. `headers` go on the handshake; a
 * `{{secret.<alias>}}` in one is resolved for the host being connected to, at
 * each attempt, and never kept.
 *
 * Boards from before `url` existed say `host`, `port` and `path`, connect over
 * plain `ws://`, and open with the `{"type":"writer"}` hello hkp-rt's own
 * websocket-server expects. They still do.
 */
namespace hkp {

// Where a WebSocket URL points.
struct WebsocketTarget
{
  bool secure = false;
  std::string host;
  std::string port;
  std::string path; // path and query, always starting with '/'

  std::string url() const
  {
    return std::string(secure ? "wss://" : "ws://") + host + ":" + port + path;
  }
};

// The target a `ws(s)://` or `http(s)://` URL names, or nothing where it is
// neither — including a mount reference, which is not an address yet.
std::optional<WebsocketTarget> parseWebsocketTarget(const std::string& url);

class WebsocketWriter : public Service
{
public:
  static std::string serviceId() { return "websocket-writer"; }

  explicit WebsocketWriter(const std::string& instanceId);
  ~WebsocketWriter();

  json configure(Data data) override;
  bool onBypassChanged(bool bypass) override;
  Data process(Data data) override;
  std::string getServiceId() const override { return serviceId(); }
  json getState() const override;

  // The connection, on its own thread. Defined in the .cpp.
  class Link;

private:
  // The address to connect to now, or nothing with the reason why not.
  std::optional<WebsocketTarget> target(std::string& why) const;
  void restart();
  void stop(bool notify = true);
  void onStatus(const std::string& status, const std::string& error);

  // As configured; what state reports.
  std::string m_url;
  std::string m_path;
  std::string m_mount;
  json m_headers = json::object();
  // About a second at 128 kbit/s: for anything live, what waited longer
  // than that is better dropped than delivered late.
  std::size_t m_maxQueueBytes = 16 * 1024;
  // The legacy form.
  std::string m_host;
  std::string m_port;

  mutable std::mutex m_statusMutex;
  std::string m_status = "idle";
  std::string m_error;

  boost::asio::io_context m_ioc;
  std::optional<boost::asio::executor_work_guard<boost::asio::io_context::executor_type>> m_work;
  std::thread m_thread;
  std::shared_ptr<Link> m_link;
};

} // namespace hkp
