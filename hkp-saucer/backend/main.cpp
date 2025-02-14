#include <saucer/smartview.hpp>

#include "embedded/all.hpp"

int main()
{
    auto app = saucer::application::init({     
        .id = "Hookitapp",                   
    });

    saucer::smartview smartview{{
        .application = app,
    }};

    smartview.set_title("HOOKITAPP"); 
    smartview.set_decorations(true);
    smartview.set_dev_tools(true);
    smartview.set_size(1024, 600);

    // Expose a synchronous native functions using the default serializer
    smartview.expose("add_ten", [&smartview](int i)
                                {
                                    smartview.execute("console.log('EXEC FROM Cpp')");
                                    return i + 10;
                                });

    // Inject code
    smartview.inject({
        .code = "console.log('Hello from Hookitapp!');",
        .time = saucer::load_time::ready,
    });

    smartview.embed(saucer::embedded::all());
    smartview.serve("index.html");
    
    smartview.show();
    app->run(); // enter run loop

    return 0;
}