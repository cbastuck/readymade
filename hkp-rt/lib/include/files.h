#pragma once

#include <filesystem>
#include <fstream>
#include <mutex>
#include <optional>
#include <string>
#include <system_error>
#include <utility>
#include <vector>

namespace hkp
{

/**
 * Where a board may make this server read and write files.
 *
 * A board names paths — a Filesystem's file, a Monitor's log, a Cache's
 * folder, a WAV to read — and the server opens them. Opened as given, that is
 * the whole machine: the vault and settings beside the desktop app
 * (`~/.hkp/vault.json`, `~/.hkp/settings.json`, which names the origins the
 * runtime admits), a hosted server's mount secret and coordinator tickets,
 * `/proc/self/environ`. A board is something somebody else may have written,
 * so a path it names is reached only when it lies inside a **folder** this
 * server was given:
 *
 * - the first folder is the default: a relative path is taken from it, which
 *   is what lets a board say `"recordings"` and mean the same thing on every
 *   machine — a standalone server's `HKP_FILES_DIR`, the desktop app's
 *   `~/.hkp/cpp/files`;
 * - the others are what the person or the operator added
 *   (`HKP_FILES_ALLOW`, the desktop's settings), named by absolute path.
 *
 * With no folders nothing is reached — what a host that says nothing gets,
 * the mobile apps among them.
 *
 * **Judged on what the path is, not on how it is spelled.** A path is made
 * canonical before it is compared — `..` taken out, every symlink that exists
 * followed — so neither leads outside. A name a service received as data (the
 * file inside a configured folder, a cache entry's file name) is taken inside
 * that folder whatever it says, absolute or not: data never chooses the
 * folder. What a check cannot see is a symlink planted between the check and
 * the open; nothing a board can drive creates one, and a folder should hold
 * nothing but what boards may have.
 *
 * Services open what `resolve` and `resolveIn` return, through `input`,
 * `output` and `list`; `tests/files_sources.test.cpp` fails on a file opened
 * anywhere else. hkp-rt has one tenant, so everyone a hosted server admits
 * shares its folders. Paths the operator names — a runtime config, plugins,
 * the coordinator tickets — are not a board's and are not judged here.
 */
namespace files
{

class Path;
inline std::optional<Path> resolve(const std::string& text, std::string& problem);
inline std::optional<Path> resolveIn(const Path& folder, const std::string& name, std::string& problem);

/** A path a board named, inside one of the folders. Only `resolve` and
 *  `resolveIn` make one. */
class Path
{
public:
  const std::filesystem::path& path() const { return m_path; }
  std::string string() const { return m_path.string(); }

private:
  explicit Path(std::filesystem::path path) : m_path(std::move(path)) {}
  std::filesystem::path m_path;

  friend std::optional<Path> resolve(const std::string& text, std::string& problem);
  friend std::optional<Path> resolveIn(const Path& folder, const std::string& name, std::string& problem);
};

/** The folders, as given. Read through `setFolders`, which makes them canonical. */
inline std::vector<std::filesystem::path>& activeFolders()
{
  static std::vector<std::filesystem::path> folders;
  return folders;
}

inline std::mutex& foldersMutex()
{
  static std::mutex mutex;
  return mutex;
}

/** Gives boards these folders, the first being the default. Replaces what was
 *  given before; an empty list gives them none. */
inline void setFolders(const std::vector<std::filesystem::path>& folders)
{
  std::vector<std::filesystem::path> canonical;
  for (const auto& folder : folders)
  {
    if (folder.empty() || !folder.is_absolute())
    {
      continue;
    }
    std::error_code ec;
    auto resolved = std::filesystem::weakly_canonical(folder, ec);
    if (!ec)
    {
      canonical.push_back(std::move(resolved));
    }
  }
  std::lock_guard lock{foldersMutex()};
  activeFolders() = std::move(canonical);
}

inline std::vector<std::filesystem::path> folders()
{
  std::lock_guard lock{foldersMutex()};
  return activeFolders();
}

/** Whether `candidate` is `folder` or lies beneath it. Both canonical. */
inline bool isInside(const std::filesystem::path& candidate, const std::filesystem::path& folder)
{
  const auto rel = candidate.lexically_relative(folder);
  return !rel.empty() && *rel.begin() != "..";
}

/**
 * The file or folder `text` names, when it lies inside one of the folders; a
 * relative path is taken from the first. Otherwise nothing, and `problem`
 * says why.
 */
inline std::optional<Path> resolve(const std::string& text, std::string& problem)
{
  const auto given = folders();
  if (given.empty())
  {
    problem = "This server gives boards no folder to use (" + text + ")";
    return std::nullopt;
  }
  if (text.empty())
  {
    problem = "No path given";
    return std::nullopt;
  }
  std::filesystem::path named(text);
  if (!named.is_absolute())
  {
    if (named.has_root_path())
    {
      // `C:file` or `\file` on Windows: neither relative nor absolute.
      problem = text + " is not a path this server takes";
      return std::nullopt;
    }
    named = given.front() / named;
  }
  std::error_code ec;
  auto candidate = std::filesystem::weakly_canonical(named, ec);
  if (ec)
  {
    problem = text + " cannot be resolved: " + ec.message();
    return std::nullopt;
  }
  for (const auto& folder : given)
  {
    if (isInside(candidate, folder))
    {
      return Path(std::move(candidate));
    }
  }
  problem = text + " is outside the folders this server gives boards";
  return std::nullopt;
}

/**
 * `name` taken inside `folder`, never outside it: a name a service received as
 * data rather than from its configuration. Absolute or not, it is read as
 * relative to `folder`.
 */
inline std::optional<Path> resolveIn(const Path& folder, const std::string& name, std::string& problem)
{
  const auto relative = std::filesystem::path(name).relative_path();
  std::error_code ec;
  auto candidate = std::filesystem::weakly_canonical(folder.path() / relative, ec);
  if (ec)
  {
    problem = name + " cannot be resolved: " + ec.message();
    return std::nullopt;
  }
  if (!isInside(candidate, folder.path()))
  {
    problem = name + " is outside " + folder.string();
    return std::nullopt;
  }
  return Path(std::move(candidate));
}

/** `path` opened for reading. */
inline std::ifstream input(const Path& path, std::ios::openmode mode = std::ios::binary)
{
  return std::ifstream(path.path(), std::ios::in | mode);
}

/** `path` opened for writing; `std::ios::app` appends. The folders it is
 *  written into are made when missing — they lie inside the same folder. */
inline std::ofstream output(const Path& path, std::ios::openmode mode = std::ios::binary)
{
  std::error_code ec;
  std::filesystem::create_directories(path.path().parent_path(), ec);
  return std::ofstream(path.path(), std::ios::out | mode);
}

/** The names in the folder `path`; empty when it is not one. */
inline std::vector<std::string> list(const Path& path)
{
  std::vector<std::string> names;
  std::error_code ec;
  for (std::filesystem::directory_iterator it(path.path(), ec), end; !ec && it != end; it.increment(ec))
  {
    names.push_back(it->path().filename().string());
  }
  return names;
}

/** Whether `path` names a file or folder that exists. */
inline bool exists(const Path& path)
{
  std::error_code ec;
  return std::filesystem::exists(path.path(), ec);
}

/** Whether `path` names a folder. */
inline bool isFolder(const Path& path)
{
  std::error_code ec;
  return std::filesystem::is_directory(path.path(), ec);
}

/**
 * The folders a list names, separated as `PATH` is (`:`, or `;` on Windows).
 * An entry that is not absolute is an error rather than skipped — an operator
 * who meant to give a folder should learn now that none was given.
 */
inline std::vector<std::filesystem::path> readFolderList(const std::string& list, const std::string& name,
                                                         std::string& error)
{
#if defined(_WIN32)
  constexpr char separator = ';';
#else
  constexpr char separator = ':';
#endif
  std::vector<std::filesystem::path> out;
  size_t start = 0;
  while (start <= list.size())
  {
    const auto end = list.find(separator, start);
    std::string entry = list.substr(start, end == std::string::npos ? std::string::npos : end - start);
    const auto first = entry.find_first_not_of(" \t");
    const auto last = entry.find_last_not_of(" \t");
    entry = first == std::string::npos ? "" : entry.substr(first, last - first + 1);
    if (!entry.empty())
    {
      if (!std::filesystem::path(entry).is_absolute())
      {
        error = name + ": \"" + entry + "\" is not an absolute path";
        return {};
      }
      out.emplace_back(entry);
    }
    if (end == std::string::npos)
    {
      break;
    }
    start = end + 1;
  }
  return out;
}

} // namespace files
} // namespace hkp
