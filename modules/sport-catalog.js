// Shared, side-effect-free data contract for the Health UI and restore validator.
// No DOM, storage, network or Health startup. Classic browser script + CommonJS.
(function(root,factory){
  const catalog=factory();
  if(typeof module==='object'&&module.exports)module.exports=catalog;
  else root.TodaySportCatalog=catalog;
})(typeof globalThis==='object'?globalThis:this,function(){
  "use strict";
  const library = [
    {id:"bench-press",name:"Bench Press",muscle:"Göğüs",category:"Göğüs",equipment:"Barbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/bench-press.jpg"},
    {id:"incline-dumbbell-press",name:"Incline Dumbbell Press",muscle:"Üst göğüs",category:"Göğüs",equipment:"Dumbbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/incline-dumbbell-press.jpg"},
    {id:"decline-bench-press",name:"Decline Bench Press",muscle:"Alt göğüs",category:"Göğüs",equipment:"Barbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/decline-bench-press.jpg"},
    {id:"cable-fly",name:"Cable Fly",muscle:"Göğüs",category:"Göğüs",equipment:"Cable",type:"strength",goals:["muscle","strength"],image:"./assets/sport/cable-fly.jpg"},
    {id:"push-up",name:"Şınav",muscle:"Göğüs · Triceps",category:"Göğüs",equipment:"Ekipmansız",type:"bodyweight",goals:["muscle","condition","general"],image:"./assets/sport/push-up.jpg"},
    {id:"chest-press",name:"Chest Press",muscle:"Göğüs",category:"Göğüs",equipment:"Makine",type:"strength",goals:["muscle","strength"],image:"./assets/sport/chest-press.jpg"},
    {id:"lat-pulldown",name:"Lat Pulldown",muscle:"Sırt",category:"Sırt",equipment:"Cable",type:"strength",goals:["muscle","strength"],image:"./assets/sport/lat-pulldown.jpg"},
    {id:"barbell-row",name:"Barbell Row",muscle:"Sırt",category:"Sırt",equipment:"Barbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/barbell-row.jpg"},
    {id:"cable-row",name:"Seated Cable Row",muscle:"Sırt",category:"Sırt",equipment:"Cable",type:"strength",goals:["muscle","strength"],image:"./assets/sport/cable-row.jpg"},
    {id:"t-bar-row",name:"T-Bar Row",muscle:"Sırt",category:"Sırt",equipment:"Makine",type:"strength",goals:["muscle","strength"],image:"./assets/sport/t-bar-row.jpg"},
    {id:"straight-arm-pulldown",name:"Straight Arm Pulldown",muscle:"Lat",category:"Sırt",equipment:"Cable",type:"strength",goals:["muscle","strength"],image:"./assets/sport/straight-arm-pulldown.jpg"},
    {id:"pull-up",name:"Pull Up",muscle:"Sırt",category:"Sırt",equipment:"Barfiks",type:"bodyweight",goals:["muscle","strength","general"],image:"./assets/sport/pull-up.jpg"},
    {id:"shoulder-press",name:"Shoulder Press",muscle:"Omuz",category:"Omuz",equipment:"Dumbbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/shoulder-press.jpg"},
    {id:"lateral-raise",name:"Lateral Raise",muscle:"Yan omuz",category:"Omuz",equipment:"Dumbbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/lateral-raise.jpg"},
    {id:"front-raise",name:"Front Raise",muscle:"Ön omuz",category:"Omuz",equipment:"Dumbbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/front-raise.jpg"},
    {id:"rear-delt-fly",name:"Rear Delt Fly",muscle:"Arka omuz",category:"Omuz",equipment:"Dumbbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/rear-delt-fly.jpg"},
    {id:"arnold-press",name:"Arnold Press",muscle:"Omuz",category:"Omuz",equipment:"Dumbbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/arnold-press.jpg"},
    {id:"upright-row",name:"Upright Row",muscle:"Omuz · Trapez",category:"Omuz",equipment:"Barbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/upright-row.jpg"},
    {id:"biceps-curl",name:"Biceps Curl",muscle:"Biceps",category:"Kol",equipment:"Dumbbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/biceps-curl.jpg"},
    {id:"hammer-curl",name:"Hammer Curl",muscle:"Biceps · Ön kol",category:"Kol",equipment:"Dumbbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/hammer-curl.jpg"},
    {id:"triceps-pushdown",name:"Triceps Pushdown",muscle:"Triceps",category:"Kol",equipment:"Cable",type:"strength",goals:["muscle","strength"],image:"./assets/sport/triceps-pushdown.jpg"},
    {id:"skull-crusher",name:"Skull Crusher",muscle:"Triceps",category:"Kol",equipment:"Barbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/skull-crusher.jpg"},
    {id:"concentration-curl",name:"Concentration Curl",muscle:"Biceps",category:"Kol",equipment:"Dumbbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/concentration-curl.jpg"},
    {id:"cable-curl",name:"Cable Curl",muscle:"Biceps",category:"Kol",equipment:"Cable",type:"strength",goals:["muscle","strength"],image:"./assets/sport/cable-curl.jpg"},
    {id:"bodyweight-squat",name:"Squat",muscle:"Bacak · Kalça",category:"Bacak",equipment:"Barbell",type:"strength",goals:["muscle","strength","general"],image:"./assets/sport/bodyweight-squat.jpg"},
    {id:"leg-press",name:"Leg Press",muscle:"Bacak",category:"Bacak",equipment:"Makine",type:"strength",goals:["muscle","strength"],image:"./assets/sport/leg-press.jpg"},
    {id:"deadlift",name:"Romanian Deadlift",muscle:"Arka bacak · Kalça",category:"Bacak",equipment:"Barbell",type:"strength",goals:["muscle","strength"],image:"./assets/sport/deadlift.jpg"},
    {id:"leg-extension",name:"Leg Extension",muscle:"Ön bacak",category:"Bacak",equipment:"Makine",type:"strength",goals:["muscle","strength"],image:"./assets/sport/leg-extension.jpg"},
    {id:"leg-curl",name:"Leg Curl",muscle:"Arka bacak",category:"Bacak",equipment:"Makine",type:"strength",goals:["muscle","strength"],image:"./assets/sport/leg-curl.jpg"},
    {id:"calf-raise",name:"Calf Raise",muscle:"Baldır",category:"Bacak",equipment:"Makine",type:"strength",goals:["muscle","strength"],image:"./assets/sport/calf-raise.jpg"},
    {id:"plank",name:"Plank",muscle:"Karın",category:"Karın",equipment:"Ekipmansız",type:"timed",goals:["condition","general"],image:"./assets/sport/plank.jpg"},
    {id:"crunch",name:"Crunch",muscle:"Karın",category:"Karın",equipment:"Ekipmansız",type:"bodyweight",goals:["muscle","general"],image:"./assets/sport/crunch.jpg"},
    {id:"russian-twist",name:"Russian Twist",muscle:"Karın · Oblik",category:"Karın",equipment:"Ekipmansız",type:"bodyweight",goals:["condition","general"],image:"./assets/sport/russian-twist.jpg"},
    {id:"bicycle-crunch",name:"Bicycle Crunch",muscle:"Karın · Oblik",category:"Karın",equipment:"Ekipmansız",type:"bodyweight",goals:["condition","general"],image:"./assets/sport/bicycle-crunch.jpg"},
    {id:"dead-bug",name:"Dead Bug",muscle:"Karın",category:"Karın",equipment:"Ekipmansız",type:"bodyweight",goals:["general"],image:"./assets/sport/dead-bug.jpg"},
    {id:"mountain-climber",name:"Mountain Climber",muscle:"Karın · Kardiyo",category:"Karın",equipment:"Ekipmansız",type:"bodyweight",goals:["condition","general"],image:"./assets/sport/mountain-climber.jpg"},
    {id:"treadmill-run",name:"Koşu Bandı",muscle:"Kardiyo",category:"Kardiyo",equipment:"Koşu bandı",type:"cardio",goals:["condition","general"],image:"./assets/sport/treadmill-run.jpg"},
    {id:"cycling",name:"Bisiklet",muscle:"Kardiyo",category:"Kardiyo",equipment:"Bisiklet",type:"cardio",goals:["condition","general"],image:"./assets/sport/cycling.jpg"},
    {id:"elliptical",name:"Eliptik",muscle:"Kardiyo",category:"Kardiyo",equipment:"Eliptik",type:"cardio",goals:["condition","general"],image:"./assets/sport/elliptical.jpg"},
    {id:"rowing-machine",name:"Kürek Makinesi",muscle:"Kardiyo · Sırt",category:"Kardiyo",equipment:"Kürek ergometresi",type:"cardio",goals:["condition","general"],image:"./assets/sport/rowing-machine.jpg"},
    {id:"jump-rope",name:"İp Atlama",muscle:"Kardiyo",category:"Kardiyo",equipment:"İp",type:"cardio",goals:["condition"],image:"./assets/sport/jump-rope.jpg"},
    {id:"brisk-walk",name:"Tempolu Yürüyüş",muscle:"Kardiyo",category:"Kardiyo",equipment:"Ekipmansız",type:"cardio",goals:["condition","general"],image:"./assets/sport/brisk-walk.jpg"},
    {id:"burpee",name:"Burpee",muscle:"Tüm vücut",category:"Fonksiyonel",equipment:"Ekipmansız",type:"bodyweight",goals:["condition","general"],image:"./assets/sport/burpee.jpg"},
    {id:"kettlebell-swing",name:"Kettlebell Swing",muscle:"Kalça · Arka bacak",category:"Fonksiyonel",equipment:"Kettlebell",type:"functional",goals:["condition","general","strength"],image:"./assets/sport/kettlebell-swing.jpg"},
    {id:"battle-rope",name:"Battle Rope",muscle:"Tüm vücut",category:"Fonksiyonel",equipment:"Battle rope",type:"functional",goals:["condition","general"],image:"./assets/sport/battle-rope.jpg"},
    {id:"medicine-ball-slam",name:"Medicine Ball Slam",muscle:"Tüm vücut",category:"Fonksiyonel",equipment:"Medicine ball",type:"functional",goals:["condition","general"],image:"./assets/sport/medicine-ball-slam.jpg"},
    {id:"farmer-walk",name:"Farmer's Walk",muscle:"Tüm vücut · Kavrama",category:"Fonksiyonel",equipment:"Dumbbell",type:"functional",goals:["condition","general","strength"],image:"./assets/sport/farmer-walk.jpg"},
    {id:"box-jump",name:"Box Jump",muscle:"Bacak · Patlayıcılık",category:"Fonksiyonel",equipment:"Box",type:"functional",goals:["condition","general"],image:"./assets/sport/box-jump.jpg"},
    {id:"cat-cow",name:"Cat Cow",muscle:"Omurga",category:"Mobilite",equipment:"Ekipmansız",type:"mobility",goals:["general","condition"],image:"./assets/sport/cat-cow.jpg"},
    {id:"hip-mobility",name:"Hip Flexor Stretch",muscle:"Kalça",category:"Mobilite",equipment:"Ekipmansız",type:"mobility",goals:["general","condition"],image:"./assets/sport/hip-mobility.jpg"},
    {id:"shoulder-mobility",name:"Shoulder Stretch",muscle:"Omuz",category:"Mobilite",equipment:"Ekipmansız",type:"mobility",goals:["general","condition"],image:"./assets/sport/shoulder-mobility.jpg"},
    {id:"full-stretch",name:"Thoracic Rotation",muscle:"Sırt · Göğüs",category:"Mobilite",equipment:"Ekipmansız",type:"mobility",goals:["general","condition"],image:"./assets/sport/full-stretch.jpg"},
  ];
  const aliases = Object.freeze({
    "one-arm-row":"barbell-row",
    "face-pull":"rear-delt-fly",
    "overhead-triceps":"skull-crusher",
    "goblet-squat":"bodyweight-squat",
    "jumping-jack":"burpee",
    "leg-raise":"dead-bug",
    "hanging-leg-raise":"dead-bug",
    "pec-deck-fly":"chest-press",
    "dumbbell-pullover":"cable-fly",
    "shrug":"upright-row"
  });
  for(const item of library){Object.freeze(item.goals);Object.freeze(item);}
  Object.freeze(library);
  function find(id){
    if(typeof id!=='string')return null;
    const resolved=Object.hasOwn(aliases,id)?aliases[id]:id;
    return library.find(item=>item.id===resolved)||null;
  }
  return Object.freeze({library,aliases,find});
});
