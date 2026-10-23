#include <catch2/catch_test_macros.hpp>

#include <string>
#include <vector>

#include "../lib/src/common/expression.h"

/**
 * The expression evaluator's reads of what is not there — the same cases are
 * pinned for the browser and hkp-node (expressionEval.test.ts,
 * expression-eval.test.ts) and for hkp-python (test_expression.py).
 */

using hkp::expression::Expression;
using json = nlohmann::json;

namespace {

json run(const std::string& source, const json& params)
{
  return Expression::parse(source).evaluate(params);
}

std::vector<std::string> reads(const std::string& source, const json& params)
{
  std::vector<std::string> missing;
  const hkp::expression::OnMissing onMissing = [&missing](const std::string& path) {
    missing.push_back(path);
  };
  Expression::parse(source).evaluate(params, &onMissing);
  return missing;
}

const json scope = json{{"a", {{"b", 1}}}, {"list", {1}}, {"none", nullptr}};

} // namespace

TEST_CASE("A member of nothing is nothing", "[expression]") {
  REQUIRE(run("params.x", scope).is_null());
  REQUIRE(run("params.x.y.z", scope).is_null());
  REQUIRE(run("params.none.y", scope).is_null());
  REQUIRE(run("params.x.y", nullptr).is_null());
  REQUIRE(run("params.x.y || 'fallback'", scope) == "fallback");
  REQUIRE(run("params.a.b", scope) == 1);
}

TEST_CASE("Reads that found nothing are reported once per chain", "[expression]") {
  using paths = std::vector<std::string>;
  REQUIRE(reads("params.a.b", scope).empty());
  REQUIRE(reads("params.titel", scope) == paths{"params.titel"});
  REQUIRE(reads("params.x.y.z", scope) == paths{"params.x"});
  REQUIRE(reads("params.a.c", scope) == paths{"params.a.c"});
  REQUIRE(reads("params.list[3]", scope) == paths{"params.list[3]"});
  REQUIRE(reads("params['x y']", scope) == paths{"params[\"x y\"]"});
  REQUIRE(reads("params.id || params.link", scope) == paths{"params.id", "params.link"});
  // Present, if empty, is not missing.
  REQUIRE(reads("params.none", scope).empty());
  // No input at all: the first read of it is what is missing.
  REQUIRE(reads("params.title", nullptr) == paths{"params.title"});
}

TEST_CASE("A predicate inside a term reports nothing of its own", "[expression]") {
  REQUIRE(reads("find(params.list, 'item.nope')", scope).empty());
}
