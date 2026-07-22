#include "./text_to_speech.h"

#include <algorithm>
#include <chrono>
#include <string>
#include <vector>

#include <types/ringbuffer.h>

#include "./speech_http.h"

#ifdef HKP_SPEECH_ENABLED
  #include "sherpa-onnx/c-api/c-api.h"
#endif

namespace hkp {

namespace {

const std::string kDefaultServerUrl = "http://127.0.0.1:8081";
const std::string kDefaultModel = "tts-1";
const std::string kDefaultVoice = "af_heart";
constexpr double kDefaultSpeed = 1.0;
constexpr int kDefaultSampleRate = 24000; // Kokoro synthesizes at this rate
constexpr int kDefaultNumThreads = 2;
constexpr double kDefaultTimeoutSec = 120.0;

const std::string kBuildHint =
  "the local backend is not compiled in — rebuild hkp-rt with -DHKP_SPEECH_ENABLED=ON";

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
    m_loadedKey.clear();
  }

  int numSpeakers() const
  {
    return m_tts ? SherpaOnnxOfflineTtsNumSpeakers(m_tts) : 0;
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
  std::string m_loadedKey;
};

#endif // HKP_SPEECH_ENABLED

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
};

TextToSpeech::TextToSpeech(const std::string& instanceId)
  : Service(instanceId, serviceId())
  , m_impl(std::make_unique<TextToSpeechImpl>())
{
}

TextToSpeech::~TextToSpeech() = default;

json TextToSpeech::configure(Data data)
{
  auto j = getJSONFromData(data);
  if (j)
  {
    if (j->contains("backend") && (*j)["backend"].is_string())
    {
      auto backend = (*j)["backend"].get<std::string>();
      if (backend == "server" || backend == "local")
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
    if (j->contains("modelPath") && (*j)["modelPath"].is_string())   { m_impl->modelPathRef()  = speech::expandUser((*j)["modelPath"].get<std::string>()); }
    if (j->contains("voicesPath") && (*j)["voicesPath"].is_string()) { m_impl->voicesPathRef() = speech::expandUser((*j)["voicesPath"].get<std::string>()); }
    if (j->contains("tokensPath") && (*j)["tokensPath"].is_string()) { m_impl->tokensPathRef() = speech::expandUser((*j)["tokensPath"].get<std::string>()); }
    if (j->contains("dataDir") && (*j)["dataDir"].is_string())       { m_impl->dataDirRef()    = speech::expandUser((*j)["dataDir"].get<std::string>()); }
    if (j->contains("lexicon") && (*j)["lexicon"].is_string())       { m_impl->lexiconRef()    = speech::expandUser((*j)["lexicon"].get<std::string>()); }
    if (j->contains("dictDir") && (*j)["dictDir"].is_string())       { m_impl->dictDirRef()    = speech::expandUser((*j)["dictDir"].get<std::string>()); }
    updateIfNeeded(m_impl->langRef(), (*j)["lang"]);
    updateIfNeeded(m_impl->numThreadsRef(), (*j)["numThreads"]);
    updateIfNeeded(m_impl->timeoutSec, (*j)["timeoutSec"]);
    if (j->contains("speed") && (*j)["speed"].is_number())
    {
      const double speed = (*j)["speed"].get<double>();
      if (speed >= 0.5 && speed <= 2.0)
      {
        m_impl->speed = speed;
      }
    }

#ifdef HKP_SPEECH_ENABLED
    m_impl->local.invalidateIfStale();
#endif
  }
  return Service::configure(data);
}

std::string TextToSpeech::getServiceId() const
{
  return serviceId();
}

json TextToSpeech::getState() const
{
  return Service::mergeStateWith(json{
    { "backend", m_impl->backend },
    { "serverUrl", m_impl->serverUrl },
    { "model", m_impl->model },
    { "voice", m_impl->voice },
    { "speakerId", m_impl->speakerId },
    { "modelPath", m_impl->modelPathRef() },
    { "voicesPath", m_impl->voicesPathRef() },
    { "tokensPath", m_impl->tokensPathRef() },
    { "dataDir", m_impl->dataDirRef() },
    { "lexicon", m_impl->lexiconRef() },
    { "dictDir", m_impl->dictDirRef() },
    { "lang", m_impl->langRef() },
    { "numThreads", m_impl->numThreadsRef() },
    { "speed", m_impl->speed },
    { "sampleRate", kDefaultSampleRate },
    { "timeoutSec", m_impl->timeoutSec },
    { "status", m_impl->status }
  });
}

Data TextToSpeech::process(Data data)
{
  if (isNull(data) || isUndefined(data))
  {
    return Null();
  }

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

  auto fail = [&](const std::string& message) -> Data
  {
    setStatus("error");
    json result = { { "error", message } };
    sendNotification(Data(result));
    return Data(result);
  };

  // ── Extract the text ──────────────────────────────────────────────────────
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

  const auto started = std::chrono::steady_clock::now();
  std::vector<float> samples;
  int sampleRate = kDefaultSampleRate;

  if (m_impl->backend == "local")
  {
#ifdef HKP_SPEECH_ENABLED
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
    auto synthesis = m_impl->local.generate(text, m_impl->speed, m_impl->speakerId);
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
  else
  {
    setStatus("generating");
    json payload = {
      { "model", m_impl->model },
      { "input", text },
      { "voice", m_impl->voice },
      { "response_format", "wav" },
      { "speed", m_impl->speed }
    };
    try
    {
      const auto timeout = std::chrono::milliseconds(
        static_cast<long long>(m_impl->timeoutSec * 1000));
      auto response = speech::httpPost(
        m_impl->serverUrl, "/v1/audio/speech",
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
      return fail(serverHint(m_impl->serverUrl));
    }
  }

  if (samples.empty())
  {
    return fail("synthesis produced no audio");
  }

  // ── Emit the audio ────────────────────────────────────────────────────────
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
    { "voice", m_impl->voice },
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
}

}
