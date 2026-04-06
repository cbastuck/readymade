#pragma once

#include <iostream>
#include <mutex>
#include <map>
#include <vector>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

/**
 * Service Documentation
 * Service ID: http-server
 * Service Name: HttpServer
 * Runtime: hkp-rt
 * Modes: unspecified
 * Key Config: runtime-specific state/config
 * IO: in=runtime-dependent -> out=runtime-dependent
 * Arrays: service-dependent
 * Binary: supported (service-dependent)
 * MixedData: native in runtime (service-dependent usage)
 */
namespace hkp {

class Session;
class HttpServerImpl;

class HttpServer : public Service 
{
public:
  static std::string serviceId() { return "http-server"; }

  HttpServer(const std::string& instanceId);
  ~HttpServer();

  json configure(Data data) override;
  std::string getServiceId() const override;
  json getState() const override;
  Data process(Data data) override;

protected:
  bool onBypassChanged(bool bypass) override;

  void onNewSession(std::shared_ptr<Session> session, const std::string& path, const std::string& method, bool awaitResponse = true);

private:  
  bool start();
  bool stop();

private:
  // Accumulates chunks for a single in-flight chunked upload.
  struct ChunkAssembly
  {
    std::vector<std::string> chunks; // indexed by chunkIndex
    int receivedCount = 0;
    int totalChunks   = 0;
    std::string filename;
    std::string contentType;
    std::string requestPath;
  };

private:
  std::shared_ptr<HttpServerImpl> m_impl;
  std::string m_mode;

  std::mutex m_assemblyMutex;
  std::map<std::string, ChunkAssembly> m_assemblies; // keyed by X-Upload-Id
};

}
