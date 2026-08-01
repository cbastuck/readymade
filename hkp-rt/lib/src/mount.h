#pragma once

#include <string>

/**
 * Mount vocabulary.
 *
 * A service that needs to be reachable from outside is assigned an address by
 * its runtime and publishes it in its own state. Both sides use one reserved
 * field:
 *
 *   __hkpMount says where a mount is.
 *
 * A service that *owns* a mount publishes its address there, as an absolute
 * `http(s)://` URL. A service that *consumes* one points at the owner there, as
 * `hkp-mount://<runtimeId>/<serviceUuid>`. The two forms are told apart by
 * scheme; a bare `<runtimeId>/<serviceUuid>` is not accepted, because it is
 * indistinguishable from a relative URL.
 *
 * Resolving a reference into an address needs a view of the whole board, which
 * only the board's coordinator has. A service therefore never resolves one
 * itself: it is configured with the address once the coordinator has it, and a
 * reference still sitting here means "not ready yet".
 *
 * Mirrors hkp-node's src/coordinator/mount.ts and the frontend's
 * runtime/board/mount.ts; the three must agree, since they read the same boards.
 */
namespace hkp {

/** State field holding a mount address, on both the owner and the consumer. */
inline constexpr const char* MOUNT_FIELD = "__hkpMount";

/** Scheme marking a value as a reference to a mount-owning service. */
inline constexpr const char* MOUNT_SCHEME = "hkp-mount://";

/**
 * Whether a `__hkpMount` value still names a service rather than an address —
 * i.e. whether the coordinator has yet to resolve it.
 */
inline bool isMountReference(const std::string& value)
{
  const std::string scheme(MOUNT_SCHEME);
  return value.rfind(scheme, 0) == 0;
}

/**
 * Joins a mount address and a path, without doubling or dropping the separator.
 */
inline std::string joinMountPath(const std::string& address, const std::string& path)
{
  if (path.empty())
  {
    return address;
  }
  std::string stem = address;
  if (!stem.empty() && stem.back() == '/')
  {
    stem.pop_back();
  }
  return path.front() == '/' ? stem + path : stem + "/" + path;
}

}
