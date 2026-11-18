import assert from 'node:assert/strict';
import {V, UP, piece, sample, levels, buildRoute, line, key} from '../docs/track.mjs';
import {PHYSICS_STEP, countLatches, guideLoad, routeFor, startRun} from '../docs/engineering.mjs';
import {DRIVE} from '../docs/spec.mjs';
import {presets, sampleLoop} from '../docs/presets.mjs';

const desk = {min:-9,max:9,back:-5,front:5,floor:-4.5};
const runFor = (start, list, opts) => startRun({fixed:[start],start,stars:[]},list,desk,opts);
function until(run, predicate, max = 1200) {
  const events = [];
  for (let i=0; i<max && !predicate(run); i++) run.tick(e => events.push(e));
  assert.ok(predicate(run), `Run did not reach its expected state: ${run.phase}, ${run.reason}`);
  return events;
}

for (const level of levels) {
  const solved = startRun(level,[...level.fixed,...level.solution],desk);
  assert.equal(until(solved,r=>r.phase==='done').at(-1).type,'goal',level.name);
  assert.equal(solved.stars,level.stars.length,level.name);
  const incomplete = startRun(level,level.fixed,desk);
  const events = until(incomplete,r=>r.phase==='done');
  assert.equal(events.at(-1).type,'derail',level.name);
  assert.equal(events.find(e=>e.type==='release').reason,'end');
}
console.log('PASS engineering: all four station runs, stars and missing pieces');

const X = V(1), Y = V(0,1), Z = V(0,0,1);
const flat = piece([0,0,0],X,X,Y);
const wrongKey = piece([1,0,0],X.clone().negate(),X.clone().negate(),Y);
const rolled = piece([1,0,0],X,X,Z);
assert.equal(countLatches(wrongKey,[flat]),0,'tab-to-tab is not a latch');
assert.equal(countLatches(rolled,[flat]),1,'a keyed quarter turn can latch');
assert.equal(routeFor({start:flat,stars:[]},[flat,rolled]).reason,'guide','latch does not imply aligned guides');
const longFlat = buildRoute(line([[-6,0,0],[8,0,0]]));
const a = runFor(longFlat[0],longFlat);
a.tick();
assert.ok(Math.abs(a.speed-1.2*PHYSICS_STEP)<1e-9);
for(let i=1;i<90;i++) a.tick();
assert.equal(a.speed,.25);
const climb = buildRoute(line([[0,-1,0],[0,6,0]]),{n:X});
const d = runFor(climb[0],climb);
for(let i=0;i<90;i++) d.tick();
assert.ok(Math.abs(d.speed-.16)<1e-10);
assert.equal(d.load,1);
console.log('PASS engineering: keyed faces, mismatched guide, acceleration and flat/climb speed');

const inverted = piece([0,1,0],X,X,V(0,-1));
const outer = piece([0,1,0],X,Y,V(0,-1));
const inner = piece([0,1,0],X,Y,Y);
assert.ok(Math.abs(guideLoad(inverted,sample(inverted,.5),.25).pull - .032*9.81) < 1e-9);
assert.ok(guideLoad(inverted,sample(inverted,.5),.25).pull < DRIVE.retention);
assert.equal(guideLoad(inner,sample(inner,.5),.5).pull,0);
assert.ok(guideLoad(outer,sample(outer,.5),.5).pull > DRIVE.retention);
const fast = runFor(outer,[outer],{speed:.5});
const release = until(fast,r=>r.phase==='air').at(-1);
assert.equal(release.reason,'retention');
assert.ok(Math.abs(Math.hypot(...release.velocity)-release.speed)<1e-8);
const impact = until(fast,r=>r.phase==='done').find(e=>e.type==='impact' && e.speed>0);
assert.ok(impact,'actual contact makes an impact');
console.log('PASS engineering: inverted retention, inner/outer bend load, release velocity and impact');

const fall = piece([2,2,2],X,X,UP), coupled = piece([3,2,2],X,X,UP);
const target = piece([1,0,0],Z,Z,UP);
const bench = runFor(flat,[flat,fall,coupled,target]);
const events = until(bench,r=>r.phase==='done');
const p = bench.loose.get(fall), q = bench.loose.get(coupled), knocked = bench.loose.get(target);
assert.ok(p.p.y < fall.p.y-1.9);
assert.ok(Math.abs(p.p.distanceTo(q.p)-1)<1e-7,'latched pair falls as one body');
assert.ok(events.some(e=>e.surface==='plastic'),'train hits the loose block');
assert.ok(knocked.p.distanceTo(target.p)>.025 && knocked.q.angleTo(p.q)>.05,'loose block slides and rotates');
const tower = buildRoute(line([[0,-1,0],[0,22,0]]),{n:X});
const laden = runFor(tower[0],tower);
assert.ok(laden.route.path.length<tower.length,'unsupported 22-block column exceeds axial latch limit');
console.log('PASS engineering: loose blocks fall, coupled blocks move together, train knocks loose block, overloaded latch opens');

for (const preset of [...presets,sampleLoop]) {
  const [start,...rest] = preset.path;
  const r = startRun({start, fixed:[start], stars:[], supports:preset.supports},[start,...rest,...preset.extra],desk);
  assert.equal(r.route.path.length,preset.path.length,preset.name);
  const events = until(r,r=>r.laps===1 || r.phase==='done');
  const closed = r.route.result==='loop';
  assert.equal(r.laps,Number(closed),preset.name);
  assert.equal(events.filter(e=>e.type==='seam').length,preset.path.length-Number(!closed),preset.name);
  if (!closed) assert.equal(events.find(e=>e.type==='release').reason,'end',preset.name);
  if (preset.id==='cross-junction') assert.equal(r.route.path.filter(({block})=>key(block.p)==='0,0,0').length,2);
}
assert.equal(presets.length,9);
console.log('PASS engineering: nine layouts, sample loop, both crossing lanes and one audio event per seam');
