#pragma once

#include <algorithm>
#include <cstdint>
#include <functional>
#include <list>
#include <map>
#include <memory>
#include <mutex>
#include <optional>
#include <regex>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>


namespace hkp {

// Assets a runtime was given, and the one way to their content.
//
// A board declares content once — a page, a script, an image, a model — as an
// asset *descriptor*: an id, a media type and exactly one source. Service state
// names one by reference, `hkp-asset://<id>`, as a whole field, and never holds
// the content itself. getState() therefore echoes the reference, and saving a
// board writes back what was configured: there is no round trip to undo.
//
// The descriptors arrive with the runtime's create payload, or on
// POST /runtimes/<id>/assets — and again whenever an asset is edited, which is
// the point: a service resolves its reference at the moment it uses it, so the
// next use gets the new content without anything being reconfigured. A runtime
// is given every asset of its board that is not kept to other runtimes, named
// by its services or not: which one a service uses can be decided as it runs.
//
// Where the content comes from depends on the source:
//
//   text, base64   already in the descriptor
//   http(s)://     fetched by this runtime as anyone would fetch it, following
//                  redirects to other http(s) addresses, cached by sha256 or
//                  revalidated by ETag
//   file://        only inside the root this host was given (HKP_ASSET_ROOT);
//                  refused everywhere else, never read
//
// An asset carries no request headers and names no secret. It is resolved
// without anyone looking, by every runtime holding it, which is no place for a
// credential; content that needs one is fetched by a service that says where
// it sends it.
//
// The format matches hkp-frontend/src/runtime/board/assets.ts and
// hkp-node/src/assets.ts: a board written against one runtime has to open
// against another.

using AssetDescriptor = nlohmann::json;

struct ResolvedAsset
{
  std::string id;
  std::string mediaType;
  std::string content; // raw bytes
};

struct AssetResolution
{
  // Empty when there is none.
  std::optional<ResolvedAsset> asset;
  // Why there is none, or empty when there is.
  std::string problem;
};

inline const std::string& assetScheme()
{
  static const std::string scheme = "hkp-asset://";
  return scheme;
}

inline bool isAssetId(const std::string& id)
{
  static const std::regex pattern(R"(^[A-Za-z0-9_.\-]+$)");
  return std::regex_match(id, pattern);
}

// The id a whole-value reference names, or nothing for anything else. A
// reference inside a longer string is not one: nothing is spliced into text.
inline std::optional<std::string> parseAssetRef(const std::string& value)
{
  static const std::regex pattern(R"(^hkp-asset://([A-Za-z0-9_.\-]+)$)");
  std::smatch match;
  if (std::regex_match(value, match, pattern))
  {
    return match[1].str();
  }
  return std::nullopt;
}

inline std::optional<std::string> parseAssetRef(const nlohmann::json& value)
{
  return value.is_string() ? parseAssetRef(value.get<std::string>()) : std::nullopt;
}

// Every asset id a value mentions, however deeply it is nested — found anywhere
// in a string, so a reference an expression produces is still one this runtime
// is told about. Finding is generous; resolving is not.
inline void findAssetRefs(const nlohmann::json& value, std::vector<std::string>& into)
{
  static const std::regex pattern(R"(hkp-asset://([A-Za-z0-9_.\-]+))");
  if (value.is_string())
  {
    const auto text = value.get<std::string>();
    for (std::sregex_iterator it(text.begin(), text.end(), pattern), end; it != end; ++it)
    {
      const auto id = (*it)[1].str();
      if (std::find(into.begin(), into.end(), id) == into.end())
      {
        into.push_back(id);
      }
    }
  }
  else if (value.is_array() || value.is_object())
  {
    for (const auto& child : value)
    {
      findAssetRefs(child, into);
    }
  }
}

// Whether a media type is text a pipeline can carry as a string.
inline bool isTextMediaType(std::string mediaType)
{
  mediaType = mediaType.substr(0, mediaType.find(';'));
  mediaType.erase(0, mediaType.find_first_not_of(" \t"));
  mediaType.erase(mediaType.find_last_not_of(" \t") + 1);
  std::transform(mediaType.begin(), mediaType.end(), mediaType.begin(),
                 [](unsigned char c) { return std::tolower(c); });
  auto endsWith = [&](const std::string& suffix)
  {
    return mediaType.size() >= suffix.size() &&
           mediaType.compare(mediaType.size() - suffix.size(), suffix.size(), suffix) == 0;
  };
  return mediaType.rfind("text/", 0) == 0 || mediaType == "application/json" ||
         endsWith("+json") || mediaType == "application/javascript" ||
         mediaType == "application/xml" || endsWith("+xml");
}

// One descriptor off the wire, or nothing when it is not one. Exactly one
// source, or it is not an asset: two would leave a runtime choosing between
// them.
std::optional<AssetDescriptor> readAssetDescriptor(const nlohmann::json& value,
                                                   const std::string& fallbackId = "");

// Reads an assets payload off the wire: a map of id to descriptor, where null
// removes one, or a list of descriptors. Anything it cannot read is dropped
// rather than failing the request — a malformed entry costs one asset, and the
// service referencing it says so by name. A removal is an entry holding null.
std::map<std::string, nlohmann::json> readAssetsPayload(const nlohmann::json& value);

// The bytes base64 text stands for, or nothing when it is not base64.
//
// Beast's decoder stops at the first character it does not recognise and hands
// back what it had, so text that is not base64 — or base64 wrapped over lines —
// would come out as some of its bytes. What is taken here is what a browser's
// atob takes — ASCII whitespace ignored, the standard alphabet, padding
// optional — so that a descriptor resolves to the same content, or the same
// refusal, on every runtime.
std::optional<std::string> decodeBase64(const std::string& encoded);

class AssetStore
{
public:
  // How one address is fetched. Supplied for tests; the default speaks HTTP and
  // HTTPS through Beast. Answers status, body and ETag, or throws. One request:
  // the store follows a redirect itself, so it does with any fetch.
  struct FetchResponse
  {
    int status = 0;
    std::string body;
    std::string etag;
    // Where a redirect points, as the response gave it; empty otherwise.
    std::string location;
  };
  using Fetch = std::function<FetchResponse(const std::string& url,
                                            const std::map<std::string, std::string>& headers)>;

  explicit AssetStore(Fetch fetch = nullptr);

  // Replaces everything held.
  void replace(const std::map<std::string, nlohmann::json>& entries);

  // Adds, replaces or removes (a null entry) individual descriptors, leaving the
  // rest alone. An asset deleted from the board is gone from every runtime that
  // was told about it, rather than served on from a stale copy.
  void merge(const std::map<std::string, nlohmann::json>& entries);

  // The ids held, for saying what a runtime knows about.
  std::vector<std::string> ids() const;

  // Called with an asset's id whenever its descriptor changes or goes away.
  // Only a service that loads something once needs it. Returns a handle for
  // unsubscribe().
  std::size_t subscribe(const std::string& id, std::function<void(const std::string&)> listener);
  void unsubscribe(std::size_t handle);

  // An asset's content for one use, or a sentence saying why there is none.
  // Blocking: a URL source is fetched on the calling thread.
  AssetResolution resolve(const std::string& reference);

  // Where file:// sources may be read from; empty refuses them all. Defaults to
  // HKP_ASSET_ROOT.
  void setFileRoot(const std::string& root);

  std::size_t maxBytes = 64 * 1024 * 1024;
  std::size_t maxCacheBytes = 128 * 1024 * 1024;

private:
  struct CacheEntry
  {
    std::string version;
    ResolvedAsset asset;
    std::string etag;
  };

  std::string load(const AssetDescriptor& descriptor, const CacheEntry* cached,
                   std::string& etagOut, std::string& problem);
  void remember(const std::string& id, CacheEntry entry);
  void forget(const std::string& id);
  void changed(const std::string& id);

  mutable std::recursive_mutex m_mutex;
  std::map<std::string, AssetDescriptor> m_descriptors;
  std::map<std::string, CacheEntry> m_cache;
  std::list<std::string> m_cacheOrder; // least recently used first
  std::size_t m_cachedBytes = 0;
  std::map<std::size_t, std::pair<std::string, std::function<void(const std::string&)>>> m_listeners;
  std::size_t m_nextListener = 1;
  Fetch m_fetch;
  std::string m_fileRoot;
};

} // namespace hkp
