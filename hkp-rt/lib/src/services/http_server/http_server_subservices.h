#pragma once

#include <algorithm>
#include <map>
#include <string>

#include <optional>
#include <vector>

#include <iostream>
#include <vector>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

#include "../../sub_runtime.h"

/**
 * Service Documentation
 * Service ID: http-server-subservices
 * Service Name: HttpServerSubservices
 * Runtime: hkp-rt
 * Modes: session pipeline hosting
 * Key Config: host/port/routes/subservices
 * IO: in=request envelope -> out=response envelope
 * Arrays: not primary
 * Binary: depends on endpoint + nested services
 * MixedData: native in runtime (service-dependent usage)
 */
namespace hkp {

class Session;
class HttpServerImpl;

// The headers a pipeline is shown, out of the ones a request carried.
//
// `forward` unset forwards everything, which is what a board that has not
// thought about it gets; a list forwards only what it names, and an empty list
// forwards none. Names are compared lower-cased, as HTTP header names compare.
//
// Free rather than a member so the decision can be checked without standing up
// a server and making a request to it.
inline nlohmann::json filterRequestHeaders(
    const std::map<std::string, std::string>& carried,
    const std::optional<std::vector<std::string>>& forward)
{
  nlohmann::json headers = nlohmann::json::object();
  for (const auto& [name, value] : carried)
  {
    if (forward && std::find(forward->begin(), forward->end(), name) == forward->end())
    {
      continue;
    }
    headers[name] = value;
  }
  return headers;
}

class HttpServerSubservices : public Service
{
public:
  static std::string serviceId() { return "http-server-subservices"; }
  static std::vector<std::string> capabilities() { return {"subservices"}; }

  explicit HttpServerSubservices(const std::string& instanceId);
  ~HttpServerSubservices();

  json configure(Data data) override;
  std::string getServiceId() const override;
  json getState() const override;
  Data process(Data data) override;

protected:
  bool supportsSubservices() const override { return true; }
  bool onBypassChanged(bool bypass) override;

  void onNewSession(std::shared_ptr<Session> session,
                    const std::string& path,
                    const std::string& method,
                    bool awaitResponse = true);

private:
  bool start();
  bool stop();
  void syncSubserviceStates();
  void rebuildSubservices();

private:
  std::shared_ptr<HttpServerImpl> m_impl;
  std::string m_mode;
  // Which of a request's headers the pipeline is shown; unset forwards all.
  //
  // Headers are where a caller puts a credential, and `meta` goes wherever the
  // pipeline takes it — including into a board, if a service is wired to write
  // it there. Naming the ones a board actually reads is how it stops carrying
  // the ones it does not: an empty list forwards none, and no list at all
  // forwards everything, which is what a board that has not thought about it
  // gets.
  std::optional<std::vector<std::string>> m_forwardHeaders;
  std::shared_ptr<SubRuntime> m_subservices;
  std::vector<json> m_subserviceConfig;
  // Reachable LAN address of the running server, published so facade widgets
  // (QR code / status) can present a scannable link. Empty while stopped.
  std::string m_host;
  std::string m_url;
};

} // namespace hkp