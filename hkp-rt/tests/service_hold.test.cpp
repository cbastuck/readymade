#include <catch2/catch_test_macros.hpp>

#include <functional>
#include <memory>
#include <string>

#include <types/data.h>

#include <services/hold.h>
#include "../lib/src/runtime_host.h"

using namespace hkp;

namespace {

// A host that lends cells, as an endpoint lends them to its entry points.
// Everything else is the minimum a Service needs to be attached at all.
class LendingHost final : public RuntimeHost {
public:
  void attach(Service& svc) { svc.setParentHost(*this); }

  Data processFrom(const Service&, Data data, bool,
                   std::function<void(Data)>) override { return data; }
  void scheduleProcessFrom(const Service&, Data, bool) override {}
  bool isConnected(const Service&) const override { return true; }
  void sendData(Data, MessagePurpose, const std::string&,
                std::function<void(Data)>) override {}
  void notifyProcessFinished(const Service&, const Data&) override {}
  void log(const Service&, LogLevel, const std::string&,
           const nlohmann::json& = nullptr) override {}
  void forwardLog(const LogEntry&) override {}
  SecretVault& secrets() override { return m_vault; }
  SlotStore& slots() override { return m_slots; }
  std::shared_ptr<SubRuntime> createSubRuntime(const Service&, const json&) override {
    return nullptr;
  }

  SecretVault m_vault;
  SlotStore m_slots;
};

// What an http-server request arrives as: no producer property in sight.
const json kRequest = json{
  { "meta", json{ { "method", "GET" }, { "path", "/" } } }
};

Hold makeHold(const std::string& property)
{
  Hold hold("hold-1");
  hold.configure(json{ { "property", property } });
  return hold;
}

json stateOf(const Hold& hold)
{
  return hold.getState();
}

} // namespace

TEST_CASE("Hold emits the named property under the same name", "[services][hold]") {
  auto hold = makeHold("triggerCount");

  auto out = getJSONFromData(hold.process(json{ { "triggerCount", 1 } }));
  REQUIRE(out.has_value());
  REQUIRE(*out == json{ { "triggerCount", 1 } });

  const auto state = stateOf(hold);
  REQUIRE(state["held"] == 1);
  REQUIRE(state["writeCount"] == 1);
}

TEST_CASE("Hold emits the same shape whichever side calls", "[services][hold]") {
  auto hold = makeHold("triggerCount");

  auto written = getJSONFromData(hold.process(json{ { "triggerCount", 4 } }));
  auto read = getJSONFromData(hold.process(kRequest));

  // What the services after Hold see does not say which side called; only the
  // counts, which nothing downstream sees, tell them apart.
  REQUIRE(written.has_value());
  REQUIRE(read.has_value());
  REQUIRE(*read == *written);

  const auto state = stateOf(hold);
  REQUIRE(state["readCount"] == 1);
  REQUIRE(state["writeCount"] == 1);
}

TEST_CASE("Hold replays without consuming", "[services][hold]") {
  auto hold = makeHold("triggerCount");
  hold.process(json{ { "triggerCount", 4 } });

  REQUIRE(*getJSONFromData(hold.process(kRequest)) == json{ { "triggerCount", 4 } });
  REQUIRE(*getJSONFromData(hold.process(kRequest)) == json{ { "triggerCount", 4 } });
}

TEST_CASE("Hold keeps the newest value written", "[services][hold]") {
  auto hold = makeHold("triggerCount");
  hold.process(json{ { "triggerCount", 1 } });
  hold.process(json{ { "triggerCount", 2 } });

  REQUIRE(*getJSONFromData(hold.process(kRequest)) == json{ { "triggerCount", 2 } });
}

TEST_CASE("Hold drops everything but the held property", "[services][hold]") {
  // A producer's other fields are not part of what is held.
  auto hold = makeHold("triggerCount");

  auto out = getJSONFromData(
    hold.process(json{ { "triggerCount", 5 }, { "note", "ignored" } }));
  REQUIRE(*out == json{ { "triggerCount", 5 } });
}

TEST_CASE("Hold stops while nothing is held", "[services][hold]") {
  auto hold = makeHold("triggerCount");

  REQUIRE(isNull(hold.process(kRequest)));
  REQUIRE(stateOf(hold)["held"].is_null());
}

TEST_CASE("Hold reads on inputs that cannot carry a property", "[services][hold]") {
  auto hold = makeHold("triggerCount");
  hold.process(json{ { "triggerCount", 6 } });

  REQUIRE(*getJSONFromData(hold.process(json::array({ 1, 2, 3 })))
          == json{ { "triggerCount", 6 } });
}

TEST_CASE("Hold reads on a null value, which is nothing to hold", "[services][hold]") {
  auto hold = makeHold("triggerCount");
  hold.process(json{ { "triggerCount", 2 } });

  auto out = getJSONFromData(hold.process(json{ { "triggerCount", nullptr } }));
  REQUIRE(*out == json{ { "triggerCount", 2 } });

  const auto state = stateOf(hold);
  REQUIRE(state["readCount"] == 1);
  REQUIRE(state["writeCount"] == 1);
}

TEST_CASE("Hold passes input through while no property is configured", "[services][hold]") {
  Hold hold("hold-1");

  auto out = getJSONFromData(hold.process(kRequest));
  REQUIRE(out.has_value());
  REQUIRE(*out == kRequest);
  REQUIRE(stateOf(hold)["held"].is_null());
}

TEST_CASE("Hold forgets the held value and the counts on clear", "[services][hold]") {
  auto hold = makeHold("triggerCount");
  hold.process(json{ { "triggerCount", 3 } });
  hold.process(kRequest);

  hold.configure(json{ { "action", "clear" } });

  // The counts described the value that was just discarded.
  const auto state = stateOf(hold);
  REQUIRE(state["held"].is_null());
  REQUIRE(state["readCount"] == 0);
  REQUIRE(state["writeCount"] == 0);
  REQUIRE(isNull(hold.process(kRequest)));
}

TEST_CASE("Hold forgets what it held when the property changes", "[services][hold]") {
  // What was held belonged to the old property name.
  auto hold = makeHold("triggerCount");
  hold.process(json{ { "triggerCount", 3 } });

  hold.configure(json{ { "property", "counter" } });

  REQUIRE(stateOf(hold)["held"].is_null());
  REQUIRE(stateOf(hold)["writeCount"] == 0);
  REQUIRE(isNull(hold.process(kRequest)));
}

TEST_CASE("Hold keeps its value when the property is reconfigured to itself",
          "[services][hold]") {
  auto hold = makeHold("triggerCount");
  hold.process(json{ { "triggerCount", 3 } });

  hold.configure(json{ { "property", "triggerCount" } });

  REQUIRE(stateOf(hold)["held"] == 3);
  REQUIRE(stateOf(hold)["writeCount"] == 1);
}

TEST_CASE("Hold passes input through when bypassed", "[services][hold]") {
  // Bypass is handled by the base, which never calls process at all.
  auto hold = makeHold("triggerCount");
  hold.configure(json{ { "bypass", true } });

  auto out = getJSONFromData(hold.startProcess(kRequest));
  REQUIRE(out.has_value());
  REQUIRE(*out == kRequest);
}

// ── A slot, where the role is declared ───────────────────────────────────────

TEST_CASE("Hold with a slot reads back what the other end wrote",
          "[services][hold]") {
  LendingHost host;
  Hold write("write-1");
  Hold read("read-1");
  host.attach(write);
  host.attach(read);
  write.configure(json{ { "slot", "document" }, { "op", "write" } });
  read.configure(json{ { "slot", "document" }, { "op", "read" } });

  const json document = json{ { "meta", json{ { "status", 200 } } }, { "body", "<rss/>" } };
  write.process(document);

  REQUIRE(*getJSONFromData(read.process(kRequest)) == document);
}

TEST_CASE("Hold with a slot passes a write's input on unchanged",
          "[services][hold]") {
  // The pass a write belongs to carries on as though the Hold were not there.
  LendingHost host;
  Hold write("write-1");
  host.attach(write);
  write.configure(json{ { "slot", "document" }, { "op", "write" } });

  const json document = json{ { "body", "<rss/>" } };
  REQUIRE(*getJSONFromData(write.process(document)) == document);
}

TEST_CASE("Hold with a slot holds two shapes that look alike",
          "[services][hold]") {
  // The reason the older arrangement cannot express an endpoint publishing a
  // document — a response and a request are the same shape, so there is nothing
  // in the value to discriminate on.
  LendingHost host;
  Hold write("write-1");
  Hold read("read-1");
  host.attach(write);
  host.attach(read);
  write.configure(json{ { "slot", "document" }, { "op", "write" } });
  read.configure(json{ { "slot", "document" }, { "op", "read" } });

  const json answer = json{ { "meta", json{ { "status", 200 } } }, { "body", "ok" } };
  write.process(answer);

  REQUIRE(*getJSONFromData(read.process(kRequest)) == answer);
  // The request did not overwrite what is held: a read is only ever a read.
  REQUIRE(*getJSONFromData(read.process(kRequest)) == answer);
}

TEST_CASE("Hold with a slot holds bytes and reports their size",
          "[services][hold]") {
  LendingHost host;
  Hold write("write-1");
  Hold read("read-1");
  host.attach(write);
  host.attach(read);
  write.configure(json{ { "slot", "audio" }, { "op", "write" } });
  read.configure(json{ { "slot", "audio" }, { "op", "read" } });

  const BinaryData audio(4096, 7);
  write.process(Data(audio));

  const auto out = getBinaryFromData(read.process(kRequest));
  REQUIRE(out.has_value());
  REQUIRE(out->size() == 4096);
  REQUIRE(write.getState()["held"] == "[4096 bytes]");
}

TEST_CASE("Hold with a slot stops a read that arrives before a write",
          "[services][hold]") {
  LendingHost host;
  Hold read("read-1");
  host.attach(read);
  read.configure(json{ { "slot", "document" }, { "op", "read" } });

  REQUIRE(isNull(read.process(kRequest)));
}

TEST_CASE("Hold keeps slots apart by name", "[services][hold]") {
  LendingHost host;
  Hold feed("feed-1");
  Hold playlist("playlist-1");
  host.attach(feed);
  host.attach(playlist);
  feed.configure(json{ { "slot", "feed" }, { "op", "write" } });
  playlist.configure(json{ { "slot", "playlist" }, { "op", "read" } });

  feed.process(json{ { "body", "<rss/>" } });

  REQUIRE(isNull(playlist.process(kRequest)));
}

TEST_CASE("Hold reports the arrangement it is using and not the other",
          "[services][hold]") {
  // A state property a service does not act on is one a board keeps and a
  // reader has to discount.
  LendingHost host;
  Hold slotted("slot-1");
  host.attach(slotted);
  slotted.configure(json{ { "slot", "document" }, { "op", "write" } });

  const auto state = slotted.getState();
  REQUIRE(state["slot"] == "document");
  REQUIRE(state["op"] == "write");
  REQUIRE_FALSE(state.contains("property"));

  auto byProperty = makeHold("triggerCount");
  REQUIRE(byProperty.getState()["property"] == "triggerCount");
  REQUIRE_FALSE(byProperty.getState().contains("slot"));
}

TEST_CASE("Hold with a slot holds for itself where nothing lends cells",
          "[services][hold]") {
  // A Hold is still a Hold outside any host that lends it cells; what it cannot
  // do there is share.
  Hold alone("alone-1");
  alone.configure(json{ { "slot", "document" }, { "op", "write" } });

  const json document = json{ { "body", "<rss/>" } };
  alone.process(document);

  REQUIRE(alone.getState()["held"] == document);
  REQUIRE(alone.getState()["writeCount"] == 1);
}
