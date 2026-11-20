#pragma once

#include <algorithm>
#include <chrono>
#include <condition_variable>
#include <iostream>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include <types/types.h>
#include <service.h>
#include <types/data.h>
#include <secrets.h>

#include "../runtime_host.h"
#include "./matrix_client.h"

/**
 * Service Documentation
 * Service ID: matrix-listener
 * Service Name: Matrix Listener
 * Runtime: hkp-rt
 * Modes: listen (source — long-polls a homeserver's /sync, pushes each message downstream)
 * Key Config: homeserver, accessToken ({{secret.…}}), rooms, includeOwn, running, since
 * IO: in=any (pass-through) -> out=JSON message pushed for each m.room.message
 * Arrays: pass-through
 * Binary: pass-through
 * MixedData: pass-through
 *
 * No end-to-end encryption: a room that sends encrypted events is reported in
 * `warning` and its messages are not passed on.
 */
namespace hkp {

class MatrixListener : public Service
{
public:
  static std::string serviceId() { return "matrix-listener"; }

  explicit MatrixListener(const std::string& instanceId)
    : Service(instanceId, serviceId())
  {
  }

  ~MatrixListener() { stopLoop(); }

  // The loop drives the pipeline, so it ends while the host is still whole.
  void shutdown() override { stopLoop(); }

  json configure(Data data) override
  {
    auto j = getJSONFromData(data);
    if (j && j->is_object())
    {
      bool reconnect = false;
      std::optional<bool> run;
      {
        std::lock_guard<std::mutex> lock(m_mutex);
        // Another server or another account: where the last one stopped means
        // nothing to this one, and neither does who it was.
        if (updateIfNeeded(m_homeserver, (*j)["homeserver"]) |
            updateIfNeeded(m_accessToken, (*j)["accessToken"]))
        {
          m_since.clear();
          m_userId.clear();
          reconnect = true;
        }
        if (j->contains("rooms") && (*j)["rooms"].is_array())
        {
          std::vector<std::string> rooms;
          for (const auto& room : (*j)["rooms"])
          {
            if (room.is_string() && !room.get<std::string>().empty())
            {
              rooms.push_back(room.get<std::string>());
            }
          }
          if (rooms != m_rooms)
          {
            m_rooms = rooms;
            reconnect = true;
          }
        }
        updateIfNeeded(m_includeOwn, (*j)["includeOwn"]);
        // A position can be handed over — or cleared, to start from now.
        if (j->contains("since") && (*j)["since"].is_string() &&
            (*j)["since"].get<std::string>() != m_since)
        {
          m_since = (*j)["since"].get<std::string>();
          reconnect = true;
        }
        if (j->contains("running") && (*j)["running"].is_boolean())
        {
          run = (*j)["running"].get<bool>();
          m_running = *run;
        }
      }

      if (run.has_value() && !*run)
      {
        stopLoop();
        setFlags(false, std::nullopt);
      }
      else if (m_running && !isBypass() && (run.has_value() || reconnect))
      {
        startLoop();
      }
      sendNotification(getState());
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
      {"rooms", m_rooms},
      {"includeOwn", m_includeOwn},
      {"running", m_running},
      {"since", m_since},
      {"connected", m_connected},
      {"userId", m_userId},
      {"error", m_error},
      {"warning", m_warning},
    });
  }

  // Messages are pushed by the loop; what arrives from upstream goes on as it is.
  Data process(Data data) override { return data; }

protected:
  bool onBypassChanged(bool bypass) override
  {
    if (bypass)
    {
      stopLoop();
      setFlags(false, std::nullopt);
    }
    else if (m_running)
    {
      startLoop();
    }
    return bypass;
  }

private:
  // ── Loop lifecycle ─────────────────────────────────────────────────────────

  void startLoop()
  {
    stopLoop();
    {
      std::lock_guard<std::mutex> lock(m_mutex);
      m_stopping = false;
      m_connection = std::make_shared<matrix::Connection>();
    }
    m_thread = std::thread([this]() { loop(); });
  }

  void stopLoop()
  {
    std::shared_ptr<matrix::Connection> connection;
    {
      std::lock_guard<std::mutex> lock(m_mutex);
      m_stopping = true;
      connection = m_connection;
    }
    m_wake.notify_all();
    if (connection)
    {
      connection->cancel();
    }
    if (m_thread.joinable())
    {
      m_thread.join();
    }
    std::lock_guard<std::mutex> lock(m_mutex);
    m_connection.reset();
  }

  // ── The loop (on m_thread) ─────────────────────────────────────────────────

  struct Settings
  {
    matrix::Homeserver server;
    std::string homeserverUrl;
    std::string accessToken;
    std::vector<std::string> rooms;
    bool includeOwn = false;
    std::string since;
    std::string userId;
  };

  // Refused for a reason waiting will not fix — a token the server does not
  // know. The loop ends and says why.
  struct Fatal : std::runtime_error
  {
    using std::runtime_error::runtime_error;
  };

  void loop()
  {
    auto connection = m_connection;
    auto backoff = std::chrono::milliseconds(2000);
    std::vector<std::string> roomIds;
    bool roomsResolved = false;

    while (true)
    {
      try
      {
        auto settings = snapshot();
        const auto token = credential(settings);

        if (settings.userId.empty())
        {
          const auto who = call(*connection, settings, matrix::whoamiTarget(settings.server), token);
          settings.userId = who.body.value("user_id", std::string());
          std::lock_guard<std::mutex> lock(m_mutex);
          m_userId = settings.userId;
        }

        if (!roomsResolved)
        {
          roomIds = resolveRooms(*connection, settings, token);
          roomsResolved = true;
        }

        const bool first = settings.since.empty();
        const auto target = matrix::syncTarget(settings.server, settings.since, roomIds, SYNC_TIMEOUT_MS);
        const auto response = connection->request(settings.server, "GET", target, token, nullptr,
                                                  std::chrono::milliseconds(SYNC_TIMEOUT_MS + 15000));
        if (response.status != 200)
        {
          syncRefused(response, settings);
          continue;
        }

        const auto sync = matrix::readSync(response.body, roomIds, settings.userId, settings.includeOwn);
        {
          std::lock_guard<std::mutex> lock(m_mutex);
          if (m_stopping)
          {
            return;
          }
          if (!sync.nextBatch.empty())
          {
            m_since = sync.nextBatch;
          }
        }
        setFlags(true, std::string());
        backoff = std::chrono::milliseconds(2000);
        reportEncrypted(sync.encryptedRooms);

        // The first sync is where the listener starts from, not something
        // that was said to it.
        if (!first)
        {
          for (const auto& message : sync.messages)
          {
            push(message);
          }
        }
      }
      catch (const matrix::Cancelled&)
      {
        return;
      }
      catch (const Fatal& e)
      {
        // Nothing will change until someone changes the configuration, so the
        // listener says it stopped rather than look like it is still trying.
        {
          std::lock_guard<std::mutex> lock(m_mutex);
          m_running = false;
        }
        sendNotification(json{{"running", false}});
        setFlags(false, std::string(e.what()));
        return;
      }
      catch (const std::exception& e)
      {
        setFlags(false, std::string(e.what()));
        if (!waitFor(backoff))
        {
          return;
        }
        backoff = std::min(backoff * 2, std::chrono::milliseconds(60000));
      }
    }
  }

  Settings snapshot()
  {
    std::lock_guard<std::mutex> lock(m_mutex);
    Settings settings;
    std::string problem;
    auto server = matrix::parseHomeserver(m_homeserver, problem);
    if (!server)
    {
      throw Fatal(problem);
    }
    settings.server = *server;
    settings.homeserverUrl = m_homeserver;
    settings.accessToken = m_accessToken;
    settings.rooms = m_rooms;
    settings.includeOwn = m_includeOwn;
    settings.since = m_since;
    settings.userId = m_userId;
    return settings;
  }

  // Resolved for each request and dropped after it: a vault that got its
  // value after the first attempt serves the next one, so a missing secret is
  // an error to retry rather than the end.
  std::string credential(const Settings& settings) const
  {
    if (settings.accessToken.empty())
    {
      throw Fatal("no access token configured");
    }
    const auto resolved = resolveCredential(
      parentHost() ? &parentHost()->secrets() : nullptr, settings.accessToken, settings.homeserverUrl);
    if (!resolved.problem.empty())
    {
      throw std::runtime_error("access token: " + resolved.problem);
    }
    return resolved.value.is_string() ? resolved.value.get<std::string>() : std::string();
  }

  // A GET that answers 200, waiting out rate limits on the way.
  matrix::Response call(matrix::Connection& connection, const Settings& settings,
                        const std::string& target, const std::string& token)
  {
    while (true)
    {
      auto response = connection.request(settings.server, "GET", target, token, nullptr,
                                         std::chrono::milliseconds(30000));
      if (response.status == 200)
      {
        return response;
      }
      if (response.status == 429)
      {
        if (!waitFor(matrix::retryAfter(response, std::chrono::milliseconds(5000))))
        {
          throw matrix::Cancelled();
        }
        continue;
      }
      if (response.status == 401 || response.status == 403 || response.status == 404)
      {
        throw Fatal(matrix::describeError(response));
      }
      throw std::runtime_error(matrix::describeError(response));
    }
  }

  std::vector<std::string> resolveRooms(matrix::Connection& connection, const Settings& settings,
                                        const std::string& token)
  {
    std::vector<std::string> ids;
    for (const auto& room : settings.rooms)
    {
      if (!matrix::isRoomAlias(room))
      {
        ids.push_back(room);
        continue;
      }
      const auto found = call(connection, settings, matrix::aliasTarget(settings.server, room), token);
      const auto id = found.body.value("room_id", std::string());
      if (id.empty())
      {
        throw Fatal("no room is called " + room);
      }
      ids.push_back(id);
    }
    return ids;
  }

  // What a refused sync means for the loop: wait as asked, start again from
  // now, or stop. Throws for everything but the first two.
  void syncRefused(const matrix::Response& response, const Settings& settings)
  {
    const auto problem = matrix::describeError(response);
    if (response.status == 401 || response.status == 403)
    {
      throw Fatal(problem);
    }
    if (response.status == 429)
    {
      if (!waitFor(matrix::retryAfter(response, std::chrono::milliseconds(5000))))
      {
        throw matrix::Cancelled();
      }
      return;
    }
    if (!settings.since.empty() && (response.status == 400 || response.status == 404))
    {
      // A position this server no longer knows — one saved with a board
      // that has since moved to another account. Starting from now loses
      // what was said in between, which is less than never starting.
      std::string warning;
      {
        std::lock_guard<std::mutex> lock(m_mutex);
        m_since.clear();
        m_warning = "the saved sync position was refused (" + problem + "); listening from now";
        warning = m_warning;
      }
      sendNotification(json{{"warning", warning}});
      return;
    }
    throw std::runtime_error(problem);
  }

  void reportEncrypted(const std::vector<std::string>& rooms)
  {
    if (rooms.empty())
    {
      return;
    }
    std::string warning;
    {
      std::lock_guard<std::mutex> lock(m_mutex);
      bool added = false;
      for (const auto& room : rooms)
      {
        if (std::find(m_encryptedRooms.begin(), m_encryptedRooms.end(), room) == m_encryptedRooms.end())
        {
          m_encryptedRooms.push_back(room);
          added = true;
        }
      }
      if (!added)
      {
        return;
      }
      std::string names;
      for (const auto& room : m_encryptedRooms)
      {
        names += names.empty() ? room : ", " + room;
      }
      m_warning = "end-to-end encrypted, so not read: " + names;
      warning = m_warning;
    }
    sendNotification(json{{"warning", warning}});
  }

  void push(const json& message)
  {
    // What the board shows as it arrives — a facade's message list reads it
    // from here — apart from what goes down the pipeline.
    sendNotification(json{{"received", message}});

    // Bracketed the way Timer brackets a tick: this service started the run.
    sendNotification(json{{"__internal", {{"state", "call-process"}, {"data", message}}}});
    try
    {
      nextAsync(Data(message));
    }
    catch (const std::exception& e)
    {
      std::cerr << "matrix-listener: " << e.what() << std::endl;
    }
    sendNotification(json{{"__internal", {{"state", "call-process-finished"}, {"data", message}}}});
  }

  // Waits, unless the loop is told to stop first. Answers whether to go on.
  bool waitFor(std::chrono::milliseconds duration)
  {
    std::unique_lock<std::mutex> lock(m_mutex);
    return !m_wake.wait_for(lock, duration, [this] { return m_stopping; });
  }

  // Says what changed and nothing else, so a healthy loop is quiet.
  void setFlags(bool connected, std::optional<std::string> error)
  {
    json changes = json::object();
    {
      std::lock_guard<std::mutex> lock(m_mutex);
      if (m_connected != connected)
      {
        m_connected = connected;
        changes["connected"] = connected;
      }
      if (error.has_value() && *error != m_error)
      {
        m_error = *error;
        changes["error"] = m_error;
      }
      if (connected && changes.contains("connected"))
      {
        changes["userId"] = m_userId;
        changes["warning"] = m_warning;
      }
    }
    if (!changes.empty())
    {
      sendNotification(changes);
    }
  }

  static constexpr int SYNC_TIMEOUT_MS = 30000;

  mutable std::mutex m_mutex;
  std::condition_variable m_wake;
  std::thread m_thread;
  std::shared_ptr<matrix::Connection> m_connection;
  bool m_stopping = false;

  // Configured
  std::string m_homeserver;
  std::string m_accessToken;
  std::vector<std::string> m_rooms;
  bool m_includeOwn = false;
  bool m_running = false;

  // Reported
  std::string m_since;
  std::string m_userId;
  bool m_connected = false;
  std::string m_error;
  std::string m_warning;
  std::vector<std::string> m_encryptedRooms;
};

} // namespace hkp
