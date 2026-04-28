#pragma once

#include <deque>
#include <memory>
#include <string>

#include <boost/asio.hpp>
#include <boost/beast.hpp>
#include <boost/beast/websocket.hpp>

namespace hkp {

class PeerRegistry;

// Owns a single WebSocket connection for one signaling peer.
// All async operations run on the session's strand (the ws executor).
// send() is thread-safe: it posts into the strand and queues writes.
class PeerWsSession : public std::enable_shared_from_this<PeerWsSession>
{
public:
  // Takes ownership of the tcp_stream and the already-read HTTP upgrade request.
  PeerWsSession(boost::beast::tcp_stream stream,
                boost::beast::http::request<boost::beast::http::string_body> upgradeReq,
                std::string peerId,
                std::shared_ptr<PeerRegistry> registry);

  ~PeerWsSession();

  // Completes the WebSocket handshake, sends OPEN, then starts the read loop.
  void run();

  // Thread-safe: posts a text frame to the strand's write queue.
  void send(std::string message);

  const std::string& peerId() const { return m_peerId; }

private:
  void on_accept(boost::beast::error_code ec);
  void do_read();
  void on_read(boost::beast::error_code ec, std::size_t n);
  void do_write();
  void on_write(boost::beast::error_code ec, std::size_t n);
  void on_close();

  boost::beast::websocket::stream<boost::beast::tcp_stream> m_ws;
  boost::beast::http::request<boost::beast::http::string_body> m_upgradeReq;
  boost::beast::flat_buffer m_readBuf;
  std::string m_peerId;
  std::shared_ptr<PeerRegistry> m_registry;
  std::deque<std::string> m_writeQueue;
  bool m_closed = false;
  bool m_closeAfterSend = false; // set when sending ID-TAKEN before closing
};

} // namespace hkp
