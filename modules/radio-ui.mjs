import { createRadioDirectory, createLiveRadioDirectory } from './radio-directory.mjs';
import {getRadioPlayer} from './radio-player.mjs';
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
export function mountRadioUI({root=document,directory=createLiveRadioDirectory(),mode='live',player=getRadioPlayer()}={}){
 const panel=root.querySelector('#radioPanel');if(!panel)return null;if(mounts.has(panel))return mounts.get(panel);
 const doc=panel.ownerDocument,view=doc.defaultView;
 const make=(tag,attrs={},text)=>{const el=doc.createElement(tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el;};
 const preview=mode==='preview';
 const form=make('form',{class:'radioFilters','aria-label':'İstasyon arama ve filtreler'});
 function field(id,title,type,choices){const label=make('label',{for:id},title);const input=make(type,{id,name:id});if(type==='select')for(const [value,text]of choices)input.append(make('option',{value},text));else{input.type='search';input.maxLength=80;label.className='radioQuery';}label.append(input);form.append(label);return input;}
 const query=field('radioQuery','İstasyon ara','input');
 const country=field('radioCountry','Ülke','select',[['','Dünya'],['TR','Türkiye'],['US','ABD'],['DE','Almanya'],['GB','Birleşik Krallık'],['FR','Fransa'],['ES','İspanya'],['IT','İtalya'],['JP','Japonya'],['IN','Hindistan']]);
 const language=field('radioLanguage','Dil','select',[['','Tüm diller'],['turkish','Türkçe'],['english','İngilizce'],['german','Almanca'],['french','Fransızca'],['spanish','İspanyolca']]);
 const genre=field('radioGenre','Tür','select',[['','Tüm türler'],['classical','Klasik'],['jazz','Jazz'],['news','Haber'],['rock','Rock'],['pop','Pop']]);
 const consent=make('input',{id:'radioDirectoryConsent',type:'checkbox'});
 if(!preview){const label=make('label',{},'Radio Browser’a bağlanmayı kabul ediyorum. IP adresim ve arama/filtre seçimlerim bu dizine iletilir; Today geçmiş veya sağlık verimi göndermez.');label.prepend(consent);label.className='radioConsent';form.append(label);}
 const actions=make('div',{class:'radioActions'}),submit=make('button',{class:'back',type:'submit',id:'btnRadioSearch'},preview?'Örnek istasyonları göster':'İstasyonları yükle'),cancel=make('button',{class:'back',type:'button',id:'btnRadioCancel'},'İptal');cancel.disabled=true;actions.append(submit,cancel);form.append(actions);
 const status=make('p',{id:'radioStatus',role:'status','aria-live':'polite'},preview?'Henüz arama yapılmadı. Filtrelerini seçip örnek istasyonları açabilirsin.':'Henüz arama yapılmadı. Filtrelerini ve bağlantı iznini seçip istasyonları yükleyebilirsin.');
 const list=make('ul',{id:'radioResults',class:'radioList','aria-label':preview?'Örnek istasyon sonuçları':'İstasyon sonuçları'});const next=make('button',{class:'back',type:'button',id:'btnRadioNext'},'Sonraki 30 kayıt');next.hidden=true;panel.append(form,status,list,next);
 let chosen=null;
 const playback=make('section',{class:'radioStation','aria-label':'Radyo oynatma'}),streamConsent=make('input',{id:'radioStreamConsent',type:'checkbox'});
 const streamLabel=make('label',{class:'radioConsent'},'Seçtiğim istasyonun yayıncısına bağlanmayı kabul ediyorum. IP adresim ve tarayıcı bağlantı bilgilerim yayıncıya iletilir. Ses kaydedilmez.');streamLabel.prepend(streamConsent);
 const playerStatus=make('p',{id:'radioPlayerStatus',role:'status','aria-live':'polite'}),retry=make('button',{class:'back',type:'button',id:'btnRadioRetry'},'Tekrar dinle'),stopButton=make('button',{class:'back',type:'button',id:'btnRadioStop'},'Durdur');
 const states={idle:'Henüz yayın başlatılmadı.',loading:'Yayına bağlanılıyor…',playing:'Çalıyor',buffering:'Bağlantı bekleniyor…',stopped:'Durduruldu.',ended:'Yayın sona erdi.'};
 const errors={'unsupported-format':'Bu yayın biçimi bu cihazda desteklenmiyor.','play-blocked':'Tarayıcı oynatmayı engelledi. Dinle düğmesine tekrar dokunabilirsin.','connection-timeout':'Yayına bağlanılamadı. Bağlantını kontrol edip tekrar deneyebilirsin.'};
 function reflectPlayer(state=player.getState()){
   playerStatus.textContent=(state.station?`${state.station.name} · `:'')+(state.status==='error'?(errors[state.error]||'Bu yayın açılamadı. Başka bir istasyon deneyebilirsin.'):states[state.status]||'Yayın durumu bilinmiyor.');
   stopButton.disabled=!['loading','playing','buffering'].includes(state.status);retry.hidden=!chosen||!stopButton.disabled;
   if(view.TodayRouter?.getState?.().route!=='radio'&&stopButton.disabled)streamConsent.checked=false;
 }
 function start(station){
   if(!streamConsent.checked){playerStatus.textContent='Önce yayıncıya bağlantı iznini seç.';return;}
   chosen=station;const result=player.play(station,{userConfirmed:true});if(!result.ok&&result.error==='invalid-station')playerStatus.textContent='Bu istasyonun yayın adresi kullanılamıyor.';
 }
 streamConsent.addEventListener('change',()=>{if(!streamConsent.checked)player.stop();});
 stopButton.addEventListener('click',()=>player.stop());retry.addEventListener('click',()=>{if(chosen)start(chosen);});
 playback.append(streamLabel,playerStatus,retry,stopButton,make('p',{class:'mini'},'Canlı yayın internet kullanır. Bağlantı kesilirse otomatik yeniden başlamaz. Kesintisiz arka plan oynatma garanti edilmez. Bu cihazda ses düzeyini sistem tuşlarıyla ayarlayabilirsin.'));
 if(!preview)panel.prepend(playback);player.subscribe(reflectPlayer);reflectPlayer();
 let epoch=0,busy=false,offset=0,lastQuery=null;
 const pageQuery=()=>({query:query.value,countryCode:country.value,language:language.value,genre:genre.value});
 function stop(message){epoch++;directory.cancel();busy=false;list.removeAttribute('aria-busy');submit.disabled=false;cancel.disabled=true;list.replaceChildren();next.hidden=true;lastQuery=null;offset=0;if(message)status.textContent=message;}
 async function load(more=false){
  if(!preview&&!consent.checked){stop('Önce dizine bağlantı iznini seç.');return;}
  const selection=pageQuery();
  offset=more&&lastQuery&&JSON.stringify(lastQuery)===JSON.stringify(selection)?offset+30:0;
  lastQuery=selection;next.hidden=true;
  const revision=++epoch;directory.cancel();busy=true;submit.disabled=true;cancel.disabled=false;list.replaceChildren();list.setAttribute('aria-busy','true');next.hidden=true;status.textContent='İstasyonlar aranıyor…';
  try{
   const result=await directory.search({userConfirmed:true,...selection,limit:30,offset});
   if(revision!==epoch)return;
   if(!result.ok){status.textContent=result.error==='cancelled'?'Arama iptal edildi.':'İstasyonlar yüklenemedi. Bağlantını kontrol edip tekrar deneyebilirsin.';return;}
   status.textContent=result.stations.length?`${result.stations.length} ${preview?'örnek ':''}istasyon bulundu. Dinlemek için bir istasyon seç.${offset?` Kayıt başlangıcı: ${offset+1}.`:''}${result.rejected?` ${result.rejected} güvensiz, geçersiz veya yinelenen kayıt gösterilmedi.`:''}`:(result.received?'Bu sayfadaki kayıtlar güvenli HTTPS doğrulamasını geçmedi.':'Bu filtrelerle istasyon bulunamadı. Filtreleri değiştirebilirsin.');
   for(const station of result.stations){const item=make('li',{class:'radioStation'});item.append(make('h2',{},station.name),make('p',{},`${station.countryCode} · ${station.languages.join(', ')} · ${station.genres.join(', ')}`),make('p',{},preview?'Örnek kayıt · Canlı yayın doğrulanmadı':`Dizin kaydı · ${station.codec}${station.hls?' / HLS':''} · Yayın durumu oynatırken doğrulanır.`));if(!preview){const play=make('button',{class:'back',type:'button','data-radio-play':station.id},'Dinle');play.addEventListener('click',()=>start(station));item.append(play);}list.append(item);}
   next.hidden=!result.hasMore;
  }catch{if(revision===epoch)status.textContent='İstasyonlar yüklenemedi. Tekrar deneyebilirsin.';}
  finally{if(revision===epoch){busy=false;list.removeAttribute('aria-busy');submit.disabled=false;cancel.disabled=true;}}
 }
 form.addEventListener('submit',event=>{event.preventDefault();load();});
 next.addEventListener('click',()=>load(true));
 form.addEventListener('input',()=>{if(busy||lastQuery||(!preview&&!consent.checked))stop('Seçimler değişti. Yeniden ara.');});
 cancel.addEventListener('click',()=>stop('Arama iptal edildi.'));
 root.querySelector('#btnRadioBack')?.addEventListener('click',()=>{consent.checked=false;stop('Arama iptal edildi.');view.TodayRouter?.navigate('modules');});
 view.addEventListener('today:routechange',()=>{if(view.TodayRouter?.getState?.().route!=='radio'&&(busy||lastQuery||consent.checked)){consent.checked=false;stop('Dizin bağlantısı kapatıldı. Yeniden aramak için izin seçebilirsin.');}});
 view.addEventListener('today:routechange',()=>{if(view.TodayRouter?.getState?.().route!=='radio'&&!['loading','playing','buffering'].includes(player.getState().status))streamConsent.checked=false;});
 const api=Object.freeze({cancel:()=>stop('Arama iptal edildi.')});mounts.set(panel,api);return api;
}
if(typeof window!=='undefined'&&typeof document!=='undefined'){
 const boot=()=>{if(window.TodayStartup?.getStatus?.().phase==='ready')mountRadioUI();};
 window.addEventListener('today:startup-ready',boot);document.addEventListener('DOMContentLoaded',boot,{once:true});boot();
}
