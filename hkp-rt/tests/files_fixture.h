#pragma once

#include <atomic>
#include <chrono>
#include <filesystem>
#include <fstream>
#include <sstream>
#include <string>

#include <files.h>

/**
 * A scratch directory holding the one folder boards are given, and room
 * beside it for what they must not reach. The folders are the process's, so
 * the fixture gives them back empty when it goes.
 */
class FilesFixture
{
public:
  FilesFixture()
  {
    static std::atomic<int> counter{0};
    const auto now = std::chrono::steady_clock::now().time_since_epoch().count();
    const auto name = "hkp-files-test-" + std::to_string(now) + "-" + std::to_string(counter++);
    m_scratch = std::filesystem::weakly_canonical(std::filesystem::temp_directory_path()) / name;
    std::filesystem::remove_all(m_scratch);
    std::filesystem::create_directories(m_scratch / "folder");
    hkp::files::setFolders({folder()});
  }

  ~FilesFixture()
  {
    hkp::files::setFolders({});
    std::error_code ec;
    std::filesystem::remove_all(m_scratch, ec);
  }

  /** The folder boards are given. */
  std::filesystem::path folder() const { return m_scratch / "folder"; }
  /** Its parent, which boards are not given. */
  const std::filesystem::path& scratch() const { return m_scratch; }

  void write(const std::string& inside, const std::string& content) const
  {
    const auto path = folder() / inside;
    std::filesystem::create_directories(path.parent_path());
    std::ofstream(path, std::ios::binary) << content;
  }

  void writeOutside(const std::string& name, const std::string& content) const
  {
    std::ofstream(m_scratch / name, std::ios::binary) << content;
  }

  static std::string read(const std::filesystem::path& path)
  {
    std::ifstream in(path, std::ios::binary);
    std::stringstream buffer;
    buffer << in.rdbuf();
    return buffer.str();
  }

private:
  std::filesystem::path m_scratch;
};
