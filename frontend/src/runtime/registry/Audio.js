import * as Tone from 'tone';

Tone.Transport.on('start', ev => {
  console.log('Position', ev)
});

Tone.Transport.start();
console.log('TRANSPORT', Tone.Transport)

export function doTheThing() {
  const synth = new Tone.Synth().toMaster();
  //play a note every quarter-note
  const loop = new Tone.Loop(
    time => {
      synth.triggerAttackRelease("C2", "8n", time);
    }, 
    "4n"
  );
  loop.start("1m").stop("4m");

  
}