#pragma once

#include <string>
#include <algorithm>
#include <cstddef>

namespace hkp {

inline std::string toLowerCase(const std::string& method)
{
  std::string methodNormalized = method;
  std::transform(methodNormalized.begin(), methodNormalized.end(), methodNormalized.begin(), ::tolower);
  return methodNormalized;
}

// Lowercase hex encoding of a raw byte buffer (e.g. for rendering a digest or
// random token as text).
inline std::string toHex(const unsigned char* data, std::size_t len)
{
  static const char* const digits = "0123456789abcdef";
  std::string out;
  out.reserve(len * 2);
  for (std::size_t i = 0; i < len; ++i)
  {
    out.push_back(digits[data[i] >> 4]);
    out.push_back(digits[data[i] & 0x0f]);
  }
  return out;
}

}
