#pragma once

#include <functional>
#include <memory>
#include <string>

#include <types/data.h>
#include <types/message.h>

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

  // Instantiate a new SubRuntime from a JSON array of service-config objects.
  // ownerInParent is the service in this host that owns the new SubRuntime.
  virtual std::shared_ptr<SubRuntime> createSubRuntime(
      const Service& ownerInParent,
      const json& servicesConfig) = 0;
};

} // namespace hkp
