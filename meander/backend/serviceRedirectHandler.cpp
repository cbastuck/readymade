#include "serviceRedirectHandler.h"
#include <nlohmann/json.hpp>
#include <string_view>

namespace {

bool isServiceRedirectCallback(std::string_view url)
{
  // Match the actual callback path, not just any URL that happens to contain
  // the redirect path as a query parameter or fragment.
  const auto schemePos = url.find("://");
  const auto pathStart = url.find('/', schemePos == std::string_view::npos ? 0 : schemePos + 3);
  if (pathStart == std::string_view::npos) {
    return false;
  }

  const auto pathEnd = url.find_first_of("?#", pathStart);
  const auto path = url.substr(pathStart, pathEnd == std::string_view::npos ? std::string_view::npos : pathEnd - pathStart);
  return path == "/serviceRedirect";
}

} // namespace

ServiceRedirectHandler::ServiceRedirectHandler(saucer::smartview *mainView, saucer::application *app)
  : mainView_(mainView), app_(app)
{}

void ServiceRedirectHandler::open(const std::string &url)
{
  // onNavigate: intercept /serviceRedirect entirely in C++ so the Meander
  // React app never loads inside the popup (it has no router for that path).
  popup_.open(
    app_,
    url,
    "Service Redirect Popup",
    {600, 700},
    nullptr,
    [this](const saucer::navigation &nav) -> saucer::policy
    {
      const auto urlStr = nav.url().string();
      if (!isServiceRedirectCallback(urlStr)) {
        return saucer::policy::allow;
      }

      relayToMain(buildPostMessagePayload(urlStr));
      popup_.close();
      return saucer::policy::block;
    }
  );
}

void ServiceRedirectHandler::relayToMain(const std::string &data)
{
  auto encoded = nlohmann::json(data).dump();
  static_cast<saucer::webview *>(mainView_)->execute(
    "window.postMessage(" + encoded + ", '*')"
  );
}

std::string ServiceRedirectHandler::buildPostMessagePayload(const std::string &urlStr)
{
  auto json = nlohmann::json::object();

  auto parseSegment = [&json](std::string_view seg)
  {
    while (!seg.empty()) {
      auto amp  = seg.find('&');
      auto pair = seg.substr(0, amp);
      auto eq   = pair.find('=');
      if (eq != std::string_view::npos) {
        json[std::string(pair.substr(0, eq))] = std::string(pair.substr(eq + 1));
      }
      if (amp == std::string_view::npos) { break; }
      seg = seg.substr(amp + 1);
    }
  };

  std::string_view url = urlStr;
  auto qPos = url.find('?');
  if (qPos != std::string_view::npos) {
    auto rest = url.substr(qPos + 1);
    auto hPos = rest.find('#');
    if (hPos != std::string_view::npos) {
      parseSegment(rest.substr(0, hPos));  // query params
      parseSegment(rest.substr(hPos + 1)); // hash fragment
    } else {
      parseSegment(rest);
    }
  }

  return json.dump();
}
