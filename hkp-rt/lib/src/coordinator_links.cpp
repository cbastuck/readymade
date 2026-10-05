#include <coordinator_links.h>

#include <algorithm>
#include <atomic>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <vector>
#include <map>
#include <functional>
#include <future>
#include <iostream>
#include <mutex>
#include <stdexcept>
#include <thread>

#include <boost/asio.hpp>

#ifndef _WIN32
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>
#endif

#include <app.h>
#include <log_entry.h>

#include "./binary_frame.h"
#include "./process_context.h"
#include "./common/link_socket.h"

namespace hkp
{

namespace net = boost::asio;

namespace {

// A runtime id is unique within a board, so a link is known by both. NUL
// occurs in neither.
std::string linkKey(const LinkRecord& record)
{
  return record.boardName + '\0' + record.runtimeId;
}

// A board's runtimes are kept apart from what the server's clients create and
// from every other board's; see App. A link always names its board, so a
// board's space is never the api's, which is the empty one.
const std::string& spaceOf(const LinkRecord& record)
{
  return record.boardName;
}

// Close codes a link reads to decide whether to come back. Only these two are
// final; anything else — a network drop, a coordinator restarting — is
// something it reconnects through.
constexpr unsigned CLOSE_TICKET_REVOKED = 4403;
constexpr unsigned CLOSE_REPLACED = 4409;

const char* const JOIN_PATH = "/join";
// What this server calls itself; the same word GET /runtimes answers with.
const char* const SERVER_KIND = "c++";

// ── Stores ───────────────────────────────────────────────────────────────────

class MemoryLinkStore final : public LinkStore
{
public:
  std::vector<LinkRecord> load() override
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    return m_held;
  }
  void save(const std::vector<LinkRecord>& records) override
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_held = records;
  }

private:
  std::mutex m_mutex;
  std::vector<LinkRecord> m_held;
};

class FileLinkStore final : public LinkStore
{
public:
  explicit FileLinkStore(std::string file) : m_file(std::move(file)) {}

  std::vector<LinkRecord> load() override
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    std::vector<LinkRecord> records;
    std::ifstream in(m_file);
    if (!in)
    {
      // Not written yet: there is nothing to reconnect with, and the next
      // introduction writes it afresh.
      return records;
    }
    const json parsed = json::parse(in, nullptr, /*allow_exceptions=*/false);
    if (!parsed.is_array())
    {
      return records;
    }
    for (const auto& entry : parsed)
    {
      if (!entry.is_object())
      {
        continue;
      }
      const auto text = [&entry](const char* key) {
        const auto it = entry.find(key);
        return it != entry.end() && it->is_string() ? it->get<std::string>() : std::string();
      };
      LinkRecord record{text("boardName"), text("runtimeId"),
                        text("coordinatorUrl"), text("ticket")};
      if (!record.boardName.empty() && !record.runtimeId.empty() &&
          !record.coordinatorUrl.empty() && !record.ticket.empty())
      {
        records.push_back(std::move(record));
      }
    }
    return records;
  }

  void save(const std::vector<LinkRecord>& records) override
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    json out = json::array();
    for (const auto& record : records)
    {
      out.push_back(json{
        {"boardName", record.boardName},
        {"runtimeId", record.runtimeId},
        {"coordinatorUrl", record.coordinatorUrl},
        {"ticket", record.ticket},
      });
    }
    const std::string text = out.dump(2);

    namespace fs = std::filesystem;
    std::error_code ec;
    const fs::path file(m_file);
    if (file.has_parent_path())
    {
      fs::create_directories(file.parent_path(), ec);
#ifndef _WIN32
      ::chmod(file.parent_path().c_str(), 0700);
#endif
    }
    // Written beside the file and moved into place, so a crash mid-write
    // leaves the tickets that were there rather than half of the new ones.
    const std::string temporary = m_file + ".tmp";
#ifndef _WIN32
    const int fd = ::open(temporary.c_str(), O_WRONLY | O_CREAT | O_TRUNC, 0600);
    if (fd < 0)
    {
      std::cerr << "[coordinator-link] Could not write " << m_file << std::endl;
      return;
    }
    // Whatever the umask or an earlier file made of it.
    ::fchmod(fd, 0600);
    const ssize_t written = ::write(fd, text.data(), text.size());
    ::close(fd);
    if (written != static_cast<ssize_t>(text.size()))
    {
      std::cerr << "[coordinator-link] Could not write " << m_file << std::endl;
      std::remove(temporary.c_str());
      return;
    }
#else
    {
      std::ofstream outFile(temporary, std::ios::binary | std::ios::trunc);
      outFile << text;
    }
#endif
    fs::rename(temporary, file, ec);
    if (ec)
    {
      std::cerr << "[coordinator-link] Could not write " << m_file << ": "
                << ec.message() << std::endl;
    }
  }

private:
  std::mutex m_mutex;
  std::string m_file;
};

// ── One link ─────────────────────────────────────────────────────────────────

struct Link
{
  LinkRecord record;

  std::mutex secretsMutex;
  std::map<std::string, SecretEntry> secrets;

  // Touched on the event loop only.
  std::shared_ptr<LinkSocket> socket;
  std::unique_ptr<net::steady_timer> timer;
  unsigned attempts = 0;
  // Which connection attempt is current; what an earlier one reports is not
  // acted on.
  unsigned generation = 0;

  std::atomic<bool> welcomed{false};
  std::atomic<bool> disposed{false};

  // How the first attempt went, told once to whoever introduced the link.
  std::mutex firstMutex;
  std::function<void(const std::string&)> onFirst;

  void settleFirst(const std::string& reason)
  {
    std::function<void(const std::string&)> report;
    {
      std::lock_guard<std::mutex> lock(firstMutex);
      report.swap(onFirst);
    }
    if (report)
    {
      report(reason);
    }
  }
};

std::string describeData(const Data& data)
{
  try
  {
    return stringify(data);
  }
  catch (const std::exception&)
  {
    return "<unprintable>";
  }
}

}  // namespace

// ── Public helpers ───────────────────────────────────────────────────────────

std::shared_ptr<LinkStore> createMemoryLinkStore()
{
  return std::make_shared<MemoryLinkStore>();
}

std::shared_ptr<LinkStore> createFileLinkStore(const std::string& file)
{
  return std::make_shared<FileLinkStore>(file);
}

std::string joinUrlFor(const std::string& coordinatorUrl)
{
  std::string rest;
  std::string scheme;
  if (coordinatorUrl.rfind("https://", 0) == 0)
  {
    scheme = "wss://";
    rest = coordinatorUrl.substr(8);
  }
  else if (coordinatorUrl.rfind("http://", 0) == 0)
  {
    scheme = "ws://";
    rest = coordinatorUrl.substr(7);
  }
  else
  {
    throw std::invalid_argument("Not a coordinator address: " + coordinatorUrl);
  }
  // Only where it is, not what was asked of it.
  rest = rest.substr(0, rest.find_first_of("?#"));
  while (!rest.empty() && rest.back() == '/')
  {
    rest.pop_back();
  }
  if (rest.empty() || rest[0] == '/')
  {
    throw std::invalid_argument("Not a coordinator address: " + coordinatorUrl);
  }
  return scheme + rest + JOIN_PATH;
}

// ── The links ────────────────────────────────────────────────────────────────

struct CoordinatorLinks::impl : public std::enable_shared_from_this<CoordinatorLinks::impl>
{
  impl(std::shared_ptr<App> a, std::shared_ptr<LinkStore> s, CoordinatorLinksOptions o)
    : app(std::move(a))
    , store(std::move(s))
    , options(std::move(o))
    , workGuard(net::make_work_guard(work))
    , worker([this]() { work.run(); })
  {
  }

  std::shared_ptr<App> app;
  std::shared_ptr<LinkStore> store;
  CoordinatorLinksOptions options;

  mutable std::mutex mutex;
  std::map<std::string, std::shared_ptr<Link>> links;
  std::atomic<bool> stopped{false};

  // Where a coordinator's requests are carried out. Not the event loop: a
  // pipeline may run for a while, and the connection it arrived on has to go
  // on answering pings meanwhile or the coordinator takes the runtime for gone.
  // One thread, so what a coordinator asks happens in the order it asked.
  net::io_context work;
  net::executor_work_guard<net::io_context::executor_type> workGuard;
  std::thread worker;

  // ── Sending ────────────────────────────────────────────────────────────────

  void sendText(const std::shared_ptr<Link>& link, std::string text)
  {
    app->postCallback([link, text = std::move(text)]() {
      if (!link->disposed && link->socket)
      {
        link->socket->sendText(text);
      }
    });
  }

  /**
   * The runtime said something; only a welcomed link has anyone to tell.
   *
   * `run` is the run it was said in, or null outside one. A result carries it
   * whole, so the coordinator can tell the board's next runtime which run this
   * continues and who began it; a notification carries the caller, which is
   * how the coordinator knows whose it is to hear.
   */
  void emitData(const std::shared_ptr<Link>& link, const Data& data,
                MessagePurpose purpose, const std::string& sender,
                const ProcessContext* run)
  {
    if (!link->welcomed || link->disposed || !link->socket)
    {
      return;
    }

    if (purpose == MessagePurpose::NOTIFICATION)
    {
      // For a person to read, so bytes are described rather than carried.
      const auto asJson = getJSONFromData(data);
      json said = {
        {"type", "notification"},
        {"serviceUuid", sender},
        {"payload", asJson ? *asJson : json(describeData(data))},
      };
      if (run && !run->caller.empty())
      {
        said["caller"] = run->caller.toJson();
      }
      link->socket->sendText(said.dump(-1, ' ', false, json::error_handler_t::replace));
      return;
    }

    // What the runtime hands to the next one.
    const Data value = isControlFlowData(data) ? getControlFlowData(data) : data;
    if (isNull(value) || isUndefined(value) || isCustomData(value))
    {
      return;
    }
    // The header is the message without its value, so the run it belongs to
    // travels in it whether the value is bytes or not.
    json header = {{"type", "result"}};
    if (run)
    {
      header["context"] = run->toWire();
    }
    if (const auto binary = binary_frame::toBinary(value))
    {
      link->socket->sendBinary(
        binary_frame::encode(header, binary->first, binary->second));
      return;
    }
    json carried;
    if (const auto asJson = getJSONFromData(value))
    {
      carried = *asJson;
    }
    else if (const auto text = getStringFromData(value))
    {
      carried = *text;
    }
    else
    {
      return;
    }
    header["data"] = carried;
    link->socket->sendText(header.dump(-1, ' ', false, json::error_handler_t::replace));
  }

  void emitLog(const std::shared_ptr<Link>& link, const LogEntry& entry)
  {
    if (!link->welcomed || link->disposed || !link->socket)
    {
      return;
    }
    link->socket->sendText(
      json{{"type", "log"}, {"entry", entry.toJson()}}
        .dump(-1, ' ', false, json::error_handler_t::replace));
  }

  void listenTo(const std::shared_ptr<Link>& link)
  {
    std::weak_ptr<impl> weakSelf = shared_from_this();
    std::weak_ptr<Link> weakLink = link;
    App::RuntimeOutputSink sink;
    sink.onData = [weakSelf, weakLink](const Data& data, MessagePurpose purpose,
                                       const std::string& sender,
                                       const ProcessContext* run) {
      auto self = weakSelf.lock();
      auto held = weakLink.lock();
      if (self && held)
      {
        self->emitData(held, data, purpose, sender, run);
      }
    };
    sink.onLog = [weakSelf, weakLink](const LogEntry& entry) {
      auto self = weakSelf.lock();
      auto held = weakLink.lock();
      if (self && held)
      {
        self->emitLog(held, entry);
      }
    };
    app->setRuntimeOutputSink(link->record.runtimeId, std::move(sink), spaceOf(link->record));
  }

  // ── Connecting (event loop) ────────────────────────────────────────────────

  void open(const std::shared_ptr<Link>& link)
  {
    if (link->disposed || stopped)
    {
      return;
    }
    link->welcomed = false;
    const unsigned generation = ++link->generation;

    LinkSocket::Options socketOptions;
    try
    {
      socketOptions.url = joinUrlFor(link->record.coordinatorUrl);
    }
    catch (const std::exception& e)
    {
      link->settleFirst(e.what());
      return;
    }
    socketOptions.bearer = link->record.ticket;
    socketOptions.idleTimeout = options.idleTimeout;
    socketOptions.handshakeTimeout = options.introduceTimeout;
    socketOptions.trustedRootPem = options.trustedRootPem;

    std::weak_ptr<impl> weakSelf = shared_from_this();
    LinkSocket::Handlers handlers;
    handlers.onOpen = [weakSelf, link, generation]() {
      auto self = weakSelf.lock();
      if (!self || link->disposed || link->generation != generation || !link->socket)
      {
        return;
      }
      link->socket->sendText(json{
        {"type", "hello"},
        {"server", SERVER_KIND},
        {"registry", self->app->getRegistry()},
        {"runtimeExists", self->app->getRuntime(link->record.runtimeId, spaceOf(link->record)).has_value()},
      }.dump());
    };
    handlers.onMessage = [weakSelf, link, generation](std::string message, bool isBinary) {
      auto self = weakSelf.lock();
      if (self && !link->disposed && link->generation == generation)
      {
        self->onMessage(link, std::move(message), isBinary);
      }
    };
    handlers.onClose = [weakSelf, link, generation](const LinkSocket::Closed& closed) {
      auto self = weakSelf.lock();
      if (self && !link->disposed && link->generation == generation)
      {
        self->onClosed(link, closed);
      }
    };
    link->socket = LinkSocket::open(app->ioContext(), std::move(socketOptions),
                                    std::move(handlers));
  }

  void onClosed(const std::shared_ptr<Link>& link, const LinkSocket::Closed& closed)
  {
    link->welcomed = false;
    link->socket.reset();

    // The coordinator refused the upgrade. 401 is its answer to a ticket it
    // does not hold — replaced, or belonging to a board that was deleted.
    if (closed.httpStatus == 401 || closed.httpStatus == 403)
    {
      link->settleFirst("the coordinator did not accept the ticket");
      reject(link);
      return;
    }
    // Revoked, or another runtime server took this runtime's place in the
    // board. Either way this server's copy is no longer the board's, and
    // reconnecting would only fight whoever holds the place now.
    if (closed.code == CLOSE_TICKET_REVOKED || closed.code == CLOSE_REPLACED)
    {
      link->settleFirst("connection closed (" + std::to_string(closed.code) + ")");
      reject(link);
      return;
    }

    if (closed.httpStatus != 0)
    {
      link->settleFirst("the coordinator answered " + std::to_string(closed.httpStatus));
    }
    else if (!closed.reason.empty())
    {
      link->settleFirst(closed.reason);
    }
    else
    {
      link->settleFirst("connection closed (" + std::to_string(closed.code) + ")");
    }
    retry(link);
  }

  void retry(const std::shared_ptr<Link>& link)
  {
    if (link->disposed || stopped)
    {
      return;
    }
    const auto shift = std::min<unsigned>(link->attempts, 16);
    const auto delay = std::min(options.maxReconnectDelay,
                                options.reconnectDelay * (1u << shift));
    link->attempts += 1;
    link->timer = std::make_unique<net::steady_timer>(app->ioContext(), delay);
    std::weak_ptr<impl> weakSelf = shared_from_this();
    link->timer->async_wait([weakSelf, link](const boost::system::error_code& ec) {
      auto self = weakSelf.lock();
      if (!ec && self)
      {
        self->open(link);
      }
    });
  }

  /** Stops a link for good, without telling anyone. Event loop only. */
  void dispose(const std::shared_ptr<Link>& link)
  {
    link->disposed = true;
    link->welcomed = false;
    if (link->timer)
    {
      link->timer->cancel();
      link->timer.reset();
    }
    if (link->socket)
    {
      link->socket->close();
      link->socket.reset();
    }
  }

  /**
   * The coordinator no longer holds this ticket, so the runtime it was for is
   * nobody's: it was built to outlive its clients, and the only party that
   * would have released it has just said it is not theirs.
   */
  void reject(const std::shared_ptr<Link>& link)
  {
    dispose(link);
    bool current = false;
    {
      std::lock_guard<std::mutex> lock(mutex);
      auto it = links.find(linkKey(link->record));
      if (it != links.end() && it->second == link)
      {
        links.erase(it);
        current = true;
      }
    }
    if (!current)
    {
      return;
    }
    app->clearRuntimeOutputSink(link->record.runtimeId, spaceOf(link->record));
    auto self = shared_from_this();
    const LinkRecord record = link->record;
    // After whatever the coordinator last asked for, which may still be running.
    net::post(work, [self, record]() {
      self->app->removeRuntime(record.runtimeId, spaceOf(record));
    });
    persist();
  }

  void persist()
  {
    std::vector<LinkRecord> records;
    {
      std::lock_guard<std::mutex> lock(mutex);
      for (const auto& [_, link] : links)
      {
        records.push_back(link->record);
      }
    }
    store->save(records);
  }

  // ── What a coordinator says (event loop → worker) ──────────────────────────

  void onMessage(const std::shared_ptr<Link>& link, std::string message, bool isBinary)
  {
    auto self = shared_from_this();

    if (isBinary)
    {
      // Input for the pipeline that holds bytes; see binary_frame.h.
      auto frame = binary_frame::decode(message);
      if (!frame || frame->header.value("type", std::string()) != "processRuntime")
      {
        return;
      }
      const json context = frame->header.contains("context") ? frame->header["context"] : json();
      net::post(work, [self, link, frame = std::move(*frame), context]() {
        self->process(link, binary_frame::fromBinary(frame.shape, frame.payload), context);
      });
      return;
    }

    json parsed = json::parse(message, nullptr, /*allow_exceptions=*/false);
    if (!parsed.is_object() || !parsed.contains("type") || !parsed["type"].is_string())
    {
      return;
    }
    const auto type = parsed["type"].get<std::string>();

    if (type == "welcome")
    {
      link->welcomed = true;
      link->attempts = 0;
      link->settleFirst("");
      return;
    }

    if (type == "processRuntime")
    {
      if (!parsed.contains("params"))
      {
        return;
      }
      const json params = parsed["params"];
      const json context = parsed.contains("context") ? parsed["context"] : json();
      net::post(work, [self, link, params, context]() {
        // A null payload is a run with nothing on the input: JSON has no
        // undefined, so that is how a sender says it.
        self->process(link, params.is_null() ? Data() : Data(params), context);
      });
      return;
    }

    if (type == "request")
    {
      net::post(work, [self, link, request = std::move(parsed)]() {
        self->answer(link, request);
      });
    }
  }

  // ── Carrying requests out (worker) ─────────────────────────────────────────

  void process(const std::shared_ptr<Link>& link, const Data& data, const json& context)
  {
    if (link->disposed)
    {
      return;
    }
    try
    {
      // The result is not sent from here: a run's result leaves through the
      // runtime's output, which this link listens to, the same as a result
      // the runtime produces on its own.
      //
      // The coordinator names the run its call belongs to — and who began it,
      // which is taken as stated on this path and on no other.
      app->processRuntimeAs(link->record.runtimeId, data, ProcessContext::fromLink(context),
                            spaceOf(link->record));
    }
    catch (const std::exception& e)
    {
      std::cerr << "[coordinator-link] Runtime \"" << link->record.runtimeId
                << "\" failed to process: " << e.what() << std::endl;
    }
  }

  void answer(const std::shared_ptr<Link>& link, const json& request)
  {
    const json requestId = request.contains("requestId") ? request["requestId"] : json();
    json response = {{"type", "response"}, {"requestId", requestId}};
    try
    {
      response["data"] = serve(link, request);
      response["ok"] = true;
    }
    catch (const std::exception& e)
    {
      response.erase("data");
      response["ok"] = false;
      response["error"] = e.what();
    }
    sendText(link, response.dump(-1, ' ', false, json::error_handler_t::replace));
  }

  json reportedServices(const LinkRecord& record)
  {
    json services = json::array();
    const json held = app->getServices(record.runtimeId, spaceOf(record));
    if (held.is_array())
    {
      for (auto service : held)
      {
        // What a coordinator knows a service by is its uuid.
        if (service.contains("instanceId"))
        {
          service["uuid"] = service["instanceId"];
        }
        services.push_back(std::move(service));
      }
    }
    return services;
  }

  json serve(const std::shared_ptr<Link>& link, const json& request)
  {
    const std::string runtimeId = link->record.runtimeId;
    const std::string& space = spaceOf(link->record);
    const auto op = request.value("op", std::string());

    if (op == "provision")
    {
      json description = {
        {"id", runtimeId},
        {"name", request.value("name", runtimeId)},
        {"state", request.contains("state") ? request["state"] : json::object()},
        {"services", request.contains("services") ? request["services"] : json::array()},
        // The board's assets for this runtime, as the coordinator sends them:
        // descriptors, by id.
        {"assets", request.contains("assets") ? request["assets"] : json::object()},
      };
      auto config = validateRuntime(description);
      if (!config)
      {
        throw std::runtime_error("The board's description of this runtime is malformed");
      }
      // The board this link was introduced for, whatever the request says: a
      // ticket speaks for one board.
      config->boardName = link->record.boardName;
      config->space = space;
      // The coordinator's until it says otherwise: a deployed board keeps
      // running with nobody watching.
      config->garbageCollected = false;
      // The values this server was handed for the runtime, by the person's own
      // client. They do not come from the coordinator and never go to it.
      std::vector<std::string> held;
      {
        std::lock_guard<std::mutex> lock(link->secretsMutex);
        config->secrets = link->secrets;
        for (const auto& [alias, _] : link->secrets)
        {
          held.push_back(alias);
        }
      }
      app->createRuntime(*config);

      json missing = json::array();
      for (const auto& alias : referencedSecrets(description["services"]))
      {
        if (std::find(held.begin(), held.end(), alias) == held.end())
        {
          missing.push_back(alias);
        }
      }
      return json{
        {"registry", app->getRegistry()},
        {"services", reportedServices(link->record)},
        {"missingSecrets", missing},
      };
    }

    if (op == "describe")
    {
      if (!app->getRuntime(runtimeId, space))
      {
        throw std::runtime_error("the runtime is not running");
      }
      return json{{"services", reportedServices(link->record)}};
    }

    if (op == "configureService")
    {
      if (!app->getRuntime(runtimeId, space))
      {
        throw std::runtime_error("the runtime is not running");
      }
      const auto serviceUuid = request.value("serviceUuid", std::string());
      const json config = request.contains("config") ? request["config"] : json();
      if (!config.is_object())
      {
        throw std::runtime_error("a service is configured with an object");
      }
      const json state = app->configureService(runtimeId, serviceUuid, config, space);
      if (state.is_boolean() && !state.get<bool>())
      {
        throw std::runtime_error("no service \"" + serviceUuid + "\"");
      }
      return state;
    }

    if (op == "processService")
    {
      // Begin at one service: what a facade's process action means on a
      // deployed board. Answered once the work is taken; what the pipeline
      // produces leaves through the runtime's output, as any result does.
      if (!app->getRuntime(runtimeId, space))
      {
        throw std::runtime_error("the runtime is not running");
      }
      const auto serviceUuid = request.value("serviceUuid", std::string());
      if (serviceUuid.empty() || !app->hasService(runtimeId, serviceUuid, space))
      {
        throw std::runtime_error("no service \"" + serviceUuid + "\"");
      }
      const json params = request.contains("params") ? request["params"] : json();
      // As on `process`: the run and its caller are the coordinator's to
      // state, over this link and nowhere else.
      const auto context = ProcessContext::fromLink(
        request.contains("context") ? request["context"] : json());
      auto self = shared_from_this();
      // After the answer, which says only that the work was taken: a pipeline
      // may run for longer than a coordinator waits for one.
      net::post(work, [self, link, serviceUuid, params, context]() {
        if (link->disposed)
        {
          return;
        }
        try
        {
          self->app->processServiceAtAs(
            link->record.runtimeId, serviceUuid,
            params.is_null() ? Data() : Data(params), context, spaceOf(link->record));
        }
        catch (const std::exception& e)
        {
          std::cerr << "[coordinator-link] Runtime \"" << link->record.runtimeId
                    << "\" failed to process at \"" << serviceUuid << "\": " << e.what()
                    << std::endl;
        }
      });
      return json{{"accepted", true}};
    }

    if (op == "setState")
    {
      const json settings = app->setRuntimeState(
        runtimeId, request.contains("state") ? request["state"] : json::object(), space);
      if (settings.is_null())
      {
        throw std::runtime_error("the runtime is not running");
      }
      return settings;
    }

    if (op == "remove")
    {
      // Removing one that is not there is a success: gone is what was asked.
      app->removeRuntime(runtimeId, space);
      return json::object();
    }

    throw std::runtime_error("Unknown operation \"" + op + "\"");
  }

  // ── Running something on the event loop and waiting for it ─────────────────

  void onLoop(std::function<void()> task)
  {
    auto done = std::make_shared<std::promise<void>>();
    auto finished = done->get_future();
    app->postCallback([task = std::move(task), done]() {
      task();
      done->set_value();
    });
    // Bounded, so that a loop which has already stopped cannot hold a caller
    // forever; what was posted simply never runs.
    finished.wait_for(std::chrono::seconds(5));
  }
};

CoordinatorLinks::CoordinatorLinks(std::shared_ptr<App> app,
                                   std::shared_ptr<LinkStore> store,
                                   CoordinatorLinksOptions options)
  : m_impl(std::make_shared<impl>(std::move(app), std::move(store), std::move(options)))
{
}

CoordinatorLinks::~CoordinatorLinks()
{
  stop();
}

std::string CoordinatorLinks::introduce(const LinkRecord& record,
                                        std::map<std::string, SecretEntry> secrets)
{
  // Validated before anything is replaced: a malformed address must not cost a
  // runtime the link it already has.
  std::string joinUrl;
  try
  {
    joinUrl = joinUrlFor(record.coordinatorUrl);
  }
  catch (const std::exception& e)
  {
    return e.what();
  }

  auto self = m_impl;
  // A runtime already connected to that coordinator stays as it is: being
  // introduced is the first step of a deploy that may yet fail, and must not
  // change what is running. One connected to a different coordinator is not
  // taken from it.
  {
    std::shared_ptr<Link> existing;
    {
      std::lock_guard<std::mutex> lock(self->mutex);
      auto it = self->links.find(linkKey(record));
      if (it != self->links.end() && it->second->welcomed.load())
      {
        existing = it->second;
      }
    }
    if (existing)
    {
      if (joinUrlFor(existing->record.coordinatorUrl) != joinUrl)
      {
        return "\"" + record.boardName + "\" is already deployed here by " +
          existing->record.coordinatorUrl;
      }
      std::lock_guard<std::mutex> lock(existing->secretsMutex);
      existing->secrets = std::move(secrets);
      return "";
    }
  }

  auto link = std::make_shared<Link>();
  link->record = record;
  link->secrets = std::move(secrets);

  auto outcome = std::make_shared<std::promise<std::string>>();
  auto reported = outcome->get_future();
  link->onFirst = [outcome](const std::string& reason) { outcome->set_value(reason); };

  self->onLoop([self, link]() {
    std::shared_ptr<Link> previous;
    {
      std::lock_guard<std::mutex> lock(self->mutex);
      auto it = self->links.find(linkKey(link->record));
      if (it != self->links.end())
      {
        previous = it->second;
      }
      self->links[linkKey(link->record)] = link;
    }
    // The runtime the earlier link was for stays: the coordinator decides,
    // over the new connection, whether to pick it up or build it again.
    if (previous)
    {
      self->dispose(previous);
    }
    self->listenTo(link);
    self->open(link);
  });

  std::string reason = "the coordinator did not answer";
  if (reported.wait_for(self->options.introduceTimeout) == std::future_status::ready)
  {
    reason = reported.get();
  }

  if (!reason.empty())
  {
    self->onLoop([self, link]() {
      self->dispose(link);
      bool current = false;
      {
        std::lock_guard<std::mutex> lock(self->mutex);
        auto it = self->links.find(linkKey(link->record));
        if (it != self->links.end() && it->second == link)
        {
          self->links.erase(it);
          current = true;
        }
      }
      if (current)
      {
        self->app->clearRuntimeOutputSink(link->record.runtimeId, spaceOf(link->record));
      }
    });
  }
  self->persist();
  return reason;
}

void CoordinatorLinks::restore()
{
  auto self = m_impl;
  const auto records = self->store->load();
  self->onLoop([self, records]() {
    for (const auto& record : records)
    {
      auto link = std::make_shared<Link>();
      link->record = record;
      {
        std::lock_guard<std::mutex> lock(self->mutex);
        if (self->links.count(linkKey(record)) > 0)
        {
          continue;
        }
        self->links[linkKey(record)] = link;
      }
      self->listenTo(link);
      self->open(link);
    }
  });
}

json CoordinatorLinks::list() const
{
  json out = json::array();
  std::lock_guard<std::mutex> lock(m_impl->mutex);
  for (const auto& [_, link] : m_impl->links)
  {
    out.push_back(json{
      {"boardName", link->record.boardName},
      {"runtimeId", link->record.runtimeId},
      {"coordinatorUrl", link->record.coordinatorUrl},
      {"connected", link->welcomed.load()},
      {"running", m_impl->app->getRuntime(link->record.runtimeId, spaceOf(link->record)).has_value()},
    });
  }
  return out;
}

bool CoordinatorLinks::remove(const std::string& boardName, const std::string& runtimeId)
{
  auto self = m_impl;
  std::shared_ptr<Link> link;
  {
    std::lock_guard<std::mutex> lock(self->mutex);
    auto it = self->links.find(linkKey(LinkRecord{boardName, runtimeId}));
    if (it == self->links.end())
    {
      return false;
    }
    link = it->second;
    self->links.erase(it);
  }
  self->onLoop([self, link]() { self->dispose(link); });
  self->app->clearRuntimeOutputSink(runtimeId, spaceOf(link->record));
  self->app->removeRuntime(runtimeId, spaceOf(link->record));
  self->persist();
  return true;
}

void CoordinatorLinks::stop()
{
  auto self = m_impl;
  if (self->stopped.exchange(true))
  {
    return;
  }
  std::vector<std::shared_ptr<Link>> held;
  {
    std::lock_guard<std::mutex> lock(self->mutex);
    for (const auto& [_, link] : self->links)
    {
      held.push_back(link);
    }
    self->links.clear();
  }
  self->onLoop([self, held]() {
    for (const auto& link : held)
    {
      self->dispose(link);
    }
  });
  for (const auto& link : held)
  {
    self->app->clearRuntimeOutputSink(link->record.runtimeId, spaceOf(link->record));
  }
  self->workGuard.reset();
  self->work.stop();
  if (self->worker.joinable())
  {
    self->worker.join();
  }
}

}
