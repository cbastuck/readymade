#pragma once

#include <memory>
#include <string>
#include <vector>

/**
 * Addressing a service inside a scope.
 *
 * A runtime's services are a flat list, and an instanceId names one of them. A
 * service holding a pipeline of its own — a SubService, an endpoint, Tracks —
 * has services inside it that the flat list does not reach, and until now
 * nothing outside could name one. A **scoped address** names it by the path
 * through the services containing it:
 *
 *     read.kept-articles          the `kept-articles` inside the `read` scope
 *     read.list.feed-doc          two levels down
 *
 * **The separator is a dot, and that is forced rather than chosen.** A service
 * address is carried in a URL path segment (`/runtimes/<id>/services/<id>`),
 * which a slash would split; the same constraint already picked a dot for the
 * separator between a unit's name and its runtime ids.
 *
 * **A flat instanceId is tried before the path is walked**, so a board whose
 * service id happens to contain a dot keeps resolving to that service rather
 * than being read as an address into something else.
 *
 * Mirrors hkp-node's src/address.ts, hkp-python's src/hkp/address.py and the
 * frontend's runtime/board/address.ts; the four must agree, since they answer
 * the same boards.
 */
namespace hkp {

class Service;

inline constexpr char ADDRESS_SEPARATOR = '.';

/** `{"read", "kept-articles"}` for `"read.kept-articles"`. */
inline std::vector<std::string> splitAddress(const std::string& address)
{
  std::vector<std::string> parts;
  std::string current;
  for (char c : address)
  {
    if (c == ADDRESS_SEPARATOR)
    {
      if (!current.empty())
        parts.push_back(current);
      current.clear();
      continue;
    }
    current.push_back(c);
  }
  if (!current.empty())
    parts.push_back(current);
  return parts;
}

/** The address of `instanceId` inside `owner`. */
inline std::string joinAddress(const std::string& owner,
                               const std::string& instanceId)
{
  if (owner.empty())
    return instanceId;
  return owner + ADDRESS_SEPARATOR + instanceId;
}

/** True where an address names something nested rather than a flat id. */
inline bool isScopedAddress(const std::string& address)
{
  return splitAddress(address).size() > 1;
}

/** The rest of an address, joined back up. */
inline std::string restOfAddress(const std::vector<std::string>& segments,
                                 size_t from)
{
  std::string rest;
  for (size_t i = from; i < segments.size(); ++i)
  {
    if (!rest.empty())
      rest.push_back(ADDRESS_SEPARATOR);
    rest += segments[i];
  }
  return rest;
}

} // namespace hkp
