#include "popupWindow.h"

extern const bool isDebugBuild;

bool PopupWindow::open(saucer::application *app,
                       const std::string   &url,
                       const std::string   &title,
                       std::pair<int,int>   size,
                       ReadyCallback        onReady,
                       NavigateCallback     onNavigate)
{
  close();

  auto winResult = saucer::window::create(app);
  if (!winResult.has_value()) 
  { 
    return false; 
  }

  win = winResult.value();
  win->set_title(title);
  win->set_size({size.first, size.second});

  auto svResult = saucer::smartview::create({.window = win});
  if (!svResult.has_value()) 
  { 
    win.reset(); 
    return false; 
  }

  view.emplace(std::move(svResult.value()));
  view->set_dev_tools(isDebugBuild);

  // Grant all media permissions (popup only loads trusted local/OAuth content).
  view->on<saucer::webview::event::permission>(
    [](const std::shared_ptr<saucer::permission::request> &req) -> saucer::status
    {
      req->accept(true);
      return saucer::status::handled;
    });

  if (onNavigate) {
    view->on<saucer::webview::event::navigate>(
      [cb = std::move(onNavigate)](const saucer::navigation &nav) -> saucer::policy
      {
        return cb(nav);
      });
  }

  // Release resources when the popup is closed (by the user or programmatically).
  win->on<saucer::window::event::closed>([this]()
  {
    view.reset();
    win.reset();
  });

  if (onReady) 
  { 
    onReady(view.value()); 
  }

  view->set_url(url);
  win->show();
  return true;
}

void PopupWindow::close()
{
  if (win) 
  { 
    win->close(); 
  }
}

bool PopupWindow::isOpen() const
{
  return win != nullptr;
}
