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
#include <iphlpapi.h>
#else
#include <arpa/inet.h>
#include <sys/select.h>
#include <unistd.h>
#include <ifaddrs.h>
#include <net/if.h>
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

// Collects the IPv4 address of each usable (up, non-loopback) network interface.
// Used to join the multicast group on every interface and to send announcements
// out each interface — so discovery is not at the mercy of which interface the
// OS picks by default (critical on Windows with Hyper-V/WSL/VPN adapters).
std::vector<in_addr> collectInterfaceAddrs()
{
  std::vector<in_addr> addrs;

#ifdef _WIN32
  ULONG bufLen = 16 * 1024;
  std::vector<char> buffer(bufLen);
  auto* adapters = reinterpret_cast<IP_ADAPTER_ADDRESSES*>(buffer.data());
  ULONG flags = GAA_FLAG_SKIP_ANYCAST | GAA_FLAG_SKIP_MULTICAST | GAA_FLAG_SKIP_DNS_SERVER;
  ULONG ret = GetAdaptersAddresses(AF_INET, flags, nullptr, adapters, &bufLen);
  if (ret == ERROR_BUFFER_OVERFLOW)
  {
    buffer.resize(bufLen);
    adapters = reinterpret_cast<IP_ADAPTER_ADDRESSES*>(buffer.data());
    ret = GetAdaptersAddresses(AF_INET, flags, nullptr, adapters, &bufLen);
  }
  if (ret == NO_ERROR)
  {
    for (auto* adapter = adapters; adapter; adapter = adapter->Next)
    {
      if (adapter->OperStatus != IfOperStatusUp ||
          adapter->IfType == IF_TYPE_SOFTWARE_LOOPBACK)
      {
        continue;
      }
      for (auto* ua = adapter->FirstUnicastAddress; ua; ua = ua->Next)
      {
        if (ua->Address.lpSockaddr->sa_family != AF_INET)
        {
          continue;
        }
        addrs.push_back(reinterpret_cast<sockaddr_in*>(ua->Address.lpSockaddr)->sin_addr);
      }
    }
  }
#else
  struct ifaddrs* ifaddr = nullptr;
  if (getifaddrs(&ifaddr) == 0)
  {
    for (auto* ifa = ifaddr; ifa; ifa = ifa->ifa_next)
    {
      if (!ifa->ifa_addr || ifa->ifa_addr->sa_family != AF_INET)
      {
        continue;
      }
      if (!(ifa->ifa_flags & IFF_UP) || (ifa->ifa_flags & IFF_LOOPBACK))
      {
        continue;
      }
      addrs.push_back(reinterpret_cast<sockaddr_in*>(ifa->ifa_addr)->sin_addr);
    }
    freeifaddrs(ifaddr);
  }
#endif

  return addrs;
}

// 224.0.0.251 in network byte order.
inline uint32_t mdnsMulticastAddr()
{
  return htonl((((uint32_t)224U) << 24U) | ((uint32_t)251U));
}

// Sends the announcement (or goodbye) out every interface by switching the
// outgoing multicast interface (IP_MULTICAST_IF) before each send. Falls back to
// a single default-interface send when no interfaces were enumerated.
void announceOnAllInterfaces(int sock, const std::vector<in_addr>& ifaceAddrs,
                             void* buffer, size_t capacity, mdns_record_t answer,
                             const std::vector<mdns_record_t>& additional, bool goodbye)
{
  auto sendOnce = [&]()
  {
    if (goodbye)
    {
      mdns_goodbye_multicast(sock, buffer, capacity, answer, nullptr, 0,
                             additional.data(), additional.size());
    }
    else
    {
      mdns_announce_multicast(sock, buffer, capacity, answer, nullptr, 0,
                              additional.data(), additional.size());
    }
  };

  if (ifaceAddrs.empty())
  {
    sendOnce();
    return;
  }
  for (const auto& ifaddr : ifaceAddrs)
  {
    setsockopt(sock, IPPROTO_IP, IP_MULTICAST_IF,
               reinterpret_cast<const char*>(&ifaddr), sizeof(ifaddr));
    sendOnce();
  }
}

// Sends a multicast PTR query for our service out every interface, soliciting
// (unicast) responses from peers. Active querying is what makes discovery
// reliable over Wi-Fi power-save.
void queryOnAllInterfaces(int sock, const std::vector<in_addr>& ifaceAddrs, void* buffer,
                          size_t capacity, const std::string& serviceType)
{
  auto sendOnce = [&]()
  {
    mdns_query_send(sock, MDNS_RECORDTYPE_PTR, serviceType.c_str(), serviceType.size(),
                    buffer, capacity, 0);
  };

  if (ifaceAddrs.empty())
  {
    sendOnce();
    return;
  }
  for (const auto& ifaddr : ifaceAddrs)
  {
    setsockopt(sock, IPPROTO_IP, IP_MULTICAST_IF,
               reinterpret_cast<const char*>(&ifaddr), sizeof(ifaddr));
    sendOnce();
  }
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

  // Materials for answering incoming queries via unicast (set when advertising).
  // A separate buffer is required because the receive buffer still holds the
  // query packet being parsed while the callback builds the answer.
  bool canRespond = false;
  void* respondBuffer = nullptr;
  size_t respondCapacity = 0;
  const std::string* serviceType = nullptr;
  const mdns_record_t* answer = nullptr;            // our PTR record
  const std::vector<mdns_record_t>* additional = nullptr; // SRV + TXT
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

int discoveryCallback(int sock, const struct sockaddr* from, size_t addrlen,
                      mdns_entry_type_t entry, uint16_t query_id, uint16_t rtype,
                      uint16_t /*rclass*/, uint32_t /*ttl*/, const void* data, size_t size,
                      size_t name_offset, size_t /*name_length*/, size_t record_offset,
                      size_t record_length, void* user_data)
{
  auto* ctx = static_cast<ParseContext*>(user_data);

  // Answer incoming queries for our service via UNICAST. Unicast is reliably
  // delivered even to a Wi-Fi client in power-save (unlike multicast), so the
  // asker — which is actively querying — gets a dependable response.
  if (entry == MDNS_ENTRYTYPE_QUESTION)
  {
    if (ctx->canRespond && (rtype == MDNS_RECORDTYPE_PTR || rtype == MDNS_RECORDTYPE_ANY))
    {
      const std::string qname = extractRecordName(data, size, name_offset);
      if (isOurService(qname))
      {
        mdns_query_answer_unicast(
            sock, from, addrlen, ctx->respondBuffer, ctx->respondCapacity, query_id,
            MDNS_RECORDTYPE_PTR, ctx->serviceType->c_str(), ctx->serviceType->size(),
            *ctx->answer, nullptr, 0, ctx->additional->data(), ctx->additional->size());
      }
    }
    return 0;
  }

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

  // One socket bound to INADDR_ANY:5353. Binding to INADDR_ANY (rather than a
  // specific interface address) is required to receive multicast on Windows.
  // NB: must pass an explicit address with port MDNS_PORT — a null saddr binds
  // an ephemeral port (the library's one-shot query mode) and would never
  // receive announcements.
  // Responder/announcer socket bound to INADDR_ANY:5353: receives multicast
  // announces + incoming queries, and sends our announces + unicast answers.
  // INADDR_ANY (not a specific interface addr) is required to receive multicast
  // on Windows. NB: must pass an explicit MDNS_PORT — a null saddr binds an
  // ephemeral port. This socket can be starved on Windows when another process
  // (Bonjour / native mDNS) owns 5353; the separate query socket below makes
  // browsing work regardless.
  struct sockaddr_in bindAddr;
  std::memset(&bindAddr, 0, sizeof(bindAddr));
  bindAddr.sin_family = AF_INET;
  bindAddr.sin_addr.s_addr = INADDR_ANY;
  bindAddr.sin_port = htons(MDNS_PORT);
#ifdef __APPLE__
  bindAddr.sin_len = sizeof(bindAddr);
#endif
  int recvSock = mdns_socket_open_ipv4(&bindAddr);

  // Browse socket on an ephemeral port (null saddr). Queries are sent from here
  // and peers reply via UNICAST to this private port — so discovering peers does
  // NOT depend on owning 5353 (which another mDNS daemon may hold on Windows).
  int querySock = mdns_socket_open_ipv4(nullptr);

  if (recvSock < 0 && querySock < 0)
  {
    std::cerr << "DiscoveryManager: failed to open any mDNS socket" << std::endl;
    m_active.store(false);
#ifdef _WIN32
    if (wsaInit) { WSACleanup(); }
#endif
    return;
  }

  // Join the multicast group on every interface so the responder socket receives
  // announcements/queries regardless of which adapter they arrive on (an
  // INADDR_ANY bind alone joins only the default interface). Errors (e.g.
  // already-joined) are ignored.
  const std::vector<in_addr> ifaceAddrs = collectInterfaceAddrs();
  if (recvSock >= 0)
  {
    for (const auto& ifaddr : ifaceAddrs)
    {
      struct ip_mreq req;
      std::memset(&req, 0, sizeof(req));
      req.imr_multiaddr.s_addr = mdnsMulticastAddr();
      req.imr_interface = ifaddr;
      setsockopt(recvSock, IPPROTO_IP, IP_ADD_MEMBERSHIP,
                 reinterpret_cast<const char*>(&req), sizeof(req));
    }
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

  // 32-bit aligned packet buffers required by the library. A second buffer is
  // needed for unicast answers, since the receive buffer still holds the query
  // being parsed when we build the answer inside the callback.
  uint32_t buffer[512];
  uint32_t respondBuffer[512];

  const auto deadline =
      std::chrono::steady_clock::now() + std::chrono::seconds(durationSeconds);
  // Far enough in the past to broadcast immediately, without the overflow that
  // time_point::min() would cause when subtracted from now().
  auto lastBroadcast = std::chrono::steady_clock::now() - std::chrono::hours(1);

  while (!m_stop.load() && std::chrono::steady_clock::now() < deadline)
  {
    const auto now = std::chrono::steady_clock::now();
    if (now - lastBroadcast >= std::chrono::seconds(2))
    {
      // Unsolicited multicast announce on the responder socket (helps passive
      // listeners + lets others find us), plus an active query from the browse
      // socket (solicits reliable unicast answers — robust over Wi-Fi power-save
      // and independent of who owns 5353).
      if (advertise && self.port > 0 && recvSock >= 0)
      {
        announceOnAllInterfaces(recvSock, ifaceAddrs, buffer, sizeof(buffer), ptrRecord,
                                additional, /*goodbye=*/false);
      }
      queryOnAllInterfaces(querySock >= 0 ? querySock : recvSock, ifaceAddrs, buffer,
                           sizeof(buffer), serviceType);
      lastBroadcast = now;
    }

    fd_set readfds;
    FD_ZERO(&readfds);
    int maxfd = 0;
    if (recvSock >= 0)
    {
      FD_SET(recvSock, &readfds);
      maxfd = std::max(maxfd, recvSock);
    }
    if (querySock >= 0)
    {
      FD_SET(querySock, &readfds);
      maxfd = std::max(maxfd, querySock);
    }
    struct timeval timeout;
    timeout.tv_sec = 0;
    timeout.tv_usec = 250000; // 250 ms

    int ready = select(maxfd + 1, &readfds, nullptr, nullptr, &timeout);
    if (ready > 0)
    {
      ParseContext ctx;
      ctx.canRespond = advertise && self.port > 0;
      ctx.respondBuffer = respondBuffer;
      ctx.respondCapacity = sizeof(respondBuffer);
      ctx.serviceType = &serviceType;
      ctx.answer = &ptrRecord;
      ctx.additional = &additional;
      // Answers (multicast announces + unicast query replies) arrive on either
      // socket; questions to answer arrive on the responder socket.
      if (recvSock >= 0 && FD_ISSET(recvSock, &readfds))
      {
        mdns_socket_listen(recvSock, buffer, sizeof(buffer), discoveryCallback, &ctx);
      }
      if (querySock >= 0 && FD_ISSET(querySock, &readfds))
      {
        mdns_socket_listen(querySock, buffer, sizeof(buffer), discoveryCallback, &ctx);
      }

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

  if (advertise && self.port > 0 && recvSock >= 0)
  {
    announceOnAllInterfaces(recvSock, ifaceAddrs, buffer, sizeof(buffer), ptrRecord,
                            additional, /*goodbye=*/true);
  }
  if (recvSock >= 0)
  {
    mdns_socket_close(recvSock);
  }
  if (querySock >= 0)
  {
    mdns_socket_close(querySock);
  }
  m_active.store(false);
  m_endsAtMs.store(0);
#ifdef _WIN32
  if (wsaInit) { WSACleanup(); }
#endif
}

}
