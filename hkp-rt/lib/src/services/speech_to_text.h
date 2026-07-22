#pragma once

#include <memory>
#include <string>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

/**
 * Service Documentation
 * Service ID: speech-to-text
 * Service Name: SpeechToText
 * Runtime: hkp-rt
 * Modes: transcribe, via one of two backends selected by the `backend` state:
 *        local (default) — runs a Whisper ONNX model in-process via sherpa-onnx
 *        server          — OpenAI-compatible /v1/audio/transcriptions client
 * Key Config: backend (local|server),
 *             serverUrl (server backend: base URL of an OpenAI-compatible server),
 *             model (server backend: model name, e.g. whisper-1),
 *             encoderPath, decoderPath, tokensPath (local backend: the sherpa
 *             Whisper model files),
 *             language ("auto" or an ISO code like "en"),
 *             numThreads (local backend inference threads),
 *             sampleRate (rate of the incoming samples, default 16000),
 *             timeoutSec (server backend request timeout)
 * IO: in=FloatRingBuffer (mono float32 at the configured sampleRate)
 *     -> out=JSON { text, language, durationMs,
 *                   segments: [{ start, end, text }] }
 * Arrays: n/a
 * Binary: consumes FloatRingBuffer; other inputs yield an error JSON
 * MixedData: not supported
 *
 * Local backend: a Whisper model (encoder + decoder ONNX + tokens) is loaded
 * lazily on first use through the embedded sherpa-onnx and reloaded when its
 * paths, language, or thread count change. Compiled in only when the runtime is
 * built with -DHKP_SPEECH_ENABLED=ON (the default on desktop platforms).
 *
 * Server backend: the service is a thin client — recognition runs in a separate
 * process that speaks the OpenAI audio-transcription API. Always available, and
 * the fallback on platforms where the local backend is not compiled in.
 *
 * A single FloatRingBuffer hop carries at most ~88200 samples (the runtime's
 * fixed ring-buffer size), i.e. ~5.5 s at 16 kHz — this service transcribes one
 * such utterance per call.
 */
namespace hkp {

struct SpeechToTextImpl;

class SpeechToText : public Service
{
public:
  static std::string serviceId() { return "speech-to-text"; }

  explicit SpeechToText(const std::string& instanceId);
  ~SpeechToText();

  json configure(Data data) override;
  std::string getServiceId() const override;
  json getState() const override;
  Data process(Data data) override;

private:
  std::unique_ptr<SpeechToTextImpl> m_impl;
};

}
