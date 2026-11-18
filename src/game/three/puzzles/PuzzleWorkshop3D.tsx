import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { X, RotateCw, RotateCcw, Check, Sparkles, Box, ShieldCheck, RefreshCw } from "lucide-react";
import { createMegalithWorkshop, MegalithWorkshopHandle } from "./MegalithWorkshop3D";
import { createCryptexWorkshop, CryptexWorkshopHandle } from "./CryptexPuzzle3D";
import { createAstrolabeWorkshop, AstrolabeWorkshopHandle } from "./AstrolabeBox3D";
import { getEquirectEnvTexture, getMuseumBackdropTexture, isSoftwareWebGLRenderer } from "../world/World3DTextures";
import { playStoneGrind, playGearTick, playSnap, playKintsugiAwaken, playUiClick, playSuccess, playMiss } from "@/game/audio";

export type Puzzle3DType = "jigsaw" | "runes" | "lock";

interface PuzzleWorkshop3DProps {
  puzzleType: Puzzle3DType;
  locale: "zh" | "en";
  easyMode?: boolean;
  onClose: () => void;
  onSolve: (puzzleType: Puzzle3DType) => void;
}

export function PuzzleWorkshop3D({
  puzzleType,
  locale,
  easyMode = true,
  onClose,
  onSolve
}: PuzzleWorkshop3DProps) {
  const isZh = locale === "zh";
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Puzzle workshop instances
  const megalithRef = useRef<MegalithWorkshopHandle | null>(null);
  const cryptexRef = useRef<CryptexWorkshopHandle | null>(null);
  const astrolabeRef = useRef<AstrolabeWorkshopHandle | null>(null);

  // Active state
  const [selectedPieceIndex, setSelectedPieceIndex] = useState<number>(0);
  const [solved, setSolved] = useState<boolean>(false);
  const [cryptexCode, setCryptexCode] = useState<string[]>([]);
  const [snappedPieces, setSnappedPieces] = useState<string[]>([]);
  const [alignedRings, setAlignedRings] = useState<boolean[]>([false, false, false]);
  const [megalithAngleDeg, setMegalithAngleDeg] = useState<number>(-60);
  const [astrolabeAngles, setAstrolabeAngles] = useState<{ current: number; target: number }[]>([
    { current: 0, target: 90 },
    { current: 60, target: 180 },
    { current: 120, target: 270 }
  ]);
  const [snapShake, setSnapShake] = useState<boolean>(false);
  const shakeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (shakeTimerRef.current !== null) {
        window.clearTimeout(shakeTimerRef.current);
      }
    };
  }, []);

  const triggerSnapShake = () => {
    if (shakeTimerRef.current !== null) {
      window.clearTimeout(shakeTimerRef.current);
    }
    setSnapShake(true);
    shakeTimerRef.current = window.setTimeout(() => {
      setSnapShake(false);
      shakeTimerRef.current = null;
    }, 800);
  };

  const titles: Record<Puzzle3DType, { title: string; subtitle: string; tip: string; clue: string }> = {
    jigsaw: {
      title: isZh ? "古石重铸 · 3D工坊" : "Megalith Forge · 3D Workshop",
      subtitle: isZh
        ? "新加坡巨石碎裂为三。旋转对齐残片角度，卡入 Altar 底座，触发金缮脉络复苏。"
        : "The Singapore Stone fractured in three. Rotate and snap fragments into the altar.",
      tip: isZh ? "选择残片并旋转至 0° 对准中央插槽，点击【卡合定位】（快捷键: 1-3 切换 / ←→ 旋转 / 空格 卡合）" : "Select fragment, rotate to 0° to align, then click [Snap to Altar]",
      clue: isZh
        ? "📜 考据线索：古石铭文自左向右为「力 · 石 · 潮」，将每块残片旋转至 0° 正向即可严丝合缝嵌入底座。"
        : "📜 Clue: Inscription reads 'Power · Stone · Tide'. Rotate each fragment to 0° to snap into the socket."
    },
    runes: {
      title: isZh ? "青铜密码筒 · 3D工坊" : "Bronze Cryptex · 3D Workshop",
      subtitle: isZh
        ? "古代航海家的机关密码筒。拨动4组铜环，使其在中央基准线上拼出秘语「海狮门月」。"
        : "Ancient navigator cryptex. Turn the 4 rings to form 'Sea, Lion, Gate, Moon'.",
      tip: isZh ? "选中圆环，使用上下箭头拨动符文面（快捷键: 1-4 选环 / ↑↓ 拨动）" : "Select ring and rotate to match the navigation cipher",
      clue: isZh
        ? "📜 考据线索：合兴茶室长老口耳相传的航海秘语——「潮落见【海】，【狮】首镇【门】，【月】映星洲」。"
        : "📜 Clue: The river elders' maritime verse — 'Ebb tide reveals the [Sea], the [Lion] guards the [Gate], the [Moon] mirrors Singapura'."
    },
    lock: {
      title: isZh ? "浑天秘匣 · 3D工坊" : "Astrolabe Box · 3D Workshop",
      subtitle: isZh
        ? "多环联动机关锁。调整三层黄铜齿轮环的星宿度数，解除四角液压锁舌。"
        : "Concentric astrolabe lock. Align the 3 brass gear rings to retract the corner bolts.",
      tip: isZh ? "选中齿轮环，微调旋转至金针指向正前子午线，点击【校准啮合】（快捷键: 1-3 选环 / ←→ 旋转 / 空格 校准）" : "Select gear ring, fine-tune rotation, and click [Align Ring]",
      clue: isZh
        ? "📜 考据线索：源发香料铺星象账册记载——外环 90°、中环 180°、内环 270°，令三枚金针同指正前子午线。"
        : "📜 Clue: Spice ledger records — Outer 90°, Middle 180°, Inner 270° aligns all three golden pins along the front meridian."
    }
  };

  const currentInfo = titles[puzzleType];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    const isSoftwareWebGL = isSoftwareWebGLRenderer(renderer);
    const initWidth = Math.max(canvas.parentElement?.clientWidth || canvas.clientWidth || 840, 320);
    const initHeight = Math.max(canvas.parentElement?.clientHeight || canvas.clientHeight || 420, 260);
    renderer.setPixelRatio(isSoftwareWebGL ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(initWidth, initHeight, false);
    renderer.shadowMap.enabled = !isSoftwareWebGL;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    scene.background = getMuseumBackdropTexture(false);

    let studioEnvRT: THREE.WebGLRenderTarget | null = null;
    if (!isSoftwareWebGL) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      studioEnvRT = pmrem.fromEquirectangular(getEquirectEnvTexture("studio"));
      pmrem.dispose();
      scene.environment = studioEnvRT.texture;
    }

    const camera = new THREE.PerspectiveCamera(
      puzzleType === "runes" ? 42 : 44,
      initWidth / initHeight,
      0.1,
      100
    );
    if (puzzleType === "jigsaw") {
      camera.position.set(0, 1.85, 7.65);
      camera.lookAt(0, -0.78, 0);
    } else if (puzzleType === "runes") {
      camera.position.set(0, 1.32, 6.85);
      camera.lookAt(0, -0.58, 0);
    } else {
      camera.position.set(0, 4.75, 7.35);
      camera.lookAt(0, -1.18, 0);
    }

    // Dynamic 4-point + Hemisphere Museum Restorer Lighting
    const ambientLight = new THREE.AmbientLight(0xfffaf0, 0.65);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xfff6e5, 0x162725, 0.82);
    scene.add(hemiLight);

    const keySpot = new THREE.SpotLight(0xfffaed, 2.8, 24, Math.PI / 3.4, 0.45, 1);
    keySpot.position.set(4.6, 7.2, 5.8);
    keySpot.castShadow = !isSoftwareWebGL;
    scene.add(keySpot);

    const frontLight = new THREE.DirectionalLight(0xfff2d8, 1.75);
    frontLight.position.set(-2.2, 2.4, 6.4);
    scene.add(frontLight);

    const rimLight = new THREE.DirectionalLight(0x3de0c8, 1.35);
    rimLight.position.set(-5.8, 3.2, -4.5);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0xd4a44c, 0.85);
    fillLight.position.set(3.2, -2.5, 4.2);
    scene.add(fillLight);

    // Initialize Workshop Scene based on puzzleType
    let workshopRoot: THREE.Group | null = null;

    if (puzzleType === "jigsaw") {
      const workshop = createMegalithWorkshop((snappedId) => {
        setSnappedPieces((prev) => [...prev, snappedId]);
        if (workshop.isComplete()) {
          setSolved(true);
        }
      });
      megalithRef.current = workshop;
      workshopRoot = workshop.root;
      scene.add(workshop.root);
      workshop.selectPiece("left");
      setMegalithAngleDeg(workshop.getPieceAngleDeg("left"));
    } else if (puzzleType === "runes") {
      const workshop = createCryptexWorkshop(() => {
        setSolved(true);
      });
      cryptexRef.current = workshop;
      workshopRoot = workshop.root;
      scene.add(workshop.root);
      setCryptexCode(workshop.getCombination());
    } else if (puzzleType === "lock") {
      const workshop = createAstrolabeWorkshop(() => {
        setSolved(true);
      });
      astrolabeRef.current = workshop;
      workshopRoot = workshop.root;
      scene.add(workshop.root);
      setAstrolabeAngles(workshop.getRingAnglesDeg());
    }

    // Orbit / Mouse Drag + Direct 3D Raycast Picking Interaction
    let isDragging = false;
    let downMouseX = 0;
    let downMouseY = 0;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let targetRotationY = 0;
    let targetRotationX = 0;
    let currentRotationY = 0;
    let currentRotationX = 0;
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      downMouseX = e.clientX;
      downMouseY = e.clientY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      targetRotationY += deltaX * 0.008;
      targetRotationX += deltaY * 0.005;
      targetRotationX = Math.max(-0.6, Math.min(0.6, targetRotationX));
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      const dragDist = Math.hypot(e.clientX - downMouseX, e.clientY - downMouseY);
      if (dragDist > 6 || !workshopRoot) return;

      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);

      if (puzzleType === "jigsaw" && megalithRef.current) {
        const pieceGroups = megalithRef.current.pieces.map((p) => p.mesh);
        const hits = raycaster.intersectObjects(pieceGroups, true);
        if (hits.length > 0) {
          let obj: THREE.Object3D | null = hits[0].object;
          while (obj && !pieceGroups.includes(obj as THREE.Group)) {
            obj = obj.parent;
          }
          const idx = pieceGroups.indexOf(obj as THREE.Group);
          if (idx !== -1) {
            playUiClick();
            setSelectedPieceIndex(idx);
            const pieceId = megalithRef.current.pieces[idx].id;
            megalithRef.current.selectPiece(pieceId);
            setMegalithAngleDeg(megalithRef.current.getPieceAngleDeg(pieceId));
          }
        }
      } else if (puzzleType === "runes" && cryptexRef.current) {
        const ringGroups = cryptexRef.current.rings.map((r) => r.group);
        const hits = raycaster.intersectObjects(ringGroups, true);
        if (hits.length > 0) {
          let obj: THREE.Object3D | null = hits[0].object;
          while (obj && !ringGroups.includes(obj as THREE.Group)) {
            obj = obj.parent;
          }
          const idx = ringGroups.indexOf(obj as THREE.Group);
          if (idx !== -1) {
            playUiClick();
            setSelectedPieceIndex(idx);
            cryptexRef.current.selectRing(idx);
          }
        }
      } else if (puzzleType === "lock" && astrolabeRef.current) {
        const ringGroups = astrolabeRef.current.rings.map((r) => r.group);
        const hits = raycaster.intersectObjects(ringGroups, true);
        if (hits.length > 0) {
          let obj: THREE.Object3D | null = hits[0].object;
          while (obj && !ringGroups.includes(obj as THREE.Group)) {
            obj = obj.parent;
          }
          const idx = ringGroups.indexOf(obj as THREE.Group);
          if (idx !== -1) {
            playUiClick();
            setSelectedPieceIndex(idx);
            astrolabeRef.current.selectRing(idx);
          }
        }
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    // Resize Handler
    const handleResize = () => {
      if (!canvas) return;
      const width = Math.max(canvas.parentElement?.clientWidth || canvas.clientWidth || 840, 320);
      const height = Math.max(canvas.parentElement?.clientHeight || canvas.clientHeight || 420, 260);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    window.addEventListener("resize", handleResize);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();
    let lastSoftwareRenderMs = -1000;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime() * 1000;

      // Smooth camera orbit rotation
      currentRotationY += (targetRotationY - currentRotationY) * 0.1;
      currentRotationX += (targetRotationX - currentRotationX) * 0.1;

      if (workshopRoot) {
        workshopRoot.rotation.y = currentRotationY;
        workshopRoot.rotation.x = currentRotationX;
      }

      // Update active workshop logic
      megalithRef.current?.update(elapsedTime, delta);
      cryptexRef.current?.update(elapsedTime, delta);
      astrolabeRef.current?.update(elapsedTime, delta);

      if (!isSoftwareWebGL || elapsedTime - lastSoftwareRenderMs >= 80) {
        lastSoftwareRenderMs = elapsedTime;
        renderer.render(scene, camera);
      }
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);

      megalithRef.current?.dispose();
      cryptexRef.current?.dispose();
      astrolabeRef.current?.dispose();
      studioEnvRT?.dispose();
      renderer.dispose();
    };
  }, [puzzleType]);

  // Handle Controls for Megalith
  const megalithPieces = ["left", "center", "right"];
  const megalithLabels = isZh ? ["残片·力", "残片·石", "残片·潮"] : ["Fragment: Power", "Fragment: Stone", "Fragment: Tide"];

  const handleSelectMegalithPiece = (index: number) => {
    playUiClick();
    setSelectedPieceIndex(index);
    const pieceId = megalithPieces[index];
    megalithRef.current?.selectPiece(pieceId);
    if (megalithRef.current) {
      setMegalithAngleDeg(megalithRef.current.getPieceAngleDeg(pieceId));
    }
  };

  const handleRotateMegalith = (direction: -1 | 1) => {
    playStoneGrind();
    megalithRef.current?.rotateSelectedPiece("y", direction * (Math.PI / 6));
    const pieceId = megalithPieces[selectedPieceIndex];
    if (megalithRef.current) {
      setMegalithAngleDeg(megalithRef.current.getPieceAngleDeg(pieceId));
    }
  };

  const handleSnapMegalith = () => {
    const pieceId = megalithPieces[selectedPieceIndex];
    const success = megalithRef.current?.trySnapPiece(pieceId, easyMode ?? false);
      if (success) {
        playSnap();
        setMegalithAngleDeg(0);
        if (megalithRef.current?.isComplete()) {
          playKintsugiAwaken();
          setSolved(true);
        } else {
          // Auto-select next unplaced piece
          const nextIdx = (selectedPieceIndex + 1) % 3;
          setSelectedPieceIndex(nextIdx);
          const nextId = megalithPieces[nextIdx];
          megalithRef.current?.selectPiece(nextId);
          if (megalithRef.current) {
            setMegalithAngleDeg(megalithRef.current.getPieceAngleDeg(nextId));
          }
        }
      } else {
        playMiss();
        triggerSnapShake();
      }
    };

  // Handle Controls for Cryptex
  const handleSelectCryptexRing = (index: number) => {
    playUiClick();
    setSelectedPieceIndex(index);
    cryptexRef.current?.selectRing(index);
  };

  const handleRotateCryptex = (step: 1 | -1) => {
    if (!cryptexRef.current) return;
    playGearTick();
    cryptexRef.current.rotateRing(selectedPieceIndex, step);
    setCryptexCode(cryptexRef.current.getCombination());
    if (cryptexRef.current.isComplete()) {
      playSuccess();
      setSolved(true);
    }
  };

  // Handle Controls for Astrolabe
  const astrolabeLabels = isZh ? ["外环·星宿", "中环·度规", "内环·潮相"] : ["Outer Ring", "Middle Ring", "Inner Ring"];

  const handleSelectAstrolabeRing = (index: number) => {
    playUiClick();
    setSelectedPieceIndex(index);
    astrolabeRef.current?.selectRing(index);
  };

  const handleRotateAstrolabe = (deltaDeg: number) => {
    if (!astrolabeRef.current) return;
    playGearTick();
    const rad = (deltaDeg * Math.PI) / 180;
    astrolabeRef.current.rotateRing(selectedPieceIndex, rad);
    setAlignedRings(astrolabeRef.current.rings.map((r) => r.isAligned));
    setAstrolabeAngles(astrolabeRef.current.getRingAnglesDeg());
    if (astrolabeRef.current.isComplete()) {
      playSuccess();
      setSolved(true);
    }
  };

  const handleSnapAstrolabeRing = () => {
    if (!astrolabeRef.current) return;
    const success = astrolabeRef.current.tryAlignRing(selectedPieceIndex, easyMode ?? false);
    setAlignedRings(astrolabeRef.current.rings.map((r) => r.isAligned));
    setAstrolabeAngles(astrolabeRef.current.getRingAnglesDeg());
    if (success) {
      if (astrolabeRef.current.isComplete()) {
        playSuccess();
        setSolved(true);
      } else {
        playSnap();
        const nextIdx = (selectedPieceIndex + 1) % 3;
        setSelectedPieceIndex(nextIdx);
        astrolabeRef.current.selectRing(nextIdx);
      }
    } else {
      playMiss();
      triggerSnapShake();
    }
  };

  // Keyboard shortcuts for smooth tactile puzzle solving
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (solved) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClaimSuccess();
        }
        return;
      }
      if (puzzleType === "jigsaw") {
        if (e.key === "1" || e.key === "2" || e.key === "3") {
          handleSelectMegalithPiece(Number(e.key) - 1);
        } else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
          e.preventDefault();
          handleRotateMegalith(-1);
        } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
          e.preventDefault();
          handleRotateMegalith(1);
        } else if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          handleSnapMegalith();
        }
      } else if (puzzleType === "runes") {
        if (e.key === "1" || e.key === "2" || e.key === "3" || e.key === "4") {
          handleSelectCryptexRing(Number(e.key) - 1);
        } else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
          e.preventDefault();
          handleSelectCryptexRing((selectedPieceIndex + 3) % 4);
        } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
          e.preventDefault();
          handleSelectCryptexRing((selectedPieceIndex + 1) % 4);
        } else if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") {
          e.preventDefault();
          handleRotateCryptex(1);
        } else if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") {
          e.preventDefault();
          handleRotateCryptex(-1);
        }
      } else if (puzzleType === "lock") {
        if (e.key === "1" || e.key === "2" || e.key === "3") {
          handleSelectAstrolabeRing(Number(e.key) - 1);
        } else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") {
          e.preventDefault();
          handleRotateAstrolabe(-15);
        } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") {
          e.preventDefault();
          handleRotateAstrolabe(15);
        } else if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          handleSnapAstrolabeRing();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const handleClaimSuccess = () => {
    onSolve(puzzleType);
    onClose();
  };

  return (
    <div className="artifact-3d-overlay" role="dialog" aria-modal="true" aria-label={currentInfo.title}>
      <div className="artifact-3d-modal puzzle-workshop-dialog">
        {/* Header Bar */}
        <header className="artifact-3d-header">
          <div className="header-titles">
            <span className="badge-3d">3D WORKSHOP</span>
            <h2>{currentInfo.title}</h2>
            <p className="puzzle-workshop-subtitle">{currentInfo.subtitle}</p>
          </div>
          <button
            type="button"
            className="close-3d-btn"
            aria-label={isZh ? "关闭工坊" : "Close workshop"}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>

        {/* 3D WebGL Canvas */}
        <div
          className="viewer-3d-canvas-wrap"
          onWheel={(e) => {
            if (solved) return;
            const dir = e.deltaY > 0 ? 1 : -1;
            if (puzzleType === "jigsaw") {
              handleRotateMegalith(dir);
            } else if (puzzleType === "runes") {
              handleRotateCryptex(dir === 1 ? -1 : 1);
            } else if (puzzleType === "lock") {
              handleRotateAstrolabe(dir * 15);
            }
          }}
        >
          <canvas ref={canvasRef} className="viewer-3d-canvas" />

          {/* Solved Overlay Celebration */}
          {solved && (
            <div className="puzzle-3d-solved-overlay">
              <div className="puzzle-3d-solved-card">
                <Sparkles size={36} className="puzzle-3d-sparkle-icon" />
                <h3>{isZh ? "✨ 机关复苏 · 解谜完成 ✨" : "✨ Mechanism Solved! ✨"}</h3>
                <p>
                  {isZh
                    ? "精密三维构造已完全契合，古代新加坡历史神器已被成功唤醒并收录！"
                    : "The 3D mechanical artifact has been perfectly restored and catalogued!"}
                </p>
                <button
                  type="button"
                  className="puzzle-3d-claim-btn"
                  onClick={handleClaimSuccess}
                >
                  <Check size={18} />
                  <span>{isZh ? "收入文物库并返回" : "Claim Relic & Return"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Mechanical Interactive Controls Bar */}
          <div className="puzzle-workshop-controls">
            {/* Megalith Controls */}
            {puzzleType === "jigsaw" && (
              <div className="workshop-control-panel">
                <div className="workshop-piece-tabs">
                  {megalithPieces.map((p, idx) => (
                    <button
                      key={p}
                      type="button"
                      className={`workshop-tab-btn ${selectedPieceIndex === idx ? "active" : ""} ${
                        snappedPieces.includes(p) ? "snapped" : ""
                      }`}
                      onClick={() => handleSelectMegalithPiece(idx)}
                    >
                      {snappedPieces.includes(p) ? <Check size={13} /> : null}
                      <span>{megalithLabels[idx]}</span>
                    </button>
                  ))}
                </div>
                <div className="workshop-action-row">
                  <button
                    type="button"
                    className="workshop-action-btn"
                    onClick={() => handleRotateMegalith(-1)}
                    title={isZh ? "逆时针旋转30度" : "Rotate -30°"}
                  >
                    <RotateCcw size={16} />
                    <span>-30°</span>
                  </button>
                  <button
                    type="button"
                    className="workshop-action-btn"
                    onClick={() => handleRotateMegalith(1)}
                    title={isZh ? "顺时针旋转30度" : "Rotate +30°"}
                  >
                    <RotateCw size={16} />
                    <span>+30°</span>
                  </button>
                  <button
                    type="button"
                    className={`workshop-action-btn workshop-snap-btn ${snapShake ? "workshop-shake" : ""}`}
                    onClick={handleSnapMegalith}
                  >
                    <ShieldCheck size={16} />
                    <span>{isZh ? "卡合定位" : "Snap to Altar"}</span>
                  </button>
                  <span className="workshop-angle-readout">
                    {snappedPieces.includes(megalithPieces[selectedPieceIndex])
                      ? isZh ? "✓ 已嵌合归位" : "✓ Snapped"
                      : isZh
                        ? `当前角度: ${megalithAngleDeg}° (目标 0°)`
                        : `Angle: ${megalithAngleDeg}° (Target 0°)`}
                  </span>
                </div>
              </div>
            )}

            {/* Cryptex Controls */}
            {puzzleType === "runes" && (
              <div className="workshop-control-panel">
                <div className="workshop-cryptex-display">
                  <span className="cryptex-cipher-label">{isZh ? "基准线符文:" : "Meridian Code:"}</span>
                  <div className="cryptex-cipher-chars">
                    {cryptexCode.map((char, idx) => (
                      <span
                        key={idx}
                        className={`cryptex-char-pill ${selectedPieceIndex === idx ? "active" : ""}`}
                        onClick={() => handleSelectCryptexRing(idx)}
                      >
                        {char}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="workshop-piece-tabs">
                  {[0, 1, 2, 3].map((idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`workshop-tab-btn ${selectedPieceIndex === idx ? "active" : ""}`}
                      onClick={() => handleSelectCryptexRing(idx)}
                    >
                      <span>{isZh ? `铜环 ${idx + 1}` : `Ring ${idx + 1}`}</span>
                    </button>
                  ))}
                </div>
                <div className="workshop-action-row">
                  <button
                    type="button"
                    className="workshop-action-btn"
                    onClick={() => handleRotateCryptex(1)}
                  >
                    <RotateCcw size={16} />
                    <span>{isZh ? "向上拨动" : "Turn Up"}</span>
                  </button>
                  <button
                    type="button"
                    className="workshop-action-btn"
                    onClick={() => handleRotateCryptex(-1)}
                  >
                    <RotateCw size={16} />
                    <span>{isZh ? "向下拨动" : "Turn Down"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Astrolabe Controls */}
            {puzzleType === "lock" && (
              <div className="workshop-control-panel">
                <div className="workshop-piece-tabs">
                  {[0, 1, 2].map((idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`workshop-tab-btn ${selectedPieceIndex === idx ? "active" : ""} ${
                        alignedRings[idx] ? "snapped" : ""
                      }`}
                      onClick={() => handleSelectAstrolabeRing(idx)}
                    >
                      {alignedRings[idx] ? <Check size={13} /> : null}
                      <span>{astrolabeLabels[idx]}</span>
                    </button>
                  ))}
                </div>
                <div className="workshop-action-row">
                  <button
                    type="button"
                    className="workshop-action-btn"
                    onClick={() => handleRotateAstrolabe(-15)}
                  >
                    <span>-15°</span>
                  </button>
                  <button
                    type="button"
                    className="workshop-action-btn"
                    onClick={() => handleRotateAstrolabe(15)}
                  >
                    <span>+15°</span>
                  </button>
                  <button
                    type="button"
                    className="workshop-action-btn"
                    onClick={() => handleRotateAstrolabe(-45)}
                  >
                    <span>-45°</span>
                  </button>
                  <button
                    type="button"
                    className="workshop-action-btn"
                    onClick={() => handleRotateAstrolabe(45)}
                  >
                    <span>+45°</span>
                  </button>
                  <button
                    type="button"
                    className={`workshop-action-btn workshop-snap-btn ${snapShake ? "workshop-shake" : ""}`}
                    onClick={handleSnapAstrolabeRing}
                  >
                    <ShieldCheck size={16} />
                    <span>{isZh ? "校准啮合" : "Align Ring"}</span>
                  </button>
                  <span className="workshop-angle-readout">
                    {alignedRings[selectedPieceIndex]
                      ? isZh ? "✓ 已啮合锁定" : "✓ Aligned"
                      : isZh
                        ? `当前: ${astrolabeAngles[selectedPieceIndex]?.current ?? 0}° / 目标: ${astrolabeAngles[selectedPieceIndex]?.target ?? 90}°`
                        : `${astrolabeAngles[selectedPieceIndex]?.current ?? 0}° / ${astrolabeAngles[selectedPieceIndex]?.target ?? 90}°`}
                  </span>
                </div>
              </div>
            )}

            {/* Clue & Hint bar */}
            <div className="workshop-tip-bar">
              <Sparkles size={14} />
              <span>{currentInfo.clue}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
