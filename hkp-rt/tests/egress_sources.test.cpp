#include <catch2/catch_test_macros.hpp>

#include <filesystem>
#include <fstream>
#include <map>
#include <regex>
#include <sstream>
#include <string>
#include <vector>

// ──────────────────────────────────────────────────────────────────────────────
// Every way out of this server goes through the egress guard (egress.h).
//
// A board's destinations are resolved with egress::resolve or
// egress::asyncResolve, and connected to what they return. This reads the
// sources for any other resolve and fails on one it was not told about, saying
// what to use instead. It reads the code rather than running it, so it is a
// tripwire, not a proof: the backstop on a hosted machine is still its
// firewall. The same check exists for hkp-node and hkp-python.
// ──────────────────────────────────────────────────────────────────────────────

namespace fs = std::filesystem;

namespace
{
const fs::path LIB = HKP_RT_LIB_DIR;

// Where a resolve is not a board's destination, and why. Each entry is a
// decision; add one only with its reason.
const std::map<std::string, std::string> EXEMPT = {
  {"include/egress.h", "the guard itself"},
  {"src/common/link_socket.cpp", "the link to a coordinator, whose address the operator gave this server"},
  {"src/http/auth.cpp", "fetching the token issuer's keys, from the issuer the operator configured"},
};

const std::regex RAW(R"(\w*resolver\w*\s*(\.|->)\s*(async_)?resolve\s*\(|\bgetaddrinfo\s*\()");

std::string code(const fs::path& file)
{
  std::ifstream in(file);
  std::stringstream buffer;
  buffer << in.rdbuf();
  // Comments out, so that describing a call is not making it.
  auto text = std::regex_replace(buffer.str(), std::regex(R"(/\*[\s\S]*?\*/)"), "");
  return std::regex_replace(text, std::regex(R"(//[^\n]*)"), "");
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

TEST_CASE("every way out of this server is known to the egress guard", "[egress]")
{
  std::vector<std::string> found;
  for (const auto& file : sources())
  {
    const auto name = fs::relative(file, LIB).generic_string();
    if (EXEMPT.count(name) == 0 && std::regex_search(code(file), RAW))
    {
      found.push_back(name + " resolves a host itself. Use hkp::egress::resolve or asyncResolve from "
                             "egress.h, and connect to what it returns");
    }
  }
  REQUIRE(found.empty());
}

TEST_CASE("no exemption outlives its reason", "[egress]")
{
  for (const auto& [name, why] : EXEMPT)
  {
    if (name == "include/egress.h")
    {
      continue;
    }
    INFO(name << ": " << why);
    REQUIRE(std::regex_search(code(LIB / name), RAW));
  }
}
