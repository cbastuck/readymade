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
  Data processFrom(const Service& svc, Data data,
                   bool advanceBefore = true,
                   std::function<void(Data)> callback = nullptr) override;
  void scheduleProcessFrom(const Service& svc, Data data,
                           bool advanceBefore = true) override;
  bool isConnected(const Service& svc) const override;
  void sendData(Data data, MessagePurpose purpose,
                const std::string& sender,
                std::function<void(Data)> callback = nullptr) override;
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
  const Service* m_ownerInParent = nullptr;
  ServiceFactory m_factory;
  PostFn         m_post;
  ServiceList    m_services;
  std::array<std::function<void()>, 100> m_scheduledProcesses;
};

} // namespace hkp
