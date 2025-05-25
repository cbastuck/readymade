#include "./ffmpeg.h"

#include <iostream>
#include <set>
#include <map>
#include <memory>
#include <functional>
#include <filesystem>

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

class MemoryIO : public av::CustomIO {
public:
    MemoryIO(const uint8_t* data, size_t buf_size)
        : m_data(data)
        , m_size(buf_size)
        , m_pos(0) 
    {
    }

    int read(uint8_t *data, size_t buf_size) override 
    {
        if (m_pos >= m_size)
        {
          return AVERROR_EOF;
        }
            
        int toRead = std::min(buf_size, static_cast<size_t>(m_size - m_pos));
        memcpy(data, m_data + m_pos, toRead);
        m_pos += toRead;
        return toRead;
    }

    int64_t seek(int64_t offset, int whence) override 
    {
        switch (whence) {
            case SEEK_SET:
                m_pos = offset;
                break;
            case SEEK_CUR:
                m_pos += offset;
                break;
            case SEEK_END:
                m_pos = m_size + offset;
                break;
            default:
                return -1;
        }
        if (m_pos < 0 || m_pos > m_size)
        {
          return -1;
        }
            
        return m_pos;
    }

private:
    const uint8_t* m_data;
    size_t m_size;
    size_t m_pos;
};


Ffmpeg::Ffmpeg(const std::string& instanceId)
    : hkp::Service(instanceId, serviceId())
    , m_targetSampleRate(-1)
{
}

json Ffmpeg::configure(Data data)
{
  auto buf = getJSONFromData(data);
  if (buf)
  {
    updateIfNeeded(m_outputFolder, (*buf)["outputFolder"]);
    updateIfNeeded(m_targetSampleRate, (*buf)["targetSampleRate"]);
  }

  return Service::configure(data);
}

std::string Ffmpeg::getServiceId() const
{
  return serviceId();
}

json Ffmpeg::getState() const
{
  return Service::mergeStateWith({
    {"outputFolder", m_outputFolder},
  });
}

Data Ffmpeg::process(Data data)
{
  auto j = getJSONFromData(data);
  if (!j)
  {
    auto custom = getCustomDataFromData(data);
    if (custom && std::string(custom->type) == "murea/AudioData" && custom->data)
    {
      if (m_targetSampleRate == -1)
      {
        std::cerr << "Ffmpeg service: target sample rate not set, cannot resample." << std::endl;
        return Null(); 
      }
      auto buffer = static_cast<AudioData*>(custom->data);
      resampleBuffer(*buffer, m_targetSampleRate);
    }
    return data;
  }
  std::string input = (*j)["input"];
  std::string output = (*j)["output"];
  unsigned int sampleRate = j->contains("sampleRate") ? (*j)["sampleRate"].get<unsigned int>() : 48000;
  auto outPath = (std::filesystem::path(m_outputFolder) / output).string(); 
  // check if output already exists;
  if (std::filesystem::exists(outPath))
  {
    std::cout << "Ffmpeg service: output file already exists: " << outPath << std::endl;
    return json{{ "output", outPath }};
  }
  
  
  return processAudioDecodeEncode(input, outPath, sampleRate) ?
    json{{ "output", outPath }} :
    json{{ "error", "Failed to process audio" }};
}

bool Ffmpeg::processAudioDecodeEncode(const std::string& input, const std::string& out, unsigned int sampleRate)
{
  using namespace std;
  using namespace av;

  av::init();
  av::setFFmpegLoggingLevel(AV_LOG_TRACE);

  ssize_t      audioStream = -1;
  AudioDecoderContext adec;
  Stream       ast;
  error_code   ec;

  int count = 0;

  {
    //
    // INPUT
    //
    FormatContext ictx;

    ictx.openInput(input, ec);
    if (ec) {
        cerr << "Can't open input\n";
        return false;
    }

    ictx.findStreamInfo();

    for (size_t i = 0; i < ictx.streamsCount(); ++i) {
        auto st = ictx.stream(i);
        if (st.isAudio()) {
            audioStream = i;
            ast = st;
            break;
        }
    }

    cerr << audioStream << endl;

    if (ast.isNull()) {
        cerr << "Audio stream not found\n";
        return false;
    }

    if (ast.isValid()) {
      adec = AudioDecoderContext(ast);

      //Codec codec = findDecodingCodec(adec.raw()->codec_id);

      //adec.setCodec(codec);
      //adec.setRefCountedFrames(true);

      adec.open(ec);

      if (ec) {
          cerr << "Can't open codec\n";
          return false;
      }
    }

      //
      // OUTPUT
      //
      OutputFormat  ofmt;
      FormatContext octx;

      ofmt = av::guessOutputFormat(out, out);
      clog << "Output format: " << ofmt.name() << " / " << ofmt.longName() << '\n';
      octx.setFormat(ofmt);

      Codec ocodec = av::findEncodingCodec(ofmt, false);
      AudioEncoderContext enc (ocodec);

      clog << ocodec.name() << " / " << ocodec.longName() << ", audio: " << (ocodec.type()==AVMEDIA_TYPE_AUDIO) << '\n';

      auto sampleFmts  = ocodec.supportedSampleFormats();
      auto sampleRates = ocodec.supportedSamplerates();
      auto layouts     = ocodec.supportedChannelLayouts();

      clog << "Supported sample formats:\n";
      for (const auto &fmt : sampleFmts) {
          clog << "  " << av_get_sample_fmt_name(fmt) << '\n';
      }

      clog << "Supported sample rates:\n";
      for (const auto &rate : sampleRates) {
          clog << "  " << rate << '\n';
      }

      clog << "Supported sample layouts:\n";
      for (const auto &lay : layouts) {
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

          clog << "  " << buf << '\n';
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
      if (ec) {
          cerr << "Can't open encoder\n";
          return false;
      }

      Stream ost = octx.addStream(enc);
      octx.openOutput(out, ec);
      if (ec) {
          cerr << "Can't open output\n";
          return false;
      }

      clog << "Encoder frame size: " << enc.frameSize() << '\n';

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
      while (true) {
          Packet pkt = ictx.readPacket(ec);
          if (ec)
          {
              clog << "Packet reading error: " << ec << ", " << ec.message() << endl;
              break;
          }

          if (pkt && pkt.streamIndex() != audioStream) {
              continue;
          }

          clog << "Read packet: isNull=" << (bool)!pkt << ", " << pkt.pts() << "(nopts:" << pkt.pts().isNoPts() << ")" << " / " << pkt.pts().seconds() << " / " << pkt.timeBase() << " / st: " << pkt.streamIndex() << endl;
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

          if (ec) {
              cerr << "Decode error: " << ec << ", " << ec.message() << endl;
              return false;
          } else if (!samples) {
              cerr << "Empty samples set\n";

              //if (!pkt) // decoder flushed here
              //   break;
              //continue;
          }

          clog << "  Samples [in]: " << samples.samplesCount()
                << ", ch: " << samples.channelsCount()
                << ", freq: " << samples.sampleRate()
                << ", name: " << samples.channelsLayoutString()
                << ", pts: " << samples.pts().seconds()
                << ", ref=" << samples.isReferenced() << ":" << samples.refCount()
                << endl;

          // Empty samples set should not be pushed to the resampler, but it is valid case for the
          // end of reading: during samples empty, some cached data can be stored at the resampler
          // internal buffer, so we should consume it.
          if (samples)
          {
              resampler.push(samples, ec);
              if (ec) {
                  clog << "Resampler push error: " << ec << ", text: " << ec.message() << endl;
                  continue;
              }
          }

          // Pop resampler data
          bool getAll = !samples;
          while (true) {
              AudioSamples ouSamples(enc.sampleFormat(),
                                      enc.frameSize(),
                                      enc.channelLayout(),
                                      enc.sampleRate());

              // Resample:
              bool hasFrame = resampler.pop(ouSamples, getAll, ec);
              if (ec) {
                  clog << "Resampling status: " << ec << ", text: " << ec.message() << endl;
                  break;
              } else if (!hasFrame) {
                  break;
              } else
                  clog << "  Samples [ou]: " << ouSamples.samplesCount()
                        << ", ch: " << ouSamples.channelsCount()
                        << ", freq: " << ouSamples.sampleRate()
                        << ", name: " << ouSamples.channelsLayoutString()
                        << ", pts: " << ouSamples.pts().seconds()
                        << ", ref=" << ouSamples.isReferenced() << ":" << ouSamples.refCount()
                        << endl;

              // ENCODE
              ouSamples.setStreamIndex(0);
              ouSamples.setTimeBase(enc.timeBase());

              Packet opkt = enc.encode(ouSamples, ec);
              if (ec) {
                  cerr << "Encoding error: " << ec << ", " << ec.message() << endl;
                  return false;
              } else if (!opkt) {
                  //cerr << "Empty packet\n";
                  continue;
              }

              opkt.setStreamIndex(0);

              clog << "Write packet: pts=" << opkt.pts() << ", dts=" << opkt.dts() << " / " << opkt.pts().seconds() << " / " << opkt.timeBase() << " / st: " << opkt.streamIndex() << endl;

              octx.writePacket(opkt, ec);
              if (ec) {
                  cerr << "Error write packet: " << ec << ", " << ec.message() << endl;
                  return false;
              }
          }

          // For the first packets samples can be empty: decoder caching
          if (!pkt && !samples)
              break;
      }

      //
      // Is resampler flushed?
      //
      cerr << "Delay: " << resampler.delay() << endl;

      //
      // Flush encoder queue
      //
      clog << "Flush encoder:\n";
      while (true) {
          AudioSamples null(nullptr);
          Packet        opkt = enc.encode(null, ec);
          if (ec || !opkt)
              break;

          opkt.setStreamIndex(0);

          clog << "Write packet: pts=" << opkt.pts() << ", dts=" << opkt.dts() << " / " << opkt.pts().seconds() << " / " << opkt.timeBase() << " / st: " << opkt.streamIndex() << endl;

          octx.writePacket(opkt, ec);
          if (ec) {
              cerr << "Error write packet: " << ec << ", " << ec.message() << endl;
              return false;
          }

      }

      octx.flush();
      octx.writeTrailer();
  }

  return true;
}

void Ffmpeg::resampleBuffer(AudioData& io, unsigned int dstSampleRate)
{
  std::error_code ec;

  av::SampleFormat sampleFormat("fltp"); // see https://ffmpeg.org/doxygen/trunk/samplefmt_8c.html
  auto& src = io.samples;
  auto srcSampleRate = io.sampleRate;
  auto numChannels = 1;
  unsigned int numSamplesPerChannel = src[0].size();

  av::AudioResampler resampler(
    numChannels, dstSampleRate, sampleFormat,
    numChannels, srcSampleRate, sampleFormat
  );

  auto sizeInBytes = numSamplesPerChannel * numChannels * sizeof(float);
  av::AudioSamples samples(
    reinterpret_cast<uint8_t*>(src[0].data()), sizeInBytes, 
    sampleFormat, numSamplesPerChannel, numChannels, srcSampleRate, 1
  );
  resampler.push(samples, ec);

  av::AudioSamples out(sampleFormat, numSamplesPerChannel, numChannels, dstSampleRate);
  auto getAllSamples = true;
  bool hasFrame = resampler.pop(out, getAllSamples, ec);

  io.samples[0].resize(out.samplesCount());
  io.samples[1].resize(out.samplesCount());
  if (hasFrame && out.samplesCount() > 0)
  {
    auto* outData = reinterpret_cast<float*>(out.data());
    for (size_t i = 0; i < out.samplesCount(); ++i)
    {
      io.samples[0][i] = outData[i];
      io.samples[1][i] = outData[i];
    }
  }
  
}