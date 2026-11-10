import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { connect } from 'node:net';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';

export const name='browser-desktop';
export const inject=['webServer','connection'];
const BASE='/browser-desktop', VIEW=BASE+'/view';
const ASSETS=fileURLToPath(new URL('./assets/',import.meta.url));
const NOVNC='/usr/share/novnc';
const SECRET=process.env.DSH_BROWSER_SESSION_FILE || path.join(homedir(),'.config/dsh-browser-desktop/session.json');
const MIME={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.wasm':'application/wasm','.ico':'image/x-icon'};
function securityHeaders(res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Pragma','no-cache');
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','SAMEORIGIN');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' blob: data:; frame-ancestors 'self'; base-uri 'none'; object-src 'none'");
 res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), fullscreen=(self)');
}
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));}
function rejection(ctx,req){
 try{const connection=ctx.get('connection');if(typeof connection?.requestRejection!=='function')return 403;const result=connection.requestRejection(req);return result===undefined?undefined:Number.isInteger(result)&&result>=400&&result<=599?result:403;}catch{return 403;}
}
function sameOrigin(req){
 try{const u=new URL(String(req.headers.origin||''));return ['http:','https:'].includes(u.protocol)&&u.host.toLowerCase()===String(req.headers.host||'').toLowerCase();}catch{return false;}
}
async function sendFile(req,res,file){
 const info=await stat(file);if(!info.isFile()){json(res,404,{ok:false});return;}
 res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream','Content-Length':info.size});
 if(req.method==='HEAD'){res.end();return;}
 const stream=createReadStream(file);stream.once('error',()=>res.destroy());res.once('close',()=>stream.destroy());stream.pipe(res);
}
async function readJSON(req){
 let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>8192)throw new Error('body too large');}return JSON.parse(text);
}
export function apply(ctx){
 const web=ctx.get('webServer');const sockets=new Set();
 function track(s){sockets.add(s);s.once('close',()=>sockets.delete(s));}
 async function handler(req,res){
  securityHeaders(res);
  const denied=rejection(ctx,req);if(denied!==undefined){json(res,denied,{ok:false,message:'需要有效 DSH 登录和受信任来源'});return;}
  let pathname;try{pathname=new URL(req.url,'http://localhost').pathname;}catch{json(res,400,{ok:false});return;}
  try{
   if(req.method==='POST'&&pathname===VIEW+'/open'){
    if(!sameOrigin(req)){json(res,403,{ok:false,message:'拒绝非同源打开请求'});return;}
    if(!String(req.headers['content-type']||'').startsWith('application/json')){json(res,415,{ok:false});return;}
    let body;try{body=await readJSON(req);}catch{json(res,400,{ok:false,message:'无效请求'});return;}
    let url;try{url=new URL(body.url);}catch{json(res,400,{ok:false,message:'请输入完整 HTTP(S) 地址'});return;}
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.href.length>4096){json(res,400,{ok:false,message:'仅允许不含账号密码的 HTTP(S) 网页地址'});return;}
    const child=spawn('/usr/local/libexec/dsh-browser-open',[url.href],{detached:true,stdio:'ignore',env:process.env});
    child.once('error',()=>{if(!res.headersSent)json(res,502,{ok:false,message:'无法启动服务器浏览器'});});
    child.once('spawn',()=>{child.unref();json(res,202,{ok:true,message:'已向服务器浏览器发送打开请求'});});return;
   }
   if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');json(res,405,{ok:false});return;}
   if([BASE,BASE+'/',VIEW].includes(pathname)){res.writeHead(302,{Location:VIEW+'/'});res.end();return;}
   if(pathname===VIEW+'/session'){
    const secret=JSON.parse(await readFile(SECRET,'utf8'));
    if(req.method==='HEAD'){res.writeHead(200,{'Content-Type':'application/json'});res.end();return;}
    json(res,200,{password:secret.password,display:':99'});return;
   }
   if(pathname===VIEW+'/'){await sendFile(req,res,path.join(ASSETS,'view.html'));return;}
   if([VIEW+'/view.js',VIEW+'/view.css'].includes(pathname)){await sendFile(req,res,path.join(ASSETS,path.basename(pathname)));return;}
   if(pathname.startsWith(VIEW+'/novnc/')){
    let relative;try{relative=decodeURIComponent(pathname.slice((VIEW+'/novnc/').length));}catch{json(res,400,{ok:false});return;}
    const file=path.resolve(NOVNC,relative);
    if(!file.startsWith(NOVNC+path.sep)||!MIME[path.extname(file)]){json(res,404,{ok:false});return;}
    await sendFile(req,res,file);return;
   }
   json(res,404,{ok:false});
  }catch(e){
   if(res.headersSent){res.destroy();return;}
   json(res,e.code==='ENOENT'?404:503,{ok:false,message:'桌面资源暂不可用'});
  }
 }
 ctx.effect(()=>web.register({kind:'prefix',path:BASE,handler}),'browser-desktop: HTTP');
 ctx.effect(()=>web.registerUpgrade({path:VIEW+'/websockify',handler(req,socket,head){
  const denied=rejection(ctx,req);
  const status=denied??(!sameOrigin(req)?403:sockets.size>=16?503:undefined);
  if(status!==undefined){socket.end(`HTTP/1.1 ${status} ${status===401?'Unauthorized':'Forbidden'}\r\nConnection: close\r\nCache-Control: no-store\r\nContent-Length: 0\r\n\r\n`);return;}
  const upstream=connect(16090,'127.0.0.1');track(socket);track(upstream);
  socket.once('close',()=>upstream.destroy());upstream.once('close',()=>socket.destroy());
  socket.once('error',()=>upstream.destroy());upstream.once('error',()=>socket.destroy());
  const timeout=setTimeout(()=>{upstream.destroy();socket.destroy();},5000);timeout.unref();
  upstream.once('connect',()=>{
   clearTimeout(timeout);
   upstream.write('GET /websockify HTTP/1.1\r\nHost: 127.0.0.1:16090\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n');
   for(const [key,value] of Object.entries(req.headers))if(key.startsWith('sec-websocket-')&&value!==undefined)upstream.write(`${key}: ${Array.isArray(value)?value.join(', '):value}\r\n`);
   upstream.write('\r\n');if(head.length)upstream.write(head);
   socket.pipe(upstream).pipe(socket);
  });
 }}),'browser-desktop: WebSocket');
 ctx.effect(()=>()=>{for(const s of sockets)s.destroy();sockets.clear();},'browser-desktop: close active sockets');
 ctx.logger.info('Browser desktop ready at /browser-desktop/view/ (authenticated; loopback VNC)');
}
