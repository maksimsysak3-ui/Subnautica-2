import{m as oe,G as se,a as ie,l as U,b as z,c as $,d as j,p as re,e as K,o as ae}from"./m4-Cd1z1CQ_.js";const A=8,i={ROOF:0,HOUSING:1,GLASS:2,METAL:3,BRICK:4,TRIM:5,SHOPFRONT:6,TILE:7,HOUSE_WALL:9,SHED_WALL:10};class R{verts=[];idx=[];get triangleCount(){return this.idx.length/3}get vertexCount(){return this.verts.length/A}tri(e,d,c,h){const r=d[0]-e[0],o=d[1]-e[1],t=d[2]-e[2],s=c[0]-e[0],a=c[1]-e[1],u=c[2]-e[2];let l=o*u-t*a,f=t*s-r*u,n=r*a-o*s;const g=Math.hypot(l,f,n)||1;l/=g,f/=g,n/=g;const p=this.vertexCount;for(const w of[e,d,c])this.verts.push(w[0],w[1],w[2],l,f,n,h,1);this.idx.push(p,p+1,p+2)}quad(e,d,c,h,r){this.tri(e,d,c,r),this.tri(e,c,h,r)}box(e,d,c,h={}){const[r,o,t]=e,[s,a,u]=d,l=h.roof??c;this.quad([s,o,u],[s,o,t],[s,a,t],[s,a,u],c),this.quad([r,o,t],[r,o,u],[r,a,u],[r,a,t],c),this.quad([r,o,u],[s,o,u],[s,a,u],[r,a,u],c),this.quad([s,o,t],[r,o,t],[r,a,t],[s,a,t],c),this.quad([r,a,u],[s,a,u],[s,a,t],[r,a,t],l),h.skipBottom===!1&&this.quad([r,o,t],[s,o,t],[s,o,u],[r,o,u],c)}gable(e,d,c,h,r,o){const[t,s,a]=e,[u,,l]=d,f=s+c;if(h==="x"){const n=(a+l)/2;this.quad([t,s,l],[u,s,l],[u,f,n],[t,f,n],r),this.quad([u,s,a],[t,s,a],[t,f,n],[u,f,n],r),this.tri([u,s,l],[u,s,a],[u,f,n],o),this.tri([t,s,a],[t,s,l],[t,f,n],o)}else{const n=(t+u)/2;this.quad([u,s,l],[u,s,a],[n,f,a],[n,f,l],r),this.quad([t,s,a],[t,s,l],[n,f,l],[n,f,a],r),this.tri([t,s,l],[u,s,l],[n,f,l],o),this.tri([u,s,a],[t,s,a],[n,f,a],o)}}cylinder(e,d,c,h,r,o,t,s=!0){for(let a=0;a<o;a++){const u=a/o*Math.PI*2,l=(a+1)/o*Math.PI*2,f=[e+Math.cos(u)*c,h,d+Math.sin(u)*c],n=[e+Math.cos(l)*c,h,d+Math.sin(l)*c],g=[e+Math.cos(l)*c,r,d+Math.sin(l)*c],p=[e+Math.cos(u)*c,r,d+Math.sin(u)*c];this.quad(f,p,g,n,t),s&&this.tri([e,r,d],[e+Math.cos(l)*c,r,d+Math.sin(l)*c],[e+Math.cos(u)*c,r,d+Math.sin(u)*c],t)}}opening(e){const d=e.frame??.11,c=e.proud??.09,h=e.frameMat??i.TRIM,r=.06,o=(s,a,u,l,f,n,g)=>{const p=e.plane+e.sign*Math.min(f,n),w=e.plane+e.sign*Math.max(f,n);e.axis==="x"?this.box([p,u,s],[w,l,a],g):this.box([s,u,p],[a,l,w],g)},t=e.plane-e.sign*r;if(e.axis==="x"){const s=[t,e.y0,e.u0],a=[t,e.y0,e.u1],u=[t,e.y1,e.u1],l=[t,e.y1,e.u0];e.sign>0?this.quad(a,s,l,u,e.glass):this.quad(s,a,u,l,e.glass)}else{const s=[e.u0,e.y0,t],a=[e.u1,e.y0,t],u=[e.u1,e.y1,t],l=[e.u0,e.y1,t];e.sign>0?this.quad(s,a,u,l,e.glass):this.quad(a,s,l,u,e.glass)}o(e.u0-d,e.u1+d,e.y1,e.y1+d,-r,c,h),o(e.u0-d,e.u1+d,e.y0-d,e.y0,-r,c,h),o(e.u0-d,e.u0,e.y0,e.y1,-r,c,h),o(e.u1,e.u1+d,e.y0,e.y1,-r,c,h)}windowRow(e){const d=e.to-e.from;for(let c=0;c<e.count;c++){const h=e.from+(c+.5)/e.count*d;this.opening({axis:e.axis,sign:e.sign,plane:e.plane,u0:h-e.width/2,u1:h+e.width/2,y0:e.y0,y1:e.y1,glass:e.glass,...e.frame!==void 0?{frame:e.frame}:{},...e.proud!==void 0?{proud:e.proud}:{}})}}cone(e,d,c,h,r,o,t,s){for(let a=0;a<t;a++){const u=a/t*Math.PI*2,l=(a+1)/t*Math.PI*2,f=[e+Math.cos(u)*c,r,d+Math.sin(u)*c],n=[e+Math.cos(l)*c,r,d+Math.sin(l)*c];h<.001?this.tri(n,f,[e,o,d],s):this.quad(f,[e+Math.cos(u)*h,o,d+Math.sin(u)*h],[e+Math.cos(l)*h,o,d+Math.sin(l)*h],n,s)}}pipe(e,d,c,h){this.box([Math.min(e[0],d[0])-c,Math.min(e[1],d[1])-c,Math.min(e[2],d[2])-c],[Math.max(e[0],d[0])+c,Math.max(e[1],d[1])+c,Math.max(e[2],d[2])+c],h,{skipBottom:!1})}build(e={}){const d=new Float32Array(this.verts.length);d.set(this.verts);const c=new Uint32Array(this.idx.length);return c.set(this.idx),e.occlusion!==!1&&ue(d,c),{vertices:d,indices:c}}}const L=.34,O=9,le=3.4,ce=.7,_=.62,X=(()=>{const m=[];for(let d=0;d<20;d++){const c=Math.sqrt((d+.5)/20),h=Math.sqrt(1-c*c),r=(d+.5)*Math.PI*(3-Math.sqrt(5));m.push([Math.cos(r)*h,c,Math.sin(r)*h])}return m})();function Z(m,e,d){return(m+512|e+512<<10|d+512<<20)>>>0}function de(m,e){const d=new Set,c=(h,r,o)=>{d.add(Z(Math.floor(h/L),Math.floor(r/L),Math.floor(o/L)))};for(let h=0;h<e.length;h+=3){const r=e[h]*A,o=e[h+1]*A,t=e[h+2]*A,s=m[r],a=m[r+1],u=m[r+2],l=m[o],f=m[o+1],n=m[o+2],g=m[t],p=m[t+1],w=m[t+2],v=Math.max(Math.hypot(l-s,f-a,n-u),Math.hypot(g-s,p-a,w-u),Math.hypot(g-l,p-f,w-n)),b=Math.min(48,Math.max(2,Math.ceil(v/L*1.6)));for(let x=0;x<=b;x++)for(let M=0;M<=b-x;M++){const S=x/b,P=M/b,I=1-S-P;c(s*I+l*S+g*P,a*I+f*S+p*P,u*I+n*S+w*P)}}return d}function ue(m,e){if(e.length===0)return;const d=de(m,e),c=le/O;for(let h=0;h<m.length;h+=A){const r=m[h],o=m[h+1],t=m[h+2],s=m[h+3],a=m[h+4],u=m[h+5];let l=0,f=0,n=0;Math.abs(a)<.9?(l=-u,n=s):l=1;const g=Math.hypot(l,f,n)||1;l/=g,f/=g,n/=g;const p=a*n-u*f,w=u*l-s*n,v=s*f-a*l,b=r+s*_,x=o+a*_,M=t+u*_;let S=0;for(const[I,D,F]of X){const J=l*I+s*D+p*F,Q=f*I+a*D+w*F,ee=n*I+u*D+v*F;for(let B=1;B<=O;B++){const H=B*c,te=b+J*H,q=x+Q*H,ne=M+ee*H;if(q<0){S+=1-(B-1)/O;break}if(d.has(Z(Math.floor(te/L),Math.floor(q/L),Math.floor(ne/L)))){S+=1-(B-1)/O;break}}}const P=1-ce*(S/X.length);m[h+7]=Math.max(.08,Math.min(1,P))}}const y=8,W=m=>m*.39;function he(m){const e=new R,d=m<2,c=7.6,h=10.4,r=5.3,o=c/2,t=h/2,s=W(c);return e.box([-o,0,-t],[o,r,t],i.HOUSE_WALL,{roof:i.TRIM}),e.gable([-o,r,-t],[o,r,t],s,"z",i.TILE,i.HOUSE_WALL),d&&(e.box([-o-.42,r-.3,-t-.42],[o+.42,r,t+.42],i.TRIM),e.box([o-2.6,r+1.4,-1.1],[o-1.5,r+s+1.6,.2],i.BRICK),e.box([-1.5,2.55,t],[1.5,2.85,t+1.25],i.TRIM),e.box([-1.35,0,t+.95],[-1.05,2.55,t+1.2],i.TRIM),e.box([1.05,0,t+.95],[1.35,2.55,t+1.2],i.TRIM),e.box([-1.7,0,t],[1.7,.16,t+1.5],i.TRIM)),e}function fe(m){const e=new R,d=m<1,c=m<2,h=7.4,r=9.8,o=5.4,t=h/2,s=r/2,a=W(h);e.box([-t,0,-s],[t,o,s],i.BRICK,{roof:i.TRIM}),e.gable([-t,o,-s],[t,o,s],a,"z",i.TILE,i.BRICK);const u=4.3,l=3.1,f=-u/2,n=u/2,g=s-.2,p=s+l;if(c){e.box([f,0,g],[n,o-.5,p],i.BRICK,{roof:i.TRIM}),e.gable([f,o-.5,g],[n,o-.5,p],W(u),"x",i.TILE,i.BRICK);const w=t-.3,v=t+4.7;e.box([w,0,-s+1.4],[v,3.1,s-1.6],i.BRICK,{roof:i.TRIM}),e.gable([w,3.1,-s+1.4],[v,3.1,s-1.6],1.5,"z",i.TILE,i.BRICK),e.box([-t-.42,o-.3,-s-.42],[t+.42,o,s+.42],i.TRIM),e.box([f-.36,o-.8,g],[n+.36,o-.5,p+.36],i.TRIM),e.box([w,2.82,-s+1.05],[v+.3,3.1,s-1.25],i.TRIM),e.box([-t-.05,o+.4,-1.6],[-t+1.5,o+2,.1],i.BRICK),e.gable([-t-.2,o+2,-1.75],[-t+1.65,o+2,.25],.7,"z",i.TILE,i.BRICK),e.box([t-2.3,o+1.2,-2.4],[t-1.2,o+a+1.8,-1.1],i.BRICK),e.box([t-2.5,o+a+1.8,-2.6],[t-1,o+a+2.1,-.9],i.TRIM)}if(d){e.box([n+.1,0,p-2.4],[n+3.4,.16,p],i.TRIM),e.box([n+.1,2.6,p-2.6],[n+3.6,2.92,p+.25],i.TRIM);for(const w of[n+.45,n+3.1])e.box([w-.14,.16,p-.4],[w+.14,2.6,p-.12],i.TRIM);for(let w=0;w<8;w++){const v=n+.5+w/7*2.55;e.box([v-.04,.16,p-.32],[v+.04,.98,p-.2],i.TRIM)}e.box([n+.35,.98,p-.38],[n+3.25,1.1,p-.14],i.TRIM);for(let w=0;w<2;w++){const v=.16-w*.07;e.box([n+.5,1e-4,p+.05+w*.24],[n+2.4,v,p+.29+w*.24],i.TRIM)}e.opening({axis:"z",sign:1,plane:p,u0:n+1.1,u1:n+2.1,y0:.16,y1:2.3,glass:i.TRIM,frame:.13,proud:.09}),e.box([f+.5,.3,p],[n-.5,2.9,p+.5],i.BRICK,{roof:i.TRIM}),e.opening({axis:"z",sign:1,plane:p+.5,u0:f+.75,u1:n-.75,y0:.75,y1:2.55,glass:i.GLASS,frame:.1,proud:.07}),e.windowRow({axis:"z",sign:1,plane:p,from:f,to:n,y0:3.3,y1:4.7,count:1,width:1.5,glass:i.GLASS,frame:.1,proud:.07});for(const[w,v]of[[1,t],[-1,-t]])e.windowRow({axis:"x",sign:w,plane:v,from:-s+1.2,to:s-1.2,y0:1.2,y1:2.7,count:2,width:1.2,glass:i.GLASS,frame:.09,proud:.06}),e.windowRow({axis:"x",sign:w,plane:v,from:-s+1.2,to:s-1.2,y0:3.4,y1:4.8,count:2,width:1.2,glass:i.GLASS,frame:.09,proud:.06});e.windowRow({axis:"z",sign:-1,plane:-s,from:-t+1,to:t-1,y0:1.3,y1:2.8,count:2,width:1.3,glass:i.GLASS,frame:.09,proud:.06}),e.windowRow({axis:"z",sign:-1,plane:-s,from:-t+1,to:t-1,y0:3.5,y1:4.9,count:2,width:1.3,glass:i.GLASS,frame:.09,proud:.06}),e.opening({axis:"z",sign:1,plane:.1,u0:-t+.35,u1:-t+1.1,y0:o+.85,y1:o+1.8,glass:i.GLASS,frame:.08,proud:.05}),e.opening({axis:"z",sign:1,plane:s-1.6,u0:t+.4,u1:t+4,y0:.15,y1:2.5,glass:i.TRIM,frame:.12,proud:.09}),e.box([-t-.42,o-.44,s+.24],[t+.42,o-.3,s+.42],i.TRIM),e.box([-t-.42,o-.44,-s-.42],[t+.42,o-.3,-s-.24],i.TRIM);for(const w of[-t-.3,t+.16])e.box([w,0,s+.26],[w+.14,o-.44,s+.4],i.TRIM)}return e}function pe(m){const e=new R,d=y*2-1.6,c=y*2-2.4,h=15.5,r=d/2,o=c/2;return e.box([-r,0,-o],[r,h,o],i.HOUSING,{roof:i.ROOF}),m<2&&e.box([-r-.16,h,-o-.16],[r+.16,h+.8,o+.16],i.TRIM),e}function me(m){const e=new R,d=m<1,c=m<2,h=y*2-1.6,r=y*2-2.4,o=5,t=3.1,s=o*t,a=h/2,u=r/2;if(e.box([-a,0,-u],[a,s,u],i.HOUSING,{roof:i.ROOF}),e.box([-a-.18,s,-u-.18],[a+.18,s+.9,u+.18],i.TRIM),e.box([-a-.22,0,-u-.22],[a+.22,3.4,u+.22],i.BRICK,{roof:i.TRIM}),c){for(let f=1;f<o;f++){const n=3.4+(f-1)*t+.1;for(let g=0;g<4;g++){const p=-a+(g+.5)/4*h;for(const[w,v]of[[u,1],[-u,-1]]){const b=1.25*v;e.box([p-1.4,n,Math.min(w,w+b)],[p+1.4,n+.16,Math.max(w,w+b)],i.TRIM);const x=w+b;e.box([p-1.4,n+.16,Math.min(x,x-.1*v)],[p+1.4,n+1.16,Math.max(x,x-.1*v)],i.TRIM)}}}e.box([-1.6,s,-1.4],[1.6,s+3,1.4],i.BRICK,{roof:i.ROOF}),e.box([a-3.6,s+.9,-2.2],[a-1.4,s+2.1,.6],i.METAL)}if(d){for(let l=0;l<o;l++){const f=3.4+(l-1)*t+.9;if(l!==0){for(const[n,g]of[[1,u],[-1,-u]])e.windowRow({axis:"z",sign:n,plane:g,from:-a+.8,to:a-.8,y0:f,y1:f+1.5,count:3,width:1.15,glass:i.GLASS,frame:.08,proud:.06});for(const[n,g]of[[1,a],[-1,-a]])e.windowRow({axis:"x",sign:n,plane:g,from:-u+.8,to:u-.8,y0:f,y1:f+1.5,count:2,width:1.25,glass:i.GLASS,frame:.08,proud:.06})}}for(const[l,f]of[[1,u],[-1,-u]])e.windowRow({axis:"z",sign:l,plane:f,from:-a+.9,to:a-.9,y0:.9,y1:2.9,count:3,width:1.7,glass:i.SHOPFRONT,frame:.1,proud:.07})}return e}function ge(m){const e=new R,d=y*3-2.4,c=y*3-2.4,h=d/2,r=c/2,o=9,t=62;e.box([-h,0,-r],[h,o,r],i.HOUSING,{roof:i.ROOF});const s=h*.72,a=r*.72;return e.box([-s,o,-a],[s,t,a],i.HOUSING,{roof:i.ROOF}),m<2&&e.box([-s-.2,t,-a-.2],[s+.2,t+1.1,a+.2],i.TRIM),e}function we(m){const e=new R,d=m<1,c=m<2,h=y*3-2.4,r=y*3-2.4,o=h/2,t=r/2,s=9.5,a=19,u=3.05,l=s+a*u,f=o*.7,n=t*.7;if(e.box([-o,0,-t],[o,s,t],i.BRICK,{roof:i.ROOF}),e.box([-o-.25,s,-t-.25],[o+.25,s+.7,t+.25],i.TRIM),e.box([-f,s,-n],[f,l,n],i.HOUSING,{roof:i.ROOF}),c){for(let p=0;p<=5;p++){const w=p/5,v=-f+w*f*2,b=-n+w*n*2;e.box([v-.16,s,n],[v+.16,l,n+.34],i.TRIM),e.box([v-.16,s,-n-.34],[v+.16,l,-n],i.TRIM),e.box([f,s,b-.16],[f+.34,l,b+.16],i.TRIM),e.box([-f-.34,s,b-.16],[-f,l,b+.16],i.TRIM)}for(let p=2;p<a;p+=3){const w=s+p*u;e.box([-f-.9,w,-n-.9],[f+.9,w+.18,n+.9],i.TRIM),e.box([-f-.9,w+.18,n+.78],[f+.9,w+1.1,n+.9],i.TRIM),e.box([-f-.9,w+.18,-n-.9],[f+.9,w+1.1,-n-.78],i.TRIM)}e.box([-f-.3,l,-n-.3],[f+.3,l+1.4,n+.3],i.TRIM),e.box([-f*.55,l,-n*.55],[f*.55,l+4.2,n*.55],i.METAL,{roof:i.ROOF}),e.box([-.22,l+4.2,-.22],[.22,l+11,.22],i.TRIM)}if(d){for(let g=0;g<a;g++){const p=s+g*u+.85,w=p+1.55;for(const[v,b]of[[1,n],[-1,-n]])e.opening({axis:"z",sign:v,plane:b,u0:-f+.75,u1:f-.75,y0:p,y1:w,glass:i.GLASS,frame:.09,proud:.05});for(const[v,b]of[[1,f],[-1,-f]])e.opening({axis:"x",sign:v,plane:b,u0:-n+.75,u1:n-.75,y0:p,y1:w,glass:i.GLASS,frame:.09,proud:.05})}for(const[g,p]of[[1,t],[-1,-t]])e.windowRow({axis:"z",sign:g,plane:p,from:-o+1,to:o-1,y0:1,y1:3.6,count:4,width:2.2,glass:i.SHOPFRONT,frame:.11,proud:.08})}return e}const G=m=>m*1.6,ve=[{id:"res.low.shaded",name:"Detached house",zone:"residential",density:"low",variant:"shaded",footprint:[2,2],height:9.7,sim:{households:1,powerKW:G(1),waterM3:.6,garbagePerWeek:12,pollution:0,upkeep:6},note:"Box, gable, chimney. Brick coursework, windows and door are all shader.",build:he},{id:"res.low.sculpted",name:"Detached house, modelled",zone:"residential",density:"low",variant:"sculpted",footprint:[2,2],height:10.4,sim:{households:1,powerKW:G(1),waterM3:.6,garbagePerWeek:12,pollution:0,upkeep:7},note:"Garage wing, eaves, porch, dormers, window reveals — the same house with the detail built.",build:fe},{id:"res.mid.shaded",name:"Apartment block",zone:"residential",density:"medium",variant:"shaded",footprint:[2,2],height:16.3,sim:{households:24,powerKW:G(24),waterM3:14,garbagePerWeek:260,pollution:1,upkeep:48},note:"Slab and a parapet. Every window and floor line is drawn by the shader.",build:pe},{id:"res.mid.sculpted",name:"Apartment block, balconied",zone:"residential",density:"medium",variant:"sculpted",footprint:[2,2],height:18.5,sim:{households:24,powerKW:G(24),waterM3:14,garbagePerWeek:260,pollution:1,upkeep:54},note:"Balconies on all four elevations, a masonry base, stair core and roof plant.",build:me},{id:"res.high.shaded",name:"Residential tower",zone:"residential",density:"high",variant:"shaded",footprint:[3,3],height:63,sim:{households:180,powerKW:G(180),waterM3:96,garbagePerWeek:1900,pollution:2,upkeep:340},note:"Podium, setback, tower, parapet. Four boxes.",build:ge},{id:"res.high.sculpted",name:"Residential tower, finned",zone:"residential",density:"high",variant:"sculpted",footprint:[3,3],height:79,sim:{households:180,powerKW:G(180),waterM3:96,garbagePerWeek:1900,pollution:2,upkeep:380},note:"Vertical fins the full height, balcony bands every third floor, crown and mast.",build:we}];function be(m){const e=new R,d=y*2-1.4,c=y*2-2,h=d/2,r=c/2,o=4.6,t=24;return e.box([-h,0,-r],[h,o,r],i.SHOPFRONT,{roof:i.TRIM}),e.box([-h,o,-r],[h,t,r],i.GLASS,{roof:i.ROOF}),m<2&&e.box([-h-.2,t,-r-.2],[h+.2,t+1,r+.2],i.TRIM),e}function xe(m){const e=new R,d=m<1,c=m<2,h=y*2-1.4,r=y*2-2,o=h/2,t=r/2,s=5,a=7,u=3.6,l=s+a*u;if(e.box([-o+.5,0,-t+.5],[o-.5,s,t-.5],i.SHOPFRONT,{roof:i.TRIM}),e.box([-o,s,-t],[o,l,t],i.GLASS,{roof:i.ROOF}),c){for(const f of[-1,1])for(const n of[-1,1])e.box([f*o-f*.55,0,n*t-n*.55],[f*o,s,n*t],i.TRIM);e.box([-o-.9,s-.7,-t-.9],[o+.9,s-.42,t+.9],i.TRIM);for(let f=1;f<=a;f++){const n=s+f*u-.5;e.box([-o-.14,n,-t-.14],[o+.14,n+.5,t+.14],i.TRIM)}e.box([-o-.42,l,-t-.42],[o+.42,l+1.3,t+.42],i.TRIM),e.box([-2.6,l,-1.9],[1.4,l+2.6,1.9],i.METAL,{roof:i.ROOF}),e.box([2,l,-2.4],[4.2,l+1.2,-.2],i.METAL),e.cylinder(3,1.8,.85,l,l+1.9,10,i.METAL)}if(d){for(let f=0;f<a;f++){const n=s+f*u+.35,g=n+u-1.05;for(const[p,w]of[[1,t],[-1,-t]])e.windowRow({axis:"z",sign:p,plane:w,from:-o+.6,to:o-.6,y0:n,y1:g,count:2,width:4.6,glass:i.GLASS,frame:.07,proud:.05});for(const[p,w]of[[1,o],[-1,-o]])e.windowRow({axis:"x",sign:p,plane:w,from:-t+.6,to:t-.6,y0:n,y1:g,count:2,width:4,glass:i.GLASS,frame:.07,proud:.05})}for(const[f,n]of[[1,t-.5],[-1,-t+.5]])e.windowRow({axis:"z",sign:f,plane:n,from:-o+1.2,to:o-1.2,y0:.7,y1:4.1,count:3,width:3,glass:i.SHOPFRONT,frame:.12,proud:.08})}return e}const ye=[{id:"com.shaded",name:"Retail and offices",zone:"commercial",density:"medium",variant:"shaded",footprint:[2,2],height:25,sim:{jobs:90,powerKW:210,waterM3:22,garbagePerWeek:480,pollution:2,upkeep:160},note:"Two boxes: shopfront base, glass above. Mullions and signage are shader.",build:be},{id:"com.sculpted",name:"Retail and offices, articulated",zone:"commercial",density:"medium",variant:"sculpted",footprint:[2,2],height:31,sim:{jobs:90,powerKW:210,waterM3:22,garbagePerWeek:480,pollution:2,upkeep:175},note:"Recessed shopfront on columns, pavement canopy, spandrel band per floor, cornice, roof plant.",build:xe}];function Me(m){const e=new R,d=m<2,c=25,h=17,r=9.2,o=2.6,t=c/2,s=h/2,a=-1.5;if(e.box([-t,0,a-s],[t,r,a+s],i.SHED_WALL,{roof:i.TRIM}),e.gable([-t,r,a-s],[t,r,a+s],o,"x",i.METAL,i.SHED_WALL),d){e.box([-t-.45,r-.35,a-s-.45],[t+.45,r,a+s+.45],i.TRIM),e.box([-t,r+o-.18,a-.35],[t,r+o+.2,a+.35],i.TRIM);for(let u=0;u<3;u++){const l=-t+4.6+u*7.4;e.box([l-2.2,0,a+s-.05],[l+2.2,5,a+s+.16],i.TRIM),e.box([l-2.4,5,a+s-.05],[l+2.4,5.35,a+s+.3],i.TRIM)}e.box([-t+.6,6.4,a+s],[t-.6,6.75,a+s+2.6],i.METAL),e.box([t-3.4,0,a+s-.05],[t-2.2,2.4,a+s+.14],i.TRIM),e.box([-t+.8,0,a+s],[t-.8,1.15,a+s+2.4],i.TRIM),e.cylinder(-5,a,.7,r+o-.4,r+o+1.3,10,i.METAL),e.cylinder(5,a,.7,r+o-.4,r+o+1.3,10,i.METAL)}return e}function Te(m){const e=new R,d=m<1,c=m<2,h=17,r=13,o=10.5,t=-32/2+h/2+1,s=.4,a=t-h/2,u=t+h/2,l=s-r/2,f=s+r/2;if(e.box([a,0,l],[u,o,f],i.METAL,{roof:i.ROOF}),c){const g=h/5,p=3.4;for(let v=0;v<5;v++){const b=a+v*g,x=b+g;e.quad([b,o,f],[x,o,f],[x,o+p,l],[b,o+p,l],i.METAL),e.quad([b,o,l],[b,o+p,l],[x,o+p,l],[x,o,l],i.GLASS),e.tri([b,o,f],[b,o+p,l],[b,o,l],i.METAL),e.tri([x,o,f],[x,o,l],[x,o+p,l],i.METAL)}e.box([u-5,0,l-5.6],[u+3.2,17.5,l+.4],i.METAL,{roof:i.ROOF}),e.box([u-5.3,17.5,l-5.9],[u+3.5,18.3,l+.7],i.TRIM);const w=(v,b,x,M)=>{e.cylinder(v,b,x*1.06,0,1.1,14,i.TRIM),e.cylinder(v,b,x,1.1,M,16,i.METAL,!1),e.cone(v,b,x,x*.34,M,M+x*.8,16,i.METAL),e.cylinder(v,b,x*.34,M+x*.8,M+x*1.1,10,i.TRIM)};w(7,-4,2.5,15),w(7,2.6,2,12),w(12.4,-1.2,1.6,9.5),e.cylinder(13.2,-7.6,1.15,0,23,12,i.TRIM,!1);for(const v of[7,13,19])e.cylinder(13.2,-7.6,1.3,v,v+.55,12,i.METAL,!1);e.box([a+1,0,f],[u-1,1.2,f+2],i.TRIM);for(let v=0;v<2;v++){const b=a+4.6+v*7;e.box([b-2,1.2,f-.1],[b+2,5.6,f+.12],i.TRIM)}e.box([a+.6,6.2,f],[u-.6,6.55,f+2.4],i.METAL),e.box([a-.4,0,f-6.4],[a+4.6,4,f-1.4],i.BRICK,{roof:i.ROOF}),e.box([a-.7,4,f-6.7],[a+4.9,4.45,f-1.1],i.TRIM)}if(d){for(const[n,g]of[[1,f],[-1,l]])e.windowRow({axis:"z",sign:n,plane:g,from:a+1.2,to:u-1.2,y0:6.8,y1:8.6,count:5,width:2.1,glass:i.GLASS,frame:.09,proud:.06});e.opening({axis:"z",sign:1,plane:f-1.4,u0:a+1.6,u1:a+2.6,y0:.1,y1:2.3,glass:i.TRIM,frame:.1,proud:.07}),e.windowRow({axis:"z",sign:1,plane:f-1.4,from:a+3,to:a+4.4,y0:1.2,y1:2.7,count:1,width:1.2,glass:i.GLASS,frame:.09,proud:.06}),e.windowRow({axis:"x",sign:-1,plane:a-.4,from:f-5.8,to:f-2,y0:1.2,y1:2.7,count:3,width:.9,glass:i.GLASS,frame:.09,proud:.06});for(let n=0;n<4;n++){const g=1+n*3.6;e.box([g-.18,0,-6.6],[g+.18,6.4,-6.24],i.TRIM),e.box([g-.18,0,-1],[g+.18,6.4,-.64],i.TRIM),e.box([g-.24,6.4,-6.7],[g+.24,6.9,-.54],i.TRIM)}for(const n of[-5.6,-4.2,-2.4])e.pipe([.4,6.9,n],[14,6.9,n],.22,i.METAL);e.pipe([7,6.9,-4],[7,14,-4],.2,i.METAL),e.pipe([7,6.9,2.6],[7,11.4,2.6],.2,i.METAL);for(let n=0;n<14;n++){const g=1+n*1.15;e.box([u+3.2,g,l-5.2+n*.32],[u+4.6,g+.12,l-4.6+n*.32],i.TRIM)}e.box([u+3.1,.8,l-5.4],[u+3.3,17.4,l-.6],i.TRIM),e.box([u+4.5,.8,l-5.4],[u+4.7,17.4,l-.6],i.TRIM);for(let n=0;n<16;n++){const g=1.4+n*.85;e.box([9.3,g,-4.2],[9.9,g+.09,-3.8],i.TRIM)}for(let n=0;n<12;n++){const g=n/12*Math.PI*2;e.box([7+Math.cos(g)*2.7-.06,15,-4+Math.sin(g)*2.7-.06],[7+Math.cos(g)*2.7+.06,16.1,-4+Math.sin(g)*2.7+.06],i.TRIM)}e.cylinder(7,-4,2.76,15,15.12,14,i.TRIM,!1);for(let n=0;n<3;n++)e.cylinder(a+3.4+n*4.6,s+3,.6,o+3.4,o+4.7,10,i.METAL)}return e}const Re=[{id:"ind.shaded",name:"Distribution shed",zone:"industrial",density:"none",variant:"shaded",footprint:[4,3],height:13.1,sim:{jobs:40,powerKW:130,waterM3:8,garbagePerWeek:300,pollution:8,upkeep:90},note:"Shed, shutters, canopy, apron. Corrugation and the clerestory band are shader.",build:Me},{id:"ind.sculpted",name:"Processing plant",zone:"industrial",density:"none",variant:"sculpted",footprint:[4,3],height:23,sim:{jobs:40,powerKW:130,waterM3:8,garbagePerWeek:300,pollution:14,upkeep:105},note:"Sawtooth shed, process block, three silos, banded stack, pipe rack, access stairs, dock.",build:Te}],E=[...ve,...ye,...Re],Se=`// Facade shading for procedural assets.
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
`,k="depth24plus",N="depth24plus",V=1024,Y=176,C=(()=>{const m=[.48,.68,.38],e=Math.hypot(...m);return[m[0]/e,m[1]/e,m[2]/e]})();class Ie{constructor(e,d=!0){this.gpu=e,this.shadows=d,this.buildPipelines(),this.buildGround(),this.resizeDepth(),e.onResize(()=>this.resizeDepth()),this.hookInput()}pipeline;wirePipeline;shadowPipeline;shadowBindGroup;sceneBuffer;bindGroup;depth=null;depthView;shadowView;ground;current=null;alive=!0;shadows=!0;dummyShadow=null;debug={frames:0,indices:0,height:0,radius:0,distance:0,error:""};yaw=Math.PI*.75;pitch=.36;distance=30;spin=!0;wireframe=!1;lod=0;asset=E[0];view=z();proj=z();viewProj=z();sunView=z();sunProj=z();sunViewProj=z();sceneData=new Float32Array(Y/4);groundRadius=60;buildPipelines(){const{device:e,format:d}=this.gpu,c=e.createShaderModule({label:"asset",code:Se}),h=e.createTexture({label:"shadow-map",size:{width:V,height:V},format:N,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});this.shadowView=h.createView();const r=e.createTexture({label:"shadow-off",size:{width:1,height:1},format:N,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});this.dummyShadow=r.createView();const o=e.createCommandEncoder();o.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:this.dummyShadow,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}}).end(),e.queue.submit([o.finish()]);const t=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"depth"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"comparison"}}]}),s=e.createPipelineLayout({bindGroupLayouts:[t]}),a=[{arrayStride:A*4,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32"},{shaderLocation:3,offset:28,format:"float32"}]}];this.pipeline=e.createRenderPipeline({label:"asset-solid",layout:s,vertex:{module:c,entryPoint:"vs",buffers:a},fragment:{module:c,entryPoint:"fs",targets:[{format:d}]},primitive:{topology:"triangle-list",cullMode:"back",frontFace:"ccw"},depthStencil:{format:k,depthWriteEnabled:!0,depthCompare:"less"}}),this.wirePipeline=e.createRenderPipeline({label:"asset-wire",layout:s,vertex:{module:c,entryPoint:"vs",buffers:a},fragment:{module:c,entryPoint:"fs_wire",targets:[{format:d}]},primitive:{topology:"line-list"},depthStencil:{format:k,depthWriteEnabled:!1,depthCompare:"less-equal"}});const u=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}}]}),l=e.createPipelineLayout({bindGroupLayouts:[u]});this.shadowPipeline=e.createRenderPipeline({label:"asset-shadow",layout:l,vertex:{module:c,entryPoint:"vs_shadow",buffers:a},primitive:{topology:"triangle-list",cullMode:"front",frontFace:"ccw"},depthStencil:{format:N,depthWriteEnabled:!0,depthCompare:"less"}}),this.sceneBuffer=e.createBuffer({size:Y,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.shadowBindGroup=e.createBindGroup({layout:u,entries:[{binding:0,resource:{buffer:this.sceneBuffer}}]}),this.bindGroup=e.createBindGroup({layout:t,entries:[{binding:0,resource:{buffer:this.sceneBuffer}},{binding:1,resource:this.shadows?this.shadowView:this.dummyShadow??this.shadowView},{binding:2,resource:e.createSampler({compare:"less"})}]})}buildGround(){const{device:e}=this.gpu,d=400,c=new Float32Array([-d,0,-d,0,1,0,8,1,d,0,-d,0,1,0,8,1,d,0,d,0,1,0,8,1,-d,0,d,0,1,0,8,1]),h=new Uint32Array([0,2,1,0,3,2]),r=e.createBuffer({size:c.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(r,0,c);const o=e.createBuffer({size:h.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(o,0,h),this.ground={vertices:r,indices:o,count:h.length}}resizeDepth(){const e=this.gpu.viewport;this.depth?.destroy(),this.depth=this.gpu.device.createTexture({size:{width:e.width,height:e.height},format:k,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.depthView=this.depth.createView()}hookInput(){const e=this.gpu.canvas;let d=!1,c=0,h=0;e.addEventListener("pointerdown",r=>{d=!0,c=r.clientX,h=r.clientY,e.setPointerCapture(r.pointerId),this.spin=!1,document.getElementById("spin")?.classList.remove("on")}),e.addEventListener("pointerup",r=>{d=!1,e.hasPointerCapture(r.pointerId)&&e.releasePointerCapture(r.pointerId)}),e.addEventListener("pointermove",r=>{d&&(this.yaw-=(r.clientX-c)*.007,this.pitch=$(this.pitch+(r.clientY-h)*.005,-.15,1.35),c=r.clientX,h=r.clientY)}),e.addEventListener("wheel",r=>{r.preventDefault(),this.distance=$(this.distance*Math.exp(r.deltaY*.0012),4,400)},{passive:!1})}select(e,d=this.lod){this.asset=e,this.lod=d;const c=e.build(d).build(),{device:h}=this.gpu;this.current?.vertices.destroy(),this.current?.indices.destroy(),this.current?.edges.destroy();const r=h.createBuffer({size:Math.max(c.vertices.byteLength,4),usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});h.queue.writeBuffer(r,0,c.vertices);const o=h.createBuffer({size:Math.max(c.indices.byteLength,4),usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});h.queue.writeBuffer(o,0,c.indices);const t=new Uint32Array(c.indices.length*2);for(let l=0;l<c.indices.length;l+=3){const f=c.indices[l],n=c.indices[l+1],g=c.indices[l+2],p=l*2;t[p]=f,t[p+1]=n,t[p+2]=n,t[p+3]=g,t[p+4]=g,t[p+5]=f}const s=h.createBuffer({size:Math.max(t.byteLength,4),usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});h.queue.writeBuffer(s,0,t);let a=0,u=1;for(let l=0;l<c.vertices.length;l+=A)a=Math.max(a,c.vertices[l+1]),u=Math.max(u,Math.hypot(c.vertices[l],c.vertices[l+2]));this.current={vertices:r,indices:o,indexCount:c.indices.length,edges:s,edgeCount:t.length,bounds:{height:a,radius:u},triangles:c.indices.length/3},this.distance=Math.max(a*1.5,u*3.4,12),this.groundRadius=Math.max(a,u)*4.5+20,Ae(e,this.current.triangles,d),Le(e.id)}setLod(e){this.select(this.asset,e)}toggleWire(){return this.wireframe=!this.wireframe,this.wireframe}toggleSpin(){return this.spin=!this.spin,this.spin}rebuild(){this.current=null,this.buildPipelines(),this.buildGround(),this.resizeDepth(),this.select(this.asset,this.lod),this.alive=!0}suspend(){this.alive=!1}frame(e){if(!this.alive)return;this.spin&&(this.yaw+=e*.4);const d=this.gpu.viewport;this.render(this.gpu.context.getCurrentTexture().createView(),this.depthView,d.width,d.height)}async capture(e,d){if(!this.alive)return"";const{device:c}=this.gpu,h=Math.ceil(e/64)*64,r=c.createTexture({size:{width:h,height:d},format:this.gpu.format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),o=c.createTexture({size:{width:h,height:d},format:k,usage:GPUTextureUsage.RENDER_ATTACHMENT});this.render(r.createView(),o.createView(),h,d);const t=h*4,s=c.createBuffer({size:t*d,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),a=c.createCommandEncoder();a.copyTextureToBuffer({texture:r},{buffer:s,bytesPerRow:t},[h,d]),c.queue.submit([a.finish()]),await s.mapAsync(GPUMapMode.READ);const u=new Uint8ClampedArray(s.getMappedRange().slice(0));if(s.unmap(),s.destroy(),r.destroy(),o.destroy(),this.gpu.format.startsWith("bgra"))for(let n=0;n<u.length;n+=4){const g=u[n];u[n]=u[n+2],u[n+2]=g}const l=document.createElement("canvas");l.width=e,l.height=d;const f=l.getContext("2d");return f?(f.putImageData(new ImageData(u,h,d),0,0),l.toDataURL("image/png")):""}render(e,d,c,h){const r=this.current;if(!r||!this.alive)return;const{device:o}=this.gpu,t={width:c,height:h},s=[0,r.bounds.height*.45,0],a=Math.cos(this.pitch),u=[s[0]+this.distance*a*Math.sin(this.yaw),s[1]+this.distance*Math.sin(this.pitch)+r.bounds.height*.12,s[2]+this.distance*a*Math.cos(this.yaw)];j(this.view,u,s,[0,1,0]),re(this.proj,42*Math.PI/180,t.width/Math.max(t.height,1),.2,2e3),K(this.viewProj,this.proj,this.view);const l=Math.max(r.bounds.radius*1.7,r.bounds.height*.9,8),f=[0,r.bounds.height*.5,0],n=[f[0]+C[0]*l*2.6,f[1]+C[1]*l*2.6,f[2]+C[2]*l*2.6];j(this.sunView,n,f,[0,1,0]),ae(this.sunProj,-l,l,-l,l,.5,l*6),K(this.sunViewProj,this.sunProj,this.sunView),this.sceneData.set(this.viewProj,0),this.sceneData.set(this.sunViewProj,16),this.sceneData.set([u[0],u[1],u[2],0],32),this.sceneData.set([C[0],C[1],C[2],0],36),this.sceneData.set([this.asset.id.length*7.3+this.asset.id.charCodeAt(0),1/V,this.groundRadius,0],40),o.queue.writeBuffer(this.sceneBuffer,0,this.sceneData);const g=o.createCommandEncoder();if(this.shadows){const w=g.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:this.shadowView,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});w.setPipeline(this.shadowPipeline),w.setBindGroup(0,this.shadowBindGroup),w.setVertexBuffer(0,r.vertices),w.setIndexBuffer(r.indices,"uint32"),w.drawIndexed(r.indexCount),w.end()}const p=g.beginRenderPass({colorAttachments:[{view:e,clearValue:{r:.043,g:.055,b:.075,a:1},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:d,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});p.setBindGroup(0,this.bindGroup),p.setPipeline(this.pipeline),p.setVertexBuffer(0,this.ground.vertices),p.setIndexBuffer(this.ground.indices,"uint32"),p.drawIndexed(this.ground.count),p.setVertexBuffer(0,r.vertices),p.setIndexBuffer(r.indices,"uint32"),p.drawIndexed(r.indexCount),this.wireframe&&(p.setPipeline(this.wirePipeline),p.setVertexBuffer(0,r.vertices),p.setIndexBuffer(r.edges,"uint32"),p.drawIndexed(r.edgeCount)),p.end(),o.queue.submit([g.finish()]),this.debug.frames++,this.debug.indices=r.indexCount,this.debug.height=r.bounds.height,this.debug.radius=r.bounds.radius,this.debug.distance=this.distance}}const Ee=[["residential · low",m=>m.zone==="residential"&&m.density==="low"],["residential · medium",m=>m.zone==="residential"&&m.density==="medium"],["residential · high",m=>m.zone==="residential"&&m.density==="high"],["commercial",m=>m.zone==="commercial"],["industrial",m=>m.zone==="industrial"]];function Le(m){for(const e of document.querySelectorAll(".item"))e.classList.toggle("on",e.dataset.id===m)}function Ae(m,e,d){const c=document.getElementById("info");if(!c)return;const h=[0,1,2].map(t=>m.build(t).triangleCount),r=(t,s)=>`<div class="row"><span>${t}</span><b>${s}</b></div>`,o=m.sim;c.innerHTML=r("variant",m.variant)+r("footprint",`${m.footprint[0]}×${m.footprint[1]} cells · ${m.footprint[0]*8}×${m.footprint[1]*8} m`)+r("height",`${m.height.toFixed(1)} m`)+r(`triangles (LOD ${d})`,e.toLocaleString())+r("LOD ladder",h.map(t=>t.toLocaleString()).join(" → "))+(o.households?r("households",String(o.households)):"")+(o.jobs?r("jobs",String(o.jobs)):"")+r("power",`${o.powerKW} kW`)+r("upkeep",`${o.upkeep}/wk`)+`<div class="note">${m.note}</div>`}function Pe(m){const e=document.getElementById("list");if(e)for(const[d,c]of Ee){const h=E.filter(c);if(!h.length)continue;const r=document.createElement("div");r.className="group",r.textContent=d,e.appendChild(r);for(const o of h){const t=document.createElement("div");t.className="item",t.dataset.id=o.id,t.innerHTML=`<div class="n">${o.name}</div><div class="m">${o.variant} · ${o.build(0).triangleCount.toLocaleString()} tris</div>`,t.addEventListener("click",()=>m(o)),e.appendChild(t)}}}function T(m,e){const d=document.getElementById("stage")??document.body;let c=document.getElementById("fatal");c||(c=document.createElement("div"),c.id="fatal",d.appendChild(c)),c.innerHTML=`<div style="font-size:15px;margin-bottom:12px">${m}</div><div style="color:#5d6b80;font-size:11px;white-space:pre-wrap;max-width:60ch;text-align:left;line-height:1.7">${e.replace(/[<>&]/g,"")}</div><div style="color:#5d6b80;font-size:11px;margin-top:14px">press \` for the log</div>`,U.error("viewer",`${m} — ${e}`)}async function ze(){const m=document.getElementById("gpu-canvas");if(!(m instanceof HTMLCanvasElement))return;const e=document.getElementById("stage");e&&oe(e),addEventListener("error",n=>T("Something broke",`${n.message} @ ${n.filename}:${n.lineno}`)),addEventListener("unhandledrejection",n=>T("Something broke",String(n.reason)));let d;try{d=await se.create(m)}catch(n){n instanceof ie?T("This browser has no usable WebGPU",`${n.kind}: ${n.message}

Chrome or Edge 113+, Safari 18+, or Firefox 141+ on Windows.`):T("Could not start the GPU",String(n));return}d.device.addEventListener("uncapturederror",n=>{T("The GPU rejected something",n.error.message)});const c=new URLSearchParams(location.search);d.device.pushErrorScope("validation");let h;try{h=new Ie(d,!c.has("noshadow"))}catch(n){d.device.popErrorScope(),T("Could not build the render pipelines",String(n));return}const r=await d.device.popErrorScope();if(r){T("The GPU rejected a pipeline",r.message);return}let o=!1;d.onLost(async()=>{if(!o){o=!0,h.suspend();try{await d.recover(),h.rebuild(),U.info("viewer","device recovered")}catch(n){U.error("viewer",`recovery failed: ${String(n)}`)}o=!1}}),Pe(n=>h.select(n));const t=c,s=E.find(n=>n.id===t.get("asset"))??E[0],a=Number(t.get("lod")??0);if(t.get("spin")==="0"&&h.toggleSpin(),t.get("hud")==="0"){for(const n of["side","bar","info","hint"])document.getElementById(n)?.remove();document.getElementById("app")?.style.setProperty("grid-template-columns","1fr")}try{h.select(s,a)}catch(n){T("Could not build that asset",String(n));return}Object.defineProperty(window,"viewer",{value:{show(n,g){const p=E.find(w=>w.id===n);return p?(h.select(p,g),!0):!1},ids:E.map(n=>n.id),capture:(n,g)=>h.capture(n,g),alive:()=>!o}});for(const n of document.querySelectorAll("[data-lod]"))n.addEventListener("click",()=>{for(const g of document.querySelectorAll("[data-lod]"))g.classList.remove("on");n.classList.add("on"),h.setLod(Number(n.dataset.lod))});document.getElementById("wire")?.addEventListener("click",n=>{n.currentTarget.classList.toggle("on",h.toggleWire())}),document.getElementById("spin")?.addEventListener("click",n=>{n.currentTarget.classList.toggle("on",h.toggleSpin())});let u=performance.now(),l=0;const f=n=>{const g=Math.min((n-u)/1e3,.1);u=n;try{h.frame(g),l++}catch(p){T("The render loop threw",String(p));return}requestAnimationFrame(f)};if(requestAnimationFrame(f),setTimeout(()=>{l===0&&T("Nothing rendered","The render loop never completed a frame.")},2500),t.get("hud")!=="0"){const n=document.createElement("div");n.style.cssText=["position:absolute","left:14px","bottom:34px","color:#5d6b80","font:11px/1.6 var(--mono)","pointer-events:none","white-space:pre"].join(";"),document.getElementById("stage")?.appendChild(n),setInterval(()=>{const g=h.debug,p=d.canvas;n.textContent=`frames ${g.frames}   tris ${g.indices/3|0}   size ${g.height.toFixed(1)}m r${g.radius.toFixed(1)}   cam ${g.distance.toFixed(0)}m
canvas ${p.width}x${p.height}   ${d.format}   shadows ${c.has("noshadow")?"off":"on"}`},400)}U.info("viewer",`${E.length} assets`)}ze();
//# sourceMappingURL=asset-F79Zd6Z0.js.map
