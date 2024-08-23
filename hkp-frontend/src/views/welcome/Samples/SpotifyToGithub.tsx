import { CarouselItem } from "@/ui-components/Carousel";

const headline = "export your favorite song on Spotify to a Github repository";

export const spotify2Github: CarouselItem = {
  videoUrl: "/assets/teaser/SpotifyGithub-cut.mp4",
  scale: "56%",
  headline,
  title: `Sample 5: ${headline}`,
  description: (
    <div className="flex flex-col gap-4">
      <div>Dum dum</div>
    </div>
  ),
  background: "/assets/teaser/blue3.png",
  action: {
    title: "Open in Playground",
    onClick: {
      url: `/playground/midi-controller?fromLink=N4KABGBEBOCuB2AXAlgWwKYGdIC4wG1wIxRjjJkATXKANgEN6AGAZiYE4BWAWgEYBjAdwAs6dAA5u7XgCYARtwBm-Fi04y1tdMN6QANETKR49DDUgAlBCgx99h8ogCeAB3Tm50APYB3TOmh7MghITER6RHc8UmCQn2h6FwBlAIA3ZH4sGkQ4dAcIAF8HIogAXQMQ-2h0zOxoh0gGZjYuPkF+ETFJaXklFTUNTi0dGkJYmNjIWFgqc3YWSlp+OVpKbnoAdjYRSnZFbnF+YX3+fkUWehlaOXZ0DfYg2KgqmvQASWo8SAALLy8Aa1gLgAdIgvAB6F4ZdCQlxeFCKJyPSZQzIAOVMUSgSThCKRFSekDkXno0E+UEo6Bc0HQ-Ai6EoYGJpMoJgwYG4YAA5uhEGBkHzFN5UGBEi5kcFIGD-uh4OZIPkwAUCWQJpLprMvuwjsJhFcWNwWHI5LwRFx6AdxLwmNwbitzipxExOEwJUZUe9yT8-oCQWDIWloeDUIk3eQPRizF8ALKhlWS1BeSnmGkuAA29EyYZCkVQ6fpNDVkxQiDT6AAvOYXKTTJhQQl+P9gWz3PHJqSUGFK19qwlUHWcpmmx3kGFMPgmKVm5js+RKPTu1AaYovNAQ4gACL0gAUvdrwPolEplAA+hE9GAEJTFMh4AyLwByACaL6f4Oj0YfAEoFU8lW3yDkVx6EwOowEUeg038RVlUVItyA1L0mHEThhC2cRJFoJhKB4HQ0KkSl0G4GROBw+h0DUOQNg2cRZ1CQNMg+cxfgBIFQQhD1gy8eABVXOiIxnGNuN4wIAJCZkyXMSlqVpelGQk1lMQ5bleX5QVhVFFxxTEqA0y8LkABUvAAYW4zAvDLGgIKgvJYlg8ZFRCRDzHoWh2DcxQmA2bhOAo7y0MUYQpE4XhugEdB6F4dgSKWYR+IYz1mJ9Nj-U4rkBW+WAFEwW9-ni6poUjLFIAAcQyrKwCSXK6OlWV5R0olgNAqzIOguyHFKIh7OeKhaW+ehbwsLxYBQeAuULbrIGGxAXBGoaRtvcbokm29ZsQebRqWkhJspTB+GgZAXBQbj6qISBM0yI6GSSJx4H4FJ4EpaAwPwcozppAArWlIkoG67oep6Xs6gogA`,
    },
  },
};
