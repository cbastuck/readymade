#pragma once

#include <types/types.h>

namespace hkp {

class Runtime;
class SubRuntime;
class RuntimeHost;

class Service
{
public:
  Service(const std::string& instanceName = "");
  Service(const std::string& instanceId, const std::string& instanceName);
  virtual json configure(Data data);
  virtual json getState() const;

  Data startProcess(const Data& data = Undefined());

  // Attach this service to a host (Runtime or SubRuntime).
  // setParentRuntime is a convenience overload kept for backward compatibility.
  void setParentHost(RuntimeHost& host);
  void setParentRuntime(Runtime& runtime);

  Data next(Data data = Undefined(), bool immediately = true);
  void nextAsync(Data data = Undefined(), std::function<void(Data)> callback = nullptr);
  bool isConnected() const;

  // ── Sub-runtime support ──────────────────────────────────────────────────
  // Create a nested pipeline from a JSON array of service configs.
  // Services are instantiated via the parent runtime's registry and parented
  // to the new SubRuntime so that next() / nextAsync() work inside it.
  // See sub_runtime.h for the config schema and usage.
  //
  //   // configure():
  //   m_pipeline = createSubRuntime((*j)["pipeline"]);
  //
  //   // process():
  //   return m_pipeline->process(data);
  //
  std::shared_ptr<SubRuntime> createSubRuntime(const json& servicesConfig);

  // ── Multi-emit support ───────────────────────────────────────────────────
  // Push a partial result through the rest of the outer pipeline without
  // ending the current process() call.  Thread-safe — posts via the App's
  // io_context, so it can also be called from a background thread.
  // Equivalent to nextAsync() but communicates intent: this service produces
  // more than one output for a single input.  emit() also closes the process
  // lifecycle bracket for this service (sends "call-process-finished" with the
  // result), so a service that deferCompletion()'d has its processing indicator
  // reflect the true end of the async work rather than the instant return.
  void emit(Data partialResult);

  // Runtime-facing: returns true (and resets) if the most recent process() call
  // deferred its completion via deferCompletion().  The runtime uses this to
  // withhold the synchronous "call-process-finished" for that call — emit()
  // sends it later, when the deferred work actually finishes.
  bool takeProcessDeferred();

  inline const std::string &getId() const { return m_instanceId; }
  inline const std::string &getName() const { return m_instanceName; }
  virtual std::string getServiceId() const = 0;

  // Inputs are a static property of a service, and are not supposed to change through lifetime.
  // Usually services don't provide additional inputs, examples that do are websocket_server_service.h,
  // or in general any "-T-shaped" service.
  virtual std::vector<ExternalServiceInput> getExternalInputs() const;

  virtual Data process(Data data = Undefined()) = 0;

protected:
  virtual bool supportsSubservices() const;
  virtual bool onBypassChanged(bool bypass);
  json& mergeBypassState(json &state) const;
  void sendNotification(const Data& params) const;
  void setBypass(bool bypass);
  bool isBypass() const;

  // Call from process() (as the return value) when the real output will be
  // produced later via emit() on a worker thread.  Returns Null() to stop the
  // synchronous push and marks the call deferred so the runtime withholds the
  // "call-process-finished" lifecycle event until emit() actually delivers.
  Data deferCompletion();

  json mergeStateWith(const json& update) const
  {
    auto state = Service::getState();
    state.update(update);
    return state;
  }

private:
  RuntimeHost* m_host = nullptr;
  // Set by deferCompletion(), consumed by the runtime's processFrom right after
  // process() returns — both on the pipeline thread, so a plain bool is enough
  // (emit(), which runs on the worker, never touches it).
  bool m_processDeferred = false;

protected:
  std::string m_instanceName;
  std::string m_instanceId;
  std::optional<bool> m_bypass;
};

}
