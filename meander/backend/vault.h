#pragma once

#include <filesystem>
#include <fstream>
#include <string>

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
    std::ofstream file(m_vaultPath);
    if (!file.is_open())
      return false;
    file << vault.dump(2);
    return true;
  }

  std::filesystem::path m_vaultPath;
};
