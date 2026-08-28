/**
 * 控制面板（桌面左侧栏 & 移动端底部抽屉共用同一内容）
 */
import { useMemo } from 'react';
import { useEngineStore } from '../store';
import { computeEngine, STATIONS } from '../data/stations';

function Toggle({
  id,
  label,
  desc,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      className={`toggle${checked ? ' on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
      <span className="toggle-text">
        <span className="toggle-label">{label}</span>
        {desc && <span className="toggle-desc">{desc}</span>}
      </span>
    </button>
  );
}

export function ControlPanel() {
  const {
    running,
    throttle,
    exploded,
    cutaway,
    airflow,
    autoRotate,
    casingOpacity,
    selectedStation,
    toggleRunning,
    setThrottle,
    toggleExploded,
    toggleCutaway,
    toggleAirflow,
    toggleAutoRotate,
    setCasingOpacity,
    setStation,
  } = useEngineStore();

  const data = useMemo(() => computeEngine(throttle), [throttle]);
  const { summary } = data;

  return (
    <div className="control-panel">
      <section className="cp-section">
        <h2 className="cp-title">发动机状态</h2>
        <div className="cp-row">
          <button
            type="button"
            className={`btn-start${running ? ' running' : ''}`}
            aria-pressed={running}
            onClick={toggleRunning}
          >
            <span className="btn-start-icon" aria-hidden="true" />
            {running ? '停车' : '启动'}
          </button>
          <div className="live-readout" aria-live="polite">
            <div className="live-item">
              <span className="live-k">转速 N1</span>
              <span className="live-v">{running ? `${summary.n1}%` : '——'}</span>
            </div>
            <div className="live-item">
              <span className="live-k">推力</span>
              <span className="live-v">{running ? `${summary.thrust} kN` : '——'}</span>
            </div>
          </div>
        </div>
        <label className="slider-row" htmlFor="throttle">
          <span className="slider-label">油门</span>
          <input
            id="throttle"
            type="range"
            min={0}
            max={100}
            step={1}
            value={throttle}
            onChange={(e) => setThrottle(Number(e.target.value))}
            aria-label="油门"
            aria-valuetext={`${throttle}%`}
          />
          <span className="slider-value">{throttle}%</span>
        </label>
        <div className="mini-stats">
          <span>总压比 OPR <b>{summary.opr}</b></span>
          <span>EGT <b>{summary.egt}K</b></span>
          <span>流量 <b>{summary.mdot}kg/s</b></span>
        </div>
      </section>

      <section className="cp-section">
        <h2 className="cp-title">显示选项</h2>
        <div className="toggle-list">
          <Toggle id="t-airflow" label="气流可视化" checked={airflow} onChange={toggleAirflow} desc="沿程粒子流，颜色随温度变化" />
          <Toggle id="t-cut" label="剖切视图" checked={cutaway} onChange={toggleCutaway} desc="切去下半部，观察内部结构" />
          <Toggle id="t-explode" label="爆炸拆解" checked={exploded} onChange={toggleExploded} desc="模块沿径向分离，看清层次" />
          <Toggle id="t-rotate" label="自动旋转" checked={autoRotate} onChange={toggleAutoRotate} desc="相机环绕发动机慢速旋转" />
        </div>
        <label className="slider-row" htmlFor="opacity">
          <span className="slider-label">机匣透明度</span>
          <input
            id="opacity"
            type="range"
            min={5}
            max={100}
            step={1}
            value={Math.round(casingOpacity * 100)}
            onChange={(e) => setCasingOpacity(Number(e.target.value) / 100)}
            aria-label="机匣透明度"
            aria-valuetext={`${Math.round(casingOpacity * 100)}%`}
          />
          <span className="slider-value">{Math.round(casingOpacity * 100)}%</span>
        </label>
      </section>

      <section className="cp-section">
        <h2 className="cp-title">站位快速定位</h2>
        <div className="chip-row" role="group" aria-label="站位快速定位">
          {STATIONS.map((st) => (
            <button
              key={st.id}
              type="button"
              className={`chip${selectedStation === st.id ? ' sel' : ''}`}
              style={selectedStation === st.id ? { borderColor: st.color, color: st.color } : undefined}
              aria-pressed={selectedStation === st.id}
              onClick={() => setStation(st.id)}
              title={st.name}
            >
              {st.id}
            </button>
          ))}
        </div>
        <p className="cp-hint">点击发动机旁的站位球也可选中站位</p>
      </section>
    </div>
  );
}
