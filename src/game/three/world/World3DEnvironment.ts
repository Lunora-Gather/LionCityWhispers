import * as THREE from "three";
import {
  getCobblestoneTexture,
  getRoofTileTexture,
  getWoodPlankTexture,
  getMegalithRuneTexture,
  getBrassPlaqueTexture,
  getShophouseSignTexture,
  getPeranakanTileTexture,
  getShophouseTimberDoorTexture,
  getFloralValanceTexture,
  getHeritageCrestTexture,
  getMerlionPlaqueTexture,
  getWovenBambooTexture,
  getAshlarWallTexture,
  getColonialStuccoTexture,
  getSpiceSackTexture,
  getCofferedCeilingTexture,
  getWaterCausticsTexture,
  getTwakowHullTexture,
  getCargoCrateTexture,
  getCanvasAwningTexture,
  getSoftParticleTexture,
  getMerlionScaleTexture,
  getBanyanBarkTexture,
  getBanyanLeafTexture,
  getSkyDomeTexture
} from "./World3DTextures";
import { World3DLifeScenes } from "./World3DLifeScenes";
import { HydrodynamicRiverSystem } from "./World3DHydrodynamics";

export type TimeOfDay = "dusk" | "night" | "dawn";

export type LandmarkId =
  | "badang-stone"
  | "rune-plaque"
  | "harbor-seal"
  | "spirit-chime"
  | "museum"
  | "merlion"
  | "curator"
  | "boatman"
  | "hop-hing"
  | "guan-huat";

export type LandmarkInvestigationConfig = {
  targetDistance?: number;
  targetPolar?: number;
  targetOffset?: THREE.Vector3;
  lookDirection?: number;
};

export type LandmarkTrigger = {
  id: LandmarkId;
  nameZh: string;
  nameEn: string;
  position: THREE.Vector3;
  radius: number;
  beaconColor: number;
  promptZh?: string;
  promptEn?: string;
  actionZh?: string;
  actionEn?: string;
  investigation?: LandmarkInvestigationConfig;
};

export type LandmarkVisualStatus = "pending" | "ready" | "restored";

export interface LandmarkCueRecord {
  id: LandmarkId;
  status: LandmarkVisualStatus;
  beaconGroup: THREE.Group;
  beaconStar: THREE.Mesh<THREE.OctahedronGeometry, THREE.MeshBasicMaterial>;
  beaconRing: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  secondaryRing?: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  baseY: number;
  bobPhase: number;
  spinSpeed: number;
  pendingBeaconColor: number;
  restoredBeaconColor: number;
  readyBeaconColor?: number;
}

/**
 * Analytical Singapore River water wave elevation model.
 * Pure mathematical function derived from river plane geometry parameters:
 * u = x + 4.0, v = 2.5 - z, matching water mesh displacement.
 */
export function getRiverWaveElevation(x: number, z: number, time: number): number {
  const u = x + 4.0;
  const v = 2.5 - z;
  return (
    0.2 +
    Math.sin(u * 0.35 + time * 2.2) * 0.08 +
    Math.cos(v * 0.5 + time * 1.8) * 0.06 +
    Math.sin((u + v) * 0.25 + time * 1.4) * 0.04
  );
}

/**
 * Unified Spatial-Temporal Wind Vector Field W(x, y, z, t).
 * Driven by Straits monsoon macro breeze, traveling spatial gust wave fronts, and boundary shear.
 */
export class UnifiedWindField {
  public static readonly scratchVector = new THREE.Vector3();

  public static sample(x: number, y: number, z: number, time: number, outVector = UnifiedWindField.scratchVector): THREE.Vector3 {
    const fHeight = Math.min(1.35, Math.max(0.30, 0.40 + 0.75 * ((y - 0.5) / 7.0)));
    const macroSpeed = 1.35 * (1.0 + 0.35 * Math.sin(0.35 * time) + 0.20 * Math.cos(0.82 * time + 1.1));
    
    // Wave vector: traveling gust front from Straits (+X, -Z diagonal)
    const phi = 0.2608 * x - 0.1161 * z - 1.28 * time;
    const rawGust = Math.sin(phi) + 0.42 * Math.sin(2.35 * phi + 0.8);
    const gust = rawGust > 0 ? Math.pow(rawGust, 1.75) * 1.80 : 0.0;
    
    const speed = fHeight * (macroSpeed + gust);
    const turbX = 0.22 * Math.sin(3.8 * time + 0.35 * x) + 0.14 * Math.cos(6.2 * time - 0.45 * z);
    const turbZ = 0.18 * Math.cos(3.5 * time - 0.40 * x) + 0.12 * Math.sin(7.1 * time + 0.50 * z);

    outVector.set(
      0.9135 * speed + turbX,
      0.08 * Math.sin(2.1 * time + 0.2 * (x + z)),
      -0.4067 * speed + turbZ
    );
    return outVector;
  }
}

export class World3DEnvironment {
  public root = new THREE.Group();
  public landmarks: LandmarkTrigger[] = [];
  public walkableMeshes: THREE.Mesh[] = [];
  public lifeScenes!: World3DLifeScenes;

  // Hydrodynamic River System (Feature 1-5, Milestone 1)
  public hydroSystem = new HydrodynamicRiverSystem();
  private riverBedCausticsTexture?: THREE.CanvasTexture;
  private scratchHydroDisp = new THREE.Vector3();
  private scratchHydroColor = new THREE.Color();
  private scratchWhiteColor = new THREE.Color(0xffffff);
  private static readonly STATIC_WIND = new THREE.Vector3();

  // Animated elements
  private waterMesh!: THREE.Mesh;
  private waterGeo!: THREE.PlaneGeometry;
  private waterBasePositions!: Float32Array;
  private lotusPads: THREE.Group[] = [];
  private merlionWaterParticles!: THREE.Points;
  private merlionParticlePositions!: Float32Array;
  private merlionParticleVelocities!: Float32Array;
  private merlionSplashRing!: THREE.Mesh;
  private merlionSprayMist!: THREE.Points;
  private merlionMistPositions!: Float32Array;
  private merlionMistPhases!: Float32Array;
  private floatingLanterns: THREE.Group[] = [];
  private lanternBasePositions: Array<{ x: number; z: number }> = [];
  private sampanBoats: THREE.Group[] = [];
  private fireflies!: THREE.Points;
  private sunMotes!: THREE.Points;
  private sunMotesPositions!: Float32Array;
  private spiritVortex!: THREE.Points;
  private harborGears: THREE.Mesh[] = [];
  private stringLightGlows: THREE.Mesh[] = [];
  private curatorNPCGroup!: THREE.Group;
  private boatmanNPCGroup!: THREE.Group;

  // Landmark Groups & State-Aware Visual Cues (Milestone 1)
  private badangMegalithGroup!: THREE.Group;
  private runePlaqueAltarGroup!: THREE.Group;
  private harborGateGroup!: THREE.Group;
  private spiritGatewayGroup!: THREE.Group;
  private colonialMuseumGroup!: THREE.Group;

  private landmarkCueRecords: LandmarkCueRecord[] = [];
  private badangCue!: LandmarkCueRecord;
  private runeCue!: LandmarkCueRecord;
  private harborCue!: LandmarkCueRecord;
  private spiritCue!: LandmarkCueRecord;
  private museumCue!: LandmarkCueRecord;

  // Landmark state-aware accent references
  private badangGoldVeinMat?: THREE.MeshStandardMaterial;
  private badangAltarLight?: THREE.PointLight;
  private badangRuneCircleOuter?: THREE.Mesh;
  private badangRuneCircleInner?: THREE.Mesh;

  private runeSteleJewelMat?: THREE.MeshStandardMaterial;
  private runeBrazierLights: THREE.PointLight[] = [];

  private harborRubyMat?: THREE.MeshStandardMaterial;
  private harborRubyLight?: THREE.PointLight;

  private spiritPortalLight?: THREE.PointLight;

  private museumInteriorLight?: THREE.PointLight;

  // Micro-climate & wind swaying elements
  private banyanAerialRoots: THREE.Group[] = [];
  private banyanCanopies: THREE.Mesh[] = [];
  private parasolCanopies: THREE.Mesh[] = [];
  private floweringBushes: THREE.Object3D[] = [];
  private portalChimes: Array<{ chime: THREE.Group; ribbon: THREE.Mesh; basePos: THREE.Vector3 }> = [];
  private shophouseLanternPivots: THREE.Group[] = [];
  private bumboatBasePositions: Array<{ x: number; z: number; yaw: number }> = [];

  // Fine artisan physical detail extensions
  private mooringRopes: Array<{
    line: THREE.Line;
    positions: Float32Array;
    boatIdx: number;
    anchorWorld: THREE.Vector3;
    bittLocal: THREE.Vector3;
  }> = [];
  private lanternFlames: THREE.Mesh[] = [];
  private lanternLights: THREE.PointLight[] = [];
  private subaquaticGrassBlades: Array<{ mesh: THREE.Mesh; phase: number; baseX: number; baseZ: number }> = [];
  private shophouseBanners: Array<{ group: THREE.Group; phase: number }> = [];
  private static readonly SCRATCH_BITT_WORLD = new THREE.Vector3();

  // Lighting
  private sunLight!: THREE.DirectionalLight;
  private ambientLight!: THREE.AmbientLight;
  private hemisphereLight!: THREE.HemisphereLight;
  private pointLights: THREE.PointLight[] = [];
  private lampLights: THREE.PointLight[] = [];
  private skyDomeMesh?: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private skyTextures?: Record<TimeOfDay, THREE.CanvasTexture>;

  // Smooth lighting targets
  private targetLighting = {
    sunColor: new THREE.Color(0xffaa5e),
    sunIntensity: 3.6,
    sunPosition: new THREE.Vector3(28, 22, -24),
    ambientColor: new THREE.Color(0x524840),
    ambientIntensity: 1.6,
    hemisphereColor: new THREE.Color(0xffd4aa),
    hemisphereGroundColor: new THREE.Color(0x384446),
    hemisphereIntensity: 1.3,
    lampIntensity: 1.5,
    fogColor: new THREE.Color(0x161822),
    fogDensity: 0.0055,
    fireflyOpacity: 0.45,
    sunMotesOpacity: 0.65
  };

  // Macro Investigation Mode (Milestone 3 - Feature 13)
  private isMacroMode = false;
  private macroWeight = 0.0;
  private softwareRenderMode = false;
  private waterNormalFrame = 0;

  public setMacroInvestigation(active: boolean): void {
    this.isMacroMode = active;
  }

  /**
   * Disables GPU-intensive shadow maps and per-pixel secondary point lights when running
   * on a CPU software WebGL rasterizer (e.g. SwiftShader in headless CI), preserving 100%
   * full quality on all hardware GPUs while preventing CPU fragment shader starvation.
   */
  public enableSoftwareRenderFastPath(): void {
    this.softwareRenderMode = true;
    if (this.sunLight) {
      this.sunLight.castShadow = false;
    }
    for (let i = 0; i < this.pointLights.length; i++) {
      this.pointLights[i].visible = false;
    }
    for (let i = 0; i < this.lanternLights.length; i++) {
      this.lanternLights[i].visible = false;
    }
  }

  constructor() {
    this.buildTerrain();
    this.buildWater();
    this.buildBridge();
    this.buildColonialMuseum();
    this.buildShophouseRow();
    this.buildHarborTradeProps();
    this.buildBadangMegalith();
    this.buildAncientPlaqueAltar();
    this.buildHarborGate();
    this.buildSpiritGateway();
    this.buildMerlionStatue();
    this.buildBumboats();
    this.buildFloatingLanterns();
    this.buildFoliageAndLamps();
    this.buildCuratorNPC();
    this.buildBoatmanNPC();
    this.buildLifeScenes();
    this.buildAtmosphereParticles();
    this.buildSkyAndHorizon();
    this.setupLighting("dusk");
    this.setupLandmarkTriggers();
  }

  /**
   * Atmospheric Gradient Sky Dome & Distant Tropical Harbour Horizon Ring
   * Eliminates bare dark void behind eye-level architectural & portrait vistas.
   */
  private buildSkyAndHorizon() {
    this.skyTextures = {
      dawn: getSkyDomeTexture("dawn"),
      dusk: getSkyDomeTexture("dusk"),
      night: getSkyDomeTexture("night")
    };
    const skyGeo = new THREE.SphereGeometry(125, 32, 20);
    const skyMat = new THREE.MeshBasicMaterial({
      map: this.skyTextures.dusk,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });
    this.skyDomeMesh = new THREE.Mesh(skyGeo, skyMat);
    this.root.add(this.skyDomeMesh);
  }

  /* -------------------------------------------------------------- */
  /* 1. Terrain & Exhibition Plinth (博物馆级微缩展示地台与地质层)   */
  /* -------------------------------------------------------------- */
  private buildTerrain() {
    const terrainGroup = new THREE.Group();

    // 1.1 Exhibition Display Plinth (Stepped Mahogany Wood Base)
    const mahoganyMat = new THREE.MeshStandardMaterial({
      color: 0x180f0a,
      roughness: 0.35,
      metalness: 0.2
    });
    const brassTrimMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.25,
      metalness: 0.88
    });

    // Lower tier pedestal
    const lowerBase = new THREE.Mesh(new THREE.BoxGeometry(68, 1.8, 58), mahoganyMat);
    lowerBase.position.y = -5.0;
    lowerBase.receiveShadow = true;
    terrainGroup.add(lowerBase);

    // Upper tier bevel pedestal
    const upperBase = new THREE.Mesh(new THREE.BoxGeometry(64, 1.4, 54), mahoganyMat);
    upperBase.position.y = -3.4;
    upperBase.receiveShadow = true;
    terrainGroup.add(upperBase);

    // Decorative brass molding band between tiers
    const brassMolding = new THREE.Mesh(new THREE.BoxGeometry(64.6, 0.16, 54.6), brassTrimMat);
    brassMolding.position.y = -2.7;
    terrainGroup.add(brassMolding);

    // 4 Antique brass corner bracket feet
    const footGeo = new THREE.BoxGeometry(2.4, 1.2, 2.4);
    for (const [fx, fz] of [[-32, -27], [32, -27], [-32, 27], [32, 27]]) {
      const foot = new THREE.Mesh(footGeo, brassTrimMat);
      foot.position.set(fx, -5.6, fz);
      terrainGroup.add(foot);
    }

    // 1.2 Front Museum Commemorative Plaque (铭牌: SINGAPORE RIVER · 1819)
    const plaqueGroup = new THREE.Group();
    plaqueGroup.position.set(0, -3.4, 27.1);

    const plaqueMat = new THREE.MeshStandardMaterial({
      map: getBrassPlaqueTexture(),
      roughness: 0.28,
      metalness: 0.82
    });
    const plaquePlate = new THREE.Mesh(new THREE.BoxGeometry(12, 1.8, 0.2), plaqueMat);
    plaqueGroup.add(plaquePlate);

    // 4 Corner domed rivets on plaque
    const rivetGeo = new THREE.SphereGeometry(0.12, 8, 8);
    for (const [rx, ry] of [[-5.4, -0.6], [5.4, -0.6], [-5.4, 0.6], [5.4, 0.6]]) {
      const rivet = new THREE.Mesh(rivetGeo, brassTrimMat);
      rivet.position.set(rx, ry, 0.12);
      plaqueGroup.add(rivet);
    }
    terrainGroup.add(plaqueGroup);

    // 1.3 Geological Strata Layers (Earth Crust Cutaway)
    // Reddish laterite bedrock (deep bottom layer)
    const bedrock = new THREE.Mesh(
      new THREE.BoxGeometry(60, 1.8, 50),
      new THREE.MeshStandardMaterial({ color: 0x4a2419, roughness: 0.95 })
    );
    bedrock.position.y = -2.2;
    terrainGroup.add(bedrock);

    // Dark organic river silt & gravel layer (sub-river underground stratum)
    const siltLayer = new THREE.Mesh(
      new THREE.BoxGeometry(58, 0.8, 48),
      new THREE.MeshStandardMaterial({ color: 0x241d18, roughness: 0.98 })
    );
    siltLayer.position.y = -0.9;
    terrainGroup.add(siltLayer);

    // River channel bed (underwater sand & fine river silt at Y = -0.45, giving crystal-clear depth)
    const causticsTex = getWaterCausticsTexture();
    this.riverBedCausticsTexture = causticsTex;
    const riverBedMat = new THREE.MeshStandardMaterial({
      color: 0x0f434a,
      roughness: 0.85,
      map: causticsTex
    });
    const riverBed = new THREE.Mesh(new THREE.PlaneGeometry(62, 16), riverBedMat);
    riverBed.rotation.x = -Math.PI / 2;
    riverBed.position.set(-4, -0.45, 2.5);
    riverBed.receiveShadow = false;
    terrainGroup.add(riverBed);

    // Embedded quartzite stones visible in cutaway
    const stoneChunkMat = new THREE.MeshStandardMaterial({ color: 0x7c7365, roughness: 0.85 });
    for (let i = 0; i < 14; i++) {
      const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + Math.random() * 0.3), stoneChunkMat);
      const angle = (i / 14) * Math.PI * 2;
      const r = 26 + Math.random() * 2;
      chunk.position.set(Math.cos(angle) * r, -1.8 + Math.random() * 1.2, Math.sin(angle) * (r * 0.85));
      chunk.rotation.set(Math.random(), Math.random(), Math.random());
      terrainGroup.add(chunk);
    }

    // 1.4 North Bank Cobblestone Quay Promenade (Walkable)
    const cobblestoneMat = new THREE.MeshStandardMaterial({
      map: getCobblestoneTexture(),
      roughness: 0.72,
      metalness: 0.08
    });
    const northBank = new THREE.Mesh(new THREE.BoxGeometry(48, 1.2, 22), cobblestoneMat);
    northBank.position.set(-6, 0.4, -12);
    northBank.receiveShadow = true;
    terrainGroup.add(northBank);
    this.walkableMeshes.push(northBank);

    // 1.5 South Bank Cobblestone Quay Promenade (Walkable)
    const southBank = new THREE.Mesh(new THREE.BoxGeometry(44, 1.2, 18), cobblestoneMat);
    southBank.position.set(-6, 0.4, 15);
    southBank.receiveShadow = true;
    terrainGroup.add(southBank);
    this.walkableMeshes.push(southBank);

    // 1.6 Granite Curbing & River Retaining Quay Walls (条石砌筑驳岸与排水暗涵)
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x948b78, roughness: 0.65 });
    const ashlarMat = new THREE.MeshStandardMaterial({
      map: getAshlarWallTexture(),
      roughness: 0.76,
      metalness: 0.05
    });
    const ironSluiceMat = new THREE.MeshStandardMaterial({ color: 0x1a2120, roughness: 0.5, metalness: 0.85 });
    const timberRailMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1d, roughness: 0.85 });

    // North curb & ashlar retaining wall
    const curbNorth = new THREE.Mesh(new THREE.BoxGeometry(48, 0.35, 0.7), curbMat);
    curbNorth.position.set(-6, 1.1, -1.05);
    terrainGroup.add(curbNorth);

    const wallNorth = new THREE.Mesh(new THREE.BoxGeometry(48, 1.8, 0.8), ashlarMat);
    wallNorth.position.set(-6, 0.1, -1.1);
    wallNorth.receiveShadow = true;
    terrainGroup.add(wallNorth);

    // South curb & ashlar retaining wall
    const curbSouth = new THREE.Mesh(new THREE.BoxGeometry(44, 0.35, 0.7), curbMat);
    curbSouth.position.set(-6, 1.1, 6.05);
    terrainGroup.add(curbSouth);

    const wallSouth = new THREE.Mesh(new THREE.BoxGeometry(44, 1.8, 0.8), ashlarMat);
    wallSouth.position.set(-6, 0.1, 6.1);
    wallSouth.receiveShadow = true;
    terrainGroup.add(wallSouth);

    // Continuous Bolted Timber Rub-Rails (木质防撞贴木) along waterline
    for (const [wz, yPos] of [
      [-0.66, 0.15],
      [5.66, 0.15]
    ]) {
      const rubRail = new THREE.Mesh(new THREE.BoxGeometry(46, 0.22, 0.14), timberRailMat);
      rubRail.position.set(-6, yPos, wz);
      terrainGroup.add(rubRail);

      // Square iron bolt heads every 3 meters
      for (let bx = -28; bx <= 16; bx += 3) {
        const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.04), ironSluiceMat);
        bolt.position.set(bx, yPos, wz > 0 ? wz - 0.08 : wz + 0.08);
        terrainGroup.add(bolt);
      }
    }

    // 4 Arched Drainage Sluice Culverts (排水暗涵) embedded in stone walls
    const sluicePositions = [
      [-16, -1.1, 0.3, Math.PI],
      [8, -1.1, 0.3, Math.PI],
      [-12, 6.1, 0.3, 0],
      [6, 6.1, 0.3, 0]
    ];
    for (const [sx, sz, sy, sRotY] of sluicePositions) {
      const sluiceGroup = new THREE.Group();
      sluiceGroup.position.set(sx, sy, sz);
      sluiceGroup.rotation.y = sRotY;

      // Stone arch surround
      const archSurround = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 0.18, 12, 1, false, 0, Math.PI),
        curbMat
      );
      archSurround.rotation.z = Math.PI / 2;
      archSurround.position.set(0, 0, 0.42);
      sluiceGroup.add(archSurround);

      // Dark culvert interior
      const darkInterior = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12, 1, false, 0, Math.PI),
        new THREE.MeshBasicMaterial({ color: 0x0a0c0c })
      );
      darkInterior.rotation.z = Math.PI / 2;
      darkInterior.position.set(0, 0, 0.3);
      sluiceGroup.add(darkInterior);

      // Cast-iron grill bars
      for (let g = -0.3; g <= 0.3; g += 0.15) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), ironSluiceMat);
        bar.position.set(g, 0, 0.45);
        sluiceGroup.add(bar);
      }

      terrainGroup.add(sluiceGroup);
    }

    // 1.7 Historical River Water Steps (河埠头下水石阶) into water near pier
    const waterStepsGroup = new THREE.Group();
    waterStepsGroup.position.set(2.4, 0, -1.1);

    const stepStoneMat = new THREE.MeshStandardMaterial({ color: 0x827a69, roughness: 0.85 });
    const algaeStoneMat = new THREE.MeshStandardMaterial({ color: 0x243e34, roughness: 0.95 });

    for (let st = 0; st < 6; st++) {
      const stepY = 0.95 - st * 0.22;
      const stepZ = st * 0.38;
      const isSubmerged = stepY <= 0.25;

      const stepMesh = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.22, 0.48),
        isSubmerged ? algaeStoneMat : stepStoneMat
      );
      stepMesh.position.set(0, stepY, stepZ);
      stepMesh.receiveShadow = true;
      waterStepsGroup.add(stepMesh);
      this.walkableMeshes.push(stepMesh);
    }
    terrainGroup.add(waterStepsGroup);

    // 1.8 Cast-Iron Mooring Rings (嵌石铸铁系缆环) along quayside face
    for (const [rx, rz, rRotY] of [
      [-22, -0.68, Math.PI], [-14, -0.68, Math.PI], [-6, -0.68, Math.PI], [4, -0.68, Math.PI], [12, -0.68, Math.PI],
      [-20, 5.68, 0], [-12, 5.68, 0], [-4, 5.68, 0], [4, 5.68, 0], [12, 5.68, 0]
    ]) {
      const ringGroup = new THREE.Group();
      ringGroup.position.set(rx, 0.6, rz);
      ringGroup.rotation.y = rRotY;

      // Square granite anchor setting pad
      const stonePad = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.12), curbMat);
      ringGroup.add(stonePad);

      // Eyelet bolt
      const eyelet = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 12), ironSluiceMat);
      eyelet.position.z = 0.08;
      ringGroup.add(eyelet);

      // Hanging swinging mooring ring
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 8, 16), ironSluiceMat);
      ring.position.set(0, -0.12, 0.14);
      ring.rotation.x = 0.4;
      ringGroup.add(ring);

      terrainGroup.add(ringGroup);
    }

    // 1.9 Cast-Iron Mooring Bollards with Coiled Nautical Ropes
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x1f2324, roughness: 0.4, metalness: 0.85 });
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x8a7251, roughness: 0.9 });
    const bollardGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.55, 12);
    const bollardCapGeo = new THREE.SphereGeometry(0.24, 12, 8);

    const bollardPositions = [
      [-18, -1.1], [-10, -1.1], [-2, -1.1], [6, -1.1], [14, -1.1],
      [-16, 6.1], [-8, 6.1], [2, 6.1], [10, 6.1]
    ];
    for (const [bx, bz] of bollardPositions) {
      const bollard = new THREE.Group();
      bollard.position.set(bx, 1.1, bz);

      const post = new THREE.Mesh(bollardGeo, ironMat);
      post.position.y = 0.28;
      bollard.add(post);

      const cap = new THREE.Mesh(bollardCapGeo, ironMat);
      cap.position.y = 0.55;
      bollard.add(cap);

      // Coiled hemp rope around base
      const ropeCoil = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.08, 8, 16), ropeMat);
      ropeCoil.rotation.x = Math.PI / 2;
      ropeCoil.position.y = 0.08;
      bollard.add(ropeCoil);

      terrainGroup.add(bollard);
    }

    this.root.add(terrainGroup);
  }

  /* -------------------------------------------------------------- */
  /* 2. Living Singapore River Water, Cutaway & Lotus Pads          */
    /* -------------------------------------------------------------- */
  /* 2. Water Lilies & Sacred Lotus Blooms (水生睡莲、叶盘与重瓣莲花) */
    /* -------------------------------------------------------------- */
  /* 2. Dynamic Historic Singapore River Waterbody                 */
  /* -------------------------------------------------------------- */
  private buildWater() {
    this.waterGeo = new THREE.PlaneGeometry(62, 16, 60, 24);
    const pos = this.waterGeo.attributes.position;
    this.waterBasePositions = new Float32Array(pos.array);

    // Dynamic Beer-Lambert depth gradient and crest breaking foam vertex colors
    const vertexCount = pos.count;
    const colors = new Float32Array(vertexCount * 3);
    for (let i = 0; i < vertexCount; i++) {
      this.hydroSystem.computeDepthColor(0.65, this.scratchHydroColor);
      colors[i * 3] = this.scratchHydroColor.r;
      colors[i * 3 + 1] = this.scratchHydroColor.g;
      colors[i * 3 + 2] = this.scratchHydroColor.b;
    }
    this.waterGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.18,
      metalness: 0.36,
      envMapIntensity: 0.62,
      transparent: true,
      opacity: 0.90,
      flatShading: false
    });
    this.waterMesh = new THREE.Mesh(this.waterGeo, waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.set(-4, 0.2, 2.5);
    this.waterMesh.receiveShadow = true;
    this.root.add(this.waterMesh);

    // River cutaway glass sides (Translucent water cross-section)
    const cutawayMat = new THREE.MeshStandardMaterial({
      color: 0x0c373a,
      roughness: 0.1,
      metalness: 0.3,
      transparent: true,
      opacity: 0.72
    });
    const leftCut = new THREE.Mesh(new THREE.BoxGeometry(16, 2.8, 0.2), cutawayMat);
    leftCut.position.set(-35, -1.2, 2.5);
    leftCut.rotation.y = Math.PI / 2;
    this.root.add(leftCut);

    const rightCut = new THREE.Mesh(new THREE.BoxGeometry(16, 2.8, 0.2), cutawayMat);
    rightCut.position.set(27, -1.2, 2.5);
    rightCut.rotation.y = Math.PI / 2;
    this.root.add(rightCut);

    // Floating Lotus Water Lily Pads (荷叶浮萍)
    this.buildLotusPads();
  }

  /* -------------------------------------------------------------- */
  /* 2.1 Water Lilies & Sacred Lotus Blooms (水生睡莲、叶盘与重瓣莲花) */
  /* -------------------------------------------------------------- */
  private buildLotusPads() {
    const padMat = new THREE.MeshStandardMaterial({ color: 0x1f5430, roughness: 0.65 });
    const padVeinMat = new THREE.MeshStandardMaterial({ color: 0x2b6e40, roughness: 0.6 });
    const outerPetalMat = new THREE.MeshStandardMaterial({ color: 0xf5b8cf, roughness: 0.42 });
    const innerPetalMat = new THREE.MeshStandardMaterial({ color: 0xfff0f5, roughness: 0.35 });
    const stamenMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    const seedPodMat = new THREE.MeshStandardMaterial({ color: 0x8fa838, roughness: 0.5 });
    const dewdropMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0.85 });

    const padPositions = [
      [-12, 0.22, 1.2], [-5, 0.22, 4.4], [8, 0.22, 1.6],
      [14, 0.22, 3.8], [-22, 0.22, 2.8], [3, 0.22, 0.8]
    ];

    for (const [px, py, pz] of padPositions) {
      const cluster = new THREE.Group();
      cluster.position.set(px, py, pz);

      for (let i = 0; i < 3; i++) {
        const r = 0.4 + (i % 2) * 0.15;
        const padGroup = new THREE.Group();
        padGroup.position.set((i - 1) * 0.45 + (Math.random() - 0.5) * 0.2, 0.008 * i, (Math.random() - 0.5) * 0.5);
        padGroup.rotation.y = i * 2.1;

        const padDisc = new THREE.Mesh(
          new THREE.CircleGeometry(r, 20, 0, Math.PI * 1.85),
          padMat
        );
        padDisc.rotation.x = -Math.PI / 2;
        padGroup.add(padDisc);

        const padRim = new THREE.Mesh(
          new THREE.TorusGeometry(r, 0.012, 4, 20, Math.PI * 1.85),
          padVeinMat
        );
        padRim.rotation.x = Math.PI / 2;
        padGroup.add(padRim);

        const dew = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), dewdropMat);
        dew.position.set(r * 0.35, 0.015, -r * 0.2);
        padGroup.add(dew);

        cluster.add(padGroup);
      }

      const flowerGroup = new THREE.Group();
      flowerGroup.position.set(0.12, 0.12, 0.08);

      for (let p = 0; p < 8; p++) {
        const pAng = (p / 8) * Math.PI * 2;
        const petal = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 4), outerPetalMat);
        petal.position.set(Math.cos(pAng) * 0.14, 0.06, Math.sin(pAng) * 0.14);
        petal.rotation.x = Math.sin(pAng) * 0.65;
        petal.rotation.z = -Math.cos(pAng) * 0.65;
        flowerGroup.add(petal);
      }

      for (let p = 0; p < 8; p++) {
        const pAng = (p / 8) * Math.PI * 2 + Math.PI / 8;
        const petal = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.22, 4), innerPetalMat);
        petal.position.set(Math.cos(pAng) * 0.08, 0.1, Math.sin(pAng) * 0.08);
        petal.rotation.x = Math.sin(pAng) * 0.35;
        petal.rotation.z = -Math.cos(pAng) * 0.35;
        flowerGroup.add(petal);
      }

      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.04, 0.06, 10), seedPodMat);
      pod.position.y = 0.11;
      flowerGroup.add(pod);

      const stamenRing = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 16), stamenMat);
      stamenRing.position.y = 0.12;
      stamenRing.rotation.x = Math.PI / 2;
      flowerGroup.add(stamenRing);

      cluster.add(flowerGroup);

      this.lotusPads.push(cluster);
      this.root.add(cluster);
    }
  }
/* 3. Historical Cavenagh Suspension Truss Bridge (1869 加文纳悬索桁架桥) */
  /* -------------------------------------------------------------- */
  private buildBridge() {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(0, 0.7, 2.5);

    // 1. Walkable Deck (preserved dimensions for test locomotion)
    const deckGeo = new THREE.BoxGeometry(6.4, 0.5, 9.5);
    const woodDeckMat = new THREE.MeshStandardMaterial({
      map: getWoodPlankTexture(),
      roughness: 0.75,
      metalness: 0.05
    });
    const bridgeDeck = new THREE.Mesh(deckGeo, woodDeckMat);
    bridgeDeck.castShadow = true;
    bridgeDeck.receiveShadow = true;
    bridgeGroup.add(bridgeDeck);
    this.walkableMeshes.push(bridgeDeck);

    // 2. Argyll Granite Bridge Towers (阿盖尔花岗岩八棱桥塔 - 4座石塔)
    const graniteTex = getAshlarWallTexture();
    graniteTex.wrapS = THREE.RepeatWrapping;
    graniteTex.wrapT = THREE.RepeatWrapping;
    graniteTex.repeat.set(1, 3);
    const graniteTowerMat = new THREE.MeshStandardMaterial({
      map: graniteTex,
      roughness: 0.65,
      metalness: 0.05
    });
    const ironStructureMat = new THREE.MeshStandardMaterial({ color: 0x202624, roughness: 0.45, metalness: 0.85 });
    const brassBadgeMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.35, metalness: 0.85 });

    const towerZPositions = [-4.6, 4.6];
    const towerXPositions = [-3.15, 3.15];

    towerXPositions.forEach((tx) => {
      towerZPositions.forEach((tz) => {
        const towerGroup = new THREE.Group();
        towerGroup.position.set(tx, 0, tz);

        // Stepped granite plinth base
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.4, 0.95), graniteTowerMat);
        plinth.position.y = 0.7;
        plinth.castShadow = true;
        towerGroup.add(plinth);

        // Octagonal granite column pylon
        const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 2.8, 8), graniteTowerMat);
        pylon.position.y = 2.4;
        pylon.castShadow = true;
        towerGroup.add(pylon);

        // Heavy cast-iron cable saddle housing at tower peak
        const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.65), ironStructureMat);
        saddle.position.y = 3.8;
        towerGroup.add(saddle);

        // Decorative tower finial spire
        const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.12, 0.5, 8), brassBadgeMat);
        finial.position.y = 4.2;
        towerGroup.add(finial);

        bridgeGroup.add(towerGroup);
      });
    });

    // 3. Mathematical Catenary Suspension Chains & Hangers (双悬链线锻铁拉索与垂直吊杆)
    towerXPositions.forEach((cx) => {
      const segCount = 20;
      for (let s = 0; s < segCount; s++) {
        const z0 = -4.6 + (s / segCount) * 9.2;
        const z1 = -4.6 + ((s + 1) / segCount) * 9.2;
        const normZ0 = z0 / 4.6;
        const normZ1 = z1 / 4.6;
        const y0 = 1.35 + 2.45 * (normZ0 * normZ0);
        const y1 = 1.35 + 2.45 * (normZ1 * normZ1);

        const linkMidZ = (z0 + z1) / 2;
        const linkMidY = (y0 + y1) / 2;
        const linkLen = Math.hypot(z1 - z0, y1 - y0);

        const link = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.045, linkLen, 6),
          ironStructureMat
        );
        link.position.set(cx, linkMidY, linkMidZ);
        link.rotation.x = Math.atan2(z1 - z0, y1 - y0);
        bridgeGroup.add(link);
      }

      // Vertical steel hanger rods connecting catenary to deck
      for (let h = -4.0; h <= 4.0; h += 0.8) {
        const normH = h / 4.6;
        const cableY = 1.35 + 2.45 * (normH * normH);
        const rodHeight = cableY - 0.35;
        if (rodHeight > 0.3) {
          const rod = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, rodHeight, 6),
            ironStructureMat
          );
          rod.position.set(cx, 0.35 + rodHeight / 2, h);
          bridgeGroup.add(rod);
        }
      }
    });

    // 4. Glasgow Steel Lattice Cross-Braced Trusses (菱形双交叉斜撑钢桁架)
    towerXPositions.forEach((rx) => {
      // Top chord steel beam
      const topChord = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 9.5), ironStructureMat);
      topChord.position.set(rx, 1.65, 0);
      bridgeGroup.add(topChord);

      // Bottom chord steel beam
      const bottomChord = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 9.5), ironStructureMat);
      bottomChord.position.set(rx, 0.35, 0);
      bridgeGroup.add(bottomChord);

      // Diamond Cross-Lattice Diagonal Struts (菱形交叉网格与铆钉节点板)
      const bays = 12;
      const bayWidth = 9.2 / bays;
      for (let b = 0; b < bays; b++) {
        const bz0 = -4.6 + b * bayWidth;
        const bz1 = bz0 + bayWidth;
        const diagLen = Math.hypot(bayWidth, 1.3);

        // Diagonal 1
        const d1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, diagLen, 4), ironStructureMat);
        d1.position.set(rx, 1.0, (bz0 + bz1) / 2);
        d1.rotation.x = Math.atan2(bayWidth, 1.3);
        bridgeGroup.add(d1);

        // Diagonal 2
        const d2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, diagLen, 4), ironStructureMat);
        d2.position.set(rx, 1.0, (bz0 + bz1) / 2);
        d2.rotation.x = -Math.atan2(bayWidth, 1.3);
        bridgeGroup.add(d2);

        // Joint gusset plate
        const gusset = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.14), ironStructureMat);
        gusset.position.set(rx, 1.0, (bz0 + bz1) / 2);
        bridgeGroup.add(gusset);
      }
    });

    // 5. Authentic British Police Notice Plate on Overhead Portal Crossbeam (1869 桥门顶梁警示铸铁铜牌)
    for (const pz of [-4.6, 4.6]) {
      const noticeGroup = new THREE.Group();
      noticeGroup.position.set(0, 3.82, pz);

      const portalBeam = new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.14, 0.16), ironStructureMat);
      noticeGroup.add(portalBeam);

      const noticePlate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.48, 0.08), brassBadgeMat);
      noticeGroup.add(noticePlate);

      const noticeBorder = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.54, 0.06), ironStructureMat);
      noticeGroup.add(noticeBorder);

      bridgeGroup.add(noticeGroup);
    }

    // 6. Victorian Gas Lanterns on Bridge Pedestals
    const lampGlowMat = new THREE.MeshStandardMaterial({
      color: 0xffeaae,
      emissive: 0xffaa33,
      emissiveIntensity: 0.9,
      roughness: 0.25,
      transparent: true,
      opacity: 0.85
    });

    for (const [px, pz] of [[-3.15, -4.6], [3.15, -4.6], [-3.15, 4.6], [3.15, 4.6]]) {
      const lanternPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.9, 8), ironStructureMat);
      lanternPost.position.set(px, 4.15, pz);
      bridgeGroup.add(lanternPost);

      const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.16, 0.45, 4), lampGlowMat);
      lanternGlass.rotation.y = Math.PI / 4;
      lanternGlass.position.set(px, 4.75, pz);
      bridgeGroup.add(lanternGlass);

      const mantle = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfff6cf }));
      mantle.position.set(px, 4.75, pz);
      bridgeGroup.add(mantle);

      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.2, 4), ironStructureMat);
      cap.rotation.y = Math.PI / 4;
      cap.position.set(px, 5.05, pz);
      bridgeGroup.add(cap);

      const finialBall = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), brassBadgeMat);
      finialBall.position.set(px, 5.2, pz);
      bridgeGroup.add(finialBall);
    }

    const bridgeLampLight = new THREE.PointLight(0xffb84d, 1.4, 14);
    bridgeLampLight.position.set(0, 5.2, 0);
    bridgeGroup.add(bridgeLampLight);
    this.pointLights.push(bridgeLampLight);
    this.lampLights.push(bridgeLampLight);

    // Cascading Bougainvillea vine garlands & multi-bract flower clusters on bridge railings
    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xd8296a, roughness: 0.55 });
    const coralBractMat = new THREE.MeshStandardMaterial({ color: 0xf24c7c, roughness: 0.5 });
    const vineLeafMat = new THREE.MeshStandardMaterial({ color: 0x26542c, roughness: 0.75 });
    for (let f = 0; f < 8; f++) {
      const side = f % 2 === 0 ? -3.15 : 3.15;
      const garlandGroup = new THREE.Group();
      garlandGroup.position.set(side, 0.82 + (f % 3) * 0.08, -3.5 + f * 1.0);

      // Leafy cascading vine cushion
      for (let l = 0; l < 4; l++) {
        const leafCluster = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), vineLeafMat);
        leafCluster.scale.set(1.1, 0.75, 1.35);
        leafCluster.position.set(
          (l % 2 === 0 ? -0.04 : 0.04),
          -l * 0.06,
          (l - 1.5) * 0.14
        );
        garlandGroup.add(leafCluster);
      }

      // Blooming magenta & coral paper-flower bract clusters
      for (let b = 0; b < 5; b++) {
        const bract = new THREE.Mesh(
          new THREE.SphereGeometry(0.09 + (b % 2) * 0.025, 7, 6),
          b % 2 === 0 ? flowerMat : coralBractMat
        );
        bract.scale.set(1.2, 0.85, 1.1);
        bract.position.set(
          (b % 2 === 0 ? 0.06 : -0.06),
          0.04 - b * 0.045,
          (b - 2) * 0.11
        );
        garlandGroup.add(bract);
      }

      bridgeGroup.add(garlandGroup);
    }

    this.root.add(bridgeGroup);
  }

  /* -------------------------------------------------------------- */
  /* 4. Historic Clarke Quay / Boat Quay Shophouses (南洋骑楼街群)    */
  /* -------------------------------------------------------------- */
  private buildShophouseRow() {
    const shophouseGroup = new THREE.Group();
    shophouseGroup.position.set(0, 1.0, 15.5);

    interface ShophouseConfig {
      x: number;
      width: number;
      height: number;
      color: number;
      accentColor: number;
      trimColor: number;
      palette: "terracotta" | "mint" | "navy" | "rose";
      crestType: "herbal" | "spice" | "maritime" | "tea";
      nameZh: string;
      nameEn: string;
      signColor: string;
    }

    const shophouses: ShophouseConfig[] = [
      {
        x: -12.5,
        width: 5.6,
        height: 7.2,
        color: 0xb85d38, // Terracotta Ochre
        accentColor: 0x733219,
        trimColor: 0xd4af37, // Gold Leaf
        palette: "terracotta",
        crestType: "herbal",
        nameZh: "同德堂 國藥行",
        nameEn: "Tong De Tang Herbs",
        signColor: "#542110"
      },
      {
        x: -6.2, // Aligned with Guan Huat Spice Landmark (-6.20, 1.20, 14.00)
        width: 5.8,
        height: 7.8,
        color: 0x3d7a6e, // Straits Mint Green
        accentColor: 0x224942,
        trimColor: 0xe0d6c3,
        palette: "mint",
        crestType: "spice",
        nameZh: "源發號 香料行",
        nameEn: "Guan Huat Spice",
        signColor: "#1a4038"
      },
      {
        x: 0,
        width: 5.6,
        height: 7.0,
        color: 0xded3ba, // Colonial Cream White
        accentColor: 0x20343e, // Admiralty Navy
        trimColor: 0xf5efe4,
        palette: "navy",
        crestType: "maritime",
        nameZh: "南洋航運 船務社",
        nameEn: "Nanyang Shipping",
        signColor: "#20343e"
      },
      {
        x: 6.2, // Aligned with Hop Hing Tea House Landmark (6.20, 1.20, 14.00)
        width: 5.8,
        height: 7.5,
        color: 0xa8525b, // Vintage Peranakan Rose
        accentColor: 0x5e262c,
        trimColor: 0x4d7564, // Celadon Jade
        palette: "rose",
        crestType: "tea",
        nameZh: "合興茶莊 茗茶",
        nameEn: "Hop Hing Tea House",
        signColor: "#42161b"
      }
    ];

    const roofTileMat = new THREE.MeshStandardMaterial({
      map: getRoofTileTexture(),
      roughness: 0.82
    });
    const woodShutterMat = new THREE.MeshStandardMaterial({ color: 0x241b14, roughness: 0.7 });
    const woodTrimMat = new THREE.MeshStandardMaterial({ color: 0x3a2416, roughness: 0.65 });
    const ironHingeMat = new THREE.MeshStandardMaterial({ color: 0x1f1d1a, roughness: 0.5, metalness: 0.8 });
    const windowGlowMat = new THREE.MeshBasicMaterial({ color: 0xffd27d });
    const fanlightGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe29e });
    const goldLeafMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.35, metalness: 0.75 });
    const terraRoofRidgeMat = new THREE.MeshStandardMaterial({ color: 0x7a301d, roughness: 0.85 });

    shophouses.forEach((sh, idx) => {
      const house = new THREE.Group();
      house.position.set(sh.x, 0, 0);

      const facadeMat = new THREE.MeshStandardMaterial({ color: sh.color, roughness: 0.72 });
      const accentMat = new THREE.MeshStandardMaterial({ color: sh.accentColor, roughness: 0.75 });
      const trimMat = new THREE.MeshStandardMaterial({ color: sh.trimColor, roughness: 0.5 });
      const peranakanTileMat = new THREE.MeshStandardMaterial({
        map: getPeranakanTileTexture(sh.palette),
        roughness: 0.32,
        metalness: 0.1
      });
      const timberDoorMat = new THREE.MeshStandardMaterial({
        map: getShophouseTimberDoorTexture(),
        roughness: 0.75
      });
      const valanceMat = new THREE.MeshStandardMaterial({
        map: getFloralValanceTexture(sh.signColor),
        transparent: true,
        roughness: 0.7,
        side: THREE.DoubleSide
      });
      const crestMat = new THREE.MeshStandardMaterial({
        map: getHeritageCrestTexture(sh.crestType),
        roughness: 0.3,
        metalness: 0.65,
        side: THREE.DoubleSide
      });

      // -------------------------------------------------------------
      // A. Ground Floor Five-Foot-Way Colonnade Arcade (五脚基走廊)
      // -------------------------------------------------------------
      // 1. Walkable arcade stone floor
      const arcadeFloor = new THREE.Mesh(
        new THREE.BoxGeometry(sh.width, 0.2, 3.0),
        new THREE.MeshStandardMaterial({ color: 0x4d453b, roughness: 0.85 })
      );
      arcadeFloor.position.set(0, 0.1, -1.5);
      arcadeFloor.receiveShadow = true;
      house.add(arcadeFloor);
      this.walkableMeshes.push(arcadeFloor);

      // Arcade ceiling (underside of upper floor cantilever)
      const arcadeCeiling = new THREE.Mesh(
        new THREE.BoxGeometry(sh.width, 0.25, 3.1),
        facadeMat
      );
      arcadeCeiling.position.set(0, 2.75, -1.5);
      house.add(arcadeCeiling);

      // Ceiling timber joist beams
      for (let jz = -2.7; jz <= -0.3; jz += 0.6) {
        const joist = new THREE.Mesh(new THREE.BoxGeometry(sh.width - 0.1, 0.1, 0.08), woodTrimMat);
        joist.position.set(0, 2.68, jz);
        house.add(joist);
      }

      // 2. Colonnade front pillars with molded plinth, chamfered shaft, and bracket capital
      const colXCoords = [-sh.width * 0.42, sh.width * 0.42];
      for (const cx of colXCoords) {
        const pillarCol = new THREE.Group();
        pillarCol.position.set(cx, 0, -2.9);

        // Molded pedestal base plinth
        const basePlinth = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.45, 0.56), accentMat);
        basePlinth.position.y = 0.225;
        basePlinth.castShadow = true;
        pillarCol.add(basePlinth);

        const baseBevel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), trimMat);
        baseBevel.position.y = 0.48;
        pillarCol.add(baseBevel);

        // Main pillar shaft
        const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.44, 1.85, 0.44), facadeMat);
        shaft.position.y = 1.455;
        shaft.castShadow = true;
        pillarCol.add(shaft);

        // Decorative bracket capital (托架牛腿与柱头)
        const neckTrim = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.48), trimMat);
        neckTrim.position.y = 2.4;
        pillarCol.add(neckTrim);

        const capBlock = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.18, 0.58), accentMat);
        capBlock.position.y = 2.51;
        pillarCol.add(capBlock);

        // Carved bracket corbel projecting forward to support architrave beam
        const corbelStep1 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.38), accentMat);
        corbelStep1.position.set(0, 2.5, 0.08);
        pillarCol.add(corbelStep1);

        const corbelStep2 = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.28), trimMat);
        corbelStep2.position.set(0, 2.34, 0.05);
        pillarCol.add(corbelStep2);

        house.add(pillarCol);
      }

      // 3. Transitional archway profile spanning between colonnade columns
      const archBeam = new THREE.Mesh(new THREE.BoxGeometry(sh.width - 0.2, 0.32, 0.42), accentMat);
      archBeam.position.set(0, 2.74, -2.9);
      house.add(archBeam);

      // Molded curved arch spandrel
      const archSpan = sh.width * 0.84;
      const archCurve = new THREE.Mesh(
        new THREE.CylinderGeometry(archSpan * 0.42, archSpan * 0.42, 0.38, 16, 1, false, 0, Math.PI),
        accentMat
      );
      archCurve.rotation.z = Math.PI;
      archCurve.position.set(0, 2.82, -2.9);
      house.add(archCurve);

      // Keystone on the arcade arch
      const arcadeKeystone = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.46), trimMat);
      arcadeKeystone.position.set(0, 2.76, -2.9);
      house.add(arcadeKeystone);

      // 4. Carved hanging fretwork valance (老字号雕花挂落)
      const valanceMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(sh.width * 0.78, 0.42),
        valanceMat
      );
      valanceMesh.rotation.y = Math.PI;
      valanceMesh.position.set(0, 2.45, -2.85);
      house.add(valanceMesh);

      // Hanging merchant banner (商号飞幡布旗 - tucked neatly beside arcade pillar cheek)
      const bannerGroup = new THREE.Group();
      bannerGroup.position.set(-sh.width * 0.40, 2.38, -2.76);
      house.add(bannerGroup);

      const dowel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.44, 6), trimMat);
      dowel.rotation.z = Math.PI / 2;
      bannerGroup.add(dowel);

      const bannerMat = new THREE.MeshStandardMaterial({
        color: sh.signColor,
        roughness: 0.65,
        side: THREE.DoubleSide
      });
      const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.64, 0.012), bannerMat);
      cloth.position.set(0, -0.32, 0);
      bannerGroup.add(cloth);

      // Hanging rolled bamboo chick blind (半卷防雨防晒竹帘)
      const blindGroup = new THREE.Group();
      blindGroup.position.set(sh.width * 0.18, 2.46, -2.84);
      house.add(blindGroup);

      const blindMat = new THREE.MeshStandardMaterial({ color: 0x9e8055, roughness: 0.82 });
      const blind = new THREE.Mesh(new THREE.BoxGeometry(sh.width * 0.42, 0.28, 0.02), blindMat);
      blind.position.set(0, -0.14, 0);
      blindGroup.add(blind);

      this.shophouseBanners.push({ group: bannerGroup, phase: idx * 1.4 });
      this.shophouseBanners.push({ group: blindGroup, phase: idx * 1.4 + 0.8 });

      // 5. Peranakan Encaustic Tile Dado Wainscoting on Inner Wall & Party Returns (娘惹花砖腰线墙裙)
      // Inner arcade wall
      const innerWallMat = new THREE.MeshStandardMaterial({ color: 0xede4d4, roughness: 0.8 });
      const innerWall = new THREE.Mesh(new THREE.BoxGeometry(sh.width, 2.7, 0.2), innerWallMat);
      innerWall.position.set(0, 1.35, -0.05);
      house.add(innerWall);

      // Dado ceramic tile wainscot
      const tileDado = new THREE.Mesh(
        new THREE.PlaneGeometry(sh.width, 0.95),
        peranakanTileMat
      );
      tileDado.rotation.y = Math.PI;
      tileDado.position.set(0, 0.65, -0.16);
      house.add(tileDado);

      // Dado chair-rail cap molding
      const dadoRail = new THREE.Mesh(new THREE.BoxGeometry(sh.width + 0.05, 0.08, 0.08), woodTrimMat);
      dadoRail.position.set(0, 1.16, -0.16);
      house.add(dadoRail);

      // Side party wall tile returns & full-height enclosing courtyard wings on terrace ends
      for (const px of [-sh.width / 2 + 0.05, sh.width / 2 - 0.05]) {
        const sideTileDado = new THREE.Mesh(
          new THREE.PlaneGeometry(2.7, 0.95),
          peranakanTileMat
        );
        sideTileDado.rotation.y = px < 0 ? Math.PI / 2 : -Math.PI / 2;
        sideTileDado.position.set(px, 0.65, -1.45);
        house.add(sideTileDado);

        const sideDadoRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.7), woodTrimMat);
        sideDadoRail.position.set(px, 1.16, -1.45);
        house.add(sideDadoRail);

        if ((idx === 0 && px < 0) || (idx === shophouses.length - 1 && px > 0)) {
          const endPartyWall = new THREE.Mesh(
            new THREE.BoxGeometry(0.14, 2.78, 2.88),
            innerWallMat
          );
          endPartyWall.position.set(px + (px > 0 ? 0.08 : -0.08), 1.39, -1.48);
          endPartyWall.castShadow = true;
          endPartyWall.receiveShadow = true;
          house.add(endPartyWall);

          const friezeTrim = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 2.92), accentMat);
          friezeTrim.position.set(px + (px > 0 ? 0.08 : -0.08), 2.74, -1.48);
          house.add(friezeTrim);
        }
      }

      // 6. Solid timber folding batten shopfront doors (传统实木排门)
      const shopDoor = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 2.2),
        timberDoorMat
      );
      shopDoor.rotation.y = Math.PI;
      shopDoor.position.set(0, 1.3, -0.165);
      house.add(shopDoor);

      // Shopfront timber frame surround
      const doorCasing = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.35, 0.06), woodTrimMat);
      doorCasing.position.set(0, 1.32, -0.155);
      house.add(doorCasing);

      // Warm interior lantern suspended in arcade bay (key lights on central shophouses)
      if (idx === 1 || idx === 3) {
        const interiorLight = new THREE.PointLight(0xffb84d, 1.15, 11);
        interiorLight.position.set(0, 2.1, -1.5);
        house.add(interiorLight);
        this.pointLights.push(interiorLight);
        this.lampLights.push(interiorLight);
      }

      // Brass lantern fixture with swinging pivot
      const lanternPivot = new THREE.Group();
      lanternPivot.position.set(0, 2.72, -1.5);

      const lanternChain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.55, 6), ironHingeMat);
      lanternChain.position.set(0, -0.27, 0);
      lanternPivot.add(lanternChain);

      const lanternHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.32, 6), trimMat);
      lanternHousing.position.set(0, -0.57, 0);
      lanternPivot.add(lanternHousing);

      const lanternFlame = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfff0ad }));
      lanternFlame.position.set(0, -0.60, 0);
      lanternPivot.add(lanternFlame);

      house.add(lanternPivot);
      this.shophouseLanternPivots.push(lanternPivot);

      // Traditional gold-embossed signboard above arcade
      const signBoard = new THREE.Mesh(
        new THREE.BoxGeometry(sh.width * 0.68, 0.68, 0.14),
        new THREE.MeshStandardMaterial({ color: 0x1c140d, roughness: 0.85 })
      );
      signBoard.position.set(0, 2.85, -3.15);
      house.add(signBoard);

      const signFace = new THREE.Mesh(
        new THREE.PlaneGeometry(sh.width * 0.66, 0.64),
        new THREE.MeshStandardMaterial({
          map: getShophouseSignTexture(sh.nameZh, sh.nameEn, sh.signColor),
          roughness: 0.35,
          metalness: 0.25,
          side: THREE.DoubleSide
        })
      );
      signFace.rotation.y = Math.PI;
      signFace.position.set(0, 2.85, -3.23);
      house.add(signFace);

      // -------------------------------------------------------------
      // B. Upper Floor Architecture & Double Cornices (巴洛克立面与双层线脚)
      // -------------------------------------------------------------
      // 1. Upper Floor Main Building Volume & Ground-Floor Rear Courtyard Volume
      const upperHeight = sh.height - 2.8;
      const upperFloor = new THREE.Mesh(
        new THREE.BoxGeometry(sh.width, upperHeight, 6.2),
        facadeMat
      );
      upperFloor.position.set(0, 2.8 + upperHeight / 2, 0);
      upperFloor.castShadow = true;
      upperFloor.receiveShadow = true;
      house.add(upperFloor);

      // Ground-floor enclosed shop body behind the Five-Foot-Way arcade (z = 0..+3.1)
      const groundRearBody = new THREE.Mesh(
        new THREE.BoxGeometry(sh.width, 2.8, 3.1),
        facadeMat
      );
      groundRearBody.position.set(0, 1.4, 1.55);
      groundRearBody.castShadow = true;
      groundRearBody.receiveShadow = true;
      house.add(groundRearBody);

      // Rear Street / Courtyard Facade Detailing (+Z face at z = +3.1) for Bird's-Eye Panorama
      const rearTileDado = new THREE.Mesh(
        new THREE.PlaneGeometry(sh.width - 0.1, 0.95),
        peranakanTileMat
      );
      rearTileDado.position.set(0, 0.62, 3.12);
      house.add(rearTileDado);

      const rearDadoRail = new THREE.Mesh(
        new THREE.BoxGeometry(sh.width + 0.06, 0.08, 0.08),
        woodTrimMat
      );
      rearDadoRail.position.set(0, 1.12, 3.13);
      house.add(rearDadoRail);

      // Rear arched timber courtyard doorway & casing
      const rearDoor = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 2.05), timberDoorMat);
      rearDoor.position.set(0, 1.18, 3.13);
      house.add(rearDoor);

      const rearDoorCasing = new THREE.Mesh(new THREE.BoxGeometry(1.62, 2.18, 0.08), woodTrimMat);
      rearDoorCasing.position.set(0, 1.20, 3.11);
      house.add(rearDoorCasing);

      // Rear lower & upper molded plaster cornices
      const rearBeltCornice = new THREE.Mesh(
        new THREE.BoxGeometry(sh.width + 0.24, 0.18, 0.28),
        accentMat
      );
      rearBeltCornice.position.set(0, 3.12, 3.14);
      house.add(rearBeltCornice);

      const rearCrownCornice = new THREE.Mesh(
        new THREE.BoxGeometry(sh.width + 0.32, 0.22, 0.36),
        accentMat
      );
      rearCrownCornice.position.set(0, sh.height + 0.14, 3.18);
      house.add(rearCrownCornice);

      // Rear vertical plaster pilasters for architectural bay rhythm (+Z face)
      for (const rpx of [-sh.width * 0.48, 0, sh.width * 0.48]) {
        const rearPilaster = new THREE.Mesh(
          new THREE.BoxGeometry(0.26, upperHeight - 0.15, 0.14),
          trimMat
        );
        rearPilaster.position.set(rpx, 2.8 + upperHeight * 0.5, 3.12);
        house.add(rearPilaster);
      }

      // Rear upper-story Peranakan louvered shutter windows (+Z face, positioned cleanly below roof eaves)
      for (const rwx of [-sh.width * 0.24, sh.width * 0.24]) {
        const rWin = new THREE.Group();
        rWin.position.set(rwx, 3.98, 3.12);

        const rSill = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.12, 0.24), trimMat);
        rSill.position.set(0, -0.76, 0.04);
        rWin.add(rSill);

        const rArchitrave = new THREE.Mesh(new THREE.BoxGeometry(1.34, 1.44, 0.08), accentMat);
        rWin.add(rArchitrave);

        const rPane = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 1.26), windowGlowMat);
        rPane.position.set(0, 0, 0.05);
        rWin.add(rPane);

        const rFanArch = new THREE.Mesh(new THREE.TorusGeometry(0.50, 0.052, 8, 16, Math.PI), trimMat);
        rFanArch.position.set(0, 0.66, 0.05);
        rWin.add(rFanArch);

        for (const lSide of [-1, 1]) {
          const rShutter = new THREE.Mesh(new THREE.BoxGeometry(0.44, 1.26, 0.05), woodShutterMat);
          rShutter.position.set(lSide * 0.54, 0, 0.07);
          rShutter.rotation.y = lSide * -0.26;
          rWin.add(rShutter);
        }
        house.add(rWin);
      }

      // 2. Lower Entablature Cornice (层间线脚与斗拱托臂)
      const lowerCorniceBeam = new THREE.Mesh(
        new THREE.BoxGeometry(sh.width + 0.24, 0.16, 0.38),
        accentMat
      );
      lowerCorniceBeam.position.set(0, 3.22, -3.16);
      house.add(lowerCorniceBeam);

      const lowerCorniceDrip = new THREE.Mesh(
        new THREE.BoxGeometry(sh.width + 0.32, 0.1, 0.44),
        trimMat
      );
      lowerCorniceDrip.position.set(0, 3.32, -3.18);
      house.add(lowerCorniceDrip);

      // Dentil course beneath lower cornice
      for (let dx = -sh.width / 2 + 0.3; dx <= sh.width / 2 - 0.3; dx += 0.38) {
        const dentil = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.12), trimMat);
        dentil.position.set(dx, 3.12, -3.22);
        house.add(dentil);
      }

      // Carved Corbel Brackets supporting lower entablature
      for (const bx of [-sh.width * 0.42, 0, sh.width * 0.42]) {
        const corbel1 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.3), accentMat);
        corbel1.position.set(bx, 3.05, -3.15);
        house.add(corbel1);

        const corbel2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.22), trimMat);
        corbel2.position.set(bx, 2.92, -3.1);
        house.add(corbel2);
      }

      // 3. Flanking Classical Pilasters with Plinths and Corinthian Capitals
      for (const px of [-sh.width / 2 + 0.22, sh.width / 2 - 0.22]) {
        // Plinth pedestal
        const pilasterPlinth = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.22), accentMat);
        pilasterPlinth.position.set(px, 3.52, -3.18);
        house.add(pilasterPlinth);

        // Shaft with recessed center flute
        const shaftH = upperHeight - 1.1;
        const pilasterShaft = new THREE.Mesh(new THREE.BoxGeometry(0.34, shaftH, 0.16), facadeMat);
        pilasterShaft.position.set(px, 3.7 + shaftH / 2, -3.16);
        pilasterShaft.castShadow = true;
        house.add(pilasterShaft);

        const flute = new THREE.Mesh(new THREE.BoxGeometry(0.18, shaftH - 0.25, 0.06), accentMat);
        flute.position.set(px, 3.7 + shaftH / 2, -3.22);
        house.add(flute);

        // Molded Capital
        const capital = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.26), trimMat);
        capital.position.set(px, sh.height - 0.35, -3.18);
        house.add(capital);

        const capitalAbacus = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.28), accentMat);
        capitalAbacus.position.set(px, sh.height - 0.22, -3.19);
        house.add(capitalAbacus);
      }

      // 4. Upper Crown Cornice & Carved Modillions (顶层挑檐与檐口斗拱)
      const upperFrieze = new THREE.Mesh(
        new THREE.BoxGeometry(sh.width + 0.16, 0.28, 0.22),
        accentMat
      );
      upperFrieze.position.set(0, sh.height - 0.14, -3.16);
      house.add(upperFrieze);

      // Modillion brackets under the heavy crown cornice
      for (let mx = -sh.width / 2 + 0.4; mx <= sh.width / 2 - 0.4; mx += 0.48) {
        const modillion = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.24), trimMat);
        modillion.position.set(mx, sh.height + 0.02, -3.22);
        house.add(modillion);
      }

      const crownCornice = new THREE.Mesh(
        new THREE.BoxGeometry(sh.width + 0.38, 0.22, 0.52),
        accentMat
      );
      crownCornice.position.set(0, sh.height + 0.18, -3.28);
      crownCornice.castShadow = true;
      house.add(crownCornice);

      // -------------------------------------------------------------
      // C. Authentic French Louvered Shutters & Fanlights (百叶折页窗与明窗)
      // -------------------------------------------------------------
      const windowXCoords = [-sh.width * 0.25, sh.width * 0.25];
      for (const wx of windowXCoords) {
        const winGroup = new THREE.Group();
        winGroup.position.set(wx, 4.45, -3.12);

        // 1. Projecting molded window sill with supporting mini-corbels
        const sill = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.16, 0.3), trimMat);
        sill.position.set(0, -1.0, -0.06);
        sill.castShadow = true;
        winGroup.add(sill);

        for (const sx of [-0.52, 0.52]) {
          const sillCorbel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.18), accentMat);
          sillCorbel.position.set(sx, -1.14, -0.02);
          winGroup.add(sillCorbel);
        }

        // 2. Architrave jamb moldings
        for (const jx of [-0.72, 0.72]) {
          const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.9, 0.14), accentMat);
          jamb.position.set(jx, -0.05, -0.01);
          winGroup.add(jamb);
        }

        // 3. Rectangular window opening with interior amber glow
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.62), windowGlowMat);
        pane.position.set(0, -0.15, -0.05);
        winGroup.add(pane);

        // 4. Semi-Circular Sunburst Fanlight Transom (半圆太阳辐射纹明窗)
        const fanlightY = 0.85;
        // Outer semicircular arch surround
        const fanArch = new THREE.Mesh(
          new THREE.TorusGeometry(0.58, 0.06, 8, 20, Math.PI),
          accentMat
        );
        fanArch.position.set(0, fanlightY, -0.03);
        winGroup.add(fanArch);

        // Glowing fanlight glass pane
        const fanGlass = new THREE.Mesh(
          new THREE.CircleGeometry(0.56, 20, 0, Math.PI),
          fanlightGlowMat
        );
        fanGlass.position.set(0, fanlightY, -0.04);
        winGroup.add(fanGlass);

        // Keystone atop fanlight arch
        const fanKeystone = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.16), trimMat);
        fanKeystone.position.set(0, fanlightY + 0.6, -0.02);
        winGroup.add(fanKeystone);

        // Sunburst radial wooden spokes (7 rays)
        const fanHub = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.1, 0.04, 12, 1, false, 0, Math.PI),
          woodTrimMat
        );
        fanHub.rotation.x = Math.PI / 2;
        fanHub.position.set(0, fanlightY, -0.02);
        winGroup.add(fanHub);

        const rayAngles = [0.26, 0.65, 1.05, 1.57, 2.09, 2.49, 2.88];
        for (const ang of rayAngles) {
          const spokeLen = 0.52;
          const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.024, spokeLen, 0.03), woodTrimMat);
          spoke.position.set(
            Math.cos(ang) * (spokeLen / 2 + 0.06),
            fanlightY + Math.sin(ang) * (spokeLen / 2 + 0.06),
            -0.02
          );
          spoke.rotation.z = ang - Math.PI / 2;
          winGroup.add(spoke);
        }

        // Horizontal transom bar separating fanlight from lower shutters
        const transomBar = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.12, 0.12), woodTrimMat);
        transomBar.position.set(0, fanlightY - 0.04, -0.02);
        winGroup.add(transomBar);

        // 5. 3D French Louvered Shutters (Left & Right Leaves, Ajar with Angled Slats & Hinges)
        const leafW = 0.56;
        const leafH = 1.62;

        const shutterLeaves = [
          { side: -1, angle: -0.32, hingeX: -0.58 }, // Left leaf slightly open
          { side: 1, angle: 0.32, hingeX: 0.58 }     // Right leaf slightly open
        ];

        for (const leafCfg of shutterLeaves) {
          const shutterLeaf = new THREE.Group();
          shutterLeaf.position.set(leafCfg.hingeX, -0.15, -0.04);
          shutterLeaf.rotation.y = leafCfg.angle;

          const panelGroup = new THREE.Group();
          panelGroup.position.set(-leafCfg.side * (leafW / 2), 0, 0);

          // Outer beveled frame stiles and rails
          const stileW = 0.07;
          const leftStile = new THREE.Mesh(new THREE.BoxGeometry(stileW, leafH, 0.05), woodShutterMat);
          leftStile.position.set(-leafW / 2 + stileW / 2, 0, 0);
          panelGroup.add(leftStile);

          const rightStile = new THREE.Mesh(new THREE.BoxGeometry(stileW, leafH, 0.05), woodShutterMat);
          rightStile.position.set(leafW / 2 - stileW / 2, 0, 0);
          panelGroup.add(rightStile);

          const topRail = new THREE.Mesh(new THREE.BoxGeometry(leafW, stileW, 0.05), woodShutterMat);
          topRail.position.set(0, leafH / 2 - stileW / 2, 0);
          panelGroup.add(topRail);

          const bottomRail = new THREE.Mesh(new THREE.BoxGeometry(leafW, 0.12, 0.05), woodShutterMat);
          bottomRail.position.set(0, -leafH / 2 + 0.06, 0);
          panelGroup.add(bottomRail);

          // Intermediate lock rail
          const midRail = new THREE.Mesh(new THREE.BoxGeometry(leafW, 0.08, 0.05), woodShutterMat);
          midRail.position.set(0, 0, 0);
          panelGroup.add(midRail);

          // 10 3D Louver Slats (5 in upper bay, 5 in lower bay) tilted at 28 degrees
          const slatW = leafW - stileW * 2 - 0.01;
          const slatThickness = 0.018;
          const slatDepth = 0.055;
          const slatTilt = 0.48; // ~28 degrees tilt for genuine tropical airflow

          // Upper bay slats
          for (let s = 0; s < 5; s++) {
            const sy = 0.14 + s * 0.125;
            const slat = new THREE.Mesh(new THREE.BoxGeometry(slatW, slatThickness, slatDepth), woodShutterMat);
            slat.position.set(0, sy, 0);
            slat.rotation.x = slatTilt;
            slat.castShadow = true;
            panelGroup.add(slat);
          }

          // Lower bay slats
          for (let s = 0; s < 5; s++) {
            const sy = -0.66 + s * 0.125;
            const slat = new THREE.Mesh(new THREE.BoxGeometry(slatW, slatThickness, slatDepth), woodShutterMat);
            slat.position.set(0, sy, 0);
            slat.rotation.x = slatTilt;
            slat.castShadow = true;
            panelGroup.add(slat);
          }

          shutterLeaf.add(panelGroup);

          // 3 Wrought-iron strap hinge plates with pivot pins
          for (const hy of [leafH * 0.38, 0.0, -leafH * 0.38]) {
            const hingeStrap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.024, 0.018), ironHingeMat);
            hingeStrap.position.set(-leafCfg.side * 0.05, hy, 0.02);
            shutterLeaf.add(hingeStrap);

            const hingePin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.045, 8), ironHingeMat);
            hingePin.position.set(0, hy, 0.02);
            shutterLeaf.add(hingePin);
          }

          winGroup.add(shutterLeaf);
        }

        house.add(winGroup);
      }

      // -------------------------------------------------------------
      // D. Baroque & Eclectic Decorative Pediments (山花立面与浮雕徽章)
      // -------------------------------------------------------------
      const pedimentGroup = new THREE.Group();
      pedimentGroup.position.set(0, sh.height + 0.28, -3.22);

      if (idx === 0) {
        // Shop 1: 同德堂药行 (Tong De Tang) - Baroque Segmental Arched Pediment
        const archR = sh.width * 0.42;
        const archedParapet = new THREE.Mesh(
          new THREE.CylinderGeometry(archR, archR, 0.24, 24, 1, false, 0, Math.PI),
          accentMat
        );
        archedParapet.rotation.x = Math.PI / 2;
        archedParapet.position.set(0, 0.5, 0);
        pedimentGroup.add(archedParapet);

        const archedMolding = new THREE.Mesh(
          new THREE.TorusGeometry(archR, 0.08, 8, 24, Math.PI),
          trimMat
        );
        archedMolding.position.set(0, 0.5, 0.06);
        pedimentGroup.add(archedMolding);

        // Herbal relief medallion crest
        const crestMedallion = new THREE.Mesh(
          new THREE.CylinderGeometry(0.48, 0.48, 0.08, 24),
          crestMat
        );
        crestMedallion.rotation.x = Math.PI / 2;
        crestMedallion.position.set(0, 0.82, 0.1);
        pedimentGroup.add(crestMedallion);

        // Flanking urn finials on corner parapets
        for (const ux of [-sh.width / 2 + 0.25, sh.width / 2 - 0.25]) {
          const urnBase = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.35, 0.38), accentMat);
          urnBase.position.set(ux, 0.2, 0);
          pedimentGroup.add(urnBase);

          const urnBody = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.32, 10), trimMat);
          urnBody.position.set(ux, 0.52, 0);
          pedimentGroup.add(urnBody);

          const urnTop = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), goldLeafMat);
          urnTop.position.set(ux, 0.72, 0);
          pedimentGroup.add(urnTop);
        }
      } else if (idx === 1) {
        // Shop 2: 源发号香料行 (Guan Huat Spice) - Stepped Dutch-Baroque Gable Pediment
        const step1 = new THREE.Mesh(new THREE.BoxGeometry(sh.width * 0.85, 0.5, 0.24), accentMat);
        step1.position.set(0, 0.25, 0);
        pedimentGroup.add(step1);

        const step2 = new THREE.Mesh(new THREE.BoxGeometry(sh.width * 0.58, 0.5, 0.24), facadeMat);
        step2.position.set(0, 0.75, 0);
        pedimentGroup.add(step2);

        const step3 = new THREE.Mesh(new THREE.BoxGeometry(sh.width * 0.34, 0.45, 0.24), accentMat);
        step3.position.set(0, 1.22, 0);
        pedimentGroup.add(step3);

        // Volute scrolls on flanks
        for (const vx of [-sh.width * 0.36, sh.width * 0.36]) {
          const volute = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 16, Math.PI), trimMat);
          volute.rotation.z = vx < 0 ? Math.PI / 2 : -Math.PI / 2;
          volute.position.set(vx, 0.5, 0.05);
          pedimentGroup.add(volute);
        }

        // Circular louvered oculus with spice crest
        const spiceCrest = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.42, 0.08, 24),
          crestMat
        );
        spiceCrest.rotation.x = Math.PI / 2;
        spiceCrest.position.set(0, 0.75, 0.1);
        pedimentGroup.add(spiceCrest);

        // Carved pineapple / nutmeg finial at apex
        const pineBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.15, 8), trimMat);
        pineBase.position.set(0, 1.52, 0);
        pedimentGroup.add(pineBase);

        const pineFinial = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18), goldLeafMat);
        pineFinial.position.set(0, 1.72, 0);
        pedimentGroup.add(pineFinial);
      } else if (idx === 2) {
        // Shop 3: 南洋航运 (Nanyang Shipping) - Neoclassical Triangular Pediment
        const pedBase = new THREE.Mesh(new THREE.BoxGeometry(sh.width + 0.15, 0.32, 0.26), accentMat);
        pedBase.position.set(0, 0.16, 0);
        pedimentGroup.add(pedBase);

        // Triangular pediment tympanum
        const triWidth = sh.width * 0.88;
        const triHeight = 1.25;
        const pedTympanum = new THREE.Mesh(
          new THREE.ConeGeometry(triWidth * 0.5, triHeight, 4),
          facadeMat
        );
        pedTympanum.rotation.y = Math.PI / 4;
        pedTympanum.scale.set(1.0, 1.0, 0.22);
        pedTympanum.position.set(0, 0.32 + triHeight / 2, 0);
        pedimentGroup.add(pedTympanum);

        // Raking dentils & cornices
        const rakeCornice = new THREE.Mesh(new THREE.BoxGeometry(sh.width * 0.94, 0.1, 0.3), trimMat);
        rakeCornice.position.set(0, 0.34, 0.08);
        pedimentGroup.add(rakeCornice);

        // Maritime crest medallion (anchor & helm)
        const maritimeCrest = new THREE.Mesh(
          new THREE.CylinderGeometry(0.44, 0.44, 0.08, 24),
          crestMat
        );
        maritimeCrest.rotation.x = Math.PI / 2;
        maritimeCrest.position.set(0, 0.76, 0.1);
        pedimentGroup.add(maritimeCrest);

        // Apex acroterion
        const apexAcroterion = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), trimMat);
        apexAcroterion.position.set(0, 1.62, 0);
        pedimentGroup.add(apexAcroterion);
      } else {
        // Shop 4: 合兴茶庄 (Hop Hing Tea House) - Swan-Neck Scrolled Baroque Pediment
        const baseBeam = new THREE.Mesh(new THREE.BoxGeometry(sh.width + 0.1, 0.35, 0.24), accentMat);
        baseBeam.position.set(0, 0.18, 0);
        pedimentGroup.add(baseBeam);

        // Dual S-curve swan neck volute scrolls
        for (const sx of [-1, 1]) {
          const scroll1 = new THREE.Mesh(
            new THREE.TorusGeometry(0.65, 0.08, 8, 16, Math.PI * 0.8),
            trimMat
          );
          scroll1.rotation.z = sx < 0 ? -0.4 : Math.PI + 0.4;
          scroll1.position.set(sx * 1.3, 0.75, 0.04);
          pedimentGroup.add(scroll1);
        }

        // Central pedestal with antique celadon tea urn finial
        const teaPedestal = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.26), accentMat);
        teaPedestal.position.set(0, 0.55, 0);
        pedimentGroup.add(teaPedestal);

        const teaCrest = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.42, 0.08, 24),
          crestMat
        );
        teaCrest.rotation.x = Math.PI / 2;
        teaCrest.position.set(0, 0.55, 0.1);
        pedimentGroup.add(teaCrest);

        // Celadon porcelain tea urn
        const teaUrnBody = new THREE.Mesh(
          new THREE.SphereGeometry(0.24, 12, 12),
          new THREE.MeshStandardMaterial({ color: 0x76a08d, roughness: 0.25, metalness: 0.1 })
        );
        teaUrnBody.position.set(0, 1.15, 0);
        pedimentGroup.add(teaUrnBody);

        const teaUrnLid = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.18, 10), goldLeafMat);
        teaUrnLid.position.set(0, 1.42, 0);
        pedimentGroup.add(teaUrnLid);
      }

      house.add(pedimentGroup);

      // -------------------------------------------------------------
      // E. Classical Chinese Interlocking Roof Tiles & Swept Ridge (筒瓦坡屋顶与起翘脊)
      // -------------------------------------------------------------
      const roofGroup = new THREE.Group();
      roofGroup.position.set(0, sh.height + 0.18, 0);

      // 1. Dual-pitch roof planes with interlocking terracotta tile texture
      const frontSlopeLen = 3.6;
      const frontSlopeAngle = 0.38; // ~22 degrees pitch slope

      const frontPitch = new THREE.Mesh(
        new THREE.PlaneGeometry(sh.width + 0.3, frontSlopeLen),
        roofTileMat
      );
      frontPitch.rotation.x = -Math.PI / 2 - frontSlopeAngle;
      frontPitch.position.set(0, 0.85, -1.95);
      frontPitch.castShadow = true;
      frontPitch.receiveShadow = true;
      roofGroup.add(frontPitch);

      // Rear slope
      const rearPitch = new THREE.Mesh(
        new THREE.PlaneGeometry(sh.width + 0.3, 3.4),
        roofTileMat
      );
      rearPitch.rotation.x = -Math.PI / 2 + frontSlopeAngle;
      rearPitch.position.set(0, 0.85, 0.85);
      roofGroup.add(rearPitch);

      // 2. 3D Convex Barrel Tile Courses (筒瓦垄) running down the front pitch
      const numTileRows = 11;
      const rowSpacing = (sh.width * 0.92) / (numTileRows - 1);

      for (let r = 0; r < numTileRows; r++) {
        const rx = -sh.width * 0.46 + r * rowSpacing;

        // Convex barrel tile rib cylinder
        const barrelRib = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.06, frontSlopeLen - 0.2, 8, 1, false, 0, Math.PI),
          terraRoofRidgeMat
        );
        barrelRib.rotation.x = Math.PI / 2 - frontSlopeAngle;
        barrelRib.position.set(rx, 0.9, -1.95);
        barrelRib.castShadow = true;
        roofGroup.add(barrelRib);

        // Circular Wadang drip medallion (瓦当) at the front eaves edge
        const wadang = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, 0.04, 12),
          terraRoofRidgeMat
        );
        wadang.rotation.x = Math.PI / 2;
        wadang.position.set(rx, 0.22, -3.5);
        roofGroup.add(wadang);

        const wadangFace = new THREE.Mesh(new THREE.CircleGeometry(0.065, 12), goldLeafMat);
        wadangFace.rotation.y = Math.PI;
        wadangFace.position.set(rx, 0.22, -3.525);
        roofGroup.add(wadangFace);

        // Pointed Drip Tile (滴水飞檐) between adjacent Wadangs
        if (r < numTileRows - 1) {
          const dripTile = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 3), terraRoofRidgeMat);
          dripTile.rotation.x = Math.PI;
          dripTile.position.set(rx + rowSpacing / 2, 0.12, -3.48);
          roofGroup.add(dripTile);
        }

        // Convex barrel tile rib & Wadang on rear pitch (+Z slope) for Bird's-Eye View fidelity
        const rearBarrelRib = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.06, 3.2, 8, 1, false, 0, Math.PI),
          terraRoofRidgeMat
        );
        rearBarrelRib.rotation.x = Math.PI / 2 + frontSlopeAngle;
        rearBarrelRib.position.set(rx, 0.9, 0.85);
        roofGroup.add(rearBarrelRib);
      }

      // 3. Minnan Swept Ridge Beam (起翘屋脊)
      const ridgeBeam = new THREE.Mesh(
        new THREE.BoxGeometry(sh.width + 0.4, 0.26, 0.36),
        terraRoofRidgeMat
      );
      ridgeBeam.position.set(0, 1.55, -0.55);
      roofGroup.add(ridgeBeam);

      // Swept upturned ridge crest ends (起翘)
      for (const rx of [-sh.width / 2 - 0.1, sh.width / 2 + 0.1]) {
        const sweptFin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.4, 0.34), terraRoofRidgeMat);
        sweptFin.position.set(rx, 1.72, -0.55);
        roofGroup.add(sweptFin);

        // Curved scroll acroterion / coiled dragon-carp finial (卷草端饰)
        const acroterion = new THREE.Mesh(
          new THREE.TorusGeometry(0.28, 0.065, 8, 16, Math.PI * 1.35),
          goldLeafMat
        );
        acroterion.rotation.z = rx < 0 ? 0.3 : Math.PI - 0.3;
        acroterion.position.set(rx, 1.95, -0.55);
        roofGroup.add(acroterion);
      }

      house.add(roofGroup);

      // -------------------------------------------------------------
      // F. Storefront Specific Props (各店特色器物)
      // -------------------------------------------------------------
      if (idx === 0) {
        // 同德堂药行: Traditional Chinese Medicine Cabinet (百子柜) silhouette inside window
        const medChest = new THREE.Mesh(
          new THREE.BoxGeometry(1.6, 1.8, 0.18),
          new THREE.MeshStandardMaterial({ color: 0x421b0e, roughness: 0.8 })
        );
        medChest.position.set(0.9, 1.1, -0.05);
        house.add(medChest);

        // Little brass drawer pulls
        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 4; col++) {
            const pull = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), goldLeafMat);
            pull.position.set(0.35 + col * 0.36, 0.45 + row * 0.32, -0.15);
            house.add(pull);
          }
        }

        // Hanging Chinese medicinal red gourd
        const gourdTop = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshStandardMaterial({ color: 0x991f17 }));
        gourdTop.position.set(-1.1, 2.1, -1.5);
        house.add(gourdTop);

        const gourdBottom = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshStandardMaterial({ color: 0x991f17 }));
        gourdBottom.position.set(-1.1, 1.94, -1.5);
        house.add(gourdBottom);
      } else if (idx === 2) {
        // 南洋航运: Brass Ship's Bell & Marine Barometer
        const bell = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.22, 12), goldLeafMat);
        bell.position.set(colXCoords[0] + 0.25, 2.05, -2.75);
        house.add(bell);

        const bellClapper = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), goldLeafMat);
        bellClapper.position.set(colXCoords[0] + 0.25, 1.92, -2.75);
        house.add(bellClapper);

        // Brass ship's barometer
        const barometer = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 16), goldLeafMat);
        barometer.rotation.x = Math.PI / 2;
        barometer.position.set(0.8, 1.7, -0.16);
        house.add(barometer);
      } else if (idx === 3) {
        // 合兴茶庄: Antique celadon tea canisters on display shelf
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.22), woodTrimMat);
        shelf.position.set(0.85, 1.35, -0.15);
        house.add(shelf);

        const celadonMat = new THREE.MeshStandardMaterial({ color: 0x6e9987, roughness: 0.3, metalness: 0.1 });
        for (let t = 0; t < 3; t++) {
          const teaJar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 10), celadonMat);
          teaJar.position.set(0.55 + t * 0.3, 1.49, -0.15);
          house.add(teaJar);

          const jarLid = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.05, 10), goldLeafMat);
          jarLid.position.set(0.55 + t * 0.3, 1.62, -0.15);
          house.add(jarLid);
        }
      }

      shophouseGroup.add(house);
    });

    // Procedural Spice Arcade Props under Guan Huat Spice arcade at (-6.20, 1.20, 14.00)
    const spiceArcadeSpot = new THREE.Group();
    spiceArcadeSpot.position.set(-6.20, 0.1, -1.5); // Local to shophouseGroup (World: -6.20, 1.20, 14.00)

    const burlapMat = new THREE.MeshStandardMaterial({ color: 0x9c8159, roughness: 0.95 });
    const spiceWoodMat = new THREE.MeshStandardMaterial({ color: 0x543c28, roughness: 0.8 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.85 });

    // 1. Nutmeg burlap sack (plump base with gathered neck)
    const nutmegSack = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), burlapMat);
    nutmegSack.scale.set(1.1, 0.75, 0.95);
    nutmegSack.position.set(-0.65, 0.24, -0.4);
    nutmegSack.castShadow = true;
    spiceArcadeSpot.add(nutmegSack);

    // 2. Open pepper sack with dark peppercorns visible
    const pepperSack = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.42, 12), burlapMat);
    pepperSack.position.set(-0.25, 0.21, -0.45);
    pepperSack.castShadow = true;
    spiceArcadeSpot.add(pepperSack);

    const pepperSurface = new THREE.Mesh(
      new THREE.CircleGeometry(0.22, 12),
      new THREE.MeshStandardMaterial({ color: 0x221d18, roughness: 0.9 })
    );
    pepperSurface.rotation.x = -Math.PI / 2;
    pepperSurface.position.set(-0.25, 0.421, -0.45);
    spiceArcadeSpot.add(pepperSurface);

    // 3. Wooden spice crate with iron straps
    const spiceCrate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.42, 0.48), spiceWoodMat);
    spiceCrate.position.set(0.45, 0.21, -0.4);
    spiceCrate.castShadow = true;
    spiceArcadeSpot.add(spiceCrate);

    // 4. Merchant's antique balance scale on small wooden bench
    const scaleBench = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.35), spiceWoodMat);
    scaleBench.position.set(0.0, 0.15, 0.5);
    spiceArcadeSpot.add(scaleBench);

    const scalePillar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.35, 8), brassMat);
    scalePillar.position.set(0.0, 0.45, 0.5);
    spiceArcadeSpot.add(scalePillar);

    const scaleBeam = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.02), brassMat);
    scaleBeam.position.set(0.0, 0.62, 0.5);
    spiceArcadeSpot.add(scaleBeam);

    shophouseGroup.add(spiceArcadeSpot);

    // --------------------------------------------------------------
    // 4.1 - 4.3 Quayside Promenade Streetscape (Decoupled to World Space)
    // --------------------------------------------------------------
    const quaysideGroup = new THREE.Group();
    quaysideGroup.position.set(0, 1.0, 0); // Sits at south bank ground elevation Y = 1.0

    // 4.1 Quayside Outdoor Dining: Striped Parasols & Bistro Tables
    const parasolColors = [0xbf3b3b, 0x2e6648];
    const parasolPositions = [[-11, 10.5], [4, 10.5]];

    parasolPositions.forEach(([px, pz], i) => {
      const cafeSpot = new THREE.Group();
      cafeSpot.position.set(px, 0, pz); // World coordinates: (px, 1.0, 10.5)

      // Striped umbrella canopy with shadow casting
      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(1.6, 0.7, 16),
        new THREE.MeshStandardMaterial({ color: parasolColors[i], roughness: 0.65 })
      );
      canopy.position.y = 2.4;
      canopy.castShadow = true;
      this.parasolCanopies.push(canopy);
      cafeSpot.add(canopy);

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8),
        woodShutterMat
      );
      pole.position.y = 1.2;
      cafeSpot.add(pole);

      // Round marble bistro table with cast-iron tripod pedestal & brass rim
      const marbleMat = new THREE.MeshStandardMaterial({ color: 0xebe8e0, roughness: 0.28, metalness: 0.05 });
      const ironBaseMat = new THREE.MeshStandardMaterial({ color: 0x1e2220, roughness: 0.55, metalness: 0.7 });
      const caneSeatMat = new THREE.MeshStandardMaterial({ color: 0xc29b61, roughness: 0.8 });
      const brassRimMat = new THREE.MeshStandardMaterial({ color: 0xc89e3c, roughness: 0.32, metalness: 0.82 });

      const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.045, 20), marbleMat);
      tableTop.position.y = 0.78;
      tableTop.castShadow = true;
      tableTop.receiveShadow = true;
      cafeSpot.add(tableTop);

      const tableRim = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.018, 8, 24), brassRimMat);
      tableRim.rotation.x = Math.PI / 2;
      tableRim.position.y = 0.78;
      cafeSpot.add(tableRim);

      const tablePedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 0.74, 10), ironBaseMat);
      tablePedestal.position.y = 0.39;
      tablePedestal.castShadow = true;
      cafeSpot.add(tablePedestal);

      const tableFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.05, 12), ironBaseMat);
      tableFoot.position.y = 0.025;
      cafeSpot.add(tableFoot);

      // Porcelain Kopi-O cups & saucers on table
      for (const cx of [-0.22, 0.24]) {
        const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.014, 12), marbleMat);
        saucer.position.set(cx, 0.81, 0.12 * (cx > 0 ? 1 : -1));
        cafeSpot.add(saucer);
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.036, 0.065, 10), marbleMat);
        cup.position.set(cx, 0.845, 0.12 * (cx > 0 ? 1 : -1));
        cafeSpot.add(cup);
      }

      // Authentic Thonet-style Bentwood Bistro Chairs around table
      for (let c = 0; c < 2; c++) {
        const chairGroup = new THREE.Group();
        const dir = c === 0 ? -1 : 1;
        chairGroup.position.set(dir * 0.86, 0, 0);
        chairGroup.rotation.y = dir * (Math.PI / 2);

        // Circular woven rattan cane seat & bentwood frame ring
        const seatDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.026, 16), caneSeatMat);
        seatDisc.position.y = 0.46;
        seatDisc.castShadow = true;
        chairGroup.add(seatDisc);

        const seatRim = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.018, 8, 18), woodShutterMat);
        seatRim.rotation.x = Math.PI / 2;
        seatRim.position.y = 0.46;
        chairGroup.add(seatRim);

        // Lower bentwood circular leg-stretcher hoop
        const stretcherRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 6, 16), woodShutterMat);
        stretcherRing.rotation.x = Math.PI / 2;
        stretcherRing.position.y = 0.18;
        chairGroup.add(stretcherRing);

        // 4 tapered splayed cylindrical legs
        for (const [lx, lz] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.011, 0.46, 8), woodShutterMat);
          leg.position.set(lx, 0.23, lz);
          leg.rotation.z = lx * 0.18;
          leg.rotation.x = -lz * 0.18;
          leg.castShadow = true;
          chairGroup.add(leg);
        }

        // Steam-bent arched backrest outer loop & inner hoop
        const backArch = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.018, 8, 16, Math.PI), woodShutterMat);
        backArch.position.set(0, 0.70, -0.19);
        backArch.rotation.x = -0.10;
        backArch.castShadow = true;
        chairGroup.add(backArch);

        for (const postX of [-0.20, 0.20]) {
          const backPost = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.26, 8), woodShutterMat);
          backPost.position.set(postX, 0.58, -0.18);
          backPost.rotation.x = -0.10;
          chairGroup.add(backPost);
        }

        const innerHeart = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 6, 14), woodShutterMat);
        innerHeart.position.set(0, 0.72, -0.20);
        innerHeart.rotation.x = -0.10;
        chairGroup.add(innerHeart);

        cafeSpot.add(chairGroup);
      }

      quaysideGroup.add(cafeSpot);
    });

    // 4.2 Carved Timber & Terracotta Flower Planter Boxes with Lush Bougainvillea Shrubs
    const planterMat = new THREE.MeshStandardMaterial({ color: 0x4a3224, roughness: 0.82 });
    const planterTrimMat = new THREE.MeshStandardMaterial({ color: 0x6b4832, roughness: 0.72 });
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x261a12, roughness: 0.95 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x24522a, roughness: 0.75 });
    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xd8296a, roughness: 0.55 });
    const coralFlowerMat = new THREE.MeshStandardMaterial({ color: 0xf04878, roughness: 0.5 });

    for (const bx of [-8.5, -1.5, 7.5]) {
      const planterGroup = new THREE.Group();
      planterGroup.position.set(bx, 0, 9.8);

      const planterBox = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.46, 0.56), planterMat);
      planterBox.position.y = 0.23;
      planterBox.castShadow = true;
      planterBox.receiveShadow = true;
      planterGroup.add(planterBox);

      const topCapping = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.06, 0.64), planterTrimMat);
      topCapping.position.y = 0.48;
      planterGroup.add(topCapping);

      const soilBed = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.04, 0.48), soilMat);
      soilBed.position.y = 0.47;
      planterGroup.add(soilBed);

      const shrubGroup = new THREE.Group();
      shrubGroup.position.y = 0.52;

      for (let f = 0; f < 5; f++) {
        const fx = -0.64 + f * 0.32;
        const leafMound = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), leafMat);
        leafMound.scale.set(1.15, 0.85, 1.05);
        leafMound.position.set(fx, 0.08 + (f % 2) * 0.05, (f % 2 === 0 ? 0.04 : -0.04));
        leafMound.castShadow = true;
        shrubGroup.add(leafMound);

        // Multi-bract bougainvillea bloom crowns
        for (let b = 0; b < 3; b++) {
          const bract = new THREE.Mesh(
            new THREE.SphereGeometry(0.11, 8, 6),
            (f + b) % 2 === 0 ? flowerMat : coralFlowerMat
          );
          bract.scale.set(1.25, 0.78, 1.15);
          bract.position.set(
            fx + (b - 1) * 0.09,
            0.22 + (b % 2) * 0.06,
            (b % 2 === 0 ? 0.08 : -0.06)
          );
          shrubGroup.add(bract);
        }
      }

      this.floweringBushes.push(shrubGroup);
      planterGroup.add(shrubGroup);
      quaysideGroup.add(planterGroup);
    }

    // 4.3 Overhead Festive String Lights (挂饰暖黄小灯串)
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe085 });
    for (let x = -13; x <= 8; x += 1.8) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), bulbMat);
      const sag = Math.sin((x + 13) / 21 * Math.PI) * 0.4;
      bulb.position.set(x, 3.4 - sag, 11.2); // World Z = 11.2, World Y = 4.4 - sag
      this.stringLightGlows.push(bulb);
      quaysideGroup.add(bulb);
    }

    this.root.add(quaysideGroup);
    this.root.add(shophouseGroup);
  }

  /* -------------------------------------------------------------- */
  /* 5. Historical Harbor Trade Logistics (香料货运、黄包车与市井细构)  */
  /* -------------------------------------------------------------- */
  private buildHarborTradeProps() {
    const tradeGroup = new THREE.Group();

    // Shared high-grade architectural and historical materials
    const woodCrateMat = new THREE.MeshStandardMaterial({
      map: getWoodPlankTexture(),
      roughness: 0.82
    });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x222424, roughness: 0.45, metalness: 0.85 });
    const rustIronMat = new THREE.MeshStandardMaterial({ color: 0x3d2c22, roughness: 0.8, metalness: 0.4 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.32, metalness: 0.88 });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x3b271a, roughness: 0.72 });
    const bambooMat = new THREE.MeshStandardMaterial({ color: 0x9e8548, roughness: 0.65 });
    const glazedJarMat = new THREE.MeshStandardMaterial({ color: 0x5a331c, roughness: 0.28, metalness: 0.15 });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x481b16, roughness: 0.52 });
    const canvasHoodMat = new THREE.MeshStandardMaterial({ color: 0xdcd1b8, roughness: 0.88 });
    const rubberMat = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.9 });
    const spiceSackMat = new THREE.MeshStandardMaterial({
      map: getSpiceSackTexture(),
      roughness: 0.95
    });

    /* ============================================================== */
    /* 5.1 19th-Century Vintage Rickshaw (老式双轮人力黄包车)          */
    /* ============================================================== */
    const rickshaw = new THREE.Group();
    rickshaw.position.set(-8.6, 1.0, 11.6);
    rickshaw.rotation.y = 0.28;

    // A. Spoked Wooden Wheels with Iron Banding (左右大车轮)
    const wheelRadius = 0.46;
    for (const wx of [-0.48, 0.48]) {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(wx, wheelRadius, 0);

      // Outer iron rim
      const ironRim = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius, 0.016, 8, 24), ironMat);
      ironRim.rotation.y = Math.PI / 2;
      wheelGroup.add(ironRim);

      // Wooden felloe ring
      const woodFelloe = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius - 0.018, 0.018, 8, 24), darkWoodMat);
      woodFelloe.rotation.y = Math.PI / 2;
      wheelGroup.add(woodFelloe);

      // Brass central axle hub
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.12, 12), brassMat);
      hub.rotation.z = Math.PI / 2;
      wheelGroup.add(hub);

      // 12 Radial wooden spokes
      for (let sp = 0; sp < 12; sp++) {
        const angle = (sp / 12) * Math.PI * 2;
        const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, wheelRadius * 0.9, 6), darkWoodMat);
        spoke.position.set(0, (Math.sin(angle) * wheelRadius) * 0.48, (Math.cos(angle) * wheelRadius) * 0.48);
        spoke.rotation.x = angle;
        wheelGroup.add(spoke);
      }

      // Curved brass mudguard over top arch
      const mudguard = new THREE.Mesh(new THREE.TorusGeometry(wheelRadius + 0.035, 0.018, 6, 16, Math.PI * 0.65), brassMat);
      mudguard.rotation.y = Math.PI / 2;
      mudguard.rotation.x = -Math.PI * 0.32;
      wheelGroup.add(mudguard);

      rickshaw.add(wheelGroup);
    }

    // B. Through Axle & Elliptical Leaf Spring Dampers (轴杆与钢板减震)
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.02, 8), ironMat);
    axle.position.set(0, wheelRadius, 0);
    axle.rotation.z = Math.PI / 2;
    rickshaw.add(axle);

    for (const sx of [-0.36, 0.36]) {
      const spring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 6, 12, Math.PI * 0.6), ironMat);
      spring.position.set(sx, wheelRadius + 0.06, 0);
      spring.rotation.y = Math.PI / 2;
      spring.rotation.x = -Math.PI * 0.3;
      rickshaw.add(spring);
    }

    // C. Passenger Carriage & Tufted Leather Bench (乘客木轿厢与皮革软包坐席)
    const carriageBase = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.58), darkWoodMat);
    carriageBase.position.set(0, wheelRadius + 0.16, -0.04);
    rickshaw.add(carriageBase);

    // Tufted leather seat cushion
    const seatCushion = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.12, 0.38), leatherMat);
    seatCushion.position.set(0, wheelRadius + 0.25, -0.08);
    seatCushion.castShadow = true;
    rickshaw.add(seatCushion);

    // Leather backrest
    const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.44, 0.08), leatherMat);
    backrest.position.set(0, wheelRadius + 0.52, -0.28);
    backrest.rotation.x = -0.15;
    rickshaw.add(backrest);

    // Carved wood armrests
    for (const ax of [-0.34, 0.34]) {
      const armrest = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.38), darkWoodMat);
      armrest.position.set(ax, wheelRadius + 0.38, -0.08);
      rickshaw.add(armrest);
    }

    // Footrest platform (踏脚台)
    const footrest = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.035, 0.38), darkWoodMat);
    footrest.position.set(0, wheelRadius - 0.12, 0.32);
    rickshaw.add(footrest);

    // Iron footrest support hangers
    for (const hx of [-0.28, 0.28]) {
      const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.32, 6), ironMat);
      hanger.position.set(hx, wheelRadius + 0.02, 0.28);
      hanger.rotation.x = 0.25;
      rickshaw.add(hanger);
    }

    // D. Folding Convertible Canvas Canopy with Brass Ribs (可折叠防雨篷布与铜骨架)
    const canopy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44, 0.44, 0.74, 16, 1, true, 0, Math.PI * 0.65),
      canvasHoodMat
    );
    canopy.position.set(0, wheelRadius + 0.72, -0.18);
    canopy.rotation.z = Math.PI / 2;
    canopy.rotation.y = -Math.PI * 0.15;
    canopy.castShadow = true;
    rickshaw.add(canopy);

    // Brass folding rib struts
    for (const rx of [-0.37, 0.37]) {
      for (const ribAngle of [-0.4, 0, 0.4]) {
        const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.46, 6), brassMat);
        rib.position.set(rx, wheelRadius + 0.54 + Math.sin(ribAngle + 0.5) * 0.2, -0.22 - Math.cos(ribAngle + 0.5) * 0.18);
        rib.rotation.x = ribAngle;
        rickshaw.add(rib);
      }
    }

    // E. Long Pulling Shafts & Ground Kickstand (车辕拉手与驻车支架)
    for (const px of [-0.28, 0.28]) {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 1.35, 8), darkWoodMat);
      shaft.position.set(px, wheelRadius - 0.08, 0.95);
      shaft.rotation.x = Math.PI / 2 - 0.14;
      rickshaw.add(shaft);

      // Brass ferrule tip
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 8), brassMat);
      tip.position.set(px, wheelRadius - 0.18, 1.6);
      tip.rotation.x = Math.PI / 2 - 0.14;
      rickshaw.add(tip);
    }

    // Front pulling crossbar
    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.62, 8), darkWoodMat);
    crossbar.position.set(0, wheelRadius - 0.17, 1.56);
    crossbar.rotation.z = Math.PI / 2;
    rickshaw.add(crossbar);

    // Resting kickstand under shaft
    const kickstand = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 6), ironMat);
    kickstand.position.set(0, wheelRadius - 0.3, 1.25);
    kickstand.rotation.x = -0.15;
    rickshaw.add(kickstand);

    // Hanging undercarriage kerosene hurricane lantern
    const lantern = new THREE.Group();
    lantern.position.set(0, wheelRadius + 0.04, -0.12);
    const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.06, 8), brassMat);
    lantern.add(lanternCap);
    const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.09, 8), new THREE.MeshBasicMaterial({ color: 0xffaa44 }));
    lanternGlass.position.y = -0.06;
    lantern.add(lanternGlass);
    rickshaw.add(lantern);

    tradeGroup.add(rickshaw);

    /* ============================================================== */
    /* 5.2 Heavy Two-Wheeled Dock Cargo Handcart (南洋码头双轮重型木推车) */
    /* ============================================================== */
    const cart = new THREE.Group();
    cart.position.set(-4.2, 1.0, -2.6);
    cart.rotation.y = -0.45;

    const cartWheelRadius = 0.44;
    // Wooden bed frame with slatted planks
    const cartBed = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.07, 1.05), woodCrateMat);
    cartBed.position.set(0, cartWheelRadius + 0.12, 0);
    cartBed.castShadow = true;
    cartBed.receiveShadow = true;
    cart.add(cartBed);

    // Side stake sideboards (插桩护栏)
    for (const cz of [-0.48, 0.48]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.05, 0.04), darkWoodMat);
      rail.position.set(0, cartWheelRadius + 0.32, cz);
      cart.add(rail);

      for (let cx = -0.65; cx <= 0.65; cx += 0.43) {
        const stake = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.28, 0.04), darkWoodMat);
        stake.position.set(cx, cartWheelRadius + 0.22, cz);
        cart.add(stake);
      }
    }

    // Heavy iron-bound spoked wheels
    for (const wx of [-0.58, 0.58]) {
      const cWheel = new THREE.Group();
      cWheel.position.set(0, cartWheelRadius, wx);

      const cRim = new THREE.Mesh(new THREE.TorusGeometry(cartWheelRadius, 0.024, 8, 20), ironMat);
      cRim.rotation.x = Math.PI / 2;
      cWheel.add(cRim);

      const cHub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 12), darkWoodMat);
      cHub.rotation.x = Math.PI / 2;
      cWheel.add(cHub);

      for (let sp = 0; sp < 10; sp++) {
        const spAngle = (sp / 10) * Math.PI * 2;
        const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, cartWheelRadius * 0.9, 6), darkWoodMat);
        spoke.position.set((Math.cos(spAngle) * cartWheelRadius) * 0.48, (Math.sin(spAngle) * cartWheelRadius) * 0.48, 0);
        spoke.rotation.z = spAngle;
        cWheel.add(spoke);
      }
      cart.add(cWheel);
    }

    // Cart through-axle
    const cartAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.28, 8), ironMat);
    cartAxle.position.set(0, cartWheelRadius, 0);
    cartAxle.rotation.x = Math.PI / 2;
    cart.add(cartAxle);

    // Front pulling T-handle shaft extending forward
    const cartHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 1.45, 8), darkWoodMat);
    cartHandle.position.set(1.2, cartWheelRadius - 0.06, 0);
    cartHandle.rotation.z = -Math.PI / 2 + 0.22;
    cart.add(cartHandle);

    const cartHandleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 8), darkWoodMat);
    cartHandleBar.position.set(1.85, cartWheelRadius - 0.22, 0);
    cartHandleBar.rotation.x = Math.PI / 2;
    cart.add(cartHandleBar);

    // Ground rest leg
    const cartLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6), darkWoodMat);
    cartLeg.position.set(0.65, cartWheelRadius - 0.24, 0);
    cart.add(cartLeg);

    // Cargo on cart bed: 2 stenciled spice sacks & 1 tea chest
    const cartSack1 = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.72, 12), spiceSackMat);
    cartSack1.position.set(-0.25, cartWheelRadius + 0.25, -0.16);
    cartSack1.rotation.set(Math.PI / 2, 0, 0.2);
    cartSack1.scale.set(1.15, 0.75, 1.0);
    cart.add(cartSack1);

    const cartSack2 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.68, 12), spiceSackMat);
    cartSack2.position.set(-0.2, cartWheelRadius + 0.24, 0.2);
    cartSack2.rotation.set(Math.PI / 2, 0, -0.15);
    cartSack2.scale.set(1.1, 0.72, 1.0);
    cart.add(cartSack2);

    const cartChest = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.52), woodCrateMat);
    cartChest.position.set(0.35, cartWheelRadius + 0.3, 0);
    cart.add(cartChest);

    tradeGroup.add(cart);

    // 5.3 Stacked Vintage Tea Crates near River Pier
    const crateConfigs = [
      { pos: [-3.8, 1.4, -3.2], size: [0.9, 0.7, 0.9], rot: 0.1 },
      { pos: [-4.0, 2.05, -3.1], size: [0.8, 0.6, 0.8], rot: -0.15 },
      { pos: [-4.8, 1.35, -3.3], size: [0.85, 0.65, 0.85], rot: 0.05 },
      { pos: [10.5, 1.4, -2.4], size: [0.9, 0.7, 0.9], rot: 0.2 },
      { pos: [11.3, 1.35, -2.3], size: [0.8, 0.6, 0.8], rot: -0.1 }
    ];

    crateConfigs.forEach((cfg) => {
      const crate = new THREE.Group();
      crate.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      crate.rotation.y = cfg.rot;

      const body = new THREE.Mesh(new THREE.BoxGeometry(cfg.size[0], cfg.size[1], cfg.size[2]), woodCrateMat);
      crate.add(body);

      // Reinforcing iron corner straps
      const strap = new THREE.Mesh(new THREE.BoxGeometry(cfg.size[0] * 1.02, 0.08, cfg.size[2] * 1.02), ironMat);
      crate.add(strap);

      tradeGroup.add(crate);
    });

    /* ============================================================== */
    /* 5.3 Tong De Tang Traditional Herbal Drying Bamboo Racks       */
    /*     (同德堂门前传统晾药竹架与手工竹编药匾)                     */
    /* ============================================================== */
    const herbalRack = new THREE.Group();
    herbalRack.position.set(-14.2, 1.0, 12.2);
    herbalRack.rotation.y = 0.15;

    // A-frame lashed bamboo supports (左右A字竹立架)
    for (const ax of [-0.95, 0.95]) {
      const trestle = new THREE.Group();
      trestle.position.set(ax, 0, 0);

      for (const [legZ, rotX] of [[-0.34, 0.32], [0.34, -0.32]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 1.35, 8), bambooMat);
        leg.position.set(0, 0.62, legZ);
        leg.rotation.x = rotX;
        trestle.add(leg);

        for (const ny of [0.3, 0.6, 0.9]) {
          const nodeRing = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 6, 12), darkWoodMat);
          nodeRing.position.set(0, ny, legZ + (rotX > 0 ? (0.62 - ny) * 0.32 : (ny - 0.62) * 0.32));
          nodeRing.rotation.x = Math.PI / 2;
          trestle.add(nodeRing);
        }
      }

      const crossTie = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.52, 8), bambooMat);
      crossTie.position.set(0, 0.38, 0);
      crossTie.rotation.x = Math.PI / 2;
      trestle.add(crossTie);

      herbalRack.add(trestle);
    }

    for (const [ry, rz] of [[0.92, -0.12], [0.72, 0.16]]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.2, 8), bambooMat);
      rail.position.set(0, ry, rz);
      rail.rotation.z = Math.PI / 2;
      herbalRack.add(rail);
    }

    const wovenMat = new THREE.MeshStandardMaterial({
      map: getWovenBambooTexture(),
      roughness: 0.78
    });
    const gojiMat = new THREE.MeshStandardMaterial({ color: 0x9e1a14, roughness: 0.65 });
    const starAniseMat = new THREE.MeshStandardMaterial({ color: 0x5a2d18, roughness: 0.72 });
    const herbSliceMat = new THREE.MeshStandardMaterial({ color: 0xc4a77d, roughness: 0.8 });

    const trayConfigs = [
      { x: -0.62, y: 0.88, z: 0.02, rotX: 0.26, herb: "goji" },
      { x: 0.02, y: 0.92, z: 0.0, rotX: 0.28, herb: "anise" },
      { x: 0.66, y: 0.86, z: 0.04, rotX: 0.24, herb: "angelica" }
    ];

    trayConfigs.forEach((cfg) => {
      const trayGroup = new THREE.Group();
      trayGroup.position.set(cfg.x, cfg.y, cfg.z);
      trayGroup.rotation.x = cfg.rotX;

      const trayDisk = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.025, 24), wovenMat);
      trayDisk.castShadow = true;
      trayGroup.add(trayDisk);

      const trayRim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.018, 8, 24), bambooMat);
      trayRim.rotation.x = Math.PI / 2;
      trayGroup.add(trayRim);

      if (cfg.herb === "goji") {
        for (let g = 0; g < 18; g++) {
          const angle = Math.random() * Math.PI * 2;
          const rad = Math.random() * 0.26;
          const berry = new THREE.Mesh(new THREE.DodecahedronGeometry(0.022), gojiMat);
          berry.position.set(Math.cos(angle) * rad, 0.02, Math.sin(angle) * rad);
          trayGroup.add(berry);
        }
      } else if (cfg.herb === "anise") {
        for (let a = 0; a < 7; a++) {
          const angle = (a / 7) * Math.PI * 2 + Math.random() * 0.3;
          const rad = 0.08 + Math.random() * 0.18;
          const anise = new THREE.Mesh(new THREE.DodecahedronGeometry(0.042), starAniseMat);
          anise.scale.set(1.3, 0.45, 1.3);
          anise.position.set(Math.cos(angle) * rad, 0.025, Math.sin(angle) * rad);
          trayGroup.add(anise);
        }
      } else {
        for (let s = 0; s < 12; s++) {
          const angle = Math.random() * Math.PI * 2;
          const rad = Math.random() * 0.25;
          const slice = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.008, 8), herbSliceMat);
          slice.position.set(Math.cos(angle) * rad, 0.018, Math.sin(angle) * rad);
          slice.rotation.set(Math.random() * 0.2, Math.random() * Math.PI, Math.random() * 0.2);
          trayGroup.add(slice);
        }
      }

      herbalRack.add(trayGroup);
    });

    tradeGroup.add(herbalRack);

    /* ============================================================== */
    /* 5.4 Guan Huat Spice Merchant Sack Pyramids & Stenciled Burlap  */
    /*     (源发号特选香料重叠麻袋堆)                                 */
    /* ============================================================== */
    const sackClusters = [
      { root: [-6.8, 1.0, 12.0], rot: 0.1 },
      { root: [-5.6, 1.25, -2.8], rot: -0.3 }
    ];

    sackClusters.forEach((cluster) => {
      const sackGroup = new THREE.Group();
      sackGroup.position.set(cluster.root[0], cluster.root[1], cluster.root[2]);
      sackGroup.rotation.y = cluster.rot;

      const sackLayout = [
        { pos: [-0.34, 0.16, -0.16], rotY: 0.15, rotZ: 0.05, s: [1.15, 0.72, 0.95] },
        { pos: [0.32, 0.16, -0.18], rotY: -0.25, rotZ: -0.06, s: [1.18, 0.74, 0.92] },
        { pos: [0.0, 0.16, 0.26], rotY: 0.05, rotZ: 0.08, s: [1.14, 0.7, 0.96] },
        { pos: [-0.18, 0.44, 0.02], rotY: -0.12, rotZ: -0.04, s: [1.12, 0.68, 0.94] },
        { pos: [0.18, 0.44, 0.04], rotY: 0.22, rotZ: 0.05, s: [1.1, 0.66, 0.92] },
        { pos: [0.0, 0.72, 0.02], rotY: 0.08, rotZ: 0.02, s: [1.08, 0.65, 0.9] }
      ];

      sackLayout.forEach((sl) => {
        const singleSack = new THREE.Group();
        singleSack.position.set(sl.pos[0], sl.pos[1], sl.pos[2]);
        singleSack.rotation.y = sl.rotY;
        singleSack.rotation.z = sl.rotZ;

        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.58, 12), spiceSackMat);
        body.scale.set(sl.s[0], sl.s[1], sl.s[2]);
        body.castShadow = true;
        singleSack.add(body);

        const cinch = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.022, 6, 12), darkWoodMat);
        cinch.position.y = 0.27 * sl.s[1];
        cinch.rotation.x = Math.PI / 2;
        singleSack.add(cinch);

        const ruffle = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.12, 10, 1, true), spiceSackMat);
        ruffle.position.y = 0.35 * sl.s[1];
        ruffle.rotation.x = Math.PI;
        singleSack.add(ruffle);

        sackGroup.add(singleSack);
      });

      tradeGroup.add(sackGroup);
    });

    /* ============================================================== */
    /* 5.5 Vintage Roadster Bicycle (老式二八大杠加重脚踏车)           */
    /* ============================================================== */
    const bicycle = new THREE.Group();
    bicycle.position.set(-0.85, 1.0, 12.5);
    bicycle.rotation.set(0.08, 0.35, 0.12);

    const bikeFrameMat = new THREE.MeshStandardMaterial({ color: 0x14181a, roughness: 0.35, metalness: 0.85 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd8dcd8, roughness: 0.25, metalness: 0.95 });

    const bWheelR = 0.35;
    for (const [bx] of [[-0.56], [0.56]]) {
      const bWheel = new THREE.Group();
      bWheel.position.set(bx, bWheelR, 0);

      const tire = new THREE.Mesh(new THREE.TorusGeometry(bWheelR, 0.018, 8, 24), rubberMat);
      bWheel.add(tire);

      const rim = new THREE.Mesh(new THREE.TorusGeometry(bWheelR - 0.016, 0.012, 8, 24), chromeMat);
      bWheel.add(rim);

      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.08, 8), chromeMat);
      hub.rotation.x = Math.PI / 2;
      bWheel.add(hub);

      for (let sp = 0; sp < 12; sp++) {
        const ang = (sp / 12) * Math.PI * 2;
        const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, bWheelR * 0.92, 4), chromeMat);
        spoke.position.set((Math.cos(ang) * bWheelR) * 0.48, (Math.sin(ang) * bWheelR) * 0.48, 0);
        spoke.rotation.z = ang;
        bWheel.add(spoke);
      }

      bicycle.add(bWheel);
    }

    // Classic Diamond Double-Top-Tube Steel Frame
    for (const ty of [bWheelR + 0.34, bWheelR + 0.28]) {
      const topTube = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.58, 8), bikeFrameMat);
      topTube.position.set(0.2, ty, 0);
      topTube.rotation.z = Math.PI / 2;
      bicycle.add(topTube);
    }

    const downTube = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.64, 8), bikeFrameMat);
    downTube.position.set(0.22, bWheelR + 0.14, 0);
    downTube.rotation.z = 0.72;
    bicycle.add(downTube);

    const seatTube = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.48, 8), bikeFrameMat);
    seatTube.position.set(-0.06, bWheelR + 0.18, 0);
    seatTube.rotation.z = -0.22;
    bicycle.add(seatTube);

    const seatStay = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.52, 6), bikeFrameMat);
    seatStay.position.set(-0.32, bWheelR + 0.18, 0);
    seatStay.rotation.z = 0.82;
    bicycle.add(seatStay);

    const chainStay = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 6), bikeFrameMat);
    chainStay.position.set(-0.31, bWheelR - 0.02, 0);
    chainStay.rotation.z = Math.PI / 2;
    bicycle.add(chainStay);

    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.46, 6), chromeMat);
    fork.position.set(0.52, bWheelR + 0.18, 0);
    fork.rotation.z = -0.28;
    bicycle.add(fork);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6), chromeMat);
    stem.position.set(0.48, bWheelR + 0.44, 0);
    bicycle.add(stem);

    const handlebar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.011, 6, 12, Math.PI * 0.75), chromeMat);
    handlebar.position.set(0.44, bWheelR + 0.48, 0);
    handlebar.rotation.x = Math.PI / 2;
    handlebar.rotation.z = -Math.PI * 0.12;
    bicycle.add(handlebar);

    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), chromeMat);
    bell.position.set(0.44, bWheelR + 0.51, 0.14);
    bicycle.add(bell);

    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.32), wovenMat);
    basket.position.set(0.62, bWheelR + 0.38, 0);
    bicycle.add(basket);

    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.16), leatherMat);
    saddle.position.set(-0.1, bWheelR + 0.43, 0);
    bicycle.add(saddle);

    for (const sz of [-0.04, 0.04]) {
      const saddleSpring = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.06, 6), chromeMat);
      saddleSpring.position.set(-0.16, bWheelR + 0.38, sz);
      bicycle.add(saddleSpring);
    }

    const chainring = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.012, 12), chromeMat);
    chainring.position.set(-0.06, bWheelR - 0.05, 0.04);
    chainring.rotation.x = Math.PI / 2;
    bicycle.add(chainring);

    tradeGroup.add(bicycle);

    /* ============================================================== */
    /* 5.6 Traditional Terracotta Dragon Water Jars (浮雕龙纹储水大陶缸) */
    /* ============================================================== */
    const waterJarPositions = [
      [-10.8, 1.0, 12.3],
      [3.8, 1.0, 12.4]
    ];

    waterJarPositions.forEach(([jx, jy, jz]) => {
      const jarGroup = new THREE.Group();
      jarGroup.position.set(jx, jy, jz);

      const jarBody = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.28, 0.72, 16), glazedJarMat);
      jarBody.position.y = 0.36;
      jarBody.castShadow = true;
      jarGroup.add(jarBody);

      const belly = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 8, 20), glazedJarMat);
      belly.position.y = 0.38;
      belly.rotation.x = Math.PI / 2;
      jarGroup.add(belly);

      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.045, 8, 20), glazedJarMat);
      rim.position.y = 0.72;
      rim.rotation.x = Math.PI / 2;
      jarGroup.add(rim);

      const waterDisc = new THREE.Mesh(
        new THREE.CircleGeometry(0.35, 16),
        new THREE.MeshStandardMaterial({ color: 0x14282c, roughness: 0.1, metalness: 0.85 })
      );
      waterDisc.position.y = 0.65;
      waterDisc.rotation.x = -Math.PI / 2;
      jarGroup.add(waterDisc);

      const woodLid = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.03, 16, 1, false, 0, Math.PI), darkWoodMat);
      woodLid.position.y = 0.74;
      woodLid.rotation.y = 0.4;
      jarGroup.add(woodLid);

      const dipperHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.58, 6), bambooMat);
      dipperHandle.position.set(0.1, 0.76, 0.05);
      dipperHandle.rotation.set(0.1, 0.8, Math.PI / 2);
      jarGroup.add(dipperHandle);

      const dipperCup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.08, 8), bambooMat);
      dipperCup.position.set(0.34, 0.77, 0.18);
      jarGroup.add(dipperCup);

      tradeGroup.add(jarGroup);
    });

    /* ============================================================== */
    /* 5.7 Dockside Capstan Winch & Admiralty Anchor (码头铸铁绞盘与铁锚) */
    /* ============================================================== */
    const winchGroup = new THREE.Group();
    winchGroup.position.set(5.8, 1.25, -2.8);

    const capstanBase = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.54, 0.16, 16), ironMat);
    capstanBase.position.y = 0.08;
    winchGroup.add(capstanBase);

    const capstanWaist = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.68, 16), ironMat);
    capstanWaist.position.y = 0.48;
    winchGroup.add(capstanWaist);

    const capstanHead = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.34, 0.22, 16), ironMat);
    capstanHead.position.y = 0.92;
    winchGroup.add(capstanHead);

    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x8a7248, roughness: 0.95 });
    for (let c = 0; c < 4; c++) {
      const ropeTurn = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.038, 6, 16), ropeMat);
      ropeTurn.position.y = 0.32 + c * 0.075;
      ropeTurn.rotation.x = Math.PI / 2;
      winchGroup.add(ropeTurn);
    }

    for (let b = 0; b < 4; b++) {
      const angle = (b / 4) * Math.PI;
      const pushBar = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 1.45, 8), darkWoodMat);
      pushBar.position.set(0, 0.92, 0);
      pushBar.rotation.y = angle;
      pushBar.rotation.z = Math.PI / 2;
      winchGroup.add(pushBar);
    }

    const anchor = new THREE.Group();
    anchor.position.set(-0.95, 0.1, 0.15);
    anchor.rotation.set(-0.25, 0.4, 0.32);

    const shank = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.45, 0.08), rustIronMat);
    shank.position.y = 0.72;
    anchor.add(shank);

    const stockBar = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.09, 0.09), darkWoodMat);
    stockBar.position.set(0, 1.32, 0);
    anchor.add(stockBar);

    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 12), ironMat);
    shackle.position.set(0, 1.45, 0);
    anchor.add(shackle);

    const anchorArms = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.045, 6, 16, Math.PI), rustIronMat);
    anchorArms.position.set(0, 0.22, 0);
    anchorArms.rotation.z = Math.PI;
    anchor.add(anchorArms);

    for (const fx of [-0.38, 0.38]) {
      const fluke = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 4), rustIronMat);
      fluke.position.set(fx, 0.28, 0);
      fluke.rotation.z = fx < 0 ? -0.4 : 0.4;
      anchor.add(fluke);
    }

    for (let l = 0; l < 8; l++) {
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 10), ironMat);
      link.position.set(-0.85 + l * 0.09, 0.02, 0.3 + l * 0.06);
      link.rotation.set(Math.PI / 2 + (l % 2) * 0.8, (l % 2) * 0.5, 0);
      winchGroup.add(link);
    }

    winchGroup.add(anchor);
    tradeGroup.add(winchGroup);

    /* ============================================================== */
    /* 5.8 Antique Brass Maritime Telescope on Stone Viewing Pedestal */
    /*     (保留望远镜交互点位 [-16.5, 1.1, -1.8] 与精细结构)        */
    /* ============================================================== */
    const telescopeGroup = new THREE.Group();
    telescopeGroup.position.set(-16.5, 1.1, -1.8);

    const plinthMat = new THREE.MeshStandardMaterial({ color: 0xc4bfa8, roughness: 0.75 });
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.54, 0.24, 8), plinthMat);
    plinth.position.y = 0.12;
    telescopeGroup.add(plinth);

    const tripodMat = new THREE.MeshStandardMaterial({ color: 0x3d2616, roughness: 0.65 });
    for (let t = 0; t < 3; t++) {
      const legAng = t * ((Math.PI * 2) / 3);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.032, 1.35, 8), tripodMat);
      leg.position.set(Math.cos(legAng) * 0.26, 0.78, Math.sin(legAng) * 0.26);
      leg.rotation.z = Math.cos(legAng) * 0.22;
      leg.rotation.x = Math.sin(legAng) * 0.22;
      telescopeGroup.add(leg);

      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 6), brassMat);
      strut.position.set(Math.cos(legAng) * 0.14, 0.62, Math.sin(legAng) * 0.14);
      strut.rotation.z = Math.cos(legAng) * 0.5;
      telescopeGroup.add(strut);
    }

    const gimbal = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.14, 12), brassMat);
    gimbal.position.y = 1.38;
    telescopeGroup.add(gimbal);

    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.12, 1.15, 16), brassMat);
    scopeTube.position.set(0, 1.48, 0);
    scopeTube.rotation.z = Math.PI / 2 + 0.22;
    scopeTube.rotation.y = -0.45;
    telescopeGroup.add(scopeTube);

    const objHood = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.22, 16), brassMat);
    objHood.position.set(-0.48, 1.58, 0.22);
    objHood.rotation.z = Math.PI / 2 + 0.22;
    objHood.rotation.y = -0.45;
    telescopeGroup.add(objHood);

    const focusWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 12), brassMat);
    focusWheel.position.set(0.35, 1.4, -0.16);
    telescopeGroup.add(focusWheel);

    tradeGroup.add(telescopeGroup);

    this.root.add(tradeGroup);
  }

  /* -------------------------------------------------------------- */
  /* 6. National Colonial Museum Facade & Forecourt Courtyard       */
  /*    (古典主义国家历史博物馆与前庭广场 - 建筑学深度手雕精构)     */
  /* -------------------------------------------------------------- */
  private buildColonialMuseum() {
    const museum = new THREE.Group();
    museum.position.set(-20, 1.0, -14);

    // Neoclassical architectural materials (warm ivory colonial stucco, free of river algae)
    const ashlarTex = getColonialStuccoTexture();
    ashlarTex.wrapS = THREE.RepeatWrapping;
    ashlarTex.wrapT = THREE.RepeatWrapping;
    ashlarTex.repeat.set(4, 2);
    const ashlarStoneMat = new THREE.MeshStandardMaterial({
      color: 0xf7f2e7,
      map: ashlarTex,
      roughness: 0.72,
      metalness: 0.04
    });

    const rusticatedTex = getColonialStuccoTexture();
    rusticatedTex.wrapS = THREE.RepeatWrapping;
    rusticatedTex.wrapT = THREE.RepeatWrapping;
    rusticatedTex.repeat.set(6, 1);
    const rusticatedMat = new THREE.MeshStandardMaterial({
      color: 0xebe2d0,
      map: rusticatedTex,
      roughness: 0.80,
      metalness: 0.04
    });
    const colMat = new THREE.MeshStandardMaterial({ color: 0xf4eedf, roughness: 0.48 });
    const copperRoofMat = new THREE.MeshStandardMaterial({ color: 0x2e665a, roughness: 0.48, metalness: 0.35 });
    const copperRibMat = new THREE.MeshStandardMaterial({ color: 0x1e4a41, roughness: 0.4, metalness: 0.55 });
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xffd27d });
    const goldOrnamentMat = new THREE.MeshStandardMaterial({
      color: 0xe6be48,
      emissive: 0x3b2808,
      emissiveIntensity: 0.38,
      roughness: 0.34,
      metalness: 0.58
    });
    const castIronMat = new THREE.MeshStandardMaterial({ color: 0x1c2422, roughness: 0.45, metalness: 0.85 });
    const teakWoodMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.75 });
    const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x1d472a, roughness: 0.72 });

    /* ============================================================== */
    /* 6.1 Central Grand Hall & Symmetrical Palladian Pavilion Wings   */
    /* ============================================================== */
    // Central Main Hall Block
    const mainHall = new THREE.Mesh(new THREE.BoxGeometry(13.6, 7.8, 9.2), ashlarStoneMat);
    mainHall.position.y = 3.9;
    mainHall.castShadow = true;
    mainHall.receiveShadow = true;
    museum.add(mainHall);

    // Rusticated Ashlar Ground Floor Podium
    const groundPodium = new THREE.Mesh(new THREE.BoxGeometry(23.2, 1.4, 10.2), rusticatedMat);
    groundPodium.position.y = 0.7;
    groundPodium.receiveShadow = true;
    museum.add(groundPodium);

    const teapotHedgeMat = new THREE.MeshStandardMaterial({ color: 0x2e6b34, roughness: 0.76 });
    const blossomRedMat = new THREE.MeshStandardMaterial({ color: 0xd9385a, roughness: 0.58 });
    const blossomGoldMat = new THREE.MeshStandardMaterial({ color: 0xf5c242, roughness: 0.54 });
    const urnFootGeo = new THREE.CylinderGeometry(0.16, 0.20, 0.10, 12);
    const urnBodyGeo = new THREE.CylinderGeometry(0.24, 0.14, 0.36, 14);
    const urnRimGeo = new THREE.TorusGeometry(0.24, 0.032, 8, 16);
    const topiaryGeo = new THREE.SphereGeometry(0.22, 12, 10);
    const blossomGeo = new THREE.SphereGeometry(0.055, 6, 6);
    const createTopiaryUrn = (scale = 1.0) => {
      const urnGroup = new THREE.Group();
      const foot = new THREE.Mesh(urnFootGeo, colMat);
      foot.position.y = -0.18;
      urnGroup.add(foot);
      const body = new THREE.Mesh(urnBodyGeo, colMat);
      body.position.y = 0.02;
      body.castShadow = true;
      urnGroup.add(body);
      const rim = new THREE.Mesh(urnRimGeo, colMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.20;
      urnGroup.add(rim);
      const foliage = new THREE.Mesh(topiaryGeo, teapotHedgeMat);
      foliage.position.y = 0.34;
      foliage.castShadow = true;
      urnGroup.add(foliage);
      for (let b = 0; b < 4; b++) {
        const bAng = (b / 4) * Math.PI * 2 + 0.4;
        const blossom = new THREE.Mesh(blossomGeo, b % 2 === 0 ? blossomRedMat : blossomGoldMat);
        blossom.position.set(Math.cos(bAng) * 0.17, 0.36 + (b % 2) * 0.06, Math.sin(bAng) * 0.17);
        urnGroup.add(blossom);
      }
      urnGroup.scale.setScalar(scale);
      return urnGroup;
    };

    const frontWinPedGeo = new THREE.ConeGeometry(1.05, 0.48, 4);
    frontWinPedGeo.rotateY(Math.PI / 4);
    frontWinPedGeo.scale(1.2, 1.0, 0.28);

    // East & West Symmetrical Pavilion Wings (双翼展厅附楼)
    for (const [wingX, rotY] of [
      [-9.2, 0],
      [9.2, Math.PI]
    ]) {
      const wingGroup = new THREE.Group();
      wingGroup.position.set(wingX, 0, 0);

      // Wing body
      const wingBody = new THREE.Mesh(new THREE.BoxGeometry(5.2, 7.0, 9.6), ashlarStoneMat);
      wingBody.position.y = 3.5;
      wingBody.castShadow = true;
      wingBody.receiveShadow = true;
      wingGroup.add(wingBody);

      // Molded frieze band & roof balustrade parapet
      const parapet = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.7, 9.7), rusticatedMat);
      parapet.position.y = 7.15;
      wingGroup.add(parapet);

      // Palladian Arched Windows with molded stone surrounds & keystones
      for (const pz of [2.2, -2.2]) {
        // Outer facade window
        const winSurround = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.5, 1.5), rusticatedMat);
        winSurround.position.set(wingX > 0 ? 2.65 : -2.65, 3.8, pz);
        wingGroup.add(winSurround);

        const winGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.1), windowMat);
        winGlass.position.set(wingX > 0 ? 2.75 : -2.75, 3.8, pz);
        winGlass.rotation.y = wingX > 0 ? Math.PI / 2 : -Math.PI / 2;
        wingGroup.add(winGlass);

        // Window bronze cross mullions (青铜十字窗棂)
        const winMullionV = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.1, 0.04), castIronMat);
        winMullionV.position.set(wingX > 0 ? 2.76 : -2.76, 3.8, pz);
        wingGroup.add(winMullionV);

        const winMullionH = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 1.2), castIronMat);
        winMullionH.position.set(wingX > 0 ? 2.76 : -2.76, 3.8, pz);
        wingGroup.add(winMullionH);
      }

      // Front facade windows on each wing with classical triangular window pediment & corbel sill
      const frontWinSurround = new THREE.Mesh(new THREE.BoxGeometry(1.56, 2.56, 0.22), colMat);
      frontWinSurround.position.set(0, 3.8, 4.84);
      wingGroup.add(frontWinSurround);

      const frontWinPediment = new THREE.Mesh(frontWinPedGeo, colMat);
      frontWinPediment.position.set(0, 5.30, 4.88);
      wingGroup.add(frontWinPediment);

      const frontWinSill = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.14, 0.32), colMat);
      frontWinSill.position.set(0, 2.48, 4.88);
      wingGroup.add(frontWinSill);

      const frontWinGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.1), windowMat);
      frontWinGlass.position.set(0, 3.8, 4.96);
      wingGroup.add(frontWinGlass);

      const frontWinMullionV = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.1, 0.04), castIronMat);
      frontWinMullionV.position.set(0, 3.8, 4.97);
      wingGroup.add(frontWinMullionV);

      const frontWinMullionH = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.04), castIronMat);
      frontWinMullionH.position.set(0, 3.8, 4.97);
      wingGroup.add(frontWinMullionH);

      // Classical roof balustrade topiary urn finials along wing parapet
      for (const ux of [-2.1, 0, 2.1]) {
        const urn = createTopiaryUrn(0.75);
        urn.position.set(ux, 7.66, 4.72);
        wingGroup.add(urn);
      }

      // Rusticated Corner Ashlar Quoins
      for (const qz of [-4.7, 4.7]) {
        for (let q = 0; q < 7; q++) {
          const quoin = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.55), rusticatedMat);
          quoin.position.set(wingX > 0 ? 2.55 : -2.55, 0.7 + q * 0.95, qz);
          wingGroup.add(quoin);
        }
      }

      museum.add(wingGroup);
    }

    /* ============================================================== */
    /* 6.2 Grand Hexastyle Portico: Ionic Fluted Columns & Coffers    */
    /* ============================================================== */
    const porticoGroup = new THREE.Group();
    porticoGroup.position.set(0, 0, 4.8);
    museum.add(porticoGroup);

    // Recessed Coffered Portico Ceiling (古典方格藻井天花)
    const cofferCeiling = new THREE.Mesh(
      new THREE.PlaneGeometry(11.2, 2.4),
      new THREE.MeshStandardMaterial({
        map: getCofferedCeilingTexture(),
        roughness: 0.6
      })
    );
    cofferCeiling.rotation.x = Math.PI / 2;
    cofferCeiling.position.set(0, 5.48, -0.6);
    porticoGroup.add(cofferCeiling);

    // 6 Fluted Ionic Portico Columns
    const colGeo = new THREE.CylinderGeometry(0.34, 0.38, 5.2, 16);
    for (let i = 0; i < 6; i++) {
      const colX = -5.0 + i * 2.0;
      const col = new THREE.Group();
      col.position.set(colX, 2.6, 0.4);

      // Torus column plinth base
      const colBase = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.52, 0.22, 16), colMat);
      colBase.position.y = -2.5;
      col.add(colBase);

      // Fluted shaft
      const shaft = new THREE.Mesh(colGeo, colMat);
      shaft.castShadow = true;
      col.add(shaft);

      // Ionic Capital with Sculpted Double Volute Horns (爱奥尼双向立体卷涡)
      const capGroup = new THREE.Group();
      capGroup.position.y = 2.55;

      const abacus = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.9), colMat);
      capGroup.add(abacus);

      for (const vx of [-0.35, 0.35]) {
        const volute = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 16), colMat);
        volute.rotation.y = Math.PI / 2;
        volute.position.set(vx, -0.08, 0);
        capGroup.add(volute);
      }
      col.add(capGroup);

      porticoGroup.add(col);
    }

    // Horizontal Entablature Architrave Beam & Frieze Molding
    const architrave = new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.65, 2.2), colMat);
    architrave.position.set(0, 5.55, 0.2);
    architrave.castShadow = true;
    porticoGroup.add(architrave);

    // Classical Triangular Portico Pediment with Molded Dentil Cornice
    const pedimentShape = new THREE.Shape();
    pedimentShape.moveTo(-5.9, 0);
    pedimentShape.lineTo(5.9, 0);
    pedimentShape.lineTo(0, 2.3);
    pedimentShape.closePath();
    const pedimentGeo = new THREE.ExtrudeGeometry(pedimentShape, {
      depth: 1.7,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.12,
      bevelSegments: 2
    });
    const pediment = new THREE.Mesh(pedimentGeo, ashlarStoneMat);
    pediment.position.set(0, 5.85, -0.85);
    pediment.castShadow = true;
    porticoGroup.add(pediment);

    // Sculpted Raking Cornice Slopes framing the triangular tympanum
    for (const side of [-1, 1]) {
      const rakingCornice = new THREE.Mesh(new THREE.BoxGeometry(6.45, 0.22, 0.36), colMat);
      rakingCornice.position.set(side * 3.0, 7.05, 1.02);
      rakingCornice.rotation.z = side * -0.372;
      rakingCornice.castShadow = true;
      porticoGroup.add(rakingCornice);
    }

    // Dentil course under pediment cornice (proud of front face at z = 1.05)
    for (let d = -25; d <= 25; d++) {
      const dentil = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.18), colMat);
      dentil.position.set(d * 0.22, 5.86, 1.05);
      porticoGroup.add(dentil);
    }

    // Central Tympanum Relief Medallion & Heraldic Garland (新加坡金盾徽章与橄榄枝浮雕，位于山花前表面 z = 1.04)
    const medallionRim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 8, 20), colMat);
    medallionRim.position.set(0, 6.68, 1.02);
    porticoGroup.add(medallionRim);

    const medallion = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.12, 20), goldOrnamentMat);
    medallion.rotation.x = Math.PI / 2;
    medallion.position.set(0, 6.68, 1.04);
    porticoGroup.add(medallion);

    // Sculpted Inner Heraldic Shield, Crown & 8 Sunburst Rays on Tympanum Medallion
    const heraldicShield = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.18, 0.42, 6), colMat);
    heraldicShield.scale.set(1.0, 1.0, 0.35);
    heraldicShield.position.set(0, 6.64, 1.12);
    porticoGroup.add(heraldicShield);

    const heraldicCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.14, 8), goldOrnamentMat);
    heraldicCrown.position.set(0, 6.94, 1.12);
    porticoGroup.add(heraldicCrown);

    for (let r = 0; r < 8; r++) {
      const rAng = (r / 8) * Math.PI * 2;
      const ray = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.48, 4), colMat);
      ray.position.set(Math.cos(rAng) * 0.34, 6.68 + Math.sin(rAng) * 0.34, 1.10);
      ray.rotation.z = rAng - Math.PI / 2;
      porticoGroup.add(ray);
    }

    for (const side of [-1, 1]) {
      const garlandWing = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, 1.35, 8), goldOrnamentMat);
      garlandWing.rotation.z = side * (Math.PI / 2 - 0.25);
      garlandWing.position.set(side * 1.25, 6.45, 1.02);
      porticoGroup.add(garlandWing);
    }

    // Classical Acroterion Finial at Pediment Apex
    const apexAcroterion = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.48, 12), goldOrnamentMat);
    apexAcroterion.position.set(0, 8.42, 1.02);
    porticoGroup.add(apexAcroterion);

    /* ============================================================== */
    /* 6.3 Double-Tiered Octagonal Drum & Verdigris Ribbed Dome       */
    /* ============================================================== */
    // Octagonal Drum Base Plinth
    const drumBase = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.15, 0.4, 8), ashlarStoneMat);
    drumBase.position.y = 7.75;
    museum.add(drumBase);

    // Drum Clerestory with 8 Arched Windows & Fluted Twin Pilasters
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.8, 1.4, 16), ashlarStoneMat);
    drum.position.y = 8.65;
    drum.castShadow = true;
    museum.add(drum);

    for (let w = 0; w < 8; w++) {
      const ang = (w / 8) * Math.PI * 2;
      const clWindow = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.12), windowMat);
      clWindow.position.set(Math.cos(ang) * 3.72, 8.65, Math.sin(ang) * 3.72);
      clWindow.rotation.y = -ang + Math.PI / 2;
      museum.add(clWindow);

      // Fluted pilaster dividers
      const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.3, 0.15), colMat);
      pilaster.position.set(Math.cos(ang + Math.PI / 8) * 3.76, 8.65, Math.sin(ang + Math.PI / 8) * 3.76);
      pilaster.rotation.y = -ang - Math.PI / 8 + Math.PI / 2;
      museum.add(pilaster);
    }

    // Molded Drum Cornice with Modillions
    const drumCornice = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 3.7, 0.35, 16), ashlarStoneMat);
    drumCornice.position.y = 9.45;
    museum.add(drumCornice);

    // Ribbed Oxidized Copper Verdigris Dome (半球穹顶)
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(3.7, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      copperRoofMat
    );
    dome.position.y = 9.6;
    dome.castShadow = true;
    museum.add(dome);

    // 12 Raised Copper Seam Ribs
    for (let r = 0; r < 12; r++) {
      const ang = (r / 12) * Math.PI * 2;
      const rib = new THREE.Mesh(new THREE.TorusGeometry(3.72, 0.05, 6, 16, Math.PI / 2), copperRibMat);
      rib.position.y = 9.6;
      rib.rotation.y = ang;
      rib.rotation.x = -Math.PI / 2;
      museum.add(rib);
    }

    // Open-Arcaded Classical Lantern Cupola (六柱采光小亭亭阁)
    const cupolaBase = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.4, 12), ashlarStoneMat);
    cupolaBase.position.y = 13.4;
    museum.add(cupolaBase);

    // 6 Mini Columns in Cupola
    for (let c = 0; c < 6; c++) {
      const ang = (c / 6) * Math.PI * 2;
      const miniCol = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.95, 8), colMat);
      miniCol.position.set(Math.cos(ang) * 0.72, 14.0, Math.sin(ang) * 0.72);
      museum.add(miniCol);
    }

    // Interior Golden Lantern Glow inside Cupola
    const cupolaGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.85, 12), windowMat);
    cupolaGlow.position.y = 14.0;
    museum.add(cupolaGlow);

    // Copper Bell Cap atop Cupola
    const cupolaRoof = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.8, 12), copperRoofMat);
    cupolaRoof.position.y = 14.85;
    museum.add(cupolaRoof);

    // Golden Weather Vane & Lightning Rod Spire
    const spireBall = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), goldOrnamentMat);
    spireBall.position.y = 15.35;
    museum.add(spireBall);

    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, 1.1, 8), goldOrnamentMat);
    spire.position.y = 15.95;
    museum.add(spire);

    /* ============================================================== */
    /* 6.4 Grand Entrance Staircase, Stone Balustrades & Ramps       */
    /* ============================================================== */
    // 5-Tier Grand Stone Steps
    for (let step = 0; step < 5; step++) {
      const stair = new THREE.Mesh(
        new THREE.BoxGeometry(10.6 - step * 0.6, 0.28, 1.1),
        rusticatedMat
      );
      stair.position.set(0, 0.14 + step * 0.25, 4.8 + (4 - step) * 0.65);
      stair.receiveShadow = true;
      museum.add(stair);
      this.walkableMeshes.push(stair);
    }

    // Flanking Stone Balustrades with Turned Baluster Spindles (双侧石雕宝瓶护栏)
    for (const [side, bx] of [
      [1, 5.4],
      [-1, -5.4]
    ]) {
      const balustradeGroup = new THREE.Group();
      balustradeGroup.position.set(bx, 0, 6.2);

      // Balustrade handrail coping & base plinth
      const handrail = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 3.2), ashlarStoneMat);
      handrail.position.set(0, 1.45, 0);
      handrail.rotation.x = -0.32;
      balustradeGroup.add(handrail);

      const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 3.2), rusticatedMat);
      plinth.position.set(0, 0.45, 0);
      plinth.rotation.x = -0.32;
      balustradeGroup.add(plinth);

      // 6 Turned stone baluster spindles
      for (let s = 0; s < 6; s++) {
        const baluster = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.65, 8), colMat);
        baluster.position.set(0, 0.8 + s * 0.18, -1.1 + s * 0.45);
        balustradeGroup.add(baluster);
      }

      // Newel end posts with sculpted stone topiary urns
      for (const [pz, py] of [
        [-1.6, 1.6],
        [1.6, 0.6]
      ]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.9, 0.48), ashlarStoneMat);
        post.position.set(0, py, pz);
        balustradeGroup.add(post);

        const urn = createTopiaryUrn(1.0);
        urn.position.set(0, py + 0.66, pz);
        balustradeGroup.add(urn);
      }

      museum.add(balustradeGroup);
    }

    // 3D Neoclassical Grand Entrance Portal: Molded Stone Architrave, Coffered Teak Double Doors & Palladian Fanlight
    const portalGroup = new THREE.Group();
    portalGroup.position.set(0, 0, 4.62);

    // Outer stone portal jambs & lintel cornice
    for (const jx of [-1.72, 1.72]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.32, 4.6, 0.28), colMat);
      jamb.position.set(jx, 2.5, 0.04);
      portalGroup.add(jamb);
    }
    const portalTransomBar = new THREE.Mesh(new THREE.BoxGeometry(3.76, 0.22, 0.34), colMat);
    portalTransomBar.position.set(0, 3.62, 0.06);
    portalGroup.add(portalTransomBar);

    const portalCornice = new THREE.Mesh(new THREE.BoxGeometry(4.05, 0.26, 0.42), colMat);
    portalCornice.position.set(0, 4.82, 0.08);
    portalGroup.add(portalCornice);

    // Warm interior foyer glow behind transom & glazed upper door panels
    const doorGlowBackdrop = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.3), windowMat);
    doorGlowBackdrop.position.set(0, 2.55, -0.02);
    portalGroup.add(doorGlowBackdrop);

    // Semicircular Palladian Fanlight Arch & 7 Radial Bronze Mullions above transom bar
    const fanlightArch = new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.14, 10, 24, Math.PI), colMat);
    fanlightArch.position.set(0, 3.68, 0.08);
    portalGroup.add(fanlightArch);

    const fanlightHub = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 16, Math.PI), castIronMat);
    fanlightHub.position.set(0, 3.68, 0.06);
    portalGroup.add(fanlightHub);

    for (let m = 1; m <= 5; m++) {
      const mAng = (m / 6) * Math.PI;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.38, 0.04), castIronMat);
      spoke.position.set(Math.cos(mAng) * 0.72, 3.68 + Math.sin(mAng) * 0.72, 0.06);
      spoke.rotation.z = mAng - Math.PI / 2;
      portalGroup.add(spoke);
    }

    // Double-Leaf Panelled Teak Museum Doors with Glazed Upper Lights & Brass Hardware
    for (const dSide of [-1, 1]) {
      const leafX = dSide * 0.78;
      // Lower solid teak door stile & rail frame
      const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(1.52, 2.25, 0.08), teakWoodMat);
      doorLeaf.position.set(leafX, 1.52, 0.02);
      portalGroup.add(doorLeaf);

      // Upper door stiles framing the glazed window panel
      for (const sx of [-0.62, 0.62]) {
        const uStile = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.95, 0.08), teakWoodMat);
        uStile.position.set(leafX + sx, 3.10, 0.02);
        portalGroup.add(uStile);
      }
      const uTopRail = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.20, 0.08), teakWoodMat);
      uTopRail.position.set(leafX, 3.48, 0.02);
      portalGroup.add(uTopRail);

      // Mullion grid inside upper door glass light
      const leafMullionV = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.85, 0.05), castIronMat);
      leafMullionV.position.set(leafX, 3.06, 0.03);
      portalGroup.add(leafMullionV);
      const leafMullionH = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.035, 0.05), castIronMat);
      leafMullionH.position.set(leafX, 3.06, 0.03);
      portalGroup.add(leafMullionH);

      // 2 Raised coffered teak panels on lower door leaf + brass molding
      for (const py of [1.10, 1.92]) {
        const cofferPanel = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.58, 0.04), teakWoodMat);
        cofferPanel.position.set(leafX, py, 0.06);
        portalGroup.add(cofferPanel);

        const brassTrim = new THREE.Mesh(new THREE.BoxGeometry(1.10, 0.64, 0.02), goldOrnamentMat);
        brassTrim.position.set(leafX, py, 0.05);
        portalGroup.add(brassTrim);
      }

      // Polished brass kickplate & vertical pull handle
      const kickplate = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.24, 0.03), goldOrnamentMat);
      kickplate.position.set(leafX, 0.54, 0.055);
      portalGroup.add(kickplate);

      const pullHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.38, 8), goldOrnamentMat);
      pullHandle.position.set(dSide * 0.14, 1.62, 0.09);
      portalGroup.add(pullHandle);
    }

    // Central brass astragal seam strip between double doors
    const astragal = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.18, 0.10), goldOrnamentMat);
    astragal.position.set(0, 1.98, 0.04);
    portalGroup.add(astragal);

    museum.add(portalGroup);

    /* ============================================================== */
    /* 6.5 Forecourt Courtyard: Twin Gas Lamps, Benches & Hedges      */
    /* ============================================================== */
    // 2 Victorian Cast-Iron Twin-Head Garden Lanterns
    for (const lx of [-7.6, 7.6]) {
      const yardLamp = new THREE.Group();
      yardLamp.position.set(lx, 0, 7.8);

      const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 0.45, 8), castIronMat);
      lampBase.position.y = 0.225;
      yardLamp.add(lampBase);

      const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 2.6, 8), castIronMat);
      lampPole.position.y = 1.6;
      yardLamp.add(lampPole);

      // Twin scrolled arms
      for (const armSide of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.65, 6), castIronMat);
        arm.position.set(armSide * 0.32, 2.8, 0);
        arm.rotation.z = armSide * 0.6;
        yardLamp.add(arm);

        const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.12, 0.38, 4), windowMat);
        lantern.position.set(armSide * 0.55, 3.0, 0);
        yardLamp.add(lantern);
      }

      const yardLight = new THREE.PointLight(0xffbe66, 1.2, 8);
      yardLight.position.set(0, 3.0, 0);
      yardLamp.add(yardLight);
      this.pointLights.push(yardLight);
      this.lampLights.push(yardLight);

      museum.add(yardLamp);
    }

    // 2 Heritage Teakwood Park Benches with Cast-Iron Scrollwork
    for (const bx of [-7.6, 7.6]) {
      const bench = new THREE.Group();
      bench.position.set(bx, 0, 5.8);
      bench.rotation.y = bx > 0 ? -Math.PI / 6 : Math.PI / 6;

      // Iron legs
      for (const legX of [-0.65, 0.65]) {
        const leg = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 12, Math.PI), castIronMat);
        leg.position.set(legX, 0.28, 0);
        bench.add(leg);

        const armrest = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 6, 10, Math.PI), castIronMat);
        armrest.position.set(legX, 0.62, 0);
        bench.add(armrest);
      }

      // Teak wood seat slats
      for (let s = 0; s < 4; s++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.1), teakWoodMat);
        slat.position.set(0, 0.46, -0.15 + s * 0.11);
        bench.add(slat);
      }

      // Teak wood backrest slats
      for (let b = 0; b < 3; b++) {
        const backSlat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.04), teakWoodMat);
        backSlat.position.set(0, 0.68 + b * 0.12, -0.2);
        bench.add(backSlat);
      }

      museum.add(bench);
    }

    // Manicured Spherical Topiary Boxwood Hedges in Terracotta Pots
    for (const [hx, hz] of [
      [-9.8, 6.4],
      [9.8, 6.4],
      [-9.8, 8.2],
      [9.8, 8.2]
    ]) {
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.26, 0.55, 12),
        new THREE.MeshStandardMaterial({ color: 0x9e5238, roughness: 0.78 })
      );
      pot.position.set(hx, 0.28, hz);
      museum.add(pot);

      const topiary = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 10), hedgeMat);
      topiary.position.set(hx, 0.78, hz);
      topiary.castShadow = true;
      museum.add(topiary);
    }

    // Interior warm museum light
    const museumInteriorLight = new THREE.PointLight(0xffb84d, 1.8, 16);
    museumInteriorLight.position.set(0, 3.5, 4.2);
    museum.add(museumInteriorLight);
    this.pointLights.push(museumInteriorLight);
    this.lampLights.push(museumInteriorLight);

    // Triumphant Monumental Entrance Portico Beacon (Subtle Civic -> Triumphant Gold)
    const beaconGeo = new THREE.OctahedronGeometry(0.32, 0);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd685 });
    const beaconStar = new THREE.Mesh(beaconGeo, beaconMat);
    beaconStar.name = "beacon";
    beaconStar.position.set(0, 9.2, 4.8);
    beaconStar.scale.setScalar(0.95);
    museum.add(beaconStar);

    const ringGeo = new THREE.TorusGeometry(0.54, 0.026, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd685 });
    const beaconRing = new THREE.Mesh(ringGeo, ringMat);
    beaconRing.position.set(0, 9.2, 4.8);
    museum.add(beaconRing);

    const secRingGeo = new THREE.TorusGeometry(0.38, 0.020, 8, 20);
    const secRingMat = new THREE.MeshBasicMaterial({ color: 0xe8c878 });
    const secondaryRing = new THREE.Mesh(secRingGeo, secRingMat);
    secondaryRing.position.set(0, 9.2, 4.8);
    museum.add(secondaryRing);

    this.museumInteriorLight = museumInteriorLight;
    this.colonialMuseumGroup = museum;

    this.museumCue = {
      id: "museum",
      status: "pending",
      beaconGroup: museum,
      beaconStar,
      beaconRing,
      secondaryRing,
      baseY: 9.2,
      bobPhase: 3.2,
      spinSpeed: 1.2,
      pendingBeaconColor: 0xffd685,
      restoredBeaconColor: 0xffd700,
      readyBeaconColor: 0xffe680
    };
    this.landmarkCueRecords.push(this.museumCue);

    this.root.add(museum);
  }

    /* -------------------------------------------------------------- */
  /* 7. Badang Megalith (巴当神力巨石遗址 - 古代神话雕塑重构)        */
  /* -------------------------------------------------------------- */
  private createChiseledMonolithGeometry(
    w: number,
    h: number,
    d: number,
    slantAngle: number,
    seed: number
  ): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const uvs: number[] = [];

    const numSlices = 8;
    const getRing = (yBase: number, radiusScaleX: number, radiusScaleZ: number, slant: number) => {
      const ring: THREE.Vector3[] = [];
      for (let i = 0; i < numSlices; i++) {
        const theta = (i / numSlices) * Math.PI * 2;
        const jitter = 0.88 + 0.22 * Math.sin(theta * 3.0 + seed * 2.1) + 0.08 * Math.cos(theta * 5.0 + seed);
        const vx = Math.cos(theta) * (w * 0.5) * radiusScaleX * jitter;
        const vz = Math.sin(theta) * (d * 0.5) * radiusScaleZ * jitter;
        const vy = yBase + (slant !== 0 ? vx * Math.tan(slant) : 0);
        ring.push(new THREE.Vector3(vx, vy, vz));
      }
      return ring;
    };

    const ring0 = getRing(-h * 0.5, 1.05, 1.05, 0);
    const ring1 = getRing(-h * 0.12, 0.98, 0.96, 0.05);
    const ring2 = getRing(h * 0.26, 0.88, 0.86, slantAngle * 0.5);
    const ring3 = getRing(h * 0.50, 0.76, 0.74, slantAngle);

    const apex = new THREE.Vector3(
      w * 0.12 * Math.sin(seed),
      h * 0.52 + (w * 0.12 * Math.sin(seed)) * Math.tan(slantAngle) + 0.18,
      d * 0.08 * Math.cos(seed)
    );
    const bottomCenter = new THREE.Vector3(0, -h * 0.5, 0);

    const addTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      for (const p of [a, b, c]) {
        const u = 0.5 + Math.atan2(p.z, p.x) / (Math.PI * 2);
        const v = (p.y + h * 0.5) / h;
        uvs.push(u, v);
      }
    };

    const addQuad = (rA: THREE.Vector3[], rB: THREE.Vector3[]) => {
      for (let i = 0; i < numSlices; i++) {
        const next = (i + 1) % numSlices;
        addTri(rA[i], rA[next], rB[next]);
        addTri(rA[i], rB[next], rB[i]);
      }
    };

    addQuad(ring0, ring1);
    addQuad(ring1, ring2);
    addQuad(ring2, ring3);

    for (let i = 0; i < numSlices; i++) {
      const next = (i + 1) % numSlices;
      addTri(ring3[i], ring3[next], apex);
    }
    for (let i = 0; i < numSlices; i++) {
      const next = (i + 1) % numSlices;
      addTri(bottomCenter, ring0[next], ring0[i]);
    }

    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();

    return geo;
  }

  private buildBadangMegalith() {
    const megalithGroup = new THREE.Group();
    megalithGroup.position.set(-6, 1.0, -8);

    // Weathered Altar Materials
    const foundationMat = new THREE.MeshStandardMaterial({ color: 0x2e2720, roughness: 0.92 });
    const carvedBasaltMat = new THREE.MeshStandardMaterial({ color: 0x3d352b, roughness: 0.82 });
    const stoneMat = new THREE.MeshStandardMaterial({
      map: getMegalithRuneTexture(),
      roughness: 0.82,
      metalness: 0.18
    });
    const goldVeinMat = new THREE.MeshStandardMaterial({
      color: 0xd8a846,
      roughness: 0.30,
      metalness: 0.88,
      emissive: 0xc28a2e,
      emissiveIntensity: 0.14
    });
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x284724, roughness: 0.92 });
    const makaraBronzeMat = new THREE.MeshStandardMaterial({
      color: 0x5a4832,
      roughness: 0.38,
      metalness: 0.85
    });
    const waterStreamMat = new THREE.MeshStandardMaterial({
      color: 0x98f0e6,
      roughness: 0.08,
      transparent: true,
      opacity: 0.85
    });
    const poolWaterMat = new THREE.MeshStandardMaterial({
      color: 0x3ab8ad,
      roughness: 0.12,
      metalness: 0.08,
      transparent: true,
      opacity: 0.82
    });

    // 7.1 Tiered Octagonal Lotus Fountain Basin, Chamfered Curbs & Perimeter Stone Balustrade
    const outerTerrace = new THREE.Mesh(new THREE.CylinderGeometry(4.55, 4.85, 0.16, 8), foundationMat);
    outerTerrace.position.y = 0.08;
    outerTerrace.receiveShadow = true;
    megalithGroup.add(outerTerrace);

    const tier1 = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.3, 0.28, 8), foundationMat);
    tier1.position.y = 0.22;
    tier1.receiveShadow = true;
    megalithGroup.add(tier1);

    // Chamfered basalt curb bevel ring
    const curbChamfer = new THREE.Mesh(new THREE.TorusGeometry(4.05, 0.075, 6, 8), carvedBasaltMat);
    curbChamfer.rotation.x = Math.PI / 2;
    curbChamfer.rotation.z = Math.PI / 8;
    curbChamfer.position.y = 0.36;
    megalithGroup.add(curbChamfer);

    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.8, 0.28, 8), carvedBasaltMat);
    tier2.position.y = 0.46;
    megalithGroup.add(tier2);

    // Perimeter Carved Stone Balustrade (八方石雕莲花望柱与栏板, leaving front +Z entrance open)
    const postGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.62, 8);
    const finialGeo = new THREE.SphereGeometry(0.11, 8, 8);
    for (let b = 0; b < 8; b++) {
      const bAngle = (b / 8) * Math.PI * 2 + Math.PI / 8;
      const bx = Math.cos(bAngle) * 4.18;
      const bz = Math.sin(bAngle) * 4.18;
      const post = new THREE.Mesh(postGeo, carvedBasaltMat);
      post.position.set(bx, 0.56, bz);
      post.castShadow = true;
      megalithGroup.add(post);

      const finial = new THREE.Mesh(finialGeo, goldVeinMat);
      finial.position.set(bx, 0.92, bz);
      megalithGroup.add(finial);

      // Connect adjacent posts except the front (+Z) ceremonial entrance span (b === 1)
      if (b !== 1) {
        const nextAngle = ((b + 1) / 8) * Math.PI * 2 + Math.PI / 8;
        const nx = Math.cos(nextAngle) * 4.18;
        const nz = Math.sin(nextAngle) * 4.18;
        const midX = (bx + nx) * 0.5;
        const midZ = (bz + nz) * 0.5;
        const spanLen = Math.hypot(nx - bx, nz - bz);
        const railAngle = Math.atan2(nx - bx, nz - bz);

        const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, spanLen), carvedBasaltMat);
        topRail.position.set(midX, 0.76, midZ);
        topRail.rotation.y = railAngle;
        megalithGroup.add(topRail);

        const lowerPanel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.24, spanLen * 0.88), foundationMat);
        lowerPanel.position.set(midX, 0.50, midZ);
        lowerPanel.rotation.y = railAngle;
        megalithGroup.add(lowerPanel);
      }
    }

    // Raised fountain pool rim coping
    const basinRim = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.22, 8), foundationMat);
    basinRim.position.y = 0.67;
    megalithGroup.add(basinRim);

    // Sunken crystalline water pool
    const poolWater = new THREE.Mesh(new THREE.CylinderGeometry(2.95, 2.95, 0.06, 16), poolWaterMat);
    poolWater.position.y = 0.72;
    megalithGroup.add(poolWater);

    // 4 Carved Corner Buttress Stones (四隅守护基石)
    for (let c = 0; c < 4; c++) {
      const angle = (c / 4) * Math.PI * 2 + Math.PI / 4;
      const buttress = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.65), carvedBasaltMat);
      buttress.position.set(Math.cos(angle) * 3.4, 0.35, Math.sin(angle) * 3.4);
      buttress.rotation.y = angle;
      megalithGroup.add(buttress);
    }

    // 4 Bronze Makara Fountain Gargoyles (四方摩羯铜制滴水兽与抛物线涌泉水流)
    for (let m = 0; m < 4; m++) {
      const angle = (m * Math.PI) / 2;
      const makaraGroup = new THREE.Group();
      makaraGroup.position.set(Math.cos(angle) * 3.3, 0.75, Math.sin(angle) * 3.3);
      makaraGroup.rotation.y = angle + Math.PI; // facing inwards toward pool center

      // Carved bronze Makara head & snout
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.36), makaraBronzeMat);
      head.castShadow = true;
      makaraGroup.add(head);

      // Curled mythical dragon crest / horn
      const crest = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.026, 6, 12, Math.PI * 0.75), goldVeinMat);
      crest.rotation.y = Math.PI / 2;
      crest.position.set(0, 0.14, 0.04);
      makaraGroup.add(crest);

      // Bronze spout nozzle
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.035, 0.18, 8), makaraBronzeMat);
      nozzle.rotation.x = Math.PI / 2 + 0.32;
      nozzle.position.set(0, -0.05, 0.24);
      makaraGroup.add(nozzle);

      // Parabolic fountain water stream arching into pool
      const streamPts = [
        new THREE.Vector3(0, -0.05, 0.30),
        new THREE.Vector3(0, -0.02, 0.65),
        new THREE.Vector3(0, -0.15, 1.05),
        new THREE.Vector3(0, -0.32, 1.35)
      ];
      const streamCurve = new THREE.CatmullRomCurve3(streamPts);
      const stream = new THREE.Mesh(new THREE.TubeGeometry(streamCurve, 12, 0.018, 6, false), waterStreamMat);
      makaraGroup.add(stream);

      // Water ripple ring where stream impacts the fountain surface
      const splashRing = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.15, 12), waterStreamMat);
      splashRing.rotation.x = -Math.PI / 2;
      splashRing.position.set(0, -0.31, 1.35);
      makaraGroup.add(splashRing);

      megalithGroup.add(makaraGroup);
    }

    // 7.2 Three Majestic Fractured Monolith Shards (巴当神力裂解三大砂岩巨柱 - 真实地质断裂面与金缮嵌金)
    const shardConfigs = [
      { w: 1.45, h: 3.25, d: 1.35, slant: 0.35, seed: 1.2, pos: [-0.95, 2.02, 0.1], rot: [0.08, 0.42, -0.1] },
      { w: 1.30, h: 2.75, d: 1.20, slant: -0.42, seed: 2.7, pos: [0.75, 1.80, -0.55], rot: [-0.12, 1.15, 0.12] },
      { w: 1.15, h: 2.45, d: 1.30, slant: 0.28, seed: 4.1, pos: [0.55, 1.65, 0.85], rot: [0.15, -0.78, -0.06] }
    ];

    shardConfigs.forEach((sc) => {
      const shardGroup = new THREE.Group();
      shardGroup.position.set(sc.pos[0], sc.pos[1], sc.pos[2]);
      shardGroup.rotation.set(sc.rot[0], sc.rot[1], sc.rot[2]);

      // Chiseled natural faceted monolith body (inlaid golden Sanskrit markings on stone face)
      const monolithGeo = this.createChiseledMonolithGeometry(sc.w, sc.h, sc.d, sc.slant, sc.seed);
      const shardMesh = new THREE.Mesh(monolithGeo, stoneMat);
      shardMesh.castShadow = true;
      shardMesh.receiveShadow = true;
      shardGroup.add(shardMesh);

      megalithGroup.add(shardGroup);
    });

    // 7.3 Levitating Chiseled Fractured Runic Stone Shards (真实斜切多面体玄武岩符文悬石残片)
    for (let f = 0; f < 6; f++) {
      const fAngle = (f / 6) * Math.PI * 2;
      const fRadius = 2.05 + (f % 2) * 0.40;
      const shardFloatGroup = new THREE.Group();
      shardFloatGroup.position.set(Math.cos(fAngle) * fRadius, 1.68 + Math.sin(f * 1.5) * 0.26, Math.sin(fAngle) * fRadius);
      shardFloatGroup.rotation.set(0.14 * Math.sin(f), fAngle + Math.PI / 2, 0.16 * Math.cos(f));

      const fShardGeo = this.createChiseledMonolithGeometry(0.32, 0.72, 0.22, (f % 2 === 0 ? 0.22 : -0.22), 1.4 + f);
      const fShard = new THREE.Mesh(fShardGeo, stoneMat);
      fShard.castShadow = true;
      fShard.receiveShadow = true;
      shardFloatGroup.add(fShard);

      // Fine flush gold hairline binding band inside fracture waist
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.12, 0.018, 6), goldVeinMat);
      collar.rotation.z = 0.28;
      shardFloatGroup.add(collar);

      megalithGroup.add(shardFloatGroup);
    }

    // 7.4 Fractured Boulder Rubble and Moss-Covered Rock Fragments
    const rubblePositions = [
      [-1.9, 0.8, 1.3, 0.38],
      [1.8, 0.8, 1.5, 0.42],
      [-1.5, 0.8, -1.7, 0.46],
      [2.0, 0.8, -1.3, 0.4],
      [0.2, 0.8, -2.2, 0.34],
      [-2.4, 0.4, 0.4, 0.3],
      [2.3, 0.4, 0.2, 0.32]
    ];
    rubblePositions.forEach(([rx, ry, rz, rs], idx) => {
      const rockMat = idx % 2 === 0 ? stoneMat : mossMat;
      const rockGeo = new THREE.DodecahedronGeometry(rs);
      rockGeo.scale(1.2, 0.6, 1.1); // Flatten naturally
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(rx, ry, rz);
      rock.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
      rock.castShadow = true;
      megalithGroup.add(rock);
    });

    // 7.5 Golden Sacred Runic Ground Aura Mandala (金色神圣符文法阵)
    const runeCircleOuter = new THREE.Mesh(
      new THREE.RingGeometry(2.5, 2.75, 32),
      new THREE.MeshBasicMaterial({ color: 0xd1a95d, side: THREE.DoubleSide })
    );
    runeCircleOuter.rotation.x = -Math.PI / 2;
    runeCircleOuter.position.y = 0.79;
    megalithGroup.add(runeCircleOuter);

    const runeCircleInner = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 1.78, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd700, side: THREE.DoubleSide })
    );
    runeCircleInner.rotation.x = -Math.PI / 2;
    runeCircleInner.position.y = 0.8;
    megalithGroup.add(runeCircleInner);

    // Altar point light
    const altarLight = new THREE.PointLight(0xffb84d, 1.35, 8.5);
    altarLight.position.set(0, 2.3, 0);
    megalithGroup.add(altarLight);
    this.pointLights.push(altarLight);

    // Floating Interaction Beacon (Warm Amber -> Golden Radiance)
    const beaconGeo = new THREE.OctahedronGeometry(0.26, 0);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xd1a95d });
    const beaconStar = new THREE.Mesh(beaconGeo, beaconMat);
    beaconStar.name = "beacon";
    beaconStar.position.set(0, 4.8, 0);
    megalithGroup.add(beaconStar);

    const ringGeo = new THREE.TorusGeometry(0.42, 0.024, 6, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xd1a95d });
    const beaconRing = new THREE.Mesh(ringGeo, ringMat);
    beaconRing.position.set(0, 4.8, 0);
    megalithGroup.add(beaconRing);

    this.badangGoldVeinMat = goldVeinMat;
    this.badangAltarLight = altarLight;
    this.badangRuneCircleOuter = runeCircleOuter;
    this.badangRuneCircleInner = runeCircleInner;
    this.badangMegalithGroup = megalithGroup;

    this.badangCue = {
      id: "badang-stone",
      status: "pending",
      beaconGroup: megalithGroup,
      beaconStar,
      beaconRing,
      baseY: 4.8,
      bobPhase: 0.0,
      spinSpeed: 1.6,
      pendingBeaconColor: 0xd1a95d,
      restoredBeaconColor: 0xffd700
    };
    this.landmarkCueRecords.push(this.badangCue);

    this.root.add(megalithGroup);
  }

  /* -------------------------------------------------------------- */
  /* 8. Ancient Inscription Plaque Altar (新加坡古文字石碑与青铜鼎炉) */
  /* -------------------------------------------------------------- */
  private buildAncientPlaqueAltar() {
    const altarGroup = new THREE.Group();
    altarGroup.position.set(9, 1.0, -8);

    // Materials
    const sumeruStoneMat = new THREE.MeshStandardMaterial({ color: 0x3a3328, roughness: 0.78 });
    const steleSandstoneMat = new THREE.MeshStandardMaterial({
      map: getMegalithRuneTexture(),
      roughness: 0.65,
      metalness: 0.25
    });
    const bronzeMat = new THREE.MeshStandardMaterial({ color: 0x4a5a4a, roughness: 0.42, metalness: 0.82 });
    const woodTableMat = new THREE.MeshStandardMaterial({ color: 0x422618, roughness: 0.68 });
    const celadonMat = new THREE.MeshStandardMaterial({ color: 0x82a898, roughness: 0.22, metalness: 0.1 });
    const fruitMat = new THREE.MeshStandardMaterial({ color: 0xd49e24, roughness: 0.55 });
    const fireGlowMat = new THREE.MeshBasicMaterial({ color: 0xff6618 });

    // 8.1 Xumi Sumeru Lotus Pedestal (须弥座三阶莲花石雕台座与四周石雕栏杆)
    const outerSanctuarySlab = new THREE.Mesh(new THREE.BoxGeometry(3.85, 0.16, 3.05), sumeruStoneMat);
    outerSanctuarySlab.position.y = 0.08;
    outerSanctuarySlab.receiveShadow = true;
    altarGroup.add(outerSanctuarySlab);

    const basePlinth = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.35, 2.4), sumeruStoneMat);
    basePlinth.position.y = 0.24;
    basePlinth.receiveShadow = true;
    altarGroup.add(basePlinth);

    // Front approach chamfered ceremonial steps (+Z side)
    for (let st = 0; st < 2; st++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(1.45 - st * 0.12, 0.14, 0.28),
        sumeruStoneMat
      );
      step.position.set(0, 0.12 + st * 0.12, 1.32 - st * 0.16);
      altarGroup.add(step);
    }

    // Perimeter Carved Lotus Balustrade around Left, Right, and Back of Sanctuary
    const altarPostGeo = new THREE.CylinderGeometry(0.075, 0.09, 0.58, 8);
    const altarLotusCapGeo = new THREE.ConeGeometry(0.095, 0.16, 8);
    const altarPostCoords: Array<[number, number]> = [
      [-1.78, 1.38],
      [-1.78, 0.0],
      [-1.78, -1.38],
      [0.0, -1.38],
      [1.78, -1.38],
      [1.78, 0.0],
      [1.78, 1.38]
    ];
    for (let i = 0; i < altarPostCoords.length; i++) {
      const [px, pz] = altarPostCoords[i];
      const post = new THREE.Mesh(altarPostGeo, sumeruStoneMat);
      post.position.set(px, 0.45, pz);
      post.castShadow = true;
      altarGroup.add(post);

      const cap = new THREE.Mesh(altarLotusCapGeo, bronzeMat);
      cap.position.set(px, 0.82, pz);
      altarGroup.add(cap);

      if (i < altarPostCoords.length - 1) {
        const [nx, nz] = altarPostCoords[i + 1];
        const mx = (px + nx) * 0.5;
        const mz = (pz + nz) * 0.5;
        const len = Math.hypot(nx - px, nz - pz);
        const ang = Math.atan2(nx - px, nz - pz);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, len), sumeruStoneMat);
        rail.position.set(mx, 0.64, mz);
        rail.rotation.y = ang;
        altarGroup.add(rail);
      }
    }

    // Recessed waist with bead borders (束腰与连珠纹)
    const waist = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.24, 1.8), sumeruStoneMat);
    waist.position.y = 0.47;
    altarGroup.add(waist);

    const upperSumeru = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.28, 2.1), sumeruStoneMat);
    upperSumeru.position.y = 0.73;
    altarGroup.add(upperSumeru);

    // 4 Corner Carved Dragon-Head Drain Spouts (须弥座四隅螭首石雕排水兽)
    for (const cx of [-1.42, 1.42]) {
      for (const cz of [-1.02, 1.02]) {
        const spoutHead = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.24), sumeruStoneMat);
        spoutHead.position.set(cx, 0.74, cz);
        spoutHead.rotation.y = Math.atan2(cx, cz);
        altarGroup.add(spoutHead);
      }
    }

    // 16 Carved Lotus Petal Upright Collar (仰莲瓣雕花托座)
    for (let p = 0; p < 16; p++) {
      const pAngle = (p / 16) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 4), sumeruStoneMat);
      petal.position.set(Math.cos(pAngle) * 1.3, 0.9, Math.sin(pAngle) * 0.95);
      petal.rotation.x = Math.sin(pAngle) * 0.35;
      petal.rotation.z = -Math.cos(pAngle) * 0.35;
      altarGroup.add(petal);
    }

    // 8.2 Historical Singapore Stone Stele with Double-Dragon Crest (螭首双龙古石碑)
    const steleBody = new THREE.Mesh(new THREE.BoxGeometry(1.85, 2.8, 0.34), steleSandstoneMat);
    steleBody.position.set(0, 2.3, 0);
    steleBody.castShadow = true;
    altarGroup.add(steleBody);

    // Chamfered stone side borders (石碑外缘浮雕立柱)
    for (const sx of [-0.95, 0.95]) {
      const border = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.8, 0.38), sumeruStoneMat);
      border.position.set(sx, 2.3, 0);
      altarGroup.add(border);
    }

    // Dragon-Crested Crown Headpiece (螭首双龙抱额)
    const steleCrown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.92, 0.92, 0.36, 16, 1, false, 0, Math.PI),
      sumeruStoneMat
    );
    steleCrown.position.set(0, 3.7, 0);
    steleCrown.rotation.z = -Math.PI / 2;
    steleCrown.rotation.y = Math.PI / 2;
    altarGroup.add(steleCrown);

    // Sacred Golden Flaming Pearl atop stele (额头摩尼宝珠)
    const jewelOrbMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      roughness: 0.2,
      metalness: 0.9,
      emissive: 0x112222,
      emissiveIntensity: 0.1
    });
    const jewelOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 12),
      jewelOrbMat
    );
    jewelOrb.position.set(0, 4.4, 0);
    altarGroup.add(jewelOrb);
    this.runeSteleJewelMat = jewelOrbMat;

    // 8.3 Three-Legged Archaic Bronze Ding Incense Burner (三足兽首饕餮纹青铜鼎炉)
    const dingGroup = new THREE.Group();
    dingGroup.position.set(0, 0.88, 0.65);

    // Bronze cauldron bowl
    const dingBody = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.32, 0.35, 16), bronzeMat);
    dingBody.position.y = 0.25;
    dingGroup.add(dingBody);

    // Flanged rim and twin loop handles (双立耳)
    for (const hx of [-0.38, 0.38]) {
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 6, 12, Math.PI), bronzeMat);
      handle.position.set(hx, 0.44, 0);
      handle.rotation.z = hx < 0 ? Math.PI / 2 : -Math.PI / 2;
      dingGroup.add(handle);
    }

    // 3 Tripod Beast Legs (三足兽蹄)
    for (let leg = 0; leg < 3; leg++) {
      const lAngle = leg * ((Math.PI * 2) / 3);
      const tripodLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.05, 0.22, 8), bronzeMat);
      tripodLeg.position.set(Math.cos(lAngle) * 0.26, 0.11, Math.sin(lAngle) * 0.26);
      tripodLeg.rotation.z = Math.cos(lAngle) * 0.15;
      dingGroup.add(tripodLeg);
    }

    // Glowing red charcoal ember bed inside cauldron
    const emberBed = new THREE.Mesh(
      new THREE.CircleGeometry(0.34, 16),
      new THREE.MeshBasicMaterial({ color: 0xdd3311 })
    );
    emberBed.position.y = 0.42;
    emberBed.rotation.x = -Math.PI / 2;
    dingGroup.add(emberBed);

    // 3 Burning Sandalwood Incense Sticks (三炷沉香线香)
    for (const ix of [-0.08, 0.0, 0.08]) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.32, 6), new THREE.MeshBasicMaterial({ color: 0x8a3822 }));
      stick.position.set(ix, 0.56, 0);
      dingGroup.add(stick);

      // Glowing incense coal tip
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff3300 }));
      tip.position.set(ix, 0.72, 0);
      dingGroup.add(tip);
    }

    altarGroup.add(dingGroup);

    // 8.4 Carved Teakwood Offering Table with Celadon Tribute (黄花梨供案与青瓷贡品)
    const offerTable = new THREE.Group();
    offerTable.position.set(0, 0.88, 1.25);

    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.55), woodTableMat);
    tableTop.position.y = 0.38;
    offerTable.add(tableTop);

    for (const tx of [-0.62, 0.62]) {
      for (const tz of [-0.22, 0.22]) {
        const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.38, 6), woodTableMat);
        tableLeg.position.set(tx, 0.19, tz);
        offerTable.add(tableLeg);
      }
    }

    // 3 Celadon porcelain tea cups (三盏龙泉青瓷茶盏)
    for (const cx of [-0.35, 0.0, 0.35]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 0.06, 12), celadonMat);
      cup.position.set(cx, 0.44, -0.06);
      offerTable.add(cup);
    }

    // Tribute dish with golden pomelos (贡果盘与金柚)
    const fruitPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.03, 12), celadonMat);
    fruitPlate.position.set(0, 0.42, 0.12);
    offerTable.add(fruitPlate);

    const fruit = new THREE.Mesh(new THREE.DodecahedronGeometry(0.075), fruitMat);
    fruit.position.set(0, 0.49, 0.12);
    offerTable.add(fruit);

    altarGroup.add(offerTable);

    // 8.5 Twin Stone Guardian Braziers with Sacred Fire (双侧神兽石雕燎炉与圣火)
    for (const bx of [-2.2, 2.2]) {
      const brazierGroup = new THREE.Group();
      brazierGroup.position.set(bx, 0, 0);

      // Octagonal tiered stone base
      const bBase = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.58, 0.42, 8), sumeruStoneMat);
      bBase.position.y = 0.21;
      brazierGroup.add(bBase);

      const bWaist = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.58, 8), sumeruStoneMat);
      bWaist.position.y = 0.71;
      brazierGroup.add(bWaist);

      // Bronze fire bowl with lattice
      const bBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.36, 0.38, 12), bronzeMat);
      bBowl.position.y = 1.18;
      brazierGroup.add(bBowl);

      // Glowing ember coals & translucent layered teardrop sacred flame (告别生硬橙色圆锥)
      const emberBed = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xcc4410 })
      );
      emberBed.scale.set(1.0, 0.28, 1.0);
      emberBed.position.y = 1.34;
      brazierGroup.add(emberBed);

      const outerFlameMat = new THREE.MeshBasicMaterial({
        color: 0xff7722,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const fireCore = new THREE.Mesh(new THREE.SphereGeometry(0.20, 12, 10), outerFlameMat);
      fireCore.scale.set(0.82, 1.85, 0.82);
      fireCore.position.y = 1.56;
      brazierGroup.add(fireCore);

      const innerFlameMat = new THREE.MeshBasicMaterial({
        color: 0xffdf70,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const fireFlameInner = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), innerFlameMat);
      fireFlameInner.scale.set(0.75, 1.65, 0.75);
      fireFlameInner.position.y = 1.52;
      brazierGroup.add(fireFlameInner);

      const brazierLight = new THREE.PointLight(0xff7722, 1.25, 6.5);
      brazierLight.position.y = 1.75;
      brazierGroup.add(brazierLight);
      this.pointLights.push(brazierLight);
      this.runeBrazierLights.push(brazierLight);

      altarGroup.add(brazierGroup);
    }

    // Floating Interaction Beacon (Ancient Ember -> Cyan-Gold Luminescence)
    const beaconGeo = new THREE.OctahedronGeometry(0.26, 0);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff6618 });
    const beaconStar = new THREE.Mesh(beaconGeo, beaconMat);
    beaconStar.name = "beacon";
    beaconStar.position.set(0, 5.2, 0);
    altarGroup.add(beaconStar);

    const ringGeo = new THREE.TorusGeometry(0.40, 0.024, 6, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff8833 });
    const beaconRing = new THREE.Mesh(ringGeo, ringMat);
    beaconRing.position.set(0, 5.2, 0);
    altarGroup.add(beaconRing);

    this.runePlaqueAltarGroup = altarGroup;

    this.runeCue = {
      id: "rune-plaque",
      status: "pending",
      beaconGroup: altarGroup,
      beaconStar,
      beaconRing,
      baseY: 5.2,
      bobPhase: 0.8,
      spinSpeed: 1.5,
      pendingBeaconColor: 0xff6618,
      restoredBeaconColor: 0x3de0c8
    };
    this.landmarkCueRecords.push(this.runeCue);

    this.root.add(altarGroup);
  }

  /* 9. Harbor Gate Defense Ramparts & Astrolabe Clockwork Fortress */
  /*    (海防八棱石堡垒、拱形水闸与精密黄铜浑天仪时计)              */
  /* -------------------------------------------------------------- */
  private buildHarborGate() {
    const gateGroup = new THREE.Group();
    gateGroup.position.set(18, 1.0, 3.0);

    // Architectural & Horological Materials
    const ashlarFortMat = new THREE.MeshStandardMaterial({
      map: getAshlarWallTexture(),
      roughness: 0.72
    });
    const rusticatedGraniteMat = new THREE.MeshStandardMaterial({ color: 0x363028, roughness: 0.85 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.88 });
    const darkBrassMat = new THREE.MeshStandardMaterial({ color: 0x9e7b26, roughness: 0.42, metalness: 0.82 });
    const copperRoofMat = new THREE.MeshStandardMaterial({ color: 0x2d5e54, roughness: 0.55, metalness: 0.35 });
    const ironGateMat = new THREE.MeshStandardMaterial({ color: 0x1c1e20, roughness: 0.45, metalness: 0.85 });

    // 9.1 Twin Octagonal Fortified Bastion Watchtowers (双子八角海防花岗岩石堡垒)
    for (const [tz, angleY] of [[-4.5, 0], [4.5, Math.PI]]) {
      const towerGroup = new THREE.Group();
      towerGroup.position.set(0, 0, tz);

      // Sloped Battered Ashlar Foundation (倾斜加固基座)
      const basePlinth = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.55, 1.2, 8), rusticatedGraniteMat);
      basePlinth.position.y = 0.6;
      basePlinth.receiveShadow = true;
      towerGroup.add(basePlinth);

      // Main Octagonal Bastion Shaft with Ashlar Wall Texture (八角石砌主塔身)
      const towerShaft = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 2.1, 5.2, 8), ashlarFortMat);
      towerShaft.position.y = 3.8;
      towerShaft.castShadow = true;
      towerShaft.receiveShadow = true;
      towerGroup.add(towerShaft);

      // 4 Firing Embrasure / Arrow-Slit Openings (箭孔与火炮射击拱窗)
      for (let s = 0; s < 4; s++) {
        const slitAngle = (s / 4) * Math.PI * 2;
        const slitFrame = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.28), rusticatedGraniteMat);
        slitFrame.position.set(Math.cos(slitAngle) * 1.88, 4.2, Math.sin(slitAngle) * 1.88);
        slitFrame.rotation.y = slitAngle;
        towerGroup.add(slitFrame);

        const slitDarkness = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.7, 0.32),
          new THREE.MeshBasicMaterial({ color: 0x0f1112 })
        );
        slitDarkness.position.copy(slitFrame.position);
        slitDarkness.rotation.y = slitAngle;
        towerGroup.add(slitDarkness);
      }

      // Molded Stone Corbel Machicolation Overhang (挑梁突拱与垛口女墙)
      const corbelRing = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 1.9, 0.45, 8), rusticatedGraniteMat);
      corbelRing.position.y = 6.45;
      towerGroup.add(corbelRing);

      // Parapet Crenels & Merlons (女墙垛口)
      for (let m = 0; m < 8; m++) {
        const mAngle = (m / 8) * Math.PI * 2;
        const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.22), rusticatedGraniteMat);
        merlon.position.set(Math.cos(mAngle) * 2.15, 6.95, Math.sin(mAngle) * 2.15);
        merlon.rotation.y = mAngle;
        towerGroup.add(merlon);
      }

      // Octagonal Pyramidal Verdigris Copper Hip Roof (八角铜绿金字塔屋顶)
      const copperRoof = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.75, 8), copperRoofMat);
      copperRoof.position.y = 7.75;
      copperRoof.rotation.y = Math.PI / 8;
      copperRoof.castShadow = true;
      towerGroup.add(copperRoof);

      // Ornamental Brass Weather Vane Spire (黄铜风向标尖塔)
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.06, 0.95, 8), brassMat);
      spire.position.y = 9.0;
      towerGroup.add(spire);

      // Cross direction indicator (E-W-S-N) & vane arrow
      const crossArm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6), brassMat);
      crossArm1.position.y = 9.15;
      crossArm1.rotation.z = Math.PI / 2;
      towerGroup.add(crossArm1);

      const crossArm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6), brassMat);
      crossArm2.position.y = 9.15;
      crossArm2.rotation.x = Math.PI / 2;
      towerGroup.add(crossArm2);

      const vaneArrow = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.24, 4), brassMat);
      vaneArrow.position.set(0.18, 9.35, 0);
      vaneArrow.rotation.z = -Math.PI / 2;
      towerGroup.add(vaneArrow);

      // Exterior Cast-Iron Bracket Lantern (海防领航铜壁灯)
      const bracketArm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.65, 6), ironGateMat);
      bracketArm.position.set(-2.0, 5.0, 0);
      bracketArm.rotation.z = Math.PI / 2;
      towerGroup.add(bracketArm);

      const bLantern = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.35, 6), brassMat);
      bLantern.position.set(-2.3, 4.85, 0);
      towerGroup.add(bLantern);

      const bLight = new THREE.PointLight(0xffb355, 0.95, 6);
      bLight.position.set(-2.3, 4.85, 0);
      towerGroup.add(bLight);
      this.pointLights.push(bLight);

      gateGroup.add(towerGroup);
    }

    // 9.2 Monumental Segmental Arch & Portcullis Grille (海防花岗岩水门大拱与落水铁闸)
    const archGroup = new THREE.Group();

    // Segmental Stone Arch Span across 9m river opening
    const archBeam = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 9.4), ashlarFortMat);
    archBeam.position.set(0, 6.2, 0);
    archBeam.castShadow = true;
    archGroup.add(archBeam);

    // Molded Cornice Entablature
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.28, 9.8), rusticatedGraniteMat);
    cornice.position.set(0, 6.85, 0);
    archGroup.add(cornice);

    // Fortified Top Rampart Balustrade connecting the twin bastions (城墙天桥石雕望柱栏杆)
    for (const rx of [-0.78, 0.78]) {
      const topCopingRail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.10, 6.4), rusticatedGraniteMat);
      topCopingRail.position.set(rx, 7.42, 0);
      archGroup.add(topCopingRail);

      for (let bz = -2.8; bz <= 2.8; bz += 0.7) {
        const baluster = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.42, 8), ashlarFortMat);
        baluster.position.set(rx, 7.18, bz);
        archGroup.add(baluster);
      }
    }

    // Central Keystone (拱顶巨型雕花拱心石)
    const keystone = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.35, 1.1), rusticatedGraniteMat);
    keystone.position.set(0, 6.2, 0);
    archGroup.add(keystone);

    // Lion Crest relief medallion on keystone
    const lionMedallion = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.12, 16), brassMat);
    lionMedallion.position.set(-0.95, 6.2, 0);
    lionMedallion.rotation.z = Math.PI / 2;
    archGroup.add(lionMedallion);

    // Heavy Suspended Portcullis Grille (半悬铸铁落闸栅栏)
    for (let gz = -3.8; gz <= 3.8; gz += 0.55) {
      const pBar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 2.6, 6), ironGateMat);
      pBar.position.set(0, 4.6, gz);
      archGroup.add(pBar);

      // Spiked bottom point
      const pSpike = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 4), ironGateMat);
      pSpike.position.set(0, 3.2, gz);
      pSpike.rotation.x = Math.PI;
      archGroup.add(pSpike);
    }

    // Horizontal portcullis cross ties
    for (const py of [3.8, 4.8, 5.5]) {
      const pCross = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 7.8), ironGateMat);
      pCross.position.set(0, py, 0);
      archGroup.add(pCross);
    }

    gateGroup.add(archGroup);

    // 9.3 Intricate Clockwork Astrolabe & Celestial Chronometer (精密黄铜浑天仪天象时计)
    // Outer Zodiac / Armillary Ring (外层天象刻度环 - 旋转齿轮1)
    const gearOuter = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.09, 12, 32), brassMat);
    gearOuter.position.set(0, 4.3, 0);
    gearOuter.rotation.y = Math.PI / 2;
    gateGroup.add(gearOuter);
    this.harborGears.push(gearOuter);

    // 12 Gear Teeth Nodes on Outer Astrolabe Ring (12枚外缘精密铜齿)
    for (let t = 0; t < 12; t++) {
      const tAngle = (t / 12) * Math.PI * 2;
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.18), darkBrassMat);
      tooth.position.set(0, 4.3 + Math.sin(tAngle) * 1.45, Math.cos(tAngle) * 1.45);
      gearOuter.add(tooth);
    }

    // Inner Sun & Moon Epicycle Cogwheel (内层反向啮合日月齿轮 - 旋转齿轮2)
    const gearInner = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.08, 12, 24), brassMat);
    gearInner.position.set(0, 4.3, 0);
    gearInner.rotation.y = Math.PI / 2;
    gateGroup.add(gearInner);
    this.harborGears.push(gearInner);

    // 4 Brass Cross Spokes linking Inner Gear (4根十字铜轮辐)
    for (let sp = 0; sp < 2; sp++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 8), darkBrassMat);
      spoke.rotation.x = sp * (Math.PI / 2);
      gearInner.add(spoke);
    }

    // Brass Escapement Mechanism & Counterweight Cylinders (重锤与擒纵机构)
    for (const cz of [-0.6, 0.6]) {
      const weightChain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.1, 6), brassMat);
      weightChain.position.set(0, 3.4, cz);
      gateGroup.add(weightChain);

      const weightBob = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.28, 12), darkBrassMat);
      weightBob.position.set(0, 2.7, cz);
      gateGroup.add(weightBob);
    }

    // Glowing Celestial Star Ruby Core (中心发光星光红宝石晶核)
    const rubyMat = new THREE.MeshStandardMaterial({
      color: 0xdc143c,
      roughness: 0.12,
      metalness: 0.88,
      emissive: 0x990022,
      emissiveIntensity: 0.6
    });
    const ruby = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38), rubyMat);
    ruby.position.set(0, 4.3, 0);
    gateGroup.add(ruby);

    const rubyGlowLight = new THREE.PointLight(0xff2244, 1.2, 6);
    rubyGlowLight.position.set(0, 4.3, 0);
    gateGroup.add(rubyGlowLight);
    this.pointLights.push(rubyGlowLight);

    // Floating Interaction Beacon (Marine Bronze -> Star Ruby Harmonic Pulse)
    const beaconGeo = new THREE.OctahedronGeometry(0.28, 0);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xcca044 });
    const beaconStar = new THREE.Mesh(beaconGeo, beaconMat);
    beaconStar.name = "beacon";
    beaconStar.position.set(0, 8.0, 0);
    gateGroup.add(beaconStar);

    const ringGeo = new THREE.TorusGeometry(0.46, 0.024, 6, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xcca044 });
    const beaconRing = new THREE.Mesh(ringGeo, ringMat);
    beaconRing.position.set(0, 8.0, 0);
    gateGroup.add(beaconRing);

    const secRingGeo = new THREE.TorusGeometry(0.32, 0.018, 6, 20);
    const secRingMat = new THREE.MeshBasicMaterial({ color: 0xb8860b });
    const secondaryRing = new THREE.Mesh(secRingGeo, secRingMat);
    secondaryRing.position.set(0, 8.0, 0);
    gateGroup.add(secondaryRing);

    this.harborRubyMat = rubyMat;
    this.harborRubyLight = rubyGlowLight;
    this.harborGateGroup = gateGroup;

    this.harborCue = {
      id: "harbor-seal",
      status: "pending",
      beaconGroup: gateGroup,
      beaconStar,
      beaconRing,
      secondaryRing,
      baseY: 8.0,
      bobPhase: 1.6,
      spinSpeed: 1.4,
      pendingBeaconColor: 0xcca044,
      restoredBeaconColor: 0xff2255
    };
    this.landmarkCueRecords.push(this.harborCue);

    this.root.add(gateGroup);
  }

  /* -------------------------------------------------------------- */
  /* 10. Spirit Realm Gateway (南洋秘境云纹通灵石牌坊与星流漩涡)      */
  /* -------------------------------------------------------------- */
  private buildSpiritGateway() {
    const portalGroup = new THREE.Group();
    portalGroup.position.set(-14, 1.0, 16);

    // Materials
    const granitePlinthMat = new THREE.MeshStandardMaterial({ color: 0x2d3432, roughness: 0.85 });
    const jadeStoneMat = new THREE.MeshStandardMaterial({ color: 0x1b3832, roughness: 0.62, metalness: 0.12 });
    const tealGlazeMat = new THREE.MeshStandardMaterial({ color: 0x1c594c, roughness: 0.45, metalness: 0.2 });
    const goldOrnamentMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.35, metalness: 0.85 });
    const bronzeChimeMat = new THREE.MeshStandardMaterial({ color: 0x3d7065, roughness: 0.5, metalness: 0.75 });
    const silkRibbonMat = new THREE.MeshStandardMaterial({ color: 0x2de0c2, roughness: 0.55 });
    const runeGlowMat = new THREE.MeshBasicMaterial({ color: 0x3de0c8 });

    // 10.1 Stepped Granite Foundation Plinths, Ceremonial Steps & Jade Balustrades (抱鼓石基座与汉白玉青玉栏杆)
    const lowerTerrace = new THREE.Mesh(new THREE.BoxGeometry(8.1, 0.18, 3.3), granitePlinthMat);
    lowerTerrace.position.y = 0.09;
    lowerTerrace.receiveShadow = true;
    portalGroup.add(lowerTerrace);

    const platform = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.35, 2.6), granitePlinthMat);
    platform.position.y = 0.24;
    platform.receiveShadow = true;
    portalGroup.add(platform);

    // Carved Jade Wing Balustrades flanking the outer approach
    for (const side of [-1, 1]) {
      const wingRail = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.10, 0.14), jadeStoneMat);
      wingRail.position.set(side * 3.15, 0.78, 0.95);
      portalGroup.add(wingRail);

      const wingPanel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.32, 0.08), tealGlazeMat);
      wingPanel.position.set(side * 3.15, 0.56, 0.95);
      portalGroup.add(wingPanel);

      for (const postX of [side * 2.52, side * 3.78]) {
        const jPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.095, 0.62, 8), jadeStoneMat);
        jPost.position.set(postX, 0.58, 0.95);
        portalGroup.add(jPost);

        const jFinial = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 8), goldOrnamentMat);
        jFinial.position.set(postX, 0.94, 0.95);
        portalGroup.add(jFinial);
      }
    }

    for (const px of [-2.4, 2.4]) {
      // Baogu Drum Stones (左右抱鼓石基座)
      const drumPlinth = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.75, 1.3), granitePlinthMat);
      drumPlinth.position.set(px, 0.55, 0);
      drumPlinth.castShadow = true;
      portalGroup.add(drumPlinth);

      // Circular relief drum discs on front and back
      for (const dz of [-0.68, 0.68]) {
        const drumDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 16), jadeStoneMat);
        drumDisc.position.set(px, 0.6, dz);
        drumDisc.rotation.x = Math.PI / 2;
        portalGroup.add(drumDisc);
      }

      // 10.2 Octagonal Spirit Jade Columns (八棱通灵翡翠石柱)
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 5.2, 8), jadeStoneMat);
      pillar.position.set(px, 3.4, 0);
      pillar.castShadow = true;
      portalGroup.add(pillar);

      // Spiraling Cloud Dragon Relief Rings (蟠龙云纹石雕柱圈)
      for (let r = 0; r < 4; r++) {
        const coilRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.04, 6, 16), jadeStoneMat);
        coilRing.position.set(px, 1.8 + r * 1.0, 0);
        coilRing.rotation.x = Math.PI / 2 + 0.15;
        coilRing.rotation.z = r * 0.4;
        portalGroup.add(coilRing);
      }

      // Pillar Capital Collar with Bronze Accents
      const capital = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.38, 0.98), jadeStoneMat);
      capital.position.set(px, 5.9, 0);
      portalGroup.add(capital);
    }

    // 10.3 Classical Multi-Tiered Dougong Bracket Sets (三进飞挑斗拱结构)
    for (const px of [-2.4, 2.4]) {
      for (let dg = 0; dg < 3; dg++) {
        const dougong = new THREE.Mesh(new THREE.BoxGeometry(0.85 + dg * 0.3, 0.18, 0.32 + dg * 0.15), jadeStoneMat);
        dougong.position.set(px, 6.15 + dg * 0.22, 0);
        portalGroup.add(dougong);
      }
    }

    // 10.4 Double-Tiered Sweeping Swallowtail Eaves (双层飞檐燕尾脊大屋顶)
    // Lower Architrave Beam
    const architrave = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.55, 0.95), jadeStoneMat);
    architrave.position.set(0, 5.7, 0);
    architrave.castShadow = true;
    portalGroup.add(architrave);

    // Celestial Seal Inscription Tablet Lintel (灵境篆书宝额: "星洲古界 · 灵墟")
    const plaqueMat = new THREE.MeshStandardMaterial({ color: 0x421818, roughness: 0.6 });
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.72, 0.22), plaqueMat);
    plaque.position.set(0, 6.35, 0);
    portalGroup.add(plaque);

    const plaqueFrame = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.85, 0.26), goldOrnamentMat);
    plaqueFrame.position.set(0, 6.35, -0.02);
    portalGroup.add(plaqueFrame);

    // Glowing Ancient Sigil on Plaque
    const sigil = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.26, 6), runeGlowMat);
    sigil.position.set(0, 6.35, 0.13);
    portalGroup.add(sigil);

    // Grand Upper Roof with Upturned Swallowtail Wings (飞檐燕尾顶)
    const upperRoof = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.35, 1.8), tealGlazeMat);
    upperRoof.position.set(0, 6.95, 0);
    upperRoof.castShadow = true;
    portalGroup.add(upperRoof);

    // Sweeping upturned swallowtail horns (左右冲天燕尾双脊)
    for (const rx of [-4.0, 4.0]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.95, 4), tealGlazeMat);
      horn.position.set(rx, 7.3, 0);
      horn.rotation.z = rx < 0 ? -Math.PI / 4 : Math.PI / 4;
      portalGroup.add(horn);

      const beastFinial = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16), goldOrnamentMat);
      beastFinial.position.set(rx + (rx < 0 ? -0.32 : 0.32), 7.6, 0);
      portalGroup.add(beastFinial);
    }

    // Central Roof Pearl Finial
    const roofPearl = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), runeGlowMat);
    roofPearl.position.set(0, 7.35, 0);
    portalGroup.add(roofPearl);

    // 10.5 Hanging Temple Wind Chimes with Silk Talisman Ribbons (青铜风铎与祈愿符带)
    for (let c = -1.8; c <= 1.8; c += 0.72) {
      const chimeGroup = new THREE.Group();
      chimeGroup.position.set(c, 5.3, 0);

      // Bronze bell
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.095, 0.26, 8), bronzeChimeMat);
      chimeGroup.add(bell);

      // Jade clapper ring
      const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), runeGlowMat);
      clapper.position.y = -0.15;
      chimeGroup.add(clapper);

      // Fluttering silk talisman ribbon (祈愿符带)
      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.65, 0.01), silkRibbonMat);
      ribbon.position.set(0, -0.48, 0);
      ribbon.rotation.z = Math.sin(c * 2) * 0.15;
      chimeGroup.add(ribbon);

      portalGroup.add(chimeGroup);
      this.portalChimes.push({ chime: chimeGroup, ribbon, basePos: new THREE.Vector3(c, 5.3, 0) });
    }

    // 10.6 Swirling Emerald Spirit Vortex Particles (双环天体灵涡微粒)
    const particleCount = 240;
    const vortexGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const isInner = i % 2 === 0;
      const r = isInner ? Math.random() * 1.1 + 0.15 : Math.random() * 1.9 + 0.6;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = 2.4 + (Math.random() - 0.5) * 2.8;
      positions[i * 3 + 2] = Math.sin(angle) * (r * 0.75);
    }
    vortexGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const vortexMat = new THREE.PointsMaterial({
      color: 0x3de0c8,
      size: 0.16,
      transparent: true,
      opacity: 0.82
    });
    this.spiritVortex = new THREE.Points(vortexGeo, vortexMat);
    portalGroup.add(this.spiritVortex);

    // Emerald Portal Glow
    const portalLight = new THREE.PointLight(0x3de0c8, 1.85, 10);
    portalLight.position.set(0, 2.9, 0);
    portalGroup.add(portalLight);
    this.pointLights.push(portalLight);

    // Floating Interaction Beacon (Emerald Vortex -> Golden-Teal Aurora)
    const beaconGeo = new THREE.OctahedronGeometry(0.28, 0);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x3de0c8 });
    const beaconStar = new THREE.Mesh(beaconGeo, beaconMat);
    beaconStar.name = "beacon";
    beaconStar.position.set(0, 8.5, 0);
    portalGroup.add(beaconStar);

    const ringGeo = new THREE.TorusGeometry(0.44, 0.024, 6, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x3de0c8 });
    const beaconRing = new THREE.Mesh(ringGeo, ringMat);
    beaconRing.position.set(0, 8.5, 0);
    portalGroup.add(beaconRing);

    this.spiritPortalLight = portalLight;
    this.spiritGatewayGroup = portalGroup;

    this.spiritCue = {
      id: "spirit-chime",
      status: "pending",
      beaconGroup: portalGroup,
      beaconStar,
      beaconRing,
      baseY: 8.5,
      bobPhase: 2.4,
      spinSpeed: 1.6,
      pendingBeaconColor: 0x3de0c8,
      restoredBeaconColor: 0x66ffcc
    };
    this.landmarkCueRecords.push(this.spiritCue);

    this.root.add(portalGroup);
  }
/* 11. Merlion Fountain Statue (鱼尾狮喷泉圣像 - 雕塑级手雕重构)    */
  /* -------------------------------------------------------------- */
  private buildMerlionStatue() {
    const merlionGroup = new THREE.Group();
    merlionGroup.position.set(16, 1.0, -10);

    // Warm artisanal limestone & granite materials
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0xedeae1,
      roughness: 0.52,
      metalness: 0.05
    });
    const darkStoneMat = new THREE.MeshStandardMaterial({
      color: 0xbdb7a9,
      roughness: 0.72
    });
    const mouthInteriorMat = new THREE.MeshStandardMaterial({
      color: 0x2b1515,
      roughness: 0.85
    });
    const fangMat = new THREE.MeshStandardMaterial({
      color: 0xfffff5,
      roughness: 0.28
    });
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x1f1914,
      roughness: 0.2,
      metalness: 0.6
    });

    /* ============================================================== */
    /* 11.1 Tiered Octagonal Wave Plinth with Surging Breaker Volutes  */
    /* ============================================================== */
    // Outer Viewing Terrace & Classical Balustrade Posts
    const viewingTerrace = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.48, 0.18, 8), darkStoneMat);
    viewingTerrace.position.y = 0.09;
    viewingTerrace.receiveShadow = true;
    merlionGroup.add(viewingTerrace);

    for (let bp = 0; bp < 8; bp++) {
      // Leave the riverward (+Z) spouting arc open for clear fountain cascade view
      if (bp === 1 || bp === 2) continue;
      const bAng = (bp / 8) * Math.PI * 2 + Math.PI / 8;
      const bx = Math.cos(bAng) * 3.12;
      const bz = Math.sin(bAng) * 3.12;
      const bPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.52, 8), stoneMat);
      bPost.position.set(bx, 0.42, bz);
      bPost.castShadow = true;
      merlionGroup.add(bPost);

      const bCap = new THREE.Mesh(new THREE.SphereGeometry(0.095, 8, 8), darkStoneMat);
      bCap.position.set(bx, 0.72, bz);
      merlionGroup.add(bCap);
    }

    // Tier 1 Base: Stepped octagonal granite plinth
    const plinthTier1 = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.95, 0.4, 8), darkStoneMat);
    plinthTier1.position.y = 0.2;
    plinthTier1.receiveShadow = true;
    merlionGroup.add(plinthTier1);

    // Tier 2 Mid: Octagonal pedestal with carved stone rustication
    const plinthTier2 = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.6, 0.65, 8), stoneMat);
    plinthTier2.position.y = 0.7;
    plinthTier2.receiveShadow = true;
    plinthTier2.castShadow = true;
    merlionGroup.add(plinthTier2);

    // Historical Commemorative Plaque on front face (+Z direction)
    const plaqueBack = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.72, 0.08), darkStoneMat);
    plaqueBack.position.set(0, 0.7, 2.45);
    merlionGroup.add(plaqueBack);

    const plaqueFace = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 0.64),
      new THREE.MeshStandardMaterial({
        map: getMerlionPlaqueTexture(),
        roughness: 0.4,
        metalness: 0.5
      })
    );
    plaqueFace.position.set(0, 0.7, 2.5);
    merlionGroup.add(plaqueFace);

    // Tier 3 Cap: Upper pedestal cornice with torus edge molding
    const plinthTier3 = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.22, 0.3, 8), darkStoneMat);
    plinthTier3.position.y = 1.15;
    merlionGroup.add(plinthTier3);

    const torusRim = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.09, 8, 32), stoneMat);
    torusRim.rotation.x = Math.PI / 2;
    torusRim.position.y = 1.28;
    merlionGroup.add(torusRim);

    // 8 Surging Ocean Wave Scroll Volutes (浪花卷浪) encircling the plinth
    const waveShape = new THREE.Shape();
    waveShape.moveTo(0, 0);
    waveShape.quadraticCurveTo(0.2, 0.05, 0.35, 0.25);
    waveShape.quadraticCurveTo(0.48, 0.55, 0.32, 0.72);
    waveShape.quadraticCurveTo(0.18, 0.82, 0.1, 0.68);
    waveShape.quadraticCurveTo(0.22, 0.54, 0.22, 0.36);
    waveShape.quadraticCurveTo(0.12, 0.18, 0, 0);
    const waveGeo = new THREE.ExtrudeGeometry(waveShape, {
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 2
    });

    for (let i = 0; i < 8; i++) {
      const angle = i * (Math.PI / 4) + Math.PI / 8;
      const waveMesh = new THREE.Mesh(waveGeo, stoneMat);
      const r = 2.18;
      waveMesh.position.set(Math.cos(angle) * r, 0.5, Math.sin(angle) * r);
      waveMesh.rotation.y = -angle + Math.PI / 2;
      waveMesh.scale.set(1.2, 1.1, 1.2);
      waveMesh.castShadow = true;
      merlionGroup.add(waveMesh);
    }

    /* ============================================================== */
    /* 11.2 Continuous S-Curve Lofted Merlion Body & Imbricated Scales */
    /* ============================================================== */
    const bodyRoot = new THREE.Group();
    bodyRoot.position.set(0, 0, 0);
    merlionGroup.add(bodyRoot);

    // Multi-tiered foaming wave surge collar at the foot of the Merlion
    const surgeCollarLower = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.24, 14, 36), stoneMat);
    surgeCollarLower.rotation.x = Math.PI / 2 - 0.16;
    surgeCollarLower.position.set(0, 1.32, -0.28);
    surgeCollarLower.castShadow = true;
    bodyRoot.add(surgeCollarLower);

    const surgeCollarUpper = new THREE.Mesh(new THREE.TorusGeometry(1.38, 0.16, 12, 32), darkStoneMat);
    surgeCollarUpper.rotation.x = Math.PI / 2 - 0.20;
    surgeCollarUpper.position.set(0, 1.48, -0.30);
    surgeCollarUpper.castShadow = true;
    bodyRoot.add(surgeCollarUpper);

    // Single continuous S-curve lofted Merlion body mesh (zero stacked-cylinder seams!)
    const merlionSpine = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.24, -0.34),
      new THREE.Vector3(0, 1.85, -0.36),
      new THREE.Vector3(0, 2.58, -0.10),
      new THREE.Vector3(0, 3.38, 0.20),
      new THREE.Vector3(0, 4.18, 0.36),
      new THREE.Vector3(0, 4.92, 0.44)
    ]);

    const radialSegs = 56;
    const heightRings = 44;
    const merlionPositions: number[] = [];
    const merlionUvs: number[] = [];
    const merlionIndices: number[] = [];
    const upVec = new THREE.Vector3(0, 1, 0);
    const tangent = new THREE.Vector3();
    const rightAxis = new THREE.Vector3();
    const forwardAxis = new THREE.Vector3();
    const ringCenter = new THREE.Vector3();

    for (let j = 0; j <= heightRings; j++) {
      const v = j / heightRings;
      merlionSpine.getPoint(v, ringCenter);
      merlionSpine.getTangent(v, tangent).normalize();
      rightAxis.crossVectors(upVec, tangent);
      if (rightAxis.lengthSq() < 1e-6) rightAxis.set(1, 0, 0);
      else rightAxis.normalize();
      forwardAxis.crossVectors(tangent, rightAxis).normalize();

      // Organic anatomical radius taper from wide caudal base to athletic waist, proud lion chest, and neck collar
      const baseR =
        1.48 * Math.pow(1 - v, 2.2) +
        1.12 * 3 * v * Math.pow(1 - v, 2) +
        1.08 * 3 * v * v * (1 - v) +
        0.78 * Math.pow(v, 3);

      // Chest expansion in the upper-mid torso (v around 0.58..0.82)
      const chestPectoralSwell = Math.exp(-Math.pow((v - 0.68) / 0.16, 2)) * 0.12;

      for (let i = 0; i <= radialSegs; i++) {
        const u = i / radialSegs;
        const theta = u * Math.PI * 2;
        const cosT = Math.cos(theta); // X lateral
        const sinT = Math.sin(theta); // Z forward (+1 is riverward front, -1 is dorsal back)

        // Imbricated scalloped fish-scale relief along lower & mid body (v < 0.74)
        const scaleZone = Math.max(0, Math.min(1, (0.76 - v) / 0.18));
        const tierPhase = v * 9.0;
        const tierFrac = tierPhase - Math.floor(tierPhase);
        const stagger = Math.floor(tierPhase) % 2 === 0 ? 0 : Math.PI / 8;
        const scaleScallop =
          scaleZone *
          0.075 *
          (1 - tierFrac * 0.78) *
          Math.abs(Math.cos(theta * 8 + stagger));

        // Proud lion chest sternum & pectoral contour on front (+sinT) in upper torso
        const pectoralContour =
          v > 0.52 && sinT > 0
            ? Math.sin((v - 0.52) / 0.48 * Math.PI) * Math.pow(sinT, 2) * (0.09 - 0.04 * Math.cos(theta * 4))
            : 0;

        // Dorsal spinal ridge along back (-sinT)
        const dorsalSpine = sinT < -0.6 ? Math.pow((-sinT - 0.6) / 0.4, 2) * 0.06 * (1 - v * 0.5) : 0;

        const rX = (baseR + chestPectoralSwell * 0.8 + scaleScallop) * 0.96;
        const rZ = baseR + chestPectoralSwell * 1.15 + scaleScallop + pectoralContour + dorsalSpine;

        const lx = cosT * rX;
        const lz = sinT * rZ;

        const wx = ringCenter.x + rightAxis.x * lx + forwardAxis.x * lz;
        const wy = ringCenter.y + rightAxis.y * lx + forwardAxis.y * lz;
        const wz = ringCenter.z + rightAxis.z * lx + forwardAxis.z * lz;

        merlionPositions.push(wx, wy, wz);
        merlionUvs.push(u, v);
      }
    }

    const merlionStride = radialSegs + 1;
    for (let j = 0; j < heightRings; j++) {
      for (let i = 0; i < radialSegs; i++) {
        const a = j * merlionStride + i;
        const b = a + 1;
        const c = (j + 1) * merlionStride + i;
        const d = c + 1;
        merlionIndices.push(a, b, d);
        merlionIndices.push(a, d, c);
      }
    }

    const merlionBodyGeo = new THREE.BufferGeometry();
    merlionBodyGeo.setAttribute("position", new THREE.Float32BufferAttribute(merlionPositions, 3));
    merlionBodyGeo.setAttribute("uv", new THREE.Float32BufferAttribute(merlionUvs, 2));
    merlionBodyGeo.setIndex(merlionIndices);
    merlionBodyGeo.computeVertexNormals();

    const merlionScaleTex = getMerlionScaleTexture();
    const merlionScaleMat = new THREE.MeshStandardMaterial({
      map: merlionScaleTex,
      bumpMap: merlionScaleTex,
      bumpScale: 0.045,
      color: 0xf4efe4,
      roughness: 0.62,
      metalness: 0.04
    });

    const merlionBodyMesh = new THREE.Mesh(merlionBodyGeo, merlionScaleMat);
    merlionBodyMesh.castShadow = true;
    merlionBodyMesh.receiveShadow = true;
    bodyRoot.add(merlionBodyMesh);

    // Sculpted Sweeping Lion Mane Mantle Curls around upper neck (雄狮颈部层叠卷云鬃毛浮雕)
    const maneLockGeo = new THREE.TorusGeometry(0.16, 0.058, 10, 18, Math.PI * 1.45);
    for (let ring = 0; ring < 2; ring++) {
      const lockCount = 12;
      const ringY = 4.68 - ring * 0.22;
      const ringZ = 0.40 - ring * 0.04;
      const ringR = 0.72 + ring * 0.05;
      for (let lk = 0; lk < lockCount; lk++) {
        const ang = ((lk + (ring % 2) * 0.5) / lockCount) * Math.PI * 2;
        // Leave front throat center (+Z, ang near PI/2) slightly parted so roaring chin curls lead into chest
        if (ring === 0 && Math.abs(ang - Math.PI / 2) < 0.32) continue;
        const lx = Math.cos(ang) * ringR * 0.94;
        const lz = ringZ + Math.sin(ang) * ringR * 1.02;
        const maneLock = new THREE.Mesh(maneLockGeo, stoneMat);
        maneLock.position.set(lx, ringY, lz);
        maneLock.rotation.set(0.35, -ang + Math.PI / 2, 0.25);
        maneLock.castShadow = true;
        bodyRoot.add(maneLock);
      }
    }

    // Sculpted Serrated Dorsal Ridge Fin (背脊背鳍) along back curve
    const dorsalShape = new THREE.Shape();
    dorsalShape.moveTo(0, 0);
    dorsalShape.quadraticCurveTo(-0.35, 0.4, -0.58, 0.85);
    dorsalShape.lineTo(-0.42, 0.9);
    dorsalShape.quadraticCurveTo(-0.62, 1.3, -0.68, 1.65);
    dorsalShape.lineTo(-0.48, 1.7);
    dorsalShape.quadraticCurveTo(-0.6, 2.05, -0.62, 2.3);
    dorsalShape.quadraticCurveTo(-0.25, 1.7, 0, 1.1);
    dorsalShape.closePath();

    const dorsalGeo = new THREE.ExtrudeGeometry(dorsalShape, {
      depth: 0.09,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 3
    });
    const dorsalMesh = new THREE.Mesh(dorsalGeo, stoneMat);
    dorsalMesh.position.set(0.045, 2.05, -0.52);
    dorsalMesh.rotation.y = -Math.PI / 2;
    dorsalMesh.castShadow = true;
    bodyRoot.add(dorsalMesh);

    // Bifurcated Caudal Mermaid Tail Fins (后侧分叉鱼尾鳍 - 扇形波浪浮雕)
    const caudalShape = new THREE.Shape();
    caudalShape.moveTo(0, 0);
    caudalShape.quadraticCurveTo(0.28, 0.35, 0.62, 0.92);
    caudalShape.quadraticCurveTo(0.45, 0.98, 0.24, 0.72);
    caudalShape.quadraticCurveTo(0.08, 0.38, 0, 0);

    const caudalGeo = new THREE.ExtrudeGeometry(caudalShape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.025,
      bevelSegments: 3
    });

    for (const [side, rotZ] of [
      [1, 0.42],
      [-1, -0.42]
    ]) {
      const caudalFluke = new THREE.Mesh(caudalGeo, stoneMat);
      caudalFluke.position.set(side * 0.44, 1.62, -1.24);
      caudalFluke.rotation.set(-0.35, side * 0.42, rotZ);
      caudalFluke.scale.set(side * 1.18, 1.18, 1.0);
      caudalFluke.castShadow = true;
      bodyRoot.add(caudalFluke);
    }

    /* ============================================================== */
    /* 11.3 Sculpted Roaring Lion Head, Contoured Muzzle & Fangs      */
    /* ============================================================== */
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 5.0, 0.45);
    merlionGroup.add(headGroup);

    // High-segment Sculpted Cranium & Temporal Dome (28x24 segments)
    const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.84, 28, 24), stoneMat);
    cranium.position.set(0, 0.06, -0.02);
    cranium.scale.set(0.96, 1.02, 1.08);
    cranium.castShadow = true;
    headGroup.add(cranium);

    // Sculpted Cheekbone & Zygomatic Arches (左右狮颊隆起肌群)
    for (const cx of [-0.40, 0.40]) {
      const cheekArch = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 14), stoneMat);
      cheekArch.position.set(cx, -0.02, 0.28);
      cheekArch.scale.set(0.70, 0.82, 1.08);
      cheekArch.castShadow = true;
      headGroup.add(cheekArch);
    }

    // Curved Supraorbital Brow Arches (雕刻感狮王眉弓)
    for (const bx of [-0.26, 0.26]) {
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.18, 8, 14), darkStoneMat);
      brow.position.set(bx, 0.28, 0.56);
      brow.rotation.set(0.18, bx > 0 ? -0.25 : 0.25, Math.PI / 2 + (bx > 0 ? -0.18 : 0.18));
      headGroup.add(brow);
    }

    // Contoured Broad Upper Muzzle / Nasal Bridge
    const snoutBridge = new THREE.Mesh(new THREE.CapsuleGeometry(0.31, 0.34, 12, 20), stoneMat);
    snoutBridge.rotation.x = Math.PI / 2 - 0.14;
    snoutBridge.scale.set(1.24, 1.0, 0.84);
    snoutBridge.position.set(0, 0.01, 0.50);
    snoutBridge.castShadow = true;
    headGroup.add(snoutBridge);

    // Sculpted Broad Lion Nose Pad (如意形狮鼻头与鼻翼)
    const nosePad = new THREE.Mesh(new THREE.SphereGeometry(0.185, 16, 12), darkStoneMat);
    nosePad.scale.set(1.36, 0.74, 0.72);
    nosePad.position.set(0, 0.09, 0.84);
    headGroup.add(nosePad);

    // Integrated Whisker Muzzle Contours tucked smoothly below nasal bridge
    for (const wx of [-0.145, 0.145]) {
      const whiskerPad = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 14), stoneMat);
      whiskerPad.position.set(wx, -0.055, 0.67);
      whiskerPad.scale.set(0.92, 0.72, 1.02);
      whiskerPad.castShadow = true;
      headGroup.add(whiskerPad);
    }

    // Deep Open Roaring Mouth Cavity (recessed inside throat so muzzle & fangs frame the water jet cleanly)
    const mouthCavity = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.20, 0.32, 16), mouthInteriorMat);
    mouthCavity.rotation.x = Math.PI / 2;
    mouthCavity.scale.set(1.10, 1.0, 0.76);
    mouthCavity.position.set(0, -0.15, 0.56);
    headGroup.add(mouthCavity);

    // Sculpted Curved Lower Jaw (Mandible) with Rounded Chin & Beard Curls
    const lowerJaw = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.34, 12, 18), stoneMat);
    lowerJaw.rotation.x = Math.PI / 2 + 0.22;
    lowerJaw.scale.set(1.24, 1.0, 0.62);
    lowerJaw.position.set(0, -0.35, 0.58);
    lowerJaw.castShadow = true;
    headGroup.add(lowerJaw);

    // Sculpted Chin Tuft Curls under lower mandible
    for (const jx of [-0.14, 0, 0.14]) {
      const chinCurl = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.045, 8, 14, Math.PI * 1.3), darkStoneMat);
      chinCurl.position.set(jx, -0.46, 0.64 - Math.abs(jx) * 0.2);
      chinCurl.rotation.set(0.5, jx * 1.2, 0);
      headGroup.add(chinCurl);
    }

    // Crimson Tongue in lower jaw
    const tongue = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.10, 0.18, 8, 12),
      new THREE.MeshStandardMaterial({ color: 0x7c2d2d, roughness: 0.55 })
    );
    tongue.rotation.x = Math.PI / 2 + 0.15;
    tongue.scale.set(1.15, 1.0, 0.35);
    tongue.position.set(0, -0.25, 0.60);
    headGroup.add(tongue);

    // 4 Chiseled White Canine Fangs + Incisor Row
    for (const fx of [-0.17, 0.17]) {
      const upperFang = new THREE.Mesh(new THREE.ConeGeometry(0.050, 0.18, 12), fangMat);
      upperFang.position.set(fx, -0.10, 0.78);
      upperFang.rotation.x = Math.PI - 0.08;
      headGroup.add(upperFang);

      const lowerFang = new THREE.Mesh(new THREE.ConeGeometry(0.044, 0.16, 12), fangMat);
      lowerFang.position.set(fx * 0.86, -0.23, 0.73);
      lowerFang.rotation.x = 0.12;
      headGroup.add(lowerFang);
    }

    // Recessed Limestone Spout Nozzle inside open jaws
    const spout = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.14, 0.24, 16),
      darkStoneMat
    );
    spout.rotation.x = Math.PI / 2;
    spout.position.set(0, -0.12, 0.66);
    headGroup.add(spout);

    // Chiseled Almond Eyes & Eyelid Hoods
    for (const ex of [-0.32, 0.32]) {
      const eyeLid = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.032, 8, 16, Math.PI), darkStoneMat);
      eyeLid.position.set(ex, 0.18, 0.56);
      eyeLid.rotation.y = ex > 0 ? 0.32 : -0.32;
      headGroup.add(eyeLid);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 12), eyeMat);
      pupil.position.set(ex, 0.15, 0.56);
      headGroup.add(pupil);
    }

    // Sculpted Lion Ears atop cranium
    for (const [ex, rotZ] of [
      [-0.58, -0.35],
      [0.58, 0.35]
    ]) {
      const earGroup = new THREE.Group();
      earGroup.position.set(ex, 0.65, 0.02);
      earGroup.rotation.set(-0.2, 0, rotZ);

      const earBack = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), stoneMat);
      earBack.scale.set(0.9, 1.12, 0.48);
      earGroup.add(earBack);

      const earHollow = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 10), darkStoneMat);
      earHollow.scale.set(0.8, 1.0, 0.36);
      earHollow.position.z = 0.045;
      earGroup.add(earHollow);

      headGroup.add(earGroup);
    }

    /* ============================================================== */
    /* 11.4 28 Layered Sculpted Mane Curls (传统狮鬃卷云浮雕满铺领圈)   */
    /* ============================================================== */
    const curlGeo = new THREE.TorusGeometry(0.19, 0.072, 10, 20, Math.PI * 1.55);
    const curlConfigs = [
      // Crown curls between ears
      { x: -0.22, y: 0.68, z: -0.15, rx: -0.3, ry: 0, rz: 0.2 },
      { x: 0.22, y: 0.68, z: -0.15, rx: -0.3, ry: 0, rz: -0.2 },
      { x: 0.0, y: 0.72, z: 0.05, rx: 0.1, ry: 0, rz: 0.0 },

      // Cheek curls cascading down jawline (Left side)
      { x: -0.58, y: 0.22, z: 0.32, rx: 0.2, ry: -0.6, rz: 0.4 },
      { x: -0.62, y: -0.05, z: 0.25, rx: 0.1, ry: -0.7, rz: 0.5 },
      { x: -0.55, y: -0.28, z: 0.18, rx: 0.0, ry: -0.8, rz: 0.6 },
      { x: -0.66, y: 0.08, z: -0.05, rx: 0.1, ry: -1.1, rz: 0.3 },

      // Cheek curls cascading down jawline (Right side)
      { x: 0.58, y: 0.22, z: 0.32, rx: 0.2, ry: 0.6, rz: -0.4 },
      { x: 0.62, y: -0.05, z: 0.25, rx: 0.1, ry: 0.7, rz: -0.5 },
      { x: 0.55, y: -0.28, z: 0.18, rx: 0.0, ry: 0.8, rz: -0.6 },
      { x: 0.66, y: 0.08, z: -0.05, rx: 0.1, ry: 1.1, rz: -0.3 },

      // Full-circle Neck & Chest Mantle Curls (bridging head to lofted neck seamlessly)
      { x: -0.44, y: -0.52, z: 0.16, rx: 0.2, ry: -0.4, rz: 0.3 },
      { x: 0.44, y: -0.52, z: 0.16, rx: 0.2, ry: 0.4, rz: -0.3 },
      { x: -0.22, y: -0.64, z: 0.26, rx: 0.3, ry: -0.2, rz: 0.2 },
      { x: 0.22, y: -0.64, z: 0.26, rx: 0.3, ry: 0.2, rz: -0.2 },
      { x: 0.0, y: -0.68, z: 0.30, rx: 0.35, ry: 0, rz: 0.0 },
      { x: -0.56, y: -0.46, z: -0.18, rx: 0.1, ry: -0.9, rz: 0.4 },
      { x: 0.56, y: -0.46, z: -0.18, rx: 0.1, ry: 0.9, rz: -0.4 },

      // Nape of neck & spine cascade
      { x: -0.34, y: 0.32, z: -0.62, rx: -0.4, ry: -0.3, rz: 0.1 },
      { x: 0.34, y: 0.32, z: -0.62, rx: -0.4, ry: 0.3, rz: -0.1 },
      { x: 0.0, y: 0.22, z: -0.72, rx: -0.5, ry: 0, rz: 0.0 },
      { x: -0.26, y: -0.15, z: -0.68, rx: -0.3, ry: -0.2, rz: 0.2 },
      { x: 0.26, y: -0.15, z: -0.68, rx: -0.3, ry: 0.2, rz: -0.2 },
      { x: 0.0, y: -0.42, z: -0.68, rx: -0.2, ry: 0, rz: 0.0 },
      { x: -0.38, y: -0.58, z: -0.52, rx: -0.25, ry: -0.5, rz: 0.2 },
      { x: 0.38, y: -0.58, z: -0.52, rx: -0.25, ry: 0.5, rz: -0.2 },
      { x: 0.0, y: -0.72, z: -0.62, rx: -0.2, ry: 0, rz: 0.0 }
    ];

    for (let cIdx = 0; cIdx < curlConfigs.length; cIdx++) {
      const cc = curlConfigs[cIdx];
      const curl = new THREE.Mesh(curlGeo, stoneMat);
      curl.position.set(cc.x, cc.y, cc.z);
      curl.rotation.set(cc.rx, cc.ry, cc.rz);
      curl.castShadow = true;
      headGroup.add(curl);
    }

    /* ============================================================== */
    /* 11.5 Spouting Water Jet Stream, Soft Droplet Spray & Mist       */
    /* ============================================================== */
    const softParticleTex = getSoftParticleTexture();

    // Continuous translucent parabolic water stream core from lion jaws to river impact
    const jetPts: THREE.Vector3[] = [];
    for (let s = 0; s <= 20; s++) {
      const t = s / 20;
      const jz = 1.18 + t * 8.22;
      const jy = 4.88 + 0.45 * t - 5.28 * t * t;
      jetPts.push(new THREE.Vector3(0, jy, jz));
    }
    const jetCurve = new THREE.CatmullRomCurve3(jetPts);
    const jetTubeGeo = new THREE.TubeGeometry(jetCurve, 28, 0.065, 10, false);
    const jetTubeMat = new THREE.MeshStandardMaterial({
      color: 0xbff4ff,
      emissive: 0x38b6d6,
      emissiveIntensity: 0.42,
      roughness: 0.15,
      transparent: true,
      opacity: 0.68
    });
    const jetTubeMesh = new THREE.Mesh(jetTubeGeo, jetTubeMat);
    merlionGroup.add(jetTubeMesh);

    const particleCount = 140;
    const pGeo = new THREE.BufferGeometry();
    this.merlionParticlePositions = new Float32Array(particleCount * 3);
    this.merlionParticleVelocities = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      this.merlionParticlePositions[i * 3] = 0;
      this.merlionParticlePositions[i * 3 + 1] = 5.0;
      this.merlionParticlePositions[i * 3 + 2] = 1.4;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(this.merlionParticlePositions, 3));

    const pMat = new THREE.PointsMaterial({
      map: softParticleTex,
      color: 0xdcf8ff,
      size: 0.13,
      transparent: true,
      opacity: 0.58,
      alphaTest: 0.02,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.merlionWaterParticles = new THREE.Points(pGeo, pMat);
    merlionGroup.add(this.merlionWaterParticles);

    // Splash Foam Ring at River Impact Point
    const splashMat = new THREE.MeshBasicMaterial({ color: 0xc4f4fa, transparent: true, opacity: 0.7 });
    this.merlionSplashRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.6, 24), splashMat);
    this.merlionSplashRing.rotation.x = -Math.PI / 2;
    this.merlionSplashRing.position.set(0, 0.05, 9.4);
    merlionGroup.add(this.merlionSplashRing);

    // Dynamic Merlion Spray Mist expanding around splash ring (80 points)
    const mistCount = 80;
    const mistGeo = new THREE.BufferGeometry();
    this.merlionMistPositions = new Float32Array(mistCount * 3);
    this.merlionMistPhases = new Float32Array(mistCount);

    for (let i = 0; i < mistCount; i++) {
      this.merlionMistPhases[i] = Math.random();
      const angle = (i / mistCount) * Math.PI * 2;
      const r = 0.5 + Math.random() * 1.4;
      this.merlionMistPositions[i * 3] = Math.cos(angle) * r;
      this.merlionMistPositions[i * 3 + 1] = 0.1 + Math.random() * 0.7;
      this.merlionMistPositions[i * 3 + 2] = 9.4 + Math.sin(angle) * r;
    }
    mistGeo.setAttribute("position", new THREE.BufferAttribute(this.merlionMistPositions, 3));
    const mistMat = new THREE.PointsMaterial({
      map: softParticleTex,
      color: 0xdaf5fb,
      size: 0.28,
      transparent: true,
      opacity: 0.55,
      alphaTest: 0.04,
      depthWrite: false
    });
    this.merlionSprayMist = new THREE.Points(mistGeo, mistMat);
    merlionGroup.add(this.merlionSprayMist);

    // Fountain ambient glow
    const fountainLight = new THREE.PointLight(0x80e5ff, 1.4, 10);
    fountainLight.position.set(0, 3.5, 3.0);
    merlionGroup.add(fountainLight);
    this.pointLights.push(fountainLight);

    this.root.add(merlionGroup);
  }

  /* -------------------------------------------------------------- */
  /* 12. Museum-Grade Singapore River Twakow (大䑩) Bumboats        */
  /* -------------------------------------------------------------- */
  private createTwakowHullGeometry(): THREE.BufferGeometry {
    const stations = [
      { z: -2.25, keelY: 0.22, botW: 0.40, botY: 0.24, topW: 0.68, topY: 0.65 }, // 0: Aft transom
      { z: -1.75, keelY: 0.16, botW: 0.50, botY: 0.18, topW: 0.74, topY: 0.60 }, // 1: Aft helm
      { z: -1.20, keelY: 0.12, botW: 0.56, botY: 0.14, topW: 0.79, topY: 0.56 }, // 2: Aft bulkhead
      { z: -0.60, keelY: 0.10, botW: 0.59, botY: 0.11, topW: 0.82, topY: 0.53 }, // 3: Hold aft
      { z:  0.00, keelY: 0.09, botW: 0.60, botY: 0.10, topW: 0.83, topY: 0.52 }, // 4: Waist (widest)
      { z: +0.60, keelY: 0.10, botW: 0.59, botY: 0.11, topW: 0.82, topY: 0.54 }, // 5: Hold fwd
      { z: +1.20, keelY: 0.14, botW: 0.55, botY: 0.15, topW: 0.78, topY: 0.58 }, // 6: Fwd bulkhead
      { z: +1.85, keelY: 0.24, botW: 0.38, botY: 0.26, topW: 0.62, topY: 0.69 }, // 7: Bow cheeks (eyes)
      { z: +2.45, keelY: 0.45, botW: 0.06, botY: 0.46, topW: 0.08, topY: 0.80 }  // 8: Prow stempost
    ];

    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const M = stations.length;

    for (let i = 0; i < M; i++) {
      const s = stations[i];
      const v = (s.z - stations[0].z) / (stations[M - 1].z - stations[0].z);

      // 0: Port gunwale
      positions.push(-s.topW, s.topY, s.z);
      uvs.push(0.0, v);
      // 1: Port chine
      positions.push(-s.botW, s.botY, s.z);
      uvs.push(0.28, v);
      // 2: Keel center
      positions.push(0.0, s.keelY, s.z);
      uvs.push(0.50, v);
      // 3: Starboard chine
      positions.push(s.botW, s.botY, s.z);
      uvs.push(0.72, v);
      // 4: Starboard gunwale
      positions.push(s.topW, s.topY, s.z);
      uvs.push(1.0, v);
    }

    // Quads between stations
    for (let i = 0; i < M - 1; i++) {
      const base = i * 5;
      const next = (i + 1) * 5;

      // Quad 0: Port side
      indices.push(base + 0, base + 1, next + 1);
      indices.push(base + 0, next + 1, next + 0);

      // Quad 1: Port bottom
      indices.push(base + 1, base + 2, next + 2);
      indices.push(base + 1, next + 2, next + 1);

      // Quad 2: Starboard bottom
      indices.push(base + 2, base + 3, next + 3);
      indices.push(base + 2, next + 3, next + 2);

      // Quad 3: Starboard side
      indices.push(base + 3, base + 4, next + 4);
      indices.push(base + 3, next + 4, next + 3);
    }

    // Stern Transom Cap at station 0 (facing -Z)
    indices.push(0, 4, 1);
    indices.push(4, 3, 1);
    indices.push(1, 3, 2);

    // Bow Stempost Cap at station M-1 (facing +Z)
    const b = (M - 1) * 5;
    indices.push(b + 0, b + 4, b + 1);
    indices.push(b + 4, b + 3, b + 1);
    indices.push(b + 1, b + 3, b + 2);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  private buildBumboats() {
    const boatConfigs = [
      { x: -14, z: 2.2, yaw: 0.2 },
      { x: -6, z: 3.5, yaw: -0.15 },
      { x: 12, z: 2.4, yaw: 0.1 }
    ];

    const twakowHullMat = new THREE.MeshStandardMaterial({
      map: getTwakowHullTexture(),
      roughness: 0.72,
      metalness: 0.08,
      side: THREE.DoubleSide
    });
    const woodPlankMat = new THREE.MeshStandardMaterial({
      map: getWoodPlankTexture(),
      roughness: 0.75,
      metalness: 0.05
    });
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x271910, roughness: 0.86 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xb52c1e, roughness: 0.55 }); // Auspicious cinnabar red
    const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xd4a035, roughness: 0.45, metalness: 0.65 });
    const canvasAwningMat = new THREE.MeshStandardMaterial({
      map: getCanvasAwningTexture(),
      roughness: 0.85,
      side: THREE.DoubleSide
    });
    const rolledCurtainMat = new THREE.MeshStandardMaterial({ color: 0x9e8663, roughness: 0.9 });
    const tireRubberMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.95, metalness: 0.1 });
    const ropeHempMat = new THREE.MeshStandardMaterial({ color: 0xbfa372, roughness: 0.9 });
    const ironHardwareMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.65, metalness: 0.7 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xc8983e, roughness: 0.35, metalness: 0.85 });
    const engineCastIronMat = new THREE.MeshStandardMaterial({ color: 0x1e2022, roughness: 0.8, metalness: 0.5 });
    const burlapSackMat = new THREE.MeshStandardMaterial({
      map: getSpiceSackTexture(),
      roughness: 0.9
    });
    const crateTeaMat = new THREE.MeshStandardMaterial({
      map: getCargoCrateTexture("tea"),
      roughness: 0.72
    });
    const crateSpiceMat = new THREE.MeshStandardMaterial({
      map: getCargoCrateTexture("spices"),
      roughness: 0.72
    });
    const bambooWovenMat = new THREE.MeshStandardMaterial({
      map: getWovenBambooTexture(),
      roughness: 0.82,
      side: THREE.DoubleSide
    });
    const urnCeramicMat = new THREE.MeshStandardMaterial({
      color: 0x3d2417,
      roughness: 0.32,
      metalness: 0.12
    });
    const silkPennantMat = new THREE.MeshStandardMaterial({
      color: 0xc42018,
      roughness: 0.42,
      side: THREE.DoubleSide
    });

    // Auspicious Dragon Water Eye Materials (三色醒狮水眼)
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xf5f5ee });
    const eyeRedMat = new THREE.MeshBasicMaterial({ color: 0xc42018 });
    const eyeBlackMat = new THREE.MeshBasicMaterial({ color: 0x080808 });

    // Lantern warm glowing material
    const lanternGlassMat = new THREE.MeshStandardMaterial({
      color: 0xffaa44,
      emissive: 0xff7711,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.9
    });

    // Shared geometries for performance
    const hullGeo = this.createTwakowHullGeometry();

    const portSheerPts = [
      new THREE.Vector3(-0.68, 0.65, -2.25),
      new THREE.Vector3(-0.74, 0.60, -1.75),
      new THREE.Vector3(-0.79, 0.56, -1.20),
      new THREE.Vector3(-0.82, 0.53, -0.60),
      new THREE.Vector3(-0.83, 0.52,  0.00),
      new THREE.Vector3(-0.82, 0.54,  0.60),
      new THREE.Vector3(-0.78, 0.58,  1.20),
      new THREE.Vector3(-0.62, 0.69,  1.85),
      new THREE.Vector3(-0.08, 0.80,  2.45)
    ];
    const stbdSheerPts = portSheerPts.map((p) => new THREE.Vector3(-p.x, p.y, p.z));
    const portSheerCurve = new THREE.CatmullRomCurve3(portSheerPts);
    const stbdSheerCurve = new THREE.CatmullRomCurve3(stbdSheerPts);
    const gunwaleGeoPort = new THREE.TubeGeometry(portSheerCurve, 24, 0.042, 6, false);
    const gunwaleGeoStbd = new THREE.TubeGeometry(stbdSheerCurve, 24, 0.042, 6, false);

    const portRubPts = portSheerPts.map((p) => new THREE.Vector3(p.x * 1.025, p.y - 0.09, p.z));
    const stbdRubPts = stbdSheerPts.map((p) => new THREE.Vector3(p.x * 1.025, p.y - 0.09, p.z));
    const rubCurvePort = new THREE.CatmullRomCurve3(portRubPts);
    const rubCurveStbd = new THREE.CatmullRomCurve3(stbdRubPts);
    const rubGeoPort = new THREE.TubeGeometry(rubCurvePort, 24, 0.035, 6, false);
    const rubGeoStbd = new THREE.TubeGeometry(rubCurveStbd, 24, 0.035, 6, false);

    this.bumboatBasePositions = boatConfigs.map((c) => ({ ...c }));

    boatConfigs.forEach((cfg, boatIdx) => {
      const outerBoat = new THREE.Group();
      outerBoat.rotation.order = "YXZ";
      outerBoat.position.set(cfg.x, 0.35, cfg.z);
      outerBoat.rotation.y = cfg.yaw;

      // Orient Twakow vessel along the East-West river channel (Bow upstream -X, Stern downstream +X into Kelvin wake)
      const boat = new THREE.Group();
      boat.rotation.y = -Math.PI / 2;
      outerBoat.add(boat);

      // 1. Procedural Compound Lofted Hull Shell
      const hullMesh = new THREE.Mesh(hullGeo, twakowHullMat);
      hullMesh.castShadow = true;
      hullMesh.receiveShadow = true;
      boat.add(hullMesh);

      // 2. Sweeping Gunwale Caps & Vermilion Rubbing Strakes
      const portGunwale = new THREE.Mesh(gunwaleGeoPort, darkWoodMat);
      const stbdGunwale = new THREE.Mesh(gunwaleGeoStbd, darkWoodMat);
      boat.add(portGunwale);
      boat.add(stbdGunwale);

      const portRub = new THREE.Mesh(rubGeoPort, trimMat);
      const stbdRub = new THREE.Mesh(rubGeoStbd, trimMat);
      boat.add(portRub);
      boat.add(stbdRub);

      // 3. Open Cargo Hold, Bilge Deck, Trapezoidal Bulkheads & Internal Oak Ribs
      // Bilge bottom plank deck (sized to fit cleanly inside the 0.94m bilge chine)
      const bilgeFloor = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.04, 2.34), woodPlankMat);
      bilgeFloor.position.set(0, 0.16, 0);
      bilgeFloor.receiveShadow = true;
      boat.add(bilgeFloor);

      // Trapezoidal bulkhead geometry matching hull flare from bilge (width 0.84) to gunwale (width 1.48)
      const bhShape = new THREE.Shape();
      bhShape.moveTo(-0.42, 0.16);
      bhShape.lineTo(0.42, 0.16);
      bhShape.lineTo(0.74, 0.56);
      bhShape.lineTo(-0.74, 0.56);
      bhShape.closePath();
      const bhGeo = new THREE.ExtrudeGeometry(bhShape, { depth: 0.05, bevelEnabled: false });

      // Forward bulkhead
      const fwdBulkhead = new THREE.Mesh(bhGeo, darkWoodMat);
      fwdBulkhead.position.set(0, 0, 1.18);
      boat.add(fwdBulkhead);

      // Aft bulkhead
      const aftBulkhead = new THREE.Mesh(bhGeo, darkWoodMat);
      aftBulkhead.position.set(0, 0, -1.22);
      boat.add(aftBulkhead);

      // 5 Internal U-shaped Timber Frames (弯曲肋骨与肋板 - 完全贴合船壳内壁不穿模)
      const ribZs = [-0.90, -0.45, 0.0, 0.45, 0.90];
      ribZs.forEach((rz) => {
        // Floor timber inside bilge
        const floorRib = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.045, 0.05), darkWoodMat);
        floorRib.position.set(0, 0.18, rz);
        boat.add(floorRib);

        // Port futtock frame (sloping outward from bilge floor x=-0.42, y=0.18 to gunwale x=-0.74, y=0.52)
        const portRib = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.36, 0.045), darkWoodMat);
        portRib.position.set(-0.58, 0.35, rz);
        portRib.rotation.z = 0.68;
        boat.add(portRib);

        // Starboard futtock frame (sloping outward from bilge floor x=+0.42, y=0.18 to gunwale x=+0.74, y=0.52)
        const stbdRib = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.36, 0.045), darkWoodMat);
        stbdRib.position.set(0.58, 0.35, rz);
        stbdRib.rotation.z = -0.68;
        boat.add(stbdRib);
      });

      // 3 Transverse Thwart Cargo Beams (横舱梁)
      for (const tz of [-0.60, 0.0, 0.60]) {
        const thwart = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.065, 0.08), darkWoodMat);
        thwart.position.set(0, 0.52, tz);
        boat.add(thwart);

        // Iron knee brackets
        for (const kx of [-0.74, 0.74]) {
          const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.08), ironHardwareMat);
          bracket.position.set(kx, 0.50, tz);
          boat.add(bracket);
        }
      }

      // 4. Tapered Foredeck & Prow Assembly (贴合尖艏弧度，绝不突出船舷)
      const foredeckShape = new THREE.Shape();
      foredeckShape.moveTo(-0.74, -0.60);
      foredeckShape.lineTo(0.74, -0.60);
      foredeckShape.quadraticCurveTo(0.58, 0.10, 0.07, 0.60);
      foredeckShape.lineTo(-0.07, 0.60);
      foredeckShape.quadraticCurveTo(-0.58, 0.10, -0.74, -0.60);
      foredeckShape.closePath();

      const foredeckGeo = new THREE.ExtrudeGeometry(foredeckShape, { depth: 0.05, bevelEnabled: false });
      foredeckGeo.rotateX(Math.PI / 2);
      const foredeck = new THREE.Mesh(foredeckGeo, woodPlankMat);
      foredeck.position.set(0, 0.66, 1.80);
      foredeck.rotation.x = -0.14;
      foredeck.castShadow = true;
      foredeck.receiveShadow = true;
      boat.add(foredeck);

      // Carved prow stempost (艏龙骨大立柱)
      const stempost = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.58, 0.18), darkWoodMat);
      stempost.position.set(0, 0.68, 2.45);
      stempost.castShadow = true;
      boat.add(stempost);

      const stemCap = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.20), brassMat);
      stemCap.position.set(0, 0.98, 2.45);
      boat.add(stemCap);

      // Twin forged-iron cross mooring bitts (十字系缆桩)
      for (const bx of [-0.35, 0.35]) {
        const bittGroup = new THREE.Group();
        bittGroup.position.set(bx, 0.72, 2.15);

        const vPost = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.048, 0.28, 12), ironHardwareMat);
        vPost.castShadow = true;
        bittGroup.add(vPost);

        const hPin = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.20, 8), ironHardwareMat);
        hPin.rotation.z = Math.PI / 2;
        hPin.position.y = 0.06;
        bittGroup.add(hPin);

        boat.add(bittGroup);
      }

      // Coiled Hemp Hawser Line (盘绕麻绳盘 - 3-tier concentric spiral)
      const hawserGroup = new THREE.Group();
      hawserGroup.position.set(0.28, 0.70, 1.68);
      hawserGroup.rotation.x = Math.PI / 2 - 0.16;

      const coil1 = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.032, 8, 20), ropeHempMat);
      const coil2 = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.028, 8, 18), ropeHempMat);
      const coil3 = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.024, 8, 14), ropeHempMat);
      hawserGroup.add(coil1);
      hawserGroup.add(coil2);
      hawserGroup.add(coil3);
      boat.add(hawserGroup);

      // Brass mooring chocks / fairleads along curved bow gunwale
      for (const cx of [-0.46, 0.46]) {
        const chock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.12), brassMat);
        chock.position.set(cx, 0.71, 1.92);
        boat.add(chock);
      }

      // 4-Fluke Forged Iron Grapnel Bow Anchor & Timber Cathead Crane (四爪铁爪大锚与艏部出挑吊锚梁)
      const anchorGroup = new THREE.Group();
      anchorGroup.position.set(-0.48, 0.70, 1.96);

      // Timber cathead projection beam
      const cathead = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.46), darkWoodMat);
      cathead.rotation.y = 0.42;
      cathead.position.set(-0.08, 0.02, 0.08);
      cathead.castShadow = true;
      anchorGroup.add(cathead);

      // Brass roller sheave at cathead tip
      const sheave = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 10), brassMat);
      sheave.rotation.z = Math.PI / 2;
      sheave.position.set(-0.22, 0.02, 0.22);
      anchorGroup.add(sheave);

      // Heavy anchor chain links hanging down hull side
      for (let c = 0; c < 5; c++) {
        const link = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.007, 6, 10), ironHardwareMat);
        link.position.set(-0.22, -0.06 - c * 0.07, 0.22 - c * 0.02);
        link.rotation.x = c % 2 === 0 ? 0 : Math.PI / 2;
        anchorGroup.add(link);
      }

      // 4-Fluke Iron Grapnel Anchor (四爪铁锚) hooked against port bow
      const grapnel = new THREE.Group();
      grapnel.position.set(-0.22, -0.42, 0.16);
      grapnel.rotation.z = 0.32;

      const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.46, 8), ironHardwareMat);
      grapnel.add(shank);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.009, 6, 12), ironHardwareMat);
      ring.position.y = 0.23;
      grapnel.add(ring);

      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), ironHardwareMat);
      crown.position.y = -0.23;
      grapnel.add(crown);

      for (let f = 0; f < 4; f++) {
        const fAngle = (f * Math.PI) / 2;
        const flukeArm = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 6, 10, Math.PI * 0.55), ironHardwareMat);
        flukeArm.rotation.y = fAngle;
        flukeArm.rotation.z = Math.PI;
        flukeArm.position.set(0, -0.20, 0);
        grapnel.add(flukeArm);

        const palm = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.065, 3), ironHardwareMat);
        palm.position.set(Math.cos(fAngle) * 0.11, -0.09, Math.sin(fAngle) * 0.11);
        palm.rotation.x = Math.PI;
        grapnel.add(palm);
      }
      anchorGroup.add(grapnel);
      boat.add(anchorGroup);

      // 5. Tapered Aft Helm Deck, Engine Compartment & Balanced Rudder (贴合船尾收窄弧线)
      const aftDeckShape = new THREE.Shape();
      aftDeckShape.moveTo(-0.74, 0.48);
      aftDeckShape.lineTo(0.74, 0.48);
      aftDeckShape.lineTo(0.62, -0.48);
      aftDeckShape.lineTo(-0.62, -0.48);
      aftDeckShape.closePath();
      const aftDeckGeo = new THREE.ExtrudeGeometry(aftDeckShape, { depth: 0.05, bevelEnabled: false });
      aftDeckGeo.rotateX(Math.PI / 2);
      const aftDeck = new THREE.Mesh(aftDeckGeo, woodPlankMat);
      aftDeck.position.set(0, 0.58, -1.70);
      aftDeck.castShadow = true;
      aftDeck.receiveShadow = true;
      boat.add(aftDeck);

      // Vintage Inboard Single-Cylinder Diesel Motor
      const engineGroup = new THREE.Group();
      engineGroup.position.set(0, 0.42, -1.35);

      const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.32), engineCastIronMat);
      engineBlock.castShadow = true;
      engineGroup.add(engineBlock);

      const cylinderHead = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.11, 0.22, 12), engineCastIronMat);
      cylinderHead.position.set(0.05, 0.24, 0);
      engineGroup.add(cylinderHead);

      const flywheel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 16), brassMat);
      flywheel.rotation.z = Math.PI / 2;
      flywheel.position.set(-0.21, 0.06, 0);
      engineGroup.add(flywheel);

      // Tall vertical exhaust pipe (黑铁排气管) with heat-shield wrap
      const exhaustLower = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.58, 8), ropeHempMat); // Insulation wrap
      exhaustLower.position.set(0.08, 0.48, -0.05);
      engineGroup.add(exhaustLower);

      const exhaustUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.45, 8), ironHardwareMat);
      exhaustUpper.position.set(0.08, 0.92, -0.05);
      exhaustUpper.rotation.x = -0.15; // angled slightly aft
      engineGroup.add(exhaustUpper);

      boat.add(engineGroup);

      // Balanced Rudder Blade & Hinges
      const rudderGroup = new THREE.Group();
      rudderGroup.position.set(0, 0.28, -2.48);

      const rudderBlade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.88, 0.52), darkWoodMat);
      rudderBlade.castShadow = true;
      rudderGroup.add(rudderBlade);

      // Iron pintle & gudgeon straps
      for (const hy of [-0.22, 0.25]) {
        const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.32), ironHardwareMat);
        hinge.position.set(0, hy, 0.10);
        rudderGroup.add(hinge);
      }
      boat.add(rudderGroup);

      // Curved wooden tiller arm (操舵木手柄)
      const tiller = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.82, 8), darkWoodMat);
      tiller.rotation.x = -0.22;
      tiller.position.set(0, 0.74, -2.10);
      boat.add(tiller);

      // Glazed Earthenware Ceramic Water Urn (南洋陶土蓄水缸) + Teak Lid + Bamboo Ladle
      const urnGroup = new THREE.Group();
      urnGroup.position.set(0.38, 0.60, -1.65);

      const urnLower = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.18, 14), urnCeramicMat);
      urnLower.position.y = 0.09;
      urnLower.castShadow = true;
      urnGroup.add(urnLower);

      const urnUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.16, 14), urnCeramicMat);
      urnUpper.position.y = 0.26;
      urnUpper.castShadow = true;
      urnGroup.add(urnUpper);

      const urnRim = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.02, 8, 16), urnCeramicMat);
      urnRim.rotation.x = Math.PI / 2;
      urnRim.position.y = 0.34;
      urnGroup.add(urnRim);

      const urnLid = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 14), darkWoodMat);
      urnLid.position.y = 0.36;
      urnGroup.add(urnLid);

      const lidKnob = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), darkWoodMat);
      lidKnob.position.y = 0.39;
      urnGroup.add(lidKnob);

      const ladleHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.32, 6), ropeHempMat);
      ladleHandle.rotation.z = 0.35;
      ladleHandle.position.set(0.06, 0.40, 0);
      urnGroup.add(ladleHandle);

      const ladleCup = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.025, 0.05, 8), darkWoodMat);
      ladleCup.position.set(-0.06, 0.43, 0);
      urnGroup.add(ladleCup);

      boat.add(urnGroup);

      // Stowed Sculling Sweep Oar (摇橹/大木橹 - Traditional Chinese River Yuloh)
      const yulohGroup = new THREE.Group();
      yulohGroup.position.set(0.72, 0.62, -1.75);

      const fulcrumPin = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.18, 8), brassMat);
      fulcrumPin.position.y = 0.06;
      yulohGroup.add(fulcrumPin);

      const oarLoom = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.036, 2.65, 8), darkWoodMat);
      oarLoom.rotation.x = -0.32;
      oarLoom.rotation.y = 0.08;
      oarLoom.position.set(0.04, 0.18, -0.85);
      oarLoom.castShadow = true;
      yulohGroup.add(oarLoom);

      const oarBlade = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.15, 0.95), darkWoodMat);
      oarBlade.rotation.x = -0.32;
      oarBlade.rotation.y = 0.08;
      oarBlade.position.set(0.05, -0.22, -1.82);
      oarBlade.castShadow = true;
      yulohGroup.add(oarBlade);

      const oarTip = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.155, 0.12), brassMat);
      oarTip.rotation.x = -0.32;
      oarTip.rotation.y = 0.08;
      oarTip.position.set(0.05, -0.38, -2.25);
      yulohGroup.add(oarTip);

      const lanyard = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.55, 6), ropeHempMat);
      lanyard.rotation.z = -0.65;
      lanyard.position.set(-0.16, 0.10, 0.12);
      yulohGroup.add(lanyard);

      boat.add(yulohGroup);

      // Stern Bamboo Ensign Flagstaff & Swallowtail Silk Merchant Pennant (南洋商号燕尾旗)
      const flagGroup = new THREE.Group();
      flagGroup.position.set(-0.35, 0.60, -2.22);

      const flagStaff = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.010, 1.55, 8), darkWoodMat);
      flagStaff.rotation.x = -0.18;
      flagStaff.position.set(0, 0.72, -0.12);
      flagGroup.add(flagStaff);

      const flagAcorn = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), brassMat);
      flagAcorn.position.set(0, 1.48, -0.26);
      flagGroup.add(flagAcorn);

      const pennantShape = new THREE.Shape();
      pennantShape.moveTo(0, 0);
      pennantShape.lineTo(0.65, 0.10);
      pennantShape.lineTo(0.42, 0);
      pennantShape.lineTo(0.65, -0.10);
      pennantShape.lineTo(0, -0.22);
      pennantShape.closePath();

      const pennant = new THREE.Mesh(new THREE.ShapeGeometry(pennantShape), silkPennantMat);
      pennant.position.set(0, 1.44, -0.25);
      pennant.rotation.y = Math.PI / 2 + 0.15;
      pennant.rotation.x = 0.08;
      flagGroup.add(pennant);

      const flagHoistRib = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.24, 6), goldTrimMat);
      flagHoistRib.position.set(0, 1.33, -0.24);
      flagGroup.add(flagHoistRib);

      boat.add(flagGroup);

      // 6. Traditional Bamboo-Rib Canopy with Rolled Curtains (乌篷双层竹篷)
      // 5 Curved bamboo arch hoops spanning port to starboard (横向拱形篷弓)
      const canopyZs = [-0.95, -0.48, 0.0, 0.48, 0.95];
      canopyZs.forEach((cz) => {
        // Torus in X-Y plane arches over the boat from port (-X) to starboard (+X)
        const arch = new THREE.Mesh(new THREE.TorusGeometry(0.83, 0.034, 8, 20, Math.PI), darkWoodMat);
        arch.position.set(0, 0.54, cz);
        boat.add(arch);

        // Rattan binding wraps at gunwale bases
        for (const bx of [-0.80, 0.80]) {
          const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.08, 8), ropeHempMat);
          wrap.position.set(bx, 0.55, cz);
          boat.add(wrap);
        }
      });

      // Longitudinal ridge beam along canopy apex
      const ridgeBeam = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 2.02), darkWoodMat);
      ridgeBeam.position.set(0, 1.37, 0);
      boat.add(ridgeBeam);

      // Bamboo woven interior ceiling lining (双层竹编内衬 - 沿Z轴纵向覆盖顶部拱廊，两端贯通)
      const bambooCeiling = new THREE.Mesh(
        new THREE.CylinderGeometry(0.835, 0.835, 1.98, 24, 1, true, -Math.PI * 0.36, Math.PI * 0.72),
        bambooWovenMat
      );
      bambooCeiling.rotation.x = -Math.PI / 2;
      bambooCeiling.position.set(0, 0.54, 0);
      boat.add(bambooCeiling);

      // Weathered Canvas Top Awning (外层防水帆布面 - 顶部对称拱形，两端敞开不封堵视线)
      const canvasAwning = new THREE.Mesh(
        new THREE.CylinderGeometry(0.855, 0.855, 2.04, 24, 1, true, -Math.PI * 0.37, Math.PI * 0.74),
        canvasAwningMat
      );
      canvasAwning.rotation.x = -Math.PI / 2;
      canvasAwning.position.set(0, 0.54, 0);
      canvasAwning.castShadow = true;
      boat.add(canvasAwning);

      // Front & rear vermilion-lacquered arched canopy gable trim hoops (前后舱口朱漆封边拱圈)
      for (const gz of [-1.01, 1.01]) {
        const gableArch = new THREE.Mesh(
          new THREE.TorusGeometry(0.852, 0.022, 8, 24, Math.PI * 0.74),
          trimMat
        );
        gableArch.rotation.z = Math.PI * 0.13;
        gableArch.position.set(0, 0.54, gz);
        boat.add(gableArch);
      }

      // 6 Longitudinal bamboo battens (六道外层加固竹压条)
      for (let bIdx = 0; bIdx < 6; bIdx++) {
        const bAngle = Math.PI * 0.20 + (bIdx / 5) * Math.PI * 0.60;
        const bpx = Math.cos(bAngle) * 0.855;
        const bpy = 0.54 + Math.sin(bAngle) * 0.855;
        const batten = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 2.02, 8), darkWoodMat);
        batten.rotation.x = Math.PI / 2;
        batten.position.set(bpx, bpy, 0);
        boat.add(batten);
      }

      // Traditional Coolie Straw Hat (南洋工友竹编斗笠) hanging inside canopy
      const hatGroup = new THREE.Group();
      hatGroup.position.set(0.18, 1.12, 0.25);
      hatGroup.rotation.z = 0.25;
      hatGroup.rotation.x = 0.15;

      const hatCord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.24, 6), ropeHempMat);
      hatCord.position.y = 0.12;
      hatGroup.add(hatCord);

      const hatCone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.08, 16, 1, true), bambooWovenMat);
      hatCone.castShadow = true;
      hatGroup.add(hatCone);

      const hatRim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.008, 6, 16), darkWoodMat);
      hatRim.rotation.x = Math.PI / 2;
      hatRim.position.y = -0.04;
      hatGroup.add(hatRim);
      boat.add(hatGroup);

      // Rolled-up Canvas Rain Curtains (侧卷帆布帘) along port and starboard eaves
      for (const cx of [-0.78, 0.78]) {
        const curtain = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.02, 10), rolledCurtainMat);
        curtain.rotation.x = Math.PI / 2;
        curtain.position.set(cx, 0.94, 0);
        curtain.castShadow = true;
        boat.add(curtain);

        // Tie-down cords securing the rolled curtain at each hoop
        canopyZs.forEach((cz) => {
          const tieCord = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.008, 6, 12), ropeHempMat);
          tieCord.position.set(cx, 0.94, cz);
          boat.add(tieCord);
        });
      }

      // Hanging Brass Hurricane Storm Lantern (马灯) with amber glass and warm point light
      const lanternGroup = new THREE.Group();
      lanternGroup.position.set(0, 1.15, 0);

      // Brass hanging loop
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.006, 6, 12), brassMat);
      lanternGroup.add(loop);

      // Brass top cap & fuel fount
      const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.05, 10), brassMat);
      topCap.position.y = -0.04;
      lanternGroup.add(topCap);

      const globe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.10, 10), lanternGlassMat);
      globe.position.y = -0.11;
      lanternGroup.add(globe);

      const fount = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.05, 10), brassMat);
      fount.position.y = -0.18;
      lanternGroup.add(fount);

      // Warm amber lantern point light on flagship bumboat
      if (boatIdx === 1) {
        const lanternLight = new THREE.PointLight(0xff9933, 1.35, 9.0);
        lanternLight.position.set(0, -0.11, 0);
        lanternGroup.add(lanternLight);
        this.pointLights.push(lanternLight);
      }

      boat.add(lanternGroup);

      // 7. Authentic Auspicious Dragon Water Eyes (三色醒狮水眼 - 贴合艏部弧形外船腮)
      for (const eyeDir of [-1, 1]) {
        const eyeGroup = new THREE.Group();
        // Flush against the exterior curved bow cheek at z = 1.72, y = 0.55, x = ±0.61
        eyeGroup.position.set(eyeDir * 0.61, 0.55, 1.72);
        eyeGroup.rotation.y = eyeDir > 0 ? -0.38 : 0.38;
        eyeGroup.rotation.z = eyeDir > 0 ? -0.15 : 0.15;

        // Carved wooden mounting plaque
        const plaque = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.028, 16), darkWoodMat);
        plaque.rotation.z = Math.PI / 2;
        eyeGroup.add(plaque);

        // White outer sclera disc
        const sclera = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.036, 16), eyeWhiteMat);
        sclera.rotation.z = Math.PI / 2;
        eyeGroup.add(sclera);

        // Vermilion red iris ring
        const iris = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.042, 16), eyeRedMat);
        iris.rotation.z = Math.PI / 2;
        eyeGroup.add(iris);

        // Gold border ring
        const goldRing = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.009, 8, 16), goldTrimMat);
        goldRing.rotation.y = Math.PI / 2;
        goldRing.position.x = eyeDir * 0.018;
        eyeGroup.add(goldRing);

        // Obsidian black pupil (offset forward toward bow and slightly down)
        const pupil = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.048, 16), eyeBlackMat);
        pupil.rotation.z = Math.PI / 2;
        pupil.position.set(0, -0.008, 0.022);
        eyeGroup.add(pupil);

        // Carved wooden brow ridge (眉弓木)
        const brow = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.016, 6, 12, Math.PI * 0.7), darkWoodMat);
        brow.rotation.y = Math.PI / 2;
        brow.rotation.z = -Math.PI * 0.15;
        brow.position.set(eyeDir * 0.015, 0.04, 0);
        eyeGroup.add(brow);

        boat.add(eyeGroup);
      }

      // 8. Authentic Historic Cargo Stacked in Open Hold
      // Colonial Tea Export Crate
      const crate1 = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.52), crateTeaMat);
      crate1.position.set(-0.28, 0.35, -0.35);
      crate1.castShadow = true;
      crate1.receiveShadow = true;
      boat.add(crate1);

      // Malacca Spices Crate
      const crate2 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.46), crateSpiceMat);
      crate2.position.set(0.26, 0.33, -0.40);
      crate2.castShadow = true;
      crate2.receiveShadow = true;
      boat.add(crate2);

      // Smaller top crate angled on top
      const crate3 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.30, 0.38), crateTeaMat);
      crate3.position.set(-0.24, 0.71, -0.32);
      crate3.rotation.y = 0.12;
      crate3.castShadow = true;
      boat.add(crate3);

      // Burlap Jute Spice & Rice Sacks
      const sackPositions = [
        { x: 0.22, y: 0.28, z: 0.38, scale: [1.2, 0.8, 1.0] as [number, number, number], rot: 0.1 },
        { x: -0.15, y: 0.28, z: 0.42, scale: [1.1, 0.85, 1.1] as [number, number, number], rot: -0.2 },
        { x: 0.05, y: 0.48, z: 0.35, scale: [1.15, 0.75, 1.0] as [number, number, number], rot: 0.35 }
      ];
      sackPositions.forEach((sp) => {
        const sack = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24), burlapSackMat);
        sack.scale.set(...sp.scale);
        sack.position.set(sp.x, sp.y, sp.z);
        sack.rotation.y = sp.rot;
        sack.castShadow = true;
        boat.add(sack);

        // Tied gathered neck bunch on sack
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.08, 8), ropeHempMat);
        neck.position.set(sp.x, sp.y + 0.14, sp.z);
        boat.add(neck);
      });

      // Oak Rum / Water Cask
      const barrelGroup = new THREE.Group();
      barrelGroup.position.set(-0.28, 0.34, 0.70);

      const barrelBody = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.44, 14), woodPlankMat);
      barrelBody.castShadow = true;
      barrelGroup.add(barrelBody);

      for (const by of [-0.15, 0, 0.15]) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.182, 0.008, 6, 16), ironHardwareMat);
        hoop.rotation.x = Math.PI / 2;
        hoop.position.y = by;
        barrelGroup.add(hoop);
      }
      boat.add(barrelGroup);

      // 9. Weathered Rubber Tire Fenders with Tread Ridges & Chain Links
      const tireConfigs = [
        { x: -0.83, y: 0.42, z: 0.70, angle: -0.08 },
        { x: -0.80, y: 0.44, z: -0.70, angle: 0.06 },
        { x: 0.83, y: 0.42, z: 0.70, angle: 0.08 },
        { x: 0.80, y: 0.44, z: -0.70, angle: -0.06 }
      ];
      tireConfigs.forEach((tc) => {
        const tireGroup = new THREE.Group();
        tireGroup.position.set(tc.x, tc.y, tc.z);
        tireGroup.rotation.y = Math.PI / 2 + tc.angle;

        // Tire torus casing
        const tire = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.065, 10, 20), tireRubberMat);
        tire.castShadow = true;
        tireGroup.add(tire);

        // Recessed inner rim
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.04, 12), ironHardwareMat);
        rim.rotation.x = Math.PI / 2;
        tireGroup.add(rim);

        // Suspension steel chain links
        for (const cx of [-0.04, 0.04]) {
          const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 6), ironHardwareMat);
          chain.position.set(cx, 0.16, 0);
          tireGroup.add(chain);
        }

        boat.add(tireGroup);
      });

      this.sampanBoats.push(outerBoat);
      this.root.add(outerBoat);

      // 10. Dynamic Physical Catenary Mooring Ropes (柔性系泊悬链线缆绳)
      const segments = 8;
      const ropeGeo = new THREE.BufferGeometry();
      const ropePos = new Float32Array((segments + 1) * 3);
      ropeGeo.setAttribute("position", new THREE.BufferAttribute(ropePos, 3));
      const ropeMat = new THREE.LineBasicMaterial({ color: 0x6e5234, linewidth: 2 });
      const ropeLine = new THREE.Line(ropeGeo, ropeMat);
      ropeLine.name = `mooringRope_${boatConfigs.indexOf(cfg)}`;
      this.root.add(ropeLine);

      const anchorCoords = [
        new THREE.Vector3(-16.4, 0.95, -1.15),
        new THREE.Vector3(-8.4, 0.95, -1.05),
        new THREE.Vector3(9.6, 0.95, -1.15)
      ];

      this.mooringRopes.push({
        line: ropeLine,
        positions: ropePos,
        boatIdx: boatConfigs.indexOf(cfg),
        anchorWorld: anchorCoords[boatConfigs.indexOf(cfg)] || new THREE.Vector3(cfg.x - 2.4, 0.95, -1.15),
        bittLocal: new THREE.Vector3(-2.15, 0.72, -0.35)
      });
    });
  }
/* -------------------------------------------------------------- */
  /* 12. Floating River Lanterns (八角水上祈福河灯 - 莲花木筏与烛光) */
  /* -------------------------------------------------------------- */
  private buildFloatingLanterns() {
    const timberRaftMat = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 0.85 });
    const paperShadeMat = new THREE.MeshStandardMaterial({
      color: 0xff9248,
      roughness: 0.45,
      transparent: true,
      opacity: 0.88,
      emissive: 0xff5511,
      emissiveIntensity: 0.4
    });
    const bambooRibMat = new THREE.MeshStandardMaterial({ color: 0x2e1e12, roughness: 0.6 });
    const candleWaxMat = new THREE.MeshStandardMaterial({ color: 0xfdfbf0, roughness: 0.3 });
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xffcc33 });

    for (let i = 0; i < 7; i++) {
      const lantern = new THREE.Group();
      const basePos = {
        x: -18 + i * 4.5 + Math.random() * 2,
        z: 1.2 + Math.random() * 2.8
      };
      this.lanternBasePositions.push(basePos);
      lantern.position.set(basePos.x, 0.28, basePos.z);

      // 1. Cross-slatted Floating Cedar Wood Raft (十字榫卯沉香浮木筏)
      const raftBase = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.52), timberRaftMat);
      raftBase.position.y = 0.03;
      raftBase.receiveShadow = true;
      lantern.add(raftBase);

      for (const rx of [-0.18, 0.18]) {
        const floatSponson = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.54, 8), timberRaftMat);
        floatSponson.position.set(rx, 0.02, 0);
        floatSponson.rotation.x = Math.PI / 2;
        lantern.add(floatSponson);
      }

      // 2. Octagonal Oiled Paper Lantern Housing (八角描金透光油纸灯罩)
      const paperHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.42, 8), paperShadeMat);
      paperHousing.position.y = 0.26;
      paperHousing.castShadow = true;
      lantern.add(paperHousing);

      // Corner Bamboo Framing Ribs (8根八角细竹骨架)
      for (let b = 0; b < 8; b++) {
        const bAng = (b / 8) * Math.PI * 2;
        const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.008, 0.44, 4), bambooRibMat);
        rib.position.set(Math.cos(bAng) * 0.26, 0.26, Math.sin(bAng) * 0.26);
        lantern.add(rib);
      }

      // Upturned Pagoda Roof Cap with Finial (飞檐宝顶盖)
      const roofCap = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.14, 8), timberRaftMat);
      roofCap.position.y = 0.52;
      lantern.add(roofCap);

      const finialBall = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), bambooRibMat);
      finialBall.position.y = 0.6;
      lantern.add(finialBall);

      // 3. Central Beeswax Candle & Flickering Flame Core (白蜡烛与灵动烛焰)
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.16, 8), candleWaxMat);
      candle.position.y = 0.14;
      lantern.add(candle);

      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 6), flameMat);
      flame.position.y = 0.26;
      lantern.add(flame);
      this.lanternFlames.push(flame);

      // Warm Radiant Point Light (consolidated to 2 river reach lights to keep fragment shader fast)
      if (i === 1 || i === 5) {
        const lanternLight = new THREE.PointLight(0xff7722, 1.1, 10.0);
        lanternLight.position.y = 0.32;
        lantern.add(lanternLight);
        this.pointLights.push(lanternLight);
        this.lanternLights.push(lanternLight);
      }

      this.floatingLanterns.push(lantern);
      this.root.add(lantern);
    }

    // 12.3 Subaquatic Stream Grass (水底流体水草丛生生态)
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x1d7543,
      roughness: 0.35,
      metalness: 0.15,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide
    });
    const bladeGeo = new THREE.ConeGeometry(0.024, 0.45, 4);
    bladeGeo.translate(0, 0.225, 0);

    const grassSpawns = [
      [-14.0, 1.2], [-11.5, 3.8], [-9.5, 4.2], [-7.2, 1.8],
      [-5.0, 4.5], [-3.0, 1.8], [0.5, 3.2], [3.2, 4.0],
      [5.5, 2.0], [8.0, 3.6], [10.5, 1.8], [13.0, 3.5]
    ];

    for (let i = 0; i < grassSpawns.length; i++) {
      const [gx, gz] = grassSpawns[i];
      const tuftGroup = new THREE.Group();
      tuftGroup.position.set(gx, -0.22, gz);
      this.root.add(tuftGroup);

      for (let b = 0; b < 3; b++) {
        const blade = new THREE.Mesh(bladeGeo, grassMat);
        blade.position.set(Math.sin(b * 2.1) * 0.08, 0, Math.cos(b * 2.1) * 0.08);
        blade.scale.set(0.85 + (b % 2) * 0.3, 0.9 + b * 0.12, 0.85 + (b % 2) * 0.3);
        tuftGroup.add(blade);

        this.subaquaticGrassBlades.push({
          mesh: blade,
          phase: i * 0.9 + b * 1.3,
          baseX: gx,
          baseZ: gz
        });
      }
    }
  }
/* 13. Singapore Tropical Botany (百年大榕树、椰林蒲葵与水生生态)   */
  /* -------------------------------------------------------------- */
  private buildFoliageAndLamps() {
    const trunkMat = new THREE.MeshStandardMaterial({
      map: getBanyanBarkTexture(),
      color: 0xc2aa90,
      roughness: 0.86
    });
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x286234, roughness: 0.58 });
    const orchidMat = new THREE.MeshStandardMaterial({ color: 0xdf528a, roughness: 0.5 });
    const orchidLeafMat = new THREE.MeshStandardMaterial({ color: 0x1b4522, roughness: 0.65 });
    const coconutMat = new THREE.MeshStandardMaterial({ color: 0x483620, roughness: 0.85 });
    const reedMat = new THREE.MeshStandardMaterial({ color: 0x385c2b, roughness: 0.75 });
    const cattailMat = new THREE.MeshStandardMaterial({ color: 0x4d2d18, roughness: 0.9 });
    const bougainvilleaMat = new THREE.MeshStandardMaterial({ color: 0xd8296a, roughness: 0.65 });
    const lampPostMat = new THREE.MeshStandardMaterial({ color: 0x1f2624, roughness: 0.5, metalness: 0.8 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xffeaae,
      emissive: 0xffaa33,
      emissiveIntensity: 0.9,
      roughness: 0.25,
      transparent: true,
      opacity: 0.85
    });
    const copperRoofMat = new THREE.MeshStandardMaterial({ color: 0x2f4c44, roughness: 0.6, metalness: 0.5 });
    const mantleFlameMat = new THREE.MeshBasicMaterial({ color: 0xfff6cf });

    /* ============================================================== */
    /* 13.1 Centennial Banyan Tree (绞杀古榕树与附生兰花蕨类生态)      */
    /* ============================================================== */
    const banyanGroup = new THREE.Group();
    banyanGroup.position.set(-2, 1.0, -18);

    // Helper: Loft an organic tapering spline branch/root with bark fluting
    const buildOrganicSplineLimb = (
      curve: THREE.CatmullRomCurve3,
      rStart: number,
      rEnd: number,
      tubularSegs: number,
      radialSegs: number,
      fluteAmp = 0.08,
      fluteFreq = 6,
      verticalScale = 1.0
    ): THREE.BufferGeometry => {
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];
      const frames = curve.computeFrenetFrames(tubularSegs, false);
      const pt = new THREE.Vector3();
      const normal = new THREE.Vector3();

      for (let j = 0; j <= tubularSegs; j++) {
        const v = j / tubularSegs;
        curve.getPointAt(v, pt);
        const rBase = rStart * Math.pow(1 - v, 0.85) + rEnd * Math.pow(v, 0.85);
        const N = frames.normals[j];
        const B = frames.binormals[j];

        for (let i = 0; i <= radialSegs; i++) {
          const u = i / radialSegs;
          const theta = u * Math.PI * 2;
          const flute = 1 + fluteAmp * Math.sin(theta * fluteFreq + v * 5.0);
          const rx = Math.cos(theta) * rBase * flute;
          const ry = Math.sin(theta) * rBase * flute * verticalScale;
          normal.set(0, 0, 0).addScaledVector(N, rx).addScaledVector(B, ry);
          positions.push(pt.x + normal.x, pt.y + normal.y, pt.z + normal.z);
          uvs.push(u, v);
        }
      }

      const stride = radialSegs + 1;
      for (let j = 0; j < tubularSegs; j++) {
        for (let i = 0; i < radialSegs; i++) {
          const a = j * stride + i;
          const b = a + 1;
          const c = (j + 1) * stride + i;
          const d = c + 1;
          indices.push(a, b, d);
          indices.push(a, d, c);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      return geo;
    };

    // 1. Sculpted Gnarled Fluted Central Banyan Trunk Core (28x24 multi-ring organic loft)
    const coreRadial = 28;
    const coreRings = 24;
    const corePositions: number[] = [];
    const coreUvs: number[] = [];
    const coreIndices: number[] = [];
    for (let j = 0; j <= coreRings; j++) {
      const v = j / coreRings;
      const y = v * 4.55;
      // Flared basal root collar -> gnarled waist -> tapered crown fork tucked cleanly inside foliage
      const baseR =
        1.55 * Math.pow(1 - v, 2.2) +
        0.78 * 2 * v * (1 - v) +
        0.64 * Math.pow(v, 2.0);
      const twistX = Math.sin(v * Math.PI * 1.4) * 0.14;
      const twistZ = Math.cos(v * Math.PI * 1.2) * 0.12;

      for (let i = 0; i <= coreRadial; i++) {
        const u = i / coreRadial;
        const theta = u * Math.PI * 2;
        const flute =
          1 +
          0.18 * Math.sin(theta * 7 + v * 4.5) +
          0.08 * Math.cos(theta * 11 - v * 3.2);
        const r = baseR * flute;
        corePositions.push(
          twistX + Math.cos(theta) * r,
          y,
          twistZ + Math.sin(theta) * r
        );
        coreUvs.push(u, v);
      }
    }
    const coreStride = coreRadial + 1;
    for (let j = 0; j < coreRings; j++) {
      for (let i = 0; i < coreRadial; i++) {
        const a = j * coreStride + i;
        const b = a + 1;
        const c = (j + 1) * coreStride + i;
        const d = c + 1;
        coreIndices.push(a, c, b);
        coreIndices.push(b, c, d);
      }
    }
    const coreTrunkGeo = new THREE.BufferGeometry();
    coreTrunkGeo.setAttribute("position", new THREE.Float32BufferAttribute(corePositions, 3));
    coreTrunkGeo.setAttribute("uv", new THREE.Float32BufferAttribute(coreUvs, 2));
    coreTrunkGeo.setIndex(coreIndices);
    coreTrunkGeo.computeVertexNormals();
    const coreTrunkMesh = new THREE.Mesh(coreTrunkGeo, trunkMat);
    coreTrunkMesh.castShadow = true;
    coreTrunkMesh.receiveShadow = true;
    banyanGroup.add(coreTrunkMesh);

    // 2. 6 Helical Entwining Strangler Trunks (螺旋绞杀融合主干柱)
    for (let p = 0; p < 6; p++) {
      const baseAng = (p / 6) * Math.PI * 2;
      const stranglerCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(baseAng) * 1.65, 0.0, Math.sin(baseAng) * 1.65),
        new THREE.Vector3(Math.cos(baseAng + 0.35) * 1.05, 1.5, Math.sin(baseAng + 0.35) * 1.05),
        new THREE.Vector3(Math.cos(baseAng + 0.72) * 0.82, 3.1, Math.sin(baseAng + 0.72) * 0.82),
        new THREE.Vector3(Math.cos(baseAng + 1.05) * 0.96, 4.55, Math.sin(baseAng + 1.05) * 0.96)
      ]);
      const pillarGeo = buildOrganicSplineLimb(stranglerCurve, 0.42, 0.22, 20, 14, 0.12, 5, 1.0);
      const pillar = new THREE.Mesh(pillarGeo, trunkMat);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      banyanGroup.add(pillar);
    }

    // 3. 8 S-Curved Fluted Plank Buttress Roots (放射状蜿蜒板根网络) hugging the earth
    for (let b = 0; b < 8; b++) {
      const angle = (b / 8) * Math.PI * 2 + 0.22;
      const sideBend = (b % 2 === 0 ? 1 : -1) * 0.22;
      const buttressCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(angle) * 0.72, 2.85, Math.sin(angle) * 0.72),
        new THREE.Vector3(Math.cos(angle + sideBend * 0.4) * 1.35, 1.45, Math.sin(angle + sideBend * 0.4) * 1.35),
        new THREE.Vector3(Math.cos(angle + sideBend * 0.8) * 2.25, 0.48, Math.sin(angle + sideBend * 0.8) * 2.25),
        new THREE.Vector3(Math.cos(angle + sideBend) * 3.15, 0.06, Math.sin(angle + sideBend) * 3.15)
      ]);
      const buttressGeo = buildOrganicSplineLimb(buttressCurve, 0.36, 0.09, 18, 12, 0.14, 4, 1.65);
      const buttress = new THREE.Mesh(buttressGeo, trunkMat);
      buttress.castShadow = true;
      buttress.receiveShadow = true;
      banyanGroup.add(buttress);
    }

    // 4. 6 Sweeping Gnarled Major Boughs (虬曲苍劲大主枝) arching outward into the crown
    const branchConfigs = [
      { angle: 0.5, len: 4.2, yEnd: 5.55 },
      { angle: 1.6, len: 3.9, yEnd: 5.35 },
      { angle: 2.7, len: 4.4, yEnd: 5.45 },
      { angle: 3.8, len: 3.8, yEnd: 5.65 },
      { angle: 4.8, len: 4.2, yEnd: 5.40 },
      { angle: 5.8, len: 4.0, yEnd: 5.50 }
    ];
    branchConfigs.forEach((bc, idx) => {
      const sway = (idx % 2 === 0 ? 1 : -1) * 0.18;
      const boughCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(bc.angle) * 0.65, 4.1, Math.sin(bc.angle) * 0.65),
        new THREE.Vector3(Math.cos(bc.angle + sway * 0.5) * (bc.len * 0.42), 4.85, Math.sin(bc.angle + sway * 0.5) * (bc.len * 0.42)),
        new THREE.Vector3(Math.cos(bc.angle + sway) * (bc.len * 0.78), bc.yEnd - 0.15, Math.sin(bc.angle + sway) * (bc.len * 0.78)),
        new THREE.Vector3(Math.cos(bc.angle + sway * 0.7) * bc.len, bc.yEnd, Math.sin(bc.angle + sway * 0.7) * bc.len)
      ]);
      const boughGeo = buildOrganicSplineLimb(boughCurve, 0.44, 0.14, 18, 12, 0.10, 5, 1.0);
      const branch = new THREE.Mesh(boughGeo, trunkMat);
      branch.castShadow = true;
      branch.receiveShadow = true;
      banyanGroup.add(branch);
    });

    // Epiphytic Bird's-Nest Ferns (附生鸟巢蕨) in bough crotches
    for (const [fx, fy, fz] of [
      [1.1, 4.8, 0.8],
      [-1.2, 4.6, -0.6],
      [0.4, 5.2, -1.3],
      [-0.8, 5.0, 1.2]
    ]) {
      const fernGroup = new THREE.Group();
      fernGroup.position.set(fx, fy, fz);

      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), new THREE.MeshBasicMaterial({ color: 0x121008 }));
      fernGroup.add(crown);

      for (let lf = 0; lf < 9; lf++) {
        const leafAngle = (lf / 9) * Math.PI * 2;
        const frondCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0.04, 0),
          new THREE.Vector3(Math.cos(leafAngle) * 0.18, 0.24, Math.sin(leafAngle) * 0.18),
          new THREE.Vector3(Math.cos(leafAngle) * 0.36, 0.32, Math.sin(leafAngle) * 0.36)
        ]);
        const frondGeo = new THREE.TubeGeometry(frondCurve, 8, 0.032, 6, false);
        frondGeo.scale(1.0, 0.45, 1.0);
        const frond = new THREE.Mesh(frondGeo, frondMat);
        fernGroup.add(frond);
      }
      banyanGroup.add(fernGroup);
    }

    // Epiphytic Wild Dendrobium Orchids (野生石斛兰花簇)
    for (const [ox, oy, oz] of [
      [1.6, 4.7, -0.8],
      [-1.4, 4.7, 0.9]
    ]) {
      const orchidGroup = new THREE.Group();
      orchidGroup.position.set(ox, oy, oz);

      for (let fl = 0; fl < 6; fl++) {
        const blossom = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), orchidMat);
        blossom.position.set(Math.sin(fl * 1.2) * 0.16, -fl * 0.11, Math.cos(fl * 1.2) * 0.16);
        orchidGroup.add(blossom);
      }
      banyanGroup.add(orchidGroup);
    }

    // 5. 16 Sinuous Hanging Aerial Root Pendulums (垂挂气生根须帘幕 - 带自然弯曲与分叉根梢)
    for (let r = 0; r < 16; r++) {
      const angle = (r / 16) * Math.PI * 2 + (r % 3) * 0.15;
      const radius = 1.45 + (r % 5) * 0.44;
      const rootPivot = new THREE.Group();
      rootPivot.position.set(Math.cos(angle) * radius, 5.0 + (r % 3) * 0.22, Math.sin(angle) * radius);

      const rootLen = 4.3 + (r % 4) * 0.38;
      const waveA = (r % 2 === 0 ? 1 : -1) * 0.08;
      const rootCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(waveA, -rootLen * 0.33, -waveA * 0.6),
        new THREE.Vector3(-waveA * 0.8, -rootLen * 0.68, waveA * 0.8),
        new THREE.Vector3(waveA * 0.4, -rootLen, 0)
      ]);
      const rootRadius = 0.036 + (r % 3) * 0.014;
      const rootTube = new THREE.Mesh(
        buildOrganicSplineLimb(rootCurve, rootRadius * 1.35, rootRadius * 0.55, 14, 8, 0.06, 3, 1.0),
        trunkMat
      );
      rootPivot.add(rootTube);

      this.banyanAerialRoots.push(rootPivot);
      banyanGroup.add(rootPivot);
    }

    // 6. Lush Layered Sculpted Botanical Cloud Canopy Clusters (14 clusters with wind breathing)
    const canopyConfigs = [
      // Lower outer clusters
      { pos: [-3.2, 5.4, 1.8], rad: 2.8, col: 0x184422 },
      { pos: [3.0, 5.2, -2.0], rad: 3.0, col: 0x184422 },
      { pos: [-2.0, 5.6, -2.8], rad: 2.7, col: 0x1e4f2a },
      { pos: [2.6, 5.5, 2.4], rad: 2.9, col: 0x1e4f2a },
      { pos: [-3.5, 5.2, -0.6], rad: 2.5, col: 0x184422 },
      { pos: [3.4, 5.4, 0.8], rad: 2.6, col: 0x1e4f2a },
      // Mid canopy body
      { pos: [0, 6.4, 0], rad: 3.8, col: 0x246234 },
      { pos: [-2.0, 6.2, 1.0], rad: 3.2, col: 0x246234 },
      { pos: [1.8, 6.3, -0.8], rad: 3.4, col: 0x286938 },
      { pos: [0.6, 6.5, 1.8], rad: 2.8, col: 0x286938 },
      { pos: [-1.2, 6.3, -1.8], rad: 2.7, col: 0x246234 },
      // Upper crown apex (sunlit warm moss lime green)
      { pos: [-0.8, 7.5, 0.5], rad: 2.5, col: 0x367c42 },
      { pos: [1.0, 7.6, -0.4], rad: 2.4, col: 0x3c8548 },
      { pos: [0, 7.8, 0], rad: 2.2, col: 0x449452 }
    ];
    const banyanLeafTex = getBanyanLeafTexture();
    canopyConfigs.forEach((cfg, cIdx) => {
      const mat = new THREE.MeshStandardMaterial({
        map: banyanLeafTex,
        color: cfg.col,
        emissive: 0x0b2412,
        emissiveIntensity: 0.16,
        roughness: 0.78
      });
      // High-resolution indexed organic botanical cloud pad (smooth normals + harmonic lobing!)
      const foliageGeo = new THREE.SphereGeometry(cfg.rad, 24, 18);
      const posAttr = foliageGeo.attributes.position;
      for (let k = 0; k < posAttr.count; k++) {
        const vx = posAttr.getX(k);
        const vy = posAttr.getY(k);
        const vz = posAttr.getZ(k);
        const ang = Math.atan2(vz, vx);
        const lobe =
          1 +
          0.08 * Math.sin(ang * 5 + cIdx * 1.3) +
          0.05 * Math.cos(vy * 2.4 + ang * 3);
        // Flatten underside slightly more than upper dome for natural umbrella banyan foliage pads
        const yFactor = vy < 0 ? 0.34 : 0.46;
        posAttr.setXYZ(k, vx * 1.44 * lobe, vy * yFactor * lobe, vz * 1.38 * lobe);
      }
      foliageGeo.computeVertexNormals();

      const foliageMesh = new THREE.Mesh(foliageGeo, mat);
      foliageMesh.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      foliageMesh.castShadow = true;
      foliageMesh.receiveShadow = true;

      // Add 3 billowy sub-cluster puffs around each pad for rich layered botanical depth
      for (let sub = 0; sub < 3; sub++) {
        const sAng = (sub / 3) * Math.PI * 2 + cIdx * 0.7;
        const puffGeo = new THREE.SphereGeometry(cfg.rad * 0.52, 14, 12);
        puffGeo.scale(1.35, 0.48, 1.28);
        const puff = new THREE.Mesh(puffGeo, mat);
        puff.position.set(
          Math.cos(sAng) * cfg.rad * 0.58,
          (sub % 2 === 0 ? 0.14 : -0.08) * cfg.rad,
          Math.sin(sAng) * cfg.rad * 0.58
        );
        puff.castShadow = true;
        puff.receiveShadow = true;
        foliageMesh.add(puff);
      }

      this.banyanCanopies.push(foliageMesh);
      banyanGroup.add(foliageMesh);

      // Curved organic secondary bough reaching out to this canopy pad
      const boughLen = Math.hypot(cfg.pos[0], cfg.pos[2]);
      if (boughLen > 0.8) {
        const subCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(cfg.pos[0] * 0.18, 4.3, cfg.pos[2] * 0.18),
          new THREE.Vector3(cfg.pos[0] * 0.55, (4.3 + cfg.pos[1]) * 0.5, cfg.pos[2] * 0.55),
          new THREE.Vector3(cfg.pos[0] * 0.88, cfg.pos[1] - 0.18, cfg.pos[2] * 0.88)
        ]);
        const boughGeo = buildOrganicSplineLimb(subCurve, 0.22, 0.08, 12, 10, 0.08, 4, 1.0);
        const bough = new THREE.Mesh(boughGeo, trunkMat);
        bough.castShadow = true;
        banyanGroup.add(bough);
      }
    });

    // Warm heritage uplight illuminating the ancient banyan roots and lower canopy dome
    const banyanUplight = new THREE.PointLight(0xffcf78, 1.35, 14);
    banyanUplight.position.set(0.6, 3.8, 2.4);
    banyanGroup.add(banyanUplight);
    this.pointLights.push(banyanUplight);

    this.root.add(banyanGroup);

    /* ============================================================== */
    /* 13.2 Sculpted Nanyang Coconut Palms (有机弧形椰林与下垂羽状椰叶) */
    /* ============================================================== */
    const palmPositions = [
      [-14.2, 1.0, -4.8, 0.22],
      [12.0, 1.0, -16.0, -0.20],
      [-5.0, 1.0, 16.5, 0.16],
      [15.0, 1.0, 7.2, -0.18]
    ];
    const upAxis = new THREE.Vector3(0, 1, 0);
    palmPositions.forEach(([tx, ty, tz, tilt]) => {
      const palmGroup = new THREE.Group();
      palmGroup.position.set(tx, ty, tz);

      // Smooth Catmull-Rom curve for continuous leaning trunk (zero disconnected segments!)
      const leanDir = tilt >= 0 ? 1 : -1;
      const leanMag = Math.abs(tilt) * 3.6;
      const curvePts = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(leanDir * leanMag * 0.22, 1.45, leanDir * 0.08),
        new THREE.Vector3(leanDir * leanMag * 0.58, 2.95, leanDir * 0.14),
        new THREE.Vector3(leanDir * leanMag, 4.40, leanDir * 0.18)
      ];
      const palmCurve = new THREE.CatmullRomCurve3(curvePts);

      // Swollen basal root bole
      const rootBole = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 0.38, 12), trunkMat);
      rootBole.position.y = 0.18;
      rootBole.castShadow = true;
      palmGroup.add(rootBole);

      const segCount = 9;
      for (let s = 0; s < segCount; s++) {
        const tMid = (s + 0.5) / segCount;
        const pt = palmCurve.getPoint(tMid);
        const tangent = palmCurve.getTangent(tMid).normalize();

        const rBottom = 0.23 - (s / segCount) * 0.095;
        const rTop = 0.23 - ((s + 1) / segCount) * 0.095;
        const seg = new THREE.Mesh(
          new THREE.CylinderGeometry(rTop, rBottom, 0.58, 10),
          trunkMat
        );
        seg.position.copy(pt);
        seg.quaternion.setFromUnitVectors(upAxis, tangent);
        seg.castShadow = true;
        seg.receiveShadow = true;
        palmGroup.add(seg);

        // Annulated leaf-scar ring aligned perpendicular to trunk tangent
        const ring = new THREE.Mesh(new THREE.TorusGeometry(rTop + 0.008, 0.018, 6, 12), trunkMat);
        ring.position.copy(palmCurve.getPoint((s + 0.9) / segCount));
        ring.quaternion.setFromUnitVectors(upAxis, tangent);
        ring.rotateX(Math.PI / 2);
        palmGroup.add(ring);
      }

      // Crown group anchored at exact top apex of the curved trunk!
      const apexPt = palmCurve.getPoint(1.0);
      const crownGroup = new THREE.Group();
      crownGroup.position.copy(apexPt);

      // Smooth green crownshaft
      const crownShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.36, 10), frondMat);
      crownShaft.position.y = 0.12;
      crownGroup.add(crownShaft);

      // Cluster of 6 golden-brown coconuts nestled under crown
      for (let c = 0; c < 6; c++) {
        const cAng = (c / 6) * Math.PI * 2;
        const coconut = new THREE.Mesh(new THREE.SphereGeometry(0.125, 8, 8), coconutMat);
        coconut.scale.set(0.92, 1.15, 0.92);
        coconut.position.set(Math.cos(cAng) * 0.19, -0.04, Math.sin(cAng) * 0.19);
        coconut.castShadow = true;
        crownGroup.add(coconut);
      }

      // 11 Arching & Drooping Pinnate Feather Palm Fronds (双层自然下垂弧形羽状椰叶，含弯曲叶轴与14对羽状小叶)
      const leafletGeo = new THREE.ConeGeometry(0.068, 0.56, 4);
      leafletGeo.scale(0.32, 1.0, 1.0);
      for (let f = 0; f < 11; f++) {
        const isUpper = f < 5;
        const fAng = isUpper
          ? (f / 5) * Math.PI * 2 + 0.3
          : ((f - 5) / 6) * Math.PI * 2;

        const frondArm = new THREE.Group();
        frondArm.position.y = isUpper ? 0.24 : 0.14;
        frondArm.rotation.y = fAng;

        // Curved central rachis spine (叶轴)
        const rachisCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0.65, isUpper ? 0.26 : 0.08, 0),
          new THREE.Vector3(1.42, isUpper ? 0.06 : -0.22, 0),
          new THREE.Vector3(2.15, isUpper ? -0.45 : -0.78, 0)
        ]);
        const rachisGeo = new THREE.TubeGeometry(rachisCurve, 12, 0.022, 6, false);
        const rachisMesh = new THREE.Mesh(rachisGeo, frondMat);
        rachisMesh.castShadow = true;
        frondArm.add(rachisMesh);

        // 7 pairs of feathered pinnate leaflets along both sides of the curved rachis
        for (let p = 1; p <= 7; p++) {
          const u = p / 7.5;
          const pt = rachisCurve.getPoint(u);
          const scaleFactor = Math.sin(u * Math.PI) * 0.75 + 0.35;
          for (const side of [-1, 1]) {
            const leaflet = new THREE.Mesh(leafletGeo, frondMat);
            leaflet.position.set(pt.x + 0.08, pt.y - 0.12 * scaleFactor, side * 0.18 * scaleFactor);
            leaflet.scale.set(1.0, scaleFactor, 1.0);
            leaflet.rotation.set(side * 1.12, side * -0.35, -0.35 - u * 0.45);
            leaflet.castShadow = true;
            frondArm.add(leaflet);
          }
        }

        crownGroup.add(frondArm);
      }

      palmGroup.add(crownGroup);
      this.root.add(palmGroup);
    });

    /* ============================================================== */
    /* 13.3 Riverbank Wetland Flora & Water Reeds (沿岸挺水芦苇菖蒲)   */
    /* ============================================================== */
    const reedPatchPositions = [
      [-12, 0.2, -0.6], [4, 0.2, -0.6], [-8, 0.2, 5.6], [8, 0.2, 5.6]
    ];
    reedPatchPositions.forEach(([rx, ry, rz]) => {
      const patch = new THREE.Group();
      patch.position.set(rx, ry, rz);

      // Clustered reed stalks with velvet cattails
      for (let i = 0; i < 6; i++) {
        const rAng = (i / 6) * Math.PI * 2;
        const dist = 0.15 + (i % 3) * 0.12;

        const stalk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.02, 1.1 + (i % 3) * 0.3, 6),
          reedMat
        );
        stalk.position.set(Math.cos(rAng) * dist, 0.55, Math.sin(rAng) * dist);
        stalk.rotation.z = (Math.random() - 0.5) * 0.15;
        patch.add(stalk);

        // Brown velvet cattail cylinder head
        const cattail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.25, 8), cattailMat);
        cattail.position.set(stalk.position.x, 0.95 + (i % 3) * 0.15, stalk.position.z);
        patch.add(cattail);
      }
      this.root.add(patch);
    });

    // 13.4 Blooming Bougainvillea Courtyard Planters (南洋九重葛八角花坛与繁花灌木)
    const bushLeafMat = new THREE.MeshStandardMaterial({ color: 0x224e28, roughness: 0.75 });
    const bushCoralMat = new THREE.MeshStandardMaterial({ color: 0xf24a7a, roughness: 0.52 });
    const bushPlanterMat = new THREE.MeshStandardMaterial({ color: 0x6e503b, roughness: 0.8 });
    const bushRimMat = new THREE.MeshStandardMaterial({ color: 0x8a684f, roughness: 0.72 });
    const bushTrunkMat = new THREE.MeshStandardMaterial({ color: 0x453020, roughness: 0.88 });

    // Positioned cleanly on North Courtyard (-7.5) and South Riverfront Promenade (+7.8, never overlapping river water!)
    for (const [bx, bz] of [[-13, -7.5], [6, -7.5], [14, 7.8], [-9, 7.8]]) {
      const planterRoot = new THREE.Group();
      planterRoot.position.set(bx, 1.0, bz);

      // Octagonal terracotta/granite planter base & molded lip
      const potBody = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.46, 0.44, 8), bushPlanterMat);
      potBody.position.y = 0.22;
      potBody.castShadow = true;
      potBody.receiveShadow = true;
      planterRoot.add(potBody);

      const potRim = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.60, 0.08, 8), bushRimMat);
      potRim.position.y = 0.44;
      potRim.castShadow = true;
      planterRoot.add(potRim);

      // Twisted woody stems rising from planter
      for (let s = 0; s < 3; s++) {
        const sAng = (s / 3) * Math.PI * 2 + 0.4;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.55, 7), bushTrunkMat);
        stem.position.set(Math.cos(sAng) * 0.12, 0.65, Math.sin(sAng) * 0.12);
        stem.rotation.z = Math.cos(sAng) * 0.24;
        stem.rotation.x = Math.sin(sAng) * 0.24;
        planterRoot.add(stem);
      }

      // Multi-layered botanical foliage & bougainvillea bract crown (wind-animated)
      const crownGroup = new THREE.Group();
      crownGroup.position.y = 0.92;

      const foliageOffsets = [
        [0, 0.05, 0, 0.36],
        [-0.28, -0.04, 0.18, 0.28],
        [0.28, -0.02, -0.16, 0.29],
        [-0.18, 0.02, -0.26, 0.27],
        [0.22, -0.05, 0.25, 0.26]
      ];
      for (const [fx, fy, fz, fr] of foliageOffsets) {
        const leafCluster = new THREE.Mesh(new THREE.SphereGeometry(fr, 10, 8), bushLeafMat);
        leafCluster.scale.set(1.18, 0.82, 1.12);
        leafCluster.position.set(fx, fy, fz);
        leafCluster.castShadow = true;
        crownGroup.add(leafCluster);
      }

      // Cascading magenta & coral bougainvillea flower bract clusters
      const bloomOffsets = [
        [0, 0.28, 0, 0.20, 0],
        [-0.32, 0.12, 0.22, 0.17, 1],
        [0.34, 0.14, -0.18, 0.18, 0],
        [-0.22, 0.16, -0.28, 0.16, 1],
        [0.24, 0.10, 0.28, 0.17, 0],
        [0.12, 0.24, 0.16, 0.15, 1],
        [-0.16, 0.22, -0.12, 0.15, 0]
      ];
      for (const [kx, ky, kz, kr, matIdx] of bloomOffsets) {
        const bloom = new THREE.Mesh(
          new THREE.SphereGeometry(kr, 9, 7),
          matIdx === 0 ? bougainvilleaMat : bushCoralMat
        );
        bloom.scale.set(1.24, 0.78, 1.16);
        bloom.position.set(kx, ky, kz);
        bloom.castShadow = true;
        crownGroup.add(bloom);
      }

      this.floweringBushes.push(crownGroup);
      planterRoot.add(crownGroup);
      this.root.add(planterRoot);
    }

    // 13.5 Victorian Cast-Iron Gas Streetlamps along the Quayside
    const lampPositions = [
      [-14, -2.2], [-6, -2.2], [4, -2.2], [12, -2.2],
      [-10, 7.2], [0, 7.2], [10, 7.2]
    ];
    for (let lIdx = 0; lIdx < lampPositions.length; lIdx++) {
      const [lx, lz] = lampPositions[lIdx];
      const lamp = new THREE.Group();
      lamp.position.set(lx, 1.0, lz);

      // Fluted cast-iron stepped base pedestal
      const basePedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.35, 8), lampPostMat);
      basePedestal.position.y = 0.175;
      lamp.add(basePedestal);

      // Slender column with ornamental ring collar
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 2.7, 8), lampPostMat);
      pole.position.y = 1.7;
      lamp.add(pole);

      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 16), lampPostMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 2.4;
      lamp.add(collar);

      // Victorian Lamplighter ladder-rest crossbar
      const crossArm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8), lampPostMat);
      crossArm.rotation.z = Math.PI / 2;
      crossArm.position.y = 2.9;
      lamp.add(crossArm);
      for (const tipX of [-0.35, 0.35]) {
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), lampPostMat);
        ball.position.set(tipX, 2.9, 0);
        lamp.add(ball);
      }

      // 4-sided tapered glass lantern housing (wider top, narrower base)
      const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.18, 0.5, 4), glassMat);
      lanternGlass.rotation.y = Math.PI / 4;
      lanternGlass.position.y = 3.35;
      lamp.add(lanternGlass);

      // Glowing gas mantle flame inside
      const mantle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), mantleFlameMat);
      mantle.position.y = 3.35;
      lamp.add(mantle);

      // 4-sided copper pagoda pyramid cap
      const roofCap = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.22, 4), copperRoofMat);
      roofCap.rotation.y = Math.PI / 4;
      roofCap.position.y = 3.7;
      lamp.add(roofCap);

      // Finial spire & ball
      const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.03, 0.16, 8), lampPostMat);
      finial.position.y = 3.9;
      lamp.add(finial);

      if (lIdx === 1 || lIdx === 3 || lIdx === 5) {
        const lampLight = new THREE.PointLight(0xffcc66, 1.25, 13.0);
        lampLight.position.y = 3.4;
        lamp.add(lampLight);
        this.pointLights.push(lampLight);
        this.lampLights.push(lampLight);
      }

      this.root.add(lamp);
    }
  }
  /* -------------------------------------------------------------- */
  /* 14. Historical NPCs (Curator Lin & Old Boatman - 手办级雕塑)   */
  /* -------------------------------------------------------------- */
  private createAnatomicalGarmentGeometry(
    rHemX: number,
    rWaistX: number,
    rChestX: number,
    height: number,
    depthRatio = 0.68
  ): THREE.BufferGeometry {
    const radialSegs = 28;
    const heightSegs = 16;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const halfH = height * 0.5;

    for (let j = 0; j <= heightSegs; j++) {
      const v = j / heightSegs;
      const y = -halfH + v * height;

      let rx: number;
      let rz: number;
      let zOffset = 0;

      if (v < 0.38) {
        const t = v / 0.38;
        const s = t * t * (3 - 2 * t);
        rx = rHemX + (rWaistX - rHemX) * s;
        rz = rx * (depthRatio + 0.05 * (1 - s));
      } else if (v < 0.78) {
        const t = (v - 0.38) / 0.40;
        const s = t * t * (3 - 2 * t);
        rx = rWaistX + (rChestX - rWaistX) * s;
        rz = rx * (depthRatio + 0.04 * Math.sin(t * Math.PI));
        zOffset = 0.012 * Math.sin(t * Math.PI);
      } else {
        // Sloped trapezius & collar shoulder dome (zero flat cylinder top!)
        const t = (v - 0.78) / 0.22;
        const s = t * t * (3 - 2 * t);
        const rNeck = rChestX * 0.38;
        rx = rChestX * (1 - s) + rNeck * s;
        rz = rx * (depthRatio * (1 - 0.12 * s) + 0.12 * s);
        zOffset = 0.010 * (1 - s);
      }

      for (let i = 0; i <= radialSegs; i++) {
        const u = i / radialSegs;
        const theta = u * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        const pectoralContour =
          v > 0.42 && v < 0.82 && sinT > 0
            ? 1 + 0.06 * Math.sin(((v - 0.42) / 0.40) * Math.PI) * Math.pow(sinT, 2)
            : 1.0;
        const spineHollow =
          v > 0.25 && v < 0.75 && sinT < -0.5
            ? 1 - 0.04 * Math.sin(((v - 0.25) / 0.50) * Math.PI) * Math.pow((-sinT - 0.5) / 0.5, 2)
            : 1.0;
        const hemFold =
          v < 0.35
            ? 1 + 0.022 * (1 - v / 0.35) * Math.sin(theta * 8)
            : 1.0;

        const x = cosT * rx * hemFold;
        const z = sinT * rz * pectoralContour * spineHollow * hemFold + zOffset;
        positions.push(x, y, z);
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
  }

  private createSculptedHeadGeometry(radius: number): THREE.BufferGeometry {
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
        const widthTaper = 1 - 0.28 * Math.pow(jawT, 1.35);
        x *= widthTaper;
        if (nz > 0.25) {
          z += radius * 0.07 * Math.pow(jawT, 1.2) * ((nz - 0.25) / 0.75);
        }
        if (nz < 0) {
          z *= 1 - 0.14 * jawT;
        }
      } else {
        x *= 0.96;
        y *= 1.04;
      }

      if (ny > -0.25 && ny < 0.18 && nz > 0.3) {
        const cheekFactor = 1 - Math.abs(ny + 0.03) / 0.22;
        x *= 1 + 0.05 * Math.max(0, cheekFactor);
      }
      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  private buildCuratorNPC() {
    this.curatorNPCGroup = new THREE.Group();
    this.curatorNPCGroup.position.set(-16, 1.23, -7);

    // Curator Lin: British-Malayan Archival Tailoring Materials
    const trenchMat = new THREE.MeshStandardMaterial({ color: 0x524434, roughness: 0.72, side: THREE.DoubleSide });
    const lapelMat = new THREE.MeshStandardMaterial({ color: 0x3d3024, roughness: 0.8 });
    const kebayaSilkMat = new THREE.MeshStandardMaterial({ color: 0x7a1828, roughness: 0.50 });
    const kebayaGoldTrimMat = new THREE.MeshStandardMaterial({ color: 0xdfb43a, roughness: 0.30, metalness: 0.80 });
    const kebayaTealAccentMat = new THREE.MeshStandardMaterial({ color: 0x2b8a7c, roughness: 0.45 });
    const scarfMat = new THREE.MeshStandardMaterial({ color: 0xb5382b, roughness: 0.62 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x181311, roughness: 0.9 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe6b894, roughness: 0.6 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.25, metalness: 0.85 });
    const glassesMat = new THREE.MeshStandardMaterial({ color: 0xcaa246, roughness: 0.2, metalness: 0.9 });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x3d2014, roughness: 0.55 });
    const paperMat = new THREE.MeshStandardMaterial({
      color: 0xf7eed6,
      roughness: 0.78
    });
    const inkLineMat = new THREE.MeshStandardMaterial({ color: 0x3c2c20, roughness: 0.85 });
    const lipMat = new THREE.MeshStandardMaterial({ color: 0xb85d4b, roughness: 0.52 });

    // 14.1 Articulated Capsule Legs & Sculpted Oxford Dress Shoes
    for (const lx of [-0.145, 0.145]) {
      const upperLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.088, 0.34, 8, 16), trenchMat);
      upperLeg.position.set(lx, 0.66, 0);
      upperLeg.castShadow = true;
      this.curatorNPCGroup.add(upperLeg);

      const kneeJoint = new THREE.Mesh(new THREE.SphereGeometry(0.082, 14, 12), trenchMat);
      kneeJoint.position.set(lx, 0.44, 0.01);
      this.curatorNPCGroup.add(kneeJoint);

      const lowerLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.076, 0.32, 8, 16), trenchMat);
      lowerLeg.position.set(lx, 0.24, 0);
      lowerLeg.castShadow = true;
      this.curatorNPCGroup.add(lowerLeg);

      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.018, 8, 18), trenchMat);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.set(lx, 0.09, 0);
      this.curatorNPCGroup.add(cuff);

      // Sculpted Leather Oxford Dress Shoe with rounded vamp & stacked heel
      const shoeGroup = new THREE.Group();
      shoeGroup.position.set(lx, 0.04, 0.04);

      const shoeVamp = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.12, 8, 14), leatherMat);
      shoeVamp.rotation.x = Math.PI / 2;
      shoeVamp.scale.set(1.08, 1.0, 0.72);
      shoeVamp.position.set(0, 0.005, 0.02);
      shoeVamp.castShadow = true;
      shoeGroup.add(shoeVamp);

      const shoeHeel = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.062, 0.045, 14), hairMat);
      shoeHeel.position.set(0, -0.018, -0.065);
      shoeGroup.add(shoeHeel);

      this.curatorNPCGroup.add(shoeGroup);
    }

    // 14.2 Contoured Multi-Ring Lofted Trench Coat & Peranakan Kebaya Collar
    const coatGroup = new THREE.Group();
    coatGroup.position.set(0, 1.06, 0);
    this.curatorNPCGroup.add(coatGroup);

    const coatTorsoGeo = this.createAnatomicalGarmentGeometry(0.41, 0.265, 0.295, 1.12, 0.68);
    const coatTorsoMesh = new THREE.Mesh(coatTorsoGeo, trenchMat);
    coatTorsoMesh.position.y = 0.03;
    coatTorsoMesh.castShadow = true;
    coatTorsoMesh.receiveShadow = true;
    coatGroup.add(coatTorsoMesh);

    // Coat hem trim ring
    const skirtHem = new THREE.Mesh(new THREE.TorusGeometry(0.405, 0.016, 8, 28), lapelMat);
    skirtHem.rotation.x = Math.PI / 2;
    skirtHem.scale.set(1.0, 0.72, 1.0);
    skirtHem.position.y = -0.52;
    coatGroup.add(skirtHem);

    // Right shoulder storm flap (gun flap - 1930s trench coat detail)
    const stormFlap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.20, 0.022), lapelMat);
    stormFlap.position.set(0.13, 0.36, 0.195);
    stormFlap.rotation.set(-0.12, 0.12, 0.05);
    coatGroup.add(stormFlap);

    // Cinched Leather Waist Belt with Brass Buckle
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.275, 0.280, 0.075, 24), leatherMat);
    belt.scale.set(1.02, 1.0, 0.70);
    belt.position.set(0, -0.06, 0);
    coatGroup.add(belt);

    const beltBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.088, 0.035), brassMat);
    beltBuckle.position.set(0, -0.06, 0.195);
    coatGroup.add(beltBuckle);

    // Peranakan Kebaya Silk Collar & Gold Embroidery Trim peaking through lapels
    for (const [kSide, kRot] of [[-1, 0.22], [1, -0.22]]) {
      const kebayaPanel = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.34, 0.022), kebayaSilkMat);
      kebayaPanel.position.set(kSide * 0.052, 0.32, 0.195);
      kebayaPanel.rotation.set(-0.14, 0, kRot);
      coatGroup.add(kebayaPanel);

      const goldTrim = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.34, 0.026), kebayaGoldTrimMat);
      goldTrim.position.set(kSide * 0.024, 0.32, 0.20);
      goldTrim.rotation.set(-0.14, 0, kRot);
      coatGroup.add(goldTrim);

      const floralAccent = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), kebayaTealAccentMat);
      floralAccent.position.set(kSide * 0.042, 0.26, 0.205);
      coatGroup.add(floralAccent);
    }

    // Traditional Peranakan Kerosang (3-tier gold filigree brooch set fastening the kebaya)
    for (const [ky, kr] of [[0.25, 0.020], [0.18, 0.017], [0.11, 0.017]]) {
      const kerosang = new THREE.Mesh(new THREE.SphereGeometry(kr, 10, 10), brassMat);
      kerosang.scale.set(1.0, 1.0, 0.55);
      kerosang.position.set(0, ky, 0.212);
      coatGroup.add(kerosang);
    }

    // 3D Notched Trench Lapels & Shoulder Epaulettes
    for (const [side, rotZ] of [
      [1, -0.18],
      [-1, 0.18]
    ]) {
      const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.030), lapelMat);
      lapel.position.set(side * 0.105, 0.30, 0.195);
      lapel.rotation.set(-0.14, side * 0.12, rotZ);
      coatGroup.add(lapel);

      const epaulette = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.11, 6, 10), lapelMat);
      epaulette.rotation.z = Math.PI / 2 + side * -0.18;
      epaulette.scale.set(1.0, 1.0, 0.45);
      epaulette.position.set(side * 0.23, 0.50, 0);
      coatGroup.add(epaulette);

      const epauletteButton = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), brassMat);
      epauletteButton.position.set(side * 0.17, 0.52, 0);
      coatGroup.add(epauletteButton);
    }

    // Double-breasted brass button columns down front
    for (const by of [0.36, 0.22, 0.08]) {
      for (const bx of [-0.07, 0.07]) {
        const button = new THREE.Mesh(new THREE.SphereGeometry(0.020, 8, 8), brassMat);
        button.position.set(bx, by, 0.205);
        coatGroup.add(button);
      }
    }

    // Curator Museum ID Badge pinned to left lapel
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.11, 0.022), brassMat);
    badge.position.set(0.14, 0.34, 0.21);
    coatGroup.add(badge);

    // 14.3 Red Cashmere Scarf with Knotted Tail
    const scarfGroup = new THREE.Group();
    scarfGroup.position.set(0, 1.60, 0);
    this.curatorNPCGroup.add(scarfGroup);

    const scarfCollar = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.058, 12, 24), scarfMat);
    scarfCollar.rotation.x = Math.PI / 2;
    scarfCollar.scale.set(1.0, 0.86, 1.0);
    scarfGroup.add(scarfCollar);

    const scarfKnot = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 12), scarfMat);
    scarfKnot.position.set(0.04, -0.04, 0.16);
    scarfGroup.add(scarfKnot);

    const scarfTail = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.22, 8, 12), scarfMat);
    scarfTail.scale.set(1.15, 1.0, 0.38);
    scarfTail.position.set(0.05, -0.17, 0.18);
    scarfTail.rotation.z = -0.12;
    scarfGroup.add(scarfTail);

    // 14.4 Sculpted Head, Facial Features, 1930s Marcel Hair Waves & Spectacles
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.86, 0);
    this.curatorNPCGroup.add(headGroup);

    const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.078, 0.09, 8, 14), skinMat);
    neck.position.y = -0.14;
    headGroup.add(neck);

    // High-segment vertex-sculpted head cranium & tapered jawline
    const head = new THREE.Mesh(this.createSculptedHeadGeometry(0.205), skinMat);
    head.scale.set(0.95, 1.03, 0.98);
    head.castShadow = true;
    headGroup.add(head);

    // Smooth sculpted nose bridge & warm rose-terracotta lips
    const nose = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.046, 6, 10), skinMat);
    nose.position.set(0, 0.014, 0.202);
    nose.rotation.x = -0.18;
    headGroup.add(nose);

    const upperLip = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.034, 6, 10), lipMat);
    upperLip.rotation.z = Math.PI / 2;
    upperLip.position.set(0, -0.052, 0.202);
    headGroup.add(upperLip);

    const lowerLip = new THREE.Mesh(new THREE.CapsuleGeometry(0.009, 0.028, 6, 10), lipMat);
    lowerLip.rotation.z = Math.PI / 2;
    lowerLip.position.set(0, -0.064, 0.198);
    headGroup.add(lowerLip);

    // Expressive eyes, sclera & catchlights behind spectacles
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a120c });
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xfbf8f2 });
    for (const ex of [-0.066, 0.066]) {
      const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 10), eyeWhiteMat);
      sclera.scale.set(1.15, 0.72, 0.50);
      sclera.position.set(ex, 0.032, 0.186);
      headGroup.add(sclera);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 10), eyeMat);
      pupil.scale.set(0.95, 0.95, 0.55);
      pupil.position.set(ex, 0.032, 0.194);
      headGroup.add(pupil);

      const catchlight = new THREE.Mesh(new THREE.SphereGeometry(0.005, 6, 6), eyeWhiteMat);
      catchlight.position.set(ex + 0.005, 0.037, 0.202);
      headGroup.add(catchlight);

      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.044, 4, 8), hairMat);
      brow.rotation.z = Math.PI / 2 + (ex < 0 ? 0.08 : -0.08);
      brow.position.set(ex, 0.072, 0.190);
      headGroup.add(brow);
    }

    // Delicate ears with gold stud earrings
    for (const ex of [-0.186, 0.186]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 10), skinMat);
      ear.scale.set(0.42, 1.12, 0.72);
      ear.position.set(ex, 0.01, -0.01);
      headGroup.add(ear);

      const earring = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), brassMat);
      earring.position.set(ex, -0.024, -0.01);
      headGroup.add(earring);
    }

    // Styled 1930s Hair Waves & High Bun (swept gracefully along temples without blocking eyebrows)
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.214, 20, 16), hairMat);
    hairCap.scale.set(0.96, 1.02, 1.0);
    hairCap.position.set(0, 0.052, -0.035);
    headGroup.add(hairCap);

    for (const [wx, wy, wz, wRotZ] of [
      [-0.142, 0.095, 0.065, 0.52],
      [0.142, 0.095, 0.065, -0.52],
      [-0.105, 0.128, 0.102, 0.32],
      [0.105, 0.128, 0.102, -0.32]
    ]) {
      const wave = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.017, 8, 14, Math.PI * 0.65), hairMat);
      wave.position.set(wx, wy, wz);
      wave.rotation.set(0.25, 0, wRotZ);
      headGroup.add(wave);
    }

    const hairBun = new THREE.Mesh(new THREE.SphereGeometry(0.128, 16, 14), hairMat);
    hairBun.position.set(0, 0.07, -0.205);
    headGroup.add(hairBun);

    const hairBunBraid = new THREE.Mesh(new THREE.TorusGeometry(0.102, 0.028, 8, 18), hairMat);
    hairBunBraid.position.set(0, 0.07, -0.205);
    headGroup.add(hairBunBraid);

    const hairpin = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.34, 8), brassMat);
    hairpin.position.set(0, 0.09, -0.205);
    hairpin.rotation.z = 0.7;
    headGroup.add(hairpin);

    const hairpinFinial = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 10), kebayaTealAccentMat);
    hairpinFinial.position.set(Math.cos(0.7) * 0.17, 0.09 + Math.sin(0.7) * 0.17, -0.205);
    headGroup.add(hairpinFinial);

    // Wireframe Round Spectacles
    const glassesBridge = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.044, 8), glassesMat);
    glassesBridge.rotation.z = Math.PI / 2;
    glassesBridge.position.set(0, 0.032, 0.205);
    headGroup.add(glassesBridge);

    for (const gx of [-0.066, 0.066]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.010, 8, 20), glassesMat);
      rim.position.set(gx, 0.032, 0.198);
      headGroup.add(rim);

      const templeArm = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.19, 6), glassesMat);
      templeArm.rotation.x = Math.PI / 2;
      templeArm.position.set(gx > 0 ? 0.118 : -0.118, 0.032, 0.10);
      headGroup.add(templeArm);
    }

    // 14.5 Articulated Capsule Arms, Sloped Shoulder/Elbow Joints & Sculpted Hands
    const shoulderCapL = new THREE.Mesh(new THREE.SphereGeometry(0.080, 14, 12), trenchMat);
    shoulderCapL.scale.set(0.88, 0.76, 0.88);
    shoulderCapL.position.set(-0.26, 1.48, 0.0);
    shoulderCapL.castShadow = true;
    this.curatorNPCGroup.add(shoulderCapL);

    const upperArmL = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.24, 8, 14), trenchMat);
    upperArmL.position.set(-0.28, 1.34, 0.03);
    upperArmL.rotation.set(-0.18, 0, -0.10);
    upperArmL.castShadow = true;
    this.curatorNPCGroup.add(upperArmL);

    const elbowL = new THREE.Mesh(new THREE.SphereGeometry(0.066, 12, 10), trenchMat);
    elbowL.position.set(-0.29, 1.18, 0.07);
    this.curatorNPCGroup.add(elbowL);

    const forearmL = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.22, 8, 14), trenchMat);
    forearmL.position.set(-0.25, 1.07, 0.16);
    forearmL.rotation.set(-0.62, 0.28, 0.22);
    forearmL.castShadow = true;
    this.curatorNPCGroup.add(forearmL);

    const cuffTabL = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.015, 8, 16), lapelMat);
    cuffTabL.position.set(-0.23, 0.99, 0.22);
    cuffTabL.rotation.set(0.95, 0.28, 0.22);
    this.curatorNPCGroup.add(cuffTabL);

    // Sculpted Left Hand holding archival clipboard
    const handLGroup = new THREE.Group();
    handLGroup.position.set(-0.21, 0.96, 0.24);
    handLGroup.rotation.set(-0.35, 0.15, -0.15);

    const palmL = new THREE.Mesh(new THREE.SphereGeometry(0.044, 12, 10), skinMat);
    palmL.scale.set(0.85, 0.55, 1.12);
    handLGroup.add(palmL);

    const thumbL = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.036, 4, 8), skinMat);
    thumbL.position.set(0.035, 0.015, -0.01);
    thumbL.rotation.set(0.2, -0.3, -0.6);
    handLGroup.add(thumbL);

    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.010, 0.042, 4, 8), skinMat);
      finger.position.set(0.022 - f * 0.015, -0.015, 0.035);
      finger.rotation.set(0.4, 0, 0);
      handLGroup.add(finger);
    }
    this.curatorNPCGroup.add(handLGroup);

    // Leather clipboard / archival ledger with brass clamp & inscribed rubbing notes
    const clipboardGroup = new THREE.Group();
    clipboardGroup.position.set(-0.14, 1.14, 0.27);
    clipboardGroup.rotation.set(-0.38, 0.18, -0.10);

    const clipboard = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.42, 0.032), leatherMat);
    clipboardGroup.add(clipboard);

    const clipClamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.038), brassMat);
    clipClamp.position.set(0, 0.19, 0.01);
    clipboardGroup.add(clipClamp);

    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.008), paperMat);
    paper.position.set(0, -0.01, 0.018);
    clipboardGroup.add(paper);

    for (let li = 0; li < 5; li++) {
      const lineW = li === 0 ? 0.14 : (li === 4 ? 0.12 : 0.19);
      const inkLine = new THREE.Mesh(new THREE.BoxGeometry(lineW, 0.009, 0.004), inkLineMat);
      inkLine.position.set(li === 0 ? 0 : -0.015, 0.10 - li * 0.048, 0.023);
      clipboardGroup.add(inkLine);
    }
    const redSeal = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.036, 0.005), kebayaSilkMat);
    redSeal.position.set(0.075, -0.11, 0.023);
    clipboardGroup.add(redSeal);

    this.curatorNPCGroup.add(clipboardGroup);

    // Right Arm: Spherical shoulder cap -> Capsule upper arm -> Spherical elbow -> Capsule forearm holding briefcase
    const shoulderCapR = new THREE.Mesh(new THREE.SphereGeometry(0.082, 14, 12), trenchMat);
    shoulderCapR.position.set(0.26, 1.48, 0.0);
    shoulderCapR.scale.set(0.88, 0.76, 0.88);
    shoulderCapR.castShadow = true;
    this.curatorNPCGroup.add(shoulderCapR);

    const upperArmR = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.25, 8, 14), trenchMat);
    upperArmR.position.set(0.31, 1.35, 0.01);
    upperArmR.rotation.set(0.06, 0, 0.14);
    upperArmR.castShadow = true;
    this.curatorNPCGroup.add(upperArmR);

    const elbowR = new THREE.Mesh(new THREE.SphereGeometry(0.070, 12, 10), trenchMat);
    elbowR.position.set(0.35, 1.19, 0.02);
    this.curatorNPCGroup.add(elbowR);

    const forearmR = new THREE.Mesh(new THREE.CapsuleGeometry(0.064, 0.22, 8, 14), trenchMat);
    forearmR.position.set(0.39, 1.06, 0.04);
    forearmR.rotation.set(0.12, 0, 0.16);
    forearmR.castShadow = true;
    this.curatorNPCGroup.add(forearmR);

    const cuffTabR = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.015, 8, 16), lapelMat);
    cuffTabR.position.set(0.43, 0.98, 0.045);
    cuffTabR.rotation.set(Math.PI / 2 + 0.12, 0, 0.18);
    this.curatorNPCGroup.add(cuffTabR);

    // Sculpted Right Hand gripping briefcase handle
    const handRGroup = new THREE.Group();
    handRGroup.position.set(0.45, 0.95, 0.05);
    handRGroup.rotation.y = 0.15;

    const palmR = new THREE.Mesh(new THREE.SphereGeometry(0.044, 12, 10), skinMat);
    palmR.scale.set(0.85, 0.55, 1.12);
    handRGroup.add(palmR);

    const thumbR = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.036, 4, 8), skinMat);
    thumbR.position.set(-0.035, 0.015, -0.01);
    thumbR.rotation.set(0.2, 0.3, 0.6);
    handRGroup.add(thumbR);

    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.010, 0.042, 4, 8), skinMat);
      finger.position.set(-0.022 + f * 0.015, -0.018, 0.035);
      finger.rotation.set(1.2, 0, 0);
      handRGroup.add(finger);
    }
    this.curatorNPCGroup.add(handRGroup);

    // Archival Leather Briefcase
    const briefcaseGroup = new THREE.Group();
    briefcaseGroup.position.set(0.46, 0.82, 0.05);
    briefcaseGroup.rotation.y = 0.15;

    const briefcaseBody = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.38, 0.48), leatherMat);
    briefcaseBody.castShadow = true;
    briefcaseGroup.add(briefcaseBody);

    const centerStrap = new THREE.Mesh(new THREE.BoxGeometry(0.186, 0.386, 0.06), lapelMat);
    briefcaseGroup.add(centerStrap);

    for (const cy of [-0.18, 0.18]) {
      for (const cz of [-0.23, 0.23]) {
        const corner = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.06, 0.06), brassMat);
        corner.position.set(0, cy, cz);
        briefcaseGroup.add(corner);
      }
    }

    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.08), brassMat);
    lock.position.set(0, 0.05, 0);
    briefcaseGroup.add(lock);

    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 8, 16, Math.PI), leatherMat);
    handle.position.set(0, 0.21, 0);
    handle.rotation.y = Math.PI / 2;
    briefcaseGroup.add(handle);

    this.curatorNPCGroup.add(briefcaseGroup);

    // Floating Interaction Beacon Star (Crucial: Keep name = "beacon")
    const beaconGeo = new THREE.OctahedronGeometry(0.16, 0);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xffd685,
      transparent: true,
      opacity: 0.85
    });
    const star = new THREE.Mesh(beaconGeo, beaconMat);
    star.position.set(0, 2.82, 0);
    star.name = "beacon";
    this.curatorNPCGroup.add(star);

    this.root.add(this.curatorNPCGroup);
  }

  private buildBoatmanNPC() {
    this.boatmanNPCGroup = new THREE.Group();
    this.boatmanNPCGroup.position.set(0, 0.75, -2.4);

    // Weathered maritime Nanyang materials
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xbf8258, roughness: 0.75 });
    const tunicMat = new THREE.MeshStandardMaterial({ color: 0xe0dcd4, roughness: 0.88, side: THREE.DoubleSide });
    const trousersMat = new THREE.MeshStandardMaterial({ color: 0x2b3744, roughness: 0.85 });
    const sashMat = new THREE.MeshStandardMaterial({ color: 0x7c2d24, roughness: 0.78 });
    const oarMat = new THREE.MeshStandardMaterial({ color: 0x543822, roughness: 0.7 });
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x968058, roughness: 0.92 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xb58b3c, roughness: 0.35, metalness: 0.8 });
    const mustacheMat = new THREE.MeshStandardMaterial({ color: 0xa29b92, roughness: 0.9 });
    const ribMat = new THREE.MeshStandardMaterial({ color: 0x6e4e2e, roughness: 0.75 });

    // 14.6 Wooden Pier Decking (Walkable for player)
    const pierPlanks = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.25, 4.2),
      new THREE.MeshStandardMaterial({
        map: getWoodPlankTexture(),
        roughness: 0.85
      })
    );
    pierPlanks.position.set(0, -0.1, 0);
    pierPlanks.receiveShadow = true;
    this.boatmanNPCGroup.add(pierPlanks);
    this.walkableMeshes.push(pierPlanks);

    // Heavy pier support stilts / piles in river
    for (const px of [-1.5, 1.5]) {
      for (const pz of [-1.8, 1.8]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 2.2, 12), oarMat);
        post.position.set(px, -1.0, pz);
        this.boatmanNPCGroup.add(post);

        const tideRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 8, 16), ropeMat);
        tideRing.rotation.x = Math.PI / 2;
        tideRing.position.set(px, -0.5, pz);
        this.boatmanNPCGroup.add(tideRing);
      }
    }

    // Wooden Mooring Bollard Cleat with Coiled Hemp Rope
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.65, 12), oarMat);
    bollard.position.set(1.4, 0.32, -1.5);
    bollard.castShadow = true;
    this.boatmanNPCGroup.add(bollard);

    const bollardCap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.1, 12), oarMat);
    bollardCap.position.set(1.4, 0.66, -1.5);
    this.boatmanNPCGroup.add(bollardCap);

    for (let r = 0; r < 3; r++) {
      const ropeLoop = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.035, 8, 20), ropeMat);
      ropeLoop.rotation.x = Math.PI / 2;
      ropeLoop.position.set(1.4, 0.2 + r * 0.07, -1.5);
      this.boatmanNPCGroup.add(ropeLoop);
    }

    // 14.7 Boatman Articulated Capsule Legs, Rolled-up Indigo Trousers & Sculpted Bare Feet
    for (const lx of [-0.155, 0.155]) {
      // Trousers rolled up to mid-calf (CapsuleGeometry)
      const legUpper = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.38, 8, 16), trousersMat);
      legUpper.position.set(lx, 0.62, 0);
      legUpper.castShadow = true;
      this.boatmanNPCGroup.add(legUpper);

      const kneeSph = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), trousersMat);
      kneeSph.position.set(lx, 0.42, 0.01);
      this.boatmanNPCGroup.add(kneeSph);

      // Rolled trouser cuff
      const legCuff = new THREE.Mesh(new THREE.TorusGeometry(0.102, 0.032, 8, 18), trousersMat);
      legCuff.rotation.x = Math.PI / 2;
      legCuff.position.set(lx, 0.35, 0);
      this.boatmanNPCGroup.add(legCuff);

      // Bare muscular calf (CapsuleGeometry)
      const calf = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.20, 8, 14), skinMat);
      calf.position.set(lx, 0.20, 0);
      calf.castShadow = true;
      this.boatmanNPCGroup.add(calf);

      // Ankle malleolus bone contour
      const ankle = new THREE.Mesh(new THREE.SphereGeometry(0.056, 10, 10), skinMat);
      ankle.position.set(lx, 0.075, 0);
      this.boatmanNPCGroup.add(ankle);

      // Sculpted bare foot with rounded instep arch and toes
      const footArch = new THREE.Mesh(new THREE.CapsuleGeometry(0.054, 0.13, 8, 12), skinMat);
      footArch.rotation.x = Math.PI / 2;
      footArch.scale.set(1.15, 1.0, 0.65);
      footArch.position.set(lx, 0.035, 0.045);
      footArch.castShadow = true;
      this.boatmanNPCGroup.add(footArch);

      const toePad = new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 10), skinMat);
      toePad.scale.set(1.12, 0.48, 0.92);
      toePad.position.set(lx, 0.026, 0.145);
      this.boatmanNPCGroup.add(toePad);
    }

    // 14.8 Contoured Multi-Ring Lofted Samfoo Cotton Tunic & Knotted Frog Buttons (盘扣)
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 1.25, 0);
    this.boatmanNPCGroup.add(torsoGroup);

    // Anatomically contoured Samfoo tunic body (zero circular tin-can silhouette!)
    const tunicGeo = this.createAnatomicalGarmentGeometry(0.355, 0.285, 0.335, 0.92, 0.66);
    const tunicBody = new THREE.Mesh(tunicGeo, tunicMat);
    tunicBody.castShadow = true;
    tunicBody.receiveShadow = true;
    torsoGroup.add(tunicBody);

    // Folded Mandarin Collar (elliptical to match neck/trapezius dome)
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.032, 10, 22), tunicMat);
    collar.rotation.x = Math.PI / 2;
    collar.scale.set(1.0, 0.85, 1.0);
    collar.position.set(0, 0.44, 0.01);
    torsoGroup.add(collar);

    // Overlapping front placket edge (大襟边缘 conforming to contoured chest)
    const placketCurve = new THREE.Mesh(new THREE.CapsuleGeometry(0.010, 0.16, 4, 8), sashMat);
    placketCurve.position.set(0.05, 0.34, 0.215);
    placketCurve.rotation.z = -0.45;
    torsoGroup.add(placketCurve);

    const placketStem = new THREE.Mesh(new THREE.CapsuleGeometry(0.010, 0.36, 4, 8), sashMat);
    placketStem.position.set(0.09, 0.10, 0.228);
    torsoGroup.add(placketStem);

    // 3 Knotted Cloth Frog Buttons (盘扣: 纽头、扣袢与侧翼)
    for (const [by, bx, bz] of [
      [0.30, 0.055, 0.222],
      [0.15, 0.09, 0.232],
      [0.0, 0.09, 0.225]
    ]) {
      const frogLoop = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.007, 6, 12, Math.PI), sashMat);
      frogLoop.position.set(bx - 0.032, by, bz);
      frogLoop.rotation.z = Math.PI / 2;
      torsoGroup.add(frogLoop);

      const frogCenter = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), sashMat);
      frogCenter.position.set(bx, by, bz + 0.005);
      torsoGroup.add(frogCenter);

      for (const wSide of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.CapsuleGeometry(0.007, 0.042, 4, 8), sashMat);
        wing.rotation.z = Math.PI / 2;
        wing.position.set(bx + wSide * 0.036, by, bz);
        torsoGroup.add(wing);
      }
    }

    // Broad Cinnabar Cloth Waist Sash (elliptically contoured to waist, not a circular drum)
    const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.320, 0.20, 24), sashMat);
    sash.scale.set(1.02, 1.0, 0.68);
    sash.position.set(0, -0.26, 0);
    sash.castShadow = true;
    torsoGroup.add(sash);

    const sashRidge = new THREE.Mesh(new THREE.TorusGeometry(0.312, 0.018, 8, 24), sashMat);
    sashRidge.rotation.x = Math.PI / 2;
    sashRidge.scale.set(1.02, 0.68, 1.0);
    sashRidge.position.set(0, -0.25, 0);
    torsoGroup.add(sashRidge);

    // Sash Knot & Double Hanging Tails
    const sashKnot = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), sashMat);
    sashKnot.position.set(-0.14, -0.26, 0.22);
    torsoGroup.add(sashKnot);

    const sashEnd1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.28, 6, 10), sashMat);
    sashEnd1.scale.set(1.1, 1.0, 0.35);
    sashEnd1.position.set(-0.15, -0.44, 0.23);
    sashEnd1.rotation.z = -0.15;
    torsoGroup.add(sashEnd1);

    const sashEnd2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.034, 0.20, 6, 10), sashMat);
    sashEnd2.scale.set(1.1, 1.0, 0.35);
    sashEnd2.position.set(-0.10, -0.40, 0.22);
    sashEnd2.rotation.z = -0.06;
    torsoGroup.add(sashEnd2);

    // Braided Coin Pouch / Money Bag & Hanging Bronze Cash Coin
    const pouchGroup = new THREE.Group();
    pouchGroup.position.set(0.21, -0.30, 0.19);
    const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.082, 12, 10), ropeMat);
    pouch.scale.set(1.0, 1.2, 0.8);
    pouchGroup.add(pouch);
    const pouchTie = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.016, 8, 14), sashMat);
    pouchTie.rotation.x = Math.PI / 2;
    pouchTie.position.y = 0.065;
    pouchGroup.add(pouchTie);

    const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.030, 0.008, 12), brassMat);
    coin.rotation.x = 0.3;
    coin.position.set(0.02, -0.11, 0.03);
    pouchGroup.add(coin);
    torsoGroup.add(pouchGroup);

    // 14.8.1 Articulated Capsule Arms, Seamless Deltoid Shoulders & Sculpted Hands
    // Right Arm: Reaching out and grasping the sculling oar handle (yuloh)
    const armRGroup = new THREE.Group();
    armRGroup.position.set(0.22, 0.25, 0.01);
    torsoGroup.add(armRGroup);

    const shoulderCapR = new THREE.Mesh(new THREE.SphereGeometry(0.068, 14, 12), tunicMat);
    shoulderCapR.scale.set(0.88, 0.72, 0.88);
    shoulderCapR.castShadow = true;
    armRGroup.add(shoulderCapR);

    const upperArmR = new THREE.Mesh(new THREE.CapsuleGeometry(0.064, 0.24, 8, 14), tunicMat);
    upperArmR.position.set(0.045, -0.12, 0.02);
    upperArmR.rotation.set(0.18, 0, 0.26);
    upperArmR.castShadow = true;
    armRGroup.add(upperArmR);

    const cuffR = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.015, 8, 16), tunicMat);
    cuffR.position.set(0.09, -0.24, 0.045);
    cuffR.rotation.set(Math.PI / 2 + 0.18, 0, 0.26);
    armRGroup.add(cuffR);

    const elbowSphR = new THREE.Mesh(new THREE.SphereGeometry(0.056, 12, 10), skinMat);
    elbowSphR.position.set(0.10, -0.27, 0.05);
    armRGroup.add(elbowSphR);

    const forearmR = new THREE.Mesh(new THREE.CapsuleGeometry(0.054, 0.24, 8, 14), skinMat);
    forearmR.position.set(0.16, -0.41, 0.08);
    forearmR.rotation.set(0.15, 0, 0.22);
    forearmR.castShadow = true;
    armRGroup.add(forearmR);

    // Sculpted Right Hand (Firmly wrapping around oar handle grip)
    const handRGroup = new THREE.Group();
    handRGroup.position.set(0.22, -0.55, 0.10);
    handRGroup.rotation.set(0.1, 0.15, -0.25);
    armRGroup.add(handRGroup);

    const palmR = new THREE.Mesh(new THREE.SphereGeometry(0.046, 12, 10), skinMat);
    palmR.scale.set(0.88, 0.58, 1.12);
    handRGroup.add(palmR);

    const thumbR = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.040, 4, 8), skinMat);
    thumbR.position.set(-0.040, 0.01, -0.01);
    thumbR.rotation.set(0.3, 0.2, 0.8);
    handRGroup.add(thumbR);

    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.010, 0.044, 4, 8), skinMat);
      finger.position.set(-0.026 + f * 0.018, -0.02, 0.036);
      finger.rotation.set(1.1, 0, 0);
      handRGroup.add(finger);
    }

    // Left Arm: Natural counter-balance posture resting near hip/sash
    const armLGroup = new THREE.Group();
    armLGroup.position.set(-0.22, 0.25, 0.01);
    torsoGroup.add(armLGroup);

    const shoulderCapL = new THREE.Mesh(new THREE.SphereGeometry(0.068, 14, 12), tunicMat);
    shoulderCapL.scale.set(0.88, 0.72, 0.88);
    shoulderCapL.castShadow = true;
    armLGroup.add(shoulderCapL);

    const upperArmL = new THREE.Mesh(new THREE.CapsuleGeometry(0.064, 0.24, 8, 14), tunicMat);
    upperArmL.position.set(-0.045, -0.12, 0.02);
    upperArmL.rotation.set(-0.10, 0, -0.24);
    upperArmL.castShadow = true;
    armLGroup.add(upperArmL);

    const cuffL = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.015, 8, 16), tunicMat);
    cuffL.position.set(-0.09, -0.24, 0.04);
    cuffL.rotation.set(Math.PI / 2 - 0.10, 0, -0.24);
    armLGroup.add(cuffL);

    const elbowSphL = new THREE.Mesh(new THREE.SphereGeometry(0.056, 12, 10), skinMat);
    elbowSphL.position.set(-0.10, -0.27, 0.045);
    armLGroup.add(elbowSphL);

    const forearmL = new THREE.Mesh(new THREE.CapsuleGeometry(0.054, 0.23, 8, 14), skinMat);
    forearmL.position.set(-0.13, -0.41, 0.085);
    forearmL.rotation.set(0.28, -0.14, -0.12);
    forearmL.castShadow = true;
    armLGroup.add(forearmL);

    // Sculpted Left Hand
    const handLGroup = new THREE.Group();
    handLGroup.position.set(-0.15, -0.55, 0.14);
    handLGroup.rotation.set(0.4, -0.2, 0.2);
    armLGroup.add(handLGroup);

    const palmL = new THREE.Mesh(new THREE.SphereGeometry(0.046, 12, 10), skinMat);
    palmL.scale.set(0.88, 0.58, 1.12);
    handLGroup.add(palmL);

    const thumbL = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.040, 4, 8), skinMat);
    thumbL.position.set(0.04, 0.01, -0.01);
    thumbL.rotation.set(0.2, -0.2, -0.7);
    handLGroup.add(thumbL);

    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.044, 4, 8), skinMat);
      finger.position.set(0.024 - f * 0.017, -0.015, 0.035);
      finger.rotation.set(0.5, 0, 0);
      handLGroup.add(finger);
    }

    // 14.9 Sculpted Weathered Maritime Head, Facial Contours, Mustache & Beard
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.88, 0);
    this.boatmanNPCGroup.add(headGroup);

    const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.084, 0.09, 8, 14), skinMat);
    neck.position.y = -0.14;
    headGroup.add(neck);

    const head = new THREE.Mesh(this.createSculptedHeadGeometry(0.23), skinMat);
    head.castShadow = true;
    headGroup.add(head);

    // Sculpted rounded supraorbital brow arches & eyes (zero BoxGeometry blocks!)
    const boatmanEyeMat = new THREE.MeshBasicMaterial({ color: 0x1a120a });
    for (const ex of [-0.072, 0.072]) {
      const browArch = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.055, 6, 10), mustacheMat);
      browArch.rotation.z = Math.PI / 2 + (ex > 0 ? -0.12 : 0.12);
      browArch.position.set(ex, 0.078, 0.205);
      headGroup.add(browArch);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 10), boatmanEyeMat);
      pupil.scale.set(1.0, 1.0, 0.55);
      pupil.position.set(ex, 0.035, 0.212);
      headGroup.add(pupil);
    }

    // Strong sculpted nose bridge & rounded nostrils
    const nose = new THREE.Mesh(new THREE.CapsuleGeometry(0.020, 0.054, 6, 10), skinMat);
    nose.position.set(0, 0.012, 0.228);
    nose.rotation.x = -0.16;
    headGroup.add(nose);

    const nostrils = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), skinMat);
    nostrils.scale.set(1.35, 0.65, 0.85);
    nostrils.position.set(0, -0.024, 0.228);
    headGroup.add(nostrils);

    // Ears & earlobes
    for (const ex of [-0.215, 0.215]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), skinMat);
      ear.scale.set(0.42, 1.15, 0.72);
      ear.position.set(ex, 0.01, -0.015);
      headGroup.add(ear);
    }

    // Sculpted Natural Silver-Grey Drooping Mustache & Tapered Goatee Beard
    for (const mx of [-0.044, 0.044]) {
      const stache = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.052, 6, 10), mustacheMat);
      stache.rotation.set(0.10, 0, mx > 0 ? 0.52 : -0.52);
      stache.position.set(mx, -0.056, 0.214);
      headGroup.add(stache);
    }

    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.24, 16), mustacheMat);
    beard.scale.set(0.95, 1.0, 0.72);
    beard.rotation.x = Math.PI - 0.22;
    beard.position.set(0, -0.18, 0.145);
    headGroup.add(beard);

    // 14.10 Woven Bamboo Conical Sun Hat (斗笠) with Inner Ribs & Head-Ring
    const hatGroup = new THREE.Group();
    hatGroup.position.set(0, 2.06, 0);
    this.boatmanNPCGroup.add(hatGroup);

    // Wide Flared Bamboo Woven Outer Cone
    const hatMat = new THREE.MeshStandardMaterial({
      map: getWovenBambooTexture(),
      roughness: 0.82
    });
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.78, 0.28, 24), hatMat);
    hat.castShadow = true;
    hatGroup.add(hat);

    // Outer brim reinforcement rim
    const brimRim = new THREE.Mesh(new THREE.TorusGeometry(0.77, 0.014, 6, 24), ribMat);
    brimRim.rotation.x = Math.PI / 2;
    brimRim.position.y = -0.138;
    hatGroup.add(brimRim);

    // Top Bamboo Finial Cap
    const hatFinial = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), oarMat);
    hatFinial.position.y = 0.15;
    hatGroup.add(hatFinial);

    // Underside Inner Head-Ring (crown hoop fitting securely atop head)
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.018, 6, 16), ribMat);
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = -0.05;
    hatGroup.add(innerRing);

    // 8 Radiating Bamboo Ribs on Hat Underside linking inner ring to brim edge
    for (let r = 0; r < 8; r++) {
      const ribAngle = (r / 8) * Math.PI * 2;
      const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.52, 4), ribMat);
      const midRad = 0.38;
      rib.position.set(
        Math.cos(ribAngle) * midRad,
        -0.02,
        Math.sin(ribAngle) * midRad
      );
      rib.rotation.y = -ribAngle;
      rib.rotation.z = Math.PI / 2 - 0.345;
      hatGroup.add(rib);
    }

    // Hat Chin String Tie with Jaw Knot & Dangling Cord Ends
    const chinString = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.015, 6, 16, Math.PI), ropeMat);
    chinString.rotation.set(-Math.PI / 2, 0, 0);
    chinString.position.set(0, -0.22, 0.05);
    hatGroup.add(chinString);

    const chinKnot = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 6), ropeMat);
    chinKnot.position.set(0, -0.40, 0.08);
    hatGroup.add(chinKnot);

    for (const dx of [-0.015, 0.015]) {
      const chinEnd = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.003, 0.14, 4), ropeMat);
      chinEnd.position.set(dx, -0.47, 0.085);
      chinEnd.rotation.z = dx > 0 ? -0.15 : 0.15;
      hatGroup.add(chinEnd);
    }

    // 14.11 Traditional Hand-Carved Sculling Oar (橹 / Yuloh)
    const oarGroup = new THREE.Group();
    oarGroup.position.set(0.58, 1.2, 0.12);
    oarGroup.rotation.z = -0.25;

    // Loom shaft
    const oarShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 2.4, 10), oarMat);
    oarShaft.castShadow = true;
    oarGroup.add(oarShaft);

    // Rounded handle grip (wrapped hemp texture)
    const handleGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 8), ropeMat);
    handleGrip.position.y = 1.1;
    oarGroup.add(handleGrip);

    // Rope binding around oar fulcrum pivot
    for (let b = 0; b < 4; b++) {
      const binding = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.018, 6, 12), ropeMat);
      binding.rotation.x = Math.PI / 2;
      binding.position.y = 0.3 + b * 0.04;
      oarGroup.add(binding);
    }

    // Carved oar blade with copper edge reinforcement strip
    const oarBlade = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 0.038), oarMat);
    oarBlade.position.set(0.08, -0.85, 0);
    oarBlade.castShadow = true;
    oarGroup.add(oarBlade);

    const bladeReinforce = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 0.042), brassMat);
    bladeReinforce.position.set(0.08, -1.22, 0);
    oarGroup.add(bladeReinforce);

    this.boatmanNPCGroup.add(oarGroup);

    // 14.12 Pier Timber Lamp Pole & Hurricane Storm Lantern
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 8), oarMat);
    pole.position.set(-0.6, 1.1, -0.4);
    pole.castShadow = true;
    this.boatmanNPCGroup.add(pole);

    // Curved iron crane hook arm
    const craneArm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8), brassMat);
    craneArm.position.set(-0.45, 2.2, -0.25);
    craneArm.rotation.set(0.4, 0, -Math.PI / 3);
    this.boatmanNPCGroup.add(craneArm);

    // Authentic Hurricane Marine Storm Lantern
    const lanternGroup = new THREE.Group();
    lanternGroup.position.set(-0.42, 1.95, -0.15);

    // Brass oil reservoir base
    const lanternBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.14, 10), brassMat);
    lanternGroup.add(lanternBase);

    // Clear glass chimney globe with incandescent flame
    const glassGlobe = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 10),
      new THREE.MeshStandardMaterial({
        color: 0xfff0c2,
        roughness: 0.1,
        transparent: true,
        opacity: 0.65
      })
    );
    glassGlobe.position.y = 0.16;
    lanternGroup.add(glassGlobe);

    // Glowing incandescent wick flame inside
    const wickFlame = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffaa22 }));
    wickFlame.position.y = 0.16;
    lanternGroup.add(wickFlame);

    // Brass protective cage bars
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
      const cageBar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 6), brassMat);
      cageBar.position.set(Math.cos(a) * 0.15, 0.16, Math.sin(a) * 0.15);
      lanternGroup.add(cageBar);
    }

    // Vented brass cap & bail handle
    const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.12, 10), brassMat);
    lanternCap.position.y = 0.34;
    lanternGroup.add(lanternCap);

    const bailHandle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.015, 6, 12, Math.PI), brassMat);
    bailHandle.position.y = 0.4;
    lanternGroup.add(bailHandle);

    this.boatmanNPCGroup.add(lanternGroup);

    const lanternGlow = new THREE.PointLight(0xff9900, 1.4, 6.5);
    lanternGlow.position.set(-0.42, 2.1, -0.15);
    this.boatmanNPCGroup.add(lanternGlow);
    this.pointLights.push(lanternGlow);
    this.lampLights.push(lanternGlow);

    // Floating Interaction Beacon Star (Crucial: Keep name = "beacon")
    const beaconGeo = new THREE.OctahedronGeometry(0.16, 0);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xffd275,
      transparent: true,
      opacity: 0.85
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, 2.82, 0);
    beacon.name = "beacon";
    this.boatmanNPCGroup.add(beacon);

    this.root.add(this.boatmanNPCGroup);
  }

  /* -------------------------------------------------------------- */
  /* 14.5 Living Miniature World Life Scenes (M2)                   */
  /* -------------------------------------------------------------- */
  private buildLifeScenes() {
    this.lifeScenes = new World3DLifeScenes();
    this.root.add(this.lifeScenes.root);
  }

  /* -------------------------------------------------------------- */
  /* 15. Ambient Atmosphere Particles (Golden Sun Dust & Fireflies) */
  /* -------------------------------------------------------------- */
  private buildAtmosphereParticles() {
    const softParticleTex = getSoftParticleTexture();
    // 15.1 Nighttime Fireflies
    const fireflyCount = 110;
    const fireflyGeo = new THREE.BufferGeometry();
    const fireflyPositions = new Float32Array(fireflyCount * 3);
    for (let i = 0; i < fireflyCount; i++) {
      fireflyPositions[i * 3] = (Math.random() - 0.5) * 48;
      fireflyPositions[i * 3 + 1] = 0.8 + Math.random() * 6.0;
      fireflyPositions[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    fireflyGeo.setAttribute("position", new THREE.BufferAttribute(fireflyPositions, 3));
    const fireflyMat = new THREE.PointsMaterial({
      map: softParticleTex,
      color: 0xffd685,
      size: 0.20,
      transparent: true,
      opacity: 0.55,
      alphaTest: 0.04,
      depthWrite: false
    });
    this.fireflies = new THREE.Points(fireflyGeo, fireflyMat);
    this.root.add(this.fireflies);

    // 15.2 Golden Sun Motes (Warm Sunlight Dust, 100 points)
    const moteCount = 100;
    const moteGeo = new THREE.BufferGeometry();
    this.sunMotesPositions = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      this.sunMotesPositions[i * 3] = (Math.random() - 0.5) * 50;
      this.sunMotesPositions[i * 3 + 1] = 0.8 + Math.random() * 7.5;
      this.sunMotesPositions[i * 3 + 2] = (Math.random() - 0.5) * 44;
    }
    moteGeo.setAttribute("position", new THREE.BufferAttribute(this.sunMotesPositions, 3));
    const moteMat = new THREE.PointsMaterial({
      map: softParticleTex,
      color: 0xffe49e,
      size: 0.18,
      transparent: true,
      opacity: 0.65,
      alphaTest: 0.04,
      depthWrite: false
    });
    this.sunMotes = new THREE.Points(moteGeo, moteMat);
    this.root.add(this.sunMotes);
  }

  /* -------------------------------------------------------------- */
  /* 16. Natural Time of Day Lighting Engine                       */
  /* -------------------------------------------------------------- */
  public setupLighting(time: TimeOfDay) {
    const isInitial = !this.sunLight;
    if (isInitial) {
      this.sunLight = new THREE.DirectionalLight(0xffd285, 2.4);
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.width = 2048;
      this.sunLight.shadow.mapSize.height = 2048;
      this.sunLight.shadow.camera.near = 0.5;
      this.sunLight.shadow.camera.far = 130;
      this.sunLight.shadow.camera.left = -32;
      this.sunLight.shadow.camera.right = 32;
      this.sunLight.shadow.camera.top = 32;
      this.sunLight.shadow.camera.bottom = -32;
      this.sunLight.shadow.normalBias = 0.02;
      this.sunLight.shadow.radius = 2.5;
      this.sunLight.shadow.bias = -0.0005;
      this.root.add(this.sunLight);

      this.ambientLight = new THREE.AmbientLight(0x283b38, 1.2);
      this.root.add(this.ambientLight);

      this.hemisphereLight = new THREE.HemisphereLight(0xffecd2, 0x182424, 0.9);
      this.root.add(this.hemisphereLight);
    }

    if (time === "dusk") {
      this.targetLighting.sunColor.setHex(0xffb46e);
      this.targetLighting.sunIntensity = 3.8;
      this.targetLighting.sunPosition.set(28, 22, -24);
      this.targetLighting.ambientColor.setHex(0x66584e);
      this.targetLighting.ambientIntensity = 2.05;
      this.targetLighting.hemisphereColor.setHex(0xffdfba);
      this.targetLighting.hemisphereGroundColor.setHex(0x465254);
      this.targetLighting.hemisphereIntensity = 1.65;
      this.targetLighting.lampIntensity = 1.85;
      this.targetLighting.fogColor.setHex(0x161822);
      this.targetLighting.fogDensity = 0.0055;
      this.targetLighting.fireflyOpacity = 0.45;
      this.targetLighting.sunMotesOpacity = 0.65;
    } else if (time === "night") {
      this.targetLighting.sunColor.setHex(0x5a7ebb);
      this.targetLighting.sunIntensity = 1.15;
      this.targetLighting.sunPosition.set(-18, 22, -18);
      this.targetLighting.ambientColor.setHex(0x20303c);
      this.targetLighting.ambientIntensity = 1.35;
      this.targetLighting.hemisphereColor.setHex(0x325066);
      this.targetLighting.hemisphereGroundColor.setHex(0x142228);
      this.targetLighting.hemisphereIntensity = 1.15;
      this.targetLighting.lampIntensity = 2.4;
      this.targetLighting.fogColor.setHex(0x0a1018);
      this.targetLighting.fogDensity = 0.0065;
      this.targetLighting.fireflyOpacity = 0.9;
      this.targetLighting.sunMotesOpacity = 0.0;
    } else {
      // dawn
      this.targetLighting.sunColor.setHex(0xffecd0);
      this.targetLighting.sunIntensity = 3.4;
      this.targetLighting.sunPosition.set(-24, 20, 20);
      this.targetLighting.ambientColor.setHex(0x52605b);
      this.targetLighting.ambientIntensity = 1.9;
      this.targetLighting.hemisphereColor.setHex(0xf0f7f5);
      this.targetLighting.hemisphereGroundColor.setHex(0x30403c);
      this.targetLighting.hemisphereIntensity = 1.55;
      this.targetLighting.lampIntensity = 1.1;
      this.targetLighting.fogColor.setHex(0x1c2228);
      this.targetLighting.fogDensity = 0.005;
      this.targetLighting.fireflyOpacity = 0.0;
      this.targetLighting.sunMotesOpacity = 0.85;
    }

    if (isInitial) {
      this.sunLight.color.copy(this.targetLighting.sunColor);
      this.sunLight.intensity = this.targetLighting.sunIntensity;
      this.sunLight.position.copy(this.targetLighting.sunPosition);
      this.ambientLight.color.copy(this.targetLighting.ambientColor);
      this.ambientLight.intensity = this.targetLighting.ambientIntensity;
      this.hemisphereLight.color.copy(this.targetLighting.hemisphereColor);
      this.hemisphereLight.groundColor.copy(this.targetLighting.hemisphereGroundColor);
      this.hemisphereLight.intensity = this.targetLighting.hemisphereIntensity;
      this.lampLights.forEach((light) => {
        light.intensity = this.targetLighting.lampIntensity;
      });
      if (this.fireflies) {
        (this.fireflies.material as THREE.PointsMaterial).opacity = this.targetLighting.fireflyOpacity;
      }
      if (this.sunMotes) {
        (this.sunMotes.material as THREE.PointsMaterial).opacity = this.targetLighting.sunMotesOpacity;
      }
    }
    if (this.skyDomeMesh && this.skyTextures) {
      this.skyDomeMesh.material.map = this.skyTextures[time];
      this.skyDomeMesh.material.needsUpdate = true;
    }
  }

  /* -------------------------------------------------------------- */
  /* 17. Interactive Landmark Triggers                              */
  /* -------------------------------------------------------------- */
  private setupLandmarkTriggers() {
    this.landmarks = [
      {
        id: "curator",
        nameZh: "林馆长 (国家历史博物馆)",
        nameEn: "Curator Lin (Museum Director)",
        position: new THREE.Vector3(-16, 1.0, -7),
        radius: 3.2,
        beaconColor: 0xffd685
      },
      {
        id: "boatman",
        nameZh: "驳船老船夫 (新加坡河码头)",
        nameEn: "Old Boatman (River Pier)",
        position: new THREE.Vector3(0, 0.8, -2.4),
        radius: 3.2,
        beaconColor: 0xff9900
      },
      {
        id: "badang-stone",
        nameZh: "巴当巨石遗址",
        nameEn: "Badang Megalith",
        position: new THREE.Vector3(-6, 1.0, -8),
        radius: 3.5,
        beaconColor: 0xd1a95d
      },
      {
        id: "rune-plaque",
        nameZh: "狮门古文字碑",
        nameEn: "Ancient Rune Plaque",
        position: new THREE.Vector3(9, 1.0, -8),
        radius: 3.5,
        beaconColor: 0x3de0c8
      },
      {
        id: "harbor-seal",
        nameZh: "海门机关要塞",
        nameEn: "Harbor Astrolabe Gate",
        position: new THREE.Vector3(18, 1.0, 3.0),
        radius: 4.2,
        beaconColor: 0xffaa44
      },
      {
        id: "spirit-chime",
        nameZh: "灵界清音入口",
        nameEn: "Spirit Realm Gateway",
        position: new THREE.Vector3(-14, 1.0, 16),
        radius: 4.0,
        beaconColor: 0x3de0c8
      },
      {
        id: "museum",
        nameZh: "新加坡历史博物馆",
        nameEn: "National History Museum",
        position: new THREE.Vector3(-20, 1.0, -10),
        radius: 4.5,
        beaconColor: 0xffd685
      },
      {
        id: "merlion",
        nameZh: "鱼尾狮喷泉圣像",
        nameEn: "Merlion Fountain",
        position: new THREE.Vector3(16, 1.0, -10),
        radius: 3.8,
        beaconColor: 0x80e5ff
      },
      {
        id: "hop-hing",
        nameZh: "合兴茶庄 (百年茗茶)",
        nameEn: "Hop Hing Tea House (Heritage Teahouse)",
        position: new THREE.Vector3(6.20, 1.20, 14.00),
        radius: 3.2,
        beaconColor: 0xa8525b,
        promptZh: "探查五脚基茶客品茗与宋代青瓷器具",
        promptEn: "Inspect five-foot-way tea guests & antique celadon ware",
        actionZh: "细细观赏",
        actionEn: "Inspect",
        investigation: {
          targetDistance: 5.2,
          targetPolar: 1.25,
          targetOffset: new THREE.Vector3(0, 0.35, 0)
        }
      },
      {
        id: "guan-huat",
        nameZh: "源发香料行 (传统香料)",
        nameEn: "Guan Huat Spice Merchant (Traditional Spice)",
        position: new THREE.Vector3(-6.20, 1.20, 14.00),
        radius: 3.2,
        beaconColor: 0x3d7a6e,
        promptZh: "探查南洋传统肉豆蔻、胡椒与香料麻袋",
        promptEn: "Inspect traditional nutmeg, pepper & spice sacks",
        actionZh: "细细观赏",
        actionEn: "Inspect",
        investigation: {
          targetDistance: 5.2,
          targetPolar: 1.25,
          targetOffset: new THREE.Vector3(0, 0.35, 0)
        }
      }
    ];
  }

  /**
   * Synchronize narrative and puzzle progression with 3D landmark visual cues.
   * Completely allocation-free: performs in-place property mutations and color updates.
   */
  public setProgressionState(
    completedIds: string[] = [],
    ritualComplete = false,
    museumComplete = false
  ): void {
    const badangRestored = completedIds.includes("badang-stone") || completedIds.includes("jigsaw");
    const runeRestored = completedIds.includes("rune-plaque") || completedIds.includes("runes");
    const harborRestored = completedIds.includes("harbor-seal") || completedIds.includes("lock");
    const spiritRestored = ritualComplete || completedIds.includes("spirit-chime") || completedIds.includes("rhythm");

    let restoredCount = 0;
    if (badangRestored) restoredCount++;
    if (runeRestored) restoredCount++;
    if (harborRestored) restoredCount++;
    if (spiritRestored) restoredCount++;

    const museumReady = restoredCount >= 4 || museumComplete;
    const museumRestored = !!museumComplete;

    this.applyCueState(this.badangCue, badangRestored ? "restored" : "pending");
    this.applyCueState(this.runeCue, runeRestored ? "restored" : "pending");
    this.applyCueState(this.harborCue, harborRestored ? "restored" : "pending");
    this.applyCueState(this.spiritCue, spiritRestored ? "restored" : "pending");
    this.applyCueState(this.museumCue, museumRestored ? "restored" : (museumReady ? "ready" : "pending"));
  }

  private applyCueState(cue: LandmarkCueRecord, status: LandmarkVisualStatus): void {
    if (!cue) return;
    cue.status = status;
    const isRestored = status === "restored";
    const isReady = status === "ready";

    let starColor = cue.pendingBeaconColor;
    let ringColor = cue.pendingBeaconColor;

    if (isRestored) {
      starColor = cue.restoredBeaconColor;
      ringColor = cue.restoredBeaconColor;
    } else if (isReady && cue.readyBeaconColor) {
      starColor = cue.readyBeaconColor;
      ringColor = cue.readyBeaconColor;
    }

    cue.beaconStar.material.color.setHex(starColor);
    cue.beaconRing.material.color.setHex(ringColor);

    if (cue.secondaryRing) {
      const secColor = (isRestored || isReady) ? 0xffaa22 : (cue.id === "harbor-seal" ? 0xb8860b : 0xe8c878);
      cue.secondaryRing.material.color.setHex(secColor);
    }

    if (cue.id === "museum") {
      const targetScale = (isRestored || isReady) ? 1.35 : 0.95;
      cue.beaconStar.scale.setScalar(targetScale);
    }

    // Keep landmark trigger metadata synchronized for UI/compass/HUD consumers
    for (let i = 0; i < this.landmarks.length; i++) {
      if (this.landmarks[i].id === cue.id) {
        this.landmarks[i].beaconColor = starColor;
        break;
      }
    }

    // Static color updates for accent materials & lights
    if (cue.id === "badang-stone") {
      if (this.badangAltarLight) {
        this.badangAltarLight.color.setHex(isRestored ? 0xffd700 : 0xffb84d);
      }
    } else if (cue.id === "rune-plaque") {
      if (this.runeSteleJewelMat) {
        this.runeSteleJewelMat.emissive.setHex(isRestored ? 0x3de0c8 : 0x221100);
      }
      for (let b = 0; b < this.runeBrazierLights.length; b++) {
        this.runeBrazierLights[b].color.setHex(isRestored ? 0xffaa44 : 0xff7722);
      }
    } else if (cue.id === "harbor-seal") {
      if (this.harborRubyLight) {
        this.harborRubyLight.color.setHex(isRestored ? 0xff2255 : 0xff2244);
      }
    } else if (cue.id === "spirit-chime") {
      if (this.spiritVortex && this.spiritVortex.material instanceof THREE.PointsMaterial) {
        this.spiritVortex.material.color.setHex(isRestored ? 0x66ffcc : 0x3de0c8);
      }
      if (this.spiritPortalLight) {
        this.spiritPortalLight.color.setHex(isRestored ? 0x55ffd8 : 0x3de0c8);
      }
    } else if (cue.id === "museum") {
      if (this.museumInteriorLight) {
        this.museumInteriorLight.color.setHex((isRestored || isReady) ? 0xffd700 : 0xffb84d);
      }
    }
  }

  /**
   * Procedural landmark visual cues animation tick.
   * STRICT ZERO ALLOCATION INVARIANT: Pure scalar arithmetic, no `new THREE.*` calls.
   */
  private updateLandmarkCues(time: number, delta: number): void {
    const cueCount = this.landmarkCueRecords.length;
    for (let i = 0; i < cueCount; i++) {
      const cue = this.landmarkCueRecords[i];
      const isRestored = cue.status === "restored";
      const isReady = cue.status === "ready";
      const effectiveSpin = (isRestored || isReady) ? cue.spinSpeed * 1.7 : cue.spinSpeed;

      // Rotate beacon star
      cue.beaconStar.rotation.y += delta * effectiveSpin;
      const bobAmp = (isRestored || isReady) ? 0.12 : 0.08;
      const bobFreq = (isRestored || isReady) ? 3.6 : 3.0;
      const currentY = cue.baseY + Math.sin(time * bobFreq + cue.bobPhase) * bobAmp;
      cue.beaconStar.position.y = currentY;

      // Orbit concentric / tilted ring
      cue.beaconRing.position.y = currentY;
      cue.beaconRing.rotation.x += delta * (effectiveSpin * 0.7);
      cue.beaconRing.rotation.z += delta * (effectiveSpin * 0.5);

      // Orbit secondary ring if present
      if (cue.secondaryRing) {
        cue.secondaryRing.position.y = currentY;
        cue.secondaryRing.rotation.x -= delta * (effectiveSpin * 0.6);
        cue.secondaryRing.rotation.y += delta * (effectiveSpin * 0.8);
      }
    }

    // Specific landmark state-driven animations
    // 1. Badang Megalith (Kintsugi gold veins pulse & sacred mandala rings counter-rotate)
    if (this.badangGoldVeinMat) {
      if (this.badangCue && this.badangCue.status === "restored") {
        this.badangGoldVeinMat.emissiveIntensity = 0.75 + Math.sin(time * 3.2) * 0.25;
        if (this.badangAltarLight) {
          this.badangAltarLight.intensity = 2.0 + Math.sin(time * 2.8) * 0.35;
        }
        if (this.badangRuneCircleOuter && this.badangRuneCircleInner) {
          this.badangRuneCircleOuter.rotation.z += delta * 0.18;
          this.badangRuneCircleInner.rotation.z -= delta * 0.24;
        }
      } else {
        this.badangGoldVeinMat.emissiveIntensity = 0.25;
        if (this.badangAltarLight) {
          this.badangAltarLight.intensity = 1.35;
        }
      }
    }

    // 2. Ancient Rune Plaque (Jewel orb luminescence & incense embers shimmer)
    if (this.runeSteleJewelMat) {
      if (this.runeCue && this.runeCue.status === "restored") {
        this.runeSteleJewelMat.emissiveIntensity = 0.80 + Math.sin(time * 3.5) * 0.25;
        for (let b = 0; b < this.runeBrazierLights.length; b++) {
          this.runeBrazierLights[b].intensity = 1.85 + Math.sin(time * 3.0 + b) * 0.25;
        }
      } else {
        this.runeSteleJewelMat.emissiveIntensity = 0.10;
        for (let b = 0; b < this.runeBrazierLights.length; b++) {
          this.runeBrazierLights[b].intensity = 1.25;
        }
      }
    }

    // 3. Harbor Gate (Star ruby harmonic pulse & accelerated astrolabe gears)
    if (this.harborRubyMat) {
      if (this.harborCue && this.harborCue.status === "restored") {
        this.harborRubyMat.emissiveIntensity = 0.85 + Math.sin(time * 4.2) * 0.35;
        if (this.harborRubyLight) {
          this.harborRubyLight.intensity = 1.8 + Math.sin(time * 4.2) * 0.55;
        }
        for (let g = 0; g < this.harborGears.length; g++) {
          this.harborGears[g].rotation.z += (g === 0 ? 0.70 : -1.05) * delta;
        }
      } else {
        this.harborRubyMat.emissiveIntensity = 0.60;
        if (this.harborRubyLight) {
          this.harborRubyLight.intensity = 1.20;
        }
        for (let g = 0; g < this.harborGears.length; g++) {
          this.harborGears[g].rotation.z += (g === 0 ? 0.35 : -0.55) * delta;
        }
      }
    }

    // 4. Spirit Gateway (Swirling vortex particles accelerated & golden-teal aurora)
    if (this.spiritVortex) {
      if (this.spiritCue && this.spiritCue.status === "restored") {
        this.spiritVortex.rotation.y += delta * 1.6;
        if (this.spiritPortalLight) {
          this.spiritPortalLight.intensity = 2.6 + Math.sin(time * 3.0) * 0.35;
        }
      } else {
        this.spiritVortex.rotation.y += delta * 0.8;
        if (this.spiritPortalLight) {
          this.spiritPortalLight.intensity = 1.85;
        }
      }
    }

    // 5. Colonial Museum (Triumphant gallery glow & cupola radiance)
    if (this.museumInteriorLight) {
      if (this.museumCue && (this.museumCue.status === "restored" || this.museumCue.status === "ready")) {
        this.museumInteriorLight.intensity = 3.0 + Math.sin(time * 2.2) * 0.40;
      } else {
        this.museumInteriorLight.intensity = 1.80;
      }
    }
  }

  /* -------------------------------------------------------------- */
  /* 18. Animation Loop Updates                                     */
  /* -------------------------------------------------------------- */
  public update(time: number, delta: number) {
    // Tropical breeze modulation: w(t) = sin(1.1t) * 0.7 + sin(2.4t + 0.6) * 0.3
    const breeze = Math.sin(1.1 * time) * 0.7 + Math.sin(2.4 * time + 0.6) * 0.3;

    // 1. Hydrodynamic River System Gerstner wave displacement & optical depth
    if (this.waterMesh && this.waterBasePositions) {
      this.hydroSystem.update(time, delta);
      const pos = this.waterGeo.attributes.position;
      const colAttr = this.waterGeo.attributes.color as THREE.BufferAttribute | undefined;
      const count = pos.count;

      for (let i = 0; i < count; i++) {
        const u = this.waterBasePositions[i * 3];
        const v = this.waterBasePositions[i * 3 + 1];
        // Coordinate transform: u = x + 4.0 => x0 = u - 4.0; v = 2.5 - z => z0 = 2.5 - v
        const x0 = u - 4.0;
        const z0 = 2.5 - v;

        this.hydroSystem.computeDisplacement(x0, z0, time, this.scratchHydroDisp);

        // Trochoidal horizontal and vertical displacements
        pos.setXYZ(
          i,
          u + this.scratchHydroDisp.x,
          v - this.scratchHydroDisp.z,
          this.scratchHydroDisp.y
        );

        if (colAttr) {
          const depth = (this.hydroSystem.baseElevation + this.scratchHydroDisp.y) - (-0.45);
          this.hydroSystem.computeDepthColor(depth, this.scratchHydroColor);
          const foam = this.hydroSystem.computeFoam(x0, z0, time);
          if (foam > 0.01) {
            this.scratchHydroColor.lerp(this.scratchWhiteColor, foam * 0.85);
          }
          colAttr.setXYZ(i, this.scratchHydroColor.r, this.scratchHydroColor.g, this.scratchHydroColor.b);
        }
      }
      pos.needsUpdate = true;
      if (colAttr) colAttr.needsUpdate = true;
      if (!this.softwareRenderMode || ((++this.waterNormalFrame & 7) === 0)) {
        this.waterGeo.computeVertexNormals();
      }

      if (this.riverBedCausticsTexture) {
        this.riverBedCausticsTexture.offset.x = (time * 0.04) % 1.0;
        this.riverBedCausticsTexture.offset.y = (time * 0.02) % 1.0;
      }
    }

    // 2. Lotus lily pads gentle drift
    for (let i = 0; i < this.lotusPads.length; i++) {
      const pad = this.lotusPads[i];
      pad.position.y = 0.22 + Math.sin(time * 1.4 + i) * 0.02;
      pad.rotation.y += delta * 0.05 * (i % 2 === 0 ? 1 : -1);
    }

    // 3. Merlion cascading water jet particles
    if (this.merlionWaterParticles) {
      const positions = this.merlionWaterParticles.geometry.attributes.position.array as Float32Array;
      const count = positions.length / 3;
      for (let i = 0; i < count; i++) {
        const t = (time * 0.85 + i / count) % 1.0;
        positions[i * 3] = Math.sin(time * 3 + i) * 0.12;
        positions[i * 3 + 1] = 5.0 - t * t * 4.8;
        positions[i * 3 + 2] = 1.4 + t * 8.2;
      }
      this.merlionWaterParticles.geometry.attributes.position.needsUpdate = true;
    }

    // 3.1 Merlion splash ring pulse
    if (this.merlionSplashRing) {
      const scale = 1.0 + Math.sin(time * 4) * 0.2;
      this.merlionSplashRing.scale.set(scale, scale, 1);
    }

    // 3.2 Merlion spray mist expanding around splash ring (80 points)
    if (this.merlionSprayMist) {
      const count = 80;
      for (let i = 0; i < count; i++) {
        const phase = (this.merlionMistPhases[i] + delta * 0.85) % 1.0;
        this.merlionMistPhases[i] = phase;
        const angle = (i / count) * Math.PI * 2 + (i % 5) * 0.35;
        const r = 0.4 + phase * 2.2;
        const driftX = Math.sin(time * 1.2) * 0.25 * phase;
        this.merlionMistPositions[i * 3] = Math.cos(angle) * r + driftX;
        this.merlionMistPositions[i * 3 + 1] = 0.1 + Math.sin(phase * Math.PI) * 0.95;
        this.merlionMistPositions[i * 3 + 2] = 9.4 + Math.sin(angle) * r;
      }
      this.merlionSprayMist.geometry.attributes.position.needsUpdate = true;
    }

    // 4. Floating lanterns bobbing, finite difference surface tilt, circular tether drift
    const lanternCount = this.floatingLanterns.length;
    for (let i = 0; i < lanternCount; i++) {
      const lantern = this.floatingLanterns[i];
      const base = this.lanternBasePositions[i] || { x: lantern.position.x, z: lantern.position.z };
      const driftRadius = 0.22;
      const driftSpeed = 0.75;
      const lx = base.x + Math.sin(time * driftSpeed + i * 1.2) * driftRadius;
      const lz = base.z + Math.cos(time * (driftSpeed * 0.85) + i * 1.2) * (driftRadius * 0.7);
      lantern.position.x = lx;
      lantern.position.z = lz;

      const waterY = getRiverWaveElevation(lx, lz, time);
      const targetY = waterY + 0.05;
      lantern.position.y = THREE.MathUtils.lerp(lantern.position.y, targetY, Math.min(1.0, delta * 5.0));

      const eps = 0.25;
      const hX1 = getRiverWaveElevation(lx + eps, lz, time);
      const hX0 = getRiverWaveElevation(lx - eps, lz, time);
      const hZ1 = getRiverWaveElevation(lx, lz + eps, time);
      const hZ0 = getRiverWaveElevation(lx, lz - eps, time);
      const tiltZ = Math.atan((hX1 - hX0) / (2 * eps));
      const tiltX = -Math.atan((hZ1 - hZ0) / (2 * eps));
      lantern.rotation.z = THREE.MathUtils.lerp(lantern.rotation.z, tiltZ, Math.min(1.0, delta * 4.0));
      lantern.rotation.x = THREE.MathUtils.lerp(lantern.rotation.x, tiltX, Math.min(1.0, delta * 4.0));
    }

    // 4.1 Organic Candle Flame Flicker & Light Modulation
    for (let i = 0; i < this.lanternFlames.length; i++) {
      const fl = this.lanternFlames[i];
      const lt = this.lanternLights[i];
      const jitter = 1.0 + Math.sin(time * 15.0 + i * 2.3) * 0.18 + Math.cos(time * 24.0 + i) * 0.12;
      fl.scale.set(1.0 + Math.sin(time * 11.0 + i) * 0.14, jitter, 1.0);
      if (lt) {
        lt.intensity = 0.85 * (1.0 + Math.sin(time * 13.0 + i * 3.1) * 0.22);
      }
    }

    // 5. Dynamic Bumboat Buoyancy & Wave Pitch/Roll (4-point sampling) with Stream Surge Drift
    const hullLength = 4.8;
    const hullWidth = 1.6;
    const draftOffset = 0.15;
    const dampFactor = Math.min(1.0, delta * 4.0);

    for (let i = 0; i < this.sampanBoats.length; i++) {
      const boat = this.sampanBoats[i];
      const base = this.bumboatBasePositions[i] || { x: boat.position.x, z: boat.position.z, yaw: boat.rotation.y };
      const surge = Math.sin(time * 0.45 + i * 1.5) * 0.08 + 0.06;
      const sway = Math.cos(time * 0.35 + i * 1.1) * 0.04;
      boat.position.x = base.x + surge;
      boat.position.z = base.z + sway;
      const yawSway = Math.sin(time * 0.38 + i * 1.7) * 0.025;
      boat.rotation.y = base.yaw + yawSway;

      const bx = boat.position.x;
      const bz = boat.position.z;
      const yaw = boat.rotation.y;

      const sinYaw = Math.sin(yaw);
      const cosYaw = Math.cos(yaw);

      // Support points half-spans: 0.4 * L and 0.4 * W
      const halfL = 0.4 * hullLength;
      const halfW = 0.4 * hullWidth;

      // Bow: local (0, +halfL)
      const xBow = bx + halfL * sinYaw;
      const zBow = bz + halfL * cosYaw;

      // Stern: local (0, -halfL)
      const xStern = bx - halfL * sinYaw;
      const zStern = bz - halfL * cosYaw;

      // Starboard (+X): local (+halfW, 0)
      const xStbd = bx + halfW * cosYaw;
      const zStbd = bz - halfW * sinYaw;

      // Port (-X): local (-halfW, 0)
      const xPort = bx - halfW * cosYaw;
      const zPort = bz + halfW * sinYaw;

      const hBow = getRiverWaveElevation(xBow, zBow, time);
      const hStern = getRiverWaveElevation(xStern, zStern, time);
      const hPort = getRiverWaveElevation(xPort, zPort, time);
      const hStbd = getRiverWaveElevation(xStbd, zStbd, time);

      // Pitch angle: high bow tilts bow up (negative rotation around local X)
      const targetPitch = -Math.atan((hBow - hStern) / (0.8 * hullLength));
      // Roll angle: high starboard tilts starboard up (positive rotation around local Z)
      const targetRoll = Math.atan((hStbd - hPort) / (0.8 * hullWidth));

      // Center elevation derived from 4 points + draft offset
      const hCenter = (hBow + hStern + hPort + hStbd) / 4.0;
      const targetY = hCenter + draftOffset;

      boat.position.y = THREE.MathUtils.lerp(boat.position.y, targetY, dampFactor);
      boat.rotation.x = THREE.MathUtils.lerp(boat.rotation.x, targetPitch, dampFactor);
      boat.rotation.z = THREE.MathUtils.lerp(boat.rotation.z, targetRoll, dampFactor);
    }

    // 5.1 Dynamic Physical Mooring Catenary Ropes with Water Floor
    const ropeSegs = 8;
    for (let i = 0; i < this.mooringRopes.length; i++) {
      const rope = this.mooringRopes[i];
      const boat = this.sampanBoats[rope.boatIdx];
      if (!boat) continue;

      World3DEnvironment.SCRATCH_BITT_WORLD.copy(rope.bittLocal);
      World3DEnvironment.SCRATCH_BITT_WORLD.applyEuler(boat.rotation);
      World3DEnvironment.SCRATCH_BITT_WORLD.add(boat.position);

      const p0 = World3DEnvironment.SCRATCH_BITT_WORLD;
      const p1 = rope.anchorWorld;

      const dx = p1.x - p0.x;
      const dz = p1.z - p0.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const slack = Math.max(0.04, 0.45 - dist * 0.08);

      for (let s = 0; s <= ropeSegs; s++) {
        const t = s / ropeSegs;
        const rx = p0.x + dx * t;
        const rz = p0.z + dz * t;
        const sagY = -slack * 4.0 * t * (1.0 - t);
        const ry = (p0.y * (1.0 - t) + p1.y * t) + sagY;
        const waterY = getRiverWaveElevation(rx, rz, time);

        rope.positions[s * 3] = rx;
        rope.positions[s * 3 + 1] = Math.max(waterY + 0.015, ry);
        rope.positions[s * 3 + 2] = rz;
      }
      rope.line.geometry.attributes.position.needsUpdate = true;
    }

    // 5.2 Subaquatic Stream Grass Fluid Drag Oscillation
    for (let i = 0; i < this.subaquaticGrassBlades.length; i++) {
      const gb = this.subaquaticGrassBlades[i];
      gb.mesh.rotation.z = -0.38 + Math.sin(time * 2.4 + gb.phase) * 0.14;
      gb.mesh.rotation.x = Math.cos(time * 1.9 + gb.phase) * 0.08;
    }

    // 6. Procedural Landmark Visual State Cues Animation Loop (Milestone 1)
    this.updateLandmarkCues(time, delta);

    // 8. Unified 3D Wind Vector Field Driven Sway (Banyan, Chimes, Ribbons, Lanterns, Foliage)
    // 8.1 Centennial Banyan Tree
    const banyanWind = UnifiedWindField.sample(-2.0, 4.0, -18.0, time, World3DEnvironment.STATIC_WIND);
    const banyanWindMag = Math.sqrt(banyanWind.x * banyanWind.x + banyanWind.z * banyanWind.z);
    for (let i = 0; i < this.banyanAerialRoots.length; i++) {
      const rootPivot = this.banyanAerialRoots[i];
      const phase = i * 0.85;
      rootPivot.rotation.z = Math.sin(time * 1.5 + phase) * 0.07 * (banyanWind.x / 1.5);
      rootPivot.rotation.x = Math.cos(time * 1.3 + phase) * 0.05 * (-banyanWind.z / 1.5);
    }

    for (let i = 0; i < this.banyanCanopies.length; i++) {
      const canopy = this.banyanCanopies[i];
      const foliageBreathe = 1.0 + Math.sin(time * 1.2 + i * 0.9) * 0.02 * (banyanWindMag / 1.5);
      canopy.scale.set(
        foliageBreathe * (1.0 - 0.012 * banyanWind.x),
        foliageBreathe,
        foliageBreathe * (1.0 + 0.012 * banyanWind.z)
      );
    }

    // 8.2 Spirit Gateway Bronze Chimes & Silk Talisman Ribbons
    const archWind = UnifiedWindField.sample(-20.5, 5.65, -4.8, time, World3DEnvironment.STATIC_WIND);
    for (let i = 0; i < this.portalChimes.length; i++) {
      const item = this.portalChimes[i];
      const phase = i * 1.1;
      item.chime.rotation.z = Math.sin(time * 2.2 + phase) * 0.04 * archWind.x;
      item.chime.rotation.x = Math.cos(time * 1.9 + phase) * 0.03 * (-archWind.z);
      item.ribbon.rotation.z = 0.15 * archWind.x + Math.sin(time * 8.5 + phase) * 0.12;
      item.ribbon.rotation.x = -0.12 * archWind.z + Math.cos(time * 7.2 + phase) * 0.09;
    }

    // 8.3 Shophouse Red Lanterns (Five-Foot-Way Arcade)
    const shophouseWind = UnifiedWindField.sample(-2.0, 2.7, 14.0, time, World3DEnvironment.STATIC_WIND);
    for (let i = 0; i < this.shophouseLanternPivots.length; i++) {
      const pivot = this.shophouseLanternPivots[i];
      const phase = i * 0.95;
      pivot.rotation.z = Math.sin(time * 1.7 + phase) * 0.06 * (shophouseWind.x / 1.2);
      pivot.rotation.x = Math.cos(time * 1.4 + phase) * 0.04 * (-shophouseWind.z / 1.2);
    }

    // 8.3.1 Shophouse Fabric Banners & Bamboo Blinds Gentle Breeze
    for (let i = 0; i < this.shophouseBanners.length; i++) {
      const b = this.shophouseBanners[i];
      b.group.rotation.x = 0.022 * (shophouseWind.z / 1.2) + Math.sin(time * 2.8 + b.phase) * 0.025;
      b.group.rotation.z = 0.028 * (shophouseWind.x / 1.2) + Math.cos(time * 2.4 + b.phase) * 0.02;
    }

    // 8.4 Quayside Parasols & Flowering Bushes
    for (let i = 0; i < this.parasolCanopies.length; i++) {
      const canopy = this.parasolCanopies[i];
      const socketPhase = i * 1.7;
      canopy.rotation.z = Math.sin(time * 1.5 + socketPhase) * 0.035 * breeze;
      canopy.rotation.x = Math.cos(time * 1.3 + socketPhase) * 0.025 * breeze;
    }

    for (let i = 0; i < this.floweringBushes.length; i++) {
      const bush = this.floweringBushes[i];
      const bushFlutter = 1.0 + Math.sin(time * 2.8 + i * 1.1) * 0.025 * breeze;
      bush.scale.set(bushFlutter, 1.0 + Math.cos(time * 2.4 + i) * 0.02 * breeze, bushFlutter);
      bush.rotation.y += delta * 0.05 * (i % 2 === 0 ? 1 : -1) * breeze;
    }

    // 9. Multi-layer Atmospheric Particles (Fireflies & Sun Motes)
    if (this.fireflies) {
      this.fireflies.rotation.y += delta * 0.03;
      const fireflyMat = this.fireflies.material as THREE.PointsMaterial;
      fireflyMat.opacity = THREE.MathUtils.lerp(fireflyMat.opacity, this.targetLighting.fireflyOpacity, Math.min(1.0, delta * 3.5));
    }

    if (this.sunMotes) {
      const count = 100;
      for (let i = 0; i < count; i++) {
        this.sunMotesPositions[i * 3] += Math.sin(time * 0.4 + i) * 0.05 * delta + 0.1 * delta;
        this.sunMotesPositions[i * 3 + 1] -= 0.25 * delta;
        this.sunMotesPositions[i * 3 + 2] += Math.cos(time * 0.5 + i) * 0.08 * delta;

        if (this.sunMotesPositions[i * 3 + 1] < 0.6) {
          this.sunMotesPositions[i * 3 + 1] = 8.5;
          this.sunMotesPositions[i * 3] = Math.sin(i * 99) * 24;
          this.sunMotesPositions[i * 3 + 2] = Math.cos(i * 37) * 20;
        }
      }
      this.sunMotes.geometry.attributes.position.needsUpdate = true;

      const moteMat = this.sunMotes.material as THREE.PointsMaterial;
      moteMat.opacity = THREE.MathUtils.lerp(moteMat.opacity, this.targetLighting.sunMotesOpacity, Math.min(1.0, delta * 3.5));
    }

    // 10. Smooth Day/Night Lighting Interpolator
    const lightLerp = Math.min(1.0, delta * 3.5);
    if (this.sunLight) {
      this.sunLight.color.lerp(this.targetLighting.sunColor, lightLerp);
      this.sunLight.intensity = THREE.MathUtils.lerp(this.sunLight.intensity, this.targetLighting.sunIntensity, lightLerp);
      this.sunLight.position.lerp(this.targetLighting.sunPosition, lightLerp);
    }
    if (this.ambientLight) {
      this.ambientLight.color.lerp(this.targetLighting.ambientColor, lightLerp);
      this.ambientLight.intensity = THREE.MathUtils.lerp(this.ambientLight.intensity, this.targetLighting.ambientIntensity, lightLerp);
    }
    if (this.hemisphereLight) {
      this.hemisphereLight.color.lerp(this.targetLighting.hemisphereColor, lightLerp);
      this.hemisphereLight.groundColor.lerp(this.targetLighting.hemisphereGroundColor, lightLerp);
      this.hemisphereLight.intensity = THREE.MathUtils.lerp(this.hemisphereLight.intensity, this.targetLighting.hemisphereIntensity, lightLerp);
    }
    for (let i = 0; i < this.lampLights.length; i++) {
      this.lampLights[i].intensity = THREE.MathUtils.lerp(this.lampLights[i].intensity, this.targetLighting.lampIntensity, lightLerp);
    }

    // Macro investigation fog modulation
    const targetMacroWeight = this.isMacroMode ? 1.0 : 0.0;
    this.macroWeight = THREE.MathUtils.lerp(
      this.macroWeight,
      targetMacroWeight,
      Math.min(1.0, delta * 4.0)
    );
    const effectiveFogDensity = this.targetLighting.fogDensity * (1.0 - 0.28 * this.macroWeight);

    // Smoothly interpolate scene fog & background if attached to scene
    const scene = this.root.parent;
    if (scene instanceof THREE.Scene) {
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.lerp(this.targetLighting.fogColor, lightLerp);
        scene.fog.density = THREE.MathUtils.lerp(scene.fog.density, effectiveFogDensity, lightLerp);
      }
      if (scene.background instanceof THREE.Color) {
        scene.background.lerp(this.targetLighting.fogColor, lightLerp);
      }
    }

    // 11. Curator & Boatman subtle idle breathing & beacon float
    if (this.curatorNPCGroup) {
      this.curatorNPCGroup.position.y = 1.23 + Math.sin(time * 2.2) * 0.015;
      const beacon = this.curatorNPCGroup.getObjectByName("beacon");
      if (beacon) {
        beacon.rotation.y += delta * 1.8;
        beacon.position.y = 2.82 + Math.sin(time * 3.0) * 0.08;
      }
    }
    if (this.boatmanNPCGroup) {
      this.boatmanNPCGroup.position.y = 0.75 + Math.sin(time * 1.8 + 1.0) * 0.015;
      const beacon = this.boatmanNPCGroup.getObjectByName("beacon");
      if (beacon) {
        beacon.rotation.y += delta * 1.8;
        beacon.position.y = 2.82 + Math.sin(time * 3.0 + 1.2) * 0.08;
      }
    }

    // 12. Living Miniature World Life Scenes (M2)
    if (this.lifeScenes) {
      this.lifeScenes.update(time, delta);
    }
  }

  public dispose() {
    if (this.lifeScenes) {
      this.lifeScenes.dispose();
    }
    this.mooringRopes = [];
    this.lanternFlames = [];
    this.lanternLights = [];
    this.subaquaticGrassBlades = [];
    this.shophouseBanners = [];
    this.landmarkCueRecords = [];
    this.runeBrazierLights = [];
    this.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || (obj as any).isLine) {
        (obj as any).geometry?.dispose();
        if (Array.isArray((obj as any).material)) {
          (obj as any).material.forEach((m: any) => m.dispose());
        } else {
          (obj as any).material?.dispose();
        }
      }
    });
  }
}
