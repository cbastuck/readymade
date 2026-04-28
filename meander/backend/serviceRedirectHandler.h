#pragma once
#include "popupWindow.h"
#include <saucer/smartview.hpp>
#include <string>

// Handles OAuth popup flows in Meander.
//
// Flow:
//   1. Frontend calls saucer.exposed.openInBrowser(url)
//   2. open() creates a popup window via PopupWindow
//   3. C++ navigate handler intercepts /serviceRedirect, parses the URL params,
//      relays them to the main window via postMessage, and closes the popup —
//      the React app never loads inside the popup (Meander has no router for that path).
class ServiceRedirectHandler
{
public:
  ServiceRedirectHandler(saucer::smartview *mainView, saucer::application *app);

  void open(const std::string &url);

private:
  saucer::smartview  *mainView_;
  saucer::application *app_;
  PopupWindow         popup_;

  void relayToMain(const std::string &data);

  // Parses query-string and hash-fragment key=value pairs from a URL into a
  // JSON object string (e.g. {"code":"...","state":"..."}).
  static std::string buildPostMessagePayload(const std::string &urlStr);
};
