import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { World3DEnvironment, type LandmarkTrigger, type TimeOfDay } from "./World3DEnvironment";
import { World3DPlayer } from "./World3DPlayer";
import { getEquirectEnvTexture } from "./World3DTextures";
import { type Locale, worldCopy } from "@/data/i18n";
import { playUiClick, playStoneGrind, playGearTick, playChimeResonance } from "@/game/audio";
import { Compass, Eye, Moon, Sun, Sunrise, X, Sparkles, Navigation, BookOpen, Settings, Volume2, VolumeX, Landmark } from "lucide-react";

export type World3DProps = {
  locale: Locale;
  completedPuzzles?: number;
  ritualComplete?: boolean;
  museumComplete?: boolean;
  objective?: string;
  inventory?: Array<{ id: string; name?: string; detail?: string }>;
  flags?: Record<string, boolean>;
  modalOpen?: boolean;
  muted?: boolean;
  onClose: () => void;
  onOpenWorkshop?: (type: "jigsaw" | "runes" | "lock") => void;
  onOpenVault?: (artifactId: string) => void;
  onEnterMuseum?: () => void;
  onTalkNpc?: (npcId: "curator" | "boatman") => void;
  onStartRitual?: () => void;
  onOpenCodex?: () => void;
  onOpenSettings?: () => void;
  onToggleAudio?: () => void;
};

export interface CameraControllerState {
  currentDistance: number;
  targetDistance: number;
  currentPolar: number;
  targetPolar: number;
  azimuth: number;
  target: THREE.Vector3;
  angularVelocityX: number;
  angularVelocityY: number;
  isDragging: boolean;
  isCloseUp: boolean;
  currentFov: number;
  targetFov: number;
  lookAtYOffset: number;
}

// Pre-allocated static scratch vectors to guarantee zero heap allocations in render loop
const STATIC_DIORAMA_TARGET = new THREE.Vector3(-2.0, 0.5, -1.5);
const STATIC_BLEND_TARGET = new THREE.Vector3();
const STATIC_INPUT = new THREE.Vector2();
const STATIC_NAV_TARGET = new THREE.Vector3();

export class World3DCameraController {
  public state: CameraControllerState;

  // Damping and stiffness constants
  private readonly SENSITIVITY_X = 0.0055;
  private readonly SENSITIVITY_Y = 0.0045;
  private readonly DAMPING_LAMBDA = 5.8; // e^(-5.8 * dt) -> ~0.91 per 60fps frame
  private readonly VELOCITY_SMOOTH_BETA = 0.40;
  private readonly VELOCITY_CUTOFF = 1e-4;

  public readonly POLAR_MIN = 0.20;
  public readonly POLAR_MAX = Math.PI / 2 - 0.05; // ~1.5208 rad

  private readonly K_TARGET = 7.0;
  private readonly K_DISTANCE = 5.2;
  private readonly K_POLAR = 5.5;
  private readonly K_FOV = 4.8;
  private readonly K_LOOKAT_Y = 6.0;

  private userZoomDistance = 14.0;
  private macroZoomDistance = 5.2;
  private prevMouseX = 0;
  private prevMouseY = 0;
  private prevMouseMoveTime = 0;

  constructor(initialTarget: THREE.Vector3) {
    this.state = {
      currentDistance: 14.0,
      targetDistance: 14.0,
      currentPolar: 0.85,
      targetPolar: 0.85,
      azimuth: 0.65,
      target: initialTarget.clone(),
      angularVelocityX: 0,
      angularVelocityY: 0,
      isDragging: false,
      isCloseUp: false,
      currentFov: 45.0,
      targetFov: 45.0,
      lookAtYOffset: 0.80
    };
  }

  public handleMouseDown(e: MouseEvent): void {
    if (e.button === 0 || e.button === 2) {
      this.state.isDragging = true;
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
      this.prevMouseMoveTime = performance.now();
      this.state.angularVelocityX = 0;
      this.state.angularVelocityY = 0;
    }
  }

  public handleMouseMove(e: MouseEvent): void {
    if (!this.state.isDragging) return;
    const now = performance.now();
    const dt = Math.max((now - this.prevMouseMoveTime) / 1000, 0.005);
    this.prevMouseMoveTime = now;

    const deltaX = e.clientX - this.prevMouseX;
    const deltaY = e.clientY - this.prevMouseY;
    this.prevMouseX = e.clientX;
    this.prevMouseY = e.clientY;

    const dPhi = -deltaX * this.SENSITIVITY_X;
    const dTheta = -deltaY * this.SENSITIVITY_Y;

    this.state.azimuth += dPhi;
    this.state.currentPolar = Math.max(this.POLAR_MIN, Math.min(this.POLAR_MAX, this.state.currentPolar + dTheta));
    this.state.targetPolar = this.state.currentPolar;

    const instVelX = dPhi / dt;
    const instVelY = dTheta / dt;

    // Rolling velocity tracking during drag
    this.state.angularVelocityX = this.state.angularVelocityX * (1 - this.VELOCITY_SMOOTH_BETA) + instVelX * this.VELOCITY_SMOOTH_BETA;
    this.state.angularVelocityY = this.state.angularVelocityY * (1 - this.VELOCITY_SMOOTH_BETA) + instVelY * this.VELOCITY_SMOOTH_BETA;
  }

  public handleMouseUp(): void {
    const now = performance.now();
    if (now - this.prevMouseMoveTime > 70) {
      this.state.angularVelocityX = 0;
      this.state.angularVelocityY = 0;
    }
    this.state.isDragging = false;
  }

  public handleWheel(deltaY: number): void {
    const zoomStep = deltaY * 0.015;
    if (this.state.isCloseUp) {
      this.macroZoomDistance = Math.max(3.8, Math.min(8.0, this.macroZoomDistance + zoomStep));
      this.state.targetDistance = this.macroZoomDistance;
    } else {
      this.userZoomDistance = Math.max(6.0, Math.min(24.0, this.userZoomDistance + zoomStep));
      this.state.targetDistance = this.userZoomDistance;
    }
  }

  public resetMacroDistance(dist = 5.2): void {
    this.macroZoomDistance = dist;
  }

  public update(
    delta: number,
    playerPos: THREE.Vector3,
    activeLandmark: LandmarkTrigger | null,
    isBirdsEye: boolean,
    camera: THREE.PerspectiveCamera
  ): void {
    const dt = Math.min(delta, 0.1);

    // 1. Determine Operational Mode
    const isCloseUp = activeLandmark !== null && !isBirdsEye;
    this.state.isCloseUp = isCloseUp;

    // 2. Compute Mode-Specific Targets
    let desiredTargetPos: THREE.Vector3;
    let desiredDistance: number;
    let desiredPolar: number;
    let desiredFov: number;
    let desiredLookAtY: number;

    if (isBirdsEye) {
      desiredTargetPos = STATIC_DIORAMA_TARGET;
      desiredDistance = 32.0;
      desiredPolar = 0.78;
      desiredFov = 45.0;
      desiredLookAtY = 0.0;
    } else if (isCloseUp && activeLandmark) {
      // Macro Investigation: blend player and landmark focus (35% player, 65% landmark)
      STATIC_BLEND_TARGET.copy(playerPos).multiplyScalar(0.35).addScaledVector(activeLandmark.position, 0.65);
      desiredTargetPos = STATIC_BLEND_TARGET;
      desiredDistance = this.macroZoomDistance;
      desiredPolar = activeLandmark.investigation?.targetPolar ?? 1.28; // eye-level dip (~73.3 deg)
      desiredFov = 38.0;   // macro telephoto compression
      desiredLookAtY = 0.65;
    } else {
      // Follow Mode
      desiredTargetPos = playerPos;
      desiredDistance = this.userZoomDistance;
      desiredPolar = 0.85;
      desiredFov = 45.0;
      desiredLookAtY = 0.80;
    }

    this.state.targetDistance = desiredDistance;
    this.state.targetPolar = desiredPolar;
    this.state.targetFov = desiredFov;

    // 3. Angular Inertial Coasting & Damping
    if (!this.state.isDragging) {
      const decay = Math.exp(-this.DAMPING_LAMBDA * dt);
      this.state.angularVelocityX *= decay;
      this.state.angularVelocityY *= decay;

      if (Math.abs(this.state.angularVelocityX) < this.VELOCITY_CUTOFF) this.state.angularVelocityX = 0;
      if (Math.abs(this.state.angularVelocityY) < this.VELOCITY_CUTOFF) this.state.angularVelocityY = 0;

      this.state.azimuth += this.state.angularVelocityX * dt;
      this.state.currentPolar += this.state.angularVelocityY * dt;

      // Polar boundary inelastic clamp
      if (this.state.currentPolar <= this.POLAR_MIN) {
        this.state.currentPolar = this.POLAR_MIN;
        this.state.angularVelocityY = 0;
      } else if (this.state.currentPolar >= this.POLAR_MAX) {
        this.state.currentPolar = this.POLAR_MAX;
        this.state.angularVelocityY = 0;
      }

      // Smooth polar relaxation towards target when idle
      if (Math.abs(this.state.angularVelocityY) === 0) {
        const alphaPolar = 1.0 - Math.exp(-this.K_POLAR * dt);
        this.state.currentPolar += (this.state.targetPolar - this.state.currentPolar) * alphaPolar;
      }

      // Smooth azimuth relaxation towards unobstructed southeast riverfront panorama in Bird's-Eye mode
      if (isBirdsEye && Math.abs(this.state.angularVelocityX) === 0) {
        const alphaAz = 1.0 - Math.exp(-this.K_POLAR * dt);
        const azDiff = Math.atan2(Math.sin(0.38 - this.state.azimuth), Math.cos(0.38 - this.state.azimuth));
        this.state.azimuth += azDiff * alphaAz;
      }
    }

    // 4. Continuous Spherical Coordinate Lerping
    const alphaTarget = 1.0 - Math.exp(-this.K_TARGET * dt);
    this.state.target.lerp(desiredTargetPos, alphaTarget);

    const alphaDist = 1.0 - Math.exp(-this.K_DISTANCE * dt);
    this.state.currentDistance += (this.state.targetDistance - this.state.currentDistance) * alphaDist;

    const alphaLookAt = 1.0 - Math.exp(-this.K_LOOKAT_Y * dt);
    this.state.lookAtYOffset += (desiredLookAtY - this.state.lookAtYOffset) * alphaLookAt;

    // 5. Dynamic FOV Telephoto Compression
    const alphaFov = 1.0 - Math.exp(-this.K_FOV * dt);
    const fovDiff = this.state.targetFov - camera.fov;
    if (Math.abs(fovDiff) > 0.005) {
      camera.fov += fovDiff * alphaFov;
      camera.updateProjectionMatrix();
      this.state.currentFov = camera.fov;
    } else if (camera.fov !== this.state.targetFov) {
      camera.fov = this.state.targetFov;
      camera.updateProjectionMatrix();
      this.state.currentFov = camera.fov;
    }

    // 6. Camera Position & LookAt Calculation
    const r = this.state.currentDistance;
    const polar = this.state.currentPolar;
    const phi = this.state.azimuth;

    const cx = this.state.target.x + r * Math.sin(polar) * Math.sin(phi);
    let cy = this.state.target.y + r * Math.cos(polar);
    const cz = this.state.target.z + r * Math.sin(polar) * Math.cos(phi);

    // Hard ground safety clamp
    if (cy < 1.65) cy = 1.65;

    camera.position.set(cx, cy, cz);
    camera.lookAt(
      this.state.target.x,
      this.state.target.y + this.state.lookAtYOffset,
      this.state.target.z
    );
  }
}

interface RelicDefinition {
  id: string;
  nameZh: string;
  nameEn: string;
  glyph: { zh: string; en: string };
  flagKey: "jigsaw" | "runes" | "lock" | "rhythm";
}

const RELIC_DEFINITIONS: RelicDefinition[] = [
  { id: "badang-stone", nameZh: "巴当巨石", nameEn: "Badang Stone", glyph: { zh: "石", en: "ST" }, flagKey: "jigsaw" },
  { id: "rune-plaque", nameZh: "狮门铭牌", nameEn: "Rune Plaque", glyph: { zh: "文", en: "RN" }, flagKey: "runes" },
  { id: "harbor-seal", nameZh: "海门星盘", nameEn: "Harbor Seal", glyph: { zh: "钥", en: "GT" }, flagKey: "lock" },
  { id: "spirit-chime", nameZh: "古灵编磬", nameEn: "Spirit Chime", glyph: { zh: "铃", en: "CH" }, flagKey: "rhythm" }
];

interface GuidedTarget {
  id: string;
  nameZh: string;
  nameEn: string;
  position: { x: number; y: number; z: number };
}

function computeGuidedTarget(
  flags: Record<string, boolean> | undefined,
  ritualComplete: boolean | undefined,
  museumComplete: boolean | undefined,
  inventoryCount: number
): GuidedTarget | null {
  if (museumComplete) return null;
  if ((ritualComplete || flags?.rhythm) && inventoryCount >= 4) {
    return { id: "museum", nameZh: "国家历史博物馆", nameEn: "National History Museum", position: { x: -20, y: 1.0, z: -10 } };
  }
  if (!flags?.jigsaw) {
    return { id: "badang-stone", nameZh: "巴当巨石遗址", nameEn: "Badang Megalith", position: { x: -6, y: 1.0, z: -8 } };
  }
  if (!flags?.runes) {
    return { id: "rune-plaque", nameZh: "古文字石碑", nameEn: "Ancient Rune Plaque", position: { x: 9, y: 1.0, z: -8 } };
  }
  if (!flags?.lock) {
    return { id: "harbor-seal", nameZh: "海门星盘机关", nameEn: "Harbor Astrolabe Gate", position: { x: 18, y: 1.0, z: 3.0 } };
  }
  if (!ritualComplete && !flags?.rhythm) {
    return { id: "spirit-chime", nameZh: "灵界清音入口", nameEn: "Spirit Realm Gateway", position: { x: -14, y: 1.0, z: 16 } };
  }
  return { id: "museum", nameZh: "国家历史博物馆", nameEn: "National History Museum", position: { x: -20, y: 1.0, z: -10 } };
}

export const World3D: React.FC<World3DProps> = ({
  locale,
  completedPuzzles = 0,
  ritualComplete = false,
  museumComplete = false,
  objective,
  inventory = [],
  flags,
  modalOpen = false,
  muted = false,
  onClose,
  onOpenWorkshop,
  onOpenVault,
  onEnterMuseum,
  onTalkNpc,
  onStartRitual,
  onOpenCodex,
  onOpenSettings,
  onToggleAudio
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [activeLandmark, setActiveLandmark] = useState<LandmarkTrigger | null>(null);
  const [investigatingLandmark, setInvestigatingLandmark] = useState<LandmarkTrigger | null>(null);
  const [isCloseUp, setIsCloseUp] = useState(false);
  const [activeNpcDialogue, setActiveNpcDialogue] = useState<{
    role: "curator" | "boatman" | "spirit" | "museum" | "system";
    speaker: string;
    lines: string[];
    index: number;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("dusk");
  const [isBirdsEye, setIsBirdsEye] = useState(false);
  const [compassAngle, setCompassAngle] = useState(0);

  // Waypoint guide DOM refs for zero-allocation 60fps updates
  const waypointArrowRef = useRef<HTMLDivElement | null>(null);
  const waypointDistRef = useRef<HTMLSpanElement | null>(null);
  const prevDistRef = useRef<number>(-1);

  // Synchronized state for objective, inventory, and flags
  const [syncedObjective, setSyncedObjective] = useState<string>(() => objective ?? "");
  const [syncedInventory, setSyncedInventory] = useState<string[]>(() => {
    if (inventory && inventory.length > 0) return inventory.map((i) => i.id);
    return [];
  });
  const [syncedFlags, setSyncedFlags] = useState<Record<string, boolean>>(() => flags ?? {});

  useEffect(() => {
    if (objective) setSyncedObjective(objective);
  }, [objective]);

  useEffect(() => {
    if (inventory) setSyncedInventory(inventory.map((i) => i.id));
  }, [inventory]);

  useEffect(() => {
    if (flags) setSyncedFlags(flags);
  }, [flags]);

  useEffect(() => {
    const handleState = (e: Event) => {
      const custom = e as CustomEvent;
      if (!custom.detail) return;
      if (custom.detail.objective) setSyncedObjective(custom.detail.objective);
      if (Array.isArray(custom.detail.inventory)) {
        setSyncedInventory(custom.detail.inventory.map((item: any) => item.id));
      }
      if (custom.detail.flags) {
        setSyncedFlags(custom.detail.flags);
      }
    };
    window.addEventListener("lcw:state", handleState);
    return () => window.removeEventListener("lcw:state", handleState);
  }, []);

  // Compute acquired relics
  const acquiredRelicIds = new Set<string>();
  if (syncedFlags.jigsaw || syncedInventory.includes("badang-stone") || (completedPuzzles ?? 0) >= 1) {
    acquiredRelicIds.add("badang-stone");
  }
  if (syncedFlags.runes || syncedInventory.includes("rune-plaque") || (completedPuzzles ?? 0) >= 2) {
    acquiredRelicIds.add("rune-plaque");
  }
  if (syncedFlags.lock || syncedInventory.includes("harbor-seal") || (completedPuzzles ?? 0) >= 3) {
    acquiredRelicIds.add("harbor-seal");
  }
  if (ritualComplete || syncedFlags.rhythm || syncedInventory.includes("spirit-chime")) {
    acquiredRelicIds.add("spirit-chime");
  }

  const guidedTarget = computeGuidedTarget(syncedFlags, ritualComplete, museumComplete, acquiredRelicIds.size);
  const guidedTargetRef = useRef<GuidedTarget | null>(guidedTarget);
  guidedTargetRef.current = guidedTarget;

  // References for the 3D loop
  const envRef = useRef<World3DEnvironment | null>(null);
  const playerRef = useRef<World3DPlayer | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const envMapsRef = useRef<Record<TimeOfDay, THREE.WebGLRenderTarget> | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const camControllerRef = useRef<World3DCameraController | null>(null);
  const compassIconRef = useRef<HTMLDivElement | null>(null);

  // Synchronize landmark progression state to environment
  useEffect(() => {
    if (envRef.current) {
      envRef.current.setProgressionState(
        Array.from(acquiredRelicIds),
        ritualComplete || !!syncedFlags.rhythm,
        museumComplete
      );
    }
  }, [acquiredRelicIds, ritualComplete, syncedFlags.rhythm, museumComplete]);

  const keysPressed = useRef<Record<string, boolean>>({});
  const activeNpcDialogueRef = useRef(activeNpcDialogue);
  activeNpcDialogueRef.current = activeNpcDialogue;
  const activeLandmarkRef = useRef(activeLandmark);
  activeLandmarkRef.current = activeLandmark;
  const investigatingLandmarkRef = useRef(investigatingLandmark);
  investigatingLandmarkRef.current = investigatingLandmark;
  const isBirdsEyeRef = useRef(isBirdsEye);
  isBirdsEyeRef.current = isBirdsEye;
  const isCloseUpRef = useRef(isCloseUp);
  isCloseUpRef.current = isCloseUp;
  const modalOpenRef = useRef(modalOpen);
  modalOpenRef.current = modalOpen;

  useEffect(() => {
    if (modalOpen) {
      keysPressed.current = {};
    }
  }, [modalOpen]);

  const getNpcLines = useCallback((role: "curator" | "boatman") => {
    const copy = worldCopy[locale] || worldCopy.zh;
    if (role === "curator") {
      if (museumComplete) return copy.curatorMuseumDone;
      if (ritualComplete) return copy.curatorRitualDone;
      if (completedPuzzles >= 2) return copy.curatorReadyRitual;
      if (completedPuzzles >= 1) return copy.curatorOnePuzzle;
      return copy.curatorStart;
    } else {
      if (museumComplete) return copy.boatmanMuseumDone;
      if (ritualComplete) return copy.boatmanRitualDone;
      if (completedPuzzles >= 2) return copy.boatmanReadyRitual;
      if (completedPuzzles >= 1) return copy.boatmanOnePuzzle;
      return copy.boatmanStart;
    }
  }, [locale, completedPuzzles, ritualComplete, museumComplete]);

  const handleAdvanceNpcDialogue = useCallback(() => {
    playUiClick();
    setActiveNpcDialogue((prev) => {
      if (!prev) return null;
      if (prev.index + 1 < prev.lines.length) {
        return { ...prev, index: prev.index + 1 };
      }
      if (prev.onAction) {
        prev.onAction();
      }
      return null;
    });
  }, []);
  const handleAdvanceNpcDialogueRef = useRef(handleAdvanceNpcDialogue);
  handleAdvanceNpcDialogueRef.current = handleAdvanceNpcDialogue;

  const handleLandmarkInteract = useCallback((landmark: LandmarkTrigger) => {
    playUiClick();
    if (landmark.id === "curator" || landmark.id === "boatman") {
      const copy = worldCopy[locale] || worldCopy.zh;
      const speaker = landmark.id === "curator" ? copy.curator : copy.boatman;
      const lines = getNpcLines(landmark.id);
      setActiveNpcDialogue({
        role: landmark.id,
        speaker,
        lines,
        index: 0
      });
      onTalkNpc?.(landmark.id);
    } else if (landmark.id === "hop-hing") {
      playChimeResonance();
      setInvestigatingLandmark(landmark);
      setActiveNpcDialogue({
        role: "system",
        speaker: locale === "zh" ? "合兴南洋茶室 · 茶座老伯" : "Hop Hing Kopitiam · Tea Elders",
        lines:
          locale === "zh"
            ? [
                "「来喝杯热南洋咖啡吧！你看河岸东侧那块古文字石碑，上面锁着早年水手留下的四环青铜密码筒。」",
                "「老一辈下南洋的船工都记着那句口诀：『潮落见【海】，【狮】首镇【门】，【月】映星洲』——把四道铜环依次拨到【海 · 狮 · 门 · 月】，机关自会开启！」"
              ]
            : [
                "\"Have a cup of warm Nanyang kopi! East along the quay stands the Ancient Rune Plaque, sealed with a four-ring bronze cryptex.\"",
                "\"Every old river sailor knows the verse: 'Ebb tide reveals the [Sea], the [Lion] guards the [Gate], the [Moon] mirrors Singapura' — dial [Sea · Lion · Gate · Moon] to unlock it!\""
              ],
        index: 0,
        actionLabel: !syncedFlags.runes
          ? (locale === "zh" ? "前往破解密码筒 ➔" : "Open Cryptex Workshop ➔")
          : undefined,
        onAction: !syncedFlags.runes
          ? () => {
              setInvestigatingLandmark(null);
              onOpenWorkshop?.("runes");
            }
          : () => setInvestigatingLandmark(null)
      });
    } else if (landmark.id === "guan-huat") {
      playChimeResonance();
      setInvestigatingLandmark(landmark);
      setActiveNpcDialogue({
        role: "system",
        speaker: locale === "zh" ? "源发香料铺 · 航海星象账册" : "Guan Huat Spice Shop · Maritime Ledger",
        lines:
          locale === "zh"
            ? [
                "「翻开柜台上的檀木星象账册，里面夹着一张标注码头海门星盘（浑天秘匣）的黄铜图纸。」",
                "「图纸批注：『外环星宿顺转至 90°、中环度规转至 180°、内环潮相转至 270°，三枚金针同归正前子午线，四角锁舌即刻退避。』」"
              ]
            : [
                "\"Inside the sandalwood ledger on the counter lies a brass blueprint of the Harbor Astrolabe Box.\"",
                "\"The margin note reads: 'Align Outer Ring to 90°, Middle Ring to 180°, Inner Ring to 270° so all three golden pins meet on the front meridian.'\""
              ],
        index: 0,
        actionLabel: !syncedFlags.lock
          ? (locale === "zh" ? "前往校准浑天秘匣 ➔" : "Open Astrolabe Workshop ➔")
          : undefined,
        onAction: !syncedFlags.lock
          ? () => {
              setInvestigatingLandmark(null);
              onOpenWorkshop?.("lock");
            }
          : () => setInvestigatingLandmark(null)
      });
    } else if (landmark.id === "badang-stone") {
      playStoneGrind();
      onOpenWorkshop?.("jigsaw");
    } else if (landmark.id === "rune-plaque") {
      playStoneGrind();
      onOpenWorkshop?.("runes");
    } else if (landmark.id === "harbor-seal") {
      playGearTick();
      onOpenWorkshop?.("lock");
    } else if (landmark.id === "spirit-chime") {
      const isRitualDone = ritualComplete || syncedFlags.rhythm;
      const canDoRitual = (completedPuzzles ?? 0) >= 2 || acquiredRelicIds.size >= 2;
      if (isRitualDone) {
        playChimeResonance();
        onOpenVault?.("spirit-chime");
      } else if (canDoRitual) {
        playChimeResonance();
        setActiveNpcDialogue({
          role: "spirit",
          speaker: locale === "zh" ? "灵界清音入口" : "Spirit Realm Gateway",
          lines: [
            locale === "zh"
              ? "两段历史文物的共鸣已驱散了外围墨雾，水波间隐现灵界竹铃的四音节律。是否开启清音净化仪式？"
              : "Resonance from the restored relics has parted the outer ink fog. The four-tone melody of the Spirit Chime ripples across the water. Begin the purification rite?"
          ],
          index: 0,
          actionLabel: locale === "zh" ? "开启净化仪式 ➔" : "Begin Ritual ➔",
          onAction: () => {
            if (onStartRitual) {
              onStartRitual();
            } else {
              window.dispatchEvent(new CustomEvent("lcw:start-ritual"));
            }
          }
        });
      } else {
        playStoneGrind();
        const copy = worldCopy[locale] || worldCopy.zh;
        setActiveNpcDialogue({
          role: "spirit",
          speaker: locale === "zh" ? "灵界竹林结界" : "Spirit Gate Barrier",
          lines: [
            copy.ritualLockedLine ??
              (locale === "zh"
                ? "入口仍被墨雾遮住。至少修复两段线索后，仪式才会回应。"
                : "Ink fog still covers the gate. Restore at least two clues before the rite will answer.")
          ],
          index: 0
        });
      }
    } else if (landmark.id === "museum") {
      const hasAllRelics = acquiredRelicIds.size >= 4 || museumComplete;
      if (!hasAllRelics) {
        playStoneGrind();
        setActiveNpcDialogue({
          role: "museum",
          speaker: locale === "zh" ? "新加坡国家历史博物馆" : "National History Museum",
          lines: [
            locale === "zh"
              ? `博物馆展厅仍在筹备中。需要集齐四件失落的历史文物（巴当巨石碎片、狮门铭牌、海门钥纹、灵界清音）方可开发展览（当前已收集: ${acquiredRelicIds.size}/4 件）。`
              : `The museum exhibition is still in preparation. You must gather all four lost historical relics (Badang stone, Lion Gate plaque, Harbor key, Spirit chime) to open the exhibition (Current: ${acquiredRelicIds.size}/4 relics).`
          ],
          index: 0
        });
      } else {
        playUiClick();
        setActiveNpcDialogue({
          role: "museum",
          speaker: locale === "zh" ? "新加坡国家历史博物馆" : "National History Museum",
          lines: [
            locale === "zh"
              ? "四件失落的新加坡河历史文物已全部寻回！现在可以进入博物馆展厅，按历史年代布置展柜，完成狮城秘语终局展陈。"
              : "All four lost Singapore River historical relics have been recovered! You may now enter the museum gallery to curate the cases in chronological order and complete the exhibition."
          ],
          index: 0,
          actionLabel: locale === "zh" ? "进入展厅布展 ➔" : "Enter Gallery ➔",
          onAction: () => {
            onEnterMuseum?.();
          }
        });
      }
    } else if (landmark.id === "merlion") {
      playStoneGrind();
      setInvestigatingLandmark(landmark);
      setActiveNpcDialogue({
        role: "system",
        speaker: locale === "zh" ? "鱼尾狮滨水石阶 · 1972原塑考据" : "Merlion Waterfront Steps · 1972 Heritage",
        lines:
          locale === "zh"
            ? [
                "「狮首象征十四世纪桑·尼拉·乌塔玛王子所见的瑞狮（Singapura），鱼尾则铭记淡马锡（Temasek）古老渔村的海洋渊源。」",
                "「底座水流与河畔古石遥相呼应，你可以在 3D 藏品室中微距鉴赏已复原的河岸文物。」"
              ]
            : [
                "\"The lion head honors Prince Sang Nila Utama's sighting of a lion (Singapura), while the fish tail recalls the ancient sea town of Temasek.\"",
                "\"Its waters echo the ancient river relics — you may inspect your restored artifacts up close in the 3D Relic Vault.\""
              ],
        index: 0,
        actionLabel: locale === "zh" ? "开启 3D 藏品室 ➔" : "Open 3D Relic Vault ➔",
        onAction: () => {
          setInvestigatingLandmark(null);
          onOpenVault?.("badang-stone");
        }
      });
    }
  }, [
    onOpenWorkshop,
    onOpenVault,
    onEnterMuseum,
    onTalkNpc,
    onStartRitual,
    getNpcLines,
    locale,
    completedPuzzles,
    ritualComplete,
    museumComplete,
    syncedFlags.runes,
    syncedFlags.lock,
    syncedFlags.rhythm,
    acquiredRelicIds.size
  ]);
  const handleLandmarkInteractRef = useRef(handleLandmarkInteract);
  handleLandmarkInteractRef.current = handleLandmarkInteract;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // Scene & Renderer
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x131a22);
    scene.fog = new THREE.FogExp2(0x131a22, 0.0055);

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.5, 300);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance"
    });
    rendererRef.current = renderer;
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    // Pre-bake PMREM IBL environment maps for Dawn, Dusk & Night (zero frame allocations)
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envMaps: Record<TimeOfDay, THREE.WebGLRenderTarget> = {
      dawn: pmrem.fromEquirectangular(getEquirectEnvTexture("dawn")),
      dusk: pmrem.fromEquirectangular(getEquirectEnvTexture("dusk")),
      night: pmrem.fromEquirectangular(getEquirectEnvTexture("night"))
    };
    pmrem.dispose();
    envMapsRef.current = envMaps;
    scene.environment = envMaps[timeOfDay].texture;

    // Environment & Player
    const env = new World3DEnvironment();
    envRef.current = env;
    env.setProgressionState(
      Array.from(acquiredRelicIds),
      ritualComplete || !!syncedFlags.rhythm,
      museumComplete
    );
    scene.add(env.root);

    const player = new World3DPlayer();
    playerRef.current = player;
    scene.add(player.root);

    const camController = new World3DCameraController(player.position);
    camControllerRef.current = camController;

    if (typeof window !== "undefined") {
      (window as any).__lcwWorld3D = {
        player,
        env,
        camera,
        camController,
        camState: camController.state
      };
    }

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    // Mouse / Touch Orbit Controls
    const onMouseDown = (e: MouseEvent) => {
      camController.handleMouseDown(e);
    };

    const onMouseMove = (e: MouseEvent) => {
      camController.handleMouseMove(e);
    };

    const onMouseUp = () => {
      camController.handleMouseUp();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camController.handleWheel(e.deltaY);
    };

    // Click to move raycasting
    const raycaster = new THREE.Raycaster();
    const mouseNDC = new THREE.Vector2();

    const onPointerClick = (e: MouseEvent) => {
      if (camController.state.isDragging) return;
      const rect = canvas.getBoundingClientRect();
      mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouseNDC, camera);
      const hits = raycaster.intersectObjects(env.walkableMeshes, true);
      if (hits.length > 0) {
        const dest = hits[0].point;
        player.setDestination(dest);
        if (investigatingLandmarkRef.current) {
          setInvestigatingLandmark(null);
        }
      }
    };

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("click", onPointerClick);

    // Keyboard controls
    const onKeyDown = (e: KeyboardEvent) => {
      if (modalOpenRef.current) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      keysPressed.current[e.code] = true;
      if (e.code === "Space" || e.code === "KeyE" || e.code === "Enter") {
        if (activeNpcDialogueRef.current) {
          e.preventDefault();
          handleAdvanceNpcDialogueRef.current();
          return;
        }
        if (investigatingLandmarkRef.current) {
          e.preventDefault();
          setInvestigatingLandmark(null);
          return;
        }
        if (activeLandmarkRef.current) {
          e.preventDefault();
          handleLandmarkInteractRef.current(activeLandmarkRef.current);
        }
      } else if (e.code === "Escape") {
        if (investigatingLandmarkRef.current) {
          e.preventDefault();
          setInvestigatingLandmark(null);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // Main Animation Loop
    const clock = new THREE.Clock();
    const animate = () => {
      const delta = Math.min(clock.getDelta(), 0.1);
      const time = clock.getElapsedTime();

      // Keyboard input vector
      STATIC_INPUT.set(0, 0);
      if (!modalOpenRef.current) {
        if (keysPressed.current["KeyW"] || keysPressed.current["ArrowUp"]) STATIC_INPUT.y -= 1;
        if (keysPressed.current["KeyS"] || keysPressed.current["ArrowDown"]) STATIC_INPUT.y += 1;
        if (keysPressed.current["KeyA"] || keysPressed.current["ArrowLeft"]) STATIC_INPUT.x -= 1;
        if (keysPressed.current["KeyD"] || keysPressed.current["ArrowRight"]) STATIC_INPUT.x += 1;
      }

      // Transform input vector by camera azimuth angle so W is forward relative to camera!
      if (STATIC_INPUT.lengthSq() > 0) {
        STATIC_INPUT.normalize();
        const sin = Math.sin(camController.state.azimuth);
        const cos = Math.cos(camController.state.azimuth);
        const transformedX = STATIC_INPUT.x * cos - STATIC_INPUT.y * sin;
        const transformedZ = STATIC_INPUT.x * sin + STATIC_INPUT.y * cos;
        STATIC_INPUT.set(transformedX, transformedZ);

        if (investigatingLandmarkRef.current) {
          setInvestigatingLandmark(null);
        }
      }

      // Update player
      player.update(delta, STATIC_INPUT);
      env.update(time, delta);

      // Proximity detection for landmarks
      let closest: LandmarkTrigger | null = null;
      let minDistance = Infinity;
      for (const lm of env.landmarks) {
        const d = player.position.distanceTo(lm.position);
        if (d < lm.radius && d < minDistance) {
          minDistance = d;
          closest = lm;
        }
      }
      if (closest?.id !== activeLandmarkRef.current?.id) {
        setActiveLandmark(closest);
        if (closest?.investigation?.targetDistance) {
          camController.resetMacroDistance(closest.investigation.targetDistance);
        } else if (!closest) {
          camController.resetMacroDistance(5.2);
        }
      }
      if (!closest && investigatingLandmarkRef.current) {
        setInvestigatingLandmark(null);
      }

      // Close-up Macro State Synchronization
      const isBirdsEyeCurrent = isBirdsEyeRef.current;
      const shouldCloseUp = (closest !== null || !!activeNpcDialogueRef.current || !!investigatingLandmarkRef.current) && !isBirdsEyeCurrent;
      if (shouldCloseUp !== isCloseUpRef.current) {
        setIsCloseUp(shouldCloseUp);
        isCloseUpRef.current = shouldCloseUp;
        env.setMacroInvestigation(shouldCloseUp);
      }

      // Update camera controller
      const targetLandmark = investigatingLandmarkRef.current ?? closest;
      camController.update(delta, player.position, targetLandmark, isBirdsEyeCurrent, camera);

      // Compass needle sync
      if (compassIconRef.current) {
        const deg = (camController.state.azimuth * 180) / Math.PI;
        compassIconRef.current.style.transform = `rotate(${-deg}deg)`;
      }

      // Waypoint arrow bearing & distance sync (pure scalar math, zero heap allocations)
      if (waypointArrowRef.current && guidedTargetRef.current && playerRef.current) {
        const p = playerRef.current.position;
        const t = guidedTargetRef.current.position;
        const dx = t.x - p.x;
        const dz = t.z - p.z;
        const dist = Math.round(Math.hypot(dx, dz));
        if (dist !== prevDistRef.current) {
          prevDistRef.current = dist;
          if (waypointDistRef.current) {
            waypointDistRef.current.textContent = `${dist}m`;
          }
        }
        const targetAngle = Math.atan2(dx, dz);
        const relativeDeg = ((targetAngle - camController.state.azimuth) * 180) / Math.PI;
        waypointArrowRef.current.style.transform = `rotate(${relativeDeg}deg)`;
      }

      renderer.render(scene, camera);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("click", onPointerClick);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (typeof window !== "undefined") {
        delete (window as any).__lcwWorld3D;
      }
      env.dispose();
      player.dispose();
      if (envMapsRef.current) {
        envMapsRef.current.dawn.dispose();
        envMapsRef.current.dusk.dispose();
        envMapsRef.current.night.dispose();
        envMapsRef.current = null;
      }
      renderer.dispose();
    };
  }, []);

  // Lighting switcher effect
  useEffect(() => {
    if (envRef.current) {
      envRef.current.setupLighting(timeOfDay);
    }
    if (sceneRef.current && envMapsRef.current) {
      sceneRef.current.environment = envMapsRef.current[timeOfDay].texture;
    }
  }, [timeOfDay]);

  return (
    <div className="world-3d-fullscreen" ref={containerRef}>
      <canvas ref={canvasRef} className="world-3d-canvas" />
      <div className="world-3d-vignette" />
      <div className={`world-3d-macro-focus ${isCloseUp ? "active" : ""}`} />

      {/* 1. 3D Diegetic Quest Objective HUD */}
      <div className="world-3d-objective-bar" role="status" aria-live="polite">
        <div className="world-3d-objective-icon-wrapper">
          <Sparkles size={16} className="world-3d-objective-sparkle" />
        </div>
        <div className="world-3d-objective-content">
          <span className="world-3d-objective-label">
            {locale === "zh" ? "当前目标" : "CURRENT OBJECTIVE"}
          </span>
          <span className="world-3d-objective-text">
            {syncedObjective || (locale === "zh" ? "漫游新加坡河畔，寻找失落的古文物线索" : "Explore the Singapore River for lost historical relics")}
          </span>
        </div>
        <div className="world-3d-objective-counter" title={locale === "zh" ? "已复原文物进度" : "Relic Restoration Progress"}>
          <span className="world-3d-counter-num">{acquiredRelicIds.size}</span>
          <span className="world-3d-counter-divider">/</span>
          <span className="world-3d-counter-total">4</span>
        </div>
      </div>

      {/* 2. 3D Relic Inventory Dock (Bottom-Left) */}
      <div className="world-3d-relic-dock" aria-label={locale === "zh" ? "已收集文物" : "Relic Inventory"}>
        {RELIC_DEFINITIONS.map((relic) => {
          const isAcquired = acquiredRelicIds.has(relic.id);
          return (
            <button
              key={relic.id}
              type="button"
              className={`world-3d-relic-pill ${isAcquired ? "acquired" : "locked"}`}
              onClick={() => {
                if (isAcquired) {
                  playUiClick();
                  onOpenVault?.(relic.id);
                }
              }}
              disabled={!isAcquired}
              title={
                isAcquired
                  ? (locale === "zh" ? `点击鉴赏 3D 特藏：${relic.nameZh}` : `Inspect in 3D Vault: ${relic.nameEn}`)
                  : (locale === "zh" ? `未解锁：${relic.nameZh}` : `Locked: ${relic.nameEn}`)
              }
            >
              <span className="world-3d-relic-glyph">
                {isAcquired ? relic.glyph[locale] : "🔒"}
              </span>
              <span className="world-3d-relic-name">
                {locale === "zh" ? relic.nameZh : relic.nameEn}
              </span>
              {isAcquired && <span className="world-3d-relic-tag">3D</span>}
            </button>
          );
        })}
      </div>

      {/* Top Controls & Navigation Bar */}
      <div className="world-3d-header">
        <div className="world-3d-brand">
          <Navigation size={18} className="world-3d-icon-pulse" />
          <div>
            <h3>{locale === "zh" ? "狮城微缩探索世界" : "Lion City 3D Miniature Realm"}</h3>
            <small>{locale === "zh" ? "新加坡河全景 · 3D 自由漫游探索" : "Singapore River 3D Diorama Roaming"}</small>
          </div>
        </div>

        {/* Time of Day Presets */}
        <div className="world-3d-time-selector">
          <button
            type="button"
            className={`world-3d-pill-btn ${timeOfDay === "dawn" ? "active" : ""}`}
            onClick={() => setTimeOfDay("dawn")}
            title={locale === "zh" ? "晨曦初晓" : "Dawn"}
          >
            <Sunrise size={14} />
            <span>{locale === "zh" ? "晨曦" : "Dawn"}</span>
          </button>
          <button
            type="button"
            className={`world-3d-pill-btn ${timeOfDay === "dusk" ? "active" : ""}`}
            onClick={() => setTimeOfDay("dusk")}
            title={locale === "zh" ? "暮色金辉" : "Dusk"}
          >
            <Sun size={14} />
            <span>{locale === "zh" ? "黄昏" : "Dusk"}</span>
          </button>
          <button
            type="button"
            className={`world-3d-pill-btn ${timeOfDay === "night" ? "active" : ""}`}
            onClick={() => setTimeOfDay("night")}
            title={locale === "zh" ? "璀璨夜市" : "Night"}
          >
            <Moon size={14} />
            <span>{locale === "zh" ? "夜色" : "Night"}</span>
          </button>
        </div>

        {/* View Toggle & Quick Actions */}
        <div className="world-3d-actions">
          {acquiredRelicIds.size >= 4 && !museumComplete && onEnterMuseum && (
            <button
              type="button"
              className="world-3d-pill-btn gold-cta"
              onClick={() => {
                playUiClick();
                onEnterMuseum();
              }}
              title={locale === "zh" ? "集齐四件文物，前往博物馆展厅布展" : "All 4 relics restored — Enter Museum Gallery"}
            >
              <Landmark size={15} />
              <span>{locale === "zh" ? "前往布展" : "Curate"}</span>
            </button>
          )}

          <button
            type="button"
            className={`world-3d-pill-btn ${isBirdsEye ? "active" : ""}`}
            onClick={() => setIsBirdsEye((prev) => !prev)}
            title={locale === "zh" ? "切换俯瞰全景视角" : "Toggle Birds-Eye View"}
          >
            <Eye size={15} />
            <span>{locale === "zh" ? (isBirdsEye ? "跟随视角" : "微缩全景") : (isBirdsEye ? "Follow" : "Diorama")}</span>
          </button>

          {onOpenCodex && (
            <button
              type="button"
              className="world-3d-pill-btn"
              onClick={() => {
                playUiClick();
                onOpenCodex();
              }}
              title={locale === "zh" ? "打开历史考据图鉴" : "Open Historical Codex"}
            >
              <BookOpen size={15} />
              <span>{locale === "zh" ? "图鉴" : "Codex"}</span>
            </button>
          )}

          {onToggleAudio && (
            <button
              type="button"
              className="world-3d-pill-btn"
              onClick={() => {
                playUiClick();
                onToggleAudio();
              }}
              title={locale === "zh" ? (muted ? "开启音效" : "静音") : (muted ? "Unmute" : "Mute")}
            >
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
          )}

          {onOpenSettings && (
            <button
              type="button"
              className="world-3d-pill-btn"
              onClick={() => {
                playUiClick();
                onOpenSettings();
              }}
              title={locale === "zh" ? "游戏设置与语言切换" : "Game Settings"}
            >
              <Settings size={15} />
            </button>
          )}

          <button
            type="button"
            className="world-3d-close-btn"
            onClick={onClose}
            aria-label={locale === "zh" ? "退出 3D 世界" : "Exit 3D World"}
            title={locale === "zh" ? "切换至 2D 绘卷模式" : "Switch to 2D Mode"}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Floating Interaction Prompt */}
      {activeLandmark && !activeNpcDialogue && (
        <div
          className={`world-3d-interact-badge ${investigatingLandmark ? "active-investigating" : ""}`}
          onClick={() => handleLandmarkInteract(activeLandmark)}
          role="button"
          tabIndex={0}
        >
          <Sparkles size={18} className="interact-sparkle" />
          <div className="interact-text">
            <strong>{locale === "zh" ? activeLandmark.nameZh : activeLandmark.nameEn}</strong>
            <small>
              {investigatingLandmark
                ? (locale === "zh" ? "正在近距探查 · 按 [空格 / E / 漫游] 退出" : "Inspecting · Press [Space / E / Move] to exit")
                : (locale === "zh"
                    ? (activeLandmark.promptZh ?? (activeLandmark.id === "curator" || activeLandmark.id === "boatman"
                        ? "按 [空格 / E] 或点击与人物交谈"
                        : "按 [空格 / E] 或点击开始调查"))
                    : (activeLandmark.promptEn ?? (activeLandmark.id === "curator" || activeLandmark.id === "boatman"
                        ? "Press [Space / E] or click to talk"
                        : "Press [Space / E] or click to investigate")))}
            </small>
          </div>
          <button type="button" className="interact-action-btn">
            {investigatingLandmark
              ? (locale === "zh" ? "退出探查" : "Back")
              : (locale === "zh"
                  ? (activeLandmark.actionZh ?? (activeLandmark.id === "curator" || activeLandmark.id === "boatman" ? "交谈对话" : "进入探索"))
                  : (activeLandmark.actionEn ?? (activeLandmark.id === "curator" || activeLandmark.id === "boatman" ? "Talk" : "Explore")))}
          </button>
        </div>
      )}

      {/* In-World 3D NPC Dialogue Card */}
      {activeNpcDialogue && (
        <div
          className="world-3d-npc-dialogue"
          onClick={handleAdvanceNpcDialogue}
          role="dialog"
          aria-label={activeNpcDialogue.speaker}
        >
          <div className="world-3d-npc-speaker-pill">
            <span className="npc-avatar-badge">
              {activeNpcDialogue.role === "curator"
                ? "🏛️"
                : activeNpcDialogue.role === "boatman"
                ? "🛶"
                : activeNpcDialogue.role === "spirit"
                ? "🎋"
                : activeNpcDialogue.role === "museum"
                ? "🏛️"
                : "📜"}
            </span>
            <strong>{activeNpcDialogue.speaker}</strong>
            <span className="npc-line-counter">
              {activeNpcDialogue.index + 1} / {activeNpcDialogue.lines.length}
            </span>
          </div>
          <p className="world-3d-npc-text">
            {activeNpcDialogue.lines[activeNpcDialogue.index]}
          </p>
          <div className="world-3d-npc-actions">
            <span className="world-3d-npc-hint">
              {locale === "zh" ? "按 [空格 / E / 回车] 或点击继续" : "Press [Space / E / Enter] or click to continue"}
            </span>
            <button
              type="button"
              className="world-3d-npc-next-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleAdvanceNpcDialogue();
              }}
            >
              {activeNpcDialogue.index < activeNpcDialogue.lines.length - 1
                ? (locale === "zh" ? "下一句 ➔" : "Next ➔")
                : (activeNpcDialogue.actionLabel ?? (locale === "zh" ? "完成对话 ✓" : "Done ✓"))}
            </button>
          </div>
        </div>
      )}

      {/* Mini-Compass & Roaming Guide */}
      <div className="world-3d-footer">
        <div className="world-3d-footer-nav">
          <div className="world-3d-compass-box">
            <div ref={compassIconRef} style={{ display: "inline-flex", willChange: "transform" }}>
              <Compass size={20} />
            </div>
            <span>{locale === "zh" ? "新加坡河畔" : "River Quay"}</span>
          </div>

          {guidedTarget && (
            <button
              type="button"
              className="world-3d-waypoint-guide"
              onClick={() => {
                if (!playerRef.current || !guidedTarget) return;
                playUiClick();
                STATIC_NAV_TARGET.set(guidedTarget.position.x, guidedTarget.position.y, guidedTarget.position.z);
                playerRef.current.setDestination(STATIC_NAV_TARGET);
              }}
              title={locale === "zh" ? `点击寻路前往：${guidedTarget.nameZh}` : `Click to navigate to ${guidedTarget.nameEn}`}
            >
              <div ref={waypointArrowRef} className="waypoint-arrow" style={{ display: "inline-flex", willChange: "transform" }}>
                <Navigation size={14} />
              </div>
              <span className="waypoint-target-name">
                {locale === "zh" ? guidedTarget.nameZh : guidedTarget.nameEn}
              </span>
              <span ref={waypointDistRef} className="waypoint-distance">--m</span>
            </button>
          )}

          {!guidedTarget && museumComplete && (
            <div className="world-3d-waypoint-guide completed">
              <span className="waypoint-target-name">
                {locale === "zh" ? "全要素展陈已完成 ✓" : "Exhibition Complete ✓"}
              </span>
            </div>
          )}
        </div>

        <div className="world-3d-guide-pill">
          <span>{locale === "zh" ? "💡 [W/A/S/D] 移动 · [鼠标左键拖拽] 环视 · [滚轮] 缩放 · [点击地面] 导航寻路" : "💡 [W/A/S/D] Walk · [Mouse Drag] Orbit · [Wheel] Zoom · [Click Ground] Navigate"}</span>
        </div>
      </div>
    </div>
  );
};
