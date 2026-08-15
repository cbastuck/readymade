#include "inflect/phonemize.h"

#include <espeak-ng/speak_lib.h>

#include <algorithm>
#include <regex>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

#include "inflect/utf8.h"

namespace inflect {
namespace {

// Punctuation._DEFAULT_MARKS.
const std::vector<std::string>& Marks() {
  static const auto* kMarks = new std::vector<std::string>{
      ";", ":", ",", ".", "!", "?", "¡", "¿", "—", "…", "\"",
      "«", "»", "“", "”", "(", ")", "{", "}", "[", "]"};
  return *kMarks;
}

bool IsMark(const std::string& codepoint) {
  const auto& marks = Marks();
  return std::find(marks.begin(), marks.end(), codepoint) != marks.end();
}

bool IsSpace(const std::string& codepoint) {
  return codepoint.size() == 1 &&
         std::isspace(static_cast<unsigned char>(codepoint[0])) != 0;
}

// Where a punctuation run sits in its utterance, mirroring phonemizer's
// _MarkIndex.position.
enum class Position { kBegin, kEnd, kInside, kAlone };

struct MarkIndex {
  int index = 0;  // Source line number, as in phonemizer.
  std::string mark;
  Position position = Position::kInside;
};

struct PunctuationRun {
  std::size_t begin = 0;  // Byte offsets into the line.
  std::size_t end = 0;
  std::string text;
};

// Equivalent of phonemizer's r'(\s*[marks]+\s*)+' but codepoint-aware.
//
// A byte-oriented character class would shred the multi-byte marks (— is
// E2 80 94) and match stray continuation bytes inside unrelated characters,
// so this scans codepoints instead: a run is a maximal stretch of marks and
// whitespace containing at least one mark.
std::vector<PunctuationRun> FindRuns(const std::string& line) {
  std::vector<std::string> chars = Utf8Split(line);
  std::vector<std::size_t> offsets;
  offsets.reserve(chars.size() + 1);
  std::size_t offset = 0;
  for (const auto& ch : chars) {
    offsets.push_back(offset);
    offset += ch.size();
  }
  offsets.push_back(offset);

  std::vector<PunctuationRun> runs;
  std::size_t i = 0;
  while (i < chars.size()) {
    if (!IsMark(chars[i]) && !IsSpace(chars[i])) {
      ++i;
      continue;
    }
    std::size_t start = i;
    bool has_mark = false;
    while (i < chars.size() && (IsMark(chars[i]) || IsSpace(chars[i]))) {
      if (IsMark(chars[i])) has_mark = true;
      ++i;
    }
    if (!has_mark) continue;
    PunctuationRun run;
    run.begin = offsets[start];
    run.end = offsets[i];
    run.text = line.substr(run.begin, run.end - run.begin);
    runs.push_back(std::move(run));
  }
  return runs;
}

// Punctuation._preserve_line.
std::vector<std::string> PreserveLine(const std::string& line, int num,
                                      std::vector<MarkIndex>* marks_out) {
  std::vector<PunctuationRun> runs = FindRuns(line);
  if (runs.empty()) return {line};

  // The line is nothing but punctuation.
  if (runs.size() == 1 && runs[0].text == line) {
    marks_out->push_back({num, line, Position::kAlone});
    return {};
  }

  std::vector<MarkIndex> marks;
  for (std::size_t i = 0; i < runs.size(); ++i) {
    Position position = Position::kInside;
    if (i == 0 && runs[i].begin == 0) {
      position = Position::kBegin;
    } else if (i + 1 == runs.size() && runs[i].end == line.size()) {
      position = Position::kEnd;
    }
    marks.push_back({num, runs[i].text, position});
  }

  // Split the line on each mark's text in turn, exactly as Python does with
  // str.split -- the first occurrence wins.
  std::vector<std::string> pieces;
  std::string rest = line;
  for (const auto& mark : marks) {
    std::size_t at = rest.find(mark.mark);
    if (at == std::string::npos) {
      pieces.push_back(rest);
      rest.clear();
      continue;
    }
    pieces.push_back(rest.substr(0, at));
    rest = rest.substr(at + mark.mark.size());
  }
  pieces.push_back(rest);

  marks_out->insert(marks_out->end(), marks.begin(), marks.end());
  return pieces;
}

// Punctuation.restore, specialised to sep.word == " ".
std::vector<std::string> RestorePunctuation(std::vector<std::string> text,
                                            std::vector<MarkIndex> marks,
                                            bool strip) {
  const std::string word_sep = " ";
  std::vector<std::string> out;
  int pos = 0;

  while (!text.empty() || !marks.empty()) {
    if (marks.empty()) {
      for (auto& line : text) {
        if (!strip && line.size() >= word_sep.size() &&
            line.compare(line.size() - word_sep.size(), word_sep.size(),
                         word_sep) != 0) {
          line += word_sep;
        }
        out.push_back(line);
      }
      text.clear();
      continue;
    }
    if (text.empty()) {
      std::string joined;
      for (const auto& mark : marks) joined += mark.mark;
      // Internal spaces become the word separator (a no-op when it is " ").
      out.push_back(joined);
      marks.clear();
      continue;
    }

    MarkIndex current = marks.front();
    if (current.index != pos) {
      out.push_back(text.front());
      text.erase(text.begin());
      ++pos;
      continue;
    }

    marks.erase(marks.begin());
    const std::string& mark = current.mark;

    if (!text.front().empty() && text.front().size() >= word_sep.size() &&
        text.front().compare(text.front().size() - word_sep.size(),
                             word_sep.size(), word_sep) == 0) {
      text.front().erase(text.front().size() - word_sep.size());
    }

    switch (current.position) {
      case Position::kBegin:
        text.front() = mark + text.front();
        break;
      case Position::kEnd: {
        bool ends_with_sep =
            mark.size() >= word_sep.size() &&
            mark.compare(mark.size() - word_sep.size(), word_sep.size(),
                         word_sep) == 0;
        out.push_back(text.front() + mark +
                      ((strip || ends_with_sep) ? "" : word_sep));
        text.erase(text.begin());
        ++pos;
        break;
      }
      case Position::kAlone: {
        bool ends_with_sep =
            mark.size() >= word_sep.size() &&
            mark.compare(mark.size() - word_sep.size(), word_sep.size(),
                         word_sep) == 0;
        out.push_back(mark + ((strip || ends_with_sep) ? "" : word_sep));
        ++pos;
        break;
      }
      case Position::kInside: {
        if (text.size() == 1) {
          text.front() += mark;
        } else {
          std::string first = text.front();
          text.erase(text.begin());
          text.front() = first + mark + text.front();
        }
        break;
      }
    }
  }
  return out;
}

// Non-overlapping left-to-right replacement, matching Python str.replace.
std::string ReplaceAll(std::string text, const std::string& from,
                       const std::string& to) {
  if (from.empty()) return text;
  std::string out;
  std::size_t pos = 0;
  while (true) {
    std::size_t at = text.find(from, pos);
    if (at == std::string::npos) {
      out.append(text, pos, text.size() - pos);
      break;
    }
    out.append(text, pos, at - pos);
    out.append(to);
    pos = at + from.size();
  }
  return out;
}

std::string Strip(const std::string& text) {
  std::size_t begin = text.find_first_not_of(" \t\n\r\f\v");
  if (begin == std::string::npos) return std::string();
  std::size_t end = text.find_last_not_of(" \t\n\r\f\v");
  return text.substr(begin, end - begin + 1);
}

// EspeakBackend._postprocess_line with with_stress=True, strip=True,
// separator.phone="", separator.word=" ", language_switch="keep-flags".
std::string PostprocessLine(std::string line) {
  line = Strip(line);
  line = ReplaceAll(line, "\n", " ");
  line = ReplaceAll(line, "  ", " ");
  line = std::regex_replace(line, std::regex("_+"), "_");
  line = std::regex_replace(line, std::regex("_ "), " ");
  if (line.empty()) return std::string();

  std::string out;
  std::size_t start = 0;
  while (true) {
    std::size_t at = line.find(' ', start);
    std::string word = (at == std::string::npos)
                           ? line.substr(start)
                           : line.substr(start, at - start);
    word = Strip(word);              // _process_stress keeps stress marks.
    word = ReplaceAll(word, "_", "");  // separator.phone is empty.
    out += word + " ";
    if (at == std::string::npos) break;
    start = at + 1;
  }
  if (!out.empty()) out.erase(out.size() - 1);  // strip=True drops the last sep.
  return out;
}

// inflect_vits_frontend._apply_phoneme_overrides.
std::string ApplyPhonemeOverrides(std::string text) {
  static const std::vector<std::pair<std::string, std::string>> kOverrides = {
      {"sˈæskɐtʃˌuːən", "sɐskˈætʃəwən"},
      {"flʊɹɹˈɛsənt", "flʊˈɹɛsənt"},
  };
  for (const auto& [from, to] : kOverrides) text = ReplaceAll(text, from, to);
  text = std::regex_replace(text, std::regex(R"(\s+)"), " ");
  return Strip(text);
}

bool g_initialized = false;

}  // namespace

Phonemizer::Phonemizer(const std::string& data_path, const std::string& voice)
    : voice_(voice) {
  if (!g_initialized) {
    // Fall back to the data directory the build produced.
    std::string resolved = data_path;
#ifdef INFLECT_DEFAULT_ESPEAK_DATA
    if (resolved.empty()) resolved = INFLECT_DEFAULT_ESPEAK_DATA;
#endif
    const char* path = resolved.empty() ? nullptr : resolved.c_str();
    if (espeak_Initialize(AUDIO_OUTPUT_SYNCHRONOUS, /*buflength=*/0, path,
                          /*options=*/0) < 0) {
      throw std::runtime_error(
          "espeak_Initialize failed. Pass --espeak-data pointing at an "
          "espeak-ng-data directory.");
    }
    g_initialized = true;
  }
  if (espeak_SetVoiceByName(voice_.c_str()) != EE_OK) {
    throw std::runtime_error("espeak_SetVoiceByName failed for voice " + voice_);
  }
}

Phonemizer::~Phonemizer() = default;

std::string Phonemizer::Phonemize(const std::string& normalized_text) const {
  // Hide the punctuation from espeak.
  std::vector<MarkIndex> marks;
  std::vector<std::string> chunks = PreserveLine(normalized_text, 0, &marks);
  chunks.erase(std::remove_if(chunks.begin(), chunks.end(),
                              [](const std::string& s) { return s.empty(); }),
               chunks.end());

  // IPA output with '_' between phonemes, matching phonemizer's phoneme mode.
  // The underscores are stripped again in PostprocessLine because the default
  // separator has an empty phone separator; we keep them here so espeak's
  // segmentation is identical to the Python path.
  const int kPhonemeMode = (static_cast<int>('_') << 8) | 0x02;
  const int kTextModeUtf8 = 1;

  std::vector<std::string> phonemized;
  phonemized.reserve(chunks.size());
  for (const std::string& chunk : chunks) {
    const void* cursor = chunk.c_str();
    std::vector<std::string> parts;
    while (cursor != nullptr) {
      const char* piece =
          espeak_TextToPhonemes(&cursor, kTextModeUtf8, kPhonemeMode);
      if (piece != nullptr && *piece != '\0') parts.emplace_back(piece);
    }
    std::string joined;
    for (std::size_t i = 0; i < parts.size(); ++i) {
      if (i) joined += " ";
      joined += parts[i];
    }
    phonemized.push_back(PostprocessLine(std::move(joined)));
  }

  std::vector<std::string> restored =
      RestorePunctuation(std::move(phonemized), std::move(marks), /*strip=*/true);

  std::string out;
  for (std::size_t i = 0; i < restored.size(); ++i) {
    if (i) out += " ";
    out += restored[i];
  }
  return ApplyPhonemeOverrides(std::move(out));
}

}  // namespace inflect
