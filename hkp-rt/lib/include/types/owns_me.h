#pragma once

// This template is only semantics to indicate that the pointer is not owned by this class that uses this template as a member variable.
// It's purely for documentation purposes and create an awareness that ownership is managed by the design.
// Used if shared ownership via shared_ptr is explicitly not wanted.
template <typename T>
class OwnsMe
{
public:
  OwnsMe(T *ptr = nullptr) : ptr_(ptr) {}
  T *get() const { return ptr_; }
  T &operator*() const { return *ptr_; }
  T *operator->() const { return ptr_; }

  operator bool() const { return ptr_ != nullptr; }

private:
  T *ptr_;
};