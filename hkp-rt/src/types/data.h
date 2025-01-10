#pragma once

#include <vector>

#include <boost/variant.hpp>
#include "ringbuffer.h"

#include <nlohmann/json.hpp>
using json = nlohmann::json;

struct Undefined
{
};

using BinaryData = std::vector<uint8_t>;

typedef boost::variant<Undefined, std::shared_ptr<FloatRingBuffer>, json, const BinaryData, const std::string> Data;

std::string stringify(const Data& data);

// from Data to specific types
json getJSONFromData(const Data &data);
std::shared_ptr<FloatRingBuffer> getRingBufferFromData(const Data &data);
std::optional<const BinaryData> getBinaryFromData(const Data& data);
std::optional<const std::string> getStringFromData(const Data& data);

// from specific types to Data
Data flatBufferToData(boost::beast::flat_buffer& buffer, bool isBinary);

// convert between specific types

