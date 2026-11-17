/* ================= weather & kick-off times =================
   Each fixture gets a kick-off time and a forecast from the country's climate and the month. Conditions can change
   during the match. Effects on play: fric (ball rolling resistance), touch (first-touch penalty), err (pass error),
   spd (top speed), fat (fatigue), hold (keeper catches cleanly), wind (drift on lofted balls). */
const WX={
 clear:{n:'Clear',fric:1,touch:0,err:0,spd:1,fat:1,hold:1,wind:0},
 cloudy:{n:'Overcast',fric:1,touch:0,err:0,spd:1,fat:1,hold:1,wind:0},
 rain:{n:'Rain',fric:.72,touch:.035,err:.008,spd:.99,fat:1.03,hold:.72,wind:.3},
 storm:{n:'Heavy rain',fric:.6,touch:.07,err:.016,spd:.97,fat:1.06,hold:.55,wind:.7},
 snow:{n:'Snow',fric:1.4,touch:.05,err:.012,spd:.93,fat:1.1,hold:.8,wind:.2},
 wind:{n:'Windy',fric:1,touch:.012,err:.006,spd:1,fat:1.02,hold:.95,wind:1},
 heat:{n:'Hot',fric:.95,touch:0,err:.004,spd:.98,fat:1.3,hold:1,wind:0},
};
const WX_ICON={
 clear:'<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
 cloudy:'<path d="M7 18h10a4 4 0 0 0 .4-8A6 6 0 0 0 6 11a3.5 3.5 0 0 0 1 7z"/>',
 rain:'<path d="M7 14h10a4 4 0 0 0 .4-8A6 6 0 0 0 6 7a3.5 3.5 0 0 0 1 7zM8 17l-1 3M12 17l-1 3M16 17l-1 3"/>',
 storm:'<path d="M7 13h10a4 4 0 0 0 .4-8A6 6 0 0 0 6 6a3.5 3.5 0 0 0 1 7zM7 16l-1.5 4M11 16l-1.5 4M15 16l-1.5 4M19 16l-1.5 4"/>',
 snow:'<path d="M7 13h10a4 4 0 0 0 .4-8A6 6 0 0 0 6 6a3.5 3.5 0 0 0 1 7z"/><circle cx="8" cy="18" r=".8"/><circle cx="12" cy="20" r=".8"/><circle cx="16" cy="18" r=".8"/>',
 wind:'<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h8"/>',
 heat:'<path d="M12 3a2 2 0 0 0-2 2v9.3a4 4 0 1 0 4 0V5a2 2 0 0 0-2-2zM12 14v3"/><path d="M17 5h3M17 9h3"/>',
};
const wxIcon=t=>`<svg class="wx" viewBox="0 0 24 24" aria-hidden="true">${WX_ICON[t]||WX_ICON.clear}</svg>`;
const SUNSET=[16.4,17.3,18.2,19.9,20.7,21.3,21.1,20.4,19.3,18.2,16.3,16];
const CLIMATE={ENG:{rain:.38,cold:3},NED:{rain:.36,cold:3},GER:{rain:.3,cold:4},FRA:{rain:.26,cold:1},ITA:{rain:.18,cold:-1},ESP:{rain:.12,cold:-2}};
function forecast(md,h){
 const c=S.clubs[h],cl=CLIMATE[c.nation]||CLIMATE.ENG,ms=mdDate(md),mon=new Date(ms).getUTCMonth(),rng=R((S.seed^(S.season*7919+md*104729+h*31))>>>0);
 const winter=[11,0,1].includes(mon),summer=[7,8,4].includes(mon);
 const temp=Math.round((summer?24:winter?4:13)-cl.cold*1.6+rng.n(0,3.5));
 let type='clear',r=rng.f();
 if(winter&&cl.cold>=1&&r<.11)type='snow';
 else if(r<cl.rain*(winter?1.25:1))type=rng.f()<.3?'storm':'rain';
 else if(r<cl.rain+.12)type='wind';
 else if(summer&&temp>=27&&r<cl.rain+.4)type='heat';
 else if(r<cl.rain+.45)type='cloudy';
 const kick=pickW([12.5,15,17.5,20],k=>({12.5:.15,15:.4,17.5:.2,20:.25})[k],rng);
 const changes=[];
 if(rng.f()<.28){const t=rng.i(15,75)*60;const to=type==='rain'?(rng.f()<.5?'storm':'cloudy'):type==='storm'?'rain':type==='snow'?'cloudy':cl.rain>.2?'rain':'cloudy';if(to!==type)changes.push({t,type:to})}
 return{type,temp,kick,mon,wDir:rng.f()*Math.PI*2,wSpd:type==='wind'?rng.i(30,55):type==='storm'?rng.i(20,40):rng.i(4,18),changes};
}
const kickLabel=h=>`${String(Math.floor(h)).padStart(2,'0')}:${h%1?'30':'00'}`;
const wxLine=w=>`${kickLabel(w.kick)} kick-off · ${WX[w.type].n} · ${w.temp}°C · wind ${w.wSpd} km/h`;
// Local time of day during play, and how much daylight is left (1 day, 0 night).
function hourAt(w,t){return w.kick+t/3600*1.18}
function daylight(w,t){const h=hourAt(w,t),ss=SUNSET[w.mon];return clamp((ss+.35-h)/1.1,0,1)}
