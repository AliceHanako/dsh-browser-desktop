import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {apply} from './index.js';
let httpHandler,upgrade,decision=undefined;
const cleanup=[];
const web={register({path,handler}){assert.equal(path,'/browser-desktop');httpHandler=handler;return()=>{};},registerUpgrade({path,handler}){assert.equal(path,'/browser-desktop/view/websockify');upgrade=handler;return()=>{};}};
const ctx={get(k){if(k==='webServer')return web;if(k==='connection')return {requestRejection(){if(decision instanceof Error)throw decision;return decision;}};},effect(fn){cleanup.push(fn());},logger:{info(){}}};
apply(ctx);
const server=createServer((req,res)=>httpHandler(req,res));server.listen(0,'127.0.0.1');await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port;
let tests=0;
async function status(path,expected,options){const r=await fetch(base+path,{redirect:'manual',...options});assert.equal(r.status,expected,path);tests++;return r;}
try{
 decision=401;await status('/browser-desktop/view/',401);await status('/browser-desktop/view/session',401);await status('/browser-desktop/view/novnc/core/rfb.js',401);
 decision=403;await status('/browser-desktop/view/',403);
 decision=new Error('missing service');await status('/browser-desktop/view/session',403);
 decision=null;await status('/browser-desktop/view/session',403);
 decision=undefined;await status('/browser-desktop',302);
 let r=await status('/browser-desktop/view/',200);assert.match(await r.text(),/浏览器桌面/);
 r=await status('/browser-desktop/view/view.js',200);assert.match(await r.text(),/new RFB/);
 await status('/browser-desktop/view/no-such-file',404);
 await status('/browser-desktop/view/novnc/%2e%2e%2f%2e%2e%2fetc%2fpasswd',404);
 await status('/browser-desktop/view/open',403,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 const headers={Origin:base,'Content-Type':'application/json'};
 await status('/browser-desktop/view/open',400,{method:'POST',headers,body:JSON.stringify({url:'file:///etc/passwd'})});
 await status('/browser-desktop/view/open',400,{method:'POST',headers,body:JSON.stringify({url:'https://user:password@example.com'})});
 await status('/browser-desktop/view/open',400,{method:'POST',headers,body:'invalid JSON'});
 await status('/browser-desktop/view/open',415,{method:'POST',headers:{Origin:base,'Content-Type':'text/plain'},body:'{}'});
 let ended='';decision=401;upgrade({headers:{}},{end(s){ended=s;}},Buffer.alloc(0));assert.match(ended,/401 Unauthorized/);tests++;
 decision=undefined;upgrade({headers:{host:'localhost',origin:'https://evil.invalid'}},{end(s){ended=s;}},Buffer.alloc(0));assert.match(ended,/403 Forbidden/);tests++;
 console.log('PASS',tests,'local contract/guard tests; framework admission mocked, no real desktop connection claimed');
}finally{for(const fn of cleanup)if(typeof fn==='function')fn();server.close();}
