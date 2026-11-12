'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const { resolveLanguage: resolve, AVAILABLE_LANGUAGES } = await import('../modules/language-resolver.mjs');
  const ready = Object.freeze(['tr', 'en']);
  const results = [];
  const expect = (input, language, reason) => assert.deepEqual(resolve(input), {effectiveLanguage: language, reason});
  async function test(name, callback) {
    try { await callback(); results.push({name, ok:true}); }
    catch(error) { results.push({name, ok:false, error:error.message}); }
  }
  await test('Default build offers only Turkish and a deterministic fallback', () => {
    assert.deepEqual(AVAILABLE_LANGUAGES, ['tr']);assert.equal(Object.isFrozen(AVAILABLE_LANGUAGES),true);expect(undefined,'tr','fallback');
  });
  await test('Manual Turkish overrides an English device preference', () => {
    expect({preference:'tr',deviceLanguages:['en-US'],availableLanguages:ready},'tr','manual');
  });
  await test('Manual English wins only when explicitly ready', () => {
    expect({preference:'en',deviceLanguages:['tr-TR'],availableLanguages:ready},'en','manual');
  });
  await test('Unavailable saved English is preserved without silently selecting auto', () => {
    const input=Object.freeze({preference:'en',deviceLanguages:Object.freeze(['tr-TR'])});expect(input,'tr','unavailable-preference');assert.equal(input.preference,'en');
  });
  await test('Unsupported or malformed saved preferences fail safely without coercion', () => {
    for(const preference of [null,false,0,'','de','TR','en-US',' auto',{},['en']]) expect({preference,deviceLanguages:['en-US'],availableLanguages:ready},'tr','unsupported-preference');
  });
  await test('Absent and auto preferences honor device list order among ready languages', () => {
    for(const preference of [undefined,'auto']) {
      expect({preference,deviceLanguages:['fr-FR','en-GB','tr-TR'],availableLanguages:ready},'en','device');
      expect({preference,deviceLanguages:['tr-TR','en-US'],availableLanguages:ready},'tr','device');
    }
  });
  await test('An English device cannot enable incomplete English in the default build', () => {
    expect({deviceLanguages:['en-US']},'tr','fallback');expect({deviceLanguages:['en-US','tr-TR']},'tr','device');
  });
  await test('Turkish region script and casing variants resolve by valid BCP47 base', () => {
    for(const tag of ['tr','tr-TR','TR-tr','tr-Latn-TR']) expect({deviceLanguages:[tag]},'tr','device');
  });
  await test('English region and casing variants resolve only with explicit readiness', () => {
    for(const tag of ['en','en-US','en-GB','EN-us']) expect({deviceLanguages:[tag],availableLanguages:ready},'en','device');
  });
  await test('Prefix lookalikes malformed tags and unsupported languages do not match', () => {
    expect({deviceLanguages:['english','trick','en_US','en-','en!',' ','fr-FR'],availableLanguages:ready},'tr','fallback');
  });
  await test('Invalid device entries are skipped without invoking their coercion hooks', () => {
    const poison={toString(){throw new Error('must not coerce');}};expect({deviceLanguages:[null,7,false,poison,['en-US'],'tr-TR']},'tr','device');
  });
  await test('Malformed options or device lists cannot crash resolution', () => {
    for(const input of [null,0,false,'en',[]])expect(input,'tr','fallback');
    for(const deviceLanguages of [null,undefined,'en-US',{0:'en-US',length:1},42])expect({deviceLanguages,availableLanguages:ready},'tr','fallback');
  });
  await test('Readiness accepts exact supported IDs and rejects malformed configuration', () => {
    for(const availableLanguages of [null,'en',{},['en-US'],['de']])expect({deviceLanguages:['en-US'],availableLanguages},'tr','fallback');
    expect({deviceLanguages:['de-DE','en-US'],availableLanguages:['de','en']},'en','device');
  });
  await test('Mandatory Turkish fallback cannot be disabled by an empty readiness list', () => {
    expect({deviceLanguages:['tr-TR'],availableLanguages:[]},'tr','device');expect({preference:'tr',availableLanguages:['en']},'tr','manual');
  });
  await test('Unicode locale extensions affect neither language identity nor stored input', () => {
    const tag='en-US-u-ca-gregory-nu-latn';expect({deviceLanguages:[tag],availableLanguages:ready},'en','device');assert.equal(tag,'en-US-u-ca-gregory-nu-latn');
  });
  await test('Oversized tags and excessive device lists have bounded handling', () => {
    expect({deviceLanguages:['en-x-'+('a123456-'.repeat(17))+'z'],availableLanguages:ready},'tr','fallback');
    expect({deviceLanguages:[...Array(31).fill('fr-FR'),'en-US'],availableLanguages:ready},'en','device');
    expect({deviceLanguages:[...Array(32).fill('fr-FR'),'en-US'],availableLanguages:ready},'tr','fallback');
  });
  await test('Frozen input is unchanged and returned state is immutable', () => {
    const input=Object.freeze({preference:'auto',deviceLanguages:Object.freeze(['fr-FR','en-GB']),availableLanguages:ready});const before=JSON.stringify(input);const output=resolve(input);assert.equal(output.effectiveLanguage,'en');assert.equal(JSON.stringify(input),before);assert.equal(Object.isFrozen(output),true);assert.throws(()=>{output.effectiveLanguage='tr';},TypeError);
  });
  await test('Repeated calls do not retain a previous manual preference or device language', () => {
    expect({preference:'en',availableLanguages:ready},'en','manual');expect({deviceLanguages:['tr-TR'],availableLanguages:ready},'tr','device');expect({deviceLanguages:['en-US'],availableLanguages:ready},'en','device');expect({},'tr','fallback');
  });
  await test('Import and calls do not access DOM storage network or device globals', async () => {
    const names=['window','document','navigator','localStorage','indexedDB','fetch'];const originals=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
    try {
      for(const name of names)Object.defineProperty(globalThis,name,{configurable:true,get(){throw new Error('unexpected global access: '+name);}});
      const isolated=await import('../modules/language-resolver.mjs?isolated-test');assert.deepEqual(isolated.resolveLanguage({deviceLanguages:['tr-TR']}),{effectiveLanguage:'tr',reason:'device'});
    } finally {for(const name of names){const descriptor=originals.get(name);if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
  });
  await test('The isolated resolver is not wired into UI startup other modules or the SW shell', () => {
    for(const name of ['index.html','sw.js',...fs.readdirSync('modules').filter(n=>/\.(?:js|mjs)$/.test(n)&&n!=='language-resolver.mjs').map(n=>'modules/'+n)])assert.equal(fs.readFileSync(name,'utf8').includes('language-resolver.mjs'),false,name);
  });
  for(const r of results)console.log(`${r.ok?'PASS':'FAIL'}: ${r.name}${r.error?' — '+r.error:''}`);
  const passed=results.filter(r=>r.ok).length;console.log(`Language Resolver: ${passed}/${results.length} başarılı`);if(passed!==results.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
