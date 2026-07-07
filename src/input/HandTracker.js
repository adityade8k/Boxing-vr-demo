import { HAND_TRACKING } from "../config.js";
import { clamp, distance2, lerp } from "../utils/math.js";

const MODULE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";

function emptyHand() {
  return {
    tracked: false,
    x: 0.5,
    y: 0.5,
    z: 0,
    size: 0,
    confidence: 0,
    velocity: 0,
  };
}

export class HandTracker {
  constructor(videoElement) {
    this.video = videoElement;
    this.handLandmarker = null;
    this.lastVideoTime = -1;
    this.lastDetectMs = 0;
    this.status = "idle";
    this.statusText = "Camera idle";
    this.hands = {
      left: emptyHand(),
      right: emptyHand(),
    };
  }

  async start() {
    this.status = "loading";
    this.statusText = "Loading hand tracker";

    const [{ FilesetResolver, HandLandmarker }] = await Promise.all([
      import(MODULE_URL),
      this.#startCamera(),
    ]);

    const vision = await FilesetResolver.forVisionTasks(HAND_TRACKING.wasmUrl);
    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: HAND_TRACKING.modelUrl,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    this.status = "ready";
    this.statusText = "Hands ready";
  }

  detect(nowMs) {
    if (!this.handLandmarker || this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return this.hands;
    }

    if (nowMs - this.lastDetectMs < HAND_TRACKING.detectionIntervalMs) {
      return this.hands;
    }

    if (this.video.currentTime === this.lastVideoTime) {
      return this.hands;
    }

    this.lastVideoTime = this.video.currentTime;
    this.lastDetectMs = nowMs;

    const result = this.handLandmarker.detectForVideo(this.video, nowMs);
    this.#applyResult(result);
    return this.hands;
  }

  #applyResult(result) {
    const detected = [];

    for (let i = 0; i < (result.landmarks?.length ?? 0); i += 1) {
      const landmarks = result.landmarks[i];
      const handedness = result.handedness?.[i]?.[0];
      const center = this.#fistCenter(landmarks);
      const size = this.#handSize(landmarks);

      detected.push({
        x: 1 - center.x,
        y: center.y,
        z: center.z,
        size,
        confidence: handedness?.score ?? 0.5,
      });
    }

    detected.sort((a, b) => a.x - b.x);

    const nextHands = {
      left: detected[0] ? { ...detected[0], tracked: true } : emptyHand(),
      right: detected[1] ? { ...detected[1], tracked: true } : emptyHand(),
    };

    if (detected.length === 1) {
      const side = detected[0].x < 0.5 ? "left" : "right";
      nextHands.left = emptyHand();
      nextHands.right = emptyHand();
      nextHands[side] = { ...detected[0], tracked: true };
    }

    this.#smoothHand("left", nextHands.left);
    this.#smoothHand("right", nextHands.right);

    const count = Number(this.hands.left.tracked) + Number(this.hands.right.tracked);
    this.statusText = count === 2 ? "Two hands tracked" : count === 1 ? "One hand tracked" : "Hands not found";
  }

  #smoothHand(side, next) {
    const current = this.hands[side];

    if (!next.tracked) {
      this.hands[side] = {
        ...current,
        tracked: false,
        confidence: 0,
        velocity: current.velocity * 0.82,
      };
      return;
    }

    const alpha = current.tracked ? 0.42 : 1;
    const smoothed = {
      tracked: true,
      x: lerp(current.x, next.x, alpha),
      y: lerp(current.y, next.y, alpha),
      z: lerp(current.z, next.z, alpha),
      size: lerp(current.size || next.size, next.size, alpha),
      confidence: next.confidence,
      velocity: 0,
    };

    smoothed.velocity = distance2(smoothed, current);
    smoothed.x = clamp(smoothed.x, 0, 1);
    smoothed.y = clamp(smoothed.y, 0, 1);
    this.hands[side] = smoothed;
  }

  #fistCenter(landmarks) {
    const ids = [0, 5, 9, 13, 17];
    const center = ids.reduce(
      (acc, id) => {
        acc.x += landmarks[id].x;
        acc.y += landmarks[id].y;
        acc.z += landmarks[id].z;
        return acc;
      },
      { x: 0, y: 0, z: 0 },
    );

    return {
      x: center.x / ids.length,
      y: center.y / ids.length,
      z: center.z / ids.length,
    };
  }

  #handSize(landmarks) {
    const wrist = landmarks[0];
    const middle = landmarks[9];
    const index = landmarks[5];
    const pinky = landmarks[17];
    const palmLength = Math.hypot(wrist.x - middle.x, wrist.y - middle.y);
    const palmWidth = Math.hypot(index.x - pinky.x, index.y - pinky.y);
    return palmLength + palmWidth * 0.72;
  }

  async #startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    });

    this.video.srcObject = stream;

    await new Promise((resolve) => {
      if (this.video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        resolve();
        return;
      }
      this.video.addEventListener("loadedmetadata", resolve, { once: true });
    });

    await this.video.play();
  }
}
