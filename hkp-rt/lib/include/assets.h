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

#include "models.h"

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
// Content is held in memory, and no asset larger than 64 MB is. What a library
// loads by file path — a model's weights — is resolved to a *path* instead
// (resolvePath): the content is written once to a folder this server owns,
// under its sha256, and found there by every runtime and after every restart.
// Only an asset that says its sha256 is kept that way; the hash is the file's
// name and the check that what was fetched is what the board meant.
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

struct AssetPathResolution
{
  // The file holding the content; empty when there is none.
  std::string path;
  // Why there is none, or empty when there is.
  std::string problem;
  // What the file holds, for keying whatever is loaded from it.
  std::string sha256;
};

// Told how much of a file has arrived, and how much is expected — nothing when
// the source did not say.
using AssetProgress =
  std::function<void(std::uint64_t received, std::optional<std::uint64_t> expected)>;

// Asset content kept as files, each named by the sha256 of what it holds.
//
// One folder per server, shared by its runtimes: two boards naming the same
// model fetch it once. A file appears under its name only after its content
// was hashed and matched, so what is found here is not checked again. When the
// folder passes its limit the files used longest ago go first.
class AssetFileCache
{
public:
  // Takes content as it arrives, with how much the source says there is.
  using Sink = std::function<void(const char* data, std::size_t size,
                                  std::optional<std::uint64_t> expected)>;

  explicit AssetFileCache(std::string folder,
                          std::uint64_t maxBytes = 8ull * 1024 * 1024 * 1024);

  // This server's folder: HKP_ASSET_CACHE, else ~/.hkp/cpp/asset-cache, holding
  // at most HKP_ASSET_CACHE_MAX_BYTES. Null where there is neither — a host
  // with no home folder that was given none.
  static std::shared_ptr<AssetFileCache> shared();

  const std::string& folder() const { return m_folder; }
  // Everything kept together, and so also the largest single file.
  std::uint64_t maxBytes() const { return m_maxBytes; }

  // Held while a file is fetched, so two askers wait for one download.
  std::shared_ptr<std::mutex> lockFor(const std::string& sha256);

  // How far the fetch of `sha256` is, when one is under way — for whoever is
  // waiting on it rather than doing it.
  struct Fetching
  {
    std::uint64_t received = 0;
    std::optional<std::uint64_t> expected;
  };
  std::optional<Fetching> fetching(const std::string& sha256);

  // The file named `sha256`, or empty. Finding it counts as using it.
  std::string find(const std::string& sha256);

  // Writes what `produce` hands its sink to the file named `sha256`, if that
  // is what it is. Throws, with a sentence, when it is not, when it is larger
  // than the folder may hold, or when `produce` throws — and keeps nothing.
  std::string put(const std::string& sha256,
                  const std::function<void(const Sink&)>& produce,
                  const AssetProgress& progress = nullptr);

private:
  void makeRoom(const std::string& keep);

  std::string m_folder;
  std::uint64_t m_maxBytes;
  std::mutex m_mutex;
  std::map<std::string, std::shared_ptr<std::mutex>> m_locks;
  std::map<std::string, Fetching> m_fetching;
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
  // Takes a body as it arrives, instead of FetchResponse::body holding it.
  using BodySink = AssetFileCache::Sink;

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

  // A file holding an asset's content, for a library that loads by path.
  //
  // Blocking, and for a first use possibly for minutes: the content is fetched
  // to this server's folder, and `progress` is told how far it is — also when
  // another caller is the one fetching it and this one waits. Every later
  // use, by any runtime, finds the file there. Only for an asset that says its
  // sha256. The file belongs to the server: it is read, never written to or
  // removed by whoever is handed its path.
  AssetPathResolution resolvePath(const std::string& reference,
                                  const AssetProgress& progress = nullptr);

  // Where content resolved to a path is kept; AssetFileCache::shared() unless
  // given one.
  void setFileCache(std::shared_ptr<AssetFileCache> files);

  // What this runtime's services loaded from those files; see models.h.
  ModelCache models;

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

  // `sink`, when given, takes the body of a URL or file source as it arrives;
  // what is returned is then empty. `limit` is how large it may be.
  std::string load(const AssetDescriptor& descriptor, const CacheEntry* cached,
                   std::string& etagOut, std::string& problem,
                   const BodySink* sink = nullptr, std::uint64_t limit = 0);
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
  std::shared_ptr<AssetFileCache> m_files;
};

} // namespace hkp
