// mp4_to_wav.cpp
//
// This translation unit owns the MINIMP4_IMPLEMENTATION define, which emits
// the minimp4 function bodies.  Including the define here (rather than in the
// header) ensures the bodies appear in exactly one object file — a requirement
// of all single-header C libraries that follow the "header-only with optional
// implementation" pattern.
//
// fdk-aac is a proper static library (not single-header), so it just needs the
// usual header include and a linker input; no special define is required.

#define MINIMP4_IMPLEMENTATION
#include "minimp4.h"

#include <fdk-aac/aacdecoder_lib.h>

#include <cstdio>
#include <cstdint>
#include <cstring>
#include <stdexcept>
#include <string>
#include <vector>

namespace hkp {

// ---------------------------------------------------------------------------
// Internal I/O helpers for minimp4
// ---------------------------------------------------------------------------

static int mp4_read_cb(int64_t offset, void* buffer, size_t size, void* token)
{
    FILE* fp = static_cast<FILE*>(token);
#ifdef _WIN32
    if (_fseeki64(fp, static_cast<__int64>(offset), SEEK_SET) != 0) return -1;
#else
    if (fseeko(fp, static_cast<off_t>(offset), SEEK_SET) != 0) return -1;
#endif
    return fread(buffer, 1, size, fp) == size ? 0 : -1;
}

struct MemoryBuffer { const uint8_t* data; size_t size; };

static int mp4_mem_read_cb(int64_t offset, void* buffer, size_t size, void* token)
{
    const auto* mb = static_cast<const MemoryBuffer*>(token);
    if (offset < 0 || static_cast<size_t>(offset) + size > mb->size) return -1;
    std::memcpy(buffer, mb->data + offset, size);
    return 0;
}

static int64_t mp4_file_size(FILE* fp)
{
#ifdef _WIN32
    if (_fseeki64(fp, 0, SEEK_END) != 0) return -1;
    const int64_t size = _ftelli64(fp);
    if (_fseeki64(fp, 0, SEEK_SET) != 0) return -1;
#else
    if (fseeko(fp, 0, SEEK_END) != 0) return -1;
    const int64_t size = static_cast<int64_t>(ftello(fp));
    if (fseeko(fp, 0, SEEK_SET) != 0) return -1;
#endif
    return size;
}

// ---------------------------------------------------------------------------
// decodeMp4ToPcm
//
// Opens an MP4 file, locates the first AAC audio track, decodes it with
// fdk-aac, and returns interleaved int16_t PCM samples.
// outSampleRate and outChannels are set from the first successfully decoded
// frame; they are not modified if decoding fails entirely.
// Throws std::runtime_error on any hard failure.
// ---------------------------------------------------------------------------
std::vector<int16_t> decodeMp4ToPcm(const char* filename,
                                     unsigned int& outSampleRate,
                                     unsigned int& outChannels)
{
    // RAII guard: all resources are released in the destructor so that every
    // early-return or exception path is safe.
    struct Guard
    {
        FILE*            fp          = nullptr;
        MP4D_demux_t     demux       = {};
        bool             demuxOpen   = false;
        HANDLE_AACDECODER decoder    = nullptr;

        ~Guard()
        {
            if (decoder)    aacDecoder_Close(decoder);
            if (demuxOpen)  MP4D_close(&demux);
            if (fp)         fclose(fp);
        }
    } g;

    // Open file
    g.fp = fopen(filename, "rb");
    if (!g.fp)
        throw std::runtime_error(std::string("failed to open MP4: ") + filename);

    const int64_t fileSize = mp4_file_size(g.fp);
    if (fileSize <= 0)
        throw std::runtime_error("failed to determine MP4 file size");

    // Parse container
    if (!MP4D_open(&g.demux, mp4_read_cb, g.fp, fileSize))
        throw std::runtime_error("failed to parse MP4 container");
    g.demuxOpen = true;

    // Find first AAC audio track (supports AAC-LC, AAC Main, AAC SSR, HE-AAC)
    int audioTrack = -1;
    for (unsigned i = 0; i < g.demux.track_count; ++i)
    {
        const MP4D_track_t& tr = g.demux.track[i];
        if (tr.handler_type != MP4D_HANDLER_TYPE_SOUN) continue;
        if (!tr.dsi || tr.dsi_bytes == 0)               continue;
        if (tr.object_type_indication == MP4_OBJECT_TYPE_AUDIO_ISO_IEC_14496_3        ||
            tr.object_type_indication == MP4_OBJECT_TYPE_AUDIO_ISO_IEC_13818_7_MAIN_PROFILE ||
            tr.object_type_indication == MP4_OBJECT_TYPE_AUDIO_ISO_IEC_13818_7_LC_PROFILE   ||
            tr.object_type_indication == MP4_OBJECT_TYPE_AUDIO_ISO_IEC_13818_7_SSR_PROFILE)
        {
            audioTrack = static_cast<int>(i);
            break;
        }
    }
    if (audioTrack < 0)
        throw std::runtime_error("no AAC audio track found in MP4");

    const MP4D_track_t& track = g.demux.track[audioTrack];

    // Configure fdk-aac decoder with the AudioSpecificConfig (DSI) from the
    // MP4 container.  TT_MP4_RAW means we feed raw AAC frames, not ADTS.
    g.decoder = aacDecoder_Open(TT_MP4_RAW, 1);
    if (!g.decoder)
        throw std::runtime_error("failed to open fdk-aac decoder");

    auto*      ascPtr  = const_cast<unsigned char*>(track.dsi);
    UINT       ascSize = static_cast<UINT>(track.dsi_bytes);
    if (aacDecoder_ConfigRaw(g.decoder, &ascPtr, &ascSize) != AAC_DEC_OK)
        throw std::runtime_error("failed to configure fdk-aac with AudioSpecificConfig");

    // Decode all frames
    std::vector<int16_t> pcm;
    pcm.reserve(track.sample_count * 1024); // rough pre-allocation

    for (unsigned i = 0; i < track.sample_count; ++i)
    {
        unsigned frameBytes = 0, ts = 0, dur = 0;
        const MP4D_file_offset_t offset = MP4D_frame_offset(
            &g.demux, static_cast<unsigned>(audioTrack), i, &frameBytes, &ts, &dur);

        if (!frameBytes) continue;

        std::vector<unsigned char> frame(frameBytes);
        if (mp4_read_cb(static_cast<int64_t>(offset), frame.data(), frameBytes, g.fp) != 0)
            continue;

        unsigned char* inBuf      = frame.data();
        const UINT     inSize     = static_cast<UINT>(frameBytes);
        UINT           bytesValid = inSize;

        if (aacDecoder_Fill(g.decoder, &inBuf, &inSize, &bytesValid) != AAC_DEC_OK)
            continue;

        INT_PCM frameBuf[2048 * 8]; // max AAC frame × max channels
        if (aacDecoder_DecodeFrame(g.decoder, frameBuf,
                                   sizeof(frameBuf) / sizeof(frameBuf[0]), 0) != AAC_DEC_OK)
            continue;

        CStreamInfo* info = aacDecoder_GetStreamInfo(g.decoder);
        if (!info || info->sampleRate <= 0 || info->numChannels <= 0 || info->frameSize <= 0)
            continue;

        outSampleRate = static_cast<unsigned int>(info->sampleRate);
        outChannels   = static_cast<unsigned int>(info->numChannels);
        const int n   = info->frameSize * info->numChannels;
        pcm.insert(pcm.end(), frameBuf, frameBuf + n);
    }

    return pcm;
}

// ---------------------------------------------------------------------------
// decodeMp4ToPcmFromMemory
//
// Same as decodeMp4ToPcm but reads directly from an in-memory buffer instead
// of a file.  The caller retains ownership of the buffer.
// ---------------------------------------------------------------------------
std::vector<int16_t> decodeMp4ToPcmFromMemory(const uint8_t* data,
                                               size_t         size,
                                               unsigned int&  outSampleRate,
                                               unsigned int&  outChannels)
{
    struct Guard
    {
        MP4D_demux_t     demux     = {};
        bool             demuxOpen = false;
        HANDLE_AACDECODER decoder  = nullptr;

        ~Guard()
        {
            if (decoder)   aacDecoder_Close(decoder);
            if (demuxOpen) MP4D_close(&demux);
        }
    } g;

    MemoryBuffer mb{ data, size };

    if (!MP4D_open(&g.demux, mp4_mem_read_cb, &mb, static_cast<int64_t>(size)))
        throw std::runtime_error("failed to parse MP4 container from memory");
    g.demuxOpen = true;

    int audioTrack = -1;
    for (unsigned i = 0; i < g.demux.track_count; ++i)
    {
        const MP4D_track_t& tr = g.demux.track[i];
        if (tr.handler_type != MP4D_HANDLER_TYPE_SOUN) continue;
        if (!tr.dsi || tr.dsi_bytes == 0)               continue;
        if (tr.object_type_indication == MP4_OBJECT_TYPE_AUDIO_ISO_IEC_14496_3             ||
            tr.object_type_indication == MP4_OBJECT_TYPE_AUDIO_ISO_IEC_13818_7_MAIN_PROFILE ||
            tr.object_type_indication == MP4_OBJECT_TYPE_AUDIO_ISO_IEC_13818_7_LC_PROFILE   ||
            tr.object_type_indication == MP4_OBJECT_TYPE_AUDIO_ISO_IEC_13818_7_SSR_PROFILE)
        {
            audioTrack = static_cast<int>(i);
            break;
        }
    }
    if (audioTrack < 0)
        throw std::runtime_error("no AAC audio track found in MP4");

    const MP4D_track_t& track = g.demux.track[audioTrack];

    g.decoder = aacDecoder_Open(TT_MP4_RAW, 1);
    if (!g.decoder)
        throw std::runtime_error("failed to open fdk-aac decoder");

    auto*      ascPtr  = const_cast<unsigned char*>(track.dsi);
    UINT       ascSize = static_cast<UINT>(track.dsi_bytes);
    if (aacDecoder_ConfigRaw(g.decoder, &ascPtr, &ascSize) != AAC_DEC_OK)
        throw std::runtime_error("failed to configure fdk-aac with AudioSpecificConfig");

    std::vector<int16_t> pcm;
    pcm.reserve(track.sample_count * 1024);

    for (unsigned i = 0; i < track.sample_count; ++i)
    {
        unsigned frameBytes = 0, ts = 0, dur = 0;
        const MP4D_file_offset_t offset = MP4D_frame_offset(
            &g.demux, static_cast<unsigned>(audioTrack), i, &frameBytes, &ts, &dur);

        if (!frameBytes) continue;

        std::vector<unsigned char> frame(frameBytes);
        if (mp4_mem_read_cb(static_cast<int64_t>(offset), frame.data(), frameBytes, &mb) != 0)
            continue;

        unsigned char* inBuf      = frame.data();
        const UINT     inSize     = static_cast<UINT>(frameBytes);
        UINT           bytesValid = inSize;

        if (aacDecoder_Fill(g.decoder, &inBuf, &inSize, &bytesValid) != AAC_DEC_OK)
            continue;

        INT_PCM frameBuf[2048 * 8];
        if (aacDecoder_DecodeFrame(g.decoder, frameBuf,
                                   sizeof(frameBuf) / sizeof(frameBuf[0]), 0) != AAC_DEC_OK)
            continue;

        CStreamInfo* info = aacDecoder_GetStreamInfo(g.decoder);
        if (!info || info->sampleRate <= 0 || info->numChannels <= 0 || info->frameSize <= 0)
            continue;

        outSampleRate = static_cast<unsigned int>(info->sampleRate);
        outChannels   = static_cast<unsigned int>(info->numChannels);
        const int n   = info->frameSize * info->numChannels;
        pcm.insert(pcm.end(), frameBuf, frameBuf + n);
    }

    return pcm;
}

} // namespace hkp
