#pragma once

#include <string>
#include <unordered_map>
#include <vector>
#include <functional>
#include <optional>

#include <saucer/scheme.hpp>

#include <boost/url.hpp>
#include <boost/url/scheme.hpp>

class Router {
public:
  using Params = std::unordered_map<std::string, std::string>;
  using Handler = std::function<saucer::scheme::response (const Params&, const saucer::scheme::request &req)>;
  using Method = std::string;

  void register_route(const Method& method, const std::string& path, Handler handler);

  std::optional<saucer::scheme::response> route(const saucer::scheme::request &req) const;

private:
  using Pattern = std::vector<std::string>;
  struct RouteEntry {
    Pattern pattern;
    Handler handler;
  };
  // Map HTTP method to vector of (pattern, handler)
  std::unordered_map<Method, std::vector<RouteEntry>> routes_;

  static std::vector<std::string> split_path(const std::string& path);
  static Pattern parse_path(const std::string& path);
  static bool match(const Pattern& pattern, const std::vector<std::string>& segments, Params& params);
};