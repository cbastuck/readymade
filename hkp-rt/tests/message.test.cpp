#include <catch2/catch_test_macros.hpp>

#include <cstdint>
#include <string>

#include <types/data.h>
#include <types/message.h>

using namespace hkp;

namespace {

// A frame as hkp-frontend and hkp-node write it by hand, rather than through
// the yas library: the 7-byte header, purpose, type, sender, then the bytes.
std::string handWrittenBinaryFrame(const std::string& sender, const std::string& bytes)
{
  std::string frame = "yas0017";
  auto put = [&frame](uint64_t value, int width) {
    for (int i = 0; i < width; ++i)
    {
      frame.push_back(static_cast<char>((value >> (8 * i)) & 0xff));
    }
  };
  put(MessagePurpose::RESULT, 2);
  put(TypeId<BinaryData>::value, 2);
  put(sender.size(), 8);
  frame += sender;
  frame += bytes;
  return frame;
}

} // namespace

TEST_CASE("Message: BinaryData survives a round trip", "[message]")
{
  const BinaryData bytes{0xff, 0xfb, 0x00, 0x01, 0x7f};
  const auto frame = Message::serializeToString(bytes, MessagePurpose::RESULT, "sender-1");

  MessageHeader header;
  const auto data = Message::deserializeFromString(frame, &header);

  REQUIRE(header.dataType == TypeId<BinaryData>::value);
  REQUIRE(header.sender == "sender-1");
  const auto binary = getBinaryFromData(data);
  REQUIRE(binary.has_value());
  REQUIRE(*binary == bytes);
}

TEST_CASE("Message: reads BinaryData framed by the other runtimes", "[message]")
{
  const std::string payload("\xff\xfb\x90\x00", 4);
  MessageHeader header;
  const auto data = Message::deserializeFromString(handWrittenBinaryFrame("", payload), &header);

  REQUIRE(header.messagePurpose == MessagePurpose::RESULT);
  const auto binary = getBinaryFromData(data);
  REQUIRE(binary.has_value());
  REQUIRE(std::string(binary->begin(), binary->end()) == payload);
}

TEST_CASE("Message: an empty BinaryData stays empty", "[message]")
{
  const auto data = Message::deserializeFromString(handWrittenBinaryFrame("", ""));
  const auto binary = getBinaryFromData(data);
  REQUIRE(binary.has_value());
  REQUIRE(binary->empty());
}
