import * as THREE from "three";
import { RING } from "../config.js";

const TEMP_MATRIX = new THREE.Matrix4();
const TEMP_POSITION = new THREE.Vector3();
const TEMP_QUATERNION = new THREE.Quaternion();
const TEMP_SCALE = new THREE.Vector3(1, 1, 1);

export class Arena {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = "Primitive Boxing Arena";
    scene.add(this.group);

    this.#buildFloor();
    this.#buildRing();
    this.#buildAudience();
    this.#buildLights();
  }

  #buildFloor() {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.MeshStandardMaterial({
        color: 0x17120f,
        roughness: 0.86,
        metalness: 0.05,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.04;
    this.group.add(floor);

    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(24, 4.4, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 }),
    );
    backWall.position.set(0, 2.05, -9.4);
    this.group.add(backWall);
  }

  #buildRing() {
    const apron = new THREE.Mesh(
      new THREE.BoxGeometry(RING.size + 1.1, 0.34, RING.size + 1.1),
      new THREE.MeshStandardMaterial({
        color: 0xb91c1c,
        roughness: 0.72,
      }),
    );
    apron.position.y = 0.13;
    this.group.add(apron);

    const mat = new THREE.Mesh(
      new THREE.BoxGeometry(RING.size, 0.08, RING.size),
      new THREE.MeshStandardMaterial({
        color: 0xdbeafe,
        roughness: 0.78,
      }),
    );
    mat.position.y = 0.36;
    this.group.add(mat);

    const logo = new THREE.Mesh(
      new THREE.TorusGeometry(0.92, 0.028, 10, 56),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.6,
      }),
    );
    logo.rotation.x = -Math.PI / 2;
    logo.position.y = 0.415;
    this.group.add(logo);

    this.#buildRopes();
    this.#buildPosts();
  }

  #buildRopes() {
    const heights = [0.9, 1.2, 1.5];
    const ropeGeometry = new THREE.CylinderGeometry(0.035, 0.035, RING.size, 12, 1);
    const ropeMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.55,
    });
    const ropes = new THREE.InstancedMesh(ropeGeometry, ropeMaterial, 12);
    ropes.name = "Instanced ropes";

    let index = 0;
    for (const height of heights) {
      for (const z of [-RING.halfSize, RING.halfSize]) {
        TEMP_POSITION.set(0, height, z);
        TEMP_QUATERNION.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
        TEMP_MATRIX.compose(TEMP_POSITION, TEMP_QUATERNION, TEMP_SCALE);
        ropes.setMatrixAt(index, TEMP_MATRIX);
        ropes.setColorAt(index, new THREE.Color(z > 0 ? 0xef4444 : 0xf8fafc));
        index += 1;
      }

      for (const x of [-RING.halfSize, RING.halfSize]) {
        TEMP_POSITION.set(x, height, 0);
        TEMP_QUATERNION.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        TEMP_MATRIX.compose(TEMP_POSITION, TEMP_QUATERNION, TEMP_SCALE);
        ropes.setMatrixAt(index, TEMP_MATRIX);
        ropes.setColorAt(index, new THREE.Color(x > 0 ? 0x38bdf8 : 0xf8fafc));
        index += 1;
      }
    }

    ropes.instanceMatrix.needsUpdate = true;
    ropes.instanceColor.needsUpdate = true;
    this.group.add(ropes);
  }

  #buildPosts() {
    const postGeometry = new THREE.CylinderGeometry(0.1, 0.12, 1.8, 16);
    const postMaterial = new THREE.MeshStandardMaterial({
      color: 0xe5e7eb,
      roughness: 0.52,
      metalness: 0.35,
    });
    const posts = new THREE.InstancedMesh(postGeometry, postMaterial, 4);
    posts.name = "Instanced corner posts";

    let index = 0;
    for (const x of [-RING.halfSize, RING.halfSize]) {
      for (const z of [-RING.halfSize, RING.halfSize]) {
        TEMP_POSITION.set(x, 1.05, z);
        TEMP_QUATERNION.identity();
        TEMP_MATRIX.compose(TEMP_POSITION, TEMP_QUATERNION, TEMP_SCALE);
        posts.setMatrixAt(index, TEMP_MATRIX);
        index += 1;
      }
    }

    posts.instanceMatrix.needsUpdate = true;
    this.group.add(posts);

    const padGeometry = new THREE.BoxGeometry(0.3, 0.62, 0.18);
    const padMaterial = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.68,
    });
    const pads = new THREE.InstancedMesh(padGeometry, padMaterial, 8);
    pads.name = "Instanced corner pads";
    index = 0;

    for (const x of [-RING.halfSize, RING.halfSize]) {
      for (const z of [-RING.halfSize, RING.halfSize]) {
        TEMP_POSITION.set(x, 1.22, z - Math.sign(z) * 0.13);
        TEMP_QUATERNION.identity();
        TEMP_MATRIX.compose(TEMP_POSITION, TEMP_QUATERNION, TEMP_SCALE);
        pads.setMatrixAt(index++, TEMP_MATRIX);

        TEMP_POSITION.set(x - Math.sign(x) * 0.13, 1.22, z);
        TEMP_QUATERNION.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
        TEMP_MATRIX.compose(TEMP_POSITION, TEMP_QUATERNION, TEMP_SCALE);
        pads.setMatrixAt(index++, TEMP_MATRIX);
      }
    }

    pads.instanceMatrix.needsUpdate = true;
    this.group.add(pads);
  }

  #buildAudience() {
    const seatPositions = [];
    const rows = 4;
    const seatsPerSide = 24;

    for (let row = 0; row < rows; row += 1) {
      const y = 0.42 + row * 0.24;
      const offset = 4.35 + row * 0.56;
      const width = 10.7 + row * 0.45;

      for (let i = 0; i < seatsPerSide; i += 1) {
        const x = -width / 2 + (i / (seatsPerSide - 1)) * width;
        seatPositions.push(new THREE.Vector3(x, y, -offset));
        seatPositions.push(new THREE.Vector3(x, y, offset));
      }

      for (let i = 0; i < seatsPerSide - 6; i += 1) {
        const z = -width / 2 + (i / (seatsPerSide - 7)) * width;
        seatPositions.push(new THREE.Vector3(-offset, y, z));
        seatPositions.push(new THREE.Vector3(offset, y, z));
      }
    }

    const seatGeometry = new THREE.BoxGeometry(0.38, 0.16, 0.34);
    const seatMaterial = new THREE.MeshStandardMaterial({
      color: 0x262626,
      roughness: 0.82,
    });
    const seats = new THREE.InstancedMesh(seatGeometry, seatMaterial, seatPositions.length);
    seats.name = "Instanced audience seats";

    seatPositions.forEach((position, index) => {
      TEMP_POSITION.copy(position);
      TEMP_QUATERNION.identity();
      TEMP_MATRIX.compose(TEMP_POSITION, TEMP_QUATERNION, TEMP_SCALE);
      seats.setMatrixAt(index, TEMP_MATRIX);
    });

    seats.instanceMatrix.needsUpdate = true;
    this.group.add(seats);

    const spectatorCount = Math.floor(seatPositions.length * 0.62);
    const bodyGeometry = new THREE.CapsuleGeometry(0.1, 0.32, 4, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({ roughness: 0.74 });
    const bodies = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, spectatorCount);
    bodies.name = "Instanced spectator bodies";

    const headGeometry = new THREE.SphereGeometry(0.095, 10, 8);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xf3c7a6,
      roughness: 0.72,
    });
    const heads = new THREE.InstancedMesh(headGeometry, headMaterial, spectatorCount);
    heads.name = "Instanced spectator heads";

    const bodyColors = [0x2563eb, 0xdc2626, 0x16a34a, 0xf59e0b, 0x7c3aed, 0xe5e7eb];

    for (let i = 0; i < spectatorCount; i += 1) {
      const seat = seatPositions[(i * 7) % seatPositions.length];
      const jitterX = Math.sin(i * 12.9898) * 0.045;
      const jitterZ = Math.cos(i * 78.233) * 0.045;

      TEMP_POSITION.set(seat.x + jitterX, seat.y + 0.26, seat.z + jitterZ);
      TEMP_QUATERNION.identity();
      TEMP_SCALE.setScalar(0.86 + (i % 5) * 0.035);
      TEMP_MATRIX.compose(TEMP_POSITION, TEMP_QUATERNION, TEMP_SCALE);
      bodies.setMatrixAt(i, TEMP_MATRIX);
      bodies.setColorAt(i, new THREE.Color(bodyColors[i % bodyColors.length]));

      TEMP_POSITION.y += 0.32;
      TEMP_SCALE.setScalar(1);
      TEMP_MATRIX.compose(TEMP_POSITION, TEMP_QUATERNION, TEMP_SCALE);
      heads.setMatrixAt(i, TEMP_MATRIX);
    }

    bodies.instanceMatrix.needsUpdate = true;
    bodies.instanceColor.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    this.group.add(bodies, heads);
  }

  #buildLights() {
    const trussMaterial = new THREE.MeshStandardMaterial({
      color: 0x343a40,
      metalness: 0.6,
      roughness: 0.35,
    });

    const trussA = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.08, 0.08), trussMaterial);
    trussA.position.set(0, 4.15, -0.8);
    this.group.add(trussA);

    const trussB = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 7.2), trussMaterial);
    trussB.position.set(0, 4.15, -0.8);
    this.group.add(trussB);

    const fixtureGeometry = new THREE.CylinderGeometry(0.14, 0.2, 0.3, 14);
    const fixtureMaterial = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      metalness: 0.22,
      roughness: 0.4,
    });
    const fixtures = new THREE.InstancedMesh(fixtureGeometry, fixtureMaterial, 12);
    fixtures.name = "Instanced light fixtures";

    let index = 0;
    const points = [
      [-3, -0.8],
      [-1.8, -0.8],
      [-0.6, -0.8],
      [0.6, -0.8],
      [1.8, -0.8],
      [3, -0.8],
      [0, -3.8],
      [0, -2.5],
      [0, -1.4],
      [0, 0.2],
      [0, 1.3],
      [0, 2.5],
    ];

    for (const [x, z] of points) {
      TEMP_POSITION.set(x, 3.9, z);
      TEMP_QUATERNION.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
      TEMP_MATRIX.compose(TEMP_POSITION, TEMP_QUATERNION, TEMP_SCALE);
      fixtures.setMatrixAt(index, TEMP_MATRIX);
      index += 1;
    }

    fixtures.instanceMatrix.needsUpdate = true;
    this.group.add(fixtures);
  }
}
