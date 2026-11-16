#pragma once

#include <string>
#include <vector>

#include "./llm_model.h"

/**
 * Service Documentation
 * Service ID: detokenize
 * Service Name: Detokenize
 * Runtime: hkp-rt
 * Modes: one — token ids back to text
 * Key Config: model (hkp-asset://…)
 * IO: in=JSON { tokens, promptTokens? }
 *     -> out=JSON { tokens, pieces, promptTokens, text, end }
 * Arrays: n/a
 * Binary: not supported
 * MixedData: not supported
 */
namespace hkp {

// Detokenize — token ids become text again.
//
// The last step of a round, and what a Loop around it asks its condition of:
//
//   text   what has been generated so far — the tokens after the prompt, with
//          control tokens left out
//   end    whether the last token is one the model ends its turn with
//
// `pieces` is filled in for every token, so the whole sequence can be shown
// with its cuts. A piece is the token on its own: a character spread over two
// tokens shows as two replacement marks there and whole in `text`.
class Detokenize : public llm::ModelService
{
public:
  static std::string serviceId() { return "detokenize"; }

  explicit Detokenize(const std::string& instanceId)
    : ModelService(instanceId, "detokenize")
  {}

  std::string getServiceId() const override { return serviceId(); }

  json configure(Data data) override
  {
    ModelService::configure(data);
    return getState();
  }

  json getState() const override { return withModelState(json::object()); }

  Data process(Data data) override
  {
    auto j = getJSONFromData(data);
    auto tokens = j ? llm::tokensOf(*j) : std::nullopt;
    if (!tokens)
      return fail("expected { tokens }");

    std::string problem;
    auto model = this->model(problem);
    if (!model)
      return fail(problem);

#ifdef HKP_LLAMA_ENABLED
    size_t prompt = 0;
    if (j->contains("promptTokens") && (*j)["promptTokens"].is_number_unsigned())
      prompt = std::min((*j)["promptTokens"].get<size_t>(), tokens->size());

    json pieces = json::array();
    std::string generated;
    for (size_t i = 0; i < tokens->size(); ++i)
    {
      const auto token = (*tokens)[i];
      if (!model->known(token))
        return fail("token " + std::to_string(token) + " is not in this model's vocabulary");
      pieces.push_back(model->piece(token));
      if (i >= prompt)
        generated += model->bytes(token, false);
    }
    const bool end = tokens->size() > prompt &&
                     llama_vocab_is_eog(model->vocab, tokens->back());

    json out = *j;
    out["pieces"] = pieces;
    out["promptTokens"] = prompt;
    out["text"] = llm::validUtf8(generated);
    out["end"] = end;
    return out;
#else
    return fail(llm::notCompiledIn());
#endif
  }
};

} // namespace hkp
