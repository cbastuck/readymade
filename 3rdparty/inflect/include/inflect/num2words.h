#pragma once

#include <cstdint>
#include <string>

namespace inflect {

// English number speller matching num2words(value, lang="en") as consumed by
// the Python frontend's _words() helper.
//
// _words() post-processes with .replace("-", " ").replace(",", ""), so the
// hyphens in "twenty-one" and the group commas in "one thousand, two hundred"
// never survive. We emit the already-flattened space-separated form directly.
//
//   1234 -> "one thousand two hundred and thirty four"
//   2024 -> "two thousand and twenty four"
std::string NumberToWords(std::int64_t value);

// As above but ordinal: num2words(value, to="ordinal").
//
//   21 -> "twenty first"
//   1100 -> "one thousand one hundredth"
std::string NumberToOrdinalWords(std::int64_t value);

}  // namespace inflect
