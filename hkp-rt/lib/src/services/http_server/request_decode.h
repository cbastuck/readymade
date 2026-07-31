#pragma once

#include <algorithm>
#include <cctype>
#include <optional>
#include <string>

#include <types/types.h>

/**
 * Turning an incoming HTTP request into pipeline data.
 *
 * Shared by the http-server services so both describe a request the same way:
 * JSON `meta` plus the body in whichever single form is useful — decoded when
 * the content type says what the bytes mean, raw otherwise.
 */
namespace hkp::request_decode {

/**
 * A request presents itself as a file transfer when it names an attachment or
 * carries the chunked-upload headers. That, not the content type, is what
 * separates "store these bytes" from "here is a payload" — an uploaded .txt or
 * .json arrives with a textual content type but is still a file.
 */
inline bool isFileTransfer(const std::string& contentDisposition,
                           const std::string& uploadId)
{
  return contentDisposition.find("filename=") != std::string::npos || !uploadId.empty();
}

/** Extract the filename from a Content-Disposition value, e.g. "photo.jpg". */
inline std::string extractFilename(const std::string& contentDisposition)
{
  std::string filename = "upload";
  auto pos = contentDisposition.find("filename=");
  if (pos != std::string::npos)
  {
    filename = contentDisposition.substr(pos + 9);
    filename.erase(std::remove(filename.begin(), filename.end(), '"'),  filename.end());
    filename.erase(std::remove(filename.begin(), filename.end(), '\''), filename.end());
    filename.erase(0, filename.find_first_not_of(" \t"));
    auto last = filename.find_last_not_of(" \t\r\n");
    if (last != std::string::npos) filename.resize(last + 1);
  }
  return filename;
}

inline std::string toLower(std::string value)
{
  std::transform(value.begin(), value.end(), value.begin(),
                 [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
  return value;
}

/** Content type with any parameters ("; charset=utf-8") stripped. */
inline std::string mediaType(const std::string& contentType)
{
  auto semicolon = contentType.find(';');
  auto bare = semicolon == std::string::npos ? contentType : contentType.substr(0, semicolon);
  auto first = bare.find_first_not_of(" \t");
  if (first == std::string::npos) return "";
  auto last = bare.find_last_not_of(" \t");
  return toLower(bare.substr(first, last - first + 1));
}

inline std::string urlDecode(const std::string& value)
{
  std::string out;
  out.reserve(value.size());
  for (std::size_t i = 0; i < value.size(); ++i)
  {
    if (value[i] == '+')
    {
      out.push_back(' ');
    }
    else if (value[i] == '%' && i + 2 < value.size())
    {
      try
      {
        out.push_back(static_cast<char>(std::stoi(value.substr(i + 1, 2), nullptr, 16)));
        i += 2;
      }
      catch (const std::exception&)
      {
        out.push_back(value[i]); // not a valid escape — keep it verbatim
      }
    }
    else
    {
      out.push_back(value[i]);
    }
  }
  return out;
}

/** Parse "a=1&b=two" into a JSON object of decoded key/value pairs. */
inline json parseQueryString(const std::string& query)
{
  auto fields = json::object();
  std::size_t start = 0;
  while (start < query.size())
  {
    auto end = query.find('&', start);
    if (end == std::string::npos) end = query.size();
    auto pair = query.substr(start, end - start);
    if (!pair.empty())
    {
      auto eq = pair.find('=');
      if (eq == std::string::npos)
        fields[urlDecode(pair)] = "";
      else
        fields[urlDecode(pair.substr(0, eq))] = urlDecode(pair.substr(eq + 1));
    }
    start = end + 1;
  }
  return fields;
}

/** The request target arrives raw, so the query still has to be split off. */
inline void splitTarget(const std::string& target, std::string& path, json& query)
{
  auto mark = target.find('?');
  path  = mark == std::string::npos ? target : target.substr(0, mark);
  query = mark == std::string::npos ? json::object()
                                    : parseQueryString(target.substr(mark + 1));
}

/**
 * Decode a body whose content type says what its bytes mean. Returns nullopt
 * when the bytes should be left raw, which includes malformed input: a public
 * endpoint takes whatever it is given, and failing the request would be worse
 * than handing the pipeline the bytes to look at.
 */
inline std::optional<json> decodeBody(const std::string& body, const std::string& contentType)
{
  if (body.empty()) return std::nullopt;

  const auto type = mediaType(contentType);
  const auto endsWith = [](const std::string& s, const std::string& suffix) {
    return s.size() >= suffix.size() &&
           s.compare(s.size() - suffix.size(), suffix.size(), suffix) == 0;
  };

  if (type == "application/json" || endsWith(type, "+json"))
  {
    auto parsed = json::parse(body, nullptr, /*allow_exceptions=*/false);
    if (parsed.is_discarded()) return std::nullopt;
    return parsed;
  }

  if (type == "application/x-www-form-urlencoded")
  {
    return parseQueryString(body);
  }

  if (type.rfind("text/", 0) == 0)
  {
    return json(body);
  }

  return std::nullopt;
}

} // namespace hkp::request_decode
