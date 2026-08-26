const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  const p=await b.newPage({viewport:{width:900,height:600}});
  p.on('pageerror',e=>console.log('PAGEERROR',e.message));
  await p.goto('file:///home/user/Subnautica-2/city.html');
  await p.waitForTimeout(14000);
  console.log(JSON.stringify(await p.evaluate(()=>{
    const ls=[...lots.values()];
    const z=ls.filter(l=>l.zone).length;
    const svc=ls.filter(l=>l.pow&&l.wat&&l.sew).length;
    const pw=ls.filter(l=>l.pow).length, wa=ls.filter(l=>l.wat).length, se=ls.filter(l=>l.sew).length;
    const s0=[...services.values()].map(s=>({k:s.kind,node:s.node,rc:roadComp.get(s.node),pc:pipeComp.get(s.node)}));
    const e0=[...edges.values()][0];
    return {lots:ls.length,zoned:z,serviced:svc,pw,wa,se,svcs:s0,built:ls.filter(l=>l.lvl).length,
      e0:{a:e0.a,rc:roadComp.get(e0.a),pipe:e0.pipe,pc:pipeComp.get(e0.a)},
      pipeCompSize:pipeComp.size, roadCompSize:roadComp.size,
      dem:SIM.demand, pipedEdges:[...edges.values()].filter(e=>e.pipe).length, edges:edges.size,
      zoneCount:[0,1,2,3].map(z=>ls.filter(l=>l.zone===z).length),
      starving:SIM.starving, prod:[SIM.powProd,SIM.watProd,SIM.sewCap],
      use:[SIM.powUse,SIM.watUse,SIM.sewUse]};
  })));
  await b.close();
})();
