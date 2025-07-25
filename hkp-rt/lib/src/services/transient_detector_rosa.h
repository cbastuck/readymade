#pragma once
#include <vector>
#include <cmath>
#include <algorithm>
#include <numeric>
#include <iostream>

namespace rosa {

constexpr float PI = 3.14159265358979323846f;

// Generate a Hann window
inline std::vector<float> hann(size_t N) {
    std::vector<float> win(N);
    for (size_t i = 0; i < N; ++i)
        win[i] = 0.5f - 0.5f * std::cos(2.0f * PI * i / N);
    return win;
}

// Naive DFT magnitude
inline std::vector<float> magnitude_spectrum(const std::vector<float>& frame) {
    size_t N = frame.size();
    std::vector<float> mag(N / 2 + 1);
    for (size_t k = 0; k <= N / 2; ++k) {
        float real = 0, imag = 0;
        for (size_t n = 0; n < N; ++n) {
            real += frame[n] * std::cos(2 * PI * k * n / N);
            imag -= frame[n] * std::sin(2 * PI * k * n / N);
        }
        mag[k] = std::sqrt(real * real + imag * imag);
    }
    return mag;
}

// Spectral flux (abs diff)
inline std::vector<float> spectral_flux(const std::vector<float>& signal, size_t frame_size, size_t hop_size) {
    std::vector<float> flux;
    std::vector<float> window = hann(frame_size);

    std::vector<float> prev_mag(frame_size / 2 + 1, 0.0f);
    for (size_t i = 0; i + frame_size <= signal.size(); i += hop_size) {
        std::vector<float> frame(signal.begin() + i, signal.begin() + i + frame_size);
        for (size_t j = 0; j < frame_size; ++j)
            frame[j] *= window[j];
        auto mag = magnitude_spectrum(frame);

        float sum = 0.0f;
        for (size_t k = 0; k < mag.size(); ++k)
            sum += std::max(0.0f, mag[k] - prev_mag[k]);

        flux.push_back(sum);
        prev_mag = mag;
    }

    return flux;
}

// Normalize vector to max 1.0
inline void normalize(std::vector<float>& v) {
    float max_val = *std::max_element(v.begin(), v.end());
    if (max_val > 1e-6f) {
        for (float& x : v) x /= max_val;
    }
}

// Autocorrelation of vector
inline std::vector<float> autocorrelate(const std::vector<float>& x, size_t max_lag) {
    std::vector<float> ac(max_lag, 0.0f);
    for (size_t lag = 1; lag < max_lag; ++lag) {
        for (size_t i = 0; i + lag < x.size(); ++i)
            ac[lag] += x[i] * x[i + lag];
    }
    return ac;
}

// Estimate tempo (BPM) from autocorrelation lag
inline float estimate_bpm(const std::vector<float>& flux, int sr, int hop_size) {
    auto ac = autocorrelate(flux, sr * 60 / 40 / hop_size); // up to 40 BPM
    auto max_it = std::max_element(ac.begin() + sr * 60 / 200 / hop_size, ac.end()); // 200–40 BPM
    size_t best_lag = std::distance(ac.begin(), max_it);
    return 60.0f * sr / (best_lag * hop_size + 1e-6f);  // prevent divide-by-zero
}

// Track beats by placing pulses at regular tempo intervals aligned to first peak
inline std::vector<float> track_beats(const std::vector<float>& flux, float bpm, int sr, int hop_size) {
    std::vector<float> beats;
    float interval = 60.0f / bpm; // seconds
    float step = interval * sr / hop_size; // in flux frames

    // Find strongest onset to align beats
    auto max_it = std::max_element(flux.begin(), flux.end());
    size_t start_idx = std::distance(flux.begin(), max_it);

    for (size_t i = 0; i < flux.size(); ++i) {
        size_t idx = start_idx + static_cast<size_t>(i * step);
        if (idx >= flux.size()) break;
        float time_sec = (idx * hop_size) / float(sr);
        beats.push_back(time_sec);
    }

    return beats;
}

// === MAIN ENTRY POINT ===
inline std::vector<float> detect_beats(const std::vector<float>& audio,
                                       int sr = 44100,
                                       size_t frame_size = 1024,
                                       size_t hop_size = 512) {
    auto flux = spectral_flux(audio, frame_size, hop_size);
    normalize(flux);
    if (flux.empty()) return {};

    float bpm = estimate_bpm(flux, sr, hop_size);
    return track_beats(flux, bpm, sr, hop_size);
}

} // namespace beat
