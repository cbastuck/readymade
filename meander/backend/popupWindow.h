#pragma once
#include <saucer/smartview.hpp>
#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <utility>

// Generic saucer popup window.
// Owns the window and smartview for a single popup.  Lifetime must exceed any
// open popup (i.e. must stay alive as long as the window can fire events).
struct PopupWindow
{
  std::optional<saucer::smartview> view;
  std::shared_ptr<saucer::window>  win;

  using NavigateCallback = std::function<saucer::policy(const saucer::navigation &)>;
  using ReadyCallback    = std::function<void(saucer::smartview &)>;

  // Creates and shows a popup window loading `url`.
  //
  //   onReady    – called with the smartview right before set_url(); use to
  //                inject scripts or expose C++ functions.
  //   onNavigate – called for every navigation event; returning block stops it.
  //
  // Returns false if the window or smartview could not be created.
  bool open(saucer::application *app,
            const std::string   &url,
            const std::string   &title      = "Popup",
            std::pair<int,int>   size        = {800, 600},
            ReadyCallback        onReady     = nullptr,
            NavigateCallback     onNavigate  = nullptr);

  void close();
  bool isOpen() const;
};
