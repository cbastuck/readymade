#pragma once

#include <string>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

// For the host's slots(): Service forward-declares RuntimeHost, and reaching a
// member of it needs the definition.
#include "../runtime_host.h"

/**
 * Service Documentation
 * Service ID: hold
 * Service Name: Hold
 * Runtime: hkp-rt
 * Modes: none — either a slot with a declared role, or a property that discriminates
 * Key Config: slot + op, or property
 * IO: in=anything -> out=the held value, or Null while nothing is held
 * Arrays: an array carries no property, so it reads
 * Binary: holdable in a slot; a property cannot discriminate on one
 * MixedData: same
 *
 * Sample-and-hold: a pipeline entered from two sides — a producer that runs on
 * its own schedule and a consumer that arrives whenever it arrives — needs the
 * producer's latest value to survive between runs. Hold keeps it.
 *
 * **Which side is calling can be said two ways**, and a board picks one.
 *
 * With a `slot`, the board says outright: `op` is `write` or `read`, and two
 * Holds naming one slot are the two ends of it. Nothing inspects the value, so
 * anything can be held — bytes, a ring buffer, a document — and the two ends
 * may sit in pipelines that never meet, which is what an endpoint's separate
 * entry points are. Where the cells live is the host's to decide
 * (RuntimeHost::slots): the service owning both pipelines, or the runtime.
 *
 * With a `property` and no slot, the input says: an input carrying that
 * property is the producer, its value replaces what is held, and every call —
 * that one included — emits the held value under the same property name, so the
 * services after Hold cannot tell the two sides apart. That is the older
 * arrangement, and the only one available where the two sides share one
 * pipeline, since there is nothing but the value to tell them apart. A null
 * held value is an empty one, so a producer cannot hold null.
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

      if (j->contains("slot") && (*j)["slot"].is_string())
      {
        const std::string slot = (*j)["slot"].get<std::string>();
        if (slot != m_slot)
        {
          // A slot is an address, and what was held belongs to the old one —
          // but it belongs to whoever else is still reading it, so only this
          // service's own cell is cleared, never the host's.
          m_own = Data();
          m_readCount = 0;
          m_writeCount = 0;
        }
        m_slot = slot;
      }

      if (j->contains("op") && (*j)["op"].is_string())
      {
        const std::string op = (*j)["op"].get<std::string>();
        if (op == "read" || op == "write")
        {
          m_op = op;
        }
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
    if (!m_slot.empty())
    {
      return useSlot(data);
    }

    // Nothing named is nothing to hold: an unconfigured Hold is a wire.
    if (m_property.empty())
    {
      return data;
    }

    if (const auto incoming = carriedValue(data); !incoming.is_null())
    {
      write(Data(incoming));
      ++m_writeCount;
    }
    else
    {
      ++m_readCount;
    }

    sendNotification(holdState());

    const auto held = getJSONFromData(read());
    if (!held || held->is_null())
    {
      return Null();
    }

    return Data(json{ { m_property, *held } });
  }

private:
  /**
   * A call on a Hold whose role is declared rather than inferred.
   *
   * A write emits **its input unchanged**, so the pass it belongs to carries on
   * as though the Hold were not there; a read emits what is held, **raw**, so
   * it can be the whole of what a pipeline answers with. Neither looks at the
   * value, which is what lets a slot hold what a property never could.
   */
  Data useSlot(Data data)
  {
    if (m_op == "write")
    {
      write(data);
      ++m_writeCount;
      sendNotification(holdState());
      return data;
    }

    ++m_readCount;
    sendNotification(holdState());
    const auto held = read();
    // Nothing held is nothing to pass on, the same as everywhere else — a
    // consumer that arrives before the producer has run stops here.
    if (isUndefined(held))
    {
      return Null();
    }
    return held;
  }

  /** What is held, from wherever this Hold holds it. */
  Data read() const
  {
    if (m_slot.empty())
    {
      return m_own;
    }
    auto* host = parentHost();
    return host ? host->slots().get(m_slot) : m_own;
  }

  void write(Data value)
  {
    auto* host = m_slot.empty() ? nullptr : parentHost();
    if (host)
    {
      host->slots().set(m_slot, std::move(value));
      return;
    }
    // No store to share through — a Hold outside any host that provides one
    // still holds, for itself alone, rather than dropping what it was given.
    m_own = std::move(value);
  }

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
    m_own = Data();
    if (!m_slot.empty())
    {
      if (auto* host = parentHost())
      {
        host->slots().set(m_slot, Data());
      }
    }
    m_readCount = 0;
    m_writeCount = 0;
  }

  json holdState() const
  {
    // Only the arrangement in use is reported. A state property a service does
    // not act on is one a board keeps and a reader has to discount, and an
    // omitted one is erased from the board the next time it is saved.
    json state = m_slot.empty()
      ? json{ { "property", m_property } }
      : json{ { "slot", m_slot }, { "op", m_op } };
    state["held"] = reportable(read());
    state["readCount"] = m_readCount;
    state["writeCount"] = m_writeCount;
    return state;
  }

  /**
   * What is held, as something safe to put in state.
   *
   * State is read back into the board and sent to everyone watching, so what a
   * Hold reports has to be worth carrying. A value that is bytes, or simply
   * large — a rendered document, an audio buffer — is described instead of
   * copied: the size is what a reader is looking for at that point, and the
   * value itself is on its way to whatever asked for it regardless.
   */
  static json reportable(const Data& value)
  {
    if (isUndefined(value) || isNull(value))
    {
      return json();
    }
    if (const auto bytes = getBinaryFromData(value))
    {
      return "[" + std::to_string(bytes->size()) + " bytes]";
    }
    const auto asJson = getJSONFromData(value);
    if (!asJson)
    {
      return "[" + stringify(value) + "]";
    }
    const auto dumped = asJson->dump();
    if (dumped.size() > kReportableLimit)
    {
      return "[" + std::to_string(dumped.size()) + " characters]";
    }
    return *asJson;
  }

  // Beyond this, what is held is described rather than sent.
  static constexpr size_t kReportableLimit = 2048;

  std::string m_property;
  std::string m_slot;
  std::string m_op = "read";
  // What is held when no slot names somewhere else to hold it.
  Data m_own;
  int m_readCount = 0;
  int m_writeCount = 0;
};

}
