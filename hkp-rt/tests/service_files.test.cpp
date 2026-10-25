#include <catch2/catch_test_macros.hpp>

#include <filesystem>
#include <functional>
#include <string>

#include <types/data.h>

#include <services/cache.h>
#include <services/cache_subservices.h>
#include <services/filesystem.h>
#include <services/monitor.h>
#include <services/wav_reader.h>
#ifdef HKP_MP4_TO_WAV_ENABLED
#include <services/mp4_to_wav.h>
#endif
#ifdef AVCPP_FOUND
#include <services/ffmpeg/ffmpeg.h>
#endif
#include "../lib/src/runtime_host.h"

#include "files_fixture.h"

using namespace hkp;
namespace fs = std::filesystem;

// ──────────────────────────────────────────────────────────────────────────────
// Every service that opens a path a board named opens it through the files
// guard (files.h): inside the folders this server gives boards, and a name
// that arrived as data inside the folder it was configured with.
//
// Each case puts something beside the folder — where the vault, a mount secret
// or settings would be — and checks it is neither read nor written.
// ──────────────────────────────────────────────────────────────────────────────

namespace {

// What the services after the one under test answer: `downstream`.
class DownstreamHost final : public RuntimeHost {
public:
  void attach(Service& svc) { svc.setParentHost(*this); }

  Data processFrom(const Service&, Data, bool, std::function<void(Data)>) override { return downstream; }
  void post(std::function<void()> fn) override { fn(); }
  void scheduleProcessFrom(const Service&, Data, bool) override {}
  bool isConnected(const Service&) const override { return true; }
  void sendData(Data, MessagePurpose, const std::string&, std::function<void(Data)>) override {}
  void notifyProcessFinished(const Service&, const Data&) override {}
  void log(const Service&, LogLevel, const std::string& event, const nlohmann::json& = nullptr) override
  {
    events.push_back(event);
  }
  void forwardLog(const LogEntry&) override {}
  SecretVault& secrets() override { return m_vault; }
  SlotStore& slots() override { return m_slots; }
  std::shared_ptr<SubRuntime> createSubRuntime(const Service&, const json&) override { return nullptr; }

  Data downstream = Null();
  std::vector<std::string> events;
  SecretVault m_vault;
  SlotStore m_slots;
};

std::string text(const Data& data)
{
  auto bytes = getBinaryFromData(data);
  return bytes ? std::string(bytes->begin(), bytes->end()) : std::string();
}

} // namespace

// ── filesystem ────────────────────────────────────────────────────────────────

TEST_CASE("filesystem reads and writes inside the folder it was given", "[services][files]") {
  FilesFixture fixture;
  fixture.write("notes/a.txt", "alpha");

  Filesystem fsService("fs-1");
  fsService.configure(json{{"path", "notes"}, {"operation", "read"}});
  REQUIRE(text(fsService.process(json{{"path", "/a.txt"}})) == "alpha");
  REQUIRE(*getJSONFromData(fsService.process(json{{"path", "/"}})) == json::array({"a.txt"}));

  Filesystem writer("fs-2");
  writer.configure(json{{"path", "notes/b.txt"}, {"operation", "write"}});
  REQUIRE((*getJSONFromData(writer.process(std::string("beta"))))["status"] == "success");
  REQUIRE(FilesFixture::read(fixture.folder() / "notes" / "b.txt") == "beta");
}

TEST_CASE("filesystem keeps a path from the input inside its configured folder", "[services][files]") {
  FilesFixture fixture;
  fixture.write("notes/a.txt", "alpha");
  fixture.writeOutside("secret.txt", "secret");

  Filesystem fsService("fs-1");
  fsService.configure(json{{"path", "notes"}, {"operation", "read"}});

  // `..` out of the folder, and out of the folders altogether.
  REQUIRE(isNull(fsService.process(json{{"path", "/../../secret.txt"}})));
  // An absolute path once the leading slash is gone: still inside.
  REQUIRE(isNull(fsService.process(json{{"path", "/" + (fixture.scratch() / "secret.txt").string()}})));
  REQUIRE(isNull(fsService.process(json{{"path", "//etc/passwd"}})));
}

TEST_CASE("filesystem takes only the file name of meta.path beside bytes", "[services][files]") {
  FilesFixture fixture;
  fs::create_directories(fixture.folder() / "uploads");

  Filesystem fsService("fs-1");
  fsService.configure(json{{"path", "uploads"}, {"operation", "write"}});
  MixedData upload;
  upload.meta = json{{"path", "../../evil.bin"}};
  upload.binary = {'x'};
  auto result = getJSONFromData(fsService.process(Data(upload)));
  REQUIRE((*result)["status"] == "success");
  REQUIRE(fs::exists(fixture.folder() / "uploads" / "evil.bin"));
  REQUIRE_FALSE(fs::exists(fixture.scratch() / "evil.bin"));
}

TEST_CASE("filesystem refuses a configured path outside the folders", "[services][files]") {
  FilesFixture fixture;
  fixture.writeOutside("settings.json", "{}");
  DownstreamHost host;

  Filesystem fsService("fs-1");
  host.attach(fsService);
  fsService.configure(json{{"path", (fixture.scratch() / "settings.json").string()}, {"operation", "write"}});
  auto result = getJSONFromData(fsService.process(json{{"allowedOrigins", json::array({"https://evil.example"})}}));
  REQUIRE((*result)["status"] == "failure");
  REQUIRE((*result)["error"].get<std::string>().find("outside") != std::string::npos);
  REQUIRE(FilesFixture::read(fixture.scratch() / "settings.json") == "{}");
  REQUIRE(host.events == std::vector<std::string>{"file-refused"});

  fsService.configure(json{{"operation", "read"}});
  REQUIRE(isNull(fsService.process(json::object())));
}

TEST_CASE("filesystem reaches nothing on a server that gives no folder", "[services][files]") {
  files::setFolders({});
  Filesystem fsService("fs-1");
  fsService.configure(json{{"path", "anything.txt"}, {"operation", "write"}});
  auto result = getJSONFromData(fsService.process(std::string("x")));
  REQUIRE((*result)["status"] == "failure");
}

TEST_CASE("an operation named by the input stays inside the folder", "[services][files]") {
  FilesFixture fixture;
  fixture.writeOutside("secret.txt", "secret");
  fs::create_directories(fixture.folder() / "served");

  Filesystem fsService("fs-1");
  fsService.configure(json{{"path", "served"}, {"operation", "read"}});
  // Switched to a write by the request: the configured path is a folder, so
  // there is nothing to write to, and nothing outside it is touched.
  fsService.process(json{{"operation", "write"}, {"path", "/../secret.txt"}});
  REQUIRE(FilesFixture::read(fixture.scratch() / "secret.txt") == "secret");
}

// ── monitor ───────────────────────────────────────────────────────────────────

TEST_CASE("monitor logs to a file inside the folders and nowhere else", "[services][files]") {
  FilesFixture fixture;

  Monitor monitor("monitor-1");
  monitor.configure(json{{"fileLogPath", "log.jsonl"}});
  monitor.process(json{{"n", 1}});
  REQUIRE(FilesFixture::read(fixture.folder() / "log.jsonl") == "{\"n\":1}\n");

  monitor.configure(json{{"fileLogPath", (fixture.scratch() / "vault.json").string()}});
  monitor.process(json{{"n", 2}});
  REQUIRE_FALSE(fs::exists(fixture.scratch() / "vault.json"));

  monitor.configure(json{{"fileLogPath", "../appended.txt"}});
  monitor.process(json{{"n", 3}});
  REQUIRE_FALSE(fs::exists(fixture.scratch() / "appended.txt"));
}

// ── wav-reader ────────────────────────────────────────────────────────────────

TEST_CASE("wav-reader reads no file outside the folders", "[services][files]") {
  FilesFixture fixture;
  fixture.writeOutside("take.wav", "RIFF");

  WavReader reader("wav-1");
  reader.configure(json{{"filePath", (fixture.scratch() / "take.wav").string()}});
  REQUIRE(isNull(reader.process()));
  reader.configure(json{{"filePath", "../take.wav"}});
  REQUIRE(isNull(reader.process()));
}

// ── cache ─────────────────────────────────────────────────────────────────────

TEST_CASE("cache persists inside its root and keeps a templated name there", "[services][files]") {
  FilesFixture fixture;
  fs::create_directories(fixture.folder() / "cache");
  DownstreamHost host;
  host.downstream = std::string("fetched");

  Cache cache("cache-1");
  host.attach(cache);
  cache.configure(json{{"key", "url"}, {"persistRoot", "cache"}, {"persistMode", "filename"},
                       {"filenameTemplate", "{{ name }}"}});

  auto answer = cache.process(json{{"url", "https://a/x.mp3"}, {"name", "x.txt"}});
  REQUIRE(isEarlyReturn(answer));
  auto inside = getJSONFromData(getControlFlowData(answer));
  REQUIRE((*inside)["path"] == (fixture.folder() / "cache" / "x.txt").string());
  REQUIRE(FilesFixture::read(fixture.folder() / "cache" / "x.txt") == "fetched");

  // The name comes from the input; `..` in it does not leave the root.
  cache.process(json{{"url", "https://a/y.mp3"}, {"name", "../../escaped.txt"}});
  REQUIRE_FALSE(fs::exists(fixture.scratch() / "escaped.txt"));
  REQUIRE_FALSE(fs::exists(fixture.folder() / "escaped.txt"));
}

TEST_CASE("cache with a root outside the folders keeps to memory", "[services][files]") {
  FilesFixture fixture;
  DownstreamHost host;
  host.downstream = json{{"value", 1}};

  Cache cache("cache-1");
  host.attach(cache);
  cache.configure(json{{"key", "id"}, {"persistRoot", fixture.scratch().string()}});
  cache.process(json{{"id", "k"}});
  REQUIRE(fs::directory_iterator(fixture.scratch() / "folder") == fs::directory_iterator());
  REQUIRE(std::distance(fs::directory_iterator(fixture.scratch()), fs::directory_iterator()) == 1);
}

TEST_CASE("cache-subservices persists only inside the folders", "[services][files]") {
  FilesFixture fixture;
  DownstreamHost host;
  host.downstream = std::string("fetched");

  CacheSubservices cache("cache-2");
  host.attach(cache);
  cache.configure(json{{"key", "url"}, {"persistRoot", "../"}, {"persistMode", "filename"}});
  cache.process(json{{"url", "https://a/escaped.txt"}});
  REQUIRE_FALSE(fs::exists(fixture.scratch() / "escaped.txt"));
}

// ── mp4-to-wav, ffmpeg: built where their libraries are ───────────────────────

#ifdef HKP_MP4_TO_WAV_ENABLED
TEST_CASE("mp4-to-wav opens no input and writes no output outside the folders", "[services][files]") {
  FilesFixture fixture;
  fixture.writeOutside("video.mp4", "not really");

  Mp4ToWav converter("mp4-1");
  auto refused = getJSONFromData(converter.process(json{{"path", (fixture.scratch() / "video.mp4").string()}}));
  REQUIRE(refused->contains("error"));
  REQUIRE((*refused)["error"].get<std::string>().find("outside") != std::string::npos);

  fixture.write("video.mp4", "not really");
  converter.configure(json{{"outputDir", fixture.scratch().string()}});
  auto out = getJSONFromData(converter.process(json{{"path", "video.mp4"}}));
  REQUIRE((*out)["error"].get<std::string>().find("outside") != std::string::npos);
  REQUIRE_FALSE(fs::exists(fixture.scratch() / "video.wav"));
}
#endif

#ifdef AVCPP_FOUND
TEST_CASE("ffmpeg opens a file inside the folders, never a URL or a file outside", "[services][files]") {
  FilesFixture fixture;
  fixture.writeOutside("song.mp3", "not really");

  Ffmpeg ffmpeg("ffmpeg-1");
  auto outside = getJSONFromData(ffmpeg.process(json{{"input", (fixture.scratch() / "song.mp3").string()},
                                                     {"output", "song.wav"}}));
  REQUIRE((*outside)["error"].get<std::string>().find("outside") != std::string::npos);

  auto escaping = getJSONFromData(ffmpeg.process(json{{"input", "song.mp3"}, {"output", "../../song.wav"}}));
  REQUIRE((*escaping)["error"].get<std::string>().find("outside") != std::string::npos);
  REQUIRE_FALSE(fs::exists(fixture.scratch() / "song.wav"));
}
#endif
