#pragma once

#include <array>
#include <functional>
#include <list>
#include <memory>
#include <string>

#include "runtime_host.h"

namespace hkp {

class Service;

// SubRuntime — a fully functional nested pipeline that implements RuntimeHost.
//
// SubRuntimes nest arbitrarily deep: a service inside a SubRuntime can call 
// createSubRuntime() to get a deeper SubRuntime backed by the same factory 
// and event-loop post function.
//
// sendData() is forwarded to the parent RuntimeHost so notifications still
// propagate to the board / WebSocket layer.
//
// Typical usage inside a Service subclass:
//
//   // configure():
//   m_pipeline = createSubRuntime((*j)["pipeline"]);
//
//   // process():
//   return m_pipeline->process(data);
//
// For selective entry-point control:
//
//   // Start from the second service in the sub-runtime:
//   auto it = std::next(m_pipeline->begin());
//   return m_pipeline->processFrom(**it, data, /*advanceBefore=*/false);
//
class SubRuntime : public RuntimeHost
{
public:
  // ServiceFactory: creates a Service by (serviceId, instanceId).  Typically
  // a lambda wrapping App::createService().
  using ServiceFactory = std::function<std::shared_ptr<Service>(
      const std::string& serviceId, const std::string& instanceId)>;

  // PostFn: posts a callable onto the event loop (e.g. App::postCallback).
  using PostFn = std::function<void(std::function<void()>)>;

  SubRuntime(RuntimeHost& parent, const Service* ownerInParent,
             ServiceFactory factory, PostFn post);
  ~SubRuntime();

  // Populate from a JSON array of service-config objects (same schema as a
  // Runtime service list).  Called internally by createSubRuntime().
  void populate(const json& servicesConfig);

  // Drive data through all services from the front.  Stops on Null or
  // EarlyReturn (EarlyReturn is unwrapped before returning).
  Data process(Data data);

  // ── RuntimeHost ──────────────────────────────────────────────────────────
  void log(const Service& svc, LogLevel level, const std::string& event,
           const nlohmann::json& data = nullptr) override;
  void forwardLog(const LogEntry& entry) override;
  Data processFrom(const Service& svc, Data data,
                   bool advanceBefore = true,
                   std::function<void(Data)> callback = nullptr) override;
  void scheduleProcessFrom(const Service& svc, Data data,
                           bool advanceBefore = true) override;
  bool isConnected(const Service& svc) const override;
  void sendData(Data data, MessagePurpose purpose,
                const std::string& sender,
                std::function<void(Data)> callback = nullptr) override;
  void notifyProcessFinished(const Service& svc, const Data& data) override;
  // Straight out to the runtime around this one: nothing provisions a nested
  // pipeline, so its own vault would always be empty. Asked for each time
  // rather than copied, so a value pushed after a board is running reaches a
  // nested service as immediately as a top-level one, and so that nesting
  // composes to whichever runtime was actually given something.
  SecretVault& secrets() override { return m_parent.secrets(); }

  // The cells this pipeline holds values in: the ones the service owning it
  // lent it, and otherwise the ones around it.
  //
  // A service with two pipelines that must hold something between them lends
  // both the same store; one with nothing to share lends none, and a slot
  // named inside it then means what the same name means outside — so nesting
  // never isolates what is inside it by accident.
  SlotStore& slots() override
  {
    return m_slots ? *m_slots : m_parent.slots();
  }

  // Hold values here rather than in the runtime around this one. Called by the
  // service that owns this pipeline, and one other, before either runs.
  void shareSlots(SlotStore& store) { m_slots = &store; }

  // Whether what this pipeline produces on its own leaves the service holding
  // it.
  //
  // The second route out, and the one a scope would otherwise leak through: a
  // nested service that emits without being called — a Timer tick, a deferred
  // result — bubbles out through the owner and drives the services after it.
  // The owner returning Null from process() does not cover that, which is why
  // stopping propagation has to be said here too.
  void setStopPropagation(bool stop) { m_stopPropagation = stop; }

  // One of the services here, by the name it carries — for a scoped address.
  std::shared_ptr<Service> find(const std::string& instanceId) const;
  std::shared_ptr<SubRuntime> createSubRuntime(const Service& ownerInParent,
                                               const json& servicesConfig) override;

  // ── Inspection ─────────────────────────────────────────────────────────────
  using ServiceList = std::list<std::shared_ptr<Service>>;
  ServiceList::const_iterator begin() const { return m_services.cbegin(); }
  ServiceList::const_iterator end()   const { return m_services.cend(); }

  size_t size()  const { return m_services.size(); }
  bool   empty() const { return m_services.empty(); }

private:
  ServiceList::const_iterator findServiceById(const std::string& id) const;
  void processScheduled();

  RuntimeHost& m_parent;
  // See shareSlots. Null means the cells of the runtime around this one.
  SlotStore* m_slots = nullptr;
  // See setStopPropagation.
  bool m_stopPropagation = false;
  const Service* m_ownerInParent = nullptr;
  ServiceFactory m_factory;
  PostFn         m_post;
  ServiceList    m_services;
  std::array<std::function<void()>, 100> m_scheduledProcesses;
};

} // namespace hkp
