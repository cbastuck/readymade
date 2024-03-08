import Article from "../../../../components/layout/Article";
import Paragraph from "../../../../components/layout/Paragraph";
import Video from "../../../../components/layout/Video";

export default function Slideshow() {
  return (
    <Article
      slug="slideshow"
      title="Cast photos from the Phone to a Browser on the TV"
      hero=""
      date="28.5.2023"
    >
      <Paragraph>
        Explore the process of building a slideshow experience across devices.
        This demo showcases the coordination between two browser instances,
        where the left side represents a smartphone with, for instance, travel
        photos, and the right side represents a TV browser such as the Silk
        Browser on Fire-TV.
      </Paragraph>

      <Video
        caption="Connecting the phone with the TV browser"
        src="/assets/videos/Slideshow - HD 720p.mov"
      />

      <Paragraph>
        In the forthcoming article, I will delve into and discuss specific
        aspects of tools like Hookup that I consider relevant in the context of
        AI-facilitated human-machine collaboration.
      </Paragraph>
    </Article>
  );
}
