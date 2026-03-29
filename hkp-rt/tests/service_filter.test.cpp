#include <catch2/catch_test_macros.hpp>

#include <types/data.h>

#include <services/filter.h>

using namespace hkp;

TEST_CASE("Filter blocks when closed", "[services][filter]") {
  Filter filter("filter-1");
  filter.configure(json{{"open", false}});

  auto out = filter.process(json{{"type", "alpha"}});
  REQUIRE(isNull(out));
}

TEST_CASE("Filter passes through when open without template", "[services][filter]") {
  Filter filter("filter-1");
  filter.configure(json{{"open", true}});

  auto in = json{{"type", "alpha"}};
  auto out = filter.process(in);
  auto jsonOut = getJSONFromData(out);
  REQUIRE(jsonOut.has_value());
  REQUIRE(*jsonOut == in);
}

TEST_CASE("Filter returns early-return when open and template does not match", "[services][filter]") {
  Filter filter("filter-1");
  filter.configure(json{{"open", true}, {"template", json{{"type", "beta"}}}});

  auto out = filter.process(json{{"type", "alpha"}});
  REQUIRE(isEarlyReturn(out));
}

TEST_CASE("Filter supports OR matching mode", "[services][filter]") {
  Filter filter("filter-1");
  filter.configure(json{
    {"open", true},
    {"mode", "or"},
    {"template", json{{"kind", "x"}, {"group", "blue"}}}
  });

  auto out = filter.process(json{{"kind", "nope"}, {"group", "blue"}});
  auto jsonOut = getJSONFromData(out);
  REQUIRE(jsonOut.has_value());
  REQUIRE((*jsonOut)["group"] == "blue");
}
