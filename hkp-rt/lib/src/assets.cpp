#include <assets.h>

#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <sstream>

#include <boost/asio/connect.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/asio/ssl/error.hpp>
#include <boost/asio/ssl/stream.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/core/detail/base64.hpp>
#include <boost/beast/http.hpp>
#include <boost/beast/ssl.hpp>
#include <boost/url.hpp>

#include "./services/root_certificates.h"
#include "./services/sha256_openssl.h"

namespace hkp {

namespace {

namespace beast = boost::beast;
namespace http = beast::http;
namespace net = boost::asio;
namespace ssl = net::ssl;
namespace urls = boost::urls;
using tcp = net::ip::tcp;

// A source that cannot be read, said in a sentence.
struct Refused : std::runtime_error
{
  using std::runtime_error::runtime_error;
};

// How many redirects one fetch follows before it is given up.
constexpr int kMaxRedirects = 10;

bool isRedirect(int status)
{
  return status == 301 || status == 302 || status == 303 || status == 307 || status == 308;
}

std::string lower(std::string text)
{
  std::transform(text.begin(), text.end(), text.begin(),
                 [](unsigned char c) { return std::tolower(c); });
  return text;
}

// One GET, over HTTP or HTTPS (SNI and certificate verification), with the body
// limited to `limit` bytes.
AssetStore::FetchResponse fetchUrl(const std::string& target,
                                   const std::map<std::string, std::string>& headers,
                                   std::size_t limit)
{
  auto parsed = urls::parse_uri(target);
  if (parsed.has_error())
  {
    throw Refused(target + " is not a URL");
  }
  const auto url = parsed.value();
  const auto host = std::string(url.encoded_host());
  const bool isHttps = url.scheme_id() == urls::scheme::https;
  auto port = std::string(url.port());
  if (port.empty())
  {
    port = isHttps ? "443" : "80";
  }
  auto path = std::string(url.encoded_path());
  if (path.empty())
  {
    path = "/";
  }
  if (url.has_query())
  {
    path += "?" + std::string(url.encoded_query());
  }

  http::request<http::empty_body> req{ http::verb::get, path, 11 };
  req.set(http::field::host, host);
  req.set(http::field::user_agent, "hkp-rt");
  for (const auto& [name, value] : headers)
  {
    req.set(name, value);
  }

  auto read = [&](auto& stream)
  {
    beast::flat_buffer buffer;
    http::response_parser<http::string_body> parser;
    parser.body_limit(limit);
    http::read(stream, buffer, parser);
    AssetStore::FetchResponse out;
    out.status = parser.get().result_int();
    out.etag = std::string(parser.get()[http::field::etag]);
    out.location = std::string(parser.get()[http::field::location]);
    out.body = std::move(parser.get().body());
    return out;
  };

  const auto timeout = std::chrono::seconds(30);
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
    http::write(stream, req);
    auto out = read(stream);
    beast::error_code ec;
    stream.shutdown(ec);
    return out;
  }

  beast::tcp_stream stream(ioc);
  stream.expires_after(timeout);
  stream.connect(endpoints);
  http::write(stream, req);
  auto out = read(stream);
  beast::error_code ec;
  stream.socket().shutdown(tcp::socket::shutdown_both, ec);
  return out;
}

// The file a file:// URL names, when it lies inside `root`; empty otherwise.
// Both are made canonical first, so neither `..` nor a symlink leads outside.
std::string fileInside(const std::string& root, const std::string& url)
{
  namespace fs = std::filesystem;
  auto parsed = urls::parse_uri(url);
  if (parsed.has_error() || !parsed.value().encoded_host().empty() || root.empty())
  {
    return "";
  }
  std::error_code ec;
  const auto base = fs::weakly_canonical(fs::path(root), ec);
  if (ec)
  {
    return "";
  }
  const auto relative = std::string(parsed.value().path());
  const auto candidate = fs::weakly_canonical(base / fs::path(relative).relative_path(), ec);
  if (ec)
  {
    return "";
  }
  const auto rel = candidate.lexically_relative(base);
  if (rel.empty() || *rel.begin() == "..")
  {
    return "";
  }
  return candidate.string();
}

} // namespace

std::optional<std::string> decodeBase64(const std::string& encoded)
{
  std::string text;
  text.reserve(encoded.size());
  for (const char c : encoded)
  {
    if (c != '\t' && c != '\n' && c != '\f' && c != '\r' && c != ' ')
    {
      text.push_back(c);
    }
  }
  if (text.size() % 4 == 0)
  {
    for (int i = 0; i < 2 && !text.empty() && text.back() == '='; ++i)
    {
      text.pop_back();
    }
  }
  // One character over a group of four stands for no byte at all.
  if (text.size() % 4 == 1)
  {
    return std::nullopt;
  }
  for (const char c : text)
  {
    const bool known = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
                       (c >= '0' && c <= '9') || c == '+' || c == '/';
    if (!known)
    {
      return std::nullopt;
    }
  }
  // Room for a last group that is not four characters: the padding that would
  // have completed it is gone by now, and `decoded_size` counts whole groups.
  std::string out((text.size() + 3) / 4 * 3, '\0');
  const auto [written, read] =
    boost::beast::detail::base64::decode(out.data(), text.data(), text.size());
  if (read != text.size())
  {
    return std::nullopt;
  }
  out.resize(written);
  return out;
}

std::optional<AssetDescriptor> readAssetDescriptor(const nlohmann::json& value,
                                                   const std::string& fallbackId)
{
  if (!value.is_object())
  {
    return std::nullopt;
  }
  std::string id = value.contains("id") && value["id"].is_string()
                     ? value["id"].get<std::string>()
                     : fallbackId;
  if (id.empty() || !isAssetId(id))
  {
    return std::nullopt;
  }
  std::string source;
  int sources = 0;
  for (const auto* key : { "text", "base64", "url" })
  {
    if (value.contains(key) && value[key].is_string())
    {
      source = key;
      ++sources;
    }
  }
  if (sources != 1)
  {
    return std::nullopt;
  }

  AssetDescriptor descriptor = { { "id", id } };
  descriptor["mediaType"] =
    value.contains("mediaType") && value["mediaType"].is_string() &&
        !value["mediaType"].get<std::string>().empty()
      ? value["mediaType"].get<std::string>()
      : "application/octet-stream";
  if (value.contains("name") && value["name"].is_string())
  {
    descriptor["name"] = value["name"];
  }
  if (value.contains("sha256") && value["sha256"].is_string())
  {
    static const std::regex hex(R"(^[0-9a-fA-F]{64}$)");
    const auto sha = value["sha256"].get<std::string>();
    if (std::regex_match(sha, hex))
    {
      descriptor["sha256"] = lower(sha);
    }
  }
  if (value.contains("size") && value["size"].is_number())
  {
    descriptor["size"] = value["size"];
  }
  // Which runtimes it is for: read by whoever provisions them, kept so that a
  // descriptor reads the same on every runtime.
  if (value.contains("runtimes") && value["runtimes"].is_array())
  {
    nlohmann::json runtimes = nlohmann::json::array();
    for (const auto& entry : value["runtimes"])
    {
      if (entry.is_string())
      {
        runtimes.push_back(entry);
      }
    }
    descriptor["runtimes"] = runtimes;
  }
  descriptor[source] = value[source];
  return descriptor;
}

std::map<std::string, nlohmann::json> readAssetsPayload(const nlohmann::json& value)
{
  std::map<std::string, nlohmann::json> entries;
  if (value.is_array())
  {
    for (const auto& item : value)
    {
      if (auto descriptor = readAssetDescriptor(item))
      {
        entries[(*descriptor)["id"].get<std::string>()] = *descriptor;
      }
    }
    return entries;
  }
  if (!value.is_object())
  {
    return entries;
  }
  for (const auto& [id, item] : value.items())
  {
    if (item.is_null())
    {
      if (isAssetId(id))
      {
        entries[id] = nullptr;
      }
      continue;
    }
    if (auto descriptor = readAssetDescriptor(item, id))
    {
      // Keyed by what the payload named, so the id inside cannot disagree.
      (*descriptor)["id"] = id;
      entries[id] = *descriptor;
    }
  }
  return entries;
}

AssetStore::AssetStore(Fetch fetch)
  : m_fetch(std::move(fetch))
{
  if (const char* root = std::getenv("HKP_ASSET_ROOT"))
  {
    m_fileRoot = root;
  }
}

void AssetStore::setFileRoot(const std::string& root)
{
  std::lock_guard lock(m_mutex);
  m_fileRoot = root;
}

void AssetStore::replace(const std::map<std::string, nlohmann::json>& entries)
{
  std::map<std::string, AssetDescriptor> previous;
  {
    std::lock_guard lock(m_mutex);
    previous = m_descriptors;
    m_descriptors.clear();
    for (const auto& [id, entry] : entries)
    {
      if (!entry.is_null())
      {
        m_descriptors[id] = entry;
      }
    }
  }
  std::vector<std::string> touched;
  for (const auto& [id, _] : previous)
  {
    touched.push_back(id);
  }
  for (const auto& [id, _] : entries)
  {
    touched.push_back(id);
  }
  std::sort(touched.begin(), touched.end());
  touched.erase(std::unique(touched.begin(), touched.end()), touched.end());
  for (const auto& id : touched)
  {
    const auto before = previous.count(id) ? previous[id].dump() : "";
    std::string after;
    {
      std::lock_guard lock(m_mutex);
      after = m_descriptors.count(id) ? m_descriptors[id].dump() : "";
    }
    if (before != after)
    {
      changed(id);
    }
  }
}

void AssetStore::merge(const std::map<std::string, nlohmann::json>& entries)
{
  for (const auto& [id, entry] : entries)
  {
    std::string before;
    {
      std::lock_guard lock(m_mutex);
      auto found = m_descriptors.find(id);
      before = found != m_descriptors.end() ? found->second.dump() : "";
      if (entry.is_null())
      {
        m_descriptors.erase(id);
      }
      else
      {
        m_descriptors[id] = entry;
      }
    }
    const auto after = entry.is_null() ? "" : entry.dump();
    if (before != after)
    {
      changed(id);
    }
  }
}

std::vector<std::string> AssetStore::ids() const
{
  std::lock_guard lock(m_mutex);
  std::vector<std::string> out;
  for (const auto& [id, _] : m_descriptors)
  {
    out.push_back(id);
  }
  return out;
}

std::size_t AssetStore::subscribe(const std::string& id,
                                  std::function<void(const std::string&)> listener)
{
  std::lock_guard lock(m_mutex);
  const auto handle = m_nextListener++;
  m_listeners[handle] = { id, std::move(listener) };
  return handle;
}

void AssetStore::unsubscribe(std::size_t handle)
{
  std::lock_guard lock(m_mutex);
  m_listeners.erase(handle);
}

AssetResolution AssetStore::resolve(const std::string& reference)
{
  const auto id = parseAssetRef(reference);
  if (!id)
  {
    return { std::nullopt, "\"" + reference + "\" is not an asset reference" };
  }

  AssetDescriptor descriptor;
  std::optional<CacheEntry> cached;
  {
    std::lock_guard lock(m_mutex);
    auto found = m_descriptors.find(*id);
    if (found == m_descriptors.end())
    {
      return { std::nullopt, "asset \"" + *id + "\" is not known to this runtime" };
    }
    descriptor = found->second;
    auto hit = m_cache.find(*id);
    if (hit != m_cache.end())
    {
      cached = hit->second;
    }
  }

  const auto version = descriptor.dump();
  const bool isUrl = descriptor.contains("url");
  // A URL without a hash is asked again on each use — with its ETag when it
  // came with one, so an unchanged source costs a 304.
  const bool revalidate = isUrl && !descriptor.contains("sha256");
  const bool current = cached && cached->version == version;
  if (current && !revalidate)
  {
    std::lock_guard lock(m_mutex);
    m_cacheOrder.remove(*id);
    m_cacheOrder.push_back(*id);
    return { cached->asset, "" };
  }

  std::string etag;
  std::string problem;
  std::string content;
  try
  {
    content = load(descriptor, current ? &*cached : nullptr, etag, problem);
  }
  catch (const std::exception& error)
  {
    problem = error.what();
  }
  if (!problem.empty())
  {
    return { std::nullopt, "asset \"" + *id + "\": " + problem };
  }
  if (content.size() > maxBytes)
  {
    return { std::nullopt, "asset \"" + *id + "\": larger than " + std::to_string(maxBytes) + " bytes" };
  }
  if (descriptor.contains("sha256"))
  {
    const auto actual = sha256(content);
    if (actual != descriptor["sha256"].get<std::string>())
    {
      return { std::nullopt,
               "asset \"" + *id + "\": content does not match its sha256 (got " + actual + ")" };
    }
  }

  ResolvedAsset asset{ *id, descriptor["mediaType"].get<std::string>(), std::move(content) };
  {
    std::lock_guard lock(m_mutex);
    // Only if the descriptor is still the one this was loaded for: an edit
    // that arrived while a fetch was in flight must not be shadowed by it.
    auto found = m_descriptors.find(*id);
    if (found != m_descriptors.end() && found->second.dump() == version)
    {
      remember(*id, CacheEntry{ version, asset, etag });
    }
  }
  return { asset, "" };
}

std::string AssetStore::load(const AssetDescriptor& descriptor, const CacheEntry* cached,
                             std::string& etagOut, std::string& problem)
{
  if (descriptor.contains("text"))
  {
    return descriptor["text"].get<std::string>();
  }
  if (descriptor.contains("base64"))
  {
    auto bytes = decodeBase64(descriptor["base64"].get<std::string>());
    if (!bytes)
    {
      problem = "its content is not base64";
      return "";
    }
    return std::move(*bytes);
  }

  const auto url = descriptor["url"].get<std::string>();
  const auto colon = url.find("://");
  const auto scheme = colon == std::string::npos ? "" : lower(url.substr(0, colon));

  if (scheme == "file")
  {
    std::string root;
    {
      std::lock_guard lock(m_mutex);
      root = m_fileRoot;
    }
    const auto path = fileInside(root, url);
    if (path.empty())
    {
      problem = root.empty() ? "file:// sources cannot be read by this runtime"
                             : url + " is outside the folder this runtime may read";
      return "";
    }
    std::ifstream in(path, std::ios::binary);
    if (!in)
    {
      problem = "no file at " + url;
      return "";
    }
    std::ostringstream bytes;
    bytes << in.rdbuf();
    return bytes.str();
  }

  if (scheme != "http" && scheme != "https")
  {
    problem = (scheme.empty() ? std::string("this") : scheme + "://") +
              " sources are not supported by this runtime";
    return "";
  }

  std::map<std::string, std::string> headers;
  if (cached && !cached->etag.empty())
  {
    headers["If-None-Match"] = cached->etag;
  }

  // A redirect is followed here rather than by whatever fetches, so that it is
  // followed the same way whichever that is — and only to another http(s)
  // address, a bounded number of times.
  FetchResponse response;
  std::string current = url;
  for (int redirects = 0;; ++redirects)
  {
    try
    {
      response = m_fetch ? m_fetch(current, headers) : fetchUrl(current, headers, maxBytes);
    }
    catch (const std::exception& error)
    {
      problem = current + " is unreachable: " + error.what();
      return "";
    }
    if (!isRedirect(response.status) || response.location.empty())
    {
      break;
    }
    if (redirects >= kMaxRedirects)
    {
      problem = url + " redirected more than " + std::to_string(kMaxRedirects) + " times";
      return "";
    }
    const auto from = urls::parse_uri(current);
    const auto to = urls::parse_uri_reference(response.location);
    urls::url next;
    if (from.has_error() || to.has_error() || urls::resolve(from.value(), to.value(), next).has_error())
    {
      problem = current + " redirected to \"" + response.location + "\", which is not a URL";
      return "";
    }
    if (next.scheme_id() != urls::scheme::http && next.scheme_id() != urls::scheme::https)
    {
      problem = current + " redirected to a " + std::string(next.scheme()) + ":// address";
      return "";
    }
    current = std::string(next.buffer());
  }
  if (response.status == 304 && cached)
  {
    etagOut = cached->etag;
    return cached->asset.content;
  }
  if (response.status < 200 || response.status >= 300)
  {
    problem = url + " answered " + std::to_string(response.status);
    return "";
  }
  etagOut = response.etag;
  return std::move(response.body);
}

void AssetStore::remember(const std::string& id, CacheEntry entry)
{
  forget(id);
  const auto size = entry.asset.content.size();
  if (size > maxCacheBytes)
  {
    return;
  }
  while (!m_cacheOrder.empty() && m_cachedBytes + size > maxCacheBytes)
  {
    forget(m_cacheOrder.front());
  }
  m_cache[id] = std::move(entry);
  m_cacheOrder.push_back(id);
  m_cachedBytes += size;
}

void AssetStore::forget(const std::string& id)
{
  auto found = m_cache.find(id);
  if (found != m_cache.end())
  {
    m_cachedBytes -= found->second.asset.content.size();
    m_cache.erase(found);
    m_cacheOrder.remove(id);
  }
}

void AssetStore::changed(const std::string& id)
{
  std::vector<std::function<void(const std::string&)>> listeners;
  {
    std::lock_guard lock(m_mutex);
    forget(id);
    for (const auto& [_, entry] : m_listeners)
    {
      if (entry.first == id)
      {
        listeners.push_back(entry.second);
      }
    }
  }
  for (const auto& listener : listeners)
  {
    try
    {
      listener(id);
    }
    catch (const std::exception& error)
    {
      std::cerr << "[assets] listener for \"" << id << "\" failed: " << error.what() << std::endl;
    }
  }
}

} // namespace hkp
