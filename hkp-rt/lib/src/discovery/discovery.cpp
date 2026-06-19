#include "discovery.h"

#include <algorithm>
#include <chrono>
#include <cstring>
#include <iostream>

// mdns.h is a public-domain single-header mDNS/DNS-SD library (mjansson/mdns).
// It pulls in the platform socket headers (Winsock2 on Windows) itself.
#include <mdns.h>

#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#else
#include <arpa/inet.h>
#include <sys/select.h>
#include <unistd.h>
#endif

namespace hkp
{

namespace
{

constexpr const char* kServiceType = "_readymade._tcp.local.";

// DNS-SD instance labels are a single wire label; strip dots so mdns_string_make
// does not split the name into extra labels.
std::string sanitizeLabel(const std::string& in)
{
  std::string out = in.empty() ? std::string("Meander") : in;
  std::replace(out.begin(), out.end(), '.', '-');
  return out;
}

mdns_string_t toMdnsString(const std::string& s)
{
  return mdns_string_t{s.c_str(), s.size()};
}

std::string sockaddrToIp(const struct sockaddr* from)
{
  if (from && from->sa_family == AF_INET)
  {
    char buf[INET_ADDRSTRLEN] = {0};
    const auto* addr = reinterpret_cast<const struct sockaddr_in*>(from);
    if (inet_ntop(AF_INET, &addr->sin_addr, buf, sizeof(buf)))
    {
      return std::string(buf);
    }
  }
  return std::string();
}

// Records of one peer accumulated across the per-record callbacks of a packet.
struct PeerAccum
{
  std::string ip;
  unsigned int port = 0;
  bool sawSrv = false;
  std::map<std::string, std::string> txt;
};

struct ParseContext
{
  std::map<std::string, PeerAccum> byInstance; // keyed by service instance name
};

// Extracts the DNS name of the record currently being parsed.
std::string extractRecordName(const void* data, size_t size, size_t name_offset)
{
  char namebuf[256] = {0};
  size_t offset = name_offset;
  mdns_string_t name = mdns_string_extract(data, size, &offset, namebuf, sizeof(namebuf));
  return std::string(name.str, name.length);
}

bool isOurService(const std::string& name)
{
  // Every record name for our service ends with kServiceType
  // ("…_readymade._tcp.local."), so a single substring check covers PTR/SRV/TXT.
  return name.find(kServiceType) != std::string::npos;
}

int discoveryCallback(int /*sock*/, const struct sockaddr* from, size_t /*addrlen*/,
                      mdns_entry_type_t entry, uint16_t /*query_id*/, uint16_t rtype,
                      uint16_t /*rclass*/, uint32_t /*ttl*/, const void* data, size_t size,
                      size_t name_offset, size_t /*name_length*/, size_t record_offset,
                      size_t record_length, void* user_data)
{
  // We only care about announced answers, not questions.
  if (entry == MDNS_ENTRYTYPE_QUESTION)
  {
    return 0;
  }

  auto* ctx = static_cast<ParseContext*>(user_data);
  const std::string ip = sockaddrToIp(from);
  char strbuf[256] = {0};

  if (rtype == MDNS_RECORDTYPE_PTR)
  {
    mdns_string_t target =
        mdns_record_parse_ptr(data, size, record_offset, record_length, strbuf, sizeof(strbuf));
    std::string instance(target.str, target.length);
    if (!isOurService(instance))
    {
      return 0;
    }
    auto& acc = ctx->byInstance[instance];
    if (acc.ip.empty())
    {
      acc.ip = ip;
    }
  }
  else if (rtype == MDNS_RECORDTYPE_SRV)
  {
    std::string instance = extractRecordName(data, size, name_offset);
    if (!isOurService(instance))
    {
      return 0;
    }
    mdns_record_srv_t srv =
        mdns_record_parse_srv(data, size, record_offset, record_length, strbuf, sizeof(strbuf));
    auto& acc = ctx->byInstance[instance];
    acc.port = srv.port;
    acc.sawSrv = true;
    if (!ip.empty())
    {
      acc.ip = ip;
    }
  }
  else if (rtype == MDNS_RECORDTYPE_TXT)
  {
    std::string instance = extractRecordName(data, size, name_offset);
    if (!isOurService(instance))
    {
      return 0;
    }
    mdns_record_txt_t txt[16];
    size_t count =
        mdns_record_parse_txt(data, size, record_offset, record_length, txt,
                              sizeof(txt) / sizeof(mdns_record_txt_t));
    auto& acc = ctx->byInstance[instance];
    for (size_t i = 0; i < count; ++i)
    {
      acc.txt[std::string(txt[i].key.str, txt[i].key.length)] =
          std::string(txt[i].value.str, txt[i].value.length);
    }
    if (!ip.empty())
    {
      acc.ip = ip;
    }
  }

  return 0;
}

} // namespace

const char* discoveryPlatformName()
{
#if defined(IS_IOS)
  return "ios";
#elif defined(IS_MACOS)
  return "macos";
#elif defined(IS_WINDOWS)
  return "windows";
#elif defined(IS_LINUX)
  return "linux";
#else
  return "unknown";
#endif
}

std::string discoveryDeviceName()
{
#ifdef _WIN32
  char buf[256];
  DWORD size = sizeof(buf);
  if (GetComputerNameA(buf, &size) && size > 0)
  {
    return std::string(buf, size);
  }
  return "Meander";
#else
  char buf[256] = {0};
  if (gethostname(buf, sizeof(buf) - 1) == 0 && buf[0] != '\0')
  {
    std::string host(buf);
    // Use just the first label: "MacBookPro.fritz.box" -> "MacBookPro".
    const auto dot = host.find('.');
    if (dot != std::string::npos)
    {
      host.resize(dot);
    }
    return host.empty() ? std::string("Meander") : host;
  }
  return "Meander";
#endif
}

void to_json(nlohmann::json& j, const DiscoveredPeer& p)
{
  j = nlohmann::json{
      {"id", p.id},
      {"name", p.name},
      {"platform", p.platform},
      {"host", p.host},
      {"port", p.port},
      {"board", p.board},
  };
}

DiscoveryManager::DiscoveryManager() = default;

DiscoveryManager::~DiscoveryManager()
{
  stop();
}

void DiscoveryManager::start(const Identity& self, bool advertise, int durationSeconds)
{
  stop();

  {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_peers.clear();
  }

  m_stop.store(false);
  m_active.store(true);
  m_endsAtMs.store(
      std::chrono::duration_cast<std::chrono::milliseconds>(
          std::chrono::system_clock::now().time_since_epoch())
          .count() +
      static_cast<int64_t>(durationSeconds) * 1000);

  m_thread = std::thread(&DiscoveryManager::run, this, self, advertise, durationSeconds);
}

void DiscoveryManager::stop()
{
  m_stop.store(true);
  if (m_thread.joinable())
  {
    m_thread.join();
  }
  m_active.store(false);
  m_endsAtMs.store(0);
}

std::vector<DiscoveredPeer> DiscoveryManager::peers() const
{
  std::lock_guard<std::mutex> lock(m_mutex);
  std::vector<DiscoveredPeer> out;
  out.reserve(m_peers.size());
  for (const auto& [id, peer] : m_peers)
  {
    out.push_back(peer);
  }
  return out;
}

void DiscoveryManager::run(Identity self, bool advertise, int durationSeconds)
{

#ifdef _WIN32
  WSADATA wsa;
  bool wsaInit = (WSAStartup(MAKEWORD(2, 2), &wsa) == 0);
#endif

  struct sockaddr_in bindAddr;
  std::memset(&bindAddr, 0, sizeof(bindAddr));
  bindAddr.sin_family = AF_INET;
  bindAddr.sin_addr.s_addr = INADDR_ANY;
  bindAddr.sin_port = htons(MDNS_PORT);
#ifdef __APPLE__
  bindAddr.sin_len = sizeof(bindAddr);
#endif

  int sock = mdns_socket_open_ipv4(&bindAddr);
  if (sock < 0)
  {
    std::cerr << "DiscoveryManager: failed to open mDNS socket" << std::endl;
    m_active.store(false);
#ifdef _WIN32
    if (wsaInit) { WSACleanup(); }
#endif
    return;
  }

  // Persistent strings backing the announce records (mdns_string_t holds borrowed
  // pointers, so these must outlive every announce call below).
  const std::string serviceType = kServiceType;
  const std::string label = sanitizeLabel(self.name) + "-" + self.id.substr(0, 8);
  const std::string instanceName = label + "." + serviceType;
  const std::string hostName = "hkp-" + self.id.substr(0, 8) + ".local.";

  std::vector<std::pair<std::string, std::string>> txtPairs = {
      {"id", self.id},
      {"name", self.name},
      {"platform", self.platform.empty() ? discoveryPlatformName() : self.platform},
  };
  if (!self.board.empty())
  {
    txtPairs.emplace_back("board", self.board);
  }

  mdns_record_t ptrRecord{};
  ptrRecord.name = toMdnsString(serviceType);
  ptrRecord.type = MDNS_RECORDTYPE_PTR;
  ptrRecord.data.ptr.name = toMdnsString(instanceName);
  ptrRecord.rclass = MDNS_CLASS_IN;
  ptrRecord.ttl = 60;

  std::vector<mdns_record_t> additional;
  mdns_record_t srvRecord{};
  srvRecord.name = toMdnsString(instanceName);
  srvRecord.type = MDNS_RECORDTYPE_SRV;
  srvRecord.data.srv.priority = 0;
  srvRecord.data.srv.weight = 0;
  srvRecord.data.srv.port = static_cast<uint16_t>(self.port);
  srvRecord.data.srv.name = toMdnsString(hostName);
  srvRecord.rclass = MDNS_CLASS_IN;
  srvRecord.ttl = 60;
  additional.push_back(srvRecord);

  for (const auto& [key, value] : txtPairs)
  {
    mdns_record_t txtRecord{};
    txtRecord.name = toMdnsString(instanceName);
    txtRecord.type = MDNS_RECORDTYPE_TXT;
    txtRecord.data.txt.key = toMdnsString(key);
    txtRecord.data.txt.value = toMdnsString(value);
    txtRecord.rclass = MDNS_CLASS_IN;
    txtRecord.ttl = 60;
    additional.push_back(txtRecord);
  }

  // 32-bit aligned packet buffer required by the library.
  uint32_t buffer[512];

  const auto deadline =
      std::chrono::steady_clock::now() + std::chrono::seconds(durationSeconds);
  // Far enough in the past to announce immediately, without the overflow that
  // time_point::min() would cause when subtracted from now().
  auto lastAnnounce = std::chrono::steady_clock::now() - std::chrono::hours(1);

  while (!m_stop.load() && std::chrono::steady_clock::now() < deadline)
  {
    const auto now = std::chrono::steady_clock::now();
    if (advertise && self.port > 0 &&
        now - lastAnnounce >= std::chrono::seconds(2))
    {
      mdns_announce_multicast(sock, buffer, sizeof(buffer), ptrRecord, nullptr, 0,
                              additional.data(), additional.size());
      lastAnnounce = now;
    }

    fd_set readfds;
    FD_ZERO(&readfds);
    FD_SET(sock, &readfds);
    struct timeval timeout;
    timeout.tv_sec = 0;
    timeout.tv_usec = 250000; // 250 ms

    int ready = select(sock + 1, &readfds, nullptr, nullptr, &timeout);
    if (ready > 0 && FD_ISSET(sock, &readfds))
    {
      ParseContext ctx;
      mdns_socket_listen(sock, buffer, sizeof(buffer), discoveryCallback, &ctx);

      std::lock_guard<std::mutex> lock(m_mutex);
      for (const auto& [instance, acc] : ctx.byInstance)
      {
        const auto idIt = acc.txt.find("id");
        if (!acc.sawSrv || acc.port == 0 || idIt == acc.txt.end())
        {
          continue; // incomplete record set; wait for the next announcement
        }
        const std::string& peerId = idIt->second;
        if (peerId == self.id)
        {
          continue; // never list ourselves
        }
        DiscoveredPeer peer;
        peer.id = peerId;
        peer.host = acc.ip;
        peer.port = acc.port;
        const auto nameIt = acc.txt.find("name");
        peer.name = nameIt != acc.txt.end() ? nameIt->second : peerId;
        const auto platIt = acc.txt.find("platform");
        peer.platform = platIt != acc.txt.end() ? platIt->second : "";
        const auto boardIt = acc.txt.find("board");
        peer.board = boardIt != acc.txt.end() ? boardIt->second : "";
        m_peers[peerId] = peer;
      }
    }
  }

  if (advertise && self.port > 0)
  {
    mdns_goodbye_multicast(sock, buffer, sizeof(buffer), ptrRecord, nullptr, 0,
                           additional.data(), additional.size());
  }

  mdns_socket_close(sock);
  m_active.store(false);
  m_endsAtMs.store(0);
#ifdef _WIN32
  if (wsaInit) { WSACleanup(); }
#endif
}

}
