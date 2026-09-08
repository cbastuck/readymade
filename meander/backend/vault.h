#pragma once

#include <filesystem>
#include <fstream>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

/**
 * The values behind the aliases a board refers to.
 *
 * An entry is a value and the hosts it may be sent to:
 *
 *     { "gmail.imap": { "value": "…", "audience": ["imap.gmail.com"] } }
 *
 * An empty audience is unconstrained. A bare string is read as one — that is
 * what entries written before audiences existed look like, and they keep
 * working until something rewrites them in the long form.
 */
class Vault
{
public:
  Vault()
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
    m_vaultPath = homeDir / ".hkp" / "vault.json";
  }

  /**
   * A vault somewhere other than the account's own.
   *
   * The default location is the one thing here that cannot be exercised: a test
   * that wrote to it would replace the credentials of whoever ran it.
   */
  explicit Vault(std::filesystem::path path) : m_vaultPath(std::move(path)) {}

  std::string getSecret(const std::string& key) const
  {
    const auto vault = readVault();
    const auto it = vault.find(key);
    if (it == vault.end())
      return "";
    return valueOf(*it);
  }

  /**
   * Every entry, in the long form, for injecting into the page.
   *
   * Normalized on the way out so that whatever shape is on disk, a page reads
   * exactly one.
   */
  nlohmann::json getAll() const
  {
    // Named, not iterated straight off readVault(): `items()` refers into the
    // json rather than copying it, and a temporary is gone by the time the
    // loop reads the first entry.
    const auto vault = readVault();
    nlohmann::json out = nlohmann::json::object();
    for (const auto& [key, entry] : vault.items())
    {
      if (!entry.is_string() && !entry.is_object())
        continue;
      out[key] = {
        {"value",    valueOf(entry)},
        {"audience", audienceOf(entry)},
      };
    }
    return out;
  }

  /** Sets the value, leaving the audience the entry already had. */
  bool setSecret(const std::string& key, const std::string& value) const
  {
    auto vault = readVault();
    const auto it = vault.find(key);
    nlohmann::json entry = nlohmann::json::object();
    entry["value"]    = value;
    entry["audience"] = it != vault.end() ? audienceOf(*it) : std::vector<std::string>{};
    vault[key] = entry;
    return writeVault(vault);
  }

  /**
   * Sets where an entry may be sent, leaving its value alone.
   *
   * Separate from setting the value because the two are learned at different
   * moments: a value is typed once, and its audience is either filled in
   * afterwards or recorded the first time the secret is released to somewhere.
   */
  bool setAudience(const std::string& key, const std::vector<std::string>& audience) const
  {
    auto vault = readVault();
    const auto it = vault.find(key);
    if (it == vault.end())
      return false;
    nlohmann::json entry = nlohmann::json::object();
    entry["value"]    = valueOf(*it);
    entry["audience"] = audience;
    vault[key] = entry;
    return writeVault(vault);
  }

  bool deleteSecret(const std::string& key) const
  {
    auto vault = readVault();
    if (vault.erase(key) == 0)
      return false;
    return writeVault(vault);
  }

  /**
   * The names held, without the values.
   *
   * What a settings UI needs: it lists what exists and lets it be replaced,
   * and never has a reason to display a secret back to whoever typed it.
   */
  std::vector<std::string> aliases() const
  {
    const auto vault = readVault();
    std::vector<std::string> names;
    for (const auto& [key, entry] : vault.items())
      if (entry.is_string() || entry.is_object())
        names.push_back(key);
    return names;
  }

  /**
   * The other half of what a settings UI needs: each alias and where it may be
   * sent, and nothing else. Shaped `{ "<alias>": ["host", …] }`.
   */
  nlohmann::json audiences() const
  {
    const auto vault = readVault();
    nlohmann::json out = nlohmann::json::object();
    for (const auto& [key, entry] : vault.items())
      if (entry.is_string() || entry.is_object())
        out[key] = audienceOf(entry);
    return out;
  }

private:
  static std::string valueOf(const nlohmann::json& entry)
  {
    if (entry.is_string())
      return entry.get<std::string>();
    if (entry.is_object())
    {
      const auto it = entry.find("value");
      if (it != entry.end() && it->is_string())
        return it->get<std::string>();
    }
    return "";
  }

  static std::vector<std::string> audienceOf(const nlohmann::json& entry)
  {
    std::vector<std::string> hosts;
    if (!entry.is_object())
      return hosts;
    const auto it = entry.find("audience");
    if (it == entry.end() || !it->is_array())
      return hosts;
    for (const auto& host : *it)
      if (host.is_string() && !host.get<std::string>().empty())
        hosts.push_back(host.get<std::string>());
    return hosts;
  }

  nlohmann::json readVault() const
  {
    using json = nlohmann::json;
    if (!std::filesystem::exists(m_vaultPath))
      return json::object();
    std::ifstream file(m_vaultPath);
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

  bool writeVault(const nlohmann::json& vault) const
  {
    std::error_code ec;
    std::filesystem::create_directories(m_vaultPath.parent_path(), ec);

    std::ofstream file(m_vaultPath);
    if (!file.is_open())
      return false;
    file << vault.dump(2);
    file.close();

    // The contents are credentials. This file is not encrypted, so the
    // permissions are the whole of its protection: readable and writable by
    // its owner and by nobody else. Set after writing, because the mode a
    // stream creates a file with is the process umask's business rather than
    // this code's.
    std::filesystem::permissions(
      m_vaultPath,
      std::filesystem::perms::owner_read | std::filesystem::perms::owner_write,
      std::filesystem::perm_options::replace,
      ec);
    return true;
  }

  std::filesystem::path m_vaultPath;
};
