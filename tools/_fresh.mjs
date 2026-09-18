import * as esbuild from 'esbuild';
const src='/home/user/Subnautica-2/src/';
const b=(await esbuild.build({stdin:{contents:[
 `export { Simulation } from '${src}sim/agents/sim';`,
 `export { startingWorld, paint, zoneCode } from '${src}sim/world';`,
 `export { makeCity } from '${src}sim/city';`,
 `export { TICKS_PER_DAY } from '${src}sim/agents/calendar';`,
 `export { configureSim } from '${src}sim/config';`,
].join('\n'),resolveDir:src,loader:'ts'},bundle:true,format:'esm',write:false,target:'es2022'})).outputFiles[0].text;
const M=await import('data:text/javascript;base64,'+Buffer.from(b).toString('base64'));
const {Simulation,startingWorld,paint,zoneCode,makeCity,TICKS_PER_DAY,configureSim}=M;
configureSim({cityGrid:200,terrainSize:9216});
const w=startingWorld();
const g=w.grid;
let sample=null;
for(let z=20;z<g-20&&!sample;z++)for(let x=20;x<g-20;x++) if(w.net.has(x,z)){sample=[x,z];break;}
paint(w,sample[0]+1,sample[1]-8,10,17,zoneCode('residential','low'));
let painted=0; for(let i=0;i<w.zones.length;i++) if(w.zones[i]!==0) painted++;
const sim=new Simulation(makeCity(w), w.net, 0x99, w);
sim.found(30);
for(let d=0;d<4;d++){
  for(let t=0;t<TICKS_PER_DAY;t+=32){
    sim.step(32);
    const grew=sim.grew();
    if(grew!==null) sim.buildingsChanged(makeCity(w,grew));
  }
  let grown=0; for(let i=0;i<w.grown.length;i++) if(w.zones[i]!==0&&w.grown[i]!==0) grown++;
  console.log(`day${d} painted ${painted} grown ${grown} homes ${sim.places.homeCapacity} `
    +`pop ${sim.people.population} want ${[...sim.demand.want].map(v=>v.toFixed(2)).join(',')} `
    +`owed ${sim.growth.report.owed.toFixed(1)} waiting ${sim.growth.report.waiting} `
    +`cells ${sim.growth.report.cells}`);
}
