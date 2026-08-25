#pragma once

#include <filesystem>
#include <fstream>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

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

  std::string getSecret(const std::string& key) const
  {
    const auto vault = readVault();
    const auto it = vault.find(key);
    if (it != vault.end() && it->is_string())
      return it->get<std::string>();
    return "";
  }

  nlohmann::json getAll() const
  {
    return readVault();
  }

  bool setSecret(const std::string& key, const std::string& value) const
  {
    auto vault = readVault();
    vault[key] = value;
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
    std::vector<std::string> names;
    for (const auto& [key, value] : readVault().items())
      if (value.is_string())
        names.push_back(key);
    return names;
  }

private:
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
