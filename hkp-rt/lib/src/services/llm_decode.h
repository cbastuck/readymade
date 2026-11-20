#pragma once

#include <string>
#include <vector>

#include "./llm_model.h"

/**
 * Service Documentation
 * Service ID: llm-decode
 * Service Name: LlmDecode
 * Runtime: hkp-rt
 * Modes: one — the model's forward pass
 * Key Config: model (hkp-asset://…), contextSize, top
 * IO: in=JSON { tokens, … }
 *     -> out=MixedData: one float32 score per vocabulary entry, for the token
 *        that follows; meta = the input with `applied: []`
 * Arrays: n/a
 * Binary: not supported as input
 * MixedData: its output
 */
namespace hkp {

// LlmDecode — the forward pass: tokens in, one score per vocabulary entry out.
//
// This is where the model runs. Every token is looked up, taken through all of
// the model's layers, and what comes out for the last position is a score
// (logit) for each entry of the vocabulary: how much the model expects that
// token to come next. Nothing is chosen here.
//
// **It behaves as a function of its input**, and is fast for the reason that
// makes real models usable: it keeps the work it did for the tokens it has
// already seen (the KV cache) and runs only the ones that are new. In a
// generation loop that is one token per round. Tokens that begin differently
// from the last call's drop what no longer applies — so editing the prompt, or
// forcing another token halfway, costs only what follows the change.
//
// What it reports each call: how many tokens it ran and how many it had kept,
// and the `top` most likely next tokens with their probabilities — before any
// sampler has touched them.
class LlmDecode : public llm::ModelService
{
public:
  static std::string serviceId() { return "llm-decode"; }

  explicit LlmDecode(const std::string& instanceId)
    : ModelService(instanceId, "llm-decode")
  {}

  ~LlmDecode() { release(); }

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
      if (j->contains("contextSize") && (*j)["contextSize"].is_number() &&
          (*j)["contextSize"].get<double>() >= 16)
      {
        const auto size = static_cast<int>((*j)["contextSize"].get<double>());
        if (size != m_contextSize)
        {
          m_contextSize = size;
          release();
        }
      }
      if (j->contains("top") && (*j)["top"].is_number() && (*j)["top"].get<double>() >= 0)
        m_top = static_cast<size_t>((*j)["top"].get<double>());
      if (j->value("clear", json(false)) == json(true))
        release();
    }
    ModelService::configure(data);
    return getState();
  }

  json getState() const override
  {
    return withModelState(json{
      { "contextSize", m_contextSize },
      { "top", m_top },
      { "cached", m_cached.size() },
    });
  }

  Data process(Data data) override
  {
    auto j = getJSONFromData(data);
    auto tokens = j ? llm::tokensOf(*j) : std::nullopt;
    if (!tokens || tokens->empty())
      return fail("expected { tokens } with at least one token");

    std::string problem;
    auto model = this->model(problem);
    if (!model)
      return fail(problem);

#ifdef HKP_LLAMA_ENABLED
    for (const auto token : *tokens)
    {
      if (!model->known(token))
        return fail("token " + std::to_string(token) + " is not in this model's vocabulary");
    }
    if (tokens->size() > static_cast<size_t>(m_contextSize))
      return fail(std::to_string(tokens->size()) + " tokens do not fit a context of " +
                  std::to_string(m_contextSize));

    if (!m_ctx || m_model != model)
    {
      release();
      auto params = llama_context_default_params();
      params.n_ctx = static_cast<uint32_t>(m_contextSize);
      params.n_batch = static_cast<uint32_t>(m_contextSize);
      m_ctx = llama_init_from_model(model->model, params);
      if (!m_ctx)
        return fail("a context of " + std::to_string(m_contextSize) + " tokens could not be made");
      m_model = model;
    }

    // What the cache already holds of this input.
    size_t kept = 0;
    while (kept < m_cached.size() && kept < tokens->size() && m_cached[kept] == (*tokens)[kept])
      ++kept;
    // The scores come from running the last token, so at least that one runs.
    kept = std::min(kept, tokens->size() - 1);

    auto* memory = llama_get_memory(m_ctx);
    if (kept < m_cached.size() &&
        !llama_memory_seq_rm(memory, 0, static_cast<llama_pos>(kept), -1))
    {
      llama_memory_clear(memory, true);
      kept = 0;
    }
    m_cached.resize(kept);

    std::vector<llama_token> fresh(tokens->begin() + kept, tokens->end());
    if (llama_decode(m_ctx, llama_batch_get_one(fresh.data(), static_cast<int32_t>(fresh.size()))) != 0)
    {
      llama_memory_clear(memory, true);
      m_cached.clear();
      return fail("the model could not run these tokens");
    }
    m_cached = *tokens;

    const float* logits = llama_get_logits_ith(m_ctx, -1);
    if (!logits)
      return fail("the model produced no scores");
    std::vector<float> scores(logits, logits + model->vocabulary());

    sendNotification(json{
      { "decoded", fresh.size() },
      { "reused", kept },
      { "candidates", model->candidates(llm::mostLikely(scores, m_top)) },
    });

    MixedData out;
    out.meta = *j;
    out.meta["applied"] = json::array();
    out.binary = llm::bytesOf(scores);
    return out;
#else
    return fail(llm::notCompiledIn());
#endif
  }

protected:
  void modelChanged() override { release(); }

private:
  void release()
  {
#ifdef HKP_LLAMA_ENABLED
    if (m_ctx)
    {
      llama_free(m_ctx);
      m_ctx = nullptr;
    }
#endif
    m_model.reset();
    m_cached.clear();
  }

#ifdef HKP_LLAMA_ENABLED
  llama_context*              m_ctx = nullptr;
#endif
  // The model the context was made from, held for as long as the context is.
  std::shared_ptr<llm::Model> m_model;
  // The tokens the KV cache holds work for, in order.
  std::vector<int32_t>        m_cached;
  int                         m_contextSize = 4096;
  size_t                      m_top = 10;
};

} // namespace hkp
