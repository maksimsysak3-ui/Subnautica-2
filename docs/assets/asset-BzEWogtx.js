import{G as ne,a as oe,l as H,m as P,c as W,b as q,p as se,d as K,o as ie}from"./m4-Du0sUTFU.js";const E=8,i={ROOF:0,HOUSING:1,GLASS:2,METAL:3,BRICK:4,TRIM:5,SHOPFRONT:6,TILE:7,HOUSE_WALL:9,SHED_WALL:10};class T{verts=[];idx=[];get triangleCount(){return this.idx.length/3}get vertexCount(){return this.verts.length/E}tri(e,u,d,h){const r=u[0]-e[0],n=u[1]-e[1],t=u[2]-e[2],s=d[0]-e[0],o=d[1]-e[1],c=d[2]-e[2];let a=n*c-t*o,f=t*s-r*c,l=r*o-n*s;const v=Math.hypot(a,f,l)||1;a/=v,f/=v,l/=v;const m=this.vertexCount;for(const g of[e,u,d])this.verts.push(g[0],g[1],g[2],a,f,l,h,1);this.idx.push(m,m+1,m+2)}quad(e,u,d,h,r){this.tri(e,u,d,r),this.tri(e,d,h,r)}box(e,u,d,h={}){const[r,n,t]=e,[s,o,c]=u,a=h.roof??d;this.quad([s,n,c],[s,n,t],[s,o,t],[s,o,c],d),this.quad([r,n,t],[r,n,c],[r,o,c],[r,o,t],d),this.quad([r,n,c],[s,n,c],[s,o,c],[r,o,c],d),this.quad([s,n,t],[r,n,t],[r,o,t],[s,o,t],d),this.quad([r,o,c],[s,o,c],[s,o,t],[r,o,t],a),h.skipBottom===!1&&this.quad([r,n,t],[s,n,t],[s,n,c],[r,n,c],d)}gable(e,u,d,h,r,n){const[t,s,o]=e,[c,,a]=u,f=s+d;if(h==="x"){const l=(o+a)/2;this.quad([t,s,a],[c,s,a],[c,f,l],[t,f,l],r),this.quad([c,s,o],[t,s,o],[t,f,l],[c,f,l],r),this.tri([c,s,a],[c,s,o],[c,f,l],n),this.tri([t,s,o],[t,s,a],[t,f,l],n)}else{const l=(t+c)/2;this.quad([c,s,a],[c,s,o],[l,f,o],[l,f,a],r),this.quad([t,s,o],[t,s,a],[l,f,a],[l,f,o],r),this.tri([t,s,a],[c,s,a],[l,f,a],n),this.tri([c,s,o],[t,s,o],[l,f,o],n)}}cylinder(e,u,d,h,r,n,t,s=!0){for(let o=0;o<n;o++){const c=o/n*Math.PI*2,a=(o+1)/n*Math.PI*2,f=[e+Math.cos(c)*d,h,u+Math.sin(c)*d],l=[e+Math.cos(a)*d,h,u+Math.sin(a)*d],v=[e+Math.cos(a)*d,r,u+Math.sin(a)*d],m=[e+Math.cos(c)*d,r,u+Math.sin(c)*d];this.quad(f,m,v,l,t),s&&this.tri([e,r,u],[e+Math.cos(a)*d,r,u+Math.sin(a)*d],[e+Math.cos(c)*d,r,u+Math.sin(c)*d],t)}}opening(e){const u=e.frame??.11,d=e.proud??.09,h=e.frameMat??i.TRIM,r=.06,n=(s,o,c,a,f,l,v)=>{const m=e.plane+e.sign*Math.min(f,l),g=e.plane+e.sign*Math.max(f,l);e.axis==="x"?this.box([m,c,s],[g,a,o],v):this.box([s,c,m],[o,a,g],v)},t=e.plane-e.sign*r;if(e.axis==="x"){const s=[t,e.y0,e.u0],o=[t,e.y0,e.u1],c=[t,e.y1,e.u1],a=[t,e.y1,e.u0];e.sign>0?this.quad(o,s,a,c,e.glass):this.quad(s,o,c,a,e.glass)}else{const s=[e.u0,e.y0,t],o=[e.u1,e.y0,t],c=[e.u1,e.y1,t],a=[e.u0,e.y1,t];e.sign>0?this.quad(s,o,c,a,e.glass):this.quad(o,s,a,c,e.glass)}n(e.u0-u,e.u1+u,e.y1,e.y1+u,-r,d,h),n(e.u0-u,e.u1+u,e.y0-u,e.y0,-r,d,h),n(e.u0-u,e.u0,e.y0,e.y1,-r,d,h),n(e.u1,e.u1+u,e.y0,e.y1,-r,d,h)}windowRow(e){const u=e.to-e.from;for(let d=0;d<e.count;d++){const h=e.from+(d+.5)/e.count*u;this.opening({axis:e.axis,sign:e.sign,plane:e.plane,u0:h-e.width/2,u1:h+e.width/2,y0:e.y0,y1:e.y1,glass:e.glass,...e.frame!==void 0?{frame:e.frame}:{},...e.proud!==void 0?{proud:e.proud}:{}})}}cone(e,u,d,h,r,n,t,s){for(let o=0;o<t;o++){const c=o/t*Math.PI*2,a=(o+1)/t*Math.PI*2,f=[e+Math.cos(c)*d,r,u+Math.sin(c)*d],l=[e+Math.cos(a)*d,r,u+Math.sin(a)*d];h<.001?this.tri(l,f,[e,n,u],s):this.quad(f,[e+Math.cos(c)*h,n,u+Math.sin(c)*h],[e+Math.cos(a)*h,n,u+Math.sin(a)*h],l,s)}}pipe(e,u,d,h){this.box([Math.min(e[0],u[0])-d,Math.min(e[1],u[1])-d,Math.min(e[2],u[2])-d],[Math.max(e[0],u[0])+d,Math.max(e[1],u[1])+d,Math.max(e[2],u[2])+d],h,{skipBottom:!1})}build(e={}){const u=new Float32Array(this.verts.length);u.set(this.verts);const d=new Uint32Array(this.idx.length);return d.set(this.idx),e.occlusion!==!1&&ce(u,d),{vertices:u,indices:d}}}const L=.34,B=9,re=3.4,ae=.7,_=.62,j=(()=>{const p=[];for(let u=0;u<20;u++){const d=Math.sqrt((u+.5)/20),h=Math.sqrt(1-d*d),r=(u+.5)*Math.PI*(3-Math.sqrt(5));p.push([Math.cos(r)*h,d,Math.sin(r)*h])}return p})();function Y(p,e,u){return(p+512|e+512<<10|u+512<<20)>>>0}function le(p,e){const u=new Set,d=(h,r,n)=>{u.add(Y(Math.floor(h/L),Math.floor(r/L),Math.floor(n/L)))};for(let h=0;h<e.length;h+=3){const r=e[h]*E,n=e[h+1]*E,t=e[h+2]*E,s=p[r],o=p[r+1],c=p[r+2],a=p[n],f=p[n+1],l=p[n+2],v=p[t],m=p[t+1],g=p[t+2],w=Math.max(Math.hypot(a-s,f-o,l-c),Math.hypot(v-s,m-o,g-c),Math.hypot(v-a,m-f,g-l)),b=Math.min(48,Math.max(2,Math.ceil(w/L*1.6)));for(let x=0;x<=b;x++)for(let M=0;M<=b-x;M++){const R=x/b,A=M/b,S=1-R-A;d(s*S+a*R+v*A,o*S+f*R+m*A,c*S+l*R+g*A)}}return u}function ce(p,e){if(e.length===0)return;const u=le(p,e),d=re/B;for(let h=0;h<p.length;h+=E){const r=p[h],n=p[h+1],t=p[h+2],s=p[h+3],o=p[h+4],c=p[h+5];let a=0,f=0,l=0;Math.abs(o)<.9?(a=-c,l=s):a=1;const v=Math.hypot(a,f,l)||1;a/=v,f/=v,l/=v;const m=o*l-c*f,g=c*a-s*l,w=s*f-o*a,b=r+s*_,x=n+o*_,M=t+c*_;let R=0;for(const[S,k,U]of j){const Z=a*S+s*k+m*U,J=f*S+o*k+g*U,Q=l*S+c*k+w*U;for(let O=1;O<=B;O++){const D=O*d,ee=b+Z*D,V=x+J*D,te=M+Q*D;if(V<0){R+=1-(O-1)/B;break}if(u.has(Y(Math.floor(ee/L),Math.floor(V/L),Math.floor(te/L)))){R+=1-(O-1)/B;break}}}const A=1-ae*(R/j.length);p[h+7]=Math.max(.08,Math.min(1,A))}}const y=8,N=p=>p*.39;function de(p){const e=new T,u=p<2,d=7.6,h=10.4,r=5.3,n=d/2,t=h/2,s=N(d);return e.box([-n,0,-t],[n,r,t],i.HOUSE_WALL,{roof:i.TRIM}),e.gable([-n,r,-t],[n,r,t],s,"z",i.TILE,i.HOUSE_WALL),u&&(e.box([-n-.42,r-.3,-t-.42],[n+.42,r,t+.42],i.TRIM),e.box([n-2.6,r+1.4,-1.1],[n-1.5,r+s+1.6,.2],i.BRICK),e.box([-1.5,2.55,t],[1.5,2.85,t+1.25],i.TRIM),e.box([-1.35,0,t+.95],[-1.05,2.55,t+1.2],i.TRIM),e.box([1.05,0,t+.95],[1.35,2.55,t+1.2],i.TRIM),e.box([-1.7,0,t],[1.7,.16,t+1.5],i.TRIM)),e}function ue(p){const e=new T,u=p<1,d=p<2,h=7.4,r=9.8,n=5.4,t=h/2,s=r/2,o=N(h);e.box([-t,0,-s],[t,n,s],i.BRICK,{roof:i.TRIM}),e.gable([-t,n,-s],[t,n,s],o,"z",i.TILE,i.BRICK);const c=4.3,a=3.1,f=-c/2,l=c/2,v=s-.2,m=s+a;if(d){e.box([f,0,v],[l,n-.5,m],i.BRICK,{roof:i.TRIM}),e.gable([f,n-.5,v],[l,n-.5,m],N(c),"x",i.TILE,i.BRICK);const g=t-.3,w=t+4.7;e.box([g,0,-s+1.4],[w,3.1,s-1.6],i.BRICK,{roof:i.TRIM}),e.gable([g,3.1,-s+1.4],[w,3.1,s-1.6],1.5,"z",i.TILE,i.BRICK),e.box([-t-.42,n-.3,-s-.42],[t+.42,n,s+.42],i.TRIM),e.box([f-.36,n-.8,v],[l+.36,n-.5,m+.36],i.TRIM),e.box([g,2.82,-s+1.05],[w+.3,3.1,s-1.25],i.TRIM),e.box([-t-.05,n+.4,-1.6],[-t+1.5,n+2,.1],i.BRICK),e.gable([-t-.2,n+2,-1.75],[-t+1.65,n+2,.25],.7,"z",i.TILE,i.BRICK),e.box([t-2.3,n+1.2,-2.4],[t-1.2,n+o+1.8,-1.1],i.BRICK),e.box([t-2.5,n+o+1.8,-2.6],[t-1,n+o+2.1,-.9],i.TRIM)}if(u){e.box([l+.1,0,m-2.4],[l+3.4,.16,m],i.TRIM),e.box([l+.1,2.6,m-2.6],[l+3.6,2.92,m+.25],i.TRIM);for(const g of[l+.45,l+3.1])e.box([g-.14,.16,m-.4],[g+.14,2.6,m-.12],i.TRIM);for(let g=0;g<8;g++){const w=l+.5+g/7*2.55;e.box([w-.04,.16,m-.32],[w+.04,.98,m-.2],i.TRIM)}e.box([l+.35,.98,m-.38],[l+3.25,1.1,m-.14],i.TRIM);for(let g=0;g<2;g++){const w=.16-g*.07;e.box([l+.5,1e-4,m+.05+g*.24],[l+2.4,w,m+.29+g*.24],i.TRIM)}e.opening({axis:"z",sign:1,plane:m,u0:l+1.1,u1:l+2.1,y0:.16,y1:2.3,glass:i.TRIM,frame:.13,proud:.09}),e.box([f+.5,.3,m],[l-.5,2.9,m+.5],i.BRICK,{roof:i.TRIM}),e.opening({axis:"z",sign:1,plane:m+.5,u0:f+.75,u1:l-.75,y0:.75,y1:2.55,glass:i.GLASS,frame:.1,proud:.07}),e.windowRow({axis:"z",sign:1,plane:m,from:f,to:l,y0:3.3,y1:4.7,count:1,width:1.5,glass:i.GLASS,frame:.1,proud:.07});for(const[g,w]of[[1,t],[-1,-t]])e.windowRow({axis:"x",sign:g,plane:w,from:-s+1.2,to:s-1.2,y0:1.2,y1:2.7,count:2,width:1.2,glass:i.GLASS,frame:.09,proud:.06}),e.windowRow({axis:"x",sign:g,plane:w,from:-s+1.2,to:s-1.2,y0:3.4,y1:4.8,count:2,width:1.2,glass:i.GLASS,frame:.09,proud:.06});e.windowRow({axis:"z",sign:-1,plane:-s,from:-t+1,to:t-1,y0:1.3,y1:2.8,count:2,width:1.3,glass:i.GLASS,frame:.09,proud:.06}),e.windowRow({axis:"z",sign:-1,plane:-s,from:-t+1,to:t-1,y0:3.5,y1:4.9,count:2,width:1.3,glass:i.GLASS,frame:.09,proud:.06}),e.opening({axis:"z",sign:1,plane:.1,u0:-t+.35,u1:-t+1.1,y0:n+.85,y1:n+1.8,glass:i.GLASS,frame:.08,proud:.05}),e.opening({axis:"z",sign:1,plane:s-1.6,u0:t+.4,u1:t+4,y0:.15,y1:2.5,glass:i.TRIM,frame:.12,proud:.09}),e.box([-t-.42,n-.44,s+.24],[t+.42,n-.3,s+.42],i.TRIM),e.box([-t-.42,n-.44,-s-.42],[t+.42,n-.3,-s-.24],i.TRIM);for(const g of[-t-.3,t+.16])e.box([g,0,s+.26],[g+.14,n-.44,s+.4],i.TRIM)}return e}function fe(p){const e=new T,u=y*2-1.6,d=y*2-2.4,h=15.5,r=u/2,n=d/2;return e.box([-r,0,-n],[r,h,n],i.HOUSING,{roof:i.ROOF}),p<2&&e.box([-r-.16,h,-n-.16],[r+.16,h+.8,n+.16],i.TRIM),e}function he(p){const e=new T,u=p<1,d=p<2,h=y*2-1.6,r=y*2-2.4,n=5,t=3.1,s=n*t,o=h/2,c=r/2;if(e.box([-o,0,-c],[o,s,c],i.HOUSING,{roof:i.ROOF}),e.box([-o-.18,s,-c-.18],[o+.18,s+.9,c+.18],i.TRIM),e.box([-o-.22,0,-c-.22],[o+.22,3.4,c+.22],i.BRICK,{roof:i.TRIM}),d){for(let f=1;f<n;f++){const l=3.4+(f-1)*t+.1;for(let v=0;v<4;v++){const m=-o+(v+.5)/4*h;for(const[g,w]of[[c,1],[-c,-1]]){const b=1.25*w;e.box([m-1.4,l,Math.min(g,g+b)],[m+1.4,l+.16,Math.max(g,g+b)],i.TRIM);const x=g+b;e.box([m-1.4,l+.16,Math.min(x,x-.1*w)],[m+1.4,l+1.16,Math.max(x,x-.1*w)],i.TRIM)}}}e.box([-1.6,s,-1.4],[1.6,s+3,1.4],i.BRICK,{roof:i.ROOF}),e.box([o-3.6,s+.9,-2.2],[o-1.4,s+2.1,.6],i.METAL)}if(u){for(let a=0;a<n;a++){const f=3.4+(a-1)*t+.9;if(a!==0){for(const[l,v]of[[1,c],[-1,-c]])e.windowRow({axis:"z",sign:l,plane:v,from:-o+.8,to:o-.8,y0:f,y1:f+1.5,count:3,width:1.15,glass:i.GLASS,frame:.08,proud:.06});for(const[l,v]of[[1,o],[-1,-o]])e.windowRow({axis:"x",sign:l,plane:v,from:-c+.8,to:c-.8,y0:f,y1:f+1.5,count:2,width:1.25,glass:i.GLASS,frame:.08,proud:.06})}}for(const[a,f]of[[1,c],[-1,-c]])e.windowRow({axis:"z",sign:a,plane:f,from:-o+.9,to:o-.9,y0:.9,y1:2.9,count:3,width:1.7,glass:i.SHOPFRONT,frame:.1,proud:.07})}return e}function pe(p){const e=new T,u=y*3-2.4,d=y*3-2.4,h=u/2,r=d/2,n=9,t=62;e.box([-h,0,-r],[h,n,r],i.HOUSING,{roof:i.ROOF});const s=h*.72,o=r*.72;return e.box([-s,n,-o],[s,t,o],i.HOUSING,{roof:i.ROOF}),p<2&&e.box([-s-.2,t,-o-.2],[s+.2,t+1.1,o+.2],i.TRIM),e}function me(p){const e=new T,u=p<1,d=p<2,h=y*3-2.4,r=y*3-2.4,n=h/2,t=r/2,s=9.5,o=19,c=3.05,a=s+o*c,f=n*.7,l=t*.7;if(e.box([-n,0,-t],[n,s,t],i.BRICK,{roof:i.ROOF}),e.box([-n-.25,s,-t-.25],[n+.25,s+.7,t+.25],i.TRIM),e.box([-f,s,-l],[f,a,l],i.HOUSING,{roof:i.ROOF}),d){for(let m=0;m<=5;m++){const g=m/5,w=-f+g*f*2,b=-l+g*l*2;e.box([w-.16,s,l],[w+.16,a,l+.34],i.TRIM),e.box([w-.16,s,-l-.34],[w+.16,a,-l],i.TRIM),e.box([f,s,b-.16],[f+.34,a,b+.16],i.TRIM),e.box([-f-.34,s,b-.16],[-f,a,b+.16],i.TRIM)}for(let m=2;m<o;m+=3){const g=s+m*c;e.box([-f-.9,g,-l-.9],[f+.9,g+.18,l+.9],i.TRIM),e.box([-f-.9,g+.18,l+.78],[f+.9,g+1.1,l+.9],i.TRIM),e.box([-f-.9,g+.18,-l-.9],[f+.9,g+1.1,-l-.78],i.TRIM)}e.box([-f-.3,a,-l-.3],[f+.3,a+1.4,l+.3],i.TRIM),e.box([-f*.55,a,-l*.55],[f*.55,a+4.2,l*.55],i.METAL,{roof:i.ROOF}),e.box([-.22,a+4.2,-.22],[.22,a+11,.22],i.TRIM)}if(u){for(let v=0;v<o;v++){const m=s+v*c+.85,g=m+1.55;for(const[w,b]of[[1,l],[-1,-l]])e.opening({axis:"z",sign:w,plane:b,u0:-f+.75,u1:f-.75,y0:m,y1:g,glass:i.GLASS,frame:.09,proud:.05});for(const[w,b]of[[1,f],[-1,-f]])e.opening({axis:"x",sign:w,plane:b,u0:-l+.75,u1:l-.75,y0:m,y1:g,glass:i.GLASS,frame:.09,proud:.05})}for(const[v,m]of[[1,t],[-1,-t]])e.windowRow({axis:"z",sign:v,plane:m,from:-n+1,to:n-1,y0:1,y1:3.6,count:4,width:2.2,glass:i.SHOPFRONT,frame:.11,proud:.08})}return e}const z=p=>p*1.6,ge=[{id:"res.low.shaded",name:"Detached house",zone:"residential",density:"low",variant:"shaded",footprint:[2,2],height:9.7,sim:{households:1,powerKW:z(1),waterM3:.6,garbagePerWeek:12,pollution:0,upkeep:6},note:"Box, gable, chimney. Brick coursework, windows and door are all shader.",build:de},{id:"res.low.sculpted",name:"Detached house, modelled",zone:"residential",density:"low",variant:"sculpted",footprint:[2,2],height:10.4,sim:{households:1,powerKW:z(1),waterM3:.6,garbagePerWeek:12,pollution:0,upkeep:7},note:"Garage wing, eaves, porch, dormers, window reveals — the same house with the detail built.",build:ue},{id:"res.mid.shaded",name:"Apartment block",zone:"residential",density:"medium",variant:"shaded",footprint:[2,2],height:16.3,sim:{households:24,powerKW:z(24),waterM3:14,garbagePerWeek:260,pollution:1,upkeep:48},note:"Slab and a parapet. Every window and floor line is drawn by the shader.",build:fe},{id:"res.mid.sculpted",name:"Apartment block, balconied",zone:"residential",density:"medium",variant:"sculpted",footprint:[2,2],height:18.5,sim:{households:24,powerKW:z(24),waterM3:14,garbagePerWeek:260,pollution:1,upkeep:54},note:"Balconies on all four elevations, a masonry base, stair core and roof plant.",build:he},{id:"res.high.shaded",name:"Residential tower",zone:"residential",density:"high",variant:"shaded",footprint:[3,3],height:63,sim:{households:180,powerKW:z(180),waterM3:96,garbagePerWeek:1900,pollution:2,upkeep:340},note:"Podium, setback, tower, parapet. Four boxes.",build:pe},{id:"res.high.sculpted",name:"Residential tower, finned",zone:"residential",density:"high",variant:"sculpted",footprint:[3,3],height:79,sim:{households:180,powerKW:z(180),waterM3:96,garbagePerWeek:1900,pollution:2,upkeep:380},note:"Vertical fins the full height, balcony bands every third floor, crown and mast.",build:me}];function ve(p){const e=new T,u=y*2-1.4,d=y*2-2,h=u/2,r=d/2,n=4.6,t=24;return e.box([-h,0,-r],[h,n,r],i.SHOPFRONT,{roof:i.TRIM}),e.box([-h,n,-r],[h,t,r],i.GLASS,{roof:i.ROOF}),p<2&&e.box([-h-.2,t,-r-.2],[h+.2,t+1,r+.2],i.TRIM),e}function we(p){const e=new T,u=p<1,d=p<2,h=y*2-1.4,r=y*2-2,n=h/2,t=r/2,s=5,o=7,c=3.6,a=s+o*c;if(e.box([-n+.5,0,-t+.5],[n-.5,s,t-.5],i.SHOPFRONT,{roof:i.TRIM}),e.box([-n,s,-t],[n,a,t],i.GLASS,{roof:i.ROOF}),d){for(const f of[-1,1])for(const l of[-1,1])e.box([f*n-f*.55,0,l*t-l*.55],[f*n,s,l*t],i.TRIM);e.box([-n-.9,s-.7,-t-.9],[n+.9,s-.42,t+.9],i.TRIM);for(let f=1;f<=o;f++){const l=s+f*c-.5;e.box([-n-.14,l,-t-.14],[n+.14,l+.5,t+.14],i.TRIM)}e.box([-n-.42,a,-t-.42],[n+.42,a+1.3,t+.42],i.TRIM),e.box([-2.6,a,-1.9],[1.4,a+2.6,1.9],i.METAL,{roof:i.ROOF}),e.box([2,a,-2.4],[4.2,a+1.2,-.2],i.METAL),e.cylinder(3,1.8,.85,a,a+1.9,10,i.METAL)}if(u){for(let f=0;f<o;f++){const l=s+f*c+.35,v=l+c-1.05;for(const[m,g]of[[1,t],[-1,-t]])e.windowRow({axis:"z",sign:m,plane:g,from:-n+.6,to:n-.6,y0:l,y1:v,count:2,width:4.6,glass:i.GLASS,frame:.07,proud:.05});for(const[m,g]of[[1,n],[-1,-n]])e.windowRow({axis:"x",sign:m,plane:g,from:-t+.6,to:t-.6,y0:l,y1:v,count:2,width:4,glass:i.GLASS,frame:.07,proud:.05})}for(const[f,l]of[[1,t-.5],[-1,-t+.5]])e.windowRow({axis:"z",sign:f,plane:l,from:-n+1.2,to:n-1.2,y0:.7,y1:4.1,count:3,width:3,glass:i.SHOPFRONT,frame:.12,proud:.08})}return e}const be=[{id:"com.shaded",name:"Retail and offices",zone:"commercial",density:"medium",variant:"shaded",footprint:[2,2],height:25,sim:{jobs:90,powerKW:210,waterM3:22,garbagePerWeek:480,pollution:2,upkeep:160},note:"Two boxes: shopfront base, glass above. Mullions and signage are shader.",build:ve},{id:"com.sculpted",name:"Retail and offices, articulated",zone:"commercial",density:"medium",variant:"sculpted",footprint:[2,2],height:31,sim:{jobs:90,powerKW:210,waterM3:22,garbagePerWeek:480,pollution:2,upkeep:175},note:"Recessed shopfront on columns, pavement canopy, spandrel band per floor, cornice, roof plant.",build:we}];function xe(p){const e=new T,u=p<2,d=25,h=17,r=9.2,n=2.6,t=d/2,s=h/2,o=-1.5;if(e.box([-t,0,o-s],[t,r,o+s],i.SHED_WALL,{roof:i.TRIM}),e.gable([-t,r,o-s],[t,r,o+s],n,"x",i.METAL,i.SHED_WALL),u){e.box([-t-.45,r-.35,o-s-.45],[t+.45,r,o+s+.45],i.TRIM),e.box([-t,r+n-.18,o-.35],[t,r+n+.2,o+.35],i.TRIM);for(let c=0;c<3;c++){const a=-t+4.6+c*7.4;e.box([a-2.2,0,o+s-.05],[a+2.2,5,o+s+.16],i.TRIM),e.box([a-2.4,5,o+s-.05],[a+2.4,5.35,o+s+.3],i.TRIM)}e.box([-t+.6,6.4,o+s],[t-.6,6.75,o+s+2.6],i.METAL),e.box([t-3.4,0,o+s-.05],[t-2.2,2.4,o+s+.14],i.TRIM),e.box([-t+.8,0,o+s],[t-.8,1.15,o+s+2.4],i.TRIM),e.cylinder(-5,o,.7,r+n-.4,r+n+1.3,10,i.METAL),e.cylinder(5,o,.7,r+n-.4,r+n+1.3,10,i.METAL)}return e}function ye(p){const e=new T,u=p<1,d=p<2,h=17,r=13,n=10.5,t=-32/2+h/2+1,s=.4,o=t-h/2,c=t+h/2,a=s-r/2,f=s+r/2;if(e.box([o,0,a],[c,n,f],i.METAL,{roof:i.ROOF}),d){const v=h/5,m=3.4;for(let w=0;w<5;w++){const b=o+w*v,x=b+v;e.quad([b,n,f],[x,n,f],[x,n+m,a],[b,n+m,a],i.METAL),e.quad([b,n,a],[b,n+m,a],[x,n+m,a],[x,n,a],i.GLASS),e.tri([b,n,f],[b,n+m,a],[b,n,a],i.METAL),e.tri([x,n,f],[x,n,a],[x,n+m,a],i.METAL)}e.box([c-5,0,a-5.6],[c+3.2,17.5,a+.4],i.METAL,{roof:i.ROOF}),e.box([c-5.3,17.5,a-5.9],[c+3.5,18.3,a+.7],i.TRIM);const g=(w,b,x,M)=>{e.cylinder(w,b,x*1.06,0,1.1,14,i.TRIM),e.cylinder(w,b,x,1.1,M,16,i.METAL,!1),e.cone(w,b,x,x*.34,M,M+x*.8,16,i.METAL),e.cylinder(w,b,x*.34,M+x*.8,M+x*1.1,10,i.TRIM)};g(7,-4,2.5,15),g(7,2.6,2,12),g(12.4,-1.2,1.6,9.5),e.cylinder(13.2,-7.6,1.15,0,23,12,i.TRIM,!1);for(const w of[7,13,19])e.cylinder(13.2,-7.6,1.3,w,w+.55,12,i.METAL,!1);e.box([o+1,0,f],[c-1,1.2,f+2],i.TRIM);for(let w=0;w<2;w++){const b=o+4.6+w*7;e.box([b-2,1.2,f-.1],[b+2,5.6,f+.12],i.TRIM)}e.box([o+.6,6.2,f],[c-.6,6.55,f+2.4],i.METAL),e.box([o-.4,0,f-6.4],[o+4.6,4,f-1.4],i.BRICK,{roof:i.ROOF}),e.box([o-.7,4,f-6.7],[o+4.9,4.45,f-1.1],i.TRIM)}if(u){for(const[l,v]of[[1,f],[-1,a]])e.windowRow({axis:"z",sign:l,plane:v,from:o+1.2,to:c-1.2,y0:6.8,y1:8.6,count:5,width:2.1,glass:i.GLASS,frame:.09,proud:.06});e.opening({axis:"z",sign:1,plane:f-1.4,u0:o+1.6,u1:o+2.6,y0:.1,y1:2.3,glass:i.TRIM,frame:.1,proud:.07}),e.windowRow({axis:"z",sign:1,plane:f-1.4,from:o+3,to:o+4.4,y0:1.2,y1:2.7,count:1,width:1.2,glass:i.GLASS,frame:.09,proud:.06}),e.windowRow({axis:"x",sign:-1,plane:o-.4,from:f-5.8,to:f-2,y0:1.2,y1:2.7,count:3,width:.9,glass:i.GLASS,frame:.09,proud:.06});for(let l=0;l<4;l++){const v=1+l*3.6;e.box([v-.18,0,-6.6],[v+.18,6.4,-6.24],i.TRIM),e.box([v-.18,0,-1],[v+.18,6.4,-.64],i.TRIM),e.box([v-.24,6.4,-6.7],[v+.24,6.9,-.54],i.TRIM)}for(const l of[-5.6,-4.2,-2.4])e.pipe([.4,6.9,l],[14,6.9,l],.22,i.METAL);e.pipe([7,6.9,-4],[7,14,-4],.2,i.METAL),e.pipe([7,6.9,2.6],[7,11.4,2.6],.2,i.METAL);for(let l=0;l<14;l++){const v=1+l*1.15;e.box([c+3.2,v,a-5.2+l*.32],[c+4.6,v+.12,a-4.6+l*.32],i.TRIM)}e.box([c+3.1,.8,a-5.4],[c+3.3,17.4,a-.6],i.TRIM),e.box([c+4.5,.8,a-5.4],[c+4.7,17.4,a-.6],i.TRIM);for(let l=0;l<16;l++){const v=1.4+l*.85;e.box([9.3,v,-4.2],[9.9,v+.09,-3.8],i.TRIM)}for(let l=0;l<12;l++){const v=l/12*Math.PI*2;e.box([7+Math.cos(v)*2.7-.06,15,-4+Math.sin(v)*2.7-.06],[7+Math.cos(v)*2.7+.06,16.1,-4+Math.sin(v)*2.7+.06],i.TRIM)}e.cylinder(7,-4,2.76,15,15.12,14,i.TRIM,!1);for(let l=0;l<3;l++)e.cylinder(o+3.4+l*4.6,s+3,.6,n+3.4,n+4.7,10,i.METAL)}return e}const Me=[{id:"ind.shaded",name:"Distribution shed",zone:"industrial",density:"none",variant:"shaded",footprint:[4,3],height:13.1,sim:{jobs:40,powerKW:130,waterM3:8,garbagePerWeek:300,pollution:8,upkeep:90},note:"Shed, shutters, canopy, apron. Corrugation and the clerestory band are shader.",build:xe},{id:"ind.sculpted",name:"Processing plant",zone:"industrial",density:"none",variant:"sculpted",footprint:[4,3],height:23,sim:{jobs:40,powerKW:130,waterM3:8,garbagePerWeek:300,pollution:14,upkeep:105},note:"Sawtooth shed, process block, three silos, banded stack, pipe rack, access stairs, dock.",build:ye}],I=[...ge,...be,...Me],Te=`// Facade shading for procedural assets.
//
// Three things carry the look, in order of how much they matter:
//
//   1. Baked ambient occlusion, in the 8th vertex float. Dark inside corners,
//      dark where a wall meets the ground, dark under eaves and balconies.
//      Without it a building is a lit box; with it, it is a building.
//   2. A directional shadow map. Self-shadowing is what puts a roof over a
//      wall and a balcony over the window beneath it.
//   3. Patterns computed from world position -- brick courses, punched
//      windows, curtain-wall mullions, corrugated metal -- with no textures
//      and no UVs. Facade coordinates come from the face normal: a wall facing
//      X uses (z, y), a wall facing Z uses (x, y), a horizontal surface uses
//      (x, z). Because the coordinate is world-space, window rows line up
//      across every wall of a building and across neighbours on the same
//      street without anything being authored.
//
// Two consequences of (3). Facades must be axis-aligned, which these buildings
// are. And every pattern has to fade out as its features approach pixel size,
// or a zoomed-out city turns into aliasing soup -- the lesson the terrain grid
// taught, applied per material.

struct Scene {
  viewProj    : mat4x4f,
  sunViewProj : mat4x4f,
  eye         : vec4f,
  sunDir      : vec4f,
  // x = per-building seed, y = shadow map texel size, z = ground fade radius
  params      : vec4f,
};

@group(0) @binding(0) var<uniform> scene : Scene;
@group(0) @binding(1) var shadowMap : texture_depth_2d;
@group(0) @binding(2) var shadowSampler : sampler_comparison;

const MAT_ROOF      = 0u;
const MAT_HOUSING   = 1u;
const MAT_GLASS     = 2u;
const MAT_METAL     = 3u;
const MAT_BRICK     = 4u;
const MAT_TRIM      = 5u;
const MAT_SHOPFRONT = 6u;
const MAT_TILE      = 7u;
const MAT_GROUND    = 8u;
const MAT_HOUSE     = 9u;
const MAT_SHED      = 10u;

struct VSOut {
  @builtin(position) pos      : vec4f,
  @location(0)       world    : vec3f,
  @location(1)       normal   : vec3f,
  @location(2)       ao       : f32,
  @location(3) @interpolate(flat) material : u32,
};

@vertex
fn vs(@location(0) position : vec3f,
      @location(1) normal   : vec3f,
      @location(2) material : f32,
      @location(3) ao       : f32) -> VSOut {
  var out : VSOut;
  out.world = position;
  out.normal = normal;
  out.ao = ao;
  out.material = u32(material + 0.5);
  out.pos = scene.viewProj * vec4f(position, 1.0);
  return out;
}

/** Depth-only pass from the sun's point of view. */
@vertex
fn vs_shadow(@location(0) position : vec3f) -> @builtin(position) vec4f {
  return scene.sunViewProj * vec4f(position, 1.0);
}

// ---------------------------------------------------------------- utilities

fn hash11(x : f32) -> f32 {
  return fract(sin(x * 127.1) * 43758.5453);
}

fn hash21(p : vec2f) -> f32 {
  let q = fract(p * vec2f(0.1031, 0.1030));
  let r = q + dot(q, q.yx + 33.33);
  return fract((r.x + r.y) * r.x * 47.0);
}

/** Facade coordinates in metres, chosen by which way the surface faces. */
fn facadeUV(world : vec3f, n : vec3f) -> vec2f {
  if (abs(n.y) > 0.6) { return world.xz; }
  if (abs(n.x) > abs(n.z)) { return vec2f(world.z, world.y); }
  return vec2f(world.x, world.y);
}

// Every pattern below takes \`mpp\` -- metres per pixel -- rather than calling
// fwidth itself. WGSL requires derivatives in uniform control flow and the
// material switch is anything but, so it is measured once in the fragment
// entry point and threaded through.

fn resolvable(feature : f32, mpp : f32) -> f32 {
  return smoothstep(1.2, 4.0, feature / mpp);
}

fn inRect(p : vec2f, centre : vec2f, half : vec2f, mpp : f32) -> f32 {
  let d = abs(p - centre) - half;
  let aa = mpp * 1.1 + 1e-5;
  return 1.0 - smoothstep(-aa, aa, max(d.x, d.y));
}

fn stripe(v : f32, spacing : f32, width : f32, mpp : f32) -> f32 {
  let c = v / spacing;
  let d = abs(fract(c) - 0.5) * spacing;
  let aa = mpp * 0.8 + 1e-5;
  return 1.0 - smoothstep(width - aa, width + aa, d);
}

// ----------------------------------------------------------------- palettes
//
// Each building draws its colours from the seed, so a street of the same
// prototype is not a street of clones. Real cities vary far more in colour
// than in shape, and this is by a distance the cheapest variety available.

fn brickColour(seed : f32) -> vec3f {
  let r = hash11(seed * 1.7);
  if (r < 0.34) { return vec3f(0.372, 0.192, 0.145); }   // red stock
  if (r < 0.58) { return vec3f(0.404, 0.310, 0.216); }   // buff
  if (r < 0.80) { return vec3f(0.286, 0.230, 0.208); }   // dark multi
  return vec3f(0.470, 0.404, 0.348);                     // pale grey
}

fn renderColour(seed : f32) -> vec3f {
  let r = hash11(seed * 3.1 + 4.0);
  if (r < 0.26) { return vec3f(0.560, 0.520, 0.440); }   // cream
  if (r < 0.48) { return vec3f(0.400, 0.412, 0.396); }   // grey-green
  if (r < 0.68) { return vec3f(0.470, 0.452, 0.428); }   // warm grey
  if (r < 0.86) { return vec3f(0.352, 0.372, 0.400); }   // cool grey
  return vec3f(0.520, 0.436, 0.384);                     // sand
}

fn tileColour(seed : f32) -> vec3f {
  let r = hash11(seed * 5.3 + 9.0);
  if (r < 0.36) { return vec3f(0.318, 0.168, 0.116); }   // terracotta
  if (r < 0.66) { return vec3f(0.196, 0.200, 0.212); }   // slate
  return vec3f(0.232, 0.184, 0.152);                     // brown
}

fn glassColour(seed : f32) -> vec3f {
  let r = hash11(seed * 7.9 + 2.0);
  if (r < 0.40) { return vec3f(0.086, 0.128, 0.156); }   // blue
  if (r < 0.72) { return vec3f(0.092, 0.132, 0.120); }   // green
  return vec3f(0.120, 0.122, 0.134);                     // neutral
}

fn metalColour(seed : f32) -> vec3f {
  let r = hash11(seed * 11.3 + 6.0);
  if (r < 0.38) { return vec3f(0.400, 0.416, 0.424); }   // galvanised
  if (r < 0.66) { return vec3f(0.318, 0.360, 0.384); }   // blue-grey
  return vec3f(0.336, 0.372, 0.336);                     // green-grey
}

// ----------------------------------------------------------------- patterns

fn housing(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let bay = 3.0;
  let floorH = 3.05;
  let wall = renderColour(seed);

  let cell = vec2f(bay, floorH);
  let id = floor(uv / cell);
  let p = (uv / cell - id) * cell;

  let centre = vec2f(bay * 0.5, 1.62);
  let win = inRect(p, centre, vec2f(0.72, 0.72), mpp);
  // A darker ring just outside the glass fakes the reveal, so even the
  // 20-triangle variant has openings that sit in the wall rather than on it.
  let reveal = inRect(p, centre, vec2f(0.84, 0.84), mpp) - win;

  let r = hash21(id + seed);
  var glass = glassColour(seed) * (0.72 + r * 0.85);
  if (r > 0.88) { glass = vec3f(0.66, 0.58, 0.38); }     // a lit room

  var col = mix(wall, wall * 0.62, reveal);
  col = mix(col, glass, win);
  // Sill under each opening.
  col = mix(col, wall * 1.24, inRect(p, vec2f(bay * 0.5, 0.84), vec2f(0.88, 0.055), mpp));
  // Floor line, faint.
  col = mix(col, wall * 0.88, stripe(uv.y, floorH, 0.03, mpp) * 0.5);
  return mix(wall, col, resolvable(1.4, mpp));
}

fn curtainWall(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let floorH = 3.6;
  let mullion = 1.5;
  let glass = glassColour(seed);
  let spandrel = mix(renderColour(seed), vec3f(0.2), 0.35);

  let band = step(fract(uv.y / floorH), 0.26);
  var col = mix(glass, spandrel, band);

  // Per-pane variation: reflections of sky and of the building opposite never
  // match pane to pane, and a curtain wall without that reads as painted-on.
  let id = floor(vec2f(uv.x / mullion, uv.y / floorH));
  let r = hash21(id + seed * 1.7);
  col = mix(col, col * (0.62 + r * 1.05), 1.0 - band);
  if (r > 0.94) { col = mix(col, vec3f(0.56, 0.52, 0.40), 0.55 * (1.0 - band)); }

  let bars = max(stripe(uv.x, mullion, 0.035, mpp), stripe(uv.y, floorH, 0.05, mpp));
  col = mix(col, vec3f(0.30, 0.31, 0.33), bars * resolvable(0.8, mpp));
  return mix(glass, col, resolvable(1.8, mpp));
}

fn corrugated(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let base = metalColour(seed);
  // Ribs shaded by a cosine rather than a drawn line, so they read as a folded
  // sheet catching light rather than as stripes painted on a flat wall.
  let rib = cos(uv.x * 6.2831853 / 0.28) * 0.5 + 0.5;
  var col = base * (0.80 + rib * 0.38);
  col = mix(col, base * 0.70, stripe(uv.y, 2.4, 0.03, mpp));
  // Streaking below the seams. Industrial buildings are never clean.
  let streak = hash21(vec2f(floor(uv.x * 3.0), 0.0) + seed) * 0.10;
  col = mix(col, col * (1.0 - streak), fract(uv.y / 2.4));
  return mix(base, col, resolvable(0.28, mpp));
}

fn brick(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let course = 0.085;
  let brickLen = 0.24;
  let row = floor(uv.y / course);
  // Every other course offset by half a brick: running bond, not stack bond.
  let offset = fract(row * 0.5) * brickLen;
  let mortar = max(stripe(uv.y, course, 0.011, mpp), stripe(uv.x + offset, brickLen, 0.011, mpp));
  let r = hash21(vec2f(floor((uv.x + offset) / brickLen), row) + seed);
  let body = brickColour(seed) * (0.80 + r * 0.40);
  return mix(body, vec3f(0.46, 0.45, 0.435), mortar * 0.65 * resolvable(0.085, mpp));
}

/**
 * Brick with punched windows, sills and a door.
 *
 * The composite materials exist so a 26-triangle house still has openings.
 * Sculpted variants model theirs and use plain BRICK instead; drawing both
 * would put a painted window inside a modelled one.
 */
fn houseWall(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  var col = brick(uv, mpp, seed);

  let bay = 3.1;
  let floorH = 2.85;
  let cell = vec2f(bay, floorH);
  let id = floor(uv / cell);
  let p = (uv / cell - id) * cell;

  // Ground floor windows sit higher off the floor than upper ones, and one
  // bay per building is a door instead.
  let isGround = f32(uv.y < floorH);
  let centre = vec2f(bay * 0.5, mix(1.62, 1.32, isGround));
  let half = vec2f(0.62, mix(0.62, 0.68, isGround));

  let r = hash21(id + seed);
  let win = inRect(p, centre, half, mpp);
  let reveal = inRect(p, centre, half + vec2f(0.14), mpp) - win;

  var glass = glassColour(seed) * (0.66 + r * 0.8);
  if (r > 0.85) { glass = vec3f(0.60, 0.53, 0.35); }

  col = mix(col, col * 0.55, reveal);
  col = mix(col, glass, win);
  // Lintel over each opening, and a sill under it.
  col = mix(col, vec3f(0.60, 0.58, 0.55), inRect(p, vec2f(bay * 0.5, centre.y + half.y + 0.12), vec2f(half.x + 0.18, 0.06), mpp));
  col = mix(col, vec3f(0.62, 0.60, 0.57), inRect(p, vec2f(bay * 0.5, centre.y - half.y - 0.09), vec2f(half.x + 0.20, 0.055), mpp));

  // A door in one ground-floor bay.
  let doorBay = floor(hash11(seed * 2.3) * 3.0);
  if (isGround > 0.5 && abs(id.x - doorBay) < 0.5) {
    let door = inRect(p, vec2f(bay * 0.5, 1.05), vec2f(0.44, 1.02), mpp);
    col = mix(col, vec3f(0.20, 0.16, 0.13), door);
  }
  return mix(brick(uv, mpp, seed), col, resolvable(1.2, mpp));
}

/** Corrugated metal with a clerestory band, the way a shed is actually lit. */
fn shedWall(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  var col = corrugated(uv, mpp, seed);

  // A glazed band every 12 m of height. Generic rather than placed, because
  // the shader has no idea how tall the building is -- one band lands on any
  // shed between about 7 and 19 metres, which is all of them.
  let band = fract(uv.y / 12.0);
  let inBand = smoothstep(0.545, 0.565, band) * (1.0 - smoothstep(0.715, 0.735, band));
  let pane = stripe(uv.x, 2.1, 0.06, mpp);
  var glass = glassColour(seed) * 0.75;
  glass = mix(glass, vec3f(0.30, 0.32, 0.33), pane);
  col = mix(col, glass, inBand * resolvable(1.6, mpp));

  // Sill flashing under the band.
  col = mix(col, vec3f(0.46, 0.48, 0.50), inBand * 0.0 + stripe(uv.y - 6.55, 12.0, 0.06, mpp) * 0.5);
  return col;
}

fn shopfront(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let glass = glassColour(seed) * 0.8;
  let stall = renderColour(seed) * 0.5;
  var col = mix(glass, stall, step(uv.y, 0.55));
  // Lit interiors and signage: shops are the brightest thing at street level
  // and the main reason a night city reads as inhabited.
  let bay = floor(uv.x / 2.6);
  let r = hash11(bay * 1.31 + seed);
  if (r > 0.45) {
    col = mix(col, vec3f(0.62, 0.56, 0.42) * (0.6 + r * 0.7), (1.0 - step(uv.y, 0.55)) * 0.6);
  }
  col = mix(col, vec3f(0.28, 0.29, 0.30), stripe(uv.x, 2.6, 0.05, mpp) * resolvable(1.4, mpp));
  return col;
}

fn tiles(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let base = tileColour(seed);
  let course = 0.30;
  let r = hash21(floor(uv / vec2f(0.22, course)) + seed);
  let col = base * (0.84 + r * 0.34);
  return mix(base, mix(col, base * 0.66, stripe(uv.y, course, 0.022, mpp)), resolvable(0.30, mpp));
}

fn roofDeck(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let base = vec3f(0.168, 0.174, 0.180);
  let r = hash21(floor(uv / 1.1) + seed);
  var col = base * (0.86 + r * 0.30);
  // Seams in the membrane, and a little staining.
  col = mix(col, col * 0.86, stripe(uv.x, 1.1, 0.02, mpp) * resolvable(1.1, mpp));
  return col;
}

fn ground(uv : vec2f, mpp : f32) -> vec3f {
  let base = vec3f(0.085, 0.092, 0.100);
  let r = hash21(floor(uv / 0.9));
  var col = base * (0.9 + r * 0.2);
  // The 8 m zoning cell, so an asset's size is readable against the grid the
  // simulation actually uses.
  col = mix(col, vec3f(0.150, 0.176, 0.200), stripe(uv.x, 8.0, 0.035, mpp) * resolvable(8.0, mpp) * 0.8);
  col = mix(col, vec3f(0.150, 0.176, 0.200), stripe(uv.y, 8.0, 0.035, mpp) * resolvable(8.0, mpp) * 0.8);
  return col;
}

fn albedo(mat : u32, uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  switch (mat) {
    case 1u: { return housing(uv, mpp, seed); }
    case 2u: { return curtainWall(uv, mpp, seed); }
    case 3u: { return corrugated(uv, mpp, seed); }
    case 4u: { return brick(uv, mpp, seed); }
    case 5u: { return mix(renderColour(seed), vec3f(0.62), 0.55); }
    case 6u: { return shopfront(uv, mpp, seed); }
    case 7u: { return tiles(uv, mpp, seed); }
    case 8u: { return ground(uv, mpp); }
    case 9u: { return houseWall(uv, mpp, seed); }
    case 10u: { return shedWall(uv, mpp, seed); }
    default: { return roofDeck(uv, mpp, seed); }
  }
}

// ------------------------------------------------------------------ shadows

fn shadowFactor(world : vec3f, ndl : f32) -> f32 {
  let lightSpace = scene.sunViewProj * vec4f(world, 1.0);
  let ndc = lightSpace.xyz / lightSpace.w;
  let uv = ndc.xy * vec2f(0.5, -0.5) + 0.5;

  // Outside the shadow volume, or past the far plane, nothing is shadowed.
  // Computed as a weight rather than an early return: textureSampleCompare,
  // like fwidth, must be reached in uniform control flow, so the sampling has
  // to happen for every fragment and the result is blended afterwards.
  let outside = f32(uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || ndc.z > 1.0);
  let safeUV = clamp(uv, vec2f(0.001), vec2f(0.999));

  // Slope-scaled bias: a surface nearly edge-on to the sun needs far more
  // bias than one facing it, and a single constant either acnes the flat
  // faces or peters the contact shadows away.
  let bias = clamp(0.0016 * tan(acos(clamp(ndl, 0.0, 1.0))), 0.0006, 0.006);
  let texel = scene.params.y;

  var sum = 0.0;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let o = vec2f(f32(x), f32(y)) * texel;
      sum += textureSampleCompare(shadowMap, shadowSampler, safeUV + o, ndc.z - bias);
    }
  }
  return mix(sum / 9.0, 1.0, outside);
}

// ----------------------------------------------------------------- fragment

@fragment
fn fs(in : VSOut) -> @location(0) vec4f {
  let n = normalize(in.normal);
  let uv = facadeUV(in.world, n);
  // Taken here, in uniform control flow, then passed down.
  let mpp = max(max(fwidth(uv.x), fwidth(uv.y)), 1e-6);
  let seed = scene.params.x;
  var col = albedo(in.material, uv, mpp, seed);

  let sun = normalize(scene.sunDir.xyz);
  let ndl = dot(n, sun);
  let shadow = shadowFactor(in.world, ndl);

  // Sky above, bounce from the ground below, both modulated by occlusion.
  let sky = vec3f(0.34, 0.40, 0.50);
  let bounce = vec3f(0.24, 0.21, 0.18);
  let ambient = mix(bounce, sky, n.y * 0.5 + 0.5) * in.ao;

  let sunColour = vec3f(1.02, 0.94, 0.80);
  let direct = sunColour * max(ndl, 0.0) * shadow * 1.15;

  col = col * (ambient + direct);

  // Specular on the smooth materials only. Masonry does not shine.
  if (in.material == MAT_GLASS || in.material == MAT_SHOPFRONT
      || in.material == MAT_METAL || in.material == MAT_SHED) {
    let v = normalize(scene.eye.xyz - in.world);
    let h = normalize(v + sun);
    let spec = pow(max(dot(n, h), 0.0), 64.0) * shadow * in.ao;
    col += vec3f(0.70, 0.72, 0.76) * spec * 0.55;
  }

  // Ground fades to the background rather than ending at a visible edge.
  if (in.material == MAT_GROUND) {
    let d = length(in.world.xz) / max(scene.params.z, 1.0);
    col = mix(col, vec3f(0.043, 0.055, 0.075), smoothstep(0.45, 1.0, d));
  }

  // Filmic-ish shoulder: keeps sunlit render and glass highlights from
  // clipping to flat white, which is most of why untonemapped renders look
  // like plastic.
  col = col / (col + vec3f(0.72)) * 1.42;
  return vec4f(pow(col, vec3f(0.9)), 1.0);
}

@fragment
fn fs_wire() -> @location(0) vec4f {
  return vec4f(0.38, 0.83, 1.0, 1.0);
}
`,C="depth24plus",$="depth32float",F=2048,X=176,G=(()=>{const p=[.48,.68,.38],e=Math.hypot(...p);return[p[0]/e,p[1]/e,p[2]/e]})();class Re{constructor(e){this.gpu=e,this.buildPipelines(),this.buildGround(),this.resizeDepth(),e.onResize(()=>this.resizeDepth()),this.hookInput()}pipeline;wirePipeline;shadowPipeline;shadowBindGroup;sceneBuffer;bindGroup;depth=null;depthView;shadowView;ground;current=null;alive=!0;yaw=Math.PI*.75;pitch=.36;distance=30;spin=!0;wireframe=!1;lod=0;asset=I[0];view=P();proj=P();viewProj=P();sunView=P();sunProj=P();sunViewProj=P();sceneData=new Float32Array(X/4);groundRadius=60;buildPipelines(){const{device:e,format:u}=this.gpu,d=e.createShaderModule({label:"asset",code:Te}),h=e.createTexture({label:"shadow-map",size:{width:F,height:F},format:$,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});this.shadowView=h.createView();const r=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"depth"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"comparison"}}]}),n=e.createPipelineLayout({bindGroupLayouts:[r]}),t=[{arrayStride:E*4,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32"},{shaderLocation:3,offset:28,format:"float32"}]}];this.pipeline=e.createRenderPipeline({label:"asset-solid",layout:n,vertex:{module:d,entryPoint:"vs",buffers:t},fragment:{module:d,entryPoint:"fs",targets:[{format:u}]},primitive:{topology:"triangle-list",cullMode:"back",frontFace:"ccw"},depthStencil:{format:C,depthWriteEnabled:!0,depthCompare:"less"}}),this.wirePipeline=e.createRenderPipeline({label:"asset-wire",layout:n,vertex:{module:d,entryPoint:"vs",buffers:t},fragment:{module:d,entryPoint:"fs_wire",targets:[{format:u}]},primitive:{topology:"line-list"},depthStencil:{format:C,depthWriteEnabled:!1,depthCompare:"less-equal"}});const s=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}}]}),o=e.createPipelineLayout({bindGroupLayouts:[s]});this.shadowPipeline=e.createRenderPipeline({label:"asset-shadow",layout:o,vertex:{module:d,entryPoint:"vs_shadow",buffers:t},primitive:{topology:"triangle-list",cullMode:"front",frontFace:"ccw"},depthStencil:{format:$,depthWriteEnabled:!0,depthCompare:"less"}}),this.sceneBuffer=e.createBuffer({size:X,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.shadowBindGroup=e.createBindGroup({layout:s,entries:[{binding:0,resource:{buffer:this.sceneBuffer}}]}),this.bindGroup=e.createBindGroup({layout:r,entries:[{binding:0,resource:{buffer:this.sceneBuffer}},{binding:1,resource:this.shadowView},{binding:2,resource:e.createSampler({compare:"less"})}]})}buildGround(){const{device:e}=this.gpu,u=400,d=new Float32Array([-u,0,-u,0,1,0,8,1,u,0,-u,0,1,0,8,1,u,0,u,0,1,0,8,1,-u,0,u,0,1,0,8,1]),h=new Uint32Array([0,2,1,0,3,2]),r=e.createBuffer({size:d.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(r,0,d);const n=e.createBuffer({size:h.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(n,0,h),this.ground={vertices:r,indices:n,count:h.length}}resizeDepth(){const e=this.gpu.viewport;this.depth?.destroy(),this.depth=this.gpu.device.createTexture({size:{width:e.width,height:e.height},format:C,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.depthView=this.depth.createView()}hookInput(){const e=this.gpu.canvas;let u=!1,d=0,h=0;e.addEventListener("pointerdown",r=>{u=!0,d=r.clientX,h=r.clientY,e.setPointerCapture(r.pointerId),this.spin=!1,document.getElementById("spin")?.classList.remove("on")}),e.addEventListener("pointerup",r=>{u=!1,e.hasPointerCapture(r.pointerId)&&e.releasePointerCapture(r.pointerId)}),e.addEventListener("pointermove",r=>{u&&(this.yaw-=(r.clientX-d)*.007,this.pitch=W(this.pitch+(r.clientY-h)*.005,-.15,1.35),d=r.clientX,h=r.clientY)}),e.addEventListener("wheel",r=>{r.preventDefault(),this.distance=W(this.distance*Math.exp(r.deltaY*.0012),4,400)},{passive:!1})}select(e,u=this.lod){this.asset=e,this.lod=u;const d=e.build(u).build(),{device:h}=this.gpu;this.current?.vertices.destroy(),this.current?.indices.destroy(),this.current?.edges.destroy();const r=h.createBuffer({size:Math.max(d.vertices.byteLength,4),usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});h.queue.writeBuffer(r,0,d.vertices);const n=h.createBuffer({size:Math.max(d.indices.byteLength,4),usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});h.queue.writeBuffer(n,0,d.indices);const t=new Uint32Array(d.indices.length*2);for(let a=0;a<d.indices.length;a+=3){const f=d.indices[a],l=d.indices[a+1],v=d.indices[a+2],m=a*2;t[m]=f,t[m+1]=l,t[m+2]=l,t[m+3]=v,t[m+4]=v,t[m+5]=f}const s=h.createBuffer({size:Math.max(t.byteLength,4),usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});h.queue.writeBuffer(s,0,t);let o=0,c=1;for(let a=0;a<d.vertices.length;a+=E)o=Math.max(o,d.vertices[a+1]),c=Math.max(c,Math.hypot(d.vertices[a],d.vertices[a+2]));this.current={vertices:r,indices:n,indexCount:d.indices.length,edges:s,edgeCount:t.length,bounds:{height:o,radius:c},triangles:d.indices.length/3},this.distance=Math.max(o*1.5,c*3.4,12),this.groundRadius=Math.max(o,c)*4.5+20,Le(e,this.current.triangles,u),Ie(e.id)}setLod(e){this.select(this.asset,e)}toggleWire(){return this.wireframe=!this.wireframe,this.wireframe}toggleSpin(){return this.spin=!this.spin,this.spin}rebuild(){this.current=null,this.buildPipelines(),this.buildGround(),this.resizeDepth(),this.select(this.asset,this.lod),this.alive=!0}suspend(){this.alive=!1}frame(e){if(!this.alive)return;this.spin&&(this.yaw+=e*.4);const u=this.gpu.viewport;this.render(this.gpu.context.getCurrentTexture().createView(),this.depthView,u.width,u.height)}async capture(e,u){if(!this.alive)return"";const{device:d}=this.gpu,h=Math.ceil(e/64)*64,r=d.createTexture({size:{width:h,height:u},format:this.gpu.format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),n=d.createTexture({size:{width:h,height:u},format:C,usage:GPUTextureUsage.RENDER_ATTACHMENT});this.render(r.createView(),n.createView(),h,u);const t=h*4,s=d.createBuffer({size:t*u,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),o=d.createCommandEncoder();o.copyTextureToBuffer({texture:r},{buffer:s,bytesPerRow:t},[h,u]),d.queue.submit([o.finish()]),await s.mapAsync(GPUMapMode.READ);const c=new Uint8ClampedArray(s.getMappedRange().slice(0));if(s.unmap(),s.destroy(),r.destroy(),n.destroy(),this.gpu.format.startsWith("bgra"))for(let l=0;l<c.length;l+=4){const v=c[l];c[l]=c[l+2],c[l+2]=v}const a=document.createElement("canvas");a.width=e,a.height=u;const f=a.getContext("2d");return f?(f.putImageData(new ImageData(c,h,u),0,0),a.toDataURL("image/png")):""}render(e,u,d,h){const r=this.current;if(!r||!this.alive)return;const{device:n}=this.gpu,t={width:d,height:h},s=[0,r.bounds.height*.45,0],o=Math.cos(this.pitch),c=[s[0]+this.distance*o*Math.sin(this.yaw),s[1]+this.distance*Math.sin(this.pitch)+r.bounds.height*.12,s[2]+this.distance*o*Math.cos(this.yaw)];q(this.view,c,s,[0,1,0]),se(this.proj,42*Math.PI/180,t.width/Math.max(t.height,1),.2,2e3),K(this.viewProj,this.proj,this.view);const a=Math.max(r.bounds.radius*1.7,r.bounds.height*.9,8),f=[0,r.bounds.height*.5,0],l=[f[0]+G[0]*a*2.6,f[1]+G[1]*a*2.6,f[2]+G[2]*a*2.6];q(this.sunView,l,f,[0,1,0]),ie(this.sunProj,-a,a,-a,a,.5,a*6),K(this.sunViewProj,this.sunProj,this.sunView),this.sceneData.set(this.viewProj,0),this.sceneData.set(this.sunViewProj,16),this.sceneData.set([c[0],c[1],c[2],0],32),this.sceneData.set([G[0],G[1],G[2],0],36),this.sceneData.set([this.asset.id.length*7.3+this.asset.id.charCodeAt(0),1/F,this.groundRadius,0],40),n.queue.writeBuffer(this.sceneBuffer,0,this.sceneData);const v=n.createCommandEncoder(),m=v.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:this.shadowView,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});m.setPipeline(this.shadowPipeline),m.setBindGroup(0,this.shadowBindGroup),m.setVertexBuffer(0,r.vertices),m.setIndexBuffer(r.indices,"uint32"),m.drawIndexed(r.indexCount),m.end();const g=v.beginRenderPass({colorAttachments:[{view:e,clearValue:{r:.043,g:.055,b:.075,a:1},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:u,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});g.setBindGroup(0,this.bindGroup),g.setPipeline(this.pipeline),g.setVertexBuffer(0,this.ground.vertices),g.setIndexBuffer(this.ground.indices,"uint32"),g.drawIndexed(this.ground.count),g.setVertexBuffer(0,r.vertices),g.setIndexBuffer(r.indices,"uint32"),g.drawIndexed(r.indexCount),this.wireframe&&(g.setPipeline(this.wirePipeline),g.setVertexBuffer(0,r.vertices),g.setIndexBuffer(r.edges,"uint32"),g.drawIndexed(r.edgeCount)),g.end(),n.queue.submit([v.finish()])}}const Se=[["residential · low",p=>p.zone==="residential"&&p.density==="low"],["residential · medium",p=>p.zone==="residential"&&p.density==="medium"],["residential · high",p=>p.zone==="residential"&&p.density==="high"],["commercial",p=>p.zone==="commercial"],["industrial",p=>p.zone==="industrial"]];function Ie(p){for(const e of document.querySelectorAll(".item"))e.classList.toggle("on",e.dataset.id===p)}function Le(p,e,u){const d=document.getElementById("info");if(!d)return;const h=[0,1,2].map(t=>p.build(t).triangleCount),r=(t,s)=>`<div class="row"><span>${t}</span><b>${s}</b></div>`,n=p.sim;d.innerHTML=r("variant",p.variant)+r("footprint",`${p.footprint[0]}×${p.footprint[1]} cells · ${p.footprint[0]*8}×${p.footprint[1]*8} m`)+r("height",`${p.height.toFixed(1)} m`)+r(`triangles (LOD ${u})`,e.toLocaleString())+r("LOD ladder",h.map(t=>t.toLocaleString()).join(" → "))+(n.households?r("households",String(n.households)):"")+(n.jobs?r("jobs",String(n.jobs)):"")+r("power",`${n.powerKW} kW`)+r("upkeep",`${n.upkeep}/wk`)+`<div class="note">${p.note}</div>`}function Ee(p){const e=document.getElementById("list");if(e)for(const[u,d]of Se){const h=I.filter(d);if(!h.length)continue;const r=document.createElement("div");r.className="group",r.textContent=u,e.appendChild(r);for(const n of h){const t=document.createElement("div");t.className="item",t.dataset.id=n.id,t.innerHTML=`<div class="n">${n.name}</div><div class="m">${n.variant} · ${n.build(0).triangleCount.toLocaleString()} tris</div>`,t.addEventListener("click",()=>p(n)),e.appendChild(t)}}}async function Ae(){const p=document.getElementById("gpu-canvas");if(!(p instanceof HTMLCanvasElement))return;let e;try{e=await ne.create(p)}catch(o){const c=document.getElementById("stage");if(c){const a=document.createElement("div");a.id="fatal",a.textContent=o instanceof oe?"This browser has no usable WebGPU. Try current Chrome or Edge.":String(o),c.appendChild(a)}return}const u=new Re(e);let d=!1;e.onLost(async()=>{if(!d){d=!0,u.suspend();try{await e.recover(),u.rebuild(),H.info("viewer","device recovered")}catch(o){H.error("viewer",`recovery failed: ${String(o)}`)}d=!1}}),Ee(o=>u.select(o));const h=new URLSearchParams(location.search),r=I.find(o=>o.id===h.get("asset"))??I[0],n=Number(h.get("lod")??0);if(h.get("spin")==="0"&&u.toggleSpin(),h.get("hud")==="0"){for(const o of["side","bar","info","hint"])document.getElementById(o)?.remove();document.getElementById("app")?.style.setProperty("grid-template-columns","1fr")}u.select(r,n),Object.defineProperty(window,"viewer",{value:{show(o,c){const a=I.find(f=>f.id===o);return a?(u.select(a,c),!0):!1},ids:I.map(o=>o.id),capture:(o,c)=>u.capture(o,c),alive:()=>!d}});for(const o of document.querySelectorAll("[data-lod]"))o.addEventListener("click",()=>{for(const c of document.querySelectorAll("[data-lod]"))c.classList.remove("on");o.classList.add("on"),u.setLod(Number(o.dataset.lod))});document.getElementById("wire")?.addEventListener("click",o=>{o.currentTarget.classList.toggle("on",u.toggleWire())}),document.getElementById("spin")?.addEventListener("click",o=>{o.currentTarget.classList.toggle("on",u.toggleSpin())});let t=performance.now();const s=o=>{const c=Math.min((o-t)/1e3,.1);t=o,u.frame(c),requestAnimationFrame(s)};requestAnimationFrame(s),H.info("viewer",`${I.length} assets`)}Ae();
//# sourceMappingURL=asset-BzEWogtx.js.map
