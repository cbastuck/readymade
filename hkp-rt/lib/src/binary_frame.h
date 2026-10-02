#pragma once

#include <cstdint>
#include <cstring>
#include <memory>
#include <optional>
#include <string>
#include <vector>
#include <utility>

#include <types/types.h>

/**
 * How a value that is not JSON crosses a coordinator connection.
 *
 * A coordinator link carries JSON as text frames. A value holding bytes
 * travels as one binary frame instead:
 *
 *   [ 4 bytes: header length, big-endian ][ header: UTF-8 JSON ][ payload ]
 *
 * The header is the message that would have been sent as text, with the value
 * left out and a `binary` field in its place saying what the payload is:
 *
 *   bytes            the payload is the value
 *   floatRingBuffer  little-endian float32 samples; `id` and `ts` in the header
 *   mixed            bytes with JSON beside them; the header carries the JSON
 *                    under `json`, the payload the bytes
 *
 * The coordinator forwards the payload without reading it. Mirrors
 * hkp-node/src/coordinator/binaryFrame.ts; the two must agree.
 */
namespace hkp::binary_frame {

struct Frame
{
  /** The message, without its value and without `binary`. */
  json header;
  json shape;
  std::string payload;
};

inline std::string encode(json header, const json& shape, const std::string& payload)
{
  header["binary"] = shape;
  const std::string head = header.dump();
  const uint32_t length = static_cast<uint32_t>(head.size());
  std::string frame;
  frame.reserve(4 + head.size() + payload.size());
  frame.push_back(static_cast<char>((length >> 24) & 0xff));
  frame.push_back(static_cast<char>((length >> 16) & 0xff));
  frame.push_back(static_cast<char>((length >> 8) & 0xff));
  frame.push_back(static_cast<char>(length & 0xff));
  frame.append(head);
  frame.append(payload);
  return frame;
}

/** Nothing for a frame that is not one of these; nothing is thrown at a peer. */
inline std::optional<Frame> decode(const std::string& raw)
{
  if (raw.size() < 4)
  {
    return std::nullopt;
  }
  const auto byte = [&raw](std::size_t i) {
    return static_cast<uint32_t>(static_cast<unsigned char>(raw[i]));
  };
  const std::size_t headLength =
    (byte(0) << 24) | (byte(1) << 16) | (byte(2) << 8) | byte(3);
  if (raw.size() - 4 < headLength)
  {
    return std::nullopt;
  }
  json header = json::parse(raw.begin() + 4, raw.begin() + 4 + headLength,
                            nullptr, /*allow_exceptions=*/false);
  if (!header.is_object() || !header.contains("binary") ||
      !header["binary"].is_object())
  {
    return std::nullopt;
  }
  Frame frame;
  frame.shape = header["binary"];
  header.erase("binary");
  const auto kind = frame.shape.value("kind", std::string());
  if (kind != "bytes" && kind != "floatRingBuffer" && kind != "mixed")
  {
    return std::nullopt;
  }
  frame.header = std::move(header);
  frame.payload = raw.substr(4 + headLength);
  return frame;
}

/**
 * What a pipeline value travels as — its shape and its bytes — or nothing when
 * it is JSON, text, or not something to send at all.
 */
inline std::optional<std::pair<json, std::string>> toBinary(const Data& data)
{
  if (auto bytes = getBinaryFromData(data))
  {
    return std::make_pair(
      json{{"kind", "bytes"}},
      std::string(reinterpret_cast<const char*>(bytes->data()), bytes->size()));
  }
  if (auto buffer = getRingBufferFromData(data))
  {
    // A copy that leaves the buffer as it was: whoever else is handed this
    // value reads the same samples.
    std::vector<uint8_t> samples;
    buffer->consumeAvailable(samples, /*advanceReadIndex=*/false);
    return std::make_pair(
      json{{"kind", "floatRingBuffer"}, {"id", buffer->id()}, {"ts", buffer->timestamp()}},
      std::string(reinterpret_cast<const char*>(samples.data()), samples.size()));
  }
  if (auto mixed = getMixedDataFromData(data))
  {
    return std::make_pair(
      json{{"kind", "mixed"}, {"json", json{{"meta", mixed->meta}}}},
      std::string(reinterpret_cast<const char*>(mixed->binary.data()),
                  mixed->binary.size()));
  }
  return std::nullopt;
}

/** The pipeline value a payload stands for; see `toBinary`. */
inline Data fromBinary(const json& shape, const std::string& payload)
{
  const auto kind = shape.value("kind", std::string());
  const auto* begin = reinterpret_cast<const uint8_t*>(payload.data());
  if (kind == "floatRingBuffer")
  {
    auto buffer = std::make_shared<FloatRingBuffer>("Link.FloatRingBuffer");
    buffer->appendBinary(payload.data(), static_cast<unsigned int>(payload.size()));
    buffer->setIdentity(
      shape.contains("id") && shape["id"].is_number() ? shape["id"].get<unsigned int>() : 0,
      shape.contains("ts") && shape["ts"].is_number() ? shape["ts"].get<uint64_t>() : 0);
    return buffer;
  }
  if (kind == "mixed")
  {
    MixedData mixed;
    const json rest = shape.contains("json") && shape["json"].is_object()
      ? shape["json"] : json::object();
    // Other runtimes keep what is said about the bytes under `meta`; one that
    // spreads it across the object is taken whole.
    mixed.meta = rest.contains("meta") && rest.size() == 1 ? rest["meta"] : rest;
    mixed.binary.assign(begin, begin + payload.size());
    return mixed;
  }
  return BinaryData(begin, begin + payload.size());
}

}
