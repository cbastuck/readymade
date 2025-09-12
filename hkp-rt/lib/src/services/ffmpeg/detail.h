#pragma once

#include <types/types.h>
#include "./types.h"

#include "codeccontext.h"


#ifdef _MSC_VER
    using ssize_t = int;
#endif

namespace hkp {

namespace detail {

bool processAudioDecodeEncode(const std::string& input, const std::string& out, unsigned int sampleRate);

bool processAudioDecodeEncodeWithInput(av::FormatContext& ictx, OutputType out, unsigned int sampleRate, av::AudioDecoderContext& adec, ssize_t audioStream);

bool convertFloatBufferToMp3(const BinaryData& rawFloatData, int sampleRate, OutputType output);
bool convertFloatBufferToOgg(const BinaryData& rawFloatData, OutputType output);
bool convertFloatBufferToWav(const BinaryData& rawFloatData, OutputType output);

void resampleBuffer(AudioData& io, unsigned int dstSampleRate);

} // namespace detail

} // namespace hkp