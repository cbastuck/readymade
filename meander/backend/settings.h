#pragma once

#include <algorithm>
#include <cctype>
#include <filesystem>
#include <fstream>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

class Settings
{ 
public:
  struct RemoteRuntimeEngine
  {
    std::string name;
    std::string url;
    int port = 0;
    std::string color;
  };

  static bool isInternalRuntimeUrl(const std::string& url)
  {
    return url.rfind("hkp://remotes/", 0) == 0;
  }

  Settings()
  {
    namespace fs = std::filesystem;
    fs::path homeDir;

    // Try to get HOME or USERPROFILE environment variable in a platform-independent way
    const char* homeEnv = getenv(
    #if defined(__APPLE__)
      "HOME"
    #else
      "USERPROFILE"
    #endif
    );

    if (homeEnv)
    {
      homeDir = fs::path(homeEnv);
    }
    else
    {
      homeDir = fs::current_path(); // fallback
    }

    fs::path hkpDir = homeDir / ".hkp";
    if (!fs::exists(hkpDir)) 
    {
      fs::create_directory(hkpDir);
    }
    m_hkpDirPath = hkpDir;
  }

  std::vector<std::string> getSavedBoards() const
  {
    namespace fs = std::filesystem;
    std::vector<std::string> boardNames;
    fs::path saveDir = m_hkpDirPath;
    
    for (const auto& entry : fs::directory_iterator(saveDir))
    {
      if (entry.is_regular_file() && entry.path().extension() == ".hkpp")
      {
        boardNames.push_back(entry.path().stem().string());
      }
    }
    
    return boardNames;
  }

  static bool isValidBoardName(const std::string& boardName)
  {
    if (boardName.empty())
    {
      return false;
    }
    for (char c : boardName)
    {
      if (!std::isalnum(static_cast<unsigned char>(c)) && c != '-' && c != '_')
      {
        return false;
      }
    }
    return true;
  }

  std::string getBoardsSavePath(const std::string& boardName) const
  {
    namespace fs = std::filesystem;
    fs::path savePath = m_hkpDirPath / (boardName + ".hkpp");
    // Verify the resolved path is still inside the intended directory
    fs::path canonical = fs::weakly_canonical(savePath);
    if (canonical.string().find(m_hkpDirPath.string()) != 0)
    {
      return "";
    }
    return savePath.string();
  }

  bool getAllowExternalAccess() const
  {
    using json = nlohmann::json;
    const auto settingsPath = (m_hkpDirPath / "settings.json").string();
    if (!std::filesystem::exists(settingsPath))
      return false;
    std::ifstream file(settingsPath);
    if (!file.is_open())
      return false;
    try
    {
      json payload;
      file >> payload;
      const auto it = payload.find("allowExternalRuntimeAccess");
      if (it != payload.end() && it->is_boolean())
        return it->get<bool>();
    }
    catch (...) {}
    return false;
  }

  std::string getBundlesPath() const
  {
    namespace fs = std::filesystem;
    fs::path bundlesPath = m_hkpDirPath / "bundles";
    if (!fs::exists(bundlesPath)) 
    {
      fs::create_directory(bundlesPath);
    }
    return bundlesPath.string();
  }

  std::vector<RemoteRuntimeEngine> getRemoteRuntimeEngines() const
  {
    std::vector<RemoteRuntimeEngine> runtimes;
    const auto payload = readRemoteRuntimeEnginesPayload();

    if (!payload.is_array())
    {
      return runtimes;
    }

    for (const auto& entry : payload)
    {
      if (!entry.is_object())
      {
        continue;
      }

      const auto nameIt = entry.find("name");
      const auto urlIt = entry.find("url");
      if (nameIt == entry.end() || urlIt == entry.end() ||
          !nameIt->is_string() || !urlIt->is_string())
      {
        continue;
      }

      RemoteRuntimeEngine runtime{
        .name = nameIt->get<std::string>(),
        .url = urlIt->get<std::string>(),
        .port = 0,
        .color = "",
      };

      const auto portIt = entry.find("port");
      if (portIt != entry.end() && portIt->is_number_integer())
      {
        runtime.port = portIt->get<int>();
      }

      const auto colorIt = entry.find("color");
      if (colorIt != entry.end() && colorIt->is_string())
      {
        runtime.color = colorIt->get<std::string>();
      }

      if (!runtime.name.empty() && !runtime.url.empty() &&
          !isInternalRuntimeUrl(runtime.url))
      {
        runtimes.push_back(std::move(runtime));
      }
    }

    return runtimes;
  }

  bool saveRemoteRuntimeEngine(const RemoteRuntimeEngine& runtime) const
  {
    if (runtime.name.empty() || runtime.url.empty() ||
        isInternalRuntimeUrl(runtime.url))
    {
      return false;
    }

    auto runtimes = getRemoteRuntimeEngines();
    auto existing = std::find_if(
        runtimes.begin(),
        runtimes.end(),
        [&runtime](const RemoteRuntimeEngine& candidate)
        {
          return candidate.name == runtime.name;
        });

    if (existing != runtimes.end())
    {
      *existing = runtime;
    }
    else
    {
      runtimes.push_back(runtime);
    }

    return writeRemoteRuntimeEngines(runtimes);
  }

  bool deleteRemoteRuntimeEngine(const std::string& runtimeName) const
  {
    auto runtimes = getRemoteRuntimeEngines();
    const auto originalSize = runtimes.size();
    runtimes.erase(
        std::remove_if(
            runtimes.begin(),
            runtimes.end(),
            [&runtimeName](const RemoteRuntimeEngine& runtime)
            {
              return runtime.name == runtimeName;
            }),
        runtimes.end());

    if (runtimes.size() == originalSize)
    {
      return false;
    }

    return writeRemoteRuntimeEngines(runtimes);
  }

private:
  std::string getSettingsPath() const
  {
    return (m_hkpDirPath / "settings.json").string();
  }

  nlohmann::json readSettings() const
  {
    using json = nlohmann::json;
    const auto path = getSettingsPath();
    if (!std::filesystem::exists(path))
      return json::object();
    std::ifstream file(path);
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

  bool writeSettings(const nlohmann::json& settings) const
  {
    std::ofstream file(getSettingsPath());
    if (!file.is_open())
      return false;
    file << settings.dump(2);
    return true;
  }

  nlohmann::json readRemoteRuntimeEnginesPayload() const
  {
    using json = nlohmann::json;
    const auto settings = readSettings();
    const auto it = settings.find("remotes");
    if (it != settings.end() && it->is_array())
      return *it;
    return json::array();
  }

  bool writeRemoteRuntimeEngines(const std::vector<RemoteRuntimeEngine>& runtimes) const
  {
    using json = nlohmann::json;

    json remotesArray = json::array();
    for (const auto& runtime : runtimes)
    {
      if (runtime.name.empty() || runtime.url.empty() ||
          isInternalRuntimeUrl(runtime.url))
      {
        continue;
      }

      json entry{
        {"name", runtime.name},
        {"url", runtime.url},
        {"port", runtime.port},
      };
      if (!runtime.color.empty())
      {
        entry["color"] = runtime.color;
      }
      remotesArray.push_back(std::move(entry));
    }

    auto settings = readSettings();
    settings["remotes"] = std::move(remotesArray);
    return writeSettings(settings);
  }

  std::filesystem::path m_hkpDirPath;
};