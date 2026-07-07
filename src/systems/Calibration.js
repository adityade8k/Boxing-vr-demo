import * as THREE from "three";
import { CALIBRATION } from "../config.js";
import { averageSamples, clamp, distance2 } from "../utils/math.js";

export class CalibrationSystem {
  constructor() {
    this.reset();
  }

  reset() {
    this.step = "block";
    this.holdTime = 0;
    this.pauseTime = 0;
    this.samples = [];
    this.block = null;
    this.punch = null;
    this.complete = false;
  }

  update(dt, hands) {
    if (this.complete) {
      return this.snapshot();
    }

    if (this.pauseTime > 0) {
      this.pauseTime = Math.max(0, this.pauseTime - dt);
      return this.snapshot();
    }

    if (!hands.left.tracked || !hands.right.tracked) {
      this.holdTime = 0;
      this.samples = [];
      return this.snapshot();
    }

    this.samples.push({
      left: { ...hands.left },
      right: { ...hands.right },
    });
    if (this.samples.length > 45) {
      this.samples.shift();
    }

    this.holdTime += dt;

    if (this.holdTime >= CALIBRATION.holdSeconds) {
      this.#captureStep();
    }

    return this.snapshot();
  }

  snapshot() {
    return {
      step: this.step,
      progress: clamp(this.holdTime / CALIBRATION.holdSeconds),
      complete: this.complete,
      paused: this.pauseTime > 0,
    };
  }

  mapHands(hands) {
    if (!this.complete) {
      return this.#defaultMappedHands(hands);
    }

    return {
      left: this.#mapHand("left", hands.left),
      right: this.#mapHand("right", hands.right),
    };
  }

  isBlocking(hands) {
    if (!this.complete || !hands.left.tracked || !hands.right.tracked) {
      return false;
    }

    const left = this.#blockScoreFor("left", hands.left);
    const right = this.#blockScoreFor("right", hands.right);
    return left > 0.46 && right > 0.46;
  }

  bestPunch(mappedHands, targetPosition = null) {
    const candidates = ["left", "right"].map((side) => {
      const hand = mappedHands[side];
      if (!hand?.tracked) {
        return { side, score: 0, reach: 0, contact: 0 };
      }

      const xScore = 1 - clamp(Math.abs(hand.position.x) / 1.05);
      const yScore = 1 - clamp(Math.abs(hand.position.y - 1.34) / 0.62);
      const reachScore = hand.reach * (0.34 + xScore * 0.36 + yScore * 0.2);
      const contact = targetPosition
        ? 1 -
          clamp(
            hand.position.distanceTo(targetPosition) / 0.86,
            0,
            1,
          )
        : 0;
      const score = Math.max(reachScore, contact * 1.18);
      return { side, score, reach: hand.reach, contact };
    });

    return candidates[0].score > candidates[1].score ? candidates[0] : candidates[1];
  }

  #captureStep() {
    const averaged = {
      left: averageSamples(this.samples, "left"),
      right: averageSamples(this.samples, "right"),
    };

    if (this.step === "block") {
      this.block = averaged;
      this.step = "punch";
      this.holdTime = 0;
      this.samples = [];
      this.pauseTime = CALIBRATION.pauseBetweenSteps;
      return;
    }

    this.punch = averaged;
    this.complete = true;
    this.holdTime = CALIBRATION.holdSeconds;
  }

  #mapHand(side, hand) {
    if (!hand.tracked) {
      return {
        tracked: false,
        reach: 0,
        position: new THREE.Vector3(side === "left" ? -0.45 : 0.45, 1.32, 1.58),
      };
    }

    const block = this.block[side];
    const punch = this.punch[side];
    const sideSign = side === "left" ? -1 : 1;
    const reach = this.#reachFor(hand, block, punch);
    const expectedX = block.x + (punch.x - block.x) * Math.min(reach, 1);
    const expectedY = block.y + (punch.y - block.y) * Math.min(reach, 1) * 0.35;
    const lateral = hand.x - expectedX;
    const vertical = expectedY - hand.y;

    const position = new THREE.Vector3(
      clamp(sideSign * 0.46 + lateral * 4.2, -1.35, 1.35),
      clamp(1.34 + vertical * 3.2, 0.85, 2.18),
      clamp(1.62 - reach * 2.1, -0.48, 1.78),
    );

    return {
      tracked: true,
      reach,
      position,
      raw: hand,
    };
  }

  #blockScoreFor(side, hand) {
    const block = this.block[side];
    const punch = this.punch[side];
    const sizeSpan = Math.max(0.025, Math.abs(punch.size - block.size), block.size * 0.12);
    const screenError = distance2(hand, block) / 0.18;
    const reachError = Math.abs(hand.size - block.size) / sizeSpan;
    return 1 - clamp(screenError * 0.62 + reachError * 0.38);
  }

  #reachFor(hand, block, punch) {
    const candidates = [];
    const dx = punch.x - block.x;
    const dy = punch.y - block.y;
    const screenSpanSq = dx * dx + dy * dy;

    if (screenSpanSq > 0.00016) {
      const hx = hand.x - block.x;
      const hy = hand.y - block.y;
      candidates.push((hx * dx + hy * dy) / screenSpanSq);
    }

    const zSpan = punch.z - block.z;
    if (Math.abs(zSpan) > 0.01) {
      candidates.push((hand.z - block.z) / zSpan);
    }

    const sizeSpan = punch.size - block.size;
    if (Math.abs(sizeSpan) > Math.max(0.012, block.size * 0.06)) {
      candidates.push((hand.size - block.size) / sizeSpan);
    }

    if (candidates.length === 0) {
      const fallbackSpan = Math.max(0.025, block.size * 0.18);
      candidates.push((hand.size - block.size) / fallbackSpan);
    }

    return clamp(Math.max(...candidates), 0, 1.25);
  }

  #defaultMappedHands(hands) {
    return {
      left: {
        tracked: hands.left.tracked,
        reach: 0,
        position: new THREE.Vector3(-0.45, 1.32, 1.62),
      },
      right: {
        tracked: hands.right.tracked,
        reach: 0,
        position: new THREE.Vector3(0.45, 1.32, 1.62),
      },
    };
  }
}
