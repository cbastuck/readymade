import Template from "../../Template";

import { Section, Text, Paragraph } from "../Elements";
import NavigateButton from "../../NavigateButton";

export default function Spotty() {
  return (
    <Template title="Spotty" parent="prototypes">
      <div style={{ margin: "40px 0px" }}>
        <Text>
          <Section title="Store favorites from Spotify on Github">
            <Paragraph brief="Motivation">
              Over the time I discovered a large number of songs on Spotify and
              added them there as favorites. What if all, or some of them would
              disappear from one day to the other? Maybe due to an accident or
              updated terms between Spotify and some smaller labels? Maybe I
              wouldn't notice, or too late. Compared to the bands I know from
              youth, artists that appeared for me first on Spotify since the
              streaming days, take longer to find their place in my mind. Mostly
              I start recognizing their names and pay more attention after a
              second or third song was liked and thus added to my favorites.
              More due diligence would not hurt for stuff that matters, such as
              good music.
            </Paragraph>
            <Paragraph brief="First runtime - service sequence">
              <Paragraph brief="1. Spotify">
                The first module connects to Spotify, first you need to login
                with your credentials using{" "}
                <a
                  href="https://developer.spotify.com/documentation/general/guides/authorization/implicit-grant/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Spotify's implicit OAuth flow
                </a>
                . During the login you're made aware of the rights that you pass
                to the board on the playground, and in particular the Spotify
                service: user-library-read, playlist-read-private,
                user-read-recently-played. The communication is solely between
                Spotify and your Browser (client). No hookup resources (server)
                are involved in this process or aware of the data exchanged.
              </Paragraph>
              <Paragraph brief="2 - 3. Map and Monitor">
                The Map module extracts the relevant data from the stream of
                received song resources. For debugging the mapped data is going
                through a Monitor.
              </Paragraph>
              <Paragraph brief="4. Github Sink">
                Data going into this module commits the incoming data to a git
                repository as specified after login. Github Auth API{" "}
                <a
                  href="https://datatracker.ietf.org/doc/html/rfc6749#section-1.3.2"
                  target="_blank"
                  rel="noreferrer"
                >
                  does not support the implicit OAuth flow
                </a>
                , and instead requires the{" "}
                <a
                  href="https://datatracker.ietf.org/doc/html/rfc6749#section-1.3.1"
                  target="_blank"
                  rel="noreferrer"
                >
                  Authorization Code
                </a>{" "}
                which is a good thing, but for simplicity at this stage of the
                hookup project I avoid remote services as much as possible on
                public prototypes flow. But you can create and use a{" "}
                <a
                  href="https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token"
                  target="_blank"
                  rel="noreferrer"
                >
                  private access token
                </a>{" "}
                to grant the board access to your account and public
                repositories. You're in control of that token, again it's not
                used in any communication to hookup services.
              </Paragraph>
              <Paragraph brief="Second runtime">
                The second runtime was added for testing whether the first
                runtime worked as expected. Authorization for the Github Source
                service is identical to the sink service mentioned above. After
                Login select a public repository and file to be retrieved. Its
                content is printed as data flows through the Monitor service.
              </Paragraph>
              <NavigateButton
                destination="/playground/spotty?template=/boards/protos/spotty.json"
                text="Show on Playground"
              />
            </Paragraph>
          </Section>
        </Text>
      </div>
    </Template>
  );
}
