#include "./http_server.h"

#include <boost/beast.hpp>
#include <boost/asio/strand.hpp>
#include <boost/json.hpp>

#include "./http_server_impl.h"
#include "./http_listener.h"
#include "./http_session.h"

#include <thread>

namespace beast = boost::beast;
namespace http = beast::http;
namespace net = boost::asio;
using tcp = net::ip::tcp;

namespace hkp {

HttpServer::HttpServer(const std::string& instanceId)
  : Service(instanceId, serviceId())
  , m_impl(std::make_shared<HttpServerImpl>())
{
  m_bypass = true; // Start in bypass mode
  m_mode = "process_on_session"; // alternative: "process_on_data"
  m_impl->setOnSessionOpenedCallback(
    [this](std::shared_ptr<Session> session, const std::string& path, const std::string& method){ onNewSession(session, path, method); }
  );
}

HttpServer::~HttpServer()
{
  m_impl->stop();
}

// Extract the filename from a Content-Disposition header value.
// e.g. "attachment; filename=\"photo.jpg\"" -> "photo.jpg"
static std::string extractFilename(const std::string& contentDisposition)
{
  std::string filename = "upload";
  auto pos = contentDisposition.find("filename=");
  if (pos != std::string::npos)
  {
    filename = contentDisposition.substr(pos + 9);
    filename.erase(std::remove(filename.begin(), filename.end(), '"'),  filename.end());
    filename.erase(std::remove(filename.begin(), filename.end(), '\''), filename.end());
    filename.erase(0, filename.find_first_not_of(" \t"));
    auto last = filename.find_last_not_of(" \t\r\n");
    if (last != std::string::npos) filename.resize(last + 1);
  }
  return filename;
}

void HttpServer::onNewSession(std::shared_ptr<Session> session, const std::string& path, const std::string& method, bool /*awaitResponse*/)
{
  // OPTIONS is a protocol-level concern (CORS preflight) — handle inline, never enters pipeline.
  if (method == "OPTIONS")
  {
    session->sendCorsPreflightResponse();
    return;
  }

  // Build a MixedData that uniformly describes the request.
  // meta["method"]      — HTTP method so downstream services can route on it.
  // meta["requestPath"] — the URL path.
  // meta["path"]        — filename (for body-carrying requests); used by filesystem service.
  // meta["contentType"] — Content-Type header (for body-carrying requests).
  // binary              — raw request body (empty for GET/HEAD).
  MixedData request;
  request.meta["method"]      = method;
  request.meta["requestPath"] = path;

  if (method == "POST" || method == "PUT" || method == "PATCH")
  {
    const auto& body              = session->getRequestBody();
    const auto contentDisposition = session->getRequestHeader("content-disposition");
    const auto contentType        = session->getRequestHeader("content-type");
    const auto filename           = extractFilename(contentDisposition);

    request.meta["path"]        = filename;
    request.meta["contentType"] = contentType;

    // Chunked upload: client sends X-Upload-Id + X-Chunk-Index + X-Total-Chunks.
    const auto uploadId       = session->getRequestHeader("x-upload-id");
    const auto chunkIndexStr  = session->getRequestHeader("x-chunk-index");
    const auto totalChunksStr = session->getRequestHeader("x-total-chunks");

    if (!uploadId.empty() && !chunkIndexStr.empty() && !totalChunksStr.empty())
    {
      int chunkIndex  = -1;
      int totalChunks = -1;
      try
      {
        chunkIndex  = std::stoi(chunkIndexStr);
        totalChunks = std::stoi(totalChunksStr);
      }
      catch (const std::exception& e)
      {
        std::cerr << "HttpServer: failed to parse chunk headers: index='"
                  << chunkIndexStr << "' total='" << totalChunksStr
                  << "' error=" << e.what() << std::endl;
        session->sendJsonResponseWithCors(json{{"error", "bad chunk headers"}});
        return;
      }
      if (chunkIndex < 0 || totalChunks <= 0 || chunkIndex >= totalChunks)
      {
        std::cerr << "HttpServer: invalid chunk values: index=" << chunkIndex
                  << " total=" << totalChunks << std::endl;
        session->sendJsonResponseWithCors(json{{"error", "invalid chunk values"}});
        return;
      }

      bool complete = false;
      MixedData assembled;

      {
        std::lock_guard<std::mutex> lock(m_assemblyMutex);
        auto& assembly = m_assemblies[uploadId];

        if (assembly.totalChunks == 0)
        {
          assembly.totalChunks = totalChunks;
          assembly.filename    = filename;
          assembly.contentType = contentType;
          assembly.requestPath = path;
          assembly.chunks.resize(totalChunks);
        }

        assembly.chunks[chunkIndex] = body;
        assembly.receivedCount++;

        if (assembly.receivedCount == totalChunks)
        {
          BinaryData binary;
          for (const auto& chunk : assembly.chunks)
            binary.insert(binary.end(), chunk.begin(), chunk.end());

          assembled.meta   = json{{"method", "POST"}, {"path", assembly.filename},
                                  {"contentType", assembly.contentType}, {"requestPath", assembly.requestPath}};
          assembled.binary = std::move(binary);
          m_assemblies.erase(uploadId);
          complete = true;
        }
      }

      if (complete)
      {
        auto data = Data(assembled);
        nextAsync(data, [session](Data result) {
          session->sendResult(result);
        });
      }
      else
      {
        // Intermediate chunk acknowledged — do not enter pipeline yet.
        session->sendJsonResponseWithCors(json{{"status", "ok"}, {"chunkIndex", chunkIndex}});
      }
      return;
    }

    // Non-chunked body — attach it directly.
    request.binary = BinaryData(body.begin(), body.end());
  }

  // Forward into the pipeline; let downstream services (e.g. method-router) decide what to do.
  auto data = Data(request);
  nextAsync(data, [session](Data result) {
    session->sendResult(result);
  });
}

std::string HttpServer::getServiceId() const
{
  return serviceId();
}

json HttpServer::configure(Data data)
{
  if (auto buf = getJSONFromData(data))
  {
    unsigned short port = m_impl->port();
    if (updateIfNeeded(port, (*buf)["port"]))
    {
      m_impl->setPort(port);
    }

    if (updateIfNeeded(m_mode, (*buf)["mode"]))
    {
      if (m_mode == "process_on_session")
      {
        m_impl->setOnSessionOpenedCallback(
          [this](std::shared_ptr<Session> session, const std::string& path, const std::string& method) { onNewSession(session, path, method); }
        );
      }
      else
      {
        m_impl->resetOnSessionOpenedCallback();
      }
    }
  }
  return Service::configure(data);
}

json HttpServer::getState() const
{
  return Service::mergeStateWith(json{
    {"port", m_impl->port()}
  });
}

bool HttpServer::onBypassChanged(bool bypass)
{
  if (bypass)
  {
    if (!stop())
    {
      std::cerr << "Failed to stop HTTP server on port: " << m_impl->port() << std::endl;
      return false;
    }
  }
  else
  {
    if (!start())
    {
      std::cerr << "Failed to start HTTP server on port: " << m_impl->port() << std::endl;
      return false;
    }
  }
  return bypass;
}

Data HttpServer::process(Data data)
{
  if (m_mode == "process_on_data")
  {
    m_impl->processData(data);
  }
  return data;
}

bool HttpServer::start()
{
  if (!isBypass())
  {
    std::cout << "HttpServer::start() HTTP server is already running on port: " << m_impl->port() << std::endl;
    return false;
  }

  auto port = m_impl->start();
  if (port == 0)
  {
    std::cerr << "HttpServer::start() Failed to start HTTP server, port is not set or already in use." << std::endl;
    return false;
  }

  std::cout << "HttpServer::start() HTTP server started on port: " << m_impl->port() << std::endl;
  sendNotification(json{{"port", m_impl->port()}});
  return true;
}

bool HttpServer::stop()
{
  if (isBypass())
  {
    std::cout << "HttpServer::stop() HTTP server is not running" << std::endl;
    return false;
  }
  return m_impl->stop();
}

}
