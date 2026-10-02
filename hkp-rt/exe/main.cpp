#include <atomic>
#include <chrono>
#include <csignal>
#include <fstream>
#include <iostream>
#include <vector>
#include <string>
#include <memory>
#include <thread>

#include "app.h"
#include "server.h"
#include "standalone_config.h"

namespace
{
std::atomic<bool> stopRequested{false};

void onSignal(int)
{
  // Only a flag: nothing a server does to stop is safe inside a signal handler.
  stopRequested = true;
}
}

int main(int argc, char **argv)
{
  std::vector<std::string> arguments;
  for (int i = 1; i < argc; ++i)
  {
    arguments.push_back(argv[i]);
  }
  if (arguments.empty())
  {
    std::cerr << "Usage: " << argv[0] << " <port> <externalHost> <config>" << std::endl;
  }

  const auto config = hkp::readStandaloneConfig(arguments);
  if (!config.error.empty())
  {
    std::cerr << "[hkp-rt] " << config.error << std::endl;
    return 1;
  }

  auto app = std::make_shared<hkp::App>();
  hkp::Server server(app, "hkp-rt", config.allowedOrigins, "", config.auth);

  // Endpoints its services expose are paths on this server's own port, at
  // addresses that survive a restart because the secret they are derived from
  // does. See mounts.h.
  hkp::Server::MountOptions mounts;
  mounts.secret = !config.mountSecret.empty() || config.mountSecretFile.empty()
    ? config.mountSecret
    : hkp::loadOrCreateMountSecret(config.mountSecretFile);
  mounts.externalUrl = config.externalUrl;
  mounts.externalHost = config.externalHost;
  mounts.port = config.port;
  server.enableMounts(std::move(mounts));

  if (!config.runtimeConfigFile.empty())
  {
    std::ifstream ifs(config.runtimeConfigFile);
    if (ifs.is_open())
    {
      json jf = json::parse(ifs);
      app->createRuntime(jf);
    }
    else
    {
      std::cerr << "Could not open file: " << config.runtimeConfigFile << std::endl;
    }
  }

  // A standalone server is one a coordinator's runtimes can live on: it stays
  // up with nobody watching. Tickets are kept beside its other data, so a
  // deployed board's runtimes are re-established after a restart.
  server.enableCoordinatorLinks(
    config.linksFile.empty()
      ? hkp::createMemoryLinkStore()
      : hkp::createFileLinkStore(config.linksFile));

  std::cout << "[hkp-rt] listening on " << config.bind << ":" << config.port
            << (config.auth.mode == hkp::AuthMode::Jwt ? " (authenticated)" : " (no auth: loopback only)")
            << std::endl;

  // SIGTERM is how a container is asked to stop; closing links on the way out
  // lets a coordinator see the runtime leave rather than time it out.
  std::signal(SIGINT, onSignal);
  std::signal(SIGTERM, onSignal);
  std::thread watcher([&server]() {
    while (!stopRequested)
    {
      std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }
    server.stop();
  });
  watcher.detach();

  server.start(config.externalHost, config.port, config.bind);
  return 0;
}
