#include <catch2/catch_test_macros.hpp>

#include <atomic>
#include <chrono>
#include <functional>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <thread>
#include <vector>

#include <boost/asio.hpp>
#include <boost/asio/ssl.hpp>
#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <boost/beast/ssl.hpp>
#include <boost/beast/websocket.hpp>
#include <boost/beast/websocket/ssl.hpp>

#include <openssl/evp.h>
#include <openssl/pem.h>
#include <openssl/x509.h>
#include <openssl/x509v3.h>

#include <common/link_socket.h>

using namespace hkp;

namespace beast = boost::beast;
namespace http = beast::http;
namespace websocket = beast::websocket;
namespace net = boost::asio;
namespace ssl = net::ssl;
using tcp = net::ip::tcp;

// ──────────────────────────────────────────────────────────────────────────────
// The connection a runtime server opens to a coordinator.
//
// What is tested is what a link decides on: whether the connection opened,
// what arrived over it, and how it ended — a refused upgrade and its status, a
// close and its code, a peer that went quiet. The peer here is a real
// websocket server on loopback, plain and over TLS.
// ──────────────────────────────────────────────────────────────────────────────

namespace {

struct Certificate
{
  std::string certPem;
  std::string keyPem;
};

std::string pemOf(BIO* bio)
{
  char* data = nullptr;
  const long length = BIO_get_mem_data(bio, &data);
  std::string out(data, static_cast<std::size_t>(length));
  BIO_free(bio);
  return out;
}

/** A self-signed certificate for 127.0.0.1, made for the test run. */
Certificate makeCertificate()
{
  EVP_PKEY* key = EVP_RSA_gen(2048);
  X509* cert = X509_new();
  ASN1_INTEGER_set(X509_get_serialNumber(cert), 1);
  X509_gmtime_adj(X509_getm_notBefore(cert), -60);
  X509_gmtime_adj(X509_getm_notAfter(cert), 3600);
  X509_set_pubkey(cert, key);
  X509_NAME* name = X509_get_subject_name(cert);
  X509_NAME_add_entry_by_txt(name, "CN", MBSTRING_ASC,
                             reinterpret_cast<const unsigned char*>("127.0.0.1"),
                             -1, -1, 0);
  X509_set_issuer_name(cert, name);
  X509V3_CTX ctx;
  X509V3_set_ctx_nodb(&ctx);
  X509V3_set_ctx(&ctx, cert, cert, nullptr, nullptr, 0);
  X509_EXTENSION* san = X509V3_EXT_conf_nid(nullptr, &ctx, NID_subject_alt_name,
                                            "IP:127.0.0.1");
  X509_add_ext(cert, san, -1);
  X509_EXTENSION_free(san);
  X509_sign(cert, key, EVP_sha256());

  BIO* certBio = BIO_new(BIO_s_mem());
  PEM_write_bio_X509(certBio, cert);
  BIO* keyBio = BIO_new(BIO_s_mem());
  PEM_write_bio_PrivateKey(keyBio, key, nullptr, nullptr, 0, nullptr, nullptr);
  Certificate out{pemOf(certBio), pemOf(keyBio)};
  X509_free(cert);
  EVP_PKEY_free(key);
  return out;
}

/**
 * A websocket peer on loopback. It accepts a connection only when it presents
 * `Bearer good`, echoes what it is sent, and does a few things on request:
 * `close:<code>` closes with that code, `silence` stops reading, and
 * `binary` answers with a binary frame.
 */
class Peer
{
public:
  explicit Peer(std::optional<Certificate> certificate = std::nullopt)
    : m_acceptor(m_ioc, tcp::endpoint(net::ip::make_address("127.0.0.1"), 0))
  {
    if (certificate)
    {
      m_tls.emplace(ssl::context::tls_server);
      m_tls->use_certificate_chain(net::buffer(certificate->certPem));
      m_tls->use_private_key(net::buffer(certificate->keyPem), ssl::context::pem);
    }
    m_port = m_acceptor.local_endpoint().port();
    m_thread = std::thread([this]() { serve(); });
  }

  ~Peer()
  {
    m_stopping = true;
    beast::error_code ignored;
    m_acceptor.close(ignored);
    // Unblocks an accept that is already waiting.
    try
    {
      tcp::socket poke(m_ioc);
      poke.connect(tcp::endpoint(net::ip::make_address("127.0.0.1"), m_port), ignored);
    }
    catch (...) {}
    if (m_thread.joinable())
    {
      m_thread.join();
    }
  }

  std::string url(const std::string& path = "/coordinator/join") const
  {
    return std::string(m_tls ? "wss" : "ws") + "://127.0.0.1:" +
      std::to_string(m_port) + path;
  }

  std::string lastAuthorization()
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    return m_authorization;
  }
  std::string lastTarget()
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    return m_target;
  }

private:
  template <class Stream>
  void session(Stream& stream)
  {
    beast::flat_buffer buffer;
    http::request<http::string_body> request;
    http::read(stream, buffer, request);
    {
      std::lock_guard<std::mutex> lock(m_mutex);
      m_authorization = std::string(request[http::field::authorization]);
      m_target = std::string(request.target());
    }
    if (request[http::field::authorization] != "Bearer good")
    {
      http::response<http::string_body> refusal{http::status::unauthorized,
                                                request.version()};
      refusal.prepare_payload();
      http::write(stream, refusal);
      return;
    }

    websocket::stream<Stream&> ws(stream);
    // The peer's own ceiling out of the way, so that the one under test is
    // the connection's.
    ws.read_message_max(0);
    ws.accept(request);
    for (;;)
    {
      beast::flat_buffer incoming;
      ws.read(incoming);
      const std::string text = beast::buffers_to_string(incoming.data());
      if (text.rfind("close:", 0) == 0)
      {
        ws.close(websocket::close_reason(
          static_cast<websocket::close_code>(std::stoi(text.substr(6))), "bye"));
        return;
      }
      if (text == "silence")
      {
        // Connected, and no longer answering anything — pings included.
        std::this_thread::sleep_for(std::chrono::milliseconds(1500));
        return;
      }
      ws.binary(ws.got_binary() || text == "binary");
      ws.write(incoming.data());
    }
  }

  void serve()
  {
    while (!m_stopping)
    {
      beast::error_code ec;
      tcp::socket socket(m_ioc);
      m_acceptor.accept(socket, ec);
      if (ec || m_stopping)
      {
        return;
      }
      try
      {
        if (m_tls)
        {
          beast::ssl_stream<tcp::socket> stream(std::move(socket), *m_tls);
          stream.handshake(ssl::stream_base::server);
          session(stream);
        }
        else
        {
          session(socket);
        }
      }
      catch (const std::exception&)
      {
        // The client went away, or never trusted us. Next connection.
      }
    }
  }

  net::io_context m_ioc;
  tcp::acceptor m_acceptor;
  std::optional<ssl::context> m_tls;
  unsigned short m_port = 0;
  std::thread m_thread;
  std::atomic<bool> m_stopping{false};
  std::mutex m_mutex;
  std::string m_authorization;
  std::string m_target;
};

/** An io_context running on its own thread, and what a connection reported. */
struct Client
{
  net::io_context ioc;
  net::executor_work_guard<net::io_context::executor_type> work{net::make_work_guard(ioc)};
  std::thread thread{[this]() { ioc.run(); }};

  std::mutex mutex;
  bool opened = false;
  std::vector<std::pair<std::string, bool>> messages;
  std::optional<LinkSocket::Closed> closed;
  std::shared_ptr<LinkSocket> socket;

  ~Client()
  {
    if (socket)
    {
      socket->close();
    }
    work.reset();
    ioc.stop();
    if (thread.joinable())
    {
      thread.join();
    }
  }

  void connect(LinkSocket::Options options)
  {
    LinkSocket::Handlers handlers;
    handlers.onOpen = [this]() {
      std::lock_guard<std::mutex> lock(mutex);
      opened = true;
    };
    handlers.onMessage = [this](std::string message, bool binary) {
      std::lock_guard<std::mutex> lock(mutex);
      messages.emplace_back(std::move(message), binary);
    };
    handlers.onClose = [this](const LinkSocket::Closed& how) {
      std::lock_guard<std::mutex> lock(mutex);
      closed = how;
    };
    socket = LinkSocket::open(ioc, std::move(options), std::move(handlers));
  }

  bool isOpen() { std::lock_guard<std::mutex> lock(mutex); return opened; }
  bool isClosed() { std::lock_guard<std::mutex> lock(mutex); return closed.has_value(); }
  std::size_t count() { std::lock_guard<std::mutex> lock(mutex); return messages.size(); }
};

bool eventually(const std::function<bool()>& check, int milliseconds = 3000)
{
  for (int waited = 0; waited < milliseconds; waited += 10)
  {
    if (check())
    {
      return true;
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(10));
  }
  return check();
}

LinkSocket::Options to(const Peer& peer, const std::string& bearer = "good")
{
  LinkSocket::Options options;
  options.url = peer.url();
  options.bearer = bearer;
  return options;
}

} // namespace

TEST_CASE("it connects presenting its credential as a header", "[link-socket]") {
  Peer peer;
  Client client;

  client.connect(to(peer));

  REQUIRE(eventually([&] { return client.isOpen(); }));
  REQUIRE(peer.lastAuthorization() == "Bearer good");
  // The address carries the path and nothing of the credential.
  REQUIRE(peer.lastTarget() == "/coordinator/join");
}

TEST_CASE("the http spelling of an address connects the same way", "[link-socket]") {
  Peer peer;
  Client client;
  auto options = to(peer);
  options.url.replace(0, 2, "http");

  client.connect(options);

  REQUIRE(eventually([&] { return client.isOpen(); }));
}

TEST_CASE("a refused upgrade ends with the status it was refused with",
          "[link-socket]") {
  // 401 is how a coordinator says a ticket is no longer one: whoever reads
  // this stops presenting it, rather than trying again.
  Peer peer;
  Client client;

  client.connect(to(peer, "stale"));

  REQUIRE(eventually([&] { return client.isClosed(); }));
  REQUIRE_FALSE(client.closed->opened);
  REQUIRE(client.closed->httpStatus == 401);
  REQUIRE_FALSE(client.isOpen());
}

TEST_CASE("text and binary frames arrive as what they were", "[link-socket]") {
  Peer peer;
  Client client;
  client.connect(to(peer));
  REQUIRE(eventually([&] { return client.isOpen(); }));
  const std::string bytes("\x00\x01\xfe\xff", 4);

  client.socket->sendText("{\"type\":\"hello\"}");
  client.socket->sendBinary(bytes);

  REQUIRE(eventually([&] { return client.count() == 2; }));
  REQUIRE(client.messages[0].first == "{\"type\":\"hello\"}");
  REQUIRE_FALSE(client.messages[0].second);
  REQUIRE(client.messages[1].first == bytes);
  REQUIRE(client.messages[1].second);
}

TEST_CASE("what is sent before the connection is open is sent once it is",
          "[link-socket]") {
  Peer peer;
  Client client;

  client.connect(to(peer));
  client.socket->sendText("early");

  REQUIRE(eventually([&] { return client.count() == 1; }));
  REQUIRE(client.messages[0].first == "early");
}

TEST_CASE("a large message is not refused for its size", "[link-socket]") {
  Peer peer;
  Client client;
  client.connect(to(peer));
  REQUIRE(eventually([&] { return client.isOpen(); }));
  // Past the 16 MiB a websocket stream accepts unless told otherwise.
  const std::string large(20 * 1024 * 1024, 'x');

  client.socket->sendBinary(large);

  REQUIRE(eventually([&] { return client.count() == 1; }, 15000));
  REQUIRE(client.messages[0].first.size() == large.size());
}

TEST_CASE("a close says which code it was closed with", "[link-socket]") {
  // 4403 and 4409 are final for a link; anything else it reconnects through.
  Peer peer;
  Client client;
  client.connect(to(peer));
  REQUIRE(eventually([&] { return client.isOpen(); }));

  client.socket->sendText("close:4403");

  REQUIRE(eventually([&] { return client.isClosed(); }));
  REQUIRE(client.closed->opened);
  REQUIRE(client.closed->code == 4403);
}

TEST_CASE("a peer that stops answering is noticed", "[link-socket]") {
  Peer peer;
  Client client;
  auto options = to(peer);
  options.idleTimeout = std::chrono::milliseconds(200);
  client.connect(options);
  REQUIRE(eventually([&] { return client.isOpen(); }));

  client.socket->sendText("silence");

  REQUIRE(eventually([&] { return client.isClosed(); }));
  REQUIRE(client.closed->opened);
  REQUIRE(client.closed->code == 0);
}

TEST_CASE("nothing listening ends in a close, not a hang", "[link-socket]") {
  unsigned short port = 0;
  {
    Peer gone;
    port = static_cast<unsigned short>(std::stoi(
      gone.url().substr(std::string("ws://127.0.0.1:").size())));
  }
  Client client;
  LinkSocket::Options options;
  options.url = "ws://127.0.0.1:" + std::to_string(port) + "/join";

  client.connect(options);

  REQUIRE(eventually([&] { return client.isClosed(); }));
  REQUIRE_FALSE(client.closed->opened);
  REQUIRE(client.closed->httpStatus == 0);
}

TEST_CASE("an address that is not a websocket one ends in a close",
          "[link-socket]") {
  Client client;
  LinkSocket::Options options;
  options.url = "ftp://example.test/join";

  client.connect(options);

  REQUIRE(client.socket == nullptr);
  REQUIRE(eventually([&] { return client.isClosed(); }));
  REQUIRE_FALSE(client.closed->opened);
}

TEST_CASE("closing from this side tells nobody", "[link-socket]") {
  Peer peer;
  Client client;
  client.connect(to(peer));
  REQUIRE(eventually([&] { return client.isOpen(); }));

  client.socket->close();
  std::this_thread::sleep_for(std::chrono::milliseconds(200));

  REQUIRE_FALSE(client.isClosed());
}

TEST_CASE("over TLS it connects to a peer whose certificate it trusts",
          "[link-socket][tls]") {
  const auto certificate = makeCertificate();
  Peer peer(certificate);
  Client client;
  auto options = to(peer);
  options.trustedRootPem = certificate.certPem;

  client.connect(options);

  REQUIRE(eventually([&] { return client.isOpen(); }));
  REQUIRE(peer.lastAuthorization() == "Bearer good");

  client.socket->sendBinary(std::string("\x01\x02", 2));
  REQUIRE(eventually([&] { return client.count() == 1; }));
  REQUIRE(client.messages[0].second);
}

TEST_CASE("over TLS it does not connect to a peer it has no reason to trust",
          "[link-socket][tls]") {
  // The credential is sent after the handshake, so a peer that cannot prove
  // who it is never sees it.
  const auto certificate = makeCertificate();
  Peer peer(certificate);
  Client client;

  client.connect(to(peer));

  REQUIRE(eventually([&] { return client.isClosed(); }));
  REQUIRE_FALSE(client.closed->opened);
  REQUIRE(peer.lastAuthorization().empty());
}
