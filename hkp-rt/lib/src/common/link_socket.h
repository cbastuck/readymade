#pragma once

#include <chrono>
#include <functional>
#include <memory>
#include <string>

#include <boost/asio/io_context.hpp>

namespace hkp {

/**
 * One outbound WebSocket connection, from handshake to close.
 *
 * Made for a runtime server's connection to a coordinator: `ws://` or
 * `wss://`, a bearer credential on the handshake, both text and binary frames,
 * and an honest account of how it ended — in particular whether the peer
 * refused the upgrade and with which HTTP status, because a `401` is how a
 * coordinator says a ticket is no longer one.
 *
 * It does not reconnect. A connection is one attempt, and deciding whether to
 * make another belongs to whoever reads `Closed`.
 *
 * A peer that stops answering is noticed: the connection is pinged when idle
 * and closed when the ping goes unanswered, so a network that vanished without
 * closing anything still ends in `onClose`.
 *
 * Every handler is called on the io_context's thread.
 */
class LinkSocket
{
public:
  struct Options
  {
    /** `ws://`, `wss://`, or the `http://` / `https://` spelling of either. */
    std::string url;
    /** Sent as `Authorization: Bearer <bearer>` on the handshake, when set. */
    std::string bearer;
    /** How long resolving, connecting and both handshakes may take together. */
    std::chrono::milliseconds handshakeTimeout{10000};
    /** How long the connection may sit silent before it is pinged. */
    std::chrono::milliseconds idleTimeout{30000};
    /**
     * A root certificate (PEM) trusted beside the built-in ones — for a peer
     * behind a private certificate authority.
     */
    std::string trustedRootPem;
  };

  /** How a connection ended. */
  struct Closed
  {
    /** Whether it was ever open. */
    bool opened = false;
    /** The status the peer answered the upgrade with, when it refused it. */
    unsigned httpStatus = 0;
    /** The close code the peer sent, when it sent one. */
    unsigned code = 0;
    std::string reason;
  };

  struct Handlers
  {
    std::function<void()> onOpen;
    std::function<void(std::string message, bool isBinary)> onMessage;
    /** Called exactly once, unless the connection was closed from this side. */
    std::function<void(const Closed&)> onClose;
  };

  /**
   * Starts connecting. Never throws. An address that is not a websocket one
   * ends in `onClose` like any other failure, and returns null — there is no
   * connection to hold.
   */
  static std::shared_ptr<LinkSocket> open(boost::asio::io_context& ioc,
                                          Options options, Handlers handlers);

  virtual ~LinkSocket() = default;

  /** Queued when sent before the connection is open; dropped once closed. */
  virtual void sendText(std::string message) = 0;
  virtual void sendBinary(std::string message) = 0;

  /**
   * Ends the connection from this side. No handler is called afterwards: the
   * caller is the one who decided, and has nothing to be told.
   */
  virtual void close() = 0;
};

}
