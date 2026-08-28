/**
 * 喷气发动机程序化几何模型（零外部素材）
 * ------------------------------------------------------------------
 * 结构：进气道 → 风扇 → 六级压气机(转子+静子) → 环形燃烧室 →
 *      两级涡轮(转子+静子) → 喷管；外有机匣（半透明，透明度可调）。
 * 所有部件用 Cylinder / Cone / Box / Torus / Ring 程序化构建，
 * 叶片采用 InstancedMesh 批量渲染以保证性能。
 * 支持：启动/油门（转子转速）、爆炸拆解（模块沿径向分离）、
 *      剖切（裁剪平面）、机匣透明度、站位高亮。
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useEngineStore } from '../store';
import { STATIONS } from '../data/stations';

/* 剖切裁剪平面：cutaway 开 → constant=0 切掉 y<0 下半；
 * 关 → constant=1000（场景 y 最大 ~2，y+1000 恒 >0，不裁剪） */
const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1000);
const _lerpTarget = new THREE.Vector3(); // 复用对象，避免每帧分配（M3 修复）

interface ModuleDef {
  id: string;
  home: [number, number, number];
  exploded: [number, number, number];
  rotating?: boolean;
}

const MODULE_DEFS: ModuleDef[] = [
  { id: 'intake', home: [0, 0, -4.05], exploded: [-0.95, 1.2, -1.5] },
  { id: 'fan', home: [0, 0, -3.1], exploded: [0.85, 1.05, -0.85], rotating: true },
  { id: 'comp0', home: [0, 0, -2.45], exploded: [-0.75, -1.05, 0.0], rotating: true },
  { id: 'comp1', home: [0, 0, -1.98], exploded: [0.8, -1.1, 0.3], rotating: true },
  { id: 'comp2', home: [0, 0, -1.51], exploded: [-0.85, -1.1, 0.55], rotating: true },
  { id: 'comp3', home: [0, 0, -1.04], exploded: [0.9, -1.05, 0.8], rotating: true },
  { id: 'comp4', home: [0, 0, -0.57], exploded: [-0.95, -1.0, 1.05], rotating: true },
  { id: 'comp5', home: [0, 0, -0.1], exploded: [1.0, -0.95, 1.3], rotating: true },
  { id: 'combustor', home: [0, 0, 0.9], exploded: [1.2, 0.9, 1.5] },
  { id: 'turb0', home: [0, 0, 2.05], exploded: [-1.05, 1.05, 1.8], rotating: true },
  { id: 'turb1', home: [0, 0, 2.55], exploded: [1.1, 1.1, 2.1], rotating: true },
  { id: 'nozzle', home: [0, 0, 4.15], exploded: [0.75, -1.05, 2.35] },
  { id: 'shaft', home: [0, 0, -0.1], exploded: [0, 0, -0.1], rotating: true },
  { id: 'casing', home: [0, 0, 0.3], exploded: [0, 1.55, 0.3] },
];

/* 压气机六级（半径逐级收敛，弦长逐级减小） */
const COMP_STAGES = [
  { z: -2.45, r: 0.82, chord: 0.2, tilt: 0.55 },
  { z: -1.98, r: 0.76, chord: 0.19, tilt: 0.58 },
  { z: -1.51, r: 0.7, chord: 0.18, tilt: 0.62 },
  { z: -1.04, r: 0.64, chord: 0.17, tilt: 0.66 },
  { z: -0.57, r: 0.58, chord: 0.16, tilt: 0.7 },
  { z: -0.1, r: 0.52, chord: 0.15, tilt: 0.74 },
];

/* 涡轮两级 */
const TURB_STAGES = [
  { z: 2.05, r: 0.66, chord: 0.26, tilt: 0.85 },
  { z: 2.55, r: 0.62, chord: 0.26, tilt: 0.88 },
];

const HUB_R = 0.16; // 压气机/涡轮轮毂半径
const SEG = 48;

/* 批量叶片环（InstancedMesh，单次 draw call） */
interface BladeRingProps {
  count: number;
  hubR: number;
  span: number;
  chord: number;
  thickness: number;
  tilt: number;
  color: string | number;
  metalness?: number;
  roughness?: number;
}

function BladeRing({ count, hubR, span, chord, thickness, tilt, color, metalness = 0.55, roughness = 0.35 }: BladeRingProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const rC = hubR + span / 2;
  useEffect(() => {
    if (!ref.current) return;
    const m = new THREE.Matrix4();
    const mr = new THREE.Matrix4();
    const mt = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      m.makeRotationZ(a);
      mr.makeRotationY(tilt);
      m.multiply(mr);
      mt.makeTranslation(0, rC, 0);
      m.multiply(mt);
      ref.current.setMatrixAt(i, m);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }, [count, tilt, hubR, span, rC]);
  return (
    <instancedMesh
      ref={ref}
      args={[undefined as unknown as THREE.BufferGeometry, undefined as unknown as THREE.Material, count]}
    >
      <boxGeometry args={[thickness, span, chord]} />
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
        side={THREE.DoubleSide}
        clippingPlanes={[clipPlane]}
      />
    </instancedMesh>
  );
}

/* 转子/静子叶片 + 轮毂盘（z 为沿轴线位置） */
function Stage({
  z,
  radius,
  chord,
  tilt,
  rotor,
  color,
  bladeCount = 22,
}: {
  z: number;
  radius: number;
  chord: number;
  tilt: number;
  rotor: boolean;
  color: string | number;
  bladeCount?: number;
}) {
  const span = radius - HUB_R;
  return (
    <group position={[0, 0, z]}>
      {/* 轮毂盘 */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[HUB_R, HUB_R, 0.06, 24]} />
        <meshStandardMaterial color={rotor ? 0x8d98a6 : 0x6e7b8c} metalness={0.5} roughness={0.4} clippingPlanes={[clipPlane]} side={THREE.DoubleSide} />
      </mesh>
      <BladeRing count={bladeCount} hubR={HUB_R} span={span} chord={chord} thickness={0.05} tilt={tilt} color={color} />
    </group>
  );
}

/* 风扇（大直径、宽弦） */
function Fan() {
  const radius = 0.98;
  const hubR = 0.2;
  return (
    <group>
      {/* 整流锥（前锥） */}
      <mesh position={[0, 0, -2.62]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[hubR, 0.85, 28]} />
        <meshStandardMaterial color={0x6e7b8c} metalness={0.6} roughness={0.35} clippingPlanes={[clipPlane]} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[hubR, hubR, 0.1, 28]} />
        <meshStandardMaterial color={0x8d98a6} metalness={0.5} roughness={0.4} clippingPlanes={[clipPlane]} side={THREE.DoubleSide} />
      </mesh>
      <BladeRing count={18} hubR={hubR} span={radius - hubR} chord={0.3} thickness={0.06} tilt={0.5} color={0x9fb8d8} />
    </group>
  );
}

/* 环形燃烧室：外火焰筒 + 内筒 + 前挡板 + 8 个燃油喷嘴 + 发光内胆 */
function Combustor({
  flameRef,
  glowRef,
}: {
  flameRef: React.MutableRefObject<THREE.Mesh | null>;
  glowRef: React.MutableRefObject<THREE.PointLight | null>;
}) {
  const nozzles = useMemo(() => Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2), []);
  return (
    <group>
      {/* 外火焰筒 */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.56, 0.56, 1.6, SEG, 1, true]} />
        <meshStandardMaterial color={0x8a8f98} metalness={0.5} roughness={0.4} side={THREE.DoubleSide} clippingPlanes={[clipPlane]} />
      </mesh>
      {/* 内筒 */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 1.6, SEG, 1, true]} />
        <meshStandardMaterial color={0x4a4f58} metalness={0.5} roughness={0.5} side={THREE.DoubleSide} clippingPlanes={[clipPlane]} />
      </mesh>
      {/* 前挡板（环形） */}
      <mesh position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.56, SEG]} />
        <meshStandardMaterial color={0x6a7078} metalness={0.5} roughness={0.45} side={THREE.DoubleSide} clippingPlanes={[clipPlane]} />
      </mesh>
      {/* 燃油喷嘴 */}
      {nozzles.map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 0.43, Math.sin(a) * 0.43, 0.3]} rotation={[0, 0, a]}>
          <cylinderGeometry args={[0.025, 0.035, 0.18, 12]} />
          <meshStandardMaterial color={0x2f3a4d} metalness={0.7} roughness={0.3} clippingPlanes={[clipPlane]} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* 发光内胆（燃烧火焰感） */}
      <mesh ref={flameRef} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 1.3, SEG, 1, true]} />
        <meshStandardMaterial
          color={0x2a1a0a}
          emissive={0xff7a2a}
          emissiveIntensity={0}
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
          clippingPlanes={[clipPlane]}
        />
      </mesh>
      <pointLight ref={glowRef} position={[0, 0, 0.9]} color={0xff7a2a} intensity={0} distance={9} decay={2} />
    </group>
  );
}

/* 进气道：外罩 + 唇口 + 内涵道 */
function Intake() {
  return (
    <group>
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.0, 1.18, 1.9, SEG, 1, true]} />
        <meshStandardMaterial color={0x7d8b9d} metalness={0.55} roughness={0.35} side={THREE.DoubleSide} clippingPlanes={[clipPlane]} />
      </mesh>
      <mesh position={[0, 0, -0.95]}>
        <torusGeometry args={[1.18, 0.09, 18, SEG]} />
        <meshStandardMaterial color={0x6b7a8c} metalness={0.6} roughness={0.35} clippingPlanes={[clipPlane]} side={THREE.DoubleSide} />
      </mesh>
      {/* 内涵道（深色半透明，体现进气道纵深） */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.92, 0.92, 1.9, SEG, 1, true]} />
        <meshStandardMaterial color={0x20262f} metalness={0.4} roughness={0.6} transparent opacity={0.55} side={THREE.DoubleSide} clippingPlanes={[clipPlane]} />
      </mesh>
    </group>
  );
}

/* 喷管：收敛段 + 出口环 + 排气辉光 */
function Nozzle({ exhaustRef }: { exhaustRef: React.MutableRefObject<THREE.Mesh | null> }) {
  return (
    <group>
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.46, 0.62, 1.7, SEG, 1, true]} />
        <meshStandardMaterial color={0x9aa5b3} metalness={0.6} roughness={0.35} side={THREE.DoubleSide} clippingPlanes={[clipPlane]} />
      </mesh>
      <mesh position={[0, 0, 0.85]}>
        <torusGeometry args={[0.46, 0.05, 16, SEG]} />
        <meshStandardMaterial color={0x7d8b9d} metalness={0.6} roughness={0.35} clippingPlanes={[clipPlane]} side={THREE.DoubleSide} />
      </mesh>
      {/* 排气辉光 */}
      <mesh ref={exhaustRef} position={[0, 0, 0.92]}>
        <cylinderGeometry args={[0.4, 0.46, 0.25, SEG, 1, true]} />
        <meshStandardMaterial
          color={0x2a1408}
          emissive={0xff8a3c}
          emissiveIntensity={0}
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
          clippingPlanes={[clipPlane]}
        />
      </mesh>
    </group>
  );
}

/* 机匣（透明度可调）+ 法兰环 */
function CasingShell({ shellRef }: { shellRef: React.MutableRefObject<THREE.Mesh | null> }) {
  return (
    <group>
      <mesh ref={shellRef} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.95, 1.05, 6.4, SEG, 1, true]} />
        <meshStandardMaterial
          color={0x8fa0b5}
          metalness={0.35}
          roughness={0.4}
          transparent
          opacity={0.32}
          depthWrite={false}
          side={THREE.DoubleSide}
          clippingPlanes={[clipPlane]}
        />
      </mesh>
      {[-2.9, -0.1, 1.7, 3.1, 3.3].map((z) => (
        <mesh key={z} position={[0, 0, z]}>
          <torusGeometry args={[1.0, 0.05, 16, SEG]} />
          <meshStandardMaterial color={0x6b7a8c} metalness={0.6} roughness={0.35} clippingPlanes={[clipPlane]} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/* 中央传动轴（连接涡轮与压气机） */
function Shaft() {
  return (
    <group>
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 6.1, 24]} />
        <meshStandardMaterial color={0x55606e} metalness={0.7} roughness={0.3} clippingPlanes={[clipPlane]} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function Module({
  def,
  register,
  children,
}: {
  def: ModuleDef;
  register: (id: string, g: THREE.Group) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  useEffect(() => {
    if (ref.current) register(def.id, ref.current);
  }, [def.id, register]);
  return (
    <group ref={ref} position={def.home}>
      {children}
    </group>
  );
}

export function EngineModel() {
  const partsRef = useRef<Record<string, THREE.Group>>({});
  const casingRef = useRef<THREE.Mesh>(null);
  const flameRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.PointLight>(null);
  const exhaustRef = useRef<THREE.Mesh>(null);
  const spin = useRef(0);

  const selectedStation = useEngineStore((s) => s.selectedStation);

  /* 站位 → 模块高亮 */
  useEffect(() => {
    const modId = STATIONS.find((st) => st.id === selectedStation)?.module ?? '';
    for (const [id, g] of Object.entries(partsRef.current)) {
      g.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && mesh.material) {
          const mats: THREE.Material[] = (
            Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          ) as THREE.Material[];
          for (const mm of mats) {
            const sm = mm as THREE.MeshStandardMaterial;
            if (sm.isMeshStandardMaterial) {
              sm.emissive.setHex(id === modId ? 0x2a6ab0 : 0x000000);
              sm.emissiveIntensity = id === modId ? 0.55 : 0;
            }
          }
        }
      });
    }
  }, [selectedStation]);

  const register = useMemo(
    () => (id: string, g: THREE.Group) => {
      partsRef.current[id] = g;
    },
    []
  );

  useFrame((_, dt) => {
    const s = useEngineStore.getState();
    const target = s.running ? Math.max(0.06, s.throttle / 100) : 0;
    spin.current += (target - spin.current) * Math.min(1, dt * 1.1);
    const w = spin.current * 16; // 视觉转速 rad/s

    /* 剖切平面 */
    clipPlane.constant = s.cutaway ? 0 : 1000;

    /* 爆炸拆解：模块位置向目标点过渡 */
    for (const def of MODULE_DEFS) {
      const g = partsRef.current[def.id];
      if (!g) continue;
      const dest = s.exploded ? def.exploded : def.home;
      g.position.lerp(_lerpTarget.set(...dest), Math.min(1, dt * 4.5));
      if (def.rotating) g.rotation.z += w * dt;
    }

    /* 机匣透明度 */
    if (casingRef.current) {
      const m = casingRef.current.material as THREE.MeshStandardMaterial;
      m.opacity = s.casingOpacity;
    }

    /* 燃烧室 / 排气辉光随油门 */
    const fl = s.running ? target : 0;
    // 站位 3/4（燃烧室）选中高亮不被每帧辉光控制覆盖（L2 修复）
    const combustorSelected = s.selectedStation === 3 || s.selectedStation === 4;
    if (flameRef.current) {
      const m = flameRef.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = Math.max(fl * 2.6, combustorSelected ? 0.55 : 0);
      m.opacity = Math.max(fl * 0.85, combustorSelected ? 0.3 : 0);
    }
    if (exhaustRef.current) {
      const m = exhaustRef.current.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = fl * 1.8;
      m.opacity = fl * 0.8;
    }
    if (glowRef.current) glowRef.current.intensity = fl * 14;

    /* 调试句柄（QA 用）：window.__jetDebugEnabled=true 时暴露每帧状态 */
    const fan = partsRef.current['fan'];
    if (fan && (window as unknown as Record<string, unknown>).__jetDebugEnabled) {
      (window as unknown as Record<string, unknown>).__jetDebug = {
        t: performance.now(),
        running: s.running,
        throttle: s.throttle,
        spin: spin.current,
        fanPosZ: +fan.position.z.toFixed(3),
        fanRotZ: +((fan.rotation.z % (Math.PI * 2)).toFixed(3)),
        casingOpacity: +s.casingOpacity.toFixed(2),
        clipConstant: +clipPlane.constant.toFixed(0),
      };
    }
  });

  return (
    <group>
      {MODULE_DEFS.map((def) => {
        let content: React.ReactNode = null;
        switch (def.id) {
          case 'intake':
            content = <Intake />;
            break;
          case 'fan':
            content = <Fan />;
            break;
          case 'comp0':
          case 'comp1':
          case 'comp2':
          case 'comp3':
          case 'comp4':
          case 'comp5': {
            const idx = Number(def.id.slice(4));
            const st = COMP_STAGES[idx];
            content = (
              <group>
                <Stage z={0} radius={st.r} chord={st.chord} tilt={st.tilt} rotor color={0xc9d2e0} />
                {/* 静子（相邻，随本模块一起拆解） */}
                <Stage z={0.24} radius={st.r * 0.98} chord={st.chord * 0.9} tilt={-0.5} rotor={false} color={0x6e7b8c} />
              </group>
            );
            break;
          }
          case 'combustor':
            content = <Combustor flameRef={flameRef} glowRef={glowRef} />;
            break;
          case 'turb0':
          case 'turb1': {
            const idx = Number(def.id.slice(4));
            const st = TURB_STAGES[idx];
            content = (
              <group>
                <Stage z={0} radius={st.r} chord={st.chord} tilt={st.tilt} rotor color={0xd8a06a} bladeCount={16} />
                <Stage z={0.26} radius={st.r * 0.95} chord={st.chord * 0.85} tilt={-0.7} rotor={false} color={0x8a5a3c} bladeCount={16} />
              </group>
            );
            break;
          }
          case 'nozzle':
            content = <Nozzle exhaustRef={exhaustRef} />;
            break;
          case 'shaft':
            content = <Shaft />;
            break;
          case 'casing':
            content = <CasingShell shellRef={casingRef} />;
            break;
        }
        return (
          <Module key={def.id} def={def} register={register}>
            {content}
          </Module>
        );
      })}
    </group>
  );
}
