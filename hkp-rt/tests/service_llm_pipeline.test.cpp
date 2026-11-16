#include <catch2/catch_test_macros.hpp>
#include <catch2/matchers/catch_matchers_floating_point.hpp>

#include <chrono>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <list>
#include <map>
#include <memory>
#include <random>
#include <string>
#include <thread>
#include <vector>

#include <assets.h>
#include <service.h>
#include <types/data.h>
#include "runtime_host.h"
#include "sub_runtime.h"
#include "services/chat_template.h"
#include "services/detokenize.h"
#include "services/llm_decode.h"
#include "services/llm_model.h"
#include "services/loop.h"
#include "services/sample.h"
#include "services/sha256_openssl.h"
#include "services/tokenize.h"

using namespace hkp;

// ──────────────────────────────────────────────────────────────────────────────
// A language model laid out as services: chat-template, tokenize, llm-decode,
// sample, detokenize.
//
// What needs no model is pinned always: the values the services pass each
// other, and what a service says where llama.cpp is not compiled in. What
// needs one runs when the build has llama.cpp (HKP_LLAMA=ON ./run-tests.sh)
// and HKP_TEST_GGUF names a chat model's GGUF file — any small one; the cases
// are about the pipeline, not about what a particular model writes.
// ──────────────────────────────────────────────────────────────────────────────

TEST_CASE("a token's bytes are shown as text, whole characters only", "[llm]")
{
  REQUIRE(llm::validUtf8("plain") == "plain");
  REQUIRE(llm::validUtf8("gr\xC3\xBC\xC3\x9F") == "gr\xC3\xBC\xC3\x9F");
  // The first two bytes of a three-byte character, as one token holds them.
  REQUIRE(llm::validUtf8("\xE2\x82") == "\xEF\xBF\xBD\xEF\xBF\xBD");
  REQUIRE(llm::validUtf8("a\xFFz") == "a\xEF\xBF\xBDz");
  // Whatever comes out, a JSON value can hold it.
  REQUIRE_NOTHROW(json(llm::validUtf8("\xF0\x9F\x98")).dump());
}

TEST_CASE("the most likely candidates are those still in the running", "[llm]")
{
  std::vector<float> scores{ 1.0f, llm::kRemoved, 3.0f, 2.0f, llm::kRemoved };
  size_t remaining = 0;
  const auto best = llm::mostLikely(scores, 2, &remaining);

  REQUIRE(remaining == 3);
  REQUIRE(best.size() == 2);
  REQUIRE(best[0].token == 2);
  REQUIRE(best[1].token == 3);
  // Probabilities are among what is left, so all three sum to one.
  const auto all = llm::mostLikely(scores, 10);
  double sum = 0;
  for (const auto& candidate : all) sum += candidate.probability;
  REQUIRE_THAT(sum, Catch::Matchers::WithinAbs(1.0, 1e-9));
  REQUIRE(llm::mostLikely({ llm::kRemoved }, 3).empty());
}

TEST_CASE("tokens and scores are read only when they are what they claim", "[llm]")
{
  REQUIRE(*llm::tokensOf(json{ { "tokens", { 1, 2, 3 } } }) == std::vector<int32_t>{ 1, 2, 3 });
  REQUIRE_FALSE(llm::tokensOf(json{ { "tokens", { 1, "two" } } }).has_value());
  REQUIRE_FALSE(llm::tokensOf(json::array({ 1, 2 })).has_value());

  MixedData scores{ json::object(), llm::bytesOf({ 0.5f, -1.0f }) };
  REQUIRE(*llm::scoresOf(scores, 2) == std::vector<float>{ 0.5f, -1.0f });
  REQUIRE_FALSE(llm::scoresOf(scores, 3).has_value());
}

TEST_CASE("sample refuses a mode it does not have", "[llm]")
{
  Sample sample("s");
  REQUIRE_THROWS(sample.configure(json{ { "mode", "nucleus" } }));
  REQUIRE(sample.getState()["mode"] == "pick");
  sample.configure(json{ { "mode", "top-k" }, { "k", 5 } });
  REQUIRE(sample.getState()["k"] == 5);
  // A facade knob sends its value as text.
  sample.configure(json{ { "temperature", "0.65" }, { "k", "12" }, { "p", "wide" } });
  REQUIRE(sample.getState()["temperature"] == 0.65);
  REQUIRE(sample.getState()["k"] == 12);
  REQUIRE(sample.getState()["p"] == 0.95);
}

namespace {

// A runtime's worth of host: services in order, an asset store, and what each
// service reported.
class Host final : public RuntimeHost {
public:
  std::list<std::shared_ptr<Service>> services;
  std::map<std::string, std::vector<json>> said;
  std::mutex saidMutex;
  AssetStore store;

  template <typename T>
  std::shared_ptr<T> add(const std::string& id) {
    auto svc = std::make_shared<T>(id);
    svc->setParentHost(*this);
    services.push_back(svc);
    return svc;
  }

  std::vector<json> reportsOf(const std::string& id) {
    std::lock_guard lock(saidMutex);
    return said[id];
  }

  Data processFrom(const Service& svc, Data data, bool advanceBefore,
                   std::function<void(Data)> callback) override {
    auto it = std::find_if(services.begin(), services.end(),
      [&](const auto& s) { return s->getId() == svc.getId(); });
    if (it == services.end()) return data;
    for (auto next = advanceBefore ? std::next(it) : it; next != services.end(); ++next) {
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
  void sendData(Data data, MessagePurpose purpose, const std::string& sender,
                std::function<void(Data)>) override {
    auto j = getJSONFromData(data);
    if (purpose == MessagePurpose::NOTIFICATION && j && !j->contains("__internal")) {
      std::lock_guard lock(saidMutex);
      said[sender].push_back(*j);
    }
  }
  void notifyProcessFinished(const Service&, const Data&) override {}
  SecretVault& secrets() override { return m_vault; }
  SlotStore& slots() override { return m_slots; }
  AssetStore* assets() override { return &store; }
  void log(const Service&, LogLevel, const std::string&, const nlohmann::json& = nullptr) override {}
  void forwardLog(const LogEntry&) override {}

  // Services a nested pipeline names, by instanceId.
  std::map<std::string, std::shared_ptr<Service>> nested;
  std::shared_ptr<SubRuntime> createSubRuntime(const Service& owner, const json& config) override {
    auto factory = [this](const std::string&, const std::string& id) -> std::shared_ptr<Service> {
      auto it = nested.find(id);
      return it != nested.end() ? it->second : nullptr;
    };
    auto sr = std::make_shared<SubRuntime>(*this, &owner, factory,
                                           [](std::function<void()> fn) { fn(); });
    sr->populate(config);
    return sr;
  }

private:
  SecretVault m_vault;
  SlotStore m_slots;
};

} // namespace

#ifndef HKP_LLAMA_ENABLED

TEST_CASE("without llama.cpp each service says why it cannot run", "[llm]")
{
  Host host;
  auto tokenize = host.add<Tokenize>("tokenize");
  tokenize->configure(json{ { "model", "hkp-asset://model" } });

  const auto state = tokenize->getState();
  REQUIRE(state["status"] == "error");
  REQUIRE(state["problem"].get<std::string>().find("not compiled in") != std::string::npos);
  REQUIRE(isNull(tokenize->startProcess(std::string("hello"))));
  REQUIRE(host.reportsOf("tokenize").back()["error"].get<std::string>().find("not compiled in") !=
          std::string::npos);
}

#else

namespace {

// The model HKP_TEST_GGUF names, put where the asset store finds it: a folder
// of files named by their sha256, as a fetch would have left it.
struct TestModel {
  std::filesystem::path folder;
  json asset;

  static const TestModel* get() {
    static const std::unique_ptr<TestModel> model = []() -> std::unique_ptr<TestModel> {
      const char* path = std::getenv("HKP_TEST_GGUF");
      if (!path || !std::filesystem::is_regular_file(path)) return nullptr;
      Sha256Stream hash;
      std::ifstream in(path, std::ios::binary);
      std::vector<char> chunk(1 << 20);
      while (in) {
        in.read(chunk.data(), static_cast<std::streamsize>(chunk.size()));
        hash.update(chunk.data(), static_cast<size_t>(in.gcount()));
      }
      const auto sha = hash.finish();
      auto made = std::make_unique<TestModel>();
      made->folder = std::filesystem::temp_directory_path() /
                     ("hkp-llm-test-" + std::to_string(std::random_device{}()));
      std::filesystem::create_directories(made->folder);
      std::filesystem::create_symlink(std::filesystem::absolute(path), made->folder / sha);
      made->asset = json{ { "id", "model" }, { "mediaType", "application/octet-stream" },
                          { "url", "https://example.invalid/model.gguf" }, { "sha256", sha } };
      return made;
    }();
    return model.get();
  }

  ~TestModel() { std::filesystem::remove_all(folder); }
};

void waitUntilReady(const std::shared_ptr<Service>& service) {
  for (int i = 0; i < 1200; ++i) {
    const auto state = service->getState();
    if (state["status"] == "ready") return;
    if (state["status"] == "error") FAIL(state["problem"].get<std::string>());
    std::this_thread::sleep_for(std::chrono::milliseconds(50));
  }
  FAIL("the model did not load in time");
}

struct Pipeline {
  Host host;
  std::shared_ptr<ChatTemplate> chat;
  std::shared_ptr<Tokenize> tokenize;
  std::shared_ptr<LlmDecode> decode;
  std::shared_ptr<Detokenize> detokenize;
  json model = json{ { "model", "hkp-asset://model" } };

  explicit Pipeline(const TestModel& with) {
    host.store.setFileCache(std::make_shared<AssetFileCache>(with.folder.string()));
    host.store.replace({ { "model", with.asset } });
    chat = host.add<ChatTemplate>("chat");
    tokenize = host.add<Tokenize>("tokenize");
    decode = host.add<LlmDecode>("decode");
    detokenize = host.add<Detokenize>("detokenize");
    for (const std::shared_ptr<Service>& service :
         std::vector<std::shared_ptr<Service>>{ chat, tokenize, decode, detokenize }) {
      service->configure(model);
      waitUntilReady(service);
    }
  }

  std::shared_ptr<Sample> sampler(const std::string& id, json state) {
    auto sample = host.add<Sample>(id);
    state["model"] = "hkp-asset://model";
    sample->configure(state);
    waitUntilReady(sample);
    return sample;
  }

  json prompt(const std::string& text) {
    auto rendered = chat->startProcess(text);
    auto tokens = getJSONFromData(tokenize->startProcess(rendered));
    REQUIRE(tokens.has_value());
    return *tokens;
  }

  static std::vector<float> scores(const Data& data, size_t* count = nullptr) {
    auto mixed = getMixedDataFromData(data);
    REQUIRE(mixed.has_value());
    std::vector<float> out(mixed->binary.size() / sizeof(float));
    std::memcpy(out.data(), mixed->binary.data(), mixed->binary.size());
    if (count) *count = out.size();
    return out;
  }

  static size_t best(const std::vector<float>& scores) {
    return std::max_element(scores.begin(), scores.end()) - scores.begin();
  }
};

#define NEEDS_MODEL()                                                          \
  const auto* testModel = TestModel::get();                                    \
  if (!testModel) SKIP("HKP_TEST_GGUF names no model file")

} // namespace

TEST_CASE("five services naming one model hold one model", "[llm][model]")
{
  NEEDS_MODEL();
  Pipeline p(*testModel);
  REQUIRE(p.host.store.models.keys().size() == 1);
  REQUIRE(p.tokenize->getState()["model"] == "hkp-asset://model");
}

TEST_CASE("a prompt is wrapped by the model's template and cut into its tokens", "[llm][model]")
{
  NEEDS_MODEL();
  Pipeline p(*testModel);

  const auto rendered = getStringFromData(p.chat->startProcess(std::string("Say hello.")));
  REQUIRE(rendered.has_value());
  REQUIRE(rendered->find("Say hello.") != std::string::npos);
  REQUIRE(rendered->size() > std::string("Say hello.").size());

  const auto tokens = *getJSONFromData(p.tokenize->startProcess(*rendered));
  REQUIRE(tokens["tokens"].size() > 3);
  REQUIRE(tokens["pieces"].size() == tokens["tokens"].size());
  REQUIRE(tokens["promptTokens"] == tokens["tokens"].size());

  // The pieces are the text again, cut.
  std::string joined;
  for (const auto& piece : tokens["pieces"]) joined += piece.get<std::string>();
  REQUIRE(joined.find("Say hello.") != std::string::npos);

  // A control token written out is one token when it is parsed, several when not.
  p.tokenize->configure(json{ { "parseSpecial", false } });
  const auto literal = *getJSONFromData(p.tokenize->startProcess(*rendered));
  REQUIRE(literal["tokens"].size() > tokens["tokens"].size());
}

TEST_CASE("llm-decode is a function of its tokens, and runs only the new ones", "[llm][model]")
{
  NEEDS_MODEL();
  Pipeline p(*testModel);
  auto tokens = p.prompt("Name one colour.");
  const auto count = tokens["tokens"].size();

  size_t vocabulary = 0;
  const auto first = Pipeline::scores(p.decode->startProcess(tokens), &vocabulary);
  REQUIRE(vocabulary > 1000);
  auto report = p.host.reportsOf("decode").back();
  REQUIRE(report["decoded"] == count);
  REQUIRE(report["reused"] == 0);
  REQUIRE(report["candidates"].size() == 10);
  REQUIRE(report["candidates"][0]["token"] == Pipeline::best(first));

  // One token more: one token runs.
  auto longer = tokens;
  longer["tokens"].push_back(Pipeline::best(first));
  const auto second = Pipeline::scores(p.decode->startProcess(longer));
  report = p.host.reportsOf("decode").back();
  REQUIRE(report["decoded"] == 1);
  REQUIRE(report["reused"] == count);

  // The shorter input again: what no longer applies is dropped, and the
  // answer is the one it gave before.
  const auto again = Pipeline::scores(p.decode->startProcess(tokens));
  REQUIRE(p.host.reportsOf("decode").back()["reused"] == count - 1);
  REQUIRE(Pipeline::best(again) == Pipeline::best(first));

  // And the same as a decode that kept nothing.
  p.decode->configure(json{ { "clear", true } });
  const auto fresh = Pipeline::scores(p.decode->startProcess(longer));
  REQUIRE(p.host.reportsOf("decode").back()["reused"] == 0);
  REQUIRE(Pipeline::best(fresh) == Pipeline::best(second));
  double largest = 0;
  for (size_t i = 0; i < fresh.size(); ++i)
    largest = std::max(largest, static_cast<double>(std::fabs(fresh[i] - second[i])));
  REQUIRE(largest < 0.5);
}

TEST_CASE("each sampler narrows the candidates, and the last one chooses", "[llm][model]")
{
  NEEDS_MODEL();
  Pipeline p(*testModel);
  auto topK = p.sampler("top-k", json{ { "mode", "top-k" }, { "k", 5 } });
  auto temperature = p.sampler("temperature", json{ { "mode", "temperature" }, { "temperature", 0.5 } });
  auto topP = p.sampler("top-p", json{ { "mode", "top-p" }, { "p", 0.5 } });
  auto greedy = p.sampler("greedy", json{ { "mode", "greedy" } });

  const auto tokens = p.prompt("Name one colour.");
  const auto decoded = p.decode->startProcess(tokens);
  const auto raw = Pipeline::scores(decoded);
  const auto winner = Pipeline::best(raw);

  const auto afterK = topK->startProcess(decoded);
  REQUIRE(p.host.reportsOf("top-k").back()["remaining"] == 5);
  const auto kept = Pipeline::scores(afterK);
  REQUIRE(kept.size() == raw.size());
  REQUIRE(kept[winner] == raw[winner]);

  // Sharper: the best is more likely than it was among the same five.
  const auto before = p.host.reportsOf("top-k").back()["candidates"][0]["p"].get<double>();
  const auto afterT = temperature->startProcess(afterK);
  const auto sharper = p.host.reportsOf("temperature").back()["candidates"][0]["p"].get<double>();
  REQUIRE(sharper > before);

  const auto afterP = topP->startProcess(afterT);
  const auto left = p.host.reportsOf("top-p").back()["remaining"].get<size_t>();
  REQUIRE(left >= 1);
  REQUIRE(left <= 5);
  REQUIRE(getMixedDataFromData(afterP)->meta["applied"] ==
          json::array({ "top-k 5", "temperature 0.5", "top-p 0.5" }));

  const auto chosen = *getJSONFromData(greedy->startProcess(afterP));
  REQUIRE(chosen["tokens"].size() == tokens["tokens"].size() + 1);
  REQUIRE(chosen["tokens"].back() == winner);
  REQUIRE(chosen["pieces"].size() == chosen["tokens"].size());
  REQUIRE(chosen["promptTokens"] == tokens["promptTokens"]);
  REQUIRE_FALSE(chosen.contains("applied"));
}

TEST_CASE("pick with a seed makes the same choices again, and a penalty lowers what was said",
          "[llm][model]")
{
  NEEDS_MODEL();
  Pipeline p(*testModel);
  const auto tokens = p.prompt("Write a word.");
  const auto decoded = p.decode->startProcess(tokens);

  auto choices = [&](const std::string& id) {
    auto pick = p.sampler(id, json{ { "mode", "pick" }, { "seed", 7 } });
    std::vector<int> made;
    for (int i = 0; i < 4; ++i)
      made.push_back((*getJSONFromData(pick->startProcess(decoded)))["tokens"].back().get<int>());
    return made;
  };
  REQUIRE(choices("pick-a") == choices("pick-b"));

  // Penalise the token the model wants most by having it already said.
  const auto raw = Pipeline::scores(decoded);
  const auto winner = Pipeline::best(raw);
  auto said = *getMixedDataFromData(decoded);
  said.meta["tokens"].push_back(winner);
  auto penalty = p.sampler("penalty", json{ { "mode", "repetition-penalty" }, { "penalty", 1.5 } });
  const auto penalised = Pipeline::scores(penalty->startProcess(said));
  REQUIRE(penalised[winner] != raw[winner]);
  REQUIRE(std::fabs(penalised[winner]) != std::fabs(raw[winner]));
}

TEST_CASE("a loop of decode, sample and detokenize writes text until the model ends",
          "[llm][model]")
{
  NEEDS_MODEL();
  const auto& with = *testModel;
  Host host;
  host.store.setFileCache(std::make_shared<AssetFileCache>(with.folder.string()));
  host.store.replace({ { "model", with.asset } });

  auto chat = host.add<ChatTemplate>("chat");
  auto tokenize = host.add<Tokenize>("tokenize");
  auto loop = host.add<Loop>("loop");
  const json model{ { "model", "hkp-asset://model" } };
  chat->configure(model);
  tokenize->configure(model);

  // Built before the loop names them, as a runtime's registry would.
  auto decode = std::make_shared<LlmDecode>("decode");
  auto greedy = std::make_shared<Sample>("greedy");
  auto detokenize = std::make_shared<Detokenize>("detokenize");
  host.nested = { { "decode", decode }, { "greedy", greedy }, { "detokenize", detokenize } };
  loop->configure(json{
    { "until", "params.end" },
    { "maxRounds", 12 },
    { "mode", "step" },
    { "pipeline", json::array({
        json{ { "serviceId", "llm-decode" }, { "instanceId", "decode" }, { "state", model } },
        json{ { "serviceId", "sample" }, { "instanceId", "greedy" },
              { "state", json{ { "model", "hkp-asset://model" }, { "mode", "greedy" } } } },
        json{ { "serviceId", "detokenize" }, { "instanceId", "detokenize" }, { "state", model } },
      }) },
  });
  for (const std::shared_ptr<Service>& service :
       std::vector<std::shared_ptr<Service>>{ chat, tokenize, decode, greedy, detokenize })
    waitUntilReady(service);

  const auto tokens = *getJSONFromData(tokenize->startProcess(chat->startProcess(std::string("Count to three."))));
  const auto prompt = tokens["tokens"].size();

  // Step by step: each round is one token longer, and only the first round
  // runs the whole prompt.
  json round = *getJSONFromData(loop->startProcess(tokens));
  REQUIRE(round["tokens"].size() == prompt + 1);
  REQUIRE(round["promptTokens"] == prompt);
  round = *getJSONFromData(loop->startProcess());
  REQUIRE(round["tokens"].size() == prompt + 2);
  REQUIRE(round["text"].is_string());

  // Then to the end, or the limit.
  loop->configure(json{ { "mode", "run" } });
  loop->startProcess();
  const auto state = loop->getState();
  REQUIRE(state["done"] == true);
  const auto reports = host.reportsOf("loop");
  const auto last = reports.back()["output"];
  REQUIRE(last["tokens"].size() == prompt + state["round"].get<size_t>());
  REQUIRE(last["text"].get<std::string>().size() > 0);
  REQUIRE(last["end"] == (state["reason"] == "until"));
}

#endif // HKP_LLAMA_ENABLED
