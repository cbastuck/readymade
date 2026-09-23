#include "./http_server_subservices.h"

#include "../../mount.h"

#include <boost/beast.hpp>
#include <boost/asio/strand.hpp>
#include <boost/json.hpp>

#include "./http_server_impl.h"
#include "./http_listener.h"
#include "./http_session.h"
#include "./request_decode.h"
#include "../../uuid.h"

#include <algorithm>
#include <optional>
#include <string>
#include <thread>

#if !defined(_WIN32)
#include <ifaddrs.h>
#include <net/if.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#endif

namespace beast = boost::beast;
namespace http = beast::http;
namespace net = boost::asio;
using tcp = net::ip::tcp;

namespace {

// Best-effort primary LAN IPv4, so the running server can advertise a link that
// other devices on the same network can reach (it binds 0.0.0.0). Prefers the
// Wi-Fi interface (en0 on Apple platforms). Falls back to loopback.
std::string primaryIPv4()
{
  std::string result = "127.0.0.1";
#if !defined(_WIN32)
  struct ifaddrs* ifaddr = nullptr;
  if (getifaddrs(&ifaddr) == -1)
  {
    return result;
  }
  bool foundPreferred = false;
  for (struct ifaddrs* ifa = ifaddr; ifa != nullptr; ifa = ifa->ifa_next)
  {
    if (!ifa->ifa_addr || ifa->ifa_addr->sa_family != AF_INET)
    {
      continue;
    }
    if (!(ifa->ifa_flags & IFF_UP) || (ifa->ifa_flags & IFF_LOOPBACK))
    {
      continue;
    }
    char buf[INET_ADDRSTRLEN] = {0};
    auto* sin = reinterpret_cast<struct sockaddr_in*>(ifa->ifa_addr);
    if (!inet_ntop(AF_INET, &sin->sin_addr, buf, sizeof(buf)))
    {
      continue;
    }
    const std::string name = ifa->ifa_name ? ifa->ifa_name : "";
    if (!foundPreferred)
    {
      result = buf; // first non-loopback candidate
    }
    if (name == "en0") // Wi-Fi on iOS/macOS — strongly preferred
    {
      result = buf;
      foundPreferred = true;
      break;
    }
  }
  freeifaddrs(ifaddr);
#endif
  return result;
}

} // namespace

namespace hkp {

using namespace request_decode;

HttpServerSubservices::HttpServerSubservices(const std::string& instanceId)
  : Service(instanceId, serviceId())
  , m_impl(std::make_shared<HttpServerImpl>())
{
  m_bypass = true; // Start in bypass mode
  // Where the nested pipeline is entered from. Alternatives:
  //   process_on_data — data from the outer chain is stored and served back to
  //     requests verbatim; the nested pipeline is not used.
  //   process_on_both — both entry points run the nested pipeline. It is a
  //     single ordered list either way, so a service inside it that needs to
  //     tell a request from a data arrival has to do so from the input.
  m_mode = "process_on_session";
  m_impl->setOnSessionOpenedCallback(
    [this](std::shared_ptr<Session> session, const std::string& path, const std::string& method) {
      onNewSession(session, path, method);
    }
  );
}

HttpServerSubservices::~HttpServerSubservices()
{
  m_impl->stop();
}

void HttpServerSubservices::onNewSession(std::shared_ptr<Session> session,
                                         const std::string& path,
                                         const std::string& method,
                                         bool awaitResponse)
{
  if (!session)
  {
    return;
  }

  // Describe the request the same way hkp-node's http-server-subservices does,
  // so a pipeline written for one runtime works on the other:
  //   meta.method / meta.path / meta.query / meta.headers, plus
  //   meta.contentType and meta.filename when the request carries a body.
  // The body then arrives in exactly one form — decoded as `body` when its
  // content type says what the bytes mean, raw as MixedData binary otherwise.
  json meta;
  std::string requestPath;
  json query;
  splitTarget(path, requestPath, query);
  meta["method"] = method;
  meta["path"]   = requestPath;
  meta["query"]  = query;
  // A caller that has to prove who it is does so in a header — a shared secret,
  // a signature, a bearer token — so a pipeline that cannot see them cannot
  // check one. What a board does not name, it does not receive.
  meta["headers"] =
      session ? filterRequestHeaders(session->getRequestHeaders(), m_forwardHeaders)
              : json::object();

  std::optional<json> decodedBody;
  BinaryData rawBody;

  if (session && (method == "POST" || method == "PUT" || method == "PATCH"))
  {
    const auto& body              = session->getRequestBody();
    const auto contentDisposition = session->getRequestHeader("content-disposition");
    const auto contentType        = session->getRequestHeader("content-type");
    const auto uploadId           = session->getRequestHeader("x-upload-id");

    if (!contentType.empty()) meta["contentType"] = contentType;

    // A named attachment is a file to keep whole, whatever its content type.
    if (isFileTransfer(contentDisposition, uploadId))
    {
      meta["filename"] = extractFilename(contentDisposition);
      rawBody          = BinaryData(body.begin(), body.end());
    }
    else
    {
      decodedBody = decodeBody(body, contentType);
      if (!decodedBody && !body.empty())
      {
        rawBody = BinaryData(body.begin(), body.end());
      }
    }
  }

  Data data = Null();
  if (rawBody.empty())
  {
    json envelope = json{{"meta", meta}};
    if (decodedBody) envelope["body"] = *decodedBody;
    data = Data(envelope);
  }
  else
  {
    MixedData mixed;
    mixed.meta   = meta;
    mixed.binary = std::move(rawBody);
    data = Data(mixed);
  }

  // A declared handler is what takes the answer away from the chain — not the
  // presence of a pipeline, which says only that this endpoint has something to
  // run, possibly on the other side. What the handler returns is what the caller
  // gets; the outer runtime still runs and its result still drives the rest of
  // the board, but it runs after the answer is decided — it is where the side
  // effects of having served a request live, not where the answer is shaped.
  // Without a handler the rest of the board is the handler instead, and its
  // result is the answer.
  const auto handler = entryFor(HttpEntry::kOnRequest);
  if (handler && !handler->empty())
  {
    Data answer = handler->process(data);
    session->sendDataSync(answer);
    // No callback: nothing downstream is awaited, because the caller has been
    // answered already. Registering one would leave the runtime waiting for a
    // response to a request nobody is holding open.
    next(answer, true);
    return;
  }

  if (!awaitResponse)
  {
    Data result = next(data, true);
    session->sendDataSync(result);
    return;
  }

  nextAsync(data, [session](Data result) {
    session->sendDataSync(result);
  });
}

std::string HttpServerSubservices::getServiceId() const
{
  return serviceId();
}

json HttpServerSubservices::configure(Data data)
{
  auto buf = getJSONFromData(data);
  if (!buf)
  {
    return Service::configure(data); // handle bypass
  }

  const bool wasRunning = m_impl->running();

  unsigned short port = m_impl->port();
  const bool portChanged = updateIfNeeded(port, (*buf)["port"]);
  if (portChanged)
  {
    m_impl->setPort(port);
  }

  // An array is a decision, including an empty one. Anything else — absent,
  // null, a string — leaves the default of forwarding all of them.
  if (buf->contains("forwardHeaders"))
  {
    const auto& named = (*buf)["forwardHeaders"];
    if (named.is_array())
    {
      std::vector<std::string> names;
      for (const auto& entry : named)
      {
        if (entry.is_string())
        {
          auto name = entry.get<std::string>();
          std::transform(name.begin(), name.end(), name.begin(),
                         [](unsigned char c) { return std::tolower(c); });
          names.push_back(name);
        }
      }
      m_forwardHeaders = names;
    }
    else
    {
      m_forwardHeaders.reset();
    }
  }

  if (updateIfNeeded(m_mode, (*buf)["mode"]))
  {
    // process_on_both serves requests exactly as process_on_session does; what
    // it adds is running the nested pipeline for data arriving from the outer
    // chain too, which happens in process().
    if (m_mode == "process_on_session" || m_mode == "process_on_both")
    {
      m_impl->setOnSessionOpenedCallback(
        [this](std::shared_ptr<Session> session, const std::string& path, const std::string& method) {
          onNewSession(session, path, method);
        }
      );
    }
    else
    {
      m_impl->resetOnSessionOpenedCallback();
    }
  }

  // Declaring an entry point by name is what puts this endpoint in the newer
  // form, and from then on its state is reported that way.
  for (const auto& [key, entry] : {std::pair{"onProcess", HttpEntry::kOnProcess},
                                   std::pair{"onRequest", HttpEntry::kOnRequest}})
  {
    if (buf->contains(key) && (*buf)[key].is_array())
    {
      m_named = true;
      editPipeline(entryPipeline(entry), json{{"pipeline", (*buf)[key]}});
      // A named endpoint always enters onNewSession, which decides for itself
      // whether it has a handler. Only the legacy process_on_data answers out
      // of the server's own store, with no session callback at all.
      m_impl->setOnSessionOpenedCallback(
        [this](std::shared_ptr<Session> session, const std::string& path, const std::string& method) {
          onNewSession(session, path, method);
        }
      );
    }
  }

  // An edit aimed at one named entry. The unscoped verbs below cannot say which
  // pipeline they mean once there is more than one.
  if (buf->contains("configurePipeline") && (*buf)["configurePipeline"].is_object())
  {
    const auto& payload = (*buf)["configurePipeline"];
    const std::string named = payload.value("entry", "");
    if (named == "onProcess" || named == "onRequest")
    {
      m_named = true;
      editPipeline(
        entryPipeline(named == "onProcess" ? HttpEntry::kOnProcess : HttpEntry::kOnRequest),
        payload);
    }
  }

  // The unscoped verbs belong to the one pipeline a legacy board declares. Left
  // working rather than redirected at an entry, because which entry they would
  // mean is exactly what the older form cannot say.
  if (buf->contains("pipeline") || buf->contains("appendService")
      || buf->contains("removeService") || buf->contains("configureService"))
  {
    editPipeline(m_legacy, *buf);
  }

  // Bypass last. Leaving bypass binds a port and publishes the address, so both
  // have to be decided by the configuration this same call carries: a board
  // being restored arrives as one configure holding the saved port and
  // bypass:false together, and handling the bypass first would bind before the
  // port was applied — the server would come up on an OS-assigned port and the
  // board would advertise a different endpoint on every load.
  Service::configure(data);

  // The port is only read when the acceptor binds, so changing it on a running
  // server takes a rebind — otherwise the state advertises a port nothing is
  // listening on.
  if (portChanged && wasRunning && m_impl->running())
  {
    stop();
    if (!start())
    {
      std::cerr << "HttpServerSubservices::configure() Failed to rebind on port: "
                << port << std::endl;
      setBypass(true); // nothing is listening; say so rather than report online
    }
  }

  return getState();
}

json HttpServerSubservices::pipelineState(const Pipeline& pipeline)
{
  json state = json::array();
  if (!pipeline.runtime)
  {
    for (const auto& cfg : pipeline.config)
    {
      state.push_back(json{
        {"serviceId", cfg.value("serviceId", "")},
        {"instanceId", cfg.value("instanceId", "")},
        {"state", cfg.value("state", json::object())}
      });
    }
    return state;
  }

  for (auto it = pipeline.runtime->begin(); it != pipeline.runtime->end(); ++it)
  {
    const auto& svc = *it;
    state.push_back(json{
      {"serviceId", svc->getServiceId()},
      {"instanceId", svc->getId()},
      {"state", svc->getState()}
    });
  }
  return state;
}

json HttpServerSubservices::getState() const
{
  json state = json{
    {"port", m_impl->port()},
    {"host", m_host},
    // Public endpoint. Reserved name: generic board machinery reads and
    // rewrites it (see the frontend's runtime/board/mount).
    {MOUNT_FIELD, m_url},
    {"status", isBypass() ? "offline" : "online"},
    {"forwardHeaders", m_forwardHeaders ? json(*m_forwardHeaders) : json(nullptr)}
  };

  // What was declared, not what it was understood as. A board that named its
  // entries gets them back; one that declared a single pipeline keeps that,
  // because it is the version an older runtime can still load.
  if (m_named)
  {
    if (m_onProcess.runtime || !m_onProcess.config.empty())
    {
      state["onProcess"] = pipelineState(m_onProcess);
    }
    if (m_onRequest.runtime || !m_onRequest.config.empty())
    {
      state["onRequest"] = pipelineState(m_onRequest);
    }
  }
  else
  {
    state["pipeline"] = pipelineState(m_legacy);
  }

  return Service::mergeStateWith(state);
}

bool HttpServerSubservices::onBypassChanged(bool bypass)
{
  // The return value is the bypass the service ends up in, which is a statement
  // about the server: bypassed means nothing is listening. A start that fails
  // — a port already taken is the usual way — therefore stays bypassed, rather
  // than reporting a service that is online with no server behind it.
  if (bypass)
  {
    stop(); // no-op when nothing is listening, which is the state asked for
    return true;
  }

  if (!start())
  {
    std::cerr << "Failed to start HTTP server on port: " << m_impl->port() << std::endl;
    return true;
  }
  return false;
}

Data HttpServerSubservices::process(Data data)
{
  // The legacy built-in slot: what the board hands this endpoint is what a
  // caller gets back. Expressible now as an `onProcess` that writes a slot and
  // an `onRequest` that reads it, and kept because boards carry the older
  // spelling and a board is a document people keep.
  if (!m_named && m_mode == "process_on_data")
  {
    m_impl->processData(data);
    return data;
  }

  const auto entry = isBypass() ? nullptr : entryFor(HttpEntry::kOnProcess);
  if (!entry || entry->empty())
  {
    return data;
  }

  // Routing only: what the pass's own pipeline returns carries on down the
  // chain. Whatever has to survive until a request arrives — a value this side
  // produces and the other reads — belongs in a slot, which is a service's job
  // and not this one's.
  return entry->process(data);
}

bool HttpServerSubservices::start()
{
  // Guarded on what is actually listening rather than on the bypass flag, so a
  // rebind — stop and start again on a changed port, with bypass unchanged
  // throughout — is not mistaken for a second start.
  if (m_impl->running())
  {
    std::cout << "HttpServerSubservices::start() HTTP server is already running on port: " << m_impl->port() << std::endl;
    return false;
  }

  auto port = m_impl->start();
  if (port == 0)
  {
    std::cerr << "HttpServerSubservices::start() Failed to start HTTP server, port is not set or already in use." << std::endl;
    return false;
  }

  std::cout << "HttpServerSubservices::start() HTTP server started on port: " << m_impl->port() << std::endl;
  m_host = primaryIPv4();
  m_url  = "http://" + m_host + ":" + std::to_string(m_impl->port()) + "/";
  sendNotification(json{
    {"port",   m_impl->port()},
    {"host",   m_host},
    {MOUNT_FIELD, m_url},
    {"status", "online"}
  });
  return true;
}

bool HttpServerSubservices::stop()
{
  if (!m_impl->running())
  {
    std::cout << "HttpServerSubservices::stop() HTTP server is not running" << std::endl;
    return false;
  }
  m_host.clear();
  m_url.clear();
  sendNotification(json{{"status", "offline"}});
  return m_impl->stop();
}

void HttpServerSubservices::syncSubserviceStates(Pipeline& pipeline)
{
  if (!pipeline.runtime)
  {
    return;
  }

  for (auto it = pipeline.runtime->begin(); it != pipeline.runtime->end(); ++it)
  {
    const auto& svc = *it;
    for (auto& cfg : pipeline.config)
    {
      if (cfg.value("instanceId", "") == svc->getId())
      {
        cfg["state"] = svc->getState();
        break;
      }
    }
  }
}

void HttpServerSubservices::rebuildSubservices(Pipeline& pipeline)
{
  json arr = json::array();
  for (const auto& cfg : pipeline.config)
  {
    arr.push_back(cfg);
  }
  pipeline.runtime = createSubRuntime(arr);
  // Both entries hold in the same cells: that they can is the whole reason for
  // declaring them separately.
  if (pipeline.runtime)
  {
    pipeline.runtime->shareSlots(m_slots);
  }
}

std::shared_ptr<Service> HttpServerSubservices::findNested(
  const std::string& instanceId) const
{
  for (const auto* pipeline : {&m_onProcess, &m_onRequest})
  {
    if (!pipeline->runtime)
      continue;
    if (auto found = pipeline->runtime->find(instanceId))
      return found;
  }
  return nullptr;
}

HttpServerSubservices::Pipeline& HttpServerSubservices::entryPipeline(HttpEntry entry)
{
  return entry == HttpEntry::kOnProcess ? m_onProcess : m_onRequest;
}

/**
 * The pipeline one side enters through, or null where that side has none.
 *
 * This is where a legacy `mode` is read, and the only place it is: a board that
 * names its entries never reaches the table below.
 *
 *   | declared             | onProcess | onRequest |
 *   |----------------------|-----------|-----------|
 *   | process_on_session   | —         | the one   |
 *   | process_on_both      | the one   | the one   |
 *   | process_on_data      | —         | —         |
 *
 * `process_on_both` answers with *the same instance* on both sides, never a
 * second copy of the configuration: a pipeline holding a Hold, a timer or a
 * mount is one running thing, and duplicating it would give a board two of each
 * and a slot that never reaches itself.
 */
std::shared_ptr<SubRuntime> HttpServerSubservices::entryFor(HttpEntry entry) const
{
  if (m_named)
  {
    return entry == HttpEntry::kOnProcess ? m_onProcess.runtime : m_onRequest.runtime;
  }
  if (m_mode == "process_on_data")
  {
    return nullptr;
  }
  if (entry == HttpEntry::kOnProcess && m_mode != "process_on_both")
  {
    return nullptr;
  }
  return m_legacy.runtime;
}

void HttpServerSubservices::editPipeline(Pipeline& pipeline, const json& payload)
{
  if (payload.contains("pipeline") && payload["pipeline"].is_array())
  {
    pipeline.config.clear();
    for (const auto& cfg : payload["pipeline"])
    {
      pipeline.config.push_back(cfg);
    }
    rebuildSubservices(pipeline);
  }
  else if (payload.contains("appendService"))
  {
    auto svcCfg = payload["appendService"];
    if (!svcCfg.contains("instanceId") || svcCfg["instanceId"].get<std::string>().empty())
    {
      svcCfg["instanceId"] = generateUUID();
    }
    syncSubserviceStates(pipeline);
    pipeline.config.push_back(std::move(svcCfg));
    rebuildSubservices(pipeline);
  }
  else if (payload.contains("removeService") && payload["removeService"].is_string())
  {
    const std::string id = payload["removeService"].get<std::string>();
    syncSubserviceStates(pipeline);
    pipeline.config.erase(
      std::remove_if(pipeline.config.begin(), pipeline.config.end(),
        [&id](const json& cfg) { return cfg.value("instanceId", "") == id; }),
      pipeline.config.end()
    );
    rebuildSubservices(pipeline);
  }
  else if (payload.contains("configureService") && payload["configureService"].is_object())
  {
    const auto& cfg = payload["configureService"];
    if (cfg.contains("instanceId") && cfg.contains("state") && pipeline.runtime)
    {
      const std::string id = cfg["instanceId"].get<std::string>();
      for (auto it = pipeline.runtime->begin(); it != pipeline.runtime->end(); ++it)
      {
        if ((*it)->getId() == id)
        {
          (*it)->configure(cfg["state"]);
          syncSubserviceStates(pipeline);
          break;
        }
      }
    }
  }
}

} // namespace hkp
