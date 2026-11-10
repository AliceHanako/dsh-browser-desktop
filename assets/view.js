import RFB from './novnc/core/rfb.js';
const desktop=document.querySelector('#desktop'), status=document.querySelector('#status');
let rfb=null, fitted=true;
function report(text){status.textContent=text;}
async function connect(){
 if(rfb){const old=rfb;rfb=null;old.disconnect();}
 desktop.dataset.connected='false';report('连接中…');
 try{
  const response=await fetch('./session',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw new Error(response.status===401?'DSH 登录已失效，请重新登录主页面':'无法取得桌面凭据（'+response.status+'）');
  const session=await response.json();
  const ws=new URL('./websockify',location.href);ws.protocol=location.protocol==='https:'?'wss:':'ws:';
  const current=new RFB(desktop,ws.href,{credentials:{password:session.password}});rfb=current;
  current.scaleViewport=fitted;current.resizeSession=false;current.showDotCursor=true;
  current.qualityLevel=6;current.compressionLevel=4;
  current.addEventListener('connect',()=>{if(rfb!==current)return;desktop.dataset.connected='true';report('已连接 · 可操作');});
  current.addEventListener('disconnect',e=>{if(rfb!==current)return;desktop.dataset.connected='false';report(e.detail.clean?'已断开':'连接中断，可点击重连');});
  current.addEventListener('securityfailure',()=>{if(rfb===current)report('桌面认证失败，请检查服务');});
 }catch(e){report(e.message||String(e));}
}
document.querySelector('#connect').addEventListener('click',connect);
document.querySelector('#disconnect').addEventListener('click',()=>{if(rfb)rfb.disconnect();});
document.querySelector('#fit').addEventListener('click',e=>{fitted=!fitted;if(rfb)rfb.scaleViewport=fitted;e.currentTarget.textContent=fitted?'原始大小':'适应窗口';});
document.querySelector('#fullscreen').addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen();});
async function openPage(url){
 try{
  const response=await fetch('./open',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})});
  const result=await response.json();if(!response.ok||!result.ok)throw new Error(result.message||'打开请求失败');
  report('已请求服务器浏览器打开网页');
 }catch(e){report(e.message||String(e));}
}
document.querySelector('#open-form').addEventListener('submit',e=>{e.preventDefault();openPage(document.querySelector('#url').value);});
document.querySelector('#moodboard').addEventListener('click',()=>openPage(new URL('/aurabot/api/ext/moodboard/board',location.origin).href));
window.addEventListener('pagehide',()=>{if(rfb)rfb.disconnect();});
connect();
