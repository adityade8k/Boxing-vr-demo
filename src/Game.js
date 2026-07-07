import * as THREE from "three";
import { Arena } from "./scene/Arena.js";
import { PlayerCharacter } from "./entities/Player.js";
import { Opponent } from "./entities/Opponent.js";
import { HandTracker } from "./input/HandTracker.js";
import { CalibrationSystem } from "./systems/Calibration.js";
import { CombatDirector } from "./systems/CombatDirector.js";
import { Hud } from "./ui/Hud.js";
import { CAMERA, PLAYER_DEFAULTS } from "./config.js";
import { lerp, smoothstep } from "./utils/math.js";

export class Game {
  constructor() {
    this.canvas = document.querySelector("#game-canvas");
    this.video = document.querySelector("#webcam");
    this.clock = new THREE.Clock();
    this.state = "menu";
    this.introTime = 0;
    this.cameraShake = 0;
    this.lastOpponentHealth = 100;
    this.lastPlayerHealth = 100;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080a0d);
    this.scene.fog = new THREE.Fog(0x080a0d, 10, 22);

    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.05, 60);
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

    this.#buildLighting();
    this.arena = new Arena(this.scene);
    this.player = new PlayerCharacter(this.scene, PLAYER_DEFAULTS);
    this.opponent = new Opponent(this.scene);
    this.handTracker = new HandTracker(this.video);
    this.calibration = new CalibrationSystem();
    this.combat = new CombatDirector();
    this.hud = new Hud({
      onStart: (colors) => this.#beginCalibration(colors),
      onColorChange: (colors) => this.player.setColors(colors),
      onCalibrationReset: () => this.#resetCalibration(),
      onRematch: () => this.#startIntro(),
      onRecalibrate: () => this.#resetCalibration(),
    });

    this.#resize();
    window.addEventListener("resize", () => this.#resize());
  }

  start() {
    this.player.setBodyVisible(true);
    this.hud.showStart();
    this.renderer.setAnimationLoop(() => this.#tick());
  }

  async #beginCalibration(colors) {
    this.player.setColors(colors);
    this.hud.setTrackerStatus("Requesting camera");
    this.hud.showCalibration();
    this.state = "loading";

    try {
      if (this.handTracker.status !== "ready") {
        await this.handTracker.start();
      }
      this.#resetCalibration();
    } catch (error) {
      this.state = "menu";
      this.player.setBodyVisible(true);
      this.hud.showStart();
      this.hud.setTrackerStatus("Camera blocked");
      console.error(error);
    }
  }

  #resetCalibration() {
    this.calibration.reset();
    this.state = "calibration";
    this.player.setBodyVisible(true);
    this.hud.showCalibration();
  }

  #startIntro() {
    this.combat.reset();
    this.combat.start();
    this.lastOpponentHealth = this.combat.opponentHealth;
    this.lastPlayerHealth = this.combat.playerHealth;
    this.introTime = 0;
    this.state = "intro";
    this.player.setBodyVisible(false);
    this.hud.showCombat();
  }

  #tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();
    const hands = this.handTracker.detect(now);
    this.hud.setTrackerStatus(this.handTracker.statusText);

    if (this.state === "calibration") {
      const snapshot = this.calibration.update(dt, hands);
      this.hud.updateCalibration(snapshot);
      this.player.updateFists(this.calibration.mapHands(hands), dt);
      if (snapshot.complete) {
        this.#startIntro();
      }
    } else if (this.calibration.complete) {
      this.player.updateFists(this.calibration.mapHands(hands), dt);
    }

    if (this.state === "intro") {
      this.#updateIntro(dt);
    } else if (this.state === "gameplay") {
      this.#updateCombat(dt, hands);
      this.#setFirstPersonCamera(dt);
    } else {
      this.#updateMenuCamera(now);
      this.opponent.update(this.combat.cue(), dt);
    }

    this.renderer.render(this.scene, this.camera);
  }

  #updateIntro(dt) {
    this.introTime += dt;
    const t = Math.min(this.introTime / 4.2, 1);
    const eased = smoothstep(0, 1, t);
    const angle = -Math.PI * 0.72 + eased * Math.PI * 1.52;
    const radius = lerp(7.6, 1.2, eased);
    const orbit = new THREE.Vector3(Math.sin(angle) * radius, lerp(7.2, 1.95, eased), Math.cos(angle) * radius);
    const firstPerson = new THREE.Vector3(
      CAMERA.firstPersonPosition.x,
      CAMERA.firstPersonPosition.y,
      CAMERA.firstPersonPosition.z,
    );
    const blend = smoothstep(0.66, 1, t);

    this.camera.position.copy(orbit).lerp(firstPerson, blend);
    this.camera.lookAt(0, lerp(0.7, CAMERA.firstPersonLookAt.y, eased), lerp(-0.6, CAMERA.firstPersonLookAt.z, eased));
    this.opponent.update(this.combat.cue(), dt);
    this.hud.updateCombat(this.combat.cue());

    if (t >= 1) {
      this.state = "gameplay";
    }
  }

  #updateCombat(dt, hands) {
    const mapped = this.calibration.mapHands(hands);
    const signals = {
      blocking: this.calibration.isBlocking(hands),
      bestPunch: this.calibration.bestPunch(mapped, this.opponent.getTargetWorldPosition()),
    };
    const cue = this.combat.update(dt, signals);

    if (cue.opponentHealth < this.lastOpponentHealth) {
      this.opponent.registerHit();
    }

    if (cue.playerHealth < this.lastPlayerHealth) {
      this.cameraShake = 1;
    }

    this.lastOpponentHealth = cue.opponentHealth;
    this.lastPlayerHealth = cue.playerHealth;
    this.opponent.update(cue, dt);
    this.hud.updateCombat(cue);
  }

  #updateMenuCamera(now) {
    const seconds = now * 0.001;
    this.camera.position.set(Math.sin(seconds * 0.22) * 5.6, 4.9, 5.4 + Math.cos(seconds * 0.18) * 0.5);
    this.camera.lookAt(0, 0.9, -0.8);
  }

  #setFirstPersonCamera(dt) {
    const base = CAMERA.firstPersonPosition;
    this.cameraShake = Math.max(0, this.cameraShake - dt * 3.4);
    const shake = this.cameraShake * 0.035;
    this.camera.position.set(
      base.x + Math.sin(performance.now() * 0.08) * shake,
      base.y + Math.cos(performance.now() * 0.11) * shake,
      base.z,
    );
    this.camera.lookAt(CAMERA.firstPersonLookAt.x, CAMERA.firstPersonLookAt.y, CAMERA.firstPersonLookAt.z);
  }

  #buildLighting() {
    this.scene.add(new THREE.HemisphereLight(0xe0f2fe, 0x28120c, 1.45));

    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(-2.8, 5.4, 2.5);
    this.scene.add(key);

    const rim = new THREE.PointLight(0xf97316, 25, 8, 2);
    rim.position.set(2.8, 2.8, -2.6);
    this.scene.add(rim);

    const blue = new THREE.PointLight(0x38bdf8, 14, 9, 2);
    blue.position.set(-3.4, 2.8, 2.2);
    this.scene.add(blue);
  }

  #resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }
}
