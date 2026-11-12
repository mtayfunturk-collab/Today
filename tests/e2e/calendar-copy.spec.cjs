const{test,expect}=require('@playwright/test');const{randomBytes}=require('node:crypto');
test('Calendar uses dictionary weekdays and formatter without changing keys or editability',async({page,context})=>{
 await context.addInitScript(()=>Object.defineProperty(navigator,'serviceWorker',{value:undefined}));
 await context.route('**/modules/locales/core-tr.mjs',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('"calendar.weekday.mon.short": "Pzt"','"calendar.weekday.mon.short": "Sentetik"').replace('"calendar.weekday.mon.full": "Pazartesi"','"calendar.weekday.mon.full": "Sentetik Pazartesi"')});});
 await page.goto(`/runs/${randomBytes(12).toString('hex')}/index.html`);await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');
 await page.locator('#btnStart').click();
 expect(await page.locator('#pillDate').textContent()).toBe(await page.evaluate(()=>TodayDay.prettyTR(TodayDay.todayKey())));
 await page.locator('#note').fill('Sentetik takvim notu');await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('today_store_v2')).days[TodayDay.todayKey()]?.note)).toBe('Sentetik takvim notu');
 await page.locator('#btnCalendar').click();
 await expect(page.locator('#calGrid [role="columnheader"]').first()).toHaveText('Sentetik');await expect(page.locator('#calGrid [role="columnheader"]').first()).toHaveAttribute('aria-label','Sentetik Pazartesi');
 await expect(page.locator('#calGrid [aria-current="date"]')).toHaveCount(1);await expect(page.locator('#calGrid [aria-disabled="false"]')).toHaveCount(1);
 expect(await page.locator('#monthTitle').textContent()).toBe(await page.evaluate(()=>new Date().toLocaleDateString('tr-TR',{month:'long',year:'numeric'})));
 const snapshot=await page.evaluate(()=>({key:TodayDay.todayKey(),note:JSON.parse(localStorage.getItem('today_store_v2')).days[TodayDay.todayKey()].note,immutable:Object.isFrozen(TodayCalendarCopy)&&Object.isFrozen(TodayCalendarCopy.weekdays),count:TodayCalendarCopy.weekdays.length}));expect(snapshot).toMatchObject({note:'Sentetik takvim notu',immutable:true,count:7});
 await page.locator('#btnBackToPick').click();await expect(page.locator('#note')).toHaveValue(snapshot.note);expect(await page.evaluate(()=>TodayDay.todayKey())).toBe(snapshot.key);
});
test('Calendar aria uses templates without exposing note text or changing records',async({page,context})=>{
 await context.addInitScript(()=>Object.defineProperty(navigator,'serviceWorker',{value:undefined}));
 await context.route('**/modules/locales/core-tr.mjs',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('"calendar.day.today": "bugün"','"calendar.day.today": "Sentetik bugün"').replace('"calendar.day.hasNote": "not var"','"calendar.day.hasNote": "Sentetik not var"').replace('"calendar.day.aria": "{date}, {relation}, {record}{hint}"','"calendar.day.aria": "Sentetik şablon: {date}, {relation}, {record}{hint}"')});});
 await page.goto(`/runs/${randomBytes(12).toString('hex')}/index.html`);await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');
 await page.locator('#btnStart').click();await page.locator('[data-choice="B"]').click();await page.locator('[data-color="mint"]').click();await page.locator('#note').fill('SECRET-SYNTHETIC-NOTE-123');
 const record=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('today_store_v2')).days[TodayDay.todayKey()]);
 await expect.poll(record).toMatchObject({note:'SECRET-SYNTHETIC-NOTE-123'});const before=await record();
 await page.locator('#btnCalendar').click();const today=page.locator('#calGrid [aria-current="date"]');
 await expect(today).toHaveAttribute('aria-label',/Sentetik şablon:.*Sentetik bugün.*Her şey çok net.*renk Nane.*Sentetik not var/);
 expect(await today.getAttribute('aria-label')).not.toContain('SECRET-SYNTHETIC-NOTE-123');
 await expect(today).toHaveAttribute('aria-disabled','false');await expect(page.locator('#calGrid [aria-disabled="false"]')).toHaveCount(1);
 expect(await record()).toEqual(before);await today.press('Enter');await expect(page.locator('#note')).toHaveValue('SECRET-SYNTHETIC-NOTE-123');
});
