#include "router.h"
#include <sstream>


void Router::register_route(const Method& method, const std::string& path, Handler handler)
{
  routes_[method].emplace_back(RouteEntry{parse_path(path), handler});
}


std::optional<saucer::scheme::response> Router::route(const saucer::scheme::request &req) const
{
  auto method = req.method();
  auto method_it = routes_.find(method);
  auto wildcard_it = routes_.find("*");

  if (method_it == routes_.end() && wildcard_it == routes_.end())
  {
    return std::nullopt;
  }

  boost::system::result< boost::url > u = boost::urls::parse_uri_reference(req.url()).value();
  auto path = std::string(u->encoded_path());
  auto host = std::string(u->encoded_host());
  std::string full = host + "/" + path;
  std::vector<std::string> segments = split_path(full);

  auto try_match = [&](const auto& entries) -> std::optional<saucer::scheme::response> {
    for (const auto& entry : entries) 
    {
      Params params;
      if (match(entry.pattern, segments, params))
      {
        return std::optional<saucer::scheme::response>(entry.handler(params, req));
      }
    }
    return std::nullopt;
  };

  if (method_it != routes_.end())
  {
    auto res = try_match(method_it->second);
    if (res)
    {
      return res;
    }
  }
  if (wildcard_it != routes_.end())
  {
    auto res = try_match(wildcard_it->second);
    if (res)
    {
      return res;
    }
  }
  return std::nullopt;
}

std::vector<std::string> Router::split_path(const std::string& path) 
{
  std::vector<std::string> result;
  std::stringstream ss(path);
  std::string segment;
  while (std::getline(ss, segment, '/'))
  {
    if (!segment.empty())
    {
      result.push_back(segment);
    }
  }
  return result;
}

Router::Pattern Router::parse_path(const std::string& path) 
{
  return split_path(path);
}

bool Router::match(const Pattern& pattern, const std::vector<std::string>& segments, Params& params) 
{
  // Support wildcard '*' only at the end of the pattern
  bool has_wildcard = !pattern.empty() && pattern.back() == "*";
  size_t pattern_size = has_wildcard ? pattern.size() - 1 : pattern.size();

  if ((!has_wildcard && pattern_size != segments.size()) ||
      (has_wildcard && segments.size() < pattern_size))
  {
    return false;
  }

  for (size_t i = 0; i < pattern_size; ++i)
  {
    if (!pattern[i].empty() && pattern[i][0] == ':')
    {
      params[pattern[i].substr(1)] = segments[i];
    }
    else if (pattern[i] != segments[i])
    {
      return false;
    }
  }

  if (has_wildcard)
  {
    // Join the remaining segments as the wildcard match
    std::string wildcard_value;
    for (size_t i = pattern_size; i < segments.size(); ++i)
    {
      if (!wildcard_value.empty()) 
      {
        wildcard_value += "/";
      }
      wildcard_value += segments[i];
    }
    params["*"] = wildcard_value;
  }

  return true;
}
