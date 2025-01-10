import { capitaliseHeadline } from ".";
import { CarouselItem } from "..";

const headline = "commit your favorite songs from Spotify to Github";

const boardUrl = `/playground/midi-controller?fromLink=N4KABGBEBOCuB2AXAlgWwKYGdIC4wG1wIxRjjJkATXKANgEN6AGAZiYE4BWAWgEYBjAdwAs6dAA5u7XgCYARtwBm-Fi04y1tdMN6QANETKR49DDUgAlBCgx99h8ogCeAB3Tm50APYB3TOmh7MghITER6RHc8UmCQn2h6FwBlAIA3ZH4sGkQ4dAcIAF8HIogAXQMQ-2h0zOxoh0gGZjYuPkF+ETFJaXklFTUNTi0dGkJYmNjIWFgqc3YWSlp+OVpKbnoAdjYRSnZFbnF+YX3+fkUWehlaOXZ0DfYg2KgqmvQASWo8SAALLy8Aa1gLgAdIgvAB6F4ZdCQlxeFCKJyPSZQzIAOVMUSgSThCKRFSekDkXno0E+UEo6Bc0HQ-Ai6EoYGJpMoJgwYG4YAA5uhEGBkHzFN5UGBEi5kcFIGD-uh4OZIPkwAUCWQJpLprMvuwjsJhFcWNwWHI5LwRFx6AdxLwmNwbitzipxExOEwJUZUe9yT8-oCQWDIWloeDUIk3eQPRizF8ALKhlWS1BeSnmGkuAA29EyYZCkVQ6fpNDVkxQiDT6AAvOYXKTTJhQQl+P9gWz3PHJqSUGFK19qwlUHWcpmmx3kGFMPgmKVm5js+RKPTu1AaYovNAQ4gACL0gAUvdrwPolEplAA+hE9GAEJTFMh4AyLwByACaL6f4Oj0YfAEoFU8lW3yDkVx6EwOowEUeg038RVlUVItyA1L0mHEThhC2cRJFoJhKB4HQ0KkSl0G4GROBw+h0DUOQNg2cRZ1CQNMg+cxfgBIFQQhD1gy8eABVXOiIxnGNuN4wIAJCZkyXMSlqVpelGQk1lMQ5bleX5QVhVFFxxTEqA0y8LkABUvAAYW4zAvDLGgIKgvJYlg8ZFRCRDzHoWh2DcxQmA2bhOAo7y0MUYQpE4XhugEdB6F4dgSKWYR+IYz1mJ9Nj-U4rkBW+WAFEwW9-ni6poUjLFIAAcQyrKwCSXK6OlWV5R0olgNAqzIOguyHFKIh7OeKhaW+ehbwsLxYBQeAuULbrIGGxAXBGoaRtvcbokm29ZsQebRqWkhJspTB+GgZAXBQbj6qISBM0yI6GSSJx4H4FJ4EpaAwPwcozppAArWlIkoG67oep6Xs6gogA`;

export const spotify2Github: CarouselItem = {
  boardUrl,
  videoUrl: "/assets/teaser/SpotifyGithub-cut.mp4",
  scale: "56%",
  headline,
  title: `Sample 5: ${capitaliseHeadline(headline)}`,
  description: (
    <div className="flex flex-col gap-4">
      <div>
        Over the time I discovered many songs on Spotify and added them to my
        favorites. What if some of them would disappear from one day to the
        other? Maybe due to an accident or updated terms between Spotify and
        smaller labels? I might notice it much later or don't remember a
        particular missing song at all.
      </div>
      <div>
        This board creates a backup of your favorite songs on Spotify and adds
        them as a new commit to an existing Github repository.
      </div>
    </div>
  ),
  action: {
    title: "Open in Playground",
    onClick: {
      url: boardUrl,
    },
  },
  createdAt: "Nov 12, 2021",
};
