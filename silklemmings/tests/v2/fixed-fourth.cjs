const assert=require('node:assert/strict'),E=require('../../battle-engine.js');
function make(){const b=new E.Battle({...E.initial(),chapter:3,baseline:5000});b.begin();b.hazards=[];b.enemyClock={crow:1000,worm:1000};return b;}
let b=make();b.spawn('silk');b.units[0].x=1;b.step(.05);assert.equal(b.pending,300);b.step(89.85);b.spawn('silk');b.units.at(-1).x=100;b.step(.1);
assert.equal(b.state.leg,'back');assert.equal(b.time,90);assert.equal(b.state.money,5100);assert.equal(b.pending,0);assert.equal(b.units.length,0);assert.equal(b.enemies.length,0);assert.equal(b.outboundUnfinished,1);assert.equal(b.spawn('silk').ok,false);assert.equal(b.spawn('imports').ok,true);assert.equal(b.canSettle(),false);assert.equal(b.settle(),null);
b.hazards=[];b.units[0].x=1;b.step(.1);b.step(100);assert.equal(b.time,180);assert.equal(b.phase,'finished');b.settle();assert.equal(b.state.money,5500);assert.equal(b.state.fourthTotals.revenue,840);assert.equal(b.state.fourthTotals.spent,340);assert.equal(b.state.fourthTotals.passed,2);assert.equal(b.settle(),null);assert.equal(b.spawn('imports').ok,false);
b=make();b.step(180);assert.equal(b.state.leg,'back');assert.equal(b.phase,'finished');b.settle();assert.equal(b.state.fourthElapsed,180);
b=make();b.step(90);b.state.money=20000;b.hazards=[];b.spawn('imports');b.units[0].x=1;b.step(.1);assert.equal(b.phase,'running');b.step(90);b.settle();assert.equal(b.state.won,true);
console.log('PASS: exact 90/180 boundaries, automatic settlement, no carryover, market switch, single settlement, large time gaps, no early finish.');
