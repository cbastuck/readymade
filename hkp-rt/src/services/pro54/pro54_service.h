#pragma once

#include <iostream>

#include <types/types.h>
#include <types/audio.h>
#include <service.h>

#include "./pro54.h"

struct NoteEvent{
  bool noteOn;
  unsigned int pitch;
  unsigned int velocity;
};
  
 class Pro54Service : public Service 
{
public:
  static std::string serviceId() { return "pro54"; }

  Pro54Service(const std::string& instanceId)
     : Service(instanceId, serviceId())
     , m_buffer(std::make_shared<FloatRingBuffer>("pro54" + instanceId))
     , m_scheduledEvents{std::nullopt}
  {
    m_pro54.initialise(1, 44100);
    m_pro54.addEvent_Volume(50);
    setPatch(m_pro54, patch115);
    m_pro54.addEvent_TestTone(0);
  }

  json configure(Data data) override
  {
    return Service::configure(data);
  }

  std::string getServiceId() const override
  {
    return serviceId();
  }

  json getState() const override
  {
    return Service::getState();
  }

  void pushEvent(const NoteEvent& event)
  {
    for (unsigned int i=0; i<m_scheduledEvents.size(); ++i)
      {
        if (!m_scheduledEvents[i].has_value())
        {
          m_scheduledEvents[i] = event;
          return;
        }
      }
  }

  std::optional<NoteEvent> popEvent()
  {
    for (int i=m_scheduledEvents.size()-1; i>=0 ; --i)
    {
      if (m_scheduledEvents[i].has_value())
      {
        auto value = m_scheduledEvents[i].value();
        m_scheduledEvents[i] = std::nullopt;
        return value;
      }
    }
    return std::nullopt;
  }

  void processScheduledNotes()
  {
    while(auto value = popEvent())
    {      
      if (value->noteOn)
      {
        m_pro54.addEvent_eventIn(Pro54::std_notes_NoteOn{0, (float)value->pitch, (float)value->velocity});
      }
      else
      {
        m_pro54.addEvent_eventIn(Pro54::std_notes_NoteOff{0, (float)value->pitch, (float)value->velocity});
      }
    }
  }

  Data process(Data data) override
  {    
    auto json = getJSONFromData(data);
    if (json)
    {
      if (json->contains("triggerCount")) 
      {
        processScheduledNotes();
        const unsigned int n = BUFFER_SIZE; 
        m_pro54.advance(n);
        for (int j = 0; j < n; j++) 
        {
          m_buffer->append(m_pro54.io.out[j][0]);
        } 
        return Data(m_buffer);
      }
      if (json->contains("pitch") && json->contains("type") && json->contains("velocity"))
      {
        pushEvent(NoteEvent {(*json)["type"] == "noteOn", (*json)["pitch"],  (*json)["velocity"]});
      }
      if (json->contains("frameCount") && json->contains("channelCount"))
      {
        processScheduledNotes();

        unsigned int frameCount = (*json)["frameCount"];
        m_pro54.advance(frameCount);
        for (int j = 0; j < frameCount; ++j) 
        {
          m_buffer->append(m_pro54.io.out[j][0]);
        }
        return Data(m_buffer);
      }
    }
    return Null();
  }

  bool onBypassChanged(bool bypass) override
  {
    return bypass;
  }

  void testInjectNotes() 
  {
    static int i = 0;
    if (++i == 1000) 
    {
      pushEvent(NoteEvent{true, 60,  127});
    }
    if (i == 2000)
    {
      pushEvent(NoteEvent{false, 60,  127});
      i=0;
    }
  }

private:
  Pro54 m_pro54;
  std::shared_ptr<FloatRingBuffer> m_buffer;
  std::array<std::optional<NoteEvent>, 8> m_scheduledEvents;
};
