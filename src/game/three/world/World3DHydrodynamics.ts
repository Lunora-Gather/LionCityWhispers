import * as THREE from "three";

/**
 * World3DHydrodynamics.ts
 *
 * Full physical fluid hydrodynamics simulation engine for the historic Singapore River:
 * - Trochoidal Gerstner Waves with horizontal (dx, dz) and vertical dy displacements,
 *   producing sharp wave crests and broad flat troughs.
 * - Directional shear velocity flow (West to East along +X, 0.18 m/s wall slip to 1.20 m/s fairway).
 * - Cavenagh Bridge pier obstacle displacement: upstream stagnation head and downstream vortex shedding.
 * - Bumboat Lord Kelvin wakes with universal 19.47° V-envelope interference and cusp foam.
 * - Shoreline smoothstep damping along stone retaining walls and water steps.
 * - Dynamic crest breaking foam (Jacobian J < 0.35) and shoreline wash lines.
 * - Water caustics intensity pattern and Beer-Lambert optical depth color gradient.
 *
 * Strict Performance Guarantee: Zero Three.js heap allocations during runtime sampling / 60 FPS update loop.
 */

export interface GerstnerWaveComponent {
  directionX: number;
  directionZ: number;
  wavelength: number;
  amplitude: number;
  steepness: number; // Q parameter
  phaseOffset: number;
}

export interface PierObstacle {
  x: number;
  z: number;
  radius: number;
}

export interface VesselWakeSource {
  x: number;
  z: number;
  yaw: number;
  length: number;
  width: number;
  speed: number;
}

export interface WaterSurfaceSample {
  x: number;
  y: number;
  z: number;
  normalX: number;
  normalY: number;
  normalZ: number;
  foam: number;
  currentVx: number;
  depth: number;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0.0, Math.min(1.0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3.0 - 2.0 * t);
}

export class HydrodynamicRiverSystem {
  // Undisturbed surface height & physical constants
  public readonly baseElevation: number = 0.20;
  public readonly waterDepth: number = 0.65;
  public readonly gravity: number = 9.81;

  // Channel boundaries
  public readonly channelCenterZ: number = 2.50;
  public readonly channelHalfWidth: number = 4.0;
  public readonly fairwayVelocity: number = 1.20;
  public readonly wallSlipVelocity: number = 0.18;
  public readonly boundaryLayerExponent: number = 2.5;

  // Gerstner wave spectrum (4 distinct components)
  private waves: Array<{
    dirX: number;
    dirZ: number;
    wavelength: number;
    amplitude: number;
    steepness: number;
    wavenumber: number;
    frequency: number;
    phaseOffset: number;
  }> = [];

  // Pier obstacles (Cavenagh Bridge granite piers)
  private piers: PierObstacle[] = [
    { x: 0.0, z: 0.6, radius: 0.75 },
    { x: 0.0, z: 4.4, radius: 0.75 }
  ];

  // Bumboat wake sources (anchored/cruising sampan boats)
  private vessels: VesselWakeSource[] = [
    { x: -14.0, z: 2.2, yaw: 0.20, length: 4.8, width: 1.6, speed: 0.0 },
    { x: -6.0, z: 3.5, yaw: -0.15, length: 4.8, width: 1.6, speed: 0.0 },
    { x: 12.0, z: 2.4, yaw: 0.10, length: 4.8, width: 1.6, speed: 0.0 }
  ];

  // Static pre-allocated scratch objects to guarantee ZERO heap allocations
  private scratchColor = new THREE.Color();
  private scratchDisp = new THREE.Vector3();
  private scratchNormal = new THREE.Vector3();
  private scratchSample: WaterSurfaceSample = {
    x: 0,
    y: 0,
    z: 0,
    normalX: 0,
    normalY: 1,
    normalZ: 0,
    foam: 0,
    currentVx: 0,
    depth: 0.65
  };

  // Current simulation time
  public currentTime: number = 0;

  constructor() {
    this.initWaveSpectrum();
  }

  private initWaveSpectrum(): void {
    const defaultWaves: GerstnerWaveComponent[] = [
      // Primary river swell travelling East (slightly angled toward south bank)
      {
        directionX: 0.98,
        directionZ: 0.20,
        wavelength: 5.2,
        amplitude: 0.042,
        steepness: 0.28,
        phaseOffset: 0.0
      },
      // Secondary oblique wave
      {
        directionX: 0.92,
        directionZ: -0.39,
        wavelength: 3.1,
        amplitude: 0.026,
        steepness: 0.22,
        phaseOffset: 1.15
      },
      // Cross capillary chop
      {
        directionX: 0.82,
        directionZ: 0.57,
        wavelength: 1.7,
        amplitude: 0.014,
        steepness: 0.16,
        phaseOffset: 2.45
      },
      // Fine surface ripple
      {
        directionX: 0.76,
        directionZ: -0.65,
        wavelength: 0.9,
        amplitude: 0.007,
        steepness: 0.10,
        phaseOffset: 3.80
      }
    ];

    this.waves = defaultWaves.map((w) => {
      const len = Math.hypot(w.directionX, w.directionZ) || 1.0;
      const dirX = w.directionX / len;
      const dirZ = w.directionZ / len;
      const k = (2 * Math.PI) / w.wavelength;
      // Finite depth dispersion relation: omega = sqrt(g * k * tanh(k * H))
      const omega = Math.sqrt(this.gravity * k * Math.tanh(k * this.waterDepth));
      return {
        dirX,
        dirZ,
        wavelength: w.wavelength,
        amplitude: w.amplitude,
        steepness: w.steepness,
        wavenumber: k,
        frequency: omega,
        phaseOffset: w.phaseOffset
      };
    });
  }

  /**
   * Directional shear flow velocity gradient v_x(z).
   * Center fairway: ~1.20 m/s; Embankment walls: slip velocity ~0.18 m/s.
   */
  public computeVelocity(_x: number, z: number): number {
    return this.getShearVelocity(z);
  }

  public getShearVelocity(z: number): number {
    let eta = 0.0;
    if (z <= this.channelCenterZ) {
      eta = Math.min(1.0, (this.channelCenterZ - z) / (this.channelCenterZ - (-1.2)));
    } else {
      eta = Math.min(1.0, (z - this.channelCenterZ) / (6.8 - this.channelCenterZ));
    }
    const profile = 1.0 - Math.pow(eta, this.boundaryLayerExponent);
    return this.wallSlipVelocity + (this.fairwayVelocity - this.wallSlipVelocity) * profile;
  }

  /**
   * Shoreline physical damping factor D_shore in [0, 1].
   * Smoothly attenuates wave displacement to 0 at stone retaining walls and water steps.
   */
  public getShorelineDamping(x: number, z: number): number {
    const dNorth = z - (-1.2);
    const dSouth = 6.8 - z;
    const dWest = x - (-35.0);
    const dEast = 27.0 - x;

    let dSteps = 999.0;
    if (x >= 1.0 && x <= 3.8 && z < 0.2) {
      dSteps = z - (-0.6);
    }

    const dMin = Math.max(0.0, Math.min(dNorth, dSouth, dWest, dEast, dSteps));
    return smoothstep(0.0, 0.85, dMin);
  }

  /**
   * Cavenagh Bridge pier stagnation head and vortex shedding displacement.
   */
  public getPierDisplacement(x: number, z: number, time: number): number {
    let totalDisp = 0.0;
    const pierCount = this.piers.length;

    for (let p = 0; p < pierCount; p++) {
      const pier = this.piers[p];
      const dx = x - pier.x;
      const dz = z - pier.z;
      const uInf = this.getShearVelocity(pier.z);

      // Upstream bow pile-up (stagnation head): smooth fade-out across dx in [-0.5, 0.5]
      if (dx < 0.5) {
        const hStag = (uInf * uInf) / (2.0 * this.gravity); // ~0.05-0.073m
        const sigma = 1.3;
        const distSq = dx * dx + dz * dz;
        const wStag = 1.0 - smoothstep(-0.5, 0.5, dx);
        totalDisp += hStag * Math.exp(-distSq / (2.0 * sigma * sigma)) * wStag;
      }

      // Downstream wake and vortex shedding: smooth onset [-0.5, 0.5] and exit [6.0, 8.0]
      if (dx > -0.5 && dx < 8.0) {
        const strouhal = 0.22;
        const diam = pier.radius * 2.0;
        const fSt = (strouhal * uInf) / diam;
        const omegaVort = 2.0 * Math.PI * fSt;
        const kv = 1.75;
        const lateralSign = dz >= 0 ? 1.0 : -1.0;
        const wWake = smoothstep(-0.5, 0.5, dx) * (1.0 - smoothstep(6.0, 8.0, dx));
        const wakeAmp = 0.026 * Math.exp(-dx / 3.8) * Math.exp(-(dz * dz) / 1.6);
        totalDisp += wakeAmp * Math.sin(kv * dx - omegaVort * time + lateralSign * (Math.PI / 2.0)) * wWake;
      }
    }

    return totalDisp;
  }

  /**
   * Bumboat Lord Kelvin wakes with universal 19.47° V-envelope interference.
   */
  public getKelvinWakeDisplacement(x: number, z: number, time: number): number {
    let totalDisp = 0.0;
    const tanKelvin = 0.353553; // tan(arcsin(1/3)) = 1 / sqrt(8) ~ 0.35355
    const vesselCount = this.vessels.length;

    for (let v = 0; v < vesselCount; v++) {
      const vessel = this.vessels[v];
      const dx = x - vessel.x;
      if (dx <= 0.0 || dx > 18.0) continue;

      const dzRel = z - vessel.z;
      const halfHull = 0.8;
      const wedgeHalfWidth = dx * tanKelvin + halfHull;

      if (Math.abs(dzRel) <= wedgeHalfWidth + 0.6) {
        const cuspDist = Math.abs(Math.abs(dzRel) - dx * tanKelvin);
        const decay = Math.sqrt(2.5 / (dx + 2.5)) * Math.exp(-(cuspDist * cuspDist) / 0.45);

        const kDiv = 3.8;
        const omegaDiv = 3.1;
        const kTrans = 2.2;
        const omegaTrans = 2.2;

        const divPhase = kDiv * (dx * 0.8165 + Math.abs(dzRel) * 0.5774) - omegaDiv * time;
        const transPhase = kTrans * dx - omegaTrans * time;

        const downstreamFade = dx > 13.0 ? (1.0 - smoothstep(13.0, 18.0, dx)) : 1.0;
        const wakeElevation = 0.035 * decay * (Math.cos(divPhase) + 0.5 * Math.cos(transPhase)) * downstreamFade;
        totalDisp += wakeElevation;
      }
    }

    return totalDisp;
  }

  /**
   * Dynamic foam generation factor in [0, 1].
   * Combines Gerstner crest breaking (Jacobian J < 0.35), shoreline wash, and Kelvin cusp foam.
   */
  public computeFoam(x: number, z: number, time: number): number {
    const vx = this.getShearVelocity(z);
    let sumCos = 0.0;
    const waveCount = this.waves.length;

    for (let m = 0; m < waveCount; m++) {
      const w = this.waves[m];
      const phi = w.wavenumber * (w.dirX * x + w.dirZ * z) - (w.frequency + w.wavenumber * w.dirX * vx) * time + w.phaseOffset;
      sumCos += w.steepness * Math.cos(phi);
    }

    // 1. Gerstner crest pinching / breaking foam
    const jacobian = 1.0 - sumCos;
    let foamCrest = 0.0;
    if (jacobian < 0.35) {
      foamCrest = Math.min(1.0, Math.max(0.0, (0.35 - jacobian) / 0.35));
    }

    // 2. Shoreline lapping foam
    const dNorth = z - (-1.2);
    const dSouth = 6.8 - z;
    const dWest = x - (-35.0);
    const dEast = 27.0 - x;
    let dSteps = 999.0;
    if (x >= 1.0 && x <= 3.8 && z < 0.2) {
      dSteps = z - (-0.6);
    }
    const dShore = Math.max(0.0, Math.min(dNorth, dSouth, dWest, dEast, dSteps));
    let foamShore = 0.0;
    if (dShore < 0.55) {
      const washOsc = 0.60 + 0.40 * Math.sin(3.5 * x + 4.2 * time);
      foamShore = Math.exp(-(dShore * dShore) / (2.0 * 0.22 * 0.22)) * washOsc;
    }

    // 3. Kelvin wake cusp foam
    let foamWake = 0.0;
    const tanKelvin = 0.353553;
    const vesselCount = this.vessels.length;
    for (let v = 0; v < vesselCount; v++) {
      const vessel = this.vessels[v];
      const dx = x - vessel.x;
      if (dx > 0.0 && dx < 14.0) {
        const dzRel = z - vessel.z;
        const cuspDist = Math.abs(Math.abs(dzRel) - dx * tanKelvin);
        if (cuspDist < 0.35) {
          const fadeFoam = dx > 10.0 ? (1.0 - smoothstep(10.0, 14.0, dx)) : 1.0;
          foamWake = Math.max(foamWake, 0.75 * Math.exp(-(cuspDist * cuspDist) / 0.15) * Math.exp(-dx / 10.0) * fadeFoam);
        }
      }
    }

    return Math.min(1.0, Math.max(0.0, foamCrest + foamShore + foamWake));
  }

  /**
   * Dual-frequency moving sunlight caustics intensity pattern in [0, 1].
   */
  public getCausticIntensity(x: number, z: number, time: number): number {
    const k1 = 1.8;
    const omega1 = 2.5;
    const c1 = 0.866;
    const s1 = 0.5;
    const term1a = Math.sin(k1 * (c1 * x + s1 * z) - omega1 * time);
    const term1b = Math.sin(k1 * (-s1 * x + c1 * z) - omega1 * time);
    const pattern1 = Math.pow(Math.abs(term1a * term1b), 1.5);

    const k2 = 3.2;
    const omega2 = 3.8;
    const c2 = 0.5;
    const s2 = -0.866;
    const term2a = Math.sin(k2 * (c2 * x + s2 * z) - omega2 * time);
    const term2b = Math.sin(k2 * (-s2 * x + c2 * z) - omega2 * time);
    const pattern2 = Math.pow(Math.abs(term2a * term2b), 2.0);

    return Math.min(1.0, Math.max(0.0, pattern1 + 0.5 * pattern2));
  }

  /**
   * Beer-Lambert optical depth color gradient.
   * Translucence shifts from shallow cyan (steps & banks) to deep emerald (channel fairway).
   */
  public computeDepthColor(depth: number, outColor?: THREE.Color): THREE.Color {
    const target = outColor || new THREE.Color();
    const clampedDepth = Math.max(0.10, Math.min(0.75, depth));
    // Beer-Lambert transmittance: T(d) = exp(-sigma * d)
    const transmittance = Math.exp(-2.2 * clampedDepth);

    // Shallow cyan: (0.118, 0.471, 0.490) -> Deep fairway emerald: (0.035, 0.173, 0.180)
    target.r = THREE.MathUtils.lerp(0.035, 0.118, transmittance);
    target.g = THREE.MathUtils.lerp(0.173, 0.471, transmittance);
    target.b = THREE.MathUtils.lerp(0.180, 0.490, transmittance);
    return target;
  }

  /**
   * Computes 3D surface displacement (deltaX, deltaY, deltaZ) for undisturbed surface point (x0, z0).
   * Result is stored in outVec3.
   */
  public computeDisplacement(x0: number, z0: number, time: number, outVec3: THREE.Vector3): void {
    const vx = this.getShearVelocity(z0);
    const damping = this.getShorelineDamping(x0, z0);

    let dx = 0.0;
    let dz = 0.0;
    let dy = 0.0;

    const waveCount = this.waves.length;
    for (let m = 0; m < waveCount; m++) {
      const w = this.waves[m];
      const phi = w.wavenumber * (w.dirX * x0 + w.dirZ * z0) - (w.frequency + w.wavenumber * w.dirX * vx) * time + w.phaseOffset;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      // Trochoidal horizontal vector displacement: -Q/k * d * sin(phi)
      const qOverK = w.steepness / w.wavenumber;
      dx -= qOverK * w.dirX * sinPhi;
      dz -= qOverK * w.dirZ * sinPhi;
      // Trochoidal vertical displacement: A * cos(phi)
      dy += w.amplitude * cosPhi;
    }

    // Add pier stagnation and wake displacement
    const pierDisp = this.getPierDisplacement(x0, z0, time);
    // Add bumboat Kelvin wake displacement
    const kelvinDisp = this.getKelvinWakeDisplacement(x0, z0, time);

    dy += pierDisp + kelvinDisp;

    // Modulate all displacements with shoreline damping
    outVec3.x = dx * damping;
    outVec3.y = dy * damping;
    outVec3.z = dz * damping;
  }

  /**
   * Analytical surface normal computation for undisturbed point (x0, z0).
   * Stores normalized normal vector in outNormal.
   */
  public computeSurfaceNormal(x0: number, z0: number, time: number, outNormal: THREE.Vector3): void {
    const vx = this.getShearVelocity(z0);
    const damping = this.getShorelineDamping(x0, z0);
    let txx = 1.0;
    let txy = 0.0;
    let txz = 0.0;
    let tzx = 0.0;
    let tzy = 0.0;
    let tzz = 1.0;

    const waveCount = this.waves.length;
    for (let m = 0; m < waveCount; m++) {
      const w = this.waves[m];
      const phi = w.wavenumber * (w.dirX * x0 + w.dirZ * z0) - (w.frequency + w.wavenumber * w.dirX * vx) * time + w.phaseOffset;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const q = w.steepness;
      const kA = w.wavenumber * w.amplitude;

      txx -= q * w.dirX * w.dirX * cosPhi;
      txy -= kA * w.dirX * sinPhi;
      txz -= q * w.dirX * w.dirZ * cosPhi;

      tzx -= q * w.dirX * w.dirZ * cosPhi;
      tzy -= kA * w.dirZ * sinPhi;
      tzz -= q * w.dirZ * w.dirZ * cosPhi;
    }

    // Normal = normalize(T_z x T_x)
    const rawNx = tzy * txz - tzz * txy;
    const detJ = tzz * txx - tzx * txz;
    const rawNz = tzx * txy - tzy * txx;

    // Modulate horizontal normal components by shoreline damping
    const nx = rawNx * damping;
    // Blend vertical component towards vertical (1.0) at boundaries, with defensive positive floor
    const ny = Math.max(0.05, (1.0 - damping) + damping * detJ);
    const nz = rawNz * damping;

    const len = Math.hypot(nx, ny, nz) || 1.0;
    outNormal.set(nx / len, ny / len, nz / len);
  }

  /**
   * Complete water surface sample at undisturbed coordinate (x0, z0).
   * Fills outSample without any heap allocations.
   */
  public sampleSurface(x0: number, z0: number, time: number, outSample: WaterSurfaceSample): void {
    this.computeDisplacement(x0, z0, time, this.scratchDisp);
    this.computeSurfaceNormal(x0, z0, time, this.scratchNormal);

    outSample.x = x0 + this.scratchDisp.x;
    outSample.y = this.baseElevation + this.scratchDisp.y;
    outSample.z = z0 + this.scratchDisp.z;
    outSample.normalX = this.scratchNormal.x;
    outSample.normalY = this.scratchNormal.y;
    outSample.normalZ = this.scratchNormal.z;
    outSample.foam = this.computeFoam(x0, z0, time);
    outSample.currentVx = this.getShearVelocity(z0);
    outSample.depth = outSample.y - (-0.45);
  }

  /**
   * Updates internal simulation time.
   */
  public update(time: number, _delta: number): void {
    this.currentTime = time;
  }
}

// Alias for survey architecture blueprint compatibility
export { HydrodynamicRiverSystem as World3DHydrodynamics };
