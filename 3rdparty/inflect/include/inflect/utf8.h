#pragma once

#include <string>
#include <vector>

namespace inflect {

// Splits a UTF-8 string into codepoint-sized substrings.
//
// The symbol table is full of multi-byte IPA characters, and the Python
// frontend iterates Python characters, not bytes. Iterating std::string
// directly would map each byte of "ˈ" to a separate lookup and silently
// produce garbage tokens, so every place that walks phoneme text goes
// through here. Malformed bytes are emitted as single-byte pieces rather
// than throwing; espeak only ever hands us valid UTF-8.
std::vector<std::string> Utf8Split(const std::string& text);

// Number of codepoints in a UTF-8 string.
std::size_t Utf8Length(const std::string& text);

}  // namespace inflect
