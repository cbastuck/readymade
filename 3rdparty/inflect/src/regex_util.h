#pragma once

#include <functional>
#include <regex>
#include <string>

namespace inflect {

// re.sub() with a callable replacement.
//
// std::regex_replace only takes a format string, but most of the normalizer's
// rules compute their replacement from the captured groups. Scanning with
// sregex_iterator reproduces Python's left-to-right, non-overlapping scan.
inline std::string RegexReplace(
    const std::string& text, const std::regex& pattern,
    const std::function<std::string(const std::smatch&)>& replace) {
  std::string out;
  auto begin = std::sregex_iterator(text.begin(), text.end(), pattern);
  auto end = std::sregex_iterator();
  std::size_t last = 0;
  for (auto it = begin; it != end; ++it) {
    const std::smatch& match = *it;
    out.append(text, last, static_cast<std::size_t>(match.position()) - last);
    out.append(replace(match));
    last = static_cast<std::size_t>(match.position() + match.length());
  }
  out.append(text, last, text.size() - last);
  return out;
}

}  // namespace inflect
