#include "./tts_inflect.h"

#ifdef HKP_INFLECT_ENABLED

#include <exception>
#include <filesystem>

#include "inflect/engine.h"

namespace hkp {

namespace inflect_detail {

// Keeps the inflect header out of tts_inflect.h, which the service includes
// unconditionally: its ONNX Runtime include would then be required on builds
// that do not compile this backend in.
class EngineHolder
{
public:
  std::unique_ptr<::inflect::Engine> engine;
};

} // namespace inflect_detail

namespace {

// Both model graphs, named as the engine expects to find them.
bool modelFilesPresent(const std::string& modelDir, std::string& missing)
{
  const std::filesystem::path root(modelDir);
  for (const char* name : { "duration.onnx", "decode.onnx" })
  {
    const auto file = root / "onnx" / name;
    std::error_code ec;
    if (!std::filesystem::exists(file, ec))
    {
      missing = file.string();
      return false;
    }
  }
  return true;
}

} // namespace

LocalInflect::LocalInflect()
  : m_holder(std::make_unique<inflect_detail::EngineHolder>())
{
}

LocalInflect::~LocalInflect() = default;

std::string LocalInflect::key() const
{
  return modelDir + "|" + espeakDataPath + "|" + std::to_string(numThreads);
}

void LocalInflect::invalidateIfStale()
{
  if (m_holder->engine && m_loadedKey != key())
  {
    release();
  }
}

bool LocalInflect::isLoaded() const
{
  return m_holder->engine != nullptr;
}

void LocalInflect::release()
{
  m_holder->engine.reset();
  m_loadedKey.clear();
}

std::string LocalInflect::ensure()
{
  if (m_holder->engine)
  {
    return {};
  }

  if (modelDir.empty())
  {
    return "inflect backend needs modelDir (a directory holding onnx/duration.onnx and onnx/decode.onnx)";
  }
  std::string missing;
  if (!modelFilesPresent(modelDir, missing))
  {
    return "inflect model file not found: " + missing;
  }
  if (espeakDataPath.empty())
  {
    return "inflect backend needs espeakDataPath (an espeak-ng-data directory)";
  }
  {
    std::error_code ec;
    if (!std::filesystem::exists(espeakDataPath, ec))
    {
      return "espeakDataPath not found: " + espeakDataPath;
    }
  }

  try
  {
    m_holder->engine = std::make_unique<::inflect::Engine>(modelDir, espeakDataPath, numThreads);
  }
  catch (const std::exception& e)
  {
    m_holder->engine.reset();
    return std::string("failed to load the inflect model: ") + e.what();
  }

  m_loadedKey = key();
  return {};
}

InflectSynthesis LocalInflect::generate(const std::string& text, double speed)
{
  InflectSynthesis out;
  out.sampleRate = ::inflect::kSampleRate;

  if (!m_holder->engine)
  {
    out.error = "inflect engine is not loaded";
    return out;
  }

  ::inflect::SynthesisOptions options;
  options.speed = static_cast<float>(speed);
  options.variation = static_cast<float>(variation);
  options.seed = static_cast<std::int64_t>(seed);
  options.split_on_abbreviations = splitOnAbbreviations;

  try
  {
    out.samples = m_holder->engine->Synthesize(text, options);
  }
  catch (const std::exception& e)
  {
    out.error = std::string("synthesis failed: ") + e.what();
  }
  return out;
}

}

#endif // HKP_INFLECT_ENABLED
