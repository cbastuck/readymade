#pragma once

#include <algorithm>
#include <cctype>
#include <filesystem>
#include <mutex>
#include <string>
#include <system_error>
#include <vector>

/**
 * Which documents this app's webview trusts, and what it lets them do.
 *
 * Everything the native host exposes — the vault, the grants, files on disk,
 * the camera and microphone — is exposed to whatever document the webview
 * holds. saucer's bridge does not say which frame called it, and WebKit offers
 * its message handler to every frame, so the host cannot ask a caller who it
 * is. What it can decide is what loads: only the app's own pages, in the main
 * frame or any other. Everything here is in aid of keeping that true, or of
 * limiting the damage if it is not.
 *
 * Pure rules, kept apart from saucer so that tests build without it; main.cpp
 * applies them.
 */
namespace readymade
{

/**
 * The origin of a URL — scheme, host and port, lowercased — or "" when it has
 * none. A `blob:` URL has its creator's origin. `about:` and `data:` have
 * none: what they mean depends on who opened them, which is decided apart.
 */
inline std::string originOf(std::string url)
{
  std::transform(url.begin(), url.end(), url.begin(),
                 [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
  if (url.starts_with("blob:"))
  {
    url.erase(0, 5);
  }
  const auto scheme = url.find("://");
  if (scheme == std::string::npos || scheme == 0)
  {
    return "";
  }
  const auto authority = scheme + 3;
  const auto end = url.find_first_of("/?#", authority);
  auto origin = end == std::string::npos ? url : url.substr(0, end);
  // Credentials in the authority would make a lookalike: `saucer://embedded@evil`.
  if (origin.size() == authority || origin.find('@', authority) != std::string::npos)
  {
    return "";
  }
  return origin;
}

/** Whether `url` is one of the app's own pages, by its origin. */
inline bool isOwnPage(const std::vector<std::string>& ownOrigins, const std::string& url)
{
  const auto origin = originOf(url);
  return !origin.empty() &&
         std::find(ownOrigins.begin(), ownOrigins.end(), origin) != ownOrigins.end();
}

/** What the webview does with a navigation it is asked about. */
enum class Navigation
{
  load,
  openInBrowser,
  block,
};

/**
 * A navigation, in the main frame or any other, loads only an own page. The
 * empty documents a page makes for itself — `about:blank`, `about:srcdoc` —
 * load too: they belong to whoever made them, and only own pages are there to
 * make one.
 *
 * Anything else is not loaded. A web address the person asked for — a link
 * they clicked, a new window — opens in their browser instead. One a page
 * asked for on its own, a redirect included, is only refused, so that no
 * page can open the person's browser at will.
 */
inline Navigation decideNavigation(const std::vector<std::string>& ownOrigins,
                                   const std::string& url,
                                   bool newWindow,
                                   bool userInitiated,
                                   bool redirect)
{
  const auto origin = originOf(url);
  const bool isWeb = origin.starts_with("http://") || origin.starts_with("https://");
  if (newWindow)
  {
    // As before this policy: a new window is never one of ours.
    return isWeb ? Navigation::openInBrowser : Navigation::block;
  }
  if (url == "about:blank" || url == "about:srcdoc" || isOwnPage(ownOrigins, url))
  {
    return Navigation::load;
  }
  return isWeb && userInitiated && !redirect ? Navigation::openInBrowser : Navigation::block;
}

/** What a page asks a permission for, in the host's terms rather than an
 *  engine's. */
struct DeviceRequest
{
  bool microphone = false;
  bool camera = false;
  bool location = false;
  /** Anything else: the screen, the clipboard, notifications, … */
  bool other = false;
};

/**
 * A permission is granted only to an own page, and only for what boards use:
 * the microphone, the camera, the person's location.
 */
inline bool mayGrantPermission(const std::vector<std::string>& ownOrigins,
                               const std::string& url,
                               const DeviceRequest& request)
{
  const bool asksSomething = request.microphone || request.camera || request.location;
  return asksSomething && !request.other && isOwnPage(ownOrigins, url);
}

/**
 * The files a page may read and write through the host: what the person
 * picked in this session, and, for reading, what lies under the folder of a
 * file they picked. That is where a composition's units are; a board naming
 * a file anywhere else — `../../..`, `file:///…` — is told no.
 *
 * Paths are compared as `weakly_canonical` makes them, so neither `..` nor a
 * symlink leads out of a granted folder.
 */
class FileGrants
{
public:
  /** A file the person picked to open: it, and what lies beside or below it. */
  void grantFile(const std::filesystem::path& file)
  {
    std::lock_guard lock{m_mutex};
    m_readRoots.push_back(canonical(file).parent_path());
  }

  /** A folder the person picked: what lies in it, at any depth. */
  void grantFolder(const std::filesystem::path& folder)
  {
    std::lock_guard lock{m_mutex};
    m_readRoots.push_back(canonical(folder));
  }

  /** A path the person picked to save to: that one path, for writing. */
  void grantSave(const std::filesystem::path& file)
  {
    std::lock_guard lock{m_mutex};
    m_writable.push_back(canonical(file));
  }

  bool mayRead(const std::filesystem::path& file) const
  {
    std::lock_guard lock{m_mutex};
    const auto path = canonical(file);
    return std::any_of(m_readRoots.begin(), m_readRoots.end(),
                       [&](const auto& root) { return isUnder(path, root); }) ||
           std::find(m_writable.begin(), m_writable.end(), path) != m_writable.end();
  }

  bool mayWrite(const std::filesystem::path& file) const
  {
    std::lock_guard lock{m_mutex};
    return std::find(m_writable.begin(), m_writable.end(), canonical(file)) != m_writable.end();
  }

private:
  static std::filesystem::path canonical(const std::filesystem::path& path)
  {
    std::error_code error;
    auto resolved = std::filesystem::weakly_canonical(path, error);
    return error ? std::filesystem::path{} : resolved;
  }

  /** Whether `path` is `root` or inside it, component by component — so that
   *  `/a/bc` is not inside `/a/b`. An empty root holds nothing. */
  static bool isUnder(const std::filesystem::path& path, const std::filesystem::path& root)
  {
    if (root.empty() || path.empty())
    {
      return false;
    }
    auto p = path.begin();
    for (auto r = root.begin(); r != root.end(); ++r, ++p)
    {
      // A trailing separator leaves an empty last component behind.
      if (r->empty() && std::next(r) == root.end())
      {
        break;
      }
      if (p == path.end() || *p != *r)
      {
        return false;
      }
    }
    return true;
  }

  mutable std::mutex m_mutex;
  std::vector<std::filesystem::path> m_readRoots;
  std::vector<std::filesystem::path> m_writable;
};

} // namespace readymade
