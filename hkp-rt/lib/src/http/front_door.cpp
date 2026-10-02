#include "./front_door.h"

#include <algorithm>
#include <array>
#include <cctype>
#include <functional>
#include <chrono>
#include <iostream>

#include <filesystem>
#include <fstream>

#include <openssl/evp.h>
#include <openssl/hmac.h>
#include <openssl/rand.h>

#ifndef _WIN32
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>
#endif

namespace hkp
{

namespace net = boost::asio;
using tcp = net::ip::tcp;

std::string loadOrCreateMountSecret(const std::string& file)
{
  {
    std::ifstream in(file);
    std::string held;
    if (in && std::getline(in, held) && !held.empty())
    {
      return held;
    }
  }
  unsigned char random[32];
  if (RAND_bytes(random, sizeof(random)) != 1)
  {
    return "";
  }
  static const char* hex = "0123456789abcdef";
  std::string secret;
  for (const unsigned char byte : random)
  {
    secret.push_back(hex[byte >> 4]);
    secret.push_back(hex[byte & 0x0f]);
  }
  std::error_code ec;
  const std::filesystem::path path(file);
  if (path.has_parent_path())
  {
    std::filesystem::create_directories(path.parent_path(), ec);
  }
#ifndef _WIN32
  const int fd = ::open(file.c_str(), O_WRONLY | O_CREAT | O_TRUNC, 0600);
  if (fd < 0)
  {
    return "";
  }
  ::fchmod(fd, 0600);
  const bool written =
    ::write(fd, secret.data(), secret.size()) == static_cast<ssize_t>(secret.size());
  ::close(fd);
  return written ? secret : "";
#else
  std::ofstream out(file, std::ios::trunc);
  out << secret;
  return out ? secret : "";
#endif
}

std::string deriveMountId(const std::string& secret, const std::string& tenant,
                          const std::string& boardName, const std::string& runtimeId,
                          const std::string& name)
{
  // NUL separates the parts, as it cannot occur in any of them.
  std::string message;
  for (const auto* part : {&tenant, &boardName, &runtimeId, &name})
  {
    if (part != &tenant)
    {
      message.push_back('\0');
    }
    message += *part;
  }
  unsigned char digest[EVP_MAX_MD_SIZE];
  unsigned int length = 0;
  HMAC(EVP_sha256(), secret.data(), static_cast<int>(secret.size()),
       reinterpret_cast<const unsigned char*>(message.data()), message.size(),
       digest, &length);
  static const char* hex = "0123456789abcdef";
  std::string id;
  for (unsigned int i = 0; i < length && id.size() < 32; ++i)
  {
    id.push_back(hex[digest[i] >> 4]);
    id.push_back(hex[digest[i] & 0x0f]);
  }
  return id;
}

namespace front_door
{

namespace {

std::string lower(std::string value)
{
  std::transform(value.begin(), value.end(), value.begin(),
                 [](unsigned char c) { return std::tolower(c); });
  return value;
}

const std::string kMountPrefix = std::string(MOUNT_PREFIX) + "/";

}

Head readHead(const std::string& bytes)
{
  Head head;
  const auto lineEnd = bytes.find("\r\n");
  if (lineEnd == std::string::npos)
  {
    return head;
  }
  const std::string line = bytes.substr(0, lineEnd);
  const auto firstSpace = line.find(' ');
  const auto lastSpace = line.rfind(' ');
  if (firstSpace == std::string::npos || lastSpace == firstSpace)
  {
    return head;
  }
  head.method = line.substr(0, firstSpace);
  head.target = line.substr(firstSpace + 1, lastSpace - firstSpace - 1);
  head.valid = !head.method.empty() && !head.target.empty();
  if (head.valid && head.target.compare(0, kMountPrefix.size(), kMountPrefix) == 0)
  {
    const auto idEnd = head.target.find_first_of("/?", kMountPrefix.size());
    head.mountId = head.target.substr(
      kMountPrefix.size(),
      idEnd == std::string::npos ? std::string::npos : idEnd - kMountPrefix.size());
  }
  return head;
}

std::string forMount(const std::string& bytes, const Head& head)
{
  const std::string prefix = kMountPrefix + head.mountId;
  std::string rest = head.target.substr(prefix.size());
  if (rest.empty() || rest[0] != '/')
  {
    rest = "/" + rest;
  }
  const auto targetStart = head.method.size() + 1;
  return bytes.substr(0, targetStart) + rest + bytes.substr(targetStart + head.target.size());
}

std::string forApi(const std::string& bytes, const std::string& frontSecret,
                   const std::string& clientAddress)
{
  const auto headEnd = bytes.find("\r\n\r\n");
  if (headEnd == std::string::npos)
  {
    return bytes;
  }
  const std::string frontName = lower(FrontDoor::FRONT_HEADER);
  const std::string clientName = lower(FrontDoor::CLIENT_HEADER);

  std::string out;
  bool upgrade = false;
  std::size_t position = 0;
  bool first = true;
  while (position < headEnd)
  {
    auto lineEnd = bytes.find("\r\n", position);
    if (lineEnd == std::string::npos || lineEnd > headEnd)
    {
      lineEnd = headEnd;
    }
    const std::string line = bytes.substr(position, lineEnd - position);
    position = lineEnd + 2;
    if (first)
    {
      out += line + "\r\n";
      first = false;
      continue;
    }
    const auto colon = line.find(':');
    const std::string name = lower(line.substr(0, colon));
    // Whatever a caller says of these two is not said by this process.
    if (name == frontName || name == clientName)
    {
      continue;
    }
    if (name == "connection")
    {
      if (lower(line).find("upgrade") != std::string::npos)
      {
        upgrade = true;
        out += line + "\r\n";
      }
      continue;
    }
    if (name == "keep-alive" || name == "proxy-connection")
    {
      continue;
    }
    out += line + "\r\n";
  }
  out += std::string(FrontDoor::FRONT_HEADER) + ": " + frontSecret + "\r\n";
  out += std::string(FrontDoor::CLIENT_HEADER) + ": " + clientAddress + "\r\n";
  if (!upgrade)
  {
    out += "Connection: close\r\n";
  }
  out += "\r\n";
  out += bytes.substr(headEnd + 4);
  return out;
}

}

namespace {

// The largest request head read before deciding whose connection it is.
constexpr std::size_t kMaxHeadBytes = 64 * 1024;
constexpr auto kHeadTimeout = std::chrono::seconds(15);

/** One connection: read its first request's head, then hand it on. */
class Arrival : public std::enable_shared_from_this<Arrival>
{
public:
  Arrival(FrontDoor& door, tcp::socket socket)
    : m_door(door)
    , m_client(std::move(socket))
    , m_upstream(m_client.get_executor())
    , m_deadline(m_client.get_executor())
  {
  }

  void start()
  {
    auto self = shared_from_this();
    m_deadline.expires_after(kHeadTimeout);
    m_deadline.async_wait([self](const boost::system::error_code& ec) {
      if (!ec && !self->m_decided)
      {
        // Still no head: not something to keep a socket open for.
        boost::system::error_code ignored;
        self->m_client.close(ignored);
      }
    });
    net::async_read_until(
      m_client, net::dynamic_buffer(m_head, kMaxHeadBytes), "\r\n\r\n",
      [self](const boost::system::error_code& ec, std::size_t) {
        self->m_decided = true;
        self->m_deadline.cancel();
        if (!ec)
        {
          self->decide();
        }
      });
  }

private:
  void decide()
  {
    const auto head = front_door::readHead(m_head);
    if (!head.valid)
    {
      return refuse("400 Bad Request");
    }
    if (!head.mountId.empty() ||
        head.target.rfind(std::string(MOUNT_PREFIX) + "/", 0) == 0)
    {
      auto adopter = m_door.find(head.mountId);
      if (!adopter)
      {
        // Unknown and unmounted answer the same: an id is not something to
        // confirm the existence of.
        return refuse("404 Not Found");
      }
      MountedConnection connection{
        std::move(m_client),
        front_door::forMount(m_head, head),
        std::string(MOUNT_PREFIX) + "/" + head.mountId,
      };
      try
      {
        adopter(std::move(connection));
      }
      catch (const std::exception& e)
      {
        std::cerr << "[mounts] a mount could not take its connection: " << e.what() << std::endl;
      }
      return;
    }
    passThrough();
  }

  void refuse(const std::string& status)
  {
    auto self = shared_from_this();
    auto response = std::make_shared<std::string>(
      "HTTP/1.1 " + status + "\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
    net::async_write(m_client, net::buffer(*response),
      [self, response](const boost::system::error_code&, std::size_t) {
        boost::system::error_code ignored;
        self->m_client.shutdown(tcp::socket::shutdown_both, ignored);
        self->m_client.close(ignored);
      });
  }

  void passThrough()
  {
    auto self = shared_from_this();
    boost::system::error_code ec;
    const auto remote = m_client.remote_endpoint(ec);
    const std::string address = ec ? std::string() : remote.address().to_string();
    m_forward = front_door::forApi(m_head, m_door.frontSecret(), address);
    m_upstream.async_connect(
      tcp::endpoint(net::ip::make_address("127.0.0.1"), m_door.upstreamPort()),
      [self](const boost::system::error_code& ec) {
        if (ec)
        {
          return self->refuse("502 Bad Gateway");
        }
        net::async_write(self->m_upstream, net::buffer(self->m_forward),
          [self](const boost::system::error_code& ec, std::size_t) {
            if (ec)
            {
              return self->close();
            }
            self->pump(self->m_client, self->m_upstream, self->m_toUpstream);
            self->pump(self->m_upstream, self->m_client, self->m_toClient);
          });
      });
  }

  /** Carries bytes one way until that way ends, then says so to the far side. */
  void pump(tcp::socket& from, tcp::socket& to, std::array<char, 16 * 1024>& buffer)
  {
    auto self = shared_from_this();
    from.async_read_some(net::buffer(buffer),
      [self, &from, &to, &buffer](const boost::system::error_code& ec, std::size_t read) {
        if (ec)
        {
          boost::system::error_code ignored;
          to.shutdown(tcp::socket::shutdown_send, ignored);
          if (++self->m_ended == 2)
          {
            self->close();
          }
          return;
        }
        net::async_write(to, net::buffer(buffer.data(), read),
          [self, &from, &to, &buffer](const boost::system::error_code& ec, std::size_t) {
            if (ec)
            {
              return self->close();
            }
            self->pump(from, to, buffer);
          });
      });
  }

  void close()
  {
    boost::system::error_code ignored;
    m_client.close(ignored);
    m_upstream.close(ignored);
  }

  FrontDoor& m_door;
  tcp::socket m_client;
  tcp::socket m_upstream;
  net::steady_timer m_deadline;
  std::string m_head;
  std::string m_forward;
  std::array<char, 16 * 1024> m_toUpstream;
  std::array<char, 16 * 1024> m_toClient;
  int m_ended = 0;
  bool m_decided = false;
};

}

FrontDoor::FrontDoor(std::string frontSecret) : m_frontSecret(std::move(frontSecret)) {}

FrontDoor::~FrontDoor()
{
  stop();
}

unsigned short FrontDoor::start(const std::string& bind, unsigned short port,
                                unsigned short upstreamPort)
{
  m_upstreamPort = upstreamPort;
  boost::system::error_code ec;
  const auto address = net::ip::make_address(bind, ec);
  if (ec)
  {
    std::cerr << "[mounts] not an address to listen on: " << bind << std::endl;
    return 0;
  }
  m_acceptor = std::make_unique<tcp::acceptor>(m_ioc);
  const tcp::endpoint endpoint(address, port);
  m_acceptor->open(endpoint.protocol(), ec);
  if (!ec) m_acceptor->set_option(net::socket_base::reuse_address(true), ec);
  if (!ec) m_acceptor->bind(endpoint, ec);
  if (!ec) m_acceptor->listen(net::socket_base::max_listen_connections, ec);
  if (ec)
  {
    std::cerr << "[mounts] could not listen on " << bind << ":" << port << ": "
              << ec.message() << std::endl;
    m_acceptor.reset();
    return 0;
  }
  const auto bound = m_acceptor->local_endpoint().port();
  m_work = std::make_unique<net::executor_work_guard<net::io_context::executor_type>>(
    net::make_work_guard(m_ioc));
  accept();
  m_thread = std::thread([this]() {
    try
    {
      m_ioc.run();
    }
    catch (const std::exception& e)
    {
      std::cerr << "[mounts] front door stopped: " << e.what() << std::endl;
    }
  });
  return bound;
}

void FrontDoor::accept()
{
  m_acceptor->async_accept([this](const boost::system::error_code& ec, tcp::socket socket) {
    if (ec)
    {
      return;
    }
    std::make_shared<Arrival>(*this, std::move(socket))->start();
    accept();
  });
}

void FrontDoor::stop()
{
  if (m_acceptor)
  {
    net::post(m_ioc, [this]() {
      boost::system::error_code ignored;
      m_acceptor->close(ignored);
    });
  }
  m_work.reset();
  m_ioc.stop();
  if (m_thread.joinable())
  {
    m_thread.join();
  }
  m_acceptor.reset();
}

void FrontDoor::mount(const std::string& mountId, MountAdopter adopter)
{
  std::lock_guard<std::mutex> lock(m_mutex);
  m_mounts[mountId] = std::move(adopter);
}

void FrontDoor::unmount(const std::string& mountId)
{
  std::lock_guard<std::mutex> lock(m_mutex);
  m_mounts.erase(mountId);
}

MountAdopter FrontDoor::find(const std::string& mountId)
{
  std::lock_guard<std::mutex> lock(m_mutex);
  const auto it = m_mounts.find(mountId);
  return it == m_mounts.end() ? MountAdopter() : it->second;
}

}
