#include "./data.h"

#include <format>

std::string stringify(const Data& data)
{
  if (data.type() == typeid(Undefined))
  {
    return "<undefined>";
  }

  auto json = getJSONFromData(data);
  if (!json.is_null()) 
  {
    return json.dump();
  }
  
  auto rb = getRingBufferFromData(data);
  if (rb)
  {
    return "<ring buffer>" + std::to_string(rb->availableCount());
  }

  auto str = getStringFromData(data);
  if (str)
  {
    return *str;
  }

  auto bin = getBinaryFromData(data);
  if (bin)
  {
    return "<binary data with size " + std::to_string(bin->size());
  }

  return "unknown type";  
}

json getJSONFromData(const Data &data)
{
  auto isJSON = data.type() == typeid(json);
  return isJSON ? boost::get<json>(data) : nullptr;
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

Data flatBufferToData(boost::beast::flat_buffer& buffer, bool isBinary) 
{
  auto data = boost::asio::buffer_cast<const uint8_t*>(buffer.data());
  return isBinary ? 
    Data(std::vector<uint8_t>(data, data + buffer.size())) : 
    Data(std::string(data, data + buffer.size()));
}
