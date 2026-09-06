#pragma once

/**
 * How deeply nested the runtime currently is in a process call.
 *
 * A service may run the services after it rather than returning to the loop, so
 * a process call can re-enter the runtime before the outer one has finished.
 * Counting entries and exits is what tells the outermost call apart from the
 * nested ones: only when the count returns to zero is a result final and worth
 * communicating, and reporting one before then would announce an intermediate
 * value as the runtime's answer.
 */
class ProcessDepth
{
public:
  int increment() { return ++m_count; }
  int decrement() { return --m_count; }
private:
  int m_count = 0;
};
