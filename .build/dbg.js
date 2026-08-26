const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
  const p=await b.newPage({viewport:{width:1200,height:700}});
  p.on('pageerror',e=>console.log('PAGEERROR',e.message));
  await p.goto('file:///home/user/Subnautica-2/city.html');
  await p.waitForTimeout(16000);
  console.log(JSON.stringify(await p.evaluate(()=>{
    SIM.hour=12;SIM.speed=0;updateSun(12);
    const st={};
    gl.bindFramebuffer(gl.FRAMEBUFFER,RT.colF);
    st.colF=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER,RT.aoF);
    st.aoF=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER,RT.b0F);
    st.b0F=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER,RT.ldrF);
    st.ldrF=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER,RT.shadowF);
    st.shF=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    st.hdrFloat=!!EXT_F16; st.RW=RW; st.RH=RH; st.cw=cv.width; st.ch=cv.height;
    st.err=gl.getError();
    st.cam={ex:CAM.ex|0,ey:CAM.ey|0,ez:CAM.ez|0,tx:CAM.dTx|0,tz:CAM.dTz|0,d:CAM.dDist|0};
    st.terr=A.terr.length; st.dyn=dynBatches.length;
    return st;
  })));
  await p.waitForTimeout(1500);
  // read the LDR buffer center pixel
  console.log(JSON.stringify(await p.evaluate(()=>{
    const px=new Uint8Array(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER,RT.ldrF);
    gl.readPixels(RW>>1,RH>>1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);
    const px2=new Uint8Array(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER,RT.aoF);
    gl.readPixels(AOW>>1,AOH>>1,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px2);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    return {ldr:[...px],ao:[...px2],err:gl.getError()};
  })));
  await p.screenshot({path:'/home/user/Subnautica-2/shots/dbg.png'});
  await b.close();
})();
