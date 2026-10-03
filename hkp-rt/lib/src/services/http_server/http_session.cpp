#include "./http_session.h"

#include <algorithm>
#include <optional>
#include <cstring>

#include "./http_server_impl.h" 
#include "./request_handler.h"
#include "./http_listener.h"

namespace beast = boost::beast;
namespace http = beast::http;
namespace net = boost::asio;
using tcp = net::ip::tcp;

namespace hkp {

const char* kUserAgent = "Hkp/HTTPServer";

inline void fail(boost::beast::error_code ec, char const* what)
{
  std::cerr << what << ": " << ec.message() << "\n";
}

inline std::shared_ptr<http::response<http::string_body>> createHttpResponse(const json& data)
{
  auto res = std::make_shared<http::response<http::string_body>>();
  res->version(11);
  res->result(http::status::ok);
  res->set(http::field::server, kUserAgent);
  res->set(http::field::content_type, "application/json");
  res->body() = data.dump();
  res->prepare_payload();
  return res;
}

inline std::shared_ptr<http::response<http::string_body>> createHttpEventStreamHeaders()
{
  auto res = std::make_shared<http::response<http::string_body>>();
  res->version(11);
  res->result(http::status::ok);
  res->set(http::field::server, kUserAgent);
  res->set(http::field::content_type, "text/event-stream");
  res->set(http::field::cache_control, "no-cache");
  res->set(http::field::connection, "keep-alive");

  return res;
}

static unsigned int s_sessionId = 0;

Session::Session(HttpServerImpl& server, tcp::socket&& socket)
    : stream_(std::move(socket))
    , lambda_(*this)
    , server_(server)
    , m_sessionId(s_sessionId++)
{ 
}

Session::~Session()
{
  do_close(false);
}

void Session::adoptMounted(const std::string& prefetched, const std::string& mountPath)
{
  m_mountPath = mountPath;
  const auto area = buffer_.prepare(prefetched.size());
  std::memcpy(area.data(), prefetched.data(), prefetched.size());
  buffer_.commit(prefetched.size());
}

// Start the asynchronous operation
void Session::run()
{
  do_read();
}

void Session::do_read()
{
  // Reset the parser before each request (parser is not reassignable, use emplace).
  parser_.emplace();
  // Allow up to 50 MB bodies (phone photos can easily exceed the 1 MB default).
  parser_->body_limit(50 * 1024 * 1024);

  // Set the timeout.
  stream_.expires_after(std::chrono::seconds(30));

  // Read a request
  http::async_read(stream_, buffer_, *parser_,
      beast::bind_front_handler(
          &Session::on_read,
          shared_from_this()));
}

void Session::on_read(beast::error_code ec, std::size_t bytes_transferred)
{
  boost::ignore_unused(bytes_transferred);

  // This means they closed the connection
  if(ec == http::error::end_of_stream)
  {
    return do_close();
  }
  if(ec)
  {
    return fail(ec, "read");
  }

  // Send the response
  // handle_request(std::move(req_), lambda_);
  server_.onSessionOpened(shared_from_this());
}

void Session::on_write(bool close, beast::error_code ec, std::size_t bytes_transferred)
{
    boost::ignore_unused(bytes_transferred);

    if(ec)
    {
      // This means they closed the connection
      if(ec == http::error::end_of_stream)
      {
          return do_close();
      }
      return fail(ec, "write");
    }

    if(close)
    {
        // This means we should close the connection, usually because
        // the response indicated the "Connection: close" semantic.
        return do_close();
    }

    // We're done with the response so delete it
    res_ = nullptr;

    // Read another request
    do_read();
}

void Session::do_close(bool notify)
{
    // Send a TCP shutdown
    beast::error_code ec;
    if (stream_.socket().is_open())
    {
      stream_.socket().shutdown(tcp::socket::shutdown_send, ec); // tcp::socket::shutdown_both
    }
    if(ec && ec != beast::errc::not_connected)
    {
      fail(ec, "shutdown");
    }    

    if (notify)
    {
      // At this point the connection is closed gracefully
      server_.onSessionClosed(shared_from_this());
    }
}

void Session::sendDataAsync(json data)
{
  auto res = createHttpResponse(data);
  res_ = res; // Store the response so it lives until the async operation completes // TODO: this created issues with multiple requests around the same time

  m_eventSourceHeadersSent = true;
  // TODO: check that where not already sending and retry
  bool closeAfterSending = true;
  boost::beast::http::async_write(
    stream_,
    *res,
    boost::beast::bind_front_handler(
        &Session::on_write,
        shared_from_this(),
        closeAfterSending
    )
  );
}

void Session::sendHtmlResponse(const std::string& html)
{
  auto res = std::make_shared<http::response<http::string_body>>();
  res->version(11);
  res->result(http::status::ok);
  res->set(http::field::server, kUserAgent);
  res->set(http::field::content_type, "text/html; charset=utf-8");
  res->set(http::field::access_control_allow_origin, "*");
  res->body() = html;
  res->prepare_payload();
  res_ = res;
  boost::beast::http::async_write(
    stream_, *res,
    boost::beast::bind_front_handler(&Session::on_write, shared_from_this(), true));
}

void Session::sendJsonResponseWithCors(const json& data)
{
  auto res = std::make_shared<http::response<http::string_body>>();
  res->version(11);
  res->result(http::status::ok);
  res->set(http::field::server, kUserAgent);
  res->set(http::field::content_type, "application/json");
  res->set(http::field::access_control_allow_origin, "*");
  res->body() = data.dump();
  res->prepare_payload();
  res_ = res;
  boost::beast::http::async_write(
    stream_, *res,
    boost::beast::bind_front_handler(&Session::on_write, shared_from_this(), true));
}

void Session::sendCorsPreflightResponse()
{
  auto res = std::make_shared<http::response<http::string_body>>();
  res->version(11);
  res->result(http::status::no_content);
  res->set(http::field::server, kUserAgent);
  res->set(http::field::access_control_allow_origin, "*");
  res->set(http::field::access_control_allow_methods, "GET, POST, OPTIONS");
  res->set(http::field::access_control_allow_headers, "Content-Type, Content-Disposition, X-Upload-Id, X-Chunk-Index, X-Total-Chunks");
  res->set(http::field::access_control_max_age, "86400");
  res->prepare_payload();
  res_ = res;
  boost::beast::http::async_write(
    stream_, *res,
    boost::beast::bind_front_handler(&Session::on_write, shared_from_this(), true));
}

namespace {

// A response a handler spelled out: status, headers, and what to send.
struct Answer
{
  unsigned status = 200;
  json headers = json::object(); // lower-cased names, string values
  std::string contentType;
  std::string payload;
};

// Whether `meta` marks a value as a response rather than a request.
//
// A request envelope and a response envelope are the same shape, and a
// pipeline that passes its input through returns the request. A request never
// carries a status and a response always does, which is what makes
// `meta.status` the one field that cannot be a coincidence — the same rule
// hkp-node and hkp-python answer by.
bool marksAnswer(const json& meta)
{
  return meta.is_object() && meta.contains("status") && meta["status"].is_number_integer();
}

Answer answerFrom(const json& meta)
{
  Answer answer;
  answer.status = meta["status"].get<unsigned>();
  if (meta.contains("headers") && meta["headers"].is_object())
  {
    for (const auto& [name, value] : meta["headers"].items())
    {
      if (value.is_null())
      {
        continue;
      }
      auto lower = name;
      std::transform(lower.begin(), lower.end(), lower.begin(),
                     [](unsigned char c) { return std::tolower(c); });
      answer.headers[lower] = value.is_string() ? value.get<std::string>() : value.dump();
    }
  }
  if (meta.contains("contentType") && meta["contentType"].is_string())
  {
    answer.contentType = meta["contentType"].get<std::string>();
  }
  else if (answer.headers.contains("content-type"))
  {
    answer.contentType = answer.headers["content-type"].get<std::string>();
  }
  answer.headers.erase("content-type");
  return answer;
}

// The response a value stands for, or nothing where it is not an envelope.
//
//   { meta: { status, contentType?, headers? }, body }   JSON value
//   MixedData with meta.status                           bytes
//
// A string body is sent as text; any other body as JSON.
std::optional<Answer> answerEnvelope(const Data& data)
{
  if (auto mixed = getMixedDataFromData(data))
  {
    if (!marksAnswer(mixed->meta))
    {
      return std::nullopt;
    }
    auto answer = answerFrom(mixed->meta);
    if (answer.contentType.empty())
    {
      answer.contentType = "application/octet-stream";
    }
    answer.payload.assign(mixed->binary.begin(), mixed->binary.end());
    return answer;
  }

  auto value = getJSONFromData(data);
  if (!value || !value->is_object() || !value->contains("meta") || !marksAnswer((*value)["meta"])
      || !(value->contains("body") || value->contains("binary")))
  {
    return std::nullopt;
  }
  auto answer = answerFrom((*value)["meta"]);
  const json body = value->contains("body") ? (*value)["body"] : json(nullptr);
  if (body.is_string())
  {
    answer.payload = body.get<std::string>();
    if (answer.contentType.empty())
    {
      answer.contentType = "text/plain; charset=utf-8";
    }
  }
  else
  {
    answer.payload = body.dump();
    if (answer.contentType.empty())
    {
      answer.contentType = "application/json";
    }
  }
  return answer;
}

} // namespace

bool Session::sendAnswerEnvelope(const Data& data)
{
  auto answer = answerEnvelope(data);
  if (!answer)
  {
    return false;
  }

  http::response<http::string_body> res;
  res.version(11);
  res.result(answer->status);
  res.set(http::field::server, kUserAgent);
  res.set(http::field::access_control_allow_origin, "*");
  for (const auto& [name, value] : answer->headers.items())
  {
    res.set(name, value.get<std::string>());
  }
  res.set(http::field::content_type, answer->contentType);
  res.body() = std::move(answer->payload);
  res.prepare_payload();

  boost::beast::error_code ec;
  http::write(stream_, res, ec);
  do_close();
  return true;
}

void Session::sendDataSync(Data& data, bool useEventStream)
{
  if (!useEventStream && sendAnswerEnvelope(data))
  {
    return;
  }
  if (auto json = getJSONFromData(data); json)
  {
    sendJsonData(*json, useEventStream);
  }
  else if (auto binary = getBinaryFromData(data); binary)
  {
    sendBinaryData(*binary);
  }
  else if (auto rb = getRingBufferFromData(data); rb)
  {
    // Convert the ring buffer to binary data
    BinaryData binaryData;
    rb->consumeAvailable(binaryData, true);
    sendBinaryData(binaryData);
  }
  else if (auto str = getStringFromData(data); str)
  {
    sendHtmlResponse(*str);
  }
  else if (isUndefined(data))
  {
    std::cerr << "Session::sendDataSync: Undefined data not supported" << std::endl;
  }
  else
  {
    // Handle undefined data case
    std::cerr << "Session::sendDataSync: data type not supported: " << data.which() << std::endl;
  }
}

void Session::sendJsonData(const json& j, bool useEventStream)
{
  if (useEventStream && m_eventSourceHeadersSent)
  {
    auto update = "data: " + j.dump() + "\n\n"; // Event stream format
    boost::asio::write(stream_.socket(), boost::asio::buffer(update)); 
    return;
  }

  auto res = useEventStream ? createHttpEventStreamHeaders() : createHttpResponse(j);
  boost::beast::http::write(stream_, *res);
  if (useEventStream)
  {
    m_eventSourceHeadersSent = true;
  }
  else
  {
    do_close();
  }
}

void Session::sendResult(Data& data)
{
  if (sendAnswerEnvelope(data))
  {
    return;
  }
  if (auto str = getStringFromData(data))
  {
    sendHtmlResponse(*str);
  }
  else if (auto j = getJSONFromData(data))
  {
    sendJsonResponseWithCors(*j);
  }
  else if (auto binary = getBinaryFromData(data))
  {
    sendBinaryData(*binary);
  }
  else
  {
    // Null, Undefined, or anything unhandled — acknowledge with ok.
    sendJsonResponseWithCors(json{{"status", "ok"}});
  }
}

void Session::sendBinaryData(const BinaryData& binary)
{
  try 
  {
    if (!m_eventSourceHeadersSent)
    {
      std::string mp3Headers = "HTTP/1.1 200 OK\r\n"
        "Content-Type: audio/mpeg\r\n"
        "Transfer-Encoding: chunked\r\n"
        "Connection: keep-alive\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "\r\n";
      std::string oggHeaders = "HTTP/1.1 200 OK\r\n"
        "Content-Type: audio/ogg\r\n"
        "Transfer-Encoding: chunked\r\n"
        "Connection: keep-alive\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "\r\n";
      std::string octetStreamHeaders = "HTTP/1.1 200 OK\r\n"
        "Content-Type: application/octet-stream\r\n"
        "Transfer-Encoding: chunked\r\n"
        "Connection: keep-alive\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "\r\n";
      boost::asio::write(stream_.socket(), boost::asio::buffer(octetStreamHeaders));
      m_eventSourceHeadersSent = true;
    }

    std::cout << "Session::sendDataSync: Sending binary data of size " << binary.size() << std::endl;
    // Send the binary data in chunked format
    std::ostringstream oss;
    oss << std::hex << binary.size() << "\r\n";
    std::string header = oss.str();

    boost::asio::write(stream_.socket(), boost::asio::buffer(header));
    auto buffer = boost::asio::buffer(&binary[0], binary.size());
    boost::asio::write(stream_.socket(), buffer); 
    boost::asio::write(stream_.socket(), boost::asio::buffer("\r\n", 2));

    // If this is the last chunk, send the chunked terminator
    //if (/* condition to detect last chunk, e.g., binary->empty() or custom logic */ false) 
    //{
    //  boost::asio::write(stream_.socket(), boost::asio::buffer("0\r\n\r\n", 5));
    //  do_close();
    //}
  }
  catch(const std::exception& e)
  {
    std::cerr << "Session::sendDataSync: Exception while sending binary data: " << e.what() << std::endl;
    do_close();
  }
}

} // namespace hkp
