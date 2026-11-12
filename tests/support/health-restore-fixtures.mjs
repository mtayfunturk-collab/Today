// Current Health UI writer shapes; never loaded by the application.
export function healthValues(label='synthetic'){
  const common={dayKey:'2026-07-01',date:'2026-07-01T12:00:00.000Z',note:'  '+label+';\n🙂  '};
  return {
    'today.health.water.glassMl':350,'today.health.water.targetMl':2800,
    'today.health.wellness.sleep.v1':[{...common,id:'sleep-one',bedtime:'23:30',wakeTime:'07:00',durationMinutes:450,quality:'good',recovery:'okay'}],
    'today.health.wellness.energy.v1':[{...common,id:'energy-one',energy:'balanced',fatigue:'some',body:'neutral'}],
    'today.health.wellness.symptoms.v1':[{...common,id:'symptoms-one',symptoms:['headache','other'],severity:2,bodyArea:'Baş',customSymptom:'  örnek  '}],
    'today.health.sport.program.v1':{goal:'general',level:'beginner',days:3,duration:45,location:'home',equipment:[],createdAt:'2026-07-01T00:00:00.000Z'},
    'today.health.sport.workouts.v1':[{id:'workout-one',date:common.date,dayIndex:0,dayTitle:'  Gün '+label+'  ',durationMinutes:30,
      exercises:[{exerciseId:'push-up',name:'Şınav',muscle:'Göğüs',image:'./assets/sport/push-up.jpg',sets:3,reps:10,kg:0,completed:true}]}],
    'today.health.sport.customDays.v1':{'0':['push-up','one-arm-row'],'4':[]},
    'today.health.sport.daySettings.v1':{'0':{title:'  Gün '+label+'  ',exercises:{'push-up':{sets:4},'one-arm-row':{reps:12}}},'4':{title:'Eski program günü'}}
  };
}
export const healthSeed=label=>Object.fromEntries(Object.entries(healthValues(label)).map(([key,value])=>[key,JSON.stringify(value)]));
