#pragma once

#include <memory>
#include <string>

#include <boost/asio.hpp>
#include <boost/beast.hpp>
#include <boost/beast/http.hpp>

namespace hkp {

class PeerRegistry;

// Handles one incoming TCP connection.
// Reads the HTTP upgrade request, then either:
//   - responds to GET /[path]/id or GET /[path]/peers  (plain HTTP), or
//   - hands the socket off to a PeerWsSession           (WebSocket upgrade).
class PeerServerSession : public std::enable_shared_from_this<PeerServerSession>
{
public:
  PeerServerSession(boost::asio::ip::tcp::socket&& socket,
                    std::shared_ptr<PeerRegistry> registry,
                    std::string basePath);

  void run();

private:
  void on_read(boost::beast::error_code ec, std::size_t n);
  void handle_http();
  void upgrade_to_ws();

  // Extracts the value of `key` from a URL query string (e.g. "?key=a&id=b").
  static std::string parseQueryParam(const std::string& target, const std::string& key);

  boost::beast::tcp_stream m_stream;
  boost::beast::flat_buffer m_buf;
  boost::beast::http::request<boost::beast::http::string_body> m_req;
  std::shared_ptr<PeerRegistry> m_registry;
  std::string m_basePath;
};

} // namespace hkp
