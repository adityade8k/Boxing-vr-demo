import * as THREE from "three";

export function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function damp(current, target, lambda, dt) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function dampVector3(vector, target, lambda, dt) {
  const amount = 1 - Math.exp(-lambda * dt);
  vector.lerp(target, amount);
  return vector;
}

export function distance2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function averageSamples(samples, side) {
  const total = samples.reduce(
    (acc, sample) => {
      const hand = sample[side];
      acc.x += hand.x;
      acc.y += hand.y;
      acc.z += hand.z;
      acc.size += hand.size;
      return acc;
    },
    { x: 0, y: 0, z: 0, size: 0 },
  );

  const count = Math.max(samples.length, 1);
  return {
    x: total.x / count,
    y: total.y / count,
    z: total.z / count,
    size: total.size / count,
  };
}

export function setCylinderBetween(mesh, start, end) {
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();

  mesh.position.copy(midpoint);
  mesh.scale.set(1, Math.max(length, 0.001), 1);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
}

export function setMatrix(instance, position, quaternion, scale) {
  const matrix = new THREE.Matrix4();
  matrix.compose(position, quaternion, scale);
  instance.setMatrixAt(instance.userData.index++, matrix);
}
