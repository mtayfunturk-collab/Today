import { createRadioDirectory } from './radio-directory.mjs';
const mounts=new WeakMap();
// This explicit design preview uses the real validator, never a network fetch.
const samples=[
 {stationuuid:'00000000-0000-4000-8000-000000000001',name:'Örnek Klasik · Türkiye',countrycode:'TR',language:'turkish',tags:'classical',codec:'MP3',hls:0,lastcheckok:0,url_resolved:'https://radio.example/classical'},
 {stationuuid:'00000000-0000-4000-8000-000000000002',name:'Örnek Jazz · Dünya',countrycode:'US',language:'english',tags:'jazz',codec:'AAC',hls:0,lastcheckok:0,url_resolved:'https://radio.example/jazz'},
 {stationuuid:'00000000-0000-4000-8000-000000000003',name:'Örnek Haber · Türkiye',countrycode:'TR',language:'turkish',tags:'news',codec:'AAC',hls:1,lastcheckok:0,url_resolved:'https://radio.example/news'}
];
export function createPreviewDirectory(){return createRadioDirectory({servers:['https://de1.api.radio-browser.info/'],fetcher:async address=>{
 const p=new URL(address).searchParams;
 const rows=samples.filter(s=>(!p.get('countrycode')||s.countrycode===p.get('countrycode'))&&(!p.get('language')||s.language===p.get('language'))&&(!p.get('tag')||s.tags===p.get('tag'))&&(!p.get('name')||s.name.toLocaleLowerCase('tr').includes(p.get('name').toLocaleLowerCase('tr'))));
 const start=Number(p.get('offset'));return new Response(JSON.stringify(rows.slice(start,start+Number(p.get('limit')))),{headers:{'Content-Type':'application/json'}});
}});}
export function mountRadioUI({root=document,directory=createPreviewDirectory()}={}){
 const panel=root.querySelector('#radioPanel');if(!panel)return null;if(mounts.has(panel))return mounts.get(panel);
 const doc=panel.ownerDocument,view=doc.defaultView;
 const make=(tag,attrs={},text)=>{const el=doc.createElement(tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el;};
 const form=make('form',{class:'radioFilters','aria-label':'İstasyon arama ve filtreler'});
 function field(id,title,type,choices){const label=make('label',{for:id},title);const input=make(type,{id,name:id});if(type==='select')for(const [value,text]of choices)input.append(make('option',{value},text));else{input.type='search';input.maxLength=80;label.className='radioQuery';}label.append(input);form.append(label);return input;}
 const query=field('radioQuery','İstasyon ara','input');
 const country=field('radioCountry','Ülke','select',[['','Dünya'],['TR','Türkiye'],['US','ABD']]);
 const language=field('radioLanguage','Dil','select',[['','Tüm diller'],['turkish','Türkçe'],['english','İngilizce']]);
 const genre=field('radioGenre','Tür','select',[['','Tüm türler'],['classical','Klasik'],['jazz','Jazz'],['news','Haber']]);
 const actions=make('div',{class:'radioActions'}),submit=make('button',{class:'back',type:'submit',id:'btnRadioSearch'},'Örnek istasyonları göster'),cancel=make('button',{class:'back',type:'button',id:'btnRadioCancel'},'İptal');cancel.disabled=true;actions.append(submit,cancel);form.append(actions);
 const status=make('p',{id:'radioStatus',role:'status','aria-live':'polite'},'Henüz arama yapılmadı. Filtrelerini seçip örnek istasyonları açabilirsin.');
 const list=make('ul',{id:'radioResults',class:'radioList','aria-label':'Örnek istasyon sonuçları'});panel.append(form,status,list);
 let epoch=0,busy=false;
 function stop(message){epoch++;directory.cancel();busy=false;list.removeAttribute('aria-busy');submit.disabled=false;cancel.disabled=true;list.replaceChildren();if(message)status.textContent=message;}
 form.addEventListener('submit',async event=>{
  event.preventDefault();const revision=++epoch;directory.cancel();busy=true;submit.disabled=true;cancel.disabled=false;list.replaceChildren();list.setAttribute('aria-busy','true');status.textContent='İstasyonlar aranıyor…';
  try{
   const result=await directory.search({userConfirmed:true,query:query.value,countryCode:country.value,language:language.value,genre:genre.value,limit:30});
   if(revision!==epoch)return;
   if(!result.ok){status.textContent=result.error==='cancelled'?'Arama iptal edildi.':'İstasyonlar yüklenemedi. Seçimlerini kontrol edip tekrar deneyebilirsin.';return;}
   status.textContent=result.stations.length?`${result.stations.length} örnek istasyon bulundu. Yayın dinleme kapalı.`:'Bu filtrelerle örnek istasyon bulunamadı. Filtreleri değiştirebilirsin.';
   for(const station of result.stations){const item=make('li',{class:'radioStation'});item.append(make('h2',{},station.name),make('p',{},`${station.countryCode} · ${station.languages.join(', ')} · ${station.genres.join(', ')}`),make('p',{},'Örnek kayıt · Canlı yayın doğrulanmadı'));list.append(item);}
  }catch{if(revision===epoch)status.textContent='İstasyonlar yüklenemedi. Tekrar deneyebilirsin.';}
  finally{if(revision===epoch){busy=false;list.removeAttribute('aria-busy');submit.disabled=false;cancel.disabled=true;}}
 });
 form.addEventListener('input',()=>{if(busy)stop('Seçimler değişti. Yeniden ara.');});
 cancel.addEventListener('click',()=>stop('Arama iptal edildi.'));
 root.querySelector('#btnRadioBack')?.addEventListener('click',()=>{stop('Arama iptal edildi.');view.TodayRouter?.navigate('modules');});
 view.addEventListener('today:routechange',()=>{if(view.TodayRouter?.getState?.().route!=='radio'&&busy)stop('Arama iptal edildi.');});
 const api=Object.freeze({cancel:()=>stop('Arama iptal edildi.')});mounts.set(panel,api);return api;
}
if(typeof window!=='undefined'&&typeof document!=='undefined'){
 const boot=()=>{if(window.TodayStartup?.getStatus?.().phase==='ready')mountRadioUI();};
 window.addEventListener('today:startup-ready',boot);document.addEventListener('DOMContentLoaded',boot,{once:true});boot();
}
