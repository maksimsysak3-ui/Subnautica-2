import{h as Q,m as We,G as Ue,a as qe,l as me,b as ie,c as Se,d as Le,p as $e,e as Ce,o as Ve}from"./m4-DvGWrzTh.js";const V=11,i={ROOF:0,GLASS:2,METAL:3,BRICK:4,TRIM:5,SHOPFRONT:6,TILE:7,GROUND:8,HOUSE_WALL:9,SHED_WALL:10,CONCRETE:11,PLASTER:12,PANE:13},x={NONE:0,BRAND:1,BRAND_DARK:2,ACCENT:3,SIGN_LIT:4,DOOR:5,AWNING:6,METAL_DARK:7,WOOD:8,GREEN:9};class T{verts=[];idx=[];tint=x.NONE;painted(e,h){const p=this.tint;this.tint=e,h(),this.tint=p}get triangleCount(){return this.idx.length/3}get vertexCount(){return this.verts.length/V}tri(e,h,p,c){const l=h[0]-e[0],o=h[1]-e[1],n=h[2]-e[2],t=p[0]-e[0],r=p[1]-e[1],s=p[2]-e[2];let a=o*s-n*r,f=n*t-l*s,u=l*r-o*t;const g=Math.hypot(a,f,u)||1;a/=g,f/=g,u/=g;const b=this.vertexCount;for(const m of[e,h,p])this.verts.push(m[0],m[1],m[2],a,f,u,c,1,this.tint,0,0);this.idx.push(b,b+1,b+2)}quad(e,h,p,c,l){this.tri(e,h,p,l),this.tri(e,p,c,l)}box(e,h,p,c={}){const[l,o,n]=e,[t,r,s]=h,a=c.roof??p;this.quad([t,o,s],[t,o,n],[t,r,n],[t,r,s],p),this.quad([l,o,n],[l,o,s],[l,r,s],[l,r,n],p),this.quad([l,o,s],[t,o,s],[t,r,s],[l,r,s],p),this.quad([t,o,n],[l,o,n],[l,r,n],[t,r,n],p),this.quad([l,r,s],[t,r,s],[t,r,n],[l,r,n],a),c.skipBottom===!1&&this.quad([l,o,n],[t,o,n],[t,o,s],[l,o,s],p)}gable(e,h,p,c,l,o){const[n,t,r]=e,[s,,a]=h,f=t+p;if(c==="x"){const u=(r+a)/2;this.quad([n,t,a],[s,t,a],[s,f,u],[n,f,u],l),this.quad([s,t,r],[n,t,r],[n,f,u],[s,f,u],l),this.tri([s,t,a],[s,t,r],[s,f,u],o),this.tri([n,t,r],[n,t,a],[n,f,u],o)}else{const u=(n+s)/2;this.quad([s,t,a],[s,t,r],[u,f,r],[u,f,a],l),this.quad([n,t,r],[n,t,a],[u,f,a],[u,f,r],l),this.tri([n,t,a],[s,t,a],[u,f,a],o),this.tri([s,t,r],[n,t,r],[u,f,r],o)}}cylinder(e,h,p,c,l,o,n,t=!0){for(let r=0;r<o;r++){const s=r/o*Math.PI*2,a=(r+1)/o*Math.PI*2,f=[e+Math.cos(s)*p,c,h+Math.sin(s)*p],u=[e+Math.cos(a)*p,c,h+Math.sin(a)*p],g=[e+Math.cos(a)*p,l,h+Math.sin(a)*p],b=[e+Math.cos(s)*p,l,h+Math.sin(s)*p];this.quad(f,b,g,u,n),t&&this.tri([e,l,h],[e+Math.cos(a)*p,l,h+Math.sin(a)*p],[e+Math.cos(s)*p,l,h+Math.sin(s)*p],n)}}opening(e){const h=e.frame??.11,p=e.proud??.09,c=e.frameMat??i.TRIM,l=(r,s,a,f,u,g,b)=>{const m=e.plane+e.sign*Math.min(u,g),w=e.plane+e.sign*Math.max(u,g);e.axis==="x"?this.box([m,a,r],[w,f,s],b):this.box([r,a,m],[s,f,w],b)},o=e.glass===i.GLASS||e.glass===i.SHOPFRONT,n=o?i.PANE:e.glass,t=e.plane+e.sign*.012;if(e.axis==="x"){const r=[t,e.y0,e.u0],s=[t,e.y0,e.u1],a=[t,e.y1,e.u1],f=[t,e.y1,e.u0];e.sign>0?o?this.signFace(s,r,f,a,n):this.quad(s,r,f,a,n):o?this.signFace(r,s,a,f,n):this.quad(r,s,a,f,n)}else{const r=[e.u0,e.y0,t],s=[e.u1,e.y0,t],a=[e.u1,e.y1,t],f=[e.u0,e.y1,t];e.sign>0?o?this.signFace(r,s,a,f,n):this.quad(r,s,a,f,n):o?this.signFace(s,r,f,a,n):this.quad(s,r,f,a,n)}l(e.u0-h,e.u1+h,e.y1,e.y1+h,-.06,p,c),l(e.u0-h,e.u1+h,e.y0-h,e.y0,-.06,p,c),l(e.u0-h,e.u0,e.y0,e.y1,-.06,p,c),l(e.u1,e.u1+h,e.y0,e.y1,-.06,p,c)}windowRow(e){const h=e.to-e.from;for(let p=0;p<e.count;p++){const c=e.from+(p+.5)/e.count*h;this.opening({axis:e.axis,sign:e.sign,plane:e.plane,u0:c-e.width/2,u1:c+e.width/2,y0:e.y0,y1:e.y1,glass:e.glass,...e.frame!==void 0?{frame:e.frame}:{},...e.proud!==void 0?{proud:e.proud}:{}})}}cone(e,h,p,c,l,o,n,t){for(let r=0;r<n;r++){const s=r/n*Math.PI*2,a=(r+1)/n*Math.PI*2,f=[e+Math.cos(s)*p,l,h+Math.sin(s)*p],u=[e+Math.cos(a)*p,l,h+Math.sin(a)*p];c<.001?this.tri(u,f,[e,o,h],t):this.quad(f,[e+Math.cos(s)*c,o,h+Math.sin(s)*c],[e+Math.cos(a)*c,o,h+Math.sin(a)*c],u,t)}}pipe(e,h,p,c){this.box([Math.min(e[0],h[0])-p,Math.min(e[1],h[1])-p,Math.min(e[2],h[2])-p],[Math.max(e[0],h[0])+p,Math.max(e[1],h[1])+p,Math.max(e[2],h[2])+p],c,{skipBottom:!1})}signFace(e,h,p,c,l){const o=[[0,0],[1,0],[1,1],[0,1]],n=(t,r,s)=>{const a=[e,h,p,c],f=a[t],u=a[r],g=a[s],b=u[0]-f[0],m=u[1]-f[1],w=u[2]-f[2],y=g[0]-f[0],A=g[1]-f[1],B=g[2]-f[2];let P=m*B-w*A,_=w*y-b*B,D=b*A-m*y;const X=Math.hypot(P,_,D)||1;P/=X,_/=X,D/=X;const Z=this.vertexCount;for(const de of[t,r,s]){const fe=a[de];this.verts.push(fe[0],fe[1],fe[2],P,_,D,l,1,this.tint,o[de][0],o[de][1])}this.idx.push(Z,Z+1,Z+2)};n(0,1,2),n(0,2,3)}bounds(){const e=[1/0,1/0,1/0],h=[-1/0,-1/0,-1/0];for(let p=0;p<this.verts.length;p+=V)for(let c=0;c<3;c++){const l=this.verts[p+c];l<e[c]&&(e[c]=l),l>h[c]&&(h[c]=l)}return Number.isFinite(e[0])?{min:e,max:h}:{min:[0,0,0],max:[0,0,0]}}build(e={}){const h=new Float32Array(this.verts.length);h.set(this.verts);const p=new Uint32Array(this.idx.length);return p.set(this.idx),e.occlusion!==!1&&Ze(h,p),{vertices:h,indices:p}}}const ee=.34,ge=9,je=3.4,Ye=.7,ve=.62,ke=(()=>{const d=[];for(let h=0;h<20;h++){const p=Math.sqrt((h+.5)/20),c=Math.sqrt(1-p*p),l=(h+.5)*Math.PI*(3-Math.sqrt(5));d.push([Math.cos(l)*c,p,Math.sin(l)*c])}return d})();function Pe(d,e,h){return(d+512|e+512<<10|h+512<<20)>>>0}function Xe(d,e){const h=new Set,p=(c,l,o)=>{h.add(Pe(Math.floor(c/ee),Math.floor(l/ee),Math.floor(o/ee)))};for(let c=0;c<e.length;c+=3){const l=e[c]*V,o=e[c+1]*V,n=e[c+2]*V,t=d[l],r=d[l+1],s=d[l+2],a=d[o],f=d[o+1],u=d[o+2],g=d[n],b=d[n+1],m=d[n+2],w=Math.max(Math.hypot(a-t,f-r,u-s),Math.hypot(g-t,b-r,m-s),Math.hypot(g-a,b-f,m-u)),y=Math.min(48,Math.max(2,Math.ceil(w/ee*1.6)));for(let A=0;A<=y;A++)for(let B=0;B<=y-A;B++){const P=A/y,_=B/y,D=1-P-_;p(t*D+a*P+g*_,r*D+f*P+b*_,s*D+u*P+m*_)}}return h}function Ze(d,e){if(e.length===0)return;const h=Xe(d,e),p=je/ge;for(let c=0;c<d.length;c+=V){const l=d[c],o=d[c+1],n=d[c+2],t=d[c+3],r=d[c+4],s=d[c+5];let a=0,f=0,u=0;Math.abs(r)<.9?(a=-s,u=t):a=1;const g=Math.hypot(a,f,u)||1;a/=g,f/=g,u/=g;const b=r*u-s*f,m=s*a-t*u,w=t*f-r*a,y=l+t*ve,A=o+r*ve,B=n+s*ve;let P=0;for(const[D,X,Z]of ke){const de=a*D+t*X+b*Z,fe=f*D+r*X+m*Z,He=u*D+s*X+w*Z;for(let he=1;he<=ge;he++){const Te=he*p,_e=y+de*Te,Oe=A+fe*Te,Ke=B+He*Te;if(Oe<0){P+=1-(he-1)/ge;break}if(h.has(Pe(Math.floor(_e/ee),Math.floor(Oe/ee),Math.floor(Ke/ee)))){P+=1-(he-1)/ge;break}}}const _=1-Ye*(P/ke.length);d[c+7]=Math.max(.08,Math.min(1,_))}}const Je={name:"",colour:[.42,.44,.47],accent:[.3,.32,.35]},re=8,L={burger:{name:"Ridgeway Burger",colour:[.62,.13,.11],accent:[.72,.55,.14],sign:"pylon"},coffee:{name:"Meridian Coffee",colour:[.12,.28,.2],accent:[.66,.58,.42],sign:"blade"},grocer:{name:"Vale Market",colour:[.16,.34,.22],accent:[.68,.62,.38],sign:"fascia"},pharmacy:{name:"Alder Pharmacy",colour:[.14,.3,.48],accent:[.7,.72,.74],sign:"box"},hardware:{name:"Keel & Sons",colour:[.52,.31,.1],accent:[.3,.3,.31],sign:"fascia"},diner:{name:"Route 9 Diner",colour:[.66,.2,.16],accent:[.72,.72,.7],sign:"blade"},bank:{name:"Harrow Trust",colour:[.16,.22,.36],accent:[.6,.52,.24],sign:"box"},bookshop:{name:"Pemberly Books",colour:[.3,.16,.28],accent:[.62,.56,.4],sign:"blade"},electronics:{name:"Cobalt Electric",colour:[.13,.34,.46],accent:[.66,.68,.7],sign:"fascia"},gym:{name:"Ironworks Gym",colour:[.2,.21,.23],accent:[.64,.38,.12],sign:"box"}};function Be(d,e,h,p,c,l,o){const n=d.plane+d.sign*Math.min(l,o),t=d.plane+d.sign*Math.max(l,o),r=Math.min(n,t),s=Math.max(n,t);return d.axis==="x"?[[r,p,e],[s,c,h]]:[[e,p,r],[h,c,s]]}function I(d,e,h,p,c,l,o,n,t){const[r,s]=Be(e,h,p,c,l,o,n);d.box(r,s,t,{skipBottom:!1})}function De(d,e,h,p,c,l,o){const n=e.plane+e.sign*o;e.axis==="x"?e.sign>0?d.signFace([n,c,p],[n,c,h],[n,l,h],[n,l,p],i.TRIM):d.signFace([n,c,h],[n,c,p],[n,l,p],[n,l,h],i.TRIM):e.sign>0?d.signFace([h,c,n],[p,c,n],[p,l,n],[h,l,n],i.TRIM):d.signFace([p,c,n],[h,c,n],[h,l,n],[p,l,n],i.TRIM)}function v(d,e,h,p,c,l,o=.85,n=.18,t=i.TRIM){d.box([e-n,l,h-n],[p+n,l+o,c+n],t)}function we(d,e,h,p,c,l,o,n,t=i.TRIM){d.box([e-n,l,c],[p+n,l+o,c+n],t),d.box([e-n,l,h-n],[p+n,l+o,h],t),d.box([p,l,h-n],[p+n,l+o,c+n],t),d.box([e-n,l,h-n],[e,l+o,c+n],t)}function E(d,e,h,p,c,l,o,n,t=i.TRIM){d.box([e-n,l,h-n],[p+n,l+o,c+n],t)}function M(d,e,h,p,c,l,o,n=1){const t=p-e,r=c-h;if(t<3||r<3)return;const s=Math.min(3.2,t*.34),a=Math.min(2.6,r*.34);d.box([e+t*.12,l,h+r*.12],[e+t*.12+s,l+2.6,h+r*.12+a],i.CONCRETE,{roof:i.ROOF});const f=Math.max(1,Math.round(t*r/60*n));for(let u=0;u<f;u++){const g=Q(u,3,o),b=Q(u,7,o),m=Q(u,11,o),w=e+1.6+g*Math.max(.1,t-3.2),y=h+1.6+b*Math.max(.1,r-3.2);if(m<.42){const A=1.1+g*1.5,B=.9+b*1.1;d.box([w,l,y],[w+A,l+.85+m,y+B],i.METAL),d.box([w+.1,l+.85+m,y+.1],[w+A-.1,l+1.05+m,y+B-.1],i.TRIM)}else m<.72?d.cylinder(w,y,.34+g*.24,l,l+.7+b*.8,8,i.METAL):(d.box([w,l+.35,y],[w+1+g*3.5,l+.85,y+.55],i.METAL),d.box([w+.1,l,y+.1],[w+.35,l+.35,y+.35],i.TRIM))}if(l>18&&Q(1,1,o)>.45){const u=p-Math.min(4,t*.3),g=c-Math.min(4,r*.3);for(const[b,m]of[[0,0],[1.9,0],[0,1.9],[1.9,1.9]])d.box([u+b-.1,l,g+m-.1],[u+b+.1,l+1.8,g+m+.1],i.TRIM);d.cylinder(u+.95,g+.95,1.5,l+1.8,l+4.2,12,i.METAL),d.cone(u+.95,g+.95,1.5,.2,l+4.2,l+5.1,12,i.METAL)}}function S(d,e,h,p,c={}){const l=c.sill??.55,o=c.head??3.5,n=p-h,t=c.bays??Math.max(2,Math.round(n/2.6)),r=c.doorBay??Math.floor(t/2),s=c.fascia??.9;d.painted(x.BRAND_DARK,()=>I(d,e,h,p,0,l,0,.16,i.TRIM));for(let f=0;f<t;f++){const u=h+f/t*n+.09,g=h+(f+1)/t*n-.09;f===r?(I(d,e,u,g,2.45,o-.75,.01,.06,i.SHOPFRONT),z(d,e,(u+g)/2,{width:Math.min(g-u-.24,1.9),height:2.3,double:g-u>2.2,glazed:!0,fanlight:!1}),d.painted(x.BRAND_DARK,()=>{I(d,e,u-.06,u+.12,0,o-.75,0,.17,i.TRIM),I(d,e,g-.12,g+.06,0,o-.75,0,.17,i.TRIM)})):I(d,e,u,g,l,o-.75,.01,.06,i.SHOPFRONT),d.painted(x.BRAND_DARK,()=>I(d,e,g,g+.18,0,o-.7,0,.15,i.TRIM))}d.painted(x.BRAND_DARK,()=>I(d,e,h-.18,h,0,o-.7,0,.15,i.TRIM));const a=c.brandFascia===!1?x.NONE:x.BRAND;d.painted(a,()=>I(d,e,h-.22,p+.22,o-.75,o-.75+s,-.05,.24,i.TRIM))}function oe(d,e,h,p,c,l=1.5){d.painted(x.AWNING,()=>{for(let n=0;n<4;n++){const t=n/4*l,r=(n+1)/4*l,s=c-n/4*.55,a=c-(n+1)/4*.55;I(d,e,h,p,Math.min(s,a)-.06,Math.max(s,a),t,r,i.TRIM)}I(d,e,h,p,c-.85,c-.55,l-.08,l,i.TRIM)})}function N(d,e,h,p,c,l){d.painted(x.BRAND_DARK,()=>I(d,e,h-.1,p+.1,c-.08,l+.08,.02,.3,i.TRIM)),d.painted(x.SIGN_LIT,()=>{I(d,e,h,p,c,l,.28,.33,i.TRIM),De(d,e,h,p,c,l,.335)})}function te(d,e,h,p,c,l=1.35){d.painted(x.METAL_DARK,()=>I(d,e,h-.06,h+.06,c-.12,c,.02,l,i.TRIM)),d.painted(x.SIGN_LIT,()=>{I(d,e,h-.055,h+.055,p,c-.1,l-.95,l-.06,i.TRIM);const o=e.plane+e.sign*(l-.95),n=e.plane+e.sign*(l-.06);e.axis==="z"?(d.signFace([h-.056,p,n],[h-.056,p,o],[h-.056,c-.1,o],[h-.056,c-.1,n],i.TRIM),d.signFace([h+.056,p,o],[h+.056,p,n],[h+.056,c-.1,n],[h+.056,c-.1,o],i.TRIM)):(d.signFace([o,p,h-.056],[n,p,h-.056],[n,c-.1,h-.056],[o,c-.1,h-.056],i.TRIM),d.signFace([n,p,h+.056],[o,p,h+.056],[o,c-.1,h+.056],[n,c-.1,h+.056],i.TRIM))}),d.painted(x.BRAND,()=>I(d,e,h-.09,h+.09,p-.08,p,l-1,l,i.TRIM))}function ze(d,e,h,p,c=3){d.painted(x.METAL_DARK,()=>{d.box([e-.28,0,h-.28],[e+.28,p-2.4,h+.28],i.TRIM),d.box([e-.7,0,h-.7],[e+.7,.35,h+.7],i.CONCRETE)}),d.painted(x.BRAND,()=>{d.box([e-c/2,p-2.6,h-.34],[e+c/2,p,h+.34],i.TRIM)}),d.painted(x.SIGN_LIT,()=>{const l=e-c/2+.16,o=e+c/2-.16,n=p-2.4,t=p-.2;d.signFace([o,n,h-.42],[l,n,h-.42],[l,t,h-.42],[o,t,h-.42],i.TRIM),d.signFace([l,n,h+.42],[o,n,h+.42],[o,t,h+.42],[l,t,h+.42],i.TRIM)})}function q(d,e,h,p,c,l){d.painted(x.SIGN_LIT,()=>{I(d,e,h,p,c,l,.02,.25,i.TRIM),De(d,e,h,p,c,l,.255)})}function R(d,e,h,p,c){const l=c.glass??i.GLASS;for(let o=0;o<c.floors;o++){const n=c.base+o*c.floorH;d.windowRow({axis:e.axis,sign:e.sign,plane:e.plane,from:h,to:p,y0:n,y1:n+c.height,count:c.count,width:c.width,glass:l,frame:.08,proud:.055}),c.sill!==!1&&I(d,e,h,p,n-.12,n-.02,-.02,.12,i.TRIM)}}function j(d,e,h,p,c){const l=c.depth??1.3,o=p-h;for(let n=0;n<c.floors;n++){const t=c.base+n*c.floorH;for(let r=0;r<c.bays;r++){const s=h+(r+.5)/c.bays*o,a=s-o/c.bays/2+.3,f=s+o/c.bays/2-.3;I(d,e,a,f,t,t+.16,0,l,i.CONCRETE),c.solid===!1?d.painted(x.METAL_DARK,()=>{I(d,e,a,f,t+.16,t+1.05,l-.08,l,i.TRIM),I(d,e,a,a+.08,t+.16,t+1.05,0,l,i.TRIM),I(d,e,f-.08,f,t+.16,t+1.05,0,l,i.TRIM)}):I(d,e,a,f,t+.16,t+1.05,l-.12,l,i.CONCRETE)}}}function Ge(d,e,h,p,c,l,o=2.4){d.painted(x.METAL_DARK,()=>{for(let n=0;n<c;n++){const t=p+n*l;if(I(d,e,h,h+o,t,t+.1,.02,1.5,i.TRIM),I(d,e,h,h+o,t+.1,t+1,1.42,1.5,i.TRIM),I(d,e,h,h+.08,t+.1,t+1,.02,1.5,i.TRIM),I(d,e,h+o-.08,h+o,t+.1,t+1,.02,1.5,i.TRIM),n>0)for(let r=0;r<7;r++){const s=r/7,a=t-s*l+.1;I(d,e,h+.2+s*(o-1),h+.9+s*(o-1),a,a+.06,.5,1.2,i.TRIM)}}})}function Qe(d,e,h,p,c,l=.16,o=.3){for(let n=0;n<c;n++){const t=(c-n)*l;I(d,e,h,p,1e-4,t,n*o,(c-n)*o+o,i.CONCRETE)}}function F(d,e,h,p,c,l){d.painted(x.METAL_DARK,()=>{for(let o=0;o<l;o++){const n=h+(o+.5)/l*(p-h),[t,r]=Be(e,n-.11,n+.11,0,.95,c-.11,c+.11);d.box(t,r,i.TRIM)}})}function le(d,e,h,p,c=.6){d.box([e-p,0,h-p],[e+p,c,h+p],i.CONCRETE),d.painted(x.GREEN,()=>{d.box([e-p+.12,c,h-p+.12],[e+p-.12,c+.5,h+p-.12],i.TRIM)})}function C(d,e,h,p,c){const l=.9+Q(Math.round(e),Math.round(h),c)*.5;d.painted(x.WOOD,()=>d.cylinder(e,h,.17,0,p*.42,6,i.TRIM,!1)),d.painted(x.GREEN,()=>{d.cone(e,h,l,l*.6,p*.36,p*.74,8,i.TRIM),d.cone(e,h,l*.72,0,p*.68,p,8,i.TRIM)})}function H(d,e,h,p,c){d.box([e,1e-4,h],[p,.14,c],i.CONCRETE)}function O(d,e,h,p,c,l={}){const o=l.depth??2.6;H(d,e,p+o-.4,h,p+o);const n=l.bollards??5;n>0&&F(d,{axis:"z",sign:1,plane:p},e+.6,h-.6,o-.9,n);const t=l.trees??2,r=h-e,s=e+r*.37,a=e+r*.63,f=p+o-.55;let u=0;for(let g=0;g<t*2&&u<t;g++){const b=t===1?.14:g%t/Math.max(1,t-1);let m=e+1.2+b*(r-2.4);m>s&&m<a&&(m=m<(s+a)/2?s-.9:a+.9,m<e+.8||m>h-.8)||(C(d,m,f,4.4+Q(g,5,c)*1.6,c+g),u++)}for(let g=0;g<(l.planters??0);g++){const b=e+1+g*2.2;b>s&&b<a||le(d,b,p+1,.55)}if(l.bin!==!1){const g=h-1.6;d.painted(x.METAL_DARK,()=>{d.box([g-.42,.12,p+.5],[g+.42,1.15,p+1.1],i.TRIM),d.box([g-.46,1.15,p+.46],[g+.46,1.28,p+1.14],i.TRIM);for(const b of[g-.32,g+.32])d.box([b-.06,0,p+.62],[b+.06,.24,p+.86],i.TRIM)})}}function Y(d,e,h,p,c,l=1.05,o=1.4){d.painted(x.METAL_DARK,()=>{const n=Math.max(2,Math.round((h-e)/o));for(let t=0;t<=n;t++){const r=e+t/n*(h-e);d.box([r-.05,c,p-.05],[r+.05,c+l,p+.05],i.TRIM)}d.box([e,c+l-.12,p-.04],[h,c+l,p+.04],i.TRIM),d.box([e,c+l*.45,p-.03],[h,c+l*.45+.08,p+.03],i.TRIM)})}function z(d,e,h,p={}){const c=(p.width??1.1)/2,l=p.height??2.25,o=h-c,n=h+c,t=p.steps??0,r=t*.16;if(I(d,e,o-.3,n+.3,.001,Math.max(r,.05),0,.5,i.CONCRETE),t>0&&Qe(d,e,o-.25,n+.25,t),d.painted(x.DOOR,()=>{I(d,e,o-.14,o,r,r+l+.14,0,.12,i.TRIM),I(d,e,n,n+.14,r,r+l+.14,0,.12,i.TRIM),I(d,e,o-.14,n+.14,r+l,r+l+.14,0,.12,i.TRIM);const s=p.double===!0?[[o,h-.03],[h+.03,n]]:[[o,n]];for(const[a,f]of s)p.glazed===!0?(I(d,e,a,f,r,r+.34,.01,.08,i.TRIM),I(d,e,a,f,r+l-.22,r+l,.01,.08,i.TRIM),I(d,e,a,a+.09,r,r+l,.01,.08,i.TRIM),I(d,e,f-.09,f,r,r+l,.01,.08,i.TRIM)):I(d,e,a,f,r,r+l,.01,.08,i.TRIM)}),p.glazed===!0)for(const[s,a]of p.double===!0?[[o,h-.03],[h+.03,n]]:[[o,n]])I(d,e,s+.09,a-.09,r+.34,r+l-.22,.02,.05,i.SHOPFRONT);d.painted(x.METAL_DARK,()=>{const s=p.double===!0?h-.16:n-.18;I(d,e,s-.03,s+.03,r+1,r+1.24,.08,.14,i.TRIM)}),p.fanlight!==!1&&d.opening({axis:e.axis,sign:e.sign,plane:e.plane,u0:o,u1:n,y0:r+l+.2,y1:r+l+.75,glass:i.GLASS,frame:.09,proud:.06}),p.canopy!==void 0&&I(d,e,o-.5,n+.5,r+l+.95,r+l+1.25,0,p.canopy,i.CONCRETE)}function se(d,e,h,p,c,l){const o=p-e,n=c-h;if(o<3||n<3)return;d.painted(x.GREEN,()=>d.box([e,.001,h],[p,.06,c],i.TRIM)),d.box([e+.4,.002,c-Math.min(2.6,n*.4)],[p-.4,.07,c],i.CONCRETE),d.painted(x.WOOD,()=>{const s=(f,u)=>{d.box([f-.07,0,u-.07],[f+.07,1.75,u+.07],i.TRIM)},a=[[e,h,p,h],[e,h,e,c],[p,h,p,c]];for(const[f,u,g,b]of a){const m=Math.hypot(g-f,b-u),w=Math.max(2,Math.round(m/1.9));for(let y=0;y<=w;y++)s(f+(g-f)*y/w,u+(b-u)*y/w);d.box([Math.min(f,g)-.06,0,Math.min(u,b)-.06],[Math.max(f,g)+.06,1.62,Math.max(u,b)+.06],i.TRIM)}});const t=e+.7,r=h+.7;d.painted(x.WOOD,()=>d.box([t,0,r],[t+2.3,2,r+1.9],i.TRIM)),d.gable([t-.12,2,r-.12],[t+2.42,2,r+2.02],.55,"x",i.TILE,i.TRIM),d.painted(x.METAL_DARK,()=>{for(const s of[e+3.4,p-1])d.box([s-.05,0,h+n*.55],[s+.05,1.8,h+n*.55+.1],i.TRIM);d.box([e+3.4,1.72,h+n*.55],[p-1,1.78,h+n*.55+.06],i.TRIM)}),C(d,p-1.4,h+1.4,5+Q(1,2,l)*1.4,l),d.painted(x.METAL_DARK,()=>{for(const s of[e+o*.45,e+o*.62])d.box([s-.22,.07,c-1.4],[s+.22,.46,c-.96],i.TRIM),d.box([s-.22,.46,c-1.4],[s+.22,.95,c-1.28],i.TRIM)})}const W=d=>d*.39;function U(d,e,h,p,c,l,o=.42,n=.3){d.box([e-o,l-n,h-o],[p+o,l,c+o],i.TRIM)}function ne(d,e,h,p,c,l=1.1){d.box([e-l/2,p,h-l/2],[e+l/2,c,h+l/2],i.BRICK),d.box([e-l/2-.14,c,h-l/2-.14],[e+l/2+.14,c+.24,h+l/2+.14],i.TRIM)}function ce(d,e,h,p,c,l,o=.42){d.box([e-o,l-.14,c+o-.18],[p+o,l,c+o],i.TRIM),d.box([e-o,l-.14,h-o],[p+o,l,h-o+.18],i.TRIM);for(const n of[e-o+.02,p+o-.16])d.box([n,0,c+o-.16],[n+.14,l-.14,c+o-.02],i.TRIM)}function en(d){const e=new T,h=d<1,p=d<2,c=7.4,l=9.8,o=5.4,n=c/2,t=l/2,r=W(c),s=4.3,a=3.1,f=-s/2,u=s/2,g=t-.2,b=t+a;if(e.box([-n,0,-t],[n,o,t],i.BRICK,{roof:i.TRIM}),e.gable([-n,o,-t],[n,o,t],r,"z",i.TILE,i.BRICK),p){e.box([f,0,g],[u,o-.5,b],i.BRICK,{roof:i.TRIM}),e.gable([f,o-.5,g],[u,o-.5,b],W(s),"x",i.TILE,i.BRICK);const m=n-.3,w=n+4.7;e.box([m,0,-t+1.4],[w,3.1,t-1.6],i.BRICK,{roof:i.TRIM}),e.gable([m,3.1,-t+1.4],[w,3.1,t-1.6],1.5,"z",i.TILE,i.BRICK),U(e,-n,-t,n,t,o),U(e,f,g,u,b,o-.5,.36),U(e,m,-t+1.4,w,t-1.6,3.1,.3),e.box([-n-.05,o+.4,-1.6],[-n+1.5,o+2,.1],i.BRICK),e.gable([-n-.2,o+2,-1.75],[-n+1.65,o+2,.25],.7,"z",i.TILE,i.BRICK),ne(e,n-1.75,-1.75,o+1.2,o+r+1.8)}if(h){ce(e,-n,-t,n,t,o),e.box([u+.1,0,b-2.4],[u+3.4,.16,b],i.CONCRETE),e.box([u+.1,2.6,b-2.6],[u+3.6,2.92,b+.25],i.TRIM);for(const m of[u+.45,u+3.1])e.box([m-.14,.16,b-.4],[m+.14,2.6,b-.12],i.TRIM);for(let m=0;m<8;m++){const w=u+.5+m/7*2.55;e.box([w-.04,.16,b-.32],[w+.04,.98,b-.2],i.TRIM)}e.box([u+.35,.98,b-.38],[u+3.25,1.1,b-.14],i.TRIM),z(e,{axis:"z",sign:1,plane:b},u+1.6,{width:1.05,steps:1}),e.box([f+.5,.3,b],[u-.5,2.9,b+.5],i.BRICK,{roof:i.TRIM}),e.opening({axis:"z",sign:1,plane:b+.5,u0:f+.75,u1:u-.75,y0:.75,y1:2.55,glass:i.GLASS,frame:.1,proud:.07}),e.windowRow({axis:"z",sign:1,plane:b,from:f,to:u,y0:3.3,y1:4.7,count:1,width:1.5,glass:i.GLASS,frame:.1,proud:.07});for(const[m,w]of[[1,n],[-1,-n]])R(e,{axis:"x",sign:m,plane:w},-t+1.2,t-1.2,{floors:2,floorH:2.2,base:1.2,count:2,width:1.2,height:1.5,sill:!1});R(e,{axis:"z",sign:-1,plane:-t},-n+1,n-1,{floors:2,floorH:2.2,base:1.3,count:2,width:1.3,height:1.5,sill:!1}),e.painted(x.METAL_DARK,()=>e.opening({axis:"z",sign:1,plane:t-1.6,u0:n+.4,u1:n+4,y0:.15,y1:2.5,glass:i.TRIM,frame:.12,proud:.09})),C(e,-n-1.6,t+2.4,5,2),se(e,-n-1,-t-8.5,n+4.7,-t-.3,2)}return e}function nn(d){const e=new T,h=d<1,p=d<2,c=12,l=8,o=3,n=c/2,t=l/2;if(e.box([-n,0,-t],[n,o,t],i.PLASTER,{roof:i.TRIM}),e.gable([-n,o,-t],[n,o,t],W(l),"x",i.TILE,i.PLASTER),p){U(e,-n,-t,n,t,o,.55),ne(e,-2,0,o+1,o+W(l)+1.2,.9),e.box([n,2.6,-t+.8],[n+4.4,2.9,t-.8],i.TRIM);for(const r of[-t+1.4,t-1.4])e.box([n+3.9,0,r-.14],[n+4.2,2.6,r+.14],i.TRIM)}if(h){ce(e,-n,-t,n,t,o,.55),z(e,{axis:"z",sign:1,plane:t},0,{width:1.05,steps:1,canopy:1.1});for(const[r,s]of[[1,t],[-1,-t]])e.windowRow({axis:"z",sign:r,plane:s,from:-n+.9,to:n-.9,y0:1,y1:2.4,count:4,width:1.5,glass:i.GLASS,frame:.09,proud:.06});e.windowRow({axis:"x",sign:-1,plane:-n,from:-t+1,to:t-1,y0:1,y1:2.4,count:2,width:1.2,glass:i.GLASS,frame:.09,proud:.06}),O(e,-n,n+4.4,t,5,{trees:3,planters:3,bollards:6}),Y(e,-n+.4,-1.6,t+1,0),Y(e,1.6,n-.4,t+1,0),e.painted(x.WOOD,()=>{e.box([-n+.6,0,-t-3.4],[-n+3.2,2.1,-t-1],i.TRIM)}),e.gable([-n+.5,2.1,-t-3.5],[-n+3.3,2.1,-t-.9],.7,"x",i.TILE,i.TRIM),e.box([-1.4,.002,t+1],[1.4,.06,t+3.4],i.CONCRETE),e.windowRow({axis:"x",sign:1,plane:n,from:-t+1,to:t-1,y0:1,y1:2.4,count:2,width:1.2,glass:i.GLASS,frame:.09,proud:.06}),se(e,-n-.5,-t-8,n+4.4,-t-.3,5)}return e}function on(d){const e=new T,h=d<1,p=d<2,c=13.5,l=8.6,o=5.6,n=c/2,t=l/2;if(e.box([-n,0,-t],[n,o,t],i.BRICK,{roof:i.TRIM}),e.gable([-n,o,-t],[n,o,t],W(l),"x",i.TILE,i.BRICK),p){U(e,-n,-t,n,t,o);for(const r of[-1,1]){const s=r*3.2;e.box([s-1.5,0,t],[s+1.5,.16,t+1.4],i.CONCRETE),e.box([s-1.7,2.5,t],[s+1.7,2.82,t+1.6],i.TRIM);for(const a of[s-1.35,s+1.35])e.box([a-.12,.16,t+1.15],[a+.12,2.5,t+1.4],i.TRIM)}ne(e,0,0,o+1,o+W(l)+1.4,1.3)}if(h){ce(e,-n,-t,n,t,o);for(const r of[-1,1]){const s=r*3.2;z(e,{axis:"z",sign:1,plane:t},s,{width:1,steps:1}),e.opening({axis:"z",sign:1,plane:t,u0:s-2.9,u1:s-1.6,y0:1,y1:2.4,glass:i.GLASS,frame:.09,proud:.06}),e.opening({axis:"z",sign:1,plane:t,u0:s-1,u1:s+1,y0:3.4,y1:4.8,glass:i.GLASS,frame:.09,proud:.06})}R(e,{axis:"z",sign:-1,plane:-t},-n+1,n-1,{floors:2,floorH:2.3,base:1.2,count:4,width:1.1,height:1.5,sill:!1});for(const[r,s]of[[1,n],[-1,-n]])R(e,{axis:"x",sign:r,plane:s},-t+1.2,t-1.2,{floors:2,floorH:2.3,base:1.2,count:1,width:1.1,height:1.5,sill:!1});O(e,-n,n,t,9,{trees:2,planters:2,bollards:5}),se(e,-n,-t-8,n,-t-.3,9);for(const r of[-1,1])Y(e,r*3.2-1.5,r*3.2+1.5,t+1.4,.16,.9)}return e}function tn(d){const e=new T,h=d<1,p=d<2,c=4,l=5,o=9,n=8.4,r=c*l/2,s=o/2;if(e.box([-r,0,-s],[r,n,s],i.BRICK,{roof:i.ROOF}),p){for(let a=0;a<=c;a++){const f=-r+a*l;e.box([f-.22,0,-s-.1],[f+.22,n+.9,s+.35],i.BRICK)}E(e,-r,-s,r,s,n,.5,.3);for(let a=0;a<c;a++){const f=-r+(a+.5)*l;e.box([f-1.1,0,s],[f+1.1,.32,s+1.1],i.CONCRETE),e.box([f-1.3,2.6,s],[f+1.3,2.9,s+1.3],i.TRIM)}M(e,-r+1,-s+1,r-1,s-1,n+.5,13,.5)}if(h){for(let a=0;a<c;a++){const f=-r+(a+.5)*l;z(e,{axis:"z",sign:1,plane:s},f,{width:1.1,steps:2}),e.opening({axis:"z",sign:1,plane:s,u0:f-2,u1:f-.85,y0:.9,y1:2.4,glass:i.GLASS,frame:.09,proud:.06});for(let u=1;u<3;u++){const g=.9+u*2.7;e.opening({axis:"z",sign:1,plane:s,u0:f-1.9,u1:f-.5,y0:g,y1:g+1.5,glass:i.GLASS,frame:.09,proud:.06}),e.opening({axis:"z",sign:1,plane:s,u0:f+.5,u1:f+1.9,y0:g,y1:g+1.5,glass:i.GLASS,frame:.09,proud:.06})}e.opening({axis:"z",sign:-1,plane:-s,u0:f-1.6,u1:f+1.6,y0:1,y1:2.5,glass:i.GLASS,frame:.09,proud:.06})}for(let a=0;a<c;a++)C(e,-r+(a+.5)*l,s+3,4.4,a*3+1);se(e,-r,-s-8,r,-s-.3,13)}return e}function sn(d){const e=new T,h=d<1,p=d<2,c=6.6,l=8.2,o=4.4,n=c/2,t=l/2,r=W(c)*1.25;if(e.box([-n,0,-t],[n,o,t],i.PLASTER,{roof:i.TRIM}),e.gable([-n,o,-t],[n,o,t],r,"z",i.TILE,i.PLASTER),p&&(U(e,-n,-t,n,t,o,.5),ne(e,0,-t+1.2,o+1.4,o+r+1.6,1),e.box([n,0,-1.6],[n+2.6,2.4,2.6],i.PLASTER,{roof:i.TRIM}),e.quad([n,2.45,2.6],[n+2.6,2.05,2.6],[n+2.6,2.05,-1.6],[n,2.45,-1.6],i.TILE),e.box([-n-1.6,.001,t+2.2],[n+2.8,.7,t+2.45],i.BRICK)),h){ce(e,-n,-t,n,t,o,.5),z(e,{axis:"z",sign:1,plane:t},-1.22,{width:1,height:2.05,steps:1}),e.opening({axis:"z",sign:1,plane:t,u0:.2,u1:1.9,y0:1,y1:2.3,glass:i.GLASS,frame:.1,proud:.07}),e.windowRow({axis:"z",sign:1,plane:t,from:-n+.7,to:n-.7,y0:2.9,y1:4,count:2,width:1.1,glass:i.GLASS,frame:.09,proud:.06}),e.windowRow({axis:"x",sign:-1,plane:-n,from:-t+1,to:t-1,y0:1.1,y1:2.4,count:2,width:1,glass:i.GLASS,frame:.09,proud:.06}),O(e,-n-1.6,n+2.8,t+.8,17,{trees:3,planters:3,bollards:4,depth:2}),Y(e,-n-1.5,n+2.7,t+2.6,.7,.6,.9);for(const s of[-.35,.35])e.cylinder(s,-t+1.2,.16,o+r+1.6,o+r+2.1,8,i.TRIM);e.painted(x.GREEN,()=>e.cylinder(n+2.9,2,.42,0,1.3,10,i.TRIM)),e.box([-2.2,2.3,t],[-.25,2.6,t+.9],i.TRIM);for(const s of[-2.1,-.35])e.box([s-.07,0,t+.72],[s+.07,2.3,t+.86],i.TRIM);e.painted(x.WOOD,()=>{for(let s=0;s<8;s++)e.cylinder(-n-.9+s%4*.34,-t+1.2+Math.floor(s/4)*.34,.15,0,1.1,6,i.TRIM,!1)}),e.painted(x.GREEN,()=>{e.box([.2,.85,t],[1.9,1.15,t+.28],i.TRIM)}),e.windowRow({axis:"x",sign:1,plane:n,from:-t+1.2,to:t-1.2,y0:1.1,y1:2.4,count:2,width:1,glass:i.GLASS,frame:.09,proud:.06}),se(e,-n-1.4,-t-7.6,n+2.8,-t-.3,17)}return e}function an(d){const e=new T,h=d<1,p=d<2,c=9.6,l=11,o=6.2,n=c/2,t=l/2,r=W(c);if(e.box([-n,0,-t],[n,o,t],i.BRICK,{roof:i.TRIM}),e.gable([-n,o,-t],[n,o,t],r,"z",i.TILE,i.BRICK),p){e.box([-n,0,t-.4],[-n+4.2,o-.3,t+3],i.BRICK,{roof:i.TRIM}),e.gable([-n,o-.3,t-.4],[-n+4.2,o-.3,t+3],W(4.2),"x",i.TILE,i.BRICK),U(e,-n,-t,n,t,o),U(e,-n,t-.4,-n+4.2,t+3,o-.3,.36),e.box([-n+4.2,3.3,t],[n,3.62,t+2.4],i.TRIM);for(const s of[-n+4.6,n-.5])e.box([s-.16,0,t+2],[s+.16,3.3,t+2.32],i.TRIM);e.box([-n+4.2,0,t],[n,.2,t+2.4],i.CONCRETE),ne(e,n-1.6,-2,o+1.2,o+r+2,1.2),ne(e,-n+1.4,-t+1.4,o+1,o+r+1.2,.9)}if(h){ce(e,-n,-t,n,t,o),z(e,{axis:"z",sign:1,plane:t},.95,{width:1.35,double:!0,steps:1}),e.opening({axis:"z",sign:1,plane:t+3,u0:-n+.6,u1:-n+3.6,y0:.9,y1:2.7,glass:i.GLASS,frame:.11,proud:.07}),e.opening({axis:"z",sign:1,plane:t+3,u0:-n+.9,u1:-n+3.3,y0:3.9,y1:5.3,glass:i.GLASS,frame:.1,proud:.07}),e.windowRow({axis:"z",sign:1,plane:t,from:-n+4.6,to:n-.6,y0:3.9,y1:5.3,count:2,width:1.2,glass:i.GLASS,frame:.1,proud:.07});for(const[s,a]of[[1,n],[-1,-n]])R(e,{axis:"x",sign:s,plane:a},-t+1.2,t-1.2,{floors:2,floorH:2.7,base:1.3,count:3,width:1.1,height:1.6,sill:!1});R(e,{axis:"z",sign:-1,plane:-t},-n+1,n-1,{floors:2,floorH:2.7,base:1.3,count:3,width:1.1,height:1.6,sill:!1}),C(e,n+2,t+3,6,29),le(e,-n+1,t+3.6,.6),se(e,-n,-t-9,n,-t-.3,29)}return e}function rn(d){const e=new T,h=d<1,p=d<2,c=re*2-1.6,l=re*2-2.4,o=5,n=3.1,t=o*n,r=c/2,s=l/2;if(e.box([-r,0,-s],[r,t,s],i.PLASTER,{roof:i.ROOF}),e.box([-r-.22,0,-s-.22],[r+.22,3.4,s+.22],i.BRICK,{roof:i.TRIM}),p&&(v(e,-r,-s,r,s,t,.9,.2),j(e,{axis:"z",sign:1,plane:s},-r+.4,r-.4,{floors:o-1,floorH:n,base:3.5,bays:3,depth:1.25,solid:!1}),j(e,{axis:"z",sign:-1,plane:-s},-r+.4,r-.4,{floors:o-1,floorH:n,base:3.5,bays:3,depth:1.25,solid:!1}),e.box([-1.6,t,-1.4],[1.6,t+3,1.4],i.BRICK,{roof:i.ROOF}),M(e,-r+1,-s+1,r-1,s-1,t,101,.9)),h){for(const[a,f,u,g]of[["z",1,s,r],["z",-1,-s,r],["x",1,r,s],["x",-1,-r,s]])R(e,{axis:a,sign:f,plane:u},-g+.8,g-.8,{floors:o-1,floorH:n,base:4.3,count:a==="z"?3:2,width:1.15,height:1.5});z(e,{axis:"z",sign:1,plane:s+.22},0,{width:1.5,double:!0,steps:2,canopy:1.5}),C(e,-r-1.2,s+2,5.4,33)}return e}function ln(d){const e=new T,h=d<1,p=d<2,c=16,l=12,o=5,n=3.2,t=4,r=t+o*n,s=c/2,a=l/2;if(e.box([-s,0,-a],[s,r,a],i.BRICK,{roof:i.ROOF}),p){for(let f=1;f<=o;f++)E(e,-s,-a,s,a,t+f*n-.3,.3,.14);E(e,-s,-a,s,a,r-.6,.6,.45),v(e,-s,-a,s,a,r,1.1,.24),E(e,-s,-a,s,a,t-.25,.5,.22),M(e,-s+1.2,-a+1.2,s-1.2,a-1.2,r,111,1)}if(h){S(e,{axis:"z",sign:1,plane:a},-s+.6,s-3.6,{bays:4,doorBay:1,head:3.5}),z(e,{axis:"z",sign:1,plane:a},s-2,{width:1.5,height:2.5,fanlight:!0,steps:2,canopy:1.2}),oe(e,{axis:"z",sign:1,plane:a},-s+.7,-1.4,3.3,1.5),N(e,{axis:"z",sign:1,plane:a},.5,6,2.95,3.6);for(const[f,u,g,b,m]of[["z",1,a,s,5],["z",-1,-a,s,5],["x",1,s,a,3],["x",-1,-s,a,3]])R(e,{axis:f,sign:u,plane:g},-b+.8,b-.8,{floors:o,floorH:n,base:t+.85,count:m,width:1.05,height:1.85});Ge(e,{axis:"x",sign:-1,plane:-s},-3,t+.5,o-1,n,3.4),F(e,{axis:"z",sign:1,plane:a},-s+1,s-1,1.6,6)}return e}function cn(d){const e=new T,h=d<1,p=d<2,c=22,l=18,o=4,n=3.1,t=o*n+.8,r=c/2,s=l/2,a=6.5;if(e.box([-r,0,-s],[r,t,-s+a],i.PLASTER,{roof:i.ROOF}),e.box([-r,0,-s+a],[-r+a,t,s],i.PLASTER,{roof:i.ROOF}),e.box([r-a,0,-s+a],[r,t,s],i.PLASTER,{roof:i.ROOF}),p&&(v(e,-r,-s,r,-s+a,t,.8,.2),v(e,-r,-s+a,-r+a,s,t,.8,.2),v(e,r-a,-s+a,r,s,t,.8,.2),e.box([-r,0,-s],[r,3.2,-s+a],i.BRICK,{roof:i.TRIM}),j(e,{axis:"z",sign:1,plane:-s+a},-r+a+.5,r-a-.5,{floors:o-1,floorH:n,base:3.6,bays:3,depth:1.2,solid:!1}),M(e,-r+1,-s+1,r-1,-s+a-1,t,121,.8),e.box([-r+a,1e-4,-s+a],[r-a,.1,s],i.CONCRETE),C(e,0,-s+a+4,6,41),C(e,-3.6,s-3,5.2,43),C(e,3.6,s-3,5.2,47)),h){for(const[f,u,g,b,m,w]of[["z",1,-s+a,-r+a+.6,r-a-.6,4],["z",-1,-s,-r+.8,r-.8,7],["x",1,r,-s+a+.6,s-.6,3],["x",-1,-r,-s+a+.6,s-.6,3]])R(e,{axis:f,sign:u,plane:g},b,m,{floors:o,floorH:n,base:3.9,count:w,width:1.1,height:1.6});z(e,{axis:"z",sign:-1,plane:-s},0,{width:1.8,double:!0,steps:1,canopy:1.5})}return e}function dn(d){const e=new T,h=d<1,p=d<2,c=18,l=13,o=4.6,n=4,t=3.15,r=o+n*t,s=c/2,a=l/2;if(e.box([-s,0,-a],[s,r,a],i.PLASTER,{roof:i.ROOF}),e.box([-s-.2,0,-a-.2],[s+.2,o,a+.2],i.CONCRETE,{roof:i.TRIM}),p&&(v(e,-s,-a,s,a,r,1,.22),E(e,-s,-a,s,a,o,.35,.3),j(e,{axis:"z",sign:1,plane:a},-s+.6,s-.6,{floors:n,floorH:t,base:o+.4,bays:4,depth:1.35,solid:!1}),M(e,-s+1.2,-a+1.2,s-1.2,a-1.2,r,131,1)),h){S(e,{axis:"z",sign:1,plane:a+.2},-s+.6,-.4,{bays:3,doorBay:1,head:3.7}),S(e,{axis:"z",sign:1,plane:a+.2},.4,s-.6,{bays:3,doorBay:1,head:3.7}),N(e,{axis:"z",sign:1,plane:a+.2},-s+1.6,-1.4,3.05,3.75),oe(e,{axis:"z",sign:1,plane:a+.2},.5,s-.7,3.9,1.5);for(const[f,u,g,b,m,w]of[["z",1,a,s,4,1.7],["z",-1,-a,s,6,1.1],["x",1,s,a,4,1.1],["x",-1,-s,a,4,1.1]])R(e,{axis:f,sign:u,plane:g},-b+.8,b-.8,{floors:n,floorH:t,base:o+.9,count:m,width:w,height:1.7});for(let f=0;f<n;f++){const u=o+.4+f*t;for(let g=0;g<4;g++){const b=-s+(g+.5)/4*(s*2);e.opening({axis:"z",sign:1,plane:a,u0:b-.45,u1:b+.45,y0:u+.2,y1:u+2.35,glass:i.GLASS,frame:.09,proud:.06})}}F(e,{axis:"z",sign:1,plane:a},-s+1,s-1,2,7),C(e,-s-1.4,a+2.4,5.6,51)}return e}function fn(d){const e=new T,h=d<1,p=d<2,c=26,l=11,o=6,n=2.95,t=o*n,r=c/2,s=l/2;if(e.box([-r,0,-s],[r,t,s],i.CONCRETE,{roof:i.ROOF}),p){v(e,-r,-s,r,s,t,.75,.2);for(let a=1;a<o;a++){const f=a*n;e.box([-r,f,-s-1.5],[r,f+.18,-s],i.CONCRETE),e.painted(x.METAL_DARK,()=>e.box([-r,f+.18,-s-1.5],[r,f+1.05,-s-1.38],i.TRIM))}for(const a of[-1,1])e.box([a*r-a*3,0,-s-1.6],[a*r,t+1.6,-s+.2],i.CONCRETE,{roof:i.ROOF});M(e,-r+2,-s+1,r-2,s-1,t,141,1.1)}if(h){R(e,{axis:"z",sign:1,plane:s},-r+.8,r-.8,{floors:o,floorH:n,base:.85,count:9,width:1.6,height:1.7}),R(e,{axis:"z",sign:-1,plane:-s},-r+3.4,r-3.4,{floors:o,floorH:n,base:.85,count:6,width:1,height:1.5}),j(e,{axis:"z",sign:1,plane:s},-r+.6,r-.6,{floors:o,floorH:n,base:.6,bays:6,depth:1.15,solid:!0});for(const a of[-1,1])R(e,{axis:"x",sign:a,plane:a*r},-s+.8,s-.8,{floors:o,floorH:n,base:.9,count:1,width:1,height:1.4,sill:!1});for(const a of[-1,1])z(e,{axis:"z",sign:-1,plane:-s-1.6},a*(r-1.5),{width:1.6,double:!0,canopy:1.4});O(e,-r,r,s,261,{trees:3,planters:2,bollards:8,depth:2.4})}return e}function hn(d){const e=new T,h=d<1,p=d<2,c=15,l=15,o=4.2,n=4,t=3.2,r=o+n*t,s=c/2,a=l/2;if(e.box([-s,0,-a],[s,r,a],i.BRICK,{roof:i.ROOF}),e.box([s-3.4,0,a-3.4],[s+.4,r,a+.4],i.PLASTER,{roof:i.ROOF}),p){v(e,-s,-a,s,a,r,1,.24),E(e,s-3.4,a-3.4,s+.4,a+.4,r,1.6,.4);for(let f=1;f<=n;f++)E(e,-s,-a,s,a,o+f*t-.28,.28,.14);E(e,-s,-a,s,a,o-.2,.42,.2),M(e,-s+1.2,-a+1.2,s-1.2,a-1.2,r,151,.9)}if(h){S(e,{axis:"z",sign:1,plane:a},-s+3,s-4.2,{bays:3,doorBay:1,head:3.6}),z(e,{axis:"z",sign:1,plane:a},-s+1.6,{width:1.4,height:2.5,fanlight:!0,steps:2,canopy:1.1}),S(e,{axis:"x",sign:1,plane:s},-a+.6,a-4.2,{bays:3,doorBay:1,head:3.6}),S(e,{axis:"z",sign:1,plane:a+.4},s-3.2,s+.2,{bays:1,doorBay:0,head:3.6}),oe(e,{axis:"z",sign:1,plane:a},-s+.7,-1,3.4,1.5);for(const[f,u,g,b,m]of[["z",1,a,s,4],["x",1,s,a,4],["z",-1,-a,s,5],["x",-1,-s,a,5]])R(e,{axis:f,sign:u,plane:g},-b+.9,b-4.4,{floors:n,floorH:t,base:o+.85,count:m,width:1.05,height:1.75});R(e,{axis:"z",sign:1,plane:a+.4},s-3,s+.2,{floors:n,floorH:t,base:o+.85,count:1,width:2.2,height:1.75}),F(e,{axis:"z",sign:1,plane:a},-s+1,s-1,1.6,6)}return e}function pn(d){const e=new T,h=d<1,p=d<2,c=re*3-2.4,l=c/2,o=c/2,n=9.5,t=19,r=3.05,s=n+t*r,a=l*.7,f=o*.7;if(e.box([-l,0,-o],[l,n,o],i.BRICK,{roof:i.ROOF}),E(e,-l,-o,l,o,n,.7,.25),e.box([-a,n,-f],[a,s,f],i.PLASTER,{roof:i.ROOF}),p){for(let g=0;g<=5;g++){const b=g/5,m=-a+b*a*2,w=-f+b*f*2;e.box([m-.16,n,f],[m+.16,s,f+.34],i.TRIM),e.box([m-.16,n,-f-.34],[m+.16,s,-f],i.TRIM),e.box([a,n,w-.16],[a+.34,s,w+.16],i.TRIM),e.box([-a-.34,n,w-.16],[-a,s,w+.16],i.TRIM)}for(let g=2;g<t;g+=3){const b=n+g*r;E(e,-a,-f,a,f,b,.18,.9),e.painted(x.METAL_DARK,()=>{e.box([-a-.9,b+.18,f+.78],[a+.9,b+1.1,f+.9],i.TRIM),e.box([-a-.9,b+.18,-f-.9],[a+.9,b+1.1,-f-.78],i.TRIM)})}v(e,-a,-f,a,f,s,1.4,.3),e.box([-a*.55,s,-f*.55],[a*.55,s+4.2,f*.55],i.METAL,{roof:i.ROOF}),e.box([-.22,s+4.2,-.22],[.22,s+11,.22],i.TRIM),M(e,-a+1,-f+1,a-1,f-1,s,161,.6)}if(h){for(let u=0;u<t;u++){const g=n+u*r+.85;for(const[b,m,w,y]of[["z",1,f,a],["z",-1,-f,a],["x",1,a,f],["x",-1,-a,f]])e.opening({axis:b,sign:m,plane:w,u0:-y+.75,u1:y-.75,y0:g,y1:g+1.55,glass:i.GLASS,frame:.09,proud:.05})}S(e,{axis:"z",sign:1,plane:o},-l+1,-1.6,{bays:2,doorBay:0,head:4.4,brandFascia:!1}),S(e,{axis:"z",sign:1,plane:o},4,l-1,{bays:2,doorBay:1,head:4.4,brandFascia:!1}),z(e,{axis:"z",sign:1,plane:o},1.2,{width:2.6,height:3.2,double:!0,canopy:1.9}),F(e,{axis:"z",sign:1,plane:o},-l+1,l-1,1.8,7)}return e}function un(d){const e=new T,h=d<1,p=d<2,c=26,l=13,o=16,n=3,t=5,r=t+o*n,s=c/2,a=l/2;if(e.box([-s,0,-a],[s,t,a],i.CONCRETE,{roof:i.TRIM}),e.box([-s+1,t,-a+.6],[s-1,r,a-.6],i.PLASTER,{roof:i.ROOF}),p){for(const f of[-1,1])e.box([f*(s-1)-f*3.2,t,-a+.4],[f*(s-1),r+2.4,a-.4],i.CONCRETE,{roof:i.ROOF});v(e,-s+1,-a+.6,s-1,a-.6,r,1,.24),j(e,{axis:"z",sign:1,plane:a-.6},-s+4.6,s-4.6,{floors:o,floorH:n,base:t+.5,bays:5,depth:1.4,solid:!0}),M(e,-s+5,-a+1,s-5,a-1,r,171,1.2)}if(h){R(e,{axis:"z",sign:1,plane:a-.6},-s+4.4,s-4.4,{floors:o,floorH:n,base:t+1.1,count:3,width:2.6,height:1.5,sill:!1}),R(e,{axis:"z",sign:-1,plane:-a+.6},-s+4.4,s-4.4,{floors:o,floorH:n,base:t+1.1,count:3,width:2.6,height:1.5,sill:!1});for(const f of[-1,1])R(e,{axis:"x",sign:f,plane:f*(s-1)},-a+1.2,a-1.2,{floors:o,floorH:n,base:t+1.1,count:1,width:1.1,height:1.4,sill:!1});S(e,{axis:"z",sign:1,plane:a},-s+2,-2.4,{bays:3,doorBay:1,head:4.2,brandFascia:!1}),S(e,{axis:"z",sign:1,plane:a},2.4,s-2,{bays:3,doorBay:1,head:4.2,brandFascia:!1}),z(e,{axis:"z",sign:1,plane:a},0,{width:2.6,height:3,double:!0,canopy:2.1})}return e}function gn(d){const e=new T,h=d<1,p=d<2,c=10.5,l=9,o=7,n=22,t=3.2,r=o+n*t;e.box([-c,0,-l],[c,o,l],i.CONCRETE,{roof:i.ROOF});const s=[[o,o+n*.45*t,.86,.86],[o+n*.45*t,o+n*.78*t,.7,.7],[o+n*.78*t,r,.54,.54]];for(const[a,f,u,g]of s)e.box([-c*u,a,-l*g],[c*u,f,l*g],i.GLASS,{roof:i.ROOF});if(p){for(const[,a,f,u]of s)E(e,-c*f,-l*u,c*f,l*u,a,.9,.35);E(e,-c,-l,c,l,o,.8,.4),e.box([-c*.28,r+.9,-l*.28],[c*.28,r+5.4,l*.28],i.METAL,{roof:i.ROOF}),e.box([-.2,r+5.4,-.2],[.2,r+13,.2],i.TRIM),M(e,-c*.5,-l*.5,c*.5,l*.5,r+.9,181,.5)}if(h){for(const[a,f,u,g]of s){const b=Math.max(1,Math.round((f-a)/t));for(let m=0;m<b;m++){const w=a+m*t+.4;for(const[y,A,B,P]of[["z",1,l*g,c*u],["z",-1,-l*g,c*u],["x",1,c*u,l*g],["x",-1,-c*u,l*g]])e.opening({axis:y,sign:A,plane:B,u0:-P+.5,u1:P-.5,y0:w,y1:w+t-1,glass:i.GLASS,frame:.07,proud:.05})}}S(e,{axis:"z",sign:1,plane:l},-c+1.2,-2.2,{bays:3,doorBay:1,head:5.2,brandFascia:!1}),S(e,{axis:"z",sign:1,plane:l},2.2,c-1.2,{bays:3,doorBay:1,head:5.2,brandFascia:!1}),z(e,{axis:"z",sign:1,plane:l},0,{width:2.8,height:3.4,double:!0,canopy:2.6})}return e}function bn(d){const e=new T,h=d<1,p=d<2,c=11,l=10,o=15,n=3.1;for(let t=0;t<o;t++){const r=t*n,s=l-t/o*(l*.55);e.box([-c,r,-l],[c,r+n,s],i.PLASTER,{roof:i.ROOF}),p&&t>0&&(e.painted(x.METAL_DARK,()=>{e.box([-c,r,s-.12],[c,r+1.05,s],i.TRIM)}),t%2===0&&e.painted(x.GREEN,()=>e.box([-c+1,r,s+.4],[c-1,r+.5,s+1.6],i.TRIM)))}if(p){for(const t of[-1,1])e.box([t*c-t*2.6,0,-l],[t*c,o*n+2.2,-l+4],i.CONCRETE,{roof:i.ROOF});M(e,-c+3,-l+1,c-3,-l+3.5,o*n+2.2,191,.8)}if(h){for(let t=0;t<o;t++){const r=t*n+.9,s=l-t/o*(l*.55);e.opening({axis:"z",sign:1,plane:s,u0:-c+.8,u1:c-.8,y0:r,y1:r+1.9,glass:i.GLASS,frame:.08,proud:.05}),e.opening({axis:"z",sign:-1,plane:-l,u0:-c+3.2,u1:c-3.2,y0:r,y1:r+1.5,glass:i.GLASS,frame:.08,proud:.05})}for(let t=0;t<o;t++){const r=t*n+.9,s=l-t/o*(l*.55);for(const a of[-1,1])e.opening({axis:"x",sign:a,plane:a*c,u0:-l+4.4,u1:s-.8,y0:r,y1:r+1.6,glass:i.GLASS,frame:.08,proud:.05})}z(e,{axis:"z",sign:-1,plane:-l},0,{width:2.4,height:3,double:!0,canopy:2.2}),R(e,{axis:"z",sign:-1,plane:-l},-c+3.2,c-3.2,{floors:1,floorH:3,base:3.6,count:3,width:1.2,height:1.4})}return e}function xn(d){const e=new T,h=d<1,p=d<2,c=13,l=11,o=8,n=14,t=3.05,r=o+n*t,s=5.2,a=6.4;e.box([-c,0,-l],[c,o,l],i.CONCRETE,{roof:i.ROOF});for(const f of[-1,1])e.box([f*6.4-s,o,-a],[f*6.4+s,r,a],i.PLASTER,{roof:i.ROOF});if(p){v(e,-c,-l,c,l,o,1,.3);for(const f of[-1,1])v(e,f*6.4-s,-a,f*6.4+s,a,r,1.2,.28),j(e,{axis:"z",sign:1,plane:a},f*6.4-s+.4,f*6.4+s-.4,{floors:n,floorH:t,base:o+.5,bays:2,depth:1.3,solid:!1});e.painted(x.GREEN,()=>{e.box([-c+1.5,o,a+1.5],[c-1.5,o+.45,l-1.5],i.TRIM)}),C(e,-6,l-3.4,4.6,201),C(e,6,l-3.4,4.6,203),M(e,-c+2,-l+1.5,c-2,-a-1.5,o,205,.7)}if(h){for(const f of[-1,1])for(const[u,g,b,m]of[["z",1,a,s],["z",-1,-a,s],["x",1,f*6.4+s,a],["x",-1,f*6.4-s,a]]){const w=b,y=u==="z"?f*6.4:0;R(e,{axis:u,sign:g,plane:w},y-m+.6,y+m-.6,{floors:n,floorH:t,base:o+1,count:1,width:m*1.5,height:1.6,sill:!1})}S(e,{axis:"z",sign:1,plane:l},-c+1.5,-3,{bays:3,doorBay:1,head:4.6,brandFascia:!1}),S(e,{axis:"z",sign:1,plane:l},3,c-1.5,{bays:3,doorBay:1,head:4.6,brandFascia:!1}),z(e,{axis:"z",sign:1,plane:l},0,{width:3,height:3.2,double:!0,canopy:2.8}),F(e,{axis:"z",sign:1,plane:l},-c+1,c-1,1.8,8)}return e}function mn(d){const e=new T,h=d<1,p=d<2,c=13,l=8.6,o=5.6,n=c/2,t=l/2,r=W(l);if(e.box([-n,0,-t],[n,o,t],i.HOUSE_WALL),e.gable([-n,o,-t],[n,o,t],r,"x",i.ROOF,i.HOUSE_WALL),e.box([-.22,0,-t-.1],[.22,o+r+.35,t+.1],i.BRICK),p){U(e,-n,-t,n,t,o+.05),ce(e,-n,-t,n,t,o+.05),ne(e,0,0,o+r-1.2,o+r+1.6,1.2);for(const s of[-1,1]){const a=s*3.2;e.box([a-1.5,0,t],[a+1.5,3,t+.9],i.HOUSE_WALL,{roof:i.ROOF}),e.box([a-1.7,3,t-.1],[a+1.7,3.25,t+1.1],i.TRIM)}e.box([-n-.14,0,-t-.14],[n+.14,.55,t+.14],i.BRICK)}if(h){for(const s of[-1,1]){const a=s*3.2;e.windowRow({axis:"z",sign:1,plane:t+.9,from:a-1.4,to:a+1.4,y0:.9,y1:2.5,count:3,width:.85,glass:i.GLASS,frame:.09,proud:.06}),R(e,{axis:"z",sign:1,plane:t},a-1.5,a+1.5,{floors:1,floorH:3,base:3.7,count:2,width:.95,height:1.4}),R(e,{axis:"z",sign:-1,plane:-t},a-2.2,a+2.2,{floors:2,floorH:2.9,base:.95,count:2,width:1,height:1.35}),R(e,{axis:"x",sign:s,plane:s*n},-t+1.4,t-1.4,{floors:2,floorH:2.9,base:1,count:1,width:.85,height:1.3}),z(e,{axis:"z",sign:1,plane:t},s*.95,{width:1,height:2.1,fanlight:!0,steps:1,canopy:1.1}),e.box([s*4.4-1.4,.002,t+.9],[s*4.4+1.4,.06,t+5.4],i.CONCRETE),e.box([s*6.1,0,t+1],[s*6.1+s*.3,.7,t+5.4],i.BRICK),C(e,s*1.9,t+3.6,3.4,620+s)}se(e,-n,-t-8.4,n,-t-.2,623),H(e,-n-1,t+5.4,n+1,t+5.8)}return e}function wn(d){const e=new T,h=d<1,p=d<2,c=21,l=14,o=5,n=3.15,t=3.9,r=t+o*n,s=c/2,a=l/2;e.box([-s,0,-a],[s,r,a],i.BRICK,{roof:i.ROOF});for(const f of[-1,1])e.box([f*s-f*4.6,0,a-.2],[f*s,r+1.4,a+1.4],i.BRICK,{roof:i.ROOF});if(e.box([-3.2,0,a-.2],[3.2,r+2.6,a+1],i.PLASTER,{roof:i.ROOF}),p){E(e,-s,-a,s,a,t-.3,.55,.26);for(let f=1;f<=o;f++)E(e,-s,-a,s,a,t+f*n-.32,.32,.15);v(e,-s,-a,s,a,r,1,.26);for(const f of[-1,1])v(e,f*s-f*4.6,a-.2,f*s,a+1.4,r+1.4,.8,.3);v(e,-3.2,a-.2,3.2,a+1,r+2.6,.9,.34);for(let f=0;f<3;f++){const u=3.2-f*.75;e.box([-u,r+3.5+f*.55,a-.1],[u,r+4.05+f*.55,a+.9],i.PLASTER)}M(e,-s+2,-a+2,s-2,a-3,r,631,.8)}if(h){for(const f of[-1,1])R(e,{axis:"z",sign:1,plane:a+1.4},Math.min(f*s-f*4,f*s-f*.7),Math.max(f*s-f*4,f*s-f*.7),{floors:o,floorH:n,base:t+.85,count:2,width:1.15,height:1.85});R(e,{axis:"z",sign:1,plane:a},-s+5.2,-3.6,{floors:o,floorH:n,base:t+.85,count:2,width:1.15,height:1.85}),R(e,{axis:"z",sign:1,plane:a},3.6,s-5.2,{floors:o,floorH:n,base:t+.85,count:2,width:1.15,height:1.85});for(let f=0;f<o;f++)e.opening({axis:"z",sign:1,plane:a+1,u0:-1.9,u1:1.9,y0:t+f*n+.7,y1:t+f*n+2.5,glass:i.GLASS,frame:.12,proud:.06});R(e,{axis:"z",sign:-1,plane:-a},-s+1,s-1,{floors:o,floorH:n,base:t+.85,count:6,width:1.15,height:1.8});for(const f of[-1,1])R(e,{axis:"x",sign:f,plane:f*s},-a+1.2,a-1.2,{floors:o,floorH:n,base:t+.85,count:4,width:1.1,height:1.8});z(e,{axis:"z",sign:1,plane:a+1},0,{width:2.4,height:3,double:!0,steps:3,canopy:1.8}),O(e,-s,s,a+1.4,633,{trees:3,planters:2,bollards:7,depth:2.4})}return e}function Rn(d){const e=new T,h=d<1,p=d<2,c=10,l=9.5,o=4.6,n=16,t=2.95,r=o+n*t;if(e.box([-c,0,-l],[c,o,l],i.CONCRETE,{roof:i.TRIM}),e.box([-c+.6,o,-l+.6],[c-.6,r,l-.6],i.BRICK,{roof:i.ROOF}),e.box([-3.4,0,-l-2.6],[3.4,r+3.6,-l+.8],i.CONCRETE,{roof:i.ROOF}),p){for(let s=0;s<=n;s++)E(e,-c+.6,-l+.6,c-.6,l-.6,o+s*t,.35,.35,i.CONCRETE);for(const s of[-1,1])for(const a of[-1,1])e.box([Math.min(s*(c-.6)-s*1.1,s*(c-.6)+s*.35),o,Math.min(a*(l-.6)-a*1.1,a*(l-.6)+a*.35)],[Math.max(s*(c-.6)-s*1.1,s*(c-.6)+s*.35),r+.9,Math.max(a*(l-.6)-a*1.1,a*(l-.6)+a*.35)],i.CONCRETE);v(e,-c+.6,-l+.6,c-.6,l-.6,r,1.1,.3),j(e,{axis:"z",sign:1,plane:l-.6},-c+1.8,c-1.8,{floors:n,floorH:t,base:o+.35,bays:2,depth:1.5,solid:!0}),M(e,-c+2,-l+2,c-2,l-2,r,641,.7),e.painted(x.GREEN,()=>{e.box([-c+1.2,o,1],[c-1.2,o+.4,l-1.2],i.TRIM)})}if(h){for(const[s,a,f,u,g]of[["z",1,l-.6,c-.6,2],["z",-1,-l+.6,c-.6,2],["x",1,c-.6,l-.6,3],["x",-1,-c+.6,l-.6,3]])R(e,{axis:s,sign:a,plane:f},-u+1.4,u-1.4,{floors:n,floorH:t,base:o+.95,count:g,width:1.5,height:1.55,sill:!1});for(let s=1;s<n+1;s++)e.opening({axis:"x",sign:1,plane:3.4,u0:-l-2.2,u1:-l+.4,y0:o+s*t-1.6,y1:o+s*t-.3,glass:i.GLASS,frame:.1,proud:.05});z(e,{axis:"z",sign:1,plane:l},0,{width:2.4,height:2.8,double:!0,glazed:!0,canopy:2.2}),e.windowRow({axis:"z",sign:1,plane:l,from:-c+1.2,to:-2.2,y0:1,y1:3.2,count:2,width:2,glass:i.GLASS,frame:.1,proud:.06}),e.windowRow({axis:"z",sign:1,plane:l,from:2.2,to:c-1.2,y0:1,y1:3.2,count:2,width:2,glass:i.GLASS,frame:.1,proud:.06}),O(e,-c,c,l,643,{trees:3,planters:2,bollards:7})}return e}const yn=d=>d*1.6,k=d=>({households:d,powerKW:yn(d),waterM3:d*.55,garbagePerWeek:d*11,pollution:d>40?2:0,upkeep:Math.round(d*2.1)+5}),Tn=[{id:"res.low.detached",name:"Detached house",zone:"residential",density:"low",variant:"sculpted",footprint:[2,4],height:10.4,sim:k(1),note:"Cross gable, garage wing, dormer, porch with balusters, bay window.",build:en},{id:"res.low.bungalow",name:"Bungalow",zone:"residential",density:"low",variant:"sculpted",footprint:[3,3],height:6.2,sim:k(1),note:"Single storey under a wide low roof, deep eaves, carport on posts.",build:nn},{id:"res.low.duplex",name:"Duplex",zone:"residential",density:"low",variant:"sculpted",footprint:[3,3],height:9,sim:k(2),note:"A mirrored pair under one roof, two porches, shared central chimney.",build:on},{id:"res.low.terrace",name:"Terrace of four",zone:"residential",density:"low",variant:"sculpted",footprint:[3,3],height:9.4,sim:k(4),note:"Party walls carried through the roof so it reads as four houses, not one block.",build:tn},{id:"res.low.cottage",name:"Cottage",zone:"residential",density:"low",variant:"sculpted",footprint:[2,3],height:8,sim:k(1),note:"Steep roof, lean-to along one side, garden wall, two trees.",build:sn},{id:"res.low.large",name:"Large family house",zone:"residential",density:"low",variant:"sculpted",footprint:[2,4],height:11,sim:k(1),note:"Two-storey projecting wing, full-width porch, two chimneys.",build:an},{id:"res.low.semi",name:"Semi-detached pair",zone:"residential",density:"low",variant:"sculpted",footprint:[2,4],height:9.5,sim:k(2),note:"Two houses under one roof, party wall through the ridge, bay windows, driveways, back gardens.",build:mn},{id:"res.mid.walkup",name:"Walk-up flats",zone:"residential",density:"medium",variant:"sculpted",footprint:[3,3],height:18.5,sim:k(24),note:"Masonry base, balconies front and back, stair core over the roofline.",build:rn},{id:"res.mid.tenement",name:"Tenement",zone:"residential",density:"medium",variant:"sculpted",footprint:[3,2],height:21.1,sim:k(30),note:"Shop at street level, string course per floor, heavy cornice, fire escape.",build:ln},{id:"res.mid.courtyard",name:"Courtyard block",zone:"residential",density:"medium",variant:"sculpted",footprint:[3,3],height:13.2,sim:k(36),note:"Three wings round a planted court, balconies facing in.",build:cn},{id:"res.mid.mixed",name:"Flats over shops",zone:"residential",density:"medium",variant:"sculpted",footprint:[3,3],height:17.2,sim:k(28),note:"Two retail units at the base, four floors of flats with balconies over.",build:dn},{id:"res.mid.slab",name:"Deck-access block",zone:"residential",density:"medium",variant:"sculpted",footprint:[4,2],height:17.7,sim:k(48),note:"Open access decks along the back, stair towers at both ends.",build:fn},{id:"res.mid.corner",name:"Corner block",zone:"residential",density:"medium",variant:"sculpted",footprint:[2,3],height:18,sim:k(26),note:"Chamfered corner with its own shopfront, string courses, awning.",build:hn},{id:"res.mid.deco",name:"Mansion block",zone:"residential",density:"medium",variant:"sculpted",footprint:[3,3],height:25,sim:k(24),note:"Inter-war brick block: projecting end bays, stepped centre crown, stone entrance, tall stair window.",build:wn},{id:"res.high.point",name:"Point tower",zone:"residential",density:"high",variant:"sculpted",footprint:[3,3],height:79,sim:k(180),note:"Podium and setback, vertical fins full height, balcony band every third floor.",build:pn},{id:"res.high.slab",name:"Slab tower",zone:"residential",density:"high",variant:"sculpted",footprint:[4,2],height:55,sim:k(190),note:"Expressed cores at both ends, solid balconies across the sunny elevation.",build:un},{id:"res.high.glass",name:"Stepped glass tower",zone:"residential",density:"high",variant:"sculpted",footprint:[3,3],height:91,sim:k(210),note:"Three setbacks with a slab band at each, crown and mast.",build:gn},{id:"res.high.terraced",name:"Terraced tower",zone:"residential",density:"high",variant:"sculpted",footprint:[3,3],height:49,sim:k(120),note:"Every floor steps back, so every flat gets a planted terrace.",build:bn},{id:"res.high.twin",name:"Twin towers on a podium",zone:"residential",density:"high",variant:"sculpted",footprint:[4,4],height:51,sim:k(200),note:"Two towers off a shared podium with a planted deck between them.",build:xn},{id:"res.high.estate",name:"Estate tower",zone:"residential",density:"high",variant:"sculpted",footprint:[3,4],height:56.1,sim:k(64),note:"Brick infill in an expressed concrete frame, balconies both sides, stair core carried above the roof.",build:Rn}];function vn(d){const e=new T,h=d<1,p=d<2,c=13,l=11,o=c/2,n=l/2,t=4.2,r=2,s=3.2,a=t+r*s;return e.box([-o,0,-n],[o,a,n],i.BRICK,{roof:i.ROOF}),p&&(v(e,-o,-n,o,n,a,1,.22),E(e,-o,-n,o,n,t-.15,.4,.16),M(e,-o+1,-n+1,o-1,n-1,a,3,.8)),h&&(S(e,{axis:"z",sign:1,plane:n},-o+.6,o-.6,{bays:4,doorBay:1,head:3.6}),S(e,{axis:"x",sign:1,plane:o},-n+.8,n-2.4,{bays:3,doorBay:3,head:3.6}),oe(e,{axis:"z",sign:1,plane:n},-o+.7,-.4,3,1.6),te(e,{axis:"z",sign:1,plane:n},o-2,4.6,6.3,1.4),N(e,{axis:"z",sign:1,plane:n},-o+1.2,o-3.4,3.05,3.85),N(e,{axis:"x",sign:1,plane:o},-n+1.4,n-3.6,3.05,3.85),R(e,{axis:"z",sign:1,plane:n},-o+1,o-1,{floors:r,floorH:s,base:t+.9,count:3,width:1.3,height:1.8}),R(e,{axis:"x",sign:1,plane:o},-n+1,n-1,{floors:r,floorH:s,base:t+.9,count:3,width:1.2,height:1.8}),R(e,{axis:"x",sign:-1,plane:-o},-n+1,n-1,{floors:r,floorH:s,base:t+.9,count:2,width:1.2,height:1.8}),F(e,{axis:"z",sign:1,plane:n},-o+1,o-1,1.5,5),le(e,o-1.6,n+1.9,.7)),e}function Mn(d){const e=new T,h=d<1,p=d<2,c=15,l=8.4,o=c/2,n=l/2,t=4.4;if(e.box([-o,0,-n],[o,t,n],i.PLASTER,{roof:i.ROOF}),e.painted(x.BRAND_DARK,()=>e.box([-o-.12,0,-n-.12],[o+.12,1,n+.12],i.TRIM)),p&&(e.painted(x.BRAND,()=>we(e,-o,-n,o,n,t-.6,.6,1.1)),e.box([-o-1.1,t-.72,-n-1.1],[o+1.1,t-.6,n+1.1],i.CONCRETE),v(e,-o,-n,o,n,t,.5,.2),M(e,-o+1,-n+1,o-1,n-1,t+.5,11,.7),ze(e,o-2.2,n+4.4,8.5,2.4)),h){for(const[r,s,a]of[[-o+.8,-1.5,3],[1.5,o-.8,3]])e.windowRow({axis:"z",sign:1,plane:n,from:r,to:s,y0:1.05,y1:3.5,count:a,width:1.55,glass:i.SHOPFRONT,frame:.09,proud:.07});e.windowRow({axis:"z",sign:-1,plane:-n,from:-o+.8,to:o-.8,y0:1.05,y1:3.5,count:7,width:1.55,glass:i.SHOPFRONT,frame:.09,proud:.07}),e.windowRow({axis:"x",sign:1,plane:o,from:-n+.8,to:n-.8,y0:1.05,y1:3.5,count:3,width:1.5,glass:i.SHOPFRONT,frame:.09,proud:.07}),N(e,{axis:"z",sign:1,plane:n},-4.5,4.5,t-.45,t-.05),z(e,{axis:"z",sign:1,plane:n},0,{width:2.2,height:2.5,double:!0,glazed:!0,canopy:1.9}),e.painted(x.METAL_DARK,()=>{for(const r of[-1.7,1.7])e.box([r-.07,0,n+1.7],[r+.07,3.45,n+1.84],i.TRIM)}),e.box([-2,0,n+.1],[2,.14,n+1.9],i.CONCRETE),te(e,{axis:"x",sign:1,plane:o},0,2.4,4.2,1.5),F(e,{axis:"z",sign:1,plane:n},-o+1,o-1,2.4,6)}return e}function En(d){const e=new T,h=d<1,p=d<2,c=14,l=11,o=c/2,n=l/2,t=-3,r=5;if(e.box([t-o/2,0,-n],[t+o/2,r,n],i.PLASTER,{roof:i.ROOF}),p){e.painted(x.BRAND,()=>we(e,t-o/2,-n,t+o/2,n,r-1.5,1.9,.5)),M(e,t-o/2+1,-n+1,t+o/2-1,n-1,r+.4,21,1.1);const s=t+o/2+1.2;e.box([s,3.4,-n+1],[s+5.4,3.8,n-1],i.CONCRETE),e.painted(x.METAL_DARK,()=>{for(const a of[-n+1.6,n-1.6])e.box([s+4.6,0,a-.16],[s+4.9,3.4,a+.16],i.TRIM)}),H(e,s-.4,-n,s+5.6,n),ze(e,t-o/2-2.6,n-1.5,9.5,2.6)}if(h){S(e,{axis:"z",sign:1,plane:n},t-o/2+.7,t+o/2-.7,{bays:4,doorBay:0,head:3.5}),N(e,{axis:"z",sign:1,plane:n},t-3,t+3,r-1.15,r-.15),N(e,{axis:"x",sign:-1,plane:t-o/2},-2.6,2.6,r-1.15,r-.15);const s={axis:"x",sign:1,plane:t+o/2};e.windowRow({axis:"x",sign:1,plane:t+o/2,from:-1.2,to:1.2,y0:1.5,y1:2.8,count:1,width:1.6,glass:i.SHOPFRONT,frame:.1,proud:.07}),q(e,s,-3.6,-1.6,1.6,3.2),O(e,t-o/2,t+o/2,n,4,{trees:2,planters:2,bollards:5}),e.painted(x.METAL_DARK,()=>{e.box([t+o/2+5,0,-1.4],[t+o/2+5.3,1.5,-1.1],i.TRIM),e.box([t+o/2+4.6,1.5,-1.7],[t+o/2+5.7,2.6,-.8],i.TRIM)}),Y(e,t-o/2,t+o/2-2,n+2.2,0,.95,1.2),e.painted(x.METAL_DARK,()=>{for(const a of[t-4.2,t+.6]){e.cylinder(a,n+1.2,.13,0,.72,6,i.TRIM,!1),e.cylinder(a,n+1.2,.58,.72,.78,10,i.TRIM);for(const f of[-.95,.95])e.box([a+f-.2,0,n+1],[a+f+.2,.44,n+1.4],i.TRIM),e.box([a+f-.2,.44,n+1.22],[a+f+.2,.92,n+1.4],i.TRIM)}});for(let a=0;a<8;a++)e.box([t+o/2+1.4+a*.7,.002,-n+.6],[t+o/2+1.8+a*.7,.02,-n+.9],i.TRIM);R(e,{axis:"x",sign:-1,plane:t-o/2},-n+1,n-1,{floors:1,floorH:3,base:1.6,count:3,width:1.1,height:1.5})}return e}function In(d){const e=new T,h=d<1,p=d<2,c=9.5,l=8,o=c/2,n=l/2,t=4;if(e.box([-o,0,-n],[o,t,n],i.BRICK,{roof:i.ROOF}),p&&(v(e,-o,-n,o,n,t,.7,.2),M(e,-o+.8,-n+.8,o-.8,n-.8,t,31,.6),e.box([-o,1e-4,n],[o,.16,n+3.6],i.CONCRETE),e.box([-o,.16,n+3.4],[o,.75,n+3.6],i.BRICK)),h){S(e,{axis:"z",sign:1,plane:n},-o+.5,o-.5,{bays:3,doorBay:2,head:3.3}),oe(e,{axis:"z",sign:1,plane:n},-o+.6,o-.6,3.5,1.8),te(e,{axis:"z",sign:1,plane:n},-o+1.2,3,4.4,1.3),e.painted(x.METAL_DARK,()=>{for(const r of[-2.4,1.4]){e.cylinder(r,n+1.9,.14,.16,.72,6,i.TRIM,!1),e.cylinder(r,n+1.9,.62,.72,.78,10,i.TRIM);for(const[s,a]of[[-1,0],[1,0]])e.box([r+s-.22,.16,n+1.9+a-.22],[r+s+.22,.46,n+1.9+a+.22],i.TRIM),e.box([r+s-.22,.46,n+1.9+a+.1],[r+s+.22,.95,n+1.9+a+.22],i.TRIM)}}),O(e,-o,o,n+3.6,31,{trees:2,planters:3,bollards:5,depth:1.8}),Y(e,-o,o,n+3.5,.16,.9,1.1);for(const[r,s]of[[1,o],[-1,-o]])R(e,{axis:"x",sign:r,plane:s},-n+1,n-1,{floors:1,floorH:3,base:1.4,count:2,width:1.2,height:1.7});R(e,{axis:"z",sign:-1,plane:-n},-o+1,o-1,{floors:1,floorH:3,base:1.4,count:2,width:1.2,height:1.5})}return e}function zn(d){const e=new T,h=d<1,p=d<2,c=28,l=12,o=c/2,n=l/2,t=5.2,r=4;if(e.box([-o,0,-n],[o,t,n],i.CONCRETE,{roof:i.ROOF}),p&&(v(e,-o,-n,o,n,t,1.1,.25),M(e,-o+1.5,-n+1.5,o-1.5,n-1.5,t,41,1.2),e.box([-o,3.6,n],[o,4.1,n+3],i.CONCRETE),e.painted(x.METAL_DARK,()=>{for(let s=0;s<=r;s++){const a=-o+s/r*c;e.box([a-.18,0,n+2.5],[a+.18,3.6,n+2.86],i.TRIM)}}),H(e,-o,n+3,o,n+4.2)),h){for(let s=0;s<r;s++){const a=-o+s/r*c+.5,f=-o+(s+1)/r*c-.5;S(e,{axis:"z",sign:1,plane:n},a,f,{bays:3,doorBay:s%3,head:3.4,fascia:1}),N(e,{axis:"z",sign:1,plane:n},a+1,f-1,3.05,3.75),s%2===0&&oe(e,{axis:"z",sign:1,plane:n},a+.3,f-.3,4.4,1.4)}for(let s=0;s<r;s++){const a=-o+(s+.5)/r*c;e.opening({axis:"z",sign:-1,plane:-n,u0:a-.55,u1:a+.55,y0:.1,y1:2.3,glass:i.TRIM,frame:.1,proud:.07})}for(const s of[-o+3,0,o-3])C(e,s,n+5,5,s+7)}return e}function An(d){const e=new T,h=d<1,p=d<2,c=30,l=20,o=c/2,n=l/2,t=8;if(e.box([-o,0,-n],[o,t,n],i.CONCRETE,{roof:i.ROOF}),p&&(v(e,-o,-n,o,n,t,1.4,.3),e.painted(x.BRAND,()=>e.box([-8.5,t,n-.4],[8.5,t+2.6,n+.4],i.TRIM)),M(e,-o+2,-n+2,o-2,n-2,t,51,1.6),e.box([-9,4.6,n],[9,5.2,n+4.5],i.CONCRETE),e.painted(x.METAL_DARK,()=>{for(const r of[-8.2,-2.8,2.8,8.2])e.box([r-.2,0,n+4],[r+.2,4.6,n+4.4],i.TRIM)}),H(e,-o,n+4.5,o,n+6)),h){e.windowRow({axis:"z",sign:1,plane:n,from:-8,to:8,y0:.5,y1:4.4,count:6,width:2.3,glass:i.SHOPFRONT,frame:.11,proud:.08}),N(e,{axis:"z",sign:1,plane:n},-6.5,6.5,t+.6,t+2.1),q(e,{axis:"x",sign:1,plane:o},-3,3,5.4,6.8),e.painted(x.METAL_DARK,()=>{e.box([o-7,0,n+5],[o-2,2.4,n+5.2],i.TRIM),e.box([o-7,2.2,n+5],[o-2,2.4,n+7.4],i.TRIM),e.box([o-7,0,n+7.2],[o-2,2.4,n+7.4],i.TRIM)}),e.box([-o+2,0,-n-2.4],[-o+12,1.2,-n],i.CONCRETE);for(let r=0;r<2;r++){const s=-o+4+r*5;e.painted(x.METAL_DARK,()=>e.box([s-1.8,1.2,-n-.14],[s+1.8,5,-n+.02],i.TRIM))}O(e,-o,o,n+6,51,{trees:4,planters:4,bollards:9,depth:2.4});for(let r=0;r<10;r++){const s=-o+1.5+r*2.9;e.box([s-.06,.002,n+9],[s+.06,.02,n+13.5],i.TRIM)}for(const[r,s]of[[1,o],[-1,-o]])R(e,{axis:"x",sign:r,plane:s},-n+2,n-2,{floors:1,floorH:3,base:5.4,count:4,width:1.4,height:1.2})}return e}function On(d){const e=new T,h=d<1,p=d<2,c=15,l=14,o=c/2,n=l/2,t=5,r=7,s=3.6,a=t+r*s;if(e.box([-o+.5,0,-n+.5],[o-.5,t,n-.5],i.SHOPFRONT,{roof:i.TRIM}),e.box([-o,t,-n],[o,a,n],i.GLASS,{roof:i.ROOF}),p){for(const f of[-1,1])for(const u of[-1,1])e.box([f*o-f*.55,0,u*n-u*.55],[f*o,t,u*n],i.CONCRETE);e.box([-o-.9,t-.7,-n-.9],[o+.9,t-.42,n+.9],i.CONCRETE);for(let f=1;f<=r;f++)E(e,-o,-n,o,n,t+f*s-.5,.5,.14);E(e,-o,-n,o,n,a,1.4,.45),M(e,-o+2,-n+2,o-2,n-2,a+1.4,61,1.3)}if(h){for(const[f,u,g,b]of[["z",1,n,o],["z",-1,-n,o],["x",1,o,n],["x",-1,-o,n]])for(let m=0;m<r;m++){const w=t+m*s+.35;e.windowRow({axis:f,sign:u,plane:g,from:-b+.6,to:b-.6,y0:w,y1:w+s-1.05,count:2,width:b*.85,glass:i.GLASS,frame:.07,proud:.05})}S(e,{axis:"z",sign:1,plane:n-.5},-o+1.4,o-1.4,{bays:4,doorBay:1,head:4.2,brandFascia:!1}),q(e,{axis:"z",sign:1,plane:n},-2.4,2.4,t+.4,t+1.4),F(e,{axis:"z",sign:1,plane:n},-o+1,o-1,1.8,6)}return e}function Sn(d){const e=new T,h=d<1,p=d<2,c=9,l=12.5,o=c/2,n=l/2,t=4.4,r=3,s=3.3,a=t+r*s;if(e.box([-o,0,-n],[o,a,n],i.BRICK,{roof:i.ROOF}),p){E(e,-o,-n,o,n,a-.55,.55,.42),v(e,-o,-n,o,n,a,1.2,.24);for(let f=1;f<r;f++)E(e,-o,-n,o,n,t+f*s-.28,.28,.16);E(e,-o,-n,o,n,t-.2,.45,.22),M(e,-o+.8,-n+.8,o-.8,n-.8,a,71,.7)}if(h){S(e,{axis:"z",sign:1,plane:n},-o+.5,o-.5,{bays:2,doorBay:1,head:3.7}),oe(e,{axis:"z",sign:1,plane:n},-o+.6,.6,3.6,1.5),te(e,{axis:"z",sign:1,plane:n},o-1.3,4.7,6.4,1.2);for(let f=0;f<r;f++){const u=t+f*s+.5;e.box([-2.4,u,n],[2.4,u+2.2,n+.6],i.BRICK),e.box([-2.6,u+2.2,n],[2.6,u+2.45,n+.75],i.TRIM),e.opening({axis:"z",sign:1,plane:n+.6,u0:-2.1,u1:2.1,y0:u+.35,y1:u+1.95,glass:i.GLASS,frame:.09,proud:.06})}R(e,{axis:"x",sign:1,plane:o},-n+1,n-1,{floors:r,floorH:s,base:t+.8,count:3,width:1.1,height:1.9}),Ge(e,{axis:"x",sign:-1,plane:-o},-2.4,t+.4,r,s,3)}return e}const ye=[{id:"com.corner_shop",name:"Corner shop",zone:"commercial",density:"low",variant:"sculpted",footprint:[2,2],height:11.7,brand:L.grocer,sim:{jobs:12,powerKW:34,waterM3:3,garbagePerWeek:70,pollution:1,upkeep:26},note:"Two-storey brick shop with flats over, wrapping shopfront, awning and blade sign.",build:vn},{id:"com.diner",name:"Roadside diner",zone:"commercial",density:"low",variant:"sculpted",footprint:[3,3],height:8.5,brand:L.diner,sim:{jobs:16,powerKW:52,waterM3:8,garbagePerWeek:140,pollution:2,upkeep:34},note:"Low glazed box under deep brand eaves, entrance porch, pylon sign by the kerb.",build:Mn},{id:"com.drivethru",name:"Drive-through",zone:"commercial",density:"low",variant:"sculpted",footprint:[3,2],height:9.5,brand:L.burger,sim:{jobs:22,powerKW:68,waterM3:10,garbagePerWeek:210,pollution:3,upkeep:40},note:"Brand band, wrapped lane under a canopy, order window, menu board and pylon.",build:En},{id:"com.coffee",name:"Coffee bar",zone:"commercial",density:"low",variant:"sculpted",footprint:[2,3],height:4.7,brand:L.coffee,sim:{jobs:8,powerKW:26,waterM3:4,garbagePerWeek:60,pollution:1,upkeep:18},note:"Single storey with a terrace: tables, planters, awning and a hanging sign.",build:In},{id:"com.strip",name:"Strip of units",zone:"commercial",density:"medium",variant:"sculpted",footprint:[4,3],height:6.3,brand:L.hardware,sim:{jobs:34,powerKW:96,waterM3:9,garbagePerWeek:260,pollution:2,upkeep:62},note:"Four units under one roof behind a colonnade, each with its own fascia and door.",build:zn},{id:"com.supermarket",name:"Supermarket",zone:"commercial",density:"medium",variant:"sculpted",footprint:[5,6],height:10.6,brand:L.grocer,sim:{jobs:70,powerKW:240,waterM3:26,garbagePerWeek:700,pollution:4,upkeep:130},note:"Big box done properly: raised brand band, entrance canopy, trolley bay, goods-in dock.",build:An},{id:"off.retailbase",name:"Offices over retail",zone:"office",density:"high",variant:"sculpted",footprint:[2,3],height:32.6,brand:L.bank,sim:{jobs:180,powerKW:320,waterM3:30,garbagePerWeek:620,pollution:2,upkeep:210},note:"Curtain wall on a recessed retail base, spandrel band per floor, cornice, roof plant.",build:On},{id:"com.boutique",name:"Boutique block",zone:"commercial",density:"medium",variant:"sculpted",footprint:[2,2],height:15.6,brand:L.bookshop,sim:{jobs:20,powerKW:48,waterM3:5,garbagePerWeek:110,pollution:1,upkeep:44},note:"Narrow three-storey with stacked bay windows, heavy cornice and a fire escape.",build:Sn}];function Ln(d){const e=new T,h=d<1,p=d<2,c=11,l=7,o=4.2,n=-8,t=c/2;if(e.box([-t,0,n-l/2],[t,o,n+l/2],i.PLASTER,{roof:i.ROOF}),p){e.painted(x.BRAND,()=>we(e,-t,n-l/2,t,n+l/2,o-.9,1.2,.3)),M(e,-t+1,n-l/2+1,t-1,n+l/2-1,o+.3,81,.6);const r=15,s=10,a=5.6;e.box([-r/2,a,-s/2+2],[r/2,a+.5,s/2+2],i.CONCRETE),e.painted(x.BRAND,()=>we(e,-r/2,-s/2+2,r/2,s/2+2,a+.5,.85,.22)),e.painted(x.METAL_DARK,()=>{for(const f of[-r/2+1.6,r/2-1.6])for(const u of[-s/2+3.4,s/2+.6])e.box([f-.3,0,u-.3],[f+.3,a,u+.3],i.TRIM)});for(const f of[-3.4,3.4]){e.box([f-1.6,1e-4,-1.2],[f+1.6,.18,3.6],i.CONCRETE);for(const u of[0,2.4])e.box([f-.42,.18,u-.34],[f+.42,1.75,u+.34],i.PLASTER),e.painted(x.BRAND,()=>e.box([f-.46,1.5,u-.38],[f+.46,1.78,u+.38],i.TRIM)),e.painted(x.METAL_DARK,()=>e.box([f-.5,.9,u-.4],[f-.42,1.4,u+.4],i.TRIM))}ze(e,-t-2.6,6,9,2.4)}return h&&(S(e,{axis:"z",sign:1,plane:n+l/2},-t+.6,t-.6,{bays:3,doorBay:1,head:3.2}),N(e,{axis:"z",sign:1,plane:n+l/2},-3.2,3.2,o-.75,o-.05),q(e,{axis:"z",sign:1,plane:12},-4,4,6.4,7.4),F(e,{axis:"z",sign:1,plane:n+l/2},-t,t,1.2,5),e.painted(x.BRAND,()=>e.box([t-1.4,0,n+5],[t-.6,1.3,n+5.8],i.TRIM)),O(e,-t,t,n+l/2+1,81,{trees:2,planters:2,bollards:4,depth:1.8}),R(e,{axis:"x",sign:1,plane:t},n-l/2+1,n+l/2-1,{floors:1,floorH:3,base:1.6,count:2,width:1.1,height:1.5}),R(e,{axis:"x",sign:-1,plane:-t},n-l/2+1,n+l/2-1,{floors:1,floorH:3,base:1.6,count:2,width:1.1,height:1.5}),e.painted(x.METAL_DARK,()=>{e.box([-t+.6,0,n+5],[-t+1.4,1.1,n+5.8],i.TRIM);for(let r=0;r<3;r++)e.box([-t+2,r*.42,n+4.6],[-t+3.4,.4+r*.42,n+5.6],i.TRIM)})),e}function Cn(d){const e=new T,h=d<1,p=d<2,c=16,l=12,o=c/2,n=l/2,t=5.4;e.box([-o,0,-n],[o,t,n],i.PLASTER,{roof:i.ROOF});for(const r of[-1,1])e.box([r*o-r*1.2,0,n-.35],[r*o,t+.6,n+.45],i.CONCRETE);return p&&(v(e,-o,-n,o,n,t,1.1,.26),e.painted(x.BRAND,()=>e.box([-o+1.2,t,n-.2],[o-1.2,t+1.5,n+.5],i.TRIM)),M(e,-o+1.5,-n+1.5,o-1.5,n-1.5,t,91,1),e.box([-3.4,3.9,n],[3.4,4.3,n+2.2],i.CONCRETE)),h&&(S(e,{axis:"z",sign:1,plane:n},-o+1.4,o-1.4,{bays:5,doorBay:2,head:3.8}),N(e,{axis:"z",sign:1,plane:n+.45},-5,5,t+.25,t+1.25),e.painted(x.SIGN_LIT,()=>{e.box([o-3.4,3,n+.5],[o-1.6,3.6,n+.62],i.TRIM),e.box([o-2.85,2.45,n+.5],[o-2.15,4.15,n+.62],i.TRIM)}),R(e,{axis:"x",sign:1,plane:o},-n+1.2,n-1.2,{floors:1,floorH:3,base:2.2,count:3,width:1.1,height:1.5}),F(e,{axis:"z",sign:1,plane:n},-o+1,o-1,1.7,7),O(e,-o,o,n+.5,91,{trees:3,planters:3,bollards:7,depth:2.4}),R(e,{axis:"x",sign:-1,plane:-o},-n+1.2,n-1.2,{floors:1,floorH:3,base:2.2,count:3,width:1.1,height:1.5}),R(e,{axis:"z",sign:-1,plane:-n},-o+1.5,o-1.5,{floors:1,floorH:3,base:2.2,count:4,width:1.1,height:1.5}),Y(e,-o+.5,o-.5,n+2.6,0,.95,1.3)),e}ye.push({id:"com.gas",name:"Filling station",zone:"commercial",density:"low",variant:"sculpted",footprint:[3,3],height:9,brand:L.electronics,sim:{jobs:10,powerKW:60,waterM3:3,garbagePerWeek:90,pollution:9,upkeep:44},note:"Forecourt canopy on columns, two pump islands, kiosk with shopfront, pylon by the road.",build:Ln},{id:"com.pharmacy",name:"Pharmacy",zone:"commercial",density:"low",variant:"sculpted",footprint:[3,3],height:6.9,brand:L.pharmacy,sim:{jobs:14,powerKW:40,waterM3:4,garbagePerWeek:80,pollution:1,upkeep:30},note:"Single-storey unit between rendered pilasters, entrance canopy, lit cross.",build:Cn});function kn(d){const e=new T,h=d<1,p=d<2,c=15,l=12,o=c/2,n=l/2,t=4.6,r=3.6,s=t+r*2;if(e.box([-o,0,-n],[o,s,n],i.PLASTER,{roof:i.ROOF}),e.box([-o-.25,0,-n-.25],[o+.25,t,n+.25],i.CONCRETE),p&&(v(e,-o,-n,o,n,s,1.4,.4),E(e,-o,-n,o,n,t,.5,.35),E(e,-o,-n,o,n,s-1.5,.45,.3),e.box([-3.6,t+.4,n+.25],[3.6,t+1,n+2.7],i.CONCRETE,{roof:i.TRIM}),e.box([-3.9,t+1,n+.25],[3.9,t+1.35,n+2.9],i.CONCRETE,{roof:i.TRIM}),e.gable([-3.9,t+1.35,n+.25],[3.9,t+1.35,n+2.9],1.1,"z",i.ROOF,i.CONCRETE),M(e,-o+2,-n+2,o-2,n-2,s,401,.6)),h){for(const a of[-2.9,-1,1,2.9])e.cylinder(a,n+1.7,.34,0,t+.4,8,i.CONCRETE),e.box([a-.45,t+.4,n+1.25],[a+.45,t+.9,n+2.15],i.CONCRETE);z(e,{axis:"z",sign:1,plane:n+.25},0,{width:2.2,height:2.9,double:!0,fanlight:!0,steps:3});for(const a of[[-o+1.2,-4.2],[4.2,o-1.2]])e.windowRow({axis:"z",sign:1,plane:n+.25,from:a[0],to:a[1],y0:1.5,y1:3.9,count:2,width:1.5,glass:i.GLASS,frame:.14,proud:.05});for(const[a,f,u,g,b,m]of[["z",1,n,-o+1,o-1,5],["z",-1,-n,-o+1,o-1,5],["x",1,o,-n+1,n-1,4],["x",-1,-o,-n+1,n-1,4]])R(e,{axis:a,sign:f,plane:u},g,b,{floors:2,floorH:r,base:t+.9,count:m,width:1.3,height:2.2});q(e,{axis:"z",sign:1,plane:n+.25},-3.2,3.2,t+1.1,t+2.3),O(e,-o,o,n+2.5,403,{trees:2,planters:2,bollards:6,depth:2.4})}return e}function Nn(d){const e=new T,h=d<1,p=d<2,c=20,l=15,o=c/2,n=l/2,t=9.4;if(e.box([-o,0,-n],[o,t,n],i.METAL,{roof:i.ROOF}),e.painted(x.ACCENT,()=>e.box([o-2.2,0,-n-.3],[o+.3,t+1.8,n+.3],i.TRIM)),p){v(e,-o,-n,o,n,t,1,.28);for(const r of[3,5.4,7.8])E(e,-o,-n,o,n,r,.14,.1,i.METAL);e.box([-o,4.6,n],[o-3.2,5.2,n+1.6],i.CONCRETE),M(e,-o+2,-n+2,o-2,n-2,t,411,1.4)}return h&&(e.windowRow({axis:"z",sign:1,plane:n,from:-o+.8,to:o-3.6,y0:.7,y1:4.5,count:5,width:2.6,glass:i.SHOPFRONT,frame:.12,proud:.07}),e.windowRow({axis:"z",sign:1,plane:n,from:-o+.8,to:o-3.6,y0:5.4,y1:8.4,count:5,width:2.6,glass:i.GLASS,frame:.1,proud:.06}),R(e,{axis:"x",sign:-1,plane:-o},-n+1.2,n-1.2,{floors:2,floorH:3.6,base:1.4,count:4,width:1.4,height:2.4,sill:!1}),z(e,{axis:"z",sign:1,plane:n},-o+4,{width:2.4,height:2.9,double:!0,canopy:1.8}),N(e,{axis:"z",sign:1,plane:n},o-12,o-4,6.2,7.4),te(e,{axis:"x",sign:1,plane:o+.3},2,5,8.4,1.5),O(e,-o,o,n,413,{trees:3,planters:2,bollards:8})),e}function Pn(d){const e=new T,h=d<1,p=d<2,c=24,l=16,o=c/2,n=l/2,t=6.4,r=5;if(e.box([-o,0,-n],[o,t,n],i.BRICK),e.gable([-o,t,-n],[o,t,n],3.8,"x",i.ROOF,i.BRICK),e.box([-o-.25,0,-n-.25],[o+.25,1.1,n+.25],i.CONCRETE),p){E(e,-o,-n,o,n,t-.7,.5,.32);for(let s=0;s<=r;s++){const a=-o+s/r*c;for(const f of[-1,1])e.box([a-.55,0,f*n-.35],[a+.55,t-.05,f*n+.35],i.CONCRETE)}for(const s of[-1,1]){for(const a of[-1,1])e.box([s*o-s*.6,0,a*n-a*.6],[s*o+s*.3,t+.25,a*n+a*.3],i.CONCRETE);e.box([s*o-s*.25,0,-n+.6],[s*o+s*.25,t+.1,n-.6],i.CONCRETE)}M(e,-o+3,-n+4.5,o-3,n-4.5,t+2.6,421,.4)}if(h){for(const s of[1,-1]){const a=s*n;for(let f=0;f<r;f++){const u=-o+f/r*c+.75,g=-o+(f+1)/r*c-.75;e.opening({axis:"z",sign:s,plane:a,u0:u,u1:g,y0:1.4,y1:4,glass:i.SHOPFRONT,frame:.12,proud:.07}),e.opening({axis:"z",sign:s,plane:a,u0:u+.3,u1:g-.3,y0:4.5,y1:t-.9,glass:i.GLASS,frame:.1,proud:.06})}}for(const s of[-1,1])R(e,{axis:"x",sign:s,plane:s*o},-n+1.4,n-1.4,{floors:1,floorH:3,base:1.8,count:3,width:1.6,height:2.6}),e.opening({axis:"x",sign:s,plane:s*o,u0:-1.4,u1:1.4,y0:t+.7,y1:t+2.4,glass:i.GLASS,frame:.14,proud:.06});z(e,{axis:"z",sign:1,plane:n},0,{width:3.2,height:3.6,double:!0,canopy:2.2,steps:2}),N(e,{axis:"z",sign:1,plane:n},-5,5,t-2.2,t-1);for(let s=0;s<4;s++){const a=-o+3+s*5.4,f=n+3.4;e.painted(x.AWNING,()=>e.box([a-1.6,2.4,f-1.3],[a+1.6,2.62,f+1.3],i.TRIM));for(const u of[a-1.45,a+1.45])for(const g of[f-1.15,f+1.15])e.box([u-.05,0,g-.05],[u+.05,2.4,g+.05],i.METAL);e.painted(x.WOOD,()=>e.box([a-1.5,.85,f-.5],[a+1.5,.95,f+.7],i.TRIM)),e.box([a-1.4,0,f-.45],[a+1.4,.85,f+.6],i.TRIM)}O(e,-o,o,n+4.8,423,{trees:3,planters:2,bollards:9,depth:2.2})}return e}ye.push({id:"com.bank",name:"Bank branch",zone:"commercial",density:"medium",variant:"sculpted",footprint:[2,3],height:11.8,brand:L.bank,sim:{jobs:22,powerKW:55,waterM3:5,garbagePerWeek:70,pollution:1,upkeep:52},note:"Stone base, columned portico over the door, small deep windows on two upper floors.",build:kn},{id:"com.gym",name:"Gym",zone:"commercial",density:"medium",variant:"sculpted",footprint:[3,3],height:11.2,brand:L.gym,sim:{jobs:18,powerKW:95,waterM3:22,garbagePerWeek:110,pollution:2,upkeep:46},note:"Clad box with a brand blade wall, double-height glazing to the street.",build:Nn},{id:"com.market",name:"Market hall",zone:"commercial",density:"medium",variant:"sculpted",footprint:[3,4],height:9.4,brand:L.grocer,sim:{jobs:40,powerKW:70,waterM3:18,garbagePerWeek:260,pollution:3,upkeep:58},note:"Brick hall under a pitched roof, tall arched openings between piers, stalls out on the pavement.",build:Pn});function Bn(d){const e=new T,h=d<1,p=d<2,c=26,l=22,o=c/2,n=l/2,t=13,r=8.4,s=5;if(e.box([-o,0,-n],[o,t,n-s],i.PLASTER,{roof:i.ROOF}),e.box([-o+1,0,n-s],[o-1,r,n],i.CONCRETE,{roof:i.ROOF}),p&&(v(e,-o,-n,o,n-s,t,1.4,.35),v(e,-o+1,n-s,o-1,n,r,1,.3),e.box([-4,t,-n+4],[4,t+3.2,n-s-4],i.PLASTER,{roof:i.ROOF}),e.painted(x.BRAND,()=>{e.box([-o+.6,r-2.6,n],[o-.6,r-1.9,n+3.2],i.TRIM)}),e.painted(x.SIGN_LIT,()=>{e.box([-o+.8,r-2.75,n+.2],[o-.8,r-2.6,n+3],i.TRIM)}),M(e,-o+2,-n+2,-4.6,n-s-2,t,701,.7)),h){for(let a=0;a<2;a++)e.windowRow({axis:"z",sign:1,plane:n,from:-o+2,to:-2.6,y0:.7+a*3.5,y1:3.4+a*3.5,count:3,width:2.4,glass:a===0?i.SHOPFRONT:i.GLASS,frame:.1,proud:.06}),e.windowRow({axis:"z",sign:1,plane:n,from:2.6,to:o-2,y0:.7+a*3.5,y1:3.4+a*3.5,count:3,width:2.4,glass:a===0?i.SHOPFRONT:i.GLASS,frame:.1,proud:.06});z(e,{axis:"z",sign:1,plane:n},0,{width:3.4,height:3,double:!0,glazed:!0}),N(e,{axis:"z",sign:1,plane:n},-6,6,r-1.7,r-.4);for(const a of[-4.6,4.6])e.painted(x.BRAND_DARK,()=>{e.box([a-.9,1,n+.02],[a+.9,3.4,n+.16],i.TRIM)}),e.opening({axis:"z",sign:1,plane:n+.16,u0:a-.75,u1:a+.75,y0:1.15,y1:3.25,glass:i.GLASS,frame:.07,proud:.05});te(e,{axis:"x",sign:1,plane:o},n-2.6,r-.5,t+2.4,1.6),O(e,-o,o,n+3.2,703,{trees:3,planters:2,bollards:9,depth:2.6})}return e}function Dn(d){const e=new T,h=d<1,p=d<2,c=22,l=15,o=5.4,n=8,t=3.15,r=o+n*t,s=c/2,a=l/2;if(e.box([-s,0,-a],[s,o,a],i.CONCRETE,{roof:i.TRIM}),e.box([-s+.8,o,-a+.6],[s-.8,r,a-.6],i.PLASTER,{roof:i.ROOF}),p){E(e,-s,-a,s,a,o,.8,.45);for(let f=1;f<=n;f++)E(e,-s+.8,-a+.6,s-.8,a-.6,o+f*t-.45,.45,.25);v(e,-s+.8,-a+.6,s-.8,a-.6,r,1.3,.34),e.box([-5.4,o-1.6,a],[5.4,o-1,a+5],i.CONCRETE),e.painted(x.METAL_DARK,()=>{for(const f of[-4.6,4.6])e.box([f-.28,0,a+3.9],[f+.28,o-1.6,a+4.5],i.TRIM)}),e.box([-s,.001,a],[s,.1,a+5.6],i.CONCRETE),M(e,-s+2,-a+2,s-2,a-2,r,711,1)}if(h){for(const[f,u,g,b,m]of[["z",1,a-.6,s-.8,6],["z",-1,-a+.6,s-.8,6],["x",1,s-.8,a-.6,4],["x",-1,-s+.8,a-.6,4]])R(e,{axis:f,sign:u,plane:g},-b+1,b-1,{floors:n,floorH:t,base:o+.9,count:m,width:1.6,height:1.9,sill:!1});for(const[f,u]of[[-s+1.2,-2.4],[2.4,s-1.2]])e.windowRow({axis:"z",sign:1,plane:a,from:f,to:u,y0:.6,y1:4.6,count:3,width:2.4,glass:i.SHOPFRONT,frame:.11,proud:.07});z(e,{axis:"z",sign:1,plane:a},0,{width:2.8,height:3.2,double:!0,glazed:!0}),q(e,{axis:"z",sign:1,plane:a},-3.6,3.6,o+.3,o+1.6),te(e,{axis:"x",sign:-1,plane:-s},3,o+1,o+6,1.4);for(const f of[-8,8])le(e,f,a+2.2,.9,.65);O(e,-s,s,a+5.6,713,{trees:3,planters:0,bollards:8,depth:2.2})}return e}ye.push({id:"com.cinema",name:"Cinema",zone:"commercial",density:"medium",variant:"sculpted",footprint:[4,5],height:16.2,brand:L.diner,sim:{jobs:26,powerKW:130,waterM3:12,garbagePerWeek:220,pollution:2,upkeep:74},note:"Blank auditorium behind a two-storey glazed foyer, lit marquee canopy, poster cases.",build:Bn},{id:"com.hotel",name:"Hotel",zone:"commercial",density:"high",variant:"sculpted",footprint:[3,4],height:34.5,brand:L.bank,sim:{jobs:55,powerKW:210,waterM3:90,garbagePerWeek:380,pollution:2,upkeep:130},note:"Banded bedroom floors over a glazed lobby, porte-cochere on columns, blade sign.",build:Dn});function pe(d,e,h,p,c){d.cylinder(e,h,p*1.06,0,1.1,14,i.TRIM),d.cylinder(e,h,p,1.1,c,16,i.METAL,!1),d.cone(e,h,p,p*.34,c,c+p*.8,16,i.METAL),d.cylinder(e,h,p*.34,c+p*.8,c+p*1.1,10,i.TRIM)}function Re(d,e,h,p,c){d.cylinder(e,h,p,0,c,12,i.TRIM,!1);for(let l=1;l<=3;l++){const o=l/4*c;d.cylinder(e,h,p*1.15,o,o+.5,12,i.METAL,!1)}}function Ae(d,e,h,p,c,l,o=3){d.painted(x.METAL_DARK,()=>{const n=Math.max(2,Math.round((h-e)/3.6));for(let t=0;t<=n;t++){const r=e+t/n*(h-e);d.box([r-.18,0,p],[r+.18,l,p+.36],i.TRIM),d.box([r-.18,0,c-.36],[r+.18,l,c],i.TRIM),d.box([r-.24,l,p-.1],[r+.24,l+.5,c+.1],i.TRIM)}});for(let n=0;n<o;n++){const t=p+(n+1)/(o+1)*(c-p);d.pipe([e,l+.5,t],[h,l+.5,t],.22,i.METAL)}}function ue(d,e,h,p,c,l=5.2){d.box([e,.001,p],[h,1.2,p+2.4],i.CONCRETE),d.painted(x.METAL_DARK,()=>{for(let o=0;o<c;o++){const n=e+(o+.5)/c*(h-e);d.box([n-1.7,1.2,p-.14],[n+1.7,l,p+.02],i.TRIM)}}),d.box([e-.4,l+.9,p],[h+.4,l+1.25,p+2.8],i.METAL)}function Gn(d){const e=new T,h=d<2,p=25,c=17,l=9.2,o=2.6,n=p/2,t=c/2,r=-1.5;if(e.box([-n,0,r-t],[n,l,r+t],i.SHED_WALL,{roof:i.TRIM}),e.gable([-n,l,r-t],[n,l,r+t],o,"x",i.METAL,i.SHED_WALL),h){e.box([-n-.45,l-.35,r-t-.45],[n+.45,l,r+t+.45],i.TRIM),e.box([-n,l+o-.18,r-.35],[n,l+o+.2,r+.35],i.TRIM),ue(e,-n+1.5,n-1.5,r+t,3,5),e.painted(x.METAL_DARK,()=>e.box([n-3.4,0,r+t-.05],[n-2.2,2.4,r+t+.14],i.TRIM));for(const s of[-9,-5,0,5,9])e.cylinder(s,r,.7,l+o-.4,l+o+1.3,10,i.METAL);H(e,-n,r+t+3.2,n,r+t+4.4);for(let s=0;s<6;s++){const a=-n+2.4+s*3.5;e.box([a,l+1,r-t+2],[a+2.2,l+1.35,r-1],i.GLASS),e.box([a,l+1,r+1],[a+2.2,l+1.35,r+t-2],i.GLASS)}for(let s=0;s<8;s++){const a=-n+2+s*3;e.box([a-.07,.002,r+t+4.6],[a+.07,.02,r+t+11],i.TRIM)}e.painted(x.METAL_DARK,()=>{for(let s=0;s<14;s++){const a=-n-1+s*2;e.box([a-.07,0,r+t+11.4],[a+.07,2.2,r+t+11.55],i.TRIM)}e.box([-n-1.1,2.05,r+t+11.4],[n+1.1,2.2,r+t+11.55],i.TRIM)}),R(e,{axis:"x",sign:-1,plane:-n},r-t+1.5,r+t-1.5,{floors:2,floorH:3,base:2,count:3,width:1.2,height:1.4}),R(e,{axis:"z",sign:1,plane:r+t},n-8,n-4,{floors:1,floorH:3,base:5.6,count:2,width:1.2,height:1.3}),C(e,-n-2,r+t+9,5.2,241),C(e,n+2,r+t+9,5,243)}return e}function Fn(d){const e=new T,h=d<1,p=d<2,c=18,l=12,o=6.4,n=c/2,t=l/2;return e.box([-n,0,-t],[-n+6,o-1.4,t],i.BRICK,{roof:i.ROOF}),e.box([-n+6,0,-t],[n,o,t],i.SHED_WALL,{roof:i.TRIM}),e.gable([-n+6,o,-t],[n,o,t],1.8,"x",i.METAL,i.SHED_WALL),p&&(v(e,-n,-t,-n+6,t,o-1.4,.6,.2),e.box([-n+5.6,o-.3,-t-.4],[n+.4,o,t+.4],i.TRIM),e.painted(x.METAL_DARK,()=>{for(let r=0;r<2;r++){const s=-n+8.6+r*5.4;e.box([s-2.1,0,t-.12],[s+2.1,4.4,t+.06],i.TRIM)}}),e.box([-n+6,5,t],[n,5.35,t+2],i.METAL),M(e,-n+7,-t+1.5,n-1.5,t-1.5,o+1.8,211,.5)),h&&(R(e,{axis:"z",sign:1,plane:t},-n+.6,-n+5.4,{floors:2,floorH:2.4,base:1.3,count:2,width:1.1,height:1.4}),z(e,{axis:"x",sign:-1,plane:-n},-.5,{width:1.05,steps:1,canopy:1.2}),O(e,-n,n,t,251,{trees:2,planters:1,bollards:5,depth:2.6}),R(e,{axis:"x",sign:-1,plane:-n},-t+1.2,t-1.2,{floors:2,floorH:2.4,base:1.3,count:2,width:1.1,height:1.4}),R(e,{axis:"z",sign:-1,plane:-t},-n+.8,-n+5.6,{floors:2,floorH:2.4,base:1.3,count:2,width:1.1,height:1.4}),e.painted(x.WOOD,()=>{for(let r=0;r<4;r++){const s=-n+4+r%2*2.6,a=t+3.4+Math.floor(r/2)*1.6;e.box([s,0,a],[s+1.9,1.1+r%3*.4,a+1.2],i.TRIM)}}),e.painted(x.METAL_DARK,()=>{for(let r=0;r<8;r++){const s=-n+r*2.6;e.box([s-.07,0,t+6.4],[s+.07,2.2,t+6.55],i.TRIM)}e.box([-n-.1,2.05,t+6.4],[n+.1,2.2,t+6.55],i.TRIM)})),e}function Hn(d){const e=new T,h=d<1,p=d<2,c=17,l=13,o=10.5,n=-re*2+c/2+1,t=.4,r=n-c/2,s=n+c/2,a=t-l/2,f=t+l/2;if(e.box([r,0,a],[s,o,f],i.METAL,{roof:i.ROOF}),p){const g=c/5,b=3.4;for(let m=0;m<5;m++){const w=r+m*g,y=w+g;e.quad([w,o,f],[y,o,f],[y,o+b,a],[w,o+b,a],i.METAL),e.quad([w,o,a],[w,o+b,a],[y,o+b,a],[y,o,a],i.GLASS),e.tri([w,o,f],[w,o+b,a],[w,o,a],i.METAL),e.tri([y,o,f],[y,o,a],[y,o+b,a],i.METAL)}e.box([s-5,0,a-5.6],[s+3.2,17.5,a+.4],i.METAL,{roof:i.ROOF}),E(e,s-5,a-5.6,s+3.2,a+.4,17.5,.8,.3),pe(e,7,-4,2.5,15),pe(e,7,2.6,2,12),pe(e,12.4,-1.2,1.6,9.5),Re(e,13.2,-7.6,1.15,23),ue(e,r+1,s-1,f,2,5.6),e.box([r-.4,0,f-6.4],[r+4.6,4,f-1.4],i.BRICK,{roof:i.ROOF}),v(e,r-.4,f-6.4,r+4.6,f-1.4,4,.45,.3)}if(h){for(const[u,g]of[[1,f],[-1,a]])e.windowRow({axis:"z",sign:u,plane:g,from:r+1.2,to:s-1.2,y0:6.8,y1:8.6,count:5,width:2.1,glass:i.GLASS,frame:.09,proud:.06});R(e,{axis:"x",sign:-1,plane:r-.4},f-5.8,f-2,{floors:1,floorH:3,base:1.2,count:3,width:.9,height:1.5}),Ae(e,1,14,-6.6,-1,6.4),e.pipe([7,6.9,-4],[7,14,-4],.2,i.METAL),e.painted(x.METAL_DARK,()=>{for(let u=0;u<14;u++){const g=1+u*1.15;e.box([s+3.2,g,a-5.2+u*.32],[s+4.6,g+.12,a-4.6+u*.32],i.TRIM)}e.box([s+3.1,.8,a-5.4],[s+3.3,17.4,a-.6],i.TRIM),e.box([s+4.5,.8,a-5.4],[s+4.7,17.4,a-.6],i.TRIM);for(let u=0;u<12;u++){const g=u/12*Math.PI*2;e.box([7+Math.cos(g)*2.7-.06,15,-4+Math.sin(g)*2.7-.06],[7+Math.cos(g)*2.7+.06,16.1,-4+Math.sin(g)*2.7+.06],i.TRIM)}}),e.cylinder(7,-4,2.76,15,15.12,14,i.TRIM,!1);for(let u=0;u<3;u++)e.cylinder(r+3.4+u*4.6,t+3,.6,o+3.4,o+4.7,10,i.METAL)}return e}function _n(d){const e=new T,h=d<1,p=d<2,c=[[-8,-4,4.6,11],[2,-4.5,5.4,13],[-7,6,3.6,8.5],[3.5,6.5,3,7]];for(const[l,o,n,t]of c)e.cylinder(l,o,n,0,t,18,i.METAL,!1),e.cone(l,o,n,n*.15,t,t+n*.22,18,i.METAL),E(e,l-n,o-n,l+n,o+n,0,.6,.08);if(p){e.box([-13.5,.001,-10],[9.5,1.5,11.5],i.CONCRETE),e.box([-13,.4,-9.5],[9,1.6,11],i.CONCRETE);for(const[l,o,n,t]of c)e.painted(x.METAL_DARK,()=>{for(let r=0;r<22;r++){const s=r/22*Math.PI*1.7,a=.6+r/22*(t-.9);e.box([l+Math.cos(s)*n-.5,a,o+Math.sin(s)*n-.5],[l+Math.cos(s)*n+.5,a+.1,o+Math.sin(s)*n+.5],i.TRIM)}});e.box([11.5,0,-8],[17,4.6,-1],i.BRICK,{roof:i.ROOF}),v(e,11.5,-8,17,-1,4.6,.5,.24),Re(e,15.5,4,.9,16)}if(h){Ae(e,-12,16,12,15,5.4,4);for(const[l,o,n,t]of c)e.pipe([l,t*.5,o+n],[l,t*.5,13.5],.24,i.METAL),e.pipe([l,t*.5,13.5],[l,5.9,13.5],.24,i.METAL);R(e,{axis:"z",sign:-1,plane:-8},12.2,16.3,{floors:1,floorH:3,base:1.4,count:2,width:1,height:1.4}),e.painted(x.METAL_DARK,()=>{for(let l=0;l<6;l++)e.box([-13+l*3.8,0,12.6],[-11.8+l*3.8,1.1,13.8],i.TRIM)})}return e}function Kn(d){const e=new T,h=d<1,p=d<2,c=26,l=16,o=15,n=c/2,t=l/2;if(e.box([-n,0,-t],[n,o,t],i.SHED_WALL,{roof:i.TRIM}),e.gable([-n,o,-t],[n,o,t],3.2,"x",i.METAL,i.SHED_WALL),p&&(e.box([-n-.5,o-.4,-t-.5],[n+.5,o,t+.5],i.TRIM),e.box([-n+2,o+3.2,-2.2],[n-2,o+5,2.2],i.METAL,{roof:i.ROOF}),e.box([-n+1.8,o+5,-2.5],[n-1.8,o+5.4,2.5],i.TRIM),Re(e,n-3,-t-3.5,1.5,30),Re(e,n-7,-t-3.5,1.1,24),e.box([-n-7,0,-t+2],[-n,7,t-2],i.METAL,{roof:i.ROOF}),v(e,-n-7,-t+2,-n,t-2,7,.6,.25),ue(e,-n+3,n-3,t,3,6.5)),h){e.painted(x.METAL_DARK,()=>{for(const[r,s]of[[1,t],[-1,-t]])for(let a=0;a<9;a++){const f=-n+1.5+a*3.1;e.box([f-.2,9.5,s-r*.9],[f+.2,10.4,s],i.TRIM)}});for(const[r,s]of[[1,t],[-1,-t]])e.windowRow({axis:"z",sign:r,plane:s,from:-n+1.5,to:n-1.5,y0:11,y1:13.2,count:7,width:2.2,glass:i.GLASS,frame:.1,proud:.07});e.painted(x.METAL_DARK,()=>{e.box([-n-7,0,t-2.6],[-n-2,4.6,t-2.44],i.TRIM)}),Ae(e,-n-6,-n-1,-t+1,t-1,8,2)}return e}function Wn(d){const e=new T,h=d<1,p=d<2,c=6,l=7,o=3.6;for(let n=0;n<3;n++){const t=-14+n*(c+.4);e.box([t,0,-10],[t+c,o,-10+.5],i.CONCRETE),e.box([t,0,-10],[t+.5,o,-10+l],i.CONCRETE),e.box([t+c-.5,0,-10],[t+c,o,-10+l],i.CONCRETE),p&&e.painted(n===1?x.WOOD:x.METAL_DARK,()=>{e.cone(t+c/2,-10+l*.55,2.4,.3,.001,2.6+n*.4,6,i.TRIM)})}return e.box([4,0,-6],[18,8,4],i.SHED_WALL,{roof:i.TRIM}),e.gable([4,8,-6],[18,8,4],2,"x",i.METAL,i.SHED_WALL),p&&(e.box([3.6,7.7,-6.4],[18.4,8,4.4],i.TRIM),e.painted(x.METAL_DARK,()=>{e.box([-4,2,6],[4.5,2.9,7.4],i.TRIM),e.box([-4,2.9,6],[4.5,3.05,6.15],i.TRIM),e.box([-4,2.9,7.25],[4.5,3.05,7.4],i.TRIM);for(const n of[-3.4,0,3.6])e.box([n-.16,0,6.3],[n+.16,2,6.62],i.TRIM),e.box([n-.16,0,6.9],[n+.16,2,7.22],i.TRIM)}),e.box([-16,.001,4],[-6,.22,9],i.CONCRETE),e.box([-5.2,0,5.4],[-2.6,3.2,8],i.BRICK,{roof:i.ROOF}),v(e,-5.2,5.4,-2.6,8,3.2,.4,.22),M(e,5,-5,17,3,10,221,.6)),h&&(R(e,{axis:"z",sign:1,plane:8},-5,-2.8,{floors:1,floorH:3,base:1.3,count:1,width:1.6,height:1.3}),e.painted(x.METAL_DARK,()=>{e.box([4,0,3.88],[9,6,4.06],i.TRIM);for(let n=0;n<16;n++){const t=-17+n*2.3;e.box([t-.08,0,10.4],[t+.08,2.4,10.56],i.TRIM)}e.box([-17.2,2.2,10.4],[18.4,2.35,10.56],i.TRIM)}),C(e,-16.5,-8,5,231),C(e,18.5,8,4.6,233),O(e,-17,2,10.6,261,{trees:3,planters:2,bollards:6,depth:2.2}),e.painted(x.METAL_DARK,()=>{for(let n=0;n<3;n++){const t=-16+n*4.4;e.box([t,0,.5],[t+3.4,1.5,2.6],i.TRIM),e.box([t+.1,1.5,.6],[t+3.3,1.62,2.5],i.TRIM)}}),e.painted(x.WOOD,()=>{for(let n=0;n<6;n++)e.box([-16+n%3*1.9,Math.floor(n/3)*1.3,-4],[-14.4+n%3*1.9,1.2+Math.floor(n/3)*1.3,-2.2],i.TRIM)}),R(e,{axis:"z",sign:-1,plane:-6},5,17,{floors:1,floorH:3,base:5.2,count:4,width:1.3,height:1.4})),e}function Un(d){const e=new T,h=d<1,p=d<2,c=26,l=18,o=14.5,n=c/2,t=l/2,r=-1;if(e.box([-n,0,r-t],[n,o,r+t],i.SHED_WALL,{roof:i.TRIM}),p){for(let s=2.4;s<o-1;s+=2.4)E(e,-n,r-t,n,r+t,s,.1,.08,i.METAL);e.box([-n-.4,o-.5,r-t-.4],[n+.4,o,r+t+.4],i.TRIM),e.box([-n+2,o,r-5],[n-2,o+.35,r+3],i.CONCRETE);for(let s=0;s<5;s++){const a=-n+3.2+s*4.2;e.box([a,o+.35,r-4.2],[a+3,o+2.1,r+2],i.METAL),e.painted(x.METAL_DARK,()=>{e.box([a+.2,o+2.1,r-4],[a+2.8,o+2.3,r+1.8],i.TRIM)})}e.painted(x.METAL_DARK,()=>{e.box([-n+1.6,o+.35,r-5.2],[n-1.6,o+2.6,r-5.05],i.TRIM)}),ue(e,-n+2,n-6,r+t,4,5.4),M(e,-n+3,r+4,n-3,r+t-2,o,511,.5)}if(h){e.box([n-6.5,0,r+t-.2],[n,6.6,r+t+5.2],i.PLASTER,{roof:i.ROOF}),v(e,n-6.5,r+t-.2,n,r+t+5.2,6.6,.7,.2),R(e,{axis:"z",sign:1,plane:r+t+5.2},n-5.9,n-.6,{floors:2,floorH:3.2,base:1.3,count:3,width:1.3,height:1.7}),R(e,{axis:"x",sign:1,plane:n},r+t+.4,r+t+4.6,{floors:2,floorH:3.2,base:1.3,count:2,width:1.3,height:1.7}),z(e,{axis:"z",sign:1,plane:r+t+5.2},n-3.2,{width:1.8,height:2.4,double:!0,glazed:!0,canopy:1.6});for(const s of[-n+5,-n+11.5])e.box([s-1.3,1.15,r+t+2.6],[s+1.3,4.4,r+t+11],i.SHED_WALL),e.painted(x.METAL_DARK,()=>{e.box([s-1.2,.45,r+t+9.6],[s+1.2,1.15,r+t+10.6],i.TRIM);for(const a of[r+t+4,r+t+5.2])e.box([s-1.35,0,a],[s+1.35,.95,a+.5],i.TRIM)});H(e,-n,r+t+12,n,r+t+12.4)}return e}function qn(d){const e=new T,h=d<1,p=d<2,c=19,l=14;for(let t=0;t<3;t++){const r=-c+1.5+t*6.4;e.box([r,0,-l+1.5],[r+.5,3.4,-l+8.5],i.CONCRETE),e.box([r,0,-l+1.5],[r+5.9,3.4,-l+2],i.CONCRETE),p&&e.cone(r+3,-l+5.4,2.6,.2,.02,2.6+t*.3,10,i.GROUND)}e.box([c-6.5,0,-l+1.5],[c-.5,3.4,-l+2],i.CONCRETE);const o=5,n=2;if(e.painted(x.METAL_DARK,()=>{for(const t of[-3.2,3.2])for(const r of[-3,3])e.box([o+t-.22,0,n+r-.22],[o+t+.22,15.5,n+r+.22],i.TRIM)}),e.box([o-3.6,9,n-3.4],[o+3.6,15.5,n+3.4],i.METAL,{roof:i.TRIM}),e.cone(o,n,3.4,1.2,6.4,9,12,i.METAL),e.cylinder(o,n,1.2,4.6,6.4,10,i.METAL,!1),p&&(pe(e,o+7.6,n-1,2.2,14),pe(e,o+12.2,n-1,2.2,14),e.painted(x.METAL_DARK,()=>{e.pipe([-c+4,1.2,-l+5.4],[o-2.4,12.2,n-1],.75,i.TRIM),e.pipe([o+7.6,14.6,n-1],[o+1.6,15.8,n],.4,i.TRIM),e.pipe([o+12.2,14.6,n-1],[o+2,15.6,n+.6],.4,i.TRIM)}),e.box([o-4.4,.001,n-5],[o+4.4,.12,n+5],i.CONCRETE),v(e,o-3.6,n-3.4,o+3.6,n+3.4,15.5,.9,.25)),h){e.box([-c+1,.25,l-7.5],[-c+8,3.4,l-4],i.SHED_WALL,{roof:i.TRIM}),e.box([-c+.7,0,l-7.8],[-c+8.3,.25,l-3.7],i.CONCRETE),R(e,{axis:"z",sign:1,plane:l-4},-c+1.6,-c+7.4,{floors:1,floorH:3,base:1.35,count:3,width:1.1,height:1.3}),z(e,{axis:"x",sign:1,plane:-c+8},l-6.6,{width:1,height:2.1,steps:2}),e.box([2,.001,l-6],[12,.16,l-2.4],i.CONCRETE),e.painted(x.METAL_DARK,()=>{e.box([1.8,0,l-6.2],[2,1.1,l-2.2],i.TRIM),e.box([12,0,l-6.2],[12.2,1.1,l-2.2],i.TRIM)}),e.painted(x.METAL_DARK,()=>{for(const t of[9,12.2]){e.box([o-4,t,n-3.8],[o+4,t+.1,n+3.8],i.TRIM);for(let r=0;r<=8;r++){const s=o-4+r/8*8;e.box([s-.05,t,n+3.7],[s+.05,t+1.05,n+3.8],i.TRIM),e.box([s-.05,t,n-3.8],[s+.05,t+1.05,n-3.7],i.TRIM)}e.box([o-4,t+1,n+3.7],[o+4,t+1.08,n+3.8],i.TRIM),e.box([o-4,t+1,n-3.8],[o+4,t+1.08,n-3.7],i.TRIM)}for(let t=0;t<18;t++){const r=.6+t*.8;e.box([o-4.3,r,n-.35],[o-3.9,r+.07,n+.35],i.TRIM)}e.box([o-4.35,0,n-.42],[o-4.25,15.5,n-.32],i.TRIM),e.box([o-4.35,0,n+.32],[o-4.25,15.5,n+.42],i.TRIM)}),H(e,-c,l-.4,c,l);for(const t of[-c+3,c-3])C(e,t,l-1.6,4.6,t+90)}return e}function $n(d){const e=new T,h=d<1,p=d<2,c=30,l=14,o=8,n=c/2,t=l/2,r=-4,s=4;if(e.box([-n,0,r-t],[n,o,r+t],i.SHED_WALL,{roof:i.TRIM}),e.gable([-n,o,r-t],[n,o,r+t],2,"x",i.METAL,i.SHED_WALL),p){e.box([-n-.4,o-.3,r-t-.4],[n+.4,o,r+t+.4],i.TRIM);for(let a=0;a<=s;a++){const f=-n+a/s*c;e.box([f-.6,0,r+t-.1],[f+.6,o,r+t+.5],i.CONCRETE)}e.painted(x.METAL_DARK,()=>{for(let a=0;a<s;a++){const f=-n+a/s*c+.7,u=-n+(a+1)/s*c-.7;e.box([f,0,r+t-.02],[u,5.6,r+t+.14],i.TRIM);for(let g=1;g<6;g++)e.box([f,g*.92,r+t+.14],[u,g*.92+.09,r+t+.2],i.TRIM)}}),M(e,-n+3,r-t+2,n-3,r+t-2,o+2,521,.5)}if(h){e.box([-n,.001,r+t+.5],[n,.1,t],i.CONCRETE),e.box([-n+3,4.6,t-6.6],[-n+12,5,t-2],i.CONCRETE),e.painted(x.METAL_DARK,()=>{for(const a of[-n+4.2,-n+10.8])e.box([a-.2,0,t-4.6],[a+.2,4.6,t-4.2],i.TRIM);for(const a of[-n+5.6,-n+9.4])e.box([a-.5,.2,t-4.9],[a+.5,1.9,t-4.1],i.TRIM)}),e.box([-n+3.4,.1,t-5.2],[-n+11.6,.32,t-3.6],i.CONCRETE),e.box([n-9,0,r-t],[n,7.2,r-t+8],i.PLASTER,{roof:i.ROOF}),v(e,n-9,r-t,n,r-t+8,7.2,.8,.22);for(const[a,f,u,g,b,m]of[["x",1,n,r-t+.7,r-t+7.3,3],["z",-1,r-t,n-8.4,n-.6,4]])R(e,{axis:a,sign:f,plane:u},g,b,{floors:2,floorH:3.3,base:1.2,count:m,width:1.3,height:1.8});z(e,{axis:"x",sign:1,plane:n},r-t+4,{width:1.6,height:2.4,double:!0,glazed:!0,canopy:1.5}),H(e,-n,t-.4,n,t)}return e}function Vn(d){const e=new T,h=d<1,p=d<2,c=19,l=15,o=15,n=12,t=8.5,r=-c+o/2+1.5,s=-l+n/2+1.5;if(e.box([r-o/2,0,s-n/2],[r+o/2,t,s+n/2],i.SHED_WALL,{roof:i.TRIM}),e.gable([r-o/2,t,s-n/2],[r+o/2,t,s+n/2],2.2,"x",i.METAL,i.SHED_WALL),p){e.cylinder(r+o/2+2.2,s,1.5,0,9.5,12,i.METAL,!1),e.cone(r+o/2+2.2,s,1.5,.5,9.5,12.5,12,i.METAL),e.cylinder(r+o/2+2.2,s,.5,12.5,13.4,8,i.TRIM),e.painted(x.METAL_DARK,()=>{e.pipe([r+o/2,7.4,s],[r+o/2+2.2,8.6,s],.55,i.TRIM)}),e.box([r-o/2-.35,t-.3,s-n/2-.35],[r+o/2+.35,t,s+n/2+.35],i.TRIM);for(let a=0;a<2;a++){const f=l-11+a*5.6;e.box([-c+2,5,f],[c-2,5.4,f+4.4],i.METAL),e.painted(x.METAL_DARK,()=>{for(let u=0;u<=5;u++){const g=-c+2.4+u/5*(2*c-5.2);e.box([g-.16,0,f+.3],[g+.16,5,f+.62],i.TRIM),e.box([g-.16,0,f+3.8],[g+.16,5,f+4.12],i.TRIM)}})}}if(h){for(let a=0;a<2;a++){const f=l-10.6+a*5.6;for(let u=0;u<5;u++){const g=-c+3.4+u*6.6;e.painted(x.WOOD,()=>{for(let b=0;b<4;b++)e.box([g,.2+b*1.05,f+.4],[g+5.2,1.1+b*1.05,f+3.4],i.TRIM)})}}for(let a=0;a<3;a++){const f=.55+a*.95,u=a*.55;for(let g=0;g<4-a;g++)e.painted(x.WOOD,()=>{e.pipe([r+o/2+5,f,-l+2.4+u+g*1.1],[r+o/2+12.5,f,-l+2.4+u+g*1.1],.5,i.TRIM)})}R(e,{axis:"z",sign:1,plane:s+n/2},r-o/2+1,r+o/2-1,{floors:1,floorH:3,base:5.2,count:5,width:1.4,height:1.6}),z(e,{axis:"z",sign:1,plane:s+n/2},r-3,{width:1.2,height:2.3,canopy:1.3}),e.painted(x.METAL_DARK,()=>{e.box([r+1,0,s+n/2-.02],[r+6.4,5.2,s+n/2+.14],i.TRIM)}),H(e,-c,l-.4,c,l)}return e}function jn(d){const e=new T,h=d<1,p=d<2,c=30,l=20,o=c/2,n=l/2,t=10,r=7.4,s=6;if(e.box([-o,0,-n],[o,t,n-s],i.SHED_WALL,{roof:i.TRIM}),e.box([-o+1.5,0,n-s],[o-1.5,r,n],i.PLASTER,{roof:i.ROOF}),p){e.box([-o-.4,t-.4,-n-.4],[o+.4,t,n-s+.4],i.TRIM),v(e,-o+1.5,n-s,o-1.5,n,r,.9,.26);for(let a=0;a<3;a++){const f=-o+5+a*8;e.box([f,t,-n+2.5],[f+5,t+1.8,n-s-2.5],i.METAL),e.box([f-.3,t+1.8,-n+2.2],[f+5.3,t+2.05,n-s-2.2],i.TRIM)}E(e,-o+1.5,n-s,o-1.5,n,r-3.7,.3,.18),M(e,-o+2,-n+1.5,o-2,-n+4,t,531,.7),ue(e,-o+2,-o+11,-n,2,5.2)}if(h){for(let a=0;a<2;a++)e.windowRow({axis:"z",sign:1,plane:n,from:-o+2.4,to:o-2.4,y0:1+a*3.7,y1:3.3+a*3.7,count:7,width:2.6,glass:a===0?i.SHOPFRONT:i.GLASS,frame:.1,proud:.06});for(const a of[-1,1])e.opening({axis:"x",sign:a,plane:a*o,u0:-n+2,u1:n-s-2,y0:6.4,y1:8.4,glass:i.GLASS,frame:.12,proud:.06});for(let a=0;a<3;a++){const f=-o+5+a*8;for(const u of[1,-1])e.opening({axis:"z",sign:u,plane:u===1?n-s-2.5:-n+2.5,u0:f+.4,u1:f+4.6,y0:t+.35,y1:t+1.6,glass:i.GLASS,frame:.1,proud:.06})}z(e,{axis:"z",sign:1,plane:n},0,{width:3,height:3,double:!0,glazed:!0,canopy:2.6}),O(e,-o+1.5,o-1.5,n,533,{trees:4,planters:2,bollards:8,depth:2.6})}return e}const G=(d,e,h)=>({jobs:d,powerKW:d*3.2,waterM3:d*.2,garbagePerWeek:d*7.5,pollution:e,upkeep:h}),Yn=[{id:"ind.shed",name:"Distribution shed",zone:"industrial",density:"none",variant:"sculpted",footprint:[4,5],height:13.1,sim:G(40,8,90),note:"Shed, three shutters, canopy and loading apron. Corrugation is shader.",build:Gn},{id:"ind.workshop",name:"Workshop unit",zone:"industrial",density:"none",variant:"sculpted",footprint:[3,4],height:9.5,sim:G(18,5,44),note:"Brick office end against a metal workshop, two roller doors, canopy.",build:Fn},{id:"ind.plant",name:"Processing plant",zone:"industrial",density:"none",variant:"sculpted",footprint:[4,3],height:23,sim:G(40,14,105),note:"Sawtooth shed, process block, three silos, banded stack, pipe rack, dock.",build:Hn},{id:"ind.tanks",name:"Tank farm",zone:"industrial",density:"none",variant:"sculpted",footprint:[5,4],height:16,sim:G(12,18,80),note:"Four tanks in a bund with spiral stairs, pump house, stack, pipe rack.",build:_n},{id:"ind.foundry",name:"Heavy works",zone:"industrial",density:"none",variant:"sculpted",footprint:[5,4],height:32,sim:G(60,22,150),note:"One tall bay with a crane rail and roof monitor, two stacks, annexe, dock.",build:Kn},{id:"ind.cold",name:"Cold store",zone:"industrial",density:"none",variant:"sculpted",footprint:[4,6],height:16.9,sim:G(30,6,110),note:"Insulated box, condenser deck on the roof, four dock seals, trailers on the apron.",build:Un},{id:"ind.batching",name:"Batching plant",zone:"industrial",density:"none",variant:"sculpted",footprint:[5,4],height:16.4,sim:G(16,16,85),note:"Aggregate bays, hopper tower on a frame, two cement silos, conveyor, weighbridge.",build:qn},{id:"ind.depot",name:"Vehicle depot",zone:"industrial",density:"none",variant:"sculpted",footprint:[4,4],height:10,sim:G(34,9,95),note:"Four-bay maintenance shed with roller doors, fuel island, two-storey office.",build:$n},{id:"ind.timber",name:"Timber yard",zone:"industrial",density:"none",variant:"sculpted",footprint:[5,4],height:13.4,sim:G(26,11,78),note:"Sawmill with a cyclone, open drying sheds, stacked boards and a log deck.",build:Vn},{id:"ind.assembly",name:"Assembly plant",zone:"industrial",density:"none",variant:"sculpted",footprint:[4,4],height:12.1,sim:G(70,4,130),note:"Glazed office frontage, production hall with roof monitors, two loading bays.",build:jn},{id:"ind.recycling",name:"Recycling yard",zone:"industrial",density:"none",variant:"sculpted",footprint:[5,4],height:10,sim:G(24,12,70),note:"Open yard: storage bays with heaps, sorting shed, conveyor, weighbridge.",build:Wn}];function Xn(d){const e=new T,h=d<1,p=d<2,c=22,l=13,o=c/2,n=l/2,t=2,r=3.8,s=t*r;e.box([-o,0,-n],[o,s,n],i.PLASTER,{roof:i.ROOF});for(const a of[-1,1])e.box([a*o-a*4,0,-n-.3],[a*o,s+.9,n+.3],i.BRICK,{roof:i.ROOF});if(p&&(v(e,-o,-n,o,n,s,.8,.22),E(e,-o+4,-n,o-4,n,r-.35,.35,.16),e.box([-2.8,0,n],[2.8,4.4,n+2.2],i.GLASS,{roof:i.TRIM}),e.box([-3,4.4,n-.2],[3,4.9,n+2.4],i.CONCRETE),M(e,-o+5,-n+1.5,o-5,n-1.5,s,301,1)),h){for(const[a,f,u,g,b,m]of[["z",1,n,-o+4.6,o-4.6,5],["z",-1,-n,-o+4.6,o-4.6,5],["x",1,o,-n+1,n-1,3],["x",-1,-o,-n+1,n-1,3]])R(e,{axis:a,sign:f,plane:u},g,b,{floors:t,floorH:r,base:1.1,count:m,width:1.9,height:2});z(e,{axis:"z",sign:1,plane:n+2.2},0,{width:2,double:!0,canopy:1.4}),N(e,{axis:"z",sign:1,plane:n+.3},-o+4.6,-o+10,4.9,5.7),O(e,-o,o,n+2.4,303,{trees:3,planters:2,bollards:6,depth:2.6});for(let a=0;a<6;a++){const f=-n+1.5+a*2.4;e.box([o+.6,.002,f],[o+5.6,.02,f+.08],i.TRIM)}H(e,o+.4,-n,o+.6,n)}return e}function Zn(d){const e=new T,h=d<1,p=d<2,c=re*2-1,l=re*2-2,o=c/2,n=l/2,t=5.2,r=6,s=3.7,a=t+r*s;if(e.box([-o,0,-n],[o,t,n],i.CONCRETE,{roof:i.TRIM}),e.box([-o,t,-n],[o,a,n],i.PLASTER,{roof:i.ROOF}),p){for(let f=1;f<=r;f++)E(e,-o,-n,o,n,t+f*s-.55,.55,.2);v(e,-o,-n,o,n,a,1.2,.3),e.box([-o-1,t-.9,-n-1],[o+1,t-.5,n+1],i.CONCRETE),M(e,-o+1.5,-n+1.5,o-1.5,n-1.5,a,311,1.2)}if(h){for(const[f,u,g,b,m]of[["z",1,n,o,4],["z",-1,-n,o,4],["x",1,o,n,3],["x",-1,-o,n,3]])R(e,{axis:f,sign:u,plane:g},-b+.8,b-.8,{floors:r,floorH:s,base:t+.9,count:m,width:2,height:2.3,sill:!1});for(const[f,u,g,b]of[["z",1,n,o],["x",1,o,n]])e.windowRow({axis:f,sign:u,plane:g,from:-b+.9,to:b-.9,y0:.6,y1:4.4,count:4,width:2.4,glass:i.SHOPFRONT,frame:.1,proud:.07});z(e,{axis:"z",sign:1,plane:n},0,{width:2.4,double:!0,canopy:2}),q(e,{axis:"z",sign:1,plane:n},-2.2,2.2,t+.5,t+1.5),O(e,-o,o,n,313,{trees:3,planters:3,bollards:7})}return e}function Jn(d){const e=new T,h=d<1,p=d<2,c=13,l=11,o=6.5,n=11,t=3.9,r=o+n*t,s=c*.72,a=l*.72;if(e.box([-c,0,-l],[c,o,l],i.CONCRETE,{roof:i.ROOF}),e.box([-s,o,-a],[s,r,a],i.GLASS,{roof:i.ROOF}),p){E(e,-c,-l,c,l,o,1,.4);for(const f of[-1,1])e.box([f*s-f*2.2,o,-a-.6],[f*s+f*.6,r+2.6,a+.6],i.CONCRETE,{roof:i.ROOF});for(let f=1;f<=n;f++)E(e,-s,-a,s,a,o+f*t-.4,.4,.16);v(e,-s,-a,s,a,r,1.4,.35),M(e,-s+2,-a+2,s-2,a-2,r,321,.9),e.box([-c,.001,l],[c,.12,l+6],i.CONCRETE),e.box([-c,.12,l+5.4],[c,.75,l+6],i.CONCRETE)}if(h){for(let f=0;f<n;f++){const u=o+f*t+.55;for(const[g,b,m,w]of[["z",1,a,s],["z",-1,-a,s],["x",1,s,a],["x",-1,-s,a]])e.opening({axis:g,sign:b,plane:m,u0:-w+.7,u1:w-.7,y0:u,y1:u+t-1.25,glass:i.GLASS,frame:.08,proud:.05})}for(const f of[-1,1]){const u=f*s-f*1.1;for(let g=0;g<n;g++){const b=o+g*t+.7;e.opening({axis:"z",sign:1,plane:a+.6,u0:u-.5,u1:u+.5,y0:b,y1:b+2.1,glass:i.GLASS,frame:.1,proud:.05}),e.opening({axis:"x",sign:f,plane:f*(s+.6),u0:-a+1,u1:a-1,y0:b+.2,y1:b+1.9,glass:i.GLASS,frame:.1,proud:.05})}}e.windowRow({axis:"z",sign:1,plane:l,from:-c+1.2,to:c-1.2,y0:.8,y1:5.6,count:5,width:3.2,glass:i.SHOPFRONT,frame:.12,proud:.08}),z(e,{axis:"z",sign:1,plane:l},0,{width:3.2,height:3.2,double:!0,canopy:3}),q(e,{axis:"z",sign:1,plane:l},-3.4,3.4,o+.2,o+1.3);for(const f of[-8,8])le(e,f,l+3,1.1,.7);for(const f of[-4,4])C(e,f,l+3.2,6.4,f+40);Y(e,-c,c,l+6,.12,1,1.6)}return e}function Qn(d){const e=new T,h=d<1,p=d<2,c=11.5,l=10.5,o=8,n=24,t=3.75,r=o+n*t;if(e.box([-c,0,-l],[c,o,l],i.CONCRETE,{roof:i.ROOF}),e.box([-c*.88,o,-l*.88],[c*.88,r,l*.88],i.GLASS,{roof:i.ROOF}),p){E(e,-c,-l,c,l,o,1.1,.45);for(const s of[-1,1])for(const a of[-1,1])e.box([s*c*.88-s*.35,o,a*l*.88-a*.35],[s*c*.88+s*.3,r+2,a*l*.88+a*.3],i.CONCRETE);v(e,-c*.88,-l*.88,c*.88,l*.88,r,1.6,.3),e.box([-c*.4,r+1.6,-l*.4],[c*.4,r+6,l*.4],i.METAL,{roof:i.ROOF}),e.box([-.22,r+6,-.22],[.22,r+14,.22],i.TRIM),M(e,-c*.6,-l*.6,c*.6,l*.6,r+1.6,331,.7)}if(h){for(let s=0;s<n;s++){const a=o+s*t+.5;for(const[f,u,g,b]of[["z",1,l*.88,c*.88],["z",-1,-l*.88,c*.88],["x",1,c*.88,l*.88],["x",-1,-c*.88,l*.88]])e.opening({axis:f,sign:u,plane:g,u0:-b+.6,u1:b-.6,y0:a,y1:a+t-1.2,glass:i.GLASS,frame:.07,proud:.05})}e.windowRow({axis:"z",sign:1,plane:l,from:-c+1,to:c-1,y0:.9,y1:7,count:5,width:3,glass:i.SHOPFRONT,frame:.12,proud:.08}),z(e,{axis:"z",sign:1,plane:l},0,{width:3.6,height:3.6,double:!0,canopy:3.4}),O(e,-c,c,l,333,{trees:4,planters:3,bollards:9,depth:3})}return e}function eo(d){const e=new T,h=d<1,p=d<2,c=18,l=12.5,o=c/2,n=l/2,t=4,r=4.1,s=t*r;if(e.box([-o,0,-n],[o,s,n],i.BRICK,{roof:i.ROOF}),p){E(e,-o,-n,o,n,s-.7,.7,.42),v(e,-o,-n,o,n,s,.9,.2);for(let a=1;a<t;a++)E(e,-o,-n,o,n,a*r-.25,.25,.14);e.box([-o+2.5,s,-n+2.5],[o-2.5,s+3.4,n-2.5],i.GLASS,{roof:i.ROOF}),v(e,-o+2.5,-n+2.5,o-2.5,n-2.5,s+3.4,.5,.25),M(e,-o+1,-n+1,-o+2.2,n-1,s,341,.8),e.box([-3.6,4.2,n],[3.6,4.6,n+2.4],i.METAL),e.painted(x.METAL_DARK,()=>{for(const a of[-3.2,3.2])e.box([a-.12,0,n+2.1],[a+.12,4.2,n+2.34],i.TRIM)})}if(h){for(const[a,f,u,g,b]of[["z",1,n,o,5],["z",-1,-n,o,5],["x",1,o,n,3],["x",-1,-o,n,3]])R(e,{axis:a,sign:f,plane:u},-g+.9,g-.9,{floors:t,floorH:r,base:1,count:b,width:2.1,height:2.6});z(e,{axis:"z",sign:1,plane:n},0,{width:2.6,height:3,double:!0}),N(e,{axis:"z",sign:1,plane:n},-5.5,-1.5,4.8,5.6),O(e,-o,o,n+2.4,343,{trees:3,planters:2,bollards:7}),e.painted(x.METAL_DARK,()=>{for(let a=1;a<t;a++){const f=a*r;e.box([-o-1.6,f,-2],[-o,f+.1,1.6],i.TRIM),e.box([-o-1.6,f+.1,-2],[-o-1.48,f+1,1.6],i.TRIM)}e.box([-o-1.55,0,-2],[-o-1.43,s,-1.88],i.TRIM),e.box([-o-1.55,0,1.48],[-o-1.43,s,1.6],i.TRIM)})}return e}const J=(d,e)=>({jobs:d,powerKW:d*1.9,waterM3:d*.14,garbagePerWeek:d*3.4,pollution:1,upkeep:e});function no(d){const e=new T,h=d<1,p=d<2,c=11,l=10,o=6.2,n=3.5,t=[[o,o+8*n,1],[o+8*n,o+14*n,.78],[o+14*n,o+18*n,.56]],r=t[2][1];e.box([-c,0,-l],[c,o,l],i.CONCRETE,{roof:i.TRIM});for(const[s,a,f]of t)e.box([-c*f,s,-l*f],[c*f,a,l*f],i.BRICK,{roof:i.ROOF});if(p){E(e,-c,-l,c,l,o,.7,.4);for(const[,s,a]of t)E(e,-c*a,-l*a,c*a,l*a,s,1,.42),v(e,-c*a,-l*a,c*a,l*a,s+1,.7,.2);for(const[s,a,f]of t){const u=Math.max(3,Math.round(c*f*2/2.6));for(let b=0;b<=u;b++){const m=-c*f+b/u*c*f*2;for(const w of[-1,1])e.box([m-.2,s,w*l*f],[m+.2,a,w*l*f+w*.3],i.CONCRETE)}const g=Math.max(3,Math.round(l*f*2/2.6));for(let b=0;b<=g;b++){const m=-l*f+b/g*l*f*2;for(const w of[-1,1])e.box([Math.min(w*c*f,w*c*f+w*.3),s,m-.2],[Math.max(w*c*f,w*c*f+w*.3),a,m+.2],i.CONCRETE)}}for(let s=0;s<3;s++){const a=.4-s*.1;e.box([-c*a,r+1.7+s*1.4,-l*a],[c*a,r+3.1+s*1.4,l*a],i.CONCRETE,{roof:i.ROOF})}e.box([-.18,r+7.3,-.18],[.18,r+13.5,.18],i.TRIM),M(e,-c*.5,-l*.5,c*.5,l*.5,r+1,341,.5)}if(h){for(const[s,a,f]of t){const u=Math.round((a-s)/n);for(let g=0;g<u;g++){const b=s+g*n+.75;for(const[m,w,y,A]of[["z",1,l*f,c*f],["z",-1,-l*f,c*f],["x",1,c*f,l*f],["x",-1,-c*f,l*f]])e.opening({axis:m,sign:w,plane:y,u0:-A+.6,u1:A-.6,y0:b,y1:b+2,glass:i.GLASS,frame:.1,proud:.05})}}e.box([-3.6,0,l],[3.6,o-.4,l+.5],i.CONCRETE,{roof:i.TRIM}),e.opening({axis:"z",sign:1,plane:l+.5,u0:-2.6,u1:2.6,y0:3.4,y1:o-.9,glass:i.GLASS,frame:.14,proud:.06}),z(e,{axis:"z",sign:1,plane:l+.5},0,{width:2.6,height:3,double:!0,steps:2}),e.windowRow({axis:"z",sign:1,plane:l,from:-c+1,to:-4.2,y0:1.2,y1:4.6,count:2,width:2,glass:i.SHOPFRONT,frame:.12,proud:.07}),e.windowRow({axis:"z",sign:1,plane:l,from:4.2,to:c-1,y0:1.2,y1:4.6,count:2,width:2,glass:i.SHOPFRONT,frame:.12,proud:.07}),q(e,{axis:"z",sign:1,plane:l+.5},-2.4,2.4,o-.85,o-.1),O(e,-c,c,l+.5,343,{trees:3,planters:2,bollards:8,depth:2.4})}return e}function oo(d){const e=new T,h=d<1,p=d<2,c=17,l=13,o=3,n=3.8,t=o*n,r=9;for(const s of[-1,1])e.box([Math.min(s*c,s*c-s*r),0,-l],[Math.max(s*c,s*c-s*r),t,l],i.GLASS,{roof:i.ROOF});if(e.box([-c+r,0,-l],[c-r,t,-l+7],i.PLASTER,{roof:i.ROOF}),p){for(const s of[-1,1]){const a=Math.min(s*c,s*c-s*r),f=Math.max(s*c,s*c-s*r);for(let u=1;u<=o;u++)E(e,a,-l,f,l,u*n-.5,.5,.28);v(e,a,-l,f,l,t,1,.3)}v(e,-c+r,-l,c-r,-l+7,t,1,.3),e.box([-c+r,n+.4,1.5],[c-r,n+3.6,5],i.GLASS,{roof:i.TRIM}),e.box([-c+r-.3,n+.1,1.2],[c-r+.3,n+.5,5.3],i.CONCRETE),M(e,-c+1.5,-l+1.5,-c+r-1.5,l-1.5,t,351,1),M(e,c-r+1.5,-l+1.5,c-1.5,l-1.5,t,353,1),e.painted(x.GREEN,()=>{e.box([-c+r+.5,.001,-l+7.5],[c-r-.5,.14,l-1],i.TRIM)})}if(h){for(const s of[-1,1]){const a=s*c,f=s*c-s*r;for(let u=0;u<o;u++){const g=u*n+.9;e.opening({axis:"x",sign:s,plane:a,u0:-l+.9,u1:l-.9,y0:g,y1:g+2.2,glass:i.GLASS,frame:.1,proud:.06}),e.opening({axis:"x",sign:-s,plane:f,u0:-l+7.6,u1:l-.9,y0:g,y1:g+2.2,glass:i.GLASS,frame:.1,proud:.06});for(const b of[1,-1])e.opening({axis:"z",sign:b,plane:b*l,u0:Math.min(a,f)+.9,u1:Math.max(a,f)-.9,y0:g,y1:g+2.2,glass:i.GLASS,frame:.1,proud:.06})}C(e,s*6,l-4,6.2,355+s),le(e,s*3,l-7.5,1.1,.6)}R(e,{axis:"z",sign:-1,plane:-l},-c+r+.8,c-r-.8,{floors:o,floorH:n,base:1.1,count:4,width:1.8,height:2,sill:!1});for(const s of[-1,1])z(e,{axis:"z",sign:1,plane:l},s*(c-r/2),{width:2.4,height:3,double:!0,glazed:!0,canopy:2.2});N(e,{axis:"z",sign:1,plane:l},-c+1.2,-c+7,t-1.6,t-.5),O(e,-c,c,l,357,{trees:2,planters:0,bollards:10,depth:2.4})}return e}const to=[{id:"off.park",name:"Business park unit",zone:"office",density:"low",variant:"sculpted",footprint:[4,3],height:8.5,brand:L.electronics,sim:J(45,70),note:"Two storeys with brick end bays, glazed entrance box, car park bays.",build:Xn},{id:"off.midrise",name:"Mid-rise offices",zone:"office",density:"medium",variant:"sculpted",footprint:[2,3],height:28,brand:L.bank,sim:J(160,190),note:"Expressed floor bands, glazed lobby, canopy over a double entrance.",build:Zn},{id:"off.hq",name:"Corporate headquarters",zone:"office",density:"high",variant:"sculpted",footprint:[4,5],height:51,brand:L.bank,sim:J(420,430),note:"Glass slab between two solid cores, podium, forecourt with planting.",build:Jn},{id:"off.tower",name:"Office tower",zone:"office",density:"high",variant:"sculpted",footprint:[3,4],height:112,brand:L.electronics,sim:J(900,820),note:"Full-height corner mullions, crown and mast, deep glazed base.",build:Qn},{id:"off.conversion",name:"Warehouse conversion",zone:"office",density:"medium",variant:"sculpted",footprint:[3,3],height:20,brand:L.bookshop,sim:J(110,130),note:"Old brick warehouse, tall industrial openings, glazed rooftop extension.",build:eo},{id:"off.deco",name:"Deco office tower",zone:"office",density:"high",variant:"sculpted",footprint:[3,4],height:87,brand:L.bank,sim:J(560,520),note:"Masonry tower in three setback stages, piers the full height, stepped crown and mast.",build:no},{id:"off.campus",name:"Tech campus",zone:"office",density:"low",variant:"sculpted",footprint:[5,4],height:12.4,brand:L.electronics,sim:J(180,210),note:"Two glazed wings around a planted court, linked by a first-floor bridge.",build:oo}],$=[...Tn,...ye,...to,...Yn];for(const d of $)d.height=Math.round(d.build(0).bounds().max[1]*10)/10;const Ie={residential:{label:"Residential",deep:"#1d4a2b",base:"#3f9a55",light:"#7fc98d",wash:"#c9e8cf",blurb:"Where people live, from detached houses to tower blocks."},commercial:{label:"Commercial",deep:"#123a63",base:"#2f7fc1",light:"#79b7e2",wash:"#c6e0f2",blurb:"Shops, food, fuel and services that need passing trade."},industrial:{label:"Industrial",deep:"#6b4a10",base:"#d09a2c",light:"#eac878",wash:"#f4e4bd",blurb:"Sheds, plants and yards. Jobs and goods, noise and pollution."},office:{label:"Office",deep:"#0f4a4c",base:"#2a9d9c",light:"#7ecfcd",wash:"#c8e9e8",blurb:"Desk work. Clean, dense, and hungry for transport rather than footfall."}},so={residential:be("residential",`
    <!-- garden strip and a tree, so the low-density read is immediate -->
    <path d="M6 38h36v4H6z" fill="{light}" opacity=".55"/>
    <path d="M11.5 38v-5" stroke="{deep}" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="11.5" cy="30" r="3.6" fill="{deep}" opacity=".85"/>
    <!-- terrace behind, main house in front: two depths in one silhouette -->
    <path d="M28 20h13v18H28z" fill="{deep}" opacity=".35"/>
    <path d="M28 20l6.5-5 6.5 5" fill="none" stroke="{deep}" stroke-width="2"
          stroke-linejoin="round" opacity=".45"/>
    <path d="M16 24h16v14H16z" fill="#fff"/>
    <path d="M14 24.5L24 16l10 8.5" fill="none" stroke="#fff" stroke-width="3"
          stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M19 28h4v4h-4zM26 28h4v4h-4z" fill="{deep}"/>
    <path d="M22.2 34h3.6v4h-3.6z" fill="{deep}" opacity=".7"/>
  `),commercial:be("commercial",`
    <path d="M6 38h36v4H6z" fill="{light}" opacity=".55"/>
    <!-- shopfront: fascia sign, striped awning, glazing, door -->
    <path d="M12 16h24v6H12z" fill="#fff"/>
    <path d="M15 18.2h13v1.7H15z" fill="{deep}" opacity=".8"/>
    <path d="M12 22h24v4H12z" fill="{deep}" opacity=".45"/>
    <path d="M14 22h3v4h-3zM20 22h3v4h-3zM26 22h3v4h-3zM32 22h3v4h-3z" fill="#fff" opacity=".9"/>
    <path d="M12 26h24v12H12z" fill="#fff" opacity=".92"/>
    <path d="M15 29h7v6h-7zM26 29h7v6h-7z" fill="{deep}"/>
    <path d="M22.6 29h2.8v9h-2.8z" fill="{deep}" opacity=".65"/>
    <!-- blade sign standing off the corner -->
    <path d="M36 17h5v8h-5z" fill="{deep}"/>
    <circle cx="38.5" cy="21" r="1.5" fill="{light}"/>
  `),industrial:be("industrial",`
    <path d="M6 38h36v4H6z" fill="{light}" opacity=".55"/>
    <!-- chimney with a puff of smoke -->
    <path d="M32 14h5v24h-5z" fill="#fff"/>
    <path d="M31 14h7v2.4h-7z" fill="{deep}" opacity=".6"/>
    <circle cx="36" cy="9.5" r="3" fill="#fff" opacity=".5"/>
    <circle cx="31.5" cy="7" r="2.2" fill="#fff" opacity=".32"/>
    <!-- sawtooth shed: the shape that says "works" faster than any other -->
    <path d="M8 38V26l6-6 0 6 6-6 0 6 6-6 0 18z" fill="#fff"/>
    <path d="M14 20v6M20 20v6M26 20v6" stroke="{deep}" stroke-width="1.4" opacity=".55"/>
    <path d="M11 30h5v8h-5z" fill="{deep}"/>
    <path d="M19 30h8v3h-8z" fill="{deep}" opacity=".6"/>
    <path d="M19 34.5h8v3.5h-8z" fill="{deep}" opacity=".85"/>
  `),office:be("office",`
    <path d="M6 38h36v4H6z" fill="{light}" opacity=".55"/>
    <!-- low block beside a tower: the density story in one glance -->
    <path d="M8 26h11v12H8z" fill="{deep}" opacity=".38"/>
    <path d="M10.5 29h2.5v2.5h-2.5zM14.5 29h2.5v2.5h-2.5zM10.5 33h2.5v2.5h-2.5zM14.5 33h2.5v2.5h-2.5z"
          fill="#fff" opacity=".55"/>
    <path d="M21 12h17v26H21z" fill="#fff"/>
    <path d="M21 12h17v3.2H21z" fill="{deep}" opacity=".55"/>
    <path d="M29.2 6h1.6v6h-1.6z" fill="{deep}"/>
    <path d="M24 18h4v3h-4zM31 18h4v3h-4zM24 23h4v3h-4zM31 23h4v3h-4zM24 28h4v3h-4zM31 28h4v3h-4z"
          fill="{deep}"/>
    <path d="M27.4 33h4.2v5h-4.2z" fill="{deep}" opacity=".7"/>
  `)};function be(d,e){const h=Ie[d],p=e.replace(/\{deep\}/g,h.deep).replace(/\{light\}/g,h.light).replace(/\{base\}/g,h.base);return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" role="img" aria-label="${h.label} zone">
  <defs>
    <linearGradient id="g-${d}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${h.light}"/>
      <stop offset="0.55" stop-color="${h.base}"/>
      <stop offset="1" stop-color="${h.deep}"/>
    </linearGradient>
    <clipPath id="c-${d}"><rect x="2" y="2" width="44" height="44" rx="10"/></clipPath>
  </defs>
  <rect x="2" y="2" width="44" height="44" rx="10" fill="url(#g-${d})"/>
  <g clip-path="url(#c-${d})">${p}</g>
  <rect x="2.6" y="2.6" width="42.8" height="42.8" rx="9.4" fill="none"
        stroke="${h.deep}" stroke-width="1.2" opacity=".75"/>
</svg>`}function Fe(d,e=20){return so[d].replace('width="48" height="48"',`width="${e}" height="${e}"`)}const io=`// Facade shading for procedural assets.
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
  /** Primary brand colour: fascia signs, awnings, painted trim. */
  brand       : vec4f,
  /** Secondary: stripes, doors, sign returns. */
  accent      : vec4f,
  /** The brand name, four characters packed per component, 16 max. */
  signText    : vec4u,
  /** x = character count. */
  signInfo    : vec4f,
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
const MAT_CONCRETE  = 11u;
const MAT_PLASTER   = 12u;
const MAT_PANE      = 13u;

struct VSOut {
  @builtin(position) pos      : vec4f,
  @location(0)       world    : vec3f,
  @location(1)       normal   : vec3f,
  @location(2)       ao       : f32,
  @location(3) @interpolate(flat) material : u32,
  @location(4) @interpolate(flat) tint     : u32,
  @location(5)       local    : vec2f,
};

@vertex
fn vs(@location(0) position : vec3f,
      @location(1) normal   : vec3f,
      @location(2) material : f32,
      @location(3) ao       : f32,
      @location(4) tint     : f32,
      @location(5) local    : vec2f) -> VSOut {
  var out : VSOut;
  out.world = position;
  out.normal = normal;
  out.ao = ao;
  out.material = u32(material + 0.5);
  out.tint = u32(tint + 0.5);
  out.local = local;
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

fn housing(uv : vec2f, mpp : f32, seed : f32, par : vec2f) -> vec3f {
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
  // The room behind the opening, mixed with what the pane reflects.
  let inside = room((p - centre + vec2f(0.72, 0.72)) / 1.44, par, r, r > 0.82);
  let glass = mix(glassColour(seed) * (0.9 + r * 0.5), inside, 0.72);

  var col = mix(wall, wall * 0.62, reveal);
  col = mix(col, glass, win);
  // Sill under each opening.
  col = mix(col, wall * 1.24, inRect(p, vec2f(bay * 0.5, 0.84), vec2f(0.88, 0.055), mpp));
  // Floor line, faint.
  col = mix(col, wall * 0.88, stripe(uv.y, floorH, 0.03, mpp) * 0.5);
  return mix(wall, col, resolvable(1.4, mpp));
}

fn curtainWall(uv : vec2f, mpp : f32, seed : f32, par : vec2f) -> vec3f {
  let floorH = 3.6;
  let mullion = 1.5;
  let glass = glassColour(seed);
  let spandrel = mix(renderColour(seed), vec3f(0.2), 0.35);

  let band = step(fract(uv.y / floorH), 0.26);
  let cell = vec2f(mullion, floorH);
  let id = floor(uv / cell);
  let r = hash21(id + seed * 1.7);

  // The office behind each pane, then the sky reflected off the front of it.
  // A curtain wall is both at once, which is why a flat blue box never looks
  // like one.
  let inside = room(vec2f(fract(uv.x / mullion), fract((uv.y - floorH * 0.26) / (floorH * 0.74))),
                    par, r, r > 0.72);
  var col = mix(mix(glass, inside, 0.62), spandrel, band);
  let sky = clamp((uv.y / max(floorH * 12.0, 1.0)) * 0.5 + 0.25, 0.0, 1.0);
  col = mix(col, glassColour(seed) * (1.4 + r * 0.6), sky * 0.42 * (1.0 - band));

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
fn houseWall(uv : vec2f, mpp : f32, seed : f32, par : vec2f) -> vec3f {
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

  let inside = room((p - centre + half) / (half * 2.0), par, r, r > 0.78);
  let glass = mix(glassColour(seed) * (0.85 + r * 0.4), inside, 0.74);

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

fn shopfront(uv : vec2f, mpp : f32, seed : f32, par : vec2f) -> vec3f {
  let bay = floor(uv.x / 2.6);
  let rr = hash11(bay * 1.31 + seed);
  // A shop interior is lit and full, which is what makes a street at dusk
  // read as open for business.
  let inside = room(vec2f(fract(uv.x / 2.6), clamp((uv.y - 0.55) / 2.6, 0.0, 1.0)), par, rr, true);
  let glass = mix(glassColour(seed) * 0.9, inside, 0.8);
  let stall = renderColour(seed) * 0.5;
  var col = mix(glass, stall, step(uv.y, 0.55));
  // Lit interiors and signage: shops are the brightest thing at street level
  // and the main reason a night city reads as inhabited.
  if (rr > 0.45) {
    col = mix(col, vec3f(0.62, 0.56, 0.42) * (0.5 + rr * 0.5), (1.0 - step(uv.y, 0.55)) * 0.28);
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

/**
 * What is behind the glass.
 *
 * Windows that are only a frame and a flat blue pane read as stickers. A room
 * costs nothing to draw: a back wall, a floor, a ceiling with a light on it,
 * a blind pulled down at a random height, and a block of furniture. The
 * parallax offset -- computed from the view direction in the fragment entry
 * point -- is what sells it, because the room shifts as the camera moves the
 * way a real recess does.
 */
fn room(local : vec2f, par : vec2f, r : f32, lit : bool) -> vec3f {
  // Shift the contents against the view, and keep them inside the opening.
  let p = clamp(local + par, vec2f(0.0), vec2f(1.0));

  // A room is mostly a dark box with a bright ceiling. Build it out of smooth
  // gradients rather than hard rectangles: the first version scattered
  // sharp-edged furniture at random positions and a whole facade of it read
  // as noise rather than as windows.
  let depthShade = mix(0.55, 1.0, smoothstep(0.0, 0.75, p.y));
  var col = vec3f(0.062, 0.060, 0.066) * (0.75 + r * 0.5) * depthShade;

  // Ceiling: the brightest thing in any room seen from outside.
  col = mix(col, vec3f(0.150, 0.148, 0.142), smoothstep(0.74, 0.99, p.y));
  // Floor, catching a little light near the window.
  col = mix(col, vec3f(0.086, 0.078, 0.070), smoothstep(0.26, 0.02, p.y));

  // One soft mass in the lower half -- furniture, a counter, a desk. Blurred
  // at the edges so it reads as something in shadow rather than as a sticker.
  let fx = 0.18 + fract(r * 7.3) * 0.5;
  let fw = 0.14 + fract(r * 3.1) * 0.2;
  let mass = smoothstep(fw + 0.09, fw - 0.02, abs(p.x - fx))
           * smoothstep(0.42, 0.30, p.y);
  col = mix(col, vec3f(0.070, 0.062, 0.058), mass * 0.85);

  if (lit) {
    // Warm light, brightest at the ceiling and falling off downwards.
    let glow = smoothstep(0.0, 0.95, p.y);
    col = mix(col, vec3f(0.58, 0.47, 0.31), 0.22 + glow * 0.5);
  }

  // A blind, pulled to a height that varies per opening. Drawn as a flat
  // panel: slats at this scale are a moire generator.
  let blind = fract(r * 11.7);
  if (fract(r * 2.9) > 0.5) {
    let edge = 1.0 - (0.28 + blind * 0.52);
    col = mix(col, vec3f(0.255, 0.248, 0.232) * (0.85 + r * 0.3),
              smoothstep(edge - 0.02, edge + 0.02, p.y) * 0.94);
  }
  return col;
}

fn concrete(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let base = vec3f(0.330, 0.334, 0.336);
  let r = hash21(floor(uv / vec2f(2.4, 1.2)) + seed);
  var col = base * (0.90 + r * 0.20);
  // Panel joints. Precast reads as panels or it reads as nothing.
  col = mix(col, base * 0.74, max(stripe(uv.x, 2.4, 0.022, mpp), stripe(uv.y, 1.2, 0.022, mpp))
                              * resolvable(1.2, mpp));
  return col;
}

fn plaster(uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let base = renderColour(seed) * 1.08;
  let r = hash21(floor(uv * 3.0) + seed) * 0.06;
  return base * (0.97 + r);
}

/**
 * Brand palette. A tint index paints a surface instead of patterning it, which
 * is how one shopfront generator makes a green grocer and a red diner.
 */
fn palette(i : u32, uv : vec2f, mpp : f32, seed : f32) -> vec3f {
  let brand = scene.brand.rgb;
  let accent = scene.accent.rgb;
  switch (i) {
    case 1u: { return brand; }
    case 2u: { return brand * 0.48; }
    case 3u: { return accent; }
    // Illuminated fascia: brighter than the paint and lifted towards white,
    // so a sign reads as lit rather than merely coloured.
    // Lifted only slightly towards white: pushed further it desaturates into
    // pink and the brand stops being readable, which is what the first attempt
    // did to every sign in the city.
    case 4u: { return mix(brand, vec3f(1.0), 0.16) * 1.18; }
    case 5u: { return accent * 0.55; }
    // Awning: alternating bands, the width of real canvas stripes.
    case 6u: {
      let band = step(0.5, fract(uv.x / 0.42));
      return mix(brand, mix(brand, vec3f(0.92), 0.75), band);
    }
    case 7u: { return vec3f(0.088, 0.092, 0.098); }
    case 8u: {
      let grain = hash21(vec2f(floor(uv.x * 8.0), floor(uv.y * 1.2)) + seed);
      return vec3f(0.238, 0.170, 0.108) * (0.88 + grain * 0.3);
    }
    case 9u: {
      let leaf = hash21(floor(uv * 5.0) + seed);
      return vec3f(0.118, 0.212, 0.108) * (0.75 + leaf * 0.6);
    }
    default: { return brand; }
  }
}

fn albedo(mat : u32, uv : vec2f, mpp : f32, seed : f32, par : vec2f) -> vec3f {
  switch (mat) {
    case 1u: { return housing(uv, mpp, seed, par); }
    case 2u: { return curtainWall(uv, mpp, seed, par); }
    case 3u: { return corrugated(uv, mpp, seed); }
    case 4u: { return brick(uv, mpp, seed); }
    case 5u: { return mix(renderColour(seed), vec3f(0.62), 0.55); }
    case 6u: { return shopfront(uv, mpp, seed, par); }
    case 7u: { return tiles(uv, mpp, seed); }
    case 8u: { return ground(uv, mpp); }
    case 9u: { return houseWall(uv, mpp, seed, par); }
    case 10u: { return shedWall(uv, mpp, seed); }
    case 11u: { return concrete(uv, mpp, seed); }
    case 12u: { return plaster(uv, mpp, seed); }
    // Handled in the fragment entry point, where the pane's own coordinates
    // are available. Never reached.
    case 13u: { return vec3f(0.0); }
    default: { return roofDeck(uv, mpp, seed); }
  }
}

// -------------------------------------------------------------------- text
//
// A 5x6 pixel font, one glyph per u32, bit = row * 5 + col. Signage without a
// name on it reads as a coloured panel; with one it reads as a business, and
// at city-builder distances five pixels of letter is plenty.

const GLYPHS = array<u32, 41>(
  589284910u, 521715247u, 1007715390u, 521717295u, 1041284159u, 34651199u,
  1025041470u, 588840497u, 1044517023u, 211034396u, 588553521u, 1041269793u,
  588830577u, 589092465u, 488162862u, 34651695u, 748340782u, 580042287u,
  520632382u, 138547359u, 488162865u, 145278513u, 599442993u, 581046609u,
  138547537u, 1041305887u, 490395438u, 474091716u, 1042424366u, 520632847u,
  301246856u, 520633407u, 488160302u, 69345823u, 488159790u, 487540270u,
  748329254u, 207618048u, 31744u, 132u, 0u,
);

/** Maps an ASCII code to an index into GLYPHS. 40 is the blank. */
fn glyphIndex(code : u32) -> u32 {
  if (code >= 65u && code <= 90u) { return code - 65u; }        // A-Z
  if (code >= 97u && code <= 122u) { return code - 97u; }       // a-z, folded
  if (code >= 48u && code <= 57u) { return code - 48u + 26u; }  // 0-9
  if (code == 38u) { return 36u; }                              // &
  if (code == 46u) { return 37u; }                              // .
  if (code == 45u) { return 38u; }                              // -
  if (code == 39u) { return 39u; }                              // '
  return 40u;
}

fn charAt(i : u32) -> u32 {
  let word = scene.signText[i / 4u];
  return (word >> ((i % 4u) * 8u)) & 255u;
}

/**
 * Draws the brand name across a sign face. \`p\` is 0..1 across the board.
 * Returns coverage, anti-aliased by the local derivative.
 */
fn signLabel(p : vec2f, count : u32, mpp : f32) -> f32 {
  if (count == 0u) { return 0.0; }
  // Letters occupy the middle 92% of the board.
  let cellW = 0.92 / f32(count);
  let x = (p.x - 0.04) / cellW;
  if (x < 0.0 || x >= f32(count)) { return 0.0; }

  let index = u32(x);
  let inCell = vec2f(fract(x), (p.y - 0.20) / 0.60);
  if (inCell.y < 0.0 || inCell.y > 1.0) { return 0.0; }

  // Glyph is 5 wide and 6 tall inside a 6-wide cell, giving a one-pixel gap.
  let col = i32(floor(inCell.x * 6.0));
  let row = i32(floor((1.0 - inCell.y) * 6.0));
  if (col < 0 || col > 4 || row < 0 || row > 5) { return 0.0; }

  let bits = GLYPHS[glyphIndex(charAt(index))];
  let on = (bits >> u32(row * 5 + col)) & 1u;

  // Fade out once a glyph pixel is smaller than a screen pixel. \`mpp\` is
  // measured in the fragment entry point, because fwidth may only be reached
  // in uniform control flow and this function is called inside a branch.
  let px = mpp * 6.0 / cellW;
  return f32(on) * (1.0 - smoothstep(1.0, 2.6, px));
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

  // Parallax for the interiors: the view direction expressed in the same two
  // axes the facade coordinate uses, divided by how square-on the surface is.
  var uDir = vec3f(1.0, 0.0, 0.0);
  var vDir = vec3f(0.0, 1.0, 0.0);
  if (abs(n.y) > 0.6) { vDir = vec3f(0.0, 0.0, 1.0); }
  else if (abs(n.x) > abs(n.z)) { uDir = vec3f(0.0, 0.0, 1.0); }
  // Derivative of the sign-face coordinate, taken here for the same reason:
  // uniform control flow.
  let localMpp = max(max(fwidth(in.local.x), fwidth(in.local.y)), 1e-5);
  let view = normalize(in.world - scene.eye.xyz);
  let facing = max(-dot(view, n), 0.12);
  let par = vec2f(dot(view, uDir), dot(view, vDir)) / facing * 0.26;
  // A tinted surface is painted, not patterned: the palette wins over the
  // material entirely.
  var col = select(albedo(in.material, uv, mpp, seed, par),
                   palette(in.tint, uv, mpp, seed),
                   in.tint != 0u);

  // A modelled window: one room mapped across the pane, using the pane's own
  // coordinates rather than a slice of a world-space grid.
  if (in.material == MAT_PANE) {
    let r = hash21(floor(vec2f(uv.x * 0.9, uv.y * 0.7)) + seed);
    let inside = room(in.local, par, r, r > 0.74);
    // What the pane reflects: sky, stronger the more glancing the view. This
    // is what makes glass read as glass rather than as a picture of a room.
    let grazing = 1.0 - clamp(dot(n, -view), 0.0, 1.0);
    let refl = glassColour(seed) * (1.5 + r * 0.4) + vec3f(0.05, 0.07, 0.10) * grazing;
    col = mix(inside, refl, 0.30 + 0.45 * grazing);
    // A transom bar across the pane, which almost every window has and which
    // gives the eye something to read the glass by.
    col = mix(col, vec3f(0.30, 0.30, 0.29),
              (1.0 - smoothstep(0.008, 0.022, abs(in.local.y - 0.62))) * 0.75);
  }

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
      || in.material == MAT_METAL || in.material == MAT_SHED
      || in.material == MAT_PANE) {
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
  var out = pow(col / (col + vec3f(0.72)) * 1.42, vec3f(0.9));

  // Lit signage bypasses all of it. Run through the tonemap, a saturated brand
  // colour loses its strongest channel fastest and every sign in the city
  // desaturates towards pink -- which is exactly what happened. A sign is its
  // own light source, so it gets its colour, lifted a little, and nothing else.
  if (in.tint == 4u) {
    // Scaled, not mixed towards white. Any lift towards white raises the weak
    // channels and a saturated red becomes salmon -- twice now.
    out = clamp(scene.brand.rgb * 1.35, vec3f(0.0), vec3f(1.0));
    // The business name, in the accent colour, on faces that carry sign
    // coordinates. Faces that do not have local = (0,0) and get nothing.
    let label = signLabel(in.local, u32(scene.signInfo.x + 0.5), localMpp);
    out = mix(out, clamp(scene.accent.rgb * 1.5, vec3f(0.0), vec3f(1.0)), label);
  }
  return vec4f(out, 1.0);
}

@fragment
fn fs_wire() -> @location(0) vec4f {
  return vec4f(0.38, 0.83, 1.0, 1.0);
}
`,xe="depth24plus",Me="depth24plus",Ee=1024,Ne=240,ae=(()=>{const d=[.48,.68,.38],e=Math.hypot(...d);return[d[0]/e,d[1]/e,d[2]/e]})();class ao{constructor(e,h=!0){this.gpu=e,this.shadows=h,this.buildPipelines(),this.buildGround(),this.resizeDepth(),e.onResize(()=>this.resizeDepth()),this.hookInput()}pipeline;wirePipeline;shadowPipeline;shadowBindGroup;sceneBuffer;bindGroup;depth=null;depthView;shadowView;ground;current=null;alive=!0;shadows=!0;dummyShadow=null;debug={frames:0,indices:0,height:0,radius:0,distance:0,error:""};yaw=Math.PI*.75;pitch=.36;distance=30;spin=!0;wireframe=!1;lod=0;asset=$[0];view=ie();proj=ie();viewProj=ie();sunView=ie();sunProj=ie();sunViewProj=ie();sceneData=new Float32Array(Ne/4);groundRadius=60;buildPipelines(){const{device:e,format:h}=this.gpu,p=e.createShaderModule({label:"asset",code:io}),c=e.createTexture({label:"shadow-map",size:{width:Ee,height:Ee},format:Me,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});this.shadowView=c.createView();const l=e.createTexture({label:"shadow-off",size:{width:1,height:1},format:Me,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});this.dummyShadow=l.createView();const o=e.createCommandEncoder();o.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:this.dummyShadow,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}}).end(),e.queue.submit([o.finish()]);const n=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"depth"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"comparison"}}]}),t=e.createPipelineLayout({bindGroupLayouts:[n]}),r=[{arrayStride:V*4,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32"},{shaderLocation:3,offset:28,format:"float32"},{shaderLocation:4,offset:32,format:"float32"},{shaderLocation:5,offset:36,format:"float32x2"}]}];this.pipeline=e.createRenderPipeline({label:"asset-solid",layout:t,vertex:{module:p,entryPoint:"vs",buffers:r},fragment:{module:p,entryPoint:"fs",targets:[{format:h}]},primitive:{topology:"triangle-list",cullMode:"back",frontFace:"ccw"},depthStencil:{format:xe,depthWriteEnabled:!0,depthCompare:"less"}}),this.wirePipeline=e.createRenderPipeline({label:"asset-wire",layout:t,vertex:{module:p,entryPoint:"vs",buffers:r},fragment:{module:p,entryPoint:"fs_wire",targets:[{format:h}]},primitive:{topology:"line-list"},depthStencil:{format:xe,depthWriteEnabled:!1,depthCompare:"less-equal"}});const s=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}}]}),a=e.createPipelineLayout({bindGroupLayouts:[s]});this.shadowPipeline=e.createRenderPipeline({label:"asset-shadow",layout:a,vertex:{module:p,entryPoint:"vs_shadow",buffers:r},primitive:{topology:"triangle-list",cullMode:"front",frontFace:"ccw"},depthStencil:{format:Me,depthWriteEnabled:!0,depthCompare:"less"}}),this.sceneBuffer=e.createBuffer({size:Ne,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.shadowBindGroup=e.createBindGroup({layout:s,entries:[{binding:0,resource:{buffer:this.sceneBuffer}}]}),this.bindGroup=e.createBindGroup({layout:n,entries:[{binding:0,resource:{buffer:this.sceneBuffer}},{binding:1,resource:this.shadows?this.shadowView:this.dummyShadow??this.shadowView},{binding:2,resource:e.createSampler({compare:"less"})}]})}buildGround(){const{device:e}=this.gpu,h=400,p=new Float32Array([-h,0,-h,0,1,0,8,1,0,0,0,h,0,-h,0,1,0,8,1,0,0,0,h,0,h,0,1,0,8,1,0,0,0,-h,0,h,0,1,0,8,1,0,0,0]),c=new Uint32Array([0,2,1,0,3,2]),l=e.createBuffer({size:p.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(l,0,p);const o=e.createBuffer({size:c.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(o,0,c),this.ground={vertices:l,indices:o,count:c.length}}resizeDepth(){const e=this.gpu.viewport;this.depth?.destroy(),this.depth=this.gpu.device.createTexture({size:{width:e.width,height:e.height},format:xe,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.depthView=this.depth.createView()}hookInput(){const e=this.gpu.canvas;let h=!1,p=0,c=0;e.addEventListener("pointerdown",l=>{h=!0,p=l.clientX,c=l.clientY,e.setPointerCapture(l.pointerId),this.spin=!1,document.getElementById("spin")?.classList.remove("on")}),e.addEventListener("pointerup",l=>{h=!1,e.hasPointerCapture(l.pointerId)&&e.releasePointerCapture(l.pointerId)}),e.addEventListener("pointermove",l=>{h&&(this.yaw-=(l.clientX-p)*.007,this.pitch=Se(this.pitch+(l.clientY-c)*.005,-.15,1.35),p=l.clientX,c=l.clientY)}),e.addEventListener("wheel",l=>{l.preventDefault(),this.distance=Se(this.distance*Math.exp(l.deltaY*.0012),4,400)},{passive:!1})}select(e,h=this.lod){this.asset=e,this.lod=h;const p=e.build(h).build(),{device:c}=this.gpu;this.current?.vertices.destroy(),this.current?.indices.destroy(),this.current?.edges.destroy();const l=c.createBuffer({size:Math.max(p.vertices.byteLength,4),usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});c.queue.writeBuffer(l,0,p.vertices);const o=c.createBuffer({size:Math.max(p.indices.byteLength,4),usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});c.queue.writeBuffer(o,0,p.indices);const n=new Uint32Array(p.indices.length*2);for(let a=0;a<p.indices.length;a+=3){const f=p.indices[a],u=p.indices[a+1],g=p.indices[a+2],b=a*2;n[b]=f,n[b+1]=u,n[b+2]=u,n[b+3]=g,n[b+4]=g,n[b+5]=f}const t=c.createBuffer({size:Math.max(n.byteLength,4),usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});c.queue.writeBuffer(t,0,n);let r=0,s=1;for(let a=0;a<p.vertices.length;a+=V)r=Math.max(r,p.vertices[a+1]),s=Math.max(s,Math.hypot(p.vertices[a],p.vertices[a+2]));this.current={vertices:l,indices:o,indexCount:p.indices.length,edges:t,edgeCount:n.length,bounds:{height:r,radius:s},triangles:p.indices.length/3},this.distance=Math.max(r*1.5,s*3.4,12),this.groundRadius=Math.max(r,s)*4.5+20,fo(e,this.current.triangles,h),co(e.id)}setLod(e){this.select(this.asset,e)}toggleWire(){return this.wireframe=!this.wireframe,this.wireframe}toggleSpin(){return this.spin=!this.spin,this.spin}rebuild(){this.current=null,this.buildPipelines(),this.buildGround(),this.resizeDepth(),this.select(this.asset,this.lod),this.alive=!0}suspend(){this.alive=!1}frame(e){if(!this.alive)return;this.spin&&(this.yaw+=e*.4);const h=this.gpu.viewport;this.render(this.gpu.context.getCurrentTexture().createView(),this.depthView,h.width,h.height)}async capture(e,h){if(!this.alive)return"";const{device:p}=this.gpu,c=Math.ceil(e/64)*64,l=p.createTexture({size:{width:c,height:h},format:this.gpu.format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),o=p.createTexture({size:{width:c,height:h},format:xe,usage:GPUTextureUsage.RENDER_ATTACHMENT});this.render(l.createView(),o.createView(),c,h);const n=c*4,t=p.createBuffer({size:n*h,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),r=p.createCommandEncoder();r.copyTextureToBuffer({texture:l},{buffer:t,bytesPerRow:n},[c,h]),p.queue.submit([r.finish()]),await t.mapAsync(GPUMapMode.READ);const s=new Uint8ClampedArray(t.getMappedRange().slice(0));if(t.unmap(),t.destroy(),l.destroy(),o.destroy(),this.gpu.format.startsWith("bgra"))for(let u=0;u<s.length;u+=4){const g=s[u];s[u]=s[u+2],s[u+2]=g}const a=document.createElement("canvas");a.width=e,a.height=h;const f=a.getContext("2d");return f?(f.putImageData(new ImageData(s,c,h),0,0),a.toDataURL("image/png")):""}render(e,h,p,c){const l=this.current;if(!l||!this.alive)return;const{device:o}=this.gpu,n={width:p,height:c},t=[0,l.bounds.height*.45,0],r=Math.cos(this.pitch),s=[t[0]+this.distance*r*Math.sin(this.yaw),t[1]+this.distance*Math.sin(this.pitch)+l.bounds.height*.12,t[2]+this.distance*r*Math.cos(this.yaw)];Le(this.view,s,t,[0,1,0]),$e(this.proj,42*Math.PI/180,n.width/Math.max(n.height,1),.2,2e3),Ce(this.viewProj,this.proj,this.view);const a=Math.max(l.bounds.radius*1.7,l.bounds.height*.9,8),f=[0,l.bounds.height*.5,0],u=[f[0]+ae[0]*a*2.6,f[1]+ae[1]*a*2.6,f[2]+ae[2]*a*2.6];Le(this.sunView,u,f,[0,1,0]),Ve(this.sunProj,-a,a,-a,a,.5,a*6),Ce(this.sunViewProj,this.sunProj,this.sunView),this.sceneData.set(this.viewProj,0),this.sceneData.set(this.sunViewProj,16),this.sceneData.set([s[0],s[1],s[2],0],32),this.sceneData.set([ae[0],ae[1],ae[2],0],36),this.sceneData.set([this.asset.id.length*7.3+this.asset.id.charCodeAt(0),1/Ee,this.groundRadius,0],40);const g=this.asset.brand??Je;this.sceneData.set([g.colour[0],g.colour[1],g.colour[2],1],44),this.sceneData.set([g.accent[0],g.accent[1],g.accent[2],1],48);const b=(g.name||"").toUpperCase().slice(0,16),m=new Uint32Array(4);for(let A=0;A<b.length;A++)m[A>>2]|=(b.charCodeAt(A)&255)<<A%4*8;new Uint32Array(this.sceneData.buffer,208,4).set(m),this.sceneData.set([b.length,0,0,0],56),o.queue.writeBuffer(this.sceneBuffer,0,this.sceneData);const w=o.createCommandEncoder();if(this.shadows){const A=w.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:this.shadowView,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});A.setPipeline(this.shadowPipeline),A.setBindGroup(0,this.shadowBindGroup),A.setVertexBuffer(0,l.vertices),A.setIndexBuffer(l.indices,"uint32"),A.drawIndexed(l.indexCount),A.end()}const y=w.beginRenderPass({colorAttachments:[{view:e,clearValue:{r:.043,g:.055,b:.075,a:1},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:h,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});y.setBindGroup(0,this.bindGroup),y.setPipeline(this.pipeline),y.setVertexBuffer(0,this.ground.vertices),y.setIndexBuffer(this.ground.indices,"uint32"),y.drawIndexed(this.ground.count),y.setVertexBuffer(0,l.vertices),y.setIndexBuffer(l.indices,"uint32"),y.drawIndexed(l.indexCount),this.wireframe&&(y.setPipeline(this.wirePipeline),y.setVertexBuffer(0,l.vertices),y.setIndexBuffer(l.edges,"uint32"),y.drawIndexed(l.edgeCount)),y.end(),o.queue.submit([w.finish()]),this.debug.frames++,this.debug.indices=l.indexCount,this.debug.height=l.bounds.height,this.debug.radius=l.bounds.radius,this.debug.distance=this.distance}}const ro=[["residential · low","residential",d=>d.zone==="residential"&&d.density==="low"],["residential · medium","residential",d=>d.zone==="residential"&&d.density==="medium"],["residential · high","residential",d=>d.zone==="residential"&&d.density==="high"],["commercial","commercial",d=>d.zone==="commercial"],["office","office",d=>d.zone==="office"],["industrial","industrial",d=>d.zone==="industrial"]];function lo(){const d=document.getElementById("legend");d&&(d.innerHTML=Object.keys(Ie).map(e=>{const h=Ie[e];return`<div class="zone" title="${h.blurb}">${Fe(e,30)}<div><div class="zn">${h.label}</div><div class="zc">${h.base}</div></div></div>`}).join(""))}function co(d){for(const e of document.querySelectorAll(".item"))e.classList.toggle("on",e.dataset.id===d)}function fo(d,e,h){const p=document.getElementById("info");if(!p)return;const c=[0,1,2].map(n=>d.build(n).triangleCount),l=(n,t)=>`<div class="row"><span>${n}</span><b>${t}</b></div>`,o=d.sim;p.innerHTML=l("variant",d.variant)+l("footprint",`${d.footprint[0]}×${d.footprint[1]} cells · ${d.footprint[0]*8}×${d.footprint[1]*8} m`)+l("height",`${d.height.toFixed(1)} m`)+l(`triangles (LOD ${h})`,e.toLocaleString())+l("LOD ladder",c.map(n=>n.toLocaleString()).join(" → "))+(o.households?l("households",String(o.households)):"")+(o.jobs?l("jobs",String(o.jobs)):"")+l("power",`${o.powerKW} kW`)+l("upkeep",`${o.upkeep}/wk`)+`<div class="note">${d.note}</div>`}function ho(d){const e=document.getElementById("list");if(e)for(const[h,p,c]of ro){const l=$.filter(c);if(!l.length)continue;const o=document.createElement("div");o.className="group",o.innerHTML=`${Fe(p,16)}<span>${h} (${l.length})</span>`,e.appendChild(o);for(const n of l){const t=document.createElement("div");t.className="item",t.dataset.id=n.id,t.innerHTML=`<div class="n">${n.name}</div><div class="m">${n.variant} · ${n.build(0).triangleCount.toLocaleString()} tris</div>`,t.addEventListener("click",()=>d(n)),e.appendChild(t)}}}function K(d,e){const h=document.getElementById("stage")??document.body;let p=document.getElementById("fatal");p||(p=document.createElement("div"),p.id="fatal",h.appendChild(p)),p.innerHTML=`<div style="font-size:15px;margin-bottom:12px">${d}</div><div style="color:#5d6b80;font-size:11px;white-space:pre-wrap;max-width:60ch;text-align:left;line-height:1.7">${e.replace(/[<>&]/g,"")}</div><div style="color:#5d6b80;font-size:11px;margin-top:14px">press \` for the log</div>`,me.error("viewer",`${d} — ${e}`)}window.__viewerBooted=!0;async function po(){const d=document.getElementById("gpu-canvas");if(!(d instanceof HTMLCanvasElement))return;const e=document.getElementById("stage");e&&We(e),addEventListener("error",u=>K("Something broke",`${u.message} @ ${u.filename}:${u.lineno}`)),addEventListener("unhandledrejection",u=>K("Something broke",String(u.reason)));let h;try{h=await Ue.create(d)}catch(u){u instanceof qe?K("This browser has no usable WebGPU",`${u.kind}: ${u.message}

Chrome or Edge 113+, Safari 18+, or Firefox 141+ on Windows.`):K("Could not start the GPU",String(u));return}h.device.addEventListener("uncapturederror",u=>{K("The GPU rejected something",u.error.message)});const p=new URLSearchParams(location.search);h.device.pushErrorScope("validation");let c;try{c=new ao(h,!p.has("noshadow"))}catch(u){h.device.popErrorScope(),K("Could not build the render pipelines",String(u));return}const l=await h.device.popErrorScope();if(l){K("The GPU rejected a pipeline",l.message);return}let o=!1;h.onLost(async()=>{if(!o){o=!0,c.suspend();try{await h.recover(),c.rebuild(),me.info("viewer","device recovered")}catch(u){me.error("viewer",`recovery failed: ${String(u)}`)}o=!1}}),lo(),ho(u=>c.select(u));const n=p,t=$.find(u=>u.id===n.get("asset"))??$[0],r=Number(n.get("lod")??0);if(n.get("spin")==="0"&&c.toggleSpin(),n.get("hud")==="0"){for(const u of["side","bar","info","hint"])document.getElementById(u)?.remove();document.getElementById("app")?.style.setProperty("grid-template-columns","1fr")}try{c.select(t,r)}catch(u){K("Could not build that asset",String(u));return}Object.defineProperty(window,"viewer",{value:{show(u,g){const b=$.find(m=>m.id===u);return b?(c.select(b,g),!0):!1},ids:$.map(u=>u.id),capture:(u,g)=>c.capture(u,g),alive:()=>!o}});for(const u of document.querySelectorAll("[data-lod]"))u.addEventListener("click",()=>{for(const g of document.querySelectorAll("[data-lod]"))g.classList.remove("on");u.classList.add("on"),c.setLod(Number(u.dataset.lod))});document.getElementById("wire")?.addEventListener("click",u=>{u.currentTarget.classList.toggle("on",c.toggleWire())}),document.getElementById("spin")?.addEventListener("click",u=>{u.currentTarget.classList.toggle("on",c.toggleSpin())});let s=performance.now(),a=0;const f=u=>{const g=Math.min((u-s)/1e3,.1);s=u;try{c.frame(g),a++}catch(b){K("The render loop threw",String(b));return}requestAnimationFrame(f)};if(requestAnimationFrame(f),setTimeout(()=>{a===0&&K("Nothing rendered","The render loop never completed a frame.")},2500),n.get("hud")!=="0"){const u=document.createElement("div");u.style.cssText=["position:absolute","left:14px","bottom:34px","color:#5d6b80","font:11px/1.6 var(--mono)","pointer-events:none","white-space:pre"].join(";"),document.getElementById("stage")?.appendChild(u),setInterval(()=>{const g=c.debug,b=h.canvas;u.textContent=`frames ${g.frames}   tris ${g.indices/3|0}   size ${g.height.toFixed(1)}m r${g.radius.toFixed(1)}   cam ${g.distance.toFixed(0)}m
canvas ${b.width}x${b.height}   ${h.format}   shadows ${p.has("noshadow")?"off":"on"}`},400)}me.info("viewer",`${$.length} assets`)}po();
//# sourceMappingURL=asset-D-06XiFB.js.map
