// mp4_to_wav.h  —  hkp service: MP4 → WAV converter
//
// SERVICE ID:  "mp4-to-wav"
//
// PURPOSE
//   Accepts a path to an MP4 file containing an AAC audio track, decodes it to
//   PCM with fdk-aac, and writes a 16-bit stereo WAV file to disk.
//
// DATA FLOW
//   Input  (JSON): { "path": "/abs/path/to/video.mp4" }
//   Output (JSON): { "path": "/abs/path/to/video.wav" }   — on success
//                  { "error": "<message>" }                — on failure
//
// CONFIGURATION (optional, via configure())
//   { "outputDir": "/some/directory" }
//   When outputDir is empty (default) the WAV is written next to the source
//   MP4 file, replacing its extension.
//
// DEPENDENCIES
//   • fdk-aac   — AAC decoder (vcpkg, proper static library)
//   • minimp4   — MP4/ISOBMFF demuxer (single-header, CPM)
//   The MINIMP4_IMPLEMENTATION define lives in mp4_to_wav.cpp, not here,
//   to satisfy the single-header "emit bodies in exactly one TU" rule.
//
// AVAILABILITY
//   Compiled only when fdk-aac is found (see hkp-rt/lib/CMakeLists.txt).
//   Guarded in registry.cpp with #if HKP_MP4_TO_WAV_ENABLED.

#pragma once

#include <cstdint>
#include <cstdio>
#include <filesystem>
#include <iostream>
#include <stdexcept>
#include <vector>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

namespace hkp {

// Forward declaration — bodies live in mp4_to_wav.cpp which owns
// #define MINIMP4_IMPLEMENTATION (single-header requirement).
std::vector<int16_t> decodeMp4ToPcm(const char*   path,
                                     unsigned int& outSampleRate,
                                     unsigned int& outChannels);

// ---------------------------------------------------------------------------

class Mp4ToWav : public Service
{
public:
  static std::string serviceId() { return "mp4-to-wav"; }

  explicit Mp4ToWav(const std::string& instanceId)
    : Service(instanceId, serviceId())
  {}

  std::string getServiceId() const override { return serviceId(); }

  // ── Configuration ─────────────────────────────────────────────────────────
  // Accepted keys:
  //   "outputDir"  (string)  Directory where converted WAV files are placed.
  //                          Defaults to the same directory as the input MP4.
  json configure(Data data) override
  {
    auto j = getJSONFromData(data);
    if (j)
    {
      updateIfNeeded(m_outputDir, (*j)["outputDir"]);
    }
    return Service::configure(data);
  }

  json getState() const override
  {
    return Service::mergeStateWith({{"outputDir", m_outputDir}});
  }

  // ── Processing ────────────────────────────────────────────────────────────
  // Input:  JSON { "path": "/path/to/file.mp4" }
  // Output: JSON { "path": "/path/to/file.wav" }  on success
  //         JSON { "error": "<what()>" }           on failure (never throws)
  Data process(Data data) override
  {
    auto j = getJSONFromData(data);
    if (!j || !j->contains("path"))
    {
      std::cerr << "[mp4-to-wav] missing \"path\" key in input JSON\n";
      return Null();
    }

    const std::string inputPath  = (*j)["path"].get<std::string>();
    const std::string outputPath = deriveOutputPath(inputPath);

    try
    {
      unsigned int sampleRate = 44100; // overwritten by first decoded frame
      unsigned int channels   = 2;

      auto pcm = decodeMp4ToPcm(inputPath.c_str(), sampleRate, channels);
      if (pcm.empty())
        throw std::runtime_error("no PCM samples decoded from: " + inputPath);

      writeWav(outputPath, pcm, sampleRate, channels);
      return json{{"path", outputPath}};
    }
    catch (const std::exception& e)
    {
      std::cerr << "[mp4-to-wav] " << e.what() << "\n";
      return json{{"error", e.what()}};
    }
  }

private:
  // ── Helpers ───────────────────────────────────────────────────────────────

  std::string deriveOutputPath(const std::string& inputPath) const
  {
    const std::filesystem::path p(inputPath);
    const std::filesystem::path dir = m_outputDir.empty()
        ? p.parent_path()
        : std::filesystem::path(m_outputDir);
    return (dir / p.stem()).string() + ".wav";
  }

  // Writes a minimal RIFF/WAV file for int16_t interleaved PCM.
  // Throws std::runtime_error if the file cannot be opened.
  static void writeWav(const std::string&        path,
                       const std::vector<int16_t>& pcm,
                       unsigned int              sampleRate,
                       unsigned int              channels)
  {
    const auto     dataBytes  = static_cast<uint32_t>(pcm.size() * sizeof(int16_t));
    const uint16_t blockAlign = static_cast<uint16_t>(channels * sizeof(int16_t));
    const uint32_t byteRate   = sampleRate * blockAlign;

    FILE* fp = std::fopen(path.c_str(), "wb");
    if (!fp)
      throw std::runtime_error("failed to open WAV output: " + path);

    // Lambdas write little-endian values (x86/ARM are natively LE).
    const auto w32 = [fp](uint32_t v) { std::fwrite(&v, 4, 1, fp); };
    const auto w16 = [fp](uint16_t v) { std::fwrite(&v, 2, 1, fp); };
    const auto wcc = [fp](const char* s) { std::fwrite(s, 1, 4, fp); };

    // ── RIFF chunk ──────────────────────────────────────────────────────────
    wcc("RIFF");  w32(36 + dataBytes);   // overall file size − 8 bytes
    wcc("WAVE");

    // ── fmt  sub-chunk (16 bytes, PCM) ──────────────────────────────────────
    wcc("fmt ");  w32(16);               // sub-chunk size
    w16(1);                              // PCM (uncompressed)
    w16(static_cast<uint16_t>(channels));
    w32(sampleRate);
    w32(byteRate);
    w16(blockAlign);
    w16(16);                             // bits per sample

    // ── data sub-chunk ──────────────────────────────────────────────────────
    wcc("data");  w32(dataBytes);
    std::fwrite(pcm.data(), sizeof(int16_t), pcm.size(), fp);

    std::fclose(fp);
  }

  // ── State ─────────────────────────────────────────────────────────────────
  std::string m_outputDir; // empty → same directory as the input file
};

} // namespace hkp
