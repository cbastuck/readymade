#pragma once

#include <boost/beast.hpp>

#include <types/types.h>

namespace hkp {
  
class WebsocketClientSession : public std::enable_shared_from_this<WebsocketClientSession>
{
public:
  typedef std::function<void(boost::beast::flat_buffer& buffer, std::size_t bytes_transferred, bool isBinary)> CallbackFunc;

  WebsocketClientSession(boost::asio::io_context &ioc, std::string host, std::string port, std::string path);
  ~WebsocketClientSession();

  bool isConnected() const;
  void signalSend(const Data& data);

  void start(std::string id, CallbackFunc callback);
  void stop();

  void close();

private:
  void fail(boost::beast::error_code ec, char const *what);
  void on_close(boost::beast::error_code ec);
  void send_data(const Data& data);

  void on_read(boost::beast::error_code ec, std::size_t bytes_transferred);

private:
  struct impl;
  std::unique_ptr<impl> m_impl;
};

}
