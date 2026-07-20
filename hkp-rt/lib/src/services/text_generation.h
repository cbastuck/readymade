#pragma once

#include <memory>
#include <string>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

/**
 * Service Documentation
 * Service ID: text-generation
 * Service Name: TextGeneration
 * Runtime: hkp-rt
 * Modes: chat, via one of two backends selected by the `backend` state:
 *        server (default) — OpenAI-compatible /v1/chat/completions client
 *        local            — loads a GGUF in-process via embedded llama.cpp
 * Key Config: backend (server|local),
 *             serverUrl (server backend: base URL of an OpenAI-compatible server),
 *             model (optional model name passed through to the server),
 *             modelPath (local backend: path to a .gguf file),
 *             contextSize, gpuLayers (local backend),
 *             systemPrompt, temperature, topP, topK, maxTokens, timeoutSec,
 *             stream (default true — generate token by token and notify the
 *             growing text as {streamText} for live chat-bot-style display;
 *             the pipeline output is unaffected and still emitted once, when
 *             generation finishes)
 * IO: in=String (the prompt) or JSON ({prompt} | {text} | {messages: [...]})
 *     -> out=JSON { text, thinking?, model, durationMs,
 *                   usage: { promptTokens, completionTokens } }
 * Arrays: n/a
 * Binary: not supported; non-text inputs yield an error JSON
 * MixedData: not supported
 *
 * Server backend: the service is a thin client — the model runs in a separate
 * process that speaks the OpenAI chat-completions API (llama-server, Ollama,
 * vLLM, LM Studio, ...). Always available; this is the only way to run quants
 * that need a custom llama.cpp build.
 *
 * Local backend: standard GGUFs (Qwen, Llama, ...) load directly into this
 * process via the embedded llama.cpp. Compiled in only when the runtime is
 * built with -DHKP_LLAMA_ENABLED=ON (the default on desktop platforms); the
 * model is loaded lazily on first use and reloaded when modelPath /
 * contextSize / gpuLayers change.
 *
 * The `{text}` input shape is deliberate: the speech-to-text service's output
 * pipes straight in.
 */
namespace hkp {

struct TextGenerationImpl;

class TextGeneration : public Service
{
public:
  static std::string serviceId() { return "text-generation"; }

  explicit TextGeneration(const std::string& instanceId);
  ~TextGeneration();

  json configure(Data data) override;
  std::string getServiceId() const override;
  json getState() const override;
  Data process(Data data) override;

private:
  std::unique_ptr<TextGenerationImpl> m_impl;
};

}
