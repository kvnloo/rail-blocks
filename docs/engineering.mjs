import {Quaternion} from './vendor/three.module.min.js';
import {V, attitude, key, length, sample} from './track.mjs';
import {DRIVE, METERS_PER_GRID as M, TOY_CM, gridFromCM} from './spec.mjs';

const UP = V(0, 1), G = V(0, -DRIVE.gravity), STEP = 1/120;
const PORTS = new WeakMap();
function ports(block) {
  if (!PORTS.has(block)) PORTS.set(block, [0, 1].map(end => {
    const {p, d, n} = sample(block, end);
    return {block, end, p, n, axis: d.multiplyScalar(end ? 1 : -1)};
  }));
  return PORTS.get(block);
}
function mates(a, b) {
  return a.end !== b.end && a.axis.dot(b.axis) < -.999 &&
    a.p.distanceTo(b.p) < gridFromCM(TOY_CM.jointGap);
}
export const countLatches = (block, others) => ports(block).filter(a =>
  others.some(b => b !== block && ports(b).some(p => mates(a,p)))).length;

function graph(blocks) {
  const byPoint = new Map(), cells = new Map(), edges = new Map(blocks.map(b => [b, []]));
  for (const b of blocks) {
    const k = key(b.p);
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(b);
    for (const p of ports(b)) {
      const k = p.p.toArray().map(x => Math.round(x*2)).join(',');
      if (!byPoint.has(k)) byPoint.set(k, []);
      byPoint.get(k).push(p);
    }
  }
  function connect(a, b, contact) {
    const edge = {a, b, contact, broken: false};
    edges.get(a).push(edge);
    edges.get(b).push(edge);
  }
  for (const group of byPoint.values()) for (const a of group) {
    if (a.end !== 1) continue;
    const b = group.find(b => mates(a,b));
    if (b) connect(a.block,b.block,[a,b]);
  }
  for (const group of cells.values()) {
    for (const b of group.slice(1)) connect(group[0],b,null);
  }
  return edges;
}
const neighbor = (e,b) => e.a === b ? e.b : e.a;
function component(edges, start, excluded) {
  const found = new Set([start]);
  for (const from of found) for (const e of edges.get(from)) {
    if (!e.broken && e !== excluded) found.add(neighbor(e,from));
  }
  return found;
}
function unsupportedMass(edge, edges, fixed) {
  const from = component(edges, edge.a, edge);
  if (from.has(edge.b)) return 0; // Another latch carries the load.
  const to = component(edges,edge.b,edge);
  const anchored = set => [...set].some(b => fixed.has(b));
  if (anchored(from) === anchored(to)) return 0;
  const hanging = anchored(from) ? to : from;
  return new Set([...hanging].map(b => key(b.p))).size * DRIVE.blockMass;
}

function trace(level, edges) {
  let b = level.start, dist = 0;
  const visited = new Set(), stars = new Set(), path = [];
  while (!visited.has(b)) {
    visited.add(b);
    if (level.stars.includes(key(b.p))) stars.add(key(b.p));
    const exit = ports(b)[1];
    const seam = edges.get(b).find(e => e.contact?.[0] === exit);
    const end = dist + length(b);
    path.push({block:b, start:dist, end, seam});
    dist = end;
    if (level.goal && b === level.goal) return {path, dist, stars:stars.size, result:'goal'};
    if (!seam || seam.broken || exit.n.dot(seam.contact[1].n) < .999) {
      return {path, dist, stars:stars.size, result:'derail', reason:!seam ? 'end' : seam.broken ? 'latch' : 'guide'};
    }
    b = seam.b;
  }
  return {path, dist, stars:stars.size, result:'loop'};
}
export const routeFor = (level, blocks) => trace(level, graph(blocks));

// Outward tension, separate from the lateral load on the guide lips. Acceleration
// is expressed in world SI; the geometric curvature is 1 / (half a grid pitch).
export function guideLoad(block, pose, speed) {
  const reaction = G.clone();
  if (block.a.dot(block.b) < .5) {
    const inward = block.a.clone().cross(block.b).cross(pose.d);
    reaction.addScaledVector(inward, -speed*speed/(M/2));
  }
  return {
    pull: DRIVE.trainMass * Math.max(0, reaction.dot(pose.n)),
    side: DRIVE.trainMass * Math.abs(reaction.dot(pose.n.clone().cross(pose.d))),
  };
}

function rigidBody(p, mass, half, q = new Quaternion()) {
  return {p:p.clone(), q:q.clone(), half, mass, v:V(), spin:V()};
}
const halfBlock = V(.37, .366, .37);
const halfCar = V(gridFromCM(TOY_CM.train.width)/2,gridFromCM(TOY_CM.train.height)/2,gridFromCM(TOY_CM.train.length)/2);
const upExtent = (q, half) => {
  const u = UP.clone().applyQuaternion(q.clone().invert());
  return Math.abs(u.x)*half.x + Math.abs(u.y)*half.y + Math.abs(u.z)*half.z;
};
function advance(body, dt) {
  body.v.addScaledVector(G,dt);
  body.p.addScaledVector(body.v,dt/M);
  const spin = body.spin.length();
  if (spin > .001) body.q.premultiply(new Quaternion().setFromAxisAngle(body.spin.clone().normalize(),spin*dt));
}

export function startRun(level, blocks, desk, {speed = 0} = {}) {
  const edges = graph(blocks), anchored = new Set(level.fixed), poses = new Map(), loose = [];
  const onDesk = p => p.x > desk.min && p.x < desk.max && p.z > desk.back && p.z < desk.front;
  const tabletop = desk.top ?? -.366;
  for (const b of blocks) {
    // Sitting on the table supplies vertical support. A preset post supplies it
    // only at its top. The blueprint starter and puzzle fixtures are pinned.
    if ((b.p.y === 0 && onDesk(b.p)) || level.supports?.some(s => b.p.distanceTo(V(s.x,s.height,s.z)) < .001)) anchored.add(b);
  }
  for (const links of edges.values()) for (const e of links) {
    if (e.contact && !e.broken && Math.abs(e.contact[0].axis.y)*DRIVE.gravity*unsupportedMass(e,edges,anchored) > DRIVE.latchAxialLimit) e.broken = true;
  }
  const route = trace(level,edges), seen = new Set();
  const run = {route, phase:'rail', speed, load:0, stars:0, pose:sample(level.start,.26), loose:poses,
    laps:0, reason:route.reason};
  let i = 0, u = .26*length(level.start), secondsAir = 0, car;

  function mobilize(start, skipGrounded = false) {
    const members = [...component(edges,start)];
    if (members.some(b => poses.has(b) || level.fixed.includes(b)) ||
        (skipGrounded && members.some(b => anchored.has(b)))) return;
    const unique = [...new Map(members.map(b => [key(b.p),b])).values()];
    const center = unique.reduce((p,b) => p.add(b.p),V()).divideScalar(unique.length);
    const body = rigidBody(center, unique.length*DRIVE.blockMass, halfBlock);
    body.parts = unique.map(b => b.p.clone().sub(center));
    body.members = members.map(b => ({b, offset:b.p.clone().sub(center), q:attitude({d:b.a,n:b.n})}));
    for (const {b} of body.members) poses.set(b,{p:b.p,q:attitude({d:b.a,n:b.n})});
    loose.push(body);
  }
  for (const b of blocks) mobilize(b, true);
  // Single unlatched blocks on the table also participate in impacts.
  for (const b of blocks) if (!edges.get(b).some(e => !e.broken)) mobilize(b);

  function contact(body, p, bottom, emit) {
    const before = p.y;
    advance(body,STEP);
    const {point, extent} = bottom();
    const table = before >= tabletop - .015 && onDesk(point), surface = table ? tabletop : desk.floor;
    const y = point.y - extent;
    if (y > surface || body.v.y >= 0) return;
    const speed = -body.v.y;
    body.p.y += surface-y;
    body.v.y = speed > .13 ? speed*.29 : 0;
    body.v.x *= speed > .13 ? .67 : .91;
    body.v.z *= speed > .13 ? .67 : .91;
    body.spin.multiplyScalar(speed > .13 ? .59 : .90);
    if (speed > .10) emit({type:'impact',speed,surface:table ? 'wood' : 'floor'});
  }

  function moveBlocks(emit) {
    for (const body of loose) {
      let extent = upExtent(body.q,body.half);
      const bottom = () => {
        extent = upExtent(body.q,body.half);
        const low = body.parts.map(p => p.clone().applyQuaternion(body.q).add(body.p)).reduce((a,b) => a.y < b.y ? a : b);
        return {point:low, extent};
      };
      const low = bottom();
      contact(body, low.point.clone().addScaledVector(UP,-extent), bottom, emit);
      for (const {b,offset,q} of body.members) poses.set(b,{p:offset.clone().applyQuaternion(body.q).add(body.p),q:body.q.clone().multiply(q)});
    }
  }
  function release(reason, emit) {
    const q = attitude(run.pose);
    const p = run.pose.p.clone().addScaledVector(run.pose.n, halfCar.y);
    car = rigidBody(p, DRIVE.trainMass, halfCar, q);
    car.v.copy(run.pose.d).multiplyScalar(run.speed);
    car.spin.copy(run.pose.n.clone().cross(run.pose.d)).multiplyScalar(7).add(V(.3,1.4,.5));
    run.phase = 'air'; run.reason = reason;
    emit({type:'stop'});
    emit({type:'release', speed:run.speed, reason, velocity:car.v.toArray()});
  }
  function hitLoose(emit) {
    for (const b of loose) {
      const point = b.parts.map(p => p.clone().applyQuaternion(b.q).add(b.p))
        .find(p => p.distanceToSquared(car.p) < .69**2);
      if (!point) continue;
      const normal = car.p.clone().sub(point).normalize(), speed = b.v.clone().sub(car.v).dot(normal);
      if (speed < .10) continue;
      const impulse = 1.2*speed/(1/car.mass+1/b.mass);
      b.v.addScaledVector(normal,-impulse/b.mass);
      const torque = normal.clone().cross(V(0,.6,.2));
      b.spin.addScaledVector(torque,impulse/(b.mass*M));
      car.v.addScaledVector(normal,impulse/car.mass);
      emit({type:'impact',speed,surface:'plastic'});
    }
  }
  function enter(emit) {
    const k = key(route.path[i].block.p);
    if (level.stars.includes(k) && !seen.has(k)) {
      seen.add(k); run.stars++; emit({type:'star',cell:k});
    }
  }
  function tick(emit = () => {}) {
    if (run.phase === 'done') return;
    moveBlocks(emit);
    if (run.phase === 'air') {
      secondsAir += STEP;
      const old = car.p.clone().addScaledVector(UP,-upExtent(car.q,car.half));
      contact(car,old,() => ({point:car.p,extent:upExtent(car.q,car.half)}),emit);
      hitLoose(emit);
      run.air = {p:car.p.clone().addScaledVector(UP.clone().applyQuaternion(car.q),-halfCar.y),q:car.q,v:car.v};
      if (secondsAir >= 1.3) {run.phase = 'done'; emit({type:'derail',reason:run.reason});}
      return;
    }
    enter(emit);
    const part = route.path[i];
    const grade = run.pose.d.y;
    run.load = Math.max(0,grade);
    const target = DRIVE.flatSpeed + run.load*(DRIVE.climbSpeed-DRIVE.flatSpeed) + Math.max(0,-grade)*(DRIVE.descentSpeed-DRIVE.flatSpeed);
    run.speed += Math.max(-DRIVE.acceleration*STEP, Math.min(DRIVE.acceleration*STEP,target-run.speed));
    const demand = guideLoad(part.block,run.pose,run.speed);
    if (demand.pull > DRIVE.retention || demand.side > DRIVE.lateralRetention) {release('retention',emit); return;}
    let delta = run.speed*STEP/M;
    while (delta >= partLength()-u) {
      delta -= partLength()-u;
      const {block,seam} = route.path[i];
      run.pose = sample(block,1);
      if (i === route.path.length-1 && route.result !== 'loop') {
        if (route.result === 'goal') {run.phase = 'done'; emit({type:'stop'}); emit({type:'goal'});}
        else release(route.reason,emit);
        return;
      }
      const axial = Math.abs(grade)*(DRIVE.gravity*unsupportedMass(seam,edges,anchored)+DRIVE.gravity*DRIVE.trainMass)+DRIVE.trainMass*DRIVE.acceleration;
      if (axial > DRIVE.latchAxialLimit) {
        seam.broken = true; mobilize(seam.a,true); mobilize(seam.b,true); release('latch',emit); return;
      }
      i = (i+1) % route.path.length;
      if (i === 0) run.laps++;
      u = 0;
      emit({type:'seam',speed:run.speed,load:run.load});
      enter(emit);
    }
    u += delta;
    run.pose = sample(route.path[i].block,u/partLength());
  }
  const partLength = () => route.path[i].end-route.path[i].start;
  return Object.assign(run,{tick});
}
export const PHYSICS_STEP = STEP;
