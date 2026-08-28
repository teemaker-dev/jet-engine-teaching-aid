/**
 * 右侧信息面板（桌面右栏 & 移动端浮层共用）：
 *  - 站位信息 Tab：整机摘要 + 站位列表 + 选中站位详情（温度/压强/速度/能量条）
 *  - 教学章节 Tab：章节列表 + 正文
 */
import { useMemo } from 'react';
import { useEngineStore } from '../store';
import { computeEngine, STATIONS, type StationValues } from '../data/stations';
import { CHAPTERS } from '../data/chapters';

const METRICS: { key: 'T' | 'P' | 'V' | 'H'; label: string; unit: string; color: string }[] = [
  { key: 'T', label: '温度', unit: 'K', color: '#ff6b4a' },
  { key: 'P', label: '压强', unit: 'kPa', color: '#4dd0ff' },
  { key: 'V', label: '速度', unit: 'm/s', color: '#7fe3a0' },
  { key: 'H', label: '能量·焓', unit: 'kJ/kg', color: '#ffd27a' },
];

/* 摘要条（推力 / 转速 / 压比 / 排气温度） */
function SummaryStrip() {
  const { throttle, running } = useEngineStore();
  const { summary } = useMemo(() => computeEngine(throttle), [throttle]);
  const items = [
    { k: '推力', v: running ? `${summary.thrust}` : '—', u: 'kN' },
    { k: '转速 N1', v: running ? `${summary.n1}` : '—', u: '%' },
    { k: '总压比', v: `${summary.opr}`, u: '' },
    { k: 'EGT', v: running ? `${summary.egt}` : '—', u: 'K' },
  ];
  return (
    <div className="summary-strip">
      {items.map((it) => (
        <div className="stat-card" key={it.k}>
          <span className="stat-k">{it.k}</span>
          <span className="stat-v">
            {it.v}
            {it.u && <em>{it.u}</em>}
          </span>
        </div>
      ))}
    </div>
  );
}

/* 单条参数条 */
function Bar({ label, value, unit, max, color }: { label: string; value: number; unit: string; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="bar-row">
      <div className="bar-label">{label}</div>
      <div className="bar-track" role="img" aria-label={`${label} ${value}${unit}，占满程 ${Math.round(pct)}%`}>
        <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="bar-value">
        {value}
        {unit}
      </div>
    </div>
  );
}

/* 选中站位详情 */
function StationDetail() {
  const selectedStation = useEngineStore((s) => s.selectedStation);
  const throttle = useEngineStore((s) => s.throttle);
  const running = useEngineStore((s) => s.running);

  const { stations } = useMemo(() => computeEngine(throttle), [throttle]);
  const st = STATIONS.find((x) => x.id === selectedStation) ?? STATIONS[0];
  const val = stations[st.id];

  /* 各指标的满程值（取所有站位最大值） */
  const maxOf: Record<string, number> = useMemo(() => {
    const all = Object.values(stations);
    const m: Record<string, number> = {};
    for (const metric of METRICS) m[metric.key] = Math.max(...all.map((v) => v[metric.key]));
    return m;
  }, [stations]);

  return (
    <div className="station-detail" aria-live="polite">
      <div className="sd-head">
        <span className="sd-tag" style={{ background: st.color }}>
          {st.label}
        </span>
        <h3 className="sd-name">{st.name}</h3>
      </div>
      <p className="sd-desc">{st.desc}</p>
      <p className="sd-stage">
        该段作用：<b>{val.stage}</b>
        {!running && '（发动机未启动，数值为停车状态）'}
      </p>
      <div className="bars">
        {METRICS.map((m) => (
          <Bar key={m.key} label={m.label} value={val[m.key]} unit={m.unit} max={maxOf[m.key]} color={m.color} />
        ))}
      </div>
    </div>
  );
}

/* 站位列表 */
function StationList() {
  const selectedStation = useEngineStore((s) => s.selectedStation);
  const setStation = useEngineStore((s) => s.setStation);
  const throttle = useEngineStore((s) => s.throttle);
  const { stations } = useMemo(() => computeEngine(throttle), [throttle]);

  return (
    <div className="station-list">
      {STATIONS.map((st) => {
        const sel = selectedStation === st.id;
        const v = stations[st.id];
        return (
          <button
            key={st.id}
            type="button"
            className={`station-card${sel ? ' sel' : ''}`}
            style={sel ? { borderColor: st.color } : undefined}
            aria-pressed={sel}
            onClick={() => setStation(st.id)}
          >
            <span className="sc-tag" style={{ background: st.color }}>
              {st.id}
            </span>
            <span className="sc-body">
              <span className="sc-name">{st.name}</span>
              <span className="sc-vals">
                T {v.T}K · P {v.P}kPa · V {v.V}m/s
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* 教学章节 */
function ChapterView() {
  const selectedChapter = useEngineStore((s) => s.selectedChapter);
  const setChapter = useEngineStore((s) => s.setChapter);
  const idx = Math.max(0, CHAPTERS.findIndex((c) => c.id === selectedChapter));
  const ch = CHAPTERS[idx];
  const prev = CHAPTERS[idx - 1];
  const next = CHAPTERS[idx + 1];

  return (
    <div className="chapter-view">
      <nav className="chapter-nav" aria-label="教学章节">
        {CHAPTERS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chapter-btn${c.id === selectedChapter ? ' sel' : ''}`}
            aria-pressed={c.id === selectedChapter}
            onClick={() => setChapter(c.id)}
          >
            <span className="cb-num">{c.num}</span>
            <span className="cb-title">{c.title}</span>
          </button>
        ))}
      </nav>
      <article className="chapter-body" aria-live="polite">
        <h3 className="ch-title">
          <span className="ch-num">{ch.num}</span> {ch.title}
        </h3>
        {ch.sections.map((sec, i) => (
          <section className="ch-sec" key={i}>
            <h4>{sec.heading}</h4>
            <p>{sec.body}</p>
          </section>
        ))}
        <div className="ch-pager">
          {prev ? (
            <button type="button" className="ch-page-btn" onClick={() => setChapter(prev.id)}>
              ← {prev.num} {prev.title}
            </button>
          ) : (
            <span />
          )}
          {next ? (
            <button type="button" className="ch-page-btn" onClick={() => setChapter(next.id)}>
              {next.num} {next.title} →
            </button>
          ) : (
            <span />
          )}
        </div>
      </article>
    </div>
  );
}

/* 信息面板主组件 */
export function InfoPanel({ compact = false }: { compact?: boolean }) {
  const infoTab = useEngineStore((s) => s.infoTab);
  const setInfoTab = useEngineStore((s) => s.setInfoTab);

  return (
    <div className={`info-panel${compact ? ' compact' : ''}`}>
      <div className="info-tabs" role="tablist" aria-label="信息面板">
        <button
          type="button"
          role="tab"
          aria-selected={infoTab === 'station'}
          className={`info-tab${infoTab === 'station' ? ' sel' : ''}`}
          onClick={() => setInfoTab('station')}
        >
          站位信息
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={infoTab === 'chapter'}
          className={`info-tab${infoTab === 'chapter' ? ' sel' : ''}`}
          onClick={() => setInfoTab('chapter')}
        >
          教学章节
        </button>
      </div>
      <div className="info-body">
        {infoTab === 'station' ? (
          <>
            <SummaryStrip />
            <StationDetail />
            <StationList />
          </>
        ) : (
          <ChapterView />
        )}
      </div>
    </div>
  );
}
