#include <catch2/catch_test_macros.hpp>

#include <atomic>
#include <iostream>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>

#include "listening_fixture.h"

using listening::Listening;
using boost::asio::ip::tcp;

// ──────────────────────────────────────────────────────────────────────────────
// A secret's value, used and then looked for everywhere it must not be.
//
// A board names a secret; the value reaches the runtime separately and is used
// where the service needs it — here, a header an HTTP Client sends. It must
// come back out nowhere else: not in what the runtime reports, not in the
// answer to the run, and not in what it writes to its console. The upstream
// fails, so the error paths run too. The same sweep is in hkp-node
// (tests/secret-canary.test.ts) and hkp-python (tests/test_secret_canary.py).
// ──────────────────────────────────────────────────────────────────────────────

namespace {

const std::string kCanary = "canary-6f1d0e2a-secret-value";

// A server the HTTP Client calls, which fails and remembers what it was sent.
class FailingUpstream
{
public:
  FailingUpstream()
    : m_acceptor(m_io, tcp::endpoint(boost::asio::ip::make_address("127.0.0.1"), 0))
  {
    m_thread = std::thread([this]() {
      boost::system::error_code error;
      tcp::socket socket(m_io);
      m_acceptor.accept(socket, error);
      if (error)
      {
        return;
      }
      boost::asio::streambuf buffer;
      boost::asio::read_until(socket, buffer, "\r\n\r\n", error);
      {
        std::lock_guard lock(m_mutex);
        m_received.assign(std::istreambuf_iterator<char>(&buffer), {});
      }
      const std::string answer =
        "HTTP/1.1 500 Internal Server Error\r\nContent-Length: 15\r\nConnection: close\r\n\r\nupstream failed";
      boost::asio::write(socket, boost::asio::buffer(answer), error);
    });
  }

  ~FailingUpstream()
  {
    boost::system::error_code error;
    m_acceptor.close(error);
    m_thread.join();
  }

  std::string url() const
  {
    return "http://127.0.0.1:" + std::to_string(m_acceptor.local_endpoint().port()) + "/hook";
  }

  std::string received()
  {
    std::lock_guard lock(m_mutex);
    return m_received;
  }

private:
  boost::asio::io_context m_io;
  tcp::acceptor m_acceptor;
  std::thread m_thread;
  std::mutex m_mutex;
  std::string m_received;
};

// What the process writes to its console while this lives.
class CapturedConsole
{
public:
  CapturedConsole()
    : m_out(std::cout.rdbuf(m_outText.rdbuf()))
    , m_err(std::cerr.rdbuf(m_errText.rdbuf()))
  {
  }
  ~CapturedConsole()
  {
    std::cout.rdbuf(m_out);
    std::cerr.rdbuf(m_err);
  }
  std::string text() const { return m_outText.str() + m_errText.str(); }

private:
  std::ostringstream m_outText;
  std::ostringstream m_errText;
  std::streambuf* m_out;
  std::streambuf* m_err;
};

} // namespace

TEST_CASE("a secret leaves the runtime only where its service uses it", "[secrets][canary]") {
  FailingUpstream upstream;
  Listening rt("");
  std::string consoleText;
  std::map<std::string, std::string> surfaces;
  {
    CapturedConsole console;
    const nlohmann::json runtime = {
      {"id", "rt"},
      {"name", "Cpp"},
      {"services",
       {{{"serviceId", "http-client"},
         {"uuid", "call"},
         {"state",
          {{"url", upstream.url()},
           {"method", "POST"},
           {"headers", {{"Authorization", "Bearer {{secret.api}}"}}}}}},
        {{"serviceId", "monitor"}, {"uuid", "watch"}}}},
      {"secrets", {{"api", {{"value", kCanary}}}}},
    };
    REQUIRE(rt.send("POST", "/runtimes", {{"Content-Type", "application/json"}}, runtime.dump()).status == 200);

    surfaces["the run's answer"] =
      rt.send("POST", "/runtimes/rt", {{"Content-Type", "application/json"}}, R"({"go":true})").body;
    for (int waited = 0; waited < 3000 && upstream.received().empty(); waited += 10)
    {
      std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }
    surfaces["the runtimes"] = rt.send("GET", "/runtimes").body;
    surfaces["the runtime"] = rt.send("GET", "/runtimes/rt").body;
    surfaces["its services"] = rt.send("GET", "/runtimes/rt/services").body;
    consoleText = console.text();
  }
  surfaces["the console"] = consoleText;

  // Used: it went where the board sent it.
  REQUIRE(upstream.received().find(kCanary) != std::string::npos);
  for (const auto& [where, text] : surfaces)
  {
    INFO(where << ": " << text);
    REQUIRE(text.find(kCanary) == std::string::npos);
  }
}
