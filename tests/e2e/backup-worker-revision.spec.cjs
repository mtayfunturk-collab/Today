const {test,expect}=require('@playwright/test');
const {randomBytes}=require('node:crypto');

test('A real worker revision during the backup barrier cannot return a trusted capture',async({page,request})=>{
  const scope=randomBytes(12).toString('hex');
  await page.goto(`/runs/${scope}/index.html`);
  await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.goto(`/runs/${scope}/backup.html`);
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);

  const started=await page.evaluate(async()=>{
    const {browserBarrier}=await import('./modules/backup-export.mjs');
    localStorage.setItem('today_synthetic_worker_probe','source');
    window.__oldWorker=navigator.serviceWorker.controller;
    window.__workerChanges=0;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{window.__workerChanges++;});
    window.__captureHold=new Promise(resolve=>{window.__releaseCapture=resolve;});
    window.__barrierOutcome=browserBarrier(window)(async()=>{
      window.__captureEntered=true;
      await window.__captureHold;
      return 'untrusted-capture';
    }).then(value=>({value}),error=>({code:error.code}));
    return {scriptURL:window.__oldWorker.scriptURL,state:window.__oldWorker.state};
  });
  expect(started.scriptURL).toContain(`/runs/${scope}/sw.js`);
  expect(started.state).toBe('activated');
  await expect.poll(()=>page.evaluate(()=>window.__captureEntered===true)).toBe(true);

  expect((await request.post(`/__test/revision/${scope}`)).status()).toBe(204);
  const revisedScript=await (await request.get(`/runs/${scope}/sw.js`)).text();
  expect(revisedScript).toContain('today-v2-foundation-103-e2e-update-1');
  await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});
  await expect.poll(()=>page.evaluate(async()=>
    (await navigator.serviceWorker.getRegistration()).waiting?.state)).toBe('installed');
  await page.evaluate(async()=>{
    const registration=await navigator.serviceWorker.getRegistration();
    registration.waiting.postMessage({type:'TODAY_ACTIVATE_UPDATE'});
  });
  await expect.poll(()=>page.evaluate(()=>
    window.__workerChanges>0&&navigator.serviceWorker.controller!==window.__oldWorker)).toBe(true);
  await page.evaluate(()=>window.__releaseCapture());

  const result=await page.evaluate(async()=>({
    outcome:await window.__barrierOutcome,
    changed:window.__workerChanges>0&&navigator.serviceWorker.controller!==window.__oldWorker,
    source:localStorage.getItem('today_synthetic_worker_probe'),
    recoveryDatabases:(await indexedDB.databases()).filter(db=>db.name==='today_recovery_v1').length
  }));
  expect(result.changed).toBe(true);
  expect(['worker-changed','coordination-unavailable']).toContain(result.outcome.code);
  expect(result.outcome.value).toBeUndefined();
  expect(result.source).toBe('source');
  expect(result.recoveryDatabases).toBe(0);
  console.log('Worker revision diagnostic '+JSON.stringify({code:result.outcome.code,
    controllerChanged:result.changed,recoveryDatabases:result.recoveryDatabases}));
});
