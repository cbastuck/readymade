#include <saucer/smartview.hpp>
#include <saucer/modules/loop.hpp>

// hkp-rt
#include "app.h"
#include "server.h"
#include "types/data.h"
#include "./schemeHandler.h"

#include <csignal>

#if USE_SAUCER_EMBEDDED
#include "../embedded/saucer/embedded/all.hpp"
#endif

#ifdef NDEBUG
    const bool isDebugBuild = false;
#else
    const bool isDebugBuild = true;
#endif  

void handle_signal(int sig)
{
    std::cerr << "meander handle_signal called: " << sig << std::endl;
    // optionally exit or continue
}

int real_main(int argc, char *argv[])
{
  std::signal(SIGSEGV, handle_signal);
  std::signal(SIGABRT, handle_signal);

  std::string projectFile = "";
  std::string pythonBundle = "";

  // If exactly one argument is provided, treat it as the project file
  if (argc == 2 && argv[1][0] != '-')
  {
    projectFile = argv[1];
  }
  
  // Parse command line arguments
  for (int i = 1; i < argc; ++i)
  {
    std::string arg = argv[i];
    if (arg == "--project" && i + 1 < argc)
    {
      projectFile = argv[++i];
    }
    else if (arg == "--python" && i + 1 < argc)
    {
      pythonBundle = argv[++i];
    }
  }

#if USE_PYTHON_INTEGRATION
  if (!pythonBundle.empty())
  {
    PythonIntegration pythonIntegration;
    auto p = std::thread(
        [&pythonBundle, &pythonIntegration]()
        {
          if (pythonIntegration.start(pythonBundle) != 0)
          {
            std::cerr << "Failed to start python command" << std::endl;
          }
        });
    p.detach();
  }
#endif

  saucer::webview::register_scheme("hkp");
  auto app  = saucer::application::create({.id = "Meander"});
  auto loop = saucer::modules::loop{app.value()};

  auto window  = saucer::window::create(loop.application()).value();
  auto webview = saucer::smartview::create({.window = window});

  window->set_title("Meander");
  webview->set_dev_tools(isDebugBuild);
  window->set_size({1024, 600});
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
  
  std::cout << "Launched meander with project file: " << projectFile << std::endl;
  if (!projectFile.empty())
  {
    webview->inject({
        .code = "setTimeout(() => { window.hkpJS.loadBoard('" + projectFile + "'); }, 500);",
        .run_at = saucer::script::time::ready,
    });
  }

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
