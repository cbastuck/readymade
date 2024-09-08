export type HeroVideoDescriptor = {
  url: string;
  backgroundSize: string;
  backgroundPosition: string;
  backgroundAttachment: string;
  backgroundRepeat: string;
  landingPitchTextStyle: string;
  logoBackground: string;
  welcomeWordStyle?: string;
  claimTextStyle?: string;
};

const diffuse: HeroVideoDescriptor = {
  url: "https://videos.pexels.com/video-files/9707164/9707164-sd_506_960_30fps.mp4",
  backgroundSize: "",
  backgroundPosition: "center",
  backgroundAttachment: "",
  backgroundRepeat: "repeat-x",
  welcomeWordStyle: "stroke-gray-500 stroke-[4px]",
  claimTextStyle: "text-gray-500  px-2 mt-2",
  landingPitchTextStyle: "bg-gray-100 text-gray-600 p-2",
  logoBackground: "bg-gradient-to-r from-gray-100 to-gray-500",
};

// source:  // source https://www.pexels.com/video/person-using-a-tablet-5190552/
const personUsingTablet: HeroVideoDescriptor = {
  url: "/assets/images/5190552-sd_960_506_25fps.mp4",
  backgroundSize: "cover",
  backgroundPosition: "50% -110px",
  backgroundAttachment: "fixed",
  backgroundRepeat: "no-repeat",
  landingPitchTextStyle: "text-gray-600",
  logoBackground: "bg-gradient-to-r from-sky-600 to-sky-400",
};

// https://www.pexels.com/photo/abstract-painting-1495321/
const wildImage: HeroVideoDescriptor = {
  url: "https://images.pexels.com/photos/1495321/pexels-photo-1495321.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2",
  backgroundSize: "cover",
  backgroundPosition: "",
  backgroundAttachment: "fixed",
  backgroundRepeat: "",
  landingPitchTextStyle: "bg-gray-100 text-gray-600 p-2 rounded px-10",
  welcomeWordStyle: "stroke-white stroke-[5px]",
  logoBackground: "bg-[#e4ba5e]",
  claimTextStyle: "text-black bg-white px-2 rounded-full",
};

// https://www.pexels.com/video/blue-food-coloring-mixing-with-liquid-3864191/
const dropDistribution: HeroVideoDescriptor = {
  url: "https://videos.pexels.com/video-files/3864191/3864191-hd_1920_1080_25fps.mp4",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundAttachment: "fixed",
  backgroundRepeat: "none",
  landingPitchTextStyle: "text-gray-600 p-2 rounded px-10",
  welcomeWordStyle: "stroke-sky-700 stroke-[4px]",
  logoBackground: "bg-sky-700",
  claimTextStyle: "text-gray-700  px-2 mt-2",
};

const shapes: HeroVideoDescriptor = {
  url: "https://videos.pexels.com/video-files/4965980/4965980-sd_960_506_25fps.mp4",
  backgroundSize: "contain",
  backgroundPosition: "center",
  backgroundAttachment: "",
  backgroundRepeat: "none",
  landingPitchTextStyle: "text-gray-600 bg-[#d4e2eb94] p-2 text-[17px]",
  welcomeWordStyle: "stroke-white stroke-[2px]",
  logoBackground: "bg-gray-600",
  claimTextStyle: "text-gray-500  px-2 mt-2",
};

// https://www.pexels.com/video/best-free-glitch-effect-footage-noise-vhs-layer-tv-effects-16181150/
const fastly: HeroVideoDescriptor = {
  url: "https://videos.pexels.com/video-files/16181150/16181150-uhd_2560_1440_30fps.mp4",
  backgroundSize: "contain",
  backgroundPosition: "center",
  backgroundAttachment: "",
  backgroundRepeat: "none",
  landingPitchTextStyle: "text-black text-lg bg-white px-2 py-0 my-0",
  welcomeWordStyle: "stroke-white stroke-[6px]",
  logoBackground: "bg-black",
  claimTextStyle: "text-white px-2 mt-2",
};

const heroVideos: Array<HeroVideoDescriptor> = [
  fastly,
  shapes,
  dropDistribution,
  wildImage,
  diffuse,
  personUsingTablet,
];

export function currentHeroVideo(): HeroVideoDescriptor {
  return heroVideos[3];
}

const videoUrl =
  // "https://v.ftcdn.net/07/98/89/66/700_F_798896647_yCb3d1rk3p3YgDfg4nPnynuQQuPj8Kh5_ST.mp4";
  //"https://v.ftcdn.net/06/87/47/93/700_F_687479380_2sk5rMtbF8HhBhstTFfpVnHNpIJE8cBP_ST.mp4";
  //"https://v.ftcdn.net/08/84/46/70/700_F_884467006_xGcSyXsfnTpFCmgUdbuICI7KoMDZKDwf_ST.mp4";
  //"https://v.ftcdn.net/03/62/92/28/700_F_362922844_PWsalTWGLrW1EznrTEJK9TuV7Mx35lOL_ST.mp4";
  //"/assets/images/particles.png";
  //"https://videos.pexels.com/video-files/7565831/7565831-sd_960_506_25fps.mp4";
  //"https://videos.pexels.com/video-files/7565977/7565977-sd_960_506_25fps.mp4";
  //"/assets/images/10915063-sd_360_640_25fps.mp4";
  //"/assets/images/3864191-sd_640_360_25fps.mp4";
  //"https://videos.pexels.com/video-files/3795389/3795389-sd_506_960_25fps.mp4";
  //"https://videos.pexels.com/video-files/4623748/4623748-sd_360_640_24fps.mp4"; // curtain
  //"https://videos.pexels.com/video-files/4067804/4067804-sd_960_506_25fps.mp4"; //frame
  //"https://videos.pexels.com/video-files/4067800/4067800-sd_960_506_25fps.mp4"; // two empty frames
  //"https://videos.pexels.com/video-files/7565816/7565816-sd_640_360_25fps.mp4";
  //"https://videos.pexels.com/video-files/9668302/9668302-sd_640_360_25fps.mp4"; //ink
  //"https://videos.pexels.com/video-files/4965957/4965957-sd_960_506_25fps.mp4"; // move shapes away
  //"https://videos.pexels.com/video-files/4965980/4965980-sd_960_506_25fps.mp4" // single dot
  //"https://videos.pexels.com/video-files/9668301/9668301-sd_360_640_25fps.mp4"; // red form the bottom
  //"https://videos.pexels.com/video-files/4965950/4965950-sd_960_506_25fps.mp4"; //move dot around
  //"https://videos.pexels.com/video-files/4965954/4965954-sd_960_506_25fps.mp4"; //move dot around better

  //"https://videos.pexels.com/video-files/9707164/9707164-sd_506_960_30fps.mp4"; // two diffuse met each other contain only - gut

  //"https://videos.pexels.com/video-files/856911/856911-sd_640_360_25fps.mp4";
  //"https://videos.pexels.com/video-files/5190552/5190552-sd_960_506_25fps.mp4"; //MEGA only contain with fixed
  "";
