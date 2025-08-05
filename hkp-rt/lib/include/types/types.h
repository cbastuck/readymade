#pragma once

#include "./ringbuffer.h"
#include "./data.h"
#include "./owns_me.h"
#include "./models.h"

template <typename T>
inline bool updateIfNeeded(T& target, const json& update)
{
  if (update.is_null())
  {
    return false;
  }

  if (update == target)
  {
    return false;
  }

  target = update;
  return true;
}

inline bool updateIfNeeded(json& target, json& update)
{
  if (update.is_null())
  {
    return false;
  }
  target = update;
  return true;
}
