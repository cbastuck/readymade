#pragma once

#ifdef __APPLE__

#include <map>
#include <string>

#include <saucer/smartview.hpp>

class SchemeHandler;

// App-side wiring of the macOS "Share to Readymade" feature. The share
// extension drops envelopes (and optional file payloads) into the App Group
// inbox (see shareInbox.h); this module exposes them to the web app:
//  - the hkp:// share routes the web app drains the inbox through
//    (hkp://share-inbox, hkp://share-files; consumer:
//    meander/frontend/src/share/desktopShareInbox.ts), and
//  - the share nudge that asks the web app to drain immediately when the
//    extension opens readymade://share?id=… (AppDelegate openURLs, main.mm).

// Registers the share routes; called by the SchemeHandler constructor with
// its default (CORS) headers.
void registerShareRoutes(SchemeHandler &handler,
                         std::map<std::string, std::string> defaultHeaders);

// The live webview the nudge executes JS in. Set for the lifetime of
// loop.run() (main.cpp); pass nullptr on shutdown. The nudge itself is
// meanderNotifyShareUrlOpened() (declared in shareInbox.h so main.mm does not
// need saucer headers).
void meanderSetShareNudgeWebview(saucer::smartview *webview);

#endif
