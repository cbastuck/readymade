export type HeroVideoDescriptor = {
  type: "video" | "image";
  url: string;
  still: string;
  landingPitchTextStyle: string;
  logoBackground: string;
  welcomeWordStyle?: string;
  claimTextStyle?: string;
  loop?: boolean;

  // image
  backgroundSize?: "cover";
  backgroundPosition?: "";
  backgroundRepeat?: "";
};

// source https://www.pexels.com/video/person-using-a-tablet-5190552/
const personUsingTablet: HeroVideoDescriptor = {
  type: "video",
  url: "/assets/heros/5190552-sd_960_506_25fps.mp4",
  landingPitchTextStyle: "text-gray-600",
  logoBackground: "bg-gradient-to-r from-sky-600 to-sky-400",
  still: "/assets/heros/5190552-sd_960_506_25fps-still.png",
};

//source https://www.pexels.com/video/a-monochromatic-video-of-clouds-of-paint-underwater-9707164/
const diffuse: HeroVideoDescriptor = {
  type: "video",
  url: "/assets/heros/9707164-sd_506_960_30fps.mp4", //"https://videos.pexels.com/video-files/9707164/9707164-sd_506_960_30fps.mp4",
  welcomeWordStyle: "stroke-gray-500 stroke-[4px]",
  claimTextStyle: "text-black  px-2 mt-2",
  landingPitchTextStyle: "bg-[#f3f4f6db] text-gray-600 p-2",
  logoBackground: "bg-gradient-to-r from-[#f3f4f6db] to-[#6b72809e]",
  still: "/assets/heros/9707164-sd_506_960_30fps-still.png",
};

// https://www.pexels.com/video/blue-food-coloring-mixing-with-liquid-3864191/
const dropDistribution: HeroVideoDescriptor = {
  type: "video",
  url: "/assets/heros/3864191-sd_640_360_25fps.mp4", //"https://videos.pexels.com/video-files/3864191/3864191-hd_1920_1080_25fps.mp4",
  landingPitchTextStyle: "text-gray-600 p-2 rounded px-10",
  welcomeWordStyle: "stroke-sky-700 stroke-[4px]",
  logoBackground: "bg-sky-700",
  claimTextStyle: "text-gray-700  px-2 mt-2",
  still: "/assets/heros/sd_640_360_25fps-still.png",
};

// source: https://www.pexels.com/video/a-black-and-white-image-of-a-red-arrow-4965980/
const shapes: HeroVideoDescriptor = {
  type: "video",
  url: "/assets/heros/4965980-sd_426_226_25fps.mp4", //"https://videos.pexels.com/video-files/4965980/4965980-sd_960_506_25fps.mp4",
  welcomeWordStyle: "stroke-white stroke-[3px]",
  landingPitchTextStyle: "text-gray-600 bg-[#d4e2ebf0] p-2 text-[17px]",
  logoBackground: "bg-[#333] drop-shadow-no",
  claimTextStyle: "text-gray-500  px-2 mt-2",
  still: "/assets/heros/4965980-sd_426_226_25fps-still.png",
};

// https://www.pexels.com/video/best-free-glitch-effect-footage-noise-vhs-layer-tv-effects-16181150/
const fastly: HeroVideoDescriptor = {
  type: "video",
  url: "/assets/heros/16181150-sd_426_240_30fps.mp4", //"https://videos.pexels.com/video-files/16181150/16181150-uhd_2560_1440_30fps.mp4",
  landingPitchTextStyle: "text-white text-lg bg-black px-2 py-0 my-0 px-4",
  welcomeWordStyle: "stroke-white stroke-[6px]",
  logoBackground: "bg-black",
  claimTextStyle: "text-white px-2 mt-2",
  still: "/assets/heros/16181150-sd_426_240_30fps-still.png",
};

// https://www.pexels.com/photo/abstract-painting-1495321/
const wildImage: HeroVideoDescriptor = {
  type: "image",
  url: "/assets/heros/pexels-steve-1495321%20md.jpg", //"https://images.pexels.com/photos/1495321/pexels-photo-1495321.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2",
  backgroundSize: "cover",
  backgroundPosition: "",
  backgroundRepeat: "",
  landingPitchTextStyle: "bg-[#f4f4f6eb] text-gray-600 py-2 px-4 rounded",
  welcomeWordStyle: "stroke-white stroke-[5px]",
  logoBackground: "bg-[#e4ba5e]",
  claimTextStyle: "text-black bg-white px-2 rounded-full",
  still: "/assets/heros/pexels-steve-1495321md-still.png",
};

const heroVideos: Array<HeroVideoDescriptor> = [
  fastly,
  shapes,
  dropDistribution,
  diffuse,
  personUsingTablet,
  wildImage,
];

const maxIdx = heroVideos.length - 1;
const randomHeroIndex = Math.round(Math.random() * maxIdx);
export function currentHeroVideo(): HeroVideoDescriptor {
  return heroVideos[randomHeroIndex];
}
