#pragma once

#ifdef __APPLE__

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

// App-process read side of the macOS "Share to Readymade" feature. The share
// extension (ShareExtension target, see meander/macos/ShareExtension) drops one
// <id>.json envelope — plus an optional <id>.payload with the shared file's
// bytes — into the App Group inbox; the scheme handler serves them to the web
// app on hkp://share-inbox and hkp://share-files. Mirrors the read side of
// meander-ios/ReadymadeIOS/Shared/ShareInbox.swift.
namespace ShareInbox
{
  // Must match the App Group in ShareExtension.entitlements and
  // Readymade.entitlements, and the macOS branch of ShareInbox.swift.
  inline constexpr const char *kAppGroupID = "group.com.readymadeit.app";

  // Envelope/payload ids are UUIDs minted by the extension; anything else in a
  // route parameter is rejected before touching the filesystem.
  bool isSafeShareId(const std::string &id);

  // Pending envelopes as raw JSON strings, oldest first.
  std::vector<std::string> pendingEnvelopes();

  // Delete <id>.json once the web app acked it (delivered at most once). The
  // payload is kept — the web app fetches it lazily and releases it separately.
  bool removeEnvelope(const std::string &id);

  std::optional<std::vector<std::uint8_t>> readFilePayload(const std::string &id);
  bool removeFilePayload(const std::string &id);

  // Delete payloads that were never consumed (e.g. the picker was cancelled).
  // Called on each inbox drain; anything older than a week is safe to drop.
  void sweepStalePayloads();
}

// Implemented in shareRouter.cpp: asks the web app to drain the share inbox
// now (window.__readymadeCheckShares). Called by the AppDelegate's openURLs
// handler in main.mm when the extension opens readymade://share?id=….
void meanderNotifyShareUrlOpened();

#endif
