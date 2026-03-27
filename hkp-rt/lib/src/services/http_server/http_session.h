#pragma once

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
    return req_.target();
  }

  std::string getRequestMethod() const
  {
    return req_.method_string();
  }

private:
  void sendJsonData(const json& j, bool useEventStream = false);
  void sendBinaryData(const BinaryData& binary);

private:
  boost::beast::tcp_stream stream_;
  boost::beast::flat_buffer buffer_;
  boost::beast::http::request<boost::beast::http::string_body> req_;
  std::shared_ptr<void> res_;
  send_lambda lambda_;
  Listener& listener_;
  unsigned int m_sessionId;

  bool m_eventSourceHeadersSent = false;
};

} // namespace hkp
