/** Restore-only shape/known-theme checks. No defaults, counters or persistence. */
import {parseBackupJSON} from './backup-export.mjs';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const owns=(v,k)=>Object.hasOwn(v,k);
const THEMES=['system','light','dark','contrast'];
function need(ok,reason){if(!ok){const e=new Error('invalid-core-preferences');e.code='invalid-core-preferences';e.reason=reason;throw e;}}
function theme(value,archive){
  need(typeof value==='string','invalid-theme-type');
  if(!archive)need(THEMES.includes(value),'unsupported-theme');
}
export function validateCorePreferences(value,{archive=false,topTheme=false}={}){
  need(object(value),'invalid-preference-store');
  if(owns(value,'settings')){
    need(object(value.settings),'invalid-settings');
    if(owns(value.settings,'theme'))theme(value.settings.theme,archive);
  }
  // There is no active usage counter writer. Keep safe JSON contents opaque;
  // this check must not invent per-day fields or coerce values into counters.
  if(owns(value,'usage'))need(object(value.usage),'invalid-usage');
  if(topTheme&&owns(value,'theme'))theme(value.theme,archive);
  return Object.freeze({settings:owns(value,'settings'),usage:owns(value,'usage')});
}
export function validateCorePreferenceEntries(entries){
  for(const e of entries){
    if(!e.present||!['today_store_v2','today_store_v2_backup','today_app_v10'].includes(e.key))continue;
    const value=parseBackupJSON(e.rawValue),archive=e.key==='today_store_v2_backup'&&(value?.schemaVersion??0)<2;
    validateCorePreferences(value,{archive,topTheme:e.key==='today_app_v10'||archive});
  }
}
