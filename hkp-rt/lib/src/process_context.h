#pragma once

#include <string>

#include <nlohmann/json.hpp>

#include "./uuid.h"

namespace hkp
{

/**
 * What travels with a process call rather than with the data it carries.
 *
 * The ordered service list says what runs; this says which invocation it is
 * running as. The distinction matters as soon as anything has to attribute work
 * after the fact — which run produced this, and what invoked that run — because
 * the payload cannot answer it: the same data can flow through the same
 * services for entirely unrelated reasons.
 *
 * Arrives as JSON over the session socket and was read field by field wherever
 * it was needed, which left its shape as a convention rather than a contract —
 * the divergence TODO-CONSOLIDATION.md section 4 records. Naming the fields
 * here is what lets the four runtimes agree on them.
 *
 * `requestId` is deliberately not a run identity: it is a *reply address*,
 * present only while somebody awaits a response and consumed on resolution. A
 * run outlives any number of those.
 */
struct ProcessContext
{
  /// One invocation of a board, across every service and runtime it reaches.
  std::string runId;
  /// The run this one was invoked from; empty when triggered from outside.
  std::string parentRunId;
  /// Where to send a result somebody is waiting for; empty when nobody is.
  std::string requestId;

  /// A run with no parent: something outside the board asked for this.
  static ProcessContext newRun()
  {
    ProcessContext context;
    context.runId = generateUUID();
    return context;
  }

  /**
   * A run invoked from inside another one, as a nested pipeline is.
   *
   * The child gets an identity of its own rather than borrowing its parent's,
   * so that work done inside a sub-pipeline stays distinguishable from work
   * done around it — the difference between a trace that shows nesting and one
   * that shows a flat list in timestamp order.
   */
  static ProcessContext childOf(const ProcessContext& parent)
  {
    ProcessContext context;
    context.runId = generateUUID();
    context.parentRunId = parent.runId;
    return context;
  }

  /**
   * Reads what a peer sent, filling in what it left out.
   *
   * A caller that names no run is not continuing one, so this begins one rather
   * than leaving the field empty: a run without an identity cannot be attributed
   * to at all, and every caller would otherwise have to remember to mint one.
   */
  static ProcessContext fromJson(const nlohmann::json& value)
  {
    ProcessContext context;
    if (value.is_object())
    {
      if (const auto it = value.find("runId"); it != value.end() && it->is_string())
        context.runId = it->get<std::string>();
      if (const auto it = value.find("parentRunId"); it != value.end() && it->is_string())
        context.parentRunId = it->get<std::string>();
      if (const auto it = value.find("requestId"); it != value.end() && it->is_string())
        context.requestId = it->get<std::string>();
    }
    if (context.runId.empty())
      context.runId = generateUUID();
    return context;
  }

  /// Only the fields that carry something, so a peer sees absence as absence.
  nlohmann::json toJson() const
  {
    nlohmann::json value = nlohmann::json::object();
    if (!runId.empty())
      value["runId"] = runId;
    if (!parentRunId.empty())
      value["parentRunId"] = parentRunId;
    if (!requestId.empty())
      value["requestId"] = requestId;
    return value;
  }
};

}
