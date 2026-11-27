/**
 * المرآة — the 3D engine. Owned by the scene person. Knows nothing about React.
 *
 * Public API (the whole contract with the rest of the app):
 *   new MirrorEngine(container, { quality, pack })
 *   setModel(model | null)          draw the child's idea in "عالم فكرتك"
 *   run(cond, split)                show these experiment conditions; split = two worlds side by side
 *   setOutcomes(kidText, realText)  badges under each world after an experiment
 *   setNoorState(state)             idle | thinking | talking | happy
 *   dispose()
 *
 * The child's world is composed from the model's sources/path (emitters); how much happens there comes
 * from pack.kidOutcome (the deterministic engine), so the picture always agrees with the brain panel.
 * Condensation: the real world runs a small vapour simulation driven by the dew point (Magnus formula).
 * Evaporation: water level, vapour leaving the surface, lid, sun, warmth and a napkin under the glass.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { ChildModel, Conditions } from '../contracts';
import type { ConceptPack } from '../packs/types';

export type NoorState = 'idle' | 'thinking' | 'talking' | 'happy';
export interface EngineOptions { quality?: 'high' | 'low'; pack: ConceptPack }

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/* glass shape, shared by both worlds */
const G = { h: 1.6, rb: 0.55, rt: 0.68 };
const rOuter = (y: number) => G.rb + (G.rt - G.rb) * clamp(y / G.h, 0, 1);
const rIn = (y: number) => 0.525 + (0.13 * (y - 0.09)) / 1.51;
const SLOPE = (G.rt - G.rb) / G.h;
const ND = 340;
const NP = 320;

const C_CLEAR = new THREE.Color(1, 1, 1);
const C_BLUE = new THREE.Color(0.25, 0.48, 1.0);
const C_BLUE_GLOW = new THREE.Color(0.3, 0.55, 1).multiplyScalar(1.8);
const VAPOR_FAST = new THREE.Color(0.36, 0.88, 0.92).multiplyScalar(1.6);
const VAPOR_SLOW = new THREE.Color(1.05, 1.05, 1.05);
const SPARK_GOLD = new THREE.Color(1.0, 0.82, 0.35).multiplyScalar(2);
const SPARK_PINK = new THREE.Color(1, 0.75, 0.75).multiplyScalar(1.6);
const BREATH = new THREE.Color(0.9, 0.95, 1).multiplyScalar(1.2);

interface WaterLook { c: THREE.Color; a: THREE.Color; d: number }
const WATER: Record<'clear' | 'blue' | 'warm', WaterLook> = {
  clear: { c: new THREE.Color(0xe2f7ff), a: new THREE.Color(0xc6ecff), d: 3.0 },
  blue: { c: new THREE.Color(0x3f7bff), a: new THREE.Color(0x1c4dff), d: 0.32 },
  warm: { c: new THREE.Color(0xfff1e2), a: new THREE.Color(0xffe2c4), d: 3.0 },
};

type Behaviour = 'leak' | 'rim' | 'vapor' | 'spark' | 'drip' | 'breath' | 'rise' | 'absorb' | 'seep' | 'pull';
interface Drop { on: boolean; th: number; y: number; s: number; ts: number; blue: boolean }
interface Particle {
  on: boolean; beh: Behaviour; col: THREE.Color | null; t: number; th: number;
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  r: number; sp: number; stage: number; stopY: number; life: number; blue: boolean; slow: number;
}
interface World {
  real: boolean; g: THREE.Group; D: Drop[]; P: Particle[]; spawnAcc: number;
  targetX: number; targetScale: number; targetWater: WaterLook;
  waterMat: THREE.MeshPhysicalMaterial; water: THREE.Mesh; ice: THREE.Mesh[]; iceBase: number[];
  lid: THREE.Mesh; aura: THREE.Mesh[]; dropMesh: THREE.InstancedMesh; partMesh: THREE.InstancedMesh;
  tag: CSS2DObject; outEl: HTMLElement;
  /* evaporation props */
  level: number; napkin: THREE.Mesh; napkinMat: THREE.MeshStandardMaterial; wet: number; sun: THREE.Mesh; puddle: THREE.Mesh;
}

/** condensation: conditions → what the scene shows; the real rate comes from the dew point (Magnus) */
function conditions(c: Conditions) {
  const warm = c.temp === 'room';
  const empty = c.contents === 'empty';
  const hum = c.air === 'dry' ? 22 : 80;
  const waterT = warm ? 25 : empty ? -4 : 3;
  const a = 17.27, b = 237.7, air = 25;
  const g = Math.log(hum / 100) + (a * air) / (b + air);
  const dew = (b * g) / (a - g);
  const surf = waterT + 0.25 * (air - waterT);
  return { warm, empty, color: c.contents === 'blue', cover: c.lid === 'on', hum, rate: clamp((dew - surf) / 8, 0, 1) };
}

const LEVEL_RATE: Record<string, number> = { stays: 0, slow: 0.018, normal: 0.034, fast: 0.055, wet: 0.045 };
const MIN_LEVEL = 0.32;
const WARM_RING = new THREE.Color(1.0, 0.62, 0.25).multiplyScalar(1.6);
const COLD_RING = new THREE.Color(0.55, 0.8, 1.0).multiplyScalar(1.5);

export class MirrorEngine {
  private renderer: THREE.WebGLRenderer;
  private labels: CSS2DRenderer;
  private composer: EffectComposer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private kid: World;
  private realW: World;
  private noor = new THREE.Group();
  private eyeMat: THREE.MeshBasicMaterial;
  private eyes: THREE.Mesh[] = [];
  private mouth: THREE.Mesh;
  private tip: THREE.Mesh;
  private clock = new THREE.Clock();
  private raf = 0;
  private ro: ResizeObserver;
  private flight: { p0: THREE.Vector3; t0: THREE.Vector3; p1: THREE.Vector3; t1: THREE.Vector3; k: number; dur: number } | null = null;
  private blinkT = 2;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private disposed = false;

  private model: ChildModel | null = null;
  private pack: ConceptPack;
  private cond: Conditions;
  private split = false;
  private noorState: NoorState = 'idle';

  // scratch
  private M = new THREE.Matrix4(); private Q = new THREE.Quaternion(); private V = new THREE.Vector3();
  private SC = new THREE.Vector3(); private N = new THREE.Vector3(); private Z = new THREE.Vector3(0, 0, 1);
  private I = new THREE.Quaternion(); private tc = new THREE.Color();

  constructor(private container: HTMLElement, opts: EngineOptions) {
    const low = opts.quality === 'low';
    this.pack = opts.pack;
    this.cond = { ...opts.pack.baseline };
    this.renderer = new THREE.WebGLRenderer({ antialias: !low, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = !low;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.labels = new CSS2DRenderer();
    Object.assign(this.labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    container.appendChild(this.labels.domElement);

    this.scene.background = this.gradientTexture();
    this.scene.environment = new THREE.PMREMGenerator(this.renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.02, 100);
    this.camera.position.set(0, 2.6, 7);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, minDistance: 0.6, maxDistance: 11, maxPolarAngle: Math.PI * 0.49 });
    this.controls.target.set(0, 0.95, 0);
    this.controls.addEventListener('start', () => (this.flight = null));

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (!low) this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.55, 0.85));
    this.composer.addPass(new OutputPass());

    this.buildStage();
    this.kid = this.makeWorld(false);
    this.realW = this.makeWorld(true);
    this.realW.g.scale.setScalar(0.001);
    this.realW.targetScale = 0.001;
    const noorParts = this.buildNoor();
    this.eyeMat = noorParts.eyeMat; this.mouth = noorParts.mouth; this.tip = noorParts.tip;

    this.setVisuals(this.kid);
    this.setVisuals(this.realW);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
  }

  /* ================= public API ================= */
  setModel(model: ChildModel | null) {
    this.model = model;
    this.wipe(this.kid);
  }

  run(cond: Conditions, split: boolean) {
    this.cond = { ...this.pack.baseline, ...cond };
    this.wipe(this.kid); this.wipe(this.realW);
    this.setVisuals(this.kid); this.setVisuals(this.realW);
    this.setOutcomes('', '');
    this.setSplit(split);
  }

  setOutcomes(kidText: string, realText: string) {
    this.kid.outEl.textContent = kidText;
    this.realW.outEl.textContent = realText;
  }

  setNoorState(s: NoorState) { this.noorState = s; }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
  }

  /* ================= building ================= */
  private gradientTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const x = c.getContext('2d')!;
    const gr = x.createRadialGradient(256, 200, 20, 256, 256, 420);
    gr.addColorStop(0, '#1B3560'); gr.addColorStop(0.45, '#0C1A33'); gr.addColorStop(1, '#050A15');
    x.fillStyle = gr; x.fillRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  private buildStage() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0x9fd3ff, 0x0a1220, 0.45));
    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(3, 5.5, 3); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 16 });
    s.add(key);
    const rimL = new THREE.PointLight(0x5ce1e6, 6, 8); rimL.position.set(-3, 2.4, -2); s.add(rimL);
    const rimW = new THREE.PointLight(0xffb547, 4, 8); rimW.position.set(3, 2.4, -2); s.add(rimW);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(10, 96), new THREE.MeshStandardMaterial({ color: 0x07101f, roughness: 0.92, envMapIntensity: 0.22 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; s.add(floor);
    const grid = new THREE.PolarGridHelper(6, 16, 8, 96, 0x2a4a75, 0x1a3050);
    const gm = grid.material as THREE.Material; gm.transparent = true; gm.opacity = 0.16;
    grid.position.y = 0.001; s.add(grid);
  }

  private glassGeo = new THREE.LatheGeometry(
    [[0.0001, 0], [0.55, 0], [0.68, 1.6], [0.655, 1.6], [0.525, 0.09], [0.0001, 0.09]].map(([x, y]) => new THREE.Vector2(x, y)), 112);
  private waterGeo = new THREE.LatheGeometry(
    [[0.0001, 0.095], [0.518, 0.095], [rIn(1.22) - 0.008, 1.22], [0.0001, 1.22]].map(([x, y]) => new THREE.Vector2(x, y)), 112);
  private glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, transmission: 1, thickness: 0.14, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.1 });
  private iceMat = new THREE.MeshPhysicalMaterial({ color: 0xf2fbff, transmission: 1, roughness: 0.16, ior: 1.31, thickness: 0.24, envMapIntensity: 1.2 });
  private dropMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, roughness: 0.01, ior: 1.33, thickness: 0.05, clearcoat: 1, envMapIntensity: 1.6 });

  private makeWorld(isReal: boolean): World {
    const g = new THREE.Group();
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.05, 0.05, 96), new THREE.MeshPhysicalMaterial({ color: 0x0f1d36, roughness: 0.4, metalness: 0.2, clearcoat: 0.5, envMapIntensity: 0.45 }));
    ped.position.y = -0.026; ped.receiveShadow = true; g.add(ped);
    const ringCol = isReal ? new THREE.Color(0.36, 0.88, 0.9) : new THREE.Color(1.0, 0.71, 0.28);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.03, 0.006, 8, 160), new THREE.MeshBasicMaterial({ color: ringCol.multiplyScalar(1.7), transparent: true, opacity: 0.7, toneMapped: false }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.003; g.add(ring);
    g.add(new THREE.Mesh(this.glassGeo, this.glassMat));
    const waterMat = new THREE.MeshPhysicalMaterial({ color: WATER.clear.c.clone(), transmission: 0.96, roughness: 0.03, ior: 1.33, thickness: 1.1, attenuationColor: WATER.clear.a.clone(), attenuationDistance: 3, envMapIntensity: 1 });
    const water = new THREE.Mesh(this.waterGeo, waterMat); g.add(water);
    const iceBase: number[] = [];
    const ice = ([[0.16, 1.13, 0.1], [-0.19, 1.11, -0.04], [0.02, 1.09, -0.24]] as const).map((p, i) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.24, 0.24, 4, 0.045), this.iceMat);
      m.position.set(p[0], p[1], p[2]); m.rotation.set(i * 0.7, i * 1.3, i * 0.4); iceBase.push(p[1]); g.add(m); return m;
    });
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.04, 96), new THREE.MeshPhysicalMaterial({ color: 0xcfd8e6, roughness: 0.3, metalness: 0.6, clearcoat: 1 }));
    lid.position.y = 1.625; lid.visible = false; lid.castShadow = true; g.add(lid);
    const aura = [0, 1, 2].map(() => {
      const a = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.012, 8, 120), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.8, 1.0).multiplyScalar(1.5), transparent: true, opacity: 0, toneMapped: false }));
      a.rotation.x = Math.PI / 2; g.add(a); return a;
    });
    const dropMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), this.dropMat, ND);
    dropMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const D: Drop[] = [];
    for (let i = 0; i < ND; i++) { dropMesh.setColorAt(i, C_CLEAR); D.push({ on: false, th: 0, y: 0, s: 0, ts: 0, blue: false }); }
    g.add(dropMesh);
    const partMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ toneMapped: false }), NP);
    partMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const P: Particle[] = [];
    for (let i = 0; i < NP; i++) {
      partMesh.setColorAt(i, C_CLEAR);
      P.push({ on: false, beh: 'spark', col: null, t: 0, th: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0, sp: 0, stage: 0, stopY: 0, life: 0, blue: false, slow: 0 });
    }
    g.add(partMesh);
    const napkinMat = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 1, envMapIntensity: 0.4 });
    const napkin = new THREE.Mesh(new THREE.CircleGeometry(0.82, 64), napkinMat);
    napkin.rotation.x = -Math.PI / 2; napkin.position.y = 0.004; napkin.visible = false; napkin.receiveShadow = true; g.add(napkin);
    const puddle = new THREE.Mesh(new THREE.RingGeometry(0.56, 0.9, 64), new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, transmission: 0.6, roughness: 0.05, transparent: true, opacity: 0 }));
    puddle.rotation.x = -Math.PI / 2; puddle.position.y = 0.006; g.add(puddle);
    const sun = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.78, 0.3).multiplyScalar(2.2), toneMapped: false }));
    sun.position.set(0.95, 2.55, 0.35); sun.visible = false; g.add(sun);
    const el = document.createElement('div');
    el.className = 'mirror-tag' + (isReal ? ' real' : '');
    el.innerHTML = `<span class="name">${isReal ? 'العالم الحقيقي' : 'عالم فكرتك'}</span><span class="out"></span>`;
    const tag = new CSS2DObject(el); tag.position.set(0, 2.05, 0); tag.center.set(0.5, 1); g.add(tag);
    this.scene.add(g);
    return {
      real: isReal, g, D, P, spawnAcc: 0, targetX: 0, targetScale: 1, targetWater: WATER.clear, waterMat, water, ice, iceBase, lid, aura, dropMesh, partMesh,
      tag, outEl: el.querySelector('.out') as HTMLElement, level: 1, napkin, napkinMat, wet: 0, sun, puddle,
    };
  }

  private buildNoor() {
    const n = this.noor;
    const shell = new THREE.MeshPhysicalMaterial({ color: 0xf6f8fc, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 });
    const head = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.34, 0.34, 6, 0.12), shell); head.castShadow = true; n.add(head);
    const face = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.22, 0.04, 4, 0.05), new THREE.MeshPhysicalMaterial({ color: 0x0a1426, roughness: 0.15, clearcoat: 1 }));
    face.position.z = 0.16; n.add(face);
    const eyeMat = new THREE.MeshBasicMaterial({ color: EYE.idle.clone(), toneMapped: false });
    for (const x of [-0.075, 0.075]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 12), eyeMat); e.position.set(x, 0.015, 0.185); e.scale.z = 0.4; n.add(e); this.eyes.push(e);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 8, 24, Math.PI), eyeMat);
    mouth.position.set(0, -0.045, 0.183); mouth.rotation.z = Math.PI; n.add(mouth);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8), shell); stem.position.y = 0.23; n.add(stem);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), eyeMat); tip.position.y = 0.32; n.add(tip);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.1, 8, 24), new THREE.MeshPhysicalMaterial({ color: 0xff9a3c, roughness: 0.35, clearcoat: 0.8 }));
    body.position.y = -0.33; body.castShadow = true; n.add(body);
    n.position.set(0, 2.3, -1.1); n.scale.setScalar(0.9);
    this.scene.add(n);
    return { eyeMat, mouth, tip };
  }

  /* ================= layout & camera ================= */
  private narrow() { return this.container.clientWidth < 760; }

  private resize() {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h); this.composer.setSize(w, h); this.labels.setSize(w, h);
    this.frameShot();
  }

  private frameShot() {
    // distance chosen so the shot fits the visible width at this aspect
    const fitW = (this.split ? 4.4 : 2.4) * (this.narrow() ? 1.45 : 1);
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const dist = clamp(fitW / 2 / (Math.tan(halfFov) * this.camera.aspect), this.split ? 6.6 : 4.4, 16);
    const y = this.split ? 2.6 : 2.0;
    this.flyTo(new THREE.Vector3(0, y * (dist / 6), dist), new THREE.Vector3(0, this.narrow() ? -0.25 : 0.95, 0));
  }

  private flyTo(p: THREE.Vector3, t: THREE.Vector3, dur = 1.6) {
    if (this.reduced) { this.camera.position.copy(p); this.controls.target.copy(t); return; }
    this.flight = { p0: this.camera.position.clone(), t0: this.controls.target.clone(), p1: p, t1: t, k: 0, dur };
  }

  private setSplit(on: boolean) {
    this.split = on;
    this.kid.targetX = on ? 1.15 : 0;
    this.realW.targetX = on ? -1.15 : 0;
    this.realW.targetScale = on ? 1 : 0.001;
    this.frameShot();
  }

  /* ================= simulation ================= */
  private wipe(w: World) {
    w.D.forEach((d) => (d.on = false)); w.P.forEach((p) => (p.on = false));
    w.level = 1; w.wet = 0;
  }

  private setVisuals(w: World) {
    if (this.pack.scene3d === 'evaporation') {
      const c = this.cond;
      w.water.visible = true;
      w.ice.forEach((m) => (m.visible = false));
      w.lid.visible = c.lid === 'closed';
      w.napkin.visible = c.napkin === 'yes';
      w.sun.visible = c.sun === 'yes';
      w.targetWater = c.temp === 'warm' ? WATER.warm : WATER.clear;
      return;
    }
    const c = conditions(this.cond);
    w.water.visible = !c.empty;
    w.ice.forEach((m) => (m.visible = !c.warm && !c.empty));
    w.lid.visible = c.cover;
    w.napkin.visible = false; w.sun.visible = false;
    w.targetWater = c.color ? WATER.blue : c.warm ? WATER.warm : WATER.clear;
  }

  private addDrop(w: World, th: number, y: number, blue: boolean) {
    if (y < 0.05 || y > G.h - 0.03) return;
    for (const d of w.D) {
      if (!d.on || d.blue !== blue) continue;
      let dt = Math.abs(d.th - th); dt = Math.min(dt, Math.PI * 2 - dt);
      if (Math.hypot(dt * rOuter(y), d.y - y) < d.s * 1.3 + 0.012) { d.ts = Math.cbrt(d.ts ** 3 + 0.011 ** 3); return; }
    }
    const f = w.D.find((d) => !d.on);
    if (f) Object.assign(f, { on: true, th, y, s: 0.002, ts: rnd(0.009, 0.015), blue });
  }

  private spawn(w: World, beh: Behaviour, col: THREE.Color | null, extra: Partial<Particle>) {
    const p = w.P.find((q) => !q.on);
    if (!p) return;
    Object.assign(p, { on: true, beh, col, t: 0, th: Math.random() * Math.PI * 2, vx: 0, vy: 0, vz: 0, slow: 0, blue: false }, extra);
  }

  private kidBehaviours() {
    const c = conditions(this.cond);
    const m = this.model;
    const pred = m ? this.pack.kidOutcome(m, this.cond) : this.pack.realOutcome(this.cond);
    const rate = pred === 'none' ? 0 : pred === 'fewer' ? 0.3 : 1;
    const blue = pred === 'blue';
    const list: string[] = [];
    if (!m) list.push('vapor');
    else for (const k of m.sources) {
      if (k === 'inside_water') { if (!c.empty) list.push(m.path === 'over_rim' ? 'rim' : 'leak'); }
      else if (k === 'ice') { if (!c.empty && !c.warm) list.push('ice'); }
      else if (k === 'air_vapor') list.push('vapor');
      else if (k === 'cold_itself') list.push('cold');
      else if (k === 'glass_itself') list.push('sweat');
      else if (k === 'spill_from_above') list.push('drip');
      else if (k === 'people_breath') list.push('breath');
      else list.push('magic');
    }
    if (rate > 0 && !list.length) list.push('magic');
    return { list, rate, blue };
  }

  private stepKid(dt: number) {
    const w = this.kid;
    const { list, rate, blue } = this.kidBehaviours();
    const waterCol = blue ? C_BLUE : C_CLEAR;
    w.spawnAcc += dt * 26 * rate;
    while (w.spawnAcc > 1 && list.length) {
      w.spawnAcc -= 1;
      const beh = list[Math.floor(Math.random() * list.length)];
      const th = Math.random() * Math.PI * 2;
      if (beh === 'leak') { const y = rnd(0.15, 1.15); this.spawn(w, 'leak', waterCol, { th, y, r: rnd(0, rIn(y) * 0.8), sp: rnd(0.12, 0.2) }); }
      else if (beh === 'ice') { const m = w.ice[Math.floor(Math.random() * 3)]; this.spawn(w, 'leak', C_CLEAR, { th: Math.atan2(m.position.z, m.position.x) + rnd(-0.6, 0.6), y: m.position.y - rnd(0, 0.15), r: Math.hypot(m.position.x, m.position.z), sp: rnd(0.12, 0.2) }); }
      else if (beh === 'rim') this.spawn(w, 'rim', waterCol, { th, y: 1.22, r: rnd(0.1, 0.5), stage: 0, stopY: rnd(0.35, 1.45) });
      else if (beh === 'vapor') { const r = rnd(0.85, 1.2); this.spawn(w, 'vapor', null, { x: Math.cos(th) * r, y: rnd(0.1, 2.0), z: Math.sin(th) * r }); }
      else if (beh === 'cold') this.addDrop(w, th, rnd(0.15, 1.5), blue);
      else if (beh === 'sweat') this.spawn(w, 'spark', SPARK_PINK, { th, y: rnd(0.15, 1.5), life: 0.5, blue });
      else if (beh === 'drip') this.spawn(w, 'drip', C_CLEAR, { x: rnd(-0.75, 0.75), y: 2.3, z: rnd(-0.75, 0.75), vy: 0 });
      else if (beh === 'breath') this.spawn(w, 'breath', BREATH, { x: rnd(-0.9, -0.7), y: rnd(1.0, 1.4), z: rnd(0.5, 0.8), vx: rnd(0.25, 0.4), vy: rnd(-0.05, 0.05), vz: rnd(-0.35, -0.2) });
      else this.spawn(w, 'spark', SPARK_GOLD, { th, y: rnd(0.15, 1.5), life: 0.6, blue });
    }
    const coldOn = list.includes('cold') && rate > 0;
    const now = performance.now() / 1000;
    w.aura.forEach((a, i) => {
      const k = ((now + i * 0.6) % 1.8) / 1.8;
      a.scale.setScalar(1 + k * 0.6); a.position.y = 0.2 + i * 0.5;
      (a.material as THREE.MeshBasicMaterial).opacity = coldOn ? (1 - k) * 0.5 : 0;
    });
    for (const p of w.P) {
      if (!p.on) continue;
      p.t += dt;
      if (p.beh === 'leak') {
        p.r += p.sp * dt;
        if (p.r > rOuter(p.y) + 0.01) { this.addDrop(w, p.th, p.y, p.col === C_BLUE); p.on = false; }
        p.x = Math.cos(p.th) * p.r; p.z = Math.sin(p.th) * p.r;
      } else if (p.beh === 'rim') {
        if (p.stage === 0) { p.y += 0.35 * dt; p.r += 0.05 * dt; if (p.y > 1.64) p.stage = 1; }
        else if (p.stage === 1) { p.r += 0.3 * dt; if (p.r > rOuter(1.6) + 0.03) p.stage = 2; }
        else { p.y -= 0.3 * dt; p.r = rOuter(p.y) + 0.02; if (p.y < p.stopY) { this.addDrop(w, p.th, p.y, p.col === C_BLUE); p.on = false; } }
        p.x = Math.cos(p.th) * p.r; p.z = Math.sin(p.th) * p.r;
      } else if (p.beh === 'vapor') {
        const r = Math.hypot(p.x, p.z) || 1e-4;
        p.vx -= (p.x / r) * 0.35 * dt; p.vz -= (p.z / r) * 0.35 * dt;
        p.vx += rnd(-0.4, 0.4) * dt; p.vy += rnd(-0.4, 0.4) * dt; p.vz += rnd(-0.4, 0.4) * dt;
        p.vx *= 0.98; p.vy *= 0.98; p.vz *= 0.98;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        const r2 = Math.hypot(p.x, p.z);
        if (r2 - rOuter(p.y) < 0.03 && p.y > 0.05 && p.y < G.h) { this.addDrop(w, Math.atan2(p.z, p.x), p.y, blue); p.on = false; }
        if (p.y < 0.03 || p.y > 2.3 || r2 > 1.3) p.on = false;
      } else if (p.beh === 'spark') {
        p.r = rOuter(p.y) + 0.03; p.x = Math.cos(p.th) * p.r; p.z = Math.sin(p.th) * p.r;
        if (p.t > p.life) { this.addDrop(w, p.th, p.y, p.blue); p.on = false; }
      } else if (p.beh === 'drip') {
        p.vy -= 3.2 * dt; p.y += p.vy * dt;
        const r = Math.hypot(p.x, p.z);
        if (p.y < G.h && r <= rOuter(p.y) + 0.02 && r >= rOuter(p.y) - 0.15) { this.addDrop(w, Math.atan2(p.z, p.x), Math.min(p.y, G.h - 0.05), false); p.on = false; }
        else if (p.y < 0.02) p.on = false;
      } else if (p.beh === 'breath') {
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        const r = Math.hypot(p.x, p.z);
        if (r - rOuter(p.y) < 0.03 && p.y > 0.05 && p.y < G.h) { this.addDrop(w, Math.atan2(p.z, p.x), p.y, false); p.on = false; }
        if (p.t > 6) p.on = false;
      }
    }
    this.draw(w, dt, rate > 0 ? 0.6 * rate : -1);
  }

  private stepReal(dt: number) {
    const w = this.realW, c = conditions(this.cond);
    const want = Math.round(NP * (0.25 + (0.75 * c.hum) / 80));
    let live = w.P.reduce((n, p) => n + (p.on ? 1 : 0), 0);
    while (live < want) {
      const th = Math.random() * Math.PI * 2, r = rnd(0.8, 1.2);
      this.spawn(w, 'vapor', null, { x: Math.cos(th) * r, y: rnd(0.08, 2.1), z: Math.sin(th) * r, vx: rnd(-0.15, 0.15), vy: rnd(-0.15, 0.15), vz: rnd(-0.15, 0.15) });
      live++;
    }
    const condensing = c.rate > 0;
    for (const p of w.P) {
      if (!p.on) continue;
      p.vx += rnd(-0.5, 0.5) * dt; p.vy += rnd(-0.5, 0.5) * dt; p.vz += rnd(-0.5, 0.5) * dt;
      const r = Math.hypot(p.x, p.z) || 1e-4, d = r - rOuter(p.y);
      if (condensing && d < 0.7 && p.y < G.h + 0.1) { p.vx -= (p.x / r) * 0.3 * c.rate * dt; p.vz -= (p.z / r) * 0.3 * c.rate * dt; }
      p.slow = condensing && d < 0.25 ? Math.min(1, p.slow + dt * 3) : Math.max(0, p.slow - dt * 3);
      const damp = p.slow > 0.5 ? 0.93 : 0.988;
      p.vx *= damp; p.vy *= damp; p.vz *= damp;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const r2 = Math.hypot(p.x, p.z) || 1e-4, d2 = r2 - rOuter(p.y);
      if (d2 < 0.03 && p.y > 0.05 && p.y < G.h) {
        if (condensing && Math.random() < 0.35 + c.rate * 0.5) { this.addDrop(w, Math.atan2(p.z, p.x), p.y, false); p.on = false; continue; }
        const f = (rOuter(p.y) + 0.035) / r2; p.x *= f; p.z *= f; p.vx *= -0.5; p.vz *= -0.5;
      }
      if (r2 > 1.25 || p.y > 2.3 || p.y < 0.03 || (c.cover && p.y > 1.62 && r2 < 0.75)) p.on = false;
    }
    this.draw(w, dt, condensing ? c.rate : -1);
  }

  private draw(w: World, dt: number, rate: number) {
    const { M, Q, V, SC, N, Z, I, tc } = this;
    let n = 0;
    for (const d of w.D) {
      if (!d.on) continue;
      if (rate > 0) d.ts += rate * dt * 0.003; else d.ts -= dt * 0.004;
      d.s += (d.ts - d.s) * Math.min(1, dt * 2.5);
      if (d.s > 0.042) d.y -= (d.s - 0.038) * dt * 7;
      if (d.y < 0.03 || d.ts < 0.003) { d.on = false; continue; }
      const r = rOuter(d.y);
      N.set(Math.cos(d.th), -SLOPE, Math.sin(d.th)).normalize();
      V.set(Math.cos(d.th) * r, d.y, Math.sin(d.th) * r).addScaledVector(N, d.s * 0.18);
      Q.setFromUnitVectors(Z, N); SC.set(d.s, d.s * 1.22, d.s * 0.5);
      M.compose(V, Q, SC); w.dropMesh.setMatrixAt(n, M); w.dropMesh.setColorAt(n, d.blue ? C_BLUE : C_CLEAR); n++;
    }
    w.dropMesh.count = n; w.dropMesh.instanceMatrix.needsUpdate = true;
    if (w.dropMesh.instanceColor) w.dropMesh.instanceColor.needsUpdate = true;
    let k = 0;
    for (const p of w.P) {
      if (!p.on) continue;
      let s = 0.013;
      if (p.beh === 'vapor') { s = 0.012; tc.copy(VAPOR_FAST).lerp(VAPOR_SLOW, p.slow); w.partMesh.setColorAt(k, tc); }
      else if (p.beh === 'spark') { s = 0.03 * (1 - p.t / p.life) + 0.008; w.partMesh.setColorAt(k, p.col ?? SPARK_GOLD); }
      else { if (p.beh === 'leak' && p.r > rIn(p.y) - 0.02) s = 0.017; w.partMesh.setColorAt(k, p.col === C_BLUE ? C_BLUE_GLOW : (p.col ?? C_CLEAR)); }
      V.set(p.x, p.y, p.z); SC.set(s, s, s); M.compose(V, I, SC); w.partMesh.setMatrixAt(k, M); k++;
    }
    w.partMesh.count = k; w.partMesh.instanceMatrix.needsUpdate = true;
    if (w.partMesh.instanceColor) w.partMesh.instanceColor.needsUpdate = true;
  }


  /* ================= evaporation ================= */
  private surfaceY(w: World) { return 1.22 * w.level; }

  private evapCommon(w: World, dt: number, out: string, leak: boolean) {
    const c = this.cond;
    w.level = Math.max(MIN_LEVEL, w.level - (LEVEL_RATE[out] ?? 0) * dt);
    if (out === 'wet') w.wet = Math.min(1, w.wet + dt * 0.35);
    w.napkinMat.color.setRGB(0.957 - 0.33 * w.wet, 0.965 - 0.25 * w.wet, 0.973 - 0.18 * w.wet);
    const pm = w.puddle.material as THREE.MeshPhysicalMaterial;
    pm.opacity += ((leak && c.napkin !== 'yes' ? 0.5 : 0) - pm.opacity) * Math.min(1, dt * 0.8);
    const now = performance.now() / 1000;
    w.aura.forEach((a, i) => {
      const k = ((now + i * 0.6) % 1.8) / 1.8;
      a.scale.setScalar(1 + k * 0.6); a.position.y = 0.2 + i * 0.5;
      const mat = a.material as THREE.MeshBasicMaterial;
      mat.color.copy(c.temp === 'warm' ? WARM_RING : COLD_RING);
      mat.opacity = (1 - k) * 0.35;
    });
  }

  private spawnRise(w: World, col: THREE.Color, life = 0) {
    const surf = this.surfaceY(w), th = Math.random() * Math.PI * 2, r = rnd(0, rIn(surf) * 0.85);
    this.spawn(w, 'rise', col, { x: Math.cos(th) * r, y: surf + 0.01, z: Math.sin(th) * r, vx: rnd(-0.04, 0.04), vy: rnd(0.25, 0.45), vz: rnd(-0.04, 0.04), life });
  }

  private stepEvapKid(dt: number) {
    const w = this.kid, c = this.cond, m = this.model;
    const sources = (m ?? this.pack.correctModel).sources;
    const out = m ? this.pack.kidOutcome(m, c) : this.pack.realOutcome(c);
    this.evapCommon(w, dt, out, sources.includes('leak_bottom'));
    const closed = c.lid === 'closed';
    const emit = out === 'stays' ? (closed ? 0.35 : 0) : out === 'slow' ? 0.45 : 1;
    w.spawnAcc += dt * 22 * emit;
    while (w.spawnAcc > 1) {
      w.spawnAcc -= 1;
      const s = sources[Math.floor(Math.random() * sources.length)];
      const surf = this.surfaceY(w), th = Math.random() * Math.PI * 2;
      if (s === 'to_vapor' || s === 'air_takes') this.spawnRise(w, VAPOR_FAST);
      else if (s === 'glass_drinks') this.spawn(w, 'absorb', C_BLUE_GLOW, { th, y: rnd(0.15, surf - 0.05), r: rnd(0, 0.3), sp: rnd(0.15, 0.25) });
      else if (s === 'leak_bottom') this.spawn(w, 'seep', C_BLUE_GLOW, { th, y: 0.014, r: 0.56, sp: rnd(0.12, 0.2) });
      else if (s === 'sun_pulls') { if (c.sun === 'yes') this.spawnRise(w, SPARK_GOLD); }
      else this.spawnRise(w, SPARK_GOLD, 0.5);
    }
    this.stepEvapParticles(w, dt);
    this.draw(w, dt, -1);
  }

  private stepEvapReal(dt: number) {
    const w = this.realW, c = this.cond;
    const out = this.pack.realOutcome(c);
    this.evapCommon(w, dt, out, false);
    const emit = out === 'stays' ? 0.35 : out === 'slow' ? 0.4 : 1;
    w.spawnAcc += dt * 22 * emit;
    while (w.spawnAcc > 1) { w.spawnAcc -= 1; this.spawnRise(w, VAPOR_FAST); }
    this.stepEvapParticles(w, dt);
    this.draw(w, dt, -1);
  }

  private stepEvapParticles(w: World, dt: number) {
    const closed = this.cond.lid === 'closed';
    const surf = this.surfaceY(w);
    const sunP = w.sun.position;
    for (const p of w.P) {
      if (!p.on) continue;
      p.t += dt;
      if (p.beh === 'rise') {
        if (p.col === SPARK_GOLD && w.sun.visible && p.life === 0) {
          // pulled toward the sun
          this.V.set(sunP.x - p.x, sunP.y - p.y, sunP.z - p.z);
          const d = this.V.length();
          if (d < 0.15) { p.on = false; continue; }
          this.V.multiplyScalar(0.9 / d);
          p.x += this.V.x * dt; p.y += this.V.y * dt; p.z += this.V.z * dt;
          continue;
        }
        p.vx += rnd(-0.2, 0.2) * dt; p.vz += rnd(-0.2, 0.2) * dt; p.vy += 0.05 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        const r = Math.hypot(p.x, p.z);
        if (p.y < 1.6 && r > rIn(p.y) - 0.02) { p.vx *= -1; p.vz *= -1; }
        if (closed && p.y > 1.57) p.vy = -Math.abs(p.vy) * 0.8;
        if (p.y < surf) p.vy = Math.abs(p.vy);
        if (p.y > 2.9 || (p.life > 0 && p.t > p.life)) p.on = false;
      } else if (p.beh === 'absorb') {
        p.r += p.sp * dt;
        p.x = Math.cos(p.th) * p.r; p.z = Math.sin(p.th) * p.r;
        if (p.r > rIn(p.y) - 0.01) p.on = false;
      } else if (p.beh === 'seep') {
        p.r += p.sp * dt;
        p.x = Math.cos(p.th) * p.r; p.z = Math.sin(p.th) * p.r;
        if (p.r > 0.95) p.on = false;
      }
    }
  }

  /* ================= loop ================= */
  private frame() {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05), t = this.clock.elapsedTime;
    const f = this.flight;
    if (f) {
      f.k = Math.min(1, f.k + dt / f.dur);
      const e = f.k < 0.5 ? 4 * f.k ** 3 : 1 - Math.pow(-2 * f.k + 2, 3) / 2;
      this.camera.position.lerpVectors(f.p0, f.p1, e); this.controls.target.lerpVectors(f.t0, f.t1, e);
      if (f.k >= 1) this.flight = null;
    }
    this.controls.update();
    for (const w of [this.kid, this.realW]) {
      const k3 = Math.min(1, dt * 3);
      w.g.position.x += (w.targetX - w.g.position.x) * k3;
      w.g.scale.setScalar(Math.max(0.001, w.g.scale.x + (w.targetScale - w.g.scale.x) * k3));
      w.tag.element.style.opacity = w.real ? (this.split ? '1' : '0') : this.split ? '1' : '0.9';
      const tw = w.targetWater, k = Math.min(1, dt * 2.2);
      w.waterMat.color.lerp(tw.c, k); w.waterMat.attenuationColor.lerp(tw.a, k);
      w.waterMat.attenuationDistance += (tw.d - w.waterMat.attenuationDistance) * k;
      if (!this.reduced) w.ice.forEach((m, i) => { m.position.y = w.iceBase[i] + Math.sin(t * 0.9 + i * 2) * 0.012; m.rotation.y += dt * 0.05; });
    }
    for (const w of [this.kid, this.realW]) w.water.scale.y = w.level;
    if (this.pack.scene3d === 'evaporation') {
      this.stepEvapKid(dt);
      if (this.split) this.stepEvapReal(dt);
    } else {
      this.stepKid(dt);
      if (this.split) this.stepReal(dt);
    }
    if (!this.split) { this.realW.partMesh.count = 0; this.realW.dropMesh.count = 0; }
    this.animateNoor(dt, t);
    this.composer.render();
    this.labels.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.frame);
  }

  private animateNoor(dt: number, t: number) {
    const n = this.noor, s = this.noorState;
    const bounce = s === 'happy' ? Math.abs(Math.sin(t * 6)) * 0.08 : 0;
    if (!this.reduced) n.position.y = 2.3 + Math.sin(t * 1.4) * 0.05 + bounce;
    n.rotation.y = Math.atan2(this.camera.position.x - n.position.x, this.camera.position.z - n.position.z) * 0.6;
    n.rotation.z = s === 'thinking' && !this.reduced ? Math.sin(t * 2) * 0.06 : 0;
    this.eyeMat.color.lerp(EYE[s], Math.min(1, dt * 6));
    this.tip.scale.setScalar(s === 'thinking' ? 1 + Math.sin(t * 10) * 0.3 : 1);
    this.mouth.scale.set(1, s === 'talking' ? 1 + Math.abs(Math.sin(t * 14)) * 1.4 : s === 'happy' ? 1.5 : 1, 1);
    this.blinkT -= dt;
    for (const e of this.eyes) e.scale.y = this.blinkT < 0.12 && this.blinkT > 0 ? 0.12 : 1;
    if (this.blinkT <= 0) this.blinkT = 2.5 + Math.random() * 2.5;
  }
}

const EYE: Record<NoorState, THREE.Color> = {
  idle: new THREE.Color(0.36, 0.88, 0.92).multiplyScalar(2.2),
  talking: new THREE.Color(0.36, 0.88, 0.92).multiplyScalar(2.2),
  thinking: new THREE.Color(1.0, 0.7, 0.28).multiplyScalar(2.2),
  happy: new THREE.Color(0.37, 0.9, 0.66).multiplyScalar(2.2),
};
