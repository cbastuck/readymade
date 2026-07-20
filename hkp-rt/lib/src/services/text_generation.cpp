#include "./text_generation.h"

#include <algorithm>
#include <chrono>
#include <functional>
#include <iostream>
#include <mutex>
#include <optional>
#include <string>
#include <vector>

#include <boost/beast/core.hpp>
#include <boost/beast/http.hpp>
#include <boost/beast/ssl.hpp>
#include <boost/beast/version.hpp>
#include <boost/asio/connect.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/asio/ssl/error.hpp>
#include <boost/asio/ssl/stream.hpp>
#include <boost/url.hpp>
#include <boost/url/scheme.hpp>

#include "./root_certificates.h"

#ifdef HKP_LLAMA_ENABLED
  #include <llama.h>
#endif

namespace beast = boost::beast;
namespace http = beast::http;
namespace net = boost::asio;
namespace ssl = net::ssl;
namespace urls = boost::urls;
using tcp = net::ip::tcp;

namespace hkp {

namespace {

const std::string kDefaultServerUrl = "http://127.0.0.1:8081";

constexpr int kDefaultContextSize = 4096;
constexpr int kDefaultGpuLayers = -1; // -1 = offload every layer

// Sensible generic chat settings; they match the hkp-python service so a board
// can move a text-generation service between the two runtimes unchanged.
const std::string kDefaultSystemPrompt = "You are a helpful assistant";
constexpr double kDefaultTemperature = 0.7;
constexpr double kDefaultTopP = 0.95;
constexpr int kDefaultTopK = 20;
constexpr int kDefaultMaxTokens = 512;
constexpr double kDefaultTimeoutSec = 300.0;

const std::string kThinkOpen = "<think>";
const std::string kThinkClose = "</think>";

// ~20 updates/s is plenty for a live view and keeps the notification socket
// calm at high token rates.
constexpr auto kStreamNotifyInterval = std::chrono::milliseconds(50);

const std::string kBuildHint =
  "the local backend is not compiled in — rebuild hkp-rt with -DHKP_LLAMA_ENABLED=ON";

std::string serverHint(const std::string& serverUrl)
{
  return "no OpenAI-compatible server reachable at " + serverUrl +
         " — start one, e.g.: llama-server -m model.gguf --port 8081 -ngl 99";
}

std::string expandUser(const std::string& path)
{
  if (path.rfind("~/", 0) != 0)
  {
    return path;
  }
  const char* home = std::getenv("HOME");
  return home ? home + path.substr(1) : path;
}

std::string trim(const std::string& s)
{
  auto begin = s.find_first_not_of(" \t\r\n");
  if (begin == std::string::npos)
  {
    return {};
  }
  auto end = s.find_last_not_of(" \t\r\n");
  return s.substr(begin, end - begin + 1);
}

// ── Server backend: OpenAI-compatible chat completions over HTTP ─────────────

// Feed a server-sent-event body fragment through the SSE framing and hand each
// complete `data:` payload to onEvent.  Returns false once the `[DONE]`
// sentinel has been seen.  `pending` carries the partial trailing line between
// calls.
bool consumeSseFragment(std::string& pending,
                        const std::string& fragment,
                        const std::function<void(const std::string&)>& onEvent)
{
  pending += fragment;
  std::size_t newline = 0;
  while ((newline = pending.find('\n')) != std::string::npos)
  {
    auto line = trim(pending.substr(0, newline));
    pending.erase(0, newline + 1);
    if (line.rfind("data:", 0) != 0)
    {
      continue;
    }
    auto payload = trim(line.substr(5));
    if (payload == "[DONE]")
    {
      return false;
    }
    onEvent(payload);
  }
  return true;
}

// An error reported by the server itself, as opposed to a transport failure.
// Distinct from the boost exceptions (which derive from std::runtime_error) so
// that the server's own message can be surfaced verbatim while transport
// failures get the "is a server running?" hint.
struct ServerError : std::exception
{
  explicit ServerError(std::string what) : message(std::move(what)) {}
  const char* what() const noexcept override { return message.c_str(); }
  std::string message;
};

// Fold streamed completion chunks into a response of the same shape as a
// non-streaming call, so both paths share the result extraction.
json parseStreamChunks(const std::vector<json>& chunks)
{
  std::string content;
  std::string reasoning;
  std::string model;
  json usage = json::object();

  for (const auto& chunk : chunks)
  {
    if (!chunk.is_object())
    {
      continue;
    }
    if (chunk.contains("model") && chunk["model"].is_string())
    {
      model = chunk["model"];
    }
    if (chunk.contains("usage") && chunk["usage"].is_object())
    {
      usage = chunk["usage"];
    }
    if (!chunk.contains("choices") || !chunk["choices"].is_array() || chunk["choices"].empty())
    {
      continue;
    }
    const auto& choice = chunk["choices"][0];
    if (!choice.contains("delta") || !choice["delta"].is_object())
    {
      continue;
    }
    const auto& delta = choice["delta"];
    if (delta.contains("reasoning_content") && delta["reasoning_content"].is_string())
    {
      reasoning += delta["reasoning_content"].get<std::string>();
    }
    if (delta.contains("content") && delta["content"].is_string())
    {
      content += delta["content"].get<std::string>();
    }
  }

  json message = { { "role", "assistant" }, { "content", content } };
  if (!reasoning.empty())
  {
    message["reasoning_content"] = reasoning;
  }
  json response = { { "choices", json::array({ json{ { "message", message } } }) } };
  if (!model.empty())
  {
    response["model"] = model;
  }
  if (!usage.empty())
  {
    response["usage"] = usage;
  }
  return response;
}

// Run one chat-completion request over an already-connected stream.  In
// streaming mode onText receives the growing assistant text; the return value
// is a non-streaming-shaped response either way.  Throws on transport errors.
template <typename Stream>
json chatCompletion(Stream& stream,
                    const std::string& host,
                    const std::string& target,
                    const std::string& payload,
                    bool streaming,
                    const std::function<void(const std::string&)>& onText)
{
  http::request<http::string_body> req{ http::verb::post, target, 11 };
  req.set(http::field::host, host);
  req.set(http::field::user_agent, "hkp-rt");
  req.set(http::field::content_type, "application/json");
  req.set(http::field::accept, streaming ? "text/event-stream" : "application/json");
  req.body() = payload;
  req.prepare_payload();
  http::write(stream, req);

  beast::flat_buffer buffer;
  http::response_parser<http::string_body> parser;
  parser.body_limit(boost::none);
  http::read_header(stream, buffer, parser);

  const auto status = parser.get().result_int();
  if (status >= 400)
  {
    beast::error_code readEc;
    http::read(stream, buffer, parser, readEc);
    auto detail = parser.get().body().substr(0, 200);
    throw ServerError("server returned HTTP " + std::to_string(status) + ": " + detail);
  }

  if (!streaming)
  {
    http::read(stream, buffer, parser);
    return json::parse(parser.get().body());
  }

  std::vector<json> chunks;
  std::string pending;
  std::string text;
  auto lastSent = std::chrono::steady_clock::now() - kStreamNotifyInterval;
  bool more = true;

  auto onEvent = [&](const std::string& data)
  {
    json chunk;
    try
    {
      chunk = json::parse(data);
    }
    catch (const json::parse_error&)
    {
      return;
    }
    chunks.push_back(chunk);

    // Track the growing text here rather than re-folding all chunks per event.
    if (!chunk.contains("choices") || !chunk["choices"].is_array() || chunk["choices"].empty())
    {
      return;
    }
    const auto& delta = chunk["choices"][0]["delta"];
    if (!delta.is_object() || !delta.contains("content") || !delta["content"].is_string())
    {
      return;
    }
    text += delta["content"].get<std::string>();
    auto now = std::chrono::steady_clock::now();
    if (now - lastSent >= kStreamNotifyInterval)
    {
      lastSent = now;
      onText(text);
    }
  };

  while (more && !parser.is_done())
  {
    beast::error_code ec;
    http::read_some(stream, buffer, parser, ec);
    if (ec == http::error::need_buffer)
    {
      ec = {};
    }
    if (ec == http::error::end_of_stream || ec == net::error::eof)
    {
      break;
    }
    if (ec)
    {
      throw beast::system_error{ ec };
    }
    auto& body = parser.get().body();
    if (body.empty())
    {
      continue;
    }
    auto fragment = body;
    body.clear();
    more = consumeSseFragment(pending, fragment, onEvent);
  }

  return parseStreamChunks(chunks);
}

// ── Local backend: in-process llama.cpp ─────────────────────────────────────

#ifdef HKP_LLAMA_ENABLED

struct ChatMessage
{
  std::string role;
  std::string content;
};

// Lazy-loading wrapper around an in-process llama.cpp model.  Owns the
// local-backend config (modelPath, contextSize, gpuLayers) and the loaded-model
// cache, and reloads when any of them change.
class LocalLlama
{
public:
  std::string modelPath;
  int contextSize = kDefaultContextSize;
  int gpuLayers = kDefaultGpuLayers;

  ~LocalLlama()
  {
    release();
  }

  // Drop the cached model if its parameters changed; it reloads lazily.
  void invalidateIfStale()
  {
    if (m_model && m_loadedKey != key())
    {
      release();
    }
  }

  bool isLoaded() const
  {
    return m_model != nullptr;
  }

  // Returns an empty string on success, the failure reason otherwise.
  std::string ensure()
  {
    if (m_model)
    {
      return {};
    }

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

    auto modelParams = llama_model_default_params();
    modelParams.n_gpu_layers = gpuLayers;
    m_model = llama_model_load_from_file(modelPath.c_str(), modelParams);
    if (!m_model)
    {
      return "failed to load model '" + modelPath + "'";
    }

    auto ctxParams = llama_context_default_params();
    ctxParams.n_ctx = static_cast<uint32_t>(contextSize);
    ctxParams.n_batch = static_cast<uint32_t>(contextSize);
    m_ctx = llama_init_from_model(m_model, ctxParams);
    if (!m_ctx)
    {
      release();
      return "failed to create a llama context for '" + modelPath + "'";
    }

    m_loadedKey = key();
    return {};
  }

  void release()
  {
    if (m_ctx)
    {
      llama_free(m_ctx);
      m_ctx = nullptr;
    }
    if (m_model)
    {
      llama_model_free(m_model);
      m_model = nullptr;
    }
    m_loadedKey.clear();
  }

  // Render the conversation with the model's own chat template, leaving the
  // prompt ready for the assistant to continue.
  std::string applyChatTemplate(const std::vector<ChatMessage>& messages) const
  {
    std::vector<llama_chat_message> raw;
    raw.reserve(messages.size());
    for (const auto& message : messages)
    {
      raw.push_back({ message.role.c_str(), message.content.c_str() });
    }

    const char* tmpl = llama_model_chat_template(m_model, nullptr);
    std::vector<char> buffer(std::max<size_t>(2048, llama_n_ctx(m_ctx)));
    int len = llama_chat_apply_template(tmpl, raw.data(), raw.size(), true, buffer.data(), buffer.size());
    if (len > static_cast<int>(buffer.size()))
    {
      buffer.resize(len);
      len = llama_chat_apply_template(tmpl, raw.data(), raw.size(), true, buffer.data(), buffer.size());
    }
    if (len < 0)
    {
      return {};
    }
    return std::string(buffer.data(), len);
  }

  struct Generation
  {
    std::string text;
    int promptTokens = 0;
    int completionTokens = 0;
    std::string error;
  };

  // Generate a completion for `prompt`.  Each request starts from an empty KV
  // cache, so the rendered conversation is the whole context — the service is
  // stateless between calls, like its hkp-python counterpart.
  Generation generate(const std::string& prompt,
                      double temperature,
                      double topP,
                      int topK,
                      int maxTokens,
                      const std::function<void(const std::string&)>& onText)
  {
    Generation result;

    const llama_vocab* vocab = llama_model_get_vocab(m_model);
    llama_memory_clear(llama_get_memory(m_ctx), true);

    const int promptTokenCount =
      -llama_tokenize(vocab, prompt.c_str(), prompt.size(), nullptr, 0, true, true);
    std::vector<llama_token> promptTokens(promptTokenCount);
    if (llama_tokenize(vocab, prompt.c_str(), prompt.size(),
                       promptTokens.data(), promptTokens.size(), true, true) < 0)
    {
      result.error = "failed to tokenize the prompt";
      return result;
    }
    result.promptTokens = promptTokenCount;

    llama_sampler* sampler = llama_sampler_chain_init(llama_sampler_chain_default_params());
    if (topK > 0)
    {
      llama_sampler_chain_add(sampler, llama_sampler_init_top_k(topK));
    }
    if (topP > 0.0 && topP < 1.0)
    {
      llama_sampler_chain_add(sampler, llama_sampler_init_top_p(static_cast<float>(topP), 1));
    }
    llama_sampler_chain_add(sampler, llama_sampler_init_temp(static_cast<float>(temperature)));
    llama_sampler_chain_add(sampler, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));

    auto batch = llama_batch_get_one(promptTokens.data(), promptTokens.size());
    auto lastSent = std::chrono::steady_clock::now() - kStreamNotifyInterval;
    const int contextLimit = static_cast<int>(llama_n_ctx(m_ctx));

    while (result.completionTokens < maxTokens)
    {
      const int used = llama_memory_seq_pos_max(llama_get_memory(m_ctx), 0) + 1;
      if (used + batch.n_tokens > contextLimit)
      {
        result.error = "context size exceeded";
        break;
      }
      if (llama_decode(m_ctx, batch) != 0)
      {
        result.error = "failed to decode";
        break;
      }

      llama_token token = llama_sampler_sample(sampler, m_ctx, -1);
      if (llama_vocab_is_eog(vocab, token))
      {
        break;
      }

      char piece[256];
      const int n = llama_token_to_piece(vocab, token, piece, sizeof(piece), 0, true);
      if (n < 0)
      {
        result.error = "failed to convert a token to text";
        break;
      }
      result.text.append(piece, n);
      result.completionTokens++;

      if (onText)
      {
        auto now = std::chrono::steady_clock::now();
        if (now - lastSent >= kStreamNotifyInterval)
        {
          lastSent = now;
          onText(result.text);
        }
      }

      batch = llama_batch_get_one(&token, 1);
    }

    llama_sampler_free(sampler);
    return result;
  }

private:
  std::string key() const
  {
    return modelPath + "|" + std::to_string(contextSize) + "|" + std::to_string(gpuLayers);
  }

  llama_model* m_model = nullptr;
  llama_context* m_ctx = nullptr;
  std::string m_loadedKey;
};

#endif // HKP_LLAMA_ENABLED

} // namespace

struct TextGenerationImpl
{
  std::string backend = "server";
  std::string serverUrl = kDefaultServerUrl;
  std::string model;
  std::string systemPrompt = kDefaultSystemPrompt;
  double temperature = kDefaultTemperature;
  double topP = kDefaultTopP;
  int topK = kDefaultTopK;
  int maxTokens = kDefaultMaxTokens;
  double timeoutSec = kDefaultTimeoutSec;
  // unset = server default; false makes thinking models answer directly, which
  // matters for interactive boards (thinking burns the whole token budget
  // invisibly before the first visible character).
  std::optional<bool> thinking;
  // Stream the completion token by token, notifying the growing text as
  // {streamText} for live UI display. The pipeline output is unaffected: the
  // full result is still emitted once, when generation finishes.
  bool stream = true;
  std::string status = "idle";

  // Local-backend config lives on LocalLlama when it is compiled in, so that
  // the loaded-model cache is invalidated in lockstep with the values.
#ifdef HKP_LLAMA_ENABLED
  LocalLlama local;
#else
  std::string modelPath;
  int contextSize = kDefaultContextSize;
  int gpuLayers = kDefaultGpuLayers;
#endif

  std::string& modelPathRef()
  {
#ifdef HKP_LLAMA_ENABLED
    return local.modelPath;
#else
    return modelPath;
#endif
  }

  int& contextSizeRef()
  {
#ifdef HKP_LLAMA_ENABLED
    return local.contextSize;
#else
    return contextSize;
#endif
  }

  int& gpuLayersRef()
  {
#ifdef HKP_LLAMA_ENABLED
    return local.gpuLayers;
#else
    return gpuLayers;
#endif
  }
};

TextGeneration::TextGeneration(const std::string& instanceId)
  : Service(instanceId, serviceId())
  , m_impl(std::make_unique<TextGenerationImpl>())
{
}

TextGeneration::~TextGeneration() = default;

json TextGeneration::configure(Data data)
{
  auto j = getJSONFromData(data);
  if (j)
  {
    if (j->contains("backend") && (*j)["backend"].is_string())
    {
      auto backend = (*j)["backend"].get<std::string>();
      if (backend == "server" || backend == "local")
      {
        m_impl->backend = backend;
      }
    }
    if (j->contains("serverUrl") && (*j)["serverUrl"].is_string())
    {
      auto url = (*j)["serverUrl"].get<std::string>();
      while (!url.empty() && url.back() == '/')
      {
        url.pop_back();
      }
      if (!url.empty())
      {
        m_impl->serverUrl = url;
      }
    }
    updateIfNeeded(m_impl->model, (*j)["model"]);
    if (j->contains("modelPath") && (*j)["modelPath"].is_string())
    {
      m_impl->modelPathRef() = expandUser((*j)["modelPath"].get<std::string>());
    }
    updateIfNeeded(m_impl->contextSizeRef(), (*j)["contextSize"]);
    updateIfNeeded(m_impl->gpuLayersRef(), (*j)["gpuLayers"]);
    updateIfNeeded(m_impl->systemPrompt, (*j)["systemPrompt"]);
    updateIfNeeded(m_impl->temperature, (*j)["temperature"]);
    updateIfNeeded(m_impl->topP, (*j)["topP"]);
    updateIfNeeded(m_impl->topK, (*j)["topK"]);
    updateIfNeeded(m_impl->maxTokens, (*j)["maxTokens"]);
    updateIfNeeded(m_impl->timeoutSec, (*j)["timeoutSec"]);
    if (j->contains("thinking"))
    {
      const auto& thinking = (*j)["thinking"];
      m_impl->thinking = thinking.is_boolean() ? std::optional<bool>(thinking.get<bool>())
                                               : std::nullopt;
    }
    if (j->contains("stream") && (*j)["stream"].is_boolean())
    {
      m_impl->stream = (*j)["stream"];
    }

#ifdef HKP_LLAMA_ENABLED
    m_impl->local.invalidateIfStale();
#endif
  }
  return Service::configure(data);
}

std::string TextGeneration::getServiceId() const
{
  return serviceId();
}

json TextGeneration::getState() const
{
  return Service::mergeStateWith(json{
    { "backend", m_impl->backend },
    { "serverUrl", m_impl->serverUrl },
    { "model", m_impl->model },
    { "modelPath", m_impl->modelPathRef() },
    { "contextSize", m_impl->contextSizeRef() },
    { "gpuLayers", m_impl->gpuLayersRef() },
    { "systemPrompt", m_impl->systemPrompt },
    { "temperature", m_impl->temperature },
    { "topP", m_impl->topP },
    { "topK", m_impl->topK },
    { "maxTokens", m_impl->maxTokens },
    { "timeoutSec", m_impl->timeoutSec },
    { "thinking", m_impl->thinking ? json(*m_impl->thinking) : json(nullptr) },
    { "stream", m_impl->stream },
    { "status", m_impl->status }
  });
}

namespace {

// Split reasoning from the answer for thinking models.  The reasoning arrives
// either as a separate `reasoning_content` field (llama-server default) or
// inline as <think>...</think> in the content, depending on the chat-template
// handling.
void splitThinking(const json& message, std::string& text, std::string& thinking)
{
  text = message.value("content", std::string{});
  thinking = message.value("reasoning_content", std::string{});

  auto close = text.find(kThinkClose);
  if (close != std::string::npos)
  {
    auto inline_ = text.substr(0, close);
    text = text.substr(close + kThinkClose.size());
    auto open = inline_.find(kThinkOpen);
    if (open != std::string::npos)
    {
      inline_.erase(open, kThinkOpen.size());
    }
    inline_ = trim(inline_);
    thinking = thinking.empty() ? inline_ : trim(thinking + "\n" + inline_);
  }
  text = trim(text);
  thinking = trim(thinking);
}

} // namespace

Data TextGeneration::process(Data data)
{
  if (isNull(data) || isUndefined(data))
  {
    return Null();
  }

  auto setStatus = [this](const std::string& status, const std::string& detail = {})
  {
    m_impl->status = status;
    json payload = { { "status", status } };
    if (!detail.empty())
    {
      payload["detail"] = detail;
    }
    sendNotification(Data(payload));
  };

  auto fail = [&](const std::string& message) -> Data
  {
    setStatus("error");
    json result = { { "error", message } };
    sendNotification(Data(result));
    return Data(result);
  };

  // ── Build the message list ────────────────────────────────────────────────
  json messages = json::array();
  std::string prompt;
  if (auto str = getStringFromData(data); str)
  {
    prompt = *str;
  }
  else if (auto j = getJSONFromData(data); j && j->is_object())
  {
    if (j->contains("messages") && (*j)["messages"].is_array())
    {
      messages = (*j)["messages"];
    }
    else
    {
      for (const auto& key : { "prompt", "text" })
      {
        if (j->contains(key) && (*j)[key].is_string())
        {
          prompt = (*j)[key].get<std::string>();
          if (!prompt.empty())
          {
            break;
          }
        }
      }
    }
  }

  if (messages.empty())
  {
    if (trim(prompt).empty())
    {
      return fail("text-generation expects String input or JSON with 'prompt', 'text', or 'messages'");
    }
    messages.push_back(json{ { "role", "user" }, { "content", prompt } });
  }

  if (!m_impl->systemPrompt.empty())
  {
    const bool hasSystem = std::any_of(messages.begin(), messages.end(), [](const json& message)
    {
      return message.is_object() && message.value("role", std::string{}) == "system";
    });
    if (!hasSystem)
    {
      messages.insert(messages.begin(), json{ { "role", "system" }, { "content", m_impl->systemPrompt } });
    }
  }

  auto notifyText = [this](const std::string& text)
  {
    sendNotification(Data(json{ { "streamText", text } }));
  };

  const auto started = std::chrono::steady_clock::now();
  json response;

  if (m_impl->backend == "local")
  {
#ifdef HKP_LLAMA_ENABLED
    if (m_impl->local.modelPath.empty())
    {
      return fail("local backend needs a modelPath pointing to a .gguf file");
    }

    if (!m_impl->local.isLoaded())
    {
      setStatus("loading", "loading model '" + m_impl->local.modelPath + "'");
    }
    if (auto error = m_impl->local.ensure(); !error.empty())
    {
      return fail(error);
    }

    std::vector<ChatMessage> chat;
    chat.reserve(messages.size());
    for (const auto& message : messages)
    {
      chat.push_back({ message.value("role", std::string("user")),
                       message.value("content", std::string{}) });
    }

    auto rendered = m_impl->local.applyChatTemplate(chat);
    if (rendered.empty())
    {
      return fail("failed to apply the model's chat template");
    }

    setStatus("generating");
    auto generation = m_impl->local.generate(
      rendered,
      m_impl->temperature,
      m_impl->topP,
      m_impl->topK,
      m_impl->maxTokens,
      m_impl->stream ? notifyText : std::function<void(const std::string&)>{}
    );

    // A context overrun or decode failure still leaves usable text behind, so
    // only a completely empty generation is treated as an error.
    if (!generation.error.empty() && generation.text.empty())
    {
      return fail("generation failed: " + generation.error);
    }
    if (m_impl->stream)
    {
      sendNotification(Data(json{ { "streamText", generation.text }, { "streamDone", true } }));
    }

    response = {
      { "choices", json::array({ json{ { "message", json{ { "role", "assistant" },
                                                          { "content", generation.text } } } } }) },
      { "model", m_impl->local.modelPath },
      { "usage", json{ { "prompt_tokens", generation.promptTokens },
                       { "completion_tokens", generation.completionTokens } } }
    };
#else
    return fail(kBuildHint);
#endif
  }
  else
  {
    json payload = {
      { "messages", messages },
      { "temperature", m_impl->temperature },
      { "top_p", m_impl->topP },
      { "top_k", m_impl->topK },
      { "max_tokens", m_impl->maxTokens },
      { "stream", m_impl->stream }
    };
    if (!m_impl->model.empty())
    {
      payload["model"] = m_impl->model;
    }
    if (m_impl->thinking)
    {
      // llama-server extension (Qwen-style chat templates); only sent when
      // explicitly configured so other backends never see the field.
      payload["chat_template_kwargs"] = json{ { "enable_thinking", *m_impl->thinking } };
    }

    setStatus("generating");
    try
    {
      auto parsed = urls::parse_uri_reference(m_impl->serverUrl);
      if (parsed.has_error())
      {
        return fail("serverUrl is not a valid URL: " + m_impl->serverUrl);
      }
      const auto url = parsed.value();
      const auto host = std::string(url.encoded_host());
      const bool isHttps = url.scheme_id() == urls::scheme::https;
      auto port = url.port();
      if (port.empty())
      {
        port = isHttps ? "443" : "80";
      }
      const auto target = std::string(url.encoded_path()) + "/v1/chat/completions";
      const auto timeout = std::chrono::milliseconds(static_cast<long long>(m_impl->timeoutSec * 1000));
      const auto body = payload.dump();

      net::io_context ioc;
      tcp::resolver resolver(ioc);
      const auto endpoints = resolver.resolve(host, port);

      if (isHttps)
      {
        ssl::context ctx(ssl::context::tlsv12_client);
        load_root_certificates(ctx);
        ctx.set_verify_mode(ssl::verify_peer);

        beast::ssl_stream<beast::tcp_stream> stream(ioc, ctx);
        if (!SSL_set_tlsext_host_name(stream.native_handle(), host.c_str()))
        {
          beast::error_code ec{ static_cast<int>(::ERR_get_error()), net::error::get_ssl_category() };
          throw beast::system_error{ ec };
        }
        beast::get_lowest_layer(stream).expires_after(timeout);
        beast::get_lowest_layer(stream).connect(endpoints);
        stream.handshake(ssl::stream_base::client);
        response = chatCompletion(stream, host, target, body, m_impl->stream, notifyText);

        beast::error_code ec;
        stream.shutdown(ec);
      }
      else
      {
        beast::tcp_stream stream(ioc);
        stream.expires_after(timeout);
        stream.connect(endpoints);
        response = chatCompletion(stream, host, target, body, m_impl->stream, notifyText);

        beast::error_code ec;
        stream.socket().shutdown(tcp::socket::shutdown_both, ec);
      }
    }
    catch (const ServerError& e)
    {
      // The server answered and said no; its message is the useful part.
      return fail(e.what());
    }
    catch (const std::exception&)
    {
      // Anything else is a transport failure — most often nothing listening.
      return fail(serverHint(m_impl->serverUrl));
    }

    if (m_impl->stream)
    {
      std::string text;
      std::string thinking;
      if (response.contains("choices") && response["choices"].is_array() && !response["choices"].empty())
      {
        splitThinking(response["choices"][0]["message"], text, thinking);
      }
      sendNotification(Data(json{ { "streamText", text }, { "streamDone", true } }));
    }
  }

  // ── Emit the result ───────────────────────────────────────────────────────
  if (!response.contains("choices") || !response["choices"].is_array() || response["choices"].empty()
      || !response["choices"][0].contains("message"))
  {
    return fail("unexpected response shape: " + response.dump().substr(0, 200));
  }

  std::string text;
  std::string thinking;
  splitThinking(response["choices"][0]["message"], text, thinking);

  const auto usage = response.value("usage", json::object());
  const auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
    std::chrono::steady_clock::now() - started).count();

  json result = {
    { "text", text },
    { "model", response.value("model", m_impl->model) },
    { "durationMs", elapsed },
    { "usage", json{ { "promptTokens", usage.value("prompt_tokens", 0) },
                     { "completionTokens", usage.value("completion_tokens", 0) } } }
  };
  if (!thinking.empty())
  {
    result["thinking"] = thinking;
  }

  setStatus("idle");
  sendNotification(Data(result));
  return Data(result);
}

}
