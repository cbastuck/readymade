#pragma once

#include <iostream>
#include <map>
#include <optional>
#include <string>
#include <algorithm>
#include <types/types.h>
#include <service.h>
#include <types/data.h>
#include "../common/inja.h"
#include "../common/expression.h"

/**
 * Service Documentation
 * Service ID: map
 * Service Name: Map
 * Runtime: hkp-rt
 * Modes: replace | add | overwrite | sensingMode
 * Key Config: template, mode, arrayMode, sensingMode
 * IO: in=object|array|scalar -> out=mapped payload
 * Arrays: maps each element (arrayMode "single" maps the array as a whole)
 * Binary: not intended for raw binary
 * MixedData: native in runtime (service-dependent usage)
 *
 * The template dialect matches the browser and Node runtimes so all three share
 * one UI: a key ending in "=" is a dynamic term whose value is an expression
 * evaluated against `params`, a plain key is a static value, a dot in a key
 * nests the result, and a lone "=" key produces a scalar instead of an object.
 *
 * Inja templates keep working alongside that: a string value carrying "{{" or
 * "{%" is rendered by Inja against the incoming data, whether or not its key is
 * dynamic. Templates written before the `=` convention therefore behave as they
 * always did.
 */
namespace hkp {

class Map : public Service
{
public:
  static std::string serviceId() { return "map"; }
  static std::string version() { return "v1"; }

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
        updateTemplate((*buf)["template"]);
      }

      if (buf->contains("mode") && (*buf)["mode"].is_string())
      {
        const std::string mode = (*buf)["mode"].get<std::string>();
        if (mode == "replace" || mode == "add" || mode == "overwrite")
        {
          m_mode = mode;
          sendNotification(json{{"mode", m_mode}});
        }
        else
        {
          std::cerr << "Map service: invalid mode '" << mode << "', keeping '"
                    << m_mode << "'" << std::endl;
        }
      }

      if (buf->contains("arrayMode") && (*buf)["arrayMode"].is_string())
      {
        const std::string arrayMode = (*buf)["arrayMode"].get<std::string>();
        if (arrayMode == "array" || arrayMode == "single")
        {
          m_arrayMode = arrayMode;
          sendNotification(json{{"arrayMode", m_arrayMode}});
        }
      }

      if (buf->contains("sensingMode") && (*buf)["sensingMode"].is_boolean())
      {
        updateSensingMode((*buf)["sensingMode"].get<bool>());
      }

      if (buf->contains("command") && (*buf)["command"].is_object())
      {
        runCommand((*buf)["command"]);
      }
    }

    return Service::configure(data);
  }

  json getState() const override
  {
    return Service::mergeStateWith(json{
      { "template", m_template },
      { "mode", m_mode },
      { "arrayMode", m_arrayMode },
      { "sensingMode", m_sensingMode }
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

    // Sensing derives a template from the data that arrives and hands the flow
    // no result — the next input is the first one that is mapped.
    if (m_sensingMode)
    {
      json learned = json::object();
      flattenInto(*inputJson, "", learned);
      updateTemplate(learned);
      updateSensingMode(false);
      return Null();
    }

    if (m_arrayMode != "single" && inputJson->is_array())
    {
      json result = json::array();
      for (const auto& item : *inputJson)
      {
        result.push_back(mapOne(item));
      }
      return Data(result);
    }

    return Data(mapOne(*inputJson));
  }

private:
  json mapOne(const json& inputData)
  {
    try
    {
      return mergeWithInput(processTemplate(m_template, inputData), inputData);
    }
    catch (const std::exception& e)
    {
      std::cerr << "Map service: " << e.what() << " in template "
                << m_template.dump() << std::endl;
      return inputData; // identity - the mapping could not be applied
    }
  }

  // Merging only applies when both sides are objects; a template that produced
  // an array or a scalar replaces the input whatever the mode.
  json mergeWithInput(const json& mapped, const json& inputData) const
  {
    if (m_mode == "replace" || !mapped.is_object() || !inputData.is_object())
    {
      return mapped;
    }

    if (m_mode == "overwrite") // template wins
    {
      json result = inputData;
      result.update(mapped);
      return result;
    }

    json result = mapped; // add: input wins
    result.update(inputData);
    return result;
  }

  json processTemplate(const json& templateNode, const json& inputData)
  {
    if (templateNode.is_object())
    {
      // A lone "=" key maps to a scalar rather than to an object.
      if (templateNode.size() == 1 && templateNode.contains("="))
      {
        return processDynamicValue(templateNode["="], inputData);
      }

      json result = json::object();

      for (auto& [key, value] : templateNode.items())
      {
        const bool dynamic = !key.empty() && key.back() == '=';
        const std::string name = dynamic ? key.substr(0, key.size() - 1) : key;

        // Keys stay Inja-renderable, so a template may compute the property
        // name as well as the value.
        const std::string processedKey = processInjaTemplate(name, inputData);
        const json processedValue = dynamic
          ? processDynamicValue(value, inputData)
          : processValue(value, inputData);

        if (processedKey.find('.') != std::string::npos)
        {
          mergeAtPath(result, processedValue, processedKey);
        }
        else
        {
          result[processedKey] = processedValue;
        }
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

  // The value behind a key marked dynamic with "=". Inja markers keep their
  // meaning; everything else is an expression over `params`.
  json processDynamicValue(const json& value, const json& inputData)
  {
    if (!value.is_string())
    {
      return processValue(value, inputData);
    }

    const std::string& source = value.get_ref<const std::string&>();
    if (isInjaTemplate(source))
    {
      return processValue(value, inputData);
    }

    return compile(source).evaluate(inputData);
  }

  // Expressions are parsed once per distinct source and reused across inputs.
  // A source that does not parse throws here, which mapOne turns into an
  // identity mapping for that input.
  const expression::Expression& compile(const std::string& source)
  {
    auto it = m_expressions.find(source);
    if (it == m_expressions.end())
    {
      it = m_expressions.emplace(source, expression::Expression::parse(source)).first;
    }
    return it->second;
  }

  // An empty template is a valid one - in replace mode it maps to an empty
  // object, in the merge modes it passes the input through. Null is stored as
  // an empty object so the state the mapping UI edits is always an object.
  void updateTemplate(const json& templateNode)
  {
    m_template = templateNode.is_null() ? json::object() : templateNode;
    m_expressions.clear();
    sendNotification(json{{"template", m_template}});
  }

  void updateSensingMode(bool isActive)
  {
    m_sensingMode = isActive;
    sendNotification(json{{"sensingMode", m_sensingMode}});
  }

  void runCommand(const json& command)
  {
    if (!command.contains("action") || command["action"] != "inject")
    {
      return;
    }

    const json params = command.contains("params") ? command["params"] : json::object();
    Data result = process(Data(params));
    if (isNull(result) || isUndefined(result))
    {
      return; // the mapping stopped the flow - nothing to push
    }

    try
    {
      nextAsync(result); // posts via the App io_context - safe from the HTTP thread
    }
    catch (const std::exception& e)
    {
      // A service that is not part of a pipeline has nowhere to push to.
      std::cerr << "Map service: cannot inject - " << e.what() << std::endl;
    }
  }

  // Turns nested data into the dotted-key template the mapping UI edits, e.g.
  // { "a": { "b": 1 } } becomes { "a.b": 1 }.
  static void flattenInto(const json& value, const std::string& prefix, json& target)
  {
    if (value.is_object() && !value.empty())
    {
      for (const auto& [key, entry] : value.items())
      {
        flattenInto(entry, prefix.empty() ? key : prefix + "." + key, target);
      }
      return;
    }

    if (value.is_array() && !value.empty())
    {
      for (size_t i = 0; i < value.size(); ++i)
      {
        const std::string key = std::to_string(i);
        flattenInto(value[i], prefix.empty() ? key : prefix + "." + key, target);
      }
      return;
    }

    target[prefix.empty() ? "value" : prefix] = value;
  }

  static void mergeAtPath(json& destination, const json& value, const std::string& path)
  {
    json* branch = &destination;
    size_t start = 0;

    while (true)
    {
      const size_t separator = path.find('.', start);
      const std::string segment = path.substr(
        start, separator == std::string::npos ? std::string::npos : separator - start);

      if (separator == std::string::npos)
      {
        (*branch)[segment] = value;
        return;
      }

      json& child = (*branch)[segment];
      if (!child.is_object())
      {
        child = json::object();
      }
      branch = &child;
      start = separator + 1;
    }
  }

private:
  json m_template = json::object();
  std::string m_mode = "replace";
  std::string m_arrayMode = "array";
  bool m_sensingMode = false;
  std::map<std::string, expression::Expression> m_expressions;
};

}
