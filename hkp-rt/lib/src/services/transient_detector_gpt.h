#pragma once
#include <vector>
#include <cmath>
#include <algorithm>
#include <numeric>

namespace onset {

constexpr float PI = 3.14159265358979323846f;

namespace internal {

// Hann window
inline std::vector<float> hann_window(size_t size) {
    std::vector<float> window(size);
    for (size_t i = 0; i < size; ++i)
        window[i] = 0.5f - 0.5f * std::cos(2.0f * PI * i / (size - 1));
    return window;
}

// Naive DFT magnitude
inline std::vector<float> magnitude_spectrum(const std::vector<float>& frame) {
    size_t N = frame.size();
    std::vector<float> mag(N / 2 + 1);
    for (size_t k = 0; k <= N / 2; ++k) {
        float real = 0.0f, imag = 0.0f;
        for (size_t n = 0; n < N; ++n) {
            real += frame[n] * std::cos(2.0f * PI * k * n / N);
            imag -= frame[n] * std::sin(2.0f * PI * k * n / N);
        }
        mag[k] = std::sqrt(real * real + imag * imag);
    }
    return mag;
}

inline std::vector<float> spectral_flux(const std::vector<float>& signal, size_t window_size, size_t hop_size) {
    auto window = hann_window(window_size);
    std::vector<std::vector<float>> spectra;

    size_t offset = 0;
    while (offset + window_size <= signal.size()) {
        std::vector<float> frame(window_size);
        for (size_t j = 0; j < window_size; ++j)
            frame[j] = signal[offset + j] * window[j];

        std::vector<float> mag(frame.size() / 2 + 1, 0.0f);
        for (size_t k = 0; k <= frame.size() / 2; ++k) {
            float real = 0.0f, imag = 0.0f;
            for (size_t n = 0; n < frame.size(); ++n) {
                real += frame[n] * std::cos(2.0f * PI * k * n / frame.size());
                imag -= frame[n] * std::sin(2.0f * PI * k * n / frame.size());
            }
            float mag_val = std::sqrt(real * real + imag * imag);
            if (std::isnan(mag_val) || std::isinf(mag_val)) mag_val = 0.0f;
            mag[k] = mag_val;
        }

        spectra.push_back(mag);
        offset += hop_size;
    }

    std::vector<float> flux;
    for (size_t i = 1; i < spectra.size(); ++i) {
        float sum = 0.0f;
        for (size_t j = 0; j < spectra[i].size(); ++j) {
            float diff = spectra[i][j] - spectra[i - 1][j];
            sum += std::max(diff, 0.0f);
        }
        flux.push_back(sum);
    }

    return flux;
}


// Estimate BPM from auto-correlation of spectral flux
inline float estimate_bpm(const std::vector<float>& flux, int sample_rate, int hop_size) {
    size_t max_lag = sample_rate * 60 / 40 / hop_size; // 40 BPM
    size_t min_lag = sample_rate * 60 / 200 / hop_size; // 200 BPM

    std::vector<float> ac(max_lag, 0.0f);
    for (size_t lag = min_lag; lag < max_lag; ++lag) {
        float sum = 0.0f;
        for (size_t i = 0; i + lag < flux.size(); ++i)
            sum += flux[i] * flux[i + lag];
        ac[lag] = sum;
    }

    auto max_it = std::max_element(ac.begin() + min_lag, ac.end());
    size_t best_lag = std::distance(ac.begin(), max_it);
    float bpm = 60.0f * sample_rate / (hop_size * best_lag);
    return bpm;
}

// Beat-spaced peak picking
inline std::vector<size_t> beat_peaks(const std::vector<float>& flux, float bpm, int sample_rate, int hop_size, float threshold = 0.3f) {
    float beat_hop = (60.0f / bpm) * sample_rate / hop_size;
    std::vector<size_t> peaks;
    size_t i = 0;

    while (i < flux.size()) {
        size_t start = i;
        size_t end = std::min<size_t>(flux.size(), i + static_cast<size_t>(beat_hop));
        auto max_it = std::max_element(flux.begin() + start, flux.begin() + end);
        if (*max_it > threshold) {
            size_t idx = std::distance(flux.begin(), max_it);
            peaks.push_back(idx);
        }
        i += static_cast<size_t>(beat_hop);
    }

    return peaks;
}

} // namespace internal

/// Main beat-detection function
inline std::vector<float> detect_beats(const std::vector<float>& pcm_data,
                                       int sample_rate = 44100,
                                       size_t window_size = 1024,
                                       size_t hop_size = 512,
                                       float peak_threshold = 0.1f) // lowered default
{
    if (pcm_data.size() < window_size) return {};

    auto flux = internal::spectral_flux(pcm_data, window_size, hop_size);
    
    // Normalize flux
    float max_val = *std::max_element(flux.begin(), flux.end());
    if (max_val > 0.0f)
        for (auto& v : flux) v /= max_val;

    // Check if signal is silent or flat
    if (max_val < 1e-4f) return {};

    float bpm = internal::estimate_bpm(flux, sample_rate, hop_size);
    if (bpm < 40.0f || bpm > 200.0f) {
        // fallback BPM
        bpm = 120.0f;
    }

    auto beat_idxs = internal::beat_peaks(flux, bpm, sample_rate, hop_size, peak_threshold);

    std::vector<float> beat_times;
    for (auto idx : beat_idxs) {
        float time = (idx * hop_size + window_size / 2) / static_cast<float>(sample_rate);
        beat_times.push_back(time);
    }

    return beat_times;
}


} // namespace onset
