import {PLAN_STATES} from './plans-contract.mjs';
import {PLANS_KEY,createPlansStore} from './plans-store.mjs';

let store;
try {store=createPlansStore({storage:window.localStorage,crypto:window.crypto});}
catch {
  const unavailable=()=>{const error=new Error('storage-unavailable');error.code='storage-unavailable';throw error;};
  store={read:unavailable,create:unavailable,update:unavailable,remove:unavailable};
}
const byId=id=>document.getElementById(id);
const form=byId('plansForm'),title=byId('planTitle'),note=byId('planNote');
const state=byId('planState'),day=byId('planDay'),dayRow=byId('planDayRow');
const status=byId('plansStatus'),save=byId('planSave'),cancel=byId('planCancel');
const lists={day:byId('plansDay'),next:byId('plansNext'),doing:byId('plansDoing'),done:byId('plansDone')};
const labels={day:'Bir gün',next:'Sırada',doing:'Yapıyorum',done:'Tamamlandı'};
let editing=null;

function message(error){
  const code=error?.code;
  if(code==='invalid-plans-data')return 'Plan kayıtları okunamadı. Önceki veriler korunuyor; bu ekranda kayıt yapılmadı.';
  if(code==='storage-write-failed'||code==='storage-unavailable')return 'Bu cihazda kayıt yapılamadı. Önceki planlar korunuyor.';
  if(code==='plans-limit')return 'Plan sınırına ulaşıldı. Yeni kayıt yapılmadı.';
  if(code==='plan-not-found')return 'Plan başka bir pencerede değişmiş olabilir. Listeyi yenile.';
  return 'Plan kaydedilemedi. Başlık, tarih ve alanları kontrol et.';
}
function showDay(){dayRow.hidden=state.value!=='day';day.required=!dayRow.hidden;}
function resetForm(){editing=null;form.reset();showDay();save.textContent='Plan ekle';cancel.hidden=true;}
function beginEdit(item,nextState=item.state){
  editing=item.id;title.value=item.title;note.value=item.note;state.value=nextState;
  day.value=nextState==='day'?(item.dayKey||''):'';showDay();
  save.textContent='Değişiklikleri kaydet';cancel.hidden=false;title.focus();
}
function option(value,selected){const node=document.createElement('option');node.value=value;node.textContent=labels[value];node.selected=value===selected;return node;}
function render(){
  let items;
  try {items=store.read().items;status.textContent='';}
  catch(error){status.textContent=message(error);return;}
  for(const [key,list] of Object.entries(lists)){
    list.replaceChildren();
    const group=items.filter(item=>item.state===key);
    if(!group.length){const empty=document.createElement('li');empty.textContent='Henüz plan yok.';list.append(empty);continue;}
    for(const item of group){
      const row=document.createElement('li');row.className='planItem';
      const heading=document.createElement('strong');heading.textContent=item.title;row.append(heading);
      if(item.state==='day'){const date=document.createElement('p');date.textContent=`Gün: ${item.dayKey}`;row.append(date);}
      if(item.note){const detail=document.createElement('p');detail.textContent=item.note;row.append(detail);}
      const actions=document.createElement('div');actions.className='planItemActions';
      const move=document.createElement('select');move.setAttribute('aria-label',`${item.title} durumunu değiştir`);
      for(const value of PLAN_STATES)move.append(option(value,item.state));
      move.addEventListener('change',()=>{
        if(move.value==='day'){beginEdit(item,'day');return;}
        try {store.update(item.id,{state:move.value});render();}
        catch(error){status.textContent=message(error);move.value=item.state;}
      });
      const edit=document.createElement('button');edit.type='button';edit.textContent='Düzenle';edit.addEventListener('click',()=>beginEdit(item));
      const remove=document.createElement('button');remove.type='button';remove.textContent='Sil';remove.addEventListener('click',()=>{
        if(!window.confirm('Bu plan silinsin mi?'))return;
        try {store.remove(item.id);if(editing===item.id)resetForm();render();}
        catch(error){status.textContent=message(error);}
      });
      actions.append(move,edit,remove);row.append(actions);list.append(row);
    }
  }
}

state.addEventListener('change',showDay);
cancel.addEventListener('click',resetForm);
form.addEventListener('submit',event=>{
  event.preventDefault();
  const values={title:title.value,note:note.value,state:state.value,...(state.value==='day'?{dayKey:day.value}:{})};
  try {editing?store.update(editing,values):store.create(values);resetForm();render();status.textContent='Plan kaydedildi.';}
  catch(error){status.textContent=message(error);}
});
byId('btnPlansBack').addEventListener('click',()=>window.TodayRouter?.navigate('modules'));
window.addEventListener('storage',event=>{if(event.key===PLANS_KEY)render();});
showDay();render();
