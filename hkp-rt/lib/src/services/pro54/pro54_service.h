#pragma once

#include <iostream>

#include <types/types.h>
#include <types/audio.h>
#include <service.h>

#include "./pro54.h"

namespace hkp {

struct NoteEvent{
  bool noteOn;
  unsigned int pitch;
  unsigned int velocity;
};
  
 class Pro54Service : public Service 
{
public:
  static std::string serviceId() { return "pro54"; }

  Pro54Service(const std::string& instanceId);

  json configure(Data data) override;
  bool configurePatch(const std::string& patch);
  std::string getServiceId() const override;
  json getState() const override;
  void pushEvent(const NoteEvent& event);

  std::optional<NoteEvent> popEvent();
  void processScheduledNotes();

  Data process(Data data) override;
  bool onBypassChanged(bool bypass) override;
  void testInjectNotes();

private:
  Pro54 m_pro54;
  std::shared_ptr<FloatRingBuffer> m_buffer;
  std::array<std::optional<NoteEvent>, 8> m_scheduledEvents;
};

}
