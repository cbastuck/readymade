#include "sub_runtime.h"
#include "service.h"
#include "uuid.h"

#include <algorithm>
#include <iostream>

namespace hkp {

SubRuntime::SubRuntime(RuntimeHost& parent, const Service* ownerInParent,
                       ServiceFactory factory, PostFn post)
  : m_parent(parent)
  , m_ownerInParent(ownerInParent)
  , m_factory(std::move(factory))
  , m_post(std::move(post))
{
  m_scheduledProcesses.fill(nullptr);
}

SubRuntime::~SubRuntime() = default;

void SubRuntime::populate(const json& servicesConfig)
{
  if (!servicesConfig.is_array())
    return;

  for (const auto& svcConfig : servicesConfig)
  {
    if (!svcConfig.contains("serviceId"))
    {
      std::cerr << "SubRuntime::populate: skipping entry without 'serviceId'\n";
      continue;
    }
    const std::string serviceId  = svcConfig["serviceId"];
    const std::string instanceId = svcConfig.value("instanceId", generateUUID());

    auto svc = m_factory(serviceId, instanceId);
    if (!svc)
    {
      std::cerr << "SubRuntime::populate: unknown service '" << serviceId << "'\n";
      continue;
    }

    svc->setParentHost(*this);

    if (svcConfig.contains("state"))
    {
      svc->configure(svcConfig["state"]);
    }

    m_services.push_back(std::move(svc));
  }
}

Data SubRuntime::process(Data data)
{
  for (auto& svc : m_services)
  {
    data = svc->startProcess(data);
    if (isNull(data))
    {
      break;
    }
    if (isEarlyReturn(data))
    {
      data = getControlFlowData(data);
      break;
    }
  }
  return data;
}

Data SubRuntime::processFrom(const Service& svc, Data data,
                              bool advanceBefore,
                              std::function<void(Data)> callback)
{
  auto it = findServiceById(svc.getId());
  if (it == m_services.cend())
    throw std::runtime_error("SubRuntime::processFrom: service not found in sub-runtime");

  bool shouldBubbleToParent = true;
  for (auto next = advanceBefore ? std::next(it) : it;
       next != m_services.cend();
       ++next)
  {
    data = (*next)->startProcess(data);
    if (isNull(data))
    {
      shouldBubbleToParent = false;
      break;
    }
    if (isEarlyReturn(data))
    {
      data = getControlFlowData(data);
      shouldBubbleToParent = false;
      break;
    }
  }

  if (shouldBubbleToParent && m_ownerInParent)
  {
    return m_parent.processFrom(*m_ownerInParent, data, true, callback);
  }

  if (callback)
  {
    callback(data);
  }
  return data;
}

void SubRuntime::scheduleProcessFrom(const Service& svc, Data data, bool advanceBefore)
{
  auto pService = &svc;
  for (size_t idx = 0; idx < m_scheduledProcesses.size(); ++idx)
  {
    if (!m_scheduledProcesses[idx])
    {
      m_scheduledProcesses[idx] = [this, pService, data, advanceBefore]() {
        this->processFrom(*pService, data, advanceBefore);
      };
      m_post([this]() { processScheduled(); });
      return;
    }
  }
  std::cerr << "SubRuntime::scheduleProcessFrom: no empty slot in m_scheduledProcesses\n";
}

void SubRuntime::processScheduled()
{
  auto cpy = m_scheduledProcesses;
  m_scheduledProcesses.fill(nullptr);
  for (auto& process : cpy)
  {
    if (process)
      process();
  }
}

bool SubRuntime::isConnected(const Service& svc) const
{
  return findServiceById(svc.getId()) != m_services.cend();
}

void SubRuntime::sendData(Data data, MessagePurpose purpose,
                           const std::string& sender,
                           std::function<void(Data)> callback)
{
  m_parent.sendData(std::move(data), purpose, sender, std::move(callback));
}

std::shared_ptr<SubRuntime> SubRuntime::createSubRuntime(const Service& ownerInParent,
                                                         const json& servicesConfig)
{
  auto sr = std::make_shared<SubRuntime>(*this, &ownerInParent, m_factory, m_post);
  sr->populate(servicesConfig);
  return sr;
}

SubRuntime::ServiceList::const_iterator SubRuntime::findServiceById(const std::string& id) const
{
  return std::find_if(
    m_services.cbegin(),
    m_services.cend(),
    [&id](const auto& svc) { return svc->getId() == id; }
  );
}

} // namespace hkp
