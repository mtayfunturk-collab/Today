const {test,expect}=require('@playwright/test');
const {randomBytes}=require('node:crypto');

// Diagnostic only: a green test means the observations are consistent, not that
// BFCache or a concurrent old writer has passed restore acceptance.
for(const destination of ['about:blank','same-origin backup'])test(`Synthetic ${destination} navigation identifies BFCache without treating reload as a hit`,async({page,request},testInfo)=>{
  const scope=randomBytes(12).toString('hex');
  const key=`TODAY_BFCACHE_PROBE_${scope}`;
  expect((await request.post(`/__test/bfcache/${scope}`)).status()).toBe(204);
  await page.addInitScript(({key})=>{
    const token=crypto.randomUUID();
    let controllerChanges=0;
    let pinnedController;
    const worker=()=>{
      const controller=navigator.serviceWorker?.controller;
      return controller?{scriptURL:controller.scriptURL,state:controller.state}:null;
    };
    Object.defineProperty(window,'__todayBfcacheProbe',{value:{token,
      pinController:()=>{pinnedController=navigator.serviceWorker?.controller;},
      snapshot:()=>({token,worker:worker(),controllerChanges,
        sameControllerObject:pinnedController? navigator.serviceWorker?.controller===pinnedController:null}),
      events:()=>JSON.parse(sessionStorage.getItem(key)||'[]'),
      clear:()=>sessionStorage.removeItem(key)}});
    navigator.serviceWorker?.addEventListener('controllerchange',()=>{controllerChanges++;});
    for(const kind of ['pagehide','pageshow'])window.addEventListener(kind,event=>{
      try {
        const events=JSON.parse(sessionStorage.getItem(key)||'[]');
        events.push({kind,token,persisted:event.persisted,worker:worker(),controllerChanges});
        sessionStorage.setItem(key,JSON.stringify(events));
      } catch { /* about:blank may not have the test origin's storage */ }
    });
  },{key});

  await page.goto(`/runs/${scope}/index.html`);
  await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.evaluate(()=>window.__todayBfcacheProbe.pinController());
  const before=await page.evaluate(()=>window.__todayBfcacheProbe.snapshot());
  await page.goto(destination==='about:blank'?'about:blank':`/runs/${scope}/backup.html`);
  // A BFCache restore does not fire DOMContentLoaded again.
  await page.goBack({waitUntil:'commit'});
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  const after=await page.evaluate(()=>window.__todayBfcacheProbe.snapshot());
  await expect.poll(()=>page.evaluate(()=>window.__todayBfcacheProbe.events()
    .some(event=>event.kind==='pageshow'&&event.token===window.__todayBfcacheProbe.token))).toBe(true);
  const events=await page.evaluate(()=>window.__todayBfcacheProbe.events());
  const notRestoredReasons=await page.evaluate(()=>{
    const reasons=performance.getEntriesByType('navigation')[0]?.notRestoredReasons?.reasons;
    return Array.isArray(reasons)?reasons.map(item=>item.reason):null;
  });
  await page.evaluate(()=>window.__todayBfcacheProbe.clear());

  const outgoing=events.findLast(event=>event.kind==='pagehide'&&event.token===before.token);
  const returned=events.findLast(event=>event.kind==='pageshow'&&event.token===after.token);
  expect(outgoing).toBeDefined();
  expect(returned).toBeDefined();
  expect(before.worker?.scriptURL).toContain(`/runs/${scope}/sw.js`);
  expect(after.worker?.scriptURL).toContain(`/runs/${scope}/sw.js`);
  const sameDocument=before.token===after.token;
  const bfcacheHit=sameDocument&&outgoing.persisted===true&&returned.persisted===true;
  if(testInfo.project.name==='chromium-bfcache')expect(bfcacheHit).toBe(true);
  if(returned.persisted)expect(bfcacheHit).toBe(true);
  if(!sameDocument)expect(bfcacheHit).toBe(false);
  console.log('BFCache diagnostic '+JSON.stringify({destination,bfcacheHit,sameDocument,
    pagehidePersisted:outgoing.persisted,pageshowPersisted:returned.persisted,
    beforeWorker:before.worker,afterWorker:after.worker,
    notRestoredReasons,
    sameControllerObject:after.sameControllerObject,
    beforeControllerChanges:before.controllerChanges,afterControllerChanges:after.controllerChanges}));
});
