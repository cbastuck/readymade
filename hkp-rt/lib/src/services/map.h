#pragma once

#include <iostream>
#include <string>
#include <algorithm>
#include <types/types.h>
#include <service.h>
#include <types/data.h>
#include "../common/inja.h"

namespace hkp {

class Map : public Service 
{
public:
  static std::string serviceId() { return "map"; }

  Map(const std::string& instanceId)
     : Service(instanceId, serviceId())
  { 
  }

  std::string getServiceId() const override
  {
    return serviceId();
  }

  json configure(Data data) override
  { 
    auto buf = getJSONFromData(data);
    if (buf)
    {
      if (buf->contains("template"))
      {
        m_template = (*buf)["template"];
      }
    }

    return Service::configure(data);
  }

  json getState() const override
  {
    return Service::mergeStateWith(json{
      { "template", m_template }
    });
  }

  Data process(Data data) override
  {
    auto inputJson = getJSONFromData(data);
    if (!inputJson)
    {
      std::cerr << "Map service: input data is not JSON" << std::endl;
      return Null();
    }

    if (m_template.is_null())
    {
      std::cerr << "Map service: template is not configured" << std::endl;
      return Null();
    }

    json result = processTemplate(m_template, *inputJson);
    return Data(result);
  }

private:
  json processTemplate(const json& templateNode, const json& inputData)
  {
    if (templateNode.is_object())
    {
      // Special case: if template has only one property "=", return the processed value directly
      if (templateNode.size() == 1 && templateNode.contains("="))
      {
        return processValue(templateNode["="], inputData);
      }
      
      json result = json::object();
      
      for (auto& [key, value] : templateNode.items())
      {
        // Process both key and value with inja templates
        std::string processedKey = processInjaTemplate(key, inputData);
        result[processedKey] = processValue(value, inputData);
      }
      
      return result;
    }
    else if (templateNode.is_array())
    {
      json result = json::array();
      for (const auto& item : templateNode)
      {
        result.push_back(processValue(item, inputData));
      }
      return result;
    }
    else if (templateNode.is_string())
    {
      return processInjaTemplate(templateNode.get<std::string>(), inputData);
    }
    else
    {
      // Return primitive values as-is
      return templateNode;
    }
  }

  json processValue(const json& value, const json& inputData)
  {
    if (value.is_object())
    {
      // Process recursively as a nested object
      return processTemplate(value, inputData);
    }
    else if (value.is_array())
    {
      json result = json::array();
      for (const auto& item : value)
      {
        result.push_back(processValue(item, inputData));
      }
      return result;
    }
    else if (value.is_string())
    {
      // Process string with inja template
      std::string processed = processInjaTemplate(value.get<std::string>(), inputData);
      
      // Try to parse as JSON if it looks like JSON
      if ((processed.starts_with("{") && processed.ends_with("}")) ||
          (processed.starts_with("[") && processed.ends_with("]")))
      {
        try
        {
          return json::parse(processed);
        }
        catch (...)
        {
          // Not valid JSON, return as string
          return processed;
        }
      }
      
      return processed;
    }
    else
    {
      // Return primitive values as-is
      return value;
    }
  }

private:
  json m_template;
};

}
