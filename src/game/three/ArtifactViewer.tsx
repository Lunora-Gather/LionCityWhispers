import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { createArtifact3D, type Artifact3DHandle } from "./artifactModels";
import { getEquirectEnvTexture, getMuseumBackdropTexture } from "./world/World3DTextures";
import type { ArtifactId } from "../state";
import type { Locale } from "@/data/i18n";
import { Layers, Lightbulb, Rotate3d, Sparkles, Volume2, X } from "lucide-react";
import { playChimeResonance } from "@/game/audio";

export type ArtifactViewerProps = {
  artifactId: ArtifactId;
  locale: Locale;
  onClose: () => void;
  onSelectArtifact?: (id: ArtifactId) => void;
  unlockedArtifacts?: ArtifactId[];
};

const artifactInfo: Record<
  ArtifactId,
  {
    zh: { name: string; tag: string; desc: string; material: string; uvNote: string };
    en: { name: string; tag: string; desc: string; material: string; uvNote: string };
  }
> = {
  "badang-stone": {
    zh: {
      name: "巴当巨石 (Singapore Stone)",
      tag: "国宝级岩石圣物 · 13至14世纪",
      desc: "新加坡河口打捞出的神秘巨石断面。相传大力士巴当掷巨石退敌，表面刻有未解的古代爪哇/梵文。三维全息视界下可清晰鉴赏经由金缮工艺修复的断口脉络。",
      material: "河岸红砂岩 · 纯金金缮填缝 · 梵文浅浮雕",
      uvNote: "🔬 紫外荧光显影：断面检出古满者伯夷朱砂矿粉残留，三块残片「力·石·潮」均呈 0° 正向嵌合轨迹。"
    },
    en: {
      name: "The Badang Stone",
      tag: "National Megalithic Relic · 13th-14th Century",
      desc: "Sacred fracture from the Singapore River mouth, inscribed with undeciphered ancient Majapahit script. Inspect the delicate golden kintsugi seams binding the ancient megalithic facets.",
      material: "Riverbed Red Sandstone · Kintsugi Gold Veins · Ancient Relief",
      uvNote: "🔬 UV Fluorescence: Traces of ancient Majapahit cinnabar pigment align the three fragments 'Power · Stone · Tide' at 0°."
    }
  },
  "rune-plaque": {
    zh: {
      name: "狮门符文铭牌 (Lion Gate Plaque)",
      tag: "室利佛逝王朝王室信物 · 青铜重器",
      desc: "古淡马锡海关要塞的青铜门阙铭牌，中心嵌铸室利佛逝海狮徽章，外围环绕四重莲瓣与护城铭文。铜绿与金辉相映，见证南洋海上丝路的枢纽过往。",
      material: "高锡古青铜 · 氧化铜绿包浆 · 鎏金狮首徽纹",
      uvNote: "🔬 紫外荧光显影：狮首徽章下方浮现暗刻航海四字真言——「海 · 狮 · 门 · 月」。"
    },
    en: {
      name: "Lion Gate Bronze Plaque",
      tag: "Srivijaya Royal Insignia · Heavy Bronze",
      desc: "Bronze fortress plaque of ancient Temasek with the majestic lion medallion and 4 sacred rune cartouches, representing the maritime gateway of Southeast Asia.",
      material: "High-Tin Bronze · Verdigris Patina · Gilded Crest",
      uvNote: "🔬 UV Fluorescence: Hidden beneath the lion crest glows the four-rune maritime cipher — 'Sea · Lion · Gate · Moon'."
    }
  },
  "harbor-seal": {
    zh: {
      name: "海门天枢机锁 (Harbor Astrolabe Seal)",
      tag: "海防航海天文枢机 · 机械密码锁",
      desc: "用于锁闭新加坡古海港水下栅闸的多重同心浑天罗盘锁。外圈刻注季风信风方位，内轴嵌入朱砂枢机密钥，需精确对齐日月星辰方位方可启闭关隘。",
      material: "精炼海防黄铜 · 同心齿轮机构 · 朱砂红宝石锁芯",
      uvNote: "🔬 紫外荧光显影：黄铜星盘刻度残留夜光磷粉，指向三环解锁角度——外环 90° · 中环 180° · 内环 270°。"
    },
    en: {
      name: "Harbor Astrolabe Mechanism",
      tag: "Defensive Celestial Lock · Clockwork Seal",
      desc: "Concentric geared navigational astrolabe seal once safeguarding early Singapore harbor chains. Rotating astronomical rings align tides and monsoon stars.",
      material: "Naval Brass · Concentric Gearing · Cinnabar Seal Core",
      uvNote: "🔬 UV Fluorescence: Phosphorescent dial marks reveal the three-ring alignment — Outer 90° · Middle 180° · Inner 270°."
    }
  },
  "spirit-chime": {
    zh: {
      name: "辟邪碧玉神竹铃 (Sacred Spirit Chime)",
      tag: "南洋航海辟邪乐器 · 仪式祭器",
      desc: "以南洋圣竹管与温润翠玉圆璧连缀的神圣风铃。古航海家悬挂于船首以音律测听潮汛风向，并在神秘仪式中叩击竹铃，以清澈声波荡涤迷雾邪祟。",
      material: "南洋密节青竹 · 缅甸透光翠玉 · 黄铜共振击槌",
      uvNote: "🔬 紫外荧光显影：翠玉圆璧内含天然铬元素荧光，五管青竹呈现五声音阶共鸣驻波。"
    },
    en: {
      name: "Sacred Bamboo Spirit Chime",
      tag: "Maritime Acoustic Talisman · Ritual Instrument",
      desc: "Crafted from sacred tuned bamboo cylinders crowned with an emerald jade ring. Navigators sounded its tones to read ocean currents and cleanse maritime fog.",
      material: "Dense Southeast Asian Bamboo · Translucent Jade · Brass Clapper",
      uvNote: "🔬 UV Fluorescence: Natural chromium luminescence in the jade bi-disc reveals pentatonic acoustic standing waves."
    }
  }
};

export const ArtifactViewer: React.FC<ArtifactViewerProps> = ({
  artifactId,
  locale,
  onClose,
  onSelectArtifact,
  unlockedArtifacts = ["badang-stone", "rune-plaque", "harbor-seal", "spirit-chime"]
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<Artifact3DHandle | null>(null);

  const [activeId, setActiveId] = useState<ArtifactId>(artifactId);

  useEffect(() => {
    setActiveId(artifactId);
    setExploded(0);
  }, [artifactId]);
  const [autoRotate, setAutoRotate] = useState(true);
  const [uvMode, setUvMode] = useState(false);
  const [exploded, setExploded] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [resonanceCount, setResonanceCount] = useState(0);

  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;
  const sceneLightsRef = useRef<{
    scene: THREE.Scene;
    keySpot: THREE.SpotLight;
    fillSpot: THREE.DirectionalLight;
    rimLight: THREE.DirectionalLight;
  } | null>(null);

  const info = artifactInfo[activeId][locale];
  const isZh = locale === "zh";

  // Three.js Scene Setup
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = getMuseumBackdropTexture(uvMode);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0.25, 6.2);
    camera.lookAt(0, -0.1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    container.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const studioEnvRT = pmrem.fromEquirectangular(getEquirectEnvTexture("studio"));
    pmrem.dispose();
    scene.environment = studioEnvRT.texture;

    // Studio Ambient & Spot Lighting
    const ambientLight = new THREE.AmbientLight(0xd9ecd9, 0.95);
    scene.add(ambientLight);

    const keySpot = new THREE.SpotLight(0xfff1cf, 3.8);
    keySpot.position.set(4, 6, 5);
    keySpot.angle = Math.PI / 4;
    keySpot.penumbra = 0.5;
    keySpot.castShadow = true;
    scene.add(keySpot);

    const fillSpot = new THREE.DirectionalLight(0x2bc7ab, 1.4);
    fillSpot.position.set(-5, -2, -3);
    scene.add(fillSpot);

    const rimLight = new THREE.DirectionalLight(0xd1a95d, 2.0);
    rimLight.position.set(0, 5, -4);
    scene.add(rimLight);

    sceneLightsRef.current = { scene, keySpot, fillSpot, rimLight };

    // Pedestal disk
    const pedestalGeo = new THREE.CylinderGeometry(2.4, 2.7, 0.2, 48);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0x091413,
      roughness: 0.4,
      metalness: 0.8
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -2.1;
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    const pedestalRingGeo = new THREE.TorusGeometry(2.5, 0.03, 8, 48);
    const pedestalRingMat = new THREE.MeshStandardMaterial({
      color: 0xd1a95d,
      emissive: 0xd1a95d,
      emissiveIntensity: 0.4
    });
    const pedestalRing = new THREE.Mesh(pedestalRingGeo, pedestalRingMat);
    pedestalRing.rotation.x = Math.PI / 2;
    pedestalRing.position.y = -2.0;
    scene.add(pedestalRing);

    // Build Current 3D Artifact Model
    const artifactHandle = createArtifact3D(activeId);
    scene.add(artifactHandle.root);
    handleRef.current = artifactHandle;
    artifactHandle.setUvMode(uvMode);
    artifactHandle.setExploded(exploded);

    let animationFrameId: number;
    let lastTime = performance.now();
    let rotY = 0;
    let rotX = 0;

    let pointerDown = false;
    let prevX = 0;
    let prevY = 0;

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      pointerDown = true;
      setIsDragging(true);
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      prevX = clientX;
      prevY = clientY;
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!pointerDown) return;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const deltaX = clientX - prevX;
      const deltaY = clientY - prevY;
      prevX = clientX;
      prevY = clientY;

      rotY += deltaX * 0.008;
      rotX = Math.max(-0.6, Math.min(0.6, rotX + deltaY * 0.008));
    };

    const onPointerUp = () => {
      pointerDown = false;
      setIsDragging(false);
    };

    const domElement = renderer.domElement;
    domElement.addEventListener("mousedown", onPointerDown);
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    domElement.addEventListener("touchstart", onPointerDown, { passive: true });
    window.addEventListener("touchmove", onPointerMove, { passive: true });
    window.addEventListener("touchend", onPointerUp);

    // Wheel zoom
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.position.z = Math.max(3.5, Math.min(8.5, camera.position.z + e.deltaY * 0.005));
    };
    domElement.addEventListener("wheel", onWheel, { passive: false });

    // Render loop
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;

      if (autoRotateRef.current && !pointerDown) {
        rotY += 0.006;
      }

      artifactHandle.root.rotation.y = rotY;
      artifactHandle.root.rotation.x = rotX;
      artifactHandle.update(now, delta);

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      domElement.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      domElement.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("touchmove", onPointerMove);
      window.removeEventListener("touchend", onPointerUp);
      domElement.removeEventListener("wheel", onWheel);

      artifactHandle.dispose();
      pedestalGeo.dispose();
      pedestalMat.dispose();
      pedestalRingGeo.dispose();
      pedestalRingMat.dispose();
      studioEnvRT.dispose();
      renderer.dispose();
      if (container.contains(domElement)) {
        container.removeChild(domElement);
      }
      sceneLightsRef.current = null;
    };
  }, [activeId]);

  // Reactive property updates on existing Three.js model
  useEffect(() => {
    if (handleRef.current) {
      handleRef.current.setUvMode(uvMode);
    }
    if (sceneLightsRef.current) {
      const { scene, keySpot, fillSpot, rimLight } = sceneLightsRef.current;
      scene.background = getMuseumBackdropTexture(uvMode);
      keySpot.color.setHex(uvMode ? 0x7c4dff : 0xfff1cf);
      fillSpot.color.setHex(uvMode ? 0x00f2fe : 0x2bc7ab);
      rimLight.color.setHex(uvMode ? 0x3de0c8 : 0xd1a95d);
    }
  }, [uvMode]);

  useEffect(() => {
    if (handleRef.current) {
      handleRef.current.setExploded(exploded);
    }
  }, [exploded]);

  const handleResonance = useCallback(() => {
    if (handleRef.current) {
      handleRef.current.pulseResonance();
      setResonanceCount((c) => c + 1);
      playChimeResonance();
    }
  }, []);

  const switchArtifact = (id: ArtifactId) => {
    setActiveId(id);
    setExploded(0);
    if (onSelectArtifact) {
      onSelectArtifact(id);
    }
  };

  return (
    <div
      className="artifact-3d-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={isZh ? "三维全息鉴赏" : "3D Hologram Vault"}
    >
      <div className="artifact-3d-modal">
        {/* Header Bar */}
        <header className="artifact-3d-header">
          <div className="header-titles">
            <span className="badge-3d">3D PBR WebGL</span>
            <h2>{info.name}</h2>
            <p className="artifact-tag">{info.tag}</p>
          </div>
          <button
            type="button"
            className="close-3d-btn"
            aria-label={isZh ? "关闭三维鉴赏" : "Close 3D Viewer"}
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </header>

        {/* Artifact Navigation Tabs */}
        <nav className="artifact-3d-tabs" aria-label={isZh ? "文物切换" : "Artifact Selection"}>
          {(["badang-stone", "rune-plaque", "harbor-seal", "spirit-chime"] as ArtifactId[]).map((id) => {
            const isUnlocked = unlockedArtifacts.includes(id);
            const active = id === activeId;
            return (
              <button
                key={id}
                type="button"
                disabled={!isUnlocked}
                className={`tab-btn ${active ? "active" : ""} ${!isUnlocked ? "locked" : ""}`}
                onClick={() => switchArtifact(id)}
              >
                {artifactInfo[id][locale].name.split(" ")[0]}
              </button>
            );
          })}
        </nav>

        {/* Three.js 3D Viewport */}
        <div className="viewport-wrapper">
          <div ref={containerRef} className="three-canvas-host" />

          {/* Interactive Hint */}
          <div className="viewport-hint">
            <span>{isZh ? "🖱️ 拖拽全方位旋转 · 滚轮缩放视角" : "🖱️ Drag to rotate 360° · Scroll to zoom"}</span>
          </div>

          {/* Floating 3D Interaction Toolbar */}
          <div className="floating-3d-controls">
            <button
              type="button"
              className={`ctrl-btn ${autoRotate ? "active" : ""}`}
              onClick={() => setAutoRotate(!autoRotate)}
              title={isZh ? "自动旋转展台" : "Toggle Turntable"}
              aria-label={isZh ? "自动旋转展台" : "Toggle Turntable"}
            >
              <Rotate3d size={18} />
              <span>{isZh ? "展台转动" : "Turntable"}</span>
            </button>

            <button
              type="button"
              className={`ctrl-btn ${uvMode ? "active" : ""}`}
              onClick={() => setUvMode(!uvMode)}
              title={isZh ? "多波段考古荧光透视" : "Spectral UV Luminescence"}
              aria-label={isZh ? "多波段考古荧光透视" : "Spectral UV Luminescence"}
            >
              <Lightbulb size={18} />
              <span>{isZh ? "荧光透视" : "UV Mode"}</span>
            </button>

            <button
              type="button"
              className="ctrl-btn resonance-btn"
              onClick={handleResonance}
              title={isZh ? "古音共振" : "Acoustic Resonance"}
              aria-label={isZh ? "古音共振" : "Acoustic Resonance"}
            >
              <Volume2 size={18} />
              <span>{isZh ? "声波共振" : "Resonate"}</span>
            </button>
          </div>

          {/* Deconstruction Exploded View Slider */}
          <div className="exploded-slider-box">
            <div className="slider-label">
              <Layers size={14} />
              <span>{isZh ? "三维解构展开" : "Exploded View"}</span>
              <strong>{Math.round(exploded * 100)}%</strong>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(exploded * 100)}
              onChange={(e) => setExploded(Number(e.target.value) / 100)}
              aria-label={isZh ? "三维解构展开进度" : "Exploded View Progress"}
            />
          </div>
        </div>

        {/* Curatorial Details & Lore Footer */}
        <footer className="artifact-3d-info">
          <div className="info-desc">
            <p>{info.desc}</p>
            {uvMode && (
              <p style={{ marginTop: "6px", color: "#3de0c8", fontWeight: 600, fontSize: "0.84rem" }}>
                {info.uvNote}
              </p>
            )}
          </div>
          <div className="info-meta">
            <div className="meta-item">
              <span className="meta-title">{isZh ? "文物材质工艺" : "Material & Craft"}</span>
              <span className="meta-val">{info.material}</span>
            </div>
            <div className="meta-item">
              <span className="meta-title">{isZh ? "三维全息解析度" : "Hologram Fidelity"}</span>
              <span className="meta-val gold">PBR Metallic Roughness · 60 FPS</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};
