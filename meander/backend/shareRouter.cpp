#ifdef __APPLE__

#include "./shareRouter.h"

#include <iostream>

#include <nlohmann/json.hpp>

#include "./schemeHandler.h"
#include "./shareInbox.h"

using json = nlohmann::json;

// ── Share nudge ──────────────────────────────────────────────────────────────

namespace
{
  // The live webview, so the AppDelegate's openURLs handler (main.mm) can nudge
  // the web app to drain the share inbox.
  saucer::smartview *g_shareNudgeWebview = nullptr;
}

void meanderSetShareNudgeWebview(saucer::smartview *webview)
{
  g_shareNudgeWebview = webview;
}

void meanderNotifyShareUrlOpened()
{
  if (g_shareNudgeWebview != nullptr)
  {
    g_shareNudgeWebview->execute(
        "window.__readymadeCheckShares && window.__readymadeCheckShares();");
  }
}

// ── Share routes ─────────────────────────────────────────────────────────────
// The share extension writes envelopes (and optional file payloads) into the
// App Group inbox; the web app drains them through these routes. See
// backend/shareInbox.h for the inbox layout and
// meander/frontend/src/share/desktopShareInbox.ts for the consumer.

namespace
{
  using Headers = std::map<std::string, std::string>;

  saucer::scheme::response invalidShareIdResponse(const Headers &headers)
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str("Invalid share id"),
        .mime = "text/plain",
        .headers = headers,
        .status = 400,
    };
  }

  saucer::scheme::response okResponse(const Headers &headers)
  {
    return saucer::scheme::response{
        .data = saucer::stash::from_str(json{{"ok", true}}.dump()),
        .mime = "application/json",
        .headers = headers,
        .status = 200,
    };
  }

  saucer::scheme::response handleListShareInbox(const Headers &headers)
  {
    // Piggyback the stale-payload sweep on the drain, like iOS does.
    ShareInbox::sweepStalePayloads();

    json result = json::array();
    for (const auto &raw : ShareInbox::pendingEnvelopes())
    {
      try
      {
        auto envelope = json::parse(raw);
        if (envelope.is_object() && envelope.contains("id"))
        {
          result.push_back(std::move(envelope));
        }
        else
        {
          std::cerr << "[share-inbox] skipping envelope without an id" << std::endl;
        }
      }
      catch (const json::exception &e)
      {
        // Corrupt envelope — skip it; the sweep will eventually clean it up.
        std::cerr << "[share-inbox] skipping corrupt envelope: " << e.what() << std::endl;
      }
    }

    return saucer::scheme::response{
        .data = saucer::stash::from_str(result.dump()),
        .mime = "application/json",
        .headers = headers,
        .status = 200,
    };
  }

  saucer::scheme::response handleAckShare(const std::string &id, const Headers &headers)
  {
    if (!ShareInbox::isSafeShareId(id))
    {
      return invalidShareIdResponse(headers);
    }

    ShareInbox::removeEnvelope(id);
    return okResponse(headers);
  }

  saucer::scheme::response handleGetShareFile(const std::string &id, const Headers &headers)
  {
    if (!ShareInbox::isSafeShareId(id))
    {
      return invalidShareIdResponse(headers);
    }

    auto bytes = ShareInbox::readFilePayload(id);
    if (!bytes.has_value())
    {
      return saucer::scheme::response{
          .data = saucer::stash::from_str("Share payload not found"),
          .mime = "text/plain",
          .headers = headers,
          .status = 404,
      };
    }

    return saucer::scheme::response{
        .data = saucer::stash::from(std::move(*bytes)),
        .mime = "application/octet-stream",
        .headers = headers,
        .status = 200,
    };
  }

  saucer::scheme::response handleDeleteShareFile(const std::string &id, const Headers &headers)
  {
    if (!ShareInbox::isSafeShareId(id))
    {
      return invalidShareIdResponse(headers);
    }

    ShareInbox::removeFilePayload(id);
    return okResponse(headers);
  }
}

void registerShareRoutes(SchemeHandler &handler, Headers defaultHeaders)
{
  handler.addRoute(
      "GET",
      "/share-inbox",
      [defaultHeaders](const Router::Params &, const saucer::scheme::request &)
      {
        return handleListShareInbox(defaultHeaders);
      });

  handler.addRoute(
      "DELETE",
      "/share-inbox/:id",
      [defaultHeaders](const Router::Params &p, const saucer::scheme::request &)
      {
        return handleAckShare(p.at("id"), defaultHeaders);
      });

  handler.addRoute(
      "GET",
      "/share-files/:id",
      [defaultHeaders](const Router::Params &p, const saucer::scheme::request &)
      {
        return handleGetShareFile(p.at("id"), defaultHeaders);
      });

  handler.addRoute(
      "DELETE",
      "/share-files/:id",
      [defaultHeaders](const Router::Params &p, const saucer::scheme::request &)
      {
        return handleDeleteShareFile(p.at("id"), defaultHeaders);
      });
}

#endif // __APPLE__
