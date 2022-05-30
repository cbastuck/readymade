import React from "react";

import Template from "../../Template";

export default function What() {
  return (
    <Template title="What's the point" isRoot={true}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          height: "100%",
          alignItems: "center",
          alignContent: "center",
        }}
      >
        Explore ways to connect logic with a different mindset, more playful and
        preferably with less code. Focus on ideas and prototypical solutions
        that provide insights and most important lead to follow-up questions.
        Iterate on aspects of centrality, connectivity, authority and scale. In
        particular acknowledge small and indvidual spaces, ie. solutions that
        matter to only a few of us, but maybe for problems relevant to most. The
        more we spread the ability to analyze and decompose patterns around us,
        even using technical terms, the more we set the odds for finding
        apporpriate solutions, ideally before they are needed. In that picture,
        this private project is an imperfect and naive thing in many ways. Sure,
        this is an excuse, but also meant as a disclaimer to set expectations
        towards three chords in contrast to a symphony. This project focuses on
        exploration and little on delivery. It rather tells another story for
        the interested, one that sounds unconventional, comes unpredictable and
        leaves it's audience hopefully more puzzled and curious than before.
        Imperfect solutions help to formulate the right question and identify
        underlying problems. Upscale the number of people finding or
        contributing to unknown solutions, not the machines executing known
        solutions.
      </div>
    </Template>
  );
}
