export class Hud {
  constructor(callbacks) {
    this.callbacks = callbacks;
    this.selectedColors = {
      bodyColor: "#2f80ed",
      fistColor: "#67e8f9",
    };

    this.elements = {
      startMenu: document.querySelector("#start-menu"),
      startButton: document.querySelector("#start-button"),
      calibrationPanel: document.querySelector("#calibration-panel"),
      calibrationTitle: document.querySelector("#calibration-title"),
      calibrationCopy: document.querySelector("#calibration-copy"),
      calibrationProgress: document.querySelector("#calibration-progress"),
      calibrationReset: document.querySelector("#calibration-reset"),
      hud: document.querySelector("#hud"),
      combatCue: document.querySelector("#combat-cue"),
      playerHealthBar: document.querySelector("#player-health-bar"),
      opponentHealthBar: document.querySelector("#opponent-health-bar"),
      playerHealthText: document.querySelector("#player-health-text"),
      opponentHealthText: document.querySelector("#opponent-health-text"),
      scoreValue: document.querySelector("#score-value"),
      comboValue: document.querySelector("#combo-value"),
      trackerStatus: document.querySelector("#tracker-status"),
      endActions: document.querySelector("#end-actions"),
      rematchButton: document.querySelector("#rematch-button"),
      recalibrateButton: document.querySelector("#recalibrate-button"),
    };

    this.#bind();
  }

  setTrackerStatus(text) {
    this.elements.trackerStatus.textContent = text;
  }

  showStart() {
    this.elements.startMenu.hidden = false;
    this.elements.calibrationPanel.hidden = true;
    this.elements.hud.hidden = true;
    this.elements.endActions.hidden = true;
  }

  showCalibration() {
    this.elements.startMenu.hidden = true;
    this.elements.calibrationPanel.hidden = false;
    this.elements.hud.hidden = true;
    this.elements.endActions.hidden = true;
  }

  showCombat() {
    this.elements.startMenu.hidden = true;
    this.elements.calibrationPanel.hidden = true;
    this.elements.hud.hidden = false;
  }

  updateCalibration(snapshot) {
    const isPunch = snapshot.step === "punch";
    this.elements.calibrationTitle.textContent = isPunch ? "Extend" : "Guard";
    this.elements.calibrationCopy.textContent = snapshot.paused
      ? "Reset your stance."
      : isPunch
        ? "Extend both fists forward."
        : "Hold both fists in front of your face.";
    this.elements.calibrationProgress.style.width = `${Math.round(snapshot.progress * 100)}%`;
  }

  updateCombat(cue) {
    const playerHealth = Math.round(cue.playerHealth);
    const opponentHealth = Math.round(cue.opponentHealth);
    this.elements.playerHealthText.textContent = playerHealth;
    this.elements.opponentHealthText.textContent = opponentHealth;
    this.elements.playerHealthBar.style.width = `${playerHealth}%`;
    this.elements.opponentHealthBar.style.width = `${opponentHealth}%`;
    this.elements.scoreValue.textContent = cue.score;
    this.elements.comboValue.textContent = cue.combo;

    const { label, className } = this.#cueLabel(cue);
    this.elements.combatCue.textContent = cue.lastEvent || label;
    this.elements.combatCue.className = `combat-cue ${className}`;
    this.elements.endActions.hidden = cue.phase !== "finished";
  }

  #cueLabel(cue) {
    if (cue.phase === "windup") {
      return { label: `${cue.attackSide} guard`, className: "block" };
    }
    if (cue.phase === "attack") {
      return { label: "Block", className: "danger" };
    }
    if (cue.phase === "recover" || cue.phase === "stunned") {
      return { label: "Counter", className: "counter" };
    }
    if (cue.phase === "finished") {
      return { label: cue.result === "win" ? "Win" : "Down", className: "danger" };
    }
    return { label: "Guard", className: "" };
  }

  #bind() {
    document.querySelectorAll(".swatch-row").forEach((row) => {
      row.addEventListener("click", (event) => {
        const button = event.target.closest(".swatch");
        if (!button) {
          return;
        }

        row.querySelectorAll(".swatch").forEach((swatch) => swatch.classList.remove("is-selected"));
        button.classList.add("is-selected");

        if (row.dataset.picker === "body") {
          this.selectedColors.bodyColor = button.dataset.color;
        } else {
          this.selectedColors.fistColor = button.dataset.color;
        }

        this.callbacks.onColorChange?.({ ...this.selectedColors });
      });
    });

    this.elements.startButton.addEventListener("click", () => {
      this.callbacks.onStart?.({ ...this.selectedColors });
    });

    this.elements.calibrationReset.addEventListener("click", () => {
      this.callbacks.onCalibrationReset?.();
    });

    this.elements.rematchButton.addEventListener("click", () => {
      this.callbacks.onRematch?.();
    });

    this.elements.recalibrateButton.addEventListener("click", () => {
      this.callbacks.onRecalibrate?.();
    });
  }
}
