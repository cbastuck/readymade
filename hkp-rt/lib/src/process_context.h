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
 * the divergence plans/TODO-CONSOLIDATION.md section 4 records. Naming the fields
 * here is what lets the four runtimes agree on them.
 *
 * `requestId` is deliberately not a run identity: it is a *reply address*,
 * present only while somebody awaits a response and consumed on resolution. A
 * run outlives any number of those.
 */
/**
 * Who took the action a run began with.
 *
 * Stated by the server that verified their token, never read from what they
 * sent: a payload saying who its sender is proves nothing about them. A run
 * nobody began — a timer tick, a request arriving at a mount — has none, and
 * neither does anything a server lets in without a token.
 */
struct Caller
{
  /// The token's `sub`. Empty means there is no caller.
  std::string sub;
  /// Present only when the token carried a verified one.
  std::string email;
  /// What the board's member list calls that email. Set by a coordinator that
  /// keeps such a list, and empty everywhere else.
  std::string name;

  bool empty() const { return sub.empty(); }

  /// A caller as a participant link states one; nobody when the shape is off.
  static Caller fromJson(const nlohmann::json& value)
  {
    Caller caller;
    if (!value.is_object())
      return caller;
    if (const auto it = value.find("sub"); it != value.end() && it->is_string())
      caller.sub = it->get<std::string>();
    if (caller.sub.empty())
      return caller;
    if (const auto it = value.find("email"); it != value.end() && it->is_string())
      caller.email = it->get<std::string>();
    if (const auto it = value.find("name"); it != value.end() && it->is_string())
      caller.name = it->get<std::string>();
    return caller;
  }

  nlohmann::json toJson() const
  {
    nlohmann::json value = {{"sub", sub}};
    if (!email.empty())
      value["email"] = email;
    if (!name.empty())
      value["name"] = name;
    return value;
  }
};

struct ProcessContext
{
  /// One invocation of a board, across every service and runtime it reaches.
  std::string runId;
  /// The run this one was invoked from; empty when triggered from outside.
  std::string parentRunId;
  /// Where to send a result somebody is waiting for; empty when nobody is.
  std::string requestId;
  /// Who began this run, when somebody did. It travels with the run across
  /// the runtimes of a deployed board.
  Caller caller;

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
    // Who began the work is the same person however deep it goes.
    context.caller = parent.caller;
    return context;
  }

  /**
   * Reads what a peer sent, filling in what it left out.
   *
   * A caller that names no run is not continuing one, so this begins one rather
   * than leaving the field empty: a run without an identity cannot be attributed
   * to at all, and every caller would otherwise have to remember to mint one.
   *
   * Whatever it says about who is calling is not read. That is stated by the
   * server that verified them (`forClient`), or by the board's coordinator
   * over its own link (`fromLink`), and by nothing a client can send.
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

  /**
   * The context of a run a client holding a token begins: a REST process call,
   * or a `processRuntime` on the runtime's socket. The run metadata it sent is
   * kept; the caller is whoever the server verified, or nobody where it let
   * the request in without a token.
   */
  static ProcessContext forClient(const nlohmann::json& value, const Caller& verified)
  {
    ProcessContext context = fromJson(value);
    context.caller = verified;
    return context;
  }

  /**
   * The context of a run as a coordinator says it over a participant link.
   *
   * The one path on which a caller is taken as stated: the link is the board's
   * own, opened by this server with the board's ticket, and the coordinator on
   * it is what verified the person. Kept apart from `fromJson` so that no
   * other entry point can come to trust a caller by sharing a parser.
   */
  static ProcessContext fromLink(const nlohmann::json& value)
  {
    ProcessContext context = fromJson(value);
    // The reply address belongs to whoever was waiting at the other end.
    context.requestId.clear();
    if (value.is_object())
    {
      if (const auto it = value.find("caller"); it != value.end())
        context.caller = Caller::fromJson(*it);
    }
    return context;
  }

  /// A run as it is said to another runtime: which run, and who began it. The
  /// reply address is left out — it means something only to whoever is waiting.
  nlohmann::json toWire() const
  {
    nlohmann::json value = nlohmann::json::object();
    if (!runId.empty())
      value["runId"] = runId;
    if (!parentRunId.empty())
      value["parentRunId"] = parentRunId;
    if (!caller.empty())
      value["caller"] = caller.toJson();
    return value;
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
