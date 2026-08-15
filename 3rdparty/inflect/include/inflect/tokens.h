#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace inflect {

// Maps an IPA phoneme string to model token IDs, interleaved with blanks.
//
// Mirrors phonemes_to_tokens() in inference_onnx.py: each symbol becomes its
// table index, then the sequence is padded to 2n+1 with zeros at the even
// positions (with_blanks[1::2] = sequence).
//
// Throws std::runtime_error if the frontend produced a symbol outside the
// table, or produced nothing at all.
std::vector<std::int64_t> PhonemesToTokens(const std::string& phoneme_text);

}  // namespace inflect
