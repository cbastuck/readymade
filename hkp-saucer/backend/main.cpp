#include <saucer/smartview.hpp>

// hkp-rt
#include "app.h"
#include "server.h"
#include "types/data.h"
#include "./schemeHandler.h"

#include <csignal>

#if USE_PYTHON_INTEGRATION
#include "./python/pythonIntegration.h"
#endif

#define _USE_SAUCER_EMBEDDED USE_SAUCER_EMBEDDED || NDEBUG
#if _USE_SAUCER_EMBEDDED
#include "embedded/all.hpp"
#endif

#ifdef NDEBUG
    const bool isDebugBuild = false;
#else
    const bool isDebugBuild = true;
#endif  

void handle_signal(int sig)
{
    std::cerr << "hkp-saucer handle_signal called: " << sig << std::endl;
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
  auto app = saucer::application::init({
      .id = "HookitApp",
  });

  saucer::smartview smartview{{.application = app}};
  smartview.set_title("HookitApp");

  smartview.set_dev_tools(isDebugBuild);
  smartview.set_size(1024, 600);
  smartview.set_background({255, 255, 255, 255}); // white background
  smartview.show();

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
  smartview.handle_scheme(
    "hkp",
    [&handler](const saucer::scheme::request &req) -> saucer::scheme::response
    {
      try
      {
        return handler.handleRequest(req);
      }
      catch(...)
      {
        std::cerr << "Scheme handler exception" << std::endl;
        return saucer::scheme::response{
          .data = saucer::make_stash("Internal error"),
          .headers = {},  
          .status = 500
        };
      }
      
    }
  );
  
  std::cout << "Launched hkp-saucer with project file: " << projectFile << std::endl;
  if (!projectFile.empty())
  {
    smartview.inject({
        .code = "setTimeout(() => { window.hkpJS.loadBoard('" + projectFile + "'); }, 500);",
        .time = saucer::load_time::ready,
    });
  }

#if _USE_SAUCER_EMBEDDED
  smartview.embed(saucer::embedded::all());
  smartview.serve("index.html");
#else
  smartview.set_url("http://localhost:5555");
#endif
  
  app->run();

  server->stop();
  t->join();

  return 0;
}
