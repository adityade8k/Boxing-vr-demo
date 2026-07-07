import * as THREE from "three";
import { damp, lerp, setCylinderBetween, smoothstep } from "../utils/math.js";

const LEFT = -1;
const RIGHT = 1;

export class Opponent {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = "Opponent";
    this.group.position.set(0, 0, -0.95);
    scene.add(this.group);

    this.materials = {
      body: new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.68 }),
      head: new THREE.MeshStandardMaterial({ color: 0xd6a174, roughness: 0.72 }),
      glove: new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.48 }),
      arm: new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.68 }),
      target: new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        transparent: true,
        opacity: 0,
        roughness: 0.38,
      }),
    };

    this.body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 1.1, 8, 18), this.materials.body);
    this.body.position.set(0, 1.02, 0);
    this.group.add(this.body);

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 14), this.materials.head);
    this.head.position.set(0, 1.82, 0.02);
    this.group.add(this.head);

    const gloveGeometry = new THREE.SphereGeometry(0.2, 20, 14);
    this.leftGlove = new THREE.Mesh(gloveGeometry, this.materials.glove.clone());
    this.rightGlove = new THREE.Mesh(gloveGeometry, this.materials.glove.clone());
    this.group.add(this.leftGlove, this.rightGlove);

    const armGeometry = new THREE.CylinderGeometry(0.065, 0.085, 1, 12);
    this.leftArm = new THREE.Mesh(armGeometry, this.materials.arm);
    this.rightArm = new THREE.Mesh(armGeometry, this.materials.arm);
    this.group.add(this.leftArm, this.rightArm);

    this.targetRing = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.028, 10, 44), this.materials.target);
    this.targetRing.position.set(0, 1.32, 0.43);
    this.group.add(this.targetRing);

    this.hitPulse = 0;
  }

  registerHit() {
    this.hitPulse = 1;
  }

  getTargetWorldPosition() {
    return this.targetRing.getWorldPosition(new THREE.Vector3());
  }

  update(cue, dt) {
    this.hitPulse = Math.max(0, this.hitPulse - dt * 2.6);
    const pulse = this.hitPulse;
    this.body.scale.setScalar(1 + pulse * 0.04);
    this.head.position.y = 1.82 + pulse * 0.04;
    this.materials.body.color.lerpColors(
      new THREE.Color(0x3f3f46),
      new THREE.Color(0x22c55e),
      pulse,
    );

    const phase = cue.phase ?? "idle";
    const progress = cue.progress ?? 0;
    const attackSide = cue.attackSide === "left" ? LEFT : RIGHT;

    const leftTarget = this.#glovePosition(LEFT, phase, progress, attackSide);
    const rightTarget = this.#glovePosition(RIGHT, phase, progress, attackSide);
    this.leftGlove.position.lerp(leftTarget, 1 - Math.exp(-20 * dt));
    this.rightGlove.position.lerp(rightTarget, 1 - Math.exp(-20 * dt));

    const leftShoulder = new THREE.Vector3(-0.34, 1.5, 0.12);
    const rightShoulder = new THREE.Vector3(0.34, 1.5, 0.12);
    setCylinderBetween(this.leftArm, leftShoulder, this.leftGlove.position);
    setCylinderBetween(this.rightArm, rightShoulder, this.rightGlove.position);

    const opening = phase === "recover" || phase === "stunned";
    const attackGlow = phase === "windup" || phase === "attack";
    const targetOpacity = opening ? 0.72 : 0;
    this.materials.target.opacity = damp(this.materials.target.opacity, targetOpacity, 12, dt);
    this.targetRing.scale.setScalar(1 + Math.sin(performance.now() * 0.011) * 0.06 * Number(opening));

    const gloveColor = attackGlow ? 0xf59e0b : 0xf97316;
    this.leftGlove.material.color.set(gloveColor);
    this.rightGlove.material.color.set(gloveColor);
  }

  #glovePosition(side, phase, progress, attackSide) {
    const guard = new THREE.Vector3(side * 0.42, 1.42, 0.42);
    const windup = new THREE.Vector3(side * 0.64, 1.58, -0.04);
    const strike = new THREE.Vector3(side * 0.18, 1.42, 2.2);
    const recover = new THREE.Vector3(side * 0.08, 1.18, 0.86);
    const relaxed = new THREE.Vector3(side * 0.52, 1.22, 0.26);

    if (phase === "idle" || phase === "guard") {
      return guard;
    }

    if (phase === "stunned") {
      return relaxed;
    }

    if (side !== attackSide) {
      return guard;
    }

    if (phase === "windup") {
      return guard.lerp(windup, smoothstep(0.05, 1, progress));
    }

    if (phase === "attack") {
      return windup.lerp(strike, smoothstep(0.05, 0.78, progress));
    }

    if (phase === "recover") {
      return strike.lerp(recover, lerp(0.15, 1, progress));
    }

    return guard;
  }
}
