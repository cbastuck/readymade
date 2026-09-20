#pragma once

#include <map>
#include <string>

#include <types/data.h>

namespace hkp {

// Named cells two pipelines can share a value through.
//
// A pipeline pass carries one value and ends; anything that has to survive
// until a *different* pipeline runs has nowhere to live. A store gives it a
// name, and whoever owns the pipelines that must share decides which store they
// see — which is what keeps the sharing scoped to the arrangement that needs it
// rather than being ambient across a runtime.
//
// Deliberately not a cache: nothing expires, nothing is computed on a miss. It
// is a cell, and the services that read and write it say what it means.
//
// Matches hkp-node's SlotStore and hkp-python's, so a board written against one
// runtime behaves the same on another.
class SlotStore
{
public:
  // What is held under `name`, or Undefined where nothing has been written —
  // which is what a default-constructed Data already is. The service reading
  // decides what an empty cell means for it; here it is only "not set".
  Data get(const std::string& name) const
  {
    const auto it = m_cells.find(name);
    return it == m_cells.end() ? Data{} : it->second;
  }

  void set(const std::string& name, Data value) { m_cells[name] = std::move(value); }

private:
  std::map<std::string, Data> m_cells;
};

} // namespace hkp
