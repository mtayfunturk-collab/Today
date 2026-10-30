import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountRadioUI,createPreviewDirectory} from '../modules/radio-ui.mjs';
let passed=0;async function check(name,fn){await fn();passed++;console.log(`PASS ${name}`);}
const tick=()=>new Promise(r=>setTimeout(r,0));
function fixture(directory,options={}){const dom=new JSDOM('<button id="btnRadioBack">Back</button><div id="radioPanel"></div>',{url:'https://today.example'});const doc=dom.window.document;let navigated;dom.window.TodayRouter={getState:()=>({route:'radio'}),navigate:r=>{navigated=r;}};const ui=mountRadioUI({root:doc,directory:directory||createPreviewDirectory(),mode:'preview',...options});return{doc,view:dom.window,ui,navigated:()=>navigated,submit:()=>doc.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}))};}
await check('mount is idempotent and never searches or writes storage on startup',()=>{let calls=0;const f=fixture({search:()=>{calls++;},cancel(){}});assert.equal(mountRadioUI({root:f.doc}),f.ui);assert.equal(calls,0);assert.equal(f.doc.querySelectorAll('form').length,1);assert.equal(f.view.localStorage.length,0);});
await check('preview catalog uses bounded filters without a network request',async()=>{const d=createPreviewDirectory();const r=await d.search({userConfirmed:true,countryCode:'TR',genre:'news'});assert.equal(r.stations.length,1);assert.match(r.stations[0].name,/Örnek Haber/);assert.equal(r.stations[0].lastCheckOk,false);});
await check('search renders clearly labelled examples with no audio or links',async()=>{const f=fixture();f.submit();await tick();assert.equal(f.doc.querySelectorAll('.radioStation').length,3);assert.match(f.doc.querySelector('#radioStatus').textContent,/3 örnek/);assert.equal(f.doc.querySelectorAll('audio,a').length,0);});
await check('country, language, genre and query are forwarded only on submit',async()=>{let request;const f=fixture({cancel(){},async search(q){request=q;return{ok:true,stations:[]};}});for(const [id,value]of [['radioCountry','TR'],['radioLanguage','turkish'],['radioGenre','news'],['radioQuery','Haber']])f.doc.getElementById(id).value=value;assert.equal(request,undefined);f.submit();await tick();assert.deepEqual(request,{userConfirmed:true,query:'Haber',countryCode:'TR',language:'turkish',genre:'news',limit:30,offset:0});assert.match(f.doc.getElementById('radioStatus').textContent,/bulunamadı/);});
await check('errors allow retry instead of claiming results',async()=>{let n=0;const f=fixture({cancel(){},async search(){if(++n===1)throw Error('secret');return{ok:true,stations:[]};}});f.submit();await tick();assert.match(f.doc.getElementById('radioStatus').textContent,/yüklenemedi/);assert(!f.doc.getElementById('btnRadioSearch').disabled);f.submit();await tick();assert.match(f.doc.getElementById('radioStatus').textContent,/bulunamadı/);});
await check('cancel ignores an adapter which returns stale results',async()=>{let release;const f=fixture({cancel(){},search:()=>new Promise(r=>{release=r;})});f.submit();f.doc.getElementById('btnRadioCancel').click();release({ok:true,stations:[{name:'stale'}]});await tick();assert.match(f.doc.getElementById('radioStatus').textContent,/iptal/);assert.equal(f.doc.querySelectorAll('li').length,0);});
await check('filter change and route exit cancel pending UI work',async()=>{for(const method of ['input','route']){let release,cancelled=0;const f=fixture({cancel(){cancelled++;},search:()=>new Promise(r=>{release=r;})});f.submit();if(method==='input')f.doc.getElementById('radioQuery').dispatchEvent(new f.view.Event('input',{bubbles:true}));else f.doc.getElementById('btnRadioBack').click();release({ok:true,stations:[]});await tick();assert(cancelled>=2);assert(!f.doc.getElementById('btnRadioSearch').disabled);if(method==='route')assert.equal(f.navigated(),'modules');}});
await check('untrusted station names stay text, never executable markup',async()=>{const f=fixture({cancel(){},async search(){return{ok:true,stations:[{name:'<img src=x onerror=alert(1)>',countryCode:'TR',languages:[],genres:[]}]};}});f.submit();await tick();assert.equal(f.doc.querySelectorAll('img').length,0);assert.match(f.doc.querySelector('h2').textContent,/<img/);});
await check('live catalog is gated by visible unchecked consent and revocation clears results',async()=>{
 let calls=0;const f=fixture({cancel(){},async search(){calls++;return{ok:true,stations:[]};}},{mode:'live'});
 const consent=f.doc.getElementById('radioDirectoryConsent');assert.equal(consent.checked,false);f.submit();await tick();assert.equal(calls,0);assert.match(f.doc.getElementById('radioStatus').textContent,/izin/);
 consent.checked=true;f.submit();await tick();assert.equal(calls,1);consent.checked=false;consent.dispatchEvent(new f.view.Event('input',{bubbles:true}));assert.equal(f.doc.querySelectorAll('li').length,0);f.submit();await tick();assert.equal(calls,1);
});
await check('live pagination uses raw page boundary and changing filters resets it',async()=>{
 const requests=[];const f=fixture({cancel(){},async search(q){requests.push(q);return{ok:true,stations:[],hasMore:true,received:30,rejected:30};}},{mode:'live'});
 f.doc.getElementById('radioDirectoryConsent').checked=true;f.submit();await tick();assert.match(f.doc.getElementById('radioStatus').textContent,/HTTPS/);assert.equal(f.doc.getElementById('btnRadioNext').hidden,false);
 f.doc.getElementById('btnRadioNext').click();await tick();assert.equal(requests[1].offset,30);
 f.doc.getElementById('radioCountry').value='TR';f.doc.getElementById('radioCountry').dispatchEvent(new f.view.Event('input',{bubbles:true}));f.submit();await tick();assert.equal(requests[2].offset,0);assert.equal(requests[2].countryCode,'TR');
});
await check('leaving Radio revokes live consent and suppresses a late result',async()=>{
 let release;const f=fixture({cancel(){},search:()=>new Promise(r=>{release=r;})},{mode:'live'});const c=f.doc.getElementById('radioDirectoryConsent');c.checked=true;f.submit();
 f.view.TodayRouter.getState=()=>({route:'modules'});f.view.dispatchEvent(new f.view.Event('today:routechange'));assert.equal(c.checked,false);
 release({ok:true,stations:[]});await tick();assert.match(f.doc.getElementById('radioStatus').textContent,/kapatıldı/);assert.equal(f.doc.getElementById('btnRadioNext').hidden,true);
});
await check('unrelated route changes do not invent a prior directory connection',()=>{
 let calls=0;const f=fixture({cancel(){},async search(){calls++;}},{mode:'live'});f.view.TodayRouter.getState=()=>({route:'pick'});f.view.dispatchEvent(new f.view.Event('today:routechange'));assert.match(f.doc.getElementById('radioStatus').textContent,/Henüz arama yapılmadı/);assert.equal(calls,0);
});
console.log(`NUT-RADIO UI: ${passed}/${passed} başarılı`);
