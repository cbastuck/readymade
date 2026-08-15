#pragma once

#include <memory>
#include <string>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

/**
 * Service Documentation
 * Service ID: text-to-speech
 * Service Name: TextToSpeech
 * Runtime: hkp-rt
 * Modes: synthesize, via one of three backends selected by the `backend` state:
 *        local (default) — runs a Kokoro ONNX model in-process via sherpa-onnx
 *        inflect         — runs an Inflect v2 model in-process via 3rdparty/inflect
 *        server          — OpenAI-compatible /v1/audio/speech client
 * Key Config: backend (local|inflect|server),
 *             serverUrl (server backend: base URL of an OpenAI-compatible server),
 *             model (server backend: model name; local backend: unused label),
 *             voice (server backend voice name),
 *             modelPath, voicesPath, tokensPath, dataDir, lexicon, dictDir
 *             (local backend: the sherpa Kokoro model files),
 *             speakerId (local backend speaker index; the reported read-only
 *             numSpeakers state gives its valid range once the model is loaded),
 *             modelDir, espeakDataPath, inflectNumThreads, variation (0.0-1.0),
 *             seed, splitOnAbbreviations (inflect backend),
 *             speed (0.5-2.0), lang, numThreads,
 *             timeoutSec (server backend request timeout)
 * IO: in=String/TextData (the text) or JSON ({text} | {prompt})
 *     -> out=FloatRingBuffer (mono float32 at the model's rate, typically 24 kHz)
 * Arrays: n/a
 * Binary: emits FloatRingBuffer; non-text inputs yield an error JSON
 * MixedData: not supported
 *
 * Local backend: a Kokoro model (ONNX + voices + tokens + espeak-ng-data) is
 * loaded lazily on first use through the embedded sherpa-onnx and reloaded when
 * its paths or thread count change. Compiled in only when the runtime is built
 * with -DHKP_SPEECH_ENABLED=ON (the default on desktop platforms).
 *
 * Inflect backend: the same lazy-load contract over two ONNX graphs in
 * `modelDir` (onnx/duration.onnx, onnx/decode.onnx) plus an `espeakDataPath`
 * espeak-ng-data directory. Gated independently on -DHKP_INFLECT_ENABLED=ON, so
 * a build can carry this backend without sherpa-onnx — the two dependencies it
 * needs are a fraction of sherpa's stack, which is what makes it the local
 * backend that fits on mobile. Selecting a backend the build omits is reported
 * as an error naming the option to rebuild with.
 *
 * Reported state is scoped to the backend: a backend's settings appear while it
 * is selected, and otherwise only once they hold a value someone chose, so a
 * board carries the fields it uses rather than every backend's. configure()
 * still accepts any of them at any time — the scoping is what is reported, not
 * what is settable, which is what lets a board pre-load a backend it has not
 * switched to yet.
 *
 * Both local backends phonemize through espeak-ng, whose configuration and
 * working buffers are process globals. Calls are serialized on one process-wide
 * lock, but the espeak-ng data directory is fixed by whichever engine
 * initialises first: a build carrying both should point `dataDir` and
 * `espeakDataPath` at the same directory.
 *
 * Server backend: the service is a thin client — synthesis runs in a separate
 * process that speaks the OpenAI audio-speech API. Always available, and the
 * fallback on platforms where the local backend is not compiled in.
 *
 * A single FloatRingBuffer hop carries at most ~88200 samples (the runtime's
 * fixed ring-buffer size), i.e. ~3.67 s at 24 kHz; longer synthesis is truncated
 * to that and a {truncated} notification is emitted.
 *
 * The `{text}` input shape is deliberate: the text-generation service's output
 * pipes straight in, completing the local voice loop
 * speech-to-text -> text-generation -> text-to-speech.
 */
namespace hkp {

struct TextToSpeechImpl;

class TextToSpeech : public Service
{
public:
  static std::string serviceId() { return "text-to-speech"; }

  explicit TextToSpeech(const std::string& instanceId);
  ~TextToSpeech();

  json configure(Data data) override;
  std::string getServiceId() const override;
  json getState() const override;
  Data process(Data data) override;
  void shutdown() override;

private:
  std::unique_ptr<TextToSpeechImpl> m_impl;
};

}
