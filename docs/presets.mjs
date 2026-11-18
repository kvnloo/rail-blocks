import {V, UP, piece, buildRoute, line} from './track.mjs';

const layout = (name, description, anchors, {closed = true, colors, extra = [], supports = []} = {}) => {
  const cells = line(anchors);
  const path = buildRoute(closed ? cells.slice(0, -1) : cells, {closed, colors});
  return {id: name.toLowerCase().replaceAll(' ', '-'), name, description, path, extra, supports};
};
const supports = (x, z, height) => ({x, z, height});

export const presets = [
  layout('Ocean Wave', 'An open run with two crests and a low trough.', [
    [-6,0,0],[-4,0,0],[-4,2,0],[-2,2,0],[-2,0,0],[1,0,0],
    [1,2,0],[3,2,0],[3,0,0],[6,0,0],
  ], {closed:false, colors:[1,3,4,3,0,2,0,3,3]}),
  layout('Turbo Tunnel', 'Two parallel lift arches around a low tabletop oval.', [
    [-4,0,2],[-2,0,2],[-2,2,2],[2,2,2],[2,0,2],[4,0,2],[4,0,-2],
    [2,0,-2],[2,3,-2],[-2,3,-2],[-2,0,-2],[-4,0,-2],[-4,0,2],
  ], {colors:[0,1,1,2,2,0,1], supports:[supports(0,2,2),supports(0,-2,3)]}),
  layout('Bumpy Road', 'A compact would-be half-pipe with two raised shoulders.', [
    [-5,0,0],[-4,0,0],[-4,2,0],[-2,2,0],[-2,0,0],[2,0,0],
    [2,2,0],[4,2,0],[4,0,0],[6,0,0],
  ], {closed:false, colors:[1,0,2,3,3,3,1,2]}),
  layout('Cross Junction', 'A figure eight. The crossing keeps the two lanes straight.', [
    [-2,0,0],[3,0,0],[3,0,-3],[0,0,-3],[0,0,3],[-3,0,3],[-3,0,0],[-2,0,0],
  ]),
  layout('Full Circle', 'Four quarter turns form a compact tabletop ring.', [
    [0,0,0],[1,0,0],[1,0,-1],[0,0,-1],[0,0,0],
  ], {colors:[3,1,1,3]}),
  layout('Skyscraper Mode', 'A tall outer climb and a tighter inner return.', [
    [-3,0,2],[3,0,2],[3,0,-2],[3,6,-2],[-3,6,-2],[-3,6,0],
    [-3,3,0],[1,3,0],[1,3,-2],[2,3,-2],
  ], {closed:false, supports:[supports(-2,-2,6),supports(0,-2,6),supports(-1,0,3)]}),
  layout('Vortex Twist', 'Offset turns bookend an ascending spiral.', [
    [-4,0,2],[2,0,2],[2,0,-2],[2,2,-2],[-2,2,-2],[-2,2,0],
    [-2,4,0],[1,4,0],[1,4,-1],
  ], {closed:false, colors:[4,3,3,2,2,0,1], supports:[supports(0,-2,2),supports(0,0,4)]}),
  layout('Arch Bridge', 'A tall stepped bridge with a vertical exit.', [
    [-5,0,0],[3,0,0],[3,3,0],[-2,3,0],[-2,5,0],[2,5,0],
  ], {closed:false, colors:[4,2,2,2,0,1], supports:[supports(1,0,3),supports(0,0,5)]}),
  layout('Looping Curve', 'An inverted course with a flat rainbow frame crossing below.', [
    [-3,0,0],[2,0,0],[2,3,0],[-4,3,0],[-4,0,0],[-3,0,0],
  ], {extra: buildRoute(line([[-4,0,2],[2,0,2],[2,0,-2],[-4,0,-2],[-4,0,2]]).slice(0,-1),{closed:true})}),
];

// The crossing shares one body, but has a dedicated guide in each direction.
const cross = presets.find(p => p.id === 'cross-junction');
for (const b of cross.path) if (b.p.equals(V())) b.c = 5;

export const sampleLoop = layout('Sample loop', 'Ride a complete inverted lap.', [
  [-3,0,0],[2,0,0],[2,4,0],[-4,4,0],[-4,0,0],[-3,0,0],
]);
export const depot = piece([-3,0,0], V(1), V(1), UP, 0);
export const sandboxPresets = [sampleLoop, ...presets];
