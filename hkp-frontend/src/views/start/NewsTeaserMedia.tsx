import { useEffect, useRef } from "react";

import type { NewsItem } from "./types";

type NewsMedia = NonNullable<NewsItem["media"]>;

export default function NewsTeaserMedia({
  media,
  href,
  className = "",
}: {
  media: NewsMedia;
  href?: string;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const setPlaying = (playing: boolean) => {
      if (playing) {
        void video.play().catch(() => {
          // A poster remains visible when a browser declines muted autoplay.
        });
      } else {
        video.pause();
      }
    };

    if (!("IntersectionObserver" in window)) {
      setPlaying(true);
      return () => video.pause();
    }

    const observer = new IntersectionObserver(
      ([entry]) => setPlaying(entry.isIntersecting),
      { threshold: 0.55 },
    );
    observer.observe(video);
    return () => {
      observer.disconnect();
      video.pause();
    };
  }, [media.video]);

  const preview = (
    <video
      ref={videoRef}
      src={media.video}
      poster={media.poster}
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
    />
  );

  if (href) {
    return (
      <a className={`st-news-media ${className}`} href={href} aria-label={media.label}>
        {preview}
      </a>
    );
  }

  return <div className={`st-news-media ${className}`}>{preview}</div>;
}
