const {test,expect}=require('@playwright/test');
const {randomBytes}=require('node:crypto');

// Characterization only. A passing diagnostic is not restore safety acceptance.
test('BFCache page reports whether its synthetic writer bypasses an active backup lock',async({page,context,request})=>{
  const scope=randomBytes(12).toString('hex');
  const key='today_synthetic_bfcache_writer';
  const lockName=`today:backup:v1:/runs/${scope}/`;
  expect((await request.post(`/__test/bfcache/${scope}`)).status()).toBe(204);
  await page.goto(`/runs/${scope}/index.html`);
  await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  const oldToken=await page.evaluate(({key,lockName})=>{
    const token=crypto.randomUUID();
    window.__oldDocumentToken=token;
    localStorage.setItem(key,'source');
    window.addEventListener('pageshow',async event=>{
      if(!event.persisted)return;
      const before=await navigator.locks.query();
      const lockHeld=before.held.some(lock=>lock.name===lockName&&lock.mode==='exclusive');
      localStorage.setItem(key,'resumed');
      window.__oldWriterResult={token,persisted:event.persisted,lockHeld,
        wrote:localStorage.getItem(key)==='resumed'};
    });
    return token;
  },{key,lockName});
  await page.goto('about:blank');

  const backup=await context.newPage();
  await backup.goto(`/runs/${scope}/backup.html`);
  await expect.poll(()=>backup.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  await backup.evaluate(async()=>{
    const {browserBarrier}=await import('./modules/backup-export.mjs');
    window.__hold=new Promise(resolve=>{window.__release=resolve;});
    window.__barrierOutcome=browserBarrier(window)(async()=>{
      window.__entered=true;
      await window.__hold;
      return 'synthetic-capture';
    }).then(value=>({value}),error=>({code:error.code}));
  });
  await expect.poll(()=>backup.evaluate(()=>window.__entered===true)).toBe(true);
  await page.goBack({waitUntil:'commit'});
  await expect.poll(()=>page.evaluate(()=>Boolean(window.__oldWriterResult))).toBe(true);
  const oldWriter=await page.evaluate(()=>window.__oldWriterResult);
  expect(oldWriter.token).toBe(oldToken);
  expect(oldWriter.persisted).toBe(true);
  const during=await backup.evaluate(async()=>({
    held:(await navigator.locks.query()).held.some(lock=>lock.name===`today:backup:v1:${new URL('./',location.href).pathname}`&&lock.mode==='exclusive'),
    source:localStorage.getItem('today_synthetic_bfcache_writer')
  }));
  await backup.evaluate(()=>window.__release());
  const outcome=await backup.evaluate(()=>window.__barrierOutcome);
  console.log('BFCache writer diagnostic '+JSON.stringify({
    persisted:oldWriter.persisted,lockHeldAtWrite:oldWriter.lockHeld,
    wrote:oldWriter.wrote,lockStillHeld:during.held,outcome:outcome.code??null}));
  expect(oldWriter.lockHeld).toBe(true);
  expect(oldWriter.wrote).toBe(true);
  expect(during.held).toBe(true);
  expect(during.source).toBe('resumed');
  expect(outcome.code).toBe('other-client');
  await backup.close();
});
