const {chromium}=require('playwright');
(async()=>{
  const [wait,name,tx,tz,dist,yaw,pitch,hour,spd]=process.argv.slice(2);
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  const p=await b.newPage({viewport:{width:1600,height:900}});
  const errs=[];p.on('pageerror',e=>errs.push('PAGEERROR '+e.message));
  await p.goto('file:///home/user/Subnautica-2/city.html');
  await p.waitForTimeout(+wait);
  await p.evaluate(a=>{
    CAM.tx=a.tx;CAM.tz=a.tz;CAM.dist=a.d;CAM.yaw=a.y;CAM.pitch=a.p;
    CAM.dTx=a.tx;CAM.dTz=a.tz;CAM.dDist=a.d;CAM.dYaw=a.y;CAM.dPitch=a.p;
    SIM.hour=a.h;SIM.speed=+a.s;updateSun(a.h);
    document.getElementById('hint').classList.remove('on');
  },{tx:+tx,tz:+tz,d:+dist,y:+yaw,p:+pitch,h:+hour,s:spd||'1'});
  await p.waitForTimeout(2600);
  await p.screenshot({path:'/home/user/Subnautica-2/shots/'+name+'.png'});
  console.log(errs.join('\n')||'ok '+name);
  await b.close();
})();
