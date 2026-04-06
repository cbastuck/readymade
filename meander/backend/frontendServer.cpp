#include "frontendServer.h"

#include <iostream>
#include <string>
#include <unordered_map>

#include <crow.h>

#if USE_SAUCER_EMBEDDED
  #include "../embedded/saucer/embedded/all.hpp"
#else
  #include <boost/beast/core.hpp>
  #include <boost/beast/http.hpp>
  #include <boost/asio/ip/tcp.hpp>
#endif

// ─── Impl ────────────────────────────────────────────────────────────────────

struct FrontendServer::Impl
{
  crow::SimpleApp crow;

#if USE_SAUCER_EMBEDDED
  // ── Embedded (release) ───────────────────────────────────────────────────
  struct EmbeddedEntry
  {
    const uint8_t* data;
    std::size_t    size;
    std::string    mime;
  };
  std::unordered_map<std::string, EmbeddedEntry> embedded;

  void init()
  {
    auto files = saucer::embedded::all();
    for (auto& [path, file] : files)
    {
      EmbeddedEntry e;
      e.data = file.content.data();
      e.size = file.content.size();
      e.mime = file.mime;
      embedded[path.string()] = std::move(e);
    }
  }

  crow::response serve(const std::string& rawPath) const
  {
    // Strip query string
    auto key = rawPath.substr(0, rawPath.find('?'));
    if (key.empty() || key == "/") key = "/index.html";

    auto it = embedded.find(key);
    if (it == embedded.end())
    {
      // SPA fallback — unknown paths return index.html so the React router
      // can handle /playground/...?fromLink=... on the phone.
      it = embedded.find("/index.html");
    }
    if (it == embedded.end())
    {
      return crow::response(404);
    }

    crow::response res(200);
    res.set_header("Content-Type", it->second.mime);
    res.body.assign(
      reinterpret_cast<const char*>(it->second.data),
      it->second.size
    );
    return res;
  }

#else
  // ── Dev proxy (debug) ────────────────────────────────────────────────────
  // Forward every request to the vite dev server so the phone always sees the
  // same live version that the desktop webview loads.  HMR websocket upgrades
  // are not forwarded (phones don't need HMR); plain HTTP assets are enough.

  static constexpr const char* DEV_HOST = "localhost";
  static constexpr const char* DEV_PORT = "5555";

  void init() {} // nothing to pre-load

  crow::response serve(const crow::request& req) const
  {
    namespace beast = boost::beast;
    namespace http  = beast::http;
    namespace net   = boost::asio;
    using tcp = net::ip::tcp;

    try
    {
      net::io_context ioc;
      tcp::resolver   resolver(ioc);
      beast::tcp_stream stream(ioc);

      stream.connect(resolver.resolve(DEV_HOST, DEV_PORT));

      // Forward the request path + query string as-is (raw_url includes ?params)
      http::request<http::string_body> fwd{http::verb::get, req.raw_url, 11};
      fwd.set(http::field::host, std::string(DEV_HOST) + ":" + DEV_PORT);
      fwd.set(http::field::connection, "close");

      http::write(stream, fwd);

      beast::flat_buffer buf;
      // Use a parser so we can lift the default 1 MB body limit — large JS
      // bundles (e.g. typescriptServices.js) would otherwise be truncated.
      http::response_parser<http::string_body> parser;
      parser.body_limit((std::numeric_limits<std::uint64_t>::max)());
      http::read(stream, buf, parser);
      auto res = parser.release();

      beast::error_code ec;
      stream.socket().shutdown(tcp::socket::shutdown_both, ec);

      crow::response out(static_cast<int>(res.result_int()), res.body());
      // Forward all response headers so Vite's MIME types, cache headers, etc.
      // reach the browser intact.
      for (auto const& field : res)
      {
        // Skip hop-by-hop headers that must not be forwarded
        if (field.name() == http::field::transfer_encoding) continue;
        if (field.name() == http::field::connection)        continue;
        out.set_header(std::string(field.name_string()), std::string(field.value()));
      }
      return out;
    }
    catch (const std::exception& e)
    {
      std::cerr << "FrontendServer: proxy error: " << e.what() << std::endl;
      return crow::response(502, "Dev server unavailable");
    }
  }
#endif
};

// ─── FrontendServer ──────────────────────────────────────────────────────────

FrontendServer::FrontendServer()
  : m_impl(std::make_unique<Impl>())
{
  m_impl->init();

  CROW_CATCHALL_ROUTE(m_impl->crow)(
    [this](const crow::request& req) -> crow::response
    {
#if USE_SAUCER_EMBEDDED
      return m_impl->serve(req.url);
#else
      return m_impl->serve(req);
#endif
    }
  );
}

FrontendServer::~FrontendServer()
{
  stop();
}

void FrontendServer::start(const std::string& bindAddress, uint16_t port)
{
  m_impl->crow
    .bindaddr(bindAddress)
    .port(port)
    .loglevel(crow::LogLevel::Warning)
    .run();
}

void FrontendServer::stop()
{
  m_impl->crow.stop();
}

uint16_t FrontendServer::getBoundPort() const
{
  return static_cast<uint16_t>(m_impl->crow.port());
}
