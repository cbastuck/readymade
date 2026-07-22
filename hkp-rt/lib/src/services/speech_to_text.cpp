#include "./speech_to_text.h"

#include <chrono>
#include <string>
#include <vector>

#include "./speech_http.h"

#ifdef HKP_SPEECH_ENABLED
  #include "sherpa-onnx/c-api/c-api.h"
#endif

namespace hkp {

namespace {

const std::string kDefaultServerUrl = "http://127.0.0.1:8081";
const std::string kDefaultModel = "whisper-1";
constexpr int kDefaultSampleRate = 16000; // Whisper's required rate
constexpr int kDefaultNumThreads = 2;
constexpr double kDefaultTimeoutSec = 120.0;

const std::string kBuildHint =
  "the local backend is not compiled in — rebuild hkp-rt with -DHKP_SPEECH_ENABLED=ON";

std::string serverHint(const std::string& serverUrl)
{
  return "no OpenAI-compatible transcription server reachable at " + serverUrl +
         " — start one, or switch backend to \"local\"";
}

// ── Local backend: in-process Whisper via sherpa-onnx ────────────────────────

#ifdef HKP_SPEECH_ENABLED

struct Transcription
{
  std::string text;
  std::string language;
  json segments = json::array();
  std::string error;
};

// Lazy-loading wrapper around an in-process sherpa-onnx Whisper recognizer. Owns
// the local-backend config and the loaded-recognizer cache, and reloads when any
// of them change.
class LocalWhisper
{
public:
  std::string encoderPath;
  std::string decoderPath;
  std::string tokensPath;
  std::string language = "auto";
  int numThreads = kDefaultNumThreads;

  ~LocalWhisper()
  {
    release();
  }

  // Drop the cached recognizer if its parameters changed; it reloads lazily.
  void invalidateIfStale()
  {
    if (m_recognizer && m_loadedKey != key())
    {
      release();
    }
  }

  bool isLoaded() const
  {
    return m_recognizer != nullptr;
  }

  // Returns an empty string on success, the failure reason otherwise.
  std::string ensure()
  {
    if (m_recognizer)
    {
      return {};
    }

    SherpaOnnxOfflineRecognizerConfig config;
    std::memset(&config, 0, sizeof(config));
    config.feat_config.sample_rate = kDefaultSampleRate;
    config.feat_config.feature_dim = 80;
    config.model_config.whisper.encoder = encoderPath.c_str();
    config.model_config.whisper.decoder = decoderPath.c_str();
    // Empty language lets Whisper auto-detect; a code pins it.
    const std::string lang = language == "auto" ? std::string{} : language;
    config.model_config.whisper.language = lang.c_str();
    config.model_config.whisper.task = "transcribe";
    config.model_config.whisper.enable_segment_timestamps = 1;
    config.model_config.tokens = tokensPath.c_str();
    config.model_config.num_threads = numThreads;
    config.model_config.provider = "cpu";
    config.model_config.debug = 0;
    config.decoding_method = "greedy_search";
    config.max_active_paths = 4;

    m_recognizer = SherpaOnnxCreateOfflineRecognizer(&config);
    if (!m_recognizer)
    {
      return "failed to load the Whisper model — check encoderPath, decoderPath, tokensPath";
    }
    m_loadedKey = key();
    return {};
  }

  void release()
  {
    if (m_recognizer)
    {
      SherpaOnnxDestroyOfflineRecognizer(m_recognizer);
      m_recognizer = nullptr;
    }
    m_loadedKey.clear();
  }

  // Recognize one utterance. sherpa resamples internally from inSampleRate to
  // the model's rate, so the caller passes samples at whatever rate they arrived.
  Transcription transcribe(const std::vector<float>& samples, int inSampleRate)
  {
    Transcription out;

    const SherpaOnnxOfflineStream* stream = SherpaOnnxCreateOfflineStream(m_recognizer);
    if (!stream)
    {
      out.error = "failed to create a recognition stream";
      return out;
    }
    SherpaOnnxAcceptWaveformOffline(stream, inSampleRate, samples.data(),
                                    static_cast<int32_t>(samples.size()));
    SherpaOnnxDecodeOfflineStream(m_recognizer, stream);

    const SherpaOnnxOfflineRecognizerResult* result = SherpaOnnxGetOfflineStreamResult(stream);
    if (result)
    {
      out.text = result->text ? result->text : "";
      out.language = result->lang ? result->lang : "";
      for (int32_t i = 0; i < result->segment_count; ++i)
      {
        const float start = result->segment_timestamps ? result->segment_timestamps[i] : 0.0f;
        const float duration = result->segment_durations ? result->segment_durations[i] : 0.0f;
        const char* text = result->segment_texts_arr ? result->segment_texts_arr[i] : "";
        out.segments.push_back(json{
          { "start", start },
          { "end", start + duration },
          { "text", text ? text : "" }
        });
      }
      SherpaOnnxDestroyOfflineRecognizerResult(result);
    }
    else
    {
      out.error = "recognition returned no result";
    }
    SherpaOnnxDestroyOfflineStream(stream);
    return out;
  }

private:
  std::string key() const
  {
    return encoderPath + "|" + decoderPath + "|" + tokensPath + "|" + language + "|" +
           std::to_string(numThreads);
  }

  const SherpaOnnxOfflineRecognizer* m_recognizer = nullptr;
  std::string m_loadedKey;
};

#endif // HKP_SPEECH_ENABLED

} // namespace

struct SpeechToTextImpl
{
  std::string backend = "local";
  std::string serverUrl = kDefaultServerUrl;
  std::string model = kDefaultModel;
  int sampleRate = kDefaultSampleRate;
  double timeoutSec = kDefaultTimeoutSec;
  std::string status = "idle";

  // Local-backend config lives on LocalWhisper when it is compiled in, so that
  // the loaded-recognizer cache is invalidated in lockstep with the values.
#ifdef HKP_SPEECH_ENABLED
  LocalWhisper local;
#else
  std::string encoderPath;
  std::string decoderPath;
  std::string tokensPath;
  std::string language = "auto";
  int numThreads = kDefaultNumThreads;
#endif

  std::string& encoderPathRef()
  {
#ifdef HKP_SPEECH_ENABLED
    return local.encoderPath;
#else
    return encoderPath;
#endif
  }

  std::string& decoderPathRef()
  {
#ifdef HKP_SPEECH_ENABLED
    return local.decoderPath;
#else
    return decoderPath;
#endif
  }

  std::string& tokensPathRef()
  {
#ifdef HKP_SPEECH_ENABLED
    return local.tokensPath;
#else
    return tokensPath;
#endif
  }

  std::string& languageRef()
  {
#ifdef HKP_SPEECH_ENABLED
    return local.language;
#else
    return language;
#endif
  }

  int& numThreadsRef()
  {
#ifdef HKP_SPEECH_ENABLED
    return local.numThreads;
#else
    return numThreads;
#endif
  }
};

SpeechToText::SpeechToText(const std::string& instanceId)
  : Service(instanceId, serviceId())
  , m_impl(std::make_unique<SpeechToTextImpl>())
{
}

SpeechToText::~SpeechToText() = default;

json SpeechToText::configure(Data data)
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
    for (const char* pathKey : { "encoderPath", "decoderPath", "tokensPath" })
    {
      if (j->contains(pathKey) && (*j)[pathKey].is_string())
      {
        auto expanded = speech::expandUser((*j)[pathKey].get<std::string>());
        if (std::string(pathKey) == "encoderPath") { m_impl->encoderPathRef() = expanded; }
        else if (std::string(pathKey) == "decoderPath") { m_impl->decoderPathRef() = expanded; }
        else { m_impl->tokensPathRef() = expanded; }
      }
    }
    updateIfNeeded(m_impl->languageRef(), (*j)["language"]);
    updateIfNeeded(m_impl->numThreadsRef(), (*j)["numThreads"]);
    updateIfNeeded(m_impl->timeoutSec, (*j)["timeoutSec"]);
    if (j->contains("sampleRate") && (*j)["sampleRate"].is_number())
    {
      const int rate = (*j)["sampleRate"].get<int>();
      if (rate > 0)
      {
        m_impl->sampleRate = rate;
      }
    }

#ifdef HKP_SPEECH_ENABLED
    m_impl->local.invalidateIfStale();
#endif
  }
  return Service::configure(data);
}

std::string SpeechToText::getServiceId() const
{
  return serviceId();
}

json SpeechToText::getState() const
{
  return Service::mergeStateWith(json{
    { "backend", m_impl->backend },
    { "serverUrl", m_impl->serverUrl },
    { "model", m_impl->model },
    { "encoderPath", m_impl->encoderPathRef() },
    { "decoderPath", m_impl->decoderPathRef() },
    { "tokensPath", m_impl->tokensPathRef() },
    { "language", m_impl->languageRef() },
    { "numThreads", m_impl->numThreadsRef() },
    { "sampleRate", m_impl->sampleRate },
    { "timeoutSec", m_impl->timeoutSec },
    { "status", m_impl->status }
  });
}

Data SpeechToText::process(Data data)
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

  auto ring = getRingBufferFromData(data);
  if (!ring)
  {
    return fail("speech-to-text expects FloatRingBuffer input (mono float32 at the configured sampleRate)");
  }

  std::vector<float> samples;
  ring->consumeAvailable(samples, true);
  if (samples.empty())
  {
    return fail("received empty audio");
  }

  const int durationMs = static_cast<int>(
    static_cast<double>(samples.size()) / m_impl->sampleRate * 1000.0);

  std::string text;
  std::string language;
  json segments = json::array();

  if (m_impl->backend == "local")
  {
#ifdef HKP_SPEECH_ENABLED
    if (m_impl->local.encoderPath.empty() || m_impl->local.decoderPath.empty() ||
        m_impl->local.tokensPath.empty())
    {
      return fail("local backend needs encoderPath, decoderPath, and tokensPath (a sherpa Whisper model)");
    }

    if (!m_impl->local.isLoaded())
    {
      setStatus("loading", "loading Whisper model");
    }
    if (auto error = m_impl->local.ensure(); !error.empty())
    {
      return fail(error);
    }

    setStatus("transcribing");
    auto transcription = m_impl->local.transcribe(samples, m_impl->sampleRate);
    if (!transcription.error.empty() && transcription.text.empty())
    {
      return fail("transcription failed: " + transcription.error);
    }
    text = transcription.text;
    language = transcription.language;
    segments = transcription.segments;
#else
    return fail(kBuildHint);
#endif
  }
  else
  {
    setStatus("transcribing");
    auto resampled = speech::resampleLinear(samples, m_impl->sampleRate, kDefaultSampleRate);
    const std::string wav = speech::writeWavPcm16(resampled, kDefaultSampleRate);

    const std::string boundary = "----hkprtSpeechBoundary7MA4YWxkTrZu0gW";
    std::string body;
    auto field = [&](const std::string& name, const std::string& value)
    {
      body += "--" + boundary + "\r\n";
      body += "Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n";
      body += value + "\r\n";
    };
    field("model", m_impl->model);
    field("response_format", "json");
    body += "--" + boundary + "\r\n";
    body += "Content-Disposition: form-data; name=\"file\"; filename=\"audio.wav\"\r\n";
    body += "Content-Type: audio/wav\r\n\r\n";
    body += wav;
    body += "\r\n--" + boundary + "--\r\n";

    try
    {
      const auto timeout = std::chrono::milliseconds(
        static_cast<long long>(m_impl->timeoutSec * 1000));
      auto response = speech::httpPost(
        m_impl->serverUrl, "/v1/audio/transcriptions",
        "multipart/form-data; boundary=" + boundary, "application/json", body, timeout);

      if (response.status >= 400)
      {
        return fail("server returned HTTP " + std::to_string(response.status) + ": " +
                    response.body.substr(0, 200));
      }
      auto parsed = json::parse(response.body, nullptr, false);
      if (parsed.is_discarded() || !parsed.is_object() || !parsed.contains("text"))
      {
        return fail("unexpected response shape: " + response.body.substr(0, 200));
      }
      text = parsed.value("text", std::string{});
      language = parsed.value("language", std::string{});
      if (parsed.contains("segments") && parsed["segments"].is_array())
      {
        segments = parsed["segments"];
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

  json result = {
    { "text", text },
    { "language", language },
    { "durationMs", durationMs },
    { "segments", segments }
  };

  setStatus("idle");
  sendNotification(Data(result));
  return Data(result);
}

}
