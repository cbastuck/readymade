import UpdatesButton from "./UpdatesButton";
import Carousel from "@/ui-components/Carousel";

import Switcher from "../../components/Switcher";

import { useNavigate } from "react-router-dom";
import Button from "@/ui-components/Button";

import Claim from "./Claim";
import Sandbox from "@/Sandbox";
import HookupLogo from "./HookupLogo";

const teaserVideos = ["/assets/teaser/Teaser2.mp4"];
const carouselItems = teaserVideos
  .map((video) => (
    <video
      className="rounded-xl border-solid border mx-auto drop-shadow-3xl"
      src={video}
      autoPlay
      loop
      width="85%"
    />
  ))
  .concat(
    <div className="flex justify-center mx-10 bg-white rounded-xl border-solid border drop-shadow-3xl">
      <Sandbox src="/assets/teaser/board.json" hidePlaygroundLink={true} />
    </div>
  );

export default function WelcomePanel() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col fade-in w-full mt-[5%]">
      <div className="flex flex-col border border-solid mx-20">
        <div className="px-[100px] w-full flex mt-2">
          <h1 className="w-full ml-auto">
            Welcome <UpdatesButton />
          </h1>
        </div>
        <div className="w-[18%] mx-auto mb-10">
          <HookupLogo />
        </div>
      </div>

      <div className="flex gap-0.5 mx-auto mt-1 w-[60%]">
        <Button className="w-full" onClick={() => navigate("/welcome/mission")}>
          What is this?
        </Button>

        <Button className="w-full" onClick={() => navigate("/engage")}>
          I want to engage
        </Button>
      </div>

      <div className="">
        <h2 className="pt-10 m-0">Teaser Videos and Demos</h2>
        <div className="mx-auto px-10 pb-10">
          <Carousel items={carouselItems} />
        </div>
      </div>
    </div>
  );
}

export function OldWelcome() {
  const navigate = useNavigate();
  return (
    <>
      <UpdatesButton />
      <div
        style={{
          display: "flex",
          width: "min-content",
          margin: "auto",
        }}
      >
        <div
          className="font-sans"
          style={{ fontSize: "35px", color: "#454f6e", height: "43px" }}
        >
          Welcome
        </div>

        <Switcher
          style={{
            width: "130px",
            textAlign: "left",
            marginTop: "21px",
            paddingLeft: "5px",
          }}
          data={[
            <Claim words={["hook", "it", "up"]} />,
            <Claim words={["make", "it", "yours"]} />,
          ]}
        />
      </div>

      <div className="flex flex-col gap-1 ml-auto mr-auto mt-1 w-[280px]">
        <Button onClick={() => navigate("/welcome/mission")}>
          What is this?
        </Button>

        <Button onClick={() => navigate("/engage")}>I want to engage</Button>
      </div>
    </>
  );
}
