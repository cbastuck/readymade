#pragma once

#include <iostream>
#include <thread>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

#include <boost/asio.hpp>
#include <boost/asio/deadline_timer.hpp>
#include <boost/bind/bind.hpp>

namespace hkp {


class Timer : public Service 
{
public:
  static std::string serviceId() { return "timer"; }

  Timer(const std::string& instanceId)
    : Service(instanceId, serviceId())
    , io_context_()
    , timer_(io_context_, boost::posix_time::microseconds(0))
  {
    
  }

  ~Timer()
  {
    stop();
  }

  json configure(Data data) override
  {
    auto json = getJSONFromData(data);
    if (json)
    {
      if (json->contains("delay"))
      {
        float f = (*json)["delay"];
        m_delayInMicroseconds = (unsigned int)(f);
      }

      auto countUpdate = getPropertyUpdate(json, "triggerCount", m_triggerCount);
      if (countUpdate)
      {
        m_triggerCount = *countUpdate;
      }
    }
    return Service::configure(data);
  }

  std::string getServiceId() const override
  {
    return serviceId();
  }

  json getState() const override
  {
    auto state = Service::getState();
    state.update(json{
      {"triggerCount", m_triggerCount}, 
      {"delay", m_delayInMicroseconds} 
    });
    return Service::mergeBypassState(state);
  }

  Data process(Data data) override
  {
    return data;
  }


  bool onBypassChanged(bool bypass) override
  {
    if (bypass)
    {
      stop();
    }
    else
    {
      start();
    }
    return bypass;
  }

private:
  void start()
  {
    std::cout << "Starting timer" << std::endl;
    if (io_service_thread_.joinable())
    {
      stop();
    }
    timer_.expires_from_now(boost::posix_time::microseconds(m_delayInMicroseconds));
    timer_.async_wait(std::bind(&Timer::onTimer, this));

    if (io_context_.stopped())
    {
      io_context_.restart();
    }
    
    io_service_thread_ = std::thread([this]() 
      { 
      io_context_.run();
      std::cout << "Timer IOContext finished" << std::endl;
      }
    );
  }

  void stop() 
  {
    io_context_.stop();
    if (io_service_thread_.joinable())
    {
      io_service_thread_.join();

    }
    std::cout << "Timer stopped" << std::endl; 
  }

  void onTimer()
  {
    next(json{{"triggerCount", m_triggerCount++}});
    timer_.expires_from_now(boost::posix_time::microseconds(m_delayInMicroseconds));
    timer_.async_wait(std::bind(&Timer::onTimer, this));
  }

  boost::asio::io_context io_context_;
  boost::asio::deadline_timer timer_;
  std::thread io_service_thread_;

  unsigned int m_triggerCount = 0;
  unsigned int m_delayInMicroseconds = 1000000; // 1 second in microseconds
};

}
