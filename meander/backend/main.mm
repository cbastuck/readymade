#import <Cocoa/Cocoa.h>
#include <string>
#include <vector>
#include <iostream>

// Forward declaration of your existing main logic
int real_main(int argc, char* argv[]); 

@interface AppDelegate : NSObject <NSApplicationDelegate>
@end

@implementation AppDelegate

- (void)application:(NSApplication *)sender openFiles:(NSArray<NSString *> *)filenames {
    std::vector<std::string> args;

    // First argument: executable path
    char exe[] = "meander";
    args.push_back(exe);

    // Append filenames from Apple Event
    for (NSString *file in filenames) {
        args.push_back(std::string([file UTF8String]));
    }

    // Convert to argc / argv
    int argc = static_cast<int>(args.size());
    std::vector<char*> argv(argc);
    for (int i = 0; i < argc; ++i) {
        argv[i] = const_cast<char*>(args[i].c_str());
    }

    // Call your C++ main logic
    int result = real_main(argc, argv.data());

    [sender replyToOpenOrPrint:NSApplicationDelegateReplySuccess];

    // Terminate the app after handling files
    [NSApp terminate:nil];
}

@end

int main(int argc, char* argv[])
{
    @autoreleasepool {
        NSApplication *app = [NSApplication sharedApplication];
        AppDelegate *delegate = [[AppDelegate alloc] init];
        [app setDelegate:delegate];

        real_main(argc, argv);
        
        //[app run]; // start Cocoa event loop
    }
    return 0;
}
