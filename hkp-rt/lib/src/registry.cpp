#include "registry.h"

#include <vector>
#include <iostream>

// Platform-specific dynamic library loading
#ifdef _WIN32
  // Nothing to include, handled in registry.cpp
#else
    #include <dlfcn.h>
#endif

#include "./services/websocket_writer.h"
#include "./services/websocket_reader.h"
#include "./services/websocket_server_service.h"
#include "./services/websocket_client_service.h"
#include "./services/monitor.h"
#include "./services/timer.h"
#include "./services/http_client.h"
#include "./services/http_server/http_server.h"
#include "./services/static.h"
#include "./services/cache.h"
#include "./services/buffer_service.h"
#include "./services/filter.h"
#include "./services/fft_service.h"
#include "./services/ifft_service.h"
#include "./services/transient_detector.h"
#include "./services/wav_reader.h"
#include "./services/filesystem.h"
#include "./services/map.h"

#if HKP_MP4_TO_WAV_ENABLED
  #include "./services/mp4_to_wav.h"
#endif

#if IS_MACOS
  #include "./services/core_input.h"
  #include "./services/core_output.h"
#endif

namespace hkp {
using ServiceTypes = Registry::TypeList<
   WebsocketWriter
  ,WebsocketReader
  ,WebsocketServerService
  ,WebsocketClientService
  ,Monitor
  ,Timer
  ,HttpClient
  ,HttpServer
  ,Static
  ,Cache
  ,FFTService
  ,IFFTService
  ,Buffer
  ,Filter
  ,TransientDetector
  ,WavReader
  ,Filesystem
  ,Map
#if HKP_MP4_TO_WAV_ENABLED
  ,Mp4ToWav
#endif
#if IS_MACOS
  ,CoreInput
  ,CoreOutput
#endif
>;


Registry::Registry()
{
  registerServices(ServiceTypes{});
}

Registry::~Registry()
{

}

std::shared_ptr<Service> Registry::create(std::string serviceId, std::string instanceId)
{
  for (auto& [id, factory] : m_serviceList)
  {
    if (id == serviceId)
    {
      return factory(serviceId, instanceId);
    }
  }
  return nullptr;
}

const std::vector<ServiceClass>& Registry::availableServices()
{
  if (m_availableServices.empty())
  {
    for (auto& [id, _] : m_serviceList)
    {
      m_availableServices.push_back(ServiceClass{id});
    }
  }
  return m_availableServices;
}

bool Registry::loadPlugin(const std::string& path)
{
  if (path.empty()) 
  {
    std::cerr << "Registry::loadPlugin: Empty path provided" << std::endl;
    return false;
  }

#ifdef _WIN32
  HMODULE handle = LoadLibraryA(path.c_str());
  if (!handle) 
  {
    std::cerr << "Registry::loadPlugin: Failed to load library: " << path 
              << " Error: " << GetLastError() << std::endl;
    return false;
  }
  
  // Look for the registration function
  typedef void (*RegisterFunc)(Registry*);
  RegisterFunc registerPlugin = (RegisterFunc)GetProcAddress(handle, "hkp_register_plugin");
  
  if (!registerPlugin) 
  {
    std::cerr << "Registry::loadPlugin: Could not find 'hkp_register_plugin' function in " 
              << path << " Error: " << GetLastError() << std::endl;
    FreeLibrary(handle);
    return false;
  }
#else
  void* handle = dlopen(path.c_str(), RTLD_NOW | RTLD_GLOBAL);
  if (!handle) 
  {
    std::cerr << "Registry::loadPlugin: Failed to load library: " << path 
              << " Error: " << dlerror() << std::endl;
    return false;
  }
  
  // Look for the hkp_plugin_info function
  typedef const char* (*InfoFunc)();
  InfoFunc pluginInfo = (InfoFunc)dlsym(handle, "hkp_plugin_info");
  if (pluginInfo) 
  {
    const char* info = pluginInfo();
    std::cout << "Plugin info: " << info << std::endl;
  }

  // parse the json if available
  json pluginJson;
  if (pluginInfo) 
  {
    const char* info = pluginInfo();
    try 
    {
      pluginJson = json::parse(info);
      std::cout << "Parsed plugin info JSON: " << pluginJson.dump(2) << std::endl;
    } 
    catch (const json::parse_error& e) 
    {
      std::cerr << "Failed to parse plugin info JSON: " << e.what() << std::endl;
    }
  }

  if (!pluginJson.contains("type") || !(pluginJson["type"] == "bundle")) 
  {
    std::cerr << "Registry::loadPlugin: Plugin is not of type 'bundle': " << path << std::endl;
    dlclose(handle);
    return false;
  }

  // Look for the registration function
  typedef void (*RegisterFunc)(Registry*);
  RegisterFunc registerPlugin = (RegisterFunc)dlsym(handle, "hkp_register_plugin");
  if (!registerPlugin) 
  {
    std::cerr << "Registry::loadPlugin: Could not find 'hkp_register_plugin' function in " 
              << path << " Error: " << dlerror() << std::endl;
    dlclose(handle);
    return false;
  }
#endif

  // Call the registration function with this registry instance
  registerPlugin(this);
  
  std::cout << "Registry::loadPlugin: Successfully loaded and registered plugin from " << path << std::endl;
  return true;
}

}
