import * as THREE from "three";
import { getRiverWaveElevation } from "./World3DEnvironment";
import {
  getBatikFabricTexture,
  getCargoCrateTexture,
  getSoftParticleTexture,
  getSpiceSackTexture,
  getWoodPlankTexture,
  getWovenBambooTexture,
} from "./World3DTextures";

export interface LifeScenesLifecycle {
  update(time: number, delta: number): void;
  dispose(): void;
}

interface WaterRipple {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  active: boolean;
  x: number;
  z: number;
  age: number;
  maxAge: number;
  maxScale: number;
}

export interface Coolie1Rig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  poleRig: THREE.Group;
  bambooPole: THREE.Mesh;
  frontHanger: THREE.Group;
  frontBasket: THREE.Group;
  rearHanger: THREE.Group;
  rearBasket: THREE.Group;
  shadowDecal: THREE.Mesh;
}

export interface Coolie2Rig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  hips: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  crateMesh: THREE.Group;
  shadowDecal: THREE.Mesh;
}

/**
 * World3DLifeScenes: Museum-grade procedural miniature life scenes and micro-ecosystems
 * for Lion City Whispers Milestone 2.
 *
 * Implements:
 * - Feature 8: Five-Foot-Way Tea Guests Miniature Scene (Hop Hing Tea House arcade)
 * - Feature 9: Pier Coolie Cargo Carriers Miniature Scene (Boatman Pier)
 * - Feature 10: Riverbank Wildlife Ecosystem (Egrets & Singapore River Otters)
 *
 * Performance Guarantee:
 * - ZERO runtime heap allocations (no `new THREE.*` or closures) in 60 FPS update loop.
 * - Comprehensive resource cleanup in `dispose()`.
 */
export class World3DLifeScenes implements LifeScenesLifecycle {
  public root = new THREE.Group();

  // Sub-scene root groups
  public teaGuestsScene = new THREE.Group();
  public cooliesScene = new THREE.Group();
  public wildlifeScene = new THREE.Group();

  /* ------------------------------------------------------------------------- */
  /* Feature 8: Tea Guests Rigs & State                                        */
  /* ------------------------------------------------------------------------- */
  private guest1ShoulderPivot!: THREE.Group;
  private guest1ElbowPivot!: THREE.Group;
  private guest1Head!: THREE.Group;
  private guest1Torso!: THREE.Mesh;

  private guest2ShoulderPivot!: THREE.Group;
  private guest2ElbowPivot!: THREE.Group;
  private guest2WristPivot!: THREE.Group;
  private guest2Head!: THREE.Group;

  private steamParticles!: THREE.Points;
  private steamPositions!: Float32Array;
  private steamPhases!: Float32Array;

  /* ------------------------------------------------------------------------- */
  /* Feature 9: Pier Coolies Rigs & State                                      */
  /* ------------------------------------------------------------------------- */
  private coolie1!: Coolie1Rig;
  private coolie2!: Coolie2Rig;

  /* ------------------------------------------------------------------------- */
  /* Feature 10: Wildlife Rigs & State                                         */
  /* ------------------------------------------------------------------------- */
  // Perched Egret
  private perchedEgretGroup!: THREE.Group;
  private perchedEgretHeadPivot!: THREE.Group;
  private perchedEgretLeftWing!: THREE.Group;
  private perchedEgretRightWing!: THREE.Group;

  // Wading Egret
  private wadingEgretGroup!: THREE.Group;
  private wadingEgretNeckPivot!: THREE.Group;
  private wadingEgretHeadPivot!: THREE.Group;
  private wadingEgretFish!: THREE.Mesh;

  // Otters
  private otter1Group!: THREE.Group;
  private otter1BodyPivot!: THREE.Group;
  private otter1HeadPivot!: THREE.Group;
  private otter1TailPivot!: THREE.Group;

  private otter2Group!: THREE.Group;
  private otter2BodyPivot!: THREE.Group;
  private otter2HeadPivot!: THREE.Group;
  private otter2TailPivot!: THREE.Group;

  // Aquatic Ecosystem Extensions (Milestone 3: Koi Fish, Peeking Otter, Dragonflies)
  private koiSchool: Array<{
    root: THREE.Group;
    tailPivot: THREE.Group;
    pectoralLeft: THREE.Mesh;
    pectoralRight: THREE.Mesh;
    phaseOffset: number;
    speed: number;
    orbitRadiusX: number;
    orbitRadiusZ: number;
    centerOffsetX: number;
    centerOffsetZ: number;
    swimDepth: number;
  }> = [];

  private peekingOtterGroup!: THREE.Group;
  private peekingOtterBodyPivot!: THREE.Group;
  private peekingOtterHeadPivot!: THREE.Group;
  private peekingOtterTailPivot!: THREE.Group;

  private dragonflies: Array<{
    root: THREE.Group;
    forewingLeft: THREE.Mesh;
    forewingRight: THREE.Mesh;
    hindwingLeft: THREE.Mesh;
    hindwingRight: THREE.Mesh;
    baseX: number;
    baseZ: number;
    hoverRadius: number;
    phaseOffset: number;
  }> = [];

  private butterflies: Array<{
    root: THREE.Group;
    leftWing: THREE.Mesh;
    rightWing: THREE.Mesh;
    baseX: number;
    baseY: number;
    baseZ: number;
    hoverRadius: number;
    phaseOffset: number;
  }> = [];

  // Pre-allocated Ripple Pool
  private ripplePool: WaterRipple[] = [];
  private nextRippleIndex = 0;
  private lastOtter1RippleTime = 0;

  // Wildlife animation state primitives (0 allocations)
  private nextSaccadeTime = 2.0;
  private saccadeStartTime = 0.0;
  private saccadeDuration = 0.075;
  private currentYaw = 0.0;
  private targetYaw = 0.0;
  private readonly saccadeAngles = [-0.65, -0.30, 0.0, 0.25, 0.60];

  private nextFlutterTime = 6.0;
  private flutterStartTime = 0.0;
  private flutterDuration = 0.42;
  private isFluttering = false;

  constructor() {
    this.root.name = "World3DLifeScenes";
    this.root.add(this.teaGuestsScene);
    this.root.add(this.cooliesScene);
    this.root.add(this.wildlifeScene);

    this.buildTeaGuestsScene();
    this.buildCooliesScene();
    this.buildWildlifeScene();
    this.initRipplePool();
  }

  /* ========================================================================= */
  /* 0.5 Organic Anatomical Torso & Cranium Sculpting Helpers                  */
  /* ========================================================================= */
  private createAnatomicalTorsoGeometry(
    halfWidthX: number,
    halfDepthZ: number,
    height: number,
    waistRatio = 0.84,
    hemFlare = 1.06,
    chestSwell = 0.032,
    pleatAmp = 0.014
  ): THREE.BufferGeometry {
    const radialSegs = 28;
    const heightSegs = 14;
    const geo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let iy = 0; iy <= heightSegs; iy++) {
      const v = iy / heightSegs;
      const y = (v - 0.5) * height;

      let profileX = 1.0;
      let profileZ = 1.0;
      if (v < 0.32) {
        const t = v / 0.32;
        const smooth = t * t * (3 - 2 * t);
        profileX = hemFlare * (1 - smooth) + waistRatio * smooth;
        profileZ = (hemFlare * 0.96) * (1 - smooth) + (waistRatio * 0.94) * smooth;
      } else if (v < 0.86) {
        const t = (v - 0.32) / 0.54;
        const smooth = t * t * (3 - 2 * t);
        profileX = waistRatio * (1 - smooth) + 1.08 * smooth;
        profileZ = (waistRatio * 0.94) * (1 - smooth) + 1.02 * smooth;
      } else {
        const t = (v - 0.86) / 0.14;
        const dome = Math.cos(t * Math.PI * 0.5);
        profileX = 0.38 + 0.70 * dome;
        profileZ = 0.38 + 0.64 * dome;
      }

      for (let ix = 0; ix <= radialSegs; ix++) {
        const u = ix / radialSegs;
        const theta = u * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        const hemWeight = Math.max(0, 1 - v * 1.8);
        const pleat = 1 + pleatAmp * hemWeight * Math.sin(theta * 8);

        const rx = halfWidthX * profileX * pleat;
        const rz = halfDepthZ * profileZ * pleat;

        const vx = cosT * rx;
        let vz = sinT * rz;

        const chestWeight = Math.exp(-Math.pow((v - 0.64) / 0.20, 2));
        if (sinT > 0) {
          vz += sinT * sinT * chestSwell * chestWeight;
        } else {
          vz += sinT * 0.012 * chestWeight;
        }

        positions.push(vx, y, vz);
        uvs.push(u, v);
      }
    }

    const ringStride = radialSegs + 1;
    for (let iy = 0; iy < heightSegs; iy++) {
      for (let ix = 0; ix < radialSegs; ix++) {
        const a = iy * ringStride + ix;
        const b = a + 1;
        const c = (iy + 1) * ringStride + ix;
        const d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    geo.setIndex(indices);
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    return geo;
  }

  private createSculptedHeadGeometry(radius: number): THREE.BufferGeometry {
    const geo = new THREE.SphereGeometry(radius, 24, 20);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let vx = pos.getX(i);
      const vy = pos.getY(i);
      let vz = pos.getZ(i);
      const ny = vy / radius;

      if (ny < 0) {
        const jawTaper = 0.76 + 0.24 * (1 + ny);
        vx *= jawTaper;
        if (vz > 0) {
          vz *= 0.92 + 0.14 * Math.max(0, -ny);
        } else {
          vz *= 0.88;
        }
      } else {
        vx *= 0.92;
      }

      const cheekWeight = Math.exp(-Math.pow(ny + 0.08, 2) * 14) * Math.max(0, vz / radius);
      vx *= 1 + 0.08 * cheekWeight;

      pos.setXYZ(i, vx, vy * 1.06, vz);
    }
    geo.computeVertexNormals();
    return geo;
  }

  /* ========================================================================= */
  /* 1. Feature 8: Five-Foot-Way Tea Guests Scene Setup                        */
  /* ========================================================================= */
  private buildTeaGuestsScene(): void {
    // Positioned under Hop Hing Tea House arcade at World (6.20, 1.20, 14.00)
    this.teaGuestsScene.name = "teaGuestsScene";
    this.teaGuestsScene.position.set(6.20, 1.20, 14.00);

    // Shared Tea Guests Materials
    const teakWoodMat = new THREE.MeshStandardMaterial({
      color: 0x3d2314,
      roughness: 0.78,
      metalness: 0.08
    });
    const brassTrimMat = new THREE.MeshStandardMaterial({
      color: 0xc89b3c,
      roughness: 0.35,
      metalness: 0.82
    });
    const marbleMat = new THREE.MeshStandardMaterial({
      color: 0xedebe6,
      roughness: 0.25,
      metalness: 0.06
    });
    const rattanMat = new THREE.MeshStandardMaterial({
      color: 0xd9c298,
      roughness: 0.85,
      metalness: 0.0
    });
    const celadonMat = new THREE.MeshStandardMaterial({
      color: 0x7da892,
      roughness: 0.18,
      metalness: 0.05
    });
    const porcelainMat = new THREE.MeshStandardMaterial({
      color: 0xf4f0e8,
      roughness: 0.22,
      metalness: 0.02
    });
    const teaLiquidMat = new THREE.MeshStandardMaterial({
      color: 0x8a4b18,
      roughness: 0.10,
      metalness: 0.15
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xd69f72,
      roughness: 0.72,
      metalness: 0.04
    });
    const hairDarkMat = new THREE.MeshStandardMaterial({
      color: 0x221a15,
      roughness: 0.90,
      metalness: 0.0
    });
    const hairSilverMat = new THREE.MeshStandardMaterial({
      color: 0xc4c4c4,
      roughness: 0.85,
      metalness: 0.05
    });
    const linenGuest1Mat = new THREE.MeshStandardMaterial({
      color: 0xe8e4dc,
      roughness: 0.88,
      metalness: 0.0,
      side: THREE.DoubleSide
    });
    const pantsNavyMat = new THREE.MeshStandardMaterial({
      color: 0x2c3848,
      roughness: 0.80,
      metalness: 0.0
    });
    const shirtGuest2Mat = new THREE.MeshStandardMaterial({
      color: 0xf0e6d2,
      roughness: 0.90,
      metalness: 0.0,
      side: THREE.DoubleSide
    });
    const pantsKhakiMat = new THREE.MeshStandardMaterial({
      color: 0x5a5642,
      roughness: 0.82,
      metalness: 0.0
    });
    const slippersMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.95,
      metalness: 0.0
    });
    const mandarinTrimMat = new THREE.MeshStandardMaterial({
      color: 0xd8d2c4,
      roughness: 0.65,
      metalness: 0.04
    });
    const frogButtonMat = new THREE.MeshStandardMaterial({
      color: 0x223040,
      roughness: 0.55,
      metalness: 0.10
    });
    const silkCrimsonMat = new THREE.MeshStandardMaterial({
      color: 0x9e2a2b,
      roughness: 0.50,
      metalness: 0.08
    });
    const batikWaistbandMat = new THREE.MeshStandardMaterial({
      map: getBatikFabricTexture(),
      roughness: 0.78,
      metalness: 0.04
    });
    const facialShadowMat = new THREE.MeshStandardMaterial({
      color: 0xbf855b,
      roughness: 0.85,
      metalness: 0.0
    });

    // 1.1 Kopitiam Marble-Top Pedestal Table
    const tableGroup = new THREE.Group();
    tableGroup.name = "kopitiamTable";

    // Center post
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.09, 0.70, 12),
      teakWoodMat
    );
    post.position.y = 0.35;
    post.castShadow = true;
    tableGroup.add(post);

    // 4 Radiating cabriole tripod/quad legs with brass casters
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.14, 0.28),
        teakWoodMat
      );
      leg.position.set(Math.sin(angle) * 0.14, 0.07, Math.cos(angle) * 0.14);
      leg.rotation.y = angle;
      leg.castShadow = true;
      tableGroup.add(leg);

      const caster = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.026, 0.04, 8),
        brassTrimMat
      );
      caster.position.set(Math.sin(angle) * 0.26, 0.02, Math.cos(angle) * 0.26);
      tableGroup.add(caster);
    }

    // Table apron
    const apron = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.40, 0.04, 24),
      teakWoodMat
    );
    apron.position.y = 0.70;
    tableGroup.add(apron);

    // Carrara marble top
    const marbleTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.035, 24),
      marbleMat
    );
    marbleTop.position.y = 0.73;
    marbleTop.castShadow = true;
    marbleTop.receiveShadow = true;
    tableGroup.add(marbleTop);

    // Bullnose protective brass rim band
    const brassRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.422, 0.012, 8, 32),
      brassTrimMat
    );
    brassRim.rotation.x = Math.PI / 2;
    brassRim.position.y = 0.73;
    tableGroup.add(brassRim);

    this.teaGuestsScene.add(tableGroup);

    // 1.2 Two Teakwood Bentwood Circular Stools with Rattan Tops
    const buildStool = (xPos: number, name: string) => {
      const stool = new THREE.Group();
      stool.name = name;
      stool.position.set(xPos, 0, 0);

      // Seat frame
      const seat = new THREE.Mesh(
        new THREE.CylinderGeometry(0.20, 0.19, 0.04, 16),
        teakWoodMat
      );
      seat.position.y = 0.45;
      seat.castShadow = true;
      seat.receiveShadow = true;
      stool.add(seat);

      // Rattan weave top inlay
      const rattanInlay = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.005, 16),
        rattanMat
      );
      rattanInlay.position.y = 0.472;
      stool.add(rattanInlay);

      // 4 Splayed legs
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2 + Math.PI / 4;
        const splayedLeg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.025, 0.45, 8),
          teakWoodMat
        );
        splayedLeg.position.set(Math.sin(angle) * 0.13, 0.225, Math.cos(angle) * 0.13);
        splayedLeg.rotation.z = Math.sin(angle) * -0.14;
        splayedLeg.rotation.x = Math.cos(angle) * 0.14;
        splayedLeg.castShadow = true;
        stool.add(splayedLeg);
      }

      // Circular footrest rung
      const rung = new THREE.Mesh(
        new THREE.TorusGeometry(0.14, 0.012, 6, 16),
        teakWoodMat
      );
      rung.rotation.x = Math.PI / 2;
      rung.position.y = 0.18;
      stool.add(rung);

      return stool;
    };

    const stool1 = buildStool(-0.65, "stoolGuest1");
    const stool2 = buildStool(0.65, "stoolGuest2");
    this.teaGuestsScene.add(stool1, stool2);

    // 1.3 Celadon Teapot & 14 Steam Particles
    const teapotGroup = new THREE.Group();
    teapotGroup.position.set(0, 0.748, 0);

    const saucer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.13, 0.015, 16),
      celadonMat
    );
    saucer.position.y = 0.008;
    saucer.castShadow = true;
    teapotGroup.add(saucer);

    const teapotBody = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 14, 12),
      celadonMat
    );
    teapotBody.scale.set(1.0, 0.78, 1.0);
    teapotBody.position.y = 0.077;
    teapotBody.castShadow = true;
    teapotGroup.add(teapotBody);

    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.065, 0.02, 12),
      celadonMat
    );
    lid.position.y = 0.147;
    teapotGroup.add(lid);

    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 8, 8),
      celadonMat
    );
    knob.position.y = 0.167;
    teapotGroup.add(knob);

    // Spout angled towards +X
    const spout = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.025, 0.07, 8),
      celadonMat
    );
    spout.position.set(0.08, 0.082, 0);
    spout.rotation.z = -0.70;
    teapotGroup.add(spout);

    // Loop handle
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.045, 0.01, 6, 14),
      celadonMat
    );
    handle.position.set(-0.07, 0.082, 0);
    handle.rotation.z = Math.PI / 2;
    teapotGroup.add(handle);

    this.teaGuestsScene.add(teapotGroup);

    // 14 Rising Translucent Steam Particles
    const steamCount = 14;
    this.steamPositions = new Float32Array(steamCount * 3);
    this.steamPhases = new Float32Array(steamCount);

    const steamGeo = new THREE.BufferGeometry();
    for (let i = 0; i < steamCount; i++) {
      const p = i / steamCount;
      this.steamPhases[i] = p;
      this.steamPositions[i * 3] = 0.08 + Math.sin(p * Math.PI * 2.5) * 0.028 * p;
      this.steamPositions[i * 3 + 1] = 0.83 + p * 0.38;
      this.steamPositions[i * 3 + 2] = Math.cos(p * Math.PI * 2.2) * 0.025 * p;
    }
    steamGeo.setAttribute("position", new THREE.BufferAttribute(this.steamPositions, 3));

    const steamMat = new THREE.PointsMaterial({
      color: 0xffffff,
      map: getSoftParticleTexture(),
      alphaTest: 0.04,
      size: 0.095,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.steamParticles = new THREE.Points(steamGeo, steamMat);
    this.teaGuestsScene.add(this.steamParticles);

    // 1.4 Porcelain Teacups & Kaya Jar
    // Guest 2 cup on table
    const cup2Group = new THREE.Group();
    cup2Group.position.set(0.30, 0.748, 0);
    const cup2Saucer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.06, 0.01, 12),
      porcelainMat
    );
    cup2Saucer.position.y = 0.005;
    cup2Group.add(cup2Saucer);

    const cup2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.03, 0.045, 12),
      porcelainMat
    );
    cup2.position.y = 0.028;
    cup2Group.add(cup2);

    const tea2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.005, 12),
      teaLiquidMat
    );
    tea2.position.y = 0.045;
    cup2Group.add(tea2);
    this.teaGuestsScene.add(cup2Group);

    // Vintage Kaya Jar
    const kayaJar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.035, 0.05, 10),
      celadonMat
    );
    kayaJar.position.set(0.05, 0.773, 0.15);
    this.teaGuestsScene.add(kayaJar);

    // 1.5 Guest 1 Figurine (Sipping Tea Kinematics)
    const guest1Group = new THREE.Group();
    guest1Group.name = "teaGuest1Figurine";
    guest1Group.position.set(-0.65, 0, 0);
    guest1Group.rotation.y = Math.PI / 2; // Facing +X towards table

    // Seated Legs (contoured trousers, spherical knee joints & leather slippers)
    for (const lx of [-0.095, 0.095]) {
      const hipPelvis = new THREE.Mesh(
        new THREE.SphereGeometry(0.062, 16, 14),
        pantsNavyMat
      );
      hipPelvis.position.set(lx, 0.47, 0.05);
      guest1Group.add(hipPelvis);

      // Horizontal contoured thigh capsule
      const thigh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.064, 0.22, 8, 18),
        pantsNavyMat
      );
      thigh.rotation.x = Math.PI / 2 + 0.06;
      thigh.position.set(lx, 0.48, 0.16);
      thigh.castShadow = true;
      guest1Group.add(thigh);

      // Rounded knee articulation cap
      const kneeCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.062, 14, 12),
        pantsNavyMat
      );
      kneeCap.position.set(lx, 0.46, 0.30);
      guest1Group.add(kneeCap);

      // Tapered vertical calf/shin
      const shin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.060, 0.048, 0.38, 18),
        pantsNavyMat
      );
      shin.position.set(lx, 0.25, 0.31);
      shin.castShadow = true;
      guest1Group.add(shin);

      // Trouser hem cuff
      const trouserCuff = new THREE.Mesh(
        new THREE.TorusGeometry(0.050, 0.012, 8, 18),
        pantsNavyMat
      );
      trouserCuff.rotation.x = Math.PI / 2;
      trouserCuff.position.set(lx, 0.07, 0.31);
      guest1Group.add(trouserCuff);

      // Sculpted Nanyang slipper with rounded toe
      const slipper = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.042, 0.09, 8, 14),
        slippersMat
      );
      slipper.rotation.x = Math.PI / 2;
      slipper.scale.set(1.15, 1.0, 0.68);
      slipper.position.set(lx, 0.032, 0.35);
      guest1Group.add(slipper);
    }

    // Anatomically Contoured Torso with Mandarin Collar & Knotted Frog Buttons (盘扣)
    this.guest1Torso = new THREE.Mesh(
      this.createAnatomicalTorsoGeometry(0.215, 0.142, 0.66, 0.84, 1.08, 0.032, 0.012),
      linenGuest1Mat
    );
    this.guest1Torso.position.y = 0.80;
    this.guest1Torso.castShadow = true;
    guest1Group.add(this.guest1Torso);

    // Rounded Deltoid Shoulder Caps tucked cleanly into broad shoulder contour
    for (const sx of [-0.165, 0.165]) {
      const deltoidCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.056, 16, 14),
        linenGuest1Mat
      );
      deltoidCap.position.set(sx, 0.21, 0.0);
      deltoidCap.scale.set(0.88, 0.68, 0.85);
      this.guest1Torso.add(deltoidCap);
    }

    // Stand-up Mandarin Collar (立领) with Silk Piping
    const mandarinCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.082, 0.094, 0.058, 22, 1, true),
      linenGuest1Mat
    );
    mandarinCollar.position.y = 0.33;
    this.guest1Torso.add(mandarinCollar);

    const collarPiping = new THREE.Mesh(
      new THREE.TorusGeometry(0.084, 0.009, 8, 22),
      mandarinTrimMat
    );
    collarPiping.rotation.x = Math.PI / 2;
    collarPiping.position.y = 0.355;
    this.guest1Torso.add(collarPiping);

    // Front Placket Overlap Strip (门襟)
    const placketStrip = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.44, 0.014),
      linenGuest1Mat
    );
    placketStrip.position.set(0, 0.04, 0.162);
    this.guest1Torso.add(placketStrip);

    // 3 Knotted Cloth Frog Buttons (盘扣)
    for (const by of [0.22, 0.08, -0.06]) {
      const loopL = new THREE.Mesh(
        new THREE.BoxGeometry(0.042, 0.012, 0.012),
        frogButtonMat
      );
      loopL.position.set(-0.028, by, 0.168);
      this.guest1Torso.add(loopL);

      const loopR = new THREE.Mesh(
        new THREE.BoxGeometry(0.042, 0.012, 0.012),
        frogButtonMat
      );
      loopR.position.set(0.028, by, 0.168);
      this.guest1Torso.add(loopR);

      const knotCenter = new THREE.Mesh(
        new THREE.SphereGeometry(0.014, 10, 10),
        frogButtonMat
      );
      knotCenter.position.set(0, by, 0.175);
      this.guest1Torso.add(knotCenter);
    }

    // Head group with sculpted cranium & facial contours
    this.guest1Head = new THREE.Group();
    this.guest1Head.position.set(0, 1.15, 0);
    guest1Group.add(this.guest1Head);

    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.062, 0.074, 0.13, 18),
      skinMat
    );
    neck.position.y = 0.055;
    this.guest1Head.add(neck);

    const headMesh = new THREE.Mesh(
      this.createSculptedHeadGeometry(0.158),
      skinMat
    );
    headMesh.position.y = 0.20;
    headMesh.castShadow = true;
    this.guest1Head.add(headMesh);

    // Brow ridge bar
    const browRidge1 = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.014, 0.085, 6, 12),
      skinMat
    );
    browRidge1.rotation.z = Math.PI / 2;
    browRidge1.position.set(0, 0.232, 0.138);
    this.guest1Head.add(browRidge1);

    // Dark eyebrows
    for (const bx of [-0.042, 0.042]) {
      const brow = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.006, 0.032, 4, 8),
        hairDarkMat
      );
      brow.position.set(bx, 0.242, 0.148);
      brow.rotation.z = Math.PI / 2 + (bx > 0 ? -0.12 : 0.12);
      this.guest1Head.add(brow);
    }

    // Almond eye sockets
    for (const ex of [-0.044, 0.044]) {
      const eyeSocket = new THREE.Mesh(
        new THREE.SphereGeometry(0.014, 10, 10),
        facialShadowMat
      );
      eyeSocket.scale.set(1.2, 0.65, 0.6);
      eyeSocket.position.set(ex, 0.205, 0.142);
      this.guest1Head.add(eyeSocket);
    }

    // Sculpted nose bridge & rounded tip
    const nose1 = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.015, 0.042, 6, 12),
      skinMat
    );
    nose1.position.set(0, 0.182, 0.155);
    nose1.rotation.x = -0.18;
    this.guest1Head.add(nose1);

    // Mouth / lip contour
    const mouth1 = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.007, 0.030, 4, 8),
      facialShadowMat
    );
    mouth1.rotation.z = Math.PI / 2;
    mouth1.position.set(0, 0.125, 0.142);
    this.guest1Head.add(mouth1);

    // Chin pad
    const chin1 = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 12, 12),
      skinMat
    );
    chin1.position.set(0, 0.082, 0.126);
    this.guest1Head.add(chin1);

    // Ear lobes
    for (const ex of [-0.145, 0.145]) {
      const ear = new THREE.Mesh(
        new THREE.TorusGeometry(0.028, 0.011, 8, 12, Math.PI * 1.25),
        skinMat
      );
      ear.position.set(ex, 0.19, -0.01);
      ear.rotation.set(0, ex > 0 ? Math.PI / 2 : -Math.PI / 2, -0.2);
      this.guest1Head.add(ear);
    }

    // Sculpted Nanyang side-parted hair cap
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.162, 22, 18),
      hairDarkMat
    );
    hair.scale.set(0.95, 0.96, 1.02);
    hair.position.set(0, 0.235, -0.018);
    this.guest1Head.add(hair);

    // Left arm resting naturally forward with seamless elbow joint, rolled cuff & hand on thigh
    const leftArmUpper = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.048, 0.22, 8, 18),
      linenGuest1Mat
    );
    leftArmUpper.position.set(-0.175, 0.94, 0.08);
    leftArmUpper.rotation.x = -0.58;
    leftArmUpper.castShadow = true;
    guest1Group.add(leftArmUpper);

    const leftArmCuff = new THREE.Mesh(
      new THREE.TorusGeometry(0.048, 0.014, 8, 18),
      linenGuest1Mat
    );
    leftArmCuff.position.set(-0.175, 0.81, 0.16);
    leftArmCuff.rotation.x = Math.PI / 2 - 0.58;
    guest1Group.add(leftArmCuff);

    const leftArmForearm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.039, 0.17, 8, 16),
      skinMat
    );
    leftArmForearm.position.set(-0.15, 0.67, 0.22);
    leftArmForearm.rotation.set(-0.82, 0, -0.14);
    leftArmForearm.castShadow = true;
    guest1Group.add(leftArmForearm);

    // Articulated resting left hand on left navy thigh
    const handLGroup = new THREE.Group();
    handLGroup.position.set(-0.12, 0.55, 0.26);
    const palmL = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.022, 0.034, 6, 12),
      skinMat
    );
    palmL.rotation.x = Math.PI / 2;
    palmL.scale.set(1.25, 1.0, 0.65);
    handLGroup.add(palmL);

    const thumbL = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.008, 0.024, 4, 8),
      skinMat
    );
    thumbL.position.set(0.028, 0.008, 0.01);
    thumbL.rotation.set(0.1, -0.3, -0.4);
    handLGroup.add(thumbL);

    const fingersL = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.016, 0.026, 6, 10),
      skinMat
    );
    fingersL.rotation.x = Math.PI / 2;
    fingersL.scale.set(1.3, 1.0, 0.55);
    fingersL.position.set(-0.004, -0.008, 0.030);
    handLGroup.add(fingersL);
    guest1Group.add(handLGroup);

    // Right Arm: 2-bone Sipping Kinematics Hierarchy (Smooth Capsule Limbs + Elbow Joint)
    this.guest1ShoulderPivot = new THREE.Group();
    this.guest1ShoulderPivot.position.set(0.175, 1.01, 0.0);
    guest1Group.add(this.guest1ShoulderPivot);

    const upperArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.048, 0.22, 8, 18),
      linenGuest1Mat
    );
    upperArm.position.y = -0.14;
    upperArm.castShadow = true;
    this.guest1ShoulderPivot.add(upperArm);

    // Rolled sleeve cuff at elbow
    const rightArmCuff = new THREE.Mesh(
      new THREE.TorusGeometry(0.052, 0.015, 8, 18),
      linenGuest1Mat
    );
    rightArmCuff.rotation.x = Math.PI / 2;
    rightArmCuff.position.set(0, -0.26, 0);
    this.guest1ShoulderPivot.add(rightArmCuff);

    this.guest1ElbowPivot = new THREE.Group();
    this.guest1ElbowPivot.position.set(0, -0.28, 0.0);
    this.guest1ShoulderPivot.add(this.guest1ElbowPivot);

    const elbowBall1 = new THREE.Mesh(
      new THREE.SphereGeometry(0.044, 14, 12),
      skinMat
    );
    this.guest1ElbowPivot.add(elbowBall1);

    const forearm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.038, 0.18, 8, 16),
      skinMat
    );
    forearm.position.set(0, -0.12, 0.03);
    forearm.rotation.x = -0.22;
    forearm.castShadow = true;
    this.guest1ElbowPivot.add(forearm);

    // Articulated Right Hand with traditional "三龙戏珠" grip holding teacup
    const handRGroup = new THREE.Group();
    handRGroup.position.set(0, -0.24, 0.07);

    const palmR = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.032, 0.055),
      skinMat
    );
    handRGroup.add(palmR);

    // Opposing thumb pinching outer cup rim
    const thumbR = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.011, 0.028, 6),
      skinMat
    );
    thumbR.position.set(0.032, 0.010, 0.025);
    thumbR.rotation.set(0.3, 0.2, -0.4);
    handRGroup.add(thumbR);

    const thumbPadR = new THREE.Mesh(
      new THREE.SphereGeometry(0.010, 6, 6),
      skinMat
    );
    thumbPadR.position.set(0.036, 0.012, 0.032);
    handRGroup.add(thumbPadR);

    // Index finger curved around cup wall
    const indexFingerR = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.009, 0.032, 6),
      skinMat
    );
    indexFingerR.position.set(-0.015, 0.008, 0.045);
    indexFingerR.rotation.set(0.6, 0, 0.2);
    handRGroup.add(indexFingerR);

    // Middle finger supporting cup footring from below ("三龙戏珠")
    const middleFingerR = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.009, 0.040, 6),
      skinMat
    );
    middleFingerR.position.set(0.005, -0.025, 0.030);
    middleFingerR.rotation.set(0.2, 0, 0);
    handRGroup.add(middleFingerR);

    // Ring and pinky fingers in graceful flexion
    for (let f = 0; f < 2; f++) {
      const finger = new THREE.Mesh(
        new THREE.CylinderGeometry(0.007, 0.008, 0.032, 6),
        skinMat
      );
      finger.position.set(-0.018 - f * 0.012, -0.018, 0.020);
      finger.rotation.set(1.0, 0, -0.2);
      handRGroup.add(finger);
    }
    this.guest1ElbowPivot.add(handRGroup);

    // Teacup held in hand
    const heldCup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.028, 0.042, 10),
      porcelainMat
    );
    heldCup.position.set(0, -0.24, 0.10);
    this.guest1ElbowPivot.add(heldCup);

    const heldTeaDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.005, 10),
      teaLiquidMat
    );
    heldTeaDisc.position.set(0, -0.225, 0.10);
    this.guest1ElbowPivot.add(heldTeaDisc);

    this.teaGuestsScene.add(guest1Group);

    // 1.6 Guest 2 Figurine (Elderly Companion Waving Rattan Fan)
    const guest2Group = new THREE.Group();
    guest2Group.name = "teaGuest2Figurine";
    guest2Group.position.set(0.65, 0, 0);
    guest2Group.rotation.y = -Math.PI / 2; // Facing -X towards table

    // Seated Legs (contoured khaki trousers, spherical knee joints & slippers)
    for (const lx of [-0.095, 0.095]) {
      const hipPelvis2 = new THREE.Mesh(
        new THREE.SphereGeometry(0.062, 16, 14),
        pantsKhakiMat
      );
      hipPelvis2.position.set(lx, 0.47, 0.05);
      guest2Group.add(hipPelvis2);

      const thigh = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.064, 0.22, 8, 18),
        pantsKhakiMat
      );
      thigh.rotation.x = Math.PI / 2 + 0.06;
      thigh.position.set(lx, 0.48, 0.16);
      thigh.castShadow = true;
      guest2Group.add(thigh);

      const kneeCap2 = new THREE.Mesh(
        new THREE.SphereGeometry(0.062, 14, 12),
        pantsKhakiMat
      );
      kneeCap2.position.set(lx, 0.46, 0.30);
      guest2Group.add(kneeCap2);

      const shin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.060, 0.048, 0.38, 18),
        pantsKhakiMat
      );
      shin.position.set(lx, 0.25, 0.31);
      shin.castShadow = true;
      guest2Group.add(shin);

      const trouserCuff2 = new THREE.Mesh(
        new THREE.TorusGeometry(0.050, 0.012, 8, 18),
        pantsKhakiMat
      );
      trouserCuff2.rotation.x = Math.PI / 2;
      trouserCuff2.position.set(lx, 0.07, 0.31);
      guest2Group.add(trouserCuff2);

      const slipper = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.042, 0.09, 8, 14),
        slippersMat
      );
      slipper.rotation.x = Math.PI / 2;
      slipper.scale.set(1.15, 1.0, 0.68);
      slipper.position.set(lx, 0.032, 0.35);
      guest2Group.add(slipper);
    }

    // Contoured Nanyang Batik Floral Waistband Ring (bengkung) & Sash matching anatomical waist
    const batikWaistband = new THREE.Mesh(
      new THREE.CylinderGeometry(0.180, 0.192, 0.105, 24),
      batikWaistbandMat
    );
    batikWaistband.scale.set(1.0, 1.0, 0.72);
    batikWaistband.position.set(0, 0.55, -0.025);
    guest2Group.add(batikWaistband);

    const sashKnot2 = new THREE.Mesh(
      new THREE.SphereGeometry(0.036, 12, 12),
      batikWaistbandMat
    );
    sashKnot2.position.set(0.145, 0.55, 0.115);
    guest2Group.add(sashKnot2);

    const sashTailOuter = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.024, 0.15, 6, 12),
      batikWaistbandMat
    );
    sashTailOuter.scale.set(1.10, 1.0, 0.36);
    sashTailOuter.position.set(0.148, 0.44, 0.128);
    sashTailOuter.rotation.z = -0.10;
    guest2Group.add(sashTailOuter);

    const sashTailInner = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.021, 0.11, 6, 12),
      batikWaistbandMat
    );
    sashTailInner.scale.set(1.10, 1.0, 0.36);
    sashTailInner.position.set(0.130, 0.45, 0.136);
    sashTailInner.rotation.z = 0.06;
    guest2Group.add(sashTailInner);

    // Anatomically Contoured Torso with slight relaxed recline & breast pocket
    const guest2Torso = new THREE.Mesh(
      this.createAnatomicalTorsoGeometry(0.22, 0.145, 0.66, 0.85, 1.08, 0.034, 0.012),
      shirtGuest2Mat
    );
    guest2Torso.position.set(0, 0.80, -0.03);
    guest2Torso.rotation.x = 0.05;
    guest2Torso.castShadow = true;
    guest2Group.add(guest2Torso);

    // Rounded Deltoid Shoulder Caps tucked cleanly into shoulder line
    for (const sx of [-0.168, 0.168]) {
      const deltoidCap2 = new THREE.Mesh(
        new THREE.SphereGeometry(0.056, 16, 14),
        shirtGuest2Mat
      );
      deltoidCap2.position.set(sx, 0.21, 0.0);
      deltoidCap2.scale.set(0.88, 0.68, 0.85);
      guest2Torso.add(deltoidCap2);
    }

    // Open-necked Nanyang linen collar ring
    const collar2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.082, 0.016, 10, 22),
      shirtGuest2Mat
    );
    collar2.rotation.x = Math.PI / 2;
    collar2.position.set(0, 0.31, 0.0);
    guest2Torso.add(collar2);

    // Breast patch pocket on left chest
    const pocketPatch = new THREE.Mesh(
      new THREE.BoxGeometry(0.068, 0.078, 0.014),
      shirtGuest2Mat
    );
    pocketPatch.position.set(-0.095, 0.12, 0.158);
    guest2Torso.add(pocketPatch);

    const pocketWelt = new THREE.Mesh(
      new THREE.BoxGeometry(0.072, 0.014, 0.018),
      shirtGuest2Mat
    );
    pocketWelt.position.set(-0.095, 0.162, 0.162);
    guest2Torso.add(pocketWelt);

    const pocketSquare = new THREE.Mesh(
      new THREE.ConeGeometry(0.020, 0.034, 4),
      silkCrimsonMat
    );
    pocketSquare.position.set(-0.095, 0.178, 0.162);
    pocketSquare.rotation.z = 0.2;
    guest2Torso.add(pocketSquare);

    // Head group with sculpted aged facial contours
    this.guest2Head = new THREE.Group();
    this.guest2Head.position.set(0, 1.15, -0.01);
    guest2Group.add(this.guest2Head);

    const neck2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.062, 0.074, 0.13, 18),
      skinMat
    );
    neck2.position.y = 0.055;
    this.guest2Head.add(neck2);

    const headMesh2 = new THREE.Mesh(
      this.createSculptedHeadGeometry(0.158),
      skinMat
    );
    headMesh2.position.y = 0.20;
    headMesh2.castShadow = true;
    this.guest2Head.add(headMesh2);

    // Aged brow ridge
    const browRidge2 = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.015, 0.088, 6, 12),
      skinMat
    );
    browRidge2.rotation.z = Math.PI / 2;
    browRidge2.position.set(0, 0.232, 0.138);
    this.guest2Head.add(browRidge2);

    // Bushy silver eyebrows
    for (const bx of [-0.044, 0.044]) {
      const silverBrow = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.008, 0.034, 4, 8),
        hairSilverMat
      );
      silverBrow.position.set(bx, 0.244, 0.148);
      silverBrow.rotation.z = Math.PI / 2 + (bx > 0 ? -0.15 : 0.15);
      this.guest2Head.add(silverBrow);
    }

    // High aquiline nose bridge supporting spectacles
    const nose2 = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.016, 0.045, 6, 12),
      skinMat
    );
    nose2.position.set(0, 0.180, 0.156);
    nose2.rotation.x = -0.18;
    this.guest2Head.add(nose2);

    // Nasolabial laugh lines
    for (const lx of [-0.032, 0.032]) {
      const laughLine = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.005, 0.032, 4, 8),
        facialShadowMat
      );
      laughLine.position.set(lx, 0.140, 0.142);
      laughLine.rotation.z = lx > 0 ? -0.25 : 0.25;
      this.guest2Head.add(laughLine);
    }

    // Mouth slit & silver goatee beard
    const mouth2 = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.006, 0.028, 4, 8),
      facialShadowMat
    );
    mouth2.rotation.z = Math.PI / 2;
    mouth2.position.set(0, 0.118, 0.138);
    this.guest2Head.add(mouth2);

    const goatee = new THREE.Mesh(
      new THREE.ConeGeometry(0.038, 0.072, 12),
      hairSilverMat
    );
    goatee.position.set(0, 0.062, 0.134);
    goatee.rotation.x = Math.PI - 0.25;
    this.guest2Head.add(goatee);

    // Sculpted ears with temple arm rest
    for (const ex of [-0.145, 0.145]) {
      const ear = new THREE.Mesh(
        new THREE.TorusGeometry(0.028, 0.011, 8, 12, Math.PI * 1.25),
        skinMat
      );
      ear.position.set(ex, 0.19, -0.01);
      ear.rotation.set(0, ex > 0 ? Math.PI / 2 : -Math.PI / 2, -0.15);
      this.guest2Head.add(ear);
    }

    const silverHair = new THREE.Mesh(
      new THREE.SphereGeometry(0.162, 22, 18),
      hairSilverMat
    );
    silverHair.scale.set(0.95, 0.96, 1.02);
    silverHair.position.set(0, 0.235, -0.018);
    this.guest2Head.add(silverHair);

    // Brass spectacles (Rims, Bridge & Temple Arms anchored on ears)
    for (const ex of [-0.048, 0.048]) {
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.032, 0.005, 8, 16),
        brassTrimMat
      );
      rim.position.set(ex, 0.208, 0.145);
      this.guest2Head.add(rim);
    }
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.034, 0.005, 0.005),
      brassTrimMat
    );
    bridge.position.set(0, 0.208, 0.152);
    this.guest2Head.add(bridge);

    for (const tx of [-0.118, 0.118]) {
      const templeArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.006, 0.006, 0.16),
        brassTrimMat
      );
      templeArm.position.set(tx, 0.208, 0.068);
      this.guest2Head.add(templeArm);
    }

    // Left arm resting comfortably on table edge with smooth capsule segments & hand
    const leftArm2Upper = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.048, 0.22, 8, 18),
      shirtGuest2Mat
    );
    leftArm2Upper.position.set(-0.175, 0.94, 0.09);
    leftArm2Upper.rotation.x = -0.58;
    leftArm2Upper.castShadow = true;
    guest2Group.add(leftArm2Upper);

    const leftArm2Cuff = new THREE.Mesh(
      new THREE.TorusGeometry(0.048, 0.014, 8, 18),
      shirtGuest2Mat
    );
    leftArm2Cuff.position.set(-0.175, 0.81, 0.17);
    leftArm2Cuff.rotation.x = Math.PI / 2 - 0.58;
    guest2Group.add(leftArm2Cuff);

    const leftArm2Forearm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.039, 0.18, 8, 16),
      skinMat
    );
    leftArm2Forearm.position.set(-0.155, 0.75, 0.25);
    leftArm2Forearm.rotation.x = -1.15;
    leftArm2Forearm.castShadow = true;
    guest2Group.add(leftArm2Forearm);

    // Articulated hand resting on Carrara marble table edge
    const handL2Group = new THREE.Group();
    handL2Group.position.set(-0.15, 0.745, 0.32);
    const palmL2 = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.022, 0.034, 6, 12),
      skinMat
    );
    palmL2.rotation.x = Math.PI / 2;
    palmL2.scale.set(1.25, 1.0, 0.65);
    handL2Group.add(palmL2);

    const fingersL2 = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.016, 0.026, 6, 10),
      skinMat
    );
    fingersL2.rotation.x = Math.PI / 2;
    fingersL2.scale.set(1.3, 1.0, 0.55);
    fingersL2.position.set(-0.005, -0.008, 0.032);
    handL2Group.add(fingersL2);
    guest2Group.add(handL2Group);

    // Right Arm: 3-bone Fan Waving Kinematics Hierarchy (Smooth Capsule Limbs + Elbow Ball Joint)
    this.guest2ShoulderPivot = new THREE.Group();
    this.guest2ShoulderPivot.position.set(0.175, 1.01, 0.0);
    guest2Group.add(this.guest2ShoulderPivot);

    const fanUpperArm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.048, 0.20, 8, 18),
      shirtGuest2Mat
    );
    fanUpperArm.position.y = -0.14;
    fanUpperArm.castShadow = true;
    this.guest2ShoulderPivot.add(fanUpperArm);

    // Rolled cuff on right arm
    const fanArmCuff = new THREE.Mesh(
      new THREE.TorusGeometry(0.052, 0.015, 8, 18),
      shirtGuest2Mat
    );
    fanArmCuff.rotation.x = Math.PI / 2;
    fanArmCuff.position.set(0, -0.25, 0);
    this.guest2ShoulderPivot.add(fanArmCuff);

    this.guest2ElbowPivot = new THREE.Group();
    this.guest2ElbowPivot.position.set(0, -0.27, 0.02);
    this.guest2ShoulderPivot.add(this.guest2ElbowPivot);

    const elbowBall2 = new THREE.Mesh(
      new THREE.SphereGeometry(0.044, 14, 12),
      skinMat
    );
    this.guest2ElbowPivot.add(elbowBall2);

    const fanForearm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.038, 0.18, 8, 16),
      skinMat
    );
    fanForearm.position.y = -0.12;
    fanForearm.castShadow = true;
    this.guest2ElbowPivot.add(fanForearm);

    this.guest2WristPivot = new THREE.Group();
    this.guest2WristPivot.position.set(0, -0.24, 0.08);
    this.guest2ElbowPivot.add(this.guest2WristPivot);

    // Articulated Hand wrapping tightly around teak fan handle
    const fanHandGroup = new THREE.Group();

    const wristJoint = new THREE.Mesh(
      new THREE.CylinderGeometry(0.034, 0.036, 0.05, 8),
      skinMat
    );
    wristJoint.position.set(0, 0.015, 0);
    fanHandGroup.add(wristJoint);

    const palmBlock = new THREE.Mesh(
      new THREE.BoxGeometry(0.052, 0.038, 0.058),
      skinMat
    );
    palmBlock.position.set(0, 0.055, 0.010);
    fanHandGroup.add(palmBlock);

    const thumbFan = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.010, 0.042, 6),
      skinMat
    );
    thumbFan.position.set(0.028, 0.050, 0.022);
    thumbFan.rotation.set(0.4, 0.2, -0.7);
    fanHandGroup.add(thumbFan);

    const knuckleBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, 0.040, 0.025),
      skinMat
    );
    knuckleBox.position.set(-0.010, 0.055, 0.025);
    fanHandGroup.add(knuckleBox);

    const fingerTips = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.008, 0.042, 6),
      skinMat
    );
    fingerTips.position.set(-0.015, 0.055, -0.015);
    fingerTips.rotation.x = Math.PI / 2;
    fanHandGroup.add(fingerTips);

    this.guest2WristPivot.add(fanHandGroup);

    // Traditional Rattan Fan passing through hand
    const fanHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.012, 0.18, 8),
      teakWoodMat
    );
    fanHandle.position.y = 0.06;
    this.guest2WristPivot.add(fanHandle);

    const fanFinial = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 6, 6),
      teakWoodMat
    );
    fanFinial.position.set(0, -0.03, 0);
    this.guest2WristPivot.add(fanFinial);

    // Rounded Woven Palm-Leaf Fan (蒲扇) in the XY plane with coplanar Crimson Silk Edge Trim
    const fanBlade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105, 0.105, 0.010, 22),
      rattanMat
    );
    fanBlade.rotation.x = Math.PI / 2;
    fanBlade.scale.set(1.0, 1.0, 1.12);
    fanBlade.position.y = 0.21;
    this.guest2WristPivot.add(fanBlade);

    // Central split-bamboo spine rib
    const fanSpine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.006, 0.21, 6),
      teakWoodMat
    );
    fanSpine.position.set(0, 0.20, 0.006);
    this.guest2WristPivot.add(fanSpine);

    // Coplanar crimson silk trim ring around the palm-leaf blade (lies in XY plane, NO rotation.x = Math.PI / 2)
    const fanRedTrim = new THREE.Mesh(
      new THREE.TorusGeometry(0.105, 0.007, 8, 24),
      silkCrimsonMat
    );
    fanRedTrim.scale.set(1.0, 1.12, 1.0);
    fanRedTrim.position.y = 0.21;
    this.guest2WristPivot.add(fanRedTrim);

    this.teaGuestsScene.add(guest2Group);
  }

  /* ========================================================================= */
  /* 2. Feature 9: Pier Coolie Cargo Carriers Setup                            */
  /* ========================================================================= */
  private buildCooliesScene(): void {
    this.cooliesScene.name = "cooliesScene";

    const skinTannedMat = new THREE.MeshStandardMaterial({
      color: 0xb87b4f,
      roughness: 0.72,
      metalness: 0.05
    });
    const bambooHatMat = new THREE.MeshStandardMaterial({
      map: getWovenBambooTexture(),
      color: 0xd4a742,
      roughness: 0.75,
      metalness: 0.02,
      side: THREE.DoubleSide
    });
    const bambooPeakMat = new THREE.MeshStandardMaterial({
      color: 0x9e7630,
      roughness: 0.80,
      metalness: 0.0
    });
    const bambooInnerRibMat = new THREE.MeshStandardMaterial({
      color: 0x8a6328,
      roughness: 0.85,
      metalness: 0.0
    });
    const indigoVestMat = new THREE.MeshStandardMaterial({
      color: 0x2f4868,
      roughness: 0.84,
      metalness: 0.04,
      side: THREE.DoubleSide
    });
    const rolledTrousersMat = new THREE.MeshStandardMaterial({
      color: 0x3a3028,
      roughness: 0.85,
      metalness: 0.0
    });
    const sweatTowelMat = new THREE.MeshStandardMaterial({
      color: 0xeee8d5,
      roughness: 0.95,
      metalness: 0.0
    });
    const bambooPoleMat = new THREE.MeshStandardMaterial({
      color: 0xd4a742,
      roughness: 0.58,
      metalness: 0.08
    });
    const rattanBasketMat = new THREE.MeshStandardMaterial({
      color: 0x7a5b32,
      roughness: 0.85,
      metalness: 0.0
    });
    const juteSackMat = new THREE.MeshStandardMaterial({
      map: getSpiceSackTexture("源發號 · 特選肉桂"),
      roughness: 0.95,
      metalness: 0.0
    });
    const hempRopeMat = new THREE.MeshStandardMaterial({
      color: 0x8c7352,
      roughness: 0.90,
      metalness: 0.0
    });
    const ironCornerMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.40,
      metalness: 0.85
    });
    const woodenCrateMat = new THREE.MeshStandardMaterial({
      map: getCargoCrateTexture("spices"),
      roughness: 0.85,
      metalness: 0.05
    });
    const woodSandalMat = new THREE.MeshStandardMaterial({
      color: 0x5c4228,
      roughness: 0.80,
      metalness: 0.0
    });
    const facialAccentMat = new THREE.MeshStandardMaterial({
      color: 0x9a5e35,
      roughness: 0.80,
      metalness: 0.02
    });
    const redHeadbandMat = new THREE.MeshStandardMaterial({
      color: 0xa33226,
      roughness: 0.78,
      metalness: 0.02
    });
    const shadowDecalMat = new THREE.MeshBasicMaterial({
      color: 0x050807,
      transparent: true,
      opacity: 0.42
    });

    // Reusable Artisan Bamboo Hat Generator with Inner Ribs & Head-Ring
    const createArtisanBambooHat = (isTilted = false) => {
      const hatGroup = new THREE.Group();

      // Open-ended woven bamboo cone brim
      const brim = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.22, 20, 1, true), bambooHatMat);
      brim.castShadow = true;
      brim.receiveShadow = true;
      hatGroup.add(brim);

      // Woven peak cone
      const peak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.14, 10), bambooPeakMat);
      peak.position.set(0, 0.16, 0);
      peak.castShadow = true;
      hatGroup.add(peak);

      // Bamboo apex knot ring
      const apexRing = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.007, 6, 12), bambooPeakMat);
      apexRing.rotation.x = Math.PI / 2;
      apexRing.position.set(0, 0.23, 0);
      hatGroup.add(apexRing);

      // Underside Inner Head-Ring (crown hoop resting securely atop head)
      const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.016, 8, 18), bambooInnerRibMat);
      innerRing.rotation.x = Math.PI / 2;
      innerRing.position.set(0, -0.04, 0);
      hatGroup.add(innerRing);

      // Secondary mid-cone stabilizer hoop
      const midRing = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.010, 6, 18), bambooInnerRibMat);
      midRing.rotation.x = Math.PI / 2;
      midRing.position.set(0, 0.01, 0);
      hatGroup.add(midRing);

      // 8 Radial Split-Bamboo Ribs along cone slope
      const slopeAngle = Math.PI / 2 - 0.38;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.44, 4), bambooInnerRibMat);
        const midR = 0.26;
        rib.position.set(Math.cos(angle) * midR, -0.01, Math.sin(angle) * midR);
        rib.rotation.y = -angle;
        rib.rotation.z = slopeAngle;
        hatGroup.add(rib);
      }

      // Hemp rope chin strap
      const chinStrap = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 6, 14, Math.PI * 1.1), hempRopeMat);
      chinStrap.rotation.x = Math.PI / 2;
      chinStrap.position.set(0, isTilted ? -0.12 : -0.16, isTilted ? 0.02 : 0.04);
      hatGroup.add(chinStrap);

      return hatGroup;
    };

    // 2.1 Coolie 1 (Shoulder Pole Carrier - Kandar Rig)
    const c1Root = new THREE.Group();
    c1Root.name = "coolie1KandarCarrier";
    c1Root.position.set(1.05, 0.775, -1.20);

    const shadowDecal1 = new THREE.Mesh(new THREE.CircleGeometry(0.52, 16), shadowDecalMat);
    shadowDecal1.rotation.x = -Math.PI / 2;
    shadowDecal1.position.y = 0.02;
    c1Root.add(shadowDecal1);

    const bodyGroup1 = new THREE.Group();
    c1Root.add(bodyGroup1);

    const createCoolie1Leg = (xOffset: number) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(xOffset, 0.65, 0);

      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.22, 8, 18), rolledTrousersMat);
      thigh.position.y = -0.18;
      thigh.castShadow = true;
      legGroup.add(thigh);

      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.022, 8, 18), rolledTrousersMat);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = -0.35;
      legGroup.add(cuff);

      const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.062, 14, 12), skinTannedMat);
      kneeCap.position.set(0, -0.37, 0.01);
      legGroup.add(kneeCap);

      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.056, 0.22, 8, 18), skinTannedMat);
      shin.position.y = -0.51;
      shin.castShadow = true;
      legGroup.add(shin);

      const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.044, 0.11, 8, 14), skinTannedMat);
      foot.rotation.x = Math.PI / 2;
      foot.scale.set(1.15, 1.0, 0.68);
      foot.position.set(0, -0.65, 0.04);
      legGroup.add(foot);

      const sandal = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.028, 0.22), woodSandalMat);
      sandal.position.set(0, -0.68, 0.04);
      legGroup.add(sandal);

      return legGroup;
    };

    const leftLeg1 = createCoolie1Leg(-0.14);
    const rightLeg1 = createCoolie1Leg(0.14);
    bodyGroup1.add(leftLeg1, rightLeg1);

    const torsoGroup1 = new THREE.Group();
    torsoGroup1.position.set(0, 1.05, 0);
    bodyGroup1.add(torsoGroup1);

    // Anatomically Contoured Muscular Torso & Samfoo Vest (no cylinder tin-can!)
    const torsoMesh1 = new THREE.Mesh(
      this.createAnatomicalTorsoGeometry(0.225, 0.148, 0.82, 0.78, 0.94, 0.038, 0.006),
      skinTannedMat
    );
    torsoMesh1.castShadow = true;
    torsoGroup1.add(torsoMesh1);

    const vestMesh1 = new THREE.Mesh(
      this.createAnatomicalTorsoGeometry(0.238, 0.158, 0.78, 0.82, 1.04, 0.038, 0.014),
      indigoVestMat
    );
    vestMesh1.position.set(0, -0.01, 0.005);
    vestMesh1.castShadow = true;
    torsoGroup1.add(vestMesh1);

    // Rounded Deltoid Shoulder Caps for Coolie 1 tucked cleanly into shoulder line
    for (const sx of [-0.215, 0.215]) {
      const deltoid1 = new THREE.Mesh(new THREE.SphereGeometry(0.072, 16, 14), skinTannedMat);
      deltoid1.position.set(sx, 0.26, 0);
      deltoid1.scale.set(0.88, 0.72, 0.88);
      torsoGroup1.add(deltoid1);
    }

    const sash1 = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.232, 0.14, 24), rolledTrousersMat);
    sash1.scale.set(1.04, 1.0, 0.72);
    sash1.position.set(0, -0.32, 0);
    torsoGroup1.add(sash1);

    // Sweat Towel: Padded Shoulder Loop with Cascading Front Tail & Rear Drape
    const towel1 = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.026, 10, 18, Math.PI), sweatTowelMat);
    towel1.rotation.set(0, Math.PI / 2, 0);
    towel1.scale.set(1.12, 0.52, 0.88);
    towel1.position.set(-0.135, 0.255, 0);
    torsoGroup1.add(towel1);

    // Front cascading towel tails (sculpted soft cotton folds, zero boxy blocks)
    const towelFrontUpper = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.12, 8, 14), sweatTowelMat);
    towelFrontUpper.scale.set(1.15, 1.0, 0.38);
    towelFrontUpper.position.set(-0.13, 0.18, 0.155);
    towelFrontUpper.rotation.set(0.18, 0, -0.12);
    torsoGroup1.add(towelFrontUpper);

    const towelFrontLower = new THREE.Mesh(new THREE.CapsuleGeometry(0.034, 0.15, 8, 14), sweatTowelMat);
    towelFrontLower.scale.set(1.15, 1.0, 0.36);
    towelFrontLower.position.set(-0.14, 0.01, 0.172);
    towelFrontLower.rotation.set(0.08, 0, -0.08);
    torsoGroup1.add(towelFrontLower);

    const towelFrontHem = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.06, 6, 10), sweatTowelMat);
    towelFrontHem.rotation.z = Math.PI / 2 - 0.08;
    towelFrontHem.position.set(-0.14, -0.09, 0.175);
    torsoGroup1.add(towelFrontHem);

    // Rear drape tail
    const towelRear = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.16, 8, 14), sweatTowelMat);
    towelRear.scale.set(1.15, 1.0, 0.38);
    towelRear.position.set(-0.13, 0.14, -0.155);
    torsoGroup1.add(towelRear);

    // Head group with sculpted cranium & exertion facial features
    const headGroup1 = new THREE.Group();
    headGroup1.position.set(0, 1.60, 0);
    bodyGroup1.add(headGroup1);

    const neck1 = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.086, 0.16, 18), skinTannedMat);
    neck1.position.y = -0.14;
    headGroup1.add(neck1);

    const head1 = new THREE.Mesh(this.createSculptedHeadGeometry(0.195), skinTannedMat);
    head1.castShadow = true;
    headGroup1.add(head1);

    // Exertion brow ridge
    const browRidge1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.12, 6, 12), facialAccentMat);
    browRidge1.rotation.z = Math.PI / 2;
    browRidge1.position.set(0, 0.068, 0.172);
    headGroup1.add(browRidge1);

    // Sculpted nose bridge & flared nostrils
    const noseBridge1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.055, 6, 12), skinTannedMat);
    noseBridge1.position.set(0, 0.01, 0.195);
    noseBridge1.rotation.x = -0.18;
    headGroup1.add(noseBridge1);

    const nostrils1 = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 10), skinTannedMat);
    nostrils1.scale.set(1.25, 0.65, 0.85);
    nostrils1.position.set(0, -0.022, 0.202);
    headGroup1.add(nostrils1);

    // Zygomatic cheekbone planes
    for (const cx of [-0.11, 0.11]) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 10), skinTannedMat);
      cheek.position.set(cx, 0.015, 0.155);
      headGroup1.add(cheek);
    }

    // Firm clenched jaw line & chin
    const chin1 = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 12), skinTannedMat);
    chin1.scale.set(1.15, 0.85, 0.95);
    chin1.position.set(0, -0.135, 0.145);
    headGroup1.add(chin1);

    const mouthLine1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.048, 4, 8), facialAccentMat);
    mouthLine1.rotation.z = Math.PI / 2;
    mouthLine1.position.set(0, -0.078, 0.178);
    headGroup1.add(mouthLine1);

    // Ear lobes
    for (const ex of [-0.18, 0.18]) {
      const ear = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.012, 8, 12, Math.PI * 1.25), skinTannedMat);
      ear.position.set(ex, 0.01, -0.02);
      ear.rotation.set(0, ex > 0 ? Math.PI / 2 : -Math.PI / 2, -0.15);
      headGroup1.add(ear);
    }

    // Artisan Woven Bamboo Sun Hat
    const hat1 = createArtisanBambooHat(false);
    hat1.position.set(0, 0.19, 0);
    headGroup1.add(hat1);

    // Articulated Muscular Capsule Arms with Seamless Elbow Joints
    // Left Arm (Natural counter-swing with sleeve cuff & relaxed hand)
    const leftArm1 = new THREE.Group();
    leftArm1.position.set(-0.235, 1.31, 0);

    const leftArmUpper1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.22, 8, 18), skinTannedMat);
    leftArmUpper1.position.set(0, -0.14, 0.03);
    leftArmUpper1.rotation.x = -0.35;
    leftArmUpper1.castShadow = true;
    leftArm1.add(leftArmUpper1);

    const leftArmCuff1 = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.018, 8, 18), indigoVestMat);
    leftArmCuff1.position.set(0, -0.04, 0.01);
    leftArm1.add(leftArmCuff1);

    const leftElbowJoint1 = new THREE.Mesh(new THREE.SphereGeometry(0.056, 14, 12), skinTannedMat);
    leftElbowJoint1.position.set(0, -0.26, 0.08);
    leftArm1.add(leftElbowJoint1);

    const leftArmForearm1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.22, 8, 18), skinTannedMat);
    leftArmForearm1.position.set(0, -0.37, 0.16);
    leftArmForearm1.rotation.x = -0.58;
    leftArmForearm1.castShadow = true;
    leftArm1.add(leftArmForearm1);

    const handL1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.045, 6, 12), skinTannedMat);
    handL1.scale.set(1.15, 1.0, 0.65);
    handL1.position.set(0, -0.50, 0.25);
    handL1.rotation.x = -0.45;
    leftArm1.add(handL1);
    bodyGroup1.add(leftArm1);

    // Right Arm (Articulated muscular arm & hand locking firmly onto bamboo shoulder pole)
    const rightArm1 = new THREE.Group();
    rightArm1.position.set(0.235, 1.31, 0);

    const rightArmUpper1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.060, 0.18, 8, 18), skinTannedMat);
    rightArmUpper1.position.set(-0.01, -0.11, 0.03);
    rightArmUpper1.rotation.set(-0.27, 0, -0.09);
    rightArmUpper1.castShadow = true;
    rightArm1.add(rightArmUpper1);

    const rightArmCuff1 = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.018, 8, 18), indigoVestMat);
    rightArmCuff1.position.set(0, -0.04, 0.01);
    rightArm1.add(rightArmCuff1);

    const rightElbowJoint1 = new THREE.Mesh(new THREE.SphereGeometry(0.056, 14, 12), skinTannedMat);
    rightElbowJoint1.position.set(-0.02, -0.22, 0.06);
    rightArm1.add(rightElbowJoint1);

    const rightArmForearm1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.20, 8, 18), skinTannedMat);
    rightArmForearm1.position.set(-0.03, -0.10, 0.16);
    rightArmForearm1.rotation.set(0.69, 0, 0.06);
    rightArmForearm1.castShadow = true;
    rightArm1.add(rightArmForearm1);

    // Articulated Hand wrapping around bamboo pole
    const handR1Group = new THREE.Group();
    handR1Group.position.set(-0.04, 0.03, 0.28);
    handR1Group.rotation.set(0.2, 0.1, -0.2);

    const palmR1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.038, 6, 12), skinTannedMat);
    palmR1.rotation.x = Math.PI / 2;
    palmR1.scale.set(1.2, 1.0, 0.65);
    handR1Group.add(palmR1);

    const thumbR1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.036, 4, 8), skinTannedMat);
    thumbR1.position.set(-0.032, 0.015, -0.01);
    thumbR1.rotation.set(0.2, 0.2, 0.5);
    handR1Group.add(thumbR1);

    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.042, 4, 8), skinTannedMat);
      finger.position.set(-0.022 + f * 0.015, -0.018, 0.035);
      finger.rotation.set(1.2, 0, 0);
      handR1Group.add(finger);
    }
    rightArm1.add(handR1Group);
    bodyGroup1.add(rightArm1);

    // Springy Bamboo Shoulder Pole (*Kandar* Rig)
    const poleRig = new THREE.Group();
    poleRig.position.set(0.22, 1.38, 0);
    bodyGroup1.add(poleRig);

    const bambooPole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.026, 2.60, 10), bambooPoleMat);
    bambooPole.rotation.x = Math.PI / 2;
    bambooPole.castShadow = true;
    poleRig.add(bambooPole);

    // 5 Nodal bamboo rings
    for (const nz of [-1.0, -0.5, 0.0, 0.5, 1.0]) {
      const node = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.007, 6, 12), bambooPeakMat);
      node.rotation.x = Math.PI / 2;
      node.position.z = nz;
      poleRig.add(node);
    }

    // Notched collars for rope slings
    for (const cz of [-1.25, 1.25]) {
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.01, 6, 12), bambooInnerRibMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.z = cz;
      poleRig.add(collar);
    }

    const createHangingBasket = (zOffset: number) => {
      const hanger = new THREE.Group();
      hanger.position.set(0, 0, zOffset);
      poleRig.add(hanger);

      for (let c = 0; c < 3; c++) {
        const angle = (c / 3) * Math.PI * 2;
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.46, 4), hempRopeMat);
        cord.position.set(Math.cos(angle) * 0.12, -0.23, Math.sin(angle) * 0.12);
        cord.rotation.z = Math.cos(angle) * 0.25;
        cord.rotation.x = Math.sin(angle) * 0.25;
        hanger.add(cord);
      }

      const basketGroup = new THREE.Group();
      basketGroup.position.set(0, -0.46, 0);
      hanger.add(basketGroup);

      const basket = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.20, 0.30, 12, 1, true),
        rattanBasketMat
      );
      basket.castShadow = true;
      basketGroup.add(basket);

      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.022, 6, 16), rattanBasketMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.15;
      basketGroup.add(rim);

      // Layered Jute Spice Sacks with procedural brand stamp
      const sackBase = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), juteSackMat);
      sackBase.scale.set(1.10, 0.68, 0.98);
      sackBase.position.set(0, 0.04, 0);
      basketGroup.add(sackBase);

      const sackTop = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), juteSackMat);
      sackTop.scale.set(0.95, 0.60, 0.90);
      sackTop.position.set(0, 0.14, 0.02);
      basketGroup.add(sackTop);

      const sackKnot = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.015, 6, 10), hempRopeMat);
      sackKnot.rotation.x = Math.PI / 2;
      sackKnot.position.set(0, 0.24, 0.02);
      basketGroup.add(sackKnot);

      return { hanger, basketGroup };
    };

    const frontBasketData = createHangingBasket(1.25);
    const rearBasketData = createHangingBasket(-1.25);

    this.coolie1 = {
      root: c1Root,
      bodyGroup: bodyGroup1,
      leftLeg: leftLeg1,
      rightLeg: rightLeg1,
      torsoGroup: torsoGroup1,
      headGroup: headGroup1,
      leftArm: leftArm1,
      rightArm: rightArm1,
      poleRig,
      bambooPole,
      frontHanger: frontBasketData.hanger,
      frontBasket: frontBasketData.basketGroup,
      rearHanger: rearBasketData.hanger,
      rearBasket: rearBasketData.basketGroup,
      shadowDecal: shadowDecal1
    };
    this.cooliesScene.add(c1Root);

    // 2.2 Coolie 2 (Dock Cargo Lifter & Procedural Spice Crate)
    const c2Root = new THREE.Group();
    c2Root.name = "coolie2CargoLifter";
    c2Root.position.set(-1.15, 0.775, -1.40);
    c2Root.rotation.y = 0.15; // Angled toward bumboat dock

    const shadowDecal2 = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), shadowDecalMat);
    shadowDecal2.rotation.x = -Math.PI / 2;
    shadowDecal2.position.y = 0.02;
    c2Root.add(shadowDecal2);

    const bodyGroup2 = new THREE.Group();
    c2Root.add(bodyGroup2);

    const hips2 = new THREE.Group();
    hips2.position.set(0, 0.65, 0);
    bodyGroup2.add(hips2);

    const createCoolie2Leg = (xOffset: number) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(xOffset, 0, 0);

      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.084, 0.22, 8, 18), rolledTrousersMat);
      thigh.position.y = -0.17;
      thigh.castShadow = true;
      legGroup.add(thigh);

      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.080, 0.022, 8, 18), rolledTrousersMat);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = -0.34;
      legGroup.add(cuff);

      // Frayed shorts hem fringe
      const fringe = new THREE.Mesh(new THREE.TorusGeometry(0.084, 0.012, 6, 16), sweatTowelMat);
      fringe.rotation.x = Math.PI / 2;
      fringe.position.y = -0.34;
      legGroup.add(fringe);

      const kneeCap2 = new THREE.Mesh(new THREE.SphereGeometry(0.064, 14, 12), skinTannedMat);
      kneeCap2.position.set(0, -0.36, 0.01);
      legGroup.add(kneeCap2);

      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.22, 8, 18), skinTannedMat);
      shin.position.y = -0.50;
      shin.castShadow = true;
      legGroup.add(shin);

      const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.11, 8, 14), skinTannedMat);
      foot.rotation.x = Math.PI / 2;
      foot.scale.set(1.15, 1.0, 0.68);
      foot.position.set(0, -0.63, 0.04);
      legGroup.add(foot);

      return legGroup;
    };

    const leftLeg2 = createCoolie2Leg(-0.15);
    const rightLeg2 = createCoolie2Leg(0.15);
    hips2.add(leftLeg2, rightLeg2);

    const torsoGroup2 = new THREE.Group();
    torsoGroup2.position.set(0, 0.40, 0);
    hips2.add(torsoGroup2);

    // Anatomically Contoured Muscular Torso & Samfoo Vest for Coolie 2
    const torsoMesh2 = new THREE.Mesh(
      this.createAnatomicalTorsoGeometry(0.235, 0.154, 0.82, 0.78, 0.94, 0.042, 0.006),
      skinTannedMat
    );
    torsoMesh2.castShadow = true;
    torsoGroup2.add(torsoMesh2);

    const vestMesh2 = new THREE.Mesh(
      this.createAnatomicalTorsoGeometry(0.248, 0.164, 0.78, 0.82, 1.04, 0.042, 0.014),
      indigoVestMat
    );
    vestMesh2.position.set(0, -0.01, 0.005);
    vestMesh2.castShadow = true;
    torsoGroup2.add(vestMesh2);

    // Rounded Deltoid Shoulder Caps for Coolie 2 tucked cleanly into shoulder line
    for (const sx of [-0.22, 0.22]) {
      const deltoid2 = new THREE.Mesh(new THREE.SphereGeometry(0.074, 16, 14), skinTannedMat);
      deltoid2.position.set(sx, 0.26, 0);
      deltoid2.scale.set(0.88, 0.72, 0.88);
      torsoGroup2.add(deltoid2);
    }

    const sash2 = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.242, 0.14, 24), rolledTrousersMat);
    sash2.scale.set(1.04, 1.0, 0.72);
    sash2.position.set(0, -0.32, 0);
    torsoGroup2.add(sash2);

    // Waist Towel: Tucked soft cloth fold with cascading rounded tails
    const sweatRagFold = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.07, 8, 14), sweatTowelMat);
    sweatRagFold.scale.set(1.15, 1.0, 0.45);
    sweatRagFold.position.set(0.16, -0.28, 0.165);
    sweatRagFold.rotation.z = -0.15;
    torsoGroup2.add(sweatRagFold);

    const sweatRagTail = new THREE.Mesh(new THREE.CapsuleGeometry(0.034, 0.17, 8, 14), sweatTowelMat);
    sweatRagTail.scale.set(1.15, 1.0, 0.36);
    sweatRagTail.position.set(0.18, -0.43, 0.172);
    sweatRagTail.rotation.set(0.15, 0, -0.18);
    torsoGroup2.add(sweatRagTail);

    const sweatRagUnder = new THREE.Mesh(new THREE.CapsuleGeometry(0.030, 0.13, 8, 14), sweatTowelMat);
    sweatRagUnder.scale.set(1.15, 1.0, 0.35);
    sweatRagUnder.position.set(0.15, -0.41, 0.162);
    sweatRagUnder.rotation.set(0.12, 0, -0.10);
    torsoGroup2.add(sweatRagUnder);

    const headGroup2 = new THREE.Group();
    headGroup2.position.set(0, 0.56, 0);
    torsoGroup2.add(headGroup2);

    const neck2 = new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.088, 0.16, 18), skinTannedMat);
    neck2.position.y = -0.14;
    headGroup2.add(neck2);

    const head2 = new THREE.Mesh(this.createSculptedHeadGeometry(0.195), skinTannedMat);
    head2.castShadow = true;
    headGroup2.add(head2);

    // Red cloth headband
    const headband2 = new THREE.Mesh(new THREE.TorusGeometry(0.192, 0.020, 8, 22), redHeadbandMat);
    headband2.rotation.x = Math.PI / 2;
    headband2.scale.set(0.95, 1.0, 1.0);
    headband2.position.set(0, 0.045, 0.01);
    headGroup2.add(headband2);

    // Tilted Artisan Woven Bamboo Sun Hat
    const hat2 = createArtisanBambooHat(true);
    hat2.rotation.x = 0.28; // Tilted back
    hat2.position.set(0, 0.19, -0.05);
    headGroup2.add(hat2);

    // Inward-furrowed brow ridges
    for (const [bx, bRotZ] of [[-0.052, 0.22], [0.052, -0.22]]) {
      const furrow = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.055, 6, 10), facialAccentMat);
      furrow.position.set(bx, 0.072, 0.172);
      furrow.rotation.set(0.15, 0, Math.PI / 2 + bRotZ);
      headGroup2.add(furrow);
    }

    // Chiseled nasal ridge
    const nose2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.055, 6, 12), skinTannedMat);
    nose2.position.set(0, 0.015, 0.196);
    nose2.rotation.x = -0.18;
    headGroup2.add(nose2);

    // Zygomatic cheekbones
    for (const cx of [-0.11, 0.11]) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 10), skinTannedMat);
      cheek.position.set(cx, 0.020, 0.155);
      headGroup2.add(cheek);
    }

    // Open exertion mouth cavity
    const mouthCavity = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.036, 4, 8), facialAccentMat);
    mouthCavity.rotation.z = Math.PI / 2;
    mouthCavity.position.set(0, -0.082, 0.180);
    headGroup2.add(mouthCavity);

    // Sculpted jaw & ears
    const chin2 = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 12), skinTannedMat);
    chin2.scale.set(1.15, 0.85, 0.95);
    chin2.position.set(0, -0.135, 0.145);
    headGroup2.add(chin2);

    for (const ex of [-0.18, 0.18]) {
      const ear = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.012, 8, 12, Math.PI * 1.25), skinTannedMat);
      ear.position.set(ex, 0.01, -0.02);
      ear.rotation.set(0, ex > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
      headGroup2.add(ear);
    }

    // Articulated Muscular Capsule Arms & Hands hooking into crate handles
    const createCoolie2Arm = (xOffset: number) => {
      const armGroup = new THREE.Group();
      armGroup.position.set(xOffset, 0.28, 0);

      const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.064, 0.22, 8, 18), skinTannedMat);
      upperArm.position.y = -0.16;
      upperArm.castShadow = true;
      armGroup.add(upperArm);

      const sleeveCuff = new THREE.Mesh(new THREE.TorusGeometry(0.070, 0.018, 8, 18), indigoVestMat);
      sleeveCuff.position.set(0, -0.05, 0);
      armGroup.add(sleeveCuff);

      const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.058, 14, 12), skinTannedMat);
      elbowJoint.position.set(0, -0.30, 0.02);
      armGroup.add(elbowJoint);

      const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.054, 0.22, 8, 18), skinTannedMat);
      forearm.position.set(0, -0.45, 0.08);
      forearm.rotation.x = -0.32;
      forearm.castShadow = true;
      armGroup.add(forearm);

      // Articulated hand hooking into crate rope handles
      const handGroup = new THREE.Group();
      handGroup.position.set(0, -0.62, 0.15);

      const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.030, 0.042, 6, 12), skinTannedMat);
      palm.rotation.x = Math.PI / 2;
      palm.scale.set(1.2, 1.0, 0.65);
      handGroup.add(palm);

      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.036, 4, 8), skinTannedMat);
      thumb.position.set(xOffset > 0 ? -0.035 : 0.035, 0.015, -0.01);
      thumb.rotation.set(0.2, xOffset > 0 ? 0.3 : -0.3, xOffset > 0 ? 0.6 : -0.6);
      handGroup.add(thumb);

      for (let f = 0; f < 4; f++) {
        const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.042, 4, 8), skinTannedMat);
        finger.position.set((xOffset > 0 ? -0.024 : 0.024) + (xOffset > 0 ? f * 0.016 : -f * 0.016), -0.018, 0.035);
        finger.rotation.set(1.1, 0, 0);
        handGroup.add(finger);
      }
      armGroup.add(handGroup);

      return armGroup;
    };

    const leftArm2 = createCoolie2Arm(-0.215);
    const rightArm2 = createCoolie2Arm(0.215);
    torsoGroup2.add(leftArm2, rightArm2);

    // Dedicated Procedural Wooden Spice Crate Prop
    // Dimensions strictly 0.65 x 0.42 x 0.46 preserving crateRearZ = 0.22 and bottom clearance
    const crateMesh = new THREE.Group();
    crateMesh.position.set(0, 0.21, 0.45);
    c2Root.add(crateMesh);

    const crateBody = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.42, 0.46), woodenCrateMat);
    crateBody.castShadow = true;
    crateMesh.add(crateBody);

    // 8 Forged iron 3-way corner brackets with corner rivet caps
    for (const cx of [-0.325, 0.325]) {
      for (const cy of [-0.21, 0.21]) {
        for (const cz of [-0.23, 0.23]) {
          const corner = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.075), ironCornerMat);
          corner.position.set(cx, cy, cz);
          crateMesh.add(corner);

          const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), ironCornerMat);
          rivet.position.set(
            cx + (cx > 0 ? 0.005 : -0.005),
            cy + (cy > 0 ? 0.005 : -0.005),
            cz + (cz > 0 ? 0.005 : -0.005)
          );
          crateMesh.add(rivet);
        }
      }
    }

    // 2 Horizontal iron binding straps with rivet studs
    const strapTop = new THREE.Mesh(new THREE.BoxGeometry(0.655, 0.045, 0.465), ironCornerMat);
    strapTop.position.y = 0.12;
    crateMesh.add(strapTop);

    const strapBottom = new THREE.Mesh(new THREE.BoxGeometry(0.655, 0.045, 0.465), ironCornerMat);
    strapBottom.position.y = -0.12;
    crateMesh.add(strapBottom);

    // Rope handles with forged iron mounting eyelets
    for (const hx of [-0.34, 0.34]) {
      const handleMesh = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 12), hempRopeMat);
      handleMesh.rotation.y = Math.PI / 2;
      handleMesh.position.set(hx, 0.06, 0);
      crateMesh.add(handleMesh);

      const eyelet = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.06, 0.05), ironCornerMat);
      eyelet.position.set(hx, 0.06, 0);
      crateMesh.add(eyelet);
    }

    const stencilMark = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.16, 0.01),
      new THREE.MeshBasicMaterial({ color: 0x1a140e })
    );
    stencilMark.position.set(0, 0, 0.235);
    crateMesh.add(stencilMark);

    this.coolie2 = {
      root: c2Root,
      bodyGroup: bodyGroup2,
      hips: hips2,
      leftLeg: leftLeg2,
      rightLeg: rightLeg2,
      torsoGroup: torsoGroup2,
      headGroup: headGroup2,
      leftArm: leftArm2,
      rightArm: rightArm2,
      crateMesh,
      shadowDecal: shadowDecal2
    };
    this.cooliesScene.add(c2Root);
  }

  /* ========================================================================= */
  /* 3. Feature 10: Riverbank Wildlife Ecosystem Setup                         */
  /* ========================================================================= */
  private buildWildlifeScene(): void {
    this.wildlifeScene.name = "wildlifeScene";

    // Shared Egret Materials
    const egretFeatherMat = new THREE.MeshStandardMaterial({
      color: 0xfcfcfc,
      roughness: 0.45,
      metalness: 0.05
    });
    const egretBillMat = new THREE.MeshStandardMaterial({
      color: 0xf5b027,
      roughness: 0.30,
      metalness: 0.15
    });
    const egretLegMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a18,
      roughness: 0.85,
      metalness: 0.10
    });
    const egretEyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const fishMat = new THREE.MeshStandardMaterial({
      color: 0x7eb0c2,
      metalness: 0.80,
      roughness: 0.25
    });

    // Shared Otter Materials
    const otterFurMat = new THREE.MeshStandardMaterial({
      color: 0x4e3626,
      roughness: 0.32,
      metalness: 0.12
    });
    const otterBellyMat = new THREE.MeshStandardMaterial({
      color: 0xd2bfa0,
      roughness: 0.42,
      metalness: 0.06
    });
    const otterNoseMat = new THREE.MeshStandardMaterial({
      color: 0x181412,
      roughness: 0.20,
      metalness: 0.30
    });
    const otterEyeMat = new THREE.MeshBasicMaterial({ color: 0x0a0808 });

    // 3.1 Perched Little Egret on North Bank Curb (5.20, 1.275, -1.05)
    this.perchedEgretGroup = new THREE.Group();
    this.perchedEgretGroup.name = "perchedLittleEgret";
    this.perchedEgretGroup.position.set(5.20, 1.275, -1.05);
    this.perchedEgretGroup.rotation.y = 2.45; // Facing southwest towards river and bridge

    // Stilt legs & feet on granite curb
    for (const lx of [-0.035, 0.035]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.009, 0.32, 6), egretLegMat);
      leg.position.set(lx, 0.16, 0);
      this.perchedEgretGroup.add(leg);

      for (let t = -1; t <= 1; t++) {
        const toe = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.006, 0.06), egretBillMat);
        toe.position.set(lx + t * 0.014, 0.003, 0.02);
        toe.rotation.y = t * 0.25;
        this.perchedEgretGroup.add(toe);
      }
    }

    const perchedBody = new THREE.Group();
    perchedBody.position.set(0, 0.32, 0);
    this.perchedEgretGroup.add(perchedBody);

    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), egretFeatherMat);
    torso.scale.set(0.85, 1.1, 1.5);
    torso.rotation.x = -0.22;
    perchedBody.add(torso);

    const tailFan = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 5), egretFeatherMat);
    tailFan.scale.set(1.3, 0.35, 1.0);
    tailFan.position.set(0, -0.02, -0.16);
    tailFan.rotation.x = -1.1;
    perchedBody.add(tailFan);

    // Left and Right sculpted folded wing pivots for flutter
    this.perchedEgretLeftWing = new THREE.Group();
    this.perchedEgretLeftWing.position.set(-0.075, 0.04, 0.02);
    perchedBody.add(this.perchedEgretLeftWing);
    const leftWingCovert = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), egretFeatherMat);
    leftWingCovert.scale.set(0.36, 0.90, 1.85);
    leftWingCovert.position.set(-0.01, -0.025, -0.04);
    leftWingCovert.rotation.x = 0.18;
    this.perchedEgretLeftWing.add(leftWingCovert);
    const leftWingTip = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.14, 6), egretFeatherMat);
    leftWingTip.scale.set(0.35, 1.0, 1.0);
    leftWingTip.position.set(-0.012, -0.055, -0.15);
    leftWingTip.rotation.x = -Math.PI * 0.44;
    this.perchedEgretLeftWing.add(leftWingTip);

    this.perchedEgretRightWing = new THREE.Group();
    this.perchedEgretRightWing.position.set(0.075, 0.04, 0.02);
    perchedBody.add(this.perchedEgretRightWing);
    const rightWingCovert = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), egretFeatherMat);
    rightWingCovert.scale.set(0.36, 0.90, 1.85);
    rightWingCovert.position.set(0.01, -0.025, -0.04);
    rightWingCovert.rotation.x = 0.18;
    this.perchedEgretRightWing.add(rightWingCovert);
    const rightWingTip = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.14, 6), egretFeatherMat);
    rightWingTip.scale.set(0.35, 1.0, 1.0);
    rightWingTip.position.set(0.012, -0.055, -0.15);
    rightWingTip.rotation.x = -Math.PI * 0.44;
    this.perchedEgretRightWing.add(rightWingTip);

    // S-curved neck and head pivot for saccadic twitches
    const neckBase = new THREE.Group();
    neckBase.position.set(0, 0.06, 0.09);
    perchedBody.add(neckBase);

    const breastPlume = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), egretFeatherMat);
    breastPlume.scale.set(0.9, 1.15, 1.1);
    breastPlume.position.set(0, 0.0, 0.01);
    neckBase.add(breastPlume);

    const lowerNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.038, 0.13, 8), egretFeatherMat);
    lowerNeck.position.set(0, 0.06, 0.025);
    lowerNeck.rotation.x = 0.28;
    neckBase.add(lowerNeck);

    this.perchedEgretHeadPivot = new THREE.Group();
    this.perchedEgretHeadPivot.position.set(0, 0.115, 0.045);
    neckBase.add(this.perchedEgretHeadPivot);

    const neckJointSph = new THREE.Mesh(new THREE.SphereGeometry(0.027, 8, 8), egretFeatherMat);
    this.perchedEgretHeadPivot.add(neckJointSph);

    const upperNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.027, 0.08, 8), egretFeatherMat);
    upperNeck.position.set(0, 0.035, -0.006);
    upperNeck.rotation.x = -0.18;
    this.perchedEgretHeadPivot.add(upperNeck);

    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), egretFeatherMat);
    cranium.scale.set(0.85, 0.98, 1.18);
    cranium.position.set(0, 0.08, 0.005);
    this.perchedEgretHeadPivot.add(cranium);

    const crestPlume = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.11, 5), egretFeatherMat);
    crestPlume.position.set(0, 0.095, -0.055);
    crestPlume.rotation.x = -0.65;
    this.perchedEgretHeadPivot.add(crestPlume);

    const bill = new THREE.Mesh(new THREE.ConeGeometry(0.019, 0.15, 8), egretBillMat);
    bill.position.set(0, 0.078, 0.115);
    bill.rotation.x = Math.PI / 2;
    this.perchedEgretHeadPivot.add(bill);

    for (const ex of [-0.034, 0.034]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), egretEyeMat);
      eye.position.set(ex, 0.086, 0.032);
      this.perchedEgretHeadPivot.add(eye);
    }

    this.wildlifeScene.add(this.perchedEgretGroup);

    // 3.2 Wading Little Egret in South Bank Shallows (-8.80, 0.06, 4.80)
    this.wadingEgretGroup = new THREE.Group();
    this.wadingEgretGroup.name = "wadingLittleEgret";
    this.wadingEgretGroup.position.set(-8.80, 0.06, 4.80);
    this.wadingEgretGroup.rotation.y = -0.45; // Facing northeast towards open channel

    for (const lx of [-0.035, 0.035]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.009, 0.32, 8), egretLegMat);
      leg.position.set(lx, 0.16, 0);
      this.wadingEgretGroup.add(leg);

      const kneeNode = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), egretLegMat);
      kneeNode.position.set(lx, 0.18, -0.005);
      this.wadingEgretGroup.add(kneeNode);
    }

    const wadingBody = new THREE.Group();
    wadingBody.position.set(0, 0.32, 0);
    this.wadingEgretGroup.add(wadingBody);

    const wadingTorso = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), egretFeatherMat);
    wadingTorso.scale.set(0.85, 1.08, 1.52);
    wadingTorso.rotation.x = -0.15;
    wadingBody.add(wadingTorso);

    // Sculpted folded wings on wading egret
    for (const side of [-1, 1]) {
      const wCovert = new THREE.Mesh(new THREE.SphereGeometry(0.060, 10, 8), egretFeatherMat);
      wCovert.scale.set(0.36, 0.88, 1.82);
      wCovert.position.set(side * 0.072, 0.015, -0.02);
      wCovert.rotation.x = 0.12;
      wadingBody.add(wCovert);

      const wTip = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.14, 6), egretFeatherMat);
      wTip.scale.set(0.35, 1.0, 1.0);
      wTip.position.set(side * 0.074, -0.015, -0.13);
      wTip.rotation.x = -Math.PI * 0.45;
      wadingBody.add(wTip);
    }

    const wadingTail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 6), egretFeatherMat);
    wadingTail.scale.set(1.3, 0.35, 1.0);
    wadingTail.position.set(0, -0.02, -0.16);
    wadingTail.rotation.x = -1.0;
    wadingBody.add(wadingTail);

    this.wadingEgretNeckPivot = new THREE.Group();
    this.wadingEgretNeckPivot.position.set(0, 0.06, 0.095);
    wadingBody.add(this.wadingEgretNeckPivot);

    const wadingBreastCollar = new THREE.Mesh(new THREE.SphereGeometry(0.048, 8, 8), egretFeatherMat);
    wadingBreastCollar.scale.set(0.9, 1.1, 1.1);
    this.wadingEgretNeckPivot.add(wadingBreastCollar);

    const wadingLowerNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.038, 0.14, 8), egretFeatherMat);
    wadingLowerNeck.position.set(0, 0.065, 0.028);
    wadingLowerNeck.rotation.x = 0.28;
    this.wadingEgretNeckPivot.add(wadingLowerNeck);

    this.wadingEgretHeadPivot = new THREE.Group();
    this.wadingEgretHeadPivot.position.set(0, 0.125, 0.048);
    this.wadingEgretNeckPivot.add(this.wadingEgretHeadPivot);

    // Continuous spherical neck joint + upper neck segment so head never detaches during strike/swallow!
    const wadingJointSph = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), egretFeatherMat);
    this.wadingEgretHeadPivot.add(wadingJointSph);

    const wadingUpperNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.027, 0.065, 8), egretFeatherMat);
    wadingUpperNeck.position.set(0, 0.028, 0.005);
    wadingUpperNeck.rotation.x = 0.12;
    this.wadingEgretHeadPivot.add(wadingUpperNeck);

    const wadingCranium = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), egretFeatherMat);
    wadingCranium.scale.set(0.85, 0.98, 1.18);
    wadingCranium.position.set(0, 0.058, 0.015);
    this.wadingEgretHeadPivot.add(wadingCranium);

    const wadingCrest = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.10, 5), egretFeatherMat);
    wadingCrest.position.set(0, 0.072, -0.045);
    wadingCrest.rotation.x = -0.65;
    this.wadingEgretHeadPivot.add(wadingCrest);

    for (const ex of [-0.034, 0.034]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), egretEyeMat);
      eye.position.set(ex, 0.064, 0.042);
      this.wadingEgretHeadPivot.add(eye);
    }

    const wadingBill = new THREE.Mesh(new THREE.ConeGeometry(0.019, 0.15, 8), egretBillMat);
    wadingBill.position.set(0, 0.055, 0.125);
    wadingBill.rotation.x = Math.PI / 2;
    this.wadingEgretHeadPivot.add(wadingBill);

    // Silvery minnow fish caught in bill (animated visibility & wriggle)
    this.wadingEgretFish = new THREE.Mesh(
      new THREE.ConeGeometry(0.02, 0.12, 6),
      fishMat
    );
    this.wadingEgretFish.scale.set(1.0, 0.4, 1.2);
    this.wadingEgretFish.rotation.z = Math.PI / 2;
    this.wadingEgretFish.position.set(0, 0.055, 0.165);
    this.wadingEgretFish.visible = false;
    this.wadingEgretHeadPivot.add(this.wadingEgretFish);

    this.wildlifeScene.add(this.wadingEgretGroup);

    // 3.3 Singapore River Otters Pair
    const buildOtter = (name: string) => {
      const otterGroup = new THREE.Group();
      otterGroup.name = name;

      const bodyPivot = new THREE.Group();
      otterGroup.add(bodyPivot);

      const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.20, 10), otterFurMat);
      chest.rotation.x = Math.PI / 2;
      bodyPivot.add(chest);

      const throatBelly = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.18, 10), otterBellyMat);
      throatBelly.rotation.x = Math.PI / 2;
      throatBelly.position.set(0, -0.015, 0);
      bodyPivot.add(throatBelly);

      const midTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.20, 10), otterFurMat);
      midTorso.rotation.x = Math.PI / 2;
      midTorso.position.set(0, 0, -0.16);
      bodyPivot.add(midTorso);

      const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.065, 0.16, 10), otterFurMat);
      pelvis.rotation.x = Math.PI / 2;
      pelvis.position.set(0, 0, -0.32);
      bodyPivot.add(pelvis);

      // Paws
      for (const px of [-0.09, 0.09]) {
        const frontPaw = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.07), otterFurMat);
        frontPaw.position.set(px, -0.05, 0.06);
        bodyPivot.add(frontPaw);

        const rearPaw = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.09), otterFurMat);
        rearPaw.position.set(px * 0.9, -0.04, -0.35);
        bodyPivot.add(rearPaw);
      }

      // Tail pivot for serpentine swimming
      const tailPivot = new THREE.Group();
      tailPivot.position.set(0, 0, -0.40);
      bodyPivot.add(tailPivot);

      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.36, 8), otterFurMat);
      tail.rotation.x = -Math.PI / 2;
      tail.position.set(0, 0, -0.18);
      tailPivot.add(tail);

      // Head pivot
      const headPivot = new THREE.Group();
      headPivot.position.set(0, 0.05, 0.14);
      bodyPivot.add(headPivot);

      const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), otterFurMat);
      cranium.scale.set(0.9, 0.8, 1.0);
      headPivot.add(cranium);

      const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.045, 0.065), otterBellyMat);
      muzzle.position.set(0, -0.02, 0.07);
      headPivot.add(muzzle);

      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.018, 0.02), otterNoseMat);
      nose.position.set(0, 0.005, 0.105);
      headPivot.add(nose);

      for (const ex of [-0.045, 0.045]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), otterEyeMat);
        eye.position.set(ex, 0.02, 0.05);
        headPivot.add(eye);

        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), otterFurMat);
        ear.position.set(ex * 1.2, 0.05, -0.02);
        headPivot.add(ear);
      }

      return { otterGroup, bodyPivot, headPivot, tailPivot };
    };

    const o1 = buildOtter("singaporeOtterSwimmer");
    this.otter1Group = o1.otterGroup;
    this.otter1BodyPivot = o1.bodyPivot;
    this.otter1HeadPivot = o1.headPivot;
    this.otter1TailPivot = o1.tailPivot;
    this.wildlifeScene.add(this.otter1Group);

    const o2 = buildOtter("singaporeOtterDiver");
    this.otter2Group = o2.otterGroup;
    this.otter2BodyPivot = o2.bodyPivot;
    this.otter2HeadPivot = o2.headPivot;
    this.otter2TailPivot = o2.tailPivot;
    this.wildlifeScene.add(this.otter2Group);

    // Mooring stilts at western pier cove for river otter playground
    const stiltMat = new THREE.MeshStandardMaterial({ color: 0x423223, roughness: 0.9 });
    for (const [sx, sz] of [[-2.2, -0.5], [-2.8, -0.4]]) {
      const stilt = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.8, 8), stiltMat);
      stilt.position.set(sx, -0.15, sz);
      this.wildlifeScene.add(stilt);
    }

    // Milestone 3 Ecosystem Additions
    this.buildKoiSchool();
    this.buildPeekingOtter();
    this.buildDragonflies();
    this.buildButterflies();
  }

  private buildKoiSchool(): void {
    const koiSchoolGroup = new THREE.Group();
    koiSchoolGroup.name = "koiSchoolGroup";
    this.wildlifeScene.add(koiSchoolGroup);

    const matRed = new THREE.MeshStandardMaterial({ color: 0xdc381e, roughness: 0.22, metalness: 0.15 });
    const matWhite = new THREE.MeshStandardMaterial({ color: 0xfff8f2, roughness: 0.25, metalness: 0.10 });
    const matBlack = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.35, metalness: 0.05 });
    const matGold = new THREE.MeshStandardMaterial({ color: 0xedba26, roughness: 0.20, metalness: 0.50 });
    const matFin = new THREE.MeshStandardMaterial({
      color: 0xffeedd,
      roughness: 0.30,
      metalness: 0.10,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide
    });
    const matEye = new THREE.MeshBasicMaterial({ color: 0x111111 });

    const configs = [
      { centerOffsetX: 0.0, centerOffsetZ: 2.5, orbitRadiusX: 6.5, orbitRadiusZ: 1.6, speed: 0.45, swimDepth: -0.08, phaseOffset: 0.0, mat: matRed },
      { centerOffsetX: -2.0, centerOffsetZ: 3.2, orbitRadiusX: 5.2, orbitRadiusZ: 1.3, speed: 0.48, swimDepth: -0.12, phaseOffset: 1.1, mat: matGold },
      { centerOffsetX: 3.0, centerOffsetZ: 2.0, orbitRadiusX: 5.8, orbitRadiusZ: 1.5, speed: 0.42, swimDepth: -0.06, phaseOffset: 2.3, mat: matRed },
      { centerOffsetX: -4.0, centerOffsetZ: 3.5, orbitRadiusX: 4.8, orbitRadiusZ: 1.2, speed: 0.52, swimDepth: -0.14, phaseOffset: 3.4, mat: matBlack },
      { centerOffsetX: 1.5, centerOffsetZ: 2.8, orbitRadiusX: 6.0, orbitRadiusZ: 1.4, speed: 0.46, swimDepth: -0.10, phaseOffset: 4.6, mat: matGold },
      { centerOffsetX: -1.0, centerOffsetZ: 2.2, orbitRadiusX: 5.5, orbitRadiusZ: 1.5, speed: 0.50, swimDepth: -0.07, phaseOffset: 5.7, mat: matRed }
    ];

    for (let i = 0; i < configs.length; i++) {
      const cfg = configs[i];
      const root = new THREE.Group();
      root.name = `koiFish_${i}`;
      koiSchoolGroup.add(root);

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.045, 0.26, 8), cfg.mat);
      body.rotation.x = Math.PI / 2;
      root.add(body);

      const belly = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.042, 0.24, 8), matWhite);
      belly.position.set(0, -0.012, 0);
      belly.rotation.x = Math.PI / 2;
      root.add(belly);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 6), cfg.mat);
      head.scale.set(0.85, 0.75, 1.1);
      head.position.set(0, 0, 0.14);
      root.add(head);

      for (const ex of [-0.034, 0.034]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 6), matEye);
        eye.position.set(ex, 0.015, 0.16);
        root.add(eye);
      }

      const dorsal = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.045, 0.12), matFin);
      dorsal.position.set(0, 0.045, -0.02);
      root.add(dorsal);

      const pectoralLeft = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.03, 0.08), matFin);
      pectoralLeft.position.set(-0.045, -0.01, 0.08);
      pectoralLeft.rotation.z = 0.35;
      root.add(pectoralLeft);

      const pectoralRight = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.03, 0.08), matFin);
      pectoralRight.position.set(0.045, -0.01, 0.08);
      pectoralRight.rotation.z = -0.35;
      root.add(pectoralRight);

      const tailPivot = new THREE.Group();
      tailPivot.position.set(0, 0, -0.13);
      root.add(tailPivot);

      const tailStem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.012, 0.14, 6), cfg.mat);
      tailStem.position.set(0, 0, -0.07);
      tailStem.rotation.x = Math.PI / 2;
      tailPivot.add(tailStem);

      const caudalFin = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 4), matFin);
      caudalFin.position.set(0, 0, -0.17);
      caudalFin.rotation.x = -Math.PI / 2;
      caudalFin.scale.set(0.12, 1.4, 0.85);
      tailPivot.add(caudalFin);

      this.koiSchool.push({
        root,
        tailPivot,
        pectoralLeft,
        pectoralRight,
        phaseOffset: cfg.phaseOffset,
        speed: cfg.speed,
        orbitRadiusX: cfg.orbitRadiusX,
        orbitRadiusZ: cfg.orbitRadiusZ,
        centerOffsetX: cfg.centerOffsetX,
        centerOffsetZ: cfg.centerOffsetZ,
        swimDepth: cfg.swimDepth
      });
    }
  }

  private buildPeekingOtter(): void {
    this.peekingOtterGroup = new THREE.Group();
    this.peekingOtterGroup.name = "peekingOtterGroup";
    this.peekingOtterGroup.position.set(-8.0, 0.18, 5.20);
    this.peekingOtterGroup.rotation.y = -1.25;
    this.wildlifeScene.add(this.peekingOtterGroup);

    const otterFurMat = new THREE.MeshStandardMaterial({ color: 0x4e3626, roughness: 0.35, metalness: 0.12 });
    const otterBellyMat = new THREE.MeshStandardMaterial({ color: 0xd2bfa0, roughness: 0.42, metalness: 0.06 });
    const otterNoseMat = new THREE.MeshStandardMaterial({ color: 0x181412, roughness: 0.20, metalness: 0.30 });
    const otterEyeMat = new THREE.MeshBasicMaterial({ color: 0x0a0808 });

    this.peekingOtterBodyPivot = new THREE.Group();
    this.peekingOtterGroup.add(this.peekingOtterBodyPivot);

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.26, 10), otterFurMat);
    torso.rotation.x = Math.PI / 2;
    this.peekingOtterBodyPivot.add(torso);

    const belly = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.24, 10), otterBellyMat);
    belly.position.set(0, -0.015, 0);
    belly.rotation.x = Math.PI / 2;
    this.peekingOtterBodyPivot.add(belly);

    for (const px of [-0.075, 0.075]) {
      const paw = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.02, 0.07), otterFurMat);
      paw.position.set(px, -0.045, 0.08);
      this.peekingOtterBodyPivot.add(paw);
    }

    this.peekingOtterHeadPivot = new THREE.Group();
    this.peekingOtterHeadPivot.position.set(0, 0.05, 0.14);
    this.peekingOtterBodyPivot.add(this.peekingOtterHeadPivot);

    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.072, 10, 8), otterFurMat);
    cranium.scale.set(0.9, 0.8, 1.0);
    this.peekingOtterHeadPivot.add(cranium);

    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.04, 0.06), otterBellyMat);
    muzzle.position.set(0, -0.02, 0.065);
    this.peekingOtterHeadPivot.add(muzzle);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.016, 0.02), otterNoseMat);
    nose.position.set(0, 0.005, 0.10);
    this.peekingOtterHeadPivot.add(nose);

    for (const ex of [-0.04, 0.04]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 6), otterEyeMat);
      eye.position.set(ex, 0.02, 0.05);
      this.peekingOtterHeadPivot.add(eye);

      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), otterFurMat);
      ear.position.set(ex * 1.2, 0.045, -0.02);
      this.peekingOtterHeadPivot.add(ear);
    }

    this.peekingOtterTailPivot = new THREE.Group();
    this.peekingOtterTailPivot.position.set(0, 0, -0.15);
    this.peekingOtterBodyPivot.add(this.peekingOtterTailPivot);

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.30, 8), otterFurMat);
    tail.rotation.x = -Math.PI / 2;
    tail.position.set(0, 0, -0.15);
    this.peekingOtterTailPivot.add(tail);
  }

  private buildDragonflies(): void {
    const dragonflyGroup = new THREE.Group();
    dragonflyGroup.name = "dragonflyGroup";
    this.wildlifeScene.add(dragonflyGroup);

    const matGreen = new THREE.MeshStandardMaterial({ color: 0x16b876, roughness: 0.25, metalness: 0.70 });
    const matAmber = new THREE.MeshStandardMaterial({ color: 0xdfa020, roughness: 0.15, metalness: 0.60 });
    const matThorax = new THREE.MeshStandardMaterial({ color: 0x1c241e, roughness: 0.35, metalness: 0.30 });
    const matWing = new THREE.MeshStandardMaterial({
      color: 0xd8f5ff,
      roughness: 0.10,
      metalness: 0.80,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide
    });

    const dfConfigs = [
      { baseX: -5.5, baseZ: 4.2, hoverRadius: 0.65, phaseOffset: 0.0 },
      { baseX: -8.2, baseZ: 3.8, hoverRadius: 0.50, phaseOffset: 2.1 },
      { baseX: -10.5, baseZ: 2.5, hoverRadius: 0.80, phaseOffset: 4.2 }
    ];

    for (let i = 0; i < dfConfigs.length; i++) {
      const cfg = dfConfigs[i];
      const root = new THREE.Group();
      root.name = `dragonfly_${i}`;
      root.position.set(cfg.baseX, 0.45, cfg.baseZ);
      dragonflyGroup.add(root);

      const abdomen = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.004, 0.16, 6), matGreen);
      abdomen.position.set(0, 0, -0.08);
      abdomen.rotation.x = Math.PI / 2;
      root.add(abdomen);

      const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), matThorax);
      thorax.position.set(0, 0, 0.02);
      root.add(thorax);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), matThorax);
      head.position.set(0, 0.004, 0.04);
      root.add(head);

      for (const ex of [-0.011, 0.011]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), matAmber);
        eye.position.set(ex, 0.006, 0.042);
        root.add(eye);
      }

      const forewingLeft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.002, 0.025), matWing);
      forewingLeft.position.set(-0.065, 0.01, 0.025);
      root.add(forewingLeft);

      const forewingRight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.002, 0.025), matWing);
      forewingRight.position.set(0.065, 0.01, 0.025);
      root.add(forewingRight);

      const hindwingLeft = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.002, 0.028), matWing);
      hindwingLeft.position.set(-0.055, 0.008, 0.0);
      root.add(hindwingLeft);

      const hindwingRight = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.002, 0.028), matWing);
      hindwingRight.position.set(0.055, 0.008, 0.0);
      root.add(hindwingRight);

      this.dragonflies.push({
        root,
        forewingLeft,
        forewingRight,
        hindwingLeft,
        hindwingRight,
        baseX: cfg.baseX,
        baseZ: cfg.baseZ,
        hoverRadius: cfg.hoverRadius,
        phaseOffset: cfg.phaseOffset
      });
    }
  }

  private buildButterflies(): void {
    const butterflyGroup = new THREE.Group();
    butterflyGroup.name = "butterflyGroup";
    this.wildlifeScene.add(butterflyGroup);

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
    const wingMatAmber = new THREE.MeshStandardMaterial({
      color: 0xf5a623,
      roughness: 0.35,
      metalness: 0.2,
      side: THREE.DoubleSide
    });
    const wingMatAzure = new THREE.MeshStandardMaterial({
      color: 0x22a0df,
      roughness: 0.35,
      metalness: 0.2,
      side: THREE.DoubleSide
    });

    const spawns = [
      { x: -12.0, y: 1.45, z: -4.5, radius: 0.75, phase: 0.0, mat: wingMatAmber },
      { x: -7.5, y: 1.35, z: -4.0, radius: 0.60, phase: 1.8, mat: wingMatAzure },
      { x: -3.5, y: 2.20, z: -16.5, radius: 0.85, phase: 3.2, mat: wingMatAmber },
      { x: -1.0, y: 2.45, z: -18.0, radius: 0.70, phase: 4.9, mat: wingMatAzure }
    ];

    for (let i = 0; i < spawns.length; i++) {
      const sp = spawns[i];
      const root = new THREE.Group();
      root.name = `swallowtailButterfly_${i}`;
      root.position.set(sp.x, sp.y, sp.z);
      butterflyGroup.add(root);

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.003, 0.06, 5), bodyMat);
      body.rotation.x = Math.PI / 2;
      root.add(body);

      const leftWing = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.09), sp.mat);
      leftWing.position.set(-0.042, 0.006, 0);
      leftWing.rotation.x = -Math.PI / 2;
      root.add(leftWing);

      const rightWing = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.09), sp.mat);
      rightWing.position.set(0.042, 0.006, 0);
      rightWing.rotation.x = -Math.PI / 2;
      root.add(rightWing);

      this.butterflies.push({
        root,
        leftWing,
        rightWing,
        baseX: sp.x,
        baseY: sp.y,
        baseZ: sp.z,
        hoverRadius: sp.radius,
        phaseOffset: sp.phase
      });
    }
  }

  /* ========================================================================= */
  /* 4. Pre-allocated Dynamic Ripple Pool (Zero Allocations in Loop)           */
  /* ========================================================================= */
  private initRipplePool(): void {
    const ringGeo = new THREE.RingGeometry(0.04, 0.08, 24);
    ringGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x8ce8f2,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      this.wildlifeScene.add(mesh);

      this.ripplePool.push({
        mesh,
        mat,
        active: false,
        x: 0,
        z: 0,
        age: 0,
        maxAge: 1.4,
        maxScale: 1.2
      });
    }
  }

  public emitRipple(x: number, z: number, maxScale = 1.0, maxAge = 1.4): void {
    const ripple = this.ripplePool[this.nextRippleIndex];
    this.nextRippleIndex = (this.nextRippleIndex + 1) % this.ripplePool.length;

    ripple.active = true;
    ripple.x = x;
    ripple.z = z;
    ripple.age = 0;
    ripple.maxAge = maxAge;
    ripple.maxScale = maxScale;
    ripple.mesh.visible = true;
    ripple.mesh.scale.set(0.15, 0.15, 1);
    ripple.mat.opacity = 0.60;
  }

  /* ========================================================================= */
  /* 5. 60 FPS Lifecycle Update (Zero Heap Allocations)                        */
  /* ========================================================================= */
  public update(time: number, delta: number): void {
    this.updateTeaGuests(time, delta);
    this.updateCoolies(time, delta);
    this.updateWildlife(time, delta);
  }

  private updateTeaGuests(time: number, delta: number): void {
    // 5.1 Teapot Steam Particle Drift
    const steamCount = 14;
    for (let i = 0; i < steamCount; i++) {
      const p = (time * 0.6 + this.steamPhases[i]) % 1.0;
      this.steamPositions[i * 3] = 0.08 + Math.sin(time * 2.0 + i) * 0.025 * p;
      this.steamPositions[i * 3 + 1] = 0.83 + p * 0.38;
      this.steamPositions[i * 3 + 2] = Math.cos(time * 1.8 + i) * 0.025 * p;
    }
    this.steamParticles.geometry.attributes.position.needsUpdate = true;

    // 5.2 Guest 1 (Sipping Tea 2-Bone Kinematics, 8.0s loop)
    const s = time % 8.0;
    if (s < 2.5) {
      // Phase 1: Idle listening pose
      this.guest1ShoulderPivot.rotation.x = -0.30;
      this.guest1ElbowPivot.rotation.x = 0.60;
      this.guest1Head.rotation.x = 0.0;
    } else if (s < 4.0) {
      // Phase 2: Smooth lifting cup to lips
      const u = (s - 2.5) / 1.5;
      const ease = u * u * (3.0 - 2.0 * u);
      this.guest1ShoulderPivot.rotation.x = -0.30 - 0.55 * ease;
      this.guest1ElbowPivot.rotation.x = 0.60 + 0.75 * ease;
      this.guest1Head.rotation.x = 0.08 * ease;
    } else if (s < 5.5) {
      // Phase 3: Sipping tea with subtle breathing and tilt
      this.guest1ShoulderPivot.rotation.x = -0.85;
      this.guest1ElbowPivot.rotation.x = 1.35;
      this.guest1Head.rotation.x = -0.06 + Math.sin(time * 3.0) * 0.015;
    } else if (s < 7.0) {
      // Phase 4: Smoothly lowering cup
      const u = (s - 5.5) / 1.5;
      const ease = u * u * (3.0 - 2.0 * u);
      this.guest1ShoulderPivot.rotation.x = -0.85 + 0.55 * ease;
      this.guest1ElbowPivot.rotation.x = 1.35 - 0.75 * ease;
      this.guest1Head.rotation.x = -0.06 * (1.0 - ease) + 0.04 * Math.sin(u * Math.PI);
    } else {
      // Phase 5: Idle pause
      this.guest1ShoulderPivot.rotation.x = -0.30;
      this.guest1ElbowPivot.rotation.x = 0.60;
      this.guest1Head.rotation.x = 0.0;
    }

    // 5.3 Guest 2 (3-Bone Rattan Fan Waving Kinematics: 1.2 Hz)
    const fanPeriod = 12.0;
    const fCycle = time % fanPeriod;
    const omegaFan = 7.5398; // 2 * PI * 1.2 Hz

    if (fCycle < 9.5) {
      // Active fanning
      this.guest2WristPivot.rotation.z = Math.sin(time * omegaFan) * 0.35;
      this.guest2WristPivot.rotation.y = Math.cos(time * omegaFan) * 0.10;
      this.guest2ElbowPivot.rotation.x = -0.40 + Math.sin(time * (omegaFan * 0.5)) * 0.12;
      this.guest2ShoulderPivot.rotation.x = -0.25 + Math.cos(time * (omegaFan * 0.5)) * 0.05;
      this.guest2Head.rotation.y = Math.sin(time * 0.8) * 0.06;
    } else {
      // Periodic rest pause: rest fan on knee, nod head
      const pRest = (fCycle - 9.5) / 2.5;
      const restEase = Math.sin(pRest * Math.PI);
      this.guest2WristPivot.rotation.z = 0.15 * (1.0 - restEase);
      this.guest2ElbowPivot.rotation.x = -0.40 - 0.20 * restEase;
      this.guest2ShoulderPivot.rotation.x = -0.25 - 0.15 * restEase;
      this.guest2Head.rotation.y = Math.sin(time * 1.5) * 0.14 * restEase;
    }
  }

  private updateCoolies(time: number, delta: number): void {
    // 5.4 Coolie 1: Resonant 1.9 Hz walking cadence & bamboo harmonic flex
    const strideFreq = 1.90;
    const omegaStride = 2 * Math.PI * strideFreq;
    const stridePhase = omegaStride * time;

    // Leg stride swing
    const legAngle = Math.sin(stridePhase) * 0.55;
    this.coolie1.leftLeg.rotation.x = legAngle;
    this.coolie1.rightLeg.rotation.x = -legAngle;

    // Torso vertical bounce (double stride frequency)
    const torsoBob = Math.abs(Math.sin(stridePhase)) * 0.045;
    this.coolie1.bodyGroup.position.y = torsoBob;

    // Lateral weight shift & roll
    this.coolie1.bodyGroup.position.x = Math.sin(stridePhase) * 0.022;
    this.coolie1.bodyGroup.rotation.z = Math.sin(stridePhase) * 0.035;

    // Bamboo pole elastic flex (phase lag = 0.40 rad)
    const flexOffset = Math.cos(stridePhase * 2 - 0.40) * 0.055;
    const polePitch = Math.sin(stridePhase) * 0.045;
    this.coolie1.poleRig.position.y = 1.38 + torsoBob * 0.5;
    this.coolie1.poleRig.rotation.x = polePitch;
    this.coolie1.poleRig.rotation.z = this.coolie1.bodyGroup.rotation.z;

    // Basket vertical bounce (elastic cable delay phase = 0.85 rad)
    const basketBob = Math.sin(stridePhase * 2 - 0.85) * 0.040;
    this.coolie1.frontBasket.position.y = -0.46 - flexOffset - basketBob;
    this.coolie1.rearBasket.position.y = -0.46 - flexOffset - basketBob;

    // Pendulum swing along travel direction
    this.coolie1.frontHanger.rotation.x = Math.sin(stridePhase - 0.50) * 0.12;
    this.coolie1.rearHanger.rotation.x = -Math.sin(stridePhase - 0.50) * 0.12;

    // Coolie 1 linear ping-pong patrol route: Z from -1.20 to -3.90
    const travelDist = 2.70;
    const walkSpeed = 0.65;
    const walkDuration = travelDist / walkSpeed; // 4.15s
    const turnDuration = 1.20;
    const halfCycle = walkDuration + turnDuration; // 5.35s
    const totalCycle = halfCycle * 2; // 10.70s
    const relTime = time % totalCycle;

    let currentZ = -1.20;
    let targetYaw = 0.0;

    if (relTime < walkDuration) {
      // Walking North towards quay
      const t = relTime / walkDuration;
      currentZ = -1.20 - travelDist * t;
      targetYaw = Math.PI;
    } else if (relTime < halfCycle) {
      // Turning around at quay
      const t = (relTime - walkDuration) / turnDuration;
      const smoothT = t * t * (3.0 - 2.0 * t);
      currentZ = -3.90;
      targetYaw = Math.PI - Math.PI * smoothT;
    } else if (relTime < halfCycle + walkDuration) {
      // Walking South towards river dock
      const t = (relTime - halfCycle) / walkDuration;
      currentZ = -3.90 + travelDist * t;
      targetYaw = 0.0;
    } else {
      // Turning around at river dock
      const t = (relTime - (halfCycle + walkDuration)) / turnDuration;
      const smoothT = t * t * (3.0 - 2.0 * t);
      currentZ = -1.20;
      targetYaw = -Math.PI * smoothT;
    }

    this.coolie1.root.position.z = currentZ;
    this.coolie1.root.rotation.y = targetYaw;

    // Elevation ramp between pier deck (0.775) and cobblestone quay (1.00)
    const zNorm = THREE.MathUtils.clamp((-currentZ - 3.40) / 0.50, 0.0, 1.0);
    this.coolie1.root.position.y = 0.775 + 0.225 * zNorm;

    // 5.5 Coolie 2: Periodic Crate Bending & Lifting Posture Animation (12.0s period)
    const cratePeriod = 12.0;
    const sCrate = (time % cratePeriod) / cratePeriod;
    const deckCrateY = 0.21;
    const liftedCrateY = 0.58;

    if (sCrate < 0.28) {
      // Phase 1: Resting upright, wiping brow with sweat cloth
      this.coolie2.hips.position.y = 0.65;
      this.coolie2.torsoGroup.rotation.x = 0.05 + Math.sin(time * 1.5) * 0.015;
      this.coolie2.torsoGroup.rotation.y = 0.0;
      this.coolie2.headGroup.rotation.y = Math.sin(time * 0.8) * 0.12;

      this.coolie2.rightArm.rotation.x = -0.52 + Math.sin(time * 2.5) * 0.08;
      this.coolie2.rightArm.rotation.z = -0.10;
      this.coolie2.leftArm.rotation.x = -0.22;
      this.coolie2.leftArm.rotation.z = 0.08;

      this.coolie2.crateMesh.position.y = deckCrateY;
      this.coolie2.crateMesh.rotation.y = 0.0;
    } else if (sCrate < 0.44) {
      // Phase 2: Bending down & squatting to grip crate handles
      const p2 = (sCrate - 0.28) / 0.16;
      const ease = p2 * p2 * (3.0 - 2.0 * p2);

      this.coolie2.hips.position.y = 0.65 - 0.22 * ease;
      this.coolie2.torsoGroup.rotation.x = 0.05 + 0.65 * ease;
      this.coolie2.torsoGroup.rotation.y = 0.0;
      this.coolie2.headGroup.rotation.y = 0.0;

      this.coolie2.leftArm.rotation.x = -0.22 - 0.43 * ease;
      this.coolie2.leftArm.rotation.z = 0.08 * (1.0 - ease);
      this.coolie2.rightArm.rotation.x = -0.52 * (1.0 - ease) - 0.65 * ease;
      this.coolie2.rightArm.rotation.z = -0.10 * (1.0 - ease);

      this.coolie2.crateMesh.position.y = deckCrateY;
    } else if (sCrate < 0.60) {
      // Phase 3: Lifting crate up to waist/chest level with effort arch and tremor
      const p3 = (sCrate - 0.44) / 0.16;
      const ease = p3 * p3 * (3.0 - 2.0 * p3);
      const exertionTremor = Math.sin(time * 16.0) * 0.005;

      this.coolie2.hips.position.y = 0.43 + 0.22 * ease + exertionTremor;
      this.coolie2.torsoGroup.rotation.x = 0.70 - 0.55 * ease;

      this.coolie2.leftArm.rotation.x = -0.65 + 0.35 * ease;
      this.coolie2.rightArm.rotation.x = -0.65 + 0.35 * ease;

      this.coolie2.crateMesh.position.y = deckCrateY + (liftedCrateY - deckCrateY) * ease + exertionTremor;
    } else if (sCrate < 0.72) {
      // Phase 4: Holding crate and checking cargo mark with slight torso turn
      const p4 = (sCrate - 0.60) / 0.12;
      const turnEase = Math.sin(p4 * Math.PI);

      this.coolie2.hips.position.y = 0.65;
      this.coolie2.torsoGroup.rotation.x = 0.15;
      this.coolie2.torsoGroup.rotation.y = turnEase * 0.25;

      this.coolie2.leftArm.rotation.x = -0.30;
      this.coolie2.rightArm.rotation.x = -0.30;

      this.coolie2.crateMesh.position.y = liftedCrateY;
      this.coolie2.crateMesh.rotation.y = turnEase * 0.25;
    } else if (sCrate < 0.88) {
      // Phase 5: Lowering crate back down to pier dock
      const p5 = (sCrate - 0.72) / 0.16;
      const ease = p5 * p5 * (3.0 - 2.0 * p5);

      this.coolie2.hips.position.y = 0.65 - 0.22 * ease;
      this.coolie2.torsoGroup.rotation.x = 0.15 + 0.55 * ease;
      this.coolie2.torsoGroup.rotation.y = 0.0;
      this.coolie2.crateMesh.rotation.y = 0.0;

      this.coolie2.leftArm.rotation.x = -0.30 - 0.35 * ease;
      this.coolie2.rightArm.rotation.x = -0.30 - 0.35 * ease;

      this.coolie2.crateMesh.position.y = liftedCrateY - (liftedCrateY - deckCrateY) * ease;
    } else {
      // Phase 6: Release handles & straighten back up to rest stance
      const p6 = (sCrate - 0.88) / 0.12;
      const ease = p6 * p6 * (3.0 - 2.0 * p6);

      this.coolie2.hips.position.y = 0.43 + 0.22 * ease;
      this.coolie2.torsoGroup.rotation.x = 0.70 - 0.65 * ease;

      this.coolie2.leftArm.rotation.x = -0.65 + 0.43 * ease;
      this.coolie2.leftArm.rotation.z = 0.08 * ease;
      this.coolie2.rightArm.rotation.x = -0.65 * (1.0 - ease) - 0.52 * ease;
      this.coolie2.rightArm.rotation.z = -0.10 * ease;

      this.coolie2.crateMesh.position.y = deckCrateY;
    }
  }

  private updateWildlife(time: number, delta: number): void {
    // 5.6 Perched Little Egret Saccadic Head Twitches & Comfort Wing Flutter
    if (time >= this.nextSaccadeTime) {
      this.currentYaw = this.targetYaw;
      const idx = Math.floor(Math.random() * this.saccadeAngles.length);
      this.targetYaw = this.saccadeAngles[idx];
      this.saccadeStartTime = time;
      this.saccadeDuration = 0.075;
      this.nextSaccadeTime = time + 1.8 + Math.random() * 2.2;
    }

    const saccadeProgress = Math.min(1.0, (time - this.saccadeStartTime) / this.saccadeDuration);
    const easeSaccade = 1.0 - Math.pow(1.0 - saccadeProgress, 3);
    this.perchedEgretHeadPivot.rotation.y = this.currentYaw + (this.targetYaw - this.currentYaw) * easeSaccade;
    this.perchedEgretHeadPivot.rotation.x = Math.sin(time * 1.5) * 0.05;

    if (time >= this.nextFlutterTime && !this.isFluttering) {
      this.isFluttering = true;
      this.flutterStartTime = time;
      this.flutterDuration = 0.42;
      this.nextFlutterTime = time + 7.5 + Math.random() * 4.5;
    }

    if (this.isFluttering) {
      const fProg = (time - this.flutterStartTime) / this.flutterDuration;
      if (fProg >= 1.0) {
        this.isFluttering = false;
        this.perchedEgretLeftWing.rotation.z = 0.10;
        this.perchedEgretRightWing.rotation.z = -0.10;
      } else {
        const envelope = Math.sin(fProg * Math.PI);
        const flutter = Math.sin(fProg * Math.PI * 2 * 14) * 0.40 * envelope;
        this.perchedEgretLeftWing.rotation.z = 0.10 + flutter;
        this.perchedEgretRightWing.rotation.z = -0.10 - flutter;
      }
    }

    // 5.7 Wading Little Egret: 4-Phase Feeding Cycle (7.5s loop)
    const cycle = time % 7.5;
    if (cycle < 3.2) {
      // Phase 1: Stalking & coiling
      this.wadingEgretNeckPivot.rotation.x = -0.32 + Math.sin(time * 2.0) * 0.04;
      this.wadingEgretHeadPivot.rotation.x = 0.45;
      this.wadingEgretFish.visible = false;
      this.wadingEgretGroup.position.y = 0.06 + Math.sin(time * 1.4) * 0.006;
    } else if (cycle < 3.6) {
      // Phase 2: Strike & dip into water
      this.wadingEgretNeckPivot.rotation.x = 0.78;
      this.wadingEgretHeadPivot.rotation.x = 0.82;
      if (cycle >= 3.55 && !this.wadingEgretFish.visible) {
        this.emitRipple(this.wadingEgretGroup.position.x, this.wadingEgretGroup.position.z + 0.18, 0.45, 1.0);
      }
    } else if (cycle < 5.2) {
      // Phase 3: Catch & tip-back with wriggling minnow
      this.wadingEgretNeckPivot.rotation.x = -0.48;
      this.wadingEgretHeadPivot.rotation.x = -0.35;
      this.wadingEgretFish.visible = true;
      this.wadingEgretFish.scale.set(1.0, 1.0, 1.0);
      this.wadingEgretFish.rotation.x = Math.sin(time * 32.0) * 0.30;
    } else {
      // Phase 4: Swallow & reset
      this.wadingEgretHeadPivot.rotation.x = -0.80;
      const s = Math.max(0, 1.0 - (cycle - 5.2) / 1.2);
      this.wadingEgretFish.scale.set(s, s, s);
      if (s === 0) {
        this.wadingEgretFish.visible = false;
      }
    }

    // 5.8 Singapore River Otters Kinematics
    // Otter 1 (Continuous Swimmer in cove)
    const o1X = -2.60 + Math.sin(time * 0.75) * 0.85;
    const o1Z = 0.35 + Math.cos(time * 0.75) * 0.45;
    const vX = 0.6375 * Math.cos(time * 0.75);
    const vZ = -0.3375 * Math.sin(time * 0.75);
    const yaw1 = Math.atan2(vX, vZ);

    const waterY1 = getRiverWaveElevation(o1X, o1Z, time);
    this.otter1Group.position.set(o1X, waterY1 - 0.02 + Math.sin(time * 2.8) * 0.025, o1Z);
    this.otter1Group.rotation.y = yaw1;
    this.otter1TailPivot.rotation.y = Math.sin(time * 5.5) * 0.32;
    this.otter1BodyPivot.rotation.x = Math.sin(time * 2.8) * 0.08;

    if (time - this.lastOtter1RippleTime >= 1.25) {
      this.emitRipple(o1X, o1Z, 0.85, 1.5);
      this.lastOtter1RippleTime = time;
    }

    // Otter 2 (Playful Surfacing & Peek Bobber near pier stilt)
    const cycle2 = time % 6.0;
    const o2X = -1.90 + Math.sin(time * 0.3) * 0.15;
    const o2Z = 0.65;
    const waterY2 = getRiverWaveElevation(o2X, o2Z, time);

    if (cycle2 < 3.2) {
      this.otter2Group.position.set(o2X, waterY2 + 0.03 + Math.sin(time * 2.5) * 0.015, o2Z);
      this.otter2BodyPivot.rotation.x = 0.05;
      this.otter2HeadPivot.rotation.y = Math.sin(time * 2.2) * 0.35;
      this.otter2TailPivot.rotation.y = Math.sin(time * 4.0) * 0.15;
    } else if (cycle2 < 4.4) {
      // Arch Dive
      this.otter2Group.position.set(o2X, waterY2 - 0.16, o2Z);
      this.otter2BodyPivot.rotation.x = -1.35;
      this.otter2TailPivot.rotation.x = 0.90;
      if (cycle2 < 3.3) {
        this.emitRipple(o2X, o2Z, 0.95, 1.6);
      }
    } else {
      // Underwater glide & relocation
      this.otter2Group.position.set(o2X, waterY2 - 0.25, o2Z);
      if (cycle2 >= 5.95) {
        this.emitRipple(o2X, o2Z, 0.70, 1.2);
      }
    }

    // 5.10 Procedural Koi Fish School Kinematics (Carangiform tail undulation & figure-8 patrol)
    for (let i = 0; i < this.koiSchool.length; i++) {
      const fish = this.koiSchool[i];
      const u = time * fish.speed + fish.phaseOffset;
      const kx = fish.centerOffsetX + Math.sin(u) * fish.orbitRadiusX;
      const kz = fish.centerOffsetZ + Math.sin(u * 2.0) * fish.orbitRadiusZ * 0.5;
      const vx = Math.cos(u) * fish.orbitRadiusX * fish.speed;
      const vz = Math.cos(u * 2.0) * fish.orbitRadiusZ * fish.speed;
      const yaw = Math.atan2(vx, vz);

      const waterY = getRiverWaveElevation(kx, kz, time);
      const ky = Math.min(waterY - 0.03, fish.swimDepth + Math.sin(u * 1.5) * 0.035);

      fish.root.position.set(kx, ky, kz);
      fish.root.rotation.y = yaw;
      fish.tailPivot.rotation.y = Math.sin(time * 7.5 + fish.phaseOffset) * 0.35;
      fish.pectoralLeft.rotation.z = 0.30 + Math.sin(time * 4.0 + fish.phaseOffset) * 0.15;
      fish.pectoralRight.rotation.z = -0.30 - Math.sin(time * 4.0 + fish.phaseOffset) * 0.15;
    }

    // 5.11 Peeking Wetland Otter 4-Stage State Machine (9.0s loop)
    if (this.peekingOtterGroup) {
      const otterCycle = (time + 1.8) % 9.0;
      const px = -8.0;
      const pz = 5.20;
      const waterY = getRiverWaveElevation(px, pz, time);

      if (otterCycle < 2.8) {
        // Stage 1: Reeds Concealment
        this.peekingOtterGroup.position.set(px, waterY - 0.08, pz);
        this.peekingOtterBodyPivot.rotation.x = 0.0;
        this.peekingOtterHeadPivot.rotation.y = Math.sin(time * 1.2) * 0.12;
        this.peekingOtterHeadPivot.rotation.x = -0.10;
        this.peekingOtterTailPivot.rotation.x = 0.0;
      } else if (otterCycle < 5.2) {
        // Stage 2: Periscope Elevation & Saccadic Sniff
        const prog = (otterCycle - 2.8) / 2.4;
        const ease = 1.0 - Math.pow(1.0 - prog, 3);
        this.peekingOtterGroup.position.set(px, waterY - 0.08 + 0.22 * ease, pz);
        this.peekingOtterBodyPivot.rotation.x = -0.10 * ease;
        this.peekingOtterHeadPivot.rotation.y = Math.sin(otterCycle * 7.5) * 0.35;
        this.peekingOtterHeadPivot.rotation.x = -0.05 + Math.sin(time * 3.5) * 0.08;
      } else if (otterCycle < 7.0) {
        // Stage 3: Stone Step Paw Rest
        this.peekingOtterGroup.position.set(px, waterY + 0.14, pz);
        this.peekingOtterBodyPivot.rotation.x = -0.22;
        this.peekingOtterHeadPivot.rotation.y = Math.sin(time * 1.8) * 0.20;
        this.peekingOtterHeadPivot.rotation.x = -0.15 + Math.sin(time * 3.0) * 0.08;
      } else {
        // Stage 4: Sleek Arc Dive
        const diveProg = (otterCycle - 7.0) / 2.0;
        this.peekingOtterGroup.position.set(px, waterY + 0.14 - diveProg * 0.30, pz);
        this.peekingOtterBodyPivot.rotation.x = -0.22 - diveProg * 1.0;
        this.peekingOtterTailPivot.rotation.x = diveProg * 0.85;
        if (diveProg < 0.08) {
          this.emitRipple(px, pz, 0.75, 1.4);
        }
      }
    }

    // 5.12 Hovering & Water-Dipping Dragonflies Kinematics (42 Hz Dual Wings)
    const wingOmega = 263.89; // 42 Hz * 2 * PI
    for (let i = 0; i < this.dragonflies.length; i++) {
      const df = this.dragonflies[i];
      const flapFore = Math.sin(time * wingOmega + df.phaseOffset) * 0.50;
      const flapHind = Math.sin(time * wingOmega + df.phaseOffset - Math.PI / 2) * 0.50;

      df.forewingLeft.rotation.z = flapFore;
      df.forewingRight.rotation.z = -flapFore;
      df.hindwingLeft.rotation.z = flapHind;
      df.hindwingRight.rotation.z = -flapHind;

      const cycle = (time + df.phaseOffset * 2.0) % 8.0;
      let targetX = df.baseX;
      let targetZ = df.baseZ;
      let targetY = 0.45;

      if (cycle < 4.5) {
        targetX = df.baseX + Math.sin(time * 2.2 + i) * (df.hoverRadius * 0.4);
        targetZ = df.baseZ + Math.cos(time * 1.8 + i) * (df.hoverRadius * 0.4);
        targetY = 0.45 + Math.sin(time * 4.5 + i) * 0.025;
        df.root.rotation.y = Math.sin(time * 1.5 + i) * 0.35;
        df.root.rotation.x = 0.05;
      } else if (cycle < 5.8) {
        const dartProg = (cycle - 4.5) / 1.3;
        const easeDart = dartProg * dartProg * (3.0 - 2.0 * dartProg);
        targetX = df.baseX + (df.hoverRadius * 1.2) * easeDart;
        targetZ = df.baseZ + (df.hoverRadius * 0.8) * easeDart;
        targetY = 0.48 + Math.sin(dartProg * Math.PI) * 0.12;
        df.root.rotation.y = 0.85;
        df.root.rotation.x = -0.15;
      } else if (cycle < 7.0) {
        const dipProg = (cycle - 5.8) / 1.2;
        const dipX = df.baseX + df.hoverRadius * 1.2 * (1.0 - dipProg * 0.5);
        const dipZ = df.baseZ + df.hoverRadius * 0.8 * (1.0 - dipProg * 0.5);
        targetX = dipX;
        targetZ = dipZ;

        const surfaceY = getRiverWaveElevation(dipX, dipZ, time);
        const dipArc = Math.sin(dipProg * Math.PI);
        targetY = 0.45 * (1.0 - dipArc) + (surfaceY + 0.015) * dipArc;
        df.root.rotation.x = 0.35 * (1.0 - dipProg) - 0.45 * dipProg;

        if (dipProg > 0.48 && dipProg < 0.54) {
          this.emitRipple(dipX, dipZ, 0.35, 0.9);
        }
      } else {
        const resetProg = (cycle - 7.0) / 1.0;
        targetX = df.baseX;
        targetZ = df.baseZ;
        targetY = 0.45;
        df.root.rotation.x = -0.20 * (1.0 - resetProg);
      }

      df.root.position.set(targetX, targetY, targetZ);
    }

    // 5.13 Pre-allocated Water Ripple Rings Animation
    for (let i = 0; i < this.ripplePool.length; i++) {
      const r = this.ripplePool[i];
      if (!r.active) continue;

      r.age += delta;
      if (r.age >= r.maxAge) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }

      const progress = r.age / r.maxAge;
      const scale = 0.15 + progress * (r.maxScale - 0.15);
      r.mesh.scale.set(scale, scale, 1);

      const waterY = getRiverWaveElevation(r.x, r.z, time);
      r.mesh.position.set(r.x, waterY + 0.008, r.z);
      r.mat.opacity = (1.0 - progress) * 0.55;
    }

    // 5.14 Fluttering Swallowtail Butterflies Kinematics (12 Hz Wing Flap)
    for (let i = 0; i < this.butterflies.length; i++) {
      const bf = this.butterflies[i];
      const flap = Math.sin(time * 75.398 + bf.phaseOffset) * 0.72;
      bf.leftWing.rotation.z = flap;
      bf.rightWing.rotation.z = -flap;

      const u = time * 0.95 + bf.phaseOffset;
      const bx = bf.baseX + Math.sin(u) * bf.hoverRadius;
      const bz = bf.baseZ + Math.cos(u * 1.4) * (bf.hoverRadius * 0.7);
      const by = bf.baseY + Math.sin(time * 3.5 + bf.phaseOffset) * 0.14;

      bf.root.position.set(bx, by, bz);
      bf.root.rotation.y = Math.atan2(Math.cos(u), -Math.sin(u * 1.4) * 0.7);
      bf.root.rotation.z = Math.sin(time * 4.2 + i) * 0.18;
    }
  }

  /* ========================================================================= */
  /* 6. Clean Lifecycle Disposal                                               */
  /* ========================================================================= */
  public dispose(): void {
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

    this.ripplePool = [];
    this.koiSchool = [];
    this.dragonflies = [];
    this.butterflies = [];
    if (this.root.parent) {
      this.root.parent.remove(this.root);
    }
  }
}
