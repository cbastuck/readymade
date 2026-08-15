#include "inflect/tokens.h"

#include <stdexcept>
#include <unordered_map>

#include "inflect/symbols_table.h"
#include "inflect/utf8.h"

namespace inflect {
namespace {

const std::unordered_map<std::string, std::int64_t>& SymbolToId() {
  static const auto* kMap = [] {
    auto* map = new std::unordered_map<std::string, std::int64_t>();
    for (int i = 0; i < kSymbolCount; ++i) {
      map->emplace(kSymbols[i], i);
    }
    return map;
  }();
  return *kMap;
}

}  // namespace

std::vector<std::int64_t> PhonemesToTokens(const std::string& phoneme_text) {
  const auto& table = SymbolToId();
  std::vector<std::int64_t> sequence;

  for (const std::string& symbol : Utf8Split(phoneme_text)) {
    auto it = table.find(symbol);
    if (it == table.end()) {
      throw std::runtime_error("Phoneme '" + symbol +
                               "' is not in the model symbol table.");
    }
    sequence.push_back(it->second);
  }

  if (sequence.empty()) {
    throw std::runtime_error("The text frontend produced no speakable tokens.");
  }

  std::vector<std::int64_t> with_blanks(sequence.size() * 2 + 1, 0);
  for (std::size_t i = 0; i < sequence.size(); ++i) {
    with_blanks[i * 2 + 1] = sequence[i];
  }
  return with_blanks;
}

}  // namespace inflect
