/* ================= match audio =================
   Everything is synthesised with WebAudio, so the page ships no audio files: crowd bed, swells on chances,
   goal roars, the referee's whistle and an original pre-match anthem. Created on a click (autoplay rules). */
const SND={
 ctx:null,master:null,crowd:null,crowdG:null,crowdF:null,level:.35,
 get on(){try{return localStorage.getItem('dugout:sound')!=='0'}catch(e){return true}},
 set on(v){try{localStorage.setItem('dugout:sound',v?'1':'0')}catch(e){}if(this.master)this.master.gain.value=v?.9:0},
 init(){
  if(this.ctx){if(this.ctx.state==='suspended')this.ctx.resume();return true}
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
  try{this.ctx=new AC()}catch(e){return false}
  const c=this.ctx;this.master=c.createGain();this.master.gain.value=this.on?.9:0;
  const comp=c.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;this.master.connect(comp);comp.connect(c.destination);
  // Crowd bed: two seconds of brown-ish noise, looped, band-passed around voice frequencies.
  const len=c.sampleRate*2,buf=c.createBuffer(2,len,c.sampleRate);
  for(let ch=0;ch<2;ch++){const d=buf.getChannelData(ch);let last=0;for(let i=0;i<len;i++){const w=Math.random()*2-1;last=(last+.045*w)/1.045;d[i]=last*3.2+w*.08}}
  const src=c.createBufferSource();src.buffer=buf;src.loop=true;
  this.crowdF=c.createBiquadFilter();this.crowdF.type='bandpass';this.crowdF.frequency.value=700;this.crowdF.Q.value=.5;
  this.crowdG=c.createGain();this.crowdG.gain.value=0;src.connect(this.crowdF);this.crowdF.connect(this.crowdG);this.crowdG.connect(this.master);src.start();this.crowd=src;
  return true;
 },
 now(){return this.ctx?this.ctx.currentTime:0},
 // Overall crowd intensity, 0..1. Ramps rather than jumps.
 setCrowd(v,secs=1.2){if(!this.ctx)return;this.level=v;const t=this.now();this.crowdG.gain.cancelScheduledValues(t);this.crowdG.gain.setTargetAtTime(.05+v*.22,t,secs/3);this.crowdF.frequency.setTargetAtTime(520+v*700,t,secs/3)},
 swell(peak=.8,hold=1.2){if(!this.ctx)return;const t=this.now(),g=this.crowdG.gain,f=this.crowdF.frequency;g.cancelScheduledValues(t);g.setTargetAtTime(.05+peak*.3,t,.12);g.setTargetAtTime(.05+this.level*.22,t+hold,.8);f.setTargetAtTime(600+peak*900,t,.1);f.setTargetAtTime(520+this.level*700,t+hold,.8)},
 whistle(n=1,long=false){
  if(!this.ctx)return;const c=this.ctx;let t=this.now()+.02;
  for(let i=0;i<n;i++){const d=long&&i===n-1?.95:.22,o=c.createOscillator(),lfo=c.createOscillator(),lg=c.createGain(),g=c.createGain();
   o.type='sine';o.frequency.value=2850;lfo.frequency.value=34;lg.gain.value=90;lfo.connect(lg);lg.connect(o.frequency);
   g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.16,t+.02);g.gain.setValueAtTime(.16,t+d-.04);g.gain.linearRampToValueAtTime(0,t+d);
   o.connect(g);g.connect(this.master);o.start(t);lfo.start(t);o.stop(t+d+.02);lfo.stop(t+d+.02);t+=d+.14}
 },
 // Original, stately anthem in D major: brass-like pads, a melody line and timpani on the downbeats.
 anthem(){
  if(!this.ctx)return 0;const c=this.ctx,beat=.62,t0=this.now()+.08;
  const N=m=>440*Math.pow(2,(m-69)/12);
  const voice=(midi,start,dur,vol,bright)=>{const f=c.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(bright*.6,start);f.frequency.linearRampToValueAtTime(bright,start+.12);f.Q.value=.7;
   const g=c.createGain();g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(vol,start+.09);g.gain.setValueAtTime(vol*.85,start+dur*.7);g.gain.linearRampToValueAtTime(0,start+dur+.25);
   for(const det of[-6,0,7]){const o=c.createOscillator();o.type='sawtooth';o.frequency.value=N(midi);o.detune.value=det;o.connect(f);o.start(start);o.stop(start+dur+.3)}
   f.connect(g);g.connect(this.master)};
  const timp=(midi,start)=>{const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(N(midi)*1.5,start);o.frequency.exponentialRampToValueAtTime(N(midi),start+.12);g.gain.setValueAtTime(.32,start);g.gain.exponentialRampToValueAtTime(.001,start+.9);o.connect(g);g.connect(this.master);o.start(start);o.stop(start+1)};
  // bars of 4 beats: [chord tones], melody as [midi, beats]
  const prog=[[50,57,62,66],[55,59,62,67],[47,54,59,62],[52,55,59,64],[55,59,62,67],[50,57,62,66],[45,57,61,64],[50,57,62,66]];
  const mel=[[74,2],[76,1],[78,1],[79,3],[78,1],[76,2],[74,1],[71,1],[76,4],[79,2],[78,1],[76,1],[74,2],[73,2],[74,4]];
  prog.forEach((ch,b)=>{const st=t0+b*4*beat,last=b===prog.length-1;ch.forEach((m,i)=>voice(m,st,4*beat*(last?1.6:1)-.05,i?.035:.05,i?1500:900));timp(ch[0]-12,st);if(b%2)timp(ch[0]-12,st+2*beat)});
  let mt=t0;for(const[m,bt]of mel){voice(m,mt,bt*beat-.04,.06,2600);mt+=bt*beat}
  return prog.length*4*beat;
 },
 stop(){if(this.ctx&&this.ctx.state==='running')this.ctx.suspend()},
 resume(){if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume()},
};
