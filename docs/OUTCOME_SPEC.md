# 喷气发动机 3D 互动教具 · Outcome Specification（完成条件清单）

> 本文件为任务开始前固化的完成条件（Outcome Specification），并记录逐条验收结果。
> 依据：Outcome Execution Loop（SSOT：knowledge/00_governance/OUTCOME_EXECUTION_LOOP.md）
> 项目：/home/upc/projects/jet-engine-teaching-aid/（2026-08-27 构建）

## 一、完成条件清单（动手前固化的 Outcome Spec）

| # | 完成条件 | 判定方式 | 结果 |
|---|----------|----------|------|
| O1 | Vite + React + TS + Three.js 项目可构建、可运行 | `npm run build` 通过；dev server 可访问 | PASS |
| O2 | 程序化几何：进气道/压气机(风扇+多级叶片)/燃烧室/涡轮/喷管，零外部素材 | 代码审查 + 网络请求检查 | PASS |
| O3 | 交互：旋转缩放/启动/油门/爆炸拆解/剖切/透明度/气流可视化 | L3 调试句柄 + 交互实测 | PASS |
| O4 | 站位 0/1/2/3/4/5/8 信息卡展示压比/温度/速度/能量，数值随油门变化 | DOM 数值实测（油门 55%→100%） | PASS |
| O5 | 章节式教学说明（≥5 章） | DOM 章节导航 + 正文渲染 | PASS |
| O6 | 桌面端三栏布局 + 深色航空实验台风格 | L2 截图 + DOM | PASS |
| O7 | 移动端：底部抽屉/可折叠浮层/电脑端提示/safe-area/触控 | 断点切换 + DOM + 截图 | PASS |
| O8 | 无障碍：aria/键盘/reduced-motion | DOM + 键盘实测 | PASS（reduced-motion 接线见 R4） |
| O9 | 性能：dpr 限制/InstancedMesh/无每帧对象分配 | 代码审查 + 运行时测量 | PASS（见 R3 修复后） |

## 二、验收证据（L3 确定性为主）

- 构建：`npm run build` → tsc --noEmit + vite build 通过（JS 1,093KB / gzip 308KB）
- 动画循环：`window.__jetDebug` 采样 spin/fanRotZ/fanPosZ/clipConstant/casingOpacity 证明启动、爆炸、剖切、透明度真实生效
- 油门联动：滑杆设 100 后 OPR 8.7→15、N1→94%、推力→23.6kN、EGT→948K、spin→1.0
- 移动端：断点切换后抽屉/浮层/提示条 DOM 出现并截图确认
- 控制台零 JS 错误

## 三、DSH 审查问题修复记录（2026-08-28）

外部审查（DSH）对实现进行了逐文件审查，结论为"达到可交付教学原型水准"，并指出若干问题。核实与修复如下：

| 编号 | 问题 | 核实 | 修复 |
|------|------|------|------|
| H1 | 热力不自洽：满油门 thrust 24.5kN vs ṁ×V8=55.8kN | ✅ 属实 | stations.ts 推力改为动量近似 `F=ṁ·(Ve−V0)` 推导，流量调为教学量级 8+30t，三数自洽 |
| M1 | 气流半径分段跳变 | ✅ 属实（真实跳变在 z=0.1/1.7，审查报告位置部分有偏差） | Airflow.tsx radiusAt 全段连续化 |
| M2 | 叶片倾斜轴错误 | ❌ 误判（node 实测各方位 pitch 一致 31.51°，径向方向正确） | 不修 |
| M3 | useFrame 每帧分配 + 停车空转 | ✅ 属实 | EngineModel `_lerpTarget` 复用；Airflow 模块级 Color 复用 + 停车/关流 early-return |
| M4 | usePrefersReducedMotion 死代码 + README 声称失实 | ✅ 属实 | App→Scene→Airflow 接线；OrbitControls 自动旋转联动 |
| L2 | 火焰筒选中高亮被 useFrame 覆盖 | ✅ 属实 | EngineModel 燃烧室高亮取 max(辉光, 选中高亮) |
| 自述#3 | "14 次 draw call"（实际 17 个 BladeRing） | ✅ 属实（实施者失误） | 已更正认知；实现本身无 bug |

### 修复后自洽性验证（node 实测）
- H1：满油门 thrust = 38 × 620 / 1000 = **23.6 kN** = ṁ×V8/1000 ✓（自洽）
- M1：radiusAt 在 z=0.1/1.7/3.1/5.0 全部连续（0.52→0.52→0.44→0.54→0.40）✓

## 四、已知局限（实事求是）

- 热力模型为"教学示意值"，非特定型号真实数据（代码注释已声明）
- 叶片为简化 box 几何，非真实气动叶型
- 无单元测试框架（验证依赖构建 + L3 调试句柄 + 截图）
- 移动端触控未在真实手机实测（headless 断点验证 + 截图）
