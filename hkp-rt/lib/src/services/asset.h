#pragma once

#include <string>

#include <types/types.h>
#include <service.h>
#include <types/data.h>
#include <assets.h>

// For the host's assets(): Service forward-declares RuntimeHost, and reaching a
// member of it needs the definition.
#include "../runtime_host.h"

/**
 * Service Documentation
 * Service ID: asset
 * Service Name: Asset
 * Runtime: hkp-rt
 * Modes: none
 * Key Config: asset (an `hkp-asset://<id>` reference)
 * IO: in=anything, or a reference naming another asset -> out={meta, body}
 *     for text, MixedData {meta, binary} otherwise
 * Arrays: not primary
 * Binary: an asset that is not text leaves as bytes
 * MixedData: the output for binary assets
 *
 * Puts one of the board's assets into the pipeline, for any service that has no
 * way of its own to take one. A service that serves, plays or loads content
 * resolves a reference itself; everything else composes with this.
 *
 * The asset is resolved on every pass, from the runtime's asset store, so
 * editing it changes what the next pass carries without anything being
 * reconfigured.
 *
 * The input can name the asset: a bare `hkp-asset://…` string, or an object
 * whose `asset` field is one, takes the place of the configured reference for
 * that pass. Any other input only triggers the pass.
 *
 * The answer is shaped like an HTTP response (`meta` with `status` and
 * `contentType`), so an endpoint can hand it straight back. An asset that does
 * not resolve is answered with an error status and reported, never passed on as
 * its reference.
 *
 * Mirrors hkp-node's and hkp-python's `asset`.
 */
namespace hkp {

class Asset : public Service
{
public:
  static std::string serviceId() { return "asset"; }

  Asset(const std::string& instanceId)
    : Service(instanceId, serviceId())
  {
  }

  std::string getServiceId() const override
  {
    return serviceId();
  }

  json configure(Data data) override
  {
    if (auto j = getJSONFromData(data); j && j->contains("asset") && (*j)["asset"].is_string())
    {
      m_asset = trim((*j)["asset"].get<std::string>());
    }
    return Service::configure(data);
  }

  json getState() const override
  {
    return Service::mergeStateWith(assetState());
  }

  Data process(Data data) override
  {
    auto reference = requestedReference(data);
    if (reference.empty())
    {
      reference = m_asset;
    }
    if (reference.empty())
    {
      return fail(400, "no asset is configured");
    }
    if (!parseAssetRef(reference))
    {
      return fail(400, "\"" + reference + "\" is not an asset reference");
    }
    auto* host = parentHost();
    auto* store = host ? host->assets() : nullptr;
    if (!store)
    {
      return fail(500, "this runtime has no assets");
    }

    auto resolution = store->resolve(reference);
    if (!resolution.asset)
    {
      return fail(404, resolution.problem);
    }

    const auto& asset = *resolution.asset;
    m_error.clear();
    m_mediaType = asset.mediaType;
    m_size = asset.content.size();
    sendNotification(assetState());

    json meta = {
      { "status", 200 },
      { "contentType", asset.mediaType },
      { "asset", asset.id },
      { "size", asset.content.size() },
    };
    if (isTextMediaType(asset.mediaType))
    {
      return Data(json{ { "meta", meta }, { "body", asset.content } });
    }
    MixedData mixed;
    mixed.meta = meta;
    mixed.binary.assign(asset.content.begin(), asset.content.end());
    return Data(mixed);
  }

private:
  json assetState() const
  {
    return json{
      { "asset", m_asset },
      { "mediaType", m_mediaType },
      { "size", m_size },
      { "error", m_error },
    };
  }

  Data fail(int status, const std::string& message)
  {
    m_error = message;
    sendNotification(assetState());
    return Data(json{ { "meta", { { "status", status }, { "contentType", "application/json" } } },
                      { "body", { { "error", message } } } });
  }

  // The reference an input names, when it names one.
  static std::string requestedReference(const Data& data)
  {
    if (auto str = getStringFromData(data))
    {
      const auto trimmed = trim(*str);
      return parseAssetRef(trimmed) ? trimmed : "";
    }
    auto j = getJSONFromData(data);
    if (!j)
    {
      return "";
    }
    if (j->is_string())
    {
      const auto trimmed = trim(j->get<std::string>());
      return parseAssetRef(trimmed) ? trimmed : "";
    }
    if (j->is_object() && j->contains("asset") && (*j)["asset"].is_string())
    {
      const auto trimmed = trim((*j)["asset"].get<std::string>());
      return parseAssetRef(trimmed) ? trimmed : "";
    }
    return "";
  }

  static std::string trim(std::string text)
  {
    text.erase(0, text.find_first_not_of(" \t\r\n"));
    text.erase(text.find_last_not_of(" \t\r\n") + 1);
    return text;
  }

  std::string m_asset;
  std::string m_mediaType;
  std::size_t m_size = 0;
  std::string m_error;
};

} // namespace hkp
