import { Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui-components/primitives/table";

import Text from "@/ui-components/Text";
import NewsItem from "./NewsItem";

import Template from "../../Template";

export default function Updates() {
  return (
    <Template title="What's new">
      <Table className="mt-8">
        <TableHeader>
          <TableRow>
            <TableHead className="font-sans text-xl">Description</TableHead>
            <TableHead className="font-sans text-xl">State</TableHead>
            <TableHead className="font-sans text-xl">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <NewsItem
            date="15.3.2024"
            content={
              <Text>
                Added pages: <a href="/docs">Blog Articles</a> and{" "}
                <a href="/engage">Engage</a>
              </Text>
            }
          />
          <NewsItem
            date="23.2.2024"
            content={
              <Text>
                Introduced the initial concept of BoardService, a service
                designed to encapsulate entire boards, enabling the composition
                of logic through nested boards. Each board serves as a reusable
                building block within any arbitrary pipeline.
              </Text>
            }
          />
          <NewsItem
            date="23.2.2024"
            type="fixed"
            content={
              <Text>
                Peering functionality down
                <div>
                  The introduction of support for remote runtimes led to a
                  breakdown in peering functionality due to infrastructure
                  changes.
                  <div>
                    The issue has been addressed with the deployment of an
                    updated configuration.
                  </div>
                </div>
              </Text>
            }
          />
          <NewsItem
            date="5.2.2024"
            content={<Text>Introduced typewriter style.</Text>}
          />
          <NewsItem
            date="7.1.2024"
            content={
              <Text>Major overhaul and support for remote runtimes.</Text>
            }
          />
          <NewsItem
            date="30.10.2022"
            content={
              <Text>
                <div>
                  <Link to="/docs/tracks/bridge">Bridge </Link>
                  <div>
                    Use a Google spreadsheet as content provider for a simple{" "}
                    <a
                      href={`${window.location.protocol}//bridge.${window.location.hostname}/`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      example
                    </a>{" "}
                    demonstrating the Bridge API.
                  </div>
                </div>
              </Text>
            }
          />
          <NewsItem
            date="24.7.2022"
            content={
              <Text>
                <div>
                  <Link to="/docs/proto/spotty"> Spotty</Link>
                  <div>
                    An early, unplublished, internal prototype. Still, a good
                    example for hooking up with external services.
                  </div>
                </div>
                <div>
                  Added <Link to="/docs/tracks/brand"> single dot symbol</Link>{" "}
                  as favicon and smallest logo version.
                </div>
              </Text>
            }
          />
          <NewsItem
            date="25.6.2022"
            content={
              <Text>
                <Link to="/docs"> Documentation</Link>,{" "}
                <Link to="/docs/tracks/brand">Brand</Link> side-track and merge
                <Link to="/examples"> Examples </Link> with showcases.
              </Text>
            }
          />
          <NewsItem
            date="24.6.2022"
            content={
              <Text>
                <Link to="/docs/scope/what"> What - Why - How </Link> of Hookup.
              </Text>
            }
          />
          <NewsItem
            date="24.2.2022"
            content={
              <Text>
                Updates Section / Fix{" "}
                <Link to="/service/trigger-pad">TriggerPad</Link> for touch
                devices.
              </Text>
            }
          />
        </TableBody>
      </Table>
    </Template>
  );
}
