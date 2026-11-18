import assert from 'node:assert/strict';
import {levels, simulate, sample, buildRoute} from '../docs/track.mjs';
for(const l of levels) {
  assert.equal(simulate(l,l.fixed).result,'derail',l.name);
  const run=simulate(l,[...l.fixed,...l.solution]);
  assert.equal(run.result,'goal',l.name);
  assert.equal(run.stars,l.stars.length,l.name);
}
const [a,b,c]=buildRoute([[-1,0,0],[0,0,0],[1,0,0],[1,1,0],[0,1,0]]);
assert.ok(sample(a,1).p.distanceTo(sample(b,0).p)<1e-7);
assert.ok(sample(b,1).n.distanceTo(sample(c,0).n)<1e-7);
assert.ok(sample(c,1).n.y<-.99,'inverted top');
console.log('PASS core: stations, stars, gaps, continuity and inverted rail');
