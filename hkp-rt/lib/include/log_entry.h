#pragma once

#include <chrono>
#include <ctime>
#include <iomanip>
#include <sstream>
#include <string>

#include <nlohmann/json.hpp>

namespace hkp
{

/// UTC, ISO 8601, to milliseconds — what every runtime stamps an entry with.
inline std::string isoTimestamp()
{
  using namespace std::chrono;
  const auto now = system_clock::now();
  const auto seconds = time_point_cast<std::chrono::seconds>(now);
  const auto millis = duration_cast<milliseconds>(now - seconds).count();

  const std::time_t asTime = system_clock::to_time_t(seconds);
  std::tm utc{};
#if defined(_WIN32)
  gmtime_s(&utc, &asTime);
#else
  gmtime_r(&asTime, &utc);
#endif

  std::ostringstream out;
  out << std::put_time(&utc, "%Y-%m-%dT%H:%M:%S") << '.'
      << std::setfill('0') << std::setw(3) << millis << 'Z';
  return out.str();
}

enum class LogLevel
{
  Debug,
  Info,
  Warn,
  Error
};

inline const char* toString(LogLevel level)
{
  switch (level)
  {
    case LogLevel::Debug: return "debug";
    case LogLevel::Info:  return "info";
    case LogLevel::Warn:  return "warn";
    case LogLevel::Error: return "error";
  }
  return "info";
}

/// Severity order, so a runtime can drop anything below what it records.
inline int levelRank(LogLevel level)
{
  switch (level)
  {
    case LogLevel::Debug: return 0;
    case LogLevel::Info:  return 1;
    case LogLevel::Warn:  return 2;
    case LogLevel::Error: return 3;
  }
  return 1;
}

/// The level named by a board, defaulting to info for anything unrecognised.
inline LogLevel levelFromString(const std::string& name)
{
  if (name == "debug") return LogLevel::Debug;
  if (name == "warn")  return LogLevel::Warn;
  if (name == "error") return LogLevel::Error;
  return LogLevel::Info;
}

/**
 * One thing worth recording about a run.
 *
 * A board's log is assembled by its coordinator from every runtime it spans,
 * because only the coordinator can see the whole board — a log held per runtime
 * would have to be stitched back together by timestamp to answer the first
 * question anyone asks it, which is what one run did.
 *
 * `data` is the only free-form field and therefore the only one that can carry
 * something a service did not mean to record. A runtime drops it unless the
 * board asked for it, so a service that forgets to redact can only leak through
 * a channel somebody deliberately opened.
 */
struct LogEntry
{
  std::string runId;
  std::string parentRunId;
  /// ISO 8601, set by the runtime that produced the entry.
  std::string ts;
  std::string runtimeId;
  std::string serviceUuid;
  LogLevel level = LogLevel::Info;
  /// What happened, as a short stable name a reader can group by.
  std::string event;
  nlohmann::json data;
  /// How long the call took, when the entry records one.
  double durationMs = -1;

  nlohmann::json toJson() const
  {
    nlohmann::json value = {
      {"runId", runId},
      {"ts", ts},
      {"runtimeId", runtimeId},
      {"serviceUuid", serviceUuid},
      {"level", toString(level)},
      {"event", event},
    };
    if (!parentRunId.empty())
      value["parentRunId"] = parentRunId;
    if (!data.is_null())
      value["data"] = data;
    if (durationMs >= 0)
      value["durationMs"] = durationMs;
    return value;
  }
};

}
