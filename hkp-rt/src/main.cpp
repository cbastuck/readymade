#include <fstream>

#include "./http/server.h"
#include "./app.h"

int main(int argc, char **argv)
{
  if (argc < 2) 
  {
    std::cerr << "Usage: " << argv[0] << " <port> <externalIP>" << std::endl;
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

  auto app = std::make_shared<App>(externalIP);
  Server server(app);
  server.start(port);
}
