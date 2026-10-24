#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>
#import <objc/runtime.h>

#include "./filePanel.h"

void meanderEnableFileInputs()
{
  // saucer's WKUIDelegate, by the name it registers under. Not a class of
  // ours, so it is looked up rather than linked against.
  Class delegate = NSClassFromString(@"UIDelegate");
  SEL selector = @selector(webView:runOpenPanelWithParameters:initiatedByFrame:completionHandler:);
  if (!delegate || ![delegate conformsToProtocol:@protocol(WKUIDelegate)] ||
      class_getInstanceMethod(delegate, selector))
  {
    return;
  }

  IMP open = imp_implementationWithBlock(
    ^(id, WKWebView *webview, WKOpenPanelParameters *parameters, WKFrameInfo *,
      void (^complete)(NSArray<NSURL *> *))
  {
    NSOpenPanel *panel = [NSOpenPanel openPanel];
    panel.canChooseFiles = YES;
    panel.canChooseDirectories = parameters.allowsDirectories;
    panel.allowsMultipleSelection = parameters.allowsMultipleSelection;

    // nil hands the page no files, which is what cancelling means to it.
    auto answer = ^(NSModalResponse response)
    {
      complete(response == NSModalResponseOK ? panel.URLs : nil);
    };
    if (webview.window)
    {
      [panel beginSheetModalForWindow:webview.window completionHandler:answer];
    }
    else
    {
      answer([panel runModal]);
    }
  });

  // void, self, _cmd, three objects, a block.
  class_addMethod(delegate, selector, open, "v@:@@@@?");
}
