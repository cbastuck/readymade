#pragma once

#include <iostream>
#include <fstream>
#include <vector>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

namespace hkp {

class Filesystem : public Service 
{
private:
  bool isDirectory(const std::string& path)
  {
      std::filesystem::path fsPath(path);
      return std::filesystem::is_directory(fsPath);
  }

  // Combines the configured directory (m_path) with the filename extracted
  // from a meta path (which may be a URL or file path).
  std::string buildMixedPath(const std::string& metaPath) const
  {
    auto filename = std::filesystem::path(metaPath).filename();
    return (std::filesystem::path(m_path) / filename).string();
  }

public:
  static std::string serviceId() { return "filesystem"; }

  Filesystem(const std::string& instanceId)
     : Service(instanceId, serviceId())
  { 
  }

  std::string getServiceId() const override
  {
    return serviceId();
  }

  json configure(Data data) override
  { 
    auto buf = getJSONFromData(data);
    if (buf)
    {
      updateIfNeeded(m_path, (*buf)["path"]);
      updateIfNeeded(m_operation, (*buf)["operation"]);

    };

    return Service::configure(data);
  }

  json getState() const override
  {
    return Service::mergeStateWith(json{
      { "path", m_path },
      { "operation", m_operation },
    });
  }

  Data process(Data data) override
  {
    auto j = getJSONFromData(data);
    auto mixed = getMixedDataFromData(data);
    if (m_path.empty())
    {
      return Null();
    }

    auto op = m_operation;
    const json* metaSource = j ? &(*j) : (mixed ? &mixed->meta : nullptr);
    if (metaSource && metaSource->contains("operation"))
    {
      auto val = (*metaSource)["operation"];
      if (val.is_string())
      {
          op = val.get<std::string>();
      }
      else
      {
        std::cerr << "Filesystem, invalid operation: " << val << std::endl;
      }
    }
    
    if (op == "read")
    {
      return readOperation(data);
    }
    else if (op == "write")
    {
      return writeOperation(data);
    }
    else 
    {
      std::cerr << "Filesystem service: operation not implemented: '" << op << "'" << std::endl;
      return Null();
    }
  }

  Data writeOperation(Data data)
  {
    if (auto mixed = getMixedDataFromData(data))
    {
      if (!mixed->meta.contains("path") || mixed->binary.empty())
      {
        std::cerr << "Filesystem service: MixedData write requires meta.path and non-empty binary" << std::endl;
        return json{{"status", "failure"}};
      }
      auto target = buildMixedPath(mixed->meta["path"].get<std::string>());
      std::ofstream file(target, std::ios::binary);
      if (file)
      {
        file.write(reinterpret_cast<const char*>(mixed->binary.data()), mixed->binary.size());
        return json{{"status", "success"}, {"path", target}};
      }
      std::cerr << "Filesystem service: failed to open file for writing: " << target << std::endl;
      return json{{"status", "failure"}};
    }
    else if (auto buf = getBinaryFromData(data))
    {
      std::ofstream file(m_path, std::ios::binary);
      if (file)
      {
        file.write(reinterpret_cast<const char*>(buf->data()), buf->size());
        return json{{"status", "success"}};
      }
      else
      {
        std::cerr << "Filesystem service: failed to open file for writing: " << m_path << std::endl;
      }
    }
    else if (auto buf = getJSONFromData(data))
    {
      std::ofstream file(m_path);
      if (file)
      {
        file << buf->dump(2); // pretty print with 2 spaces
        return json{{"status", "success"}};
      }
      else
      {
        std::cerr << "Filesystem service: failed to open file for writing: " << m_path << std::endl;
      }
    }
    else if (auto str = getStringFromData(data))
    {
      std::ofstream file(m_path);
      if (file)
      {
        file << *str;
        return json{{"status", "success"}};
      }
      else
      {
        std::cerr << "Filesystem service: failed to open file for writing: " << m_path << std::endl;
      }
    } 
    else
    {
      std::cerr << "Filesystem service: write operation requires BinaryData or JSON" << std::endl;
    }
    return json{{"status", "failure"}};
  }

  Data readOperation(Data data)
  {
    if (auto mixed = getMixedDataFromData(data))
    {
      if (!mixed->meta.contains("path"))
      {
        std::cerr << "Filesystem service: MixedData read requires meta.path" << std::endl;
        return Null();
      }
      auto target = buildMixedPath(mixed->meta["path"].get<std::string>());
      std::ifstream file(target, std::ios::binary);
      if (!file)
      {
        std::cerr << "Filesystem service: failed to open file for reading: " << target << std::endl;
        return Null();
      }
      MixedData result;
      result.meta = mixed->meta;
      result.binary.assign(std::istreambuf_iterator<char>(file), std::istreambuf_iterator<char>());
      return Data(result);
    }

    auto j = getJSONFromData(data);
    std::string path = j && j->contains("path") ? (*j)["path"].get<std::string>() : " "; // space due to substring below
    std::filesystem::path fullPath = std::filesystem::path(m_path) / path.substr(1); // remove leading '/' from path
    if (std::filesystem::exists(fullPath))
    {
      if (isDirectory(fullPath.string())) // list directory contents
      {
        json dirContents = json::array();
        for (const auto& entry : std::filesystem::directory_iterator(fullPath))
        {
          dirContents.push_back(entry.path().filename().string());
        }
        return Data(dirContents);
      }

      if (fullPath.string().ends_with(".json")) // read as JSON
      {
        std::ifstream file(fullPath.string());
        if (file)
        {
          std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
          try 
          {
            auto j = json::parse(content);
            return Data(j);
          } 
          catch (const std::exception& e) 
          {
            std::cerr << "Filesystem service: failed to parse JSON from file: " << fullPath << " error: " << e.what() << std::endl;
          }
        }
        else
        {
          std::cerr << "Filesystem service: failed to open file for reading: " << fullPath << std::endl;
        }
      }

      std::ifstream file(fullPath.string(), std::ios::binary); // open file 
      if (file)
      {
        std::vector<uint8_t> buffer((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
        return Data(buffer);
      }
      else
      {
        std::cerr << "Filesystem service: failed to open file for reading: " << m_path << std::endl;
      }
    }
    std::cerr << "Filesystem service - path does not exist: " << fullPath << std::endl;
    return Null();
  }

private:
  std::string m_path;
  std::string m_operation; // CRUD
};

}
