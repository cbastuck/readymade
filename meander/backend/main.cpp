#include <saucer/smartview.hpp>
#include <saucer/modules/loop.hpp>

// hkp-rt
#include "app.h"
#include "server.h"
#include "types/data.h"
#include "./schemeHandler.h"

#if USE_SAUCER_EMBEDDED
#include "../embedded/saucer/embedded/all.hpp"
#endif

#ifdef NDEBUG
    const bool isDebugBuild = false;
#else
    const bool isDebugBuild = true;
#endif

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
  auto server = std::make_shared<hkp::Server>(hkpApp, "realtime", allowedOrigins);
  auto t = std::make_shared<std::thread>([server, usePort]()
  {
    server->start("127.0.0.1", usePort);
  });


  Settings settings;
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

#if USE_SAUCER_EMBEDDED
  webview->embed(saucer::embedded::all());
  webview->serve("/index.html");
#else
  webview->set_url("http://localhost:5555");
#endif

  loop.run();

  server->stop();
  t->join();

  return 0;
}
