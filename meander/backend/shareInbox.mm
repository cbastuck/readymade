#ifdef __APPLE__

#import <Foundation/Foundation.h>

#include "./shareInbox.h"

#include <algorithm>
#include <cctype>

namespace
{
  /// The SharedInbox directory inside the App Group container, or nil when the
  /// container cannot be resolved (entitlement missing/misconfigured).
  NSURL *inboxURL()
  {
    NSURL *container = [[NSFileManager defaultManager]
        containerURLForSecurityApplicationGroupIdentifier:
            [NSString stringWithUTF8String:ShareInbox::kAppGroupID]];
    if (container == nil)
    {
      return nil;
    }
    return [container URLByAppendingPathComponent:@"SharedInbox" isDirectory:YES];
  }

  NSURL *envelopeURL(const std::string &id_)
  {
    NSURL *inbox = inboxURL();
    if (inbox == nil)
    {
      return nil;
    }
    NSString *name = [NSString stringWithFormat:@"%s.json", id_.c_str()];
    return [inbox URLByAppendingPathComponent:name isDirectory:NO];
  }

  NSURL *payloadURL(const std::string &id_)
  {
    NSURL *inbox = inboxURL();
    if (inbox == nil)
    {
      return nil;
    }
    NSString *name = [NSString stringWithFormat:@"%s.payload", id_.c_str()];
    return [inbox URLByAppendingPathComponent:name isDirectory:NO];
  }
}

namespace ShareInbox
{
  bool isSafeShareId(const std::string &id)
  {
    if (id.empty() || id.size() > 64)
    {
      return false;
    }
    return std::all_of(id.begin(), id.end(), [](unsigned char c) {
      return std::isalnum(c) != 0 || c == '-';
    });
  }

  std::vector<std::string> pendingEnvelopes()
  {
    NSURL *inbox = inboxURL();
    if (inbox == nil)
    {
      NSLog(@"[ReadymadeShare] App Group container unavailable (entitlement?)");
      return {};
    }

    NSArray<NSURL *> *entries = [[NSFileManager defaultManager]
          contentsOfDirectoryAtURL:inbox
        includingPropertiesForKeys:@[ NSURLContentModificationDateKey ]
                           options:NSDirectoryEnumerationSkipsHiddenFiles
                             error:nil];
    if (entries == nil)
    {
      return {};
    }

    // Oldest first, by file modification date (the envelope is written once,
    // so this matches its receivedAt ordering).
    NSArray<NSURL *> *sorted = [entries sortedArrayUsingComparator:^NSComparisonResult(NSURL *a, NSURL *b) {
      NSDate *da = nil;
      NSDate *db = nil;
      [a getResourceValue:&da forKey:NSURLContentModificationDateKey error:nil];
      [b getResourceValue:&db forKey:NSURLContentModificationDateKey error:nil];
      return [(da ?: NSDate.distantPast) compare:(db ?: NSDate.distantPast)];
    }];

    std::vector<std::string> envelopes;
    for (NSURL *url in sorted)
    {
      if (![url.pathExtension isEqualToString:@"json"])
      {
        continue;
      }
      NSData *data = [NSData dataWithContentsOfURL:url];
      if (data == nil || data.length == 0)
      {
        continue;
      }
      envelopes.emplace_back(static_cast<const char *>(data.bytes), data.length);
    }
    return envelopes;
  }

  bool removeEnvelope(const std::string &id)
  {
    NSURL *url = envelopeURL(id);
    if (url == nil)
    {
      return false;
    }
    return [[NSFileManager defaultManager] removeItemAtURL:url error:nil];
  }

  std::optional<std::vector<std::uint8_t>> readFilePayload(const std::string &id)
  {
    NSURL *url = payloadURL(id);
    if (url == nil)
    {
      return std::nullopt;
    }
    NSData *data = [NSData dataWithContentsOfURL:url];
    if (data == nil)
    {
      return std::nullopt;
    }
    const auto *bytes = static_cast<const std::uint8_t *>(data.bytes);
    return std::vector<std::uint8_t>(bytes, bytes + data.length);
  }

  bool removeFilePayload(const std::string &id)
  {
    NSURL *url = payloadURL(id);
    if (url == nil)
    {
      return false;
    }
    return [[NSFileManager defaultManager] removeItemAtURL:url error:nil];
  }

  void sweepStalePayloads()
  {
    NSURL *inbox = inboxURL();
    if (inbox == nil)
    {
      return;
    }
    NSArray<NSURL *> *entries = [[NSFileManager defaultManager]
          contentsOfDirectoryAtURL:inbox
        includingPropertiesForKeys:@[ NSURLContentModificationDateKey ]
                           options:NSDirectoryEnumerationSkipsHiddenFiles
                             error:nil];
    if (entries == nil)
    {
      return;
    }
    NSDate *cutoff = [NSDate dateWithTimeIntervalSinceNow:-7.0 * 24.0 * 3600.0];
    for (NSURL *url in entries)
    {
      if (![url.pathExtension isEqualToString:@"payload"])
      {
        continue;
      }
      NSDate *modified = nil;
      [url getResourceValue:&modified forKey:NSURLContentModificationDateKey error:nil];
      if (modified != nil && [modified compare:cutoff] == NSOrderedAscending)
      {
        [[NSFileManager defaultManager] removeItemAtURL:url error:nil];
      }
    }
  }
}

#endif
