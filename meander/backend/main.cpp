#include <saucer/smartview.hpp>
#include <saucer/modules/loop.hpp>
#include <saucer/modules/desktop.hpp>

#include <expected>
#include <fstream>
#include <sstream>

// hkp-rt
#include "app.h"
#include "server.h"
#include "types/data.h"
#include "./schemeHandler.h"
#include "./frontendServer.h"
#include "./serviceRedirectHandler.h"

#if USE_SAUCER_EMBEDDED
#include "../embedded/saucer/embedded/all.hpp"
#endif

#ifndef _WIN32
  #include <sys/socket.h>
  #include <netinet/in.h>
  #include <arpa/inet.h>
  #include <unistd.h>
  #include <sys/wait.h>
#endif
#ifdef _WIN32
  #include <windows.h>
  #include <shellapi.h>
#endif

#ifdef NDEBUG
    extern const bool isDebugBuild = false;
#else
    extern const bool isDebugBuild = true;
#endif

// Opens a URL in the OS default browser without spawning a shell (no injection risk).
static void openUrlInSystemBrowser(const std::string &url)
{
#ifdef _WIN32
  ShellExecuteA(nullptr, "open", url.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
#elif defined(__APPLE__)
  const char *args[] = {"open", url.c_str(), nullptr};
  pid_t pid = fork();
  if (pid == 0) { execvp("open", const_cast<char **>(args)); _exit(1); }
  if (pid > 0)  { waitpid(pid, nullptr, 0); }
#else
  const char *args[] = {"xdg-open", url.c_str(), nullptr};
  pid_t pid = fork();
  if (pid == 0) { execvp("xdg-open", const_cast<char **>(args)); _exit(1); }
  if (pid > 0)  { waitpid(pid, nullptr, 0); }
#endif
}

// Determine the primary LAN IP by connecting a UDP socket to a well-known
// address (no packet is actually sent — the OS just picks the right interface).
static std::string getLanIP()
{
#ifdef _WIN32
  // Windows: fall back to localhost.
  return "127.0.0.1";
#else
  int sock = ::socket(AF_INET, SOCK_DGRAM, 0);
  if (sock < 0)
  {
    return "127.0.0.1";
  }

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

// Converts a file:// URI to a native filesystem path.
// Handles the optional "localhost" authority and percent-decodes the path.
static std::string fileUriToPath(const std::string &uri)
{
  if (!uri.starts_with("file://"))
  {
    return uri;
  }
  std::string path = uri.substr(7); // strip "file://"
  if (path.starts_with("localhost"))
  {
    path = path.substr(9);
  }
  std::string decoded;
  decoded.reserve(path.size());
  for (std::size_t i = 0; i < path.size(); ++i)
  {
    if (path[i] == '%' && i + 2 < path.size())
    {
      int val = 0;
      std::istringstream ss(path.substr(i + 1, 2));
      ss >> std::hex >> val;
      decoded += static_cast<char>(val);
      i += 2;
    }
    else
    {
      decoded += path[i];
    }
  }
  return decoded;
}

static constexpr uint16_t FRONTEND_HTTP_PORT = 9090;
static constexpr uint16_t RUNTIME_API_PORT = 8887;

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

  // Grant media permissions so getUserMedia() works inside the webview.
  // The webview only loads trusted local content (localhost / hkp://) so
  // blanket acceptance is safe here.
  webview->on<saucer::webview::event::permission>([](const std::shared_ptr<saucer::permission::request> &req) -> saucer::status
  {
    req->accept(true);
    return saucer::status::handled;
  });

  window->set_title("Meander");
  webview->set_dev_tools(isDebugBuild);
  window->set_size({1024, 800});
  window->set_background({255, 255, 255, 255}); // white background
  window->show();

  Settings settings;
  auto bindAddress = settings.getAllowExternalAccess() ? std::string("0.0.0.0") : std::string("127.0.0.1");

  auto lanIP = getLanIP();

  // Inject runtime config into the webview as a global variable so the
  // hkp-frontend can resolve HKP_WEBAPP_URL / HKP_RUNTIME_URL without any
  // fetch calls. Runs before the page's own scripts (time::creation).
  auto configJson = nlohmann::json{
    {"lanIp",        lanIP},
    {"frontendPort", FRONTEND_HTTP_PORT},
    {"apiPort",      settings.getAllowExternalAccess() ? RUNTIME_API_PORT : 0},
  };
  webview->inject(saucer::script{
    .code   = "window.__MEANDER_CONFIG__ = " + configJson.dump() + ";",
    .run_at = saucer::script::time::creation,
  });
  auto allowedOrigins = "*"; // allow all origins for CORS
  auto hkpApp = std::make_shared<hkp::App>();
  auto server = std::make_shared<hkp::Server>(hkpApp, "meander-cpp", allowedOrigins);
  auto t = std::make_shared<std::thread>([server, lanIP, bindAddress]()
  {
    server->start(lanIP, RUNTIME_API_PORT, bindAddress);
  });
  std::cout << "Frontend available at: http://" << lanIP << ":" << FRONTEND_HTTP_PORT << "/" << std::endl;

  // Frontend HTTP server — serves the hkp-frontend SPA to devices on the LAN
  // so phones can load the webapp without requiring the dev server.
  auto frontendServer = std::make_shared<FrontendServer>();
  auto frontendThread = std::make_shared<std::thread>([frontendServer]()
  {
    frontendServer->start("0.0.0.0", FRONTEND_HTTP_PORT);
  });

  auto numLoadedPlugins = hkpApp->scanForPlugins(settings.getBundlesPath());
  std::cout << "Loaded " << numLoadedPlugins << " plugins from bundles path: " << settings.getBundlesPath() << std::endl;

  SchemeHandler handler(server, settings);
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

  // Popup support.
  //
  // WebKit ignores window.open() when the WKUIDelegate doesn't implement
  // createWebViewWithConfiguration:…  The frontend detects Meander via
  // __MEANDER_CONFIG__ and calls saucer.exposed.openInBrowser() directly.
  // The navigate handler below is kept as a fallback for target="_blank" clicks.
  // OAuth-specific relay logic lives in ServiceRedirectHandler / serviceRedirectHandler.cpp.

  ServiceRedirectHandler redirectHandler(&webview.value(), loop.application());

  webview->expose("openInBrowser", [&redirectHandler](const std::string &url)
  {
    redirectHandler.open(url);
  });

  auto desktop = saucer::modules::desktop{loop.application()};

  webview->expose("pickFile", [&desktop](saucer::modules::picker::options opts)
  {
    return desktop.pick<saucer::modules::picker::type::file>(std::move(opts))
        .transform_error(&saucer::error::message);
  });

  webview->expose("pickFolder", [&desktop](saucer::modules::picker::options opts)
  {
    return desktop.pick<saucer::modules::picker::type::folder>(std::move(opts))
        .transform_error(&saucer::error::message);
  });

  webview->expose("readFile", [](const std::string &uri) -> std::expected<std::string, std::string>
  {
    const auto path = fileUriToPath(uri);
    std::ifstream file(path, std::ios::binary);
    if (!file.is_open())
    {
      return std::unexpected("Failed to open file: " + path);
    }
    std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
    return content;
  });

  webview->expose("writeFile", [](const std::string &uri, const std::string &content) -> std::expected<bool, std::string>
  {
    const auto path = fileUriToPath(uri);
    std::ofstream file(path, std::ios::binary);
    if (!file.is_open())
    {
      return std::unexpected("Failed to open file for writing: " + path);
    }
    file.write(content.data(), static_cast<std::streamsize>(content.size()));
    if (!file)
    {
      return std::unexpected("Failed to write file: " + path);
    }
    return true;
  });

  webview->expose("pickSavePath", [&desktop](saucer::modules::picker::options opts)
  {
    return desktop.pick<saucer::modules::picker::type::save>(std::move(opts))
        .transform_error(&saucer::error::message);
  });

  // Fallback: open target="_blank" link clicks in the OS default browser.
  webview->on<saucer::webview::event::navigate>(
    [](const saucer::navigation &nav) -> saucer::policy
    {
      if (!nav.new_window()) {
        return saucer::policy::allow;
      }
      openUrlInSystemBrowser(nav.url().string());
      return saucer::policy::block;
    });

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

#ifdef _WIN32
// Windows entry point: forward to real_main to match macOS main.mm behavior
int main(int argc, char* argv[])
{
  return real_main(argc, argv);
}
#endif
