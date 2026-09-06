#pragma once

#include <functional>
#include <memory>
#include <string>

#include <types/data.h>
#include <types/message.h>

#include <log_entry.h>

#include <secrets.h>

namespace hkp {

class Service;
class SubRuntime;

// RuntimeHost — abstract interface through which a Service interacts with its
// containing runtime.  Both Runtime (the top-level pipeline) and SubRuntime
// (a nested pipeline) implement this interface, enabling unlimited nesting:
//
//   Runtime (RuntimeHost)
//     └─ ServiceA
//     └─ SubService (owns SubRuntime)
//          └─ SubRuntime (RuntimeHost)
//               └─ ServiceB  ← can call next(), nextAsync(), createSubRuntime()
//               └─ AnotherSubService (owns a deeper SubRuntime)
//                    └─ SubRuntime ...
//
// This replaces the earlier SubPipeline spike, which did not allow next() to
// be called inside the nested pipeline.
class RuntimeHost
{
public:
  virtual ~RuntimeHost() = default;

  // Drive the pipeline from `svc` onward (skipping `svc` itself when
  // advanceBefore=true, which is the next() / nextAsync() case).
  virtual Data processFrom(const Service& svc, Data data,
                           bool advanceBefore = true,
                           std::function<void(Data)> callback = nullptr) = 0;

  // Schedule processFrom to run on the host's event loop (non-blocking).
  virtual void scheduleProcessFrom(const Service& svc, Data data,
                                   bool advanceBefore = true) = 0;

  // True if `svc` belongs to this host's immediate service list.
  virtual bool isConnected(const Service& svc) const = 0;

  // Send data / notification upstream (toward the board / WebSocket layer).
  virtual void sendData(Data data, MessagePurpose purpose,
                        const std::string& sender,
                        std::function<void(Data)> callback = nullptr) = 0;

  // Record something about the run in progress. Unlike a notification, which
  // exists for whoever is watching and may be dropped when nobody is, an entry
  // has to survive with nobody attached — a board running unwatched is exactly
  // the case a log is for.
  virtual void log(const Service& svc, LogLevel level, const std::string& event,
                   const nlohmann::json& data = nullptr) = 0;

  // Pass an entry a nested pipeline produced outward, unchanged. Distinct from
  // log() because the entry already names its own run and service: re-deriving
  // those here would relabel work done inside a sub-pipeline as the work of the
  // service hosting it, which is the nesting the entry exists to record.
  virtual void forwardLog(const LogEntry& entry) = 0;

  // Close the process lifecycle bracket for `svc` (send "call-process-finished"
  // with `data`).  Called by Service::emit when deferred async work completes,
  // so a host that surfaces a per-service processing indicator can bracket the
  // real duration.  Hosts without such an indicator may ignore it.
  virtual void notifyProcessFinished(const Service& svc, const Data& data) = 0;

  // The runtime's secrets, for a service that has a credential to send.
  //
  // A service holds the reference it was configured with and asks here for the
  // value, naming where it is about to send it. What comes back is used and
  // dropped: assigning it to state would put it back on the path a board is
  // saved from, which is the whole thing this arrangement exists to prevent.
  //
  // A nested pipeline answers with the secrets of the runtime around it. It is
  // provisioned by nobody — no create payload reaches it — so its own would
  // always be empty, and a credential service could only ever be used at the
  // top level.
  virtual SecretVault& secrets() = 0;

  // Instantiate a new SubRuntime from a JSON array of service-config objects.
  // ownerInParent is the service in this host that owns the new SubRuntime.
  virtual std::shared_ptr<SubRuntime> createSubRuntime(
      const Service& ownerInParent,
      const json& servicesConfig) = 0;
};

} // namespace hkp
