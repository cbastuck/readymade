#pragma once

#include <cstring>
#include <string>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

/**
 * Service Documentation
 * Service ID: injector
 * Service Name: Injector
 * Runtime: hkp-rt
 * Modes: unspecified
 * Key Config: inject, injectBinary, recentInjection, plainText
 * IO: in=any -> out=stored injection (or identity when nothing was injected)
 * Arrays: pass-through
 * Binary: supported (base64 via injectBinary)
 * MixedData: pass-through only
 */
namespace hkp {

class Injector : public Service
{
public:
  static std::string serviceId() { return "injector"; }

  Injector(const std::string& instanceId)
    : Service(instanceId, serviceId())
    , m_plainText(false)
  {
  }

  json configure(Data data) override
  {
    auto j = getJSONFromData(data);
    if (j)
    {
      if (j->contains("inject"))
      {
        setInjection(toData((*j)["inject"]));
        // emit (not nextAsync) so the injector reports its own output as a
        // "call-process-finished" lifecycle event — otherwise the flow started
        // from configure() never brackets the injector itself and its output
        // plug / flow inspector stays empty.
        emit(m_injection);
      }

      if (j->contains("injectBinary") && (*j)["injectBinary"].is_string())
      {
        setInjection(decodeBase64((*j)["injectBinary"].get<std::string>()));
        emit(m_injection);
      }

      if (j->contains("recentInjection"))
      {
        setInjection(toData((*j)["recentInjection"]));
      }

      if (j->contains("plainText") && updateIfNeeded(m_plainText, (*j)["plainText"]))
      {
        sendNotification(json{{"plainText", m_plainText}});
      }
    }
    return Service::configure(data);
  }

  std::string getServiceId() const override
  {
    return serviceId();
  }

  json getState() const override
  {
    return Service::mergeStateWith(injectionState());
  }

  Data process(Data data) override
  {
    if (isUndefined(m_injection))
    {
      return data;
    }
    return m_injection;
  }

private:
  // A JSON string is injected as text so that downstream services see a plain
  // string rather than a quoted JSON scalar; everything else stays JSON.
  static Data toData(const json& value)
  {
    if (value.is_string())
    {
      return value.get<std::string>();
    }
    return value;
  }

  void setInjection(Data injection)
  {
    m_injection = std::move(injection);
    sendNotification(injectionState());
  }

  // The stored injection as it is reported to the frontend. Binary payloads are
  // described by their size instead of being echoed back.
  json injectionState() const
  {
    json state = json{{"plainText", m_plainText}};
    if (auto text = getStringFromData(m_injection); text)
    {
      state["recentInjection"] = *text;
    }
    else if (auto binary = getBinaryFromData(m_injection); binary)
    {
      state["recentInjectionSize"] = binary->size();
    }
    else if (auto j = getJSONFromData(m_injection); j)
    {
      state["recentInjection"] = *j;
    }
    return state;
  }

  static BinaryData decodeBase64(const std::string& encoded)
  {
    static constexpr char kAlphabet[] =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    BinaryData decoded;
    decoded.reserve(encoded.size() * 3 / 4);

    uint32_t accumulator = 0;
    int bits = 0;
    for (char c : encoded)
    {
      if (c == '=')
      {
        break;
      }
      const char* pos = std::strchr(kAlphabet, c);
      if (!pos || c == '\0')
      {
        continue; // skip whitespace, line breaks and any other padding noise
      }
      accumulator = (accumulator << 6) | static_cast<uint32_t>(pos - kAlphabet);
      bits += 6;
      if (bits >= 8)
      {
        bits -= 8;
        decoded.push_back(static_cast<uint8_t>((accumulator >> bits) & 0xFF));
      }
    }
    return decoded;
  }

  Data m_injection;
  bool m_plainText;
};

}
