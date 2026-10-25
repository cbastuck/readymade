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
 *
 * What a pass says about itself is notified when it changes, and is part of the
 * state while there is something to say, so a panel opened later shows it;
 * configuring it does nothing. The same in every runtime (browser Map.ts,
 * hkp-node map.ts, hkp-python map_service.py):
 *
 * - `error`: a term that does not parse — said when the template is configured
 *   — or that fails to evaluate. A failing pass stops the flow (Null), since a
 *   mapping that could not be made has nothing to pass on, and is logged, since
 *   nobody may be watching. With an array input, one failing element fails the
 *   pass. (An Inja template that fails to render still logs and keeps its text,
 *   as it always has.)
 * - `warnings`: a term whose value is empty because what it read was not there
 *   — `title: params.titel not found`. The flow goes on: an absent field is
 *   often legitimate, and a typo is only visible this way.
 *
 * A lone "=" is the value of its term, whatever the mode; a null one has
 * nothing to pass on.
 */
namespace hkp {

class Map : public Service
{
  // A term that failed, named by where it sits in the template.
  struct TermError : std::runtime_error
  {
    using std::runtime_error::runtime_error;
  };

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
    json state{
      { "template", m_template },
      { "mode", m_mode },
      { "arrayMode", m_arrayMode },
      { "sensingMode", m_sensingMode }
    };
    if (!m_reportedError.empty())
    {
      state["error"] = m_reportedError;
    }
    if (!m_reportedWarnings.empty())
    {
      state["warnings"] = m_reportedWarnings;
    }
    return Service::mergeStateWith(state);
  }

  Data process(Data data) override
  {
    // No input — a Map at the head of a board run without anything before it
    // — still builds its template, as in the other runtimes; `params` is null.
    auto inputJson = isUndefined(data) ? std::optional<json>(nullptr) : getJSONFromData(data);
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
      updateTemplate(sensed(learned));
      updateSensingMode(false);
      return Null();
    }

    m_passWarnings.clear();
    try
    {
      json result;
      if (m_arrayMode != "single" && inputJson->is_array())
      {
        result = json::array();
        for (const auto& item : *inputJson)
        {
          result.push_back(mapOne(item));
        }
      }
      else
      {
        result = mapOne(*inputJson);
      }
      report("", m_passWarnings);
      if (result.is_null())
      {
        return Null(); // a lone "=" that is null has nothing to pass on
      }
      return Data(result);
    }
    catch (const TermError& e)
    {
      report(e.what(), m_passWarnings);
      log(LogLevel::Error, "service.failed", json{{"message", e.what()}});
      return Null();
    }
    catch (const std::exception& e)
    {
      // A fault in the Map rather than in its template, so it is not the
      // Map's error. Stopped here rather than thrown on, as the other runtimes
      // do: a run hkp-rt starts on its event loop, a timer's, has nothing above
      // it to catch it.
      std::cerr << "Map service: " << e.what() << std::endl;
      log(LogLevel::Error, "service.failed", json{{"message", e.what()}});
      return Null();
    }
  }

private:
  json mapOne(const json& inputData)
  {
    const json mapped = processTemplate(m_template, inputData, "");
    return isLoneTerm(m_template) ? mapped : mergeWithInput(mapped, inputData);
  }

  // An object of a lone "=" key, which stands for its term's value.
  static bool isLoneTerm(const json& node)
  {
    return node.is_object() && node.size() == 1 && node.contains("=");
  }

  // Where a term sits in a template: `items.0.title`. A lone "=" adds nothing
  // to the path, since it stands for the value it sits in; at the top it is
  // named "=". The one rule both configuring and a pass name a term by, so the
  // same failure is said in the same words.
  static std::string pathIn(const std::string& label, const std::string& key)
  {
    if (key.empty())
    {
      return label.empty() ? "=" : label;
    }
    return label.empty() ? key : label + "." + key;
  }

  // Notifies what a pass or a template said about itself, when it changed.
  void report(const std::string& error, const std::vector<std::string>& warnings)
  {
    if (error != m_reportedError)
    {
      sendNotification(json{{"error", error}});
    }
    if (warnings != m_reportedWarnings)
    {
      sendNotification(json{{"warnings", warnings}});
    }
    m_reportedError = error;
    m_reportedWarnings = warnings;
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

  json processTemplate(const json& templateNode, const json& inputData, const std::string& label)
  {
    if (templateNode.is_object())
    {
      // A lone "=" key maps to a scalar rather than to an object.
      if (isLoneTerm(templateNode))
      {
        return processDynamicValue(templateNode["="], inputData, pathIn(label, ""));
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
          ? processDynamicValue(value, inputData, pathIn(label, name))
          : processValue(value, inputData, pathIn(label, name));

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
      for (size_t i = 0; i < templateNode.size(); ++i)
      {
        result.push_back(processValue(templateNode[i], inputData, pathIn(label, std::to_string(i))));
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

  json processValue(const json& value, const json& inputData, const std::string& label)
  {
    if (value.is_object())
    {
      // Process recursively as a nested object
      return processTemplate(value, inputData, label);
    }
    else if (value.is_array())
    {
      json result = json::array();
      for (size_t i = 0; i < value.size(); ++i)
      {
        result.push_back(processValue(value[i], inputData, pathIn(label, std::to_string(i))));
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
  // meaning; everything else is an expression over `params`. A failure is
  // named by `label`, where the term sits in the template; an empty value whose
  // reads found nothing is a warning.
  json processDynamicValue(const json& value, const json& inputData, const std::string& label)
  {
    if (!value.is_string())
    {
      return processValue(value, inputData, label);
    }

    const std::string& source = value.get_ref<const std::string&>();
    if (isInjaTemplate(source))
    {
      return processValue(value, inputData, label);
    }

    std::vector<std::string> missing;
    const expression::OnMissing onMissing = [&missing](const std::string& path) {
      missing.push_back(path);
    };
    json result;
    try
    {
      result = compile(source).evaluate(inputData, &onMissing);
    }
    catch (const expression::ParseError& e)
    {
      throw TermError(label + ": " + invalidExpression(source, e));
    }
    catch (const std::exception& e)
    {
      throw TermError(label + ": " + e.what());
    }

    if (result.is_null() && !missing.empty())
    {
      std::string paths;
      for (const auto& path : missing)
      {
        paths += (paths.empty() ? "" : ", ") + path;
      }
      const std::string warning = label + ": " + paths + " not found";
      if (std::find(m_passWarnings.begin(), m_passWarnings.end(), warning) == m_passWarnings.end())
      {
        m_passWarnings.push_back(warning);
      }
    }
    return result;
  }

  static std::string invalidExpression(const std::string& source, const std::exception& e)
  {
    return "invalid expression '" + source + "': " + e.what();
  }

  // The first term in a template that does not parse, named — said as soon as
  // the template is configured rather than on the first pass.
  static std::string firstParseError(const json& node, const std::string& label)
  {
    if (node.is_array())
    {
      for (size_t i = 0; i < node.size(); ++i)
      {
        const std::string error = firstParseError(node[i], pathIn(label, std::to_string(i)));
        if (!error.empty())
        {
          return error;
        }
      }
      return "";
    }
    if (!node.is_object())
    {
      return "";
    }
    for (const auto& [key, value] : node.items())
    {
      const bool dynamic = !key.empty() && key.back() == '=';
      const std::string name = dynamic ? key.substr(0, key.size() - 1) : key;
      const std::string where = pathIn(label, name);
      if (dynamic && value.is_string() && !isInjaTemplate(value.get<std::string>()))
      {
        try
        {
          expression::Expression::parse(value.get<std::string>());
        }
        catch (const expression::ParseError& e)
        {
          return where + ": " + invalidExpression(value.get<std::string>(), e);
        }
      }
      else
      {
        const std::string error = firstParseError(value, where);
        if (!error.empty())
        {
          return error;
        }
      }
    }
    return "";
  }

  // Expressions are parsed once per distinct source and reused across inputs.
  // A source that does not parse throws here, which fails the pass.
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
    report(firstParseError(m_template, ""), {});
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

  // A sensed template: the shape of what arrived, and nothing that runs — as in
  // the other runtimes. Sensing builds a template out of input, which arrives
  // from wherever the board is fed, and a template runs: a key ending in "=" is
  // an expression, and a key or text carrying an Inja marker is rendered. So the
  // suffix is dropped rather than the field, and a marker is escaped to render
  // back to exactly what arrived.
  static json sensed(const json& learned)
  {
    json safe = json::object();
    for (const auto& [key, value] : learned.items())
    {
      std::string name = key;
      while (!name.empty() && name.back() == '=')
      {
        name.pop_back();
      }
      safe[literalText(name)] = value.is_string() ? json(literalText(value.get<std::string>())) : value;
    }
    return safe;
  }

  // Text that Inja renders as itself. Only text with a marker is rendered at
  // all; in it, every "{" and "#" — what opens an expression, a statement, a
  // comment or a line statement — is written as an expression that produces it.
  static std::string literalText(const std::string& text)
  {
    if (!isInjaTemplate(text))
    {
      return text;
    }
    std::string escaped;
    for (const char c : text)
    {
      if (c == '{' || c == '#')
      {
        escaped += std::string("{{ \"") + c + "\" }}";
      }
      else
      {
        escaped += c;
      }
    }
    return escaped;
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
  // What the current pass found empty, and what was last notified about the
  // template, so only a change is.
  std::vector<std::string> m_passWarnings;
  std::string m_reportedError;
  std::vector<std::string> m_reportedWarnings;
};

}
