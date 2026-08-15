#pragma once

#include <cstdint>
#include <memory>
#include <string>
#include <vector>

#include "inflect/phonemize.h"

namespace inflect {

inline constexpr int kSampleRate = 24000;

struct SynthesisOptions {
  float speed = 1.0f;
  float variation = 0.667f;
  std::int64_t seed = 0;
  // Optional path to a raw little-endian float32 latent noise tensor. When
  // set, it replaces the generated noise so a run can be compared bit-for-bit
  // against the Python reference without reimplementing numpy's PCG64.
  std::string noise_file;
  // When false, a period closing a known abbreviation ("Mr.", "e.g.") no
  // longer starts a new chunk. Improves prosody but diverges from the Python
  // reference, which always splits. See Engine::SplitText.
  bool split_on_abbreviations = true;
};

// Frontend intermediates, exposed for the parity test.
struct FrontendResult {
  std::string normalized;
  std::string phonemes;
  std::vector<std::int64_t> tokens_with_blanks;
};

// Torch-free Inflect v2 engine over the two exported ONNX graphs.
//
// Sessions are expensive to create and cheap to reuse: build one Engine and
// call Synthesize repeatedly, as DEPLOYMENT.md advises. Not thread-safe --
// espeak-ng has process-global state and one session should serve one request
// at a time.
class Engine {
 public:
  // `model_dir` must contain onnx/duration.onnx and onnx/decode.onnx.
  Engine(const std::string& model_dir, const std::string& espeak_data_path,
         int threads = 0);
  ~Engine();

  Engine(const Engine&) = delete;
  Engine& operator=(const Engine&) = delete;

  // Full pipeline: normalize, phonemize, tokenize, infer, join chunks.
  std::vector<float> Synthesize(const std::string& text,
                                const SynthesisOptions& options) const;

  // Frontend only, for parity checks against the Python reference.
  FrontendResult RunFrontend(const std::string& text) const;

  // Punctuation-aware chunking, exposed for tests.
  //
  // With `split_on_abbreviations` true this reproduces the reference
  // split_text() exactly -- including its habit of treating the period in
  // "Mr. Smith" as a sentence end, which strands "mister" in a chunk of its
  // own and inserts a 0.22 s pause after it. Pass false to suppress that
  // boundary for the known abbreviations; the result is better prosody but no
  // longer byte-identical to Python.
  static std::vector<std::string> SplitText(const std::string& text,
                                            std::size_t limit = 280,
                                            bool split_on_abbreviations = true);

 private:
  struct Impl;
  std::unique_ptr<Impl> impl_;
  Phonemizer phonemizer_;
};

}  // namespace inflect
