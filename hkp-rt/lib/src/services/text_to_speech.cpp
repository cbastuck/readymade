#include "./text_to_speech.h"

#include <algorithm>
#include <atomic>
#include <chrono>
#include <iostream>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include <types/ringbuffer.h>

#include "./speech_http.h"
#include "./tts_inflect.h"

#ifdef HKP_SPEECH_ENABLED
  #include "sherpa-onnx/c-api/c-api.h"
#endif

namespace hkp {

namespace {

const std::string kDefaultServerUrl = "http://127.0.0.1:8081";
const std::string kDefaultModel = "tts-1";
const std::string kDefaultVoice = "af_heart";
constexpr double kDefaultSpeed = 1.0;
constexpr double kDefaultVariation = 0.667; // the inflect reference default
constexpr int kDefaultSampleRate = 24000; // Kokoro synthesizes at this rate
constexpr int kDefaultNumThreads = 2;
constexpr double kDefaultTimeoutSec = 120.0;

const std::string kBuildHint =
  "the local backend is not compiled in — rebuild hkp-rt with -DHKP_SPEECH_ENABLED=ON";

const std::string kInflectBuildHint =
  "the inflect backend is not compiled in — rebuild hkp-rt with -DHKP_INFLECT_ENABLED=ON";

// espeak-ng holds its configuration and working buffers in process globals, and
// both local engines phonemize through it — Kokoro by way of sherpa-onnx, the
// inflect backend directly. Two synthesis workers calling in at once corrupt
// that state, and the workers belong to different service instances, so the
// per-instance lock cannot see the collision. Serialize on one lock for the
// whole process.
//
// This orders the calls; it does not reconcile them. Whichever engine
// initialises espeak-ng first fixes the data directory for the process, so a
// build carrying both should point `dataDir` and `espeakDataPath` at the same
// espeak-ng-data.
std::mutex& espeakGlobalMutex()
{
  static std::mutex mutex;
  return mutex;
}

std::string serverHint(const std::string& serverUrl)
{
  return "no OpenAI-compatible speech server reachable at " + serverUrl +
         " — start one, or switch backend to \"local\"";
}

std::string trim(const std::string& s)
{
  auto begin = s.find_first_not_of(" \t\r\n");
  if (begin == std::string::npos)
  {
    return {};
  }
  auto end = s.find_last_not_of(" \t\r\n");
  return s.substr(begin, end - begin + 1);
}

// ── Local backend: in-process Kokoro via sherpa-onnx ─────────────────────────

#ifdef HKP_SPEECH_ENABLED

struct Synthesis
{
  std::vector<float> samples;
  int sampleRate = kDefaultSampleRate;
  std::string error;
};

// Lazy-loading wrapper around an in-process sherpa-onnx Kokoro TTS engine. Owns
// the local-backend model config and the loaded-engine cache, and reloads when
// any of the model parameters change.
class LocalKokoro
{
public:
  std::string modelPath;
  std::string voicesPath;
  std::string tokensPath;
  std::string dataDir;
  std::string lexicon;
  std::string dictDir;
  std::string lang;
  int numThreads = kDefaultNumThreads;

  ~LocalKokoro()
  {
    release();
  }

  void invalidateIfStale()
  {
    if (m_tts && m_loadedKey != key())
    {
      release();
    }
  }

  bool isLoaded() const
  {
    return m_tts != nullptr;
  }

  std::string ensure()
  {
    if (m_tts)
    {
      return {};
    }

    SherpaOnnxOfflineTtsConfig config;
    std::memset(&config, 0, sizeof(config));
    config.model.kokoro.model = modelPath.c_str();
    config.model.kokoro.voices = voicesPath.c_str();
    config.model.kokoro.tokens = tokensPath.c_str();
    config.model.kokoro.data_dir = dataDir.c_str();
    config.model.kokoro.length_scale = 1.0f; // speech rate comes from generation config
    config.model.kokoro.dict_dir = dictDir.c_str();
    config.model.kokoro.lexicon = lexicon.c_str();
    config.model.kokoro.lang = lang.c_str();
    config.model.num_threads = numThreads;
    config.model.provider = "cpu";
    config.model.debug = 0;
    config.max_num_sentences = 1;

    m_tts = SherpaOnnxCreateOfflineTts(&config);
    if (!m_tts)
    {
      return "failed to load the Kokoro model — check modelPath, voicesPath, tokensPath, dataDir";
    }
    m_sampleRate = SherpaOnnxOfflineTtsSampleRate(m_tts);
    m_numSpeakers.store(SherpaOnnxOfflineTtsNumSpeakers(m_tts), std::memory_order_relaxed);
    m_loadedKey = key();
    return {};
  }

  void release()
  {
    if (m_tts)
    {
      SherpaOnnxDestroyOfflineTts(m_tts);
      m_tts = nullptr;
    }
    m_numSpeakers.store(0, std::memory_order_relaxed);
    m_loadedKey.clear();
  }

  // Cached rather than read off the engine on demand: getState() runs on the
  // thread serving the request, and the engine pointer is only valid while
  // localMutex is held — which a worker holds for the whole of a synthesis.
  // Taking that lock here would stall a state read for seconds; an atomic
  // answers immediately and cannot observe a half-released engine.
  int numSpeakers() const
  {
    return m_numSpeakers.load(std::memory_order_relaxed);
  }

  Synthesis generate(const std::string& text, double speed, int speakerId)
  {
    Synthesis out;
    out.sampleRate = m_sampleRate;

    SherpaOnnxGenerationConfig gen;
    std::memset(&gen, 0, sizeof(gen));
    gen.speed = static_cast<float>(speed);
    gen.sid = speakerId;
    gen.silence_scale = 0.2f;

    const SherpaOnnxGeneratedAudio* audio =
      SherpaOnnxOfflineTtsGenerateWithConfig(m_tts, text.c_str(), &gen, nullptr, nullptr);
    if (!audio || audio->n <= 0 || !audio->samples)
    {
      out.error = "synthesis produced no audio";
      if (audio)
      {
        SherpaOnnxDestroyOfflineTtsGeneratedAudio(audio);
      }
      return out;
    }
    out.samples.assign(audio->samples, audio->samples + audio->n);
    out.sampleRate = audio->sample_rate;
    SherpaOnnxDestroyOfflineTtsGeneratedAudio(audio);
    return out;
  }

private:
  std::string key() const
  {
    return modelPath + "|" + voicesPath + "|" + tokensPath + "|" + dataDir + "|" +
           lexicon + "|" + dictDir + "|" + lang + "|" + std::to_string(numThreads);
  }

  const SherpaOnnxOfflineTts* m_tts = nullptr;
  int m_sampleRate = kDefaultSampleRate;
  std::atomic<int> m_numSpeakers{ 0 };
  std::string m_loadedKey;
};

#endif // HKP_SPEECH_ENABLED

// An immutable snapshot of everything one synthesis needs, taken on the pipeline
// thread before the work is handed to the worker. Only the local engine stays
// shared (guarded by localMutex).
struct TtsParams
{
  std::string backend;
  std::string serverUrl;
  std::string model;
  std::string voice;
  int speakerId = 0;
  double speed = kDefaultSpeed;
  double timeoutSec = kDefaultTimeoutSec;
  std::string text;
};

} // namespace

struct TextToSpeechImpl
{
  std::string backend = "local";
  std::string serverUrl = kDefaultServerUrl;
  std::string model = kDefaultModel;
  std::string voice = kDefaultVoice;
  int speakerId = 0;
  double speed = kDefaultSpeed;
  double timeoutSec = kDefaultTimeoutSec;
  std::string status = "idle";

  // Synthesis is long-running, so process() hands it to this worker instead of
  // blocking the pipeline thread (the App event loop / UI thread). `generating`
  // admits one at a time; `localMutex` guards the shared engine so configure()
  // never reloads it while the worker is synthesizing.
  std::atomic<bool> generating{ false };
  std::thread worker;
  std::mutex localMutex;

  // Local-backend config lives on LocalKokoro when it is compiled in, so that
  // the loaded-engine cache is invalidated in lockstep with the values.
#ifdef HKP_SPEECH_ENABLED
  LocalKokoro local;
#else
  std::string modelPath;
  std::string voicesPath;
  std::string tokensPath;
  std::string dataDir;
  std::string lexicon;
  std::string dictDir;
  std::string lang;
  int numThreads = kDefaultNumThreads;
#endif

  // Likewise for the inflect backend. Its config is separate rather than shared
  // with Kokoro's: the two describe different model layouts (one directory of
  // two graphs versus four independent file paths), so a board that names both
  // stays readable and switching backend does not silently reinterpret a path.
#ifdef HKP_INFLECT_ENABLED
  LocalInflect inflect;
#else
  std::string inflectModelDir;
  std::string inflectEspeakDataPath;
  int inflectNumThreads = 0;
  double inflectVariation = 0.667;
  long long inflectSeed = 0;
  bool inflectSplitOnAbbreviations = true;
#endif

  std::string& inflectModelDirRef() {
#ifdef HKP_INFLECT_ENABLED
    return inflect.modelDir;
#else
    return inflectModelDir;
#endif
  }
  std::string& inflectEspeakDataPathRef() {
#ifdef HKP_INFLECT_ENABLED
    return inflect.espeakDataPath;
#else
    return inflectEspeakDataPath;
#endif
  }
  int& inflectNumThreadsRef() {
#ifdef HKP_INFLECT_ENABLED
    return inflect.numThreads;
#else
    return inflectNumThreads;
#endif
  }
  double& inflectVariationRef() {
#ifdef HKP_INFLECT_ENABLED
    return inflect.variation;
#else
    return inflectVariation;
#endif
  }
  long long& inflectSeedRef() {
#ifdef HKP_INFLECT_ENABLED
    return inflect.seed;
#else
    return inflectSeed;
#endif
  }
  bool& inflectSplitOnAbbreviationsRef() {
#ifdef HKP_INFLECT_ENABLED
    return inflect.splitOnAbbreviations;
#else
    return inflectSplitOnAbbreviations;
#endif
  }

  std::string& modelPathRef()   {
#ifdef HKP_SPEECH_ENABLED
    return local.modelPath;
#else
    return modelPath;
#endif
  }
  std::string& voicesPathRef()  {
#ifdef HKP_SPEECH_ENABLED
    return local.voicesPath;
#else
    return voicesPath;
#endif
  }
  std::string& tokensPathRef()  {
#ifdef HKP_SPEECH_ENABLED
    return local.tokensPath;
#else
    return tokensPath;
#endif
  }
  std::string& dataDirRef()     {
#ifdef HKP_SPEECH_ENABLED
    return local.dataDir;
#else
    return dataDir;
#endif
  }
  std::string& lexiconRef()     {
#ifdef HKP_SPEECH_ENABLED
    return local.lexicon;
#else
    return lexicon;
#endif
  }
  std::string& dictDirRef()     {
#ifdef HKP_SPEECH_ENABLED
    return local.dictDir;
#else
    return dictDir;
#endif
  }
  std::string& langRef()        {
#ifdef HKP_SPEECH_ENABLED
    return local.lang;
#else
    return lang;
#endif
  }
  int& numThreadsRef()          {
#ifdef HKP_SPEECH_ENABLED
    return local.numThreads;
#else
    return numThreads;
#endif
  }

  // How many speakers the loaded Kokoro model offers, i.e. the range `speakerId`
  // may take. Zero until the model has been loaded, which happens lazily on the
  // first synthesis — and zero on a build without the local backend, or on the
  // inflect backend, whose model is single-speaker and has no speaker input.
  int numSpeakersValue() const {
#ifdef HKP_SPEECH_ENABLED
    return local.numSpeakers();
#else
    return 0;
#endif
  }
};

TextToSpeech::TextToSpeech(const std::string& instanceId)
  : Service(instanceId, serviceId())
  , m_impl(std::make_unique<TextToSpeechImpl>())
{
}

TextToSpeech::~TextToSpeech()
{
  // Backstop: the host calls shutdown() first (while it is still alive), so this
  // is normally a no-op. Still join here for a service destroyed on its own.
  if (m_impl && m_impl->worker.joinable())
  {
    m_impl->worker.join();
  }
}

void TextToSpeech::shutdown()
{
  // Join any in-flight synthesis so its emit() runs while the host is still
  // alive. Idempotent — the destructor's join then finds nothing to do.
  if (m_impl && m_impl->worker.joinable())
  {
    m_impl->worker.join();
  }
}

json TextToSpeech::configure(Data data)
{
  auto j = getJSONFromData(data);
  if (j)
  {
    if (j->contains("backend") && (*j)["backend"].is_string())
    {
      auto backend = (*j)["backend"].get<std::string>();
      if (backend == "server" || backend == "local" || backend == "inflect")
      {
        m_impl->backend = backend;
      }
    }
    if (j->contains("serverUrl") && (*j)["serverUrl"].is_string())
    {
      auto url = (*j)["serverUrl"].get<std::string>();
      while (!url.empty() && url.back() == '/')
      {
        url.pop_back();
      }
      if (!url.empty())
      {
        m_impl->serverUrl = url;
      }
    }
    updateIfNeeded(m_impl->model, (*j)["model"]);
    updateIfNeeded(m_impl->voice, (*j)["voice"]);
    updateIfNeeded(m_impl->speakerId, (*j)["speakerId"]);
    {
      // Mutate the engine's model paths/config and invalidate its cached engine
      // together, under the lock the worker holds while synthesizing, so a
      // reload can never race an in-flight synthesis (which would free the
      // engine out from under it). A configure() arriving mid-run blocks here
      // until it ends.
      std::lock_guard<std::mutex> lock(m_impl->localMutex);
      if (j->contains("modelPath") && (*j)["modelPath"].is_string())   { m_impl->modelPathRef()  = speech::expandUser((*j)["modelPath"].get<std::string>()); }
      if (j->contains("voicesPath") && (*j)["voicesPath"].is_string()) { m_impl->voicesPathRef() = speech::expandUser((*j)["voicesPath"].get<std::string>()); }
      if (j->contains("tokensPath") && (*j)["tokensPath"].is_string()) { m_impl->tokensPathRef() = speech::expandUser((*j)["tokensPath"].get<std::string>()); }
      if (j->contains("dataDir") && (*j)["dataDir"].is_string())       { m_impl->dataDirRef()    = speech::expandUser((*j)["dataDir"].get<std::string>()); }
      if (j->contains("lexicon") && (*j)["lexicon"].is_string())       { m_impl->lexiconRef()    = speech::expandUser((*j)["lexicon"].get<std::string>()); }
      if (j->contains("dictDir") && (*j)["dictDir"].is_string())       { m_impl->dictDirRef()    = speech::expandUser((*j)["dictDir"].get<std::string>()); }
      updateIfNeeded(m_impl->langRef(), (*j)["lang"]);
      updateIfNeeded(m_impl->numThreadsRef(), (*j)["numThreads"]);

      if (j->contains("modelDir") && (*j)["modelDir"].is_string())
      {
        m_impl->inflectModelDirRef() = speech::expandUser((*j)["modelDir"].get<std::string>());
      }
      if (j->contains("espeakDataPath") && (*j)["espeakDataPath"].is_string())
      {
        m_impl->inflectEspeakDataPathRef() = speech::expandUser((*j)["espeakDataPath"].get<std::string>());
      }
      updateIfNeeded(m_impl->inflectNumThreadsRef(), (*j)["inflectNumThreads"]);
      updateIfNeeded(m_impl->inflectSeedRef(), (*j)["seed"]);
      updateIfNeeded(m_impl->inflectSplitOnAbbreviationsRef(), (*j)["splitOnAbbreviations"]);
      if (j->contains("variation") && (*j)["variation"].is_number())
      {
        const double variation = (*j)["variation"].get<double>();
        if (variation >= 0.0 && variation <= 1.0)
        {
          m_impl->inflectVariationRef() = variation;
        }
      }
#ifdef HKP_SPEECH_ENABLED
      m_impl->local.invalidateIfStale();
#endif
#ifdef HKP_INFLECT_ENABLED
      m_impl->inflect.invalidateIfStale();
#endif
    }
    updateIfNeeded(m_impl->timeoutSec, (*j)["timeoutSec"]);
    if (j->contains("speed") && (*j)["speed"].is_number())
    {
      const double speed = (*j)["speed"].get<double>();
      if (speed >= 0.5 && speed <= 2.0)
      {
        m_impl->speed = speed;
      }
    }
  }
  return Service::configure(data);
}

std::string TextToSpeech::getServiceId() const
{
  return serviceId();
}

// Backend-specific settings are reported only when they can mean something:
// the selected backend's group always, another backend's group only once it
// holds a value someone chose. A board that has never used Kokoro therefore
// carries no Kokoro paths, and a board that has keeps them across a switch.
//
// The second half of that rule is what makes this safe. Board persistence
// replaces a service's stored state with whatever getState() returns
// (`state: config` in hkp-frontend/src/core/boardPersistence.ts), so a field
// dropped here is a field erased from the board on the next save. Reporting a
// configured-but-inactive group costs a few lines of JSON; omitting it would
// silently discard the model paths of whichever backend the board is not
// using at the moment it happens to be saved.
json TextToSpeech::getState() const
{
  json state{
    { "backend", m_impl->backend },
    { "speed", m_impl->speed },
    { "sampleRate", kDefaultSampleRate },
    { "status", m_impl->status }
  };

  const bool kokoroConfigured =
    !m_impl->modelPathRef().empty() || !m_impl->voicesPathRef().empty() ||
    !m_impl->tokensPathRef().empty() || !m_impl->dataDirRef().empty() ||
    !m_impl->lexiconRef().empty() || !m_impl->dictDirRef().empty() ||
    !m_impl->langRef().empty() || m_impl->numThreadsRef() != kDefaultNumThreads ||
    m_impl->speakerId != 0;

  if (m_impl->backend == "local" || kokoroConfigured)
  {
    state["modelPath"] = m_impl->modelPathRef();
    state["voicesPath"] = m_impl->voicesPathRef();
    state["tokensPath"] = m_impl->tokensPathRef();
    state["dataDir"] = m_impl->dataDirRef();
    state["lexicon"] = m_impl->lexiconRef();
    state["dictDir"] = m_impl->dictDirRef();
    state["lang"] = m_impl->langRef();
    state["numThreads"] = m_impl->numThreadsRef();
    state["speakerId"] = m_impl->speakerId;
    // Read-only: the range speakerId may take, 0 until the model lazy-loads.
    state["numSpeakers"] = m_impl->numSpeakersValue();
  }

  const bool inflectConfigured =
    !m_impl->inflectModelDirRef().empty() ||
    !m_impl->inflectEspeakDataPathRef().empty() ||
    m_impl->inflectNumThreadsRef() != 0 ||
    m_impl->inflectVariationRef() != kDefaultVariation ||
    m_impl->inflectSeedRef() != 0 ||
    !m_impl->inflectSplitOnAbbreviationsRef();

  if (m_impl->backend == "inflect" || inflectConfigured)
  {
    state["modelDir"] = m_impl->inflectModelDirRef();
    state["espeakDataPath"] = m_impl->inflectEspeakDataPathRef();
    state["inflectNumThreads"] = m_impl->inflectNumThreadsRef();
    state["variation"] = m_impl->inflectVariationRef();
    state["seed"] = m_impl->inflectSeedRef();
    state["splitOnAbbreviations"] = m_impl->inflectSplitOnAbbreviationsRef();
  }

  const bool serverConfigured =
    m_impl->serverUrl != kDefaultServerUrl || m_impl->model != kDefaultModel ||
    m_impl->voice != kDefaultVoice || m_impl->timeoutSec != kDefaultTimeoutSec;

  if (m_impl->backend == "server" || serverConfigured)
  {
    state["serverUrl"] = m_impl->serverUrl;
    state["model"] = m_impl->model;
    state["voice"] = m_impl->voice;
    state["timeoutSec"] = m_impl->timeoutSec;
  }

  return Service::mergeStateWith(state);
}

Data TextToSpeech::process(Data data)
{
  if (isNull(data) || isUndefined(data))
  {
    return Null();
  }

  // These close over `this` only, so a copy survives the return of process()
  // and can run on the worker thread. sendNotification marshals onto the App
  // event loop, so it is safe to call from there.
  auto setStatus = [this](const std::string& status, const std::string& detail = {})
  {
    m_impl->status = status;
    json payload = { { "status", status } };
    if (!detail.empty())
    {
      payload["detail"] = detail;
    }
    sendNotification(Data(payload));
  };

  auto fail = [this, setStatus](const std::string& message) -> Data
  {
    setStatus("error");
    json result = { { "error", message } };
    sendNotification(Data(result));
    return Data(result);
  };

  // ── Extract the text (cheap; stays on the pipeline thread) ──────────────────
  std::string text;
  if (auto str = getStringFromData(data); str)
  {
    text = *str;
  }
  else if (auto j = getJSONFromData(data); j && j->is_object())
  {
    for (const auto& key : { "text", "prompt" })
    {
      if (j->contains(key) && (*j)[key].is_string())
      {
        text = (*j)[key].get<std::string>();
        if (!text.empty())
        {
          break;
        }
      }
    }
  }
  text = trim(text);
  if (text.empty())
  {
    return fail("text-to-speech expects String input or JSON with 'text' or 'prompt'");
  }

  // Only one synthesis at a time: the local engine is not reentrant and the
  // server backend opens one connection. Reject an overlapping request.
  bool expected = false;
  if (!m_impl->generating.compare_exchange_strong(expected, true))
  {
    setStatus("error", "a synthesis is already in progress");
    // Defer rather than stop: the in-flight synthesis is still running and its
    // emit() will close this service's processing bracket.
    return deferCompletion();
  }

  TtsParams params;
  params.backend = m_impl->backend;
  params.serverUrl = m_impl->serverUrl;
  params.model = m_impl->model;
  params.voice = m_impl->voice;
  params.speakerId = m_impl->speakerId;
  params.speed = m_impl->speed;
  params.timeoutSec = m_impl->timeoutSec;
  params.text = std::move(text);

  // The synthesis below runs for seconds; doing it here would block the thread
  // that drives the pipeline (the App event loop / UI thread). Compute it in a
  // worker instead and emit() the audio when done, so the services after this
  // one run then (inversion of control).
  auto synthesize = [this, setStatus, fail, params]() -> Data
  {
    const auto started = std::chrono::steady_clock::now();
    std::vector<float> samples;
    int sampleRate = kDefaultSampleRate;

    if (params.backend == "local")
    {
#ifdef HKP_SPEECH_ENABLED
      // Held across ensure()+generate() so configure() cannot reload the engine
      // mid-synthesis (see configure()).
      std::unique_lock<std::mutex> lock(m_impl->localMutex);
      if (m_impl->local.modelPath.empty() || m_impl->local.voicesPath.empty() ||
          m_impl->local.tokensPath.empty())
      {
        return fail("local backend needs modelPath, voicesPath, and tokensPath (a sherpa Kokoro model)");
      }

      if (!m_impl->local.isLoaded())
      {
        setStatus("loading", "loading Kokoro model");
      }
      if (auto error = m_impl->local.ensure(); !error.empty())
      {
        return fail(error);
      }

      setStatus("generating");
      Synthesis synthesis;
      {
        // Kokoro phonemizes through espeak-ng's process globals.
        std::lock_guard<std::mutex> espeakLock(espeakGlobalMutex());
        synthesis = m_impl->local.generate(params.text, params.speed, params.speakerId);
      }
      lock.unlock();

      if (!synthesis.error.empty())
      {
        return fail("synthesis failed: " + synthesis.error);
      }
      samples = std::move(synthesis.samples);
      sampleRate = synthesis.sampleRate;
#else
      return fail(kBuildHint);
#endif
    }
    else if (params.backend == "inflect")
    {
#ifdef HKP_INFLECT_ENABLED
      // Held across ensure()+generate() for the same reason as the Kokoro
      // branch: configure() must not reload the engine mid-synthesis.
      std::unique_lock<std::mutex> lock(m_impl->localMutex);

      if (!m_impl->inflect.isLoaded())
      {
        setStatus("loading", "loading inflect model");
      }
      if (auto error = m_impl->inflect.ensure(); !error.empty())
      {
        return fail(error);
      }

      setStatus("generating");
      InflectSynthesis synthesis;
      {
        std::lock_guard<std::mutex> espeakLock(espeakGlobalMutex());
        synthesis = m_impl->inflect.generate(params.text, params.speed);
      }
      lock.unlock();

      if (!synthesis.error.empty())
      {
        return fail(synthesis.error);
      }
      samples = std::move(synthesis.samples);
      sampleRate = synthesis.sampleRate;
#else
      return fail(kInflectBuildHint);
#endif
    }
    else
    {
      setStatus("generating");
      json payload = {
        { "model", params.model },
        { "input", params.text },
        { "voice", params.voice },
        { "response_format", "wav" },
        { "speed", params.speed }
      };
      try
      {
        const auto timeout = std::chrono::milliseconds(
          static_cast<long long>(params.timeoutSec * 1000));
        auto response = speech::httpPost(
          params.serverUrl, "/v1/audio/speech",
          "application/json", "audio/wav", payload.dump(), timeout);

        if (response.status >= 400)
        {
          return fail("server returned HTTP " + std::to_string(response.status) + ": " +
                      response.body.substr(0, 200));
        }
        if (!speech::readWavPcm(response.body, samples, sampleRate))
        {
          return fail("server response was not a 16-bit PCM WAV (Content-Type: " +
                      response.contentType + ")");
        }
      }
      catch (const speech::ServerError& e)
      {
        return fail(e.what());
      }
      catch (const std::exception&)
      {
        return fail(serverHint(params.serverUrl));
      }
    }

    if (samples.empty())
    {
      return fail("synthesis produced no audio");
    }

    // ── Build the audio ───────────────────────────────────────────────────────
    // One FloatRingBuffer hop is capped at the runtime's fixed buffer size; keep
    // the head of a longer utterance and report the truncation.
    auto ring = std::make_shared<FloatRingBuffer>("text-to-speech");
    const size_t capacity = ring->getInternalBufferSize();
    const bool truncated = samples.size() > capacity;
    const size_t emitted = truncated ? capacity : samples.size();
    ring->appendBinary(reinterpret_cast<const char*>(samples.data()), emitted * sizeof(float));

    const auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
      std::chrono::steady_clock::now() - started).count();

    json meta = {
      { "backend", params.backend },
      { "voice", params.voice },
      { "sampleRate", sampleRate },
      { "samples", static_cast<uint64_t>(emitted) },
      { "audioMs", sampleRate > 0 ? static_cast<int>(static_cast<double>(emitted) / sampleRate * 1000.0) : 0 },
      { "generationMs", static_cast<int>(elapsed) }
    };
    if (truncated)
    {
      meta["truncated"] = static_cast<uint64_t>(samples.size() - capacity);
    }

    setStatus("idle");
    sendNotification(Data(meta));
    return Data(ring);
  };

  // Reap a previous finished-but-unjoined worker before launching the next; the
  // generating CAS above guarantees single ownership of the thread handle here.
  if (m_impl->worker.joinable())
  {
    m_impl->worker.join();
  }
  m_impl->worker = std::thread([this, synthesize]()
  {
    try
    {
      Data out = synthesize();
      if (!isNull(out))
      {
        emit(out);
      }
    }
    catch (const std::exception& e)
    {
      std::cerr << "text-to-speech worker failed: " << e.what() << std::endl;
    }
    m_impl->generating = false;
  });

  // Stop the synchronous push; the worker emit()s the audio when it is ready,
  // which also closes this service's processing bracket (deferCompletion tells
  // the runtime to withhold the immediate "call-process-finished").
  return deferCompletion();
}

}
