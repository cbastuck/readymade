#include "peer_ws_session.h"

#include "peer_registry.h"

#include <nlohmann/json.hpp>

#include <iostream>

namespace beast     = boost::beast;
namespace websocket = beast::websocket;
namespace net       = boost::asio;
using json          = nlohmann::json;

namespace hkp {

PeerWsSession::PeerWsSession(beast::tcp_stream stream,
                             beast::http::request<beast::http::string_body> upgradeReq,
                             std::string peerId,
                             std::shared_ptr<PeerRegistry> registry)
  : m_ws(std::move(stream))
  , m_upgradeReq(std::move(upgradeReq))
  , m_peerId(std::move(peerId))
  , m_registry(std::move(registry))
{
}

PeerWsSession::~PeerWsSession()
{
  on_close();
}

void PeerWsSession::run()
{
  m_ws.set_option(websocket::stream_base::decorator(
    [](websocket::response_type& res)
    {
      res.set(beast::http::field::server, "hkp-peer-server");
    }));

  // Complete the handshake using the already-read HTTP upgrade request.
  m_ws.async_accept(
    m_upgradeReq,
    beast::bind_front_handler(&PeerWsSession::on_accept, shared_from_this()));
}

void PeerWsSession::on_accept(beast::error_code ec)
{
  if (ec)
  {
    std::cerr << "PeerWsSession::on_accept: " << ec.message() << "\n";
    on_close();
    return;
  }

  // Attempt to register. If the ID is already taken, send ID-TAKEN and close.
  if (!m_registry->registerPeer(m_peerId, shared_from_this()))
  {
    m_closeAfterSend = true;
    send(json{{"type", "ID-TAKEN"}}.dump());
    return;
  }

  send(json{{"type", "OPEN"}}.dump());
  do_read();
}

void PeerWsSession::do_read()
{
  if (m_closed)
  {
    return;
  }
  m_ws.async_read(
    m_readBuf,
    beast::bind_front_handler(&PeerWsSession::on_read, shared_from_this()));
}

void PeerWsSession::on_read(beast::error_code ec, std::size_t /*n*/)
{
  if (ec == websocket::error::closed || ec == net::error::operation_aborted)
  {
    on_close();
    return;
  }
  if (ec)
  {
    std::cerr << "PeerWsSession::on_read: " << ec.message() << "\n";
    on_close();
    return;
  }

  auto msg = beast::buffers_to_string(m_readBuf.data());
  m_readBuf.consume(m_readBuf.size());

  try
  {
    auto j = json::parse(msg);
    std::string type = j.value("type", "");
    std::string dst  = j.value("dst", "");

    if (type == "LEAVE")
    {
      on_close();
      return;
    }

    if (!dst.empty())
    {
      // Stamp the source and forward to destination peer.
      j["src"] = m_peerId;
      if (!m_registry->route(dst, j.dump()))
      {
        json err;
        err["type"]           = "ERROR";
        err["payload"]["msg"] = "Could not get data to peer " + dst;
        send(err.dump());
      }
    }
  }
  catch (const std::exception& e)
  {
    std::cerr << "PeerWsSession::on_read parse error: " << e.what() << "\n";
  }

  do_read();
}

void PeerWsSession::send(std::string message)
{
  // Post into the ws strand to serialise writes without an external mutex.
  net::post(
    m_ws.get_executor(),
    [self = shared_from_this(), msg = std::move(message)]() mutable
    {
      self->m_writeQueue.push_back(std::move(msg));
      if (self->m_writeQueue.size() == 1)
      {
        self->do_write();
      }
    });
}

void PeerWsSession::do_write()
{
  if (m_writeQueue.empty() || m_closed)
  {
    return;
  }
  m_ws.text(true);
  m_ws.async_write(
    net::buffer(m_writeQueue.front()),
    beast::bind_front_handler(&PeerWsSession::on_write, shared_from_this()));
}

void PeerWsSession::on_write(beast::error_code ec, std::size_t /*n*/)
{
  if (ec)
  {
    std::cerr << "PeerWsSession::on_write: " << ec.message() << "\n";
    on_close();
    return;
  }
  m_writeQueue.pop_front();
  if (!m_writeQueue.empty())
  {
    do_write();
  }
  else if (m_closeAfterSend)
  {
    on_close();
  }
}

void PeerWsSession::on_close()
{
  if (m_closed)
  {
    return;
  }
  m_closed = true;
  m_registry->unregisterPeer(m_peerId);
}

} // namespace hkp
