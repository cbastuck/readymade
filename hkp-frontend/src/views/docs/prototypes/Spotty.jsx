import Template from "../../Template";

import { Section, Text, Paragraph } from "../Elements";
import NavigateButton from "../../NavigateButton";
import Date from "../../../components/Date";

export default function Spotty() {
  return (
    <Template title="Spotty" isRoot={true}>
      <div style={{ margin: "40px 0px" }}>
        <Text>
          <Section title="Store Spotify favorites on Github">
            <Paragraph brief="Motivation">
              Over the time I discovered many songs on Spotify and added them as
              favorites. What if all, or some of them would disappear from one
              day to the other? Maybe due to an accident or updated terms
              between Spotify and smaller labels? I might notice it a lot later.
              Compared to the bands I know from my youth, artists that appeared
              for me on Spotify first take longer to find their place in my
              mind. Mostly I start recognizing artist names and give more
              attention after a second or third song was added to my favorites.
              More due diligence does not hurt for stuff that truly matters,
              such as good music.
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
                . During the login you're presented the rights that you pass to
                the board on the playground and in particular the Spotify
                service: user-library-read, playlist-read-private,
                user-read-recently-played. The following communication is solely
                between Spotify and your Browser (client). No remote resources
                (hookup resources) are involved in this process or aware of the
                data exchanged.
              </Paragraph>
              <Paragraph brief="2 - 3. Map and Monitor">
                The Map module extracts the relevant data from the stream of
                received song resources. For debugging the mapped data is going
                through a Monitor.
              </Paragraph>
              <Paragraph brief="4. Github Sink">
                The module commits incomgin data to an existing git repository
                as specified after login. Github's Auth API{" "}
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
                </a>
                {"  flow,  "}
                which in general is a good thing. But at this point I avoid
                remote services as much as possible on public prototypes. But
                such service would be required for using this authentication
                flow. So you need to create and use a{" "}
                <a
                  href="https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token"
                  target="_blank"
                  rel="noreferrer"
                >
                  private access token
                </a>{" "}
                to grant access to the board. You're in control of that token.
                It is not used in any communication to hookup services.
              </Paragraph>
              <Paragraph brief="Second runtime">
                The second runtime exists for testing the first runtime.
                Authorization for the Github Source service is identical to the
                sink service. After Login select a public repository and file to
                be retrieved. The subesequent Montitor displays the data flowing
                through.
              </Paragraph>

              <NavigateButton
                width="100%"
                destination="/playground/spotty?template=/boards/protos/spotty.json"
                text="Show it on Playground"
              />
            </Paragraph>
          </Section>
          <Date month="July" day="24" year="2022" />
        </Text>
      </div>
    </Template>
  );
}
