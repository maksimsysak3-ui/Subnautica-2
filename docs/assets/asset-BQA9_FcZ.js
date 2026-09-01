import{h as Q,m as Ne,G as Ge,a as Fe,l as le,b as X,c as Me,d as Ee,p as _e,e as Ie,o as He}from"./m4-DvGWrzTh.js";const K=11,i={ROOF:0,GLASS:2,METAL:3,BRICK:4,TRIM:5,SHOPFRONT:6,TILE:7,SHED_WALL:10,CONCRETE:11,PLASTER:12,PANE:13},x={NONE:0,BRAND:1,BRAND_DARK:2,SIGN_LIT:4,DOOR:5,AWNING:6,METAL_DARK:7,WOOD:8,GREEN:9};class y{verts=[];idx=[];tint=x.NONE;painted(e,d){const u=this.tint;this.tint=e,d(),this.tint=u}get triangleCount(){return this.idx.length/3}get vertexCount(){return this.verts.length/K}tri(e,d,u,c){const a=d[0]-e[0],o=d[1]-e[1],n=d[2]-e[2],t=u[0]-e[0],r=u[1]-e[1],s=u[2]-e[2];let l=o*s-n*r,p=n*t-a*s,h=a*r-o*t;const g=Math.hypot(l,p,h)||1;l/=g,p/=g,h/=g;const b=this.vertexCount;for(const m of[e,d,u])this.verts.push(m[0],m[1],m[2],l,p,h,c,1,this.tint,0,0);this.idx.push(b,b+1,b+2)}quad(e,d,u,c,a){this.tri(e,d,u,a),this.tri(e,u,c,a)}box(e,d,u,c={}){const[a,o,n]=e,[t,r,s]=d,l=c.roof??u;this.quad([t,o,s],[t,o,n],[t,r,n],[t,r,s],u),this.quad([a,o,n],[a,o,s],[a,r,s],[a,r,n],u),this.quad([a,o,s],[t,o,s],[t,r,s],[a,r,s],u),this.quad([t,o,n],[a,o,n],[a,r,n],[t,r,n],u),this.quad([a,r,s],[t,r,s],[t,r,n],[a,r,n],l),c.skipBottom===!1&&this.quad([a,o,n],[t,o,n],[t,o,s],[a,o,s],u)}gable(e,d,u,c,a,o){const[n,t,r]=e,[s,,l]=d,p=t+u;if(c==="x"){const h=(r+l)/2;this.quad([n,t,l],[s,t,l],[s,p,h],[n,p,h],a),this.quad([s,t,r],[n,t,r],[n,p,h],[s,p,h],a),this.tri([s,t,l],[s,t,r],[s,p,h],o),this.tri([n,t,r],[n,t,l],[n,p,h],o)}else{const h=(n+s)/2;this.quad([s,t,l],[s,t,r],[h,p,r],[h,p,l],a),this.quad([n,t,r],[n,t,l],[h,p,l],[h,p,r],a),this.tri([n,t,l],[s,t,l],[h,p,l],o),this.tri([s,t,r],[n,t,r],[h,p,r],o)}}cylinder(e,d,u,c,a,o,n,t=!0){for(let r=0;r<o;r++){const s=r/o*Math.PI*2,l=(r+1)/o*Math.PI*2,p=[e+Math.cos(s)*u,c,d+Math.sin(s)*u],h=[e+Math.cos(l)*u,c,d+Math.sin(l)*u],g=[e+Math.cos(l)*u,a,d+Math.sin(l)*u],b=[e+Math.cos(s)*u,a,d+Math.sin(s)*u];this.quad(p,b,g,h,n),t&&this.tri([e,a,d],[e+Math.cos(l)*u,a,d+Math.sin(l)*u],[e+Math.cos(s)*u,a,d+Math.sin(s)*u],n)}}opening(e){const d=e.frame??.11,u=e.proud??.09,c=e.frameMat??i.TRIM,a=(r,s,l,p,h,g,b)=>{const m=e.plane+e.sign*Math.min(h,g),w=e.plane+e.sign*Math.max(h,g);e.axis==="x"?this.box([m,l,r],[w,p,s],b):this.box([r,l,m],[s,p,w],b)},o=e.glass===i.GLASS||e.glass===i.SHOPFRONT,n=o?i.PANE:e.glass,t=e.plane+e.sign*.012;if(e.axis==="x"){const r=[t,e.y0,e.u0],s=[t,e.y0,e.u1],l=[t,e.y1,e.u1],p=[t,e.y1,e.u0];e.sign>0?o?this.signFace(s,r,p,l,n):this.quad(s,r,p,l,n):o?this.signFace(r,s,l,p,n):this.quad(r,s,l,p,n)}else{const r=[e.u0,e.y0,t],s=[e.u1,e.y0,t],l=[e.u1,e.y1,t],p=[e.u0,e.y1,t];e.sign>0?o?this.signFace(r,s,l,p,n):this.quad(r,s,l,p,n):o?this.signFace(s,r,p,l,n):this.quad(s,r,p,l,n)}a(e.u0-d,e.u1+d,e.y1,e.y1+d,-.06,u,c),a(e.u0-d,e.u1+d,e.y0-d,e.y0,-.06,u,c),a(e.u0-d,e.u0,e.y0,e.y1,-.06,u,c),a(e.u1,e.u1+d,e.y0,e.y1,-.06,u,c)}windowRow(e){const d=e.to-e.from;for(let u=0;u<e.count;u++){const c=e.from+(u+.5)/e.count*d;this.opening({axis:e.axis,sign:e.sign,plane:e.plane,u0:c-e.width/2,u1:c+e.width/2,y0:e.y0,y1:e.y1,glass:e.glass,...e.frame!==void 0?{frame:e.frame}:{},...e.proud!==void 0?{proud:e.proud}:{}})}}cone(e,d,u,c,a,o,n,t){for(let r=0;r<n;r++){const s=r/n*Math.PI*2,l=(r+1)/n*Math.PI*2,p=[e+Math.cos(s)*u,a,d+Math.sin(s)*u],h=[e+Math.cos(l)*u,a,d+Math.sin(l)*u];c<.001?this.tri(h,p,[e,o,d],t):this.quad(p,[e+Math.cos(s)*c,o,d+Math.sin(s)*c],[e+Math.cos(l)*c,o,d+Math.sin(l)*c],h,t)}}pipe(e,d,u,c){this.box([Math.min(e[0],d[0])-u,Math.min(e[1],d[1])-u,Math.min(e[2],d[2])-u],[Math.max(e[0],d[0])+u,Math.max(e[1],d[1])+u,Math.max(e[2],d[2])+u],c,{skipBottom:!1})}signFace(e,d,u,c,a){const o=[[0,0],[1,0],[1,1],[0,1]],n=(t,r,s)=>{const l=[e,d,u,c],p=l[t],h=l[r],g=l[s],b=h[0]-p[0],m=h[1]-p[1],w=h[2]-p[2],v=g[0]-p[0],M=g[1]-p[1],z=g[2]-p[2];let C=m*z-w*M,D=w*v-b*z,k=b*M-m*v;const W=Math.hypot(C,D,k)||1;C/=W,D/=W,k/=W;const q=this.vertexCount;for(const ne of[t,r,s]){const te=l[ne];this.verts.push(te[0],te[1],te[2],C,D,k,a,1,this.tint,o[ne][0],o[ne][1])}this.idx.push(q,q+1,q+2)};n(0,1,2),n(0,2,3)}bounds(){const e=[1/0,1/0,1/0],d=[-1/0,-1/0,-1/0];for(let u=0;u<this.verts.length;u+=K)for(let c=0;c<3;c++){const a=this.verts[u+c];a<e[c]&&(e[c]=a),a>d[c]&&(d[c]=a)}return Number.isFinite(e[0])?{min:e,max:d}:{min:[0,0,0],max:[0,0,0]}}build(e={}){const d=new Float32Array(this.verts.length);d.set(this.verts);const u=new Uint32Array(this.idx.length);return u.set(this.idx),e.occlusion!==!1&&qe(d,u),{vertices:d,indices:u}}}const V=.34,ae=9,Ke=3.4,Ue=.7,ge=.62,Ae=(()=>{const f=[];for(let d=0;d<20;d++){const u=Math.sqrt((d+.5)/20),c=Math.sqrt(1-u*u),a=(d+.5)*Math.PI*(3-Math.sqrt(5));f.push([Math.cos(a)*c,u,Math.sin(a)*c])}return f})();function Le(f,e,d){return(f+512|e+512<<10|d+512<<20)>>>0}function We(f,e){const d=new Set,u=(c,a,o)=>{d.add(Le(Math.floor(c/V),Math.floor(a/V),Math.floor(o/V)))};for(let c=0;c<e.length;c+=3){const a=e[c]*K,o=e[c+1]*K,n=e[c+2]*K,t=f[a],r=f[a+1],s=f[a+2],l=f[o],p=f[o+1],h=f[o+2],g=f[n],b=f[n+1],m=f[n+2],w=Math.max(Math.hypot(l-t,p-r,h-s),Math.hypot(g-t,b-r,m-s),Math.hypot(g-l,b-p,m-h)),v=Math.min(48,Math.max(2,Math.ceil(w/V*1.6)));for(let M=0;M<=v;M++)for(let z=0;z<=v-M;z++){const C=M/v,D=z/v,k=1-C-D;u(t*k+l*C+g*D,r*k+p*C+b*D,s*k+h*C+m*D)}}return d}function qe(f,e){if(e.length===0)return;const d=We(f,e),u=Ke/ae;for(let c=0;c<f.length;c+=K){const a=f[c],o=f[c+1],n=f[c+2],t=f[c+3],r=f[c+4],s=f[c+5];let l=0,p=0,h=0;Math.abs(r)<.9?(l=-s,h=t):l=1;const g=Math.hypot(l,p,h)||1;l/=g,p/=g,h/=g;const b=r*h-s*p,m=s*l-t*h,w=t*p-r*l,v=a+t*ge,M=o+r*ge,z=n+s*ge;let C=0;for(const[k,W,q]of Ae){const ne=l*k+t*W+b*q,te=p*k+r*W+m*q,Be=h*k+s*W+w*q;for(let oe=1;oe<=ae;oe++){const he=oe*u,Pe=v+ne*he,Te=M+te*he,De=z+Be*he;if(Te<0){C+=1-(oe-1)/ae;break}if(d.has(Le(Math.floor(Pe/V),Math.floor(Te/V),Math.floor(De/V)))){C+=1-(oe-1)/ae;break}}}const D=1-Ue*(C/Ae.length);f[c+7]=Math.max(.08,Math.min(1,D))}}const Ve={name:"",colour:[.42,.44,.47],accent:[.3,.32,.35]},ce=8,G={burger:{name:"Ridgeway Burger",colour:[.62,.13,.11],accent:[.72,.55,.14],sign:"pylon"},coffee:{name:"Meridian Coffee",colour:[.12,.28,.2],accent:[.66,.58,.42],sign:"blade"},grocer:{name:"Vale Market",colour:[.16,.34,.22],accent:[.68,.62,.38],sign:"fascia"},pharmacy:{name:"Alder Pharmacy",colour:[.14,.3,.48],accent:[.7,.72,.74],sign:"box"},hardware:{name:"Keel & Sons",colour:[.52,.31,.1],accent:[.3,.3,.31],sign:"fascia"},diner:{name:"Route 9 Diner",colour:[.66,.2,.16],accent:[.72,.72,.7],sign:"blade"},bank:{name:"Harrow Trust",colour:[.16,.22,.36],accent:[.6,.52,.24],sign:"box"},bookshop:{name:"Pemberly Books",colour:[.3,.16,.28],accent:[.62,.56,.4],sign:"blade"},electronics:{name:"Cobalt Electric",colour:[.13,.34,.46],accent:[.66,.68,.7],sign:"fascia"}};function Oe(f,e,d,u,c,a,o){const n=f.plane+f.sign*Math.min(a,o),t=f.plane+f.sign*Math.max(a,o),r=Math.min(n,t),s=Math.max(n,t);return f.axis==="x"?[[r,u,e],[s,c,d]]:[[e,u,r],[d,c,s]]}function T(f,e,d,u,c,a,o,n,t){const[r,s]=Oe(e,d,u,c,a,o,n);f.box(r,s,t,{skipBottom:!1})}function Ce(f,e,d,u,c,a,o){const n=e.plane+e.sign*o;e.axis==="x"?e.sign>0?f.signFace([n,c,u],[n,c,d],[n,a,d],[n,a,u],i.TRIM):f.signFace([n,c,d],[n,c,u],[n,a,u],[n,a,d],i.TRIM):e.sign>0?f.signFace([d,c,n],[u,c,n],[u,a,n],[d,a,n],i.TRIM):f.signFace([u,c,n],[d,c,n],[d,a,n],[u,a,n],i.TRIM)}function E(f,e,d,u,c,a,o=.85,n=.18,t=i.TRIM){f.box([e-n,a,d-n],[u+n,a+o,c+n],t)}function de(f,e,d,u,c,a,o,n,t=i.TRIM){f.box([e-n,a,c],[u+n,a+o,c+n],t),f.box([e-n,a,d-n],[u+n,a+o,d],t),f.box([u,a,d-n],[u+n,a+o,c+n],t),f.box([e-n,a,d-n],[e,a+o,c+n],t)}function A(f,e,d,u,c,a,o,n,t=i.TRIM){f.box([e-n,a,d-n],[u+n,a+o,c+n],t)}function I(f,e,d,u,c,a,o,n=1){const t=u-e,r=c-d;if(t<3||r<3)return;const s=Math.min(3.2,t*.34),l=Math.min(2.6,r*.34);f.box([e+t*.12,a,d+r*.12],[e+t*.12+s,a+2.6,d+r*.12+l],i.CONCRETE,{roof:i.ROOF});const p=Math.max(1,Math.round(t*r/60*n));for(let h=0;h<p;h++){const g=Q(h,3,o),b=Q(h,7,o),m=Q(h,11,o),w=e+1.6+g*Math.max(.1,t-3.2),v=d+1.6+b*Math.max(.1,r-3.2);if(m<.42){const M=1.1+g*1.5,z=.9+b*1.1;f.box([w,a,v],[w+M,a+.85+m,v+z],i.METAL),f.box([w+.1,a+.85+m,v+.1],[w+M-.1,a+1.05+m,v+z-.1],i.TRIM)}else m<.72?f.cylinder(w,v,.34+g*.24,a,a+.7+b*.8,8,i.METAL):(f.box([w,a+.35,v],[w+1+g*3.5,a+.85,v+.55],i.METAL),f.box([w+.1,a,v+.1],[w+.35,a+.35,v+.35],i.TRIM))}if(a>18&&Q(1,1,o)>.45){const h=u-Math.min(4,t*.3),g=c-Math.min(4,r*.3);for(const[b,m]of[[0,0],[1.9,0],[0,1.9],[1.9,1.9]])f.box([h+b-.1,a,g+m-.1],[h+b+.1,a+1.8,g+m+.1],i.TRIM);f.cylinder(h+.95,g+.95,1.5,a+1.8,a+4.2,12,i.METAL),f.cone(h+.95,g+.95,1.5,.2,a+4.2,a+5.1,12,i.METAL)}}function S(f,e,d,u,c={}){const a=c.sill??.55,o=c.head??3.5,n=u-d,t=c.bays??Math.max(2,Math.round(n/2.6)),r=c.doorBay??Math.floor(t/2),s=c.fascia??.9;f.painted(x.BRAND_DARK,()=>T(f,e,d,u,0,a,0,.16,i.TRIM));for(let p=0;p<t;p++){const h=d+p/t*n+.09,g=d+(p+1)/t*n-.09;p===r?(T(f,e,h,g,0,o-.75,.01,.06,i.SHOPFRONT),f.painted(x.DOOR,()=>{T(f,e,h+.12,g-.12,0,2.25,.06,.13,i.TRIM),T(f,e,h-.06,h+.12,0,o-.75,0,.17,i.TRIM),T(f,e,g-.12,g+.06,0,o-.75,0,.17,i.TRIM)})):T(f,e,h,g,a,o-.75,.01,.06,i.SHOPFRONT),f.painted(x.BRAND_DARK,()=>T(f,e,g,g+.18,0,o-.7,0,.15,i.TRIM))}f.painted(x.BRAND_DARK,()=>T(f,e,d-.18,d,0,o-.7,0,.15,i.TRIM));const l=c.brandFascia===!1?x.NONE:x.BRAND;f.painted(l,()=>T(f,e,d-.22,u+.22,o-.75,o-.75+s,-.05,.24,i.TRIM))}function Y(f,e,d,u,c,a=1.5){f.painted(x.AWNING,()=>{for(let n=0;n<4;n++){const t=n/4*a,r=(n+1)/4*a,s=c-n/4*.55,l=c-(n+1)/4*.55;T(f,e,d,u,Math.min(s,l)-.06,Math.max(s,l),t,r,i.TRIM)}T(f,e,d,u,c-.85,c-.55,a-.08,a,i.TRIM)})}function B(f,e,d,u,c,a){f.painted(x.BRAND_DARK,()=>T(f,e,d-.1,u+.1,c-.08,a+.08,.02,.3,i.TRIM)),f.painted(x.SIGN_LIT,()=>{T(f,e,d,u,c,a,.28,.33,i.TRIM),Ce(f,e,d,u,c,a,.335)})}function ue(f,e,d,u,c,a=1.35){f.painted(x.METAL_DARK,()=>T(f,e,d-.06,d+.06,c-.12,c,.02,a,i.TRIM)),f.painted(x.SIGN_LIT,()=>{T(f,e,d-.055,d+.055,u,c-.1,a-.95,a-.06,i.TRIM);const o=e.plane+e.sign*(a-.95),n=e.plane+e.sign*(a-.06);e.axis==="z"?(f.signFace([d-.056,u,n],[d-.056,u,o],[d-.056,c-.1,o],[d-.056,c-.1,n],i.TRIM),f.signFace([d+.056,u,o],[d+.056,u,n],[d+.056,c-.1,n],[d+.056,c-.1,o],i.TRIM)):(f.signFace([o,u,d-.056],[n,u,d-.056],[n,c-.1,d-.056],[o,c-.1,d-.056],i.TRIM),f.signFace([n,u,d+.056],[o,u,d+.056],[o,c-.1,d+.056],[n,c-.1,d+.056],i.TRIM))}),f.painted(x.BRAND,()=>T(f,e,d-.09,d+.09,u-.08,u,a-1,a,i.TRIM))}function we(f,e,d,u,c=3){f.painted(x.METAL_DARK,()=>{f.box([e-.28,0,d-.28],[e+.28,u-2.4,d+.28],i.TRIM),f.box([e-.7,0,d-.7],[e+.7,.35,d+.7],i.CONCRETE)}),f.painted(x.BRAND,()=>{f.box([e-c/2,u-2.6,d-.34],[e+c/2,u,d+.34],i.TRIM)}),f.painted(x.SIGN_LIT,()=>{const a=e-c/2+.16,o=e+c/2-.16,n=u-2.4,t=u-.2;f.signFace([o,n,d-.42],[a,n,d-.42],[a,t,d-.42],[o,t,d-.42],i.TRIM),f.signFace([a,n,d+.42],[o,n,d+.42],[o,t,d+.42],[a,t,d+.42],i.TRIM)})}function pe(f,e,d,u,c,a){f.painted(x.SIGN_LIT,()=>{T(f,e,d,u,c,a,.02,.25,i.TRIM),Ce(f,e,d,u,c,a,.255)})}function R(f,e,d,u,c){const a=c.glass??i.GLASS;for(let o=0;o<c.floors;o++){const n=c.base+o*c.floorH;f.windowRow({axis:e.axis,sign:e.sign,plane:e.plane,from:d,to:u,y0:n,y1:n+c.height,count:c.count,width:c.width,glass:a,frame:.08,proud:.055}),c.sill!==!1&&T(f,e,d,u,n-.12,n-.02,-.02,.12,i.TRIM)}}function j(f,e,d,u,c){const a=c.depth??1.3,o=u-d;for(let n=0;n<c.floors;n++){const t=c.base+n*c.floorH;for(let r=0;r<c.bays;r++){const s=d+(r+.5)/c.bays*o,l=s-o/c.bays/2+.3,p=s+o/c.bays/2-.3;T(f,e,l,p,t,t+.16,0,a,i.CONCRETE),c.solid===!1?f.painted(x.METAL_DARK,()=>{T(f,e,l,p,t+.16,t+1.05,a-.08,a,i.TRIM),T(f,e,l,l+.08,t+.16,t+1.05,0,a,i.TRIM),T(f,e,p-.08,p,t+.16,t+1.05,0,a,i.TRIM)}):T(f,e,l,p,t+.16,t+1.05,a-.12,a,i.CONCRETE)}}}function ze(f,e,d,u,c,a,o=2.4){f.painted(x.METAL_DARK,()=>{for(let n=0;n<c;n++){const t=u+n*a;if(T(f,e,d,d+o,t,t+.1,.02,1.5,i.TRIM),T(f,e,d,d+o,t+.1,t+1,1.42,1.5,i.TRIM),T(f,e,d,d+.08,t+.1,t+1,.02,1.5,i.TRIM),T(f,e,d+o-.08,d+o,t+.1,t+1,.02,1.5,i.TRIM),n>0)for(let r=0;r<7;r++){const s=r/7,l=t-s*a+.1;T(f,e,d+.2+s*(o-1),d+.9+s*(o-1),l,l+.06,.5,1.2,i.TRIM)}}})}function je(f,e,d,u,c,a=.16,o=.3){for(let n=0;n<c;n++){const t=(c-n)*a;T(f,e,d,u,1e-4,t,n*o,(c-n)*o+o,i.CONCRETE)}}function P(f,e,d,u,c,a){f.painted(x.METAL_DARK,()=>{for(let o=0;o<a;o++){const n=d+(o+.5)/a*(u-d),[t,r]=Oe(e,n-.11,n+.11,0,.95,c-.11,c+.11);f.box(t,r,i.TRIM)}})}function ve(f,e,d,u,c=.6){f.box([e-u,0,d-u],[e+u,c,d+u],i.CONCRETE),f.painted(x.GREEN,()=>{f.box([e-u+.12,c,d-u+.12],[e+u-.12,c+.5,d+u-.12],i.TRIM)})}function O(f,e,d,u,c){const a=.9+Q(Math.round(e),Math.round(d),c)*.5;f.painted(x.WOOD,()=>f.cylinder(e,d,.17,0,u*.42,6,i.TRIM,!1)),f.painted(x.GREEN,()=>{f.cone(e,d,a,a*.6,u*.36,u*.74,8,i.TRIM),f.cone(e,d,a*.72,0,u*.68,u,8,i.TRIM)})}function se(f,e,d,u,c){f.box([e,1e-4,d],[u,.14,c],i.CONCRETE)}function F(f,e,d,u,c,a={}){const o=a.depth??2.6;se(f,e,u+o-.4,d,u+o);const n=a.bollards??5;n>0&&P(f,{axis:"z",sign:1,plane:u},e+.6,d-.6,o-.9,n);const t=a.trees??2;for(let r=0;r<t;r++){const s=t===1?.5:r/(t-1);O(f,e+1.2+s*(d-e-2.4),u+o-1.2,4.4+Q(r,5,c)*1.6,c+r)}for(let r=0;r<(a.planters??0);r++)ve(f,e+1+r*2.2,u+1,.55);if(a.bin!==!1){const r=d-1.6;f.painted(x.METAL_DARK,()=>{f.box([r-.42,.12,u+.5],[r+.42,1.15,u+1.1],i.TRIM),f.box([r-.46,1.15,u+.46],[r+.46,1.28,u+1.14],i.TRIM);for(const s of[r-.32,r+.32])f.box([s-.06,0,u+.62],[s+.06,.24,u+.86],i.TRIM)})}}function $(f,e,d,u,c,a=1.05,o=1.4){f.painted(x.METAL_DARK,()=>{const n=Math.max(2,Math.round((d-e)/o));for(let t=0;t<=n;t++){const r=e+t/n*(d-e);f.box([r-.05,c,u-.05],[r+.05,c+a,u+.05],i.TRIM)}f.box([e,c+a-.12,u-.04],[d,c+a,u+.04],i.TRIM),f.box([e,c+a*.45,u-.03],[d,c+a*.45+.08,u+.03],i.TRIM)})}const _=f=>f*.39;function U(f,e,d,u,c,a,o=.42,n=.3){f.box([e-o,a-n,d-o],[u+o,a,c+o],i.TRIM)}function ee(f,e,d,u,c,a=1.1){f.box([e-a/2,u,d-a/2],[e+a/2,c,d+a/2],i.BRICK),f.box([e-a/2-.14,c,d-a/2-.14],[e+a/2+.14,c+.24,d+a/2+.14],i.TRIM)}function ie(f,e,d,u,c,a,o=.42){f.box([e-o,a-.14,c+o-.18],[u+o,a,c+o],i.TRIM),f.box([e-o,a-.14,d-o],[u+o,a,d-o+.18],i.TRIM);for(const n of[e-o+.02,u+o-.16])f.box([n,0,c+o-.16],[n+.14,a-.14,c+o-.02],i.TRIM)}function $e(f){const e=new y,d=f<1,u=f<2,c=7.4,a=9.8,o=5.4,n=c/2,t=a/2,r=_(c),s=4.3,l=3.1,p=-s/2,h=s/2,g=t-.2,b=t+l;if(e.box([-n,0,-t],[n,o,t],i.BRICK,{roof:i.TRIM}),e.gable([-n,o,-t],[n,o,t],r,"z",i.TILE,i.BRICK),u){e.box([p,0,g],[h,o-.5,b],i.BRICK,{roof:i.TRIM}),e.gable([p,o-.5,g],[h,o-.5,b],_(s),"x",i.TILE,i.BRICK);const m=n-.3,w=n+4.7;e.box([m,0,-t+1.4],[w,3.1,t-1.6],i.BRICK,{roof:i.TRIM}),e.gable([m,3.1,-t+1.4],[w,3.1,t-1.6],1.5,"z",i.TILE,i.BRICK),U(e,-n,-t,n,t,o),U(e,p,g,h,b,o-.5,.36),U(e,m,-t+1.4,w,t-1.6,3.1,.3),e.box([-n-.05,o+.4,-1.6],[-n+1.5,o+2,.1],i.BRICK),e.gable([-n-.2,o+2,-1.75],[-n+1.65,o+2,.25],.7,"z",i.TILE,i.BRICK),ee(e,n-1.75,-1.75,o+1.2,o+r+1.8)}if(d){ie(e,-n,-t,n,t,o),e.box([h+.1,0,b-2.4],[h+3.4,.16,b],i.CONCRETE),e.box([h+.1,2.6,b-2.6],[h+3.6,2.92,b+.25],i.TRIM);for(const m of[h+.45,h+3.1])e.box([m-.14,.16,b-.4],[m+.14,2.6,b-.12],i.TRIM);for(let m=0;m<8;m++){const w=h+.5+m/7*2.55;e.box([w-.04,.16,b-.32],[w+.04,.98,b-.2],i.TRIM)}e.box([h+.35,.98,b-.38],[h+3.25,1.1,b-.14],i.TRIM),e.painted(x.DOOR,()=>e.opening({axis:"z",sign:1,plane:b,u0:h+1.1,u1:h+2.1,y0:.16,y1:2.3,glass:i.TRIM,frame:.13,proud:.09})),e.box([p+.5,.3,b],[h-.5,2.9,b+.5],i.BRICK,{roof:i.TRIM}),e.opening({axis:"z",sign:1,plane:b+.5,u0:p+.75,u1:h-.75,y0:.75,y1:2.55,glass:i.GLASS,frame:.1,proud:.07}),e.windowRow({axis:"z",sign:1,plane:b,from:p,to:h,y0:3.3,y1:4.7,count:1,width:1.5,glass:i.GLASS,frame:.1,proud:.07});for(const[m,w]of[[1,n],[-1,-n]])R(e,{axis:"x",sign:m,plane:w},-t+1.2,t-1.2,{floors:2,floorH:2.2,base:1.2,count:2,width:1.2,height:1.5,sill:!1});R(e,{axis:"z",sign:-1,plane:-t},-n+1,n-1,{floors:2,floorH:2.2,base:1.3,count:2,width:1.3,height:1.5,sill:!1}),e.painted(x.DOOR,()=>e.opening({axis:"z",sign:1,plane:t-1.6,u0:n+.4,u1:n+4,y0:.15,y1:2.5,glass:i.TRIM,frame:.12,proud:.09})),O(e,-n-1.6,t+2.4,5,2)}return e}function Ye(f){const e=new y,d=f<1,u=f<2,c=12,a=8,o=3,n=c/2,t=a/2;if(e.box([-n,0,-t],[n,o,t],i.PLASTER,{roof:i.TRIM}),e.gable([-n,o,-t],[n,o,t],_(a),"x",i.TILE,i.PLASTER),u){U(e,-n,-t,n,t,o,.55),ee(e,-2,0,o+1,o+_(a)+1.2,.9),e.box([n,2.6,-t+.8],[n+4.4,2.9,t-.8],i.TRIM);for(const r of[-t+1.4,t-1.4])e.box([n+3.9,0,r-.14],[n+4.2,2.6,r+.14],i.TRIM)}if(d){ie(e,-n,-t,n,t,o,.55),e.painted(x.DOOR,()=>e.opening({axis:"z",sign:1,plane:t,u0:-.55,u1:.55,y0:.16,y1:2.25,glass:i.TRIM,frame:.12,proud:.08})),e.box([-1.4,0,t],[1.4,.16,t+1],i.CONCRETE);for(const[r,s]of[[1,t],[-1,-t]])e.windowRow({axis:"z",sign:r,plane:s,from:-n+.9,to:n-.9,y0:1,y1:2.4,count:4,width:1.5,glass:i.GLASS,frame:.09,proud:.06});e.windowRow({axis:"x",sign:-1,plane:-n,from:-t+1,to:t-1,y0:1,y1:2.4,count:2,width:1.2,glass:i.GLASS,frame:.09,proud:.06}),F(e,-n,n+4.4,t,5,{trees:3,planters:3,bollards:6}),$(e,-n+.4,-1.6,t+1,0),$(e,1.6,n-.4,t+1,0),e.painted(x.WOOD,()=>{e.box([-n+.6,0,-t-3.4],[-n+3.2,2.1,-t-1],i.TRIM)}),e.gable([-n+.5,2.1,-t-3.5],[-n+3.3,2.1,-t-.9],.7,"x",i.TILE,i.TRIM),e.box([-1.4,.002,t+1],[1.4,.06,t+3.4],i.CONCRETE),e.windowRow({axis:"x",sign:1,plane:n,from:-t+1,to:t-1,y0:1,y1:2.4,count:2,width:1.2,glass:i.GLASS,frame:.09,proud:.06})}return e}function Xe(f){const e=new y,d=f<1,u=f<2,c=13.5,a=8.6,o=5.6,n=c/2,t=a/2;if(e.box([-n,0,-t],[n,o,t],i.BRICK,{roof:i.TRIM}),e.gable([-n,o,-t],[n,o,t],_(a),"x",i.TILE,i.BRICK),u){U(e,-n,-t,n,t,o);for(const r of[-1,1]){const s=r*3.2;e.box([s-1.5,0,t],[s+1.5,.16,t+1.4],i.CONCRETE),e.box([s-1.7,2.5,t],[s+1.7,2.82,t+1.6],i.TRIM);for(const l of[s-1.35,s+1.35])e.box([l-.12,.16,t+1.15],[l+.12,2.5,t+1.4],i.TRIM)}ee(e,0,0,o+1,o+_(a)+1.4,1.3)}if(d){ie(e,-n,-t,n,t,o);for(const r of[-1,1]){const s=r*3.2;e.painted(x.DOOR,()=>e.opening({axis:"z",sign:1,plane:t,u0:s-.5,u1:s+.5,y0:.16,y1:2.25,glass:i.TRIM,frame:.12,proud:.08})),e.opening({axis:"z",sign:1,plane:t,u0:s-2.9,u1:s-1.6,y0:1,y1:2.4,glass:i.GLASS,frame:.09,proud:.06}),e.opening({axis:"z",sign:1,plane:t,u0:s-1,u1:s+1,y0:3.4,y1:4.8,glass:i.GLASS,frame:.09,proud:.06})}R(e,{axis:"z",sign:-1,plane:-t},-n+1,n-1,{floors:2,floorH:2.3,base:1.2,count:4,width:1.1,height:1.5,sill:!1});for(const[r,s]of[[1,n],[-1,-n]])R(e,{axis:"x",sign:r,plane:s},-t+1.2,t-1.2,{floors:2,floorH:2.3,base:1.2,count:1,width:1.1,height:1.5,sill:!1});F(e,-n,n,t,9,{trees:2,planters:2,bollards:5});for(const r of[-1,1])$(e,r*3.2-1.5,r*3.2+1.5,t+1.4,.16,.9)}return e}function Ze(f){const e=new y,d=f<1,u=f<2,c=4,a=5,o=9,n=8.4,r=c*a/2,s=o/2;if(e.box([-r,0,-s],[r,n,s],i.BRICK,{roof:i.ROOF}),u){for(let l=0;l<=c;l++){const p=-r+l*a;e.box([p-.22,0,-s-.1],[p+.22,n+.9,s+.35],i.BRICK)}A(e,-r,-s,r,s,n,.5,.3);for(let l=0;l<c;l++){const p=-r+(l+.5)*a;e.box([p-1.1,0,s],[p+1.1,.32,s+1.1],i.CONCRETE),e.box([p-1.3,2.6,s],[p+1.3,2.9,s+1.3],i.TRIM)}I(e,-r+1,-s+1,r-1,s-1,n+.5,13,.5)}if(d){for(let l=0;l<c;l++){const p=-r+(l+.5)*a;e.painted(x.DOOR,()=>e.opening({axis:"z",sign:1,plane:s,u0:p-.55,u1:p+.55,y0:.32,y1:2.42,glass:i.TRIM,frame:.13,proud:.09})),e.opening({axis:"z",sign:1,plane:s,u0:p-2,u1:p-.85,y0:.9,y1:2.4,glass:i.GLASS,frame:.09,proud:.06});for(let h=1;h<3;h++){const g=.9+h*2.7;e.opening({axis:"z",sign:1,plane:s,u0:p-1.9,u1:p-.5,y0:g,y1:g+1.5,glass:i.GLASS,frame:.09,proud:.06}),e.opening({axis:"z",sign:1,plane:s,u0:p+.5,u1:p+1.9,y0:g,y1:g+1.5,glass:i.GLASS,frame:.09,proud:.06})}e.opening({axis:"z",sign:-1,plane:-s,u0:p-1.6,u1:p+1.6,y0:1,y1:2.5,glass:i.GLASS,frame:.09,proud:.06})}for(let l=0;l<c;l++)O(e,-r+(l+.5)*a,s+3,4.4,l*3+1)}return e}function Je(f){const e=new y,d=f<1,u=f<2,c=6.6,a=8.2,o=4.4,n=c/2,t=a/2,r=_(c)*1.25;if(e.box([-n,0,-t],[n,o,t],i.PLASTER,{roof:i.TRIM}),e.gable([-n,o,-t],[n,o,t],r,"z",i.TILE,i.PLASTER),u&&(U(e,-n,-t,n,t,o,.5),ee(e,0,-t+1.2,o+1.4,o+r+1.6,1),e.box([n,0,-1.6],[n+2.6,2.4,2.6],i.PLASTER,{roof:i.TRIM}),e.quad([n,2.45,2.6],[n+2.6,2.05,2.6],[n+2.6,2.05,-1.6],[n,2.45,-1.6],i.TILE),e.box([-n-1.6,.001,t+2.2],[n+2.8,.7,t+2.45],i.BRICK)),d){ie(e,-n,-t,n,t,o,.5),e.painted(x.DOOR,()=>e.opening({axis:"z",sign:1,plane:t,u0:-1.7,u1:-.75,y0:.16,y1:2.15,glass:i.TRIM,frame:.13,proud:.09})),e.opening({axis:"z",sign:1,plane:t,u0:.2,u1:1.9,y0:1,y1:2.3,glass:i.GLASS,frame:.1,proud:.07}),e.windowRow({axis:"z",sign:1,plane:t,from:-n+.7,to:n-.7,y0:2.9,y1:4,count:2,width:1.1,glass:i.GLASS,frame:.09,proud:.06}),e.windowRow({axis:"x",sign:-1,plane:-n,from:-t+1,to:t-1,y0:1.1,y1:2.4,count:2,width:1,glass:i.GLASS,frame:.09,proud:.06}),F(e,-n-1.6,n+2.8,t+.8,17,{trees:3,planters:3,bollards:4,depth:2}),$(e,-n-1.5,n+2.7,t+2.6,.7,.6,.9);for(const s of[-.35,.35])e.cylinder(s,-t+1.2,.16,o+r+1.6,o+r+2.1,8,i.TRIM);e.painted(x.GREEN,()=>e.cylinder(n+2.9,2,.42,0,1.3,10,i.TRIM)),e.box([-2.2,2.3,t],[-.25,2.6,t+.9],i.TRIM);for(const s of[-2.1,-.35])e.box([s-.07,0,t+.72],[s+.07,2.3,t+.86],i.TRIM);e.painted(x.WOOD,()=>{for(let s=0;s<8;s++)e.cylinder(-n-.9+s%4*.34,-t+1.2+Math.floor(s/4)*.34,.15,0,1.1,6,i.TRIM,!1)}),e.painted(x.GREEN,()=>{e.box([.2,.85,t],[1.9,1.15,t+.28],i.TRIM)}),e.windowRow({axis:"x",sign:1,plane:n,from:-t+1.2,to:t-1.2,y0:1.1,y1:2.4,count:2,width:1,glass:i.GLASS,frame:.09,proud:.06})}return e}function Qe(f){const e=new y,d=f<1,u=f<2,c=9.6,a=11,o=6.2,n=c/2,t=a/2,r=_(c);if(e.box([-n,0,-t],[n,o,t],i.BRICK,{roof:i.TRIM}),e.gable([-n,o,-t],[n,o,t],r,"z",i.TILE,i.BRICK),u){e.box([-n,0,t-.4],[-n+4.2,o-.3,t+3],i.BRICK,{roof:i.TRIM}),e.gable([-n,o-.3,t-.4],[-n+4.2,o-.3,t+3],_(4.2),"x",i.TILE,i.BRICK),U(e,-n,-t,n,t,o),U(e,-n,t-.4,-n+4.2,t+3,o-.3,.36),e.box([-n+4.2,3.3,t],[n,3.62,t+2.4],i.TRIM);for(const s of[-n+4.6,n-.5])e.box([s-.16,0,t+2],[s+.16,3.3,t+2.32],i.TRIM);e.box([-n+4.2,0,t],[n,.2,t+2.4],i.CONCRETE),ee(e,n-1.6,-2,o+1.2,o+r+2,1.2),ee(e,-n+1.4,-t+1.4,o+1,o+r+1.2,.9)}if(d){ie(e,-n,-t,n,t,o),e.painted(x.DOOR,()=>e.opening({axis:"z",sign:1,plane:t,u0:.4,u1:1.5,y0:.2,y1:2.45,glass:i.TRIM,frame:.14,proud:.1})),e.opening({axis:"z",sign:1,plane:t+3,u0:-n+.6,u1:-n+3.6,y0:.9,y1:2.7,glass:i.GLASS,frame:.11,proud:.07}),e.opening({axis:"z",sign:1,plane:t+3,u0:-n+.9,u1:-n+3.3,y0:3.9,y1:5.3,glass:i.GLASS,frame:.1,proud:.07}),e.windowRow({axis:"z",sign:1,plane:t,from:-n+4.6,to:n-.6,y0:3.9,y1:5.3,count:2,width:1.2,glass:i.GLASS,frame:.1,proud:.07});for(const[s,l]of[[1,n],[-1,-n]])R(e,{axis:"x",sign:s,plane:l},-t+1.2,t-1.2,{floors:2,floorH:2.7,base:1.3,count:3,width:1.1,height:1.6,sill:!1});R(e,{axis:"z",sign:-1,plane:-t},-n+1,n-1,{floors:2,floorH:2.7,base:1.3,count:3,width:1.1,height:1.6,sill:!1}),O(e,n+2,t+3,6,29),ve(e,-n+1,t+3.6,.6)}return e}function en(f){const e=new y,d=f<1,u=f<2,c=ce*2-1.6,a=ce*2-2.4,o=5,n=3.1,t=o*n,r=c/2,s=a/2;if(e.box([-r,0,-s],[r,t,s],i.PLASTER,{roof:i.ROOF}),e.box([-r-.22,0,-s-.22],[r+.22,3.4,s+.22],i.BRICK,{roof:i.TRIM}),u&&(E(e,-r,-s,r,s,t,.9,.2),j(e,{axis:"z",sign:1,plane:s},-r+.4,r-.4,{floors:o-1,floorH:n,base:3.5,bays:3,depth:1.25,solid:!1}),j(e,{axis:"z",sign:-1,plane:-s},-r+.4,r-.4,{floors:o-1,floorH:n,base:3.5,bays:3,depth:1.25,solid:!1}),e.box([-1.6,t,-1.4],[1.6,t+3,1.4],i.BRICK,{roof:i.ROOF}),I(e,-r+1,-s+1,r-1,s-1,t,101,.9)),d){for(const[l,p,h,g]of[["z",1,s,r],["z",-1,-s,r],["x",1,r,s],["x",-1,-r,s]])R(e,{axis:l,sign:p,plane:h},-g+.8,g-.8,{floors:o-1,floorH:n,base:4.3,count:l==="z"?3:2,width:1.15,height:1.5});e.painted(x.DOOR,()=>e.opening({axis:"z",sign:1,plane:s+.22,u0:-.7,u1:.7,y0:.2,y1:2.5,glass:i.TRIM,frame:.14,proud:.1})),je(e,{axis:"z",sign:1,plane:s+.22},-1.1,1.1,2),e.box([-1.5,3,s+.22],[1.5,3.35,s+1.6],i.CONCRETE),O(e,-r-1.2,s+2,5.4,33)}return e}function nn(f){const e=new y,d=f<1,u=f<2,c=16,a=12,o=5,n=3.2,t=4,r=t+o*n,s=c/2,l=a/2;if(e.box([-s,0,-l],[s,r,l],i.BRICK,{roof:i.ROOF}),u){for(let p=1;p<=o;p++)A(e,-s,-l,s,l,t+p*n-.3,.3,.14);A(e,-s,-l,s,l,r-.6,.6,.45),E(e,-s,-l,s,l,r,1.1,.24),A(e,-s,-l,s,l,t-.25,.5,.22),I(e,-s+1.2,-l+1.2,s-1.2,l-1.2,r,111,1)}if(d){S(e,{axis:"z",sign:1,plane:l},-s+.6,s-.6,{bays:5,doorBay:2,head:3.5}),Y(e,{axis:"z",sign:1,plane:l},-s+.7,-1.4,3.3,1.5),B(e,{axis:"z",sign:1,plane:l},.5,6,2.95,3.6);for(const[p,h,g,b,m]of[["z",1,l,s,5],["z",-1,-l,s,5],["x",1,s,l,3],["x",-1,-s,l,3]])R(e,{axis:p,sign:h,plane:g},-b+.8,b-.8,{floors:o,floorH:n,base:t+.85,count:m,width:1.05,height:1.85});ze(e,{axis:"x",sign:-1,plane:-s},-3,t+.5,o-1,n,3.4),P(e,{axis:"z",sign:1,plane:l},-s+1,s-1,1.6,6)}return e}function tn(f){const e=new y,d=f<1,u=f<2,c=22,a=18,o=4,n=3.1,t=o*n+.8,r=c/2,s=a/2,l=6.5;if(e.box([-r,0,-s],[r,t,-s+l],i.PLASTER,{roof:i.ROOF}),e.box([-r,0,-s+l],[-r+l,t,s],i.PLASTER,{roof:i.ROOF}),e.box([r-l,0,-s+l],[r,t,s],i.PLASTER,{roof:i.ROOF}),u&&(E(e,-r,-s,r,-s+l,t,.8,.2),E(e,-r,-s+l,-r+l,s,t,.8,.2),E(e,r-l,-s+l,r,s,t,.8,.2),e.box([-r,0,-s],[r,3.2,-s+l],i.BRICK,{roof:i.TRIM}),j(e,{axis:"z",sign:1,plane:-s+l},-r+l+.5,r-l-.5,{floors:o-1,floorH:n,base:3.6,bays:3,depth:1.2,solid:!1}),I(e,-r+1,-s+1,r-1,-s+l-1,t,121,.8),e.box([-r+l,1e-4,-s+l],[r-l,.1,s],i.CONCRETE),O(e,0,-s+l+4,6,41),O(e,-3.6,s-3,5.2,43),O(e,3.6,s-3,5.2,47)),d){for(const[p,h,g,b,m,w]of[["z",1,-s+l,-r+l+.6,r-l-.6,4],["z",-1,-s,-r+.8,r-.8,7],["x",1,r,-s+l+.6,s-.6,3],["x",-1,-r,-s+l+.6,s-.6,3]])R(e,{axis:p,sign:h,plane:g},b,m,{floors:o,floorH:n,base:3.9,count:w,width:1.1,height:1.6});e.painted(x.DOOR,()=>e.opening({axis:"z",sign:-1,plane:-s,u0:-1,u1:1,y0:.2,y1:2.6,glass:i.TRIM,frame:.14,proud:.1})),e.box([-1.6,3,-s-1.5],[1.6,3.4,-s],i.CONCRETE)}return e}function on(f){const e=new y,d=f<1,u=f<2,c=18,a=13,o=4.6,n=4,t=3.15,r=o+n*t,s=c/2,l=a/2;if(e.box([-s,0,-l],[s,r,l],i.PLASTER,{roof:i.ROOF}),e.box([-s-.2,0,-l-.2],[s+.2,o,l+.2],i.CONCRETE,{roof:i.TRIM}),u&&(E(e,-s,-l,s,l,r,1,.22),A(e,-s,-l,s,l,o,.35,.3),j(e,{axis:"z",sign:1,plane:l},-s+.6,s-.6,{floors:n,floorH:t,base:o+.4,bays:4,depth:1.35,solid:!1}),I(e,-s+1.2,-l+1.2,s-1.2,l-1.2,r,131,1)),d){S(e,{axis:"z",sign:1,plane:l+.2},-s+.6,-.4,{bays:3,doorBay:1,head:3.7}),S(e,{axis:"z",sign:1,plane:l+.2},.4,s-.6,{bays:3,doorBay:1,head:3.7}),B(e,{axis:"z",sign:1,plane:l+.2},-s+1.6,-1.4,3.05,3.75),Y(e,{axis:"z",sign:1,plane:l+.2},.5,s-.7,3.9,1.5);for(const[p,h,g,b,m]of[["z",-1,-l,s,6],["x",1,s,l,4],["x",-1,-s,l,4]])R(e,{axis:p,sign:h,plane:g},-b+.8,b-.8,{floors:n,floorH:t,base:o+.9,count:m,width:1.1,height:1.7});P(e,{axis:"z",sign:1,plane:l},-s+1,s-1,2,7),O(e,-s-1.4,l+2.4,5.6,51)}return e}function sn(f){const e=new y,d=f<1,u=f<2,c=26,a=11,o=6,n=2.95,t=o*n,r=c/2,s=a/2;if(e.box([-r,0,-s],[r,t,s],i.CONCRETE,{roof:i.ROOF}),u){E(e,-r,-s,r,s,t,.75,.2);for(let l=1;l<o;l++){const p=l*n;e.box([-r,p,-s-1.5],[r,p+.18,-s],i.CONCRETE),e.painted(x.METAL_DARK,()=>e.box([-r,p+.18,-s-1.5],[r,p+1.05,-s-1.38],i.TRIM))}for(const l of[-1,1])e.box([l*r-l*3,0,-s-1.6],[l*r,t+1.6,-s+.2],i.CONCRETE,{roof:i.ROOF});I(e,-r+2,-s+1,r-2,s-1,t,141,1.1)}if(d){R(e,{axis:"z",sign:1,plane:s},-r+.8,r-.8,{floors:o,floorH:n,base:.85,count:9,width:1.6,height:1.7}),R(e,{axis:"z",sign:-1,plane:-s},-r+3.4,r-3.4,{floors:o,floorH:n,base:.85,count:6,width:1,height:1.5}),j(e,{axis:"z",sign:1,plane:s},-r+.6,r-.6,{floors:o,floorH:n,base:.6,bays:6,depth:1.15,solid:!0});for(const l of[-1,1])R(e,{axis:"x",sign:l,plane:l*r},-s+.8,s-.8,{floors:o,floorH:n,base:.9,count:1,width:1,height:1.4,sill:!1})}return e}function an(f){const e=new y,d=f<1,u=f<2,c=15,a=15,o=4.2,n=4,t=3.2,r=o+n*t,s=c/2,l=a/2;if(e.box([-s,0,-l],[s,r,l],i.BRICK,{roof:i.ROOF}),e.box([s-3.4,0,l-3.4],[s+.4,r,l+.4],i.PLASTER,{roof:i.ROOF}),u){E(e,-s,-l,s,l,r,1,.24),A(e,s-3.4,l-3.4,s+.4,l+.4,r,1.6,.4);for(let p=1;p<=n;p++)A(e,-s,-l,s,l,o+p*t-.28,.28,.14);A(e,-s,-l,s,l,o-.2,.42,.2),I(e,-s+1.2,-l+1.2,s-1.2,l-1.2,r,151,.9)}if(d){S(e,{axis:"z",sign:1,plane:l},-s+.6,s-4.2,{bays:3,doorBay:1,head:3.6}),S(e,{axis:"x",sign:1,plane:s},-l+.6,l-4.2,{bays:3,doorBay:1,head:3.6}),S(e,{axis:"z",sign:1,plane:l+.4},s-3.2,s+.2,{bays:1,doorBay:0,head:3.6}),Y(e,{axis:"z",sign:1,plane:l},-s+.7,-1,3.4,1.5);for(const[p,h,g,b,m]of[["z",1,l,s,4],["x",1,s,l,4],["z",-1,-l,s,5],["x",-1,-s,l,5]])R(e,{axis:p,sign:h,plane:g},-b+.9,b-4.4,{floors:n,floorH:t,base:o+.85,count:m,width:1.05,height:1.75});R(e,{axis:"z",sign:1,plane:l+.4},s-3,s+.2,{floors:n,floorH:t,base:o+.85,count:1,width:2.2,height:1.75}),P(e,{axis:"z",sign:1,plane:l},-s+1,s-1,1.6,6)}return e}function rn(f){const e=new y,d=f<1,u=f<2,c=ce*3-2.4,a=c/2,o=c/2,n=9.5,t=19,r=3.05,s=n+t*r,l=a*.7,p=o*.7;if(e.box([-a,0,-o],[a,n,o],i.BRICK,{roof:i.ROOF}),A(e,-a,-o,a,o,n,.7,.25),e.box([-l,n,-p],[l,s,p],i.PLASTER,{roof:i.ROOF}),u){for(let g=0;g<=5;g++){const b=g/5,m=-l+b*l*2,w=-p+b*p*2;e.box([m-.16,n,p],[m+.16,s,p+.34],i.TRIM),e.box([m-.16,n,-p-.34],[m+.16,s,-p],i.TRIM),e.box([l,n,w-.16],[l+.34,s,w+.16],i.TRIM),e.box([-l-.34,n,w-.16],[-l,s,w+.16],i.TRIM)}for(let g=2;g<t;g+=3){const b=n+g*r;A(e,-l,-p,l,p,b,.18,.9),e.painted(x.METAL_DARK,()=>{e.box([-l-.9,b+.18,p+.78],[l+.9,b+1.1,p+.9],i.TRIM),e.box([-l-.9,b+.18,-p-.9],[l+.9,b+1.1,-p-.78],i.TRIM)})}E(e,-l,-p,l,p,s,1.4,.3),e.box([-l*.55,s,-p*.55],[l*.55,s+4.2,p*.55],i.METAL,{roof:i.ROOF}),e.box([-.22,s+4.2,-.22],[.22,s+11,.22],i.TRIM),I(e,-l+1,-p+1,l-1,p-1,s,161,.6)}if(d){for(let h=0;h<t;h++){const g=n+h*r+.85;for(const[b,m,w,v]of[["z",1,p,l],["z",-1,-p,l],["x",1,l,p],["x",-1,-l,p]])e.opening({axis:b,sign:m,plane:w,u0:-v+.75,u1:v-.75,y0:g,y1:g+1.55,glass:i.GLASS,frame:.09,proud:.05})}S(e,{axis:"z",sign:1,plane:o},-a+1,a-1,{bays:4,doorBay:1,head:4.4,brandFascia:!1}),P(e,{axis:"z",sign:1,plane:o},-a+1,a-1,1.8,7)}return e}function ln(f){const e=new y,d=f<1,u=f<2,c=26,a=13,o=16,n=3,t=5,r=t+o*n,s=c/2,l=a/2;if(e.box([-s,0,-l],[s,t,l],i.CONCRETE,{roof:i.TRIM}),e.box([-s+1,t,-l+.6],[s-1,r,l-.6],i.PLASTER,{roof:i.ROOF}),u){for(const p of[-1,1])e.box([p*(s-1)-p*3.2,t,-l+.4],[p*(s-1),r+2.4,l-.4],i.CONCRETE,{roof:i.ROOF});E(e,-s+1,-l+.6,s-1,l-.6,r,1,.24),j(e,{axis:"z",sign:1,plane:l-.6},-s+4.6,s-4.6,{floors:o,floorH:n,base:t+.5,bays:5,depth:1.4,solid:!0}),I(e,-s+5,-l+1,s-5,l-1,r,171,1.2)}if(d){R(e,{axis:"z",sign:1,plane:l-.6},-s+4.4,s-4.4,{floors:o,floorH:n,base:t+1.1,count:3,width:2.6,height:1.5,sill:!1}),R(e,{axis:"z",sign:-1,plane:-l+.6},-s+4.4,s-4.4,{floors:o,floorH:n,base:t+1.1,count:3,width:2.6,height:1.5,sill:!1});for(const p of[-1,1])R(e,{axis:"x",sign:p,plane:p*(s-1)},-l+1.2,l-1.2,{floors:o,floorH:n,base:t+1.1,count:1,width:1.1,height:1.4,sill:!1});S(e,{axis:"z",sign:1,plane:l},-s+2,s-2,{bays:6,doorBay:2,head:4.2,brandFascia:!1})}return e}function cn(f){const e=new y,d=f<1,u=f<2,c=10.5,a=9,o=7,n=22,t=3.2,r=o+n*t;e.box([-c,0,-a],[c,o,a],i.CONCRETE,{roof:i.ROOF});const s=[[o,o+n*.45*t,.86,.86],[o+n*.45*t,o+n*.78*t,.7,.7],[o+n*.78*t,r,.54,.54]];for(const[l,p,h,g]of s)e.box([-c*h,l,-a*g],[c*h,p,a*g],i.GLASS,{roof:i.ROOF});if(u){for(const[,l,p,h]of s)A(e,-c*p,-a*h,c*p,a*h,l,.9,.35);A(e,-c,-a,c,a,o,.8,.4),e.box([-c*.28,r+.9,-a*.28],[c*.28,r+5.4,a*.28],i.METAL,{roof:i.ROOF}),e.box([-.2,r+5.4,-.2],[.2,r+13,.2],i.TRIM),I(e,-c*.5,-a*.5,c*.5,a*.5,r+.9,181,.5)}if(d){for(const[l,p,h,g]of s){const b=Math.max(1,Math.round((p-l)/t));for(let m=0;m<b;m++){const w=l+m*t+.4;for(const[v,M,z,C]of[["z",1,a*g,c*h],["z",-1,-a*g,c*h],["x",1,c*h,a*g],["x",-1,-c*h,a*g]])e.opening({axis:v,sign:M,plane:z,u0:-C+.5,u1:C-.5,y0:w,y1:w+t-1,glass:i.GLASS,frame:.07,proud:.05})}}S(e,{axis:"z",sign:1,plane:a},-c+1.2,c-1.2,{bays:5,doorBay:2,head:5.2,brandFascia:!1})}return e}function dn(f){const e=new y,d=f<1,u=f<2,c=11,a=10,o=15,n=3.1;for(let t=0;t<o;t++){const r=t*n,s=a-t/o*(a*.55);e.box([-c,r,-a],[c,r+n,s],i.PLASTER,{roof:i.ROOF}),u&&t>0&&(e.painted(x.METAL_DARK,()=>{e.box([-c,r,s-.12],[c,r+1.05,s],i.TRIM)}),t%2===0&&e.painted(x.GREEN,()=>e.box([-c+1,r,s+.4],[c-1,r+.5,s+1.6],i.TRIM)))}if(u){for(const t of[-1,1])e.box([t*c-t*2.6,0,-a],[t*c,o*n+2.2,-a+4],i.CONCRETE,{roof:i.ROOF});I(e,-c+3,-a+1,c-3,-a+3.5,o*n+2.2,191,.8)}if(d)for(let t=0;t<o;t++){const r=t*n+.9,s=a-t/o*(a*.55);e.opening({axis:"z",sign:1,plane:s,u0:-c+.8,u1:c-.8,y0:r,y1:r+1.9,glass:i.GLASS,frame:.08,proud:.05}),e.opening({axis:"z",sign:-1,plane:-a,u0:-c+3.2,u1:c-3.2,y0:r,y1:r+1.5,glass:i.GLASS,frame:.08,proud:.05})}return e}function fn(f){const e=new y,d=f<1,u=f<2,c=13,a=11,o=8,n=14,t=3.05,r=o+n*t,s=5.2,l=6.4;e.box([-c,0,-a],[c,o,a],i.CONCRETE,{roof:i.ROOF});for(const p of[-1,1])e.box([p*6.4-s,o,-l],[p*6.4+s,r,l],i.PLASTER,{roof:i.ROOF});if(u){E(e,-c,-a,c,a,o,1,.3);for(const p of[-1,1])E(e,p*6.4-s,-l,p*6.4+s,l,r,1.2,.28),j(e,{axis:"z",sign:1,plane:l},p*6.4-s+.4,p*6.4+s-.4,{floors:n,floorH:t,base:o+.5,bays:2,depth:1.3,solid:!1});e.painted(x.GREEN,()=>{e.box([-c+1.5,o,l+1.5],[c-1.5,o+.45,a-1.5],i.TRIM)}),O(e,-6,a-3.4,4.6,201),O(e,6,a-3.4,4.6,203),I(e,-c+2,-a+1.5,c-2,-l-1.5,o,205,.7)}if(d){for(const p of[-1,1])for(const[h,g,b,m]of[["z",1,l,s],["z",-1,-l,s],["x",1,p*6.4+s,l],["x",-1,p*6.4-s,l]]){const w=b,v=h==="z"?p*6.4:0;R(e,{axis:h,sign:g,plane:w},v-m+.6,v+m-.6,{floors:n,floorH:t,base:o+1,count:1,width:m*1.5,height:1.6,sill:!1})}S(e,{axis:"z",sign:1,plane:a},-c+1.5,c-1.5,{bays:6,doorBay:3,head:4.6,brandFascia:!1}),P(e,{axis:"z",sign:1,plane:a},-c+1,c-1,1.8,8)}return e}const un=f=>f*1.6,L=f=>({households:f,powerKW:un(f),waterM3:f*.55,garbagePerWeek:f*11,pollution:f>40?2:0,upkeep:Math.round(f*2.1)+5}),pn=[{id:"res.low.detached",name:"Detached house",zone:"residential",density:"low",variant:"sculpted",footprint:[2,2],height:10.4,sim:L(1),note:"Cross gable, garage wing, dormer, porch with balusters, bay window.",build:$e},{id:"res.low.bungalow",name:"Bungalow",zone:"residential",density:"low",variant:"sculpted",footprint:[3,2],height:6.2,sim:L(1),note:"Single storey under a wide low roof, deep eaves, carport on posts.",build:Ye},{id:"res.low.duplex",name:"Duplex",zone:"residential",density:"low",variant:"sculpted",footprint:[3,2],height:9,sim:L(2),note:"A mirrored pair under one roof, two porches, shared central chimney.",build:Xe},{id:"res.low.terrace",name:"Terrace of four",zone:"residential",density:"low",variant:"sculpted",footprint:[3,3],height:9.4,sim:L(4),note:"Party walls carried through the roof so it reads as four houses, not one block.",build:Ze},{id:"res.low.cottage",name:"Cottage",zone:"residential",density:"low",variant:"sculpted",footprint:[2,2],height:8,sim:L(1),note:"Steep roof, lean-to along one side, garden wall, two trees.",build:Je},{id:"res.low.large",name:"Large family house",zone:"residential",density:"low",variant:"sculpted",footprint:[2,3],height:11,sim:L(1),note:"Two-storey projecting wing, full-width porch, two chimneys.",build:Qe},{id:"res.mid.walkup",name:"Walk-up flats",zone:"residential",density:"medium",variant:"sculpted",footprint:[3,3],height:18.5,sim:L(24),note:"Masonry base, balconies front and back, stair core over the roofline.",build:en},{id:"res.mid.tenement",name:"Tenement",zone:"residential",density:"medium",variant:"sculpted",footprint:[3,2],height:21.1,sim:L(30),note:"Shop at street level, string course per floor, heavy cornice, fire escape.",build:nn},{id:"res.mid.courtyard",name:"Courtyard block",zone:"residential",density:"medium",variant:"sculpted",footprint:[3,3],height:13.2,sim:L(36),note:"Three wings round a planted court, balconies facing in.",build:tn},{id:"res.mid.mixed",name:"Flats over shops",zone:"residential",density:"medium",variant:"sculpted",footprint:[3,3],height:17.2,sim:L(28),note:"Two retail units at the base, four floors of flats with balconies over.",build:on},{id:"res.mid.slab",name:"Deck-access block",zone:"residential",density:"medium",variant:"sculpted",footprint:[4,2],height:17.7,sim:L(48),note:"Open access decks along the back, stair towers at both ends.",build:sn},{id:"res.mid.corner",name:"Corner block",zone:"residential",density:"medium",variant:"sculpted",footprint:[2,3],height:18,sim:L(26),note:"Chamfered corner with its own shopfront, string courses, awning.",build:an},{id:"res.high.point",name:"Point tower",zone:"residential",density:"high",variant:"sculpted",footprint:[3,3],height:79,sim:L(180),note:"Podium and setback, vertical fins full height, balcony band every third floor.",build:rn},{id:"res.high.slab",name:"Slab tower",zone:"residential",density:"high",variant:"sculpted",footprint:[4,2],height:55,sim:L(190),note:"Expressed cores at both ends, solid balconies across the sunny elevation.",build:ln},{id:"res.high.glass",name:"Stepped glass tower",zone:"residential",density:"high",variant:"sculpted",footprint:[3,3],height:91,sim:L(210),note:"Three setbacks with a slab band at each, crown and mast.",build:cn},{id:"res.high.terraced",name:"Terraced tower",zone:"residential",density:"high",variant:"sculpted",footprint:[3,3],height:49,sim:L(120),note:"Every floor steps back, so every flat gets a planted terrace.",build:dn},{id:"res.high.twin",name:"Twin towers on a podium",zone:"residential",density:"high",variant:"sculpted",footprint:[4,4],height:51,sim:L(200),note:"Two towers off a shared podium with a planted deck between them.",build:fn}];function hn(f){const e=new y,d=f<1,u=f<2,c=13,a=11,o=c/2,n=a/2,t=4.2,r=2,s=3.2,l=t+r*s;return e.box([-o,0,-n],[o,l,n],i.BRICK,{roof:i.ROOF}),u&&(E(e,-o,-n,o,n,l,1,.22),A(e,-o,-n,o,n,t-.15,.4,.16),I(e,-o+1,-n+1,o-1,n-1,l,3,.8)),d&&(S(e,{axis:"z",sign:1,plane:n},-o+.6,o-.6,{bays:4,doorBay:1,head:3.6}),S(e,{axis:"x",sign:1,plane:o},-n+.8,n-2.4,{bays:3,doorBay:3,head:3.6}),Y(e,{axis:"z",sign:1,plane:n},-o+.7,-.4,3,1.6),ue(e,{axis:"z",sign:1,plane:n},o-2,4.6,6.3,1.4),B(e,{axis:"z",sign:1,plane:n},-o+1.2,o-3.4,3.05,3.85),B(e,{axis:"x",sign:1,plane:o},-n+1.4,n-3.6,3.05,3.85),R(e,{axis:"z",sign:1,plane:n},-o+1,o-1,{floors:r,floorH:s,base:t+.9,count:3,width:1.3,height:1.8}),R(e,{axis:"x",sign:1,plane:o},-n+1,n-1,{floors:r,floorH:s,base:t+.9,count:3,width:1.2,height:1.8}),R(e,{axis:"x",sign:-1,plane:-o},-n+1,n-1,{floors:r,floorH:s,base:t+.9,count:2,width:1.2,height:1.8}),P(e,{axis:"z",sign:1,plane:n},-o+1,o-1,1.5,5),ve(e,o-1.6,n+1.9,.7)),e}function gn(f){const e=new y,d=f<1,u=f<2,c=15,a=8.4,o=c/2,n=a/2,t=4.4;if(e.box([-o,0,-n],[o,t,n],i.PLASTER,{roof:i.ROOF}),e.painted(x.BRAND_DARK,()=>e.box([-o-.12,0,-n-.12],[o+.12,1,n+.12],i.TRIM)),u&&(e.painted(x.BRAND,()=>de(e,-o,-n,o,n,t-.6,.6,1.1)),e.box([-o-1.1,t-.72,-n-1.1],[o+1.1,t-.6,n+1.1],i.CONCRETE),E(e,-o,-n,o,n,t,.5,.2),I(e,-o+1,-n+1,o-1,n-1,t+.5,11,.7),we(e,o-2.2,n+4.4,8.5,2.4)),d){for(const[r,s]of[[1,n],[-1,-n]])e.windowRow({axis:"z",sign:r,plane:s,from:-o+.8,to:o-.8,y0:1.05,y1:3.5,count:7,width:1.55,glass:i.SHOPFRONT,frame:.09,proud:.07});e.windowRow({axis:"x",sign:1,plane:o,from:-n+.8,to:n-.8,y0:1.05,y1:3.5,count:3,width:1.5,glass:i.SHOPFRONT,frame:.09,proud:.07}),B(e,{axis:"z",sign:1,plane:n},-4.5,4.5,t-.45,t-.05),e.painted(x.BRAND,()=>e.box([-2.2,0,n+1],[2.2,3.3,n+1.3],i.TRIM)),e.box([-2,0,n+.1],[2,.14,n+1.2],i.CONCRETE),ue(e,{axis:"x",sign:1,plane:o},0,2.4,4.2,1.5),P(e,{axis:"z",sign:1,plane:n},-o+1,o-1,2.4,6)}return e}function bn(f){const e=new y,d=f<1,u=f<2,c=14,a=11,o=c/2,n=a/2,t=-3,r=5;if(e.box([t-o/2,0,-n],[t+o/2,r,n],i.PLASTER,{roof:i.ROOF}),u){e.painted(x.BRAND,()=>de(e,t-o/2,-n,t+o/2,n,r-1.5,1.9,.5)),I(e,t-o/2+1,-n+1,t+o/2-1,n-1,r+.4,21,1.1);const s=t+o/2+1.2;e.box([s,3.4,-n+1],[s+5.4,3.8,n-1],i.CONCRETE),e.painted(x.METAL_DARK,()=>{for(const l of[-n+1.6,n-1.6])e.box([s+4.6,0,l-.16],[s+4.9,3.4,l+.16],i.TRIM)}),se(e,s-.4,-n,s+5.6,n),we(e,t-o/2-2.6,n-1.5,9.5,2.6)}if(d){S(e,{axis:"z",sign:1,plane:n},t-o/2+.7,t+o/2-.7,{bays:4,doorBay:0,head:3.5}),B(e,{axis:"z",sign:1,plane:n},t-3,t+3,r-1.15,r-.15),B(e,{axis:"x",sign:-1,plane:t-o/2},-2.6,2.6,r-1.15,r-.15);const s={axis:"x",sign:1,plane:t+o/2};e.windowRow({axis:"x",sign:1,plane:t+o/2,from:-1.2,to:1.2,y0:1.5,y1:2.8,count:1,width:1.6,glass:i.SHOPFRONT,frame:.1,proud:.07}),pe(e,s,-3.6,-1.6,1.6,3.2),F(e,t-o/2,t+o/2,n,4,{trees:2,planters:2,bollards:5}),e.painted(x.METAL_DARK,()=>{e.box([t+o/2+5,0,-1.4],[t+o/2+5.3,1.5,-1.1],i.TRIM),e.box([t+o/2+4.6,1.5,-1.7],[t+o/2+5.7,2.6,-.8],i.TRIM)}),$(e,t-o/2,t+o/2-2,n+2.2,0,.95,1.2),e.painted(x.METAL_DARK,()=>{for(const l of[t-4.2,t+.6]){e.cylinder(l,n+1.2,.13,0,.72,6,i.TRIM,!1),e.cylinder(l,n+1.2,.58,.72,.78,10,i.TRIM);for(const p of[-.95,.95])e.box([l+p-.2,0,n+1],[l+p+.2,.44,n+1.4],i.TRIM),e.box([l+p-.2,.44,n+1.22],[l+p+.2,.92,n+1.4],i.TRIM)}});for(let l=0;l<8;l++)e.box([t+o/2+1.4+l*.7,.002,-n+.6],[t+o/2+1.8+l*.7,.02,-n+.9],i.TRIM);R(e,{axis:"x",sign:-1,plane:t-o/2},-n+1,n-1,{floors:1,floorH:3,base:1.6,count:3,width:1.1,height:1.5})}return e}function xn(f){const e=new y,d=f<1,u=f<2,c=9.5,a=8,o=c/2,n=a/2,t=4;if(e.box([-o,0,-n],[o,t,n],i.BRICK,{roof:i.ROOF}),u&&(E(e,-o,-n,o,n,t,.7,.2),I(e,-o+.8,-n+.8,o-.8,n-.8,t,31,.6),e.box([-o,1e-4,n],[o,.16,n+3.6],i.CONCRETE),e.box([-o,.16,n+3.4],[o,.75,n+3.6],i.BRICK)),d){S(e,{axis:"z",sign:1,plane:n},-o+.5,o-.5,{bays:3,doorBay:2,head:3.3}),Y(e,{axis:"z",sign:1,plane:n},-o+.6,o-.6,3.5,1.8),ue(e,{axis:"z",sign:1,plane:n},-o+1.2,3,4.4,1.3),e.painted(x.METAL_DARK,()=>{for(const r of[-2.4,1.4]){e.cylinder(r,n+1.9,.14,.16,.72,6,i.TRIM,!1),e.cylinder(r,n+1.9,.62,.72,.78,10,i.TRIM);for(const[s,l]of[[-1,0],[1,0]])e.box([r+s-.22,.16,n+1.9+l-.22],[r+s+.22,.46,n+1.9+l+.22],i.TRIM),e.box([r+s-.22,.46,n+1.9+l+.1],[r+s+.22,.95,n+1.9+l+.22],i.TRIM)}}),F(e,-o,o,n+3.6,31,{trees:2,planters:3,bollards:5,depth:1.8}),$(e,-o,o,n+3.5,.16,.9,1.1);for(const[r,s]of[[1,o],[-1,-o]])R(e,{axis:"x",sign:r,plane:s},-n+1,n-1,{floors:1,floorH:3,base:1.4,count:2,width:1.2,height:1.7});R(e,{axis:"z",sign:-1,plane:-n},-o+1,o-1,{floors:1,floorH:3,base:1.4,count:2,width:1.2,height:1.5})}return e}function mn(f){const e=new y,d=f<1,u=f<2,c=28,a=12,o=c/2,n=a/2,t=5.2,r=4;if(e.box([-o,0,-n],[o,t,n],i.CONCRETE,{roof:i.ROOF}),u&&(E(e,-o,-n,o,n,t,1.1,.25),I(e,-o+1.5,-n+1.5,o-1.5,n-1.5,t,41,1.2),e.box([-o,3.6,n],[o,4.1,n+3],i.CONCRETE),e.painted(x.METAL_DARK,()=>{for(let s=0;s<=r;s++){const l=-o+s/r*c;e.box([l-.18,0,n+2.5],[l+.18,3.6,n+2.86],i.TRIM)}}),se(e,-o,n+3,o,n+4.2)),d){for(let s=0;s<r;s++){const l=-o+s/r*c+.5,p=-o+(s+1)/r*c-.5;S(e,{axis:"z",sign:1,plane:n},l,p,{bays:3,doorBay:s%3,head:3.4,fascia:1}),B(e,{axis:"z",sign:1,plane:n},l+1,p-1,3.05,3.75),s%2===0&&Y(e,{axis:"z",sign:1,plane:n},l+.3,p-.3,4.4,1.4)}for(let s=0;s<r;s++){const l=-o+(s+.5)/r*c;e.opening({axis:"z",sign:-1,plane:-n,u0:l-.55,u1:l+.55,y0:.1,y1:2.3,glass:i.TRIM,frame:.1,proud:.07})}for(const s of[-o+3,0,o-3])O(e,s,n+5,5,s+7)}return e}function wn(f){const e=new y,d=f<1,u=f<2,c=30,a=20,o=c/2,n=a/2,t=8;if(e.box([-o,0,-n],[o,t,n],i.CONCRETE,{roof:i.ROOF}),u&&(E(e,-o,-n,o,n,t,1.4,.3),e.painted(x.BRAND,()=>e.box([-8.5,t,n-.4],[8.5,t+2.6,n+.4],i.TRIM)),I(e,-o+2,-n+2,o-2,n-2,t,51,1.6),e.box([-9,4.6,n],[9,5.2,n+4.5],i.CONCRETE),e.painted(x.METAL_DARK,()=>{for(const r of[-8.2,-2.8,2.8,8.2])e.box([r-.2,0,n+4],[r+.2,4.6,n+4.4],i.TRIM)}),se(e,-o,n+4.5,o,n+6)),d){e.windowRow({axis:"z",sign:1,plane:n,from:-8,to:8,y0:.5,y1:4.4,count:6,width:2.3,glass:i.SHOPFRONT,frame:.11,proud:.08}),B(e,{axis:"z",sign:1,plane:n},-6.5,6.5,t+.6,t+2.1),pe(e,{axis:"x",sign:1,plane:o},-3,3,5.4,6.8),e.painted(x.METAL_DARK,()=>{e.box([o-7,0,n+5],[o-2,2.4,n+5.2],i.TRIM),e.box([o-7,2.2,n+5],[o-2,2.4,n+7.4],i.TRIM),e.box([o-7,0,n+7.2],[o-2,2.4,n+7.4],i.TRIM)}),e.box([-o+2,0,-n-2.4],[-o+12,1.2,-n],i.CONCRETE);for(let r=0;r<2;r++){const s=-o+4+r*5;e.painted(x.METAL_DARK,()=>e.box([s-1.8,1.2,-n-.14],[s+1.8,5,-n+.02],i.TRIM))}F(e,-o,o,n+6,51,{trees:4,planters:4,bollards:9,depth:2.4});for(let r=0;r<10;r++){const s=-o+1.5+r*2.9;e.box([s-.06,.002,n+9],[s+.06,.02,n+13.5],i.TRIM)}for(const[r,s]of[[1,o],[-1,-o]])R(e,{axis:"x",sign:r,plane:s},-n+2,n-2,{floors:1,floorH:3,base:5.4,count:4,width:1.4,height:1.2})}return e}function vn(f){const e=new y,d=f<1,u=f<2,c=15,a=14,o=c/2,n=a/2,t=5,r=7,s=3.6,l=t+r*s;if(e.box([-o+.5,0,-n+.5],[o-.5,t,n-.5],i.SHOPFRONT,{roof:i.TRIM}),e.box([-o,t,-n],[o,l,n],i.GLASS,{roof:i.ROOF}),u){for(const p of[-1,1])for(const h of[-1,1])e.box([p*o-p*.55,0,h*n-h*.55],[p*o,t,h*n],i.CONCRETE);e.box([-o-.9,t-.7,-n-.9],[o+.9,t-.42,n+.9],i.CONCRETE);for(let p=1;p<=r;p++)A(e,-o,-n,o,n,t+p*s-.5,.5,.14);A(e,-o,-n,o,n,l,1.4,.45),I(e,-o+2,-n+2,o-2,n-2,l+1.4,61,1.3)}if(d){for(const[p,h,g,b]of[["z",1,n,o],["z",-1,-n,o],["x",1,o,n],["x",-1,-o,n]])for(let m=0;m<r;m++){const w=t+m*s+.35;e.windowRow({axis:p,sign:h,plane:g,from:-b+.6,to:b-.6,y0:w,y1:w+s-1.05,count:2,width:b*.85,glass:i.GLASS,frame:.07,proud:.05})}S(e,{axis:"z",sign:1,plane:n-.5},-o+1.4,o-1.4,{bays:4,doorBay:1,head:4.2,brandFascia:!1}),pe(e,{axis:"z",sign:1,plane:n},-2.4,2.4,t+.4,t+1.4),P(e,{axis:"z",sign:1,plane:n},-o+1,o-1,1.8,6)}return e}function Rn(f){const e=new y,d=f<1,u=f<2,c=9,a=12.5,o=c/2,n=a/2,t=4.4,r=3,s=3.3,l=t+r*s;if(e.box([-o,0,-n],[o,l,n],i.BRICK,{roof:i.ROOF}),u){A(e,-o,-n,o,n,l-.55,.55,.42),E(e,-o,-n,o,n,l,1.2,.24);for(let p=1;p<r;p++)A(e,-o,-n,o,n,t+p*s-.28,.28,.16);A(e,-o,-n,o,n,t-.2,.45,.22),I(e,-o+.8,-n+.8,o-.8,n-.8,l,71,.7)}if(d){S(e,{axis:"z",sign:1,plane:n},-o+.5,o-.5,{bays:2,doorBay:1,head:3.7}),Y(e,{axis:"z",sign:1,plane:n},-o+.6,.6,3.6,1.5),ue(e,{axis:"z",sign:1,plane:n},o-1.3,4.7,6.4,1.2);for(let p=0;p<r;p++){const h=t+p*s+.5;e.box([-2.4,h,n],[2.4,h+2.2,n+.6],i.BRICK),e.box([-2.6,h+2.2,n],[2.6,h+2.45,n+.75],i.TRIM),e.opening({axis:"z",sign:1,plane:n+.6,u0:-2.1,u1:2.1,y0:h+.35,y1:h+1.95,glass:i.GLASS,frame:.09,proud:.06})}R(e,{axis:"x",sign:1,plane:o},-n+1,n-1,{floors:r,floorH:s,base:t+.8,count:3,width:1.1,height:1.9}),ze(e,{axis:"x",sign:-1,plane:-o},-2.4,t+.4,r,s,3)}return e}const ke=[{id:"com.corner_shop",name:"Corner shop",zone:"commercial",density:"low",variant:"sculpted",footprint:[2,2],height:11.7,brand:G.grocer,sim:{jobs:12,powerKW:34,waterM3:3,garbagePerWeek:70,pollution:1,upkeep:26},note:"Two-storey brick shop with flats over, wrapping shopfront, awning and blade sign.",build:hn},{id:"com.diner",name:"Roadside diner",zone:"commercial",density:"low",variant:"sculpted",footprint:[3,3],height:8.5,brand:G.diner,sim:{jobs:16,powerKW:52,waterM3:8,garbagePerWeek:140,pollution:2,upkeep:34},note:"Low glazed box under deep brand eaves, entrance porch, pylon sign by the kerb.",build:gn},{id:"com.drivethru",name:"Drive-through",zone:"commercial",density:"low",variant:"sculpted",footprint:[3,2],height:9.5,brand:G.burger,sim:{jobs:22,powerKW:68,waterM3:10,garbagePerWeek:210,pollution:3,upkeep:40},note:"Brand band, wrapped lane under a canopy, order window, menu board and pylon.",build:bn},{id:"com.coffee",name:"Coffee bar",zone:"commercial",density:"low",variant:"sculpted",footprint:[2,3],height:4.7,brand:G.coffee,sim:{jobs:8,powerKW:26,waterM3:4,garbagePerWeek:60,pollution:1,upkeep:18},note:"Single storey with a terrace: tables, planters, awning and a hanging sign.",build:xn},{id:"com.strip",name:"Strip of units",zone:"commercial",density:"medium",variant:"sculpted",footprint:[4,3],height:6.3,brand:G.hardware,sim:{jobs:34,powerKW:96,waterM3:9,garbagePerWeek:260,pollution:2,upkeep:62},note:"Four units under one roof behind a colonnade, each with its own fascia and door.",build:mn},{id:"com.supermarket",name:"Supermarket",zone:"commercial",density:"medium",variant:"sculpted",footprint:[5,6],height:10.6,brand:G.grocer,sim:{jobs:70,powerKW:240,waterM3:26,garbagePerWeek:700,pollution:4,upkeep:130},note:"Big box done properly: raised brand band, entrance canopy, trolley bay, goods-in dock.",build:wn},{id:"com.office",name:"Office block",zone:"commercial",density:"high",variant:"sculpted",footprint:[2,3],height:32.6,brand:G.bank,sim:{jobs:180,powerKW:320,waterM3:30,garbagePerWeek:620,pollution:2,upkeep:210},note:"Curtain wall on a recessed retail base, spandrel band per floor, cornice, roof plant.",build:vn},{id:"com.boutique",name:"Boutique block",zone:"commercial",density:"medium",variant:"sculpted",footprint:[2,2],height:15.6,brand:G.bookshop,sim:{jobs:20,powerKW:48,waterM3:5,garbagePerWeek:110,pollution:1,upkeep:44},note:"Narrow three-storey with stacked bay windows, heavy cornice and a fire escape.",build:Rn}];function yn(f){const e=new y,d=f<1,u=f<2,c=11,a=7,o=4.2,n=-8,t=c/2;if(e.box([-t,0,n-a/2],[t,o,n+a/2],i.PLASTER,{roof:i.ROOF}),u){e.painted(x.BRAND,()=>de(e,-t,n-a/2,t,n+a/2,o-.9,1.2,.3)),I(e,-t+1,n-a/2+1,t-1,n+a/2-1,o+.3,81,.6);const r=15,s=10,l=5.6;e.box([-r/2,l,-s/2+2],[r/2,l+.5,s/2+2],i.CONCRETE),e.painted(x.BRAND,()=>de(e,-r/2,-s/2+2,r/2,s/2+2,l+.5,.85,.22)),e.painted(x.METAL_DARK,()=>{for(const p of[-r/2+1.6,r/2-1.6])for(const h of[-s/2+3.4,s/2+.6])e.box([p-.3,0,h-.3],[p+.3,l,h+.3],i.TRIM)});for(const p of[-3.4,3.4]){e.box([p-1.6,1e-4,-1.2],[p+1.6,.18,3.6],i.CONCRETE);for(const h of[0,2.4])e.box([p-.42,.18,h-.34],[p+.42,1.75,h+.34],i.PLASTER),e.painted(x.BRAND,()=>e.box([p-.46,1.5,h-.38],[p+.46,1.78,h+.38],i.TRIM)),e.painted(x.METAL_DARK,()=>e.box([p-.5,.9,h-.4],[p-.42,1.4,h+.4],i.TRIM))}we(e,-t-2.6,6,9,2.4)}return d&&(S(e,{axis:"z",sign:1,plane:n+a/2},-t+.6,t-.6,{bays:3,doorBay:1,head:3.2}),B(e,{axis:"z",sign:1,plane:n+a/2},-3.2,3.2,o-.75,o-.05),pe(e,{axis:"z",sign:1,plane:12},-4,4,6.4,7.4),P(e,{axis:"z",sign:1,plane:n+a/2},-t,t,1.2,5),e.painted(x.BRAND,()=>e.box([t-1.4,0,n+5],[t-.6,1.3,n+5.8],i.TRIM)),F(e,-t,t,n+a/2+1,81,{trees:2,planters:2,bollards:4,depth:1.8}),R(e,{axis:"x",sign:1,plane:t},n-a/2+1,n+a/2-1,{floors:1,floorH:3,base:1.6,count:2,width:1.1,height:1.5}),R(e,{axis:"x",sign:-1,plane:-t},n-a/2+1,n+a/2-1,{floors:1,floorH:3,base:1.6,count:2,width:1.1,height:1.5}),e.painted(x.METAL_DARK,()=>{e.box([-t+.6,0,n+5],[-t+1.4,1.1,n+5.8],i.TRIM);for(let r=0;r<3;r++)e.box([-t+2,r*.42,n+4.6],[-t+3.4,.4+r*.42,n+5.6],i.TRIM)})),e}function Tn(f){const e=new y,d=f<1,u=f<2,c=16,a=12,o=c/2,n=a/2,t=5.4;e.box([-o,0,-n],[o,t,n],i.PLASTER,{roof:i.ROOF});for(const r of[-1,1])e.box([r*o-r*1.2,0,n-.35],[r*o,t+.6,n+.45],i.CONCRETE);return u&&(E(e,-o,-n,o,n,t,1.1,.26),e.painted(x.BRAND,()=>e.box([-o+1.2,t,n-.2],[o-1.2,t+1.5,n+.5],i.TRIM)),I(e,-o+1.5,-n+1.5,o-1.5,n-1.5,t,91,1),e.box([-3.4,3.9,n],[3.4,4.3,n+2.2],i.CONCRETE)),d&&(S(e,{axis:"z",sign:1,plane:n},-o+1.4,o-1.4,{bays:5,doorBay:2,head:3.8}),B(e,{axis:"z",sign:1,plane:n+.45},-5,5,t+.25,t+1.25),e.painted(x.SIGN_LIT,()=>{e.box([o-3.4,3,n+.5],[o-1.6,3.6,n+.62],i.TRIM),e.box([o-2.85,2.45,n+.5],[o-2.15,4.15,n+.62],i.TRIM)}),R(e,{axis:"x",sign:1,plane:o},-n+1.2,n-1.2,{floors:1,floorH:3,base:2.2,count:3,width:1.1,height:1.5}),P(e,{axis:"z",sign:1,plane:n},-o+1,o-1,1.7,7),F(e,-o,o,n+.5,91,{trees:3,planters:3,bollards:7,depth:2.4}),R(e,{axis:"x",sign:-1,plane:-o},-n+1.2,n-1.2,{floors:1,floorH:3,base:2.2,count:3,width:1.1,height:1.5}),R(e,{axis:"z",sign:-1,plane:-n},-o+1.5,o-1.5,{floors:1,floorH:3,base:2.2,count:4,width:1.1,height:1.5}),$(e,-o+.5,o-.5,n+2.6,0,.95,1.3)),e}ke.push({id:"com.gas",name:"Filling station",zone:"commercial",density:"low",variant:"sculpted",footprint:[3,3],height:9,brand:G.electronics,sim:{jobs:10,powerKW:60,waterM3:3,garbagePerWeek:90,pollution:9,upkeep:44},note:"Forecourt canopy on columns, two pump islands, kiosk with shopfront, pylon by the road.",build:yn},{id:"com.pharmacy",name:"Pharmacy",zone:"commercial",density:"low",variant:"sculpted",footprint:[3,3],height:6.9,brand:G.pharmacy,sim:{jobs:14,powerKW:40,waterM3:4,garbagePerWeek:80,pollution:1,upkeep:30},note:"Single-storey unit between rendered pilasters, entrance canopy, lit cross.",build:Tn});function be(f,e,d,u,c){f.cylinder(e,d,u*1.06,0,1.1,14,i.TRIM),f.cylinder(e,d,u,1.1,c,16,i.METAL,!1),f.cone(e,d,u,u*.34,c,c+u*.8,16,i.METAL),f.cylinder(e,d,u*.34,c+u*.8,c+u*1.1,10,i.TRIM)}function fe(f,e,d,u,c){f.cylinder(e,d,u,0,c,12,i.TRIM,!1);for(let a=1;a<=3;a++){const o=a/4*c;f.cylinder(e,d,u*1.15,o,o+.5,12,i.METAL,!1)}}function Re(f,e,d,u,c,a,o=3){f.painted(x.METAL_DARK,()=>{const n=Math.max(2,Math.round((d-e)/3.6));for(let t=0;t<=n;t++){const r=e+t/n*(d-e);f.box([r-.18,0,u],[r+.18,a,u+.36],i.TRIM),f.box([r-.18,0,c-.36],[r+.18,a,c],i.TRIM),f.box([r-.24,a,u-.1],[r+.24,a+.5,c+.1],i.TRIM)}});for(let n=0;n<o;n++){const t=u+(n+1)/(o+1)*(c-u);f.pipe([e,a+.5,t],[d,a+.5,t],.22,i.METAL)}}function ye(f,e,d,u,c,a=5.2){f.box([e,.001,u],[d,1.2,u+2.4],i.CONCRETE),f.painted(x.METAL_DARK,()=>{for(let o=0;o<c;o++){const n=e+(o+.5)/c*(d-e);f.box([n-1.7,1.2,u-.14],[n+1.7,a,u+.02],i.TRIM)}}),f.box([e-.4,a+.9,u],[d+.4,a+1.25,u+2.8],i.METAL)}function Mn(f){const e=new y,d=f<2,u=25,c=17,a=9.2,o=2.6,n=u/2,t=c/2,r=-1.5;if(e.box([-n,0,r-t],[n,a,r+t],i.SHED_WALL,{roof:i.TRIM}),e.gable([-n,a,r-t],[n,a,r+t],o,"x",i.METAL,i.SHED_WALL),d){e.box([-n-.45,a-.35,r-t-.45],[n+.45,a,r+t+.45],i.TRIM),e.box([-n,a+o-.18,r-.35],[n,a+o+.2,r+.35],i.TRIM),ye(e,-n+1.5,n-1.5,r+t,3,5),e.painted(x.METAL_DARK,()=>e.box([n-3.4,0,r+t-.05],[n-2.2,2.4,r+t+.14],i.TRIM));for(const s of[-9,-5,0,5,9])e.cylinder(s,r,.7,a+o-.4,a+o+1.3,10,i.METAL);se(e,-n,r+t+3.2,n,r+t+4.4);for(let s=0;s<6;s++){const l=-n+2.4+s*3.5;e.box([l,a+1,r-t+2],[l+2.2,a+1.35,r-1],i.GLASS),e.box([l,a+1,r+1],[l+2.2,a+1.35,r+t-2],i.GLASS)}for(let s=0;s<8;s++){const l=-n+2+s*3;e.box([l-.07,.002,r+t+4.6],[l+.07,.02,r+t+11],i.TRIM)}e.painted(x.METAL_DARK,()=>{for(let s=0;s<14;s++){const l=-n-1+s*2;e.box([l-.07,0,r+t+11.4],[l+.07,2.2,r+t+11.55],i.TRIM)}e.box([-n-1.1,2.05,r+t+11.4],[n+1.1,2.2,r+t+11.55],i.TRIM)}),R(e,{axis:"x",sign:-1,plane:-n},r-t+1.5,r+t-1.5,{floors:2,floorH:3,base:2,count:3,width:1.2,height:1.4}),R(e,{axis:"z",sign:1,plane:r+t},n-8,n-4,{floors:1,floorH:3,base:5.6,count:2,width:1.2,height:1.3}),O(e,-n-2,r+t+9,5.2,241),O(e,n+2,r+t+9,5,243)}return e}function En(f){const e=new y,d=f<1,u=f<2,c=18,a=12,o=6.4,n=c/2,t=a/2;return e.box([-n,0,-t],[-n+6,o-1.4,t],i.BRICK,{roof:i.ROOF}),e.box([-n+6,0,-t],[n,o,t],i.SHED_WALL,{roof:i.TRIM}),e.gable([-n+6,o,-t],[n,o,t],1.8,"x",i.METAL,i.SHED_WALL),u&&(E(e,-n,-t,-n+6,t,o-1.4,.6,.2),e.box([-n+5.6,o-.3,-t-.4],[n+.4,o,t+.4],i.TRIM),e.painted(x.METAL_DARK,()=>{for(let r=0;r<2;r++){const s=-n+8.6+r*5.4;e.box([s-2.1,0,t-.12],[s+2.1,4.4,t+.06],i.TRIM)}}),e.box([-n+6,5,t],[n,5.35,t+2],i.METAL),I(e,-n+7,-t+1.5,n-1.5,t-1.5,o+1.8,211,.5)),d&&(R(e,{axis:"z",sign:1,plane:t},-n+.6,-n+5.4,{floors:2,floorH:2.4,base:1.3,count:2,width:1.1,height:1.4}),e.painted(x.DOOR,()=>e.opening({axis:"x",sign:-1,plane:-n,u0:-1,u1:0,y0:.16,y1:2.3,glass:i.TRIM,frame:.12,proud:.08})),F(e,-n,n,t,251,{trees:2,planters:1,bollards:5,depth:2.6}),R(e,{axis:"x",sign:-1,plane:-n},-t+1.2,t-1.2,{floors:2,floorH:2.4,base:1.3,count:2,width:1.1,height:1.4}),R(e,{axis:"z",sign:-1,plane:-t},-n+.8,-n+5.6,{floors:2,floorH:2.4,base:1.3,count:2,width:1.1,height:1.4}),e.painted(x.WOOD,()=>{for(let r=0;r<4;r++){const s=-n+4+r%2*2.6,l=t+3.4+Math.floor(r/2)*1.6;e.box([s,0,l],[s+1.9,1.1+r%3*.4,l+1.2],i.TRIM)}}),e.painted(x.METAL_DARK,()=>{for(let r=0;r<8;r++){const s=-n+r*2.6;e.box([s-.07,0,t+6.4],[s+.07,2.2,t+6.55],i.TRIM)}e.box([-n-.1,2.05,t+6.4],[n+.1,2.2,t+6.55],i.TRIM)})),e}function In(f){const e=new y,d=f<1,u=f<2,c=17,a=13,o=10.5,n=-ce*2+c/2+1,t=.4,r=n-c/2,s=n+c/2,l=t-a/2,p=t+a/2;if(e.box([r,0,l],[s,o,p],i.METAL,{roof:i.ROOF}),u){const g=c/5,b=3.4;for(let m=0;m<5;m++){const w=r+m*g,v=w+g;e.quad([w,o,p],[v,o,p],[v,o+b,l],[w,o+b,l],i.METAL),e.quad([w,o,l],[w,o+b,l],[v,o+b,l],[v,o,l],i.GLASS),e.tri([w,o,p],[w,o+b,l],[w,o,l],i.METAL),e.tri([v,o,p],[v,o,l],[v,o+b,l],i.METAL)}e.box([s-5,0,l-5.6],[s+3.2,17.5,l+.4],i.METAL,{roof:i.ROOF}),A(e,s-5,l-5.6,s+3.2,l+.4,17.5,.8,.3),be(e,7,-4,2.5,15),be(e,7,2.6,2,12),be(e,12.4,-1.2,1.6,9.5),fe(e,13.2,-7.6,1.15,23),ye(e,r+1,s-1,p,2,5.6),e.box([r-.4,0,p-6.4],[r+4.6,4,p-1.4],i.BRICK,{roof:i.ROOF}),E(e,r-.4,p-6.4,r+4.6,p-1.4,4,.45,.3)}if(d){for(const[h,g]of[[1,p],[-1,l]])e.windowRow({axis:"z",sign:h,plane:g,from:r+1.2,to:s-1.2,y0:6.8,y1:8.6,count:5,width:2.1,glass:i.GLASS,frame:.09,proud:.06});R(e,{axis:"x",sign:-1,plane:r-.4},p-5.8,p-2,{floors:1,floorH:3,base:1.2,count:3,width:.9,height:1.5}),Re(e,1,14,-6.6,-1,6.4),e.pipe([7,6.9,-4],[7,14,-4],.2,i.METAL),e.painted(x.METAL_DARK,()=>{for(let h=0;h<14;h++){const g=1+h*1.15;e.box([s+3.2,g,l-5.2+h*.32],[s+4.6,g+.12,l-4.6+h*.32],i.TRIM)}e.box([s+3.1,.8,l-5.4],[s+3.3,17.4,l-.6],i.TRIM),e.box([s+4.5,.8,l-5.4],[s+4.7,17.4,l-.6],i.TRIM);for(let h=0;h<12;h++){const g=h/12*Math.PI*2;e.box([7+Math.cos(g)*2.7-.06,15,-4+Math.sin(g)*2.7-.06],[7+Math.cos(g)*2.7+.06,16.1,-4+Math.sin(g)*2.7+.06],i.TRIM)}}),e.cylinder(7,-4,2.76,15,15.12,14,i.TRIM,!1);for(let h=0;h<3;h++)e.cylinder(r+3.4+h*4.6,t+3,.6,o+3.4,o+4.7,10,i.METAL)}return e}function An(f){const e=new y,d=f<1,u=f<2,c=[[-8,-4,4.6,11],[2,-4.5,5.4,13],[-7,6,3.6,8.5],[3.5,6.5,3,7]];for(const[a,o,n,t]of c)e.cylinder(a,o,n,0,t,18,i.METAL,!1),e.cone(a,o,n,n*.15,t,t+n*.22,18,i.METAL),A(e,a-n,o-n,a+n,o+n,0,.6,.08);if(u){e.box([-13.5,.001,-10],[9.5,1.5,11.5],i.CONCRETE),e.box([-13,.4,-9.5],[9,1.6,11],i.CONCRETE);for(const[a,o,n,t]of c)e.painted(x.METAL_DARK,()=>{for(let r=0;r<22;r++){const s=r/22*Math.PI*1.7,l=.6+r/22*(t-.9);e.box([a+Math.cos(s)*n-.5,l,o+Math.sin(s)*n-.5],[a+Math.cos(s)*n+.5,l+.1,o+Math.sin(s)*n+.5],i.TRIM)}});e.box([11.5,0,-8],[17,4.6,-1],i.BRICK,{roof:i.ROOF}),E(e,11.5,-8,17,-1,4.6,.5,.24),fe(e,15.5,4,.9,16)}if(d){Re(e,-12,16,12,15,5.4,4);for(const[a,o,n,t]of c)e.pipe([a,t*.5,o+n],[a,t*.5,13.5],.24,i.METAL),e.pipe([a,t*.5,13.5],[a,5.9,13.5],.24,i.METAL);R(e,{axis:"z",sign:-1,plane:-8},12.2,16.3,{floors:1,floorH:3,base:1.4,count:2,width:1,height:1.4}),e.painted(x.METAL_DARK,()=>{for(let a=0;a<6;a++)e.box([-13+a*3.8,0,12.6],[-11.8+a*3.8,1.1,13.8],i.TRIM)})}return e}function Sn(f){const e=new y,d=f<1,u=f<2,c=26,a=16,o=15,n=c/2,t=a/2;if(e.box([-n,0,-t],[n,o,t],i.SHED_WALL,{roof:i.TRIM}),e.gable([-n,o,-t],[n,o,t],3.2,"x",i.METAL,i.SHED_WALL),u&&(e.box([-n-.5,o-.4,-t-.5],[n+.5,o,t+.5],i.TRIM),e.box([-n+2,o+3.2,-2.2],[n-2,o+5,2.2],i.METAL,{roof:i.ROOF}),e.box([-n+1.8,o+5,-2.5],[n-1.8,o+5.4,2.5],i.TRIM),fe(e,n-3,-t-3.5,1.5,30),fe(e,n-7,-t-3.5,1.1,24),e.box([-n-7,0,-t+2],[-n,7,t-2],i.METAL,{roof:i.ROOF}),E(e,-n-7,-t+2,-n,t-2,7,.6,.25),ye(e,-n+3,n-3,t,3,6.5)),d){e.painted(x.METAL_DARK,()=>{for(const[r,s]of[[1,t],[-1,-t]])for(let l=0;l<9;l++){const p=-n+1.5+l*3.1;e.box([p-.2,9.5,s-r*.9],[p+.2,10.4,s],i.TRIM)}});for(const[r,s]of[[1,t],[-1,-t]])e.windowRow({axis:"z",sign:r,plane:s,from:-n+1.5,to:n-1.5,y0:11,y1:13.2,count:7,width:2.2,glass:i.GLASS,frame:.1,proud:.07});e.painted(x.METAL_DARK,()=>{e.box([-n-7,0,t-2.6],[-n-2,4.6,t-2.44],i.TRIM)}),Re(e,-n-6,-n-1,-t+1,t-1,8,2)}return e}function Ln(f){const e=new y,d=f<1,u=f<2,c=6,a=7,o=3.6;for(let n=0;n<3;n++){const t=-14+n*(c+.4);e.box([t,0,-10],[t+c,o,-10+.5],i.CONCRETE),e.box([t,0,-10],[t+.5,o,-10+a],i.CONCRETE),e.box([t+c-.5,0,-10],[t+c,o,-10+a],i.CONCRETE),u&&e.painted(n===1?x.WOOD:x.METAL_DARK,()=>{e.cone(t+c/2,-10+a*.55,2.4,.3,.001,2.6+n*.4,6,i.TRIM)})}return e.box([4,0,-6],[18,8,4],i.SHED_WALL,{roof:i.TRIM}),e.gable([4,8,-6],[18,8,4],2,"x",i.METAL,i.SHED_WALL),u&&(e.box([3.6,7.7,-6.4],[18.4,8,4.4],i.TRIM),e.painted(x.METAL_DARK,()=>{e.box([-4,2,6],[4.5,2.9,7.4],i.TRIM),e.box([-4,2.9,6],[4.5,3.05,6.15],i.TRIM),e.box([-4,2.9,7.25],[4.5,3.05,7.4],i.TRIM);for(const n of[-3.4,0,3.6])e.box([n-.16,0,6.3],[n+.16,2,6.62],i.TRIM),e.box([n-.16,0,6.9],[n+.16,2,7.22],i.TRIM)}),e.box([-16,.001,4],[-6,.22,9],i.CONCRETE),e.box([-5.2,0,5.4],[-2.6,3.2,8],i.BRICK,{roof:i.ROOF}),E(e,-5.2,5.4,-2.6,8,3.2,.4,.22),I(e,5,-5,17,3,10,221,.6)),d&&(R(e,{axis:"z",sign:1,plane:8},-5,-2.8,{floors:1,floorH:3,base:1.3,count:1,width:1.6,height:1.3}),e.painted(x.METAL_DARK,()=>{e.box([4,0,3.88],[9,6,4.06],i.TRIM);for(let n=0;n<16;n++){const t=-17+n*2.3;e.box([t-.08,0,10.4],[t+.08,2.4,10.56],i.TRIM)}e.box([-17.2,2.2,10.4],[18.4,2.35,10.56],i.TRIM)}),O(e,-16.5,-8,5,231),O(e,18.5,8,4.6,233),F(e,-17,2,10.6,261,{trees:3,planters:2,bollards:6,depth:2.2}),e.painted(x.METAL_DARK,()=>{for(let n=0;n<3;n++){const t=-16+n*4.4;e.box([t,0,.5],[t+3.4,1.5,2.6],i.TRIM),e.box([t+.1,1.5,.6],[t+3.3,1.62,2.5],i.TRIM)}}),e.painted(x.WOOD,()=>{for(let n=0;n<6;n++)e.box([-16+n%3*1.9,Math.floor(n/3)*1.3,-4],[-14.4+n%3*1.9,1.2+Math.floor(n/3)*1.3,-2.2],i.TRIM)}),R(e,{axis:"z",sign:-1,plane:-6},5,17,{floors:1,floorH:3,base:5.2,count:4,width:1.3,height:1.4})),e}const Z=(f,e,d)=>({jobs:f,powerKW:f*3.2,waterM3:f*.2,garbagePerWeek:f*7.5,pollution:e,upkeep:d}),On=[{id:"ind.shed",name:"Distribution shed",zone:"industrial",density:"none",variant:"sculpted",footprint:[4,5],height:13.1,sim:Z(40,8,90),note:"Shed, three shutters, canopy and loading apron. Corrugation is shader.",build:Mn},{id:"ind.workshop",name:"Workshop unit",zone:"industrial",density:"none",variant:"sculpted",footprint:[3,4],height:9.5,sim:Z(18,5,44),note:"Brick office end against a metal workshop, two roller doors, canopy.",build:En},{id:"ind.plant",name:"Processing plant",zone:"industrial",density:"none",variant:"sculpted",footprint:[4,3],height:23,sim:Z(40,14,105),note:"Sawtooth shed, process block, three silos, banded stack, pipe rack, dock.",build:In},{id:"ind.tanks",name:"Tank farm",zone:"industrial",density:"none",variant:"sculpted",footprint:[5,4],height:16,sim:Z(12,18,80),note:"Four tanks in a bund with spiral stairs, pump house, stack, pipe rack.",build:An},{id:"ind.foundry",name:"Heavy works",zone:"industrial",density:"none",variant:"sculpted",footprint:[5,4],height:32,sim:Z(60,22,150),note:"One tall bay with a crane rail and roof monitor, two stacks, annexe, dock.",build:Sn},{id:"ind.recycling",name:"Recycling yard",zone:"industrial",density:"none",variant:"sculpted",footprint:[5,4],height:10,sim:Z(24,12,70),note:"Open yard: storage bays with heaps, sorting shed, conveyor, weighbridge.",build:Ln}],H=[...pn,...ke,...On];for(const f of H)f.height=Math.round(f.build(0).bounds().max[1]*10)/10;const Cn=`// Facade shading for procedural assets.
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

  let back = vec3f(0.052, 0.050, 0.056) * (0.7 + r * 0.7);
  var col = back;

  // Ceiling and floor, seen at an angle through the opening.
  col = mix(col, vec3f(0.115, 0.112, 0.108), smoothstep(0.72, 0.98, p.y));
  col = mix(col, vec3f(0.070, 0.062, 0.056), smoothstep(0.30, 0.04, p.y));

  // A block of furniture in the lower half, its width and place from the hash.
  let fx = 0.12 + fract(r * 7.3) * 0.55;
  let fw = 0.16 + fract(r * 3.1) * 0.26;
  let fh = 0.16 + fract(r * 5.7) * 0.22;
  if (p.x > fx && p.x < fx + fw && p.y < fh + 0.06) {
    col = vec3f(0.088, 0.078, 0.070) * (0.8 + r * 0.5);
  }

  if (lit) {
    // Warm bounce, strongest at the ceiling where the fitting is.
    let glow = smoothstep(0.15, 1.0, p.y);
    col = mix(col, vec3f(0.72, 0.60, 0.40), 0.30 + glow * 0.45);
    if (p.y > 0.86) { col = vec3f(0.88, 0.80, 0.60); }
  }

  // A blind, pulled down to a height that varies per opening.
  let blind = 0.30 + fract(r * 11.7) * 0.62;
  if (fract(r * 2.9) > 0.45 && p.y > 1.0 - blind) {
    let slat = 0.55 + 0.45 * step(0.5, fract(p.y * 34.0));
    col = mix(col, vec3f(0.30, 0.29, 0.27) * slat, 0.92);
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
    // What the pane reflects, brighter higher up where it sees more sky.
    let refl = glassColour(seed) * (1.1 + r * 0.5) + vec3f(0.02, 0.03, 0.045) * in.world.y * 0.02;
    col = mix(inside, refl, 0.26 + 0.2 * (1.0 - clamp(dot(normalize(in.normal), -normalize(in.world - scene.eye.xyz)), 0.0, 1.0)));
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
`,re="depth24plus",xe="depth24plus",me=1024,Se=240,J=(()=>{const f=[.48,.68,.38],e=Math.hypot(...f);return[f[0]/e,f[1]/e,f[2]/e]})();class zn{constructor(e,d=!0){this.gpu=e,this.shadows=d,this.buildPipelines(),this.buildGround(),this.resizeDepth(),e.onResize(()=>this.resizeDepth()),this.hookInput()}pipeline;wirePipeline;shadowPipeline;shadowBindGroup;sceneBuffer;bindGroup;depth=null;depthView;shadowView;ground;current=null;alive=!0;shadows=!0;dummyShadow=null;debug={frames:0,indices:0,height:0,radius:0,distance:0,error:""};yaw=Math.PI*.75;pitch=.36;distance=30;spin=!0;wireframe=!1;lod=0;asset=H[0];view=X();proj=X();viewProj=X();sunView=X();sunProj=X();sunViewProj=X();sceneData=new Float32Array(Se/4);groundRadius=60;buildPipelines(){const{device:e,format:d}=this.gpu,u=e.createShaderModule({label:"asset",code:Cn}),c=e.createTexture({label:"shadow-map",size:{width:me,height:me},format:xe,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});this.shadowView=c.createView();const a=e.createTexture({label:"shadow-off",size:{width:1,height:1},format:xe,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING});this.dummyShadow=a.createView();const o=e.createCommandEncoder();o.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:this.dummyShadow,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}}).end(),e.queue.submit([o.finish()]);const n=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"depth"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"comparison"}}]}),t=e.createPipelineLayout({bindGroupLayouts:[n]}),r=[{arrayStride:K*4,attributes:[{shaderLocation:0,offset:0,format:"float32x3"},{shaderLocation:1,offset:12,format:"float32x3"},{shaderLocation:2,offset:24,format:"float32"},{shaderLocation:3,offset:28,format:"float32"},{shaderLocation:4,offset:32,format:"float32"},{shaderLocation:5,offset:36,format:"float32x2"}]}];this.pipeline=e.createRenderPipeline({label:"asset-solid",layout:t,vertex:{module:u,entryPoint:"vs",buffers:r},fragment:{module:u,entryPoint:"fs",targets:[{format:d}]},primitive:{topology:"triangle-list",cullMode:"back",frontFace:"ccw"},depthStencil:{format:re,depthWriteEnabled:!0,depthCompare:"less"}}),this.wirePipeline=e.createRenderPipeline({label:"asset-wire",layout:t,vertex:{module:u,entryPoint:"vs",buffers:r},fragment:{module:u,entryPoint:"fs_wire",targets:[{format:d}]},primitive:{topology:"line-list"},depthStencil:{format:re,depthWriteEnabled:!1,depthCompare:"less-equal"}});const s=e.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}}]}),l=e.createPipelineLayout({bindGroupLayouts:[s]});this.shadowPipeline=e.createRenderPipeline({label:"asset-shadow",layout:l,vertex:{module:u,entryPoint:"vs_shadow",buffers:r},primitive:{topology:"triangle-list",cullMode:"front",frontFace:"ccw"},depthStencil:{format:xe,depthWriteEnabled:!0,depthCompare:"less"}}),this.sceneBuffer=e.createBuffer({size:Se,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.shadowBindGroup=e.createBindGroup({layout:s,entries:[{binding:0,resource:{buffer:this.sceneBuffer}}]}),this.bindGroup=e.createBindGroup({layout:n,entries:[{binding:0,resource:{buffer:this.sceneBuffer}},{binding:1,resource:this.shadows?this.shadowView:this.dummyShadow??this.shadowView},{binding:2,resource:e.createSampler({compare:"less"})}]})}buildGround(){const{device:e}=this.gpu,d=400,u=new Float32Array([-d,0,-d,0,1,0,8,1,0,0,0,d,0,-d,0,1,0,8,1,0,0,0,d,0,d,0,1,0,8,1,0,0,0,-d,0,d,0,1,0,8,1,0,0,0]),c=new Uint32Array([0,2,1,0,3,2]),a=e.createBuffer({size:u.byteLength,usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(a,0,u);const o=e.createBuffer({size:c.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});e.queue.writeBuffer(o,0,c),this.ground={vertices:a,indices:o,count:c.length}}resizeDepth(){const e=this.gpu.viewport;this.depth?.destroy(),this.depth=this.gpu.device.createTexture({size:{width:e.width,height:e.height},format:re,usage:GPUTextureUsage.RENDER_ATTACHMENT}),this.depthView=this.depth.createView()}hookInput(){const e=this.gpu.canvas;let d=!1,u=0,c=0;e.addEventListener("pointerdown",a=>{d=!0,u=a.clientX,c=a.clientY,e.setPointerCapture(a.pointerId),this.spin=!1,document.getElementById("spin")?.classList.remove("on")}),e.addEventListener("pointerup",a=>{d=!1,e.hasPointerCapture(a.pointerId)&&e.releasePointerCapture(a.pointerId)}),e.addEventListener("pointermove",a=>{d&&(this.yaw-=(a.clientX-u)*.007,this.pitch=Me(this.pitch+(a.clientY-c)*.005,-.15,1.35),u=a.clientX,c=a.clientY)}),e.addEventListener("wheel",a=>{a.preventDefault(),this.distance=Me(this.distance*Math.exp(a.deltaY*.0012),4,400)},{passive:!1})}select(e,d=this.lod){this.asset=e,this.lod=d;const u=e.build(d).build(),{device:c}=this.gpu;this.current?.vertices.destroy(),this.current?.indices.destroy(),this.current?.edges.destroy();const a=c.createBuffer({size:Math.max(u.vertices.byteLength,4),usage:GPUBufferUsage.VERTEX|GPUBufferUsage.COPY_DST});c.queue.writeBuffer(a,0,u.vertices);const o=c.createBuffer({size:Math.max(u.indices.byteLength,4),usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});c.queue.writeBuffer(o,0,u.indices);const n=new Uint32Array(u.indices.length*2);for(let l=0;l<u.indices.length;l+=3){const p=u.indices[l],h=u.indices[l+1],g=u.indices[l+2],b=l*2;n[b]=p,n[b+1]=h,n[b+2]=h,n[b+3]=g,n[b+4]=g,n[b+5]=p}const t=c.createBuffer({size:Math.max(n.byteLength,4),usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});c.queue.writeBuffer(t,0,n);let r=0,s=1;for(let l=0;l<u.vertices.length;l+=K)r=Math.max(r,u.vertices[l+1]),s=Math.max(s,Math.hypot(u.vertices[l],u.vertices[l+2]));this.current={vertices:a,indices:o,indexCount:u.indices.length,edges:t,edgeCount:n.length,bounds:{height:r,radius:s},triangles:u.indices.length/3},this.distance=Math.max(r*1.5,s*3.4,12),this.groundRadius=Math.max(r,s)*4.5+20,Pn(e,this.current.triangles,d),Bn(e.id)}setLod(e){this.select(this.asset,e)}toggleWire(){return this.wireframe=!this.wireframe,this.wireframe}toggleSpin(){return this.spin=!this.spin,this.spin}rebuild(){this.current=null,this.buildPipelines(),this.buildGround(),this.resizeDepth(),this.select(this.asset,this.lod),this.alive=!0}suspend(){this.alive=!1}frame(e){if(!this.alive)return;this.spin&&(this.yaw+=e*.4);const d=this.gpu.viewport;this.render(this.gpu.context.getCurrentTexture().createView(),this.depthView,d.width,d.height)}async capture(e,d){if(!this.alive)return"";const{device:u}=this.gpu,c=Math.ceil(e/64)*64,a=u.createTexture({size:{width:c,height:d},format:this.gpu.format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),o=u.createTexture({size:{width:c,height:d},format:re,usage:GPUTextureUsage.RENDER_ATTACHMENT});this.render(a.createView(),o.createView(),c,d);const n=c*4,t=u.createBuffer({size:n*d,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),r=u.createCommandEncoder();r.copyTextureToBuffer({texture:a},{buffer:t,bytesPerRow:n},[c,d]),u.queue.submit([r.finish()]),await t.mapAsync(GPUMapMode.READ);const s=new Uint8ClampedArray(t.getMappedRange().slice(0));if(t.unmap(),t.destroy(),a.destroy(),o.destroy(),this.gpu.format.startsWith("bgra"))for(let h=0;h<s.length;h+=4){const g=s[h];s[h]=s[h+2],s[h+2]=g}const l=document.createElement("canvas");l.width=e,l.height=d;const p=l.getContext("2d");return p?(p.putImageData(new ImageData(s,c,d),0,0),l.toDataURL("image/png")):""}render(e,d,u,c){const a=this.current;if(!a||!this.alive)return;const{device:o}=this.gpu,n={width:u,height:c},t=[0,a.bounds.height*.45,0],r=Math.cos(this.pitch),s=[t[0]+this.distance*r*Math.sin(this.yaw),t[1]+this.distance*Math.sin(this.pitch)+a.bounds.height*.12,t[2]+this.distance*r*Math.cos(this.yaw)];Ee(this.view,s,t,[0,1,0]),_e(this.proj,42*Math.PI/180,n.width/Math.max(n.height,1),.2,2e3),Ie(this.viewProj,this.proj,this.view);const l=Math.max(a.bounds.radius*1.7,a.bounds.height*.9,8),p=[0,a.bounds.height*.5,0],h=[p[0]+J[0]*l*2.6,p[1]+J[1]*l*2.6,p[2]+J[2]*l*2.6];Ee(this.sunView,h,p,[0,1,0]),He(this.sunProj,-l,l,-l,l,.5,l*6),Ie(this.sunViewProj,this.sunProj,this.sunView),this.sceneData.set(this.viewProj,0),this.sceneData.set(this.sunViewProj,16),this.sceneData.set([s[0],s[1],s[2],0],32),this.sceneData.set([J[0],J[1],J[2],0],36),this.sceneData.set([this.asset.id.length*7.3+this.asset.id.charCodeAt(0),1/me,this.groundRadius,0],40);const g=this.asset.brand??Ve;this.sceneData.set([g.colour[0],g.colour[1],g.colour[2],1],44),this.sceneData.set([g.accent[0],g.accent[1],g.accent[2],1],48);const b=(g.name||"").toUpperCase().slice(0,16),m=new Uint32Array(4);for(let M=0;M<b.length;M++)m[M>>2]|=(b.charCodeAt(M)&255)<<M%4*8;new Uint32Array(this.sceneData.buffer,208,4).set(m),this.sceneData.set([b.length,0,0,0],56),o.queue.writeBuffer(this.sceneBuffer,0,this.sceneData);const w=o.createCommandEncoder();if(this.shadows){const M=w.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:this.shadowView,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});M.setPipeline(this.shadowPipeline),M.setBindGroup(0,this.shadowBindGroup),M.setVertexBuffer(0,a.vertices),M.setIndexBuffer(a.indices,"uint32"),M.drawIndexed(a.indexCount),M.end()}const v=w.beginRenderPass({colorAttachments:[{view:e,clearValue:{r:.043,g:.055,b:.075,a:1},loadOp:"clear",storeOp:"store"}],depthStencilAttachment:{view:d,depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});v.setBindGroup(0,this.bindGroup),v.setPipeline(this.pipeline),v.setVertexBuffer(0,this.ground.vertices),v.setIndexBuffer(this.ground.indices,"uint32"),v.drawIndexed(this.ground.count),v.setVertexBuffer(0,a.vertices),v.setIndexBuffer(a.indices,"uint32"),v.drawIndexed(a.indexCount),this.wireframe&&(v.setPipeline(this.wirePipeline),v.setVertexBuffer(0,a.vertices),v.setIndexBuffer(a.edges,"uint32"),v.drawIndexed(a.edgeCount)),v.end(),o.queue.submit([w.finish()]),this.debug.frames++,this.debug.indices=a.indexCount,this.debug.height=a.bounds.height,this.debug.radius=a.bounds.radius,this.debug.distance=this.distance}}const kn=[["residential · low",f=>f.zone==="residential"&&f.density==="low"],["residential · medium",f=>f.zone==="residential"&&f.density==="medium"],["residential · high",f=>f.zone==="residential"&&f.density==="high"],["commercial",f=>f.zone==="commercial"],["industrial",f=>f.zone==="industrial"]];function Bn(f){for(const e of document.querySelectorAll(".item"))e.classList.toggle("on",e.dataset.id===f)}function Pn(f,e,d){const u=document.getElementById("info");if(!u)return;const c=[0,1,2].map(n=>f.build(n).triangleCount),a=(n,t)=>`<div class="row"><span>${n}</span><b>${t}</b></div>`,o=f.sim;u.innerHTML=a("variant",f.variant)+a("footprint",`${f.footprint[0]}×${f.footprint[1]} cells · ${f.footprint[0]*8}×${f.footprint[1]*8} m`)+a("height",`${f.height.toFixed(1)} m`)+a(`triangles (LOD ${d})`,e.toLocaleString())+a("LOD ladder",c.map(n=>n.toLocaleString()).join(" → "))+(o.households?a("households",String(o.households)):"")+(o.jobs?a("jobs",String(o.jobs)):"")+a("power",`${o.powerKW} kW`)+a("upkeep",`${o.upkeep}/wk`)+`<div class="note">${f.note}</div>`}function Dn(f){const e=document.getElementById("list");if(e)for(const[d,u]of kn){const c=H.filter(u);if(!c.length)continue;const a=document.createElement("div");a.className="group",a.textContent=d,e.appendChild(a);for(const o of c){const n=document.createElement("div");n.className="item",n.dataset.id=o.id,n.innerHTML=`<div class="n">${o.name}</div><div class="m">${o.variant} · ${o.build(0).triangleCount.toLocaleString()} tris</div>`,n.addEventListener("click",()=>f(o)),e.appendChild(n)}}}function N(f,e){const d=document.getElementById("stage")??document.body;let u=document.getElementById("fatal");u||(u=document.createElement("div"),u.id="fatal",d.appendChild(u)),u.innerHTML=`<div style="font-size:15px;margin-bottom:12px">${f}</div><div style="color:#5d6b80;font-size:11px;white-space:pre-wrap;max-width:60ch;text-align:left;line-height:1.7">${e.replace(/[<>&]/g,"")}</div><div style="color:#5d6b80;font-size:11px;margin-top:14px">press \` for the log</div>`,le.error("viewer",`${f} — ${e}`)}window.__viewerBooted=!0;async function Nn(){const f=document.getElementById("gpu-canvas");if(!(f instanceof HTMLCanvasElement))return;const e=document.getElementById("stage");e&&Ne(e),addEventListener("error",h=>N("Something broke",`${h.message} @ ${h.filename}:${h.lineno}`)),addEventListener("unhandledrejection",h=>N("Something broke",String(h.reason)));let d;try{d=await Ge.create(f)}catch(h){h instanceof Fe?N("This browser has no usable WebGPU",`${h.kind}: ${h.message}

Chrome or Edge 113+, Safari 18+, or Firefox 141+ on Windows.`):N("Could not start the GPU",String(h));return}d.device.addEventListener("uncapturederror",h=>{N("The GPU rejected something",h.error.message)});const u=new URLSearchParams(location.search);d.device.pushErrorScope("validation");let c;try{c=new zn(d,!u.has("noshadow"))}catch(h){d.device.popErrorScope(),N("Could not build the render pipelines",String(h));return}const a=await d.device.popErrorScope();if(a){N("The GPU rejected a pipeline",a.message);return}let o=!1;d.onLost(async()=>{if(!o){o=!0,c.suspend();try{await d.recover(),c.rebuild(),le.info("viewer","device recovered")}catch(h){le.error("viewer",`recovery failed: ${String(h)}`)}o=!1}}),Dn(h=>c.select(h));const n=u,t=H.find(h=>h.id===n.get("asset"))??H[0],r=Number(n.get("lod")??0);if(n.get("spin")==="0"&&c.toggleSpin(),n.get("hud")==="0"){for(const h of["side","bar","info","hint"])document.getElementById(h)?.remove();document.getElementById("app")?.style.setProperty("grid-template-columns","1fr")}try{c.select(t,r)}catch(h){N("Could not build that asset",String(h));return}Object.defineProperty(window,"viewer",{value:{show(h,g){const b=H.find(m=>m.id===h);return b?(c.select(b,g),!0):!1},ids:H.map(h=>h.id),capture:(h,g)=>c.capture(h,g),alive:()=>!o}});for(const h of document.querySelectorAll("[data-lod]"))h.addEventListener("click",()=>{for(const g of document.querySelectorAll("[data-lod]"))g.classList.remove("on");h.classList.add("on"),c.setLod(Number(h.dataset.lod))});document.getElementById("wire")?.addEventListener("click",h=>{h.currentTarget.classList.toggle("on",c.toggleWire())}),document.getElementById("spin")?.addEventListener("click",h=>{h.currentTarget.classList.toggle("on",c.toggleSpin())});let s=performance.now(),l=0;const p=h=>{const g=Math.min((h-s)/1e3,.1);s=h;try{c.frame(g),l++}catch(b){N("The render loop threw",String(b));return}requestAnimationFrame(p)};if(requestAnimationFrame(p),setTimeout(()=>{l===0&&N("Nothing rendered","The render loop never completed a frame.")},2500),n.get("hud")!=="0"){const h=document.createElement("div");h.style.cssText=["position:absolute","left:14px","bottom:34px","color:#5d6b80","font:11px/1.6 var(--mono)","pointer-events:none","white-space:pre"].join(";"),document.getElementById("stage")?.appendChild(h),setInterval(()=>{const g=c.debug,b=d.canvas;h.textContent=`frames ${g.frames}   tris ${g.indices/3|0}   size ${g.height.toFixed(1)}m r${g.radius.toFixed(1)}   cam ${g.distance.toFixed(0)}m
canvas ${b.width}x${b.height}   ${d.format}   shadows ${u.has("noshadow")?"off":"on"}`},400)}le.info("viewer",`${H.length} assets`)}Nn();
//# sourceMappingURL=asset-BQA9_FcZ.js.map
