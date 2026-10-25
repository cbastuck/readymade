#pragma once

#include <catch2/catch_test_macros.hpp>

#include <algorithm>
#include <functional>
#include <list>
#include <map>
#include <memory>
#include <stdexcept>
#include <string>
#include <vector>

#include <service.h>
#include <types/data.h>
#include "runtime_host.h"
#include "sub_runtime.h"

// A host for a service holding a nested pipeline, without a runtime around it.
//
// The services a pipeline names are looked up by instanceId in `instances`, so
// a test builds them first, with whatever behaviour it needs, and the pipeline
// is made of exactly those. What the service logs and notifies is kept, since
// for a service that reports rather than throws that is what there is to check.
namespace nested_fixture {
using namespace hkp;

// Answers with what its state says: twice a number, `{ saw }` otherwise; null
// for `stopOn`, a throw for `failOn`.
class FakeItemService final : public Service {
public:
  explicit FakeItemService(const std::string& id, json state = json::object())
    : Service(id, "fake"), m_state(std::move(state)) {}

  std::string getServiceId() const override { return "fake"; }
  json getState() const override { return m_state; }

  Data process(Data data) override {
    auto j = getJSONFromData(data);
    seen().push_back(j ? *j : json("<not json>"));
    if (j && m_state.contains("failOn") && m_state["failOn"] == *j)
      throw std::runtime_error("malformed");
    if (j && m_state.contains("stopOn") && m_state["stopOn"] == *j)
      return Null();
    if (j && j->is_number_integer())
      return json(j->get<int64_t>() * 2);
    return j ? json{{"saw", *j}} : data;
  }

  // What every fake was handed, in order, shared by every instance in a test.
  static std::vector<json>& seen() {
    static std::vector<json> values;
    return values;
  }

private:
  json m_state;
};

class NestedHost final : public RuntimeHost {
public:
  std::list<std::shared_ptr<Service>> services;
  std::map<std::string, std::shared_ptr<Service>> instances;
  std::vector<std::string> logged;   // "<level> <event>"
  std::vector<json> logData;
  std::vector<json> notifications;

  void addService(std::shared_ptr<Service> svc) {
    svc->setParentHost(*this);
    services.push_back(std::move(svc));
  }

  Data processFrom(const Service& svc, Data data, bool advanceBefore,
                   std::function<void(Data)> callback) override {
    auto it = std::find_if(services.begin(), services.end(),
      [&](const auto& s) { return s->getId() == svc.getId(); });
    REQUIRE(it != services.end());
    for (auto next = advanceBefore ? std::next(it) : it;
         next != services.end(); ++next) {
      data = (*next)->startProcess(data);
      if (isNull(data)) break;
    }
    if (callback) callback(data);
    return data;
  }

  void post(std::function<void()> fn) override { fn(); }
  void scheduleProcessFrom(const Service& svc, Data data, bool advanceBefore) override {
    processFrom(svc, data, advanceBefore, nullptr);
  }
  bool isConnected(const Service&) const override { return true; }

  void sendData(Data data, MessagePurpose purpose, const std::string&,
                std::function<void(Data)>) override {
    if (purpose != MessagePurpose::NOTIFICATION)
      return;
    auto j = getJSONFromData(data);
    // The nested pipeline's own lifecycle brackets are not what is under test.
    if (j && !j->contains("__internal"))
      notifications.push_back(*j);
  }
  void notifyProcessFinished(const Service&, const Data&) override {}
  void log(const Service&, LogLevel level, const std::string& event,
           const nlohmann::json& data = nullptr) override {
    logged.push_back(std::string(toString(level)) + " " + event);
    logData.push_back(data);
  }
  void forwardLog(const LogEntry&) override {}
  SecretVault& secrets() override { return m_vault; }
  SlotStore& slots() override { return m_slots; }

  std::shared_ptr<SubRuntime> createSubRuntime(const Service& ownerInParent,
                                               const json& servicesConfig) override {
    auto factory = [this](const std::string&, const std::string& id)
      -> std::shared_ptr<Service> {
      auto it = instances.find(id);
      return it != instances.end() ? it->second : nullptr;
    };
    auto post = [](std::function<void()> fn) { fn(); };
    auto sr = std::make_shared<SubRuntime>(*this, &ownerInParent, factory, post);
    sr->populate(servicesConfig);
    return sr;
  }

  SecretVault m_vault;
  SlotStore m_slots;
};

} // namespace nested_fixture
