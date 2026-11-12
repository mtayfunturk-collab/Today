import {captureSnapshot,browserBarrier} from './backup-export.mjs';
import {prepareRestorePreview} from './backup-restore-preview.mjs';

// Read-only UI. There is deliberately no apply control or recovery import.
export function mountRestorePreview({root=document,prepare=prepareRestorePreview,capture=captureSnapshot,barrier}={}){
  const form=root.querySelector('#restorePreviewForm');if(!form)return null;
  const view=form.ownerDocument.defaultView;
  const file=root.querySelector('#restorePreviewFile'),password=root.querySelector('#restorePreviewPassword');
  const consent=root.querySelector('#restorePreviewConsent'),status=root.querySelector('#restorePreviewStatus');
  let active=null,busy=false;
  const invalidate=()=>{active?.abort();status.textContent='';};
  form.addEventListener('input',invalidate);
  view.addEventListener('pagehide',()=>{invalidate();password.value='';file.value='';consent.checked=false;});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    status.textContent='';
    if(!consent.checked){status.textContent='Önce yalnız okuma onayını seç.';return;}
    if(!file.files?.[0]||file.files[0].size>50*1024*1024){status.textContent='Desteklenen boyutta bir Today dosyası seç.';return;}
    busy=true;active=new view.AbortController();const signal=active.signal;
    const secret=password.value;password.value='';
    try{
      const result=await prepare({userConfirmed:true,file:await file.files[0].text(),password:secret,signal,
        barrier:barrier||browserBarrier(view),contracts:view.TodayNutritionContracts,crypto:view.crypto,
        capture:()=>capture({storage:view.localStorage,indexedDB:view.indexedDB,contracts:view.TodayNutritionContracts,
          crypto:view.crypto,signal,source:{appVersion:view.TodayVersion.getCurrentVersion().appVersion,origin:view.location.origin,runtime:'web'}})});
      if(signal.aborted)return;
      const changes=result.localStorage;
      status.textContent=`Önizleme tamamlandı. ${result.coreDays.count} Core günü; bilinen veri alanlarında ${changes.added} yeni, ${changes.changed} değişecek, ${changes.removed} kaldırılacak. Geri yükleme yapılmadı; mevcut kayıtların değişmedi.`;
    }catch(error){if(!signal.aborted)status.textContent=error?.code==='other-context-or-version'
      ?'Diğer Today pencerelerini kapatıp yeniden dene. Kayıtların değişmedi.'
      :'Önizleme tamamlanamadı. Dosya, parola veya veri uyumu doğrulanamadı; kayıtların değişmedi.';}
    finally{busy=false;active=null;file.value='';consent.checked=false;}
  });
  return Object.freeze({invalidate});
}
if(typeof document!=='undefined')mountRestorePreview();
