#pragma once

// Shared HTTP + WAV helpers for the speech-to-text and text-to-speech services'
// server backends. Both speak small OpenAI-compatible audio endpoints:
//   speech-to-text -> POST /v1/audio/transcriptions (multipart wav upload)
//   text-to-speech -> POST /v1/audio/speech          (json in, audio bytes out)
// The functions are inline so the header can be included from both translation
// units without a one-definition-rule clash.

#include <chrono>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <exception>
#include <string>
#include <utility>
#include <vector>

#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <boost/beast/ssl.hpp>
#include <boost/beast/version.hpp>
#include <boost/asio/connect.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/asio/ssl/error.hpp>
#include <boost/asio/ssl/stream.hpp>
#include <boost/url.hpp>
#include <boost/url/scheme.hpp>

#include "./root_certificates.h"

namespace hkp::speech {

namespace beast = boost::beast;
namespace http = beast::http;
namespace net = boost::asio;
namespace ssl = net::ssl;
namespace urls = boost::urls;
using tcp = net::ip::tcp;

// An error reported by the server itself (HTTP >= 400), as opposed to a
// transport failure. Distinct from the boost exceptions (which derive from
// std::runtime_error) so that the server's own message can be surfaced verbatim
// while transport failures get the "is a server running?" hint.
struct ServerError : std::exception
{
  explicit ServerError(std::string what) : message(std::move(what)) {}
  const char* what() const noexcept override { return message.c_str(); }
  std::string message;
};

// Expand a leading ~/ to $HOME so model paths in config read naturally, matching
// the hkp-python services (Path.expanduser).
inline std::string expandUser(const std::string& path)
{
  if (path.rfind("~/", 0) != 0)
  {
    return path;
  }
  const char* home = std::getenv("HOME");
  return home ? home + path.substr(1) : path;
}

struct HttpResponse
{
  int status = 0;
  std::string contentType;
  std::string body;
};

// One request/response round trip against an OpenAI-compatible server. Handles
// http and https (SNI + certificate verification). The body and response are
// raw bytes carried in std::string, so binary payloads (a WAV upload, an audio
// download) pass through unchanged. Throws beast::system_error on transport
// failure and ServerError-free — status codes are returned, not thrown.
inline HttpResponse httpPost(const std::string& serverUrl,
                             const std::string& path,
                             const std::string& contentType,
                             const std::string& accept,
                             const std::string& body,
                             std::chrono::milliseconds timeout)
{
  auto parsed = urls::parse_uri_reference(serverUrl);
  if (parsed.has_error())
  {
    throw ServerError("serverUrl is not a valid URL: " + serverUrl);
  }
  const auto url = parsed.value();
  const auto host = std::string(url.encoded_host());
  const bool isHttps = url.scheme_id() == urls::scheme::https;
  auto port = std::string(url.port());
  if (port.empty())
  {
    port = isHttps ? "443" : "80";
  }
  const auto target = std::string(url.encoded_path()) + path;

  auto makeRequest = [&]
  {
    http::request<http::string_body> req{ http::verb::post, target, 11 };
    req.set(http::field::host, host);
    req.set(http::field::user_agent, "hkp-rt");
    req.set(http::field::content_type, contentType);
    req.set(http::field::accept, accept);
    req.body() = body;
    req.prepare_payload();
    return req;
  };

  auto readResponse = [&](auto& stream) -> HttpResponse
  {
    beast::flat_buffer buffer;
    http::response_parser<http::string_body> parser;
    parser.body_limit(boost::none);
    http::read(stream, buffer, parser);
    HttpResponse out;
    out.status = parser.get().result_int();
    out.contentType = std::string(parser.get()[http::field::content_type]);
    out.body = std::move(parser.get().body());
    return out;
  };

  net::io_context ioc;
  tcp::resolver resolver(ioc);
  const auto endpoints = resolver.resolve(host, port);

  if (isHttps)
  {
    ssl::context ctx(ssl::context::tlsv12_client);
    load_root_certificates(ctx);
    ctx.set_verify_mode(ssl::verify_peer);

    beast::ssl_stream<beast::tcp_stream> stream(ioc, ctx);
    if (!SSL_set_tlsext_host_name(stream.native_handle(), host.c_str()))
    {
      beast::error_code ec{ static_cast<int>(::ERR_get_error()), net::error::get_ssl_category() };
      throw beast::system_error{ ec };
    }
    beast::get_lowest_layer(stream).expires_after(timeout);
    beast::get_lowest_layer(stream).connect(endpoints);
    stream.handshake(ssl::stream_base::client);

    auto req = makeRequest();
    http::write(stream, req);
    auto out = readResponse(stream);

    beast::error_code ec;
    stream.shutdown(ec);
    return out;
  }

  beast::tcp_stream stream(ioc);
  stream.expires_after(timeout);
  stream.connect(endpoints);

  auto req = makeRequest();
  http::write(stream, req);
  auto out = readResponse(stream);

  beast::error_code ec;
  stream.socket().shutdown(tcp::socket::shutdown_both, ec);
  return out;
}

// ── Minimal WAV (16-bit PCM, mono) ───────────────────────────────────────────

inline void putLE16(std::string& out, uint16_t v)
{
  out.push_back(static_cast<char>(v & 0xff));
  out.push_back(static_cast<char>((v >> 8) & 0xff));
}

inline void putLE32(std::string& out, uint32_t v)
{
  out.push_back(static_cast<char>(v & 0xff));
  out.push_back(static_cast<char>((v >> 8) & 0xff));
  out.push_back(static_cast<char>((v >> 16) & 0xff));
  out.push_back(static_cast<char>((v >> 24) & 0xff));
}

// Encode mono float samples ([-1, 1]) as a 16-bit PCM WAV container. Used to
// hand audio to an OpenAI-compatible transcription endpoint, which wants a file.
inline std::string writeWavPcm16(const std::vector<float>& samples, int sampleRate)
{
  const uint32_t dataBytes = static_cast<uint32_t>(samples.size()) * 2;
  const uint32_t byteRate = static_cast<uint32_t>(sampleRate) * 2;

  std::string out;
  out.reserve(44 + dataBytes);
  out += "RIFF";
  putLE32(out, 36 + dataBytes);
  out += "WAVE";
  out += "fmt ";
  putLE32(out, 16);                                  // fmt chunk size
  putLE16(out, 1);                                   // PCM
  putLE16(out, 1);                                   // mono
  putLE32(out, static_cast<uint32_t>(sampleRate));
  putLE32(out, byteRate);
  putLE16(out, 2);                                   // block align
  putLE16(out, 16);                                  // bits per sample
  out += "data";
  putLE32(out, dataBytes);
  for (float s : samples)
  {
    float clamped = s < -1.0f ? -1.0f : (s > 1.0f ? 1.0f : s);
    auto v = static_cast<int16_t>(clamped * 32767.0f);
    putLE16(out, static_cast<uint16_t>(v));
  }
  return out;
}

inline uint32_t readLE32(const unsigned char* p)
{
  return static_cast<uint32_t>(p[0]) | (static_cast<uint32_t>(p[1]) << 8) |
         (static_cast<uint32_t>(p[2]) << 16) | (static_cast<uint32_t>(p[3]) << 24);
}

inline uint16_t readLE16(const unsigned char* p)
{
  return static_cast<uint16_t>(p[0] | (p[1] << 8));
}

// Decode a 16-bit-PCM WAV container into mono float samples. Returns false if
// the bytes are not a WAV this minimal reader understands (a TTS server that
// returned mp3, say). Multi-channel audio is downmixed by averaging.
inline bool readWavPcm(const std::string& bytes, std::vector<float>& outSamples, int& outSampleRate)
{
  if (bytes.size() < 44)
  {
    return false;
  }
  const auto* data = reinterpret_cast<const unsigned char*>(bytes.data());
  if (std::memcmp(data, "RIFF", 4) != 0 || std::memcmp(data + 8, "WAVE", 4) != 0)
  {
    return false;
  }

  uint16_t channels = 1;
  uint16_t bitsPerSample = 16;
  size_t offset = 12;
  size_t dataStart = 0;
  size_t dataSize = 0;
  while (offset + 8 <= bytes.size())
  {
    const auto* chunk = data + offset;
    const uint32_t chunkSize = readLE32(chunk + 4);
    if (std::memcmp(chunk, "fmt ", 4) == 0 && offset + 24 <= bytes.size())
    {
      channels = readLE16(chunk + 10);
      outSampleRate = static_cast<int>(readLE32(chunk + 12));
      bitsPerSample = readLE16(chunk + 22);
    }
    else if (std::memcmp(chunk, "data", 4) == 0)
    {
      dataStart = offset + 8;
      dataSize = std::min<size_t>(chunkSize, bytes.size() - dataStart);
      break;
    }
    offset += 8 + chunkSize + (chunkSize & 1); // chunks are word-aligned
  }

  if (dataStart == 0 || bitsPerSample != 16 || channels == 0)
  {
    return false;
  }

  const auto* pcm = reinterpret_cast<const int16_t*>(data + dataStart);
  const size_t frames = (dataSize / 2) / channels;
  outSamples.resize(frames);
  for (size_t i = 0; i < frames; ++i)
  {
    int acc = 0;
    for (uint16_t c = 0; c < channels; ++c)
    {
      acc += pcm[i * channels + c];
    }
    outSamples[i] = static_cast<float>(acc) / (channels * 32768.0f);
  }
  return true;
}

// Linear-interpolating resample of mono float audio. Whisper needs 16 kHz, so
// audio captured at another rate is converted before recognition.
inline std::vector<float> resampleLinear(const std::vector<float>& in, int fromRate, int toRate)
{
  if (fromRate == toRate || in.empty() || fromRate <= 0 || toRate <= 0)
  {
    return in;
  }
  const size_t outLength = static_cast<size_t>(in.size() * static_cast<double>(toRate) / fromRate);
  std::vector<float> out(outLength);
  const double step = static_cast<double>(fromRate) / toRate;
  for (size_t i = 0; i < outLength; ++i)
  {
    const double pos = i * step;
    const size_t idx = static_cast<size_t>(pos);
    const double frac = pos - idx;
    const float a = in[idx];
    const float b = idx + 1 < in.size() ? in[idx + 1] : a;
    out[i] = static_cast<float>(a + (b - a) * frac);
  }
  return out;
}

} // namespace hkp::speech
