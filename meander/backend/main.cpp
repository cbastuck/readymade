#include <saucer/smartview.hpp>
#include <saucer/modules/loop.hpp>

// hkp-rt
#include "app.h"
#include "server.h"
#include "types/data.h"
#include "./schemeHandler.h"
#include "./frontendServer.h"

#if USE_SAUCER_EMBEDDED
#include "../embedded/saucer/embedded/all.hpp"
#endif

#ifndef _WIN32
  #include <sys/socket.h>
  #include <netinet/in.h>
  #include <arpa/inet.h>
  #include <unistd.h>
#endif

#ifdef NDEBUG
    const bool isDebugBuild = false;
#else
    const bool isDebugBuild = true;
#endif

// Determine the primary LAN IP by connecting a UDP socket to a well-known
// address (no packet is actually sent — the OS just picks the right interface).
static std::string getLanIP()
{
#ifdef _WIN32
  // Windows: fall back to localhost.
  return "127.0.0.1";
#else
  int sock = ::socket(AF_INET, SOCK_DGRAM, 0);
  if (sock < 0) return "127.0.0.1";

  sockaddr_in dest{};
  dest.sin_family = AF_INET;
  dest.sin_port   = htons(53);
  ::inet_pton(AF_INET, "8.8.8.8", &dest.sin_addr);

  if (::connect(sock, reinterpret_cast<sockaddr*>(&dest), sizeof(dest)) != 0)
  {
    ::close(sock);
    return "127.0.0.1";
  }

  sockaddr_in local{};
  socklen_t len = sizeof(local);
  ::getsockname(sock, reinterpret_cast<sockaddr*>(&local), &len);
  ::close(sock);

  char buf[INET_ADDRSTRLEN];
  ::inet_ntop(AF_INET, &local.sin_addr, buf, sizeof(buf));
  return buf;
#endif
}

static constexpr uint16_t FRONTEND_HTTP_PORT = 9090;

int real_main(int argc, char *argv[])
{
  saucer::webview::register_scheme("hkp");
  auto app = saucer::application::create({.id = "Meander"});
  if (!app.has_value())
  {
    std::cerr << "Failed to create saucer application" << std::endl;
    return 1;
  }
  auto loop = saucer::modules::loop{app.value()};

  auto windowResult = saucer::window::create(loop.application());
  if (!windowResult.has_value())
  {
    std::cerr << "Failed to create window" << std::endl;
    return 1;
  }
  auto window  = windowResult.value();
  auto webview = saucer::smartview::create({.window = window});

  window->set_title("Meander");
  webview->set_dev_tools(isDebugBuild);
  window->set_size({1024, 800});
  window->set_background({255, 255, 255, 255}); // white background
  window->show();

  auto allowedOrigins = "*"; // allow all origins for CORS
  auto usePort = 0; // start with random port
  auto hkpApp = std::make_shared<hkp::App>();
  auto server = std::make_shared<hkp::Server>(hkpApp, "meander-cpp", allowedOrigins);
  auto t = std::make_shared<std::thread>([server, usePort]()
  {
    server->start("127.0.0.1", usePort);
  });

  auto lanIP = getLanIP();
  std::cout << "Frontend available at: http://" << lanIP << ":" << FRONTEND_HTTP_PORT << "/" << std::endl;

  // Frontend HTTP server — serves the hkp-frontend SPA to devices on the LAN
  // so phones can load the webapp without requiring the dev server.
  auto frontendServer = std::make_shared<FrontendServer>();
  auto frontendThread = std::make_shared<std::thread>([frontendServer]()
  {
    frontendServer->start("0.0.0.0", FRONTEND_HTTP_PORT);
  });

  Settings settings;
  auto numLoadedPlugins = hkpApp->scanForPlugins(settings.getBundlesPath());
  std::cout << "Loaded " << numLoadedPlugins << " plugins from bundles path: " << settings.getBundlesPath() << std::endl;

  SchemeHandler handler(server, settings);

  // Expose LAN IP and frontend port via hkp://meander/info so the desktop QR
  // code service can resolve MEANDER_HOST without hardcoding any address.
  handler.addRoute("GET", "/meander/info",
    [lanIP](const Router::Params&, const saucer::scheme::request&) -> saucer::scheme::response
    {
      return saucer::scheme::response{
        .data    = saucer::stash::from_str(
                     nlohmann::json{{"lanIp", lanIP}, {"frontendPort", FRONTEND_HTTP_PORT}}.dump()),
        .mime    = "application/json",
        .headers = {{"Access-Control-Allow-Origin", "*"}},
        .status  = 200,
      };
    });

  webview->handle_scheme(
    "hkp",
    [&handler](const saucer::scheme::request &req, saucer::scheme::executor executor)
    {
      auto [resolve, reject] = executor;
      try
      {
        resolve(handler.handleRequest(req));
      }
      catch(...)
      {
        std::cerr << "Scheme handler exception" << std::endl;
        resolve(saucer::scheme::response{
          .data = saucer::stash::from_str("Internal error"),
          .headers = {},
          .status = 500
        });
      }
    }
  );

  std::cout << "Launched meander" << std::endl;

#if USE_SAUCER_EMBEDDED
  webview->embed(saucer::embedded::all());
  webview->serve("/index.html");
#else
  webview->set_url("http://localhost:5555");
#endif

  loop.run();

  frontendServer->stop();
  frontendThread->join();

  server->stop();
  t->join();

  return 0;
}
