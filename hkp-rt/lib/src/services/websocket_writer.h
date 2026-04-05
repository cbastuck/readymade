#pragma once

#include <thread>

#include <types/types.h>
#include <service.h>
#include <common/websocket_config.h>

#include "./writer_session.h"

/**
 * Service Documentation
 * Service ID: websocket_writer
 * Service Name: WebsocketWriter
 * Runtime: hkp-rt
 * Modes: unspecified
 * Key Config: runtime-specific state/config
 * IO: in=runtime-dependent -> out=runtime-dependent
 * Arrays: service-dependent
 * Binary: supported (service-dependent)
 * MixedData: native in runtime (service-dependent usage)
 */
namespace hkp {

class WebsocketWriter : public Service
{
public:
  static std::string serviceId();
  
  WebsocketWriter(const std::string& instanceId);
  ~WebsocketWriter();

  void start();
  void stop();

  json configure(Data data) override;
  bool onBypassChanged(bool bypass) override;
  Data process(Data data) override;

  std::string getServiceId() const override;
  json getState() const override;

private:
  void run();

private:
  net::io_context m_ioc;
  std::shared_ptr<WriterSession> m_session;
  std::thread m_t;

  WebsocketConfig m_config;
};

}
