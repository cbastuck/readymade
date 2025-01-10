#include <fstream>

#include "./types.h"
#include "./core_input.h"
#include "./core_output.h"
#include "./sine_provider.h"
#include "./websocket_writer.h"
#include "./websocket_reader.h"
#include "./runtime.h"
#include "./server.h"

int manualWiring(int argc, char **argv)
{
  std::string mode = argc > 1 ? argv[1] : "both";
  std::cout << "Started with mode: " << mode << std::endl;

  std::shared_ptr<CoreInput> producer;
  std::shared_ptr<WebsocketWriter> writer;
  if (mode == "producer" || mode == "both")
  {
    producer = std::make_shared<CoreInput>("producer");
    writer = std::make_shared<WebsocketWriter>("writer");

    std::ifstream f("/Users/cbastuck/Development/Projects/hookup/hkp-rt/core-audio/config/local_producer.json");
    json config = json::parse(f);
    writer->configure(config);

    producer->connect(writer);
    producer->configure(json{{"running", true}});
  }

  std::this_thread::sleep_for(std::chrono::milliseconds(100)); // give the writer a chance to produce some initial data

  std::shared_ptr<WebsocketReader> reader;
  std::shared_ptr<CoreOutput> consumer;
  if (mode == "consumer" || mode == "both")
  {
    consumer = std::make_shared<CoreOutput>("consumer");
    reader = std::make_shared<WebsocketReader>("reader");

    std::ifstream f("/Users/cbastuck/Development/Projects/hookup/hkp-rt/core-audio/config/local_consumer.json");
    json config = json::parse(f);
    reader->configure(config);

    consumer->connect(reader);
    consumer->configure(json{{"running", true}});
  }

  while (true)
  {
    // stop withg ctrl + c
  }
}
