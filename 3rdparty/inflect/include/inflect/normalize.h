#pragma once

#include <string>

namespace inflect {

// Port of normalize_text() from inflect_nano_v2_frontend.py.
//
// Expands money, dates, times, versions, phone numbers, ordinals, decimals,
// acronyms and labelled identifiers into spoken words, and folds typographic
// punctuation into the ASCII set espeak handles well. The rewrite passes run
// in the same order as the Python original -- the order is load-bearing,
// since e.g. the date rule must claim "12/25/2024" before the bare-number
// rule sees "12".
//
// Limitation: the underlying rules are ASCII-oriented (\b, [A-Z]) exactly as
// in Python, but Python's \b is Unicode-aware while std::regex works on
// bytes. For non-ASCII input that survives the punctuation folding, word
// boundaries may differ. The model is English-only, so this is a corner.
std::string NormalizeText(const std::string& text);

// True if `text` ends with one of the frontend's known abbreviations --
// "Mr.", "Dr.", "e.g." and friends -- matched case-insensitively and on a
// word boundary, the same way normalize_text's ABBREVIATIONS rules match.
//
// Used by the chunker to tell a sentence-ending period from an abbreviation's
// period. The Python reference does not make this distinction.
bool EndsWithAbbreviation(const std::string& text);

}  // namespace inflect
