/**
 * 站位定义 + 简化热力模型
 * ------------------------------------------------------------------
 * 本教具采用"地面静止、海平面标准大气"的教学简化模型：
 *   T0 = 288 K，P0 = 101.3 kPa，V0 = 0 m/s
 * 所有数值为教学示意值（非某一具体发动机型号的真实数据），
 * 用于直观展示沿程 压比 / 温度 / 速度 / 能量 的变化趋势。
 */

export interface Station {
  id: number;
  label: string;
  name: string;
  posZ: number; // 在发动机轴线上的位置（z 轴，负=前方）
  color: string;
  module: string; // 高亮对应的 3D 模块 id
  desc: string;
}

export const STATIONS: Station[] = [
  {
    id: 0, label: '站位 0', name: '自由来流', posZ: -6.2, color: '#4dd0ff', module: 'intake',
    desc: '发动机前方未受扰动的空气。温度等于环境温度（288 K），压强等于大气压（101.3 kPa），速度取决于飞行状态（本教具默认地面静止）。',
  },
  {
    id: 1, label: '站位 1', name: '进气道出口 / 风扇进口', posZ: -3.1, color: '#4dd0ff', module: 'fan',
    desc: '气流经进气道减速增压：速度下降、压强略升（冲压效应）。飞行马赫数越高，冲压增压越明显；地面静止时进气道主要起导流与整流作用。',
  },
  {
    id: 2, label: '站位 2', name: '压气机出口', posZ: -0.1, color: '#ffe066', module: 'comp5',
    desc: '压气机对空气做功，压强与温度大幅升高，总压比（OPR）可达 10~25。这是发动机最重要的增压环节——压比越高，循环效率越高。',
  },
  {
    id: 3, label: '站位 3', name: '燃烧室进口', posZ: 0.5, color: '#ffb347', module: 'combustor',
    desc: '高压空气进入环形燃烧室。一部分空气进入火焰筒与燃油混合燃烧，另一部分沿外壁流过并参与掺混降温，为涡轮叶片提供可承受的燃气温度。',
  },
  {
    id: 4, label: '站位 4', name: '燃烧室出口 / 涡轮进口', posZ: 1.7, color: '#ff6b4a', module: 'combustor',
    desc: '燃油燃烧使温度骤升至约 1400~1600 K，是全流程温度最高点。燃烧近似等压过程，压强仅略降，能量（焓）达到最大。',
  },
  {
    id: 5, label: '站位 5', name: '涡轮出口', posZ: 3.1, color: '#ff9d45', module: 'turb1',
    desc: '高温燃气在涡轮中膨胀做功，驱动同轴压气机与风扇。温度、压强显著下降，能量被提取。涡轮出口温度 EGT 是发动机最重要的监控参数之一。',
  },
  {
    id: 8, label: '站位 8', name: '喷管出口', posZ: 5.0, color: '#ff7847', module: 'nozzle',
    desc: '燃气在喷管中继续膨胀加速，以全流程最高速度喷出，产生反作用推力。出口压强恢复到接近大气压。推力 = 质量流量 × (出口速度 − 进口速度)。',
  },
];

export interface StationValues {
  P: number; // kPa
  T: number; // K
  V: number; // m/s
  H: number; // 比焓 kJ/kg（能量）
  stage: string; // 该段作用说明
}

export interface EngineSummary {
  thrust: number; // kN（示意）
  opr: number; // 总压比
  n1: number; // 高压转速 %
  egt: number; // 排气温度 K
  mdot: number; // 空气质量流量 kg/s（示意）
}

export interface EngineData {
  stations: Record<number, StationValues>;
  summary: EngineSummary;
}

const CP = 1.005; // kJ/(kg·K) 空气定压比热

/** 依据油门百分比（0~100）计算各站位热力参数与整机摘要 */
export function computeEngine(throttle: number): EngineData {
  const t = Math.max(0, Math.min(1, throttle / 100));
  const T0 = 288;
  const P0 = 101.3;

  const T1 = T0 + 2 + 8 * t;
  const P1 = P0 * (1 + 0.03 * t);
  const V1 = 20 + 130 * t;

  const opr = 1 + 14 * t; // 满油门总压比 ≈ 15
  const T2 = T0 + 60 + 352 * t;
  const P2 = P1 * opr;
  const V2 = 25 + 150 * t;

  const T3 = T2;
  const P3 = P2 * 0.99;
  const V3 = V2;

  const T4 = T0 + 120 + 1080 * t; // 满油门 ≈ 1488 K（最高温）
  const P4 = P2 * 0.93;
  const V4 = 40 + 220 * t;

  const T5 = T0 + 100 + 560 * t; // 满油门 ≈ 948 K
  const P5 = P2 * 0.22;
  const V5 = 80 + 320 * t;

  const T8 = T0 + 120 + 340 * t; // 满油门 ≈ 748 K
  const P8 = P0 * (1.0 - 0.01 * t);
  const V8 = 120 + 500 * t; // 满油门 ≈ 620 m/s（最高速）

  // 空气质量流量（kg/s，教学量级，随油门线性增长）
  const mdot = 8 + 30 * t;
  // 推力按动量近似 F ≈ ṁ·(Ve − V0)（地面静止 V0 = 0）由 mdot × V8 推导，
  // 保证与出口速度、流量三数自洽；未计压差项与附加阻力，属教学简化。
  const thrust = (mdot * V8) / 1000; // kN

  const mk = (P: number, T: number, V: number, stage: string): StationValues => ({
    P: Math.round(P * 10) / 10,
    T: Math.round(T),
    V: Math.round(V),
    H: Math.round(T * CP),
    stage,
  });

  return {
    stations: {
      0: mk(P0, T0, 0, '环境空气'),
      1: mk(P1, T1, V1, '进气道减速增压'),
      2: mk(P2, T2, V2, '压气机做功增压'),
      3: mk(P3, T3, V3, '进入燃烧室'),
      4: mk(P4, T4, V4, '燃烧加温（等压）'),
      5: mk(P5, T5, V5, '涡轮膨胀做功'),
      8: mk(P8, T8, V8, '喷管膨胀加速'),
    },
    summary: {
      thrust: Math.round(thrust * 10) / 10,
      opr: Math.round(opr * 10) / 10,
      n1: Math.round(28 + 66 * t),
      egt: Math.round(T5),
      mdot: Math.round(mdot * 10) / 10,
    },
  };
}
