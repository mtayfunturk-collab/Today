import {PLACE_STATES} from './places-contract.mjs';
import {PLACES_KEY,createPlacesStore} from './places-store.mjs';

let store;
try{store=createPlacesStore({storage:window.localStorage,crypto:window.crypto});}
catch{
  const unavailable=()=>{const error=new Error('storage-unavailable');error.code='storage-unavailable';throw error;};
  store={read:unavailable,create:unavailable,update:unavailable,remove:unavailable};
}
const byId=id=>document.getElementById(id);
const form=byId('placesForm'),name=byId('placeName'),city=byId('placeCity'),note=byId('placeNote');
const address=byId('placeAddress'),url=byId('placeUrl'),state=byId('placeState');
const status=byId('placesStatus'),save=byId('placeSave'),cancel=byId('placeCancel');
const lists={want:byId('placesWant'),visited:byId('placesVisited')};
const labels={want:'Gitmek istiyorum',visited:'Gittim'};
let editing=null;
function message(error){
  const code=error?.code;
  if(code==='invalid-places-data')return 'Yer kayıtları okunamadı. Önceki veriler korunuyor; kayıt yapılmadı.';
  if(code==='storage-write-failed'||code==='storage-unavailable')return 'Bu cihazda kayıt yapılamadı. Önceki yerler korunuyor.';
  if(code==='places-limit')return 'Yer sınırına ulaşıldı. Yeni kayıt yapılmadı.';
  if(code==='place-not-found')return 'Yer başka bir pencerede değişmiş olabilir. Listeyi yenile.';
  return 'Yer kaydedilemedi. Ad, şehir ve bağlantı alanlarını kontrol et.';
}
function resetForm(){editing=null;form.reset();save.textContent='Yer ekle';cancel.hidden=true;}
function beginEdit(item){
  editing=item.id;name.value=item.name;city.value=item.city;note.value=item.note;
  address.value=item.address;url.value=item.url;state.value=item.state;
  save.textContent='Değişiklikleri kaydet';cancel.hidden=false;name.focus();
}
function render(){
  let items;
  try{items=store.read().items;status.textContent='';}catch(error){status.textContent=message(error);return;}
  for(const [key,list] of Object.entries(lists)){
    list.replaceChildren();const group=items.filter(item=>item.state===key);
    if(!group.length){const empty=document.createElement('li');empty.textContent='Henüz yer yok.';list.append(empty);continue;}
    for(const item of group){
      const row=document.createElement('li');row.className='placeItem';
      const heading=document.createElement('strong');heading.textContent=item.name;row.append(heading);
      const location=document.createElement('p');location.textContent=item.city;row.append(location);
      if(item.note){const detail=document.createElement('p');detail.textContent=item.note;row.append(detail);}
      if(item.address){const detail=document.createElement('p');detail.textContent=item.address;row.append(detail);}
      const actions=document.createElement('div');actions.className='placeItemActions';
      const move=document.createElement('select');move.setAttribute('aria-label',`${item.name} durumunu değiştir`);
      for(const value of PLACE_STATES){const option=document.createElement('option');option.value=value;option.textContent=labels[value];option.selected=value===item.state;move.append(option);}
      move.addEventListener('change',()=>{try{store.update(item.id,{state:move.value});render();}catch(error){status.textContent=message(error);move.value=item.state;}});
      const edit=document.createElement('button');edit.type='button';edit.textContent='Düzenle';edit.addEventListener('click',()=>beginEdit(item));
      const remove=document.createElement('button');remove.type='button';remove.textContent='Sil';remove.addEventListener('click',()=>{
        if(!window.confirm('Bu yer silinsin mi?'))return;
        try{store.remove(item.id);if(editing===item.id)resetForm();render();}catch(error){status.textContent=message(error);}
      });
      actions.append(move,edit,remove);
      if(item.url){const link=document.createElement('a');link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Bağlantıyı aç';actions.append(link);}
      row.append(actions);list.append(row);
    }
  }
}
cancel.addEventListener('click',resetForm);
form.addEventListener('submit',event=>{
  event.preventDefault();const values={name:name.value,city:city.value,note:note.value,address:address.value,url:url.value,state:state.value};
  try{editing?store.update(editing,values):store.create(values);resetForm();render();status.textContent='Yer kaydedildi.';}
  catch(error){status.textContent=message(error);}
});
byId('btnPlacesBack').addEventListener('click',()=>window.TodayRouter?.navigate('modules'));
window.addEventListener('storage',event=>{if(event.key===PLACES_KEY)render();});
render();
