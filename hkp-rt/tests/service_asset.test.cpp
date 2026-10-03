#include <catch2/catch_test_macros.hpp>

#include <algorithm>
#include <filesystem>
#include <fstream>
#include <functional>
#include <list>
#include <memory>
#include <string>

#include <boost/asio/connect.hpp>
#include <boost/asio/io_context.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/asio/write.hpp>

#include <assets.h>
#include <service.h>
#include <types/data.h>
#include "runtime_host.h"
#include "sub_runtime.h"
#include "services/asset.h"
#include "services/http_server/http_server_subservices.h"
#include "services/static.h"
#include "services/sha256_openssl.h"

using namespace hkp;

// ──────────────────────────────────────────────────────────────────────────────
// Content a board declares once and names by reference.
//
// A runtime is handed descriptors and resolves a reference when a service uses
// it. Pinned here, as in hkp-node's and hkp-python's suites: the store resolves
// each source and says why when it cannot, an edit reaches the next use without
// anything being reconfigured, a nested pipeline sees its host's assets, and an
// endpoint serves an asset named as its response body.
// ──────────────────────────────────────────────────────────────────────────────

namespace {

AssetDescriptor text(const std::string& id, const std::string& mediaType, const std::string& content)
{
  return json{ { "id", id }, { "mediaType", mediaType }, { "text", content } };
}

class AssetHost final : public RuntimeHost {
public:
  std::list<std::shared_ptr<Service>> services;
  std::function<std::shared_ptr<Service>(const std::string&, const std::string&)> factory;

  void addService(std::shared_ptr<Service> svc) {
    svc->setParentHost(*this);
    services.push_back(std::move(svc));
  }

  Data processFrom(const Service& svc, Data data, bool advanceBefore,
                   std::function<void(Data)> callback) override {
    auto it = std::find_if(services.begin(), services.end(),
      [&](const auto& s) { return s->getId() == svc.getId(); });
    if (it == services.end()) {
      return data;
    }
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
  bool isConnected(const Service& svc) const override {
    return std::any_of(services.cbegin(), services.cend(),
      [&](const auto& s) { return s->getId() == svc.getId(); });
  }
  void sendData(Data, MessagePurpose, const std::string&, std::function<void(Data)>) override {}
  void notifyProcessFinished(const Service&, const Data&) override {}
  SecretVault& secrets() override { return m_vault; }
  SlotStore& slots() override { return m_slots; }
  AssetStore* assets() override { return &store; }
  void log(const Service&, LogLevel, const std::string&, const nlohmann::json& = nullptr) override {}
  void forwardLog(const LogEntry&) override {}

  std::shared_ptr<SubRuntime> createSubRuntime(const Service& ownerInParent,
                                               const json& servicesConfig) override {
    auto post = [](std::function<void()> fn) { fn(); };
    auto sr = std::make_shared<SubRuntime>(*this, &ownerInParent, factory, post);
    sr->populate(servicesConfig);
    return sr;
  }

  SecretVault m_vault;
  SlotStore m_slots;
  AssetStore store;
};

struct HttpAnswer {
  std::string head;
  std::string body;
};

HttpAnswer httpGet(unsigned short port, const std::string& target) {
  namespace net = boost::asio;
  using tcp = net::ip::tcp;
  net::io_context ioc;
  tcp::socket socket(ioc);
  net::connect(socket, tcp::resolver(ioc).resolve("127.0.0.1", std::to_string(port)));
  const std::string request =
    "GET " + target + " HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n";
  net::write(socket, net::buffer(request));
  std::string response;
  boost::system::error_code ec;
  char buffer[4096];
  for (;;) {
    const std::size_t n = socket.read_some(net::buffer(buffer), ec);
    if (ec) break;
    response.append(buffer, n);
  }
  const auto headerEnd = response.find("\r\n\r\n");
  if (headerEnd == std::string::npos) {
    return {};
  }
  auto head = response.substr(0, headerEnd);
  std::transform(head.begin(), head.end(), head.begin(), [](unsigned char c) { return std::tolower(c); });
  return { head, response.substr(headerEnd + 4) };
}

} // namespace

TEST_CASE("asset references are whole values, found anywhere", "[assets]") {
  REQUIRE(parseAssetRef(std::string("hkp-asset://player")) == "player");
  REQUIRE_FALSE(parseAssetRef(std::string("<script>hkp-asset://player</script>")));
  REQUIRE_FALSE(parseAssetRef(std::string("hkp-asset://")));

  std::vector<std::string> found;
  findAssetRefs(json{ { "body=", "p == '/app.js' ? 'hkp-asset://app' : 'hkp-asset://page'" },
                      { "nested", json::array({ "hkp-asset://page" }) } },
                found);
  REQUIRE(found == std::vector<std::string>{ "app", "page" });
}

TEST_CASE("an assets payload keeps descriptors with exactly one source", "[assets]") {
  auto entries = readAssetsPayload(json{
    { "page", { { "mediaType", "text/html" }, { "text", "<p>hi</p>" } } },
    { "both", { { "mediaType", "text/plain" }, { "text", "a" }, { "url", "https://x" } } },
    { "gone", nullptr },
  });
  REQUIRE(entries.size() == 2);
  REQUIRE(entries["page"]["id"] == "page");
  REQUIRE(entries["gone"].is_null());
}

TEST_CASE("an assets payload keeps which runtimes an asset is for, and no headers", "[assets]") {
  auto entries = readAssetsPayload(json{
    { "model",
      { { "mediaType", "application/octet-stream" },
        { "url", "https://example.com/m.bin" },
        { "runtimes", json::array({ "rt", 7 }) },
        { "headers", { { "authorization", "Bearer {{secret.token}}" } } } } },
  });
  REQUIRE(entries["model"]["runtimes"] == json::array({ "rt" }));
  REQUIRE_FALSE(entries["model"].contains("headers"));
}

TEST_CASE("base64 is read as a browser reads it, and refused when it is not base64", "[assets]") {
  const auto bytes = [](const std::string& text) { return decodeBase64(text); };
  REQUIRE(bytes("AQID") == std::string("\x01\x02\x03"));
  REQUIRE(bytes("AQ ID\nBA==\n") == std::string("\x01\x02\x03\x04"));
  REQUIRE(bytes("AQIDBA") == std::string("\x01\x02\x03\x04"));
  REQUIRE(bytes("") == std::string());
  // One character over a group of four stands for no byte at all.
  REQUIRE_FALSE(bytes("AQIDB").has_value());
  REQUIRE_FALSE(bytes("AQ=ID").has_value());
  REQUIRE_FALSE(bytes("AQID-_").has_value());
  // Not the bytes of the part it recognises.
  REQUIRE_FALSE(bytes("AQID!").has_value());

  AssetStore store;
  store.replace({
    { "logo", json{ { "id", "logo" }, { "mediaType", "image/png" }, { "base64", "not base64!" } } },
  });
  REQUIRE(store.resolve("hkp-asset://logo").problem == "asset \"logo\": its content is not base64");
}

TEST_CASE("a URL source is followed through redirects to other http(s) addresses", "[assets]") {
  std::vector<std::string> asked;
  AssetStore store(
    [&](const std::string& url, const std::map<std::string, std::string>&) {
      asked.push_back(url);
      if (url == "https://example.com/model") {
        return AssetStore::FetchResponse{ 302, "", "", "https://cdn.example.net/store/m.bin?sig=1" };
      }
      if (url == "https://cdn.example.net/store/m.bin?sig=1") {
        return AssetStore::FetchResponse{ 307, "", "", "../final.bin" };
      }
      if (url == "https://cdn.example.net/final.bin") {
        return AssetStore::FetchResponse{ 200, "weights", "" };
      }
      if (url == "https://example.com/local") {
        return AssetStore::FetchResponse{ 302, "", "", "file:///etc/passwd" };
      }
      // Anything else points back at itself.
      return AssetStore::FetchResponse{ 302, "", "", url };
    });
  const auto at = [](const std::string& id, const std::string& url) {
    return std::pair<const std::string, json>{
      id, json{ { "id", id }, { "mediaType", "application/octet-stream" }, { "url", url } } };
  };
  store.replace({
    at("model", "https://example.com/model"),
    at("local", "https://example.com/local"),
    at("loop", "https://example.com/loop"),
  });

  REQUIRE(store.resolve("hkp-asset://model").asset->content == "weights");
  REQUIRE(asked == std::vector<std::string>{
    "https://example.com/model",
    "https://cdn.example.net/store/m.bin?sig=1",
    "https://cdn.example.net/final.bin",
  });

  REQUIRE(store.resolve("hkp-asset://local").problem ==
          "asset \"local\": https://example.com/local redirected to a file:// address");
  asked.clear();
  REQUIRE(store.resolve("hkp-asset://loop").problem ==
          "asset \"loop\": https://example.com/loop redirected more than 10 times");
  REQUIRE(asked.size() == 11);
}

TEST_CASE("the store resolves inline sources and says why when it cannot", "[assets]") {
  AssetStore store;
  store.replace({
    { "page", text("page", "text/html", "<p>hi</p>") },
    { "logo", json{ { "id", "logo" }, { "mediaType", "image/png" }, { "base64", "AQID" } } },
    { "pinned", json{ { "id", "pinned" }, { "mediaType", "text/plain" }, { "text", "changed" },
                      { "sha256", sha256("original") } } },
    { "ftp", json{ { "id", "ftp" }, { "mediaType", "text/plain" }, { "url", "ftp://example.com/a" } } },
    { "local", json{ { "id", "local" }, { "mediaType", "text/plain" }, { "url", "file:///etc/passwd" } } },
  });
  store.setFileRoot("");

  auto page = store.resolve("hkp-asset://page");
  REQUIRE(page.asset);
  REQUIRE(page.asset->content == "<p>hi</p>");
  REQUIRE(store.resolve("hkp-asset://logo").asset->content == std::string("\x01\x02\x03", 3));

  REQUIRE(store.resolve("hkp-asset://missing").problem.find("not known") != std::string::npos);
  REQUIRE(store.resolve("hkp-asset://pinned").problem.find("sha256") != std::string::npos);
  REQUIRE(store.resolve("hkp-asset://ftp").problem.find("not supported") != std::string::npos);
  REQUIRE(store.resolve("hkp-asset://local").problem.find("cannot be read") != std::string::npos);
}

TEST_CASE("the store serves an edit on the next use and tells subscribers", "[assets]") {
  AssetStore store;
  store.replace({ { "page", text("page", "text/html", "v1") } });
  std::vector<std::string> changed;
  store.subscribe("page", [&](const std::string& id) { changed.push_back(id); });

  REQUIRE(store.resolve("hkp-asset://page").asset->content == "v1");
  store.merge({ { "page", text("page", "text/html", "v2") } });
  REQUIRE(store.resolve("hkp-asset://page").asset->content == "v2");
  store.merge({ { "page", text("page", "text/html", "v2") } }); // nothing changed
  store.merge({ { "page", nullptr } });
  REQUIRE_FALSE(store.resolve("hkp-asset://page").asset);
  REQUIRE(changed == std::vector<std::string>{ "page", "page" });
}

TEST_CASE("a file:// source is read only inside the root this runtime was given", "[assets]") {
  namespace fs = std::filesystem;
  const auto root = fs::temp_directory_path() / "hkp-asset-root-test";
  fs::create_directories(root / "samples");
  std::ofstream(root / "samples" / "kit.wav", std::ios::binary) << "RIFF";
  std::ofstream(root.parent_path() / "hkp-asset-outside.txt") << "secret";

  AssetStore store;
  store.setFileRoot(root.string());
  store.replace({
    { "kit", json{ { "id", "kit" }, { "mediaType", "audio/wav" }, { "url", "file:///samples/kit.wav" } } },
    { "escape", json{ { "id", "escape" }, { "mediaType", "text/plain" },
                      { "url", "file:///../hkp-asset-outside.txt" } } },
  });

  REQUIRE(store.resolve("hkp-asset://kit").asset->content == "RIFF");
  REQUIRE(store.resolve("hkp-asset://escape").problem.find("outside") != std::string::npos);

  fs::remove_all(root);
  fs::remove(root.parent_path() / "hkp-asset-outside.txt");
}

TEST_CASE("a URL source is revalidated with its ETag, or not at all when pinned", "[assets]") {
  int requests = 0;
  std::string lastIfNoneMatch;
  std::string body = "remote v1";
  AssetStore store(
    [&](const std::string&, const std::map<std::string, std::string>& headers) {
      ++requests;
      auto found = headers.find("If-None-Match");
      lastIfNoneMatch = found != headers.end() ? found->second : "";
      const auto etag = "\"" + sha256(body) + "\"";
      if (lastIfNoneMatch == etag) {
        return AssetStore::FetchResponse{ 304, "", etag };
      }
      return AssetStore::FetchResponse{ 200, body, etag };
    });
  store.replace({ { "r", json{ { "id", "r" }, { "mediaType", "text/plain" }, { "url", "https://example.com/a" } } } });

  REQUIRE(store.resolve("hkp-asset://r").asset->content == "remote v1");
  REQUIRE(store.resolve("hkp-asset://r").asset->content == "remote v1");
  REQUIRE_FALSE(lastIfNoneMatch.empty());
  body = "remote v2";
  REQUIRE(store.resolve("hkp-asset://r").asset->content == "remote v2");
  REQUIRE(requests == 3);

  store.replace({ { "r", json{ { "id", "r" }, { "mediaType", "text/plain" }, { "url", "https://example.com/a" },
                                { "sha256", sha256("remote v2") } } } });
  requests = 0;
  store.resolve("hkp-asset://r");
  store.resolve("hkp-asset://r");
  REQUIRE(requests == 1);
}

TEST_CASE("the asset service emits text as a body and bytes as MixedData", "[assets][services]") {
  AssetHost host;
  host.store.replace({
    { "page", text("page", "text/html", "<p>hi</p>") },
    { "logo", json{ { "id", "logo" }, { "mediaType", "image/png" }, { "base64", "CQ==" } } },
  });
  auto asset = std::make_shared<Asset>("a");
  host.addService(asset);
  asset->configure(Data(json{ { "asset", "hkp-asset://page" } }));

  auto out = getJSONFromData(asset->process(Data(json::object())));
  REQUIRE(out);
  REQUIRE((*out)["body"] == "<p>hi</p>");
  REQUIRE((*out)["meta"]["contentType"] == "text/html");

  auto bytes = getMixedDataFromData(asset->process(Data(json{ { "asset", "hkp-asset://logo" } })));
  REQUIRE(bytes);
  REQUIRE(bytes->binary == BinaryData{ 9 });

  host.store.merge({ { "page", nullptr } });
  auto missing = getJSONFromData(asset->process(Data(json::object())));
  REQUIRE((*missing)["meta"]["status"] == 404);
  REQUIRE(asset->getState()["error"].get<std::string>().find("not known") != std::string::npos);
}

TEST_CASE("an endpoint serves an asset named as its response body", "[assets][http-server-subservices]") {
  auto host = std::make_shared<AssetHost>();
  host->store.replace({ { "page", text("page", "text/html; charset=utf-8", "<h1>v1</h1>") } });
  host->factory = [](const std::string& serviceId, const std::string& instanceId) -> std::shared_ptr<Service> {
    return std::make_shared<Static>(instanceId);
  };

  auto server = std::make_shared<HttpServerSubservices>("http-1");
  host->addService(server);
  server->configure(Data(json{
    { "port", 0 },
    { "bypass", true },
    { "onRequest", json::array({ json{
        { "instanceId", "answer" }, { "serviceId", "static" },
        { "state", { { "out", { { "meta", { { "status", 200 } } }, { "body", "hkp-asset://page" } } } } } } }) },
  }));
  server->configure(Data(json{ { "bypass", false } }));
  const auto port = server->getState().value("port", static_cast<unsigned short>(0));
  REQUIRE(port != 0);

  auto first = httpGet(port, "/");
  REQUIRE(first.body == "<h1>v1</h1>");
  REQUIRE(first.head.find("content-type: text/html; charset=utf-8") != std::string::npos);

  // An edit is served on the next request; the endpoint is not reconfigured.
  host->store.merge({ { "page", text("page", "text/html; charset=utf-8", "<h1>v2</h1>") } });
  REQUIRE(httpGet(port, "/").body == "<h1>v2</h1>");

  // And one it does not have fails loudly.
  host->store.merge({ { "page", nullptr } });
  auto missing = httpGet(port, "/");
  REQUIRE(missing.head.find(" 500 ") != std::string::npos);
  REQUIRE(missing.body.find("not known") != std::string::npos);

  server->configure(Data(json{ { "bypass", true } }));
}
