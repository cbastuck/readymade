#pragma once

#include <algorithm>
#include <map>
#include <string>

#include <optional>
#include <vector>

#include <iostream>
#include <vector>

#include <types/types.h>
#include <service.h>
#include <types/data.h>
#include <slot_store.h>

#include "../../sub_runtime.h"

/**
 * Service Documentation
 * Service ID: http-server-subservices
 * Service Name: HttpServerSubservices
 * Runtime: hkp-rt
 * Modes: none — the entry points a board declares say what it is for
 * Key Config: host/port/onProcess/onRequest
 * IO: in=request envelope -> out=response envelope
 * Arrays: not primary
 * Binary: depends on endpoint + nested services
 * MixedData: native in runtime (service-dependent usage)
 *
 * **There are two ways in, and a board names the ones it uses.** `onRequest` is
 * a caller arriving; `onProcess` is a pass of the board's own chain. Each is a
 * pipeline of its own, because they are different jobs:
 *
 *     { "onRequest": [ … ] }                      requests; a pass goes through
 *     { "onProcess": [ … ] }                      passes; the board answers
 *     { "onProcess": [ … ], "onRequest": [ … ] }  both, separately
 *     { "pipeline":  [ … ] }                      one pipeline, entered from both
 *
 * **Declaring `onRequest` is what takes the answer away from the chain.** With
 * one, that pipeline is the handler and what it returns is what the caller
 * gets; the services after this one still run — that is where a board acts on
 * having served a request — but after the answer is decided. Without one, the
 * request flows into the services after this one and whatever they return is
 * the answer, which is the inversion of control this service is built around.
 *
 * So an endpoint can have something to run on a pass without silently becoming
 * an HTTP handler, which is what a single unnamed pipeline could not express:
 * having one at all decided who answered.
 *
 * **A value does not survive between the two on its own.** They are separate
 * pipelines, and a pass ends where it ends — so an endpoint that publishes what
 * the board last handed it holds that value in a slot (see `hold`), in cells
 * this service owns and lends to both of its pipelines. Legacy boards say the
 * same thing as `mode: "process_on_data"`, which is this arrangement built in
 * and unnamed; `entryFor` is where the older spellings are read.
 */
namespace hkp {

class Session;
class HttpServerImpl;

// The headers a pipeline is shown, out of the ones a request carried.
//
// `forward` unset forwards everything, which is what a board that has not
// thought about it gets; a list forwards only what it names, and an empty list
// forwards none. Names are compared lower-cased, as HTTP header names compare.
//
// Free rather than a member so the decision can be checked without standing up
// a server and making a request to it.
inline nlohmann::json filterRequestHeaders(
    const std::map<std::string, std::string>& carried,
    const std::optional<std::vector<std::string>>& forward)
{
  nlohmann::json headers = nlohmann::json::object();
  for (const auto& [name, value] : carried)
  {
    if (forward && std::find(forward->begin(), forward->end(), name) == forward->end())
    {
      continue;
    }
    headers[name] = value;
  }
  return headers;
}

// The two ways into this service, named.
//
// `onProcess` is a pass of the board's own chain arriving; `onRequest` is a
// caller. They are declared as separate pipelines because they are separate
// jobs — which is what the `mode` flag was standing in for, badly: one unnamed
// list could not say what it was for, so a flag beside it had to.
enum class HttpEntry
{
  kOnProcess,
  kOnRequest
};

class HttpServerSubservices : public Service
{
public:
  static std::string serviceId() { return "http-server-subservices"; }
  static std::vector<std::string> capabilities() { return {"subservices"}; }

  explicit HttpServerSubservices(const std::string& instanceId);
  ~HttpServerSubservices();

  json configure(Data data) override;
  std::string getServiceId() const override;
  json getState() const override;
  Data process(Data data) override;

protected:
  bool supportsSubservices() const override { return true; }
  bool onBypassChanged(bool bypass) override;

  void onNewSession(std::shared_ptr<Session> session,
                    const std::string& path,
                    const std::string& method,
                    bool awaitResponse = true);

private:
  // One pipeline this endpoint owns: what a board declared for it, and what is
  // running. Held together because a rebuild reads one to make the other.
  struct Pipeline
  {
    std::vector<json> config;
    std::shared_ptr<SubRuntime> runtime;
  };

  bool start();
  bool stop();
  void syncSubserviceStates(Pipeline& pipeline);
  void rebuildSubservices(Pipeline& pipeline);
  // The four edit verbs, applied to whichever pipeline was named.
  void editPipeline(Pipeline& pipeline, const json& payload);
  Pipeline& entryPipeline(HttpEntry entry);
  // The pipeline one side enters through, or null where that side has none.
  std::shared_ptr<SubRuntime> entryFor(HttpEntry entry) const;
  static json pipelineState(const Pipeline& pipeline);

private:
  std::shared_ptr<HttpServerImpl> m_impl;
  // How a board that predates named entry points says which side enters the one
  // pipeline it declares. Still accepted; entryFor is the whole of what it
  // means now.
  std::string m_mode;
  // Which way the board declared its pipelines. State reports what was
  // declared, never a canonical form.
  bool m_named = false;
  // Which of a request's headers the pipeline is shown; unset forwards all.
  //
  // Headers are where a caller puts a credential, and `meta` goes wherever the
  // pipeline takes it — including into a board, if a service is wired to write
  // it there. Naming the ones a board actually reads is how it stops carrying
  // the ones it does not: an empty list forwards none, and no list at all
  // forwards everything, which is what a board that has not thought about it
  // gets.
  std::optional<std::vector<std::string>> m_forwardHeaders;
  // The one pipeline a legacy board declares, entered from whichever side its
  // `mode` says.
  Pipeline m_legacy;
  Pipeline m_onProcess;
  Pipeline m_onRequest;
  // The cells this endpoint's pipelines hold values in.
  //
  // Owned here because the two entry points are pipelines that never meet: a
  // value one of them produces has nowhere to live until the other runs. One
  // store per endpoint is also what keeps the names in it private, so two
  // endpoints on a runtime may both call a slot `document`.
  SlotStore m_slots;
  // Reachable LAN address of the running server, published so facade widgets
  // (QR code / status) can present a scannable link. Empty while stopped.
  std::string m_host;
  std::string m_url;
};

} // namespace hkp