#pragma once

#include <memory>
#include <string>
#include <vector>

/**
 * The text-to-speech service's `inflect` backend: the vendored Inflect v2
 * pipeline (3rdparty/inflect) running in-process.
 *
 * Compiled in only when the runtime is built with -DHKP_INFLECT_ENABLED=ON
 * (the default on desktop platforms). The whole header is inert otherwise, so
 * the service can include it unconditionally.
 *
 * Two files make a model — <modelDir>/onnx/duration.onnx and
 * <modelDir>/onnx/decode.onnx — plus an espeak-ng data directory for
 * grapheme-to-phoneme. The data directory is a runtime path rather than a
 * build artefact: what a voice says is fixed by that directory's contents, and
 * an en-US-only set is under a megabyte.
 */
namespace hkp {

struct InflectSynthesis
{
  std::vector<float> samples;
  int sampleRate = 24000;
  std::string error;
};

#ifdef HKP_INFLECT_ENABLED

namespace inflect_detail {
class EngineHolder;
}

// Lazy-loading wrapper around an in-process Inflect engine. Owns the backend's
// model config and the loaded-engine cache, and reloads when any of the
// parameters that define the engine change.
//
// Mirrors the LocalKokoro shape in text_to_speech.cpp deliberately: same
// invalidateIfStale/isLoaded/ensure/generate contract, so the service drives
// both local engines through one code path.
class LocalInflect
{
public:
  std::string modelDir;
  std::string espeakDataPath;
  int numThreads = 0; // 0 lets ONNX Runtime choose
  // Latent-noise scale. The reference default; higher is more varied prosody.
  double variation = 0.667;
  long long seed = 0;
  // The reference splits a chunk after any period, including the one closing
  // "Mr." — which strands "mister" in its own chunk behind a 0.22 s pause.
  // False suppresses that boundary for known abbreviations.
  bool splitOnAbbreviations = true;

  LocalInflect();
  ~LocalInflect();

  LocalInflect(const LocalInflect&) = delete;
  LocalInflect& operator=(const LocalInflect&) = delete;

  // Drop the cached engine if its parameters changed; it reloads lazily.
  void invalidateIfStale();
  bool isLoaded() const;

  // Returns an empty string on success, the failure reason otherwise.
  std::string ensure();
  void release();

  InflectSynthesis generate(const std::string& text, double speed);

private:
  std::string key() const;

  std::unique_ptr<inflect_detail::EngineHolder> m_holder;
  std::string m_loadedKey;
};

#endif // HKP_INFLECT_ENABLED

}
