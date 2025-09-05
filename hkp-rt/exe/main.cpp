#include <fstream>

#include "server.h"
#include "app.h"

int main(int argc, char **argv)
{
  if (argc < 2) 
  {
    std::cerr << "Usage: " << argv[0] << " <port> <externalIP> <config>" << std::endl;
  }

  unsigned int port = 5556;
  if (argc > 1)
  {
    port = std::stoi(argv[1]);
  }

  std::string externalIP = "127.0.0.1";
  if (argc > 2) 
  {
    externalIP = argv[2];
  }

  auto app = std::make_shared<hkp::App>();
  hkp::Server server(app, "hkp-rt", "*");

  if (argc > 3) 
  {
    std::ifstream ifs(argv[3]); // third argument is a runtime config
    if (ifs.is_open()) {
      json jf = json::parse(ifs);
      app->createRuntime(jf);
    }
    else
    {
      std::cerr << "Could not open file: " << argv[3] << std::endl;
    }
  }

  server.start(externalIP, port);
}
