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
#include "./vault.h"
#include "./grants.h"

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
  #ifndef WIN32_LEAN_AND_MEAN
  #define WIN32_LEAN_AND_MEAN
  #endif
  #include <winsock2.h>
  #include <ws2tcpip.h>
  #include <windows.h>
  #include <shellapi.h>
  #pragma comment(lib, "Ws2_32.lib")
#endif

#ifdef NDEBUG
    extern const bool isDebugBuild = false;
#else
    extern const bool isDebugBuild = true;
#endif

#ifdef __APPLE__
#include "./shareRouter.h"
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

// Whether a TCP port can still be bound on `address` — false when something is
// already listening there, which for this app's fixed ports means another
// instance of it. Probed with SO_REUSEADDR set, like the servers themselves, so
// a port left in TIME_WAIT still reads as available.
static bool isPortAvailable(const std::string &address, uint16_t port)
{
#ifdef _WIN32
  WSADATA wsaData;
  if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0)
  {
    return true; // Can't tell; let the server report the real error.
  }
  SOCKET sock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
  const auto invalid = (sock == INVALID_SOCKET);
#else
  int sock = socket(AF_INET, SOCK_STREAM, 0);
  const auto invalid = (sock < 0);
#endif
  if (invalid)
  {
#ifdef _WIN32
    WSACleanup();
#endif
    return true;
  }

  int reuse = 1;
  setsockopt(sock, SOL_SOCKET, SO_REUSEADDR, reinterpret_cast<const char *>(&reuse), sizeof(reuse));

  sockaddr_in addr{};
  addr.sin_family = AF_INET;
  addr.sin_port   = htons(port);
  if (inet_pton(AF_INET, address.c_str(), &addr.sin_addr) != 1)
  {
    addr.sin_addr.s_addr = INADDR_ANY;
  }

  const bool available = bind(sock, reinterpret_cast<sockaddr *>(&addr), sizeof(addr)) == 0;

#ifdef _WIN32
  closesocket(sock);
  WSACleanup();
#else
  close(sock);
#endif
  return available;
}

// Determine the primary LAN IP by connecting a UDP socket to a well-known
// address (no packet is actually sent — the OS just picks the right interface).
static std::string getLanIP()
{
#ifdef _WIN32
  // Same UDP-connect trick as the POSIX path, via Winsock.
  WSADATA wsaData;
  if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0)
  {
    return "127.0.0.1";
  }
  std::string result = "127.0.0.1";
  SOCKET sock = ::socket(AF_INET, SOCK_DGRAM, 0);
  if (sock != INVALID_SOCKET)
  {
    sockaddr_in dest{};
    dest.sin_family = AF_INET;
    dest.sin_port   = htons(53);
    ::inet_pton(AF_INET, "8.8.8.8", &dest.sin_addr);

    if (::connect(sock, reinterpret_cast<sockaddr*>(&dest), sizeof(dest)) == 0)
    {
      sockaddr_in local{};
      int len = sizeof(local);
      if (::getsockname(sock, reinterpret_cast<sockaddr*>(&local), &len) == 0)
      {
        char buf[INET_ADDRSTRLEN];
        if (::inet_ntop(AF_INET, &local.sin_addr, buf, sizeof(buf)))
        {
          result = buf;
        }
      }
    }
    ::closesocket(sock);
  }
  WSACleanup();
  return result;
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
  Vault vault;
  Grants grants;

  auto app = saucer::application::create({.id = "Readymade"});
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

#ifdef __APPLE__
  meanderSetShareNudgeWebview(&webview.value());
#endif

  // Grant media permissions so getUserMedia() works inside the webview.
  // The webview only loads trusted local content (localhost / hkp://) so
  // blanket acceptance is safe here.
  webview->on<saucer::webview::event::permission>([](const std::shared_ptr<saucer::permission::request> &req) -> saucer::status
  {
    req->accept(true);
    return saucer::status::handled;
  });

  window->set_title("Readymade");
  webview->set_dev_tools(isDebugBuild);
  window->set_size({1024, 800});
  window->set_background({255, 255, 255, 255}); // white background
  window->show();

  Settings settings;
  auto bindAddress = settings.getAllowExternalAccess() ? std::string("0.0.0.0") : std::string("127.0.0.1");

  auto lanIP = getLanIP();

  // The app's ports are fixed, so a second instance finds them taken. Probed up
  // front rather than left to the servers, because a bound port is not merely a
  // server that failed to start: the instance holding it is the one answering,
  // and what it answers with goes to its window, not this one. An OAuth callback
  // is the case that matters — it would complete a login in the other window.
  const bool ownsFrontendPort = isPortAvailable("0.0.0.0", FRONTEND_HTTP_PORT);
  const bool ownsRuntimePort  = isPortAvailable(bindAddress, RUNTIME_API_PORT);
  if (!ownsFrontendPort)
  {
    std::cerr << "[startup] Port " << FRONTEND_HTTP_PORT
              << " is already in use — another Readymade instance is most likely "
                 "running. This window still works, but it cannot serve the web "
                 "app to other devices, and a login started here would be "
                 "completed in the other window instead." << std::endl;
  }
  if (!ownsRuntimePort)
  {
    std::cerr << "[startup] Port " << RUNTIME_API_PORT
              << " is already in use — another Readymade instance is most likely "
                 "running. This window still works, but its runtime answers no "
                 "requests from outside it." << std::endl;
  }

  // Inject runtime config into the webview as a global variable so the
  // hkp-frontend can resolve HKP_WEBAPP_URL / HKP_RUNTIME_URL without any
  // fetch calls. Runs before the page's own scripts (time::creation).
  // Whether the exposed runtime has a usable auth allow-list. When external
  // access is on but this is false, the runtime fails closed (denies everyone),
  // so the Settings/About tab can warn the user to configure it.
  const auto displayAuthCfg = settings.getAuthConfig();
  const bool authConfigured =
      !displayAuthCfg.issuers.empty() && !displayAuthCfg.allowedEmails.empty();

  auto configJson = nlohmann::json{
    {"lanIp",               lanIP},
    {"frontendPort",        FRONTEND_HTTP_PORT},
    // False when another instance holds the port: the web app is still served
    // there, but by that instance, so nothing addressed to this one arrives.
    {"ownsFrontendPort",    ownsFrontendPort},
    {"apiPort",             settings.getAllowExternalAccess() ? RUNTIME_API_PORT : 0},
    // The actual bound port and exposure flag, surfaced for the Settings/About
    // tab so it can show the runtime URL in both localhost-only and LAN modes.
    {"runtimePort",         RUNTIME_API_PORT},
    {"allowExternalAccess", settings.getAllowExternalAccess()},
    // True only when exposed AND an allow-list is configured (auth enforced).
    {"authConfigured",      settings.getAllowExternalAccess() && authConfigured},
  };
  webview->inject(saucer::script{
    .code   = "window.__MEANDER_CONFIG__ = " + configJson.dump() + ";",
    .run_at = saucer::script::time::creation,
  });
  webview->inject(saucer::script{
    .code   = "window.__HKP_VAULT__ = " + vault.getAll().dump() + ";",
    .run_at = saucer::script::time::creation,
  });
  // At creation, like the vault: a board can be provisioned as soon as one
  // loads, and a grant that arrived later would be a question asked again for
  // something already answered.
  webview->inject(saucer::script{
    .code   = "window.__HKP_GRANTS__ = " + grants.getAll().dump() + ";",
    .run_at = saucer::script::time::creation,
  });
  auto allowedOrigins = "*"; // allow all origins for CORS

  // Auth gate. A loopback bind is itself the access boundary, so no auth is
  // required there. When exposed on the LAN we require a verified, allow-listed
  // user — and fail closed: an exposed runtime with no issuers/allowed users
  // configured denies every request rather than running open.
  hkp::AuthConfig authConfig;
  if (!hkp::isLoopbackHost(bindAddress))
  {
    authConfig = settings.getAuthConfig();
    authConfig.mode = hkp::AuthMode::Jwt;
    if (authConfig.issuers.empty() || authConfig.allowedEmails.empty())
    {
      std::cerr << "[auth] WARNING: runtime is exposed on " << bindAddress
                << " but no trusted issuers / allowed users are configured in "
                   "~/.hkp/settings.json — all LAN requests will be denied."
                << std::endl;
    }
  }

  auto hkpApp = std::make_shared<hkp::App>();
  auto server = std::make_shared<hkp::Server>(hkpApp, "meander-cpp", allowedOrigins, "", std::move(authConfig));
  auto t = std::make_shared<std::thread>([server, lanIP, bindAddress]()
  {
    // Thrown from a thread, a failure to bind would otherwise terminate the
    // whole app — the window included, which has no need of this server to run
    // a board in the browser runtime.
    try
    {
      server->start(lanIP, RUNTIME_API_PORT, bindAddress);
    }
    catch (const std::exception &e)
    {
      std::cerr << "[startup] Runtime server on port " << RUNTIME_API_PORT
                << " did not start: " << e.what() << std::endl;
    }
  });
  if (ownsFrontendPort)
  {
    std::cout << "Frontend available at: http://" << lanIP << ":" << FRONTEND_HTTP_PORT << "/" << std::endl;
  }

  // Frontend HTTP server — serves the hkp-frontend SPA to devices on the LAN
  // so phones can load the webapp without requiring the dev server, and answers
  // the OAuth callback the OS browser delivers to /serviceRedirect.
  auto frontendServer = std::make_shared<FrontendServer>();

  // Login runs in the OS browser (see openInBrowser below), so the provider
  // redirects to this server rather than to the webview, which it cannot reach.
  // Relaying the parameters as a postMessage puts them where the in-page flow
  // is already listening for them — MessageDispatcher, keyed by `state`.
  frontendServer->setRedirectRelay([&webview](const std::string &paramsJson)
  {
    static_cast<saucer::webview *>(&webview.value())->execute(
      "window.postMessage(" + nlohmann::json(paramsJson).dump() + ", '*')");
  });

  auto frontendThread = std::make_shared<std::thread>([frontendServer]()
  {
    try
    {
      frontendServer->start("0.0.0.0", FRONTEND_HTTP_PORT);
    }
    catch (const std::exception &e)
    {
      std::cerr << "[startup] Frontend server on port " << FRONTEND_HTTP_PORT
                << " did not start: " << e.what() << std::endl;
    }
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

  std::cout << "Launched Readymade" << std::endl;

  // Opening a link elsewhere.
  //
  // WebKit ignores window.open() when the WKUIDelegate doesn't implement
  // createWebViewWithConfiguration:…  The frontend detects Meander via
  // __MEANDER_CONFIG__ and calls saucer.exposed.openInBrowser() directly.
  // The navigate handler below is kept as a fallback for target="_blank" clicks.
  //
  // This hands the URL to the OS browser rather than to a webview of our own.
  // For a login that matters: the browser is where the user's passwords and
  // provider sessions are, and an embedded webview has neither (several
  // providers refuse to log in inside one at all). What the provider then
  // redirects to is the frontend server's /serviceRedirect, relayed above.
  webview->expose("openInBrowser", [](const std::string &url)
  {
    openUrlInSystemBrowser(url);
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

  webview->expose("saveJSON", [&desktop](const std::string &content) -> std::expected<bool, std::string>
  {
    auto picked = desktop.pick<saucer::modules::picker::type::save>(
        saucer::modules::picker::options{.filters = {"*.json"}}
    );
    if (!picked.has_value())
    {
      return std::unexpected(picked.error().message());
    }
    std::filesystem::path path{fileUriToPath(picked.value().string())};
    if (path.extension() != ".json")
    {
      path += ".json";
    }
    std::ofstream file(path);
    if (!file.is_open())
    {
      return std::unexpected("Failed to open file: " + path.string());
    }
    file << content;
    if (!file)
    {
      return std::unexpected("Failed to write file: " + path.string());
    }
    return true;
  });

  webview->expose("setSecret", [&vault](const std::string& key, const std::string& value) -> bool
  {
    return vault.setSecret(key, value);
  });

  webview->expose("deleteSecret", [&vault](const std::string& key) -> bool
  {
    return vault.deleteSecret(key);
  });

  // The names only. A page that needs a value already has every value, from
  // the injection above; this is for a settings view, which needs to list what
  // is held without reading any of it.
  webview->expose("secretAliases", [&vault]() -> std::vector<std::string>
  {
    return vault.aliases();
  });

  // Where each secret may be sent, as a JSON object of alias to hosts. Carries
  // no values, so a settings view can show and edit the constraint without
  // asking for the thing it constrains.
  webview->expose("secretAudiences", [&vault]() -> std::string
  {
    return vault.audiences().dump();
  });

  webview->expose("setSecretAudience",
    [&vault](const std::string& key, const std::vector<std::string>& audience) -> bool
  {
    return vault.setAudience(key, audience);
  });

  // Which board may hand which secrets to which runtime — the remembered
  // answers to the consent prompt. Names only; no values pass through here.
  webview->expose("grantSecrets",
    [&grants](const std::string& key, const std::vector<std::string>& aliases) -> bool
  {
    return grants.grant(key, aliases);
  });

  webview->expose("revokeSecretGrant", [&grants](const std::string& key) -> bool
  {
    return grants.revoke(key);
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
  webview->set_url("http://localhost:8555");
#endif

  loop.run();

#ifdef __APPLE__
  meanderSetShareNudgeWebview(nullptr);
#endif

  frontendServer->stop();
  frontendThread->join();

  server->stop();
  t->join();

  return 0;
}

#ifndef __APPLE__
// Windows and Linux entry point: forward to real_main to match macOS main.mm behavior
int main(int argc, char* argv[])
{
  return real_main(argc, argv);
}
#endif
