#pragma once

#include <string>
#include <vector>

#include "./llm_model.h"

/**
 * Service Documentation
 * Service ID: chat-template
 * Service Name: ChatTemplate
 * Runtime: hkp-rt
 * Modes: one — the model's own chat template applied to a conversation
 * Key Config: model (hkp-asset://…), systemPrompt, addAssistant
 * IO: in=String (the user's message) or JSON ({prompt} | {text} | {messages: [...]})
 *     -> out=String, the prompt as the model reads it
 * Arrays: n/a
 * Binary: not supported
 * MixedData: not supported
 */
namespace hkp {

// ChatTemplate — messages become one prompt string.
//
// A chat model was trained on conversations written in one particular way:
// each message wrapped in control tokens that say who is speaking. The wrapping
// travels inside the model file. This service applies it, as `text-generation`
// does before anything else, and hands on the text — so what the model is
// really given can be read, control tokens and all.
//
// `addAssistant` ends the prompt where the assistant's turn begins, which is
// what makes the model answer rather than continue the user's message.
class ChatTemplate : public llm::ModelService
{
public:
  static std::string serviceId() { return "chat-template"; }

  explicit ChatTemplate(const std::string& instanceId)
    : ModelService(instanceId, "chat-template")
  {}

  std::string getServiceId() const override { return serviceId(); }

  json configure(Data data) override
  {
    if (auto j = getJSONFromData(data))
    {
      if (j->contains("systemPrompt") && (*j)["systemPrompt"].is_string())
        m_systemPrompt = (*j)["systemPrompt"].get<std::string>();
      if (j->contains("addAssistant") && (*j)["addAssistant"].is_boolean())
        m_addAssistant = (*j)["addAssistant"].get<bool>();
    }
    ModelService::configure(data);
    return getState();
  }

  json getState() const override
  {
    return withModelState(json{
      { "systemPrompt", m_systemPrompt },
      { "addAssistant", m_addAssistant },
    });
  }

  Data process(Data data) override
  {
    std::vector<std::pair<std::string, std::string>> messages;
    if (!m_systemPrompt.empty())
      messages.emplace_back("system", m_systemPrompt);

    if (auto text = getStringFromData(data))
    {
      messages.emplace_back("user", *text);
    }
    else if (auto j = getJSONFromData(data); j && j->is_object())
    {
      if (j->contains("messages") && (*j)["messages"].is_array())
      {
        for (const auto& message : (*j)["messages"])
        {
          if (message.is_object() && message.value("role", json()).is_string() &&
              message.value("content", json()).is_string())
            messages.emplace_back(message["role"].get<std::string>(),
                                  message["content"].get<std::string>());
        }
      }
      else if (j->value("prompt", json()).is_string())
        messages.emplace_back("user", (*j)["prompt"].get<std::string>());
      else if (j->value("text", json()).is_string())
        messages.emplace_back("user", (*j)["text"].get<std::string>());
    }
    if (messages.empty() || (messages.size() == 1 && !m_systemPrompt.empty()))
      return fail("expected text, { prompt }, { text } or { messages }");

    std::string problem;
    auto model = this->model(problem);
    if (!model)
      return fail(problem);

#ifdef HKP_LLAMA_ENABLED
    std::vector<llama_chat_message> raw;
    size_t length = 0;
    for (const auto& [role, content] : messages)
    {
      raw.push_back({ role.c_str(), content.c_str() });
      length += role.size() + content.size();
    }
    const char* tmpl = llama_model_chat_template(model->model, nullptr);
    std::vector<char> buffer(2048 + 2 * length);
    int written = llama_chat_apply_template(tmpl, raw.data(), raw.size(), m_addAssistant,
                                            buffer.data(), static_cast<int32_t>(buffer.size()));
    if (written > static_cast<int>(buffer.size()))
    {
      buffer.resize(written);
      written = llama_chat_apply_template(tmpl, raw.data(), raw.size(), m_addAssistant,
                                          buffer.data(), static_cast<int32_t>(buffer.size()));
    }
    if (written < 0)
      return fail("the model's chat template is not one llama.cpp knows");
    return std::string(buffer.data(), written);
#else
    return fail(llm::notCompiledIn());
#endif
  }

private:
  std::string m_systemPrompt;
  bool        m_addAssistant = true;
};

} // namespace hkp
