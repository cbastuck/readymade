#include "./matrix_client.h"

#include <algorithm>
#include <cctype>
#include <cstdio>

#include <boost/asio/connect.hpp>
#include <boost/asio/io_context.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/asio/ssl.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <boost/beast/ssl.hpp>
#include <boost/url.hpp>

#include "./root_certificates.h"
#include "egress.h"

namespace beast = boost::beast;
namespace http = beast::http;
namespace net = boost::asio;
namespace ssl = net::ssl;
namespace urls = boost::urls;
using tcp = net::ip::tcp;

namespace hkp {
namespace matrix {

namespace {

const char* const CLIENT_API = "/_matrix/client/v3";

// A sync answer for a busy account is large; anything past this is not one.
constexpr std::uint64_t BODY_LIMIT = 32 * 1024 * 1024;

std::string api(const Homeserver& server)
{
  return server.basePath + CLIENT_API;
}

std::string hostHeader(const Homeserver& server)
{
  const bool defaultPort = (server.secure && server.port == "443") ||
                           (!server.secure && server.port == "80");
  return defaultPort ? server.host : server.host + ":" + server.port;
}

} // namespace

// ── Homeserver ───────────────────────────────────────────────────────────────

std::optional<Homeserver> parseHomeserver(const std::string& url, std::string& problem)
{
  if (url.empty())
  {
    problem = "no homeserver configured";
    return std::nullopt;
  }
  auto parsed = urls::parse_uri(url);
  if (parsed.has_error())
  {
    problem = "homeserver is not an address: " + url;
    return std::nullopt;
  }
  const auto& u = *parsed;
  Homeserver server;
  if (u.scheme_id() == urls::scheme::https)
  {
    server.secure = true;
  }
  else if (u.scheme_id() == urls::scheme::http)
  {
    server.secure = false;
  }
  else
  {
    problem = "homeserver must be an http or https address: " + url;
    return std::nullopt;
  }
  server.host = std::string(u.encoded_host());
  if (server.host.empty())
  {
    problem = "homeserver names no host: " + url;
    return std::nullopt;
  }
  server.port = u.has_port() ? std::string(u.port()) : (server.secure ? "443" : "80");
  server.basePath = std::string(u.encoded_path());
  while (!server.basePath.empty() && server.basePath.back() == '/')
  {
    server.basePath.pop_back();
  }
  return server;
}

std::string describeError(const Response& response)
{
  if (response.body.is_object())
  {
    const auto code = response.body.value("errcode", std::string());
    const auto text = response.body.value("error", std::string());
    if (!code.empty() || !text.empty())
    {
      return code.empty() ? text : (text.empty() ? code : code + ": " + text);
    }
  }
  return "homeserver answered " + std::to_string(response.status);
}

std::chrono::milliseconds retryAfter(const Response& response,
                                     std::chrono::milliseconds fallback)
{
  if (response.body.is_object() && response.body.contains("retry_after_ms") &&
      response.body["retry_after_ms"].is_number_integer())
  {
    return std::chrono::milliseconds(response.body["retry_after_ms"].get<long long>());
  }
  return fallback;
}

// ── Connection ───────────────────────────────────────────────────────────────

struct Connection::Impl
{
  net::io_context ioc;
  ssl::context tls{ssl::context::tlsv12_client};
  std::atomic<bool> cancelled{false};

  Impl()
  {
    load_root_certificates(tls);
    tls.set_verify_mode(ssl::verify_peer);
  }

  // Runs the one asynchronous step `start` begins to its end on this thread.
  //
  // Each step of a request is asynchronous only so that cancel() can end it:
  // stopping the context returns run() at once, wherever the step was. The
  // flag is checked after restart() because a stop that came before it is
  // undone by it.
  template <class Start>
  void step(Start&& start)
  {
    ioc.restart();
    if (cancelled)
    {
      throw Cancelled();
    }
    start();
    ioc.run();
    if (cancelled)
    {
      throw Cancelled();
    }
  }

  template <class Stream>
  Response exchange(Stream& stream, http::request<http::string_body>& req)
  {
    boost::system::error_code ec;
    step([&] {
      http::async_write(stream, req, [&](const boost::system::error_code& e, std::size_t) { ec = e; });
    });
    if (ec)
    {
      throw std::runtime_error("sending to the homeserver failed: " + ec.message());
    }

    beast::flat_buffer buffer;
    http::response_parser<http::string_body> parser;
    parser.body_limit(BODY_LIMIT);
    step([&] {
      http::async_read(stream, buffer, parser, [&](const boost::system::error_code& e, std::size_t) { ec = e; });
    });
    if (ec)
    {
      throw std::runtime_error(ec == beast::error::timeout
                                 ? std::string("the homeserver did not answer in time")
                                 : "reading the homeserver's answer failed: " + ec.message());
    }

    const auto& res = parser.get();
    Response response;
    response.status = res.result_int();
    response.body = json::parse(res.body(), nullptr, false);
    if (response.body.is_discarded())
    {
      response.body = nullptr;
    }
    return response;
  }
};

Connection::Connection() : m_impl(std::make_unique<Impl>()) {}

Connection::~Connection() = default;

void Connection::cancel()
{
  m_impl->cancelled = true;
  m_impl->ioc.stop();
}

Response Connection::request(const Homeserver& server,
                             const std::string& method,
                             const std::string& target,
                             const std::string& accessToken,
                             const json* body,
                             std::chrono::milliseconds timeout)
{
  auto& impl = *m_impl;

  http::request<http::string_body> req{http::string_to_verb(method), target, 11};
  req.set(http::field::host, hostHeader(server));
  req.set(http::field::user_agent, "Readymade hkp-rt");
  req.set(http::field::accept, "application/json");
  req.keep_alive(false);
  if (!accessToken.empty())
  {
    req.set(http::field::authorization, "Bearer " + accessToken);
  }
  if (body)
  {
    req.set(http::field::content_type, "application/json");
    req.body() = body->dump(-1, ' ', false, json::error_handler_t::replace);
  }
  req.prepare_payload();

  tcp::resolver resolver(impl.ioc);
  boost::system::error_code ec;
  tcp::resolver::results_type endpoints;
  impl.step([&] {
    ::hkp::egress::asyncResolve(resolver, server.host, server.port,
      [&](const boost::system::error_code& e, tcp::resolver::results_type results) {
        ec = e;
        endpoints = std::move(results);
      });
  });
  if (ec)
  {
    throw std::runtime_error("cannot reach " + server.host + ": " + ec.message());
  }

  const auto connected = [&](auto& lowest) {
    lowest.expires_after(timeout);
    impl.step([&] {
      lowest.async_connect(endpoints, [&](const boost::system::error_code& e, const tcp::endpoint&) { ec = e; });
    });
    if (ec)
    {
      throw std::runtime_error("cannot connect to " + server.host + ": " + ec.message());
    }
  };

  if (server.secure)
  {
    beast::ssl_stream<beast::tcp_stream> stream(impl.ioc, impl.tls);
    if (!SSL_set_tlsext_host_name(stream.native_handle(), server.host.c_str()))
    {
      throw std::runtime_error("cannot name " + server.host + " for TLS");
    }
    stream.set_verify_callback(ssl::host_name_verification(server.host));
    connected(beast::get_lowest_layer(stream));
    impl.step([&] {
      stream.async_handshake(ssl::stream_base::client, [&](const boost::system::error_code& e) { ec = e; });
    });
    if (ec)
    {
      throw std::runtime_error("TLS with " + server.host + " failed: " + ec.message());
    }
    // No TLS shutdown: the request asked to close, and a server that closes
    // without a close_notify is not an error worth waiting on.
    return impl.exchange(stream, req);
  }

  beast::tcp_stream stream(impl.ioc);
  connected(stream);
  return impl.exchange(stream, req);
}

// ── Addresses ────────────────────────────────────────────────────────────────

std::string encodeComponent(const std::string& text)
{
  static const char* const hex = "0123456789ABCDEF";
  std::string out;
  out.reserve(text.size());
  for (unsigned char c : text)
  {
    if (std::isalnum(c) || c == '-' || c == '.' || c == '_' || c == '~')
    {
      out.push_back(static_cast<char>(c));
    }
    else
    {
      out.push_back('%');
      out.push_back(hex[c >> 4]);
      out.push_back(hex[c & 0x0F]);
    }
  }
  return out;
}

std::string whoamiTarget(const Homeserver& server)
{
  return api(server) + "/account/whoami";
}

std::string aliasTarget(const Homeserver& server, const std::string& alias)
{
  return api(server) + "/directory/room/" + encodeComponent(alias);
}

std::string syncTarget(const Homeserver& server,
                       const std::string& since,
                       const std::vector<std::string>& rooms,
                       int timeoutMs)
{
  // Only messages, and the encrypted events that say a room cannot be read.
  // Everything else a sync would carry — presence, receipts, typing, room
  // state, account data — is asked away, so a long-running listener moves as
  // little as it can.
  json timeline = {{"types", {"m.room.message", "m.room.encrypted"}}};
  if (since.empty())
  {
    // The first sync is made for its next_batch: one event per room is the
    // least the filter can ask for and still be a valid one.
    timeline["limit"] = 1;
  }
  json room = {
    {"timeline", timeline},
    {"state", {{"not_types", {"*"}}}},
    {"ephemeral", {{"not_types", {"*"}}}},
    {"account_data", {{"not_types", {"*"}}}},
  };
  if (!rooms.empty())
  {
    room["rooms"] = rooms;
  }
  const json filter = {
    {"room", room},
    {"presence", {{"not_types", {"*"}}}},
    {"account_data", {{"not_types", {"*"}}}},
  };

  std::string target = api(server) + "/sync?timeout=" +
                       std::to_string(since.empty() ? 0 : timeoutMs) +
                       "&filter=" + encodeComponent(filter.dump());
  if (!since.empty())
  {
    target += "&since=" + encodeComponent(since);
  }
  return target;
}

std::string sendTarget(const Homeserver& server,
                       const std::string& roomId,
                       const std::string& txnId)
{
  return api(server) + "/rooms/" + encodeComponent(roomId) +
         "/send/m.room.message/" + encodeComponent(txnId);
}

// ── What a sync says ─────────────────────────────────────────────────────────

std::string isoDate(long long epochMs)
{
  // Civil date from days since the epoch (H. Hinnant's algorithm): portable,
  // where gmtime_r and gmtime_s are each only on some of the platforms this
  // library builds for.
  long long ms = epochMs % 1000;
  long long secs = epochMs / 1000;
  if (ms < 0)
  {
    ms += 1000;
    secs -= 1;
  }
  long long days = secs / 86400;
  long long rem = secs % 86400;
  if (rem < 0)
  {
    rem += 86400;
    days -= 1;
  }
  days += 719468;
  const long long era = (days >= 0 ? days : days - 146096) / 146097;
  const long long doe = days - era * 146097;
  const long long yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
  long long year = yoe + era * 400;
  const long long doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
  const long long mp = (5 * doy + 2) / 153;
  const long long day = doy - (153 * mp + 2) / 5 + 1;
  const long long month = mp < 10 ? mp + 3 : mp - 9;
  if (month <= 2)
  {
    year += 1;
  }

  char out[32];
  std::snprintf(out, sizeof(out), "%04lld-%02lld-%02lldT%02lld:%02lld:%02lld.%03lldZ",
                year, month, day, rem / 3600, (rem % 3600) / 60, rem % 60, ms);
  return out;
}

SyncResult readSync(const json& body,
                    const std::vector<std::string>& rooms,
                    const std::string& ownUserId,
                    bool includeOwn)
{
  SyncResult result;
  if (!body.is_object())
  {
    return result;
  }
  result.nextBatch = body.value("next_batch", std::string());

  const auto joined = body.contains("rooms") && body["rooms"].is_object() &&
                      body["rooms"].contains("join") && body["rooms"]["join"].is_object()
                        ? body["rooms"]["join"]
                        : json::object();

  std::vector<json> messages;
  for (const auto& [roomId, room] : joined.items())
  {
    // The filter already asked for these rooms; a server that ignores a
    // filter does not make the listener report rooms it was not given.
    if (!rooms.empty() && std::find(rooms.begin(), rooms.end(), roomId) == rooms.end())
    {
      continue;
    }
    if (!room.is_object() || !room.contains("timeline") ||
        !room["timeline"].is_object() || !room["timeline"].contains("events") ||
        !room["timeline"]["events"].is_array())
    {
      continue;
    }
    for (const auto& event : room["timeline"]["events"])
    {
      if (!event.is_object())
      {
        continue;
      }
      const auto type = event.value("type", std::string());
      if (type == "m.room.encrypted")
      {
        if (std::find(result.encryptedRooms.begin(), result.encryptedRooms.end(), roomId) ==
            result.encryptedRooms.end())
        {
          result.encryptedRooms.push_back(roomId);
        }
        continue;
      }
      if (type != "m.room.message")
      {
        continue;
      }
      const auto sender = event.value("sender", std::string());
      if (!includeOwn && !ownUserId.empty() && sender == ownUserId)
      {
        continue;
      }
      const auto content = event.contains("content") && event["content"].is_object()
                             ? event["content"]
                             : json::object();
      // A redacted message keeps its type and loses its body: nothing to say.
      if (!content.contains("body") || !content["body"].is_string())
      {
        continue;
      }

      const long long ts = event.contains("origin_server_ts") &&
                               event["origin_server_ts"].is_number_integer()
                             ? event["origin_server_ts"].get<long long>()
                             : 0;
      json message = {
        {"text", content["body"]},
        {"msgtype", content.value("msgtype", std::string("m.text"))},
        {"sender", sender},
        {"roomId", roomId},
        {"eventId", event.value("event_id", std::string())},
        {"timestamp", ts},
        {"date", isoDate(ts)},
        {"content", content},
      };

      // An edit carries the new text apart from a fallback ("* new text") for
      // clients that do not know edits; this one does.
      if (content.contains("m.new_content") && content["m.new_content"].is_object() &&
          content["m.new_content"].contains("body") && content["m.new_content"]["body"].is_string())
      {
        message["text"] = content["m.new_content"]["body"];
        if (content.contains("m.relates_to") && content["m.relates_to"].is_object())
        {
          message["replaces"] = content["m.relates_to"].value("event_id", std::string());
        }
      }
      messages.push_back(std::move(message));
    }
  }

  // Rooms come back keyed by id; what was said comes out in the order it was.
  std::stable_sort(messages.begin(), messages.end(), [](const json& a, const json& b) {
    return a["timestamp"].get<long long>() < b["timestamp"].get<long long>();
  });
  for (auto& message : messages)
  {
    result.messages.push_back(std::move(message));
  }
  return result;
}

// ── What is sent ─────────────────────────────────────────────────────────────

std::optional<OutgoingMessage> outgoingMessage(const Data& input,
                                               const std::string& defaultMsgtype)
{
  const auto msgtype = defaultMsgtype.empty() ? std::string("m.text") : defaultMsgtype;
  const auto plain = [&](const std::string& text) -> std::optional<OutgoingMessage> {
    if (text.empty())
    {
      return std::nullopt;
    }
    return OutgoingMessage{json{{"msgtype", msgtype}, {"body", text}}, ""};
  };

  if (auto text = getStringFromData(input); text)
  {
    return plain(*text);
  }
  auto j = getJSONFromData(input);
  if (!j || j->is_null())
  {
    return std::nullopt;
  }
  if (j->is_string())
  {
    return plain(j->get<std::string>());
  }
  if (!j->is_object())
  {
    return plain(j->dump(2));
  }

  const auto textField = j->contains("text") && (*j)["text"].is_string() ? "text"
                       : j->contains("body") && (*j)["body"].is_string() ? "body"
                                                                         : nullptr;
  if (!textField)
  {
    return plain(j->dump(2));
  }
  const auto text = (*j)[textField].get<std::string>();
  if (text.empty())
  {
    return std::nullopt;
  }

  OutgoingMessage out;
  out.content = json{{"msgtype", j->value("msgtype", msgtype)}, {"body", text}};
  const auto html = j->value("html", std::string());
  if (!html.empty())
  {
    out.content["format"] = "org.matrix.custom.html";
    out.content["formatted_body"] = html;
  }
  out.roomId = j->value("roomId", std::string());
  return out;
}

} // namespace matrix
} // namespace hkp
