const assert=require('node:assert/strict'),E=require('../../battle-engine.js');
const make=(chapter=3)=>{const b=new E.Battle({...E.initial(),chapter,baseline:5000,enemyClock:{crow:100,worm:100}});b.begin();b.hazards=[];return b;};
let b=make(),camel=b.spawn('shield').unit,horse=b.spawn('silk').unit;b.spawnEnemy('crow');b.step(1.9);assert.equal(horse.alive,false);assert.equal(horse.goods,0);assert.equal(camel.hp,600);assert.equal(b.pending,0);assert.equal(b.losses,1);assert.equal(b.enemies[0].carried,'silk');
b=make();camel=b.spawn('shield').unit;b.spawnEnemy('crow');b.step(2);assert.equal(camel.hp,570);b.step(3);assert.equal(b.enemies.length,0);
b=make();b.spawnEnemy('crow');b.step(3);assert.equal(b.enemies.length,0);
b=make();camel=b.spawn('sand').unit;camel.x=100;camel.stopped=true;let worm=b.spawnEnemy('worm');worm.x=100;b.step(1);assert.equal(camel.hp,100);horse=b.spawn('silk').unit;horse.x=145;b.step(.025);assert.equal(horse.alive,false);assert.equal(horse.goods,0);b.step(.7);horse=b.spawn('silk').unit;horse.x=100;b.step(.025);assert.equal(horse.alive,true);
b=make();b.enemyClock={crow:8,worm:13};b.step(7.9);assert.equal(b.enemies.length,0);b.step(.2);assert.ok(b.enemies.some(e=>e.kind==='crow'));b.step(5);assert.ok(b.enemies.some(e=>e.kind==='worm'));const saved={...b.state};const next=new E.Battle(saved);assert.deepEqual(next.enemyClock,b.enemyClock);b.phase='result';const clock={...b.enemyClock};b.step(5);assert.deepEqual(b.enemyClock,clock);
for(let c=0;c<3;c++){b=make(c);b.enemyClock={crow:.01,worm:.01};b.step(20);assert.equal(b.enemies.length,0);}
console.log('Enemy rules passed: horse priority, cargo loss, camel damage, empty departure, worm range and single bite, cadence, city clock, frozen result, chapters 1–3.');
