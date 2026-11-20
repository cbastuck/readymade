#pragma once

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cstring>
#include <functional>
#include <iostream>
#include <limits>
#include <memory>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

#include <assets.h>
#include <service.h>
#include <types/data.h>
#include <types/types.h>

#include "../runtime_host.h"

#ifdef HKP_LLAMA_ENABLED
  #include <llama.h>
#endif

// What the services that lay a language model out on a board share: the model
// itself, how a service comes by it, and the values they pass each other.
//
// `text-generation` does in one call what these do in five: chat-template,
// tokenize, llm-decode, sample, detokenize. Each is one llama.cpp call on a
// real model, cut where llama.cpp's own API cuts.
//
// **The model** is a board asset, named from every one of them as
// `hkp-asset://<id>`. The asset store resolves it to a file once per server
// and its model cache loads that file once per runtime, so five services
// naming one model hold one model.
//
// **Tokens** travel as JSON:
//
//   { "tokens": [151644, 872], "pieces": ["<|im_start|>", "user"],
//     "promptTokens": 2 }
//
// `tokens` is what the model reads, `pieces` what a panel shows, and
// `promptTokens` how many of them were the prompt — the rest were generated.
//
// **Scores** travel as MixedData: one float32 per vocabulary entry, with the
// tokens they follow and what has been done to them so far beside it. A
// candidate a sampler removed is -infinity, so the order of the entries never
// changes and every sampler reads the same shape it writes.
namespace hkp {
namespace llm {

inline const char* notCompiledIn()
{
  return "llama.cpp is not compiled in — rebuild hkp-rt with -DHKP_LLAMA_ENABLED=ON";
}

// `bytes` as text a JSON value can hold. A token is a run of bytes, and a
// character of more than one byte may be split between two of them; what is
// not a whole character on its own is shown as U+FFFD.
inline std::string validUtf8(const std::string& bytes)
{
  std::string out;
  out.reserve(bytes.size());
  size_t i = 0;
  while (i < bytes.size())
  {
    const auto lead = static_cast<unsigned char>(bytes[i]);
    size_t length = lead < 0x80 ? 1 : (lead >> 5) == 0x6 ? 2 : (lead >> 4) == 0xE ? 3
                    : (lead >> 3) == 0x1E ? 4 : 0;
    bool whole = length > 0 && i + length <= bytes.size();
    for (size_t k = 1; whole && k < length; ++k)
    {
      whole = (static_cast<unsigned char>(bytes[i + k]) & 0xC0) == 0x80;
    }
    // Encodings longer than they need to be, surrogates and what lies past
    // the last code point are not characters either.
    if (whole && length > 1)
    {
      const auto second = static_cast<unsigned char>(bytes[i + 1]);
      whole = !(length == 2 && lead < 0xC2) &&
              !(length == 3 && lead == 0xE0 && second < 0xA0) &&
              !(length == 3 && lead == 0xED && second > 0x9F) &&
              !(length == 4 && lead == 0xF0 && second < 0x90) &&
              !(length == 4 && (lead > 0xF4 || (lead == 0xF4 && second > 0x8F)));
    }
    if (whole)
    {
      out.append(bytes, i, length);
      i += length;
    }
    else
    {
      out += "\xEF\xBF\xBD";
      ++i;
    }
  }
  return out;
}

// The token ids a tokens value carries, or nothing when it is not one.
inline std::optional<std::vector<int32_t>> tokensOf(const json& value)
{
  if (!value.is_object() || !value.contains("tokens") || !value["tokens"].is_array())
  {
    return std::nullopt;
  }
  std::vector<int32_t> ids;
  ids.reserve(value["tokens"].size());
  for (const auto& entry : value["tokens"])
  {
    if (!entry.is_number_integer())
    {
      return std::nullopt;
    }
    ids.push_back(entry.get<int32_t>());
  }
  return ids;
}

inline constexpr float kRemoved = -std::numeric_limits<float>::infinity();

// The scores a value carries, when it has exactly one per vocabulary entry.
inline std::optional<std::vector<float>> scoresOf(const MixedData& value, size_t vocabulary)
{
  if (value.binary.size() != vocabulary * sizeof(float))
  {
    return std::nullopt;
  }
  std::vector<float> scores(vocabulary);
  std::memcpy(scores.data(), value.binary.data(), value.binary.size());
  return scores;
}

inline BinaryData bytesOf(const std::vector<float>& scores)
{
  BinaryData bytes(scores.size() * sizeof(float));
  std::memcpy(bytes.data(), scores.data(), bytes.size());
  return bytes;
}

struct Candidate
{
  int32_t token;
  float score;
  double probability;
};

// The `count` most likely tokens among those still in the running, with the
// probability each has among them.
inline std::vector<Candidate> mostLikely(const std::vector<float>& scores, size_t count,
                                         size_t* remaining = nullptr)
{
  float highest = kRemoved;
  size_t left = 0;
  for (const float score : scores)
  {
    if (score > kRemoved)
    {
      highest = std::max(highest, score);
      ++left;
    }
  }
  if (remaining)
  {
    *remaining = left;
  }
  std::vector<Candidate> best;
  if (left == 0)
  {
    return best;
  }
  double sum = 0;
  for (const float score : scores)
  {
    if (score > kRemoved)
    {
      sum += std::exp(static_cast<double>(score - highest));
    }
  }
  std::vector<int32_t> order;
  order.reserve(left);
  for (size_t i = 0; i < scores.size(); ++i)
  {
    if (scores[i] > kRemoved)
    {
      order.push_back(static_cast<int32_t>(i));
    }
  }
  count = std::min(count, order.size());
  std::partial_sort(order.begin(), order.begin() + count, order.end(),
                    [&](int32_t a, int32_t b) { return scores[a] > scores[b]; });
  for (size_t i = 0; i < count; ++i)
  {
    const float score = scores[order[i]];
    best.push_back({ order[i], score, std::exp(static_cast<double>(score - highest)) / sum });
  }
  return best;
}

#ifdef HKP_LLAMA_ENABLED

// A GGUF file, loaded. One per runtime and file, shared through the asset
// store's model cache; the last service to let go of it frees it.
struct Model
{
  llama_model* model = nullptr;
  const llama_vocab* vocab = nullptr;
  std::string sha256;

  ~Model()
  {
    if (model)
    {
      llama_model_free(model);
    }
  }

  size_t vocabulary() const { return static_cast<size_t>(llama_vocab_n_tokens(vocab)); }

  // The bytes a token stands for. `special` shows the control tokens a chat
  // template puts around a message, which are otherwise nothing.
  std::string bytes(int32_t token, bool special) const
  {
    char piece[256];
    int n = llama_token_to_piece(vocab, token, piece, sizeof(piece), 0, special);
    if (n >= 0)
    {
      return std::string(piece, n);
    }
    std::string longer(static_cast<size_t>(-n), '\0');
    n = llama_token_to_piece(vocab, token, longer.data(), static_cast<int32_t>(longer.size()),
                             0, special);
    return n >= 0 ? longer.substr(0, n) : std::string();
  }

  // A token as a panel shows it.
  std::string piece(int32_t token) const { return validUtf8(bytes(token, true)); }

  bool known(int32_t token) const
  {
    return token >= 0 && static_cast<size_t>(token) < vocabulary();
  }

  json candidates(const std::vector<Candidate>& best) const
  {
    json list = json::array();
    for (const auto& candidate : best)
    {
      list.push_back(json{ { "token", candidate.token },
                           { "piece", piece(candidate.token) },
                           { "p", candidate.probability } });
    }
    return list;
  }
};

inline std::shared_ptr<Model> loadModel(const std::string& path, const std::string& sha256)
{
  static std::once_flag backendOnce;
  std::call_once(backendOnce, []
  {
    llama_log_set([](ggml_log_level level, const char* text, void*)
    {
      if (level >= GGML_LOG_LEVEL_ERROR)
      {
        std::cerr << text;
      }
    }, nullptr);
    llama_backend_init();
  });

  auto params = llama_model_default_params();
  params.n_gpu_layers = -1; // every layer, where there is something to offload to
  auto loaded = std::make_shared<Model>();
  loaded->model = llama_model_load_from_file(path.c_str(), params);
  if (!loaded->model)
  {
    throw std::runtime_error("the file is not a model llama.cpp can load");
  }
  loaded->vocab = llama_model_get_vocab(loaded->model);
  loaded->sha256 = sha256;
  return loaded;
}

#else

// Nothing to load without llama.cpp; the type exists so the services read the
// same either way.
struct Model
{
};

#endif // HKP_LLAMA_ENABLED

// A service of the pipeline: one that names a model and says where it is with
// it. The model is fetched and loaded on a thread of its own — a first use
// downloads it, which takes minutes — and until it is there the service passes
// nothing on and says why.
//
// State, beside the service's own:
//   model     "hkp-asset://<id>", an asset that says its sha256
//   status    idle | fetching | loading | ready | error   (read-only)
//   progress  0…1 while fetching, when the source says its size (read-only)
//   fetched   the same as text, "76%", for a panel to show     (read-only)
//   problem   why status is error                          (read-only)
class ModelService : public Service
{
public:
  ModelService(const std::string& instanceId, const std::string& instanceName)
    : Service(instanceId, instanceName)
  {}

  ~ModelService() { stopLoading(); }

  void shutdown() override { stopLoading(); }

  json configure(Data data) override
  {
    if (auto j = getJSONFromData(data))
    {
      if (j->contains("model") && (*j)["model"].is_string())
      {
        const auto reference = (*j)["model"].get<std::string>();
        bool changed = false;
        {
          std::lock_guard lock(m_use.mutex);
          changed = reference != m_use.reference;
        }
        if (changed)
        {
          useModel(reference);
        }
      }
    }
    return Service::configure(data);
  }

protected:
  // The service's own state with the model's beside it.
  json withModelState(json own) const
  {
    std::lock_guard lock(m_use.mutex);
    own["model"] = m_use.reference;
    own["status"] = m_use.status;
    own["problem"] = m_use.problem;
    if (m_use.status == "fetching" && m_use.progress >= 0)
    {
      own["progress"] = m_use.progress;
    }
    own["fetched"] = fetchedText(m_use.status, m_use.progress);
    return mergeStateWith(own);
  }

  // The model, or nothing with the reason in `problem`.
  std::shared_ptr<Model> model(std::string& problem) const
  {
    std::lock_guard lock(m_use.mutex);
    if (m_use.loaded)
    {
      return m_use.loaded;
    }
    if (m_use.reference.empty())
    {
      problem = "no model is named";
    }
    else if (m_use.status == "error")
    {
      problem = m_use.problem;
    }
    else
    {
      problem = "the model is not loaded yet (" + m_use.status + ")";
    }
    return nullptr;
  }

  // Why this call passes nothing on: reported, logged, and nothing returned.
  Data fail(const std::string& problem)
  {
    sendNotification(json{ { "error", problem } });
    log(LogLevel::Error, "service.failed", json{ { "message", problem } });
    return Null();
  }

  // Called when the model a service holds is replaced or let go of, before it
  // is — for what a service built on it.
  virtual void modelChanged() {}

private:
  // How much of the model has arrived, as a panel shows it: "76%" while it is
  // being fetched, and nothing otherwise.
  static std::string fetchedText(const std::string& status, double progress)
  {
    if (status != "fetching")
      return "";
    return progress >= 0 ? std::to_string(static_cast<int>(progress * 100)) + "%" : "…";
  }

  struct Use
  {
    mutable std::mutex mutex;
    std::string reference;
    std::string status = "idle";
    std::string problem;
    double progress = -1;
    std::shared_ptr<Model> loaded;
  };

  void set(const std::string& status, const std::string& problem = "", double progress = -1)
  {
    json said;
    {
      std::lock_guard lock(m_use.mutex);
      m_use.status = status;
      m_use.problem = problem;
      m_use.progress = progress;
      said = json{ { "status", status }, { "problem", problem },
                   { "fetched", fetchedText(status, progress) } };
      if (progress >= 0)
      {
        said["progress"] = progress;
      }
    }
    sendNotification(said);
  }

  void stopLoading()
  {
    m_cancel = true;
    if (m_loader.joinable())
    {
      m_loader.join();
    }
    m_cancel = false;
  }

  void useModel(const std::string& reference)
  {
    stopLoading();
    modelChanged();
    {
      std::lock_guard lock(m_use.mutex);
      m_use.reference = reference;
      m_use.loaded.reset();
    }
    if (reference.empty())
    {
      return set("idle");
    }
#ifndef HKP_LLAMA_ENABLED
    set("error", notCompiledIn());
#else
    auto* host = parentHost();
    AssetStore* store = host ? host->assets() : nullptr;
    if (!store)
    {
      return set("error", "this runtime keeps no assets");
    }
    set("fetching");
    m_loader = std::thread([this, store, reference]()
    {
      try
      {
        auto lastSaid = std::chrono::steady_clock::now();
        const auto file = store->resolvePath(reference,
          [&](std::uint64_t received, std::optional<std::uint64_t> expected)
          {
            if (m_cancel)
            {
              throw std::runtime_error("no longer wanted");
            }
            const auto now = std::chrono::steady_clock::now();
            if (expected && *expected > 0 && now - lastSaid >= std::chrono::milliseconds(250))
            {
              lastSaid = now;
              set("fetching", "", static_cast<double>(received) / static_cast<double>(*expected));
            }
          });
        if (m_cancel)
        {
          return;
        }
        if (!file.problem.empty())
        {
          return set("error", file.problem);
        }
        set("loading");
        auto loaded = store->models.acquire<Model>(
          "llama:" + file.sha256,
          [&]() { return loadModel(file.path, file.sha256); });
        {
          std::lock_guard lock(m_use.mutex);
          m_use.loaded = std::move(loaded);
        }
        set("ready");
      }
      catch (const std::exception& error)
      {
        set("error", std::string("the model could not be loaded: ") + error.what());
      }
    });
#endif
  }

  Use m_use;
  std::thread m_loader;
  std::atomic<bool> m_cancel{ false };
};

} // namespace llm
} // namespace hkp
