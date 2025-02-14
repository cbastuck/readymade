#pragma once

#include <string>
#include <unordered_map>

#include <saucer/webview.hpp>

#include "assets/index-kMyAg1Lz.js.hpp"
#include "assets/index-n_ryQ3BS.css.hpp"
#include "index.html.hpp"
#include "vite.svg.hpp"

namespace saucer::embedded
{
    inline auto all()
    {
        std::unordered_map<std::string, embedded_file> rtn;

        rtn.emplace("assets/index-kMyAg1Lz.js", embedded_file{saucer::stash<>::view(f9TaEeOwraPTSuvkbjqw91aoem8yJctAKKrw4xlzrNQtCslNo8B7F6wt4tfGrke1fDt2hKFrZuYYAVXTLUPKPT147W29s73kFUiHakHIp2doG0MrzSf4pNQ96Oifbv), "application/javascript"});
        rtn.emplace("assets/index-n_ryQ3BS.css", embedded_file{saucer::stash<>::view(fd89cUp13GLBfP4SRpKa5Ga1AMn332ZmdyAhoUoBQOl1xC7eIzltuOh9QDqPdwbGsDLH8tdVEHWf5OEDAjYaH9oP12GulR9Sxyoqdj5RikuNW5WSAOaWQqqEAyevhfX), "text/css"});
        rtn.emplace("index.html", embedded_file{saucer::stash<>::view(fKjjpU5YBdCG2WQsw55q3gdHG03uQmi95nSqxswmj1yoOJos3gJQ5ziONoTZmSme5qtBDQdMhNIenMvyqAg023P6ZKwMe6P8YpUzrJQiPcq), "text/html"});
        rtn.emplace("vite.svg", embedded_file{saucer::stash<>::view(f1DPiK69V6deZjX6cTCXslD45ySyNyp2bdixng8PbG3eXxhAQ7aqUWBZinDJUfOlozQWW31enrPvBdydEXYxB5rqC3u1vQVHOW9OpUPdH), "image/svg+xml"});

        return rtn;
    }
} // namespace saucer::embedded
