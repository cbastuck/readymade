#pragma once

#include <algorithm>
#include <atomic>
#include <chrono>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <thread>

#include <types/types.h>
#include <service.h>
#include <types/data.h>
#include <secrets.h>

#include "../runtime_host.h"
#include "./matrix_client.h"

/**
 * Service Documentation
 * Service ID: matrix-sender
 * Service Name: Matrix Sender
 * Runtime: hkp-rt
 * Modes: send (sink — sends each input as an m.room.message)
 * Key Config: homeserver, accessToken ({{secret.…}}), roomId, msgtype
 * IO: in=String | JSON { text, msgtype?, html?, roomId? } -> out=JSON { roomId, eventId, text }
 * Arrays: an array is sent as its JSON text
 * Binary: not sent (nothing passes on)
 * MixedData: not sent (nothing passes on)
 *
 * No end-to-end encryption: a message sent to an encrypted room is sent in
 * the clear, and the clients there show it as unencrypted.
 */
namespace hkp {

class MatrixSender : public Service
{
public:
  static std::string serviceId() { return "matrix-sender"; }

  explicit MatrixSender(const std::string& instanceId)
    : Service(instanceId, serviceId())
  {
  }

  // A send waiting on a homeserver that does not answer is let go, so the
  // runtime is not held up by it.
  void shutdown() override
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    m_shutdown = true;
    if (m_inFlight)
    {
      m_inFlight->cancel();
    }
  }

  json configure(Data data) override
  {
    auto j = getJSONFromData(data);
    if (j && j->is_object())
    {
      std::lock_guard<std::mutex> lock(m_mutex);
      if (updateIfNeeded(m_homeserver, (*j)["homeserver"]) |
          updateIfNeeded(m_accessToken, (*j)["accessToken"]))
      {
        // Aliases resolve per server; an account change keeps none of them.
        m_aliases.clear();
      }
      updateIfNeeded(m_roomId, (*j)["roomId"]);
      updateIfNeeded(m_msgtype, (*j)["msgtype"]);
    }
    return Service::configure(data);
  }

  std::string getServiceId() const override { return serviceId(); }

  json getState() const override
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    return Service::mergeStateWith({
      {"homeserver", m_homeserver},
      // A {{secret.…}} reference as written, never a value.
      {"accessToken", m_accessToken},
      {"roomId", m_roomId},
      {"msgtype", m_msgtype},
      {"lastEventId", m_lastEventId},
      {"error", m_error},
    });
  }

  Data process(Data data) override
  {
    if (isUndefined(data) || isNull(data))
    {
      return Null();
    }
    try
    {
      return send(data);
    }
    catch (const matrix::Cancelled&)
    {
      return Null();
    }
    catch (const std::exception& e)
    {
      report(std::string(), e.what());
      return Null();
    }
  }

private:
  Data send(const Data& data)
  {
    std::string homeserver, accessToken, configuredRoom, msgtype;
    {
      std::lock_guard<std::mutex> lock(m_mutex);
      homeserver = m_homeserver;
      accessToken = m_accessToken;
      configuredRoom = m_roomId;
      msgtype = m_msgtype;
    }

    const auto message = matrix::outgoingMessage(data, msgtype);
    if (!message)
    {
      // Nothing to say is not a failure: an empty line from a composer.
      return Null();
    }

    std::string problem;
    const auto server = matrix::parseHomeserver(homeserver, problem);
    if (!server)
    {
      throw std::runtime_error(problem);
    }
    if (accessToken.empty())
    {
      throw std::runtime_error("no access token configured");
    }
    // The token exists for the length of this send and nowhere else.
    const auto credential = resolveCredential(
      parentHost() ? &parentHost()->secrets() : nullptr, accessToken, homeserver);
    if (!credential.problem.empty())
    {
      throw std::runtime_error("access token: " + credential.problem);
    }
    const auto token = credential.value.is_string() ? credential.value.get<std::string>() : std::string();

    const auto room = message->roomId.empty() ? configuredRoom : message->roomId;
    if (room.empty())
    {
      throw std::runtime_error("no room configured");
    }

    auto connection = std::make_shared<matrix::Connection>();
    {
      std::lock_guard<std::mutex> lock(m_mutex);
      if (m_shutdown)
      {
        return Null();
      }
      m_inFlight = connection;
    }
    struct Release
    {
      MatrixSender& self;
      ~Release()
      {
        std::lock_guard<std::mutex> lock(self.m_mutex);
        self.m_inFlight.reset();
      }
    } release{*this};

    const auto roomId = resolveRoom(*connection, *server, room, token);

    // One id per message, kept across a retry: the homeserver treats a repeat
    // of the same transaction as the same message, so a retry never sends it
    // twice.
    const auto txnId = "hkp" + std::to_string(std::chrono::duration_cast<std::chrono::milliseconds>(
                                 std::chrono::system_clock::now().time_since_epoch()).count()) +
                       "." + std::to_string(++m_txnCounter);
    const auto target = matrix::sendTarget(*server, roomId, txnId);

    for (int attempt = 0;; ++attempt)
    {
      const auto response = connection->request(*server, "PUT", target, token, &message->content,
                                                std::chrono::milliseconds(30000));
      if (response.status == 200)
      {
        const auto eventId = response.body.is_object() ? response.body.value("event_id", std::string())
                                                       : std::string();
        report(eventId, std::string());
        return Data(json{{"roomId", roomId}, {"eventId", eventId}, {"text", message->content["body"]}});
      }
      if (response.status == 429 && attempt == 0)
      {
        // Waited out once, briefly: a sender that blocks its pipeline for as
        // long as a homeserver asks would hold up everything behind it.
        const auto wait = std::min(matrix::retryAfter(response, std::chrono::milliseconds(1000)),
                                   std::chrono::milliseconds(10000));
        std::this_thread::sleep_for(wait);
        continue;
      }
      throw std::runtime_error(matrix::describeError(response));
    }
  }

  std::string resolveRoom(matrix::Connection& connection, const matrix::Homeserver& server,
                          const std::string& room, const std::string& token)
  {
    if (!matrix::isRoomAlias(room))
    {
      return room;
    }
    {
      std::lock_guard<std::mutex> lock(m_mutex);
      const auto known = m_aliases.find(room);
      if (known != m_aliases.end())
      {
        return known->second;
      }
    }
    const auto response = connection.request(server, "GET", matrix::aliasTarget(server, room), token,
                                             nullptr, std::chrono::milliseconds(30000));
    const auto id = response.status == 200 && response.body.is_object()
                      ? response.body.value("room_id", std::string())
                      : std::string();
    if (id.empty())
    {
      throw std::runtime_error(room + ": " + matrix::describeError(response));
    }
    std::lock_guard<std::mutex> lock(m_mutex);
    m_aliases[room] = id;
    return id;
  }

  void report(const std::string& eventId, const std::string& error)
  {
    json changes;
    {
      std::lock_guard<std::mutex> lock(m_mutex);
      if (!eventId.empty())
      {
        m_lastEventId = eventId;
      }
      m_error = error;
      changes = json{{"lastEventId", m_lastEventId}, {"error", m_error}};
    }
    sendNotification(changes);
  }

  mutable std::mutex m_mutex;
  std::shared_ptr<matrix::Connection> m_inFlight;
  bool m_shutdown = false;
  std::atomic<unsigned long long> m_txnCounter{0};

  std::string m_homeserver;
  std::string m_accessToken;
  std::string m_roomId;
  std::string m_msgtype = "m.text";
  std::map<std::string, std::string> m_aliases;

  std::string m_lastEventId;
  std::string m_error;
};

} // namespace hkp
