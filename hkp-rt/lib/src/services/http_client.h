#pragma once

#include <boost/beast/http.hpp>

#include <iostream>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

/**
 * Service Documentation
 * Service ID: http-client
 * Service Name: HttpClient
 * Runtime: hkp-rt
 * Modes: unspecified
 * Key Config: runtime-specific state/config
 * IO: in=runtime-dependent -> out=runtime-dependent
 * Arrays: service-dependent
 * Binary: supported (service-dependent)
 * MixedData: native in runtime (service-dependent usage)
 */
namespace hkp {

struct HttpClientImpl;

/**
 * The method a request goes out with: what the input says, else what the board
 * configured, else GET.
 *
 * The same precedence `url`, `headers` and `body` follow. Free rather than a
 * member so it can be checked without making a request: reading only the input
 * meant a configured method was stored and reported but never used, and every
 * request went out as GET — taking the body with it, since a body is only
 * attached to a POST or a PUT.
 */
inline std::string chooseRequestMethod(const nlohmann::json& j,
                                       const std::string& configured)
{
  auto method = j.value("method", configured);
  return method.empty() ? std::string("get") : method;
}

class HttpClient : public Service 
{
public:
  static std::string serviceId() { return "http-client"; }

  HttpClient(const std::string& instanceId);
  ~HttpClient();

  json configure(Data data) override;
  std::string getServiceId() const override;
  json getState() const override;
  // The request both transports send; see the definition for why it is shared.
  boost::beast::http::request<boost::beast::http::string_body> buildRequest(
      const std::string& method, const std::string& path,
      const std::string& query, const std::string& host, int version,
      const nlohmann::json& j);

  Data process(Data data) override;

private:
  std::unique_ptr<HttpClientImpl> m_impl;
};

}
