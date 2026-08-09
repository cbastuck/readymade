#pragma once

#include <string>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

/**
 * Service Documentation
 * Service ID: hold
 * Service Name: Hold
 * Runtime: hkp-rt
 * Modes: none — a call carrying the property writes, every call reads
 * Key Config: property
 * IO: in=JSON -> out={ property: held value }, or Null while nothing is held
 * Arrays: an array carries no property, so it reads
 * Binary: reads; holding non-JSON values is not supported yet
 * MixedData: same
 *
 * Sample-and-hold: a pipeline entered from two sides — a producer that runs on
 * its own schedule and a consumer that arrives whenever it arrives — needs the
 * producer's latest value to survive between runs. Hold keeps it.
 *
 * One property name is the whole configuration. An input carrying that property
 * is the producer, and its value replaces what is held. Every call, that one
 * included, then emits the held value under the same property name — so the
 * services after Hold receive the same shape whichever side called, and cannot
 * tell the two apart. That is the point: the ordered list itself cannot say
 * where a call came from, and with Hold in front of them nothing downstream
 * needs to.
 *
 * A null held value is an empty one, the way Null is nothing to pass on
 * everywhere else, so a producer cannot hold null: an input carrying the
 * property as null reads like any other.
 *
 * Mirrors hkp-node's and hkp-python's `hold`.
 */
namespace hkp {

class Hold : public Service
{
public:
  static std::string serviceId() { return "hold"; }

  Hold(const std::string& instanceId)
    : Service(instanceId, serviceId())
  {
  }

  std::string getServiceId() const override
  {
    return serviceId();
  }

  json configure(Data data) override
  {
    auto j = getJSONFromData(data);
    if (j)
    {
      if (j->contains("property") && (*j)["property"].is_string())
      {
        const std::string property = (*j)["property"].get<std::string>();
        if (property != m_property)
        {
          // What is held belongs to the property it was written for.
          forget();
        }
        m_property = property;
      }

      if (j->contains("action") && (*j)["action"] == "clear")
      {
        forget();
      }
    }

    sendNotification(holdState());
    return Service::configure(data);
  }

  json getState() const override
  {
    return Service::mergeStateWith(holdState());
  }

  // Bypass is handled by Service::startProcess, which passes the input straight
  // through without calling this at all.
  Data process(Data data) override
  {
    // Nothing named is nothing to hold: an unconfigured Hold is a wire.
    if (m_property.empty())
    {
      return data;
    }

    if (const auto incoming = carriedValue(data); !incoming.is_null())
    {
      m_held = incoming;
      ++m_writeCount;
    }
    else
    {
      ++m_readCount;
    }

    sendNotification(holdState());

    if (m_held.is_null())
    {
      return Null();
    }

    return Data(json{ { m_property, m_held } });
  }

private:
  /**
   * The value an input carries for the held property, if it carries one at all
   * — anything else makes the call a read rather than a write. A null value is
   * indistinguishable from an absent one on purpose: neither is something to
   * hold.
   */
  json carriedValue(const Data& data) const
  {
    const auto inputJson = getJSONFromData(data);
    if (!inputJson || !inputJson->is_object() || !inputJson->contains(m_property))
    {
      return json();
    }
    return (*inputJson)[m_property];
  }

  /**
   * Back to how the service started. The counts go with the value: they say how
   * often each side has called for what is held now, and left running across a
   * clear they would describe a value that is gone.
   */
  void forget()
  {
    m_held = json();
    m_readCount = 0;
    m_writeCount = 0;
  }

  json holdState() const
  {
    return json{
      { "property", m_property },
      { "held", m_held },
      { "readCount", m_readCount },
      { "writeCount", m_writeCount }
    };
  }

  std::string m_property;
  json m_held;
  int m_readCount = 0;
  int m_writeCount = 0;
};

}
