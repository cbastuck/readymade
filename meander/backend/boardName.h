#pragma once

#include <cctype>
#include <cstddef>
#include <cstdint>
#include <iomanip>
#include <sstream>
#include <string>
#include <string_view>

/**
 * A board's name, as a request gives it and as it names the board's files.
 *
 * Two rules, kept apart on purpose. Which names are accepted is about the name
 * being text. Keeping a name inside the boards directory is the encoding's job:
 * every name becomes a single file name, whatever it contains, so the accepted
 * set does not have to be narrowed to what is safe in a path.
 *
 * They live apart from the settings so they are testable without the runtime
 * library — this header depends on nothing but the standard library.
 */
namespace readymade
{

/**
 * Whether a board may be called this: non-empty, well-formed UTF-8, and free of
 * ASCII control characters.
 *
 * A name is what a person typed, so punctuation and any script are taken as
 * written. It has to be well-formed because it is echoed back in JSON, which
 * cannot carry anything else.
 */
inline bool isValidBoardName(std::string_view name)
{
  if (name.empty())
  {
    return false;
  }

  for (std::size_t i = 0; i < name.size();)
  {
    const auto lead = static_cast<unsigned char>(name[i]);
    if (lead < 0x80)
    {
      if (lead < 0x20 || lead == 0x7F)
      {
        return false;
      }
      ++i;
      continue;
    }

    // The sequence's length, and the smallest code point that needs that many
    // bytes — a smaller one written this long is an overlong encoding.
    std::size_t length = 0;
    std::uint32_t codePoint = 0;
    std::uint32_t smallest = 0;
    if ((lead & 0xE0) == 0xC0)
    {
      length = 2;
      codePoint = lead & 0x1F;
      smallest = 0x80;
    }
    else if ((lead & 0xF0) == 0xE0)
    {
      length = 3;
      codePoint = lead & 0x0F;
      smallest = 0x800;
    }
    else if ((lead & 0xF8) == 0xF0)
    {
      length = 4;
      codePoint = lead & 0x07;
      smallest = 0x10000;
    }
    else
    {
      return false;
    }

    if (i + length > name.size())
    {
      return false;
    }
    for (std::size_t k = 1; k < length; ++k)
    {
      const auto continuation = static_cast<unsigned char>(name[i + k]);
      if ((continuation & 0xC0) != 0x80)
      {
        return false;
      }
      codePoint = (codePoint << 6) | (continuation & 0x3F);
    }

    const bool surrogate = codePoint >= 0xD800 && codePoint <= 0xDFFF;
    if (codePoint < smallest || codePoint > 0x10FFFF || surrogate)
    {
      return false;
    }
    i += length;
  }

  return true;
}

/**
 * The file name a board is stored under, without its extension: letters,
 * digits, `-`, `_` and spaces as they are, every other byte as `%XX`. No
 * separator and no dot survives, so the result is always one path component.
 */
inline std::string encodeBoardNameForStorage(std::string_view boardName)
{
  std::ostringstream oss;
  oss << std::uppercase << std::hex;
  for (unsigned char c : boardName)
  {
    if (std::isalnum(c) || c == '-' || c == '_' || c == ' ')
    {
      oss << static_cast<char>(c);
    }
    else
    {
      oss << '%' << std::setw(2) << std::setfill('0') << static_cast<int>(c);
    }
  }
  return oss.str();
}

/** The board name a stored file name stands for. */
inline std::string decodeBoardNameFromStorage(std::string_view storageName)
{
  std::string result;
  result.reserve(storageName.size());
  for (std::size_t i = 0; i < storageName.size(); ++i)
  {
    if (storageName[i] == '%' && i + 2 < storageName.size())
    {
      const unsigned char hi = static_cast<unsigned char>(storageName[i + 1]);
      const unsigned char lo = static_cast<unsigned char>(storageName[i + 2]);
      if (std::isxdigit(hi) && std::isxdigit(lo))
      {
        const std::string hex(storageName.substr(i + 1, 2));
        const char decoded = static_cast<char>(std::stoi(hex, nullptr, 16));
        result.push_back(decoded);
        i += 2;
        continue;
      }
    }
    result.push_back(storageName[i]);
  }
  return result;
}

} // namespace readymade
