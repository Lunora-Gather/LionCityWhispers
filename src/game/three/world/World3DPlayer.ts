import * as THREE from "three";
import { getSoftParticleTexture } from "./World3DTextures";
import { playFootstep } from "../../audio";

const SCRATCH_V3_A = new THREE.Vector3();
const SCRATCH_V3_B = new THREE.Vector3();
const SCRATCH_V2 = new THREE.Vector2();

export class World3DPlayer {
  public root = new THREE.Group();
  public position = new THREE.Vector3(-6, 1.0, -2.2); // Start on North Bank quay near Cavenagh Bridge
  public targetPosition: THREE.Vector3 | null = null;
  public isMoving = false;

  public get rotation(): THREE.Euler {
    return this.root.rotation;
  }

  // Hierarchy nodes
  private bodyGroup = new THREE.Group();
  private pelvisGroup = new THREE.Group();

  // Multi-joint leg hierarchy
  private leftThighGroup = new THREE.Group();
  private rightThighGroup = new THREE.Group();
  private leftKneeGroup = new THREE.Group();
  private rightKneeGroup = new THREE.Group();
  private leftShankGroup = new THREE.Group();
  private rightShankGroup = new THREE.Group();
  private leftAnkleGroup = new THREE.Group();
  private rightAnkleGroup = new THREE.Group();
  private leftFootGroup = new THREE.Group();
  private rightFootGroup = new THREE.Group();

  // Spine & Torso hierarchy
  private torsoSpineGroup = new THREE.Group();
  private thoraxGroup = new THREE.Group();
  private headGroup = new THREE.Group();

  // Articulated arms hierarchy
  private leftShoulderGroup = new THREE.Group();
  private rightShoulderGroup = new THREE.Group();
  private leftUpperArmGroup = new THREE.Group();
  private rightUpperArmGroup = new THREE.Group();
  private leftElbowGroup = new THREE.Group();
  private rightElbowGroup = new THREE.Group();
  private leftForearmGroup = new THREE.Group();
  private rightForearmGroup = new THREE.Group();

  // Secondary dynamic props
  private satchelGroup = new THREE.Group();
  private canteenGroup = new THREE.Group();
  private scarfTailGroup = new THREE.Group();

  // Decals & UI Markers
  private destinationMarker!: THREE.Mesh;
  private shadowDecal!: THREE.Mesh;

  // Particle & Ripple Object Pools
  private static readonly DUST_POOL_SIZE = 24;
  private dustPoints!: THREE.Points;
  private dustPositions = new Float32Array(World3DPlayer.DUST_POOL_SIZE * 3);
  private dustVx = new Float32Array(World3DPlayer.DUST_POOL_SIZE);
  private dustVy = new Float32Array(World3DPlayer.DUST_POOL_SIZE);
  private dustVz = new Float32Array(World3DPlayer.DUST_POOL_SIZE);
  private dustLife = new Float32Array(World3DPlayer.DUST_POOL_SIZE);
  private dustMaxLife = new Float32Array(World3DPlayer.DUST_POOL_SIZE);
  private dustActive = new Uint8Array(World3DPlayer.DUST_POOL_SIZE);
  private nextDustIndex = 0;

  private static readonly RIPPLE_POOL_SIZE = 6;
  private rippleGroup = new THREE.Group();
  private ripplePool: THREE.Mesh[] = [];
  private rippleLife = new Float32Array(World3DPlayer.RIPPLE_POOL_SIZE);
  private rippleActive = new Uint8Array(World3DPlayer.RIPPLE_POOL_SIZE);
  private nextRippleIndex = 0;

  // Locomotion & Inertia Physics State
  private moveSpeed = 7.5;
  private walkCycle = 0;
  private prevWalkCycle = 0;
  private elapsedTime = 0;
  private currentFacingAngle = 0;
  private currentSpeed = 0;
  private currentBankAngle = 0;
  private currentAccelPitch = 0;
  private settleTimer = -1;
  private settleY = 0;
  private wasMoving = false;

  private internalTarget = new THREE.Vector3();
  private prngSeed = 192837465;

  constructor() {
    this.buildCharacterMesh();
    this.buildFeedbackPools();
    this.buildDestinationMarker();
    this.root.position.copy(this.position);
  }

  private nextPrng(): number {
    this.prngSeed = (this.prngSeed * 1664525 + 1013904223) >>> 0;
    return this.prngSeed / 4294967296;
  }

  private buildCharacterMesh() {
    this.root.add(this.bodyGroup);
    this.bodyGroup.add(this.pelvisGroup);

    const coatMat = new THREE.MeshStandardMaterial({ color: 0x6b533b, roughness: 0.58 });
    const coatDarkMat = new THREE.MeshStandardMaterial({ color: 0x453324, roughness: 0.64 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf2ead9, roughness: 0.68 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe0ae84, roughness: 0.52 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x241711, roughness: 0.78 });
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x3b2c1e, roughness: 0.62, side: THREE.DoubleSide });
    const scarfMat = new THREE.MeshStandardMaterial({ color: 0x1e7d74, roughness: 0.52 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x241a14, roughness: 0.72 });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x69371d, roughness: 0.48 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xe2bc48, roughness: 0.24, metalness: 0.84 });
    const irisMat = new THREE.MeshBasicMaterial({ color: 0x4a2f1b });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x120d08 });
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xfbf9f4 });
    const canteenMat = new THREE.MeshStandardMaterial({ color: 0x3d6659, roughness: 0.36, metalness: 0.30 });
    const corkMat = new THREE.MeshStandardMaterial({ color: 0xc28e58, roughness: 0.85 });

    // Helper: Sleek ~4.8-head artisan safari jacket thorax with natural sloping trapezius/shoulders (zero barrel or sausage bar!)
    const buildContouredThoraxGeometry = (): THREE.BufferGeometry => {
      const radialSegs = 32;
      const heightSegs = 16;
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      const height = 0.78;

      for (let j = 0; j <= heightSegs; j++) {
        const v = j / heightSegs;
        const y = v * height;

        let rx: number;
        let rz: number;
        let zOffset = 0;

        if (v < 0.76) {
          // Tailored V-silhouette from cinched belt waist (0.245) to athletic chest/shoulders (0.305)
          const t = v / 0.76;
          const s = t * t * (3 - 2 * t);
          rx = 0.245 + (0.305 - 0.245) * s;
          rz = 0.178 + (0.215 - 0.178) * s + 0.014 * Math.sin(t * Math.PI);
          zOffset = 0.012 * Math.sin(t * Math.PI);
        } else {
          // Natural anatomical shoulder & trapezius slope closing into shirt collar
          const t = (v - 0.76) / 0.24;
          const s = t * t * (3 - 2 * t);
          rx = 0.305 * (1 - s) + 0.125 * s;
          rz = 0.215 * (1 - s) + 0.110 * s;
          zOffset = 0.012 * (1 - s);
        }

        for (let i = 0; i <= radialSegs; i++) {
          const u = i / radialSegs;
          const theta = u * Math.PI * 2;
          const cosT = Math.cos(theta);
          const sinT = Math.sin(theta);

          const pectoral =
            v > 0.34 && v < 0.80 && sinT > 0
              ? 1 + 0.065 * Math.sin(((v - 0.34) / 0.46) * Math.PI) * Math.pow(sinT, 2)
              : 1.0;

          positions.push(cosT * rx, y, sinT * rz * pectoral + zOffset);
          uvs.push(u, v);
        }
      }

      const stride = radialSegs + 1;
      for (let j = 0; j < heightSegs; j++) {
        for (let i = 0; i < radialSegs; i++) {
          const a = j * stride + i;
          const b = a + 1;
          const c = (j + 1) * stride + i;
          const d = c + 1;
          indices.push(a, c, b);
          indices.push(b, c, d);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      return geo;
    };

    // Helper: Vertex-sculpted head with defined jawline, cheekbones & chin
    const buildSculptedHeadGeometry = (radius: number): THREE.BufferGeometry => {
      const geo = new THREE.SphereGeometry(radius, 24, 20);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);
        const ny = y / radius;
        const nz = z / radius;

        if (ny < 0) {
          const jawT = Math.min(1, -ny);
          x *= 1 - 0.26 * Math.pow(jawT, 1.35);
          if (nz > 0.25) {
            z += radius * 0.065 * Math.pow(jawT, 1.2) * ((nz - 0.25) / 0.75);
          }
          if (nz < 0) {
            z *= 1 - 0.12 * jawT;
          }
        } else {
          x *= 0.96;
          y *= 1.04;
        }
        pos.setXYZ(i, x, y, z);
      }
      geo.computeVertexNormals();
      return geo;
    };

    // 1. Tailored Safari Coat Peplum Skirt & Cinched Leather Waist Belt
    const coatSkirt = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.295, 0.24, 28), coatMat);
    coatSkirt.scale.set(1.02, 1.0, 0.74);
    coatSkirt.position.set(0, 0.63, 0);
    coatSkirt.castShadow = true;
    this.pelvisGroup.add(coatSkirt);

    const skirtHem = new THREE.Mesh(new THREE.TorusGeometry(0.292, 0.014, 10, 28), coatDarkMat);
    skirtHem.rotation.x = Math.PI / 2;
    skirtHem.scale.set(1.02, 0.74, 1.0);
    skirtHem.position.set(0, 0.515, 0);
    this.pelvisGroup.add(skirtHem);

    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.252, 0.254, 0.072, 28), leatherMat);
    belt.scale.set(1.03, 1.0, 0.75);
    belt.position.set(0, 0.72, 0);
    this.pelvisGroup.add(belt);

    const beltBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.088, 0.036), brassMat);
    beltBuckle.position.set(0, 0.72, 0.192);
    this.pelvisGroup.add(beltBuckle);

    const buckleProng = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.065, 0.044), coatDarkMat);
    buckleProng.position.set(0, 0.72, 0.194);
    this.pelvisGroup.add(buckleProng);

    // 2. Multi-Joint Articulated Legs & Field Boots (Left & Right)
    const thighGeo = new THREE.CylinderGeometry(0.098, 0.080, 0.30, 18);
    thighGeo.translate(0, -0.15, 0);

    const hipJointGeo = new THREE.SphereGeometry(0.096, 14, 12);
    const kneeCapGeo = new THREE.SphereGeometry(0.078, 14, 12);

    const shankGeo = new THREE.CylinderGeometry(0.078, 0.065, 0.26, 18);
    shankGeo.translate(0, -0.13, 0);

    const gaiterCuffGeo = new THREE.CylinderGeometry(0.084, 0.080, 0.062, 18);
    const gaiterWrapGeo = new THREE.TorusGeometry(0.075, 0.010, 8, 18);
    gaiterWrapGeo.rotateX(Math.PI / 2);

    const buildArtisanFoot = (footGroup: THREE.Group) => {
      // Ankle boot collar
      const ankleShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.080, 0.08, 16), bootMat);
      ankleShaft.position.set(0, -0.02, 0);
      ankleShaft.castShadow = true;
      footGroup.add(ankleShaft);

      // Sculpted leather vamp & instep
      const vamp = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.11, 8, 16), bootMat);
      vamp.rotation.x = Math.PI / 2;
      vamp.scale.set(1.06, 1.0, 0.78);
      vamp.position.set(0, -0.045, 0.055);
      vamp.castShadow = true;
      footGroup.add(vamp);

      // Domed explorer boot toe cap
      const toeCap = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 12), leatherMat);
      toeCap.scale.set(1.06, 0.72, 1.15);
      toeCap.position.set(0, -0.048, 0.13);
      toeCap.castShadow = true;
      footGroup.add(toeCap);

      // Lugged sole & stacked heel
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.022, 0.25), coatDarkMat);
      sole.position.set(0, -0.072, 0.055);
      footGroup.add(sole);

      const heel = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.070, 0.032, 14), bootMat);
      heel.position.set(0, -0.068, -0.025);
      footGroup.add(heel);
    };

    // Left Leg
    this.leftThighGroup.position.set(-0.16, 0.65, 0);
    this.pelvisGroup.add(this.leftThighGroup);

    const leftHipSph = new THREE.Mesh(hipJointGeo, coatMat);
    this.leftThighGroup.add(leftHipSph);

    const leftThighMesh = new THREE.Mesh(thighGeo, coatMat);
    leftThighMesh.castShadow = true;
    this.leftThighGroup.add(leftThighMesh);

    this.leftKneeGroup.position.set(0, -0.32, 0);
    this.leftThighGroup.add(this.leftKneeGroup);
    this.leftKneeGroup.add(this.leftShankGroup);

    const leftKneeSph = new THREE.Mesh(kneeCapGeo, coatDarkMat);
    this.leftShankGroup.add(leftKneeSph);

    const leftShankMesh = new THREE.Mesh(shankGeo, bootMat);
    leftShankMesh.castShadow = true;
    this.leftShankGroup.add(leftShankMesh);

    const leftCuffMesh = new THREE.Mesh(gaiterCuffGeo, leatherMat);
    leftCuffMesh.position.set(0, -0.05, 0);
    this.leftShankGroup.add(leftCuffMesh);

    for (const wy of [-0.11, -0.16, -0.21]) {
      const wrap = new THREE.Mesh(gaiterWrapGeo, leatherMat);
      wrap.position.set(0, wy, 0);
      this.leftShankGroup.add(wrap);
    }

    this.leftAnkleGroup.position.set(0, -0.28, 0);
    this.leftShankGroup.add(this.leftAnkleGroup);
    this.leftAnkleGroup.add(this.leftFootGroup);
    buildArtisanFoot(this.leftFootGroup);

    // Right Leg
    this.rightThighGroup.position.set(0.16, 0.65, 0);
    this.pelvisGroup.add(this.rightThighGroup);

    const rightHipSph = new THREE.Mesh(hipJointGeo, coatMat);
    this.rightThighGroup.add(rightHipSph);

    const rightThighMesh = new THREE.Mesh(thighGeo, coatMat);
    rightThighMesh.castShadow = true;
    this.rightThighGroup.add(rightThighMesh);

    this.rightKneeGroup.position.set(0, -0.32, 0);
    this.rightThighGroup.add(this.rightKneeGroup);
    this.rightKneeGroup.add(this.rightShankGroup);

    const rightKneeSph = new THREE.Mesh(kneeCapGeo, coatDarkMat);
    this.rightShankGroup.add(rightKneeSph);

    const rightShankMesh = new THREE.Mesh(shankGeo, bootMat);
    rightShankMesh.castShadow = true;
    this.rightShankGroup.add(rightShankMesh);

    const rightCuffMesh = new THREE.Mesh(gaiterCuffGeo, leatherMat);
    rightCuffMesh.position.set(0, -0.05, 0);
    this.rightShankGroup.add(rightCuffMesh);

    for (const wy of [-0.11, -0.16, -0.21]) {
      const wrap = new THREE.Mesh(gaiterWrapGeo, leatherMat);
      wrap.position.set(0, wy, 0);
      this.rightShankGroup.add(wrap);
    }

    this.rightAnkleGroup.position.set(0, -0.28, 0);
    this.rightShankGroup.add(this.rightAnkleGroup);
    this.rightAnkleGroup.add(this.rightFootGroup);
    buildArtisanFoot(this.rightFootGroup);

    // 3. Sculpted Torso Spine & Continuous Multi-Ring Lofted Safari Coat Thorax
    this.torsoSpineGroup.position.set(0, 0.72, 0);
    this.pelvisGroup.add(this.torsoSpineGroup);
    this.torsoSpineGroup.add(this.thoraxGroup);

    const thoraxMesh = new THREE.Mesh(buildContouredThoraxGeometry(), coatMat);
    thoraxMesh.castShadow = true;
    thoraxMesh.receiveShadow = true;
    this.thoraxGroup.add(thoraxMesh);

    // Linen explorer shirt collar inset at V-neck (no sausage shoulder bar!)
    const shirtInset = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.105, 0.20, 16), shirtMat);
    shirtInset.scale.set(1.0, 1.0, 0.72);
    shirtInset.position.set(0, 0.70, 0.06);
    this.thoraxGroup.add(shirtInset);

    // Notched tailored coat lapels & subtle shoulder epaulets
    for (const side of [-1, 1]) {
      const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.060, 0.21, 0.018), coatDarkMat);
      lapel.position.set(side * 0.082, 0.59, 0.198);
      lapel.rotation.z = side * -0.32;
      lapel.rotation.x = -0.10;
      lapel.rotation.y = side * 0.16;
      this.thoraxGroup.add(lapel);

      const lapelPin = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), brassMat);
      lapelPin.position.set(side * 0.092, 0.63, 0.208);
      this.thoraxGroup.add(lapelPin);

      const epaulet = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.11, 6, 10), coatDarkMat);
      epaulet.position.set(side * 0.22, 0.71, 0);
      epaulet.rotation.z = Math.PI / 2 + side * -0.22;
      epaulet.scale.set(1.0, 1.0, 0.45);
      this.thoraxGroup.add(epaulet);

      const epButton = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), brassMat);
      epButton.position.set(side * 0.165, 0.735, 0);
      this.thoraxGroup.add(epButton);
    }

    // Tailored Pleated Safari Chest Pockets with Scalloped Flaps & Brass Buttons
    for (const px of [-0.135, 0.135]) {
      const pocketBody = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.125, 0.024), coatMat);
      pocketBody.position.set(px, 0.44, 0.198);
      pocketBody.rotation.y = px > 0 ? 0.22 : -0.22;
      this.thoraxGroup.add(pocketBody);

      const pocketFlap = new THREE.Mesh(new THREE.BoxGeometry(0.122, 0.036, 0.030), coatDarkMat);
      pocketFlap.position.set(px, 0.495, 0.202);
      pocketFlap.rotation.y = px > 0 ? 0.22 : -0.22;
      this.thoraxGroup.add(pocketFlap);

      const pButton = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), brassMat);
      pButton.position.set(px * 0.98, 0.482, 0.218);
      this.thoraxGroup.add(pButton);
    }

    // Polished Brass Jacket Buttons down front placket
    const placket = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.52, 0.018), coatDarkMat);
    placket.position.set(0, 0.33, 0.205);
    this.thoraxGroup.add(placket);

    for (const by of [0.52, 0.37, 0.22, 0.08]) {
      const button = new THREE.Mesh(new THREE.SphereGeometry(0.015, 10, 8), brassMat);
      button.scale.set(1.0, 1.0, 0.52);
      button.position.set(0, by, 0.215);
      this.thoraxGroup.add(button);
    }

    // Surface-Hugging Curved Leather Baldric Strap (CatmullRom spline from left shoulder across chest & back to right hip satchel!)
    const baldricCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.20, 0.72, 0.02),
      new THREE.Vector3(-0.04, 0.48, 0.222),
      new THREE.Vector3(0.18, 0.22, 0.185),
      new THREE.Vector3(0.28, 0.05, 0.04),
      new THREE.Vector3(0.16, 0.24, -0.175),
      new THREE.Vector3(-0.06, 0.50, -0.195)
    ], true);
    const baldricGeo = new THREE.TubeGeometry(baldricCurve, 32, 0.024, 8, true);
    baldricGeo.scale(1.0, 1.0, 0.96);
    const strap = new THREE.Mesh(baldricGeo, leatherMat);
    this.thoraxGroup.add(strap);

    const chestStrapBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.068, 0.026), brassMat);
    chestStrapBuckle.position.set(-0.04, 0.48, 0.228);
    chestStrapBuckle.rotation.z = -0.68;
    this.thoraxGroup.add(chestStrapBuckle);

    // Beveled Saddle-Leather Field Satchel Bag + Rolled Map Scroll Tube
    this.satchelGroup.position.set(0.30, 0.02, 0.04);
    const satchelShape = new THREE.Shape();
    satchelShape.moveTo(-0.055, -0.12);
    satchelShape.lineTo(0.055, -0.12);
    satchelShape.quadraticCurveTo(0.072, -0.12, 0.072, -0.09);
    satchelShape.lineTo(0.066, 0.11);
    satchelShape.quadraticCurveTo(0.066, 0.135, 0.04, 0.135);
    satchelShape.lineTo(-0.04, 0.135);
    satchelShape.quadraticCurveTo(-0.066, 0.135, -0.066, 0.11);
    satchelShape.lineTo(-0.072, -0.09);
    satchelShape.quadraticCurveTo(-0.072, -0.12, -0.055, -0.12);
    const satchelGeo = new THREE.ExtrudeGeometry(satchelShape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.018,
      bevelSegments: 2
    });
    satchelGeo.translate(0, 0, -0.11);
    satchelGeo.rotateY(Math.PI / 2);
    const satchelBagMesh = new THREE.Mesh(satchelGeo, leatherMat);
    satchelBagMesh.castShadow = true;
    this.satchelGroup.add(satchelBagMesh);

    const satchelFlap = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.24, 16), coatDarkMat);
    satchelFlap.rotation.x = Math.PI / 2;
    satchelFlap.position.set(0, 0.115, 0);
    this.satchelGroup.add(satchelFlap);

    for (const sz of [-0.055, 0.055]) {
      const sStrap = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.20, 0.022), coatDarkMat);
      sStrap.position.set(0.005, 0.01, sz);
      this.satchelGroup.add(sStrap);

      const sBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.042, 0.030), brassMat);
      sBuckle.position.set(0.088, -0.02, sz);
      this.satchelGroup.add(sBuckle);
    }

    const mapScroll = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.28, 12), shirtMat);
    mapScroll.rotation.x = Math.PI / 2;
    mapScroll.position.set(0.02, 0.16, 0);
    this.satchelGroup.add(mapScroll);
    this.thoraxGroup.add(this.satchelGroup);

    // Vintage Traveler Canteen with secondary inertia node
    this.canteenGroup.position.set(-0.29, 0.02, 0.03);
    const canteenBody = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.10, 18), canteenMat);
    canteenBody.rotation.z = Math.PI / 2;
    canteenBody.castShadow = true;
    this.canteenGroup.add(canteenBody);

    const canteenNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.06, 12), brassMat);
    canteenNeck.position.y = 0.095;
    this.canteenGroup.add(canteenNeck);

    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.020, 0.045, 10), corkMat);
    cork.position.y = 0.135;
    this.canteenGroup.add(cork);

    const canteenStrap = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.014, 8, 20), leatherMat);
    canteenStrap.rotation.y = Math.PI / 2;
    this.canteenGroup.add(canteenStrap);
    this.thoraxGroup.add(this.canteenGroup);

    // Tailored Neckerchief Collar & Subtle Fluttering Tails
    const scarfGroup = new THREE.Group();
    scarfGroup.position.set(0, 0.77, 0.01);

    const scarfCollar = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.028, 12, 24), scarfMat);
    scarfCollar.rotation.x = Math.PI / 2;
    scarfCollar.scale.set(1.02, 0.86, 1.0);
    scarfGroup.add(scarfCollar);

    const scarfKnot = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 10), scarfMat);
    scarfKnot.position.set(0.03, -0.02, -0.155);
    scarfGroup.add(scarfKnot);

    this.scarfTailGroup.position.set(0, 0, -0.155);
    const tailGeo1 = new THREE.CapsuleGeometry(0.024, 0.20, 6, 12);
    tailGeo1.scale(1.15, 1.0, 0.32);
    tailGeo1.translate(0.032, -0.13, -0.015);
    const tailMesh1 = new THREE.Mesh(tailGeo1, scarfMat);
    tailMesh1.rotation.z = 0.14;
    this.scarfTailGroup.add(tailMesh1);

    const tailGeo2 = new THREE.CapsuleGeometry(0.021, 0.17, 6, 12);
    tailGeo2.scale(1.15, 1.0, 0.32);
    tailGeo2.translate(-0.030, -0.11, -0.015);
    const tailMesh2 = new THREE.Mesh(tailGeo2, scarfMat);
    tailMesh2.rotation.z = -0.16;
    this.scarfTailGroup.add(tailMesh2);

    scarfGroup.add(this.scarfTailGroup);
    this.thoraxGroup.add(scarfGroup);

    // 4. Sculpted Artisan Head, Facial Features, Layered Hair & Explorer Fedora Hat
    this.headGroup.position.set(0, 0.98, 0);

    // Neck column connecting collar to head
    const neckCol = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.11, 0.14, 16), skinMat);
    neckCol.position.set(0, -0.12, 0);
    this.headGroup.add(neckCol);

    // Vertex-sculpted cranium + tapered jawline
    const head = new THREE.Mesh(buildSculptedHeadGeometry(0.235), skinMat);
    head.position.y = 0.03;
    head.castShadow = true;
    this.headGroup.add(head);

    // Sculpted nose bridge & warm mouth contour
    const nose = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.048, 6, 10), skinMat);
    nose.rotation.x = -0.18;
    nose.position.set(0, 0.025, 0.232);
    this.headGroup.add(nose);

    const mouthMat = new THREE.MeshStandardMaterial({ color: 0xb05a46, roughness: 0.55 });
    const mouthLine = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.042, 6, 10), mouthMat);
    mouthLine.rotation.z = Math.PI / 2;
    mouthLine.position.set(0, -0.048, 0.222);
    this.headGroup.add(mouthLine);

    // Sculpted ears
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), skinMat);
      ear.scale.set(0.45, 1.15, 0.75);
      ear.position.set(side * 0.222, 0.02, 0.01);
      this.headGroup.add(ear);
    }

    // Expressive almond eyes with warm hazel irises, pupils, catchlights & sculpted brows
    for (const ex of [-0.076, 0.076]) {
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), eyeWhiteMat);
      sclera.scale.set(1.22, 0.80, 0.55);
      sclera.position.set(ex, 0.040, 0.215);
      this.headGroup.add(sclera);

      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), irisMat);
      iris.scale.set(0.96, 0.98, 0.55);
      iris.position.set(ex, 0.039, 0.224);
      this.headGroup.add(iris);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.015, 10, 10), eyeMat);
      pupil.scale.set(0.95, 0.95, 0.55);
      pupil.position.set(ex, 0.039, 0.230);
      this.headGroup.add(pupil);

      const catchlight = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 8, 8), eyeWhiteMat);
      catchlight.position.set(ex + 0.007, 0.046, 0.238);
      this.headGroup.add(catchlight);

      const upperLid = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.046, 4, 8), coatDarkMat);
      upperLid.position.set(ex, 0.056, 0.222);
      upperLid.rotation.z = Math.PI / 2 + (ex < 0 ? 0.05 : -0.05);
      this.headGroup.add(upperLid);

      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.052, 4, 8), hairMat);
      brow.position.set(ex, 0.084, 0.218);
      brow.rotation.z = Math.PI / 2 + (ex < 0 ? 0.08 : -0.08);
      this.headGroup.add(brow);
    }

    // Sculpted hair cap, nape locks, sideburns, and clean hairline under hat
    const hairBackCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.248, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
      hairMat
    );
    hairBackCap.scale.set(0.98, 1.05, 1.03);
    hairBackCap.rotation.x = -0.52;
    hairBackCap.position.set(0, 0.04, -0.02);
    this.headGroup.add(hairBackCap);

    // Sideburns & temple locks
    for (const sx of [-0.21, 0.21]) {
      const sideLock = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.10, 6, 10), hairMat);
      sideLock.position.set(sx, 0.05, 0.08);
      sideLock.rotation.x = 0.2;
      this.headGroup.add(sideLock);
    }

    // Smooth Swept Hairline Framing Forehead cleanly beneath hat crown
    for (const side of [-1, 1]) {
      const partSweep = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.085, 8, 12), hairMat);
      partSweep.scale.set(1.15, 0.36, 0.42);
      partSweep.position.set(side * 0.072, 0.164, 0.142);
      partSweep.rotation.set(0.14, side * -0.18, side * -1.36);
      this.headGroup.add(partSweep);

      const templeSoft = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.062, 6, 10), hairMat);
      templeSoft.scale.set(0.70, 1.0, 0.80);
      templeSoft.position.set(side * 0.158, 0.102, 0.128);
      templeSoft.rotation.set(0.10, side * -0.52, side * -0.16);
      this.headGroup.add(templeSoft);
    }

    // Sculpted Saddle-Brim & Pinched-Crown Explorer Fedora Hat (LatheGeometry + organic brim saddle curve!)
    const hatGroup = new THREE.Group();
    hatGroup.position.set(0, 0.195, -0.01);
    hatGroup.rotation.x = -0.07;

    const hatProfile = [
      new THREE.Vector2(0.415, 0.005),
      new THREE.Vector2(0.395, 0.022),
      new THREE.Vector2(0.335, 0.014),
      new THREE.Vector2(0.258, 0.020),
      new THREE.Vector2(0.242, 0.105),
      new THREE.Vector2(0.215, 0.195),
      new THREE.Vector2(0.165, 0.225),
      new THREE.Vector2(0.075, 0.205),
      new THREE.Vector2(0.001, 0.195)
    ];
    const fedoraGeo = new THREE.LatheGeometry(hatProfile, 36);
    const fedoraPos = fedoraGeo.attributes.position;
    for (let i = 0; i < fedoraPos.count; i++) {
      let vx = fedoraPos.getX(i);
      let vy = fedoraPos.getY(i);
      let vz = fedoraPos.getZ(i);
      const r = Math.hypot(vx, vz);
      // Elongate front-to-back & sculpt classic safari saddle-brim (curled up on sides, dipped front/back)
      vx *= 0.92;
      vz *= 1.07;
      if (r > 0.27) {
        const brimT = (r - 0.27) / 0.15;
        const sideTurnUp = (vx * vx) / Math.max(0.01, r * r);
        const frontDip = (vz * vz) / Math.max(0.01, r * r);
        vy += brimT * (0.042 * sideTurnUp - 0.026 * frontDip);
      } else if (vy > 0.11 && vz > 0.02) {
        // Front teardrop pinch dents on crown
        const pinch = Math.max(0, 1 - Math.abs(vy - 0.165) / 0.065) * Math.min(1, vz / 0.18);
        vx *= 1 - 0.18 * pinch;
      }
      fedoraPos.setXYZ(i, vx, vy, vz);
    }
    fedoraGeo.computeVertexNormals();

    const fedoraMesh = new THREE.Mesh(fedoraGeo, hatMat);
    fedoraMesh.castShadow = true;
    fedoraMesh.receiveShadow = true;
    hatGroup.add(fedoraMesh);

    // Grosgrain leather hatband & brass buckle
    const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.250, 0.260, 0.044, 32), leatherMat);
    hatBand.scale.set(0.93, 1.0, 1.08);
    hatBand.position.y = 0.042;
    hatGroup.add(hatBand);

    const hatBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.048, 0.020), brassMat);
    hatBuckle.position.set(0, 0.042, 0.278);
    hatGroup.add(hatBuckle);

    // Kingfisher-teal explorer feather tucked into hatband
    const feather = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.17, 8), scarfMat);
    feather.scale.set(0.35, 1.0, 1.0);
    feather.position.set(-0.24, 0.11, -0.02);
    feather.rotation.x = -0.48;
    feather.rotation.z = 0.20;
    hatGroup.add(feather);

    this.headGroup.add(hatGroup);
    this.thoraxGroup.add(this.headGroup);

    // 5. Sleek Tapered Articulated Sleeves, Rolled Cuffs & Sculpted Hands
    const shoulderCapGeo = new THREE.SphereGeometry(0.086, 14, 12);
    const upperArmGeo = new THREE.CylinderGeometry(0.082, 0.070, 0.28, 18);
    upperArmGeo.translate(0, -0.14, 0);

    const elbowJointGeo = new THREE.SphereGeometry(0.069, 14, 12);
    const forearmGeo = new THREE.CylinderGeometry(0.068, 0.056, 0.24, 18);
    forearmGeo.translate(0, -0.12, 0);

    const cuffRollGeo = new THREE.TorusGeometry(0.058, 0.014, 8, 18);
    cuffRollGeo.rotateX(Math.PI / 2);

    const buildArtisanHand = (forearmGroup: THREE.Group, side: number) => {
      const cuffRoll = new THREE.Mesh(cuffRollGeo, coatDarkMat);
      cuffRoll.position.set(0, -0.23, 0);
      forearmGroup.add(cuffRoll);

      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.056, 14, 12), skinMat);
      palm.scale.set(0.78, 1.15, 0.95);
      palm.position.set(0, -0.28, 0.005);
      palm.castShadow = true;
      forearmGroup.add(palm);

      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.034, 4, 8), skinMat);
      thumb.position.set(side * -0.032, -0.27, 0.038);
      thumb.rotation.x = 0.55;
      thumb.rotation.z = side * 0.35;
      forearmGroup.add(thumb);
    };

    // Left Arm (tucked seamlessly into sloping jacket shoulder at x = -0.262, y = 0.615)
    this.leftShoulderGroup.position.set(-0.262, 0.615, 0);
    this.leftShoulderGroup.add(this.leftUpperArmGroup);

    const leftShoulderCap = new THREE.Mesh(shoulderCapGeo, coatMat);
    this.leftUpperArmGroup.add(leftShoulderCap);

    const leftUpperArmMesh = new THREE.Mesh(upperArmGeo, coatMat);
    leftUpperArmMesh.castShadow = true;
    this.leftUpperArmGroup.add(leftUpperArmMesh);

    this.leftElbowGroup.position.set(0, -0.29, 0);
    this.leftUpperArmGroup.add(this.leftElbowGroup);
    this.leftElbowGroup.add(this.leftForearmGroup);

    const leftElbowSph = new THREE.Mesh(elbowJointGeo, coatMat);
    this.leftForearmGroup.add(leftElbowSph);

    const leftForearmMesh = new THREE.Mesh(forearmGeo, coatMat);
    leftForearmMesh.castShadow = true;
    this.leftForearmGroup.add(leftForearmMesh);

    buildArtisanHand(this.leftForearmGroup, -1);

    this.leftUpperArmGroup.rotation.z = -0.07;
    this.leftForearmGroup.rotation.x = 0.18;
    this.thoraxGroup.add(this.leftShoulderGroup);

    // Right Arm (tucked seamlessly into sloping jacket shoulder at x = +0.262, y = 0.615)
    this.rightShoulderGroup.position.set(0.262, 0.615, 0);
    this.rightShoulderGroup.add(this.rightUpperArmGroup);

    const rightShoulderCap = new THREE.Mesh(shoulderCapGeo, coatMat);
    this.rightUpperArmGroup.add(rightShoulderCap);

    const rightUpperArmMesh = new THREE.Mesh(upperArmGeo, coatMat);
    rightUpperArmMesh.castShadow = true;
    this.rightUpperArmGroup.add(rightUpperArmMesh);

    this.rightElbowGroup.position.set(0, -0.29, 0);
    this.rightUpperArmGroup.add(this.rightElbowGroup);
    this.rightElbowGroup.add(this.rightForearmGroup);

    const rightElbowSph = new THREE.Mesh(elbowJointGeo, coatMat);
    this.rightForearmGroup.add(rightElbowSph);

    const rightForearmMesh = new THREE.Mesh(forearmGeo, coatMat);
    rightForearmMesh.castShadow = true;
    this.rightForearmGroup.add(rightForearmMesh);

    buildArtisanHand(this.rightForearmGroup, 1);

    this.rightUpperArmGroup.rotation.z = 0.07;
    this.rightForearmGroup.rotation.x = 0.18;
    this.thoraxGroup.add(this.rightShoulderGroup);

    // Ground Shadow Decal
    this.shadowDecal = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 16),
      new THREE.MeshBasicMaterial({ color: 0x050807, transparent: true, opacity: 0.45 })
    );
    this.shadowDecal.rotation.x = -Math.PI / 2;
    this.shadowDecal.position.y = 0.02;
    this.root.add(this.shadowDecal);
  }

  private buildFeedbackPools() {
    // 1. Stone Dust Particles Pool (24 particles in a single THREE.Points)
    for (let i = 0; i < World3DPlayer.DUST_POOL_SIZE; i++) {
      this.dustPositions[i * 3 + 0] = 0;
      this.dustPositions[i * 3 + 1] = -999.0;
      this.dustPositions[i * 3 + 2] = 0;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(this.dustPositions, 3));

    const dustMat = new THREE.PointsMaterial({
      color: 0x9e9484,
      map: getSoftParticleTexture(),
      alphaTest: 0.04,
      size: 0.095,
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    });
    this.dustPoints = new THREE.Points(dustGeo, dustMat);
    this.root.add(this.dustPoints);

    // 2. Concentric Water Ripple Pool (6 THREE.RingGeometry meshes)
    this.root.add(this.rippleGroup);
    const ringGeo = new THREE.RingGeometry(0.08, 0.16, 24);
    for (let i = 0; i < World3DPlayer.RIPPLE_POOL_SIZE; i++) {
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x6ee5d6,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(ringGeo, ringMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.03;
      mesh.visible = false;
      this.rippleGroup.add(mesh);
      this.ripplePool.push(mesh);
    }
  }

  private buildDestinationMarker() {
    const markerGeo = new THREE.RingGeometry(0.45, 0.6, 24);
    const markerMat = new THREE.MeshBasicMaterial({
      color: 0x3de0c8,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    this.destinationMarker = new THREE.Mesh(markerGeo, markerMat);
    this.destinationMarker.rotation.x = -Math.PI / 2;
    this.destinationMarker.position.y = 0.05;
    this.destinationMarker.visible = false;
    this.root.add(this.destinationMarker);
  }

  public setDestination(point: THREE.Vector3) {
    this.internalTarget.copy(point);
    this.targetPosition = this.internalTarget;
    this.destinationMarker.position.set(point.x - this.root.position.x, 0.05, point.z - this.root.position.z);
    this.destinationMarker.visible = true;
  }

  public clearDestination() {
    this.targetPosition = null;
    this.destinationMarker.visible = false;
  }

  private onFootstep(isLeft: boolean) {
    const footX = isLeft ? -0.20 : 0.20;
    const footZ = 0.08;
    const sinF = Math.sin(this.currentFacingAngle);
    const cosF = Math.cos(this.currentFacingAngle);

    // World foot contact position
    const worldX = this.position.x + (footX * cosF + footZ * sinF);
    const worldZ = this.position.z + (-footX * sinF + footZ * cosF);
    const worldY = this.position.y;

    // Local coordinates relative to this.root
    const localX = worldX - this.root.position.x;
    const localZ = worldZ - this.root.position.z;

    // Moisture / Proximity sensing: wet stone steps or river margin
    const isNearWaterSteps = worldX >= 0.0 && worldX <= 5.0 && worldZ >= -2.0 && worldZ <= 2.0;
    const isWaterMargin = worldY <= 0.45 && worldZ >= -1.5 && worldZ <= 6.5;
    const isWater = isNearWaterSteps || isWaterMargin;

    if (isWater) {
      this.spawnWaterRipple(localX, localZ);
    } else {
      this.spawnDustPuff(localX, localZ);
    }
    playFootstep(isWater);
  }

  private spawnDustPuff(localX: number, localZ: number) {
    for (let k = 0; k < 3; k++) {
      const idx = (this.nextDustIndex + k) % World3DPlayer.DUST_POOL_SIZE;
      this.dustActive[idx] = 1;
      this.dustLife[idx] = 0.32 + k * 0.04;
      this.dustMaxLife[idx] = this.dustLife[idx];

      const angle = this.nextPrng() * Math.PI * 2;
      const speed = 0.25 + this.nextPrng() * 0.35;
      this.dustVx[idx] = Math.cos(angle) * speed;
      this.dustVy[idx] = 0.45 + this.nextPrng() * 0.35;
      this.dustVz[idx] = Math.sin(angle) * speed;

      this.dustPositions[idx * 3 + 0] = localX + (this.nextPrng() - 0.5) * 0.06;
      this.dustPositions[idx * 3 + 1] = 0.02;
      this.dustPositions[idx * 3 + 2] = localZ + (this.nextPrng() - 0.5) * 0.06;
    }
    this.nextDustIndex = (this.nextDustIndex + 3) % World3DPlayer.DUST_POOL_SIZE;
  }

  private spawnWaterRipple(localX: number, localZ: number) {
    const idx = this.nextRippleIndex;
    this.nextRippleIndex = (this.nextRippleIndex + 1) % World3DPlayer.RIPPLE_POOL_SIZE;
    this.rippleActive[idx] = 1;
    this.rippleLife[idx] = 0.5;

    const mesh = this.ripplePool[idx];
    mesh.position.set(localX, 0.03, localZ);
    mesh.scale.set(1.0, 1.0, 1.0);
    mesh.visible = true;
    (mesh.material as THREE.MeshBasicMaterial).opacity = 0.75;
  }

  public update(delta: number, inputDirection: THREE.Vector2) {
    const dt = Math.max(0.001, Math.min(0.1, delta));
    let moveX = 0;
    let moveZ = 0;

    // 1. Input direction or click-to-move pathing
    if (inputDirection.lengthSq() > 0.01) {
      this.clearDestination();
      moveX = inputDirection.x;
      moveZ = inputDirection.y;
    } else if (this.targetPosition) {
      SCRATCH_V3_A.subVectors(this.targetPosition, this.position);
      SCRATCH_V3_A.y = 0;
      const dist = SCRATCH_V3_A.length();
      if (dist < 0.25) {
        this.clearDestination();
      } else {
        SCRATCH_V3_A.normalize();
        moveX = SCRATCH_V3_A.x;
        moveZ = SCRATCH_V3_A.z;
      }
    }

    const prevPosX = this.position.x;
    const prevPosZ = this.position.z;
    this.isMoving = Math.abs(moveX) > 0.01 || Math.abs(moveZ) > 0.01;

    // 2. Translational Movement
    const speed = this.moveSpeed * dt;
    if (this.isMoving) {
      this.position.x += moveX * speed;
      this.position.z += moveZ * speed;

      // Diorama perimeter constraints
      this.position.x = Math.max(-26, Math.min(22, this.position.x));
      this.position.z = Math.max(-22, Math.min(20, this.position.z));

      // Singapore River fairway collision clamping (Z in (-1.1, 6.1) outside Cavenagh Bridge X in [-3.2, 3.2])
      const RIVER_Z_MIN = -1.1;
      const RIVER_Z_MAX = 6.1;
      const BRIDGE_X_MIN = -3.2;
      const BRIDGE_X_MAX = 3.2;
      const inRiverZ = this.position.z > RIVER_Z_MIN && this.position.z < RIVER_Z_MAX;
      const onBridgeX = this.position.x >= BRIDGE_X_MIN && this.position.x <= BRIDGE_X_MAX;
      if (inRiverZ && !onBridgeX) {
        const wasOnBridgeX = prevPosX >= BRIDGE_X_MIN && prevPosX <= BRIDGE_X_MAX;
        const wasInRiverZ = prevPosZ > RIVER_Z_MIN && prevPosZ < RIVER_Z_MAX;
        if (wasOnBridgeX && wasInRiverZ) {
          this.position.x = this.position.x < BRIDGE_X_MIN ? BRIDGE_X_MIN : BRIDGE_X_MAX;
        } else if (prevPosZ <= RIVER_Z_MIN) {
          this.position.z = RIVER_Z_MIN;
        } else if (prevPosZ >= RIVER_Z_MAX) {
          this.position.z = RIVER_Z_MAX;
        } else {
          this.position.z = this.position.z < 2.5 ? RIVER_Z_MIN : RIVER_Z_MAX;
        }
      }
    }

    // Measure delta movement for feedback pool anchor compensation
    let dx = this.position.x - prevPosX;
    let dz = this.position.z - prevPosZ;
    if (Math.abs(dx) > 1.0 || Math.abs(dz) > 1.0) {
      dx = 0;
      dz = 0;
    }

    // Sync root position with external position
    this.root.position.x = this.position.x;
    this.root.position.y = this.position.y;
    this.root.position.z = this.position.z;

    // 3. Linear Speed & Forward Acceleration Tracking
    const targetSpeed = this.isMoving ? this.moveSpeed : 0.0;
    const speedAlpha = 1.0 - Math.exp(-12.0 * dt);
    const prevSpeed = this.currentSpeed;
    this.currentSpeed += (targetSpeed - this.currentSpeed) * speedAlpha;
    if (Math.abs(this.currentSpeed) < 1e-6) this.currentSpeed = 0.0;
    const linearAccel = (this.currentSpeed - prevSpeed) / dt;

    // Forward pitch lean tracking acceleration
    const targetPitch = Math.max(0, Math.min(0.085, linearAccel * 0.012));
    this.currentAccelPitch += (targetPitch - this.currentAccelPitch) * (1.0 - Math.exp(-10.0 * dt));
    if (Math.abs(this.currentAccelPitch) < 1e-6) this.currentAccelPitch = 0.0;

    // 4. Turning & Centripetal Turn Banking
    let deltaAngle = 0;
    if (this.isMoving) {
      const targetAngle = Math.atan2(moveX, moveZ);
      let angleDiff = targetAngle - this.currentFacingAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      deltaAngle = angleDiff * Math.min(1.0, dt * 12);
      this.currentFacingAngle += deltaAngle;
    }
    const turnOmega = dt > 0.0001 ? Math.max(-15.0, Math.min(15.0, deltaAngle / dt)) : 0;
    const targetBank = Math.max(-0.12, Math.min(0.12, -turnOmega * 0.016));
    this.currentBankAngle += (targetBank - this.currentBankAngle) * (1.0 - Math.exp(-8.0 * dt));
    if (Math.abs(this.currentBankAngle) < 1e-6) this.currentBankAngle = 0.0;

    // 5. Braking Squat Sink & Damped Settle Oscillation
    if (this.wasMoving && !this.isMoving) {
      this.settleTimer = 0.0;
    }
    this.wasMoving = this.isMoving;

    if (this.settleTimer >= 0) {
      this.settleTimer += dt;
      const t = this.settleTimer;
      if (t < 0.45) {
        this.settleY = -0.045 * Math.exp(-7.5 * t) * Math.cos(16.0 * t);
        if (Math.abs(this.settleY) < 1e-6) this.settleY = 0.0;
      } else {
        this.settleY = 0;
        this.settleTimer = -1;
      }
    } else {
      this.settleY = 0;
    }

    // 6. Gait Cycle Phase & Deterministic Heel-Strike Triggering
    const walkIntensity = this.currentSpeed > 1e-5 ? Math.min(1.0, this.currentSpeed / this.moveSpeed) : 0.0;
    this.prevWalkCycle = this.walkCycle;
    this.walkCycle += dt * 14.0 * walkIntensity;
    this.elapsedTime += dt;

    const TWO_PI = Math.PI * 2;
    if (walkIntensity > 0.1) {
      // Left heel strike zero-crossing
      if (Math.floor(this.walkCycle / TWO_PI) > Math.floor(this.prevWalkCycle / TWO_PI)) {
        this.onFootstep(true);
      }
      // Right heel strike zero-crossing (offset by PI)
      if (Math.floor((this.walkCycle + Math.PI) / TWO_PI) > Math.floor((this.prevWalkCycle + Math.PI) / TWO_PI)) {
        this.onFootstep(false);
      }
    }

    // 7. Update Footstep Object Pools (Zero Heap Allocations)
    // (a) Dust particle simulation
    let dustActiveCount = 0;
    for (let i = 0; i < World3DPlayer.DUST_POOL_SIZE; i++) {
      if (this.dustActive[i] === 1) {
        this.dustLife[i] -= dt;
        if (this.dustLife[i] <= 0) {
          this.dustActive[i] = 0;
          this.dustPositions[i * 3 + 1] = -999.0;
        } else {
          dustActiveCount++;
          this.dustPositions[i * 3 + 0] += this.dustVx[i] * dt - dx;
          this.dustPositions[i * 3 + 1] += this.dustVy[i] * dt;
          this.dustPositions[i * 3 + 2] += this.dustVz[i] * dt - dz;
          this.dustVy[i] -= 2.2 * dt;
          if (this.dustPositions[i * 3 + 1] < 0.01) {
            this.dustPositions[i * 3 + 1] = 0.01;
          }
        }
      }
    }
    if (dustActiveCount > 0 || this.dustPoints.geometry.attributes.position.needsUpdate) {
      (this.dustPoints.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    // (b) Water ripple simulation
    for (let i = 0; i < World3DPlayer.RIPPLE_POOL_SIZE; i++) {
      if (this.rippleActive[i] === 1) {
        this.rippleLife[i] -= dt;
        if (this.rippleLife[i] <= 0) {
          this.rippleActive[i] = 0;
          this.ripplePool[i].visible = false;
        } else {
          const mesh = this.ripplePool[i];
          mesh.position.x -= dx;
          mesh.position.z -= dz;
          const u = 1.0 - this.rippleLife[i] / 0.5;
          const s = 1.0 + u * 3.5;
          mesh.scale.set(s, s, s);
          (mesh.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1.0 - u);
        }
      }
    }

    // 8. Multi-Joint Leg Kinematics Calculations
    const phiL = this.walkCycle % TWO_PI;
    const phiR = (this.walkCycle + Math.PI) % TWO_PI;

    // Hip pitch: theta_hip = 0.54 * sin(phi)
    const hipPitchL = 0.54 * Math.sin(phiL) * walkIntensity;
    const hipPitchR = 0.54 * Math.sin(phiR) * walkIntensity;
    this.leftThighGroup.rotation.x = hipPitchL;
    this.rightThighGroup.rotation.x = hipPitchR;

    // Knee flexion: swing (50.4 deg) + shock absorption + toe-off
    const sinL = Math.sin(phiL);
    const cosL = Math.cos(phiL);
    const kappaSwingL = 0.88 * Math.pow(Math.max(0, -sinL), 1.35);
    const kappaShockL = 0.22 * Math.max(0, sinL) * Math.max(0, cosL);
    const kappaToeOffL = 0.25 * Math.pow(Math.max(0, -cosL), 2);
    const kappaL = (kappaSwingL + kappaShockL + kappaToeOffL) * walkIntensity;
    this.leftShankGroup.rotation.x = -kappaL;

    const sinR = Math.sin(phiR);
    const cosR = Math.cos(phiR);
    const kappaSwingR = 0.88 * Math.pow(Math.max(0, -sinR), 1.35);
    const kappaShockR = 0.22 * Math.max(0, sinR) * Math.max(0, cosR);
    const kappaToeOffR = 0.25 * Math.pow(Math.max(0, -cosR), 2);
    const kappaR = (kappaSwingR + kappaShockR + kappaToeOffR) * walkIntensity;
    this.rightShankGroup.rotation.x = -kappaR;

    // Ankle pitch: heel-strike dorsiflexion (-14 deg), flat, toe-off plantarflexion (+22 deg)
    const anklePitchL =
      (-0.22 * cosL + 0.16 * Math.sin(2.0 * phiL) + 0.28 * Math.pow(Math.max(0, -cosL), 3)) * walkIntensity;
    const anklePitchR =
      (-0.22 * cosR + 0.16 * Math.sin(2.0 * phiR) + 0.28 * Math.pow(Math.max(0, -cosR), 3)) * walkIntensity;
    this.leftFootGroup.rotation.x = anklePitchL;
    this.rightFootGroup.rotation.x = anklePitchR;

    // 9. Pelvis Dynamics: Lateral Sway, Coronal Roll, Yaw & C2 Harmonic Bounce
    const lateralSway = 0.055 * Math.sin(phiL) * walkIntensity;
    const pelvisRoll = -0.052 * Math.sin(phiL) * walkIntensity;
    const pelvisYaw = 0.08 * Math.cos(phiL) * walkIntensity;
    const verticalBounce = 0.065 * 0.5 * (1.0 - Math.cos(2.0 * phiL)) * walkIntensity;

    this.pelvisGroup.position.x = lateralSway;
    this.pelvisGroup.position.y = verticalBounce;
    this.pelvisGroup.rotation.z = pelvisRoll;
    this.pelvisGroup.rotation.y = pelvisYaw;

    // 10. Torso Counter-Twist & Arm Flexion
    const thoraxYaw = -0.11 * Math.cos(phiL) * walkIntensity;
    const thoraxPitch = 0.025 * Math.sin(2.0 * phiL) * walkIntensity;
    this.thoraxGroup.rotation.y = thoraxYaw;
    this.thoraxGroup.rotation.x = thoraxPitch;

    // Upper arm swing: theta_upperArm = -0.48 * sin(phi)
    const armPitchL = -0.48 * Math.sin(phiL) * walkIntensity;
    const armPitchR = 0.48 * Math.sin(phiL) * walkIntensity;
    this.leftUpperArmGroup.rotation.x = armPitchL;
    this.rightUpperArmGroup.rotation.x = armPitchR;

    // Elbow flexion: 10.3 deg (0.18 rad) relaxing to 34.3 deg (0.60 rad) forward flexion
    const elbowFlexL = 0.18 + 0.42 * Math.max(0, -sinL) * walkIntensity;
    const elbowFlexR = 0.18 + 0.42 * Math.max(0, sinL) * walkIntensity;
    this.leftForearmGroup.rotation.x = elbowFlexL;
    this.rightForearmGroup.rotation.x = elbowFlexR;

    // 11. Secondary Spring-Damper Inertia (Satchel, Canteen, Scarf)
    const satchelPitch = (0.08 * Math.sin(2.0 * phiL - 0.45 * Math.PI) + this.currentAccelPitch * 0.5) * walkIntensity;
    const satchelRoll = 0.06 * Math.sin(phiL - 0.35 * Math.PI) * walkIntensity;
    this.satchelGroup.rotation.x = satchelPitch;
    this.satchelGroup.rotation.z = satchelRoll;

    const canteenRoll = -0.06 * Math.sin(phiL - 0.25 * Math.PI) * walkIntensity;
    const canteenPitch = 0.04 * Math.cos(2.0 * phiL - 0.25 * Math.PI) * walkIntensity;
    this.canteenGroup.rotation.z = canteenRoll;
    this.canteenGroup.rotation.x = canteenPitch;

    const scarfFlutter = Math.sin(this.elapsedTime * 8.0) * 0.06;
    const scarfYawFlutter = Math.sin(this.elapsedTime * 5.5 + 1.2) * 0.08;
    const scarfSpeedLag = walkIntensity > 0 ? -(this.currentSpeed / this.moveSpeed) * 0.45 : 0;
    const scarfRotX = -0.08 + scarfSpeedLag - scarfFlutter;
    this.scarfTailGroup.rotation.x = Math.abs(scarfRotX) < 1e-7 ? 0 : scarfRotX;
    this.scarfTailGroup.rotation.y = Math.abs(scarfYawFlutter) < 1e-7 ? 0 : scarfYawFlutter;

    // 12. Turn Banking, Acceleration Inertia, Settle & Idle Breathing
    this.bodyGroup.rotation.y = this.currentFacingAngle;
    this.bodyGroup.rotation.z = Math.abs(this.currentBankAngle) < 1e-7 ? 0 : this.currentBankAngle;
    this.bodyGroup.rotation.x = Math.abs(this.currentAccelPitch) < 1e-7 ? 0 : this.currentAccelPitch;
    this.bodyGroup.position.y = Math.abs(this.settleY) < 1e-7 ? 0 : this.settleY;

    // Organic idle breathing & curious living gestures when stationary
    const idleWeight = 1.0 - walkIntensity;
    if (idleWeight > 0.01) {
      const chestBreath = Math.sin(this.elapsedTime * 2.2) * 0.012 * idleWeight;
      const headBreath = Math.sin(this.elapsedTime * 2.2 + 0.5) * 0.018 * idleWeight;
      this.thoraxGroup.position.y = Math.abs(chestBreath) < 1e-7 ? 0 : chestBreath;
      this.headGroup.rotation.x = Math.abs(headBreath) < 1e-7 ? 0 : headBreath;

      // Curious idle environment observation scan & subtle weight shift
      const headScan = Math.sin(this.elapsedTime * 0.85) * 0.16 * idleWeight;
      this.headGroup.rotation.y = Math.abs(headScan) < 1e-7 ? 0 : headScan;
      const weightShift = Math.sin(this.elapsedTime * 0.65) * 0.014 * idleWeight;
      this.pelvisGroup.position.x += weightShift;
      this.pelvisGroup.rotation.z += weightShift * 0.8;
    } else {
      this.thoraxGroup.position.y = 0;
      this.headGroup.rotation.x = 0;
      this.headGroup.rotation.y = 0;
    }

    // Dynamic ground shadow scale
    const netVerticalY = this.bodyGroup.position.y + this.pelvisGroup.position.y;
    const shadowScale = Math.max(0.7, Math.min(1.2, 1.0 - netVerticalY * 0.5));
    this.shadowDecal.scale.set(shadowScale, shadowScale, shadowScale);

    // Pulse destination marker if visible
    if (this.destinationMarker.visible && this.targetPosition) {
      this.destinationMarker.position.set(
        this.targetPosition.x - this.root.position.x,
        0.05,
        this.targetPosition.z - this.root.position.z
      );
      const markerScale = 1.0 + Math.sin(this.walkCycle * 2) * 0.12;
      this.destinationMarker.scale.set(markerScale, markerScale, markerScale);
    }
  }

  public dispose() {
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });
    this.ripplePool.length = 0;
  }
}
