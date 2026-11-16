#pragma once

#include <string>
#include <vector>

#include "./llm_model.h"

/**
 * Service Documentation
 * Service ID: tokenize
 * Service Name: Tokenize
 * Runtime: hkp-rt
 * Modes: one — text to the token ids a model reads
 * Key Config: model (hkp-asset://…), addSpecial, parseSpecial
 * IO: in=String or JSON ({text} | {prompt})
 *     -> out=JSON { tokens: [id…], pieces: [text…], promptTokens }
 * Arrays: n/a
 * Binary: not supported
 * MixedData: not supported
 */
namespace hkp {

// Tokenize — a string becomes token ids.
//
// A model does not read characters. Its vocabulary is a fixed list of pieces —
// whole words, parts of words, single bytes, control tokens — and text is cut
// into the longest pieces that list holds. `pieces` shows where the cuts fell;
// `tokens` is what the model is given.
//
// `addSpecial` puts the model's beginning-of-text token in front where the
// model wants one. `parseSpecial` reads control tokens written out in the text
// (`<|im_start|>`) as the single tokens they are, which a chat template's
// output needs; without it they are cut up like any other text.
//
// Everything this hands on counts as the prompt: `promptTokens` is how many
// tokens there are, so that what is appended later can be told from it.
class Tokenize : public llm::ModelService
{
public:
  static std::string serviceId() { return "tokenize"; }

  explicit Tokenize(const std::string& instanceId)
    : ModelService(instanceId, "tokenize")
  {}

  std::string getServiceId() const override { return serviceId(); }

  json configure(Data data) override
  {
    if (auto j = getJSONFromData(data))
    {
      if (j->contains("addSpecial") && (*j)["addSpecial"].is_boolean())
        m_addSpecial = (*j)["addSpecial"].get<bool>();
      if (j->contains("parseSpecial") && (*j)["parseSpecial"].is_boolean())
        m_parseSpecial = (*j)["parseSpecial"].get<bool>();
    }
    ModelService::configure(data);
    return getState();
  }

  json getState() const override
  {
    return withModelState(json{
      { "addSpecial", m_addSpecial },
      { "parseSpecial", m_parseSpecial },
    });
  }

  Data process(Data data) override
  {
    std::optional<std::string> text;
    if (auto plain = getStringFromData(data))
      text = *plain;
    else if (auto j = getJSONFromData(data); j && j->is_object())
    {
      if (j->value("text", json()).is_string())
        text = (*j)["text"].get<std::string>();
      else if (j->value("prompt", json()).is_string())
        text = (*j)["prompt"].get<std::string>();
    }
    if (!text)
      return fail("expected text, { text } or { prompt }");

    std::string problem;
    auto model = this->model(problem);
    if (!model)
      return fail(problem);

#ifdef HKP_LLAMA_ENABLED
    const auto length = static_cast<int32_t>(text->size());
    const int count = -llama_tokenize(model->vocab, text->c_str(), length, nullptr, 0,
                                      m_addSpecial, m_parseSpecial);
    std::vector<llama_token> tokens(std::max(count, 0));
    if (count < 0 || llama_tokenize(model->vocab, text->c_str(), length, tokens.data(),
                                    static_cast<int32_t>(tokens.size()),
                                    m_addSpecial, m_parseSpecial) < 0)
      return fail("the text could not be tokenized");

    json pieces = json::array();
    for (const auto token : tokens)
      pieces.push_back(model->piece(token));
    sendNotification(json{ { "count", tokens.size() }, { "pieces", pieces } });
    return json{
      { "tokens", tokens },
      { "pieces", pieces },
      { "promptTokens", tokens.size() },
    };
#else
    return fail(llm::notCompiledIn());
#endif
  }

private:
  bool m_addSpecial = true;
  bool m_parseSpecial = true;
};

} // namespace hkp
