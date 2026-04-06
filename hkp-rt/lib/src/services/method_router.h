#pragma once

#include <types/types.h>
#include <service.h>
#include <types/data.h>

/**
 * Service Documentation
 * Service ID: method-router
 * Service Name: Method Router
 * Runtime: hkp-rt
 * Key Config:
 *   htmlPage — HTML string served verbatim for GET requests (short-circuits the pipeline).
 * IO:
 *   in  = MixedData { meta: { method, requestPath, [path, contentType] }, binary }
 *   out = std::string (GET — HTML page)
 *       | passthrough MixedData (POST/PUT/PATCH — forwarded to next service)
 *       | json { error } (GET with no htmlPage configured)
 *
 * This service implements the middleware short-circuit pattern:
 *   GET  → returns makeEarlyReturn(htmlPage); the pipeline loop stops and the
 *           callback (if any) receives the HTML string directly.
 *   POST → returns data unchanged; the pipeline loop naturally continues to
 *           the next service (e.g. filesystem).
 *
 * Pair with http-server (upstream) and filesystem (downstream) for the AirDrop upload board.
 */
namespace hkp {

class MethodRouter : public Service
{
public:
  static std::string serviceId() { return "method-router"; }

  MethodRouter(const std::string& instanceId)
    : Service(instanceId, serviceId())
  {}

  std::string getServiceId() const override
  {
    return serviceId();
  }

  json configure(Data data) override
  {
    if (auto buf = getJSONFromData(data))
    {
      updateIfNeeded(m_htmlPage, (*buf)["htmlPage"]);
    }
    return Service::configure(data);
  }

  json getState() const override
  {
    return Service::mergeStateWith(json{{"htmlPage", m_htmlPage}});
  }

  Data process(Data data) override
  {
    auto mixed = getMixedDataFromData(data);

    // If upstream didn't send MixedData (unexpected), pass through unchanged.
    if (!mixed || !mixed->meta.contains("method"))
      return data;

    const auto method = mixed->meta["method"].get<std::string>();

    if (method == "GET" || method == "HEAD")
    {
      if (!m_htmlPage.empty())
        return makeEarlyReturn(Data(m_htmlPage)); // short-circuit; pipeline stops here
      return makeEarlyReturn(Data(json{{"error", "method-router: no htmlPage configured for GET"}}));
    }

    // POST, PUT, PATCH and anything else: return data unchanged so the pipeline
    // loop forwards it to the next service (e.g. filesystem) naturally.
    return data;
  }

private:
  std::string m_htmlPage;
};

} // namespace hkp
