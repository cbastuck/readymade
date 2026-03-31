#include <types/data.h>

#include <boost/beast.hpp>

#include <format>

using json = nlohmann::json;
namespace beast = boost::beast;
namespace hkp
{
struct ControlFlowData::Impl 
{
  Data data;
  Type type;
};

std::string stringify(const Data& data)
{
  if (isUndefined(data))
  {
    return "<undefined>";
  }

  if (isNull(data))
  {
    return "<null>";
  }

  auto json = getJSONFromData(data);
  if (json) 
  {
    return json->dump();
  }
  
  auto rb = getRingBufferFromData(data);
  if (rb)
  {
    return "<ring buffer> s:" + std::to_string(rb->availableCount()) + " (r" + std::to_string(rb->getReadIndex()) + "w" + std::to_string(rb->getWriteIndex()) + ")";
  }

  auto str = getStringFromData(data);
  if (str)
  {
    return "\"" + *str + "\""; 
  }

  auto bin = getBinaryFromData(data);
  if (bin)
  {
    return "<binary data with size " + std::to_string(bin->size());
  }

  auto mixed = getMixedDataFromData(data);
  if (mixed)
  {
    return mixed->meta.dump();
  }

  return "unknown type";
}

namespace hkp
{
  std::ostream& operator<<(std::ostream& os, const Data& data)
  {
    os << "Data.type: " << data.which() << " content: " << stringify(data);
    return os;
  }
}

std::optional<json> getJSONFromData(const Data &data)
{
  auto isJSON = data.type() == typeid(json);
  return isJSON ? std::optional<json>(boost::get<json>(data)) : std::nullopt;
}

std::shared_ptr<FloatRingBuffer> getRingBufferFromData(const Data &data)
{
  auto isBuffer = data.type() == typeid(std::shared_ptr<FloatRingBuffer>);
  return isBuffer ? boost::get<std::shared_ptr<FloatRingBuffer>>(data) : nullptr;
}

std::optional<const BinaryData> getBinaryFromData(const Data& data)
{
  auto isBinary = data.type() == typeid(const BinaryData);
  return isBinary ? 
    std::optional<const BinaryData>(boost::get<const BinaryData>(data)) :
    std::nullopt;
}

std::optional<const std::string> getStringFromData(const Data& data)
{
  auto isString = data.type() == typeid(const std::string);
  return isString ? 
    std::optional<const std::string>(boost::get<const std::string>(data)) :
    std::nullopt;
}

std::optional<CustomData> getCustomDataFromData(const Data& data)
{
  auto isCustom = data.type() == typeid(CustomData);
  return isCustom ?
    std::optional<CustomData>(boost::get<CustomData>(data)) :
    std::nullopt;
}

std::optional<MixedData> getMixedDataFromData(const Data& data)
{
  auto isMixed = data.type() == typeid(MixedData);
  return isMixed ?
    std::optional<MixedData>(boost::get<MixedData>(data)) :
    std::nullopt;
}

Data getControlFlowData(const Data &data)
{
  auto isCtrlFlow = data.type() == typeid(ControlFlowData);
  return isCtrlFlow ? boost::get<ControlFlowData>(data).impl->data : Null();
}

bool isEarlyReturn(const Data& data)
{
  auto isCtrlFlow = data.type() == typeid(ControlFlowData);
  if (isCtrlFlow)
  {
    auto cf = boost::get<ControlFlowData>(data);
    return cf.impl->type == ControlFlowData::Type::kEarlyReturn;
  }
  return false;
}

bool isCustomData(const Data& data)
{
  return data.type() == typeid(CustomData);
}

bool isUndefined(const Data& data)
{
  return data.type() == typeid(Undefined);
}

bool isNull(const Data& data)
{
  return data.type() == typeid(Null);
}

bool isControlFlowData(const Data& data)
{
  return data.type() == typeid(ControlFlowData);
}

Data flatBufferToData(FloatRingBuffer::BufferType& buffer, bool isBinary) 
{
  auto data = static_cast<const uint8_t*>(buffer.data().data());
  if (isBinary)
  {
    return Data(std::vector<uint8_t>(data, data + buffer.size()));
  }
  
  std::string ascii(data, data + buffer.size());
  try {
    auto j = json::parse(ascii); // TODO: this is kind of brute force -> send the type information with the data
    return j.is_null() ? Data(ascii) : Data(j);
  } catch (const std::exception& e) {
    return Data(ascii);
  }  
}

template <>
std::optional<bool> getProperty(const json& j, const std::string& key)
{
  auto it = j.find(key);
  if (it == j.end() || it->is_null() || !it->is_boolean()) 
  {
    return std::nullopt;
  }
  return it->get<bool>();
}

template <>
std::optional<float> getProperty(const json& j, const std::string& key)
{
  auto it = j.find(key);
  if (it == j.end()) 
  {
    return std::nullopt;
  }
  return it->get<float>();
}

template <>
std::optional<unsigned int> getProperty(const json& j, const std::string& key)
{
  auto it = j.find(key);
  if (it == j.end()) 
  {
    return std::nullopt;
  }
  return it->get<unsigned int>();
}

template <>
std::optional<std::string> getProperty(const json& j, const std::string& key)
{
  auto it = j.find(key);
  if (it == j.end()) 
  {
    return std::nullopt;
  }
  return it->get<std::string>();
}

template <>
std::optional<json> getProperty(const json& j, const std::string& key)
{
  auto it = j.find(key);
  if (it == j.end()) 
  {
    return std::nullopt;
  }
  return it->get<json>();
}

ControlFlowData makeEarlyReturn(const Data& data)
{
  ControlFlowData cf;
  cf.impl = std::make_shared<ControlFlowData::Impl>();
  cf.impl->type = ControlFlowData::Type::kEarlyReturn;
  cf.impl->data = data;
  return cf;
}

}
