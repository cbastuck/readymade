#pragma once

#include <functional>
#include <memory>
#include <string>
#include <thread>

/**
 * Serves the hkp-frontend SPA over plain HTTP on a LAN-accessible address.
 *
 * In SAUCER_EMBEDDED builds the content comes from the same compiled-in byte
 * arrays that the webview uses.  In dev builds every request is proxied to the
 * vite dev server at localhost:8555 so the phone sees the same live code as
 * the desktop.
 *
 * All unrecognised paths fall back to index.html so that client-side routing
 * (/playground/…?fromLink=…) works correctly.
 *
 * One path is answered rather than served: /serviceRedirect, where an OAuth
 * provider sends the user back after login in the OS browser. See
 * setRedirectRelay().
 */
class FrontendServer
{
public:
  FrontendServer();
  ~FrontendServer();

  /**
   * Called with the JSON object of an OAuth callback's parameters
   * (`{"code":"…","state":"…"}`) when one arrives at /serviceRedirect from the
   * loopback interface — the app relays it into the webview, where the flow
   * that opened the browser is waiting for it.
   *
   * Called on the server thread. Set it before start(); with none set, a
   * callback is answered but goes nowhere.
   */
  using RedirectRelay = std::function<void(const std::string& paramsJson)>;
  void setRedirectRelay(RedirectRelay relay);

  /** Start serving on bindAddress:port (blocks until stop() or error). */
  void start(const std::string& bindAddress, uint16_t port);
  void stop();

  uint16_t getBoundPort() const;

private:
  struct Impl;
  std::unique_ptr<Impl> m_impl;
};
