#include "./schemeHandler.h"

#include <algorithm>
#include <cctype>
#include <set>

#include <nlohmann/json.hpp>

#include <crow.h>
#include <crow/common.h>

#include "server.h"

using json = nlohmann::json;

SchemeHandler::SchemeHandler(std::shared_ptr<hkp::Server> server, const Settings& settings)
    : m_server(server), m_defaultHeaders(
                            {
                                {"Access-Control-Allow-Origin", server->allowedOrigins()},
                                {"Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE"},
                                {"Access-Control-Allow-Headers", "Content-Type"},
                            })
    , m_settings(settings)
{
  m_router.register_route(
      "GET",
      "/remotes/",
      std::bind(&SchemeHandler::handleGetRemotes, this, std::placeholders::_1, std::placeholders::_2));

    m_router.register_route(
      "POST",
      "/remotes/",
      std::bind(&SchemeHandler::handleSaveRemote, this, std::placeholders::_1, std::placeholders::_2));

    m_router.register_route(
      "DELETE",
      "/remotes/",
      std::bind(&SchemeHandler::handleDeleteRemote, this, std::placeholders::_1, std::placeholders::_2));

  m_router.register_route(
      "*",
      "/remotes/:remote/*",
      std::bind(&SchemeHandler::handleRemoteForward, this, std::placeholders::_1, std::placeholders::_2));

  m_router.register_route(
      "POST",
      "/boards/:board",
      std::bind(&SchemeHandler::handleSaveBoard, this, std::placeholders::_1, std::placeholders::_2));

  m_router.register_route(
      "GET",
      "/boards",
      std::bind(&SchemeHandler::handleListBoards, this, std::placeholders::_1, std::placeholders::_2));

  m_router.register_route(
      "GET",
      "/boards/:board",
      std::bind(&SchemeHandler::handleLoadBoard, this, std::placeholders::_1, std::placeholders::_2));

  m_router.register_route(
      "DELETE",
      "/boards/:board",
      std::bind(&SchemeHandler::handleDeleteBoard, this, std::placeholders::_1, std::placeholders::_2));

  m_router.register_route(
      "GET",
      "/history/",
      std::bind(&SchemeHandler::handleListBoardHistories, this, std::placeholders::_1, std::placeholders::_2));

  m_router.register_route(
      "POST",
      "/history/:board",
      std::bind(&SchemeHandler::handlePushBoardSnapshot, this, std::placeholders::_1, std::placeholders::_2));

  m_router.register_route(
      "GET",
      "/history/:board",
      std::bind(&SchemeHandler::handleLoadBoardHistory, this, std::placeholders::_1, std::placeholders::_2));

  m_router.register_route(
      "DELETE",
      "/history/:board",
      std::bind(&SchemeHandler::handleClearBoardHistory, this, std::placeholders::_1, std::placeholders::_2));

  m_router.register_route(
      "GET",
      "/settings",
      std::bind(&SchemeHandler::handleGetSettings, this, std::placeholders::_1, std::placeholders::_2));

  m_router.register_route(
      "POST",
      "/settings",
      std::bind(&SchemeHandler::handleSaveSettings, this, std::placeholders::_1, std::placeholders::_2));

  m_router.register_route(
      "GET",
      "/startpage",
      std::bind(&SchemeHandler::handleGetStartPage, this, std::placeholders::_1, std::placeholders::_2));

  m_router.register_route(
      "POST",
      "/startpage",
      std::bind(&SchemeHandler::handleSaveStartPage, this, std::placeholders::_1, std::placeholders::_2));

  m_router.register_route(
      "GET",
      "/board-art/:board",
      std::bind(&SchemeHandler::handleGetBoardArt, this, std::placeholders::_1, std::placeholders::_2));

  m_router.register_route(
      "POST",
      "/board-art/:board",
      std::bind(&SchemeHandler::handleSaveBoardArt, this, std::placeholders::_1, std::placeholders::_2));

  m_router.register_route(
      "GET",
      "/local-image/:path",
      std::bind(&SchemeHandler::handleGetLocalImage, this, std::placeholders::_1, std::placeholders::_2));
}

void SchemeHandler::addRoute(const Router::Method &method, const std::string &path, Router::Handler handler)
{
  m_router.register_route(method, path, handler);
}

saucer::scheme::response SchemeHandler::handleRequest(const saucer::scheme::request &req)
{
  // Answer CORS preflight for every route. On Windows (WebView2) the embedded
  // frontend runs from `saucer://embedded`, so non-simple requests (e.g. a POST
  // with a JSON Content-Type) to the `hkp://` scheme are cross-origin and get
  // preflighted; the OPTIONS response must have an ok status and the CORS
  // headers or the browser blocks the actual request.
  if (req.method() == "OPTIONS")
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str(""),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 204,
    };
  }

  auto res = m_router.route(req);
  if (res)
  {
    return *res;
  }
  return saucer::scheme::response{
      .data = saucer::stash::from_str((
        json{
          {"url", req.url().string()}
        }).dump()
      ),
      .mime = "application/json",
      .headers = m_defaultHeaders,
      .status = 404,
  };
}

saucer::scheme::response SchemeHandler::handleGetRemotes(const Router::Params &p, const saucer::scheme::request &req) const
{
  auto remotesArr = json::array();
  remotesArr.push_back({
      {"url", "hkp://remotes/" + m_server->name()},
      {"port", m_server->port()},
      {"name", m_server->name()},
  });

  for (const auto& runtime : m_settings.getRemoteRuntimeEngines())
  {
    if (runtime.name == m_server->name() ||
        Settings::isInternalRuntimeUrl(runtime.url))
    {
      continue;
    }

    remotesArr.push_back({
        {"url", runtime.url},
        {"port", runtime.port},
        {"name", runtime.name},
        {"color", runtime.color},
    });
  }

  return saucer::scheme::response{
      .data = saucer::stash::from_str(remotesArr.dump()),
      .mime = "application/json",
      .headers = m_defaultHeaders,
  };
}

saucer::scheme::response SchemeHandler::handleSaveRemote(const Router::Params &p, const saucer::scheme::request &req) const
{
  try
  {
    const auto content = req.content();
    if (content.size() == 0)
    {
      return saucer::scheme::response{
          .data = saucer::stash::from_str("No content provided"),
          .mime = "text/plain",
          .headers = m_defaultHeaders,
          .status = 400,
      };
    }

    const auto payload = json::parse(
        std::string(reinterpret_cast<const char *>(content.data()), content.size()));
    if (!payload.is_object())
    {
      return saucer::scheme::response{
          .data = saucer::stash::from_str("Invalid remote payload"),
          .mime = "text/plain",
          .headers = m_defaultHeaders,
          .status = 400,
      };
    }

    const auto nameIt = payload.find("name");
    const auto urlIt = payload.find("url");
    if (nameIt == payload.end() || urlIt == payload.end() ||
        !nameIt->is_string() || !urlIt->is_string())
    {
      return saucer::scheme::response{
          .data = saucer::stash::from_str("Remote payload requires string name and url"),
          .mime = "text/plain",
          .headers = m_defaultHeaders,
          .status = 400,
      };
    }

    Settings::RemoteRuntimeEngine runtime{
        .name = nameIt->get<std::string>(),
        .url = urlIt->get<std::string>(),
        .port = 0,
        .color = "",
    };

    if (runtime.name == m_server->name())
    {
      return saucer::scheme::response{
          .data = saucer::stash::from_str("The local runtime name is reserved"),
          .mime = "text/plain",
          .headers = m_defaultHeaders,
          .status = 409,
      };
    }

    if (Settings::isInternalRuntimeUrl(runtime.url))
    {
      return saucer::scheme::response{
          .data = saucer::stash::from_str("The internal runtime proxy cannot be persisted"),
          .mime = "text/plain",
          .headers = m_defaultHeaders,
          .status = 409,
      };
    }

    const auto portIt = payload.find("port");
    if (portIt != payload.end() && portIt->is_number_integer())
    {
      runtime.port = portIt->get<int>();
    }

    const auto colorIt = payload.find("color");
    if (colorIt != payload.end() && colorIt->is_string())
    {
      runtime.color = colorIt->get<std::string>();
    }

    if (!m_settings.saveRemoteRuntimeEngine(runtime))
    {
      return saucer::scheme::response{
          .data = saucer::stash::from_str("Failed to save remote runtime"),
          .mime = "text/plain",
          .headers = m_defaultHeaders,
          .status = 500,
      };
    }

    return saucer::scheme::response{
        .data = saucer::stash::from_str(json{
            {"message", "Remote runtime saved successfully"},
            {"name", runtime.name},
            {"url", runtime.url},
            {"port", runtime.port},
            {"color", runtime.color},
        }.dump()),
        .mime = "application/json",
        .headers = m_defaultHeaders,
        .status = 201,
    };
  }
  catch (const json::exception&)
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Invalid JSON payload"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 400,
    };
  }
}

saucer::scheme::response SchemeHandler::handleDeleteRemote(const Router::Params &p, const saucer::scheme::request &req) const
{
  try
  {
    const auto content = req.content();
    if (content.size() == 0)
    {
      return saucer::scheme::response{
          .data = saucer::stash::from_str("No content provided"),
          .mime = "text/plain",
          .headers = m_defaultHeaders,
          .status = 400,
      };
    }

    const auto payload = json::parse(
        std::string(reinterpret_cast<const char *>(content.data()), content.size()));
    const auto nameIt = payload.find("name");
    if (!payload.is_object() || nameIt == payload.end() || !nameIt->is_string())
    {
      return saucer::scheme::response{
          .data = saucer::stash::from_str("Remote delete payload requires a string name"),
          .mime = "text/plain",
          .headers = m_defaultHeaders,
          .status = 400,
      };
    }

    const auto runtimeName = nameIt->get<std::string>();
    if (runtimeName == m_server->name())
    {
      return saucer::scheme::response{
          .data = saucer::stash::from_str("The local runtime cannot be deleted"),
          .mime = "text/plain",
          .headers = m_defaultHeaders,
          .status = 409,
      };
    }

    if (!m_settings.deleteRemoteRuntimeEngine(runtimeName))
    {
      return saucer::scheme::response{
          .data = saucer::stash::from_str("Remote runtime not found"),
          .mime = "text/plain",
          .headers = m_defaultHeaders,
          .status = 404,
      };
    }

    return saucer::scheme::response{
        .data = saucer::stash::from_str(json{
            {"message", "Remote runtime deleted successfully"},
            {"name", runtimeName},
        }.dump()),
        .mime = "application/json",
        .headers = m_defaultHeaders,
        .status = 200,
    };
  }
  catch (const json::exception&)
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Invalid JSON payload"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 400,
    };
  }
}

saucer::scheme::response SchemeHandler::handleRemoteForward(const Router::Params &p, const saucer::scheme::request &req) const
{
  crow::request crowReq;
  auto forwardedUrl = std::string("/") + p.at("*");
  crowReq.url = forwardedUrl;
  crowReq.method = method_from_string(req.method().c_str());

  crowReq.body = std::string(reinterpret_cast<const char *>(req.content().data()), req.content().size());
  for (const auto &[key, value] : req.headers())
  {
    crowReq.headers.insert({key, value});
  }

  crow::response crowRes;
  m_server->handleRequest(crowReq, crowRes);
  std::map<std::string, std::string> resHeaders;
  for (const auto &[key, value] : crowRes.headers)
  {
    resHeaders[key] = value;
  }
  return saucer::scheme::response{
      .data = saucer::stash::from_str(crowRes.body),
      .headers = resHeaders,
      .status = static_cast<int>(crowRes.code),
  };
}

saucer::scheme::response SchemeHandler::handleListBoards(const Router::Params &p, const saucer::scheme::request &req) const
{
  auto vec = m_settings.getSavedBoards();
  json boardsArr = json::array();
  for (const auto &board : vec)
  {
    boardsArr.push_back(board);
  }
  return saucer::scheme::response{
      .data = saucer::stash::from_str(boardsArr.dump()),
      .mime = "application/json",
      .headers = m_defaultHeaders,
      .status = 200,
  };
}

saucer::scheme::response SchemeHandler::handleLoadBoard(const Router::Params &p, const saucer::scheme::request &req) const
{
  auto boardName = p.at("board");
  if (!Settings::isValidBoardName(boardName))
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Invalid board name"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 400,
    };
  }
  if (!boardName.empty())
  {
    std::ifstream file(m_settings.getBoardsSavePath(boardName));
    if (!file.is_open())
    {
      return saucer::scheme::response{
          .data = saucer::stash::from_str("Board not found"),
          .mime = "text/plain",
          .headers = m_defaultHeaders,
          .status = 404,
      };
    }
    std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
    if (content.empty())
    {
      return saucer::scheme::response{
          .data = saucer::stash::from_str("Board is empty"),
          .mime = "text/plain",
          .headers = m_defaultHeaders,
          .status = 404,
      };
    }
    return saucer::scheme::response{
        .data = saucer::stash::from_str(content),
        .mime = "application/json",
        .headers = m_defaultHeaders,
        .status = 200,
    };
  }

  return saucer::scheme::response{
      .data = saucer::stash::from_str("List of boards"),
      .mime = "text/plain",
      .headers = m_defaultHeaders,
      .status = 200,
  };
}

saucer::scheme::response SchemeHandler::handleSaveBoard(const Router::Params &p, const saucer::scheme::request &req) const
{
  auto boardName = p.at("board");
  if (!Settings::isValidBoardName(boardName))
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Invalid board name"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 400,
    };
  }
  auto content = req.content();
  if (content.size() == 0)
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("No content provided"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 400,
    };
  }

  auto savePath = m_settings.getBoardsSavePath(boardName);
  std::ofstream file(savePath);
  if (!file.is_open())
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Failed to open file for writing"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 400,
    };
  }
  file.write(reinterpret_cast<const char *>(content.data()), content.size());

  return saucer::scheme::response{
      .data = saucer::stash::from_str(json{
          {"message", "Board saved successfully"},
          {"board", boardName},
          {"path", savePath}}.dump()),
      .mime = "application/json",
      .headers = m_defaultHeaders,
      .status = 201};
}

saucer::scheme::response SchemeHandler::handleDeleteBoard(const Router::Params &p, const saucer::scheme::request &req) const
{
  auto boardName = p.at("board");
  if (!Settings::isValidBoardName(boardName))
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Invalid board name"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 400,
    };
  }

  auto path = m_settings.getBoardsSavePath(boardName);
  if (!std::filesystem::remove(path))
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Board not found"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 404,
    };
  }

  return saucer::scheme::response{
      .data = saucer::stash::from_str(json{
          {"message", "Board deleted successfully"},
          {"board", boardName},
          {"path", path}}.dump()),
      .mime = "application/json",
      .headers = m_defaultHeaders,
      .status = 200,
  };
}

saucer::scheme::response SchemeHandler::handleListBoardHistories(const Router::Params &p, const saucer::scheme::request &req) const
{
  namespace fs = std::filesystem;
  auto meandersDir = m_settings.getMeandersDirPath();

  json result = json::array();
  for (const auto& entry : fs::directory_iterator(meandersDir))
  {
    if (!entry.is_regular_file() || entry.path().extension() != ".history")
    {
      continue;
    }
    auto boardName = Settings::decodeBoardNameFromStorage(entry.path().stem().string());
    if (!Settings::isValidBoardName(boardName))
    {
      continue;
    }

    std::string latestTimestamp;
    std::ifstream file(entry.path());
    if (file.is_open())
    {
      try
      {
        json history;
        file >> history;
        if (history.is_array() && !history.empty() &&
            history[0].is_object() && history[0].contains("timestamp") &&
            history[0]["timestamp"].is_string())
        {
          latestTimestamp = history[0]["timestamp"].get<std::string>();
        }
      }
      catch (...) {}
    }

    json item{{"name", boardName}};
    if (!latestTimestamp.empty())
    {
      item["latestTimestamp"] = latestTimestamp;
    }
    result.push_back(std::move(item));
  }

  return saucer::scheme::response{
      .data = saucer::stash::from_str(result.dump()),
      .mime = "application/json",
      .headers = m_defaultHeaders,
      .status = 200,
  };
}

static constexpr std::size_t MAX_HISTORY_DEPTH = 50;

saucer::scheme::response SchemeHandler::handlePushBoardSnapshot(const Router::Params &p, const saucer::scheme::request &req) const
{
  auto boardName = p.at("board");
  if (!Settings::isValidBoardName(boardName))
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Invalid board name"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 400,
    };
  }

  auto content = req.content();
  if (content.size() == 0)
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("No content provided"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 400,
    };
  }

  json entry;
  try
  {
    entry = json::parse(std::string(reinterpret_cast<const char *>(content.data()), content.size()));
    if (entry.is_object())
    {
      auto snapshotIt = entry.find("snapshot");
      if (snapshotIt != entry.end() && snapshotIt->is_object())
      {
        snapshotIt->erase("registry");
      }
    }
  }
  catch (const json::exception&)
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Invalid JSON payload"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 400,
    };
  }

  auto histPath = m_settings.getHistoryPath(boardName);
  if (histPath.empty())
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Invalid board name"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 400,
    };
  }

  json history = json::array();
  if (std::filesystem::exists(histPath))
  {
    std::ifstream file(histPath);
    if (file.is_open())
    {
      try
      {
        json parsed;
        file >> parsed;
        if (parsed.is_array())
        {
          history = std::move(parsed);
        }
      }
      catch (...) {}
    }
  }

  history.insert(history.begin(), entry);
  if (history.size() > MAX_HISTORY_DEPTH)
  {
    history.erase(history.begin() + MAX_HISTORY_DEPTH, history.end());
  }

  std::ofstream out(histPath);
  if (!out.is_open())
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Failed to write history file"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 500,
    };
  }
  out << history.dump(2);

  return saucer::scheme::response{
      .data = saucer::stash::from_str(json{{"ok", true}}.dump()),
      .mime = "application/json",
      .headers = m_defaultHeaders,
      .status = 201,
  };
}

saucer::scheme::response SchemeHandler::handleLoadBoardHistory(const Router::Params &p, const saucer::scheme::request &req) const
{
  auto boardName = p.at("board");
  if (!Settings::isValidBoardName(boardName))
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Invalid board name"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 400,
    };
  }

  auto histPath = m_settings.getHistoryPath(boardName);
  if (histPath.empty())
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Invalid board name"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 400,
    };
  }

  if (!std::filesystem::exists(histPath))
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("[]"),
        .mime = "application/json",
        .headers = m_defaultHeaders,
        .status = 200,
    };
  }

  std::ifstream file(histPath);
  if (!file.is_open())
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("[]"),
        .mime = "application/json",
        .headers = m_defaultHeaders,
        .status = 200,
    };
  }

  std::string rawContent((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
  return saucer::scheme::response{
      .data = saucer::stash::from_str(rawContent),
      .mime = "application/json",
      .headers = m_defaultHeaders,
      .status = 200,
  };
}

saucer::scheme::response SchemeHandler::handleClearBoardHistory(const Router::Params &p, const saucer::scheme::request &req) const
{
  auto boardName = p.at("board");
  if (!Settings::isValidBoardName(boardName))
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Invalid board name"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 400,
    };
  }

  auto histPath = m_settings.getHistoryPath(boardName);
  if (histPath.empty())
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Invalid board name"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 400,
    };
  }

  std::filesystem::remove(histPath);

  return saucer::scheme::response{
      .data = saucer::stash::from_str(json{{"ok", true}}.dump()),
      .mime = "application/json",
      .headers = m_defaultHeaders,
      .status = 200,
  };
}

json SchemeHandler::currentRuntimeSettings() const
{
  auto allowedUsers = json::array();
  for (const auto& email : m_settings.getAuthConfig().allowedEmails)
  {
    allowedUsers.push_back(email);
  }
  return json{
      {"allowExternalRuntimeAccess", m_settings.getAllowExternalAccess()},
      {"allowedUsers", allowedUsers},
  };
}

saucer::scheme::response SchemeHandler::handleGetSettings(const Router::Params &p, const saucer::scheme::request &req) const
{
  return saucer::scheme::response{
      .data = saucer::stash::from_str(currentRuntimeSettings().dump()),
      .mime = "application/json",
      .headers = m_defaultHeaders,
  };
}

saucer::scheme::response SchemeHandler::handleGetStartPage(const Router::Params &p, const saucer::scheme::request &req) const
{
  const auto path = m_settings.getStartPagePath();
  std::ifstream file(path);
  if (!file.is_open())
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Start page tree not found"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 404,
    };
  }
  std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
  return saucer::scheme::response{
      .data = saucer::stash::from_str(content),
      .mime = "application/json",
      .headers = m_defaultHeaders,
      .status = 200,
  };
}

saucer::scheme::response SchemeHandler::handleSaveStartPage(const Router::Params &p, const saucer::scheme::request &req) const
{
  const auto content = req.content();
  if (content.size() == 0)
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("No content provided"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 400,
    };
  }

  // Validate that the payload is JSON before persisting it.
  try
  {
    const auto payload = json::parse(
        std::string(reinterpret_cast<const char *>(content.data()), content.size()));
    if (!payload.is_object())
    {
      throw json::type_error::create(302, "start page tree must be an object", nullptr);
    }
  }
  catch (const json::exception&)
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Invalid JSON payload"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 400,
    };
  }

  std::ofstream file(m_settings.getStartPagePath());
  if (!file.is_open())
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Failed to open file for writing"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 500,
    };
  }
  file.write(reinterpret_cast<const char *>(content.data()), content.size());

  return saucer::scheme::response{
      .data = saucer::stash::from_str(json{{"ok", true}}.dump()),
      .mime = "application/json",
      .headers = m_defaultHeaders,
      .status = 201,
  };
}

saucer::scheme::response SchemeHandler::handleGetBoardArt(const Router::Params &p, const saucer::scheme::request &req) const
{
  auto boardName = p.at("board");
  if (!Settings::isValidBoardName(boardName))
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Invalid board name"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 400,
    };
  }

  const auto path = m_settings.getBoardArtPath(boardName);
  std::ifstream file(path, std::ios::binary);
  if (path.empty() || !file.is_open())
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Board art not found"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 404,
    };
  }

  std::vector<std::uint8_t> bytes(
      (std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
  return saucer::scheme::response{
      .data = saucer::stash::from(std::move(bytes)),
      .mime = "image/jpeg",
      .headers = m_defaultHeaders,
      .status = 200,
  };
}

// The saucer webview does not open a panel for <input type="file">, so the
// frontend picks images via the native picker (saucer.exposed.pickFile) and
// fetches the bytes through this route to downscale them in-canvas. Reading
// is limited to image extensions; the webview already has arbitrary text
// reads via the exposed readFile, so this adds no new exposure.
saucer::scheme::response SchemeHandler::handleGetLocalImage(const Router::Params &p, const saucer::scheme::request &req) const
{
  namespace fs = std::filesystem;
  const auto path = p.at("path");

  std::string extension = fs::path(path).extension().string();
  std::transform(extension.begin(), extension.end(), extension.begin(),
                 [](unsigned char c) { return std::tolower(c); });
  static const std::set<std::string> allowed{
      ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif"};
  if (!allowed.contains(extension))
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Not an image file"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 415,
    };
  }

  std::error_code ec;
  const auto size = fs::file_size(path, ec);
  constexpr std::uintmax_t MAX_LOCAL_IMAGE_BYTES = 32ull * 1024 * 1024;
  if (ec || size == 0 || size > MAX_LOCAL_IMAGE_BYTES)
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Image not readable"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 404,
    };
  }

  std::ifstream file(path, std::ios::binary);
  if (!file.is_open())
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Image not readable"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 404,
    };
  }
  std::vector<std::uint8_t> bytes(
      (std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());

  return saucer::scheme::response{
      .data = saucer::stash::from(std::move(bytes)),
      .mime = "application/octet-stream",
      .headers = m_defaultHeaders,
      .status = 200,
  };
}

// The uploaded artwork is a small client-side-downscaled JPEG; cap defensively.
static constexpr std::size_t MAX_BOARD_ART_BYTES = 4 * 1024 * 1024;

saucer::scheme::response SchemeHandler::handleSaveBoardArt(const Router::Params &p, const saucer::scheme::request &req) const
{
  auto boardName = p.at("board");
  if (!Settings::isValidBoardName(boardName))
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Invalid board name"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 400,
    };
  }

  const auto content = req.content();
  if (content.size() == 0)
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("No image data received"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 400,
    };
  }
  if (content.size() > MAX_BOARD_ART_BYTES)
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str(
            "Image too large (max " +
            std::to_string(MAX_BOARD_ART_BYTES / (1024 * 1024)) + " MB)"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 413,
    };
  }

  const auto path = m_settings.getBoardArtPath(boardName);
  std::ofstream file(path, std::ios::binary);
  if (path.empty() || !file.is_open())
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Failed to open file for writing"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 500,
    };
  }
  file.write(reinterpret_cast<const char *>(content.data()), content.size());

  return saucer::scheme::response{
      .data = saucer::stash::from_str(json{{"ok", true}}.dump()),
      .mime = "application/json",
      .headers = m_defaultHeaders,
      .status = 201,
  };
}

saucer::scheme::response SchemeHandler::handleSaveSettings(const Router::Params &p, const saucer::scheme::request &req) const
{
  const auto content = req.content();
  if (content.size() == 0)
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("No content provided"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 400,
    };
  }

  json payload;
  try
  {
    payload = json::parse(
        std::string(reinterpret_cast<const char *>(content.data()), content.size()));
  }
  catch (...)
  {
    payload = json();
  }
  if (!payload.is_object())
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Invalid settings payload"),
        .mime = "text/plain",
        .headers = m_defaultHeaders,
        .status = 400,
    };
  }

  const auto exposeIt = payload.find("allowExternalRuntimeAccess");
  if (exposeIt != payload.end() && exposeIt->is_boolean())
  {
    m_settings.setAllowExternalAccess(exposeIt->get<bool>());
  }

  const auto usersIt = payload.find("allowedUsers");
  if (usersIt != payload.end() && usersIt->is_array())
  {
    std::vector<std::string> emails;
    for (const auto& entry : *usersIt)
    {
      if (entry.is_string())
      {
        emails.push_back(entry.get<std::string>());
      }
    }
    m_settings.setAllowedUsers(emails);
  }

  return saucer::scheme::response{
      .data = saucer::stash::from_str(currentRuntimeSettings().dump()),
      .mime = "application/json",
      .headers = m_defaultHeaders,
  };
}
