#include "inflect/utf8.h"

namespace inflect {
namespace {

// Length of the UTF-8 sequence introduced by `lead`, or 1 for a stray
// continuation/invalid byte so callers always make forward progress.
std::size_t SequenceLength(unsigned char lead) {
  if (lead < 0x80) return 1;
  if ((lead & 0xE0) == 0xC0) return 2;
  if ((lead & 0xF0) == 0xE0) return 3;
  if ((lead & 0xF8) == 0xF0) return 4;
  return 1;
}

}  // namespace

std::vector<std::string> Utf8Split(const std::string& text) {
  std::vector<std::string> pieces;
  pieces.reserve(text.size());
  std::size_t i = 0;
  while (i < text.size()) {
    std::size_t width = SequenceLength(static_cast<unsigned char>(text[i]));
    if (i + width > text.size()) width = 1;
    pieces.emplace_back(text, i, width);
    i += width;
  }
  return pieces;
}

std::size_t Utf8Length(const std::string& text) {
  std::size_t count = 0;
  std::size_t i = 0;
  while (i < text.size()) {
    std::size_t width = SequenceLength(static_cast<unsigned char>(text[i]));
    if (i + width > text.size()) width = 1;
    i += width;
    ++count;
  }
  return count;
}

}  // namespace inflect
