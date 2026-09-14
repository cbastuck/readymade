#include <catch2/catch_test_macros.hpp>

#include <memory>
#include <string>

#include <app.h>
#include <service.h>
#include <types/data.h>

using namespace hkp;

// ──────────────────────────────────────────────────────────────────────────────
// Running a runtime with nothing on its input.
//
// "Run" starts the pipeline with nothing, which is not the same as starting it
// with an empty object: a service that answers an empty input with its own
// configuration — http-client sends its configured body — behaves differently
// for the two, and `{}` is a payload a caller can also mean.
//
// JSON has no undefined, so a caller says it with `null` and this side turns it
// into Undefined. What is covered here is the socket, which is the transport an
// attached runtime uses. The REST entry point maps a null body the same way
// (`buildInputData` in lib/src/http/server.cpp) and is not covered here: crow
// does not start a second time inside one test binary, so a case needing a
// server passes alone and hangs after any case that has built an App.
//
// The same contract is pinned in every runtime:
// hkp-node/tests/server.test.ts, hkp-python/tests/test_server.py,
// hkp-go/graph/params_test.go, and hkp-frontend's browser and rest suites.
// ──────────────────────────────────────────────────────────────────────────────

namespace {

// Records what a run handed it. Static, because the App owns the instance and
// hands out no reference to it.
class CapturingService final : public Service {
public:
  explicit CapturingService(const std::string& instanceId)
    : Service(instanceId, serviceId()) {}

  static std::string serviceId() { return "capturing"; }
  std::string getServiceId() const override { return serviceId(); }

  Data process(Data data) override {
    ++calls;
    lastInput = data;
    return data;
  }

  static void reset() {
    calls = 0;
    lastInput = Data(json{{"never", "set"}});
  }

  static int calls;
  static Data lastInput;
};

int CapturingService::calls = 0;
Data CapturingService::lastInput = Data(json{{"never", "set"}});

/** An app holding one runtime, "rt-1", whose only service records its input. */
std::shared_ptr<App> appWithCapturingRuntime() {
  CapturingService::reset();
  auto app = std::make_shared<App>();
  app->registerService<CapturingService>();
  app->createRuntime(json{
    {"id", "rt-1"},
    {"name", "Runtime"},
    {"services", json::array({
      json{{"serviceId", CapturingService::serviceId()}, {"uuid", "svc-1"}},
    })},
  });
  return app;
}

} // namespace

TEST_CASE("a null payload over the socket runs the pipeline with nothing",
          "[runtime][no-input]") {
  auto app = appWithCapturingRuntime();

  app->dispatchRuntimeWsMessage(
    "rt-1", R"({"type":"processRuntime","params":null,"context":null})", false);

  // Ran at all: dropping the frame as malformed is the failure this guards.
  REQUIRE(CapturingService::calls == 1);
  REQUIRE(isUndefined(CapturingService::lastInput));
  // Undefined rather than Null: a Null input is the value that stops a
  // pipeline, and a run that starts by stopping is not a run.
  REQUIRE_FALSE(isNull(CapturingService::lastInput));
}

TEST_CASE("an empty object over the socket stays a payload",
          "[runtime][no-input]") {
  auto app = appWithCapturingRuntime();

  app->dispatchRuntimeWsMessage(
    "rt-1", R"({"type":"processRuntime","params":{},"context":null})", false);

  REQUIRE(CapturingService::calls == 1);
  REQUIRE_FALSE(isUndefined(CapturingService::lastInput));
  const auto asJson = getJSONFromData(CapturingService::lastInput);
  REQUIRE(asJson);
  REQUIRE(asJson->is_object());
}
