#pragma once

#include <map>
#include <memory>

#include "./router.h"
#include "./settings.h"

#include <saucer/scheme.hpp>

namespace hkp
{
  class Server;
}

class SchemeHandler
{
public:
  SchemeHandler(std::shared_ptr<hkp::Server> server, Settings settings);

  saucer::scheme::response handleRequest(const saucer::scheme::request &req);
  void addRoute(const Router::Method &method, const std::string &path, Router::Handler handler);

private:
  saucer::scheme::response handleGetRemotes(const Router::Params &p, const saucer::scheme::request &req) const;
  saucer::scheme::response handleRemoteForward(const Router::Params &p, const saucer::scheme::request &req) const;
  saucer::scheme::response handleSaveBoard(const Router::Params &p, const saucer::scheme::request &req) const;
  saucer::scheme::response handleLoadBoard(const Router::Params &p, const saucer::scheme::request &req) const;
  saucer::scheme::response handleListBoards(const Router::Params &p, const saucer::scheme::request &req) const;
  saucer::scheme::response handleDeleteBoard(const Router::Params &p, const saucer::scheme::request &req) const;

private:
  std::shared_ptr<hkp::Server> m_server;
  std::map<std::string, std::string> m_defaultHeaders;
  Router m_router;
  Settings m_settings;
};
