#pragma once

#include <algorithm>
#include <string>
#include <vector>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

#include "../sub_runtime.h"
#include "../uuid.h"

/**
 * Service Documentation
 * Service ID: tracks
 * Service Name: Tracks
 * Runtime: hkp-rt
 * Modes: serial | parallel
 * Key Config: tracks, reduce, run, bypass
 * IO: in=any -> out=what the reducer made of the tracks' answers
 * Arrays: the answers are a JSON array, one element per track, in declaration order
 * Binary: handed to every track untouched
 * MixedData: handed to every track untouched
 */
namespace hkp {

// Tracks — several pipelines over one input, and one answer out.
//
// Iterator runs one pipeline over many items; this is the other half of that
// pair. A board that has to do two unrelated things with the same value could
// always fake it by putting them in a row and teaching each to pass its input
// through — which works, and records nothing: not that they are siblings rather
// than a sequence, not in which order they may run, not which answer matters.
//
//     input ──┬── track ── answer ──┬── reduce ── output
//             ├── track ── answer ──┤
//             └── track ── answer ──┘
//
// Every track is given the same input and none can see another's answer.
//
// State shape:
//   {
//     "bypass": false,
//     "run": "serial",
//     "tracks": [ { "name": "keep", "bypass": false, "pipeline": [ … ] }, … ],
//     "reduce": [ … ]
//   }
//
// configure() takes the whole list, or scopes an edit to one pipeline by name —
// `{"track": "keep", "appendService": …}`, where the reserved name "reduce"
// reaches the reducer.
//
// **What a track answers with is collected as JSON.** A track answering with
// audio or raw bytes contributes null, exactly as one that stopped does: there
// is no Data type for a list of Data, and inventing one would be understood by
// nothing else on the board. A board fanning audio out therefore ends each
// track in what it feeds — a device, a window — and ignores the array, which is
// the shape such a board has anyway.
//
// `run` is recorded and honoured where a runtime can overlap work. This one
// processes synchronously, so tracks here always run one at a time. A board
// says the same thing in every runtime and gets the same answers; only the wall
// clock differs.
class Tracks : public Service
{
public:
  static std::string serviceId() { return "tracks"; }
  static std::vector<std::string> capabilities() { return {"subservices"}; }

  // The name the reducer answers to; a track may not take it.
  static const char* reduceName() { return "reduce"; }

  explicit Tracks(const std::string& instanceId)
    : Service(instanceId, "tracks")
  {}

  std::string getServiceId() const override { return serviceId(); }

  json configure(Data data) override
  {
    Service::configure(data); // handle bypass

    auto j = getJSONFromData(data);
    if (!j)
      return getState();

    // An edit naming a track is about one pipeline under this service rather
    // than about the service; without it there is no way to say which.
    if (j->contains("track") && (*j)["track"].is_string())
    {
      configureTrack((*j)["track"].get<std::string>(), *j);
      return getState();
    }

    if (j->contains("run") && (*j)["run"].is_string())
    {
      const auto run = (*j)["run"].get<std::string>();
      if (run == "serial" || run == "parallel")
        m_run = run;
    }

    if (j->contains("tracks") && (*j)["tracks"].is_array())
      setTracks((*j)["tracks"]);

    if (j->contains("reduce") && (*j)["reduce"].is_array())
    {
      m_reduceConfig.clear();
      for (const auto& cfg : (*j)["reduce"])
        m_reduceConfig.push_back(cfg);
      m_reduce = m_reduceConfig.empty() ? nullptr : createSubRuntime((*j)["reduce"]);
      adopt(m_reduce);
    }

    return getState();
  }

  json getState() const override
  {
    json tracks = json::array();
    for (const auto& track : m_tracks)
      tracks.push_back(json{
        {"name",     track.name},
        {"bypass",   track.bypass},
        {"pipeline", pipelineState(track.pipeline, track.config)}
      });

    return mergeStateWith({
      {"run",    m_run},
      {"tracks", tracks},
      {"reduce", pipelineState(m_reduce, m_reduceConfig)},
      {"error",  m_lastError}
    });
  }

  Data process(Data data) override
  {
    if (m_tracks.empty())
      return data;

    // One at a time, each finished before the next begins. See the note on
    // `run` above: this runtime has no way to overlap them.
    json results = json::array();
    for (auto& track : m_tracks)
      results.push_back(answerOf(track, data));

    if (!m_reduce || m_reduce->empty())
      return results;

    json envelope;
    envelope["input"] = asJson(data);
    envelope["results"] = results;
    return m_reduce->process(envelope);
  }

protected:
  bool supportsSubservices() const override { return true; }

  // The nested service a scoped address names, tracks first and in declaration
  // order, then the reducer. A name used in two tracks resolves to the earlier,
  // which is the cost of addressing a branch by what is in it rather than by
  // the branch's own name.
  std::shared_ptr<Service> findNested(const std::string& instanceId) const override
  {
    for (const auto& track : m_tracks)
    {
      if (!track.pipeline)
        continue;
      if (auto found = track.pipeline->find(instanceId))
        return found;
    }
    return m_reduce ? m_reduce->find(instanceId) : nullptr;
  }

private:
  // Lends a freshly built pipeline this service's cells and its name.
  //
  // The cells are owned here, like an endpoint's: the branches are pipelines
  // of one arrangement, so a value one leaves for another belongs to this
  // service rather than to the runtime around it — and two of these on a
  // runtime may both use a name without meeting.
  void adopt(const std::shared_ptr<SubRuntime>& pipeline)
  {
    if (!pipeline)
      return;
    pipeline->shareSlots(m_slots);
  }

  struct Track
  {
    std::string name;
    bool bypass = false;
    std::shared_ptr<SubRuntime> pipeline;
    std::vector<json> config;
  };

  // A track's answer, or null where it has none: it stopped, it was switched
  // off, or it answered with something JSON cannot hold.
  json answerOf(Track& track, Data data)
  {
    if (track.bypass || !track.pipeline || track.pipeline->empty())
      return nullptr;
    return asJson(track.pipeline->process(data));
  }

  static json asJson(const Data& data)
  {
    auto j = getJSONFromData(data);
    if (j)
      return *j;
    auto str = getStringFromData(data);
    if (str)
      return *str;
    return nullptr;
  }

  static json pipelineState(const std::shared_ptr<SubRuntime>& pipeline,
                            const std::vector<json>& config)
  {
    json state = json::array();
    if (pipeline)
    {
      for (auto it = pipeline->begin(); it != pipeline->end(); ++it)
      {
        const auto& svc = *it;
        state.push_back(json{
          {"serviceId",  svc->getServiceId()},
          {"instanceId", svc->getId()},
          {"state",      svc->getState()}
        });
      }
      return state;
    }
    for (const auto& cfg : config)
      state.push_back(cfg);
    return state;
  }

  void setTracks(const json& value)
  {
    std::vector<Track> next;
    for (size_t index = 0; index < value.size(); ++index)
    {
      const auto& entry = value[index];
      if (!entry.is_object())
      {
        m_lastError = "every track is an object with a name and a pipeline";
        return;
      }

      // A name is what a reducer, a log and a panel call this track. Unnamed,
      // it is called by the position it was declared in.
      std::string name = entry.value("name", std::string());
      if (name.empty())
        name = std::to_string(index);
      if (name == reduceName())
      {
        m_lastError = std::string("'") + reduceName() +
                      "' is the reducer's name and cannot be a track's";
        return;
      }
      if (std::any_of(next.begin(), next.end(),
                      [&name](const Track& t) { return t.name == name; }))
      {
        m_lastError = "two tracks are both called '" + name + "'";
        return;
      }

      Track track;
      track.name = name;
      track.bypass = entry.value("bypass", false);
      if (entry.contains("pipeline") && entry["pipeline"].is_array())
      {
        for (const auto& cfg : entry["pipeline"])
          track.config.push_back(cfg);
        track.pipeline = createSubRuntime(entry["pipeline"]);
        adopt(track.pipeline);
      }
      next.push_back(std::move(track));
    }

    m_lastError.clear();
    m_tracks = std::move(next);
  }

  // Applies a pipeline edit to one track, or to the reducer.
  void configureTrack(const std::string& name, const json& config)
  {
    if (name == reduceName())
    {
      if (config.contains("pipeline") && config["pipeline"].is_array())
      {
        m_reduceConfig.clear();
        for (const auto& cfg : config["pipeline"])
          m_reduceConfig.push_back(cfg);
        m_reduce = createSubRuntime(config["pipeline"]);
      }
      return;
    }

    auto it = std::find_if(m_tracks.begin(), m_tracks.end(),
                           [&name](const Track& t) { return t.name == name; });
    if (it == m_tracks.end())
    {
      m_lastError = "no track called '" + name + "'";
      return;
    }

    if (config.contains("bypass") && config["bypass"].is_boolean())
      it->bypass = config["bypass"].get<bool>();

    if (config.contains("pipeline") && config["pipeline"].is_array())
    {
      it->config.clear();
      for (const auto& cfg : config["pipeline"])
        it->config.push_back(cfg);
      it->pipeline = createSubRuntime(config["pipeline"]);
    }
    else if (config.contains("appendService") && config["appendService"].is_object())
    {
      auto svcCfg = config["appendService"];
      if (!svcCfg.contains("instanceId") ||
          svcCfg["instanceId"].get<std::string>().empty())
        svcCfg["instanceId"] = generateUUID();
      syncStates(*it);
      it->config.push_back(std::move(svcCfg));
      rebuild(*it);
    }
    else if (config.contains("removeService") && config["removeService"].is_string())
    {
      const std::string id = config["removeService"].get<std::string>();
      syncStates(*it);
      it->config.erase(
        std::remove_if(it->config.begin(), it->config.end(),
          [&id](const json& cfg) { return cfg.value("instanceId", "") == id; }),
        it->config.end());
      rebuild(*it);
    }
    else if (config.contains("configureService") && config["configureService"].is_object())
    {
      const auto& cfg = config["configureService"];
      if (cfg.contains("instanceId") && cfg.contains("state") && it->pipeline)
      {
        const std::string id = cfg["instanceId"].get<std::string>();
        for (auto svc = it->pipeline->begin(); svc != it->pipeline->end(); ++svc)
        {
          if ((*svc)->getId() == id)
          {
            (*svc)->configure(cfg["state"]);
            syncStates(*it);
            break;
          }
        }
      }
    }
  }

  // Flush live states back into the config before a rebuild, so a reconfigured
  // service inside a track does not lose its settings.
  static void syncStates(Track& track)
  {
    if (!track.pipeline)
      return;
    for (auto it = track.pipeline->begin(); it != track.pipeline->end(); ++it)
    {
      const auto& svc = *it;
      for (auto& cfg : track.config)
      {
        if (cfg.value("instanceId", "") == svc->getId())
        {
          cfg["state"] = svc->getState();
          break;
        }
      }
    }
  }

  void rebuild(Track& track)
  {
    json arr = json::array();
    for (const auto& cfg : track.config)
      arr.push_back(cfg);
    track.pipeline = createSubRuntime(arr);
    adopt(track.pipeline);
  }

  std::string                 m_run = "serial";
  std::vector<Track>          m_tracks;
  std::shared_ptr<SubRuntime> m_reduce;
  std::vector<json>           m_reduceConfig;
  std::string                 m_lastError;
  // See adopt(): the cells this service's pipelines share, private from the
  // runtime around them.
  SlotStore                   m_slots;
};

} // namespace hkp
