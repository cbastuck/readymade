#pragma once

#include <memory>
#include <string>
#include <thread>

/**
 * Serves the hkp-frontend SPA over plain HTTP on a LAN-accessible address.
 *
 * In SAUCER_EMBEDDED builds the content comes from the same compiled-in byte
 * arrays that the webview uses.  In dev builds every request is proxied to the
 * vite dev server at localhost:5555 so the phone sees the same live code as
 * the desktop.
 *
 * All unrecognised paths fall back to index.html so that client-side routing
 * (/playground/…?fromLink=…) works correctly.
 */
class FrontendServer
{
public:
  FrontendServer();
  ~FrontendServer();

  /** Start serving on bindAddress:port (blocks until stop() or error). */
  void start(const std::string& bindAddress, uint16_t port);
  void stop();

  uint16_t getBoundPort() const;

private:
  struct Impl;
  std::unique_ptr<Impl> m_impl;
};
