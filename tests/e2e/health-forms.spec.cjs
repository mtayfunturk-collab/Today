const {test,expect}=require('@playwright/test');
const {randomBytes}=require('node:crypto');
async function open(page){await page.goto(`/runs/${randomBytes(12).toString('hex')}/index.html`);await expect.poll(()=>page.evaluate(()=>window.TodayStartup?.getStatus().phase)).toBe('ready');await expect.poll(()=>page.evaluate(()=>window.TodayHealthHub?.getState().initialized)).toBe(true);await page.locator('#btnStart').click();await page.locator('#btnHomeFromPick').click();await page.locator('#btnModuleHealth').click();}
async function measure(page,name,violations){
 for(const width of [320,393,520])for(const scale of [100,200]){
  await page.setViewportSize({width,height:852});await page.evaluate(scale=>document.documentElement.style.fontSize=scale+'%',scale);
  const controls=await page.locator('[data-view="health"]').evaluate(view=>[...view.querySelectorAll('button,input,textarea,select')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return{id:e.id||e.className,type:e.type,left:r.left,right:r.right,height:r.height,scroll:e.scrollWidth,client:e.clientWidth};}));
  for(const c of controls)if(c.left<0||c.right>width+1||c.height<44||c.scroll>c.client+1)violations.push({name,width,scale,...c});
 }
 await page.evaluate(()=>document.documentElement.style.fontSize='100%');
}
for(const group of ['wellness','sport','nutrition'])test(`Health ${group} inner forms fit narrow and large text layouts`,async({page},info)=>{
 await open(page);const violations=[];
 if(group==='wellness'||group==='sport'){
  const sections=group==='wellness'?['sleep','energy','symptoms','history']:['program','today','exercises','progress'];
  for(const section of sections){
   await page.evaluate(({group,section})=>{TodayHealthHub.showSection(group);if(group==='wellness')TodayHealthHub.showWellnessSection(section);else TodayHealthHub.showSportSection(section);},{group,section});
   await measure(page,section,violations);await page.screenshot({path:info.outputPath(section+'.png'),fullPage:true});
  }
  if(group==='sport'){
   await page.evaluate(()=>TodayHealthHub.showSportSection('program'));
   for(const [group,value]of [['goal','muscle'],['level','beginner'],['days','3'],['duration','45'],['location','gym']])await page.locator(`[data-sport-choice-group="${group}"][data-sport-choice-value="${value}"]`).click();
   await page.locator('#btnCreateSportProgram').click();await expect(page.locator('#sportProgramSummary')).toBeVisible();await measure(page,'program-summary',violations);
   await page.locator('.sportDayCard').first().click();await expect(page.locator('.sportDayTitleInput')).toBeVisible();await measure(page,'program-day-editor',violations);await page.screenshot({path:info.outputPath('program-editor.png'),fullPage:true});
   const title=page.locator('.sportDayTitleInput');await title.fill('Uzun sentetik program günü adı 🌸');await title.focus();await page.keyboard.press('End');expect(await title.evaluate(e=>e.selectionStart)).toBe((await title.inputValue()).length);await page.keyboard.press('Home');expect(await title.evaluate(e=>e.selectionStart)).toBe(0);
   await page.evaluate(()=>TodayHealthHub.showSportSection('today'));await page.locator('.sportWorkoutDayButton').first().click();await expect(page.locator('[data-workout-field]').first()).toBeVisible();await measure(page,'workout-fields',violations);await page.screenshot({path:info.outputPath('workout-fields.png'),fullPage:true});
  }
 }else{
  await page.locator('[data-health-hub-open="nutrition"]').click();await page.locator('[data-nutrition-hub-open="meals"]').click();
  await page.locator('[data-meal-hub-open="add"]').click();await expect(page.locator('#healthMealForm')).toBeVisible();await measure(page,'meal-add',violations);
  await page.evaluate(()=>TodayHealthHub.showSection('nutrition'));await page.locator('[data-nutrition-hub-open="library"]').click();
  for(const kind of ['Food','Recipe']){
   await page.locator('#btnHealthNew'+kind).click();await expect(page.locator('#healthLibraryEditor')).toBeVisible();await measure(page,'library-'+kind,violations);await page.screenshot({path:info.outputPath('library-'+kind+'.png'),fullPage:true});await page.locator('#btnHealthLibraryCancel').click();
  }
 }
 await info.attach('layout-violations',{body:JSON.stringify(violations,null,2),contentType:'application/json'});expect(violations).toEqual([]);
});
