export default [
  {
    title: 'Hello World',
    brief: 'The mother of examples',
    description: [
      'This example is showing the basic structure of a workflow',
      'Try double-clicking the canvas and realize this is the service that is used in the quick pitch and the thought-experiment on the start-page'
    ],
    image: '/assets/shutterstock_1196210650.png',
    url: '/boards/examples/helloworld.json',
    explanation: 'In this basic example a [Timer](/service/timer) emits [time-data](/datamodel/timer) every second. This is [mapped](/service/map) to a [Renderable](/datamodel/renderable) datamodel, which is visualized using the [canvas](/service/canvas) service.'
  },
  {
    title: 'Audiolize',
    brief: 'Visualizaton for the ear',
    description: [
      'Listen to changes on Wikipedia. Hear a sound whenever someone makes an to an article. You hear different sound whether a bit or a human makes the change.',
    ],
    image: '/assets/shutterstock_1196210650.png',
    url: '/boards/examples/audiolize.json',
    explanation: 'The first module connects to the event source that communicates changes on Wikipedia. Further we map that event into a #Note and pass it to the audio generator.'
  },
  {
    title: 'Dropbox',
    brief: 'Upload into your Dropbox',
    description: 'Every 10 seconds make a picture with the camera and upload it into your Dropbox (once authorized and granted access)',
    image: '/assets/shutterstock_1196210650.png',
    url: '/boards/examples/dropbox.json'
  },
  {
    title: 'Trigger Pad',
    brief: 'Control the output',
    description: 'Record sounds in your environment, put them on a launchpad and start playing with them',
    image: '/assets/shutterstock_1196210650.png',
    url: '/boards/examples/triggerpad.json'
  }
];