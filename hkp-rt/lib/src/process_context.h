#pragma once

class ProcessContext
{
public:
  int increment() { return ++m_count; }
  int decrement() { return --m_count; }
private:
  int m_count = 0;
};