import React from "react";

import Template from "../../Template";

export default function How() {
  return (
    <Template title="How could it work" isRoot={false}>
      When I started my professional path, I ended up writing one thing multiple
      times. First when I started in the domain of Music Information Retrieval.
      At the institute that published MP3 a few years before we were working on
      algorithms that would allow for content-based music recommendation. Which
      means, computationally solving the phenomenon of music simlilarity as
      perceived by the human. There are too many wrong assumptions in this last
      sentence to enumerate. But the point is, we ended up writing processing
      pipelines and eventually graphs. Connected processing untis that accepted
      mp3 content on their input, extracted features, selected features, trained
      models, validated models, and eventually persisted them for a query
      interface at the frontend. Something similar I already did during studies,
      whe we fed raw volumetric data of a CT scan, that was preprocessed,
      projected, selected, mapped and eventually visualized as slices of
      textures blended over one another. The common pattern made me apply for a
      job at NI where, before I started, I was convinced that every software
      instrument they release, would be a composition of low-level reaktor
      modules on a programming level. I learned that things are different and
      partially I understood why. Still I found it hard to silence the voice
      that was constantly arguing, as soon as you lined up your logic in some
      nice and convenient abstraction everything you do is always the same, and
      more or less lining up the components in a processing pipeline or graph.
      This is basically the how: boxes and arrows for general purpose. Becuase
      if it works for RT audio, it should work for everything else as well,
      right? Well, the thing with complexity and its exponential growth is hard
      to overlook. Still, if you look at it from a naive perspective, it looks
      like it might work, less than 1% of all the other cases. Acknowledging
      that this is already an optimistic best-case scenario estimate, we can
      derive two assumptions from that: 1. it's a lot of fun, trying out what
      work, and how to make parts work nevertheless 2. you might save valuable
      time and continue <a href="https://duckduckgo.com/">somewhere else</a>
    </Template>
  );
}
