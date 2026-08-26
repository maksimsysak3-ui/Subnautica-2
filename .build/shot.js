const {chromium}=require('playwright');
(async()=>{
  const args=process.argv.slice(2);
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox',
          '--enable-webgl','--ignore-gpu-blocklist','--disable-dev-shm-usage']});
  const p=await b.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
  const errs=[];
  p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.type()+': '+m.text().slice(0,300));});
  p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message.slice(0,600)));
  await p.goto('file:///home/user/Subnautica-2/city.html');
  await p.waitForTimeout(+(args[0]||22000));
  const st=await p.evaluate(()=>{try{return{pop:SIM.pop,cash:Math.round(SIM.cash),built:SIM.built,
    lots:lots.size,edges:edges.size,veh:VEH.n,ped:PED.n,tris:STAT.tris,draws:STAT.draws,
    pow:[Math.round(SIM.powProd),Math.round(SIM.powUse)],wat:[Math.round(SIM.watProd),Math.round(SIM.watUse)],
    sew:[Math.round(SIM.sewCap),Math.round(SIM.sewUse)],hap:+SIM.happy.toFixed(2),
    demand:SIM.demand,hour:+SIM.hour.toFixed(1)};}catch(e){return 'EVAL:'+e.message;}});
  console.log(JSON.stringify(st));
  console.log(errs.slice(0,14).join('\n')||'NO ERRORS');
  await p.screenshot({path:'/home/user/Subnautica-2/shots/'+(args[1]||'a')+'.png'});
  await b.close();
})();
