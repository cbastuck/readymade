#include "./detail.h"

#include "av.h"
#include "ffmpeg.h"
#include "codec.h"
#include "packet.h"
#include "videorescaler.h"
#include "audioresampler.h"
#include "avutils.h"

// API2
#include "format.h"
#include "formatcontext.h"
#include "codec.h"
#include "codeccontext.h"

namespace hkp {

namespace detail {

bool processAudioDecodeEncode(const std::string& input, const std::string& out, unsigned int sampleRate)
{
  using namespace std;
  using namespace av;

  av::init();
  av::setFFmpegLoggingLevel(AV_LOG_ERROR); // AV_LOG_TRACE);

  ssize_t      audioStream = -1;
  AudioDecoderContext adec;
  Stream       ast;
  error_code   ec;

  // INPUT
  FormatContext ictx;

  ictx.openInput(input, ec);
  if (ec) 
  {
      cerr << "Ffmpeg::processAudioDecodeEncode() Can't open input\n";
      return false;
  }

  ictx.findStreamInfo();
  for (size_t i = 0; i < ictx.streamsCount(); ++i) 
  {
      auto st = ictx.stream(i);
      if (st.isAudio()) 
      {
          audioStream = i;
          ast = st;
          break;
      }
  }

  cerr << audioStream << endl;
  if (ast.isNull()) 
  {
      cerr << "Ffmpeg::processAudioDecodeEncode() Audio stream not found\n";
      return false;
  }

  if (ast.isValid()) 
  {
    adec = AudioDecoderContext(ast);
    adec.open(ec);
    if (ec) 
    {
      cerr << "Ffmpeg::processAudioDecodeEncode() Can't open codec\n";
      return false;
    }
  }
  return detail::processAudioDecodeEncodeWithInput(ictx, out, sampleRate, adec, audioStream);
}

bool convertFloatBufferToMp3(const BinaryData& rawFloatData, int sampleRate, OutputType output) 
{
  using namespace std;
  using namespace av;

  av::init();
  av::setFFmpegLoggingLevel(AV_LOG_ERROR);

  ssize_t      audioStream = -1;
  AudioDecoderContext adec;
  Stream       ast;
  error_code   ec;
  
  // INPUT
  FormatContext ictx;
  MemoryIO input(reinterpret_cast<const uint8_t*>(rawFloatData.data()), rawFloatData.size());

  InputFormat inputFormat;
  auto isLittleEndian = isPlatformLittleEndian();
  inputFormat.setFormat(isLittleEndian ? "f32le" : "f32be");
  
  ictx.openInput(&input, inputFormat, ec);
  if (ec)
  {
    cerr << "Ffmpeg::convertFloatBufferToMp3() Can't open input\n";
    return false;
  }

  ictx.findStreamInfo();

  for (size_t i = 0; i < ictx.streamsCount(); ++i) 
  {
      auto st = ictx.stream(i);
      if (st.isAudio()) 
      {
          audioStream = i;
          ast = st;
          break;
      }
  }

  cerr << audioStream << endl;

  if (ast.isNull()) 
  {
      cerr << "Ffmpeg::convertFloatBufferToMp3() Audio stream not found\n";
      return false;
  }

  if (ast.isValid()) 
  {
    adec = AudioDecoderContext(ast);
    adec.open(ec);

    if (ec) 
    {
        cerr << "Ffmpeg::convertFloatBufferToMp3() Can't open codec\n";
        return false;
    }
  }
  return detail::processAudioDecodeEncodeWithInput(ictx, output, sampleRate, adec, audioStream);
}

bool convertFloatBufferToWav(const BinaryData& rawFloatData, OutputType output)
{
  if (!output.memoryIO)
  {
    std::cerr << "Ffmpeg::convertFloatBufferToWav() only MemoryIO supported yet." << std::endl;
    return false;
  }
  auto& target = *output.memoryIO;
  
  // Write WAV header for mono channel float little endian data
  uint32_t fileSize = static_cast<uint32_t>(rawFloatData.size() + 44 - 8); // 44 bytes header, minus "RIFF" and file size
  uint32_t fmtChunkSize = 16; // PCM format chunk size
  uint16_t audioFormat = 3; // IEEE float format
  uint16_t numChannels = 1; // Mono
  uint32_t sampleRate = 44100; // Default sample rate
  uint32_t byteRate = sampleRate * numChannels * sizeof(float); // SampleRate * NumChannels * BytesPerSample
  uint16_t blockAlign = numChannels * sizeof(float); // NumChannels * BytesPerSample
  uint16_t bitsPerSample = 32; // Float is 32 bits
  uint32_t dataChunkSize = static_cast<uint32_t>(rawFloatData.size());

  // RIFF header
  target.write(reinterpret_cast<const uint8_t*>("RIFF"), 4);
  target.write(reinterpret_cast<const uint8_t*>(&fileSize), 4);
  target.write(reinterpret_cast<const uint8_t*>("WAVE"), 4);

  // fmt subchunk
  target.write(reinterpret_cast<const uint8_t*>("fmt "), 4);
  target.write(reinterpret_cast<const uint8_t*>(&fmtChunkSize), 4);
  target.write(reinterpret_cast<const uint8_t*>(&audioFormat), 2);
  target.write(reinterpret_cast<const uint8_t*>(&numChannels), 2);
  target.write(reinterpret_cast<const uint8_t*>(&sampleRate), 4);
  target.write(reinterpret_cast<const uint8_t*>(&byteRate), 4);
  target.write(reinterpret_cast<const uint8_t*>(&blockAlign), 2);
  target.write(reinterpret_cast<const uint8_t*>(&bitsPerSample), 2);

  // data subchunk
  target.write(reinterpret_cast<const uint8_t*>("data"), 4);
  target.write(reinterpret_cast<const uint8_t*>(&dataChunkSize), 4);
  target.write(reinterpret_cast<const uint8_t*>(rawFloatData.data()), rawFloatData.size());

  // update file size in the header
  fileSize = static_cast<uint32_t>(target.dataBuffer().size() - 8); // 8 bytes for "RIFF" and file size
  target.patchDataAt(4, reinterpret_cast<const uint8_t*>(&fileSize), 4);
  return true;
}

void resampleBuffer(AudioData& io, unsigned int dstSampleRate)
{
  std::error_code ec;

  av::SampleFormat sampleFormat("fltp"); // see https://ffmpeg.org/doxygen/trunk/samplefmt_8c.html
  auto& src = io.samples;
  auto srcSampleRate = io.sampleRate;

  int numChannels = 2;
  unsigned int numSamplesPerChannel = static_cast<unsigned int>(src[0].size());

  uint64_t channelLayout = AV_CH_LAYOUT_STEREO;
  int sampleRate = srcSampleRate; // your input sample rate

  // Create AudioSamples with allocated internal buffers
  av::AudioSamples samples(sampleFormat, numSamplesPerChannel, channelLayout, sampleRate);

  // Copy your vectors into AudioSamples planar buffers
  for (int ch = 0; ch < numChannels; ++ch) 
  {
      float* dst = reinterpret_cast<float*>(samples.data(ch)); // pointer to channel buffer
      std::memcpy(dst, src[ch].data(), numSamplesPerChannel * sizeof(float));
  }

  av::AudioResampler resampler(
    channelLayout, dstSampleRate, sampleFormat,
    channelLayout, srcSampleRate, sampleFormat
  );
  resampler.push(samples, ec);

  double factor = static_cast<double>(dstSampleRate) / srcSampleRate;

  av::AudioSamples out(sampleFormat, numSamplesPerChannel * factor, channelLayout, dstSampleRate);
  bool hasFrame = resampler.pop(out, true, ec);

  auto n = out.samplesCount();
  if (hasFrame && n > 0)
  {
    io.samples[0].resize(n);
    io.samples[1].resize(n);
    auto* outDataL = reinterpret_cast<float*>(out.data());
    auto* outDataR = reinterpret_cast<float*>(out.data(1));
    for (size_t i = 0; i < n; ++i)
    {
      io.samples[0][i] = outDataL[i];
      io.samples[1][i] = outDataR[i];
    }
  }
}

bool processAudioDecodeEncodeWithInput(
  av::FormatContext& ictx, 
  OutputType out,
  unsigned int sampleRate, 
  av::AudioDecoderContext& adec,
  ssize_t audioStream
)
{
  using namespace std;
  using namespace av;

  std::error_code ec;
  int count = 0;

  OutputFormat  ofmt;
  FormatContext octx;

  ofmt = av::guessOutputFormat(out.filename, out.filename);
  // clog << "Ffmpeg::detail::processAudioDecodeEncodeWithInput Output format: " << ofmt.name() << " / " << ofmt.longName() << '\n';
  octx.setFormat(ofmt);

  Codec ocodec = av::findEncodingCodec(ofmt, false);
  AudioEncoderContext enc (ocodec);

  // clog << ocodec.name() << " / " << ocodec.longName() << ", audio: " << (ocodec.type()==AVMEDIA_TYPE_AUDIO) << '\n';

  auto sampleFmts  = ocodec.supportedSampleFormats();
  auto sampleRates = ocodec.supportedSamplerates();
  auto layouts     = ocodec.supportedChannelLayouts();

  /*
  clog << "Ffmpeg::detail::processAudioDecodeEncodeWithInput Supported sample formats:\n";
  for (const auto &fmt : sampleFmts) 
  {
      clog << "  " << av_get_sample_fmt_name(fmt) << '\n';
  }

  clog << "Ffmpeg::detail::processAudioDecodeEncodeWithInput Supported sample rates:\n";
  for (const auto &rate : sampleRates) 
  {
      clog << "  " << rate << '\n';
  }
  */

  //clog << "Ffmpeg::detail::processAudioDecodeEncodeWithInput Supported sample layouts:\n";
  for (const auto &lay : layouts) 
  {
      char buf[128] = {0};
      // FIXME: Add AVChannelLayout API
#if API_NEW_CHANNEL_LAYOUT
      AVChannelLayout layout{};
      av_channel_layout_from_mask(&layout, lay);
      av_channel_layout_describe(&layout, buf, sizeof(buf));
#else
      av_get_channel_layout_string(buf,
                                    sizeof(buf),
                                    av_get_channel_layout_nb_channels(lay),
                                    lay);
#endif

      // clog << "  " << buf << '\n';
  }

  //return 0;


  // Settings
#if 1
  enc.setSampleRate(sampleRate);
  enc.setSampleFormat(sampleFmts[0]);
  // Layout
  //enc.setChannelLayout(adec.channelLayout());
  enc.setChannelLayout(AV_CH_LAYOUT_STEREO);
  //enc.setChannelLayout(AV_CH_LAYOUT_MONO);
  enc.setTimeBase(Rational(1, enc.sampleRate()));
  enc.setBitRate(adec.bitRate());
#else
  enc.setSampleRate(adec.sampleRate());
  enc.setSampleFormat(adec.sampleFormat());
  enc.setChannelLayout(adec.channelLayout());
  enc.setTimeBase(adec.timeBase());
  enc.setBitRate(adec.bitRate());
#endif

  enc.open(ec);
  if (ec) 
  {
      cerr << "Ffmpeg::detail::processAudioDecodeEncodeWithInput Can't open encoder\n";
      return false;
  }

  Stream ost = octx.addStream(enc);
  if (out.memoryIO)
  {
    size_t bufferSize = 1024 * 1024; // 1MB default buffer size
    octx.openOutput(out.memoryIO.get(), ec, bufferSize);
  } else 
  {
    octx.openOutput(out.filename, ec);
  }
  if (ec) 
  {
      cerr << "Ffmpeg::detail::processAudioDecodeEncodeWithInput Can't open output\n";
      return false;
  }

  // clog << "Ffmpeg::detail::processAudioDecodeEncodeWithInput Encoder frame size: " << enc.frameSize() << '\n';

  octx.dump();
  octx.writeHeader();
  octx.flush();

  //
  // RESAMPLER
  //
  AudioResampler resampler(enc.channelLayout(),  enc.sampleRate(),  enc.sampleFormat(),
                            adec.channelLayout(), adec.sampleRate(), adec.sampleFormat());

  //
  // PROCESS
  //
  while (true) 
  {
      Packet pkt = ictx.readPacket(ec);
      if (ec)
      {
          // clog << "Ffmpeg::detail::processAudioDecodeEncodeWithInput Packet reading error: " << ec << ", " << ec.message() << endl;
          break;
      }

      if (pkt && pkt.streamIndex() != audioStream) 
      {
          continue;
      }

      // clog << "Ffmpeg::detail::processAudioDecodeEncodeWithInput Read packet: isNull=" << (bool)!pkt << ", " << pkt.pts() << "(nopts:" << pkt.pts().isNoPts() << ")" << " / " << pkt.pts().seconds() << " / " << pkt.timeBase() << " / st: " << pkt.streamIndex() << endl;
#if 0
      if (pkt.pts() == av::NoPts && pkt.timeBase() == Rational())
      {
          clog << "Skip invalid timestamp packet: data=" << (void*)pkt.data()
                << ", size=" << pkt.size()
                << ", flags=" << pkt.flags() << " (corrupt:" << (pkt.flags() & AV_PKT_FLAG_CORRUPT) << ";key:" << (pkt.flags() & AV_PKT_FLAG_KEY) << ")"
                << ", side_data=" << (void*)pkt.raw()->side_data
                << ", side_data_count=" << pkt.raw()->side_data_elems
                << endl;
          //continue;
      }
#endif

      auto samples = adec.decode(pkt, ec);
      count++;
      //if (count > 200)
      //    break;

      if (ec) 
      {
          cerr << "Ffmpeg::detail::processAudioDecodeEncodeWithInput Decode error: " << ec << ", " << ec.message() << endl;
          return false;
      } 
      else if (!samples) 
      {
          cerr << "Ffmpeg::detail::processAudioDecodeEncodeWithInput Empty samples set\n";

          //if (!pkt) // decoder flushed here
          //   break;
          //continue;
      }
/*
      clog << "  Samples [in]: " << samples.samplesCount()
            << ", ch: " << samples.channelsCount()
            << ", freq: " << samples.sampleRate()
            << ", name: " << samples.channelsLayoutString()
            << ", pts: " << samples.pts().seconds()
            << ", ref=" << samples.isReferenced() << ":" << samples.refCount()
            << endl;
*/

      // Empty samples set should not be pushed to the resampler, but it is valid case for the
      // end of reading: during samples empty, some cached data can be stored at the resampler
      // internal buffer, so we should consume it.
      if (samples)
      {
          resampler.push(samples, ec);
          if (ec) {
              // clog << "Ffmpeg::detail::processAudioDecodeEncodeWithInput Resampler push error: " << ec << ", text: " << ec.message() << endl;
              continue;
          }
      }

      // Pop resampler data
      bool getAll = !samples;
      while (true) 
      {
          AudioSamples ouSamples(enc.sampleFormat(),
                                  enc.frameSize(),
                                  enc.channelLayout(),
                                  enc.sampleRate());

          // Resample:
          bool hasFrame = resampler.pop(ouSamples, getAll, ec);
          if (ec) 
          {
              cerr << "Ffmpeg::detail::processAudioDecodeEncodeWithInput Resampling status: " << ec << ", text: " << ec.message() << endl;
              break;
          } 
          else if (!hasFrame) 
          {
              break;
          } 
          /*else 
          {
            clog << "  Samples [ou]: " << ouSamples.samplesCount()
                    << ", ch: " << ouSamples.channelsCount()
                    << ", freq: " << ouSamples.sampleRate()
                    << ", name: " << ouSamples.channelsLayoutString()
                    << ", pts: " << ouSamples.pts().seconds()
                    << ", ref=" << ouSamples.isReferenced() << ":" << ouSamples.refCount()
                    << endl;
          }
        */  

          // ENCODE
          ouSamples.setStreamIndex(0);
          ouSamples.setTimeBase(enc.timeBase());

          Packet opkt = enc.encode(ouSamples, ec);
          if (ec) 
          {
              cerr << "Ffmpeg::detail::processAudioDecodeEncodeWithInput Encoding error: " << ec << ", " << ec.message() << endl;
              return false;
          } 
          else if (!opkt) 
          {
              //cerr << "Empty packet\n";
              continue;
          }

          opkt.setStreamIndex(0);

          // clog << "Write packet: pts=" << opkt.pts() << ", dts=" << opkt.dts() << " / " << opkt.pts().seconds() << " / " << opkt.timeBase() << " / st: " << opkt.streamIndex() << endl;

          octx.writePacket(opkt, ec);
          if (ec) 
          {
              cerr << "Error write packet: " << ec << ", " << ec.message() << endl;
              return false;
          }
      }

      // For the first packets samples can be empty: decoder caching
      if (!pkt && !samples)
      {
        break;
      }  
  }

  //
  // Is resampler flushed?
  //
  //cerr << "Ffmpeg::detail::processAudioDecodeEncodeWithInput Delay: " << resampler.delay() << endl;

  //
  // Flush encoder queue
  //
  //clog << "Ffmpeg::detail::processAudioDecodeEncodeWithInput Flush encoder:\n";
  while (true) 
  {
      AudioSamples null(nullptr);
      Packet        opkt = enc.encode(null, ec);
      if (ec || !opkt)
      {
        break;
      }

      opkt.setStreamIndex(0);

      // clog << "Ffmpeg::detail::processAudioDecodeEncodeWithInput Write packet: pts=" << opkt.pts() << ", dts=" << opkt.dts() << " / " << opkt.pts().seconds() << " / " << opkt.timeBase() << " / st: " << opkt.streamIndex() << endl;

      octx.writePacket(opkt, ec);
      if (ec) 
      {
          cerr << "Ffmpeg::detail::processAudioDecodeEncodeWithInput Error write packet: " << ec << ", " << ec.message() << endl;
          return false;
      }

  }

  octx.flush();
  octx.writeTrailer();
  return true;
}

// ----- OGG support -----

const int SAMPLE_RATE = 48000;
const int CHANNELS = 1;
const AVSampleFormat SAMPLE_FMT = AV_SAMPLE_FMT_FLT;
//const int BLOCK_MS = 500;               // chunk duration in ms
//const int BLOCK_SAMPLES = SAMPLE_RATE * BLOCK_MS / 1000; // 24000 samples

// Generate a sine wave chunk of duration BLOCK_MS in milliseconds
/*void generate_sine_wave_chunk(std::vector<float>& buffer, float freq, int chunk_index) 
{
    buffer.resize(BLOCK_SAMPLES);
    int start_sample = chunk_index * BLOCK_SAMPLES;
    for (int i = 0; i < BLOCK_SAMPLES; ++i)
    {
        float t = float(start_sample + i) / SAMPLE_RATE;
        buffer[i] = 0.5f * std::sin(2.0f * M_PI * freq * t);
    }
}
*/

/*
class MemoryOutput 
{
public:
  std::vector<uint8_t> buffer;

  static int write_packet(void* opaque, const uint8_t* buf, int buf_size) 
  {
    MemoryOutput* mem_output = static_cast<MemoryOutput*>(opaque);
    mem_output->buffer.insert(mem_output->buffer.end(), buf, buf + buf_size);
    return buf_size;
  }
};
*/

bool convertFloatBufferToOgg(const BinaryData& rawFloatData, OutputType output) 
{
    av_log_set_level(AV_LOG_ERROR);

    AVFormatContext* fmt_ctx = nullptr;
    avformat_alloc_output_context2(&fmt_ctx, nullptr, "ogg", "output.ogg");
    if (!fmt_ctx) 
    {
        std::cerr << "Could not create output context\n";
        return 1;
    }

    const AVCodec* codec = avcodec_find_encoder(AV_CODEC_ID_OPUS);
    if (!codec) 
    {
        std::cerr << "Opus codec not found\n";
        return 1;
    }

    AVStream* stream = avformat_new_stream(fmt_ctx, codec);
    if (!stream) 
    {
        std::cerr << "Failed to create stream\n";
        return 1;
    }

    AVCodecContext* codec_ctx = avcodec_alloc_context3(codec);
    if (!codec_ctx) 
    {
        std::cerr << "Failed to allocate codec context\n";
        return 1;
    }

    codec_ctx->sample_fmt = SAMPLE_FMT;
    codec_ctx->sample_rate = SAMPLE_RATE;
    av_channel_layout_default(&codec_ctx->ch_layout, CHANNELS);
    codec_ctx->bit_rate = 64000;

    stream->time_base = {1, SAMPLE_RATE};
    codec_ctx->time_base = stream->time_base;

    if (fmt_ctx->oformat->flags & AVFMT_GLOBALHEADER)
    {
        codec_ctx->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;
    }
        
    if (avcodec_open2(codec_ctx, codec, nullptr) < 0) 
    {
        std::cerr << "Could not open codec\n";
        return 1;
    }

    if (avcodec_parameters_from_context(stream->codecpar, codec_ctx) < 0) 
    {
        std::cerr << "Failed to copy codec parameters\n";
        return 1;
    }
    
    auto writeToFile = !output.memoryIO;
    if (writeToFile)
    {
      if (!(fmt_ctx->oformat->flags & AVFMT_NOFILE)) 
      {
          if (avio_open(&fmt_ctx->pb, "output.ogg", AVIO_FLAG_WRITE) < 0)
           {
              std::cerr << "Could not open output file\n";
              return 1;
          }
      }
    }
    else 
    {
      auto& memory_output = *output.memoryIO; 
      unsigned char* io_buffer = static_cast<unsigned char*>(av_malloc(4096));
      AVIOContext* avio_ctx = avio_alloc_context(io_buffer, 4096, 1, &memory_output, nullptr, MemoryIO::write_packet, nullptr);
      if (!avio_ctx) 
      {
        std::cerr << "Could not allocate AVIOContext\n";
        return 1;
      }
      fmt_ctx->pb = avio_ctx;
      fmt_ctx->flags |= AVFMT_FLAG_CUSTOM_IO;
    }

    if (avformat_write_header(fmt_ctx, nullptr) < 0) 
    {
        std::cerr << "Error writing header\n";
        return 1;
    }

    int64_t pts = 0;
    const int frame_size = codec_ctx->frame_size; // Opus frame size, usually 960

    const float* buffer = reinterpret_cast<const float*>(rawFloatData.data());
    const int BLOCK_SAMPLES = static_cast<int>(rawFloatData.size() / sizeof(float));
    const int NUM_CHUNKS = std::ceil(BLOCK_SAMPLES / (float)frame_size);
    for (int chunk_idx = 0; chunk_idx < NUM_CHUNKS; ++chunk_idx) 
    {
        //std::vector<float> buffer;
        //generate_sine_wave_chunk(buffer, 440.0f, chunk_idx);

        int offset = 0;
        while (offset < BLOCK_SAMPLES) 
        {
            int current_size = std::min(frame_size, BLOCK_SAMPLES - offset);

            AVFrame* frame = av_frame_alloc();
            frame->nb_samples = current_size;
            frame->format = codec_ctx->sample_fmt;
            av_channel_layout_copy(&frame->ch_layout, &codec_ctx->ch_layout);
            frame->sample_rate = codec_ctx->sample_rate;

            if (av_frame_get_buffer(frame, 0) < 0) 
            {
                std::cerr << "Error allocating frame buffer\n";
                av_frame_free(&frame);
                break;
            }
            av_frame_make_writable(frame);

            memcpy(frame->data[0], buffer + offset, current_size * sizeof(float));
            frame->pts = pts;
            pts += current_size;

            if (avcodec_send_frame(codec_ctx, frame) < 0)
            {
                std::cerr << "Error sending frame\n";
            }

            AVPacket* pkt = av_packet_alloc();
            while (avcodec_receive_packet(codec_ctx, pkt) == 0) 
            {
                pkt->stream_index = stream->index;
                if (av_interleaved_write_frame(fmt_ctx, pkt) < 0) 
                {
                    std::cerr << "Error writing packet\n";
                }
                av_packet_unref(pkt);
            }
            av_packet_free(&pkt);
            av_channel_layout_uninit(&frame->ch_layout);
            av_frame_free(&frame);

            offset += current_size;
        }
    }

    // Flush encoder
    avcodec_send_frame(codec_ctx, nullptr);
    AVPacket* pkt = av_packet_alloc();
    while (avcodec_receive_packet(codec_ctx, pkt) == 0) 
    {
        pkt->stream_index = stream->index;
        if (av_interleaved_write_frame(fmt_ctx, pkt) < 0) 
        {
            std::cerr << "Error writing packet\n";
        }
        av_packet_unref(pkt);
    }
    av_packet_free(&pkt);

    av_write_trailer(fmt_ctx);

    avcodec_free_context(&codec_ctx);

    if (writeToFile) 
    {
        if (!(fmt_ctx->oformat->flags & AVFMT_NOFILE)) 
        {
            avio_closep(&fmt_ctx->pb);
        }
        std::cout << "Wrote output.ogg\n";
    } 
    else 
    {
        MemoryIO* mem_output = static_cast<MemoryIO*>(fmt_ctx->pb->opaque);
        std::cout << "Encoded data size: " << mem_output->dataBuffer().size() << " bytes\n";
    }
  
    avformat_free_context(fmt_ctx);
    return true;
}


} // namespace detail

} // namespace hkp
