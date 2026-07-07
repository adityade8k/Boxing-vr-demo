import * as THREE from "three";
import { dampVector3 } from "../utils/math.js";

export class PlayerCharacter {
  constructor(scene, colors) {
    this.group = new THREE.Group();
    this.group.name = "Player";
    scene.add(this.group);

    this.bodyMaterial = new THREE.MeshStandardMaterial({
      color: colors.bodyColor,
      roughness: 0.64,
    });
    this.fistMaterial = new THREE.MeshStandardMaterial({
      color: colors.fistColor,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
      roughness: 0.42,
      metalness: 0.05,
    });

    this.body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 1.12, 8, 18), this.bodyMaterial);
    this.body.position.set(0, 1.0, 1.95);
    this.group.add(this.body);

    const fistGeometry = new THREE.SphereGeometry(0.22, 24, 16);
    this.leftFist = new THREE.Mesh(fistGeometry, this.fistMaterial.clone());
    this.rightFist = new THREE.Mesh(fistGeometry, this.fistMaterial.clone());
    this.leftFist.name = "Left translucent fist";
    this.rightFist.name = "Right translucent fist";
    this.leftFist.position.set(-0.45, 1.34, 1.62);
    this.rightFist.position.set(0.45, 1.34, 1.62);
    this.group.add(this.leftFist, this.rightFist);
  }

  setColors(colors) {
    this.bodyMaterial.color.set(colors.bodyColor);
    this.leftFist.material.color.set(colors.fistColor);
    this.rightFist.material.color.set(colors.fistColor);
  }

  setBodyVisible(visible) {
    this.body.visible = visible;
  }

  updateFists(mappedHands, dt) {
    if (!mappedHands) {
      return;
    }

    if (mappedHands.left?.tracked) {
      dampVector3(this.leftFist.position, mappedHands.left.position, 18, dt);
      this.leftFist.visible = true;
    } else {
      this.leftFist.visible = false;
    }

    if (mappedHands.right?.tracked) {
      dampVector3(this.rightFist.position, mappedHands.right.position, 18, dt);
      this.rightFist.visible = true;
    } else {
      this.rightFist.visible = false;
    }

    this.leftFist.material.opacity = 0.42 + 0.16 * (mappedHands.left?.reach ?? 0);
    this.rightFist.material.opacity = 0.42 + 0.16 * (mappedHands.right?.reach ?? 0);
  }
}
