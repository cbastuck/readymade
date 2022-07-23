import Template from "../../Template";

import { Section, Text, Paragraph } from "../Elements";
import NavigateButton from "../../NavigateButton";

export default function Spotty() {
  return (
    <Template title="Spotty" parent="prototypes">
      <div style={{ margin: "40px 0px" }}>
        <Text>
          <Section title="Store your favorites from Spotify to your Github">
            <Paragraph brief="Motivation">
              The fear when realizing the amount of songs that by now I
              discovered on Spotify and added as favorites there. What if some
              of them would disappear from day to the next, accidentally or due
              to some updated deals and terms with some labels.? Maybe I
              wouldn't notice, or simply too late. Compared to the bands I know
              from youth, artists that first showed up on Spotify in the
              streaming era take longer to find their place in my mind to be
              remembered. Around the time a second or third song is added from a
              new artist roughly. A bit more due diligence would not hurt for
              stuff that matters as much as for instance good music.
            </Paragraph>
            <Paragraph brief="Seqeuence">
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
