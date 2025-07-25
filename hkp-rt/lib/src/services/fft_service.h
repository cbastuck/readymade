#pragma once

#include <vector>
#include <complex>
#include <cmath>
#include <stdexcept>
#include <iostream>

#include <types/types.h>
#include <service.h>
#include <types/data.h>

namespace hkp {

class FFTService : public Service 
{
public:
  using complexf = std::complex<float>;

  static std::string serviceId() { return "fft"; }

  FFTService(const std::string& instanceId)
    : Service(instanceId, serviceId())
    , m_windowLength(512) // Default FFT window length
  { 
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
    auto state = json{{ "windowLength", m_windowLength }};
    return Service::mergeBypassState(state);
  }

  Data process(Data data) override
  {
    auto buffer = getRingBufferFromData(data);
    if (buffer)
    {
      auto numSamples = buffer->availableCount();
      if (numSamples < m_windowLength) 
      {
        std::cout << "Not enough samples yet for FFT, got: " << numSamples << std::endl;
        return Null();
      }
      
      if ((numSamples & (numSamples - 1)) != 0) 
      {
        std::cout << "FFT input size must be a power of 2, got: " << numSamples << std::endl;
        return Null(); // or throw an exception 
      }

      std::vector<float> samples(numSamples);
      buffer->consumeAvailable(samples, true);
      if (samples.size() > m_windowLength) 
      {
        std::cout << "Resampling down from " << samples.size() << " to " << m_windowLength << std::endl;
        resample_down(samples, m_windowLength);
      }

      std::vector<complexf> spectrum = fft(samples);
      auto result = json::array();
      for (unsigned int i=0, n=numSamples/2; i<n ; ++i) 
      {
        result.push_back(std::abs(spectrum[i])); // Store magnitude of each complex number
      }
      return Data(result);
    }
    return data;
  }

private:
  static constexpr float PI = 3.14159265358979323846f;

  // Internal recursive FFT function
  inline void fft_recursive(std::vector<complexf>& a, bool inverse) 
  {
      size_t n = a.size();
      if (n <= 1) 
      {
        return;
      }

      std::vector<complexf> even(n / 2), odd(n / 2);
      for (size_t i = 0; i < n / 2; ++i) 
      {
          even[i] = a[i * 2];
          odd[i]  = a[i * 2 + 1];
      }

      fft_recursive(even, inverse);
      fft_recursive(odd, inverse);

      for (size_t k = 0; k < n / 2; ++k) 
      {
          float angle = (inverse ? 2.0f : -2.0f) * PI * k / static_cast<float>(n);
          complexf twiddle = std::polar(1.0f, angle) * odd[k];
          a[k] = even[k] + twiddle;
          a[k + n / 2] = even[k] - twiddle;
      }
  }

  // Forward FFT: from real input to complex frequency domain
  inline std::vector<complexf> fft(const std::vector<float>& input) 
  {
      size_t n = input.size();

      // Check if n is a power of 2
      if ((n & (n - 1)) != 0) 
      {
          std::cout << "FFT input size must be a power of 2" << std::endl;;
          n = previous_power_of_two(n);
      }

      std::vector<complexf> data(n);
      for (size_t i = 0; i < n; ++i) 
      {
          data[i] = complexf(input[i], 0.0f);
      }
      fft_recursive(data, false);

      return data;
  }

  inline uint32_t previous_power_of_two(uint32_t n) {
    if (n == 0) return 0;

    // Set all bits below the highest set bit
    n |= (n >> 1);
    n |= (n >> 2);
    n |= (n >> 4);
    n |= (n >> 8);
    n |= (n >> 16);

    // The result is now all 1s below the highest set bit
    // Shift right once and add 1 to get the highest power of 2 <= original
    return n - (n >> 1);
}

inline void resample_down(std::vector<float>& data, size_t new_size) 
{
  size_t old_size = data.size();
  if (new_size >= old_size || new_size == 0)
  {
    return;
  }

  std::vector<float> result(new_size);
  float scale = static_cast<float>(old_size) / new_size;
  for (size_t i = 0; i < new_size; ++i) 
  {
    float idx = i * scale;
    size_t idx0 = static_cast<size_t>(idx);
    size_t idx1 = std::min(idx0 + 1, old_size - 1);
    float frac = idx - idx0;
    // Linear interpolation
    result[i] = data[idx0] * (1.0f - frac) + data[idx1] * frac;
  }
  data = std::move(result);
}
  unsigned int m_windowLength; // Length of the FFT window
};

}
