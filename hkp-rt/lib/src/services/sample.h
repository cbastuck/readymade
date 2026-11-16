#pragma once

#include <cstdlib>
#include <string>
#include <vector>

#include "./llm_model.h"

/**
 * Service Documentation
 * Service ID: sample
 * Service Name: Sample
 * Runtime: hkp-rt
 * Modes: repetition-penalty | top-k | top-p | min-p | temperature — scores to
 *        scores; pick | greedy — scores to tokens, one appended
 * Key Config: model (hkp-asset://…), mode, k, p, minP, temperature,
 *             penalty, lastN, seed, top
 * IO: in=MixedData scores (as llm-decode or another sample hands them on)
 *     -> out=MixedData scores, or JSON { tokens, pieces, … } for pick / greedy
 * Arrays: n/a
 * Binary: not supported on its own
 * MixedData: its input, and its output in the modes that do not choose
 */
namespace hkp {

// Sample — one step of choosing the next token.
//
// The model hands over a score for every entry of its vocabulary. What happens
// between that and one token being chosen is a chain of small steps, and each
// instance of this service is one of them, by `mode`. The order on the board
// is the order they are applied in — each wraps the llama.cpp sampler of the
// same name.
//
//   repetition-penalty  lowers the scores of tokens among the last `lastN`
//   top-k               keeps the `k` highest
//   top-p               keeps the most likely until their probabilities sum to `p`
//   min-p               keeps what is at least `minP` as likely as the best
//   temperature         divides the scores: below 1 sharper, above 1 flatter
//   pick                chooses one at random, by probability, and appends it
//   greedy              chooses the highest, and appends it
//
// A step that narrows removes candidates; it does not reorder the scores. A
// removed candidate is -infinity, so the next step reads the shape this one
// wrote. `pick` and `greedy` end the chain: what leaves them is tokens again,
// one longer.
//
// Each call reports how many candidates are left and the `top` most likely of
// them, which is what makes a step's effect visible: put the same report from
// `llm-decode` beside it.
class Sample : public llm::ModelService
{
public:
  static std::string serviceId() { return "sample"; }

  explicit Sample(const std::string& instanceId)
    : ModelService(instanceId, "sample")
  {}

  ~Sample() { release(); }

  std::string getServiceId() const override { return serviceId(); }

  void shutdown() override
  {
    ModelService::shutdown();
    release();
  }

  json configure(Data data) override
  {
    if (auto j = getJSONFromData(data))
    {
      if (j->contains("mode") && (*j)["mode"].is_string())
      {
        const auto mode = (*j)["mode"].get<std::string>();
        if (!isMode(mode))
          throw std::runtime_error("sample: unknown mode '" + mode + "'");
        m_mode = mode;
      }
      number(*j, "k", m_k, 0);
      number(*j, "p", m_p, 0);
      number(*j, "minP", m_minP, 0);
      number(*j, "temperature", m_temperature, 0);
      number(*j, "penalty", m_penalty, 0);
      number(*j, "lastN", m_lastN, 0);
      number(*j, "top", m_top, 0);
      if (j->contains("seed"))
      {
        const auto& seed = (*j)["seed"];
        m_seed = seed.is_number_unsigned() ? std::optional<uint32_t>(seed.get<uint32_t>())
                                           : std::nullopt;
      }
      // Whatever changed, the sampler is made again from what holds now.
      release();
    }
    ModelService::configure(data);
    return getState();
  }

  json getState() const override
  {
    return withModelState(json{
      { "mode", m_mode },
      { "k", m_k },
      { "p", m_p },
      { "minP", m_minP },
      { "temperature", m_temperature },
      { "penalty", m_penalty },
      { "lastN", m_lastN },
      { "seed", m_seed ? json(*m_seed) : json(nullptr) },
      { "top", m_top },
    });
  }

  Data process(Data data) override
  {
    auto input = getMixedDataFromData(data);
    if (!input)
      return fail("expected scores, as llm-decode hands them on");

    std::string problem;
    auto model = this->model(problem);
    if (!model)
      return fail(problem);

#ifdef HKP_LLAMA_ENABLED
    auto scores = llm::scoresOf(*input, model->vocabulary());
    if (!scores)
      return fail("these scores are not for this model's vocabulary");
    auto tokens = llm::tokensOf(input->meta);
    if (!tokens)
      return fail("the scores do not say which tokens they follow");

    // The candidates still in the running, as llama.cpp's samplers take them.
    std::vector<llama_token_data> candidates;
    candidates.reserve(scores->size());
    for (size_t i = 0; i < scores->size(); ++i)
    {
      if ((*scores)[i] > llm::kRemoved)
        candidates.push_back({ static_cast<llama_token>(i), (*scores)[i], 0.0f });
    }
    if (candidates.empty())
      return fail("no candidate is left to choose from");
    llama_token_data_array array{ candidates.data(), candidates.size(), -1, false };

    const bool chooses = m_mode == "pick" || m_mode == "greedy";
    if (m_mode == "repetition-penalty")
    {
      // Made for each call: what it penalises is this call's tokens.
      auto* penalties = llama_sampler_init_penalties(static_cast<int32_t>(m_lastN),
                                                     static_cast<float>(m_penalty), 0.0f, 0.0f);
      const size_t from = tokens->size() > static_cast<size_t>(m_lastN)
                            ? tokens->size() - static_cast<size_t>(m_lastN) : 0;
      for (size_t i = from; i < tokens->size(); ++i)
        llama_sampler_accept(penalties, (*tokens)[i]);
      llama_sampler_apply(penalties, &array);
      llama_sampler_free(penalties);
    }
    else
    {
      if (!m_sampler)
        m_sampler = make();
      llama_sampler_apply(m_sampler, &array);
    }

    if (chooses)
    {
      if (array.selected < 0 || static_cast<size_t>(array.selected) >= array.size)
        return fail("no token was chosen");
      const auto chosen = array.data[array.selected].id;
      const auto piece = model->piece(chosen);
      // How likely the chosen one was, among what it was chosen from.
      double probability = 0;
      for (const auto& candidate : llm::mostLikely(*scores, scores->size()))
      {
        if (candidate.token == chosen)
        {
          probability = candidate.probability;
          break;
        }
      }
      sendNotification(json{
        { "mode", m_mode },
        { "chosen", json{ { "token", chosen }, { "piece", piece }, { "p", probability } } },
        { "remaining", candidates.size() },
      });

      json out = input->meta;
      out.erase("applied");
      out["tokens"].push_back(chosen);
      if (out.contains("pieces") && out["pieces"].is_array())
        out["pieces"].push_back(piece);
      return out;
    }

    std::vector<float> narrowed(scores->size(), llm::kRemoved);
    for (size_t i = 0; i < array.size; ++i)
      narrowed[array.data[i].id] = array.data[i].logit;

    size_t remaining = 0;
    const auto best = llm::mostLikely(narrowed, m_top, &remaining);
    sendNotification(json{
      { "mode", m_mode },
      { "remaining", remaining },
      { "candidates", model->candidates(best) },
    });

    MixedData out;
    out.meta = input->meta;
    if (!out.meta.contains("applied") || !out.meta["applied"].is_array())
      out.meta["applied"] = json::array();
    out.meta["applied"].push_back(describe());
    out.binary = llm::bytesOf(narrowed);
    return out;
#else
    return fail(llm::notCompiledIn());
#endif
  }

  static bool isMode(const std::string& mode)
  {
    return mode == "repetition-penalty" || mode == "top-k" || mode == "top-p" ||
           mode == "min-p" || mode == "temperature" || mode == "pick" || mode == "greedy";
  }

private:
  // A number, or one written as text — which is how a facade knob sends its
  // value.
  template <typename T>
  static void number(const json& j, const char* key, T& into, double least)
  {
    if (!j.contains(key))
      return;
    std::optional<double> value;
    if (j[key].is_number())
      value = j[key].get<double>();
    else if (j[key].is_string())
    {
      const auto text = j[key].get<std::string>();
      char* end = nullptr;
      const double parsed = std::strtod(text.c_str(), &end);
      if (!text.empty() && end == text.c_str() + text.size())
        value = parsed;
    }
    if (value && std::isfinite(*value) && *value >= least)
      into = static_cast<T>(*value);
  }

  // The step as its scores say it was applied.
  std::string describe() const
  {
    auto trimmed = [](double value) {
      auto text = std::to_string(value);
      text.erase(text.find_last_not_of('0') + 1);
      if (!text.empty() && text.back() == '.')
        text.pop_back();
      return text;
    };
    if (m_mode == "top-k") return "top-k " + std::to_string(m_k);
    if (m_mode == "top-p") return "top-p " + trimmed(m_p);
    if (m_mode == "min-p") return "min-p " + trimmed(m_minP);
    if (m_mode == "temperature") return "temperature " + trimmed(m_temperature);
    if (m_mode == "repetition-penalty")
      return "repetition-penalty " + trimmed(m_penalty) + " over " + std::to_string(m_lastN);
    return m_mode;
  }

  void release()
  {
#ifdef HKP_LLAMA_ENABLED
    if (m_sampler)
    {
      llama_sampler_free(m_sampler);
      m_sampler = nullptr;
    }
#endif
  }

#ifdef HKP_LLAMA_ENABLED
  llama_sampler* make() const
  {
    if (m_mode == "top-k") return llama_sampler_init_top_k(m_k);
    if (m_mode == "top-p") return llama_sampler_init_top_p(static_cast<float>(m_p), 1);
    if (m_mode == "min-p") return llama_sampler_init_min_p(static_cast<float>(m_minP), 1);
    if (m_mode == "temperature") return llama_sampler_init_temp(static_cast<float>(m_temperature));
    if (m_mode == "greedy") return llama_sampler_init_greedy();
    // Kept between calls, so a seed gives one sequence of choices and not the
    // same choice every round.
    return llama_sampler_init_dist(m_seed ? *m_seed : LLAMA_DEFAULT_SEED);
  }

  llama_sampler*          m_sampler = nullptr;
#endif
  std::string             m_mode = "pick";
  int                     m_k = 40;
  double                  m_p = 0.95;
  double                  m_minP = 0.05;
  double                  m_temperature = 0.8;
  double                  m_penalty = 1.1;
  int                     m_lastN = 64;
  // None: a different sequence of choices each time.
  std::optional<uint32_t> m_seed;
  size_t                  m_top = 10;
};

} // namespace hkp
