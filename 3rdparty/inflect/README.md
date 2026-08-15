# inflect-cpp

A C++17 port of the [Inflect v2](https://huggingface.co/owensong/Inflect-Micro-v2-ONNX)
text-to-speech pipeline. Local neural speech synthesis with no Python at
runtime.

Verified bit-exact against the Python reference: identical chunk boundaries,
normalized text, phoneme strings, token IDs, and — given the same latent noise
— identical waveform samples.

Self-contained: nothing here depends on the upstream Inflect repository. The
model is fetched from Hugging Face, and the parity harness imports the
reference implementation straight out of the downloaded package.

## Dependencies

Two, both required, nothing else:

| Dependency | Why | Linkage |
| --- | --- | --- |
| **espeak-ng** 1.52.0 | English grapheme-to-phoneme. Non-neural and not embedded in the ONNX graphs. | static |
| **ONNX Runtime** 1.28.0 | Runs `duration.onnx` and `decode.onnx`. | shared (see below) |

Everything else is in-tree rather than pulled from a package: the WAV writer
(`src/wav.cpp`, ~60 lines), the English number speller (`src/num2words.cpp`),
the text normalizer (`src/normalize.cpp`), and UTF-8 codepoint handling
(`src/utf8.cpp`). No numpy, no libsndfile, no Boost, no regex library beyond
`std::regex`.

CMake fetches both dependencies; there is nothing to install first.

### On "statically linked"

espeak-ng is fully static. ONNX Runtime is not, and that is a deliberate
compromise: Microsoft publishes prebuilt **shared** libraries only, and a
static build from source takes roughly 45 minutes. The default build uses the
prebuilt shared library so `cmake --build` finishes in a couple of minutes.

To go fully static, build ONNX Runtime yourself and point the build at it:

```bash
git clone --recursive --depth 1 --branch v1.28.0 \
    https://github.com/microsoft/onnxruntime.git
cd onnxruntime
./build.sh --config Release --parallel --build_dir build \
    --cmake_extra_defines onnxruntime_BUILD_SHARED_LIB=OFF
cmake -S /path/to/cpp -B build -DINFLECT_ORT_ROOT=$PWD/build/Release
```

On macOS, `libc++` and `libSystem` always remain dynamic — there is no static
libSystem. "Static" here means no third-party runtime dependencies.

## Build

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j8
```

Produces `build/inflect` (~670 KB) plus `build/_deps/.../espeak-ng-data`,
which the binary needs at runtime. The data directory path is compiled in as
the default; override it with `--espeak-data`.

## Get the model

The binary reads exactly two files — `onnx/duration.onnx` and
`onnx/decode.onnx` — so `curl` is enough. No Python involved:

```bash
REV=91b1ab6432323064ec0e8e9704d92fcecd24855f
BASE="https://huggingface.co/owensong/Inflect-Micro-v2-ONNX/resolve/$REV/onnx"

mkdir -p models/inflect-micro-v2-onnx/onnx
curl -L -o models/inflect-micro-v2-onnx/onnx/duration.onnx "$BASE/duration.onnx"
curl -L -o models/inflect-micro-v2-onnx/onnx/decode.onnx   "$BASE/decode.onnx"

export MODEL="$PWD/models/inflect-micro-v2-onnx"
```

36 MB total. `-L` is required: Hugging Face redirects LFS files to a CDN.
`$REV` pins the commit the parity tests were run against; use `main` to track
upstream instead.

Optional integrity check. The published checksum file has CRLF line endings,
so strip them before handing it to `shasum`:

```bash
curl -sL "$BASE/checksums.sha256" > /tmp/inflect-sums
(cd models/inflect-micro-v2-onnx/onnx &&
 grep -E '(duration|decode)\.onnx' /tmp/inflect-sums | tr -d '\r' | shasum -a 256 -c -)
```

<details>
<summary>Alternative: <code>huggingface_hub</code></summary>

If you already have a Python environment with `huggingface_hub` — the parity
venv below has one — this fetches the full package (~63 MB) into the shared HF
cache:

```bash
MODEL=$(.venv/bin/python -c "from huggingface_hub import snapshot_download; \
    print(snapshot_download('owensong/Inflect-Micro-v2-ONNX'))")
```

Note `python3` or a venv interpreter — macOS has no bare `python`.

</details>

## Run

```bash
./build/inflect \
  --model-dir "$MODEL" \
  --text "A complete local voice can fit almost anywhere." \
  --output inflect.wav
```

`--model-dir` needs only an `onnx/` subdirectory holding those two graphs; the
location is irrelevant, so a `curl`-populated directory and the HF cache work
equally well.

```
--speed F         0.5 to 2.0 (default 1.0)
--variation F     0.0 to 1.0 (default 0.667)
--seed N          latent noise seed (default 0)
--threads N       intra-op threads (default: ONNX Runtime's choice)
--espeak-data DIR override the compiled-in espeak-ng-data path
--noise-file F    raw float32 latent noise, for parity testing
--dump-frontend   print normalized text, phonemes and tokens as JSON
--no-abbrev-split suppress the chunk break after "Mr.", "Dr.", "e.g." etc.
```

Quote the text with **single** quotes if it contains a `$`. In `"$42.50"` the
shell expands `$42` — which is empty — and the binary receives `.50`, giving a
stray full stop and a bare "fifty" instead of "forty two dollars and fifty
cents".

### `--no-abbrev-split`

The reference `split_text()` breaks after any period followed by whitespace,
so `"Mr. Smith paid $42.50"` becomes two chunks:

```
"Mr."               -> "mister"
"Smith paid $42.50" -> "Smith paid forty two dollars and fifty cents"
```

Chunks are synthesized independently and joined with a pause — 0.22 s for a
period — so you hear a clipped "mister", silence, then the rest. Abbreviation
expansion happens *inside* the frontend, which runs after chunking, so the
chunker never sees anything but a sentence-ending period.

`--no-abbrev-split` suppresses that boundary for the abbreviations the
normalizer knows about, keeping the sentence in one chunk. Real sentence ends
still split.

It is **off by default**, because turning it on deliberately diverges from the
Python reference and would make the parity guarantee conditional. This flag is
the only knob that changes chunking; everything else is a faithful port.

Reference timing: 2.9 s of audio in 0.40 s wall on an M-series laptop, CPU
only.

## Demo

Exercises most of the frontend in one go — abbreviation, money, time, date,
labelled identifier, and multi-sentence chunking:

```bash
./build/inflect --model-dir "$MODEL" \
    --text 'Hello there, this is a browser test. Mr. Smith paid $42.50 at 3:15pm on 6/24/2026 for order A2093. This third sentence is long enough to show how the runtime splits text into sentence-sized chunks, synthesizes each one separately, and joins them with punctuation-aware pauses.' \
    --output inflect.wav --seed 7 --no-abbrev-split
```

Single quotes throughout, so the `$` in `$42.50` needs no escaping.

Produces 22.7 s of audio in three chunks:

```
Hello there, this is a browser test.
  -> Hello there, this is a browser test.

Mr. Smith paid $42.50 at 3:15pm on 6/24/2026 for order A2093.
  -> mister Smith paid forty two dollars and fifty cents at three fifteen p m
     on June twenty fourth two thousand and twenty six for order ay two
     thousand and ninety three.

This third sentence is long enough to show how the runtime splits text into
sentence-sized chunks, synthesizes each one separately, and joins them with
punctuation-aware pauses.
  -> (unchanged — no numerals or abbreviations to expand)
```

Swap `--output` for `--dump-frontend` to see that breakdown yourself.

## Parity testing

The harness runs the Python reference and diffs it against the built binary.
It needs its own virtualenv; the C++ build needs none of this.

```bash
python3 -m venv .venv
.venv/bin/pip install -r tests/requirements.txt

.venv/bin/python tests/gen_reference.py        # dump ground truth
.venv/bin/python tests/check_parity.py         # frontend, 15 sentences
.venv/bin/python tests/check_audio_parity.py   # waveform, shared noise
```

No torch required — the reference used here is the package's torch-free ONNX
runner, which the scripts import from the downloaded snapshot.

The corpus exercises every normalizer branch: money, dates, times, versions,
phone numbers, ordinals, decimals, acronyms, dotted initialisms, labelled
identifiers, typographic punctuation, and a sentence long enough to force
mid-sentence chunk splitting.

`check_parity.py` also pins down `--no-abbrev-split`, which by definition
cannot be compared against Python — those cases assert the intended chunking
directly.

Latent noise is the one thing that cannot match by construction: Python draws
it from numpy's PCG64 generator, and reimplementing PCG64 plus numpy's
ziggurat sampler in C++ would be a lot of work for no audible benefit. The
C++ build uses `std::mt19937_64`, which yields different but equally valid
speech. `--noise-file` accepts a dumped tensor so the rest of the pipeline can
still be compared exactly — which is how the bit-exact result above was
obtained.

## Notes on the port

**UTF-8.** The symbol table is full of multi-byte IPA characters, and the
Python frontend iterates characters, not bytes. Every place that walks phoneme
text goes through `Utf8Split`; byte-wise iteration would silently produce
garbage tokens instead of failing.

**Punctuation.** espeak-ng discards punctuation, so phonemizer hides the marks
before calling it and splices them back afterwards. `src/phonemize.cpp`
reimplements that preserve/restore algorithm. Calling `espeak_TextToPhonemes`
directly would lose every comma and full stop, and with them the model's
prosody.

**Chunking changes pronunciation.** The runtime splits text after sentence
punctuation before phonemizing. This is not cosmetic: `"The U.S.A."` as its own
chunk phonemizes its trailing `A` as the letter name (`ˈeɪ`), where the same
text mid-sentence yields the article (`ɐ`). Port the chunker faithfully or the
output drifts.

**Rule order.** The rewrite passes in `NormalizeText` run in the same order as
Python. The order is load-bearing — the date rule must claim `12/25/2024`
before the bare-number rule sees `12`.

**espeak-ng's CMake interface.** It exports `src/include/compat` on every
consumer's include path, where a stub `wctype.h` shadows the system header and
breaks `<string>`. The build links the built archives by path to avoid
inheriting that.

**Not thread-safe.** espeak-ng keeps process-global state. Build one `Engine`
and reuse it, one request at a time, as `DEPLOYMENT.md` advises.

## Licensing

espeak-ng is **GPL-3.0**. Statically linking it into a distributed binary
carries that obligation. Fine for local use; worth a look before shipping
anything. ONNX Runtime is MIT. The model weights carry their own license —
see the model card.
