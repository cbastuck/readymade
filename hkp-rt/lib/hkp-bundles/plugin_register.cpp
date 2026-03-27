#include "registry.h"
#include "../src/services/ffmpeg/ffmpeg.h"

// This function will be called by the host application to register services
extern "C" void hkp_register_plugin(hkp::Registry* registry)
{
    // Register the Ffmpeg service from this plugin
    registry->registerService<hkp::Ffmpeg>();
}
// This fuction will be called by the host application to introspect the plugin
extern "C" const char* hkp_plugin_info()
{
    return R"({"type": "bundle", "services": ["ffmpeg"]})";
}
