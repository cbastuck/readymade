#include <catch2/catch_test_macros.hpp>

#include <filesystem>
#include <fstream>
#include <map>
#include <regex>
#include <sstream>
#include <string>
#include <vector>

// ──────────────────────────────────────────────────────────────────────────────
// Every file a board names is opened through the files guard (files.h).
//
// A service resolves a path with files::resolve or files::resolveIn and opens
// what they return with files::input, files::output or files::list. This reads
// the sources for any other way of opening a file and fails on one it was not
// told about, saying what to use instead. It reads the code rather than
// running it, so it is a tripwire, not a proof.
// ──────────────────────────────────────────────────────────────────────────────

namespace fs = std::filesystem;

namespace
{
const fs::path LIB = HKP_RT_LIB_DIR;

// Where a file is opened that is not a board's to name, or was resolved
// before it got here, and why. Each entry is a decision; add one only with
// its reason.
const std::map<std::string, std::string> EXEMPT = {
  {"include/files.h", "the guard itself"},
  {"src/runtime.cpp", "loadFromDisk: a runtime config the operator names at start"},
  {"src/app.cpp", "scanForPlugins: the bundle folder the host names"},
  {"src/coordinator_links.cpp", "the coordinator tickets, at the file the operator names"},
  {"src/http/front_door.cpp", "the mount secret, at the file the operator names"},
  {"src/assets.cpp", "file:// assets, confined to HKP_ASSET_ROOT by fileInside"},
  {"src/services/mp4_to_wav.cpp", "decodeMp4ToPcm opens the path Mp4ToWav resolved through files.h"},
  {"src/services/ffmpeg/detail.cpp", "opens the paths Ffmpeg resolved through files.h"},
};

const std::regex RAW(
  R"(\b(i|o)?fstream\b|\bfopen\s*\(|\bopenInput\s*\(|\bavio_open\s*\(|\bdirectory_iterator\b|\bfile_body\b|(^|[^\w>.])::open\s*\()");

std::string code(const fs::path& file)
{
  std::ifstream in(file);
  std::stringstream buffer;
  buffer << in.rdbuf();
  // Comments and includes out, so that describing or including is not opening.
  auto text = std::regex_replace(buffer.str(), std::regex(R"(/\*[\s\S]*?\*/)"), "");
  text = std::regex_replace(text, std::regex(R"(//[^\n]*)"), "");
  return std::regex_replace(text, std::regex(R"(#\s*include[^\n]*)"), "");
}

std::vector<fs::path> sources()
{
  std::vector<fs::path> files;
  for (const auto* dir : {"src", "include"})
  {
    for (const auto& entry : fs::recursive_directory_iterator(LIB / dir))
    {
      const auto extension = entry.path().extension();
      if (entry.is_regular_file() && (extension == ".cpp" || extension == ".h" || extension == ".hpp"))
      {
        files.push_back(entry.path());
      }
    }
  }
  return files;
}
} // namespace

TEST_CASE("every file a board names is opened through the files guard", "[files]")
{
  std::vector<std::string> found;
  for (const auto& file : sources())
  {
    const auto name = fs::relative(file, LIB).generic_string();
    if (EXEMPT.count(name) == 0 && std::regex_search(code(file), RAW))
    {
      found.push_back(name + " opens a file itself. Resolve the path with hkp::files::resolve or resolveIn "
                             "from files.h, and open it with files::input, output or list");
    }
  }
  INFO([&] {
    std::string all;
    for (const auto& line : found)
    {
      all += line + "\n";
    }
    return all;
  }());
  REQUIRE(found.empty());
}

TEST_CASE("no files exemption outlives its reason", "[files]")
{
  for (const auto& [name, why] : EXEMPT)
  {
    if (name == "include/files.h")
    {
      continue;
    }
    INFO(name << ": " << why);
    // A source compiled only on some builds (ffmpeg, mp4-to-wav) is still in
    // the tree on all of them.
    REQUIRE(fs::exists(LIB / name));
    REQUIRE(std::regex_search(code(LIB / name), RAW));
  }
}
