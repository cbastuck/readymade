#pragma once

#include <iostream>
#include <fstream>
#include <string>
#include <algorithm>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

namespace hkp {

class Filter : public Service 
{
public:
  static std::string serviceId() { return "filter"; }

  Filter(const std::string& instanceId)
     : Service(instanceId, serviceId())
     , m_isOpen(false)
     , m_mode("AND")
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
      updateIfNeeded(m_isOpen, (*buf)["open"]);
      
      if (buf->contains("template"))
      {
        m_template = (*buf)["template"];
      }
      
      if (buf->contains("mode"))
      {
        std::string mode = (*buf)["mode"];
        std::transform(mode.begin(), mode.end(), mode.begin(), ::toupper);
        if (mode == "AND" || mode == "OR")
        {
          m_mode = mode;
        }
        else
        {
          std::cerr << "Filter service: invalid mode '" << mode << "', using AND" << std::endl;
          m_mode = "AND";
        }
      }
    };
    return Service::configure(data);
  }

  json getState() const override
  {
    return Service::mergeStateWith(json{
      { "open", m_isOpen },
      { "template", m_template },
      { "mode", m_mode }
    });
  }

  Data process(Data data) override
  {
    // If filter is not open, block
    if (!m_isOpen)
    {
      return Null();
    }
    
    // If no template is configured, pass through (backward compatible)
    if (m_template.is_null())
    {
      return data;
    }
    
    // Try to get JSON from input data
    auto inputJson = getJSONFromData(data);
    if (!inputJson)
    {
      // Not JSON, can't apply template matching, pass through
      return data;
    }
    
    // Apply template matching, send an early return if it does not match
    if (!matchesTemplate(*inputJson, m_template))
    {
      return makeEarlyReturn(data);
    }
    return data;    
  }

private:
  bool matchesTemplate(const json& inputData, const json& templateData)
  {
    // If template is not an object, we can't match properties
    if (!templateData.is_object())
    {
      return true; // Pass through if template is malformed
    }
    
    int matchCount = 0;
    int totalChecks = 0;
    
    // Check each property in the template
    for (auto& [key, templateValue] : templateData.items())
    {
      totalChecks++;
      
      // Check if the input has this property
      if (!inputData.contains(key))
      {
        // Property missing in input
        if (m_mode == "AND")
        {
          return false; // AND mode: all must match
        }
        continue; // OR mode: try next property
      }
      
      const auto& inputValue = inputData[key];
      
      // Compare values
      if (valuesMatch(inputValue, templateValue))
      {
        matchCount++;
        if (m_mode == "OR")
        {
          return true; // OR mode: at least one match is enough
        }
      }
      else
      {
        // Values don't match
        if (m_mode == "AND")
        {
          return false; // AND mode: all must match
        }
      }
    }
    
    // For AND mode: all checks must have matched
    // For OR mode: at least one must have matched
    if (m_mode == "AND")
    {
      return matchCount == totalChecks;
    }
    else // OR mode
    {
      return matchCount > 0;
    }
  }
  
  bool valuesMatch(const json& inputValue, const json& templateValue)
  {
    // Direct comparison for same types
    if (inputValue.type() == templateValue.type())
    {
      return inputValue == templateValue;
    }
    
    // For different types, try string comparison (case-insensitive for strings)
    if (inputValue.is_string() && templateValue.is_string())
    {
      std::string inputStr = inputValue.get<std::string>();
      std::string templateStr = templateValue.get<std::string>();
      
      std::transform(inputStr.begin(), inputStr.end(), inputStr.begin(), ::tolower);
      std::transform(templateStr.begin(), templateStr.end(), templateStr.begin(), ::tolower);
      
      return inputStr == templateStr;
    }
    
    // Convert both to strings and compare
    std::string inputStr = inputValue.is_string() ? 
      inputValue.get<std::string>() : inputValue.dump();
    std::string templateStr = templateValue.is_string() ? 
      templateValue.get<std::string>() : templateValue.dump();
    
    return inputStr == templateStr;
  }

private:
  bool m_isOpen;
  json m_template;
  std::string m_mode;
};

}
