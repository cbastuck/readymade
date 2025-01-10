#include <fstream>

#include "./http/server.h"
#include "./app.h"

int main(int argc, char **argv)
{
  unsigned int port = 5556;
  if (argc > 1)
  {
    std::cerr << "Usage: " << argv[0] << " <port>" << std::endl;
    port = std::stoi(argv[1]);
  }

  auto app = std::make_shared<App>();
  Server server(app);
  server.start(port);
}
