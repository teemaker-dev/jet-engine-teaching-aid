/**
 * 气流可视化：程序化粒子沿发动机轴向流动
 * - 半径沿流程变化（进气道收敛 → 压气机收敛 → 燃烧室环形 → 涡轮扩张 → 喷管收敛 → 尾喷流扩张）
 * - 半径曲线各分段边界连续，无径向瞬移（M1 修复）
 * - 颜色随流程由冷（蓝）到热（橙白）再到略降温（红橙），体现温度分布
 * - 转速、流量随油门实时变化；停车 / 关闭气流时粒子保持静止分布，
 *   跳过逐帧计算（零空转开销，M3 修复）
 * - reduceMotion：尊重用户减少动画偏好，粒子静止显示
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useEngineStore } from '../store';

const N = 1500;
const Z_FRONT = -6.0; // 粒子出生位置（进气道前方）
const Z_END = 7.6; // 尾喷流末端

/* z → 流道半径（分段线性，边界连续） */
function radiusAt(z: number): number {
  if (z < -3.1) {
    // 进气道：前方较粗 → 收敛
    const t = (z + 6.0) / 2.9; // 0..1（z=-6 → -3.1）
    return 1.0 - t * 0.18; // 1.00 → 0.82
  }
  if (z < -0.1) {
    // 压气机：继续收敛
    const t = (z + 3.1) / 3.0; // 0..1（z=-3.1 → -0.1）
    return 0.82 - t * 0.3; // 0.82 → 0.52
  }
  if (z < 0.1) return 0.52; // 短过渡段（保持连续）
  if (z < 1.7) {
    // 燃烧室：收敛到环形通道（内外筒之间）0.52 → 0.44
    const t = (z - 0.1) / 1.6;
    return 0.52 - t * 0.08;
  }
  if (z < 3.1) {
    // 涡轮：扩张 0.44 → 0.54
    const t = (z - 1.7) / 1.4;
    return 0.44 + t * 0.1;
  }
  if (z < 5.0) {
    // 喷管：收敛加速 0.54 → 0.40
    const t = (z - 3.1) / 1.9;
    return 0.54 - t * 0.14;
  }
  // 尾喷流：自 0.40 起自由膨胀
  return 0.4 + (z - 5.0) * 0.12;
}

const C_BLUE = new THREE.Color('#3f9dff');
const C_CYAN = new THREE.Color('#7fe3ff');
const C_YELLOW = new THREE.Color('#ffe07a');
const C_ORANGE = new THREE.Color('#ff9a4d');
const C_RED = new THREE.Color('#ff6a3a');
const C_DARKRED = new THREE.Color('#ff4a2a');
const tmpColor = new THREE.Color(); // 模块级复用，避免每帧分配（M3 修复）

/* z → 颜色（模拟温度沿程变化） */
function colorAt(z: number, out: THREE.Color): THREE.Color {
  if (z < -3.1) return out.copy(C_BLUE).lerp(C_CYAN, ((z + 6) / 2.9) * 0.5);
  if (z < -0.1) {
    const t = (z - -3.1) / (-0.1 - -3.1);
    return out.copy(C_CYAN).lerp(C_YELLOW, t);
  }
  if (z < 1.7) {
    const t = (z - -0.1) / (1.7 - -0.1);
    return out.copy(C_YELLOW).lerp(C_ORANGE, t * 0.7);
  }
  if (z < 5.0) {
    const t = (z - 1.7) / (5.0 - 1.7);
    return out.copy(C_ORANGE).lerp(C_RED, t * 0.6);
  }
  const t = Math.min(1, (z - 5.0) / 2.6);
  return out.copy(C_RED).lerp(C_DARKRED, t * 0.6);
}

export function Airflow({ reduceMotion = false }: { reduceMotion?: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);

  const { geometry, data } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const data = new Float32Array(N * 2); // [phase, 方位角]
    const tmp = new THREE.Color();
    for (let i = 0; i < N; i++) {
      data[i * 2] = Math.random(); // 相位 0..1
      data[i * 2 + 1] = Math.random() * Math.PI * 2;
      const z = Z_FRONT + data[i * 2] * (Z_END - Z_FRONT);
      const r = radiusAt(z);
      pos[i * 3] = Math.cos(data[i * 2 + 1]) * r;
      pos[i * 3 + 1] = Math.sin(data[i * 2 + 1]) * r;
      pos[i * 3 + 2] = z;
      const c = colorAt(z, tmp);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return { geometry: geo, data };
  }, []);

  useFrame((state, dt) => {
    const s = useEngineStore.getState();
    const points = pointsRef.current;
    if (!points) return;
    points.visible = s.airflow;

    // 停车 / 关闭气流 / 减少动画：粒子保持静止分布，跳过逐帧计算（零空转开销）
    if (reduceMotion || !s.running || !s.airflow) return;

    const t = Math.max(0.06, s.throttle / 100);
    const flow = 0.35 + 1.5 * t; // 相位前进速度
    const swirlBase = 0.25 + 0.75 * t;

    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geometry.getAttribute('color') as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;
    const col = colAttr.array as Float32Array;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < N; i++) {
      let ph = data[i * 2];
      ph = (ph + dt * flow * 0.09) % 1;
      data[i * 2] = ph;
      const z = Z_FRONT + ph * (Z_END - Z_FRONT);
      const r = radiusAt(z);
      // 角动量守恒式旋转：越靠近中心旋得越快
      const ang = data[i * 2 + 1] + time * swirlBase * (0.9 / Math.max(r, 0.22));
      const k = i * 3;
      pos[k] = Math.cos(ang) * r;
      pos[k + 1] = Math.sin(ang) * r;
      pos[k + 2] = z;
      const c = colorAt(z, tmpColor);
      col[k] = c.r;
      col[k + 1] = c.g;
      col[k + 2] = c.b;
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={0.07}
        vertexColors
        transparent
        opacity={0.75}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
