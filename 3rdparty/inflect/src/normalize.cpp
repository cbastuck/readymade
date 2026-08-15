#include "inflect/normalize.h"

#include <algorithm>
#include <array>
#include <cctype>
#include <cstdlib>
#include <regex>
#include <string>
#include <utility>
#include <vector>

#include "inflect/num2words.h"
#include "regex_util.h"

namespace inflect {
namespace {

constexpr std::array<const char*, 12> kMonths = {
    "January", "February", "March",     "April",   "May",      "June",
    "July",    "August",   "September", "October", "November", "December"};

// Insertion order matters: these are applied as an ordered sequence, exactly
// as Python iterates the dict.
const std::vector<std::pair<std::string, std::string>>& WordOverrides() {
  static const auto* kTable = new std::vector<std::pair<std::string, std::string>>{
      {"Qwen3", "Qwen three"},
      {"Qwen", "Qwen"},
      {"PyTorch", "pie torch"},
      {"SQLite", "ess cue lite"},
      {"USB-C", "you ess bee see"},
      {"RTX 3060", "ar tee ex thirty sixty"},
      {"RTX 3090", "ar tee ex thirty ninety"},
      {"RTX 4090", "ar tee ex forty ninety"},
      {"RTX 5080", "ar tee ex fifty eighty"},
      {"RTX 5090", "ar tee ex fifty ninety"},
  };
  return *kTable;
}

const std::vector<std::pair<std::string, std::string>>& Abbreviations() {
  static const auto* kTable = new std::vector<std::pair<std::string, std::string>>{
      {"Dr.", "doctor"},   {"Mr.", "mister"},      {"Mrs.", "missus"},
      {"Ms.", "miss"},     {"Prof.", "professor"}, {"St.", "saint"},
      {"vs.", "versus"},   {"etc.", "et cetera"},  {"e.g.", "for example"},
      {"i.e.", "that is"},
  };
  return *kTable;
}

std::string LetterName(char letter) {
  static const std::array<const char*, 26> kNames = {
      "ay",  "bee", "see", "dee",        "ee",  "eff", "gee",
      "aitch", "eye", "jay", "kay",      "ell", "em",  "en",
      "oh",  "pee", "cue", "ar",         "ess", "tee", "you",
      "vee", "double you", "ex", "why",  "zee"};
  char upper = static_cast<char>(std::toupper(static_cast<unsigned char>(letter)));
  if (upper < 'A' || upper > 'Z') return std::string(1, letter);
  return kNames[static_cast<std::size_t>(upper - 'A')];
}

// Python's re.escape over the literal keys above.
std::string EscapeRegex(const std::string& text) {
  static const std::string kSpecial = R"(\^$.|?*+()[]{})";
  std::string out;
  for (char ch : text) {
    if (kSpecial.find(ch) != std::string::npos) out.push_back('\\');
    out.push_back(ch);
  }
  return out;
}

std::string Join(const std::vector<std::string>& parts, const std::string& sep) {
  std::string out;
  for (std::size_t i = 0; i < parts.size(); ++i) {
    if (i) out.append(sep);
    out.append(parts[i]);
  }
  return out;
}

std::int64_t ToInt(const std::string& digits) {
  if (digits.empty()) return 0;
  return std::strtoll(digits.c_str(), nullptr, 10);
}

std::string Words(std::int64_t value, bool ordinal = false) {
  return ordinal ? NumberToOrdinalWords(value) : NumberToWords(value);
}

// _digit_words: every digit spelled out individually.
std::string DigitWords(const std::string& text) {
  std::vector<std::string> words;
  for (char ch : text) {
    if (std::isdigit(static_cast<unsigned char>(ch))) {
      words.push_back(Words(ch - '0'));
    }
  }
  return Join(words, " ");
}

// _identifier_digits: like DigitWords but a non-leading '0' becomes "oh".
// The index is into the whole token, not just its digits.
std::string IdentifierDigits(const std::string& text) {
  std::vector<std::string> words;
  for (std::size_t index = 0; index < text.size(); ++index) {
    char ch = text[index];
    if (!std::isdigit(static_cast<unsigned char>(ch))) continue;
    if (ch == '0' && index > 0) {
      words.emplace_back("oh");
    } else {
      words.push_back(Words(ch - '0'));
    }
  }
  return Join(words, " ");
}

std::string ExpandIdentifierToken(const std::string& token) {
  static const std::regex kPattern(R"(([A-Za-z]?)(\d+)([A-Za-z]?))");
  std::smatch match;
  if (!std::regex_match(token, match, kPattern)) return token;

  std::string prefix = match[1].str();
  std::string digits = match[2].str();
  std::string suffix = match[3].str();

  std::vector<std::string> pieces;
  if (!prefix.empty()) pieces.push_back(LetterName(prefix[0]));
  if (digits.size() == 3 || digits.front() == '0') {
    pieces.push_back(IdentifierDigits(digits));
  } else {
    pieces.push_back(Words(ToInt(digits)));
  }
  if (!suffix.empty()) pieces.push_back(LetterName(suffix[0]));
  return Join(pieces, " ");
}

std::string ExpandMoney(const std::smatch& match) {
  std::string raw = match[1].str();
  raw.erase(std::remove(raw.begin(), raw.end(), ','), raw.end());

  std::string dollars = raw;
  std::string cents;
  std::size_t dot = raw.find('.');
  if (dot != std::string::npos) {
    dollars = raw.substr(0, dot);
    cents = raw.substr(dot + 1);
  }

  std::int64_t dollar_count = ToInt(dollars);
  std::vector<std::string> parts{Words(dollar_count),
                                 dollar_count == 1 ? "dollar" : "dollars"};
  if (!cents.empty()) {
    cents = cents.substr(0, 2);
    while (cents.size() < 2) cents.push_back('0');
    std::int64_t cent_count = ToInt(cents);
    if (cent_count != 0) {
      parts.emplace_back("and");
      parts.push_back(Words(cent_count));
      parts.emplace_back(cent_count == 1 ? "cent" : "cents");
    }
  }
  return Join(parts, " ");
}

bool IsValidDate(int year, int month, int day) {
  if (month < 1 || month > 12 || day < 1) return false;
  static const std::array<int, 12> kDays = {31, 28, 31, 30, 31, 30,
                                            31, 31, 30, 31, 30, 31};
  int limit = kDays[static_cast<std::size_t>(month - 1)];
  bool leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
  if (month == 2 && leap) limit = 29;
  return day <= limit;
}

std::string ExpandDateSlash(const std::smatch& match) {
  int month = static_cast<int>(ToInt(match[1].str()));
  int day = static_cast<int>(ToInt(match[2].str()));
  int year = static_cast<int>(ToInt(match[3].str()));
  if (!IsValidDate(year, month, day)) return match[0].str();
  return std::string(kMonths[static_cast<std::size_t>(month - 1)]) + " " +
         Words(day, /*ordinal=*/true) + " " + Words(year);
}

// "p.m." -> "p m": lowercase, drop dots, then space out the characters that
// remain (an interior space becomes an empty element, which the final
// whitespace collapse cleans up -- matching Python's list(suffix) behaviour).
std::string SpaceOutSuffix(std::string suffix, bool letters_only) {
  std::string cleaned;
  for (char ch : suffix) {
    if (letters_only) {
      if (std::isalpha(static_cast<unsigned char>(ch))) cleaned.push_back(ch);
    } else if (ch != '.') {
      cleaned.push_back(ch);
    }
  }
  std::vector<std::string> chars;
  for (char ch : cleaned) {
    chars.emplace_back(1, static_cast<char>(
                              std::tolower(static_cast<unsigned char>(ch))));
  }
  return Join(chars, " ");
}

std::string ExpandTime(const std::smatch& match) {
  std::int64_t hour = ToInt(match[1].str());
  std::int64_t minute = ToInt(match[2].str());
  std::string suffix = match[3].matched ? match[3].str() : std::string();

  std::vector<std::string> pieces{Words(hour)};
  if (minute == 0) {
    pieces.emplace_back("o clock");
  } else if (minute < 10) {
    pieces.emplace_back("oh");
    pieces.push_back(Words(minute));
  } else {
    pieces.push_back(Words(minute));
  }
  if (!suffix.empty()) {
    pieces.push_back(SpaceOutSuffix(suffix, /*letters_only=*/false));
  }
  return Join(pieces, " ");
}

std::string ExpandBareHourTime(const std::smatch& match) {
  std::int64_t hour = ToInt(match[1].str());
  return Words(hour) + " " + SpaceOutSuffix(match[2].str(), /*letters_only=*/true);
}

std::string ExpandVersion(const std::smatch& match) {
  std::string whole = match[0].str();
  std::vector<std::string> parts;
  std::size_t start = 0;
  while (true) {
    std::size_t dot = whole.find('.', start);
    std::string piece = whole.substr(
        start, dot == std::string::npos ? std::string::npos : dot - start);
    parts.push_back(Words(ToInt(piece)));
    if (dot == std::string::npos) break;
    start = dot + 1;
  }
  return Join(parts, " point ");
}

std::string ExpandNumber(const std::smatch& match) {
  std::string value = match[0].str();
  value.erase(std::remove(value.begin(), value.end(), ','), value.end());
  if (value.size() >= 5 && value.rfind("20", 0) != 0) return DigitWords(value);
  return Words(ToInt(value));
}

std::string ExpandAcronym(const std::smatch& match) {
  std::string acronym = match[0].str();
  if (acronym.size() <= 1) return acronym;
  std::vector<std::string> names;
  for (char ch : acronym) names.push_back(LetterName(ch));
  return Join(names, " ");
}

// PUNCT_TRANSLATION: typographic punctuation folded to what espeak reads well.
std::string TranslatePunctuation(const std::string& text) {
  static const std::vector<std::pair<std::string, std::string>> kMap = {
      {"‘", "'"},  {"’", "'"}, {"“", "\""}, {"”", "\""},
      {"–", "-"},  {"—", ", "}, {"…", "..."},
  };
  std::string out;
  std::size_t i = 0;
  while (i < text.size()) {
    bool replaced = false;
    for (const auto& [from, to] : kMap) {
      if (text.compare(i, from.size(), from) == 0) {
        out.append(to);
        i += from.size();
        replaced = true;
        break;
      }
    }
    if (replaced) continue;
    char ch = text[i];
    if (ch == '(' || ch == ')' || ch == '[' || ch == ']' || ch == '{' ||
        ch == '}') {
      out.append(", ");
    } else {
      out.push_back(ch);
    }
    ++i;
  }
  return out;
}

std::string CollapseWhitespace(const std::string& text) {
  static const std::regex kWs(R"(\s+)");
  std::string collapsed = std::regex_replace(text, kWs, " ");
  std::size_t begin = collapsed.find_first_not_of(' ');
  if (begin == std::string::npos) return std::string();
  std::size_t end = collapsed.find_last_not_of(' ');
  return collapsed.substr(begin, end - begin + 1);
}

bool IsWordChar(char ch) {
  auto byte = static_cast<unsigned char>(ch);
  return std::isalnum(byte) != 0 || ch == '_';
}

}  // namespace

bool EndsWithAbbreviation(const std::string& text) {
  for (const auto& [abbreviation, unused] : Abbreviations()) {
    if (text.size() < abbreviation.size()) continue;
    std::size_t start = text.size() - abbreviation.size();

    bool matches = true;
    for (std::size_t i = 0; i < abbreviation.size(); ++i) {
      if (std::tolower(static_cast<unsigned char>(text[start + i])) !=
          std::tolower(static_cast<unsigned char>(abbreviation[i]))) {
        matches = false;
        break;
      }
    }
    if (!matches) continue;

    // \b: the abbreviation must start on a word boundary.
    if (start > 0 && IsWordChar(text[start - 1]) &&
        IsWordChar(abbreviation.front())) {
      continue;
    }
    return true;
  }
  return false;
}

std::string NormalizeText(const std::string& input) {
  std::string text = CollapseWhitespace(TranslatePunctuation(input));

  for (const auto& [src, dst] : WordOverrides()) {
    std::regex pattern("\\b" + EscapeRegex(src) + "\\b");
    text = std::regex_replace(text, pattern, dst);
  }
  for (const auto& [src, dst] : Abbreviations()) {
    std::regex pattern("\\b" + EscapeRegex(src), std::regex::icase);
    text = std::regex_replace(text, pattern, dst);
  }

  // Dotted initialisms: "U.S.A." -> "U S A".
  {
    static const std::regex kPattern(R"(\b([A-Z])(?:\.([A-Z]))+\.)");
    static const std::regex kUpper(R"([A-Z])");
    text = RegexReplace(text, kPattern, [](const std::smatch& match) {
      std::string whole = match[0].str();
      std::vector<std::string> letters;
      for (auto it = std::sregex_iterator(whole.begin(), whole.end(), kUpper);
           it != std::sregex_iterator(); ++it) {
        letters.push_back(it->str());
      }
      return Join(letters, " ");
    });
  }

  {
    static const std::regex kPattern(
        R"(\b(apartment|apt\.?|suite|unit|room|flight|extension|order|invoice|locker|aisle|gate)\s+([A-Za-z]?\d{1,4}[A-Za-z]?)\b)",
        std::regex::icase);
    text = RegexReplace(text, kPattern, [](const std::smatch& match) {
      return match[1].str() + " " + ExpandIdentifierToken(match[2].str());
    });
  }
  {
    static const std::regex kPattern(
        R"(\b(\d{3})(?=\s+(?:North|South|East|West)\b))", std::regex::icase);
    text = RegexReplace(text, kPattern, [](const std::smatch& match) {
      return IdentifierDigits(match[1].str());
    });
  }
  {
    static const std::regex kPattern(R"(\$(\d[\d,]*(?:\.\d{1,2})?))");
    text = RegexReplace(text, kPattern, ExpandMoney);
  }
  {
    static const std::regex kPattern(
        R"(\b(0?[1-9]|1[0-2])/(0?[1-9]|[12]\d|3[01])/(20\d{2}|19\d{2})\b)");
    text = RegexReplace(text, kPattern, ExpandDateSlash);
  }
  {
    static const std::regex kPattern(
        R"(\b(\d{1,2}):(\d{2})\s*([AaPp]\.?\s*[Mm]\.?)?\b)");
    text = RegexReplace(text, kPattern, ExpandTime);
  }
  {
    static const std::regex kPattern(R"(\b(\d{1,2})\s*([AaPp]\.?\s*[Mm]\.?)\b)");
    text = RegexReplace(text, kPattern, ExpandBareHourTime);
  }
  {
    static const std::regex kPattern(R"(\b(\d{3})-(\d{4})\b)");
    text = RegexReplace(text, kPattern, [](const std::smatch& match) {
      return DigitWords(match[1].str()) + ", " + DigitWords(match[2].str());
    });
  }
  {
    static const std::regex kPattern(R"(\b\d+(?:\.\d+){2,}\b)");
    text = RegexReplace(text, kPattern, ExpandVersion);
  }
  {
    static const std::regex kPattern(R"(\b(\d+)\.(\d+)\b)");
    text = RegexReplace(text, kPattern, [](const std::smatch& match) {
      return Words(ToInt(match[1].str())) + " point " +
             DigitWords(match[2].str());
    });
  }
  {
    static const std::regex kPattern(R"(\b(\d+)(st|nd|rd|th)\b)",
                                     std::regex::icase);
    text = RegexReplace(text, kPattern, [](const std::smatch& match) {
      return Words(ToInt(match[1].str()), /*ordinal=*/true);
    });
  }
  {
    static const std::regex kPattern(R"(\b\d[\d,]*\b)");
    text = RegexReplace(text, kPattern, ExpandNumber);
  }
  {
    static const std::regex kPattern(R"(\b[A-Z]{2,}\b)");
    text = RegexReplace(text, kPattern, ExpandAcronym);
  }

  // Punctuation tidy-up.
  text = std::regex_replace(text, std::regex(R"(,(?:\s*,)+)"), ",");
  text = std::regex_replace(text, std::regex(R"(,\s*([.!?]))"), "$1");
  text = std::regex_replace(text, std::regex(R"(\s+([,;:.!?]))"), "$1");
  text = std::regex_replace(text, std::regex(R"(([,;:.!?])(?=\S))"), "$1 ");
  return CollapseWhitespace(text);
}

}  // namespace inflect
