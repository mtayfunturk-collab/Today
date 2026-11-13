const {test,expect}=require('@playwright/test');
const {randomBytes}=require('node:crypto');

test('Backup return opens modules without changing the normal home entry',async({page})=>{
  const path=`/runs/${randomBytes(12).toString('hex')}/backup.html`;
  await page.goto(path);
  await page.getByRole('link',{name:'Today’e dön'}).click();
  await expect(page).toHaveURL(/\/index\.html\?fromBackup=modules$/);
  await expect(page.locator('body')).toHaveAttribute('data-route','modules');
  await expect(page.getByRole('heading',{name:'TODAY',exact:true})).toBeVisible();

  await page.goto(path.replace('backup.html','index.html?fromBackup=unknown'));
  await expect(page.locator('body')).toHaveAttribute('data-route','home');
});

test('Backup worker accepts one queried page and identifies a second live tab',async({page,context})=>{
  const root=`/runs/${randomBytes(12).toString('hex')}/`;
  await page.goto(root+'index.html');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.goto(root+'backup.html?from=settings');
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  const probe=()=>page.evaluate(async()=>{
    const channel=new MessageChannel();
    const answer=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('worker timeout')),3000);
      channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};
    });
    navigator.serviceWorker.controller.postMessage({type:'TODAY_BACKUP_CHECK'},[channel.port2]);
    return answer;
  });
  await expect.poll(async()=>(await probe()).onlyClient).toBe(true);
  const second=await context.newPage();
  await second.goto(root+'index.html');
  await expect.poll(async()=>(await probe()).denyReason).toBe('other-client');
  await second.close();
  await expect.poll(async()=>(await probe()).onlyClient).toBe(true);
});

test('Separate backup page requires explicit consent and does not write on load',async({page,context})=>{
  const writes=[];
  await context.addInitScript(()=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
      window.__todayBackupWrites??=[];
      window.__todayBackupWrites.push(key);
      return original.call(this,key,value);
    };
  });
  const path=`/runs/${randomBytes(12).toString('hex')}/backup.html`;
  const response=await page.goto(path);
  expect(response.status()).toBe(200);
  await expect(page.getByRole('heading',{name:'Tam yedek'})).toBeVisible();
  await expect(page.getByText('Geri yükleme henüz etkin değildir',{exact:false})).toBeVisible();
  expect(await page.evaluate(()=>window.__todayBackupWrites??[])).toEqual([]);
  await page.locator('#backupPassword').fill('synthetic password 123');
  await page.locator('#backupConfirmation').fill('synthetic password 123');
  await page.getByRole('button',{name:'Yedek dosyasını hazırla'}).click();
  await expect(page.locator('#backupStatus')).toContainText('Önce dosya oluşturma onayını seç.');
  await expect(page.locator('#backupDownload')).toBeHidden();
  expect(await page.evaluate(()=>window.__todayBackupWrites??[])).toEqual([]);
  expect(writes).toEqual([]);
});

test('Real worker reports backup navigation lock capability before launch',async({page})=>{
  const path=`/runs/${randomBytes(12).toString('hex')}/index.html`;
  await page.goto(path);
  await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  const result=await page.evaluate(async()=>{
    const channel=new MessageChannel();
    const response=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('worker timed out')),3000);
      channel.port1.onmessage=event=>{clearTimeout(timer);resolve(event.data);};
    });
    navigator.serviceWorker.controller.postMessage({type:'TODAY_BACKUP_CHECK'},[channel.port2]);
    return response;
  });
  expect(result.protocol).toBe(1);
  expect(result.scope).toBe(new URL('.',page.url()).href);
  expect(result.onlyClient).toBe(false);
  expect(typeof result.navigationLock).toBe('boolean');
  console.log('BACKUP_WORKER_LOCK '+test.info().project.name+' '+result.navigationLock);
});

test('Settings launch enters isolated backup page and creates a verified synthetic file',async({page})=>{
  const path=`/runs/${randomBytes(12).toString('hex')}/index.html`;
  await page.goto(path);
  await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.locator('#btnStart').click();
  await page.locator('#note').fill('SENTETIK-YEDEK-NOTU');
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('today_store_v2')).days[TodayDay.todayKey()]?.note)).toBe('SENTETIK-YEDEK-NOTU');
  await page.locator('#btnCalendar').click();
  await page.locator('#btnOpenSettings').click();
  await page.locator('#btnBackupLaunch').click();
  await expect(page).toHaveURL(/\/backup\.html$/);
  await expect(page.locator('#backupDownload')).toBeHidden();
  await page.locator('#backupConsent').check();
  await page.locator('#backupPassword').fill('synthetic passphrase 123');
  await page.locator('#backupConfirmation').fill('synthetic passphrase 123');
  await page.getByRole('button',{name:'Yedek dosyasını hazırla'}).click();
  await expect(page.locator('#backupDownload')).toBeVisible({timeout:20000});
  const result=await page.evaluate(async()=>{
    const response=await fetch(document.querySelector('#backupDownload').href);
    const text=await response.text();
    const {verifyBackupFile}=await import('./modules/backup-export.mjs');
    return {raw:text.includes('SENTETIK-YEDEK-NOTU'),verified:await verifyBackupFile(text,'synthetic passphrase 123'),core:localStorage.getItem('today_store_v2')};
  });
  expect(result.raw).toBe(false);
  expect(result.verified).toMatchObject({ok:true,sections:24,restoreValidated:false});
  expect(result.core).toContain('SENTETIK-YEDEK-NOTU');
  const preview=await page.evaluate(async()=>{
    const text=await (await fetch(document.querySelector('#backupDownload').href)).text();
    const {prepareRestorePreview,revalidateRestorePreview}=await import('./modules/backup-restore-preview.mjs');
    const {captureSnapshot}=await import('./modules/backup-export.mjs');
    const capture=()=>captureSnapshot({storage:localStorage,indexedDB,contracts:TodayNutritionContracts,
      crypto,source:{appVersion:TodayVersion.getCurrentVersion().appVersion,origin:location.origin,runtime:'web'}});
    const value=await prepareRestorePreview({userConfirmed:true,file:text,password:'synthetic passphrase 123',
      barrier:fn=>fn(),capture,contracts:TodayNutritionContracts,crypto});
    const unchanged=await revalidateRestorePreview(value);
    return {status:value.status,applyAvailable:value.applyAvailable,restoreValidated:value.restoreValidated,
      unchanged:unchanged.unchanged,after:localStorage.getItem('today_store_v2')};
  });
  expect(preview).toMatchObject({status:'preview-only',applyAvailable:false,restoreValidated:false,unchanged:true});
  expect(preview.after).toContain('SENTETIK-YEDEK-NOTU');
});

test('Backup page previews a synthetic file only after separate read consent',async({page})=>{
  const path=`/runs/${randomBytes(12).toString('hex')}/index.html`;
  await page.goto(path);
  await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.locator('#btnStart').click();
  await page.locator('#note').fill('SYNTHETIC PREVIEW NOTE');
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('today_store_v2')?.includes('SYNTHETIC PREVIEW NOTE'))).toBe(true);
  await page.goto(path.replace('index.html','backup.html'));
  await page.locator('#backupConsent').check();
  await page.locator('#backupPassword').fill('synthetic preview password');
  await page.locator('#backupConfirmation').fill('synthetic preview password');
  await page.getByRole('button',{name:'Yedek dosyasını hazırla'}).click();
  await expect(page.locator('#backupDownload')).toBeVisible({timeout:20000});
  const file=await page.evaluate(async()=>await (await fetch(document.querySelector('#backupDownload').href)).text());
  const before=await page.evaluate(()=>localStorage.getItem('today_store_v2'));
  await page.getByText('Geri yükleme kapsamını önizle').click();
  await page.locator('#restorePreviewFile').setInputFiles({name:'synthetic.today-backup.json',mimeType:'application/json',buffer:Buffer.from(file)});
  await page.locator('#restorePreviewPassword').fill('synthetic preview password');
  await page.getByRole('button',{name:'Kapsamı önizle'}).click();
  await expect(page.locator('#restorePreviewStatus')).toContainText('Önce yalnız okuma onayını seç.');
  await page.locator('#restorePreviewConsent').check();
  await page.getByRole('button',{name:'Kapsamı önizle'}).click();
  await expect(page.locator('#restorePreviewStatus')).toContainText('Geri yükleme yapılmadı',{timeout:20000});
  expect(await page.evaluate(()=>localStorage.getItem('today_store_v2'))).toBe(before);
  expect(await page.evaluate(async()=>!(await indexedDB.databases()).some(db=>db.name==='today_recovery_v1'))).toBe(true);
  await page.context().setOffline(true);
  await page.reload();
  await page.getByText('Geri yükleme kapsamını önizle').click();
  await page.locator('#restorePreviewFile').setInputFiles({name:'synthetic.today-backup.json',mimeType:'application/json',buffer:Buffer.from(file)});
  await page.locator('#restorePreviewPassword').fill('synthetic preview password');
  await page.locator('#restorePreviewConsent').check();
  await page.getByRole('button',{name:'Kapsamı önizle'}).click();
  await expect(page.locator('#restorePreviewStatus')).toContainText('Geri yükleme yapılmadı',{timeout:20000});
  expect(await page.evaluate(()=>localStorage.getItem('today_store_v2'))).toBe(before);
});
