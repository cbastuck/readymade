#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

#include <types/data.h>

// What a call report says of the value a service was called with, or produced.
//
// Every call is bracketed by a pair of reports (`call-process`,
// `call-process-finished`), and each carries the value — what the flow
// inspector shows of the call. That value travels wherever the reports do: to
// every client watching the runtime and, on a deployed board, to its
// coordinator, whose frame limit drops a message above 64 MiB and closes the
// connection a little above that. A value that never leaves its runtime would
// still leave it as a report, once for every service it passes through.
//
// So a report carries a value only up to `limit`. Above it, a description
// takes its place — what it is, how large, and how it begins — which the
// inspector shows and will not run again. The same limit, and the same
// description, in every runtime: `callReport.ts` in hkp-node and hkp-frontend,
// `call_report.py` in hkp-python.
//
// Measuring stops once the limit is passed, so a value of a hundred megabytes
// costs no more to judge than one of five. A size counted only that far is said
// to be not `exact`.
namespace hkp::call_report {

// The most a report carries of one value: 5 MiB.
constexpr uint64_t limit = 5ull * 1024 * 1024;

// How much of a value too large to report its description begins with.
constexpr size_t previewLength = 1024;

// The beginning of `text`, at most `max` bytes, never inside a UTF-8 character.
inline std::string head(const std::string& text, size_t max = previewLength)
{
  if (text.size() <= max)
    return text;
  size_t end = max;
  while (end > 0 && (static_cast<unsigned char>(text[end]) & 0xC0) == 0x80)
    --end;
  return text.substr(0, end);
}

// What `value` takes as compact JSON, near enough, counted until it passes
// `budget`. A container's own brackets and commas are counted before what is
// in it, so a list of a million items is past a small budget without one of
// them being visited.
inline uint64_t sizeUpTo(const json& value, uint64_t budget)
{
  uint64_t total = 0;
  std::vector<const json*> pending{&value};
  while (!pending.empty() && total <= budget)
  {
    const json* next = pending.back();
    pending.pop_back();
    switch (next->type())
    {
      case json::value_t::string:
        total += next->get_ref<const std::string&>().size() + 2;
        break;
      case json::value_t::array:
        total += 2 + (next->empty() ? 0 : next->size() - 1);
        if (total <= budget)
          for (const auto& item : *next)
            pending.push_back(&item);
        break;
      case json::value_t::object:
        total += 2;
        for (auto it = next->begin(); it != next->end() && total <= budget; ++it)
        {
          total += it.key().size() + 4;
          pending.push_back(&it.value());
        }
        break;
      case json::value_t::binary:
        total += next->get_binary().size();
        break;
      default:
        // A number, a boolean or null: a few characters each.
        total += next->dump().size();
        break;
    }
  }
  return total;
}

namespace detail {

inline std::string quoted(const std::string& text)
{
  return json(text).dump(-1, ' ', false, json::error_handler_t::replace);
}

// Writes `value` as compact JSON into `out` until it holds `previewLength`
// bytes. False once full: nothing more is written, not even the brackets that
// would close what was begun.
inline bool writePreview(const json& value, std::string& out)
{
  if (out.size() >= previewLength)
    return false;
  switch (value.type())
  {
    case json::value_t::string:
      out += quoted(head(value.get_ref<const std::string&>(), previewLength - out.size()));
      break;
    case json::value_t::array:
    {
      out += '[';
      bool first = true;
      for (const auto& item : value)
      {
        if (!first)
          out += ',';
        first = false;
        if (!writePreview(item, out))
          return false;
      }
      out += ']';
      break;
    }
    case json::value_t::object:
    {
      out += '{';
      bool first = true;
      for (auto it = value.begin(); it != value.end(); ++it)
      {
        out += (first ? "" : ",") + quoted(it.key()) + ':';
        first = false;
        if (!writePreview(it.value(), out))
          return false;
      }
      out += '}';
      break;
    }
    case json::value_t::binary:
      out += "\"<" + std::to_string(value.get_binary().size()) + " bytes>\"";
      break;
    default:
      out += value.dump();
      break;
  }
  return out.size() < previewLength;
}

} // namespace detail

// How `value` begins, as compact JSON of at most `previewLength` bytes and an
// ellipsis — written only that far, never the whole of it.
inline std::string preview(const json& value)
{
  std::string out;
  const bool complete = detail::writePreview(value, out);
  return complete ? out : head(out) + "…";
}

inline json tooLarge(const std::string& type, uint64_t bytes, bool exact,
                     const std::optional<std::string>& preview = std::nullopt)
{
  json described{{"type", type}, {"bytes", bytes}, {"exact", exact}};
  if (preview)
    described["preview"] = *preview;
  return json{{"__hkpTooLarge", std::move(described)}};
}

inline bool isTooLarge(const json& value)
{
  return value.is_object() && value.contains("__hkpTooLarge");
}

// `data` as a report carries it: JSON and text as they are, nothing as null, an
// undefined input as "<undefined>", anything else as its stringified form —
// and in place of JSON or text above `max`, its description. Read where it is
// held, so a value too large is never copied to be judged.
inline json reported(const Data& data, uint64_t max = limit)
{
  if (const auto* value = boost::get<json>(&data))
  {
    const auto bytes = sizeUpTo(*value, max);
    return bytes > max ? tooLarge("json", bytes, false, preview(*value)) : *value;
  }
  if (const auto* text = boost::get<std::string>(&data))
  {
    return text->size() > max ? tooLarge("string", text->size(), true, head(*text)) : json(*text);
  }
  if (isNull(data))
    return nullptr;
  if (isUndefined(data))
    return "<undefined>";
  // A ring buffer, bytes, mixed data: stringified as a summary of themselves.
  return stringify(data);
}

} // namespace hkp::call_report
