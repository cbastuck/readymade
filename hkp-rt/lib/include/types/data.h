#pragma once

#include <vector>

#include <boost/variant.hpp>
#include "ringbuffer.h"

#include <nlohmann/json.hpp>

namespace hkp {

using json = nlohmann::json;
struct Undefined
{
};

struct Null
{
};

using BinaryData = std::vector<uint8_t>;

class ControlFlowData
{
public:
  enum class Type
  {
    kEarlyReturn = 0,
 };
  struct Impl;
  std::shared_ptr<Impl> impl;
};

struct MixedData
{
  json meta;
  BinaryData binary;
};

struct CustomData
{
  CustomData(const char* t, void* d)
    : type(t), data(d) {}
  
  const char* type; // type of the custom data describing the data structure
  void* data; // pointer to custom data, can be anything
};

typedef boost::variant<
  Undefined,
  std::shared_ptr<FloatRingBuffer>,
  json,
  BinaryData,
  std::string,
  Null,
  ControlFlowData,
  CustomData,
  MixedData
> Data;

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
std::optional<CustomData> getCustomDataFromData(const Data& data);
std::optional<MixedData>  getMixedDataFromData(const Data& data);

Data getControlFlowData(const Data &data);
bool isUndefined(const Data& data);
bool isNull(const Data& data);
bool isControlFlowData(const Data& data);
bool isEarlyReturn(const Data& data);
bool isCustomData(const Data& data);
// from specific types to Data
Data flatBufferToData(FloatRingBuffer::BufferType& buffer, bool isBinary);

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

ControlFlowData makeEarlyReturn(const Data& data);

template <typename T>
struct TypeId;

template <> struct TypeId<Undefined> { static constexpr uint16_t value = 0; };
template <> struct TypeId<FloatRingBuffer> { static constexpr uint16_t value = 1; };
template <> struct TypeId<std::shared_ptr<FloatRingBuffer>> { static constexpr uint16_t value = 1; };
template <> struct TypeId<json> { static constexpr uint16_t value = 2; };
template <> struct TypeId<BinaryData> { static constexpr uint16_t value = 3; };
template <> struct TypeId<std::string> { static constexpr uint16_t value = 4; };
template <> struct TypeId<Null> { static constexpr uint16_t value = 5; };
template <> struct TypeId<ControlFlowData> { static constexpr uint16_t value = 6; };
template <> struct TypeId<CustomData> { static constexpr uint16_t value = 7; };
template <> struct TypeId<MixedData>  { static constexpr uint16_t value = 8; };

template <typename T>
constexpr uint16_t getTypeId() {
  if constexpr (std::is_base_of_v<TypeId<T>, TypeId<T>>) 
  {
    return TypeId<T>::value;
  } 
  else 
  {
    return static_cast<uint16_t>(-1); // undefined type
  }
}

inline uint16_t getTypeId(const Data& data)
{
  if (data.type() == typeid(Undefined)) return TypeId<Undefined>::value;
  if (data.type() == typeid(std::shared_ptr<FloatRingBuffer>)) return TypeId<FloatRingBuffer>::value;
  if (data.type() == typeid(json)) return TypeId<json>::value;
  if (data.type() == typeid(BinaryData)) return TypeId<BinaryData>::value;
  if (data.type() == typeid(std::string)) return TypeId<std::string>::value;
  if (data.type() == typeid(Null)) return TypeId<Null>::value;
  if (data.type() == typeid(ControlFlowData)) return TypeId<ControlFlowData>::value;
  if (data.type() == typeid(CustomData)) return TypeId<CustomData>::value;
  if (data.type() == typeid(MixedData))  return TypeId<MixedData>::value;

  return static_cast<uint16_t>(-1); // undefined type
}

inline bool isPlatformLittleEndian() 
{
  uint32_t num = 1;
  return *(reinterpret_cast<uint8_t*>(&num)) == 1;
};

}