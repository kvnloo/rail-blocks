// Family listing for the train envelope. The other dimensions are working estimates.
export const TOY_CM = Object.freeze({
  pitch: 3, train: Object.freeze({length: 5, width: 2.5, height: 3}),
  guideWidth: 1.2, rackWidth: .35, toothPitch: .08, bevel: .12,
  recessWidth: .25, recessDepth: .12, jointGap: .04,
});
export const gridFromCM = cm => cm / TOY_CM.pitch;
export const METERS_PER_GRID = TOY_CM.pitch / 100;

// SI units. Downhill speed and lateral retention are gameplay assumptions.
export const DRIVE = Object.freeze({
  trainMass: .032, blockMass: .010, gravity: 9.81,
  flatSpeed: .25, climbSpeed: .16, descentSpeed: .36, acceleration: 1.2,
  retention: .65, lateralRetention: .65, latchAxialLimit: 1.5,
});
