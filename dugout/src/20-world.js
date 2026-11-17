/* ================= world ================= */
const NATIONS={
 ENG:{n:'England',f:['cross','#ffffff','#ce1124'],pool:'en',sk:[0,4],w:22},
 SCO:{n:'Scotland',f:['saltire','#005eb8','#ffffff'],pool:'en',sk:[0,1],w:4},
 IRL:{n:'Ireland',f:['v','#169b62','#ffffff','#ff883e'],pool:'en',sk:[0,1],w:4},
 FRA:{n:'France',f:['v','#002395','#ffffff','#ed2939'],pool:'fr',sk:[0,7],w:7},
 ESP:{n:'Spain',f:['h3','#aa151b','#f1bf00','#aa151b'],pool:'es',sk:[1,3],w:6},
 POR:{n:'Portugal',f:['v2','#046a38','#da291c'],pool:'pt',sk:[1,4],w:4},
 ITA:{n:'Italy',f:['v','#009246','#ffffff','#ce2b37'],pool:'it',sk:[1,3],w:4},
 GER:{n:'Germany',f:['h','#000000','#dd0000','#ffce00'],pool:'de',sk:[0,5],w:5},
 NED:{n:'Netherlands',f:['h','#ae1c28','#ffffff','#21468b'],pool:'nl',sk:[0,6],w:5},
 BEL:{n:'Belgium',f:['v','#000000','#fdda24','#ef3340'],pool:'fr',sk:[0,6],w:3},
 DEN:{n:'Denmark',f:['nordic','#c8102e','#ffffff'],pool:'nord',sk:[0,1],w:3},
 SWE:{n:'Sweden',f:['nordic','#006aa7','#fecc00'],pool:'nord',sk:[0,4],w:3},
 NOR:{n:'Norway',f:['nordic2','#ba0c2f','#ffffff','#00205b'],pool:'nord',sk:[0,1],w:3},
 BRA:{n:'Brazil',f:['brazil','#009c3b','#ffdf00','#002776'],pool:'pt',sk:[1,7],w:5},
 ARG:{n:'Argentina',f:['h','#74acdf','#ffffff','#74acdf'],pool:'es',sk:[0,3],w:4},
 COL:{n:'Colombia',f:['col','#fcd116','#003893','#ce1126'],pool:'es',sk:[2,6],w:2},
 NGA:{n:'Nigeria',f:['v','#008751','#ffffff','#008751'],pool:'waf',sk:[5,7],w:4},
 GHA:{n:'Ghana',f:['hstar','#ce1126','#fcd116','#006b3f'],pool:'waf',sk:[5,7],w:3},
 SEN:{n:'Senegal',f:['vstar','#00853f','#fdef42','#e31b23'],pool:'waf',sk:[6,7],w:3},
 CIV:{n:"Côte d'Ivoire",f:['v','#f77f00','#ffffff','#009e60'],pool:'waf',sk:[5,7],w:3},
 JPN:{n:'Japan',f:['disc','#ffffff','#bc002d'],pool:'jp',sk:[0,2],w:2},
 POL:{n:'Poland',f:['h2','#ffffff','#dc143c'],pool:'pl',sk:[0,1],w:2},
 AUT:{n:'Austria',f:['h3','#ed2939','#ffffff','#ed2939'],pool:'de',sk:[0,1],w:2},
 MEX:{n:'Mexico',f:['v','#006847','#ffffff','#ce1126'],pool:'es',sk:[2,5],w:2},
};
const NAT_BAG=Object.entries(NATIONS).flatMap(([k,v])=>Array(v.w).fill(k));
const NAMES={
 en:{f:['Jack','Harry','Callum','Owen','Lewis','Ryan','Connor','Josh','Tom','Kieran','Mason','Declan','Reece','Jordan','Ben','Liam','Aaron','Jamie','Sam','Ethan','Alfie','Charlie','Rhys','Tyler'],l:['Walker','Hughes','Bennett','Carter','Fletcher','Marsh','Doyle','Barnes','Reid','Holloway','Kerr','Sutton','Price','Whitaker','Gallagher','Cole','Murray','Ashworth','Lynch','Dempsey','Thornton','Pryce','Coyle','Hartley','Brennan','Okoro','Mensah-Clarke']},
 fr:{f:['Lucas','Théo','Hugo','Mathis','Nathan','Enzo','Yanis','Maxime','Rayan','Adrien','Bastien','Moussa','Ibrahim','Jules','Noah'],l:['Martin','Dubois','Lefèvre','Moreau','Girard','Fontaine','Chevalier','Rousseau','Laurent','Mercier','Diallo','Camara','Benali','Perrin','Gauthier','Vasseur']},
 es:{f:['Pablo','Álvaro','Diego','Sergio','Iker','Marcos','Javier','Adrián','Mateo','Santiago','Nicolás','Thiago','Facundo','Julián','Rodrigo'],l:['García','Fernández','Navarro','Romero','Herrera','Ortega','Castillo','Vidal','Paredes','Molina','Acosta','Ramos','Ibarra','Cuesta','Salazar']},
 pt:{f:['João','Rafael','Tiago','Gonçalo','Diogo','Rúben','Vinícius','Gabriel','Matheus','Bruno','André','Caio','Pedro','Felipe','Danilo'],l:['Silva','Costa','Pereira','Almeida','Ferreira','Rocha','Carvalho','Nunes','Teixeira','Moura','Barbosa','Pinto','Lopes','Antunes','Macedo']},
 it:{f:['Lorenzo','Matteo','Federico','Alessandro','Davide','Nicolò','Riccardo','Giacomo','Simone','Andrea'],l:['Rossi','Bianchi','Ricci','Marino','Greco','Conti','Esposito','Barone','Ferri','Galli']},
 de:{f:['Lukas','Jonas','Leon','Felix','Niklas','Florian','Timo','Maximilian','Kai','Julian'],l:['Schneider','Fischer','Wagner','Becker','Hoffmann','Krüger','Brandt','Vogel','Hartmann','Lehmann']},
 nl:{f:['Daan','Sem','Luuk','Thijs','Bram','Jesse','Stijn','Ruben','Milan','Joey'],l:['de Vries','Jansen','Bakker','Visser','Smit','de Boer','Mulder','van Leeuwen','Bosman','Kuipers']},
 nord:{f:['Emil','Oliver','Magnus','Viktor','Oskar','Anders','Mikkel','Erik','Henrik','Rasmus'],l:['Nielsen','Larsen','Andersson','Lindqvist','Halvorsen','Johansen','Berg','Dahl','Holm','Sørensen']},
 waf:{f:['Kwame','Chidi','Emeka','Kofi','Samuel','Victor','Yaw','Ousmane','Ismaïla','Wilfried','Franck','Tunde','Abdou','Joseph','Seydou'],l:['Mensah','Okafor','Adeyemi','Boateng','Owusu','Ndiaye','Sarr','Diop','Kouassi','Bamba','Eze','Nwosu','Asante','Fofana','Traoré']},
 jp:{f:['Haruto','Ren','Takumi','Kaito','Daichi','Sota','Yuki','Riku'],l:['Tanaka','Sato','Watanabe','Nakamura','Ito','Kobayashi','Morita','Endo']},
 pl:{f:['Jakub','Kacper','Mateusz','Bartosz','Szymon','Piotr'],l:['Nowak','Kowalski','Wiśniewski','Zieliński','Wójcik','Kamiński']},
};
const KEY='dugout-career-v3',PER=20,MDAYS=(PER-1)*2,DROP=3,WIN1=4,WIN2=[19,22];
const COUNTRIES=[
 {code:'ENG',lang:'en',f:1.0,leagues:['Crown League','Crown League Two']},
 {code:'ESP',lang:'es',f:.98,leagues:['Liga Solar','Liga Solar Dos']},
 {code:'GER',lang:'de',f:.95,leagues:['Meisterliga','Meisterliga Zwei']},
 {code:'ITA',lang:'it',f:.94,leagues:['Lega Aurea','Lega Aurea Due']},
 {code:'FRA',lang:'fr',f:.9,leagues:['Ligue Étoile','Ligue Étoile Deux']},
 {code:'NED',lang:'nl',f:.84,leagues:['Kroonklasse','Kroonklasse Twee']},
];
const TOWN={
 en:[['Ash','Brack','Cal','Dun','Elm','Fen','Gal','Hol','Kings','Lang','Mar','North','Oak','Red','Salt','Thorn','West','Whit','Wynd','Har','Brom','Ched','Stan','Mill','Cold','Black','Stone','Ever','Bright','Fair','Sel','Ross','Hay','Wick','Ald','Bur','Pen','Tad','Wal','Cres'],['ford','field','mere','gate','bridge','wick','ton','by','ley','bury','minster','haven','stow','combe','port','well','dale','moor']],
 es:[['Villa','Monte','Río','Valle','Puerto','Costa','Sierra','Alto','Campo','Torre','Vega','Peña','Mira','Fuente','Cala'],['real','verde','blanca','nueva','alegre','mar','sol','dorada','luna','clara','flores','rosa','fría','alta']],
 de:[['Ober','Unter','Neu','Alt','Gross','Klein','Rot','Blau','Grün','Wald','Berg','Stein','Linden','Eich','Hohen','Tann'],['heim','berg','bach','dorf','hausen','feld','stadt','burg','tal','furt','au','brück','hagen']],
 it:[['Castel','Monte','Porto','Villa','Borgo','Rocca','Ponte','Fiume','Lago','Torre','Colle','Pietra','Valle'],['franco','nuovo','vecchio','bello','alto','verde','rosso','marino','chiaro','lungo','fiore','sole']],
 fr:[['Mont','Beau','Val','Ville','Port','Bel','Clair','Roche','Fontaine','Bois','Pont','Haut','Grand'],['mont','ville','court','bourg','lieu','pré','mer','champ','val','fort','roc','lac']],
 nl:[['Zand','Ooster','Wester','Hoog','Laag','Groen','Berg','Veen','Dijk','Brug','Noord','Zuid','Holt'],['vliet','dam','wijk','hoven','berg','voort','horst','meer','dorp','haven','sloot','kerk']],
};
const CLUB_FORMS={
 en:['{t} United','{t} City','{t} Rovers','{t} Athletic','{t} Town','{t} Wanderers','{t} Albion','{t} FC','{t} Rangers','{t} County','Sporting {t}','{t} Borough'],
 es:['CD {t}','Real {t}','Atlético {t}','{t} CF','Deportivo {t}','UD {t}','Racing {t}','SD {t}'],
 de:['FC {t}','SV {t}','VfL {t}','TSV {t}','SC {t}','Sportfreunde {t}','Union {t}','FSV {t}'],
 it:['{t} Calcio','AC {t}','US {t}','Sporting {t}','Virtus {t}','AS {t}','Pro {t}','Real {t}'],
 fr:['FC {t}','AS {t}','Olympique {t}','Stade {t}','RC {t}','US {t}','SC {t}','AC {t}'],
 nl:['{t} FC','SC {t}','VV {t}','FC {t}','SV {t}','Rapid {t}'],
};
const STADIUMS={en:['{t} Park','{t} Road','{t} Lane','The {t} Arena','{t} Ground'],es:['Estadio de {t}','Estadio {t}','Campo de {t}'],de:['{t} Arena','Stadion {t}','Waldstadion {t}'],it:['Stadio {t}','Stadio Comunale {t}'],fr:['Stade de {t}','Stade {t}'],nl:['{t} Stadion','Sportpark {t}']};
const PALETTES=[['#8fc6ef','#ffffff','#0d2a52'],['#6a1b2e','#8fc6ef','#ffffff'],['#111111','#ffffff','#d4a017'],['#ff7a00','#111111','#ffffff'],['#0e5c55','#ff7f6e','#ffffff'],['#2b2d7a','#ff4fa3','#ffffff'],['#c9a227','#111111','#ffffff'],['#e5e5e5','#7a1f1f','#1b1b1b'],['#3d7a2e','#f2e9c9','#7a4b1f'],['#a0153e','#f2c230','#111111'],['#5f8dd3','#ffffff','#e4572e'],['#2a2a2a','#36c5f0','#ffffff'],['#c0182b','#ffffff','#121826'],['#1f4fd1','#ffffff','#f2c230'],['#141414','#f4c20d','#ffffff'],['#17703b','#ffffff','#d4a017'],['#5b2bbf','#f6b93b','#ffffff'],['#f47a1f','#10192e','#ffffff'],['#4cb8f0','#0b2545','#ffffff'],['#7d1f2c','#7fb6f0','#ffffff'],['#1d3787','#e8424a','#ffffff'],['#0f7a72','#f9df8b','#ffffff'],['#3a4354','#e6e9ef','#e2443a'],['#ffffff','#111827','#c0182b'],['#ffffff','#1d3787','#e8424a'],['#d42a2a','#111111','#f4c20d'],['#0b3d91','#f4c20d','#ffffff'],['#006b3f','#ffffff','#111111'],['#e30613','#ffffff','#003c82'],['#ffd200','#1a5d1a','#ffffff'],['#8b0000','#f4c20d','#ffffff'],['#2c1a4d','#b4e1ff','#ffffff'],['#ff6b00','#ffffff','#111111'],['#00a3e0','#ffffff','#e30613'],['#ffffff','#0b8a3e','#111111'],['#1b1b1b','#e30613','#ffffff']];
const SPONSOR_A=['NOVA','KESTREL','VOLTA','MERIDIAN','HALCYON','GRANITE','TIDEWATER','NORTHWIND','SOLACE','BRIGHTLINE','OAKMONT','FORGE','APEX','LUMEN','ORBIT','CRESTA','VANTA','PULSE','ZENITH','HELIX','ATLAS','QUILL','EMBER','SUMMIT'];
const SPONSOR_B=['',' AIR',' BANK',' TELECOM',' ENERGY',' MOTORS',' LABS',' FOODS',' MOBILE',' TRAVEL'];
const SHAPE_KEYS=['heater','rounded','pointed','hex','round','round','castle','oval','diamond','badge','badge','scallop','tall','pennant'],DIVS=['plain','plain','pale','bend','stripes','chevron','quarters','chief','fess','saltire','cross','pile','hoops','chequy','wavy','sun','bordure'],EMBS=Object.keys(EMB).concat(['ball','mono','mono']),ORNS=['','','','','stars1','stars2','stars3','laurel'];
const KIT_PATS=['plain','plain','plain','stripes','stripes','hoops','halves','sash','pinstripe','chevron','quarters','gradient','band','centre','panels','yoke','checks','dstripes','fade','hoopsthin'];

/* attributes */
const ATTRS=['pas','cro','dri','fir','fin','lon','hea','tck','mar','vis','dec','pos','cmp','wor','agg','pac','acc','sta','str','agi','jmp','ref','han','div','dst','one'];
const AIX={};ATTRS.forEach((a,i)=>AIX[a]=i);
const ATTR_NAME={pas:'Passing',cro:'Crossing',dri:'Dribbling',fir:'First touch',fin:'Finishing',lon:'Long shots',hea:'Heading',tck:'Tackling',mar:'Marking',vis:'Vision',dec:'Decisions',pos:'Positioning',cmp:'Composure',wor:'Work rate',agg:'Aggression',pac:'Pace',acc:'Acceleration',sta:'Stamina',str:'Strength',agi:'Agility',jmp:'Jumping',ref:'Reflexes',han:'Handling',div:'Diving',dst:'Distribution',one:'One-on-ones'};
const ATTR_GROUPS={Technical:['pas','cro','dri','fir','fin','lon','hea','tck','mar'],Mental:['vis','dec','pos','cmp','wor','agg'],Physical:['pac','acc','sta','str','agi','jmp'],Goalkeeping:['ref','han','div','dst','one']};
const GKA=ATTR_GROUPS.Goalkeeping;
const POS=['GK','CB','LB','RB','DM','CM','AM','LW','RW','ST'];
const POS_NAME={GK:'Goalkeeper',CB:'Centre-back',LB:'Left-back',RB:'Right-back',DM:'Defensive midfielder',CM:'Central midfielder',AM:'Attacking midfielder',LW:'Left winger',RW:'Right winger',ST:'Striker'};
const GROUP={GK:'GK',CB:'DEF',LB:'DEF',RB:'DEF',DM:'MID',CM:'MID',AM:'MID',LW:'ATT',RW:'ATT',ST:'ATT'};
const NEAR={GK:[],CB:['DM','RB','LB'],LB:['RB','LW','CB'],RB:['LB','RW','CB'],DM:['CM','CB'],CM:['DM','AM'],AM:['CM','LW','RW','ST'],LW:['RW','AM','LB','ST'],RW:['LW','AM','RB','ST'],ST:['AM','LW','RW']};
const PROF={
 GK:{ref:3,han:3,div:3,dst:1.5,one:2,pos:2,dec:1,cmp:1,jmp:1,agi:1.5},
 CB:{tck:3,mar:3,hea:2.5,pos:2.5,str:2,jmp:2,dec:1.5,pac:1,cmp:1,pas:1,agg:1},
 LB:{tck:2,mar:2,pac:2.5,acc:2,cro:2,sta:2,pos:1.5,pas:1.5,dri:1,wor:1.5,dec:1},
 RB:{tck:2,mar:2,pac:2.5,acc:2,cro:2,sta:2,pos:1.5,pas:1.5,dri:1,wor:1.5,dec:1},
 DM:{tck:2.5,mar:2,pos:2.5,pas:2.5,dec:2,sta:1.5,str:1.5,wor:1.5,vis:1,cmp:1.5},
 CM:{pas:3,vis:2.5,dec:2.5,fir:2,sta:2,wor:1.5,tck:1,dri:1.5,cmp:1.5,lon:1},
 AM:{pas:2.5,vis:3,dri:2.5,fir:2.5,fin:1.5,lon:1.5,dec:2,cmp:2,agi:1.5,acc:1},
 LW:{pac:3,acc:3,dri:3,cro:2,fir:2,fin:1.5,agi:2,pas:1,vis:1,dec:1},
 RW:{pac:3,acc:3,dri:3,cro:2,fir:2,fin:1.5,agi:2,pas:1,vis:1,dec:1},
 ST:{fin:3.5,cmp:2.5,fir:2,hea:2,pos:2,acc:2,pac:1.5,str:1.5,dri:1.5,dec:1.5},
};
function ovrRaw(pos,at){const w=PROF[pos];let s=0,t=0;for(const k in w){s+=at[AIX[k]]*w[k];t+=w[k]}return s/t}
const calcOvr=(pos,at)=>Math.round(ovrRaw(pos,at));
const famil=(p,pos)=>p.pos===pos?1:p.sec.includes(pos)?.97:NEAR[p.pos].includes(pos)?.88:pos==='GK'||p.pos==='GK'?.3:.74;
const rateAt=(p,pos)=>Math.round(calcOvr(pos,p.at)*(p.pos===pos||p.sec.includes(pos)?1:famil(p,pos)+.06));
function genAttrs(rng,pos,target,age){
 const w=PROF[pos],gk=pos==='GK';
 let at=ATTRS.map(a=>{const g=GKA.includes(a);let b;if(gk)b=g||w[a]?((w[a]||1)-1.6)*4:-24+(a==='pas'||a==='sta'?12:0);else b=g?-48:w[a]?(w[a]-1.6)*4:-9;return target+b+rng.n(0,6)});
 if(age>29)for(const a of['pac','acc','sta','agi'])at[AIX[a]]-=(age-29)*1.8;
 if(age<21)for(const a of['dec','cmp','pos','vis'])at[AIX[a]]-=(21-age)*2;
 for(let k=0;k<3;k++){const d=target-ovrRaw(pos,at);at=at.map(v=>v+d)}
 return at.map(v=>clamp(Math.round(v),5,99));
}
// Live valuation: ability, potential, age, current form and contract length. Recomputed every matchday.
function valueOf(p){const af=p.age<=21?1.5:p.age<=24?1.32:p.age<=27?1.08:p.age<=29?.92:p.age<=31?.6:.3;
 const form=p.s&&p.s.ap>=3?clamp(1+(p.s.rs/p.s.ap-6.7)*.24,.8,1.32):1,con=p.con<=1?.62:p.con===2?.86:1;
 return Math.max(25e3,Math.round(6e5*Math.pow(1.116,p.ovr-60)*Math.pow(1.22,clamp(p.ovr-74,0,10))*Math.pow(1.08,Math.max(0,p.ovr-84))*af*(1+Math.max(0,p.pot-p.ovr)/32)*form*con/25e3)*25e3)}
const wageOf=p=>Math.max(500,Math.round(700*Math.pow(1.12,p.ovr-50)*Math.pow(1.08,Math.max(0,p.ovr-80))/100)*100);
function genPlayer(rng,pos,target,club,nat,o={}){
 const pool=NAMES[NATIONS[nat].pool],age=o.age??rng.i(18,33),at=genAttrs(rng,pos,target,age);
 const p={id:0,fn:rng.pick(pool.f),ln:rng.pick(pool.l),nat,pos,sec:NEAR[pos].filter(()=>rng.chance(.3)).slice(0,2),age,at,ovr:calcOvr(pos,at),pot:0,club,num:0,foot:rng.chance(.25)?'L':'R',ht:pos==='GK'?rng.i(185,198):pos==='CB'?rng.i(181,195):rng.i(167,190),cond:100,mor:70,con:rng.i(1,4),s:{ap:0,g:0,a:0,rs:0,mom:0}};
 p.pot=clamp(o.pot??p.ovr+Math.max(0,Math.round((24-age)*rng.f()*2.4)),p.ovr,Math.max(p.ovr,o.pot?96:rng.chance(.05)?93:89));
 p.val=valueOf(p);p.wage=wageOf(p);p.ovr0=p.ovr;p.val0=p.val;return p;
}
function bump(p,d){p.at=p.at.map((v,i)=>{const a=ATTRS[i];const phys=['pac','acc','sta','agi'].includes(a);return clamp(v+(d<0&&phys?d*1.5:d),5,99)});p.ovr=calcOvr(p.pos,p.at);if(p.pot<p.ovr)p.pot=p.ovr;p.val=valueOf(p)}
const NUMS={GK:[1,13,31],CB:[5,4,6,15,24,26],LB:[3,12,33],RB:[2,22,25],DM:[16,8,18],CM:[8,14,18,20,23],AM:[10,19,21],LW:[11,17,27],RW:[7,19,28],ST:[9,10,20,29,39]};
function assignNum(club,pos){const used=new Set(S.clubs[club].squad.map(id=>S.players[id].num));for(const n of NUMS[pos])if(!used.has(n))return n;for(let n=2;n<99;n++)if(!used.has(n))return n;return 99}
const TEMPLATE=['GK','GK','GK','CB','CB','CB','CB','LB','LB','RB','RB','DM','DM','CM','CM','CM','AM','AM','LW','LW','RW','RW','ST','ST','ST'];
const repToOvr=rep=>18+rep*.7;
const budgetOf=rep=>Math.round(2e6*Math.exp((rep-50)*.085)/1e5)*1e5;

/* club identity */
function makeClubIdentity(rng,lang,used){
 let town,name;
 for(let k=0;k<50;k++){const[a,b]=TOWN[lang];town=rng.pick(a)+rng.pick(b);town=town[0].toUpperCase()+town.slice(1);if(!used.has(town))break}
 used.add(town);name=fill(rng.pick(CLUB_FORMS[lang]),{t:town});
 const colors=rng.pick(PALETTES).slice();if(rng.chance(.25))[colors[1],colors[2]]=[colors[2],colors[1]];
 const letters=town.replace(/[^A-Za-zÀ-ÿ]/g,'').toUpperCase();
 const kp=()=>rng.pick(KIT_PATS);
 return{name,short:town,abbr:letters.slice(0,3),colors,crest:[rng.pick(SHAPE_KEYS),rng.pick(DIVS),rng.pick(EMBS),rng.pick(ORNS)],
  stadium:fill(rng.pick(STADIUMS[lang]),{t:town}),est:rng.i(1868,1925),sponsor:rng.pick(SPONSOR_A)+rng.pick(SPONSOR_B),
  kits:{home:{base:colors[0],alt:colors[1],trim:colors[2],pattern:kp(),collar:rng.pick(['crew','v','polo']),shorts:rng.pick([colors[0],colors[1],colors[1],colors[2],'#ffffff','#111318']),socks:rng.pick([colors[0],colors[0],colors[1],colors[2]])},
        away:{base:colors[1],alt:colors[0],trim:colors[0],pattern:kp(),collar:rng.pick(['crew','v'])},
        third:{base:rng.pick(['#151b2b','#2a2f3a','#0f3b2e','#3b0f2a']),alt:colors[0],trim:colors[2]==='#ffffff'?colors[0]:colors[2],pattern:kp(),collar:'polo'}}};
}
