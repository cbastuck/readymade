#pragma once

#include <algorithm>
#include <chrono>
#include <ctime>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iterator>
#include <optional>
#include <sstream>
#include <string>
#include <system_error>
#include <vector>

#include "boardName.h"

/**
 * The boards the Readymade iOS app keeps in iCloud Drive, seen from the Mac.
 *
 * The iOS app keeps its board library in the iCloud container
 * `iCloud.com.readymadeit.readymade` (`BoardLibrary.swift`), whose public
 * Documents folder iCloud Drive brings to every Mac signed in to the same
 * account. This app is not sandboxed, so it reads and writes that folder as an
 * ordinary path. It names boards the way the iOS app does, which is this app's
 * own rule (`boardName.h`): the same board is the same file on both.
 *
 * Apart from the settings and the scheme handler so it can be tested without
 * saucer or the runtime library.
 */
namespace readymade
{

class SharedBoards
{
public:
  struct Entry
  {
    std::string name;
    /** Last write time as ISO 8601 UTC; empty when it could not be read. */
    std::string modified;
  };

  explicit SharedBoards(std::filesystem::path directory) : m_directory(std::move(directory)) {}

  /** Where iCloud Drive keeps the iOS app's boards under `home`. */
  static std::filesystem::path iCloudFolder(const std::filesystem::path &home)
  {
    return home / "Library" / "Mobile Documents" / "iCloud~com~readymadeit~readymade" / "Documents" /
           "Boards";
  }

  /** Whether the folder is there: iCloud Drive is on, and the iOS app has written to it. */
  bool available() const
  {
    std::error_code ec;
    return !m_directory.empty() && std::filesystem::is_directory(m_directory, ec);
  }

  /**
   * The boards, by name. A board iCloud has not brought to this Mac yet is a
   * hidden placeholder, `.<file>.icloud`, on macOS versions before iCloud
   * Drive's files became dataless; it is listed all the same.
   */
  std::vector<Entry> list() const
  {
    std::vector<Entry> entries;
    if (!available())
    {
      return entries;
    }
    std::error_code ec;
    for (const auto &item : std::filesystem::directory_iterator(m_directory, ec))
    {
      auto fileName = item.path().filename().string();
      const std::string placeholderSuffix = ".icloud";
      if (fileName.size() > placeholderSuffix.size() + 1 && fileName.front() == '.' &&
          fileName.compare(fileName.size() - placeholderSuffix.size(), placeholderSuffix.size(),
                           placeholderSuffix) == 0)
      {
        fileName = fileName.substr(1, fileName.size() - 1 - placeholderSuffix.size());
      }
      else if (fileName.front() == '.')
      {
        continue;
      }
      const std::filesystem::path file(fileName);
      if (file.extension() != ".hkpp")
      {
        continue;
      }
      const auto name = decodeBoardNameFromStorage(file.stem().string());
      if (!isValidBoardName(name))
      {
        continue;
      }
      entries.push_back({name, isoWriteTime(m_directory / fileName)});
    }
    std::sort(entries.begin(), entries.end(), [](const Entry &a, const Entry &b) { return a.name < b.name; });
    return entries;
  }

  std::optional<std::string> load(const std::string &name) const
  {
    if (!isValidBoardName(name))
    {
      return std::nullopt;
    }
    std::ifstream file(fileFor(name), std::ios::binary);
    if (!file.is_open())
    {
      return std::nullopt;
    }
    std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
    if (content.empty())
    {
      return std::nullopt;
    }
    return content;
  }

  bool save(const std::string &name, const std::string &content) const
  {
    if (!isValidBoardName(name) || !available())
    {
      return false;
    }
    // Written beside and then moved over, so iCloud never uploads half a board.
    const auto target = fileFor(name);
    auto staging = target;
    staging += ".saving";
    {
      std::ofstream file(staging, std::ios::binary | std::ios::trunc);
      if (!file.is_open())
      {
        return false;
      }
      file.write(content.data(), static_cast<std::streamsize>(content.size()));
      if (!file)
      {
        return false;
      }
    }
    std::error_code ec;
    std::filesystem::rename(staging, target, ec);
    if (ec)
    {
      std::filesystem::remove(staging, ec);
      return false;
    }
    return true;
  }

  bool remove(const std::string &name) const
  {
    if (!isValidBoardName(name))
    {
      return false;
    }
    std::error_code ec;
    std::filesystem::remove(fileFor(name), ec);
    return !ec;
  }

  std::filesystem::path fileFor(const std::string &name) const
  {
    return m_directory / (encodeBoardNameForStorage(name) + ".hkpp");
  }

private:
  static std::string isoWriteTime(const std::filesystem::path &path)
  {
    namespace fs = std::filesystem;
    std::error_code ec;
    const auto fileTime = fs::last_write_time(path, ec);
    if (ec)
    {
      return {};
    }
    const auto systemTime = std::chrono::time_point_cast<std::chrono::system_clock::duration>(
        fileTime - fs::file_time_type::clock::now() + std::chrono::system_clock::now());
    const std::time_t seconds = std::chrono::system_clock::to_time_t(systemTime);
    std::tm utc{};
#if defined(_WIN32)
    gmtime_s(&utc, &seconds);
#else
    gmtime_r(&seconds, &utc);
#endif
    std::ostringstream out;
    out << std::put_time(&utc, "%Y-%m-%dT%H:%M:%SZ");
    return out.str();
  }

  std::filesystem::path m_directory;
};

} // namespace readymade
