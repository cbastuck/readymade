#pragma once

#ifdef __APPLE__

// Lets <input type="file"> open a panel in the app's webview.
//
// WebKit asks its WKUIDelegate to show the open panel and, when the delegate
// has no answer, drops the click without a word. saucer's delegate answers
// alert, confirm and media permission, not this one, so every web file input
// in the app was dead. This gives saucer's delegate class the missing method:
// the person picks in an NSOpenPanel, and the page gets real files, bytes and
// all, the way it would in a browser.
//
// Must run before the webview is created: WebKit reads which methods a
// delegate has when the delegate is set, and a method added afterwards is
// never asked. Does nothing if saucer someday answers the panel itself.
void meanderEnableFileInputs();

#endif
