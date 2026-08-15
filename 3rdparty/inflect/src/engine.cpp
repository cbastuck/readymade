#include "inflect/engine.h"

#include <onnxruntime_cxx_api.h>

#include <algorithm>
#include <array>
#include <cctype>
#include <cmath>
#include <cstdio>
#include <fstream>
#include <memory>
#include <random>
#include <stdexcept>
#include <string>
#include <vector>

#include "inflect/normalize.h"
#include "inflect/tokens.h"
#include "inflect/utf8.h"

namespace inflect {
namespace {

bool IsSpaceChar(const std::string& cp) {
  return cp.size() == 1 &&
         std::isspace(static_cast<unsigned char>(cp[0])) != 0;
}

// " ".join(text.split()): collapse all whitespace runs, drop leading/trailing.
std::string CollapseWhitespace(const std::string& text) {
  std::vector<std::string> chars = Utf8Split(text);
  std::string out;
  bool pending_space = false;
  for (const auto& cp : chars) {
    if (IsSpaceChar(cp)) {
      if (!out.empty()) pending_space = true;
      continue;
    }
    if (pending_space) {
      out += " ";
      pending_space = false;
    }
    out += cp;
  }
  return out;
}

std::string StripCodepoints(const std::vector<std::string>& chars,
                            std::size_t begin, std::size_t end) {
  while (begin < end && IsSpaceChar(chars[begin])) ++begin;
  while (end > begin && IsSpaceChar(chars[end - 1])) --end;
  std::string out;
  for (std::size_t i = begin; i < end; ++i) out += chars[i];
  return out;
}

float BoundaryPauseSeconds(const std::string& chunk) {
  std::vector<std::string> chars = Utf8Split(chunk);
  std::size_t end = chars.size();
  while (end > 0 && IsSpaceChar(chars[end - 1])) --end;
  if (end == 0) return 0.08f;
  const std::string& last = chars[end - 1];
  if (last == "?") return 0.28f;
  if (last == "!") return 0.24f;
  if (last == ".") return 0.22f;
  if (last == ";") return 0.16f;
  if (last == ":") return 0.13f;
  if (last == ",") return 0.09f;
  return 0.08f;
}

// 5 ms cosine-free linear ramp on both edges, as in edge_fade().
void EdgeFade(std::vector<float>* waveform) {
  const double milliseconds = 5.0;
  auto frames = static_cast<std::size_t>(
      std::lround(kSampleRate * milliseconds / 1000.0));
  frames = std::min(frames, waveform->size() / 2);
  if (frames == 0) return;
  for (std::size_t i = 0; i < frames; ++i) {
    // np.linspace(0, 1, frames, endpoint=True)
    float ramp = frames == 1 ? 0.0f
                             : static_cast<float>(i) /
                                   static_cast<float>(frames - 1);
    (*waveform)[i] *= ramp;
    (*waveform)[waveform->size() - frames + i] *= (frames == 1 ? 0.0f : 1.0f - ramp);
  }
}

std::vector<float> LoadNoiseFile(const std::string& path, std::size_t expected) {
  std::ifstream in(path, std::ios::binary);
  if (!in) throw std::runtime_error("Cannot open noise file " + path);
  std::vector<float> noise(expected);
  in.read(reinterpret_cast<char*>(noise.data()),
          static_cast<std::streamsize>(expected * sizeof(float)));
  if (static_cast<std::size_t>(in.gcount()) != expected * sizeof(float)) {
    throw std::runtime_error("Noise file " + path + " has the wrong size: need " +
                             std::to_string(expected) + " float32 values.");
  }
  return noise;
}

}  // namespace

struct Engine::Impl {
  Ort::Env env{ORT_LOGGING_LEVEL_WARNING, "inflect"};
  Ort::SessionOptions session_options;
  std::unique_ptr<Ort::Session> duration;
  std::unique_ptr<Ort::Session> decode;
  Ort::MemoryInfo memory =
      Ort::MemoryInfo::CreateCpu(OrtArenaAllocator, OrtMemTypeDefault);
};

Engine::Engine(const std::string& model_dir, const std::string& espeak_data_path,
               int threads)
    : impl_(std::make_unique<Impl>()), phonemizer_(espeak_data_path) {
  // DEPLOYMENT.md: set an explicit thread policy rather than inheriting every
  // visible core.
  if (threads > 0) {
    impl_->session_options.SetIntraOpNumThreads(threads);
    impl_->session_options.SetInterOpNumThreads(1);
  }
  impl_->session_options.SetGraphOptimizationLevel(
      GraphOptimizationLevel::ORT_ENABLE_ALL);

  const std::string duration_path = model_dir + "/onnx/duration.onnx";
  const std::string decode_path = model_dir + "/onnx/decode.onnx";
  try {
    impl_->duration = std::make_unique<Ort::Session>(
        impl_->env, duration_path.c_str(), impl_->session_options);
    impl_->decode = std::make_unique<Ort::Session>(
        impl_->env, decode_path.c_str(), impl_->session_options);
  } catch (const Ort::Exception& error) {
    throw std::runtime_error(std::string("Failed to load ONNX graphs from ") +
                             model_dir + ": " + error.what());
  }
}

Engine::~Engine() = default;

std::vector<std::string> Engine::SplitText(const std::string& text,
                                           std::size_t limit,
                                           bool split_on_abbreviations) {
  std::string normalized = CollapseWhitespace(text);
  std::vector<std::string> chars = Utf8Split(normalized);

  // Byte offset of the end of each codepoint, so the abbreviation lookahead
  // can slice `normalized` without rescanning. The loop below skips over
  // whitespace runs, so a running counter would drift.
  std::vector<std::size_t> end_offsets;
  end_offsets.reserve(chars.size());
  {
    std::size_t offset = 0;
    for (const auto& cp : chars) {
      offset += cp.size();
      end_offsets.push_back(offset);
    }
  }

  // re.split(r"(?<=[.!?;:])\s+", ...): break after sentence punctuation.
  std::vector<std::string> sentences;
  std::size_t start = 0;
  for (std::size_t i = 0; i + 1 < chars.size(); ++i) {
    const std::string& cp = chars[i];
    bool is_boundary = cp == "." || cp == "!" || cp == "?" || cp == ";" ||
                       cp == ":";
    if (!is_boundary || !IsSpaceChar(chars[i + 1])) continue;
    // "Mr." is an abbreviation, not the end of a sentence.
    if (!split_on_abbreviations && cp == "." &&
        EndsWithAbbreviation(normalized.substr(0, end_offsets[i]))) {
      continue;
    }
    std::size_t run_end = i + 1;
    while (run_end < chars.size() && IsSpaceChar(chars[run_end])) ++run_end;
    std::string piece = StripCodepoints(chars, start, i + 1);
    if (!piece.empty()) sentences.push_back(piece);
    start = run_end;
    i = run_end - 1;
  }
  {
    std::string piece = StripCodepoints(chars, start, chars.size());
    if (!piece.empty()) sentences.push_back(piece);
  }
  if (sentences.empty()) sentences.push_back(normalized);

  std::vector<std::string> chunks;
  for (std::string sentence : sentences) {
    std::vector<std::string> cps = Utf8Split(sentence);
    while (cps.size() > limit) {
      // Prefer the last comma-ish break inside the window, else the last
      // space, else a hard cut at the limit.
      std::size_t window = std::min(limit + 1, cps.size());
      long punctuation = -1;
      for (std::size_t i = 0; i < window; ++i) {
        if (cps[i] == "," || cps[i] == ";" || cps[i] == ":") {
          punctuation = static_cast<long>(i);
        }
      }
      long split_at;
      if (punctuation >= static_cast<long>(limit / 2)) {
        split_at = punctuation + 1;
      } else {
        split_at = -1;
        for (std::size_t i = 0; i < window; ++i) {
          if (cps[i] == " ") split_at = static_cast<long>(i);
        }
      }
      if (split_at < static_cast<long>(limit / 2)) {
        split_at = static_cast<long>(limit);
      }
      chunks.push_back(
          StripCodepoints(cps, 0, static_cast<std::size_t>(split_at)));
      cps.erase(cps.begin(), cps.begin() + split_at);
      sentence = StripCodepoints(cps, 0, cps.size());
      cps = Utf8Split(sentence);
    }
    if (!sentence.empty()) chunks.push_back(sentence);
  }
  return chunks;
}

FrontendResult Engine::RunFrontend(const std::string& text) const {
  FrontendResult result;
  result.normalized = NormalizeText(text);
  result.phonemes = phonemizer_.Phonemize(result.normalized);
  result.tokens_with_blanks = PhonemesToTokens(result.phonemes);
  return result;
}

std::vector<float> Engine::Synthesize(const std::string& text,
                                      const SynthesisOptions& options) const {
  std::string normalized = CollapseWhitespace(text);
  if (normalized.empty()) throw std::runtime_error("Text must not be empty.");
  if (options.speed < 0.5f || options.speed > 2.0f) {
    throw std::runtime_error("speed must be between 0.5 and 2.0");
  }
  if (options.variation < 0.0f || options.variation > 1.0f) {
    throw std::runtime_error("variation must be between 0.0 and 1.0");
  }

  const std::vector<std::string> chunks =
      SplitText(normalized, 280, options.split_on_abbreviations);
  std::vector<float> output;

  for (std::size_t index = 0; index < chunks.size(); ++index) {
    if (index > 0) {
      float pause = BoundaryPauseSeconds(chunks[index - 1]);
      auto samples = static_cast<std::size_t>(std::lround(kSampleRate * pause));
      output.insert(output.end(), samples, 0.0f);
    }

    FrontendResult frontend = RunFrontend(chunks[index]);
    std::vector<std::int64_t> tokens = std::move(frontend.tokens_with_blanks);

    // --- duration.onnx ---
    std::array<std::int64_t, 2> token_shape{
        1, static_cast<std::int64_t>(tokens.size())};
    std::int64_t length = static_cast<std::int64_t>(tokens.size());
    std::array<std::int64_t, 1> length_shape{1};
    float length_scale = 1.0f / options.speed;

    std::vector<Ort::Value> duration_inputs;
    duration_inputs.push_back(Ort::Value::CreateTensor<std::int64_t>(
        impl_->memory, tokens.data(), tokens.size(), token_shape.data(),
        token_shape.size()));
    duration_inputs.push_back(Ort::Value::CreateTensor<std::int64_t>(
        impl_->memory, &length, 1, length_shape.data(), length_shape.size()));
    duration_inputs.push_back(Ort::Value::CreateTensor<float>(
        impl_->memory, &length_scale, 1, nullptr, 0));

    const char* duration_input_names[] = {"tokens", "lengths", "length_scale"};
    const char* duration_output_names[] = {"m_p_exp", "logs_p_exp", "y_mask"};
    std::vector<Ort::Value> duration_outputs = impl_->duration->Run(
        Ort::RunOptions{nullptr}, duration_input_names, duration_inputs.data(),
        duration_inputs.size(), duration_output_names, 3);

    // --- latent noise ---
    Ort::TensorTypeAndShapeInfo m_p_info =
        duration_outputs[0].GetTensorTypeAndShapeInfo();
    std::vector<std::int64_t> m_p_shape = m_p_info.GetShape();
    std::size_t noise_count = m_p_info.GetElementCount();

    std::vector<float> noise;
    if (!options.noise_file.empty()) {
      noise = LoadNoiseFile(options.noise_file, noise_count);
    } else {
      // Deterministic per chunk. This is NOT numpy's PCG64 stream, so the
      // waveform differs from the Python reference while remaining valid
      // speech; use --noise-file to compare bit-for-bit.
      std::mt19937_64 rng(static_cast<std::uint64_t>(options.seed + index));
      std::normal_distribution<float> gaussian(0.0f, 1.0f);
      noise.resize(noise_count);
      for (float& value : noise) value = gaussian(rng);
    }

    // --- decode.onnx ---
    float noise_scale = options.variation;
    std::vector<Ort::Value> decode_inputs;
    decode_inputs.push_back(std::move(duration_outputs[0]));
    decode_inputs.push_back(std::move(duration_outputs[1]));
    decode_inputs.push_back(std::move(duration_outputs[2]));
    decode_inputs.push_back(Ort::Value::CreateTensor<float>(
        impl_->memory, noise.data(), noise.size(), m_p_shape.data(),
        m_p_shape.size()));
    decode_inputs.push_back(Ort::Value::CreateTensor<float>(
        impl_->memory, &noise_scale, 1, nullptr, 0));

    const char* decode_input_names[] = {"m_p_exp", "logs_p_exp", "y_mask",
                                        "zp_noise", "noise_scale"};
    const char* decode_output_names[] = {"waveform"};
    std::vector<Ort::Value> decode_outputs = impl_->decode->Run(
        Ort::RunOptions{nullptr}, decode_input_names, decode_inputs.data(),
        decode_inputs.size(), decode_output_names, 1);

    const float* wave = decode_outputs[0].GetTensorData<float>();
    std::size_t wave_count =
        decode_outputs[0].GetTensorTypeAndShapeInfo().GetElementCount();
    std::vector<float> chunk_wave(wave, wave + wave_count);
    EdgeFade(&chunk_wave);
    output.insert(output.end(), chunk_wave.begin(), chunk_wave.end());
  }

  for (float& sample : output) sample = std::clamp(sample, -1.0f, 1.0f);
  return output;
}

}  // namespace inflect
