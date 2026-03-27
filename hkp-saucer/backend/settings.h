#pragma once

#include <filesystem>

class Settings
{ 
public:
  Settings()
  {
    namespace fs = std::filesystem;
    fs::path homeDir;

    // Try to get HOME or USERPROFILE environment variable in a platform-independent way
    const char* homeEnv = getenv(
    #if IS_MACOS
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

  std::string getBoardsSavePath(const std::string& boardName) const
  {
    namespace fs = std::filesystem;
    fs::path savePath = m_hkpDirPath / (boardName + ".hkpp");
    return savePath.string();
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

private:
  std::filesystem::path m_hkpDirPath;
};