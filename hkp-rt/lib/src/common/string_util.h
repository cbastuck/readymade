#pragma once

#include <string>
#include <algorithm>

namespace hkp {

inline std::string toLowerCase(const std::string& method)
{
  std::string methodNormalized = method;
  std::transform(methodNormalized.begin(), methodNormalized.end(), methodNormalized.begin(), ::tolower);
  return methodNormalized;  
}

}
