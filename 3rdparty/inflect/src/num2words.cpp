#include "inflect/num2words.h"

#include <array>
#include <string>
#include <utility>
#include <vector>

namespace inflect {
namespace {

constexpr std::array<const char*, 20> kUnits = {
    "zero",     "one",     "two",       "three",    "four",
    "five",     "six",     "seven",     "eight",    "nine",
    "ten",      "eleven",  "twelve",    "thirteen", "fourteen",
    "fifteen",  "sixteen", "seventeen", "eighteen", "nineteen"};

constexpr std::array<const char*, 10> kTens = {
    "",      "",      "twenty",  "thirty", "forty",
    "fifty", "sixty", "seventy", "eighty", "ninety"};

// Scale words, ascending. num2words uses the short scale for en.
constexpr std::array<const char*, 7> kScales = {
    "", "thousand", "million", "billion", "trillion", "quadrillion",
    "quintillion"};

void Append(std::string* out, const std::string& piece) {
  if (piece.empty()) return;
  if (!out->empty()) out->push_back(' ');
  out->append(piece);
}

// Spells 1..999. Mirrors num2words' "X hundred and Y" shape.
std::string SpellGroup(int value) {
  std::string out;
  int hundreds = value / 100;
  int rest = value % 100;
  if (hundreds > 0) {
    Append(&out, kUnits[hundreds]);
    Append(&out, "hundred");
  }
  if (rest == 0) return out;
  if (hundreds > 0) Append(&out, "and");
  if (rest < 20) {
    Append(&out, kUnits[rest]);
  } else {
    Append(&out, kTens[rest / 10]);
    if (rest % 10 != 0) Append(&out, kUnits[rest % 10]);
  }
  return out;
}

}  // namespace

std::string NumberToWords(std::int64_t value) {
  if (value == 0) return "zero";

  std::string out;
  if (value < 0) {
    out = "minus";
    value = -value;
  }

  // Break into 3-digit groups, least significant first.
  std::vector<int> groups;
  while (value > 0) {
    groups.push_back(static_cast<int>(value % 1000));
    value /= 1000;
  }

  // num2words separates scale groups with ", " but uses " and " before a
  // trailing group below 100 ("two thousand and twenty-four" versus "one
  // thousand, one hundred"). Both collapse to a space here, so the only
  // observable difference is the inserted "and".
  for (std::size_t i = groups.size(); i-- > 0;) {
    if (groups[i] == 0) continue;
    bool is_last_group = (i == 0);
    if (is_last_group && !out.empty() && groups[0] < 100) Append(&out, "and");
    Append(&out, SpellGroup(groups[i]));
    if (i < kScales.size() && i > 0) Append(&out, kScales[i]);
  }
  return out;
}

std::string NumberToOrdinalWords(std::int64_t value) {
  std::string cardinal = NumberToWords(value);

  // num2words forms the ordinal by rewriting only the final word.
  static const std::pair<const char*, const char*> kIrregular[] = {
      {"zero", "zeroth"},       {"one", "first"},
      {"two", "second"},        {"three", "third"},
      {"four", "fourth"},       {"five", "fifth"},
      {"six", "sixth"},         {"seven", "seventh"},
      {"eight", "eighth"},      {"nine", "ninth"},
      {"ten", "tenth"},         {"eleven", "eleventh"},
      {"twelve", "twelfth"},    {"twenty", "twentieth"},
      {"thirty", "thirtieth"},  {"forty", "fortieth"},
      {"fifty", "fiftieth"},    {"sixty", "sixtieth"},
      {"seventy", "seventieth"},{"eighty", "eightieth"},
      {"ninety", "ninetieth"},
  };

  std::size_t split = cardinal.find_last_of(' ');
  std::string head = (split == std::string::npos)
                         ? std::string()
                         : cardinal.substr(0, split + 1);
  std::string tail = (split == std::string::npos) ? cardinal
                                                  : cardinal.substr(split + 1);

  for (const auto& [from, to] : kIrregular) {
    if (tail == from) return head + to;
  }
  // Regular: "-teen" and the scale words just take "th".
  return head + tail + "th";
}

}  // namespace inflect
