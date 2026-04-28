#pragma once

#include <algorithm>
#include <cctype>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <sstream>
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
    fs::path saveDir = getMeandersDirPath();

    for (const auto& entry : fs::directory_iterator(saveDir))
    {
      if (entry.is_regular_file() && entry.path().extension() == ".hkpp")
      {
        boardNames.push_back(decodeBoardNameFromStorage(entry.path().stem().string()));
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

    for (size_t i = 0; i < boardName.size(); ++i)
    {
      const unsigned char c = static_cast<unsigned char>(boardName[i]);
      if (std::isalnum(c) || c == '-' || c == '_' || c == ' ' || c == '/')
      {
        continue;
      }

      return false;
    }

    return true;
  }

  static std::string decodeBoardNameFromStorage(const std::string& storageName)
  {
    std::string result;
    result.reserve(storageName.size());
    for (size_t i = 0; i < storageName.size(); ++i)
    {
      if (storageName[i] == '%' && i + 2 < storageName.size())
      {
        const unsigned char hi = static_cast<unsigned char>(storageName[i + 1]);
        const unsigned char lo = static_cast<unsigned char>(storageName[i + 2]);
        if (std::isxdigit(hi) && std::isxdigit(lo))
        {
          const std::string hex = storageName.substr(i + 1, 2);
          const char decoded = static_cast<char>(std::stoi(hex, nullptr, 16));
          result.push_back(decoded);
          i += 2;
          continue;
        }
      }
      result.push_back(storageName[i]);
    }
    return result;
  }

  std::string getBoardsSavePath(const std::string& boardName) const
  {
    namespace fs = std::filesystem;
    const std::string storageName = encodeBoardNameForStorage(boardName);
    fs::path savePath = getMeandersDirPath() / (storageName + ".hkpp");
    fs::path canonical = fs::weakly_canonical(savePath);
    if (canonical.string().find(m_hkpDirPath.string()) != 0)
    {
      return "";
    }
    return savePath.string();
  }

  std::string getHistoryPath(const std::string& boardName) const
  {
    namespace fs = std::filesystem;
    const std::string storageName = encodeBoardNameForStorage(boardName);
    fs::path histPath = getMeandersDirPath() / (storageName + ".history");
    fs::path canonical = fs::weakly_canonical(histPath);
    if (canonical.string().find(m_hkpDirPath.string()) != 0)
    {
      return "";
    }
    return histPath.string();
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

  std::filesystem::path getMeandersDirPath() const
  {
    namespace fs = std::filesystem;
    fs::path meandersDir = m_hkpDirPath / "meanders";
    if (!fs::exists(meandersDir))
    {
      fs::create_directory(meandersDir);
    }
    return meandersDir;
  }

private:
  static std::string encodeBoardNameForStorage(const std::string& boardName)
  {
    std::ostringstream oss;
    oss << std::uppercase << std::hex;
    for (unsigned char c : boardName)
    {
      if (std::isalnum(c) || c == '-' || c == '_' || c == ' ')
      {
        oss << static_cast<char>(c);
      }
      else
      {
        oss << '%' << std::setw(2) << std::setfill('0') << static_cast<int>(c);
      }
    }
    return oss.str();
  }

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
