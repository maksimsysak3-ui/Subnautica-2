import{m as oe,G as se,a as ie,l as U,b as z,c as q,d as j,p as re,e as K,o as ae}from"./m4-Cd1z1CQ_.js";const P=8,i={ROOF:0,HOUSING:1,GLASS:2,METAL:3,BRICK:4,TRIM:5,SHOPFRONT:6,TILE:7,HOUSE_WALL:9,SHED_WALL:10};class R{verts=[];idx=[];get triangleCount(){return this.idx.length/3}get vertexCount(){return this.verts.length/P}tri(e,f,c,h){const r=f[0]-e[0],n=f[1]-e[1],t=f[2]-e[2],o=c[0]-e[0],l=c[1]-e[1],u=c[2]-e[2];let d=n*u-t*l,s=t*o-r*u,a=r*l-n*o;const v=Math.hypot(d,s,a)||1;d/=v,s/=v,a/=v;const m=this.vertexCount;for(const g of[e,f,c])this.verts.push(g[0],g[1],g[2],d,s,a,h,1);this.idx.push(m,m+1,m+2)}quad(e,f,c,h,r){this.tri(e,f,c,r),this.tri(e,c,h,r)}box(e,f,c,h={}){const[r,n,t]=e,[o,l,u]=f,d=h.roof??c;this.quad([o,n,u],[o,n,t],[o,l,t],[o,l,u],c),this.quad([r,n,t],[r,n,u],[r,l,u],[r,l,t],c),this.quad([r,n,u],[o,n,u],[o,l,u],[r,l,u],c),this.quad([o,n,t],[r,n,t],[r,l,t],[o,l,t],c),this.quad([r,l,u],[o,l,u],[o,l,t],[r,l,t],d),h.skipBottom===!1&&this.quad([r,n,t],[o,n,t],[o,n,u],[r,n,u],c)}gable(e,f,c,h,r,n){const[t,o,l]=e,[u,,d]=f,s=o+c;if(h==="x"){const a=(l+d)/2;this.quad([t,o,d],[u,o,d],[u,s,a],[t,s,a],r),this.quad([u,o,l],[t,o,l],[t,s,a],[u,s,a],r),this.tri([u,o,d],[u,o,l],[u,s,a],n),this.tri([t,o,l],[t,o,d],[t,s,a],n)}else{const a=(t+u)/2;this.quad([u,o,d],[u,o,l],[a,s,l],[a,s,d],r),this.quad([t,o,l],[t,o,d],[a,s,d],[a,s,l],r),this.tri([t,o,d],[u,o,d],[a,s,d],n),this.tri([u,o,l],[t,o,l],[a,s,l],n)}}cylinder(e,f,c,h,r,n,t,o=!0){for(let l=0;l<n;l++){const u=l/n*Math.PI*2,d=(l+1)/n*Math.PI*2,s=[e+Math.cos(u)*c,h,f+Math.sin(u)*c],a=[e+Math.cos(d)*c,h,f+Math.sin(d)*c],v=[e+Math.cos(d)*c,r,f+Math.sin(d)*c],m=[e+Math.cos(u)*c,r,f+Math.sin(u)*c];this.quad(s,m,v,a,t),o&&this.tri([e,r,f],[e+Math.cos(d)*c,r,f+Math.sin(d)*c],[e+Math.cos(u)*c,r,f+Math.sin(u)*c],t)}}opening(e){const f=e.frame??.11,c=e.proud??.09,h=e.frameMat??i.TRIM,r=.06,n=(o,l,u,d,s,a,v)=>{const m=e.plane+e.sign*Math.min(s,a),g=e.plane+e.sign*Math.max(s,a);e.axis==="x"?this.box([m,u,o],[g,d,l],v):this.box([o,u,m],[l,d,g],v)},t=e.plane-e.sign*r;if(e.axis==="x"){const o=[t,e.y0,e.u0],l=[t,e.y0,e.u1],u=[t,e.y1,e.u1],d=[t,e.y1,e.u0];e.sign>0?this.quad(l,o,d,u,e.glass):this.quad(o,l,u,d,e.glass)}else{const o=[e.u0,e.y0,t],l=[e.u1,e.y0,t],u=[e.u1,e.y1,t],d=[e.u0,e.y1,t];e.sign>0?this.quad(o,l,u,d,e.glass):this.quad(l,o,d,u,e.glass)}n(e.u0-f,e.u1+f,e.y1,e.y1+f,-r,c,h),n(e.u0-f,e.u1+f,e.y0-f,e.y0,-r,c,h),n(e.u0-f,e.u0,e.y0,e.y1,-r,c,h),n(e.u1,e.u1+f,e.y0,e.y1,-r,c,h)}windowRow(e){const f=e.to-e.from;for(let c=0;c<e.count;c++){const h=e.from+(c+.5)/e.count*f;this.opening({axis:e.axis,sign:e.sign,plane:e.plane,u0:h-e.width/2,u1:h+e.width/2,y0:e.y0,y1:e.y1,glass:e.glass,...e.frame!==void 0?{frame:e.frame}:{},...e.proud!==void 0?{proud:e.proud}:{}})}}cone(e,f,c,h,r,n,t,o){for(let l=0;l<t;l++){const u=l/t*Math.PI*2,d=(l+1)/t*Math.PI*2,s=[e+Math.cos(u)*c,r,f+Math.sin(u)*c],a=[e+Math.cos(d)*c,r,f+Math.sin(d)*c];h<.001?this.tri(a,s,[e,n,f],o):this.quad(s,[e+Math.cos(u)*h,n,f+Math.sin(u)*h],[e+Math.cos(d)*h,n,f+Math.sin(d)*h],a,o)}}pipe(e,f,c,h){this.box([Math.min(e[0],f[0])-c,Math.min(e[1],f[1])-c,Math.min(e[2],f[2])-c],[Math.max(e[0],f[0])+c,Math.max(e[1],f[1])+c,Math.max(e[2],f[2])+c],h,{skipBottom:!1})}build(e={}){const f=new Float32Array(this.verts.length);f.set(this.verts);const c=new Uint32Array(this.idx.length);return c.set(this.idx),e.occlusion!==!1&&ue(f,c),{vertices:f,indices:c}}}const L=.34,C=9,le=3.4,ce=.7,F=.62,$=(()=>{const p=[];for(let f=0;f<20;f++){const c=Math.sqrt((f+.5)/20),h=Math.sqrt(1-c*c),r=(f+.5)*Math.PI*(3-Math.sqrt(5));p.push([Math.cos(r)*h,c,Math.sin(r)*h])}return p})();function Z(p,e,f){return(p+512|e+512<<10|f+512<<20)>>>0}function de(p,e){const f=new Set,c=(h,r,n)=>{f.add(Z(Math.floor(h/L),Math.floor(r/L),Math.floor(n/L)))};for(let h=0;h<e.length;h+=3){const r=e[h]*P,n=e[h+1]*P,t=e[h+2]*P,o=p[r],l=p[r+1],u=p[r+2],d=p[n],s=p[n+1],a=p[n+2],v=p[t],m=p[t+1],g=p[t+2],w=Math.max(Math.hypot(d-o,s-l,a-u),Math.hypot(v-o,m-l,g-u),Math.hypot(v-d,m-s,g-a)),b=Math.min(48,Math.max(2,Math.ceil(w/L*1.6)));for(let x=0;x<=b;x++)for(let M=0;M<=b-x;M++){const S=x/b,A=M/b,I=1-S-A;c(o*I+d*S+v*A,l*I+s*S+m*A,u*I+a*S+g*A)}}return f}function ue(p,e){if(e.length===0)return;const f=de(p,e),c=le/C;for(let h=0;h<p.length;h+=P){const r=p[h],n=p[h+1],t=p[h+2],o=p[h+3],l=p[h+4],u=p[h+5];let d=0,s=0,a=0;Math.abs(l)<.9?(d=-u,a=o):d=1;const v=Math.hypot(d,s,a)||1;d/=v,s/=v,a/=v;const m=l*a-u*s,g=u*d-o*a,w=o*s-l*d,b=r+o*F,x=n+l*F,M=t+u*F;let S=0;for(const[I,D,H]of $){const J=d*I+o*D+m*H,Q=s*I+l*D+g*H,ee=a*I+u*D+w*H;for(let O=1;O<=C;O++){const _=O*c,te=b+J*_,V=x+Q*_,ne=M+ee*_;if(V<0){S+=1-(O-1)/C;break}if(f.has(Z(Math.floor(te/L),Math.floor(V/L),Math.floor(ne/L)))){S+=1-(O-1)/C;break}}}const A=1-ce*(S/$.length);p[h+7]=Math.max(.08,Math.min(1,A))}}const y=8,W=p=>p*.39;function fe(p){const e=new R,f=p<2,c=7.6,h=10.4,r=5.3,n=c/2,t=h/2,o=W(c);return e.box([-n,0,-t],[n,r,t],i.HOUSE_WALL,{roof:i.TRIM}),e.gable([-n,r,-t],[n,r,t],o,"z",i.TILE,i.HOUSE_WALL),f&&(e.box([-n-.42,r-.3,-t-.42],[n+.42,r,t+.42],i.TRIM),e.box([n-2.6,r+1.4,-1.1],[n-1.5,r+o+1.6,.2],i.BRICK),e.box([-1.5,2.55,t],[1.5,2.85,t+1.25],i.TRIM),e.box([-1.35,0,t+.95],[-1.05,2.55,t+1.2],i.TRIM),e.box([1.05,0,t+.95],[1.35,2.55,t+1.2],i.TRIM),e.box([-1.7,0,t],[1.7,.16,t+1.5],i.TRIM)),e}function he(p){const e=new R,f=p<1,c=p<2,h=7.4,r=9.8,n=5.4,t=h/2,o=r/2,l=W(h);e.box([-t,0,-o],[t,n,o],i.BRICK,{roof:i.TRIM}),e.gable([-t,n,-o],[t,n,o],l,"z",i.TILE,i.BRICK);const u=4.3,d=3.1,s=-u/2,a=u/2,v=o-.2,m=o+d;if(c){e.box([s,0,v],[a,n-.5,m],i.BRICK,{roof:i.TRIM}),e.gable([s,n-.5,v],[a,n-.5,m],W(u),"x",i.TILE,i.BRICK);const g=t-.3,w=t+4.7;e.box([g,0,-o+1.4],[w,3.1,o-1.6],i.BRICK,{roof:i.TRIM}),e.gable([g,3.1,-o+1.4],[w,3.1,o-1.6],1.5,"z",i.TILE,i.BRICK),e.box([-t-.42,n-.3,-o-.42],[t+.42,n,o+.42],i.TRIM),e.box([s-.36,n-.8,v],[a+.36,n-.5,m+.36],i.TRIM),e.box([g,2.82,-o+1.05],[w+.3,3.1,o-1.25],i.TRIM),e.box([-t-.05,n+.4,-1.6],[-t+1.5,n+2,.1],i.BRICK),e.gable([-t-.2,n+2,-1.75],[-t+1.65,n+2,.25],.7,"z",i.TILE,i.BRICK),e.box([t-2.3,n+1.2,-2.4],[t-1.2,n+l+1.8,-1.1],i.BRICK),e.box([t-2.5,n+l+1.8,-2.6],[t-1,n+l+2.1,-.9],i.TRIM)}if(f){e.box([a+.1,0,m-2.4],[a+3.4,.16,m],i.TRIM),e.box([a+.1,2.6,m-2.6],[a+3.6,2.92,m+.25],i.TRIM);for(const g of[a+.45,a+3.1])e.box([g-.14,.16,m-.4],[g+.14,2.6,m-.12],i.TRIM);for(let g=0;g<8;g++){const w=a+.5+g/7*2.55;e.box([w-.04,.16,m-.32],[w+.04,.98,m-.2],i.TRIM)}e.box([a+.35,.98,m-.38],[a+3.25,1.1,m-.14],i.TRIM);for(let g=0;g<2;g++){const w=.16-g*.07;e.box([a+.5,1e-4,m+.05+g*.24],[a+2.4,w,m+.29+g*.24],i.TRIM)}e.opening({axis:"z",sign:1,plane:m,u0:a+1.1,u1:a+2.1,y0:.16,y1:2.3,glass:i.TRIM,frame:.13,proud:.09}),e.box([s+.5,.3,m],[a-.5,2.9,m+.5],i.BRICK,{roof:i.TRIM}),e.opening({axis:"z",sign:1,plane:m+.5,u0:s+.75,u1:a-.75,y0:.75,y1:2.55,glass:i.GLASS,frame:.1,proud:.07}),e.windowRow({axis:"z",sign:1,plane:m,from:s,to:a,y0:3.3,y1:4.7,count:1,width:1.5,glass:i.GLASS,frame:.1,proud:.07});for(const[g,w]of[[1,t],[-1,-t]])e.windowRow({axis:"x",sign:g,plane:w,from:-o+1.2,to:o-1.2,y0:1.2,y1:2.7,count:2,width:1.2,glass:i.GLASS,frame:.09,proud:.06}),e.windowRow({axis:"x",sign:g,plane:w,from:-o+1.2,to:o-1.2,y0:3.4,y1:4.8,count:2,width:1.2,glass:i.GLASS,frame:.09,proud:.06});e.windowRow({axis:"z",sign:-1,plane:-o,from:-t+1,to:t-1,y0:1.3,y1:2.8,count:2,width:1.3,glass:i.GLASS,frame:.09,proud:.06}),e.windowRow({axis:"z",sign:-1,plane:-o,from:-t+1,to:t-1,y0:3.5,y1:4.9,count:2,width:1.3,glass:i.GLASS,frame:.09,proud:.06}),e.opening({axis:"z",sign:1,plane:.1,u0:-t+.35,u1:-t+1.1,y0:n+.85,y1:n+1.8,glass:i.GLASS,frame:.08,proud:.05}),e.opening({axis:"z",sign:1,plane:o-1.6,u0:t+.4,u1:t+4,y0:.15,y1:2.5,glass:i.TRIM,frame:.12,proud:.09}),e.box([-t-.42,n-.44,o+.24],[t+.42,n-.3,o+.42],i.TRIM),e.box([-t-.42,n-.44,-o-.42],[t+.42,n-.3,-o-.24],i.TRIM);for(const g of[-t-.3,t+.16])e.box([g,0,o+.26],[g+.14,n-.44,o+.4],i.TRIM)}return e}function pe(p){const e=new R,f=y*2-1.6,c=y*2-2.4,h=15.5,r=f/2,n=c/2;return e.box([-r,0,-n],[r,h,n],i.HOUSING,{roof:i.ROOF}),p<2&&e.box([-r-.16,h,-n-.16],[r+.16,h+.8,n+.16],i.TRIM),e}function me(p){const e=new R,f=p<1,c=p<2,h=y*2-1.6,r=y*2-2.4,n=5,t=3.1,o=n*t,l=h/2,u=r/2;if(e.box([-l,0,-u],[l,o,u],i.HOUSING,{roof:i.ROOF}),e.box([-l-.18,o,-u-.18],[l+.18,o+.9,u+.18],i.TRIM),e.box([-l-.22,0,-u-.22],[l+.22,3.4,u+.22],i.BRICK,{roof:i.TRIM}),c){for(let s=1;s<n;s++){const a=3.4+(s-1)*t+.1;for(let v=0;v<4;v++){const m=-l+(v+.5)/4*h;for(const[g,w]of[[u,1],[-u,-1]]){const b=1.25*w;e.box([m-1.4,a,Math.min(g,g+b)],[m+1.4,a+.16,Math.max(g,g+b)],i.TRIM);const x=g+b;e.box([m-1.4,a+.16,Math.min(x,x-.1*w)],[m+1.4,a+1.16,Math.max(x,x-.1*w)],i.TRIM)}}}e.box([-1.6,o,-1.4],[1.6,o+3,1.4],i.BRICK,{roof:i.ROOF}),e.box([l-3.6,o+.9,-2.2],[l-1.4,o+2.1,.6],i.METAL)}if(f){for(let d=0;d<n;d++){const s=3.4+(d-1)*t+.9;if(d!==0){for(const[a,v]of[[1,u],[-1,-u]])e.windowRow({axis:"z",sign:a,plane:v,from:-l+.8,to:l-.8,y0:s,y1:s+1.5,count:3,width:1.15,glass:i.GLASS,frame:.08,proud:.06});for(const[a,v]of[[1,l],[-1,-l]])e.windowRow({axis:"x",sign:a,plane:v,from:-u+.8,to:u-.8,y0:s,y1:s+1.5,count:2,width:1.25,glass:i.GLASS,frame:.08,proud:.06})}}for(const[d,s]of[[1,u],[-1,-u]])e.windowRow({axis:"z",sign:d,plane:s,from:-l+.9,to:l-.9,y0:.9,y1:2.9,count:3,width:1.7,glass:i.SHOPFRONT,frame:.1,proud:.07})}return e}function ge(p){const e=new R,f=y*3-2.4,c=y*3-2.4,h=f/2,r=c/2,n=9,t=62;e.box([-h,0,-r],[h,n,r],i.HOUSING,{roof:i.ROOF});const o=h*.72,l=r*.72;return e.box([-o,n,-l],[o,t,l],i.HOUSING,{roof:i.ROOF}),p<2&&e.box([-o-.2,t,-l-.2],[o+.2,t+1.1,l+.2],i.TRIM),e}function ve(p){const e=new R,f=p<1,c=p<2,h=y*3-2.4,r=y*3-2.4,n=h/2,t=r/2,o=9.5,l=19,u=3.05,d=o+l*u,s=n*.7,a=t*.7;if(e.box([-n,0,-t],[n,o,t],i.BRICK,{roof:i.ROOF}),e.box([-n-.25,o,-t-.25],[n+.25,o+.7,t+.25],i.TRIM),e.box([-s,o,-a],[s,d,a],i.HOUSING,{roof:i.ROOF}),c){for(let m=0;m<=5;m++){const g=m/5,w=-s+g*s*2,b=-a+g*a*2;e.box([w-.16,o,a],[w+.16,d,a+.34],i.TRIM),e.box([w-.16,o,-a-.34],[w+.16,d,-a],i.TRIM),e.box([s,o,b-.16],[s+.34,d,b+.16],i.TRIM),e.box([-s-.34,o,b-.16],[-s,d,b+.16],i.TRIM)}for(let m=2;m<l;m+=3){const g=o+m*u;e.box([-s-.9,g,-a-.9],[s+.9,g+.18,a+.9],i.TRIM),e.box([-s-.9,g+.18,a+.78],[s+.9,g+1.1,a+.9],i.TRIM),e.box([-s-.9,g+.18,-a-.9],[s+.9,g+1.1,-a-.78],i.TRIM)}e.box([-s-.3,d,-a-.3],[s+.3,d+1.4,a+.3],i.TRIM),e.box([-s*.55,d,-a*.55],[s*.55,d+4.2,a*.55],i.METAL,{roof:i.ROOF}),e.box([-.22,d+4.2,-.22],[.22,d+11,.22],i.TRIM)}if(f){for(let v=0;v<l;v++){const m=o+v*u+.85,g=m+1.55;for(const[w,b]of[[1,a],[-1,-a]])e.opening({axis:"z",sign:w,plane:b,u0:-s+.75,u1:s-.75,y0:m,y1:g,glass:i.GLASS,frame:.09,proud:.05});for(const[w,b]of[[1,s],[-1,-s]])e.opening({axis:"x",sign:w,plane:b,u0:-a+.75,u1:a-.75,y0:m,y1:g,glass:i.GLASS,frame:.09,proud:.05})}for(const[v,m]of[[1,t],[-1,-t]])e.windowRow({axis:"z",sign:v,plane:m,from:-n+1,to:n-1,y0:1,y1:3.6,count:4,width:2.2,glass:i.SHOPFRONT,frame:.11,proud:.08})}return e}const G=p=>p*1.6,we=[{id:"res.low.shaded",name:"Detached house",zone:"residential",density:"low",variant:"shaded",footprint:[2,2],height:9.7,sim:{households:1,powerKW:G(1),waterM3:.6,garbagePerWeek:12,pollution:0,upkeep:6},note:"Box, gable, chimney. Brick coursework, windows and door are all shader.",build:fe},{id:"res.low.sculpted",name:"Detached house, modelled",zone:"residential",density:"low",variant:"sculpted",footprint:[2,2],height:10.4,sim:{households:1,powerKW:G(1),waterM3:.6,garbagePerWeek:12,pollution:0,upkeep:7},note:"Garage wing, eaves, porch, dormers, window reveals — the same house with the detail built.",build:he},{id:"res.mid.shaded",name:"Apartment block",zone:"residential",density:"medium",variant:"shaded",footprint:[2,2],height:16.3,sim:{households:24,powerKW:G(24),waterM3:14,garbagePerWeek:260,pollution:1,upkeep:48},note:"Slab and a parapet. Every window and floor line is drawn by the shader.",build:pe},{id:"res.mid.sculpted",name:"Apartment block, balconied",zone:"residential",density:"medium",variant:"sculpted",footprint:[2,2],height:18.5,sim:{households:24,powerKW:G(24),waterM3:14,garbagePerWeek:260,pollution:1,upkeep:54},note:"Balconies on all four elevations, a masonry base, stair core and roof plant.",build:me},{id:"res.high.shaded",name:"Residential tower",zone:"residential",density:"high",variant:"shaded",footprint:[3,3],height:63,sim:{households:180,powerKW:G(180),waterM3:96,garbagePerWeek:1900,pollution:2,upkeep:340},note:"Podium, setback, tower, parapet. Four boxes.",build:ge},{id:"res.high.sculpted",name:"Residential tower, finned",zone:"residential",density:"high",variant:"sculpted",footprint:[3,3],height:79,sim:{households:180,powerKW:G(180),waterM3:96,garbagePerWeek:1900,pollution:2,upkeep:380},note:"Vertical fins the full height, balcony bands every third floor, crown and mast.",build:ve}];function be(p){const e=new R,f=y*2-1.4,c=y*2-2,h=f/2,r=c/2,n=4.6,t=24;return e.box([-h,0,-r],[h,n,r],i.SHOPFRONT,{roof:i.TRIM}),e.box([-h,n,-r],[h,t,r],i.GLASS,{roof:i.ROOF}),p<2&&e.box([-h-.2,t,-r-.2],[h+.2,t+1,r+.2],i.TRIM),e}function xe(p){const e=new R,f=p<1,c=p<2,h=y*2-1.4,r=y*2-2,n=h/2,t=r/2,o=5,l=7,u=3.6,d=o+l*u;if(e.box([-n+.5,0,-t+.5],[n-.5,o,t-.5],i.SHOPFRONT,{roof:i.TRIM}),e.box([-n,o,-t],[n,d,t],i.GLASS,{roof:i.ROOF}),c){for(const s of[-1,1])for(const a of[-1,1])e.box([s*n-s*.55,0,a*t-a*.55],[s*n,o,a*t],i.TRIM);e.box([-n-.9,o-.7,-t-.9],[n+.9,o-.42,t+.9],i.TRIM);for(let s=1;s<=l;s++){const a=o+s*u-.5;e.box([-n-.14,a,-t-.14],[n+.14,a+.5,t+.14],i.TRIM)}e.box([-n-.42,d,-t-.42],[n+.42,d+1.3,t+.42],i.TRIM),e.box([-2.6,d,-1.9],[1.4,d+2.6,1.9],i.METAL,{roof:i.ROOF}),e.box([2,d,-2.4],[4.2,d+1.2,-.2],i.METAL),e.cylinder(3,1.8,.85,d,d+1.9,10,i.METAL)}if(f){for(let s=0;s<l;s++){const a=o+s*u+.35,v=a+u-1.05;for(const[m,g]of[[1,t],[-1,-t]])e.windowRow({axis:"z",sign:m,plane:g,from:-n+.6,to:n-.6,y0:a,y1:v,count:2,width:4.6,glass:i.GLASS,frame:.07,proud:.05});for(const[m,g]of[[1,n],[-1,-n]])e.windowRow({axis:"x",sign:m,plane:g,from:-t+.6,to:t-.6,y0:a,y1:v,count:2,width:4,glass:i.GLASS,frame:.07,proud:.05})}for(const[s,a]of[[1,t-.5],[-1,-t+.5]])e.windowRow({axis:"z",sign:s,plane:a,from:-n+1.2,to:n-1.2,y0:.7,y1:4.1,count:3,width:3,glass:i.SHOPFRONT,frame:.12,proud:.08})}return e}const ye=[{id:"com.shaded",name:"Retail and offices",zone:"commercial",density:"medium",variant:"shaded",footprint:[2,2],height:25,sim:{jobs:90,powerKW:210,waterM3:22,garbagePerWeek:480,pollution:2,upkeep:160},note:"Two boxes: shopfront base, glass above. Mullions and signage are shader.",build:be},{id:"com.sculpted",name:"Retail and offices, articulated",zone:"commercial",density:"medium",variant:"sculpted",footprint:[2,2],height:31,sim:{jobs:90,powerKW:210,waterM3:22,garbagePerWeek:480,pollution:2,upkeep:175},note:"Recessed shopfront on columns, pavement canopy, spandrel band per floor, cornice, roof plant.",build:xe}];function Me(p){const e=new R,f=p<2,c=25,h=17,r=9.2,n=2.6,t=c/2,o=h/2,l=-1.5;if(e.box([-t,0,l-o],[t,r,l+o],i.SHED_WALL,{roof:i.TRIM}),e.gable([-t,r,l-o],[t,r,l+o],n,"x",i.METAL,i.SHED_WALL),f){e.box([-t-.45,r-.35,l-o-.45],[t+.45,r,l+o+.45],i.TRIM),e.box([-t,r+n-.18,l-.35],[t,r+n+.2,l+.35],i.TRIM);for(let u=0;u<3;u++){const d=-t+4.6+u*7.4;e.box([d-2.2,0,l+o-.05],[d+2.2,5,l+o+.16],i.TRIM),e.box([d-2.4,5,l+o-.05],[d+2.4,5.35,l+o+.3],i.TRIM)}e.box([-t+.6,6.4,l+o],[t-.6,6.75,l+o+2.6],i.METAL),e.box([t-3.4,0,l+o-.05],[t-2.2,2.4,l+o+.14],i.TRIM),e.box([-t+.8,0,l+o],[t-.8,1.15,l+o+2.4],i.TRIM),e.cylinder(-5,l,.7,r+n-.4,r+n+1.3,10,i.METAL),e.cylinder(5,l,.7,r+n-.4,r+n+1.3,10,i.METAL)}return e}function Te(p){const e=new R,f=p<1,c=p<2,h=17,r=13,n=10.5,t=-32/2+h/2+1,o=.4,l=t-h/2,u=t+h/2,d=o-r/2,s=o+r/2;if(e.box([l,0,d],[u,n,s],i.METAL,{roof:i.ROOF}),c){const v=h/5,m=3.4;for(let w=0;w<5;w++){const b=l+w*v,x=b+v;e.quad([b,n,s],[x,n,s],[x,n+m,d],[b,n+m,d],i.METAL),e.quad([b,n,d],[b,n+m,d],[x,n+m,d],[x,n,d],i.GLASS),e.tri([b,n,s],[b,n+m,d],[b,n,d],i.METAL),e.tri([x,n,s],[x,n,d],[x,n+m,d],i.METAL)}e.box([u-5,0,d-5.6],[u+3.2,17.5,d+.4],i.METAL,{roof:i.ROOF}),e.box([u-5.3,17.5,d-5.9],[u+3.5,18.3,d+.7],i.TRIM);const g=(w,b,x,M)=>{e.cylinder(w,b,x*1.06,0,1.1,14,i.TRIM),e.cylinder(w,b,x,1.1,M,16,i.METAL,!1),e.cone(w,b,x,x*.34,M,M+x*.8,16,i.METAL),e.cylinder(w,b,x*.34,M+x*.8,M+x*1.1,10,i.TRIM)};g(7,-4,2.5,15),g(7,2.6,2,12),g(12.4,-1.2,1.6,9.5),e.cylinder(13.2,-7.6,1.15,0,23,12,i.TRIM,!1);for(const w of[7,13,19])e.cylinder(13.2,-7.6,1.3,w,w+.55,12,i.METAL,!1);e.box([l+1,0,s],[u-1,1.2,s+2],i.TRIM);for(let w=0;w<2;w++){const b=l+4.6+w*7;e.box([b-2,1.2,s-.1],[b+2,5.6,s+.12],i.TRIM)}e.box([l+.6,6.2,s],[u-.6,6.55,s+2.4],i.METAL),e.box([l-.4,0,s-6.4],[l+4.6,4,s-1.4],i.BRICK,{roof:i.ROOF}),e.box([l-.7,4,s-6.7],[l+4.9,4.45,s-1.1],i.TRIM)}if(f){for(const[a,v]of[[1,s],[-1,d]])e.windowRow({axis:"z",sign:a,plane:v,from:l+1.2,to:u-1.2,y0:6.8,y1:8.6,count:5,width:2.1,glass:i.GLASS,frame:.09,proud:.06});e.opening({axis:"z",sign:1,plane:s-1.4,u0:l+1.6,u1:l+2.6,y0:.1,y1:2.3,glass:i.TRIM,frame:.1,proud:.07}),e.windowRow({axis:"z",sign:1,plane:s-1.4,from:l+3,to:l+4.4,y0:1.2,y1:2.7,count:1,width:1.2,glass:i.GLASS,frame:.09,proud:.06}),e.windowRow({axis:"x",sign:-1,plane:l-.4,from:s-5.8,to:s-2,y0:1.2,y1:2.7,count:3,width:.9,glass:i.GLASS,frame:.09,proud:.06});for(let a=0;a<4;a++){const v=1+a*3.6;e.box([v-.18,0,-6.6],[v+.18,6.4,-6.24],i.TRIM),e.box([v-.18,0,-1],[v+.18,6.4,-.64],i.TRIM),e.box([v-.24,6.4,-6.7],[v+.24,6.9,-.54],i.TRIM)}for(const a of[-5.6,-4.2,-2.4])e.pipe([.4,6.9,a],[14,6.9,a],.22,i.METAL);e.pipe([7,6.9,-4],[7,14,-4],.2,i.METAL),e.pipe([7,6.9,2.6],[7,11.4,2.6],.2,i.METAL);for(let a=0;a<14;a++){const v=1+a*1.15;e.box([u+3.2,v,d-5.2+a*.32],[u+4.6,v+.12,d-4.6+a*.32],i.TRIM)}e.box([u+3.1,.8,d-5.4],[u+3.3,17.4,d-.6],i.TRIM),e.box([u+4.5,.8,d-5.4],[u+4.7,17.4,d-.6],i.TRIM);for(let a=0;a<16;a++){const v=1.4+a*.85;e.box([9.3,v,-4.2],[9.9,v+.09,-3.8],i.TRIM)}for(let a=0;a<12;a++){const v=a/12*Math.PI*2;e.box([7+Math.cos(v)*2.7-.06,15,-4+Math.sin(v)*2.7-.06],[7+Math.cos(v)*2.7+.06,16.1,-4+Math.sin(v)*2.7+.06],i.TRIM)}e.cylinder(7,-4,2.76,15,15.12,14,i.TRIM,!1);for(let a=0;a<3;a++)e.cylinder(l+3.4+a*4.6,o+3,.6,n+3.4,n+4.7,10,i.METAL)}return e}const Re=[{id:"ind.shaded",name:"Distribution shed",zone:"industrial",density:"none",variant:"shaded",footprint:[4,3],height:13.1,sim:{jobs:40,powerKW:130,waterM3:8,garbagePerWeek:300,pollution:8,upkeep:90},note:"Shed, shutters, canopy, apron. Corrugation and the clerestory band are shader.",build:Me},{id:"ind.sculpted",name:"Processing plant",zone:"industrial",density:"none",variant:"sculpted",footprint:[4,3],height:23,sim:{jobs:40,powerKW:130,waterM3:8,garbagePerWeek:300,pollution:14,upkeep:105},note:"Sawtooth shed, process block, three silos, banded stack, pipe rack, access stairs, dock.",build:Te}],E=[...we,...ye,...Re],Se=`// Facade shading for procedural assets.
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
`,k="depth24plus",X="depth24plus",N=2048,Y=176,B=(()=>{const p=[.48,.68,.38],e=Math.hypot(...p);return[p[0]/e,p[1]/e,p[2]/e]})();class Ie{constructor(e){this.gpu=e,this.buildPipelines(),this.buildGround(),this.resizeDepth(),e.onResize(()=>this.resizeDepth()),this.hookInput()}pipeline;wirePipeline;shadowPipeline;shadowBindGroup;sceneBuffer;bindGroup;depth=null;depthView;shadowView;ground;current=null;alive=!0;yaw=Math.PI*.75;pitch=.36;distance=30;spin=!0;wireframe=!1;lod=0;asset=E[0];view=z();proj=z();viewProj=z();sunView=z();sunProj=z();sunViewProj=z();sceneData=new Float32Array(Y/4);groundRadius=60;buildPipelines(){const{device:e,format:f}=this.gpu,c=e.createShaderModule({label:"asset",code:Se}),h=e.createTexture({label:"shadow-map",size:{width:N,height:N},format:X,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});this.shadowView=h.createView();const r=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"depth"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"comparison"}}]}),n=e.createPipelineLayout({bindGroupLayouts:[r]}),t=[{arrayStride:P*4,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32"},{shaderLocation:3,offset:28,format:"float32"}]}];this.pipeline=e.createRenderPipeline({label:"asset-solid",layout:n,vertex:{module:c,entryPoint:"vs",buffers:t},fragment:{module:c,entryPoint:"fs",targets:[{format:f}]},primitive:{topology:"triangle-list",cullMode:"back",frontFace:"ccw"},depthStencil:{format:k,depthWriteEnabled:!0,depthCompare:"less"}}),this.wirePipeline=e.createRenderPipeline({label:"asset-wire",layout:n,vertex:{module:c,entryPoint:"vs",buffers:t},fragment:{module:c,entryPoint:"fs_wire",targets:[{format:f}]},primitive:{topology:"line-list"},depthStencil:{format:k,depthWriteEnabled:!1,depthCompare:"less-equal"}});const o=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}}]}),l=e.createPipelineLayout({bindGroupLayouts:[o]});this.shadowPipeline=e.createRenderPipeline({label:"asset-shadow",layout:l,vertex:{module:c,entryPoint:"vs_shadow",buffers:t},primitive:{topology:"triangle-list",cullMode:"front",frontFace:"ccw"},depthStencil:{format:X,depthWriteEnabled:!0,depthCompare:"less"}}),this.sceneBuffer=e.createBuffer({size:Y,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.shadowBindGroup=e.createBindGroup({layout:o,entries:[{binding:0,resource:{buffer:this.sceneBuffer}}]}),this.bindGroup=e.createBindGroup({layout:r,entries:[{binding:0,resource:{buffer:this.sceneBuffer}},{binding:1,resource:this.shadowView},{binding:2,resource:e.createSampler({compare:"less"})}]})}buildGround(){const{device:e}=this.gpu,f=400,c=new Float32Array([-f,0,-f,0,1,0,8,1,f,0,-f,0,1,0,8,1,f,0,f,0,1,0,8,1,-f,0,f,0,1,0,8,1]),h=new Uint32Array([0,2,1,0,3,2]),r=e.createBuffer({size:c.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(r,0,c);const n=e.createBuffer({size:h.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(n,0,h),this.ground={vertices:r,indices:n,count:h.length}}resizeDepth(){const e=this.gpu.viewport;this.depth?.destroy(),this.depth=this.gpu.device.createTexture({size:{width:e.width,height:e.height},format:k,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.depthView=this.depth.createView()}hookInput(){const e=this.gpu.canvas;let f=!1,c=0,h=0;e.addEventListener("pointerdown",r=>{f=!0,c=r.clientX,h=r.clientY,e.setPointerCapture(r.pointerId),this.spin=!1,document.getElementById("spin")?.classList.remove("on")}),e.addEventListener("pointerup",r=>{f=!1,e.hasPointerCapture(r.pointerId)&&e.releasePointerCapture(r.pointerId)}),e.addEventListener("pointermove",r=>{f&&(this.yaw-=(r.clientX-c)*.007,this.pitch=q(this.pitch+(r.clientY-h)*.005,-.15,1.35),c=r.clientX,h=r.clientY)}),e.addEventListener("wheel",r=>{r.preventDefault(),this.distance=q(this.distance*Math.exp(r.deltaY*.0012),4,400)},{passive:!1})}select(e,f=this.lod){this.asset=e,this.lod=f;const c=e.build(f).build(),{device:h}=this.gpu;this.current?.vertices.destroy(),this.current?.indices.destroy(),this.current?.edges.destroy();const r=h.createBuffer({size:Math.max(c.vertices.byteLength,4),usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});h.queue.writeBuffer(r,0,c.vertices);const n=h.createBuffer({size:Math.max(c.indices.byteLength,4),usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});h.queue.writeBuffer(n,0,c.indices);const t=new Uint32Array(c.indices.length*2);for(let d=0;d<c.indices.length;d+=3){const s=c.indices[d],a=c.indices[d+1],v=c.indices[d+2],m=d*2;t[m]=s,t[m+1]=a,t[m+2]=a,t[m+3]=v,t[m+4]=v,t[m+5]=s}const o=h.createBuffer({size:Math.max(t.byteLength,4),usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});h.queue.writeBuffer(o,0,t);let l=0,u=1;for(let d=0;d<c.vertices.length;d+=P)l=Math.max(l,c.vertices[d+1]),u=Math.max(u,Math.hypot(c.vertices[d],c.vertices[d+2]));this.current={vertices:r,indices:n,indexCount:c.indices.length,edges:o,edgeCount:t.length,bounds:{height:l,radius:u},triangles:c.indices.length/3},this.distance=Math.max(l*1.5,u*3.4,12),this.groundRadius=Math.max(l,u)*4.5+20,Pe(e,this.current.triangles,f),Le(e.id)}setLod(e){this.select(this.asset,e)}toggleWire(){return this.wireframe=!this.wireframe,this.wireframe}toggleSpin(){return this.spin=!this.spin,this.spin}rebuild(){this.current=null,this.buildPipelines(),this.buildGround(),this.resizeDepth(),this.select(this.asset,this.lod),this.alive=!0}suspend(){this.alive=!1}frame(e){if(!this.alive)return;this.spin&&(this.yaw+=e*.4);const f=this.gpu.viewport;this.render(this.gpu.context.getCurrentTexture().createView(),this.depthView,f.width,f.height)}async capture(e,f){if(!this.alive)return"";const{device:c}=this.gpu,h=Math.ceil(e/64)*64,r=c.createTexture({size:{width:h,height:f},format:this.gpu.format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),n=c.createTexture({size:{width:h,height:f},format:k,usage:GPUTextureUsage.RENDER_ATTACHMENT});this.render(r.createView(),n.createView(),h,f);const t=h*4,o=c.createBuffer({size:t*f,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),l=c.createCommandEncoder();l.copyTextureToBuffer({texture:r},{buffer:o,bytesPerRow:t},[h,f]),c.queue.submit([l.finish()]),await o.mapAsync(GPUMapMode.READ);const u=new Uint8ClampedArray(o.getMappedRange().slice(0));if(o.unmap(),o.destroy(),r.destroy(),n.destroy(),this.gpu.format.startsWith("bgra"))for(let a=0;a<u.length;a+=4){const v=u[a];u[a]=u[a+2],u[a+2]=v}const d=document.createElement("canvas");d.width=e,d.height=f;const s=d.getContext("2d");return s?(s.putImageData(new ImageData(u,h,f),0,0),d.toDataURL("image/png")):""}render(e,f,c,h){const r=this.current;if(!r||!this.alive)return;const{device:n}=this.gpu,t={width:c,height:h},o=[0,r.bounds.height*.45,0],l=Math.cos(this.pitch),u=[o[0]+this.distance*l*Math.sin(this.yaw),o[1]+this.distance*Math.sin(this.pitch)+r.bounds.height*.12,o[2]+this.distance*l*Math.cos(this.yaw)];j(this.view,u,o,[0,1,0]),re(this.proj,42*Math.PI/180,t.width/Math.max(t.height,1),.2,2e3),K(this.viewProj,this.proj,this.view);const d=Math.max(r.bounds.radius*1.7,r.bounds.height*.9,8),s=[0,r.bounds.height*.5,0],a=[s[0]+B[0]*d*2.6,s[1]+B[1]*d*2.6,s[2]+B[2]*d*2.6];j(this.sunView,a,s,[0,1,0]),ae(this.sunProj,-d,d,-d,d,.5,d*6),K(this.sunViewProj,this.sunProj,this.sunView),this.sceneData.set(this.viewProj,0),this.sceneData.set(this.sunViewProj,16),this.sceneData.set([u[0],u[1],u[2],0],32),this.sceneData.set([B[0],B[1],B[2],0],36),this.sceneData.set([this.asset.id.length*7.3+this.asset.id.charCodeAt(0),1/N,this.groundRadius,0],40),n.queue.writeBuffer(this.sceneBuffer,0,this.sceneData);const v=n.createCommandEncoder(),m=v.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:this.shadowView,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});m.setPipeline(this.shadowPipeline),m.setBindGroup(0,this.shadowBindGroup),m.setVertexBuffer(0,r.vertices),m.setIndexBuffer(r.indices,"uint32"),m.drawIndexed(r.indexCount),m.end();const g=v.beginRenderPass({colorAttachments:[{view:e,clearValue:{r:.043,g:.055,b:.075,a:1},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:f,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});g.setBindGroup(0,this.bindGroup),g.setPipeline(this.pipeline),g.setVertexBuffer(0,this.ground.vertices),g.setIndexBuffer(this.ground.indices,"uint32"),g.drawIndexed(this.ground.count),g.setVertexBuffer(0,r.vertices),g.setIndexBuffer(r.indices,"uint32"),g.drawIndexed(r.indexCount),this.wireframe&&(g.setPipeline(this.wirePipeline),g.setVertexBuffer(0,r.vertices),g.setIndexBuffer(r.edges,"uint32"),g.drawIndexed(r.edgeCount)),g.end(),n.queue.submit([v.finish()])}}const Ee=[["residential · low",p=>p.zone==="residential"&&p.density==="low"],["residential · medium",p=>p.zone==="residential"&&p.density==="medium"],["residential · high",p=>p.zone==="residential"&&p.density==="high"],["commercial",p=>p.zone==="commercial"],["industrial",p=>p.zone==="industrial"]];function Le(p){for(const e of document.querySelectorAll(".item"))e.classList.toggle("on",e.dataset.id===p)}function Pe(p,e,f){const c=document.getElementById("info");if(!c)return;const h=[0,1,2].map(t=>p.build(t).triangleCount),r=(t,o)=>`<div class="row"><span>${t}</span><b>${o}</b></div>`,n=p.sim;c.innerHTML=r("variant",p.variant)+r("footprint",`${p.footprint[0]}×${p.footprint[1]} cells · ${p.footprint[0]*8}×${p.footprint[1]*8} m`)+r("height",`${p.height.toFixed(1)} m`)+r(`triangles (LOD ${f})`,e.toLocaleString())+r("LOD ladder",h.map(t=>t.toLocaleString()).join(" → "))+(n.households?r("households",String(n.households)):"")+(n.jobs?r("jobs",String(n.jobs)):"")+r("power",`${n.powerKW} kW`)+r("upkeep",`${n.upkeep}/wk`)+`<div class="note">${p.note}</div>`}function Ae(p){const e=document.getElementById("list");if(e)for(const[f,c]of Ee){const h=E.filter(c);if(!h.length)continue;const r=document.createElement("div");r.className="group",r.textContent=f,e.appendChild(r);for(const n of h){const t=document.createElement("div");t.className="item",t.dataset.id=n.id,t.innerHTML=`<div class="n">${n.name}</div><div class="m">${n.variant} · ${n.build(0).triangleCount.toLocaleString()} tris</div>`,t.addEventListener("click",()=>p(n)),e.appendChild(t)}}}function T(p,e){const f=document.getElementById("stage")??document.body;let c=document.getElementById("fatal");c||(c=document.createElement("div"),c.id="fatal",f.appendChild(c)),c.innerHTML=`<div style="font-size:15px;margin-bottom:12px">${p}</div><div style="color:#5d6b80;font-size:11px;white-space:pre-wrap;max-width:60ch;text-align:left;line-height:1.7">${e.replace(/[<>&]/g,"")}</div><div style="color:#5d6b80;font-size:11px;margin-top:14px">press \` for the log</div>`,U.error("viewer",`${p} — ${e}`)}async function ze(){const p=document.getElementById("gpu-canvas");if(!(p instanceof HTMLCanvasElement))return;const e=document.getElementById("stage");e&&oe(e),addEventListener("error",s=>T("Something broke",`${s.message} @ ${s.filename}:${s.lineno}`)),addEventListener("unhandledrejection",s=>T("Something broke",String(s.reason)));let f;try{f=await se.create(p)}catch(s){s instanceof ie?T("This browser has no usable WebGPU",`${s.kind}: ${s.message}

Chrome or Edge 113+, Safari 18+, or Firefox 141+ on Windows.`):T("Could not start the GPU",String(s));return}f.device.addEventListener("uncapturederror",s=>{T("The GPU rejected something",s.error.message)}),f.device.pushErrorScope("validation");let c;try{c=new Ie(f)}catch(s){f.device.popErrorScope(),T("Could not build the render pipelines",String(s));return}const h=await f.device.popErrorScope();if(h){T("The GPU rejected a pipeline",h.message);return}let r=!1;f.onLost(async()=>{if(!r){r=!0,c.suspend();try{await f.recover(),c.rebuild(),U.info("viewer","device recovered")}catch(s){U.error("viewer",`recovery failed: ${String(s)}`)}r=!1}}),Ae(s=>c.select(s));const n=new URLSearchParams(location.search),t=E.find(s=>s.id===n.get("asset"))??E[0],o=Number(n.get("lod")??0);if(n.get("spin")==="0"&&c.toggleSpin(),n.get("hud")==="0"){for(const s of["side","bar","info","hint"])document.getElementById(s)?.remove();document.getElementById("app")?.style.setProperty("grid-template-columns","1fr")}try{c.select(t,o)}catch(s){T("Could not build that asset",String(s));return}Object.defineProperty(window,"viewer",{value:{show(s,a){const v=E.find(m=>m.id===s);return v?(c.select(v,a),!0):!1},ids:E.map(s=>s.id),capture:(s,a)=>c.capture(s,a),alive:()=>!r}});for(const s of document.querySelectorAll("[data-lod]"))s.addEventListener("click",()=>{for(const a of document.querySelectorAll("[data-lod]"))a.classList.remove("on");s.classList.add("on"),c.setLod(Number(s.dataset.lod))});document.getElementById("wire")?.addEventListener("click",s=>{s.currentTarget.classList.toggle("on",c.toggleWire())}),document.getElementById("spin")?.addEventListener("click",s=>{s.currentTarget.classList.toggle("on",c.toggleSpin())});let l=performance.now(),u=0;const d=s=>{const a=Math.min((s-l)/1e3,.1);l=s;try{c.frame(a),u++}catch(v){T("The render loop threw",String(v));return}requestAnimationFrame(d)};requestAnimationFrame(d),setTimeout(()=>{u===0&&T("Nothing rendered","The render loop never completed a frame.")},2500),U.info("viewer",`${E.length} assets`)}ze();
//# sourceMappingURL=asset-BJ7CM2Po.js.map
