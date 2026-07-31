#pragma once

/**
 * Expression evaluation for services that let a board author write small
 * dynamic terms — a Map template's `key=` rows, for example.
 *
 * An expression is a single JavaScript-style expression evaluated with the
 * incoming data bound to `params` and the helper functions below in scope. The
 * browser and Node runtimes evaluate the same sources, so the dialect and the
 * helper set are kept aligned: a template authored in the shared Map UI behaves
 * the same whichever runtime hosts the service. Helpers that need a browser
 * (DOM, vault, AudioContext) have no counterpart here.
 *
 * Supported: literals (number, string, true/false/null), array literals,
 * identifiers, member and index access, calls into the builtin table, unary
 * `!`/`-`/`+`, `* / %`, `+ -`, `< <= > >=`, `== != === !==`, `&& ||` and the
 * ternary operator. There are no assignments, no statements and no lambdas —
 * `find`/`filter` take their predicate as an expression string with the element
 * bound to `item` (and its position to `index`).
 *
 *   Expression e = Expression::parse("round(params.value * 2)");
 *   json result = e.evaluate(input);   // throws EvaluationError on failure
 */

#include <algorithm>
#include <array>
#include <cctype>
#include <chrono>
#include <cmath>
#include <ctime>
#include <functional>
#include <iomanip>
#include <iostream>
#include <limits>
#include <map>
#include <memory>
#include <random>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "../uuid.h"

namespace hkp {
namespace expression {

using json = nlohmann::json;

class ParseError : public std::runtime_error
{
public:
  explicit ParseError(const std::string& what) : std::runtime_error(what) {}
};

class EvaluationError : public std::runtime_error
{
public:
  explicit EvaluationError(const std::string& what) : std::runtime_error(what) {}
};

// Variables visible to an expression. Always holds "params"; find/filter add
// "item" and "index" while evaluating their predicate.
using Scope = std::map<std::string, json>;

// ── Value helpers ────────────────────────────────────────────────────────────

inline bool isTruthy(const json& value)
{
  if (value.is_null())
  {
    return false;
  }
  if (value.is_boolean())
  {
    return value.get<bool>();
  }
  if (value.is_number())
  {
    return value.get<double>() != 0.0;
  }
  if (value.is_string())
  {
    return !value.get<std::string>().empty();
  }
  return true; // objects and arrays are truthy, empty or not
}

inline double toNumber(const json& value)
{
  if (value.is_number())
  {
    return value.get<double>();
  }
  if (value.is_boolean())
  {
    return value.get<bool>() ? 1.0 : 0.0;
  }
  if (value.is_string())
  {
    try
    {
      size_t consumed = 0;
      const auto& text = value.get_ref<const std::string&>();
      double parsed = std::stod(text, &consumed);
      while (consumed < text.size() && std::isspace(static_cast<unsigned char>(text[consumed])))
      {
        ++consumed;
      }
      return consumed == text.size() ? parsed : std::nan("");
    }
    catch (const std::exception&)
    {
      return std::nan("");
    }
  }
  if (value.is_null())
  {
    return 0.0;
  }
  return std::nan("");
}

// Numbers are rendered the way JSON.stringify would: integral values without a
// decimal tail, so string concatenation does not turn 42 into "42.0".
inline std::string toText(const json& value)
{
  if (value.is_string())
  {
    return value.get<std::string>();
  }
  if (value.is_null())
  {
    return "null";
  }
  if (value.is_boolean())
  {
    return value.get<bool>() ? "true" : "false";
  }
  if (value.is_number_integer())
  {
    return std::to_string(value.get<int64_t>());
  }
  if (value.is_number_float())
  {
    double number = value.get<double>();
    if (std::isnan(number) || std::isinf(number))
    {
      return std::isnan(number) ? "NaN" : (number > 0 ? "Infinity" : "-Infinity");
    }
    if (number == std::floor(number) && std::fabs(number) < 1e15)
    {
      return std::to_string(static_cast<int64_t>(number));
    }
    std::ostringstream out;
    out << std::setprecision(15) << number;
    return out.str();
  }
  return value.dump();
}

// A double result that is integral is stored as an integer, so downstream
// consumers see 4 rather than 4.0. NaN has no JSON representation and becomes
// null, mirroring what JSON.stringify does with it in the other runtimes.
inline json fromNumber(double number)
{
  if (std::isnan(number) || std::isinf(number))
  {
    return json();
  }
  if (number == std::floor(number) && std::fabs(number) < 9.2e18)
  {
    return json(static_cast<int64_t>(number));
  }
  return json(number);
}

// ── Date helpers (moment-style token subset shared with the other runtimes) ──

inline const std::vector<std::string>& monthNames()
{
  static const std::vector<std::string> names = {
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"};
  return names;
}

inline const std::vector<std::string>& weekdayNames()
{
  static const std::vector<std::string> names = {
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"};
  return names;
}

struct FormatToken
{
  bool literal = false;
  std::string text; // token name, or the literal text
};

inline std::vector<FormatToken> tokenizeFormat(const std::string& format)
{
  static const std::vector<std::string> tokens = {
    "YYYY", "YY", "MMMM", "MMM", "MM", "M", "DD", "D", "dddd", "ddd",
    "HH", "H", "hh", "h", "mm", "m", "ss", "s", "A", "a"};

  std::vector<FormatToken> result;
  size_t i = 0;
  std::string literal;

  auto flushLiteral = [&]() {
    if (!literal.empty())
    {
      result.push_back(FormatToken{true, literal});
      literal.clear();
    }
  };

  while (i < format.size())
  {
    if (format[i] == '[')
    {
      const size_t end = format.find(']', i);
      if (end != std::string::npos)
      {
        literal += format.substr(i + 1, end - i - 1);
        i = end + 1;
        continue;
      }
    }

    bool matched = false;
    for (const auto& token : tokens)
    {
      if (format.compare(i, token.size(), token) == 0)
      {
        flushLiteral();
        result.push_back(FormatToken{false, token});
        i += token.size();
        matched = true;
        break;
      }
    }

    if (!matched)
    {
      literal += format[i];
      ++i;
    }
  }

  flushLiteral();
  return result;
}

inline std::string pad(int value, int width = 2)
{
  std::ostringstream out;
  out << std::setw(width) << std::setfill('0') << value;
  return out.str();
}

inline std::string formatTime(const std::tm& tm, const std::string& format)
{
  std::string result;
  const int hours12 = (tm.tm_hour % 12 == 0) ? 12 : tm.tm_hour % 12;

  for (const auto& token : tokenizeFormat(format))
  {
    if (token.literal)
    {
      result += token.text;
      continue;
    }

    const std::string& t = token.text;
    if (t == "YYYY") { result += std::to_string(tm.tm_year + 1900); }
    else if (t == "YY") { result += pad((tm.tm_year + 1900) % 100); }
    else if (t == "MMMM") { result += monthNames()[tm.tm_mon]; }
    else if (t == "MMM") { result += monthNames()[tm.tm_mon].substr(0, 3); }
    else if (t == "MM") { result += pad(tm.tm_mon + 1); }
    else if (t == "M") { result += std::to_string(tm.tm_mon + 1); }
    else if (t == "DD") { result += pad(tm.tm_mday); }
    else if (t == "D") { result += std::to_string(tm.tm_mday); }
    else if (t == "dddd") { result += weekdayNames()[tm.tm_wday % 7]; }
    else if (t == "ddd") { result += weekdayNames()[tm.tm_wday % 7].substr(0, 3); }
    else if (t == "HH") { result += pad(tm.tm_hour); }
    else if (t == "H") { result += std::to_string(tm.tm_hour); }
    else if (t == "hh") { result += pad(hours12); }
    else if (t == "h") { result += std::to_string(hours12); }
    else if (t == "mm") { result += pad(tm.tm_min); }
    else if (t == "m") { result += std::to_string(tm.tm_min); }
    else if (t == "ss") { result += pad(tm.tm_sec); }
    else if (t == "s") { result += std::to_string(tm.tm_sec); }
    else if (t == "A") { result += tm.tm_hour < 12 ? "AM" : "PM"; }
    else if (t == "a") { result += tm.tm_hour < 12 ? "am" : "pm"; }
  }

  return result;
}

// Reads a date written in the token subset above. Returns false when the text
// does not line up with the format, leaving the caller to fall back.
inline bool parseTime(const std::string& text, const std::string& format, std::tm& out)
{
  std::tm tm{};
  tm.tm_year = 70;
  tm.tm_mday = 1;
  tm.tm_isdst = -1;
  bool pm = false;
  bool hours12 = false;

  size_t pos = 0;
  const std::string trimmedText = [&]() {
    size_t begin = text.find_first_not_of(" \t");
    size_t end = text.find_last_not_of(" \t");
    return begin == std::string::npos ? std::string() : text.substr(begin, end - begin + 1);
  }();

  auto readNumber = [&](int maxDigits) -> int {
    size_t start = pos;
    while (pos < trimmedText.size() && pos - start < static_cast<size_t>(maxDigits) &&
           std::isdigit(static_cast<unsigned char>(trimmedText[pos])))
    {
      ++pos;
    }
    if (pos == start)
    {
      return -1;
    }
    return std::stoi(trimmedText.substr(start, pos - start));
  };

  auto readName = [&]() -> std::string {
    size_t start = pos;
    while (pos < trimmedText.size() && std::isalpha(static_cast<unsigned char>(trimmedText[pos])))
    {
      ++pos;
    }
    return trimmedText.substr(start, pos - start);
  };

  for (const auto& token : tokenizeFormat(format))
  {
    if (token.literal)
    {
      if (trimmedText.compare(pos, token.text.size(), token.text) != 0)
      {
        return false;
      }
      pos += token.text.size();
      continue;
    }

    const std::string& t = token.text;
    if (t == "YYYY" || t == "YY")
    {
      const int value = readNumber(t.size() == 4 ? 4 : 2);
      if (value < 0) { return false; }
      tm.tm_year = (t == "YYYY" ? value : 2000 + value) - 1900;
    }
    else if (t == "MMMM" || t == "MMM")
    {
      const std::string name = readName();
      if (name.empty()) { return false; }
      const auto& months = monthNames();
      auto it = std::find_if(months.begin(), months.end(), [&](const std::string& month) {
        return month.size() >= name.size() &&
               std::equal(name.begin(), name.end(), month.begin(), [](char a, char b) {
                 return std::tolower(static_cast<unsigned char>(a)) ==
                        std::tolower(static_cast<unsigned char>(b));
               });
      });
      if (it == months.end()) { return false; }
      tm.tm_mon = static_cast<int>(std::distance(months.begin(), it));
    }
    else if (t == "dddd" || t == "ddd")
    {
      if (readName().empty()) { return false; } // weekday carries no information
    }
    else if (t == "A" || t == "a")
    {
      const std::string name = readName();
      if (name.size() != 2) { return false; }
      pm = std::tolower(static_cast<unsigned char>(name[0])) == 'p';
    }
    else
    {
      const int value = readNumber(2);
      if (value < 0) { return false; }
      if (t == "MM" || t == "M") { tm.tm_mon = value - 1; }
      else if (t == "DD" || t == "D") { tm.tm_mday = value; }
      else if (t == "HH" || t == "H") { tm.tm_hour = value; }
      else if (t == "hh" || t == "h") { tm.tm_hour = value; hours12 = true; }
      else if (t == "mm" || t == "m") { tm.tm_min = value; }
      else if (t == "ss" || t == "s") { tm.tm_sec = value; }
    }
  }

  if (pos != trimmedText.size())
  {
    return false;
  }

  if (hours12)
  {
    tm.tm_hour = (tm.tm_hour % 12) + (pm ? 12 : 0);
  }

  std::tm normalized = tm;
  const std::time_t stamp = std::mktime(&normalized);
  if (stamp == static_cast<std::time_t>(-1))
  {
    return false;
  }

  out = normalized;
  return true;
}

// Milliseconds since the epoch for anything the other runtimes accept as a
// timestamp: a number, or an ISO-8601 string.
inline bool toEpochMillis(const json& value, int64_t& out)
{
  if (value.is_number())
  {
    out = static_cast<int64_t>(value.get<double>());
    return true;
  }

  if (!value.is_string())
  {
    return false;
  }

  const std::string text = value.get<std::string>();
  std::tm tm{};
  tm.tm_isdst = -1;
  std::istringstream in(text);
  in >> std::get_time(&tm, "%Y-%m-%dT%H:%M:%S");
  if (in.fail())
  {
    std::istringstream dateOnly(text);
    dateOnly >> std::get_time(&tm, "%Y-%m-%d");
    if (dateOnly.fail())
    {
      return false;
    }
  }

  // Trailing "Z" or "+00:00" means UTC; anything else is read as local time,
  // which is what a bare "2026-07-30T12:00:00" means everywhere else too.
  const bool utc = text.find('Z') != std::string::npos ||
                   text.find("+00:00") != std::string::npos;
#ifdef _WIN32
  const std::time_t stamp = utc ? _mkgmtime(&tm) : std::mktime(&tm);
#else
  const std::time_t stamp = utc ? timegm(&tm) : std::mktime(&tm);
#endif
  if (stamp == static_cast<std::time_t>(-1))
  {
    return false;
  }

  out = static_cast<int64_t>(stamp) * 1000;
  return true;
}

inline int64_t nowMillis()
{
  return std::chrono::duration_cast<std::chrono::milliseconds>(
           std::chrono::system_clock::now().time_since_epoch())
    .count();
}

// ── AST ──────────────────────────────────────────────────────────────────────

class Expression;

namespace detail {

struct Node;
using NodePtr = std::shared_ptr<const Node>;

using Builtin = std::function<json(const std::vector<json>&)>;
const std::map<std::string, Builtin>& builtins();

struct Node
{
  enum class Kind
  {
    Literal,
    Identifier,
    Member,   // object.property / object[property]
    Call,
    Unary,
    Binary,
    Logical,
    Conditional,
    ArrayLiteral
  };

  Kind kind = Kind::Literal;
  json value;                   // Literal
  std::string name;             // Identifier, Member property, Unary/Binary/Logical operator
  bool computed = false;        // Member: true for object[expr]
  NodePtr left;                 // Member object, Unary/Binary operand, Conditional test, Call callee
  NodePtr right;                // Binary right, Member computed property, Conditional consequent
  NodePtr third;                // Conditional alternate
  std::vector<NodePtr> items;   // Call arguments, array literal items
};

// Flattens an identifier/member chain into a dotted name, so `uuid.v4` can be
// looked up in the builtin table. Returns false for anything else.
inline bool calleeName(const NodePtr& node, std::string& out)
{
  if (!node)
  {
    return false;
  }
  if (node->kind == Node::Kind::Identifier)
  {
    out = node->name;
    return true;
  }
  if (node->kind == Node::Kind::Member && !node->computed)
  {
    std::string prefix;
    if (!calleeName(node->left, prefix))
    {
      return false;
    }
    out = prefix + "." + node->name;
    return true;
  }
  return false;
}

class Parser
{
public:
  explicit Parser(const std::string& source) : m_source(source) {}

  NodePtr parse()
  {
    skipSpace();
    NodePtr node = parseExpression();
    skipSpace();
    if (m_pos != m_source.size())
    {
      throw ParseError("unexpected '" + m_source.substr(m_pos) + "'");
    }
    return node;
  }

private:
  NodePtr parseExpression() { return parseConditional(); }

  NodePtr parseConditional()
  {
    NodePtr test = parseBinary(0);
    skipSpace();
    if (peek() != '?')
    {
      return test;
    }
    ++m_pos;
    NodePtr consequent = parseExpression();
    skipSpace();
    expect(':');
    NodePtr alternate = parseExpression();

    auto node = std::make_shared<Node>();
    node->kind = Node::Kind::Conditional;
    node->left = test;
    node->right = consequent;
    node->third = alternate;
    return node;
  }

  // Precedence-climbing over the binary operators, lowest level first.
  NodePtr parseBinary(int level)
  {
    static const std::vector<std::vector<std::string>> levels = {
      {"||"},
      {"&&"},
      {"===", "!==", "==", "!="},
      {"<=", ">=", "<", ">"},
      {"+", "-"},
      {"*", "/", "%"}};

    if (level >= static_cast<int>(levels.size()))
    {
      return parseUnary();
    }

    NodePtr left = parseBinary(level + 1);
    while (true)
    {
      skipSpace();
      std::string matched;
      for (const auto& op : levels[level])
      {
        if (m_source.compare(m_pos, op.size(), op) == 0)
        {
          // "&&" must not be read as "&", and "=>"/"=" are not operators here.
          matched = op;
          break;
        }
      }
      if (matched.empty())
      {
        return left;
      }

      m_pos += matched.size();
      NodePtr right = parseBinary(level + 1);

      auto node = std::make_shared<Node>();
      node->kind = (matched == "&&" || matched == "||") ? Node::Kind::Logical
                                                        : Node::Kind::Binary;
      node->name = matched;
      node->left = left;
      node->right = right;
      left = node;
    }
  }

  NodePtr parseUnary()
  {
    skipSpace();
    const char c = peek();
    if (c == '!' || c == '-' || c == '+')
    {
      if (c == '!' && m_source.compare(m_pos, 2, "!=") == 0)
      {
        throw ParseError("unexpected '!='");
      }
      ++m_pos;
      auto node = std::make_shared<Node>();
      node->kind = Node::Kind::Unary;
      node->name = std::string(1, c);
      node->left = parseUnary();
      return node;
    }
    return parsePostfix();
  }

  NodePtr parsePostfix()
  {
    NodePtr node = parsePrimary();
    while (true)
    {
      skipSpace();
      const char c = peek();
      if (c == '.')
      {
        ++m_pos;
        skipSpace();
        auto member = std::make_shared<Node>();
        member->kind = Node::Kind::Member;
        member->left = node;
        member->name = parseIdentifier();
        node = member;
      }
      else if (c == '[')
      {
        ++m_pos;
        auto member = std::make_shared<Node>();
        member->kind = Node::Kind::Member;
        member->computed = true;
        member->left = node;
        member->right = parseExpression();
        skipSpace();
        expect(']');
        node = member;
      }
      else if (c == '(')
      {
        ++m_pos;
        auto call = std::make_shared<Node>();
        call->kind = Node::Kind::Call;
        call->left = node;
        call->items = parseArguments(')');
        node = call;
      }
      else
      {
        return node;
      }
    }
  }

  std::vector<NodePtr> parseArguments(char closing)
  {
    std::vector<NodePtr> args;
    skipSpace();
    if (peek() == closing)
    {
      ++m_pos;
      return args;
    }

    while (true)
    {
      args.push_back(parseExpression());
      skipSpace();
      if (peek() == ',')
      {
        ++m_pos;
        continue;
      }
      expect(closing);
      return args;
    }
  }

  NodePtr parsePrimary()
  {
    skipSpace();
    const char c = peek();

    if (c == '\0')
    {
      throw ParseError("unexpected end of expression");
    }

    if (c == '(')
    {
      ++m_pos;
      NodePtr node = parseExpression();
      skipSpace();
      expect(')');
      return node;
    }

    if (c == '[')
    {
      ++m_pos;
      auto node = std::make_shared<Node>();
      node->kind = Node::Kind::ArrayLiteral;
      node->items = parseArguments(']');
      return node;
    }

    if (c == '\'' || c == '"')
    {
      auto node = std::make_shared<Node>();
      node->kind = Node::Kind::Literal;
      node->value = parseString(c);
      return node;
    }

    if (std::isdigit(static_cast<unsigned char>(c)) ||
        (c == '.' && std::isdigit(static_cast<unsigned char>(peek(1)))))
    {
      auto node = std::make_shared<Node>();
      node->kind = Node::Kind::Literal;
      node->value = parseNumber();
      return node;
    }

    const std::string name = parseIdentifier();
    auto node = std::make_shared<Node>();
    if (name == "true" || name == "false")
    {
      node->kind = Node::Kind::Literal;
      node->value = (name == "true");
    }
    else if (name == "null" || name == "undefined")
    {
      node->kind = Node::Kind::Literal;
      node->value = json();
    }
    else
    {
      node->kind = Node::Kind::Identifier;
      node->name = name;
    }
    return node;
  }

  json parseString(char quote)
  {
    ++m_pos; // opening quote
    std::string text;
    while (m_pos < m_source.size() && m_source[m_pos] != quote)
    {
      char c = m_source[m_pos];
      if (c == '\\' && m_pos + 1 < m_source.size())
      {
        ++m_pos;
        switch (m_source[m_pos])
        {
          case 'n': c = '\n'; break;
          case 't': c = '\t'; break;
          case 'r': c = '\r'; break;
          default: c = m_source[m_pos]; break;
        }
      }
      text += c;
      ++m_pos;
    }
    if (m_pos >= m_source.size())
    {
      throw ParseError("unterminated string literal");
    }
    ++m_pos; // closing quote
    return json(text);
  }

  json parseNumber()
  {
    const size_t start = m_pos;
    while (m_pos < m_source.size() &&
           (std::isdigit(static_cast<unsigned char>(m_source[m_pos])) ||
            m_source[m_pos] == '.' || m_source[m_pos] == 'e' || m_source[m_pos] == 'E' ||
            ((m_source[m_pos] == '+' || m_source[m_pos] == '-') && m_pos > start &&
             (m_source[m_pos - 1] == 'e' || m_source[m_pos - 1] == 'E'))))
    {
      ++m_pos;
    }

    const std::string text = m_source.substr(start, m_pos - start);
    try
    {
      return fromNumber(std::stod(text));
    }
    catch (const std::exception&)
    {
      throw ParseError("invalid number '" + text + "'");
    }
  }

  std::string parseIdentifier()
  {
    skipSpace();
    const size_t start = m_pos;
    while (m_pos < m_source.size() &&
           (std::isalnum(static_cast<unsigned char>(m_source[m_pos])) ||
            m_source[m_pos] == '_' || m_source[m_pos] == '$'))
    {
      ++m_pos;
    }
    if (m_pos == start)
    {
      throw ParseError("expected an identifier at position " + std::to_string(start));
    }
    return m_source.substr(start, m_pos - start);
  }

  void skipSpace()
  {
    while (m_pos < m_source.size() &&
           std::isspace(static_cast<unsigned char>(m_source[m_pos])))
    {
      ++m_pos;
    }
  }

  void expect(char c)
  {
    if (peek() != c)
    {
      throw ParseError(std::string("expected '") + c + "'");
    }
    ++m_pos;
  }

  char peek(size_t offset = 0) const
  {
    return m_pos + offset < m_source.size() ? m_source[m_pos + offset] : '\0';
  }

  const std::string m_source;
  size_t m_pos = 0;
};

json evaluateNode(const NodePtr& node, const Scope& scope);

inline json memberOf(const json& object, const json& key)
{
  if (object.is_array())
  {
    if (key.is_string() && key.get_ref<const std::string&>() == "length")
    {
      return json(static_cast<int64_t>(object.size()));
    }
    const double index = toNumber(key);
    if (std::isnan(index) || index < 0 || index >= static_cast<double>(object.size()))
    {
      return json();
    }
    return object[static_cast<size_t>(index)];
  }

  if (object.is_string())
  {
    const std::string& text = object.get_ref<const std::string&>();
    if (key.is_string() && key.get_ref<const std::string&>() == "length")
    {
      return json(static_cast<int64_t>(text.size()));
    }
    const double index = toNumber(key);
    if (std::isnan(index) || index < 0 || index >= static_cast<double>(text.size()))
    {
      return json();
    }
    return json(std::string(1, text[static_cast<size_t>(index)]));
  }

  if (object.is_object())
  {
    const std::string name = toText(key);
    auto it = object.find(name);
    return it == object.end() ? json() : *it;
  }

  return json();
}

inline bool looseEquals(const json& left, const json& right)
{
  if (left.is_number() && right.is_number())
  {
    return toNumber(left) == toNumber(right);
  }
  if ((left.is_number() && right.is_string()) || (left.is_string() && right.is_number()))
  {
    const double a = toNumber(left);
    const double b = toNumber(right);
    return !std::isnan(a) && !std::isnan(b) && a == b;
  }
  if (left.is_null() && right.is_null())
  {
    return true;
  }
  return left == right;
}

inline json applyBinary(const std::string& op, const json& left, const json& right)
{
  if (op == "+")
  {
    if (left.is_string() || right.is_string())
    {
      return json(toText(left) + toText(right));
    }
    return fromNumber(toNumber(left) + toNumber(right));
  }
  if (op == "-") { return fromNumber(toNumber(left) - toNumber(right)); }
  if (op == "*") { return fromNumber(toNumber(left) * toNumber(right)); }
  if (op == "/") { return fromNumber(toNumber(left) / toNumber(right)); }
  if (op == "%") { return fromNumber(std::fmod(toNumber(left), toNumber(right))); }

  if (op == "==") { return json(looseEquals(left, right)); }
  if (op == "!=") { return json(!looseEquals(left, right)); }
  if (op == "===") { return json(left == right); }
  if (op == "!==") { return json(left != right); }

  if (left.is_string() && right.is_string())
  {
    const std::string& a = left.get_ref<const std::string&>();
    const std::string& b = right.get_ref<const std::string&>();
    if (op == "<") { return json(a < b); }
    if (op == "<=") { return json(a <= b); }
    if (op == ">") { return json(a > b); }
    if (op == ">=") { return json(a >= b); }
  }

  const double a = toNumber(left);
  const double b = toNumber(right);
  if (op == "<") { return json(a < b); }
  if (op == "<=") { return json(a <= b); }
  if (op == ">") { return json(a > b); }
  if (op == ">=") { return json(a >= b); }

  throw EvaluationError("unknown operator '" + op + "'");
}

inline json evaluateNode(const NodePtr& node, const Scope& scope)
{
  if (!node)
  {
    return json();
  }

  switch (node->kind)
  {
    case Node::Kind::Literal:
      return node->value;

    case Node::Kind::Identifier:
    {
      auto it = scope.find(node->name);
      if (it != scope.end())
      {
        return it->second;
      }
      if (builtins().count(node->name))
      {
        // A builtin referenced without a call has no value of its own.
        throw EvaluationError("'" + node->name + "' must be called");
      }
      return json();
    }

    case Node::Kind::Member:
    {
      const json object = evaluateNode(node->left, scope);
      const json key = node->computed ? evaluateNode(node->right, scope) : json(node->name);
      return memberOf(object, key);
    }

    case Node::Kind::ArrayLiteral:
    {
      json result = json::array();
      for (const auto& item : node->items)
      {
        result.push_back(evaluateNode(item, scope));
      }
      return result;
    }

    case Node::Kind::Call:
    {
      std::string name;
      if (!calleeName(node->left, name))
      {
        throw EvaluationError("only builtin functions can be called");
      }
      auto it = builtins().find(name);
      if (it == builtins().end())
      {
        throw EvaluationError("unknown function '" + name + "'");
      }

      std::vector<json> args;
      args.reserve(node->items.size());
      for (const auto& item : node->items)
      {
        args.push_back(evaluateNode(item, scope));
      }
      return it->second(args);
    }

    case Node::Kind::Unary:
    {
      const json operand = evaluateNode(node->left, scope);
      if (node->name == "!") { return json(!isTruthy(operand)); }
      if (node->name == "-") { return fromNumber(-toNumber(operand)); }
      return fromNumber(toNumber(operand));
    }

    case Node::Kind::Logical:
    {
      const json left = evaluateNode(node->left, scope);
      if (node->name == "&&")
      {
        return isTruthy(left) ? evaluateNode(node->right, scope) : left;
      }
      return isTruthy(left) ? left : evaluateNode(node->right, scope);
    }

    case Node::Kind::Binary:
      return applyBinary(node->name,
                         evaluateNode(node->left, scope),
                         evaluateNode(node->right, scope));

    case Node::Kind::Conditional:
      return isTruthy(evaluateNode(node->left, scope))
               ? evaluateNode(node->right, scope)
               : evaluateNode(node->third, scope);
  }

  return json();
}

} // namespace detail

/**
 * A parsed expression. Parsing happens once — when a service is configured —
 * so evaluating per input costs only the tree walk.
 */
class Expression
{
public:
  Expression() = default;

  static Expression parse(const std::string& source)
  {
    Expression expression;
    expression.m_source = source;
    expression.m_root = detail::Parser(source).parse();
    return expression;
  }

  json evaluate(const json& params) const
  {
    return evaluate(Scope{{"params", params}});
  }

  json evaluate(const Scope& scope) const
  {
    if (!m_root)
    {
      throw EvaluationError("expression is empty");
    }
    return detail::evaluateNode(m_root, scope);
  }

  const std::string& source() const { return m_source; }

private:
  std::string m_source;
  detail::NodePtr m_root;
};

namespace detail {

inline json argAt(const std::vector<json>& args, size_t index)
{
  return index < args.size() ? args[index] : json();
}

// find/filter take their predicate as an expression string, parsed per call and
// evaluated with the element bound to `item` and its position to `index`.
inline bool matchesPredicate(const Expression& predicate, const json& item, size_t index)
{
  return isTruthy(predicate.evaluate(Scope{
    {"item", item},
    {"index", json(static_cast<int64_t>(index))}}));
}

inline const std::map<std::string, Builtin>& builtins()
{
  static const std::map<std::string, Builtin> table = {
    {"print", [](const std::vector<json>& args) -> json {
       std::cout << toText(argAt(args, 0)) << std::endl;
       return json();
     }},
    {"log", [](const std::vector<json>& args) -> json {
       std::cout << toText(argAt(args, 0)) << std::endl;
       return json();
     }},
    {"round", [](const std::vector<json>& args) -> json {
       return fromNumber(std::round(toNumber(argAt(args, 0))));
     }},
    {"sin", [](const std::vector<json>& args) -> json {
       return json(std::sin(toNumber(argAt(args, 0))));
     }},
    {"min", [](const std::vector<json>& args) -> json {
       double result = std::numeric_limits<double>::infinity();
       for (const auto& arg : args) { result = std::min(result, toNumber(arg)); }
       return fromNumber(result);
     }},
    {"max", [](const std::vector<json>& args) -> json {
       double result = -std::numeric_limits<double>::infinity();
       for (const auto& arg : args) { result = std::max(result, toNumber(arg)); }
       return fromNumber(result);
     }},
    {"rand", [](const std::vector<json>&) -> json {
       static std::mt19937 engine{std::random_device{}()};
       static std::uniform_real_distribution<double> distribution(0.0, 1.0);
       return json(distribution(engine));
     }},
    {"number", [](const std::vector<json>& args) -> json {
       return fromNumber(toNumber(argAt(args, 0)));
     }},
    {"string", [](const std::vector<json>& args) -> json {
       return json(toText(argAt(args, 0)));
     }},
    {"stringify", [](const std::vector<json>& args) -> json {
       return json(argAt(args, 0).dump());
     }},
    {"parse", [](const std::vector<json>& args) -> json {
       const json arg = argAt(args, 0);
       if (!arg.is_string()) { return json("<parse undefined>"); }
       try { return json::parse(arg.get_ref<const std::string&>()); }
       catch (const std::exception&) { return json(); }
     }},
    {"concat", [](const std::vector<json>& args) -> json {
       std::string result;
       for (const auto& arg : args) { result += toText(arg); }
       return json(result);
     }},
    {"encodeURI", [](const std::vector<json>& args) -> json {
       static const std::string unreserved =
         "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
         "-_.!~*'();/?:@&=+$,#";
       std::ostringstream out;
       for (unsigned char c : toText(argAt(args, 0)))
       {
         if (unreserved.find(static_cast<char>(c)) != std::string::npos)
         {
           out << c;
         }
         else
         {
           out << '%' << std::uppercase << std::hex << std::setw(2)
               << std::setfill('0') << static_cast<int>(c) << std::nouppercase << std::dec;
         }
       }
       return json(out.str());
     }},
    {"slug", [](const std::vector<json>& args) -> json {
       std::string result;
       for (char c : toText(argAt(args, 0)))
       {
         const char lower = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
         if ((lower >= 'a' && lower <= 'z') || (lower >= '0' && lower <= '9') ||
             lower == '_' || lower == '-')
         {
           result += lower;
         }
       }
       return json(result);
     }},
    {"now", [](const std::vector<json>&) -> json {
       return json(nowMillis());
     }},
    {"range", [](const std::vector<json>& args) -> json {
       json result = json::array();
       const double count = std::round(toNumber(argAt(args, 0)));
       for (int64_t i = 0; i < static_cast<int64_t>(std::max(0.0, count)); ++i)
       {
         result.push_back(i);
       }
       return result;
     }},
    {"sum", [](const std::vector<json>& args) -> json {
       const json arg = argAt(args, 0);
       if (!arg.is_array()) { return arg; }
       double total = 0.0;
       for (const auto& entry : arg) { total += toNumber(entry); }
       return fromNumber(total);
     }},
    {"avg", [](const std::vector<json>& args) -> json {
       const json arg = argAt(args, 0);
       if (!arg.is_array()) { return arg; }
       if (arg.empty()) { return json(); }
       double total = 0.0;
       for (const auto& entry : arg) { total += toNumber(entry); }
       return fromNumber(total / static_cast<double>(arg.size()));
     }},
    {"flatSum", [](const std::vector<json>& args) -> json {
       const json arg = argAt(args, 0);
       if (!arg.is_array()) { return fromNumber(0); }
       double total = 0.0;
       for (const auto& entry : arg)
       {
         if (entry.is_array())
         {
           for (const auto& inner : entry) { total += toNumber(inner); }
         }
         else
         {
           total += toNumber(entry);
         }
       }
       return fromNumber(total);
     }},
    {"at", [](const std::vector<json>& args) -> json {
       const json arg = argAt(args, 0);
       if (!arg.is_array() || arg.empty()) { return json(); }
       const double index = std::fabs(std::round(toNumber(argAt(args, 1))));
       return arg[static_cast<size_t>(index) % arg.size()];
     }},
    {"slice", [](const std::vector<json>& args) -> json {
       const json arg = argAt(args, 0);
       if (!arg.is_array()) { return json::array(); }
       const int64_t offset = static_cast<int64_t>(toNumber(argAt(args, 1)));
       const double rawStep = toNumber(argAt(args, 2));
       const int64_t step = std::isnan(rawStep) || rawStep < 1 ? 1 : static_cast<int64_t>(rawStep);
       const double rawEnd = toNumber(argAt(args, 3));
       const int64_t end = std::isnan(rawEnd) ? static_cast<int64_t>(arg.size())
                                              : static_cast<int64_t>(rawEnd);
       json result = json::array();
       for (int64_t i = std::max<int64_t>(0, offset);
            i < std::min<int64_t>(end, static_cast<int64_t>(arg.size())); ++i)
       {
         if ((i - std::max<int64_t>(0, offset)) % step == 0)
         {
           result.push_back(arg[static_cast<size_t>(i)]);
         }
       }
       return result;
     }},
    {"find", [](const std::vector<json>& args) -> json {
       const json arg = argAt(args, 0);
       const json predicateSource = argAt(args, 1);
       if (!arg.is_array() || !predicateSource.is_string()) { return json(); }
       const Expression predicate =
         Expression::parse(predicateSource.get_ref<const std::string&>());
       for (size_t i = 0; i < arg.size(); ++i)
       {
         if (matchesPredicate(predicate, arg[i], i)) { return arg[i]; }
       }
       return json();
     }},
    {"filter", [](const std::vector<json>& args) -> json {
       const json arg = argAt(args, 0);
       const json predicateSource = argAt(args, 1);
       json result = json::array();
       if (!arg.is_array() || !predicateSource.is_string()) { return result; }
       const Expression predicate =
         Expression::parse(predicateSource.get_ref<const std::string&>());
       for (size_t i = 0; i < arg.size(); ++i)
       {
         if (matchesPredicate(predicate, arg[i], i)) { result.push_back(arg[i]); }
       }
       return result;
     }},
    {"isFuture", [](const std::vector<json>& args) -> json {
       int64_t millis = 0;
       if (!toEpochMillis(argAt(args, 0), millis)) { return json(false); }
       return json(millis >= nowMillis());
     }},
    {"isPast", [](const std::vector<json>& args) -> json {
       int64_t millis = 0;
       if (!toEpochMillis(argAt(args, 0), millis)) { return json(false); }
       return json(millis < nowMillis());
     }},
    {"formatNow", [](const std::vector<json>& args) -> json {
       const std::time_t stamp = std::time(nullptr);
       std::tm tm{};
#ifdef _WIN32
       localtime_s(&tm, &stamp);
#else
       localtime_r(&stamp, &tm);
#endif
       return json(formatTime(tm, toText(argAt(args, 0))));
     }},
    {"reformatDate", [](const std::vector<json>& args) -> json {
       const std::string text = toText(argAt(args, 0));
       const std::string inputFormat = toText(argAt(args, 1));
       const std::string outputFormat = toText(argAt(args, 2));

       std::tm tm{};
       if (!parseTime(text, inputFormat, tm))
       {
         int64_t millis = 0;
         if (!toEpochMillis(argAt(args, 0), millis)) { return json(text); }
         const std::time_t stamp = static_cast<std::time_t>(millis / 1000);
#ifdef _WIN32
         localtime_s(&tm, &stamp);
#else
         localtime_r(&stamp, &tm);
#endif
       }
       return json(formatTime(tm, outputFormat));
     }},
    {"uuid.v4", [](const std::vector<json>&) -> json {
       return json(generateUUID());
     }},
    {"uuid.v7", [](const std::vector<json>&) -> json {
       // Time-ordered: 48 bits of epoch millis, then version/variant bits over
       // random data, rendered in the canonical 8-4-4-4-12 form.
       static std::mt19937 engine{std::random_device{}()};
       std::uniform_int_distribution<int> byte(0, 255);
       std::array<unsigned char, 16> bytes{};
       for (auto& b : bytes) { b = static_cast<unsigned char>(byte(engine)); }

       const uint64_t millis = static_cast<uint64_t>(nowMillis());
       for (int i = 0; i < 6; ++i)
       {
         bytes[i] = static_cast<unsigned char>((millis >> (8 * (5 - i))) & 0xff);
       }
       bytes[6] = static_cast<unsigned char>((bytes[6] & 0x0f) | 0x70);
       bytes[8] = static_cast<unsigned char>((bytes[8] & 0x3f) | 0x80);

       std::ostringstream out;
       out << std::hex << std::setfill('0');
       for (size_t i = 0; i < bytes.size(); ++i)
       {
         if (i == 4 || i == 6 || i == 8 || i == 10) { out << '-'; }
         out << std::setw(2) << static_cast<int>(bytes[i]);
       }
       return json(out.str());
     }},
  };
  return table;
}

} // namespace detail
} // namespace expression
} // namespace hkp
