export const PLAYER_DEFAULTS = {
  bodyColor: "#2f80ed",
  fistColor: "#67e8f9",
};

export const CAMERA = {
  firstPersonPosition: { x: 0, y: 1.72, z: 2.15 },
  firstPersonLookAt: { x: 0, y: 1.38, z: -1.75 },
  fov: 62,
};

export const HAND_TRACKING = {
  modelUrl:
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  wasmUrl: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
  detectionIntervalMs: 28,
};

export const CALIBRATION = {
  holdSeconds: 0.85,
  pauseBetweenSteps: 0.35,
};

export const RING = {
  size: 5.4,
  halfSize: 2.7,
};
