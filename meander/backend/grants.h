#pragma once

#include <algorithm>
#include <filesystem>
#include <fstream>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

/**
 * Which board may hand which secrets to which runtime.
 *
 * A grant is the remembered answer to *"send secrets to this runtime?"*, keyed
 * by the board, the runtime and the address it is reached at:
 *
 *     { "[\"Mail\",\"node\",\"http://127.0.0.1:8080\"]": ["gmail.imap"] }
 *
 * The key is a JSON array rather than joined text because a board may be called
 * anything, separators included, and two different triples must never read as
 * one. What it means is decided in `hkp-frontend/src/core/secretConsent.ts`;
 * this only keeps it.
 *
 * Grants hold no secrets — they name them. They are still written like the
 * vault, owner-only, because they are what stands between a board and the
 * credentials it asked for: anything that can add a line here can help itself
 * to a secret without being asked.
 */
class Grants
{
public:
  Grants()
  {
    namespace fs = std::filesystem;
    const char* homeEnv = getenv(
    #if defined(__APPLE__)
      "HOME"
    #else
      "USERPROFILE"
    #endif
    );
    fs::path homeDir = homeEnv ? fs::path(homeEnv) : fs::current_path();
    m_grantsPath = homeDir / ".hkp" / "grants.json";
  }

  /**
   * Grants somewhere other than the account's own.
   *
   * The default location is the one thing here that cannot be exercised: a test
   * that wrote to it would change what the person running it has agreed to.
   */
  explicit Grants(std::filesystem::path path) : m_grantsPath(std::move(path)) {}

  /** Everything granted, for injecting into the page. */
  nlohmann::json getAll() const
  {
    const auto grants = readGrants();
    nlohmann::json out = nlohmann::json::object();
    for (const auto& [key, aliases] : grants.items())
    {
      const auto named = aliasesOf(aliases);
      if (!named.empty())
        out[key] = named;
    }
    return out;
  }

  /** The aliases granted under one key. */
  std::vector<std::string> granted(const std::string& key) const
  {
    const auto grants = readGrants();
    const auto it = grants.find(key);
    return it == grants.end() ? std::vector<std::string>{} : aliasesOf(*it);
  }

  /**
   * Adds aliases to a grant, leaving the rest of it alone.
   *
   * Merged rather than replaced: a board that comes to need one more secret is
   * asked about that one, and the answer must not drop what was already agreed.
   */
  bool grant(const std::string& key, const std::vector<std::string>& aliases)
  {
    auto grants = readGrants();
    const auto it = grants.find(key);
    auto named = it == grants.end() ? std::vector<std::string>{} : aliasesOf(*it);
    for (const auto& alias : aliases)
    {
      if (alias.empty())
        continue;
      if (std::find(named.cbegin(), named.cend(), alias) == named.cend())
        named.push_back(alias);
    }
    if (named.empty())
      return false;
    std::sort(named.begin(), named.end());
    grants[key] = named;
    return writeGrants(grants);
  }

  /** Forgets one grant entirely, so the next release asks again. */
  bool revoke(const std::string& key)
  {
    auto grants = readGrants();
    if (grants.erase(key) == 0)
      return false;
    return writeGrants(grants);
  }

private:
  static std::vector<std::string> aliasesOf(const nlohmann::json& entry)
  {
    std::vector<std::string> named;
    if (!entry.is_array())
      return named;
    for (const auto& alias : entry)
      if (alias.is_string() && !alias.get<std::string>().empty())
        named.push_back(alias.get<std::string>());
    return named;
  }

  nlohmann::json readGrants() const
  {
    using json = nlohmann::json;
    if (!std::filesystem::exists(m_grantsPath))
      return json::object();
    std::ifstream file(m_grantsPath);
    if (!file.is_open())
      return json::object();
    try
    {
      json obj;
      file >> obj;
      return obj.is_object() ? obj : json::object();
    }
    catch (...) { return json::object(); }
  }

  bool writeGrants(const nlohmann::json& grants) const
  {
    std::error_code ec;
    std::filesystem::create_directories(m_grantsPath.parent_path(), ec);

    std::ofstream file(m_grantsPath);
    if (!file.is_open())
      return false;
    file << grants.dump(2);
    file.close();

    // Owner-only, for the same reason the vault is: this file does not hold
    // credentials, it holds permission to have them handed over.
    std::filesystem::permissions(
      m_grantsPath,
      std::filesystem::perms::owner_read | std::filesystem::perms::owner_write,
      std::filesystem::perm_options::replace,
      ec);
    return true;
  }

  std::filesystem::path m_grantsPath;
};
