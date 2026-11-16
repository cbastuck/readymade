#include <catch2/catch_test_macros.hpp>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <filesystem>
#include <fstream>
#include <functional>
#include <list>
#include <memory>
#include <string>
#include <thread>

#include <random>

#include <boost/asio/connect.hpp>
#include <boost/asio/io_context.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/asio/read_until.hpp>
#include <boost/asio/streambuf.hpp>
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

// ── As a file ────────────────────────────────────────────────────────────────
// What a library loads by path: fetched once to a folder the server owns.

namespace {

struct CacheFolder {
  std::filesystem::path path;
  CacheFolder() {
    path = std::filesystem::temp_directory_path() /
           ("hkp-asset-cache-test-" + std::to_string(std::random_device{}()));
    std::filesystem::remove_all(path);
  }
  ~CacheFolder() { std::filesystem::remove_all(path); }

  std::shared_ptr<AssetFileCache> cache(std::uint64_t maxBytes = 1024) const {
    return std::make_shared<AssetFileCache>(path.string(), maxBytes);
  }
  std::size_t files() const {
    if (!std::filesystem::exists(path)) return 0;
    return std::distance(std::filesystem::directory_iterator(path),
                         std::filesystem::directory_iterator());
  }
};

std::string contentOf(const std::string& path) {
  std::ifstream in(path, std::ios::binary);
  return std::string(std::istreambuf_iterator<char>(in), {});
}

json pinnedUrl(const std::string& id, const std::string& url, const std::string& content) {
  return json{ { "id", id }, { "mediaType", "application/octet-stream" }, { "url", url },
               { "sha256", sha256(content) } };
}

json pinnedText(const std::string& id, const std::string& content) {
  return json{ { "id", id }, { "mediaType", "text/plain" }, { "text", content },
               { "sha256", sha256(content) } };
}

} // namespace

TEST_CASE("an asset is fetched to a file once, and found by another runtime", "[assets][files]") {
  CacheFolder folder;
  int fetches = 0;
  auto fetch = [&](const std::string&, const std::map<std::string, std::string>&) {
    ++fetches;
    return AssetStore::FetchResponse{ 200, "weights", "" };
  };
  std::vector<std::pair<std::uint64_t, std::uint64_t>> progress;

  AssetStore first(fetch);
  first.setFileCache(folder.cache());
  first.replace({ { "m", pinnedUrl("m", "https://example.com/m.bin", "weights") } });
  const auto one = first.resolvePath("hkp-asset://m",
    [&](std::uint64_t received, std::optional<std::uint64_t> expected) {
      progress.emplace_back(received, expected.value_or(0));
    });

  AssetStore second(fetch);
  second.setFileCache(folder.cache());
  second.replace({ { "other-name", pinnedUrl("other-name", "https://example.org/same.bin", "weights") } });
  const auto two = second.resolvePath("hkp-asset://other-name");

  REQUIRE(one.problem == "");
  REQUIRE(contentOf(one.path) == "weights");
  REQUIRE(one.sha256 == sha256("weights"));
  REQUIRE(two.path == one.path);
  REQUIRE(fetches == 1);
  REQUIRE(progress == std::vector<std::pair<std::uint64_t, std::uint64_t>>{ { 7, 7 } });
}

TEST_CASE("inline content and a file:// source are kept as files too", "[assets][files]") {
  namespace fs = std::filesystem;
  CacheFolder folder;
  const auto root = fs::temp_directory_path() / "hkp-asset-root-path-test";
  fs::create_directories(root);
  std::ofstream(root / "kit.wav", std::ios::binary) << "RIFF";

  AssetStore store;
  store.setFileCache(folder.cache());
  store.setFileRoot(root.string());
  store.replace({
    { "t", pinnedText("t", "abc") },
    { "kit", pinnedUrl("kit", "file:///kit.wav", "RIFF") },
  });

  REQUIRE(contentOf(store.resolvePath("hkp-asset://t").path) == "abc");
  REQUIRE(contentOf(store.resolvePath("hkp-asset://kit").path) == "RIFF");
  fs::remove_all(root);
}

TEST_CASE("nothing is kept that does not match its hash, and why there is no file is said",
          "[assets][files]") {
  CacheFolder folder;
  AssetStore store([](const std::string& url, const std::map<std::string, std::string>&) {
    return url.find("missing") != std::string::npos
             ? AssetStore::FetchResponse{ 404, "", "" }
             : AssetStore::FetchResponse{ 200, "weights", "" };
  });
  store.setFileCache(folder.cache());
  const std::string big(2000, 'x');
  store.replace({
    { "wrong", pinnedUrl("wrong", "https://example.com/m.bin", "something else") },
    { "missing", pinnedUrl("missing", "https://example.com/missing.bin", "weights") },
    { "unpinned", json{ { "id", "unpinned" }, { "mediaType", "text/plain" },
                        { "url", "https://example.com/m.bin" } } },
    { "local", pinnedUrl("local", "file:///etc/passwd", "x") },
    { "big", pinnedText("big", big) },
  });

  auto problem = [&](const std::string& id) { return store.resolvePath("hkp-asset://" + id).problem; };
  REQUIRE(problem("wrong").find("does not match its sha256") != std::string::npos);
  REQUIRE(problem("missing").find("answered 404") != std::string::npos);
  REQUIRE(problem("unpinned").find("does not say its sha256") != std::string::npos);
  REQUIRE(problem("local").find("file:// sources cannot be read") != std::string::npos);
  REQUIRE(problem("big").find("larger than 1024 bytes") != std::string::npos);
  REQUIRE(problem("nothing").find("not known") != std::string::npos);
  REQUIRE(folder.files() == 0);
}

TEST_CASE("the folder lets go of what was used longest ago when it is full", "[assets][files]") {
  namespace fs = std::filesystem;
  CacheFolder folder;
  AssetStore store;
  store.setFileCache(folder.cache());
  std::map<std::string, nlohmann::json> assets;
  for (const char* name : { "a", "b", "c" }) {
    assets[name] = pinnedText(name, std::string(400, name[0]));
  }
  store.replace(assets);

  const auto a = store.resolvePath("hkp-asset://a").path;
  const auto b = store.resolvePath("hkp-asset://b").path;
  const auto long_ago = fs::file_time_type::clock::now() - std::chrono::hours(2);
  fs::last_write_time(a, long_ago);
  fs::last_write_time(b, long_ago + std::chrono::minutes(1));
  store.resolvePath("hkp-asset://a"); // used again, so b is now the oldest
  const auto c = store.resolvePath("hkp-asset://c").path;

  REQUIRE(fs::exists(a));
  REQUIRE(fs::exists(c));
  REQUIRE_FALSE(fs::exists(b));
}

TEST_CASE("a large file arrives in pieces, never held whole", "[assets][files]") {
  namespace net = boost::asio;
  using net::ip::tcp;
  // More than one piece of it, and not a whole number of them.
  std::string body(700 * 1024 + 123, '\0');
  for (std::size_t i = 0; i < body.size(); ++i) body[i] = static_cast<char>('a' + i % 23);

  net::io_context io;
  tcp::acceptor acceptor(io, tcp::endpoint(net::ip::make_address("127.0.0.1"), 0));
  const auto port = acceptor.local_endpoint().port();
  std::thread server([&] {
    tcp::socket socket(io);
    acceptor.accept(socket);
    net::streambuf request;
    boost::system::error_code ec;
    net::read_until(socket, request, "\r\n\r\n", ec);
    net::write(socket, net::buffer("HTTP/1.1 200 OK\r\nContent-Length: " + std::to_string(body.size()) +
                                   "\r\nConnection: close\r\n\r\n" + body), ec);
    socket.shutdown(tcp::socket::shutdown_both, ec);
  });

  CacheFolder folder;
  AssetStore store;
  store.setFileCache(folder.cache(8 * 1024 * 1024));
  store.replace({ { "m", pinnedUrl("m", "http://127.0.0.1:" + std::to_string(port) + "/m.bin", body) } });
  std::vector<std::uint64_t> received;
  std::uint64_t expected = 0;
  const auto resolved = store.resolvePath("hkp-asset://m",
    [&](std::uint64_t got, std::optional<std::uint64_t> total) {
      received.push_back(got);
      expected = total.value_or(0);
    });
  server.join();

  REQUIRE(resolved.problem == "");
  REQUIRE(contentOf(resolved.path) == body);
  REQUIRE(received.size() > 1);
  REQUIRE(received.back() == body.size());
  REQUIRE(expected == body.size());
}

TEST_CASE("whoever waits for a fetch is told how far it is", "[assets][files]") {
  CacheFolder folder;
  const auto files = folder.cache();
  std::atomic<bool> release{ false };
  std::atomic<int> fetches{ 0 };
  auto slow = [&](const std::string&, const std::map<std::string, std::string>&) {
    ++fetches;
    return AssetStore::FetchResponse{ 200, "weights", "" };
  };
  AssetStore fetcher(slow);
  AssetStore waiter(slow);
  for (auto* store : { &fetcher, &waiter }) {
    store->setFileCache(files);
    store->replace({ { "m", pinnedUrl("m", "https://example.com/m.bin", "weights") } });
  }

  // The first holds the fetch open at its first report.
  std::thread first([&] {
    fetcher.resolvePath("hkp-asset://m", [&](std::uint64_t, std::optional<std::uint64_t>) {
      while (!release) std::this_thread::sleep_for(std::chrono::milliseconds(5));
    });
  });
  while (!files->fetching(sha256("weights")))
    std::this_thread::sleep_for(std::chrono::milliseconds(5));

  std::vector<std::uint64_t> heard;
  const auto resolved = waiter.resolvePath("hkp-asset://m",
    [&](std::uint64_t received, std::optional<std::uint64_t>) {
      heard.push_back(received);
      release = true;
    });
  first.join();

  REQUIRE(resolved.problem == "");
  REQUIRE(contentOf(resolved.path) == "weights");
  REQUIRE_FALSE(heard.empty());
  REQUIRE(heard.front() == 7);
  REQUIRE(fetches == 1);
  REQUIRE_FALSE(files->fetching(sha256("weights")).has_value());
}

// ── Models ───────────────────────────────────────────────────────────────────
// What services loaded from those files, shared between them.

TEST_CASE("a model is loaded once for everyone and closed when the last lets go", "[assets][models]") {
  AssetStore store;
  int loads = 0;
  int closed = 0;
  std::function<std::shared_ptr<std::string>()> load = [&] {
    ++loads;
    return std::shared_ptr<std::string>(new std::string("weights"), [&](std::string* model) {
      ++closed;
      delete model;
    });
  };

  auto first = store.models.acquire<std::string>("gpt2:abc", load);
  auto second = store.models.acquire<std::string>("gpt2:abc", load);
  REQUIRE(first.get() == second.get());
  REQUIRE(loads == 1);

  first.reset();
  REQUIRE(closed == 0);
  REQUIRE(store.models.keys() == std::vector<std::string>{ "gpt2:abc" });
  second.reset();
  REQUIRE(closed == 1);
  REQUIRE(store.models.keys().empty());

  auto again = store.models.acquire<std::string>("gpt2:abc", load);
  REQUIRE(loads == 2);
}

TEST_CASE("a load that fails leaves nothing behind", "[assets][models]") {
  AssetStore store;
  std::function<std::shared_ptr<int>()> broken = []() -> std::shared_ptr<int> {
    throw std::runtime_error("not a model");
  };
  REQUIRE_THROWS(store.models.acquire<int>("k", broken));

  std::function<std::shared_ptr<int>()> works = [] { return std::make_shared<int>(7); };
  REQUIRE(*store.models.acquire<int>("k", works) == 7);
}

TEST_CASE("two services asking at once wait for one load", "[assets][models]") {
  AssetStore store;
  std::atomic<int> loads{ 0 };
  std::function<std::shared_ptr<int>()> load = [&] {
    ++loads;
    std::this_thread::sleep_for(std::chrono::milliseconds(50));
    return std::make_shared<int>(7);
  };
  std::shared_ptr<int> got[2];
  std::thread a([&] { got[0] = store.models.acquire<int>("k", load); });
  std::thread b([&] { got[1] = store.models.acquire<int>("k", load); });
  a.join();
  b.join();

  REQUIRE(got[0].get() == got[1].get());
  REQUIRE(loads == 1);
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
