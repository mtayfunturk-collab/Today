const {test,expect}=require('@playwright/test');
const {randomBytes}=require('node:crypto');

for(const failure of [false,true])test(`Native IndexedDB synthetic restore ${failure?'rolls back a failed write':'commits and verifies'}`,async({page})=>{
  const scope=randomBytes(12).toString('hex');
  await page.goto(`/runs/${scope}/index.html`);
  await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');
  await page.locator('#btnStart').click();
  await page.locator('#note').fill('SYNTHETIC SOURCE NOTE');
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('today_store_v2')?.includes('SYNTHETIC SOURCE NOTE'))).toBe(true);
  await page.goto(`/runs/${scope}/backup.html`);
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  const result=await page.evaluate(async({failure})=>{
    const {captureSnapshot,createBackup,browserBarrier}=await import('./modules/backup-export.mjs');
    const {createSyntheticRecovery}=await import('./modules/backup-recovery.mjs');
    const key='today_store_v2', source=localStorage.getItem(key), password='isolated synthetic browser passphrase';
    const origin={appVersion:TodayVersion.getCurrentVersion().appVersion,origin:location.origin,runtime:'web'};
    let throwOnce=false;
    const storage={get length(){return localStorage.length;},key:i=>localStorage.key(i),
      getItem:k=>localStorage.getItem(k),removeItem:k=>localStorage.removeItem(k),
      setItem(k,v){if(throwOnce&&k===key){throwOnce=false;throw Error('SYNTHETIC_WRITE_FAILURE');}localStorage.setItem(k,v);}};
    const capture=()=>captureSnapshot({storage,indexedDB,contracts:TodayNutritionContracts,crypto,source:origin});
    const barrier=browserBarrier(window);
    const file=(await createBackup({userConfirmed:true,password,confirmation:password,
      crypto,barrier,capture})).file;
    const target=source.replace('SYNTHETIC SOURCE NOTE','SYNTHETIC TARGET NOTE');
    if(target===source)throw Error('source note missing');
    localStorage.setItem(key,target);
    const coordinator=createSyntheticRecovery({syntheticProfile:true,indexedDB,storage,capture,
      contracts:TodayNutritionContracts,crypto,barrier});
    const preview=await coordinator.prepare({file,password,userConfirmed:true});
    if(failure)throwOnce=true;
    const outcome=await coordinator.apply(preview,{replaceConfirmed:true});
    const after=localStorage.getItem(key);
    const startup=await coordinator.guardStartup();
    return {outcome,startup,after,source,target};
  },{failure});
  expect(result.outcome.syntheticOnly).toBe(true);
  expect(result.outcome.restoreValidated).toBe(false);
  expect(result.outcome.status).toBe(failure?'ROLLED_BACK':'COMMITTED');
  expect(result.after).toBe(failure?result.target:result.source);
  expect(result.startup.canStart).toBe(true);
  // apply already completed the rollback; startup verifies and cleans its terminal journal.
  expect(result.startup.status).toBe('VERIFIED_AND_CLEANED');
});

test('Persistent write failure blocks synthetic recovery until the before-image is restored',async({page})=>{
  const scope=randomBytes(12).toString('hex');
  await page.goto(`/runs/${scope}/index.html`);
  await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');
  await page.locator('#btnStart').click();
  await page.locator('#note').fill('SYNTHETIC SOURCE NOTE');
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('today_store_v2')?.includes('SYNTHETIC SOURCE NOTE'))).toBe(true);
  await page.goto(`/runs/${scope}/backup.html`);
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  const result=await page.evaluate(async()=>{
    const {captureSnapshot,createBackup,browserBarrier}=await import('./modules/backup-export.mjs');
    const {createSyntheticRecovery}=await import('./modules/backup-recovery.mjs');
    const key='today_store_v2',legacy='today_app_v10',password='isolated synthetic browser passphrase';
    const origin={appVersion:TodayVersion.getCurrentVersion().appVersion,origin:location.origin,runtime:'web'};
    localStorage.setItem(legacy,JSON.stringify({v:10,days:{},logs:{}}));
    let fail=false;
    const storage={get length(){return localStorage.length;},key:i=>localStorage.key(i),
      getItem:k=>localStorage.getItem(k),
      setItem(k,v){if(fail&&k===legacy)throw Error('SYNTHETIC_PERSISTENT_FAILURE');localStorage.setItem(k,v);},
      removeItem(k){if(fail&&k===legacy)throw Error('SYNTHETIC_PERSISTENT_FAILURE');localStorage.removeItem(k);}};
    const capture=()=>captureSnapshot({storage,indexedDB,contracts:TodayNutritionContracts,crypto,source:origin});
    const barrier=browserBarrier(window);
    const file=(await createBackup({userConfirmed:true,password,confirmation:password,
      crypto,barrier,capture})).file;
    const target=localStorage.getItem(key).replace('SYNTHETIC SOURCE NOTE','SYNTHETIC TARGET NOTE');
    localStorage.setItem(key,target);
    const before=await capture();
    const coordinator=()=>createSyntheticRecovery({syntheticProfile:true,indexedDB,storage,capture,
      contracts:TodayNutritionContracts,crypto,barrier});
    const active=coordinator();
    const preview=await active.prepare({file,password,userConfirmed:true});
    fail=true;
    const applied=await active.apply(preview,{replaceConfirmed:true});
    const blocked=await coordinator().guardStartup();
    fail=false;
    const recovered=await coordinator().guardStartup();
    const after=await capture();
    const clean=await coordinator().guardStartup();
    return {applied:applied.status,blocked:blocked.canStart,recovered:recovered.status,
      clean:clean.status,unchanged:JSON.stringify(after.localStorageEntries)===JSON.stringify(before.localStorageEntries)
        &&JSON.stringify(after.databases)===JSON.stringify(before.databases)};
  });
  expect(result).toEqual({applied:'RECOVERY_REQUIRED',blocked:false,
    recovered:'ROLLED_BACK_AND_CLEANED',clean:'NO_ATTEMPT',unchanged:true});
});

test('Second tab changes synthetic target after preview, so apply stops before writing',async({page,context})=>{
  const scope=randomBytes(12).toString('hex');
  await page.goto(`/runs/${scope}/index.html`);
  await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');
  await page.locator('#btnStart').click();
  await page.locator('#note').fill('SYNTHETIC SOURCE NOTE');
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('today_store_v2')?.includes('SYNTHETIC SOURCE NOTE'))).toBe(true);
  await page.goto(`/runs/${scope}/backup.html`);
  await page.evaluate(async()=>{
    const {captureSnapshot,createBackup}=await import('./modules/backup-export.mjs');
    const {createSyntheticRecovery}=await import('./modules/backup-recovery.mjs');
    const password='separate synthetic tab passphrase';
    const source={appVersion:TodayVersion.getCurrentVersion().appVersion,origin:location.origin,runtime:'web'};
    const capture=()=>captureSnapshot({storage:localStorage,indexedDB,contracts:TodayNutritionContracts,crypto,source});
    const file=(await createBackup({userConfirmed:true,password,confirmation:password,
      crypto,barrier:fn=>fn(),capture})).file;
    window.__recovery=createSyntheticRecovery({syntheticProfile:true,indexedDB,storage:localStorage,
      capture,contracts:TodayNutritionContracts,crypto,barrier:fn=>fn()});
    window.__preview=await window.__recovery.prepare({file,password,userConfirmed:true});
  });
  const other=await context.newPage();
  await other.goto(`/runs/${scope}/backup.html`);
  const changed=await other.evaluate(()=>{
    const key='today_store_v2',before=localStorage.getItem(key);
    const after=before.replace('SYNTHETIC SOURCE NOTE','SYNTHETIC SECOND TAB NOTE');
    if(after===before)throw Error('source note missing');
    localStorage.setItem(key,after);return after;
  });
  const result=await page.evaluate(async()=>{
    try {await window.__recovery.apply(window.__preview,{replaceConfirmed:true});return {error:null};}
    catch(error){return {error:error.code,after:localStorage.getItem('today_store_v2'),
      startup:await window.__recovery.guardStartup()};}
  });
  expect(result.error).toBe('target-changed');
  expect(result.after).toBe(changed);
  expect(result.startup).toMatchObject({canStart:true,status:'NO_ATTEMPT'});
  await other.close();
});

test('Existing Today tab blocks synthetic recovery preparation before journaling',async({page,context})=>{
  const scope=randomBytes(12).toString('hex');
  await page.goto(`/runs/${scope}/index.html`);
  await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');
  await page.locator('#btnStart').click();
  await page.locator('#note').fill('SYNTHETIC SOURCE NOTE');
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('today_store_v2')?.includes('SYNTHETIC SOURCE NOTE'))).toBe(true);
  await page.goto(`/runs/${scope}/backup.html`);
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.evaluate(async()=>{
    const {captureSnapshot,createBackup,browserBarrier}=await import('./modules/backup-export.mjs');
    const password='isolated synthetic browser passphrase';
    const capture=()=>captureSnapshot({storage:localStorage,indexedDB,contracts:TodayNutritionContracts,crypto,
      source:{appVersion:TodayVersion.getCurrentVersion().appVersion,origin:location.origin,runtime:'web'}});
    window.__syntheticFile=(await createBackup({userConfirmed:true,password,confirmation:password,
      crypto,barrier:browserBarrier(window),capture})).file;
  });
  const other=await context.newPage();
  await other.goto(`/runs/${scope}/index.html`);
  const result=await page.evaluate(async()=>{
    const {captureSnapshot,browserBarrier}=await import('./modules/backup-export.mjs');
    const {createSyntheticRecovery,RECOVERY_DB}=await import('./modules/backup-recovery.mjs');
    const before=localStorage.getItem('today_store_v2');
    const capture=()=>captureSnapshot({storage:localStorage,indexedDB,contracts:TodayNutritionContracts,crypto,
      source:{appVersion:TodayVersion.getCurrentVersion().appVersion,origin:location.origin,runtime:'web'}});
    const recovery=createSyntheticRecovery({syntheticProfile:true,indexedDB,storage:localStorage,capture,
      contracts:TodayNutritionContracts,crypto,barrier:browserBarrier(window)});
    let code=null;
    try{await recovery.prepare({file:window.__syntheticFile,password:'isolated synthetic browser passphrase',userConfirmed:true});}
    catch(error){code=error.code;}
    return {code,unchanged:localStorage.getItem('today_store_v2')===before,
      journalAbsent:!(await indexedDB.databases()).some(db=>db.name===RECOVERY_DB)};
  });
  expect(result).toEqual({code:'other-client',unchanged:true,journalAbsent:true});
  await other.close();
});

test('Existing backup barrier rejects a second Today tab before synthetic recovery',async({page,context})=>{
  const scope=randomBytes(12).toString('hex');
  await page.goto(`/runs/${scope}/index.html`);
  await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.goto(`/runs/${scope}/backup.html`);
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  const other=await context.newPage();
  await other.goto(`/runs/${scope}/backup.html`);
  const blocked=await page.evaluate(async()=>{
    const {browserBarrier}=await import('./modules/backup-export.mjs');
    let entered=false;
    try {await browserBarrier(window)(()=>{entered=true;});return {code:null,entered};}
    catch(error){return {code:error.code,entered};}
  });
  expect(blocked).toEqual({code:'other-client',entered:false});
  await other.close();
  const solo=await page.evaluate(async()=>{
    const {browserBarrier}=await import('./modules/backup-export.mjs');
    return browserBarrier(window)(async()=>42);
  });
  expect(solo).toBe(42);
});

test('Exclusive backup barrier holds a new Today navigation until work releases it',async({page,context})=>{
  const scope=randomBytes(12).toString('hex');
  await page.goto(`/runs/${scope}/index.html`);
  await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.goto(`/runs/${scope}/backup.html`);
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.evaluate(async()=>{
    const {browserBarrier}=await import('./modules/backup-export.mjs');
    window.__held=new Promise(resolve=>{window.__release=resolve;});
    window.__barrierResult=browserBarrier(window)(async()=>{
      window.__entered=true;await window.__held;return 'released';
    }).then(value=>({value}),error=>({error:error.code}));
  });
  await expect.poll(()=>page.evaluate(()=>window.__entered===true)).toBe(true);
  const other=await context.newPage();
  let navigated=false;
  const navigation=other.goto(`/runs/${scope}/index.html`).then(()=>{navigated=true;});
  await page.waitForTimeout(300);
  expect(navigated).toBe(false);
  await page.evaluate(()=>window.__release());
  await navigation;
  const result=await page.evaluate(()=>window.__barrierResult);
  expect(['released','other-client']).toContain(result.value??result.error);
  await other.close();
});
