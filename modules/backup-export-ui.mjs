import {createBackup,captureSnapshot,browserBarrier,verifyBackupFile} from './backup-export.mjs';
const launches=new WeakSet();

// Do not navigate to the separate tool through an older worker: older workers
// cache every HTML navigation as the main offline index.
export function mountBackupLaunch({root=document,navigate}={}){
 const button=root.querySelector('[data-backup-launch]');if(!button||launches.has(button))return;
 launches.add(button);const view=button.ownerDocument.defaultView;
 const status=button.ownerDocument.createElement('p');status.setAttribute('role','status');button.after(status);
 button.addEventListener('click',async()=>{
  if(button.disabled)return;button.disabled=true;
  try{
   const worker=view.navigator.serviceWorker?.controller;
   if(!view.isSecureContext||!worker||!view.navigator.locks?.request)throw Error();
   const ready=await new Promise(resolve=>{
    const channel=new view.MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(false);},1500);
    channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();const d=e.data;resolve(d?.protocol===1&&d.navigationLock===true&&d.scope===new URL('./',view.location.href).href);};
    try{worker.postMessage({type:'TODAY_BACKUP_CHECK'},[channel.port2]);}catch{clearTimeout(timer);channel.port1.close();resolve(false);}
   });
   if(!ready)throw Error();(navigate||(()=>view.location.assign('./backup.html')))();
  }catch{status.textContent='Bu ortamda tam yedek henüz açılamıyor. Today güncellemesini tamamlayıp desteklenen tarayıcıda yeniden açabilirsin.';}
  finally{button.disabled=false;}
 });
}

const messages={
 'consent-required':'Önce dosya oluşturma onayını seç.',
 'password-invalid':'En az 12 karakterli parolanı iki alana aynı şekilde gir.',
 'coordination-unavailable':'Bu ortam güvenli tam yedeklemeyi desteklemiyor. Today güncellemesini tamamlayıp sayfayı yeniden açabilirsin. Şifresiz veya bulut aktarımı yapılmadı.',
 'other-context-or-version':'Diğer Today pencerelerini kapat ve güncel sürümden yeniden dene. Başka açık aynı site penceresi de yedeklemeyi engelleyebilir.',
 'other-client':'Tarayıcı aynı siteye ait başka bir pencere görüyor. Today sekmelerini ve kurulu PWA penceresini kapatıp bu sayfayı yenile.',
 'client-mismatch':'Yedek sayfası servis çalışanı tarafından doğrulanamadı. Sayfayı yenileyip yeniden dene.',
 'backup-lock-busy':'Yedekleme kilidi meşgul. Devam eden Today işlemi bittikten sonra sayfayı yenileyip yeniden dene.',
 'unregistered-data':'Bu sürümün tanımadığı Today verisi bulundu. Eksik kapsamla tam yedek oluşturulmadı.',
 'invalid-source':'Bazı kayıtlar doğrulanamadı. Tam yedek hazırlanmadı; mevcut kayıtların değiştirilmedi.',
 'unsupported-source-version':'Kayıt sürümü desteklenmiyor. Tam yedek hazırlanmadı; mevcut kayıtların değiştirilmedi.',
 'source-changed':'Yedek hazırlanırken veriler değişti. Dosya oluşturulmadı.',
 'data-limit':'Veri boyutu desteklenen sınırı aşıyor. Kayıtlar kesilmedi; dosya oluşturulmadı.',
 'cancelled':'İşlem iptal edildi. Mevcut kayıtların değiştirilmedi.'
};
export function mountBackupExport({root=document,create=createBackup,capture=captureSnapshot,barrier,verify=verifyBackupFile}={}){
 const form=root.querySelector('#backupForm');if(!form)return null;
 const view=form.ownerDocument.defaultView,$=s=>root.querySelector(s);
 let active=null,url=null,busy=false;
 const status=$('#backupStatus'),fields=$('#backupFields'),cancel=$('#backupCancel'),download=$('#backupDownload');
 const dispose=()=>{download.hidden=true;download.removeAttribute('href');if(url){view.URL.revokeObjectURL(url);url=null;}};
 const clearPasswords=()=>{for(const s of ['#backupPassword','#backupConfirmation','#backupVerifyPassword'])$(s).value='';};
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  dispose();active=new view.AbortController();busy=true;fields.disabled=true;cancel.hidden=false;status.textContent='Dosya hazırlanıyor…';
  let password=$('#backupPassword').value,confirmation=$('#backupConfirmation').value;
  try{
   const result=await create({userConfirmed:$('#backupConsent').checked,password,confirmation,signal:active.signal,
    barrier:barrier||browserBarrier(view),capture:()=>capture({storage:view.localStorage,indexedDB:view.indexedDB,
     crypto:view.crypto,contracts:view.TodayNutritionContracts,signal:active.signal,
     source:{appVersion:view.TodayVersion.getCurrentVersion().appVersion,origin:view.location.origin,runtime:'web'}})});
   if(active.signal.aborted)return;
   url=view.URL.createObjectURL(new view.Blob([result.file],{type:'application/json'}));download.href=url;download.download=result.filename;download.hidden=false;
   status.textContent='Şifreli dosyan hazır. Seçtiğin konuma kaydet, sonra aşağıdan yeniden açıp doğrula. Dosyanın kalıcı kaydedildiğini Today otomatik doğrulayamaz.';
  }catch(error){status.textContent=messages[error?.code]||'Tam yedek oluşturulamadı. Mevcut kayıtların değiştirilmedi.';}
  finally{password='';confirmation='';clearPasswords();busy=false;fields.disabled=false;cancel.hidden=true;active=null;}
 });
 cancel.addEventListener('click',()=>{active?.abort();dispose();status.textContent=messages.cancelled;});
 const invalidate=()=>{if(busy)active?.abort();dispose();};
 form.addEventListener('input',invalidate);
 view.addEventListener('pagehide',()=>{invalidate();clearPasswords();});
 view.document.addEventListener('visibilitychange',()=>{if(view.document.hidden&&busy)active?.abort();});
 $('#backupVerifyForm').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  const input=$('#backupVerifyFile'),file=input.files?.[0];
  if(!file||file.size>50*1024*1024){status.textContent='Desteklenen boyutta bir Today yedek dosyası seç.';return;}
  busy=true;fields.disabled=true;let password=$('#backupVerifyPassword').value;
  try{const result=await verify(await file.text(),password,{crypto:view.crypto});status.textContent=result.ok?'Dosya açıldı ve bütünlüğü doğrulandı. Bu kontrol geri yükleme yapmadı; geri yükleme kabulü henüz yok.':'Dosya açılamadı. Parolanı ve dosyanı kontrol et.';}
  catch{status.textContent='Dosya okunamadı; mevcut kayıtların değiştirilmedi.';}
  finally{password='';clearPasswords();input.value='';busy=false;fields.disabled=false;}
 });
 return Object.freeze({dispose});
}
if(typeof document!=='undefined'){mountBackupExport();mountBackupLaunch();}
