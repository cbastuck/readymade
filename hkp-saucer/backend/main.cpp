#include <saucer/smartview.hpp>
#include <saucer/modules/desktop.hpp>

// hkp-rt
#include "app.h"
#include "server.h"
#include "types/data.h"
#include "./schemeHandler.h"


#if USE_SAUCER_EMBEDDED
  #include "embedded/all.hpp"
#endif

int main(int argc, char* argv[])
{
    std::string argument = "";
    if (argc > 1) 
    {
      argument = argv[1];
    }

    saucer::webview::register_scheme("hkp");
    auto app = saucer::application::init({     
        .id = "HookitApp",                   
    });
    auto& desktop = app->add_module<saucer::modules::desktop>();

    saucer::smartview smartview{{
        .application = app,
    }};

    smartview.set_title("HookitApp"); 
    smartview.set_dev_tools(true);
    smartview.set_size(1024, 600);
    smartview.set_background({255, 255, 255, 255}); // white background

    auto allowedOrigins = "*"; // allow all origins for CORS
    auto usePort = 0; // start with random port
    auto hkpApp = std::make_shared<hkp::App>();
    auto server = std::make_shared<hkp::Server>(hkpApp, "realtime", allowedOrigins);
    auto t = std::make_shared<std::thread>([&server, usePort]()
    {
      server->start(usePort); 
    });

    SchemeHandler handler(server, desktop);
    smartview.handle_scheme(
      "hkp",
      [&handler](const saucer::scheme::request &req) -> saucer::scheme::response
      {
          return handler.handleRequest(req);
      });
    
    if (!argument.empty())
    {
      smartview.inject({
        .code = "setTimeout(() => { window.hkpJS.loadBoard('" + argument + "'); }, 500);",
        .time = saucer::load_time::ready,
      });
    }

#if USE_SAUCER_EMBEDDED
    smartview.embed(saucer::embedded::all());
    smartview.serve("index.html");
  #else
    smartview.set_url("http://localhost:5555");
  #endif
    
    smartview.show();    
    app->run(); // enter run loop

    server->stop();
    t->join();

    return 0;
}