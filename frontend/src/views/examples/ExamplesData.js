export default [
  {
    title: 'Hello World',
    brief: 'The mother of examples',
    description: [
      'This example is showing the basic structure of a workflow',
      'Try double-clicking the canvas to see that this service is used in the quick pitch and the thought-experiment on the start-page'
    ],
    image: '/assets/shutterstock_1196210650.png',
    url: '/boards/examples/helloworld.json',
    explanation: 'In this basic example a [Timer](/service/timer) emits [time-data](/datamodel/timer) every second. This is [mapped](/service/map) to a [Renderable](/datamodel/renderable) data-object, which is visualized using the [canvas](/service/canvas) service.'
  },
  {
    title: 'Audiolize',
    brief: 'Visualizaton for the ear',
    description: [ 'Listen to changes on Wikipedia. Hear a sound whenever someone makes an to an article. You hear different sound whether a bit or a human makes the change.' ],
    image: '/assets/shutterstock_1196210650.png',
    url: '/boards/examples/audiolize.json',
    explanation: [
      'Press "Start Audio" and listen to changes on wikipedia as kindof a drum beat.',
      'From Wikipedia\'s event stream we [map](/service/map) whether a change was made by a bot or a user and create drum sounds accordingly.',
      'On bot changes we accumulate a snare event. On human changes we a hihat event. After [aggregating](/service/aggregate) for 90 milliseconds a snare or hihat [note-event](/datamodel/note) is passed to the [sampler](/service/sound), depending on what occurred more often. To make it more as a beatish, a base-drum event is randomly created with a human change'
    ]
  },
  {
    title: 'Dropbox',
    brief: 'Stop motion to Dropbox',
    description: 'Every 10 seconds make a picture with the camera and upload it into your Dropbox (once authorized and granted access)',
    image: '/assets/shutterstock_1196210650.png',
    url: '/boards/examples/dropbox.json',
    explanation: [
      'Produce material for a stop motion video by periodically making photos and upload them automatically into your dropbox folder',
      'Log into your dropbox using the and after you enable the upload, the captured images will appear in a hkp-db folder of you dropbox (no other content is accessible by this board).'
    ]
  },
  {
    title: 'Trigger Pad',
    brief: 'Control the output',
    description: 'Record sounds in your environment, put them on a launchpad and start playing with them',
    image: '/assets/shutterstock_1196210650.png',
    url: '/boards/examples/triggerpad.json'
  },
  {
    title: 'GIF Animator',
    brief: 'Make a GIF',
    description: 'Create a simple GIF animation with the output of the canvas service and a GIF recorder',
    image: '/assets/shutterstock_1196210650.png',
    url: '/boards/examples/animate.json'
  }
];