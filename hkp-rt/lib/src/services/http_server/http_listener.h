#pragma once

#include <boost/beast.hpp>
#include <boost/asio/strand.hpp>
#include <boost/json.hpp>

namespace hkp {

class HttpServerImpl;
class Session;
class Listener : public std::enable_shared_from_this<Listener>
{
public:
    using tcp = boost::asio::ip::tcp;

    Listener(HttpServerImpl& impl, tcp::endpoint endpoint);
    ~Listener();

    unsigned short start();
    bool stop();

    void onSessionOpened(std::shared_ptr<Session> session);
    void onSessionClosed(std::shared_ptr<Session> session);

private:
    void do_accept();
    void on_accept(boost::beast::error_code ec, tcp::socket socket);

    HttpServerImpl& m_impl;
    tcp::acceptor acceptor_;
};

} // namespace hkp