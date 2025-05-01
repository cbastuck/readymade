#include <saucer/smartview.hpp>

#include "embedded/all.hpp"

// hkp-rt
#include "app.h"
#include "server.h"
#include "types/data.h"


int main()
{
    auto app = saucer::application::init({     
        .id = "HookitApp",                   
    });

    saucer::smartview smartview{{
        .application = app,
    }};

    smartview.set_title("HookitApp"); 
    //smartview.set_decorations(true);
    smartview.set_dev_tools(true);
    smartview.set_size(1024, 600);    

    auto localport = 3446;
    auto hkpApp = std::make_shared<hkp::App>();
    auto server = std::make_shared<hkp::Server>(hkpApp);
    auto t = std::make_shared<std::thread>([&](){ 
      server->start(localport);
    });

    // Expose a synchronous native functions using the default serializer
    smartview.expose(
      "getRemotes", 
      [&localport](){
          // smartview.execute("console.log('EXEC FROM Cpp')");   
          return "http://localhost:" + std::to_string(localport);
      }
    );

    smartview.expose("add_ten", [&smartview](int i)
                                {
                                    smartview.execute("console.log('EXEC FROM Cpp')");
                                    return i + 10;
                                });

    // Inject code
    smartview.inject({
        .code = "console.log('Hello from Cpp')",
        .time = saucer::load_time::ready,
    });

    smartview.embed(saucer::embedded::all());
    smartview.serve("index.html");
    
    smartview.show();
    app->run(); // enter run loop

    server->stop();
    t->join();
    

    return 0;
}