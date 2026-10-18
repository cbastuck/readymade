#pragma once

#include <iostream>
#include <optional>
#include <vector>

#include <files.h>
#include <types/types.h>
#include <service.h>
#include <types/data.h>

/**
 * Service Documentation
 * Service ID: filesystem
 * Service Name: Filesystem
 * Runtime: hkp-rt
 * Modes: read | write — configured, or named by the input's `operation`
 * Key Config: path, operation
 * IO: in=a trigger, {path}, or what to write -> out=file contents, a listing, or {status}
 * Arrays: a folder's listing is one array
 * Binary: supported
 * MixedData: meta.path names a file inside the configured folder
 *
 * `path` lies inside a folder this server gives boards, and is taken from the
 * default one when relative (files.h). A name the input carries — `path` in a
 * JSON request, `meta.path` beside bytes — is taken inside `path`, whatever it
 * says: the data picks a file, never the folder.
 */
namespace hkp {

class Filesystem : public Service
{
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
    std::string problem;
    auto configured = files::resolve(m_path, problem);
    if (!configured)
    {
      return refused(m_path, problem);
    }

    if (auto mixed = getMixedDataFromData(data))
    {
      if (!mixed->meta.contains("path") || mixed->binary.empty())
      {
        std::cerr << "Filesystem service: MixedData write requires meta.path and non-empty binary" << std::endl;
        return json{{"status", "failure"}};
      }

      int chunkIndex  = 0;
      int totalChunks = 1;
      if (mixed->meta.contains("chunkIndex"))
        chunkIndex = mixed->meta["chunkIndex"].get<int>();
      if (mixed->meta.contains("totalChunks"))
        totalChunks = mixed->meta["totalChunks"].get<int>();

      // Only the file name of meta.path, which may be a URL or a path
      // somewhere else entirely.
      const auto name = std::filesystem::path(mixed->meta["path"].get<std::string>()).filename().string();
      auto target = files::resolveIn(*configured, name, problem);
      if (!target)
      {
        return refused(name, problem);
      }

      // Append for every chunk after the first so the file is reassembled
      // in order without overwriting previously written chunks.
      bool append = (chunkIndex > 0);
      auto file = files::output(*target, std::ios::binary | (append ? std::ios::app : std::ios::trunc));
      if (file)
      {
        file.write(reinterpret_cast<const char*>(mixed->binary.data()), mixed->binary.size());
        bool done = (chunkIndex + 1 >= totalChunks);
        return json{{"status", done ? "success" : "partial"}, {"path", target->string()}};
      }
      std::cerr << "Filesystem service: failed to open file for writing: " << target->string() << std::endl;
      return json{{"status", "failure"}};
    }
    else if (auto buf = getBinaryFromData(data))
    {
      auto file = files::output(*configured, std::ios::binary);
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
      auto file = files::output(*configured, std::ios::trunc);
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
      auto file = files::output(*configured, std::ios::trunc);
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
    std::string problem;
    auto configured = files::resolve(m_path, problem);
    if (!configured)
    {
      refused(m_path, problem);
      return Null();
    }

    if (auto mixed = getMixedDataFromData(data))
    {
      if (!mixed->meta.contains("path"))
      {
        std::cerr << "Filesystem service: MixedData read requires meta.path" << std::endl;
        return Null();
      }
      const auto name = std::filesystem::path(mixed->meta["path"].get<std::string>()).filename().string();
      auto target = files::resolveIn(*configured, name, problem);
      if (!target)
      {
        refused(name, problem);
        return Null();
      }
      auto file = files::input(*target);
      if (!file)
      {
        std::cerr << "Filesystem service: failed to open file for reading: " << target->string() << std::endl;
        return Null();
      }
      MixedData result;
      result.meta = mixed->meta;
      result.binary.assign(std::istreambuf_iterator<char>(file), std::istreambuf_iterator<char>());
      return Data(result);
    }

    // A request names a file inside the configured folder; anything else
    // reads the configured path itself.
    auto j = getJSONFromData(data);
    std::optional<files::Path> target = configured;
    if (j && j->contains("path") && (*j)["path"].is_string())
    {
      const auto name = (*j)["path"].get<std::string>();
      target = files::resolveIn(*configured, name, problem);
      if (!target)
      {
        refused(name, problem);
        return Null();
      }
    }

    if (!files::exists(*target))
    {
      std::cerr << "Filesystem service - path does not exist: " << target->string() << std::endl;
      return Null();
    }

    if (files::isFolder(*target)) // list directory contents
    {
      json dirContents = json::array();
      for (const auto& name : files::list(*target))
      {
        dirContents.push_back(name);
      }
      return Data(dirContents);
    }

    if (target->string().ends_with(".json")) // read as JSON
    {
      auto file = files::input(*target, {});
      if (file)
      {
        std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
        try
        {
          auto parsed = json::parse(content);
          return Data(parsed);
        }
        catch (const std::exception& e)
        {
          std::cerr << "Filesystem service: failed to parse JSON from file: " << target->string() << " error: " << e.what() << std::endl;
        }
      }
      else
      {
        std::cerr << "Filesystem service: failed to open file for reading: " << target->string() << std::endl;
      }
    }

    auto file = files::input(*target); // open file
    if (file)
    {
      std::vector<uint8_t> buffer((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
      return Data(buffer);
    }
    std::cerr << "Filesystem service: failed to open file for reading: " << target->string() << std::endl;
    return Null();
  }

private:
  Data refused(const std::string& path, const std::string& problem)
  {
    std::cerr << "Filesystem service: " << problem << std::endl;
    log(LogLevel::Warn, "file-refused", json{{"path", path}, {"reason", problem}});
    return json{{"status", "failure"}, {"error", problem}};
  }

  std::string m_path;
  std::string m_operation; // CRUD
};

}
