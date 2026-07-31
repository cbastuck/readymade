#include "./http_server.h"

#include <boost/beast.hpp>
#include <boost/asio/strand.hpp>
#include <boost/json.hpp>

#include "./http_server_impl.h"
#include "./http_listener.h"
#include "./http_session.h"
#include "./request_decode.h"

#include <algorithm>
#include <cctype>
#include <optional>
#include <string>
#include <thread>

namespace beast = boost::beast;
namespace http = beast::http;
namespace net = boost::asio;
using tcp = net::ip::tcp;

namespace hkp {

using namespace request_decode;

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

void HttpServer::onNewSession(std::shared_ptr<Session> session, const std::string& path, const std::string& method, bool /*awaitResponse*/)
{
  // OPTIONS is a protocol-level concern (CORS preflight) — handle inline, never enters pipeline.
  if (method == "OPTIONS")
  {
    session->sendCorsPreflightResponse();
    return;
  }

  // Describe the request uniformly.
  // meta["method"]      — HTTP method so downstream services can route on it.
  // meta["requestPath"] — the URL path, without the query string.
  // meta["query"]       — decoded query parameters.
  // meta["path"]        — filename; set only for file transfers, and what the
  //                       filesystem service writes to.
  // meta["contentType"] — Content-Type header (for body-carrying requests).
  //
  // What leaves this service depends on what the body turns out to be:
  //   * bytes that cannot be interpreted (an upload) → MixedData, meta + binary
  //   * a body whose type says what it means, or none → JSON, meta + body
  // Emitting MixedData unconditionally is what made a Map downstream fail: it
  // only accepts plain JSON, so a request it could have handled stopped there.
  MixedData request;
  std::string requestPath;
  json query;
  splitTarget(path, requestPath, query);
  request.meta["method"]      = method;
  request.meta["requestPath"] = requestPath;
  request.meta["query"]       = query;

  std::optional<json> decodedBody;

  if (method == "POST" || method == "PUT" || method == "PATCH")
  {
    const auto& body              = session->getRequestBody();
    const auto contentDisposition = session->getRequestHeader("content-disposition");
    const auto contentType        = session->getRequestHeader("content-type");
    const auto filename           = extractFilename(contentDisposition);

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
          // The split path, matching the non-chunked branch — an assembled
          // upload should not describe itself differently from a plain one.
          assembly.requestPath = requestPath;
          assembly.query       = query;
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
                                  {"contentType", assembly.contentType},
                                  {"requestPath", assembly.requestPath},
                                  {"query", assembly.query}};
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

    // Non-chunked body. A file transfer keeps its bytes and its filename; any
    // other body is decoded when its content type says what it means.
    if (isFileTransfer(contentDisposition, uploadId))
    {
      request.meta["path"] = filename;
      request.binary       = BinaryData(body.begin(), body.end());
    }
    else
    {
      decodedBody = decodeBody(body, contentType);
      if (!decodedBody)
      {
        request.binary = BinaryData(body.begin(), body.end());
      }
    }
  }

  // Forward into the pipeline; let downstream services (e.g. method-router) decide what to do.
  // Bytes we could not interpret stay MixedData so the filesystem service still
  // receives them; everything else goes as plain JSON, which every
  // JSON-consuming service can act on.
  Data data = Null();
  if (request.binary.empty())
  {
    json envelope = json{{"meta", request.meta}};
    if (decodedBody) envelope["body"] = *decodedBody;
    data = Data(envelope);
  }
  else
  {
    data = Data(request);
  }

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
