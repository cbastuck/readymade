const examplesData = [
  {
    title: "Hello World",
    brief: "The mother of examples",
    description: [
      "Shows the basic structure of a flow. The well-known words periodically rendered on a canvas",
    ],
    image: "/assets/hkp-single-dot.png",
    url: "/boards/examples/helloworld.json",
    explanation:
      "In this basic example a [Timer](/service/timer) emits [time-data](/datamodel/timer) every second. This is [mapped](/service/map) to a [Renderable](/datamodel/renderable) data-object, which is visualized using the [canvas](/service/canvas) service.",
    createdAt: "Wed Jul 29 08:42:26 2020 +0200",
  },
  {
    title: "Audiolize",
    brief: "Visualizaton for the ear",
    description: [
      "Listen to changes on Wikipedia. Whenever an article is changed, whether from a bot or a user, this leads to a sounds as part of a beat",
    ],
    image: "/assets/hkp-single-dot.png",
    url: "/boards/examples/audiolize.json",
    explanation: [
      'Press "Start Audio" for listening to changes on wikipedia as a "beat".',
      "From Wikipedia's event stream of recent changes the flow [maps](/service/map) whether a change was made from a bot or a user.",
      "Changes from a bot are translated into a snare note. User changes become hihat notes. After [aggregating](/service/aggregate) for 90 milliseconds and depending on what event occurred more often a [note-event](/datamodel/note) is passed to the [sampler](/service/sound).",
      "To make it sound like a beat a base-drum is created randomly on a change from a user.",
    ],
    createdAt: "Sat Sep 26 11:37:44 2020 +0200",
  },
  {
    title: "Dropbox",
    brief: "Stop motion to Dropbox",
    description:
      "Every 10 seconds make a picture with the camera and upload it into your Dropbox (once authorized and granted access)",
    image: "/assets/hkp-single-dot.png",
    url: "/boards/examples/dropbox.json",
    explanation: [
      "Produce material for a stop motion video by periodically making photos and automatically uploading them into your dropbox",
      'Log into your dropbox by pressing the "Login" button. After you enable the upload toggle, incoming images will appear in a hkp-db folder of your dropbox drive (no other content is accessible by this board).',
    ],
    createdAt: "Sat Sep 26 11:37:44 2020 +0200",
  },
  {
    title: "Trigger Pad",
    brief: "Control the output",
    description:
      "Record sounds in your environment, put them on a launchpad and start playing with them",
    image: "/assets/hkp-single-dot.png",
    url: "/boards/examples/triggerpad.json",
    explanation: [
      "[AudioInput](/service/audio-input) allows recording audio from an input device while holding a button, or constantly by creating audio slices based on time intervals.",
      "An empty and armed pad of the [Trigger Pad](/service/trigger-pad) is highlighted with a blue border. Whenever a new event comes in, its data is stored inside of the armed pad and the following empty pad will be armed. Triggering a non-empty pad injects its content on the output. Here, this will playback the recorded sample.",
    ],
    createdAt: "Sat Sep 26 11:37:44 2020 +0200",
  },
  {
    title: "GIF Animator",
    brief: "Make a GIF",
    description:
      "Create a simple GIF animation with the a GIF recorder behind the output of a canvas",
    image: "/assets/hkp-single-dot.png",
    url: "/boards/examples/animate.json",
    explanation: [
      "Creates a simple parallax scrolling animation at 25fps. Route the output of the [canvas](/service/canvas) in capture mode to [GIF Recorder](/service/gif-recorder) service",
      "[Stack](/service/stack) is configured to multiply the input data to the services inside of the stack and comine their output in an array of type [Renderable](/datamodel/renderable).",
    ],
    createdAt: "Wed Oct 28 09:30:17 2020 +0100",
  } /*
  {
    title: 'Spotify2Github',
    brief: 'Preserve your liked songs on Github ',
    description: '',
    image: '/assets/shutterstock_1196210650.png',
    url: '/boards/examples/spotify.json',
    explanation: [
      'Spotify scenario'
    ]
  }*/,
];

export default examplesData;
