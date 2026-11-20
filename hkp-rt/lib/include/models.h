#pragma once

#include <functional>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

namespace hkp {

// Models a runtime has loaded, shared by the services that use them.
//
// A board that lays a model out as services names the same weights from every
// one of them. Each resolves its asset reference to the same file
// (AssetStore::resolvePath); this is what keeps them from each loading it. A
// model is loaded by the first service that asks for it, handed to every later
// one, and let go of when the last service holding it lets go — which is what
// the shared_ptr a service is handed means. Whatever closes the model is the
// deleter its loader gave it.
//
// Keyed by whatever says two loads would produce the same thing: what it was
// loaded as and the asset's sha256 ("llama:<sha256>"), never an asset's id,
// which a board may point at other content while it runs. One kind of model
// per key — the key is also what says which type comes back.
//
// One per asset store, so a nested pipeline, which asks the runtime around it
// for its assets, finds the models there too.
class ModelCache
{
public:
  // The model under `key`, loading it when nobody holds it. Blocking, for as
  // long as the load takes: two services asking at once wait for one load. A
  // load that throws, or answers with nothing, leaves nothing behind, and the
  // next to ask tries again.
  template <typename T>
  std::shared_ptr<T> acquire(const std::string& key,
                             const std::function<std::shared_ptr<T>()>& load)
  {
    std::shared_ptr<Entry> entry;
    {
      std::lock_guard lock(m_mutex);
      // Entries nobody holds any more and nobody is waiting on.
      for (auto it = m_entries.begin(); it != m_entries.end();)
      {
        const bool unused = it->second.use_count() == 1 && it->second->model.expired();
        it = unused && it->first != key ? m_entries.erase(it) : std::next(it);
      }
      auto& slot = m_entries[key];
      if (!slot)
      {
        slot = std::make_shared<Entry>();
      }
      entry = slot;
    }
    std::lock_guard loading(entry->loading);
    if (auto held = entry->model.lock())
    {
      return std::static_pointer_cast<T>(held);
    }
    auto loaded = load();
    entry->model = loaded;
    return loaded;
  }

  // What is loaded, for saying what a runtime holds.
  std::vector<std::string> keys() const
  {
    std::lock_guard lock(m_mutex);
    std::vector<std::string> out;
    for (const auto& [key, entry] : m_entries)
    {
      if (!entry->model.expired())
      {
        out.push_back(key);
      }
    }
    return out;
  }

private:
  struct Entry
  {
    std::mutex loading;
    std::weak_ptr<void> model;
  };

  mutable std::mutex m_mutex;
  std::map<std::string, std::shared_ptr<Entry>> m_entries;
};

} // namespace hkp
