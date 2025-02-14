#pragma once

#include <vector>

#include <boost/variant.hpp>
#include "ringbuffer.h"

#include <nlohmann/json.hpp>
using json = nlohmann::json;

struct Undefined
{
};

struct Null
{
};

using BinaryData = std::vector<uint8_t>;

typedef boost::variant<
  Undefined, 
  std::shared_ptr<FloatRingBuffer>, 
  json, 
  BinaryData, 
  std::string, 
  Null> Data;

std::string stringify(const Data& data);

// put this in a namespace to avoid conflicts with other Data types (since variant holds multiple common types)
// if you want to log Data instance, make sure to use the namespace hkp before logging
namespace hkp 
{
  std::ostream& operator<<(std::ostream& os, const Data& data);
}

// from Data to specific types
std::optional<json> getJSONFromData(const Data &data);
std::shared_ptr<FloatRingBuffer> getRingBufferFromData(const Data &data);
std::optional<const BinaryData> getBinaryFromData(const Data& data);
std::optional<const std::string> getStringFromData(const Data& data);
bool isUndefined(const Data& data);
bool isNull(const Data& data);

// from specific types to Data
Data flatBufferToData(boost::beast::flat_buffer& buffer, bool isBinary);

// convert between specific types

template <typename T>
std::optional<T> getProperty(const json& j, const std::string& key);

template <typename T>
std::optional<T> getPropertyUpdate(const json& j, const std::string& key, const T& old)
{
  auto prop = getProperty<T>(j, key);
  if (prop && *prop != old)
  {
    return std::optional<T>(*prop);
  }
  return std::nullopt;
}



