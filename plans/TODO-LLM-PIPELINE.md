# LLM pipeline boards

What `text-generation` does in one call, laid out as services: the prompt
becomes tokens, the tokens go through the model, the model's scores go through
a chain of samplers, one token is picked, and the loop runs again. Two boards,
cut at different depths, and a third step that trains a model whose
architecture is the board itself.

- **Board 1, the real pipeline** (hkp-rt): any GGUF model through llama.cpp,
  cut where llama.cpp's own API cuts. The forward pass stays one service.
- **Board 2, inside the forward pass** (hkp-python): GPT-2 small with every
  layer on the board as services, so each intermediate result can be looked at
  and each layer removed, repeated, reordered or changed.
- **Train** (hkp-python): a tiny model trained on this machine from the
  services a board holds, which is what makes a different attention mechanism
  or layer count a real experiment and not noise.

**State:** planned 2026-11-16. M0, M1, M2 and M3 built the same day; see *Work*.
M4 next.

`text-generation` is not touched in either runtime. It stays the service a
board uses to get text; these boards are for seeing and changing how text is
made.

---

## Background

The models llama.cpp runs are decoder-only: one stack of identical layers, run
once per generated token.

1. **Chat template**: messages become one prompt string.
2. **Tokenize**: the string becomes token ids.
3. **Forward pass**: embedding lookup, N layers of attention and MLP, then a
   projection to one score (logit) per vocabulary entry.
4. **Sampler chain**: penalties, top-k, top-p, temperature, then one token is
   picked.
5. **Detokenize**: the token id becomes a piece of text.
6. **Loop**: the token is appended and step 3 runs again, until the model
   emits its end token or a limit is reached.

`hkp-rt/lib/src/services/text_generation.cpp` (`generate`) already makes each
of these as a separate llama.cpp call, in this order. Board 1 is that function
taken apart.

---

## Decided

| Question | Decision | Why |
|---|---|---|
| `text-generation` | **Unchanged**, in every runtime | It is the service boards use. Nothing here changes what it is for. |
| One service or many | **One service per stage**, in both boards | The point is to see each stage's output and to change one stage without the others. |
| Where Board 1 cuts | **At llama.cpp's public API**: tokenize, decode, sample, detokenize | Each is one real call on a real model. Per-layer steps are not exposed by llama.cpp, and re-implementing them for large models is slow and teaches nothing Board 2 does not. |
| Board 2's model | **GPT-2 small** (124M parameters, 12 layers), CPU | Small enough for a laptop, real enough to write sentences, and the architecture every explanation uses. The larger GPT-2 sizes are the same services with more layers. |
| How a layer is wired | **Every service reads the stream and adds to it** | A transformer's residual connections look like wires. Seen as one running tensor that Attention and MLP each add to, the model is an ordered list, which is what a runtime already is. |
| Layers on the board | **One `layer` block, used once per layer**, the layer's index as its param | Twelve explicit entries can be deleted, reordered and duplicated. A count in one service's state could not. |
| KV cache | **Board 1: inside Decode, as a memo. Board 2: none** | In Board 1 it is what makes real models usable. In Board 2 it would make every service stateful for speed nobody needs on short prompts. |
| The model | **A board asset by `url` and `sha256`**, named from every service as `hkp-asset://<id>`; parsed once per runtime | The board keeps an address, not 550 MB. Fourteen services must not each load the file. |
| Architecture experiments | **On pretrained weights only what the weights survive**; everything else through Train | Removing a layer or a head degrades GPT-2 in ways worth watching. Another attention mechanism on GPT-2's weights produces noise, which shows nothing. |
| What Train trains | **The pipeline it holds** | The board is then the architecture: add a layer use, change an Attention's mode, train again. A separate model description would have to be kept in step with the board by hand. |
| Python library | **PyTorch**, as an optional extra like `llm` | Train needs gradients. One implementation for inference and training means what was trained is what runs. |

---

## Values between services

Three shapes, the same in both runtimes so that Sample and Detokenize mean the
same thing on both boards:

- **Tokens**: JSON, `{ "tokens": [15496, 995], "pieces": ["Hello", " world"] }`.
  `pieces` is what a panel shows; `tokens` is what the model reads.
- **Scores**: `MixedData`. Its JSON side carries `tokens` and what has been
  done to the scores so far; its binary side is one float32 per vocabulary
  entry (50,257 for GPT-2, about 200 KB). A sampler takes scores and returns
  scores; the last one returns tokens with the picked one appended.
- **Stream** (Board 2 only): `MixedData`, float32 of shape `[tokens, width]`
  with the shape and `tokens` in its JSON side. For GPT-2 small and a
  20-token prompt this is about 60 KB.

The weights never travel. They stay in the runtime and are reached by the
asset reference each service carries.

hkp-python's `data.py` has no `MixedData` class today (`binary_frame.py` knows
the shape as a dict with bytes under `binary`). The stream needs a value type
that stays a tensor between services in one runtime and serialises only when
it leaves: for a notification, for Capture mode, or for the next runtime.

---

## Foundations

### Models as assets

`TODO-ASSETS.md` lists this as remaining work ("Model loaders"): the stores
cache in memory, at most 64 MB per asset, and a model library loads from a
file path. Needed in hkp-python and hkp-rt:

- **An on-disk cache** in the asset store, keyed by `sha256`, with its own
  size limit, and a way to resolve a reference to a **path** instead of bytes.
  A descriptor without `sha256` is not cached on disk.
- **A model cache** per runtime, keyed by the same `sha256`: the parsed
  weights (Board 2) or the loaded `llama_model` (Board 1), shared by every
  service that names the asset and released when the last one lets go.
- hkp-rt opens files only through `files.h`. The cache folder is one the
  runtime owns, and the existing exception for a model handed to its library
  by path covers the load itself.

GPT-2 needs three assets: the weights (`model.safetensors`, about 550 MB), the
tokenizer (about 1 MB) and the model's configuration (layer count, heads,
width, context length). The last two fit in the stores as they are.

### A loop

Generation repeats a pipeline on its own output. Neither hkp-rt nor hkp-python
has a service for that: the browser's Looper records and replays, and Iterator
runs one pipeline over many items. Needed, in both runtimes: a control-flow
service that holds a pipeline and

- runs it again on its own output until a condition on that output holds, or
  a limit of rounds is reached,
- notifies each round's output, so text grows on screen while it runs,
- can be told to run **one round** per call, which is the facade's Step
  button, and to stop.

It is generic. Nothing in it knows about tokens.

**Built** as `loop` in both runtimes (`docs/content/services/loop.md`). A call
with a value starts over and a call with nothing carries on, which is Step;
`until` is an expression over a round's output; Stop and Reset are configures.
The two differ in how a run answers its call, because of what *Long runs*
found:

- **hkp-python** runs `process` on one worker thread and takes configures on
  the server's loop. A run stays inside its call and Stop reaches it between
  rounds.
- **hkp-rt** runs pipelines on the App's event loop, which in the app is the
  UI's thread. A run answers at once with nothing, takes one round per posted
  event and hands the last output on with `emit()`, as `text-generation` does.
  **Consequence for Board 1:** a service inside the loop must answer its call
  itself. One that defers (`emit()` later) bubbles past the loop and ends the
  round with nothing, so `llm-decode` decodes on the pipeline thread, one
  token per round.

---

## Board 1: the real pipeline (hkp-rt)

```
chat-template → tokenize → loop [ llm-decode → sample… → detokenize ]
```

| Service | In | Out | Notes |
|---|---|---|---|
| `chat-template` | messages or text | text | The model's own template, as `text-generation` applies it. Shown so the special tokens around a message are visible. |
| `tokenize` | text | tokens | |
| `llm-decode` | tokens | scores | The forward pass. Keeps the context and its KV cache, and decodes only the tokens the cache does not already hold. A different beginning clears it, so it behaves as a function of its input. |
| `sample` | scores | scores, or tokens | One instance per step, by mode: `repetition-penalty`, `top-k`, `top-p`, `min-p`, `temperature`, `pick`, `greedy`. Each wraps the llama.cpp sampler of the same name. The order on the board is the order applied. |
| `detokenize` | tokens | tokens with `text` | Also says whether the last token ends generation, which is the loop's condition. |

The services compile under the same build flag as the local backend of
`text-generation`, and report why they cannot run when it is off.

**Facade.** A prompt field, Step and Run and Stop, knobs for temperature and
top-p and top-k, the prompt as coloured token pieces, the ten most likely next
tokens with their probability before and after the samplers (`data-table`),
and the text as it grows.

**Shown by this board:** where token boundaries fall; how each sampler narrows
the candidates; what reordering or removing one does; what greedy picking
sounds like; what a forced token does to everything after it.

---

## Board 2: inside the forward pass (hkp-python)

```
tokenize → loop [ token-embed → layer ×12 → unembed → sample… → detokenize ]

layer (a block, param: index)  =  attention → mlp
```

| Service | Reads | Adds or produces |
|---|---|---|
| `token-embed` | tokens | the stream: token vector plus position vector, per token |
| `attention` | stream | what each token gathered from the tokens before it |
| `mlp` | stream | what each token computed on its own |
| `unembed` | stream | scores for the last position |

`tokenize`, `sample`, `detokenize` and the loop are the same services as in
Board 1, built for hkp-python against the same contract.

**What each service reports.** `attention`: one tokens × tokens pattern per
head. `mlp`: how much it changed the stream. Any service: the stream's size
per token. `unembed` placed after any layer shows what the model would say if
it stopped there, so the answer can be watched forming layer by layer.

**What can be changed on pretrained weights:**

- delete, bypass, repeat or reorder `layer` uses
- switch individual heads off (`attention`)
- change what a token may look at: everything before it, the last *n* tokens,
  or everything including what follows
- sharpen or flatten attention
- read the answer early

**Facade.** The prompt and the growing text as in Board 1, the candidates
table, the layer-by-layer guess, and the attention pattern for a chosen layer
and head. The last needs a matrix display the facade does not have (see
*Open*).

**Correctness.** Both boards can run the same model: GPT-2 exists as GGUF. For
one prompt, Board 2's scores must match Board 1's within rounding. That is the
test that the layers are implemented right. In the test suite, a tiny model
with fixed random weights and stored expected scores does the same job without
a download.

---

## Train (hkp-python)

A `train` service that holds a pipeline (`token-embed`, `layer` uses,
`unembed`) and trains it on a text asset.

- **The board is the architecture.** The number of `layer` uses, the head
  count and width in their state, and the mode of each `attention` are what
  gets built. Train reads them from the services it holds.
- **Small by design.** A character-level model on about 1 MB of text, a few
  layers, trained in minutes on a laptop. The corpus is an asset.
- **It runs in the background** and reports the loss as it goes (`line-chart`),
  with Start, Stop and a sample of what the model writes at this point.
- **What it produces** is a model in the runtime's model cache under a name,
  which the same inference services then run.

What becomes a real experiment with it: position schemes (learned positions as
GPT-2 has, rotary as current models have), one head against many, a causal
mask against a window, depth against width at the same parameter count.

---

## Work

Each service comes with what the project asks of any service: logic, panel,
registration, tests, demo board and docs page.

### M0: foundations

- **Done, hkp-python.** On-disk asset cache and resolve-to-path
  (`AssetStore.resolve_path`, `AssetFileCache` in `assets.py`): only for an
  asset that says its `sha256`, one folder per server, least recently used
  goes first past 8 GB, a `progress` callback for the first fetch.
- **Done, hkp-python.** Model cache (`models.py`), one per asset store as
  `store.models`, so a nested pipeline finds it where it finds its assets.
  Keyed by the caller, loaded once, closed when the last lease is released.
- **Done, hkp-rt.** The same two: `AssetStore::resolvePath` and
  `AssetFileCache` (`assets.h`), with a fetch that hands a body over in
  pieces so a model is never held whole, and `ModelCache` (`models.h`) as
  `store.models`. A model there is a `shared_ptr`: the last service to drop
  it closes it, through the deleter its loader gave it. `file://` sources
  under `HKP_ASSET_ROOT` are copied into the folder like any other.
- **Not done.** Nothing shows a first download yet: `resolvePath` reports
  progress to its caller, and what a service does with it (a notification a
  facade can read) is M1's. The embedded runtime of the iOS and Android apps
  has no folder unless `HKP_ASSET_CACHE` names one.
- **Done, both.** The loop service: `loop.py`, `loop.h`, the panel
  (`LoopUI.tsx`), `boards/loop-demo-board.json` (Python), the docs page.
- **Done.** The value type: `MixedData` in hkp-python's `data.py`. The payload
  stays a tensor or array between services and becomes little-endian float32
  where it leaves; it crosses a coordinator connection as `mixed` and is
  reported by its JSON side and its size. **Not done:** a `MixedData` that is
  a runtime's final output over REST has no YAS form in hkp-python, and
  Capture mode shows its size, not its numbers.

### M1: Board 1

- **Done.** `chat-template`, `tokenize`, `llm-decode`, `sample`, `detokenize`
  in hkp-rt (`lib/src/services/`, with what they share in `llm_model.h`),
  each with a docs page.
- **Done.** `boards/llm-pipeline-board.json` with its facade and
  `docs/content/boards/llm-pipeline-board.md`. `"remote": "embedded"`. The
  model is Qwen3 0.6B Q8_0 (Apache-2.0) by `url` and `sha256`.
- **Tested** with `HKP_LLAMA=ON HKP_TEST_GGUF=<a GGUF> ./run-tests.sh`
  (`tests/service_llm_pipeline.test.cpp`); without a model those cases are
  skipped, and without llama.cpp the services say why they cannot run. The
  board's runtime was driven over REST on the standalone server: stepped,
  run, stopped by the model's end token.

What was decided while building it:

- **A service names its model and loads it beside the pipeline.** Each has
  `model` (an asset reference) and reports `status`, `progress`, `problem`.
  Fetching and loading run on a thread of the service's own; until the model
  is there, `process` passes nothing on and notifies `{ error }`. Five
  services naming one asset share one `llama_model` through the model cache.
- **The context is `llm-decode`'s.** The model is shared; the `llama_context`
  and its KV cache belong to the one service that runs it, so `contextSize`
  is that service's state and nothing else's.
- **A removed candidate is -infinity.** Scores keep one float32 per vocabulary
  entry through the whole chain. A narrowing sampler does not shorten or
  reorder them, so every `sample` reads the shape it writes, and `applied`
  in the JSON side says what was done.
- **Tokens carry `promptTokens`**, so `detokenize` can give the generated text
  apart from the prompt.
- **A service that cannot answer passes nothing on** instead of throwing:
  outside a Loop nothing in hkp-rt catches a throw from `process` on the
  event loop.
- **A call with no payload reaches hkp-rt as JSON `null`** (the frontend's
  REST client sends that), which `loop` now reads as nothing. That is what a
  Step button sends.
- **Facade knobs gained `decimals`** (`KnobRenderer.tsx`): they turned in
  whole numbers, which leaves top-p two positions.

Not done in M1:

- **The board loads in the Readymade app** and fetched its model there
  (2026-11-16). Writing, stepping and the knobs have not been tried in it
  yet.
- **Coloured token pieces** are a striped `repeat` of text widgets, two
  colours alternating. A widget of its own would do better.
- **Probabilities are shown raw** (`0.6213…`) in the tables.
- **Panels.** The five services have the generic panel. Each has a docs page
  and, since 2026-11-17, a `<slug>-demo-board.json`; `chat-template` and
  `llm-decode` run on hkp-rt, while `tokenize`, `sample` and `detokenize`,
  shared with Board 2, run on hkp-python, where `tokenize` and `detokenize`
  need only the 1 MB tokenizer.
- **An asset edited while the board runs** does not reach a loaded model; the
  service has to be configured again.
- **`gpuLayers`** is not a setting: the model is offloaded as far as the
  machine allows, as `text-generation` does by default.

### M2: Board 2, running

- **Done.** The `transformer` extra (`torch`, `safetensors`, `tokenizers`,
  `numpy`) in `hkp-python/pyproject.toml`.
- **Done.** `tokenize`, `sample`, `detokenize`, `token-embed`, `attention`,
  `mlp`, `unembed` in `hkp-python/src/hkp/services/` (with what they share in
  `llm_model.py`), registered in `server.py`, and docs pages for the four
  forward-pass services alongside updated pages for `tokenize`, `sample` and
  `detokenize`.
- **Done.** `AssetFileCache.fetching` and waiter progress reporting in
  `hkp-python/src/hkp/assets.py`, matching `hkp-rt`'s so every service naming
  the weights reports `status`, `progress` and `fetched` while waiting on the
  download.
- **Done.** `boards/gpt2-layers-board.json` with the `layer` block (`attention`
  → `mlp`, parameterized by `layer` 0..11), GPT-2 small (`openai-community/gpt2`
  weights by URL and `sha256`, tokenizer and config), facade, and
  `docs/content/boards/gpt2-layers-board.md`. `"remote": "python"`.
- **Tested** in `hkp-python/tests/test_llm_pipeline.py` with a tiny two-layer,
  two-head, width-8 GPT-2 built in-process against both the reference GPT-2
  equations and stored expected scores, plus the full loop with `layer`
  sub-services. Comparison against Board 1 on real GPT-2 weights remains by
  hand.

### M3: Board 2, looked into

- **Done.** Service panels in `hkp-frontend/src/runtime/rest/ui/`:
  `AttentionUI.tsx` (interactive head selector, head on/off toggle, mask,
  window, temperature, and embedded attention matrix), `StreamStepUI.tsx`
  (per-token stream vector norm bars for `token-embed` and `mlp`), and
  `UnembedUI.tsx` (top candidate probability bars, `passThrough` early-answer
  toggle, and layer-by-layer logit-lens progression), registered in the REST
  `UIRegistry.ts`.
- **Done.** Pretrained-weight experiments in `attention.py` and `unembed.py`:
  switching individual heads off (`disabledHeads` as array or string),
  changing `mask` (`causal`, `window` over the last *n* tokens, or `full`
  including future tokens), sharpening/flattening attention (`temperature`),
  and reading the answer early (`unembed` with `passThrough: true`, plus
  automatic layer-by-layer logit-lens scoring in `unembed` from the record
  the layers keep beside the stream).
- **Done.** `layer` block parameters (`layer`, `mask`, `window`,
  `temperature`, `disabledHeads`) delegated on `boards/gpt2-layers-board.json`.
- **Done.** Generic `heatmap` facade widget (`HeatmapRenderer.tsx`, `types.ts`,
  `widgetRegistry.tsx`, `heatmap.test.tsx`) supporting 2D matrices and 3D
  slice arrays with row/column labels, hover readout and slice tabs, wired into
  `boards/gpt2-layers-board.json` alongside `Inspect layer` and `Inspect head`
  knobs and the layer-by-layer guess table.

What was decided while reviewing it (2026-11-17):

- **The layers' record is `MixedData.local`, not part of the stream's JSON
  side.** A facade source names one service, so a knob cannot switch which
  layer a heatmap reads; `unembed` relays the chosen layer and head instead,
  and it needs every layer's last vector and patterns for that. Built first as
  `meta._trace` of rounded lists, it cost about 250 ms and 6 MB of
  notifications per round at 50 tokens, growing with the square of the
  length. Kept as tensors in a field no exit serialises, a round is about
  70 ms and 0.25 MB; only the shown head becomes a list. The record does not
  cross runtimes.
- **Attention reports one head**, `head`; choosing another re-reports it from
  the last call. `unembed`'s `attention` likewise carries the inspected head
  only, so the board's knob is the one head picker.
- **No notification roll-up on sub-services.** M3 had every plain sub-service
  in hkp-python re-send its steps' notifications on its own address, so a
  block use could be read as a whole. Nothing on the board read it, no other
  runtime does it, it doubled every notification inside a layer, and a step
  named `scope` or `error` would read as the sub-service's own. Reverted; if a
  board needs to read inside a use, it is decided in `concepts/blocks.md` for
  every runtime.
- **The heatmap knows nothing of attention.** It takes a matrix, slices of
  one shape, or `{ matrix | slices, rows, columns, labels, slice }`, tinted
  from the theme's primary colour; the board points it at
  `attention.pattern` and `attention.pieces` by path and says which layer,
  head and mask it shows with text widgets beside it.
- **Panels inside a use lock themselves** (`usePanelBlockLock`, or
  `PanelBlockLock` around one control): Attention's layer, mask, window,
  temperature and head switch, MLP's layer and Unembed's `passThrough` are
  the use's to set. Choosing which head Attention shows stays in reach — it
  changes nothing the layer hands on.
- **The panels are registered for REST runtimes only**: the services exist
  in hkp-python, and the browser registry's entries for them were never
  reached.
- **Every service has a demo board**, `<slug>-demo-board.json`: one service
  with only what it needs around it, between an Injector and a Monitor.

### M4: Train

- `train`, attention's further modes, the corpus asset, the loss chart.
- A board that trains a tiny model and then writes with it.

### Later

- A current small model (SmolLM2-135M, Gemma 3 270M) in Board 2: rotary
  positions, another normalisation, grouped attention.
- The larger GPT-2 sizes.
- Saving a trained model to a file and loading it elsewhere.

---

## Open

- **Service names.** `tokenize`, `sample` and `attention` read well. `embed`
  alone would be taken for text-to-vector search, hence `token-embed`.
  `llm-decode` is llama.cpp's word and means the forward pass, which is not
  what "decode" suggests. The loop service was built as `loop`; renaming it
  is still cheap while no shipped board but its demo uses it.
- **The matrix display.** A generic `heatmap` facade widget (a matrix, row and
  column labels, a colour scale), or the attention panel embedded the way
  `canvas` and `xy-pad` embed theirs. The first is useful beyond this board.
- **Where a trained model lives.** The services name their model by asset
  reference. A model Train produced is not an asset: no board declared it, and
  it exists in one runtime. Either the field also takes a runtime-local name,
  or Train's output becomes something an asset can point at.
- **How Train reaches the services it holds.** It needs their computation as
  something gradients flow through, not their `process` results. The inference
  services have to expose that, and what a service reports while 10,000
  training steps run through it has to be decided (probably nothing).
- **Long runs.** Checked for the loop (see *A loop*): hkp-python answers
  configure during a `process`, hkp-rt does not unless the service gives the
  thread back. Still open for Train: minutes on hkp-python's one worker thread
  queue every other `process` call of that server behind it, so Train needs a
  thread of its own and has to say what the inference services may do
  meanwhile.
- **Forcing a token.** Named above as something Board 1 shows, and not built.
  It is a `sample` mode (`force`) or an edit of the tokens between rounds;
  not decided. `llm-decode` is ready for either: tokens that differ from the
  last call's drop only what follows the change.
- **Download size and first run.** Board 1 shows it: each service reports
  `status` and `progress` while its model is fetched, and the reason when it
  cannot be — also the ones waiting on a fetch another service is doing
  (`AssetFileCache::fetching`), which was missing when the board was first
  opened in the app: the facade watched a service that only waited, and
  showed nothing for four minutes. `fetched` is the same as text ("76%").
  Board 2's 550 MB needs the same in hkp-python.
- **Licences.** GPT-2's weights are MIT. Each further model's licence is
  checked before a shipped board names it.
