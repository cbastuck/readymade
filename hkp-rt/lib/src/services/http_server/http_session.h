#pragma once

#include <optional>

#include <boost/beast.hpp>
#include <boost/asio/strand.hpp>
#include <boost/json.hpp>

#include <types/types.h>

namespace hkp {

class Listener;

class Session : public std::enable_shared_from_this<Session>
{ 
  using tcp = boost::asio::ip::tcp;

  // This is the C++11 equivalent of a generic lambda.
  // The function object is used to send an HTTP message.
  struct send_lambda
  {
      explicit send_lambda(Session& self)
          : self_(self)
      {
      }

      template<bool isRequest, class Body, class Fields>
      void operator()(boost::beast::http::message<isRequest, Body, Fields>&& msg) const
      {
          // The lifetime of the message has to extend
          // for the duration of the async operation so
          // we use a shared_ptr to manage it.
          auto sp = std::make_shared<
              boost::beast::http::message<isRequest, Body, Fields>>(std::move(msg));

          // Store a type-erased version of the shared
          // pointer in the class to keep it alive.
          self_.res_ = sp;

          // Write the response
          boost::beast::http::async_write(
              self_.stream_,
              *sp,
              boost::beast::bind_front_handler(
                  &Session::on_write,
                  self_.shared_from_this(),
                  sp->need_eof()));
      }
    private:
      Session& self_;
  };

public:
  // Take ownership of the stream
  Session(Listener& listener, tcp::socket&& socket);
  ~Session();
  
  // Start the asynchronous operation
  void run();
  void do_read();
  void on_read(boost::beast::error_code ec, std::size_t bytes_transferred);

  void on_write(bool close, boost::beast::error_code ec, std::size_t bytes_transferred);
  void do_close(bool notify = true);

  void sendDataSync(Data& data, bool useEventStream = false);
  void sendDataAsync(json data);

  std::string getRequestPath() const
  {
    return std::string(parser_->get().target());
  }

  std::string getRequestMethod() const
  {
    return std::string(parser_->get().method_string());
  }

  // Returns the raw request body as a string (works for binary payloads too).
  const std::string& getRequestBody() const
  {
    return parser_->get().body();
  }

  // Returns the value of a header by name, or empty string if absent.
  std::string getRequestHeader(const std::string& name) const
  {
    auto it = parser_->get().find(name);
    return (it != parser_->get().end()) ? std::string(it->value()) : "";
  }

  void sendHtmlResponse(const std::string& html);
  void sendJsonResponseWithCors(const json& data);
  void sendCorsPreflightResponse();
  // Dispatch to the right send method based on the Data variant type.
  void sendResult(Data& data);

private:
  void sendJsonData(const json& j, bool useEventStream = false);
  void sendBinaryData(const BinaryData& binary);

private:
  boost::beast::tcp_stream stream_;
  boost::beast::flat_buffer buffer_;
  std::optional<boost::beast::http::request_parser<boost::beast::http::string_body>> parser_;
  std::shared_ptr<void> res_;
  send_lambda lambda_;
  Listener& listener_;
  unsigned int m_sessionId;

  bool m_eventSourceHeadersSent = false;
};

} // namespace hkp
