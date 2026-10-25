#pragma once

#include <inja/inja.hpp>

namespace hkp {
  // Check if a string contains template markers
  static bool isInjaTemplate(const std::string& str)
  {
    return str.find("{{") != std::string::npos || str.find("{%") != std::string::npos;
  }

  // Helper function to process template strings
  static std::string processInjaTemplate(const std::string& templateStr, const json& data)
  {
    // Only process if template contains inja markers
    if (!isInjaTemplate(templateStr))
    {
      return templateStr; // Use as-is for static strings
    }
    
    try
    {
      inja::Environment env;
      // An include would read the file it names, from anywhere the process can,
      // past the files guard (files.h) — and a template is what a board, or a
      // sensed input, wrote. An include renders as a failure instead.
      env.set_search_included_templates_in_files(false);
      return env.render(templateStr, data);
    }
    catch (const std::exception& e)
    {
      std::cerr << "Template rendering error: " << e.what() << std::endl;
      return templateStr; // Return original string if rendering fails
    }
  }
}
