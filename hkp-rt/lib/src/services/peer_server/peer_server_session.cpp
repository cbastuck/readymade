#include "peer_server_session.h"

#include "peer_registry.h"
#include "peer_ws_session.h"

#include <nlohmann/json.hpp>

#include <iostream>

namespace beast = boost::beast;
namespace http  = beast::http;
namespace net   = boost::asio;
using json      = nlohmann::json;

namespace hkp {

// ── helpers ──────────────────────────────────────────────────────────────────

static void addCorsHeaders(http::response<http::string_body>& res)
{
  res.set(http::field::access_control_allow_origin, "*");
  res.set(http::field::access_control_allow_headers, "Content-Type");
}

// ── PeerServerSession ─────────────────────────────────────────────────────────

PeerServerSession::PeerServerSession(net::ip::tcp::socket&& socket,
                                     std::shared_ptr<PeerRegistry> registry,
                                     std::string basePath)
  : m_stream(std::move(socket))
  , m_registry(std::move(registry))
  , m_basePath(std::move(basePath))
{
}

void PeerServerSession::run()
{
  http::async_read(
    m_stream,
    m_buf,
    m_req,
    beast::bind_front_handler(&PeerServerSession::on_read, shared_from_this()));
}

void PeerServerSession::on_read(beast::error_code ec, std::size_t /*n*/)
{
  if (ec)
  {
    if (ec != http::error::end_of_stream)
    {
      std::cerr << "PeerServerSession::on_read: " << ec.message() << "\n";
    }
    return;
  }

  if (beast::websocket::is_upgrade(m_req))
  {
    upgrade_to_ws();
  }
  else
  {
    handle_http();
  }
}

void PeerServerSession::handle_http()
{
  const auto target = std::string(m_req.target());

  // Strip query string for path matching.
  auto pathEnd = target.find('?');
  auto path    = target.substr(0, pathEnd);

  auto respond = [&](http::status status, const std::string& body, const std::string& contentType)
  {
    http::response<http::string_body> res{status, m_req.version()};
    res.set(http::field::content_type, contentType);
    res.keep_alive(false);
    res.body() = body;
    res.prepare_payload();
    addCorsHeaders(res);
    beast::error_code wec;
    http::write(m_stream, res, wec);
  };

  // GET /[basePath]/id  — generate and return a fresh peer ID.
  if (m_req.method() == http::verb::get && path == m_basePath + "/id")
  {
    respond(http::status::ok, "\"" + m_registry->generateId() + "\"", "application/json");
    return;
  }

  // GET /[basePath]/peers  — return the list of connected peer IDs.
  if (m_req.method() == http::verb::get && path == m_basePath + "/peers")
  {
    json j = m_registry->connectedPeerIds();
    respond(http::status::ok, j.dump(), "application/json");
    return;
  }

  // CORS preflight.
  if (m_req.method() == http::verb::options)
  {
    http::response<http::string_body> res{http::status::no_content, m_req.version()};
    res.set(http::field::access_control_allow_methods, "GET, OPTIONS");
    res.keep_alive(false);
    res.prepare_payload();
    addCorsHeaders(res);
    beast::error_code wec;
    http::write(m_stream, res, wec);
    return;
  }

  respond(http::status::not_found, "Not found", "text/plain");
}

void PeerServerSession::upgrade_to_ws()
{
  const auto target = std::string(m_req.target());
  auto id = parseQueryParam(target, "id");
  if (id.empty())
  {
    id = m_registry->generateId();
  }

  // Move stream and request into the WS session.
  // Registration and OPEN/ID-TAKEN are handled inside PeerWsSession::on_accept.
  auto wsSession = std::make_shared<PeerWsSession>(
    std::move(m_stream),
    std::move(m_req),
    std::move(id),
    m_registry);

  wsSession->run();
}

// static
std::string PeerServerSession::parseQueryParam(const std::string& target, const std::string& key)
{
  auto qpos = target.find('?');
  if (qpos == std::string::npos)
  {
    return {};
  }
  const std::string query  = target.substr(qpos + 1);
  const std::string prefix = key + "=";
  auto kpos = query.find(prefix);
  if (kpos == std::string::npos)
  {
    return {};
  }
  auto vstart = kpos + prefix.size();
  auto vend   = query.find('&', vstart);
  return query.substr(vstart, vend == std::string::npos ? std::string::npos : vend - vstart);
}

} // namespace hkp
