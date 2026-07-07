const PHASES = {
  idle: 1,
  guard: 0.62,
  windup: 0.78,
  attack: 0.42,
  recover: 0.82,
  stunned: 0.58,
  finished: 999,
};

const NEXT_PHASE = {
  guard: "windup",
  windup: "attack",
  attack: "recover",
  recover: "guard",
  stunned: "guard",
};

export class CombatDirector {
  constructor() {
    this.reset();
  }

  reset() {
    this.phase = "idle";
    this.phaseTime = 0;
    this.attackSide = "left";
    this.attackResolved = false;
    this.openingHit = false;
    this.playerHealth = 100;
    this.opponentHealth = 100;
    this.score = 0;
    this.combo = 0;
    this.punchCooldown = 0;
    this.lastEvent = "";
    this.result = "";
  }

  start() {
    this.phase = "guard";
    this.phaseTime = 0;
    this.lastEvent = "Ready";
  }

  update(dt, signals) {
    this.lastEvent = "";
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);

    if (this.phase === "finished" || this.phase === "idle") {
      return this.cue();
    }

    if (this.phase === "attack") {
      this.#resolveAttack(signals);
    }

    if ((this.phase === "recover" || this.phase === "stunned") && !this.openingHit) {
      this.#resolveCounter(signals);
    }

    this.phaseTime += dt;

    if (this.phaseTime >= PHASES[this.phase]) {
      this.#advance(NEXT_PHASE[this.phase]);
    }

    return this.cue();
  }

  cue() {
    return {
      phase: this.phase,
      progress: Math.min(this.phaseTime / PHASES[this.phase], 1),
      attackSide: this.attackSide,
      playerHealth: this.playerHealth,
      opponentHealth: this.opponentHealth,
      score: this.score,
      combo: this.combo,
      lastEvent: this.lastEvent,
      result: this.result,
    };
  }

  #resolveAttack(signals) {
    if (this.attackResolved || this.phaseTime < 0.09) {
      return;
    }

    if (signals.blocking) {
      this.attackResolved = true;
      this.combo += 1;
      this.score += 80 + this.combo * 10;
      this.lastEvent = "Blocked";
      this.#advance("recover");
      return;
    }

    if (this.phaseTime > PHASES.attack * 0.7) {
      this.attackResolved = true;
      this.combo = 0;
      this.playerHealth = Math.max(0, this.playerHealth - 12);
      this.lastEvent = "Hit";
      if (this.playerHealth <= 0) {
        this.#finish("down");
      }
    }
  }

  #resolveCounter(signals) {
    const punch = signals.bestPunch;
    const hasReach = punch.reach >= 0.42;
    const hasContact = punch.contact >= 0.46;
    if (this.punchCooldown > 0 || punch.score < 0.6 || (!hasReach && !hasContact)) {
      return;
    }

    this.openingHit = true;
    this.punchCooldown = 0.48;
    this.combo += 1;
    this.opponentHealth = Math.max(0, this.opponentHealth - 14);
    this.score += 140 + this.combo * 16;
    this.lastEvent = `${punch.side} hit`;

    if (this.opponentHealth <= 0) {
      this.#finish("win");
      return;
    }

    this.#advance("stunned");
  }

  #advance(phase) {
    if (!phase || this.phase === "finished") {
      return;
    }

    if (phase === "windup") {
      this.attackSide = this.attackSide === "left" ? "right" : "left";
      this.attackResolved = false;
      this.openingHit = false;
    }

    if (phase === "recover") {
      this.openingHit = false;
    }

    this.phase = phase;
    this.phaseTime = 0;
  }

  #finish(result) {
    this.result = result;
    this.phase = "finished";
    this.phaseTime = 0;
    this.lastEvent = result === "win" ? "Win" : "Down";
  }
}
