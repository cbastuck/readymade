#pragma once

#include <algorithm>
#include <filesystem>
#include <sstream>
#include <string>
#include <vector>

/**
 * The folders a person lets boards read and write on the embedded runtime.
 *
 * The runtime opens a path a board names only inside a folder it was given
 * (hkp-rt's files.h). This app gives it one of its own,
 * `~/.hkp/cpp/files`, where a relative path lands, and whatever the person
 * adds in `fileFolders` of ~/.hkp/settings.json — chosen with the folder
 * picker, so what arrives may be a file:// URL rather than a path.
 *
 * A folder holding this app's own data is never one of them: `~/.hkp` keeps
 * the vault, the grants and the settings that name which sites may call the
 * runtime, and a board that could write those could undo every one of them.
 * Adding the home folder would be exactly that, so it is refused like `~/.hkp`
 * itself.
 */
namespace readymade
{

/** A file:// URI as a native path; anything else as given. Handles the
 *  optional "localhost" authority and percent-decodes the path. */
inline std::string fileUriToPath(const std::string& uri)
{
  if (!uri.starts_with("file://"))
  {
    return uri;
  }
  std::string path = uri.substr(7); // strip "file://"
  if (path.starts_with("localhost"))
  {
    path = path.substr(9);
  }
  std::string decoded;
  decoded.reserve(path.size());
  for (std::size_t i = 0; i < path.size(); ++i)
  {
    if (path[i] == '%' && i + 2 < path.size())
    {
      int val = 0;
      std::istringstream ss(path.substr(i + 1, 2));
      ss >> std::hex >> val;
      decoded += static_cast<char>(val);
      i += 2;
    }
    else
    {
      decoded += path[i];
    }
  }
  return decoded;
}

/** Whether `a` is `b` or lies beneath it, both lexically normal. */
inline bool isWithinFolder(const std::filesystem::path& a, const std::filesystem::path& b)
{
  const auto rel = a.lexically_relative(b);
  return !rel.empty() && *rel.begin() != "..";
}

/**
 * Whether `a` is `b` or lies beneath it on disk: `a` with its symlinks
 * followed, then it and each folder around it compared with `b` as the file
 * system sees them. Neither a symlink, nor a spelling that differs only in
 * case on a volume that ignores case, nor a second route to the same folder
 * (`/System/Volumes/Data/Users/…`) gets past it. What does not exist is never
 * the same as anything.
 */
inline bool isWithinFolderOnDisk(const std::filesystem::path& a, const std::filesystem::path& b)
{
  namespace fs = std::filesystem;
  std::error_code ec;
  auto current = fs::weakly_canonical(a, ec);
  if (ec)
  {
    return false;
  }
  while (true)
  {
    if (fs::equivalent(current, b, ec) && !ec)
    {
      return true;
    }
    if (!current.has_relative_path())
    {
      return false;
    }
    current = current.parent_path();
  }
}

/**
 * The folders as they are kept: absolute paths, normal, each once, none
 * holding or held by `appData` (`~/.hkp`) — as spelled or on disk. A relative
 * path or an empty one is dropped rather than guessed at. Settings are read
 * through this too, so a hand-edited file is held to the same rule.
 */
inline std::vector<std::string> normalizeFileFolders(const std::vector<std::string>& values,
                                                     const std::filesystem::path& appData)
{
  namespace fs = std::filesystem;
  const auto data = appData.lexically_normal();
  std::vector<std::string> folders;
  for (const auto& value : values)
  {
    const auto first = value.find_first_not_of(" \t\r\n");
    if (first == std::string::npos)
    {
      continue;
    }
    const auto last = value.find_last_not_of(" \t\r\n");
    fs::path folder = fs::path(fileUriToPath(value.substr(first, last - first + 1))).lexically_normal();
    if (!folder.is_absolute())
    {
      continue;
    }
    // `/a/b/` and `/a/b` are one folder.
    if (!folder.has_filename() && folder != folder.root_path())
    {
      folder = folder.parent_path();
    }
    // By spelling, and then on disk: the runtime follows a folder's symlinks
    // before it compares a board's path with it (files.h), so a folder that
    // only looks unrelated to `~/.hkp` here would hold it there.
    if (isWithinFolder(folder, data) || isWithinFolder(data, folder) || isWithinFolderOnDisk(folder, appData) ||
        isWithinFolderOnDisk(appData, folder))
    {
      continue;
    }
    const auto kept = folder.string();
    if (std::find(folders.begin(), folders.end(), kept) == folders.end())
    {
      folders.push_back(kept);
    }
  }
  return folders;
}

} // namespace readymade
