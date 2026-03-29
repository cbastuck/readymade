#include "./schemeHandler.h"

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
}

void SchemeHandler::addRoute(const Router::Method &method, const std::string &path, Router::Handler handler)
{
  m_router.register_route(method, path, handler);
}

saucer::scheme::response SchemeHandler::handleRequest(const saucer::scheme::request &req)
{
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
  auto remotesArr = json{
      {
          {"url", "hkp://remotes/" + m_server->name()},
          {"port", m_server->port()},
          {"name", m_server->name()},
      },
  };
  return saucer::scheme::response{
      .data = saucer::stash::from_str(remotesArr.dump()),
      .mime = "application/json",
      .headers = m_defaultHeaders,
  };
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
