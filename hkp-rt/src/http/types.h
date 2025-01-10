#pragma once

struct jsonresponse : crow::response
{
  jsonresponse(const json &_body)
      : crow::response{_body.dump()}
  {
    add_header("Access-Control-Allow-Origin", "*");
    add_header("Access-Control-Allow-Headers", "Content-Type");
    add_header("Content-Type", "application/json");
  }
};
