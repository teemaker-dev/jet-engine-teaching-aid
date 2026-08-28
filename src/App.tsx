/**
 * 应用主框架：桌面三栏布局 / 移动端底部抽屉 + 浮层 + 电脑端提示
 * 单一 Canvas 常驻，仅切换外围 Chrome，避免断点切换时 3D 场景重挂载。
 */
import { useEffect, useState } from 'react';
import { Scene } from './engine/Scene';
import { ControlPanel } from './components/ControlPanel';
import { InfoPanel } from './components/InfoPanel';
import { useEngineStore } from './store';
import { useMediaQuery, usePrefersReducedMotion } from './hooks';

const MOBILE_QUERY = '(max-width: 1023px)';

/* 移动端"建议电脑端打开"提示 */
function MobileNotice() {
  const dismissed = useEngineStore((s) => s.mobileNoticeDismissed);
  const dismissNotice = useEngineStore((s) => s.dismissNotice);
  if (dismissed) return null;
  return (
    <div className="mobile-notice" role="status">
      <span className="notice-ico" aria-hidden="true">
        ℹ
      </span>
      <span className="notice-text">建议使用电脑端打开，获得更完整的 3D 交互体验</span>
      <button type="button" className="notice-close" onClick={dismissNotice} aria-label="关闭提示">
        ✕
      </button>
    </div>
  );
}

/* 移动端底部抽屉 */
function ControlDrawer() {
  const [open, setOpen] = useState(false);
  return (
    <div className="drawer-wrap">
      {open && (
        <div className="drawer-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      )}
      <div className={`drawer${open ? ' open' : ''}`}>
        <button
          type="button"
          className="drawer-handle"
          aria-expanded={open}
          aria-controls="drawer-panel"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="drawer-handle-bar" aria-hidden="true" />
          <span className="drawer-handle-label">{open ? '收起控制面板' : '控制面板'}</span>
        </button>
        <div id="drawer-panel" className="drawer-body">
          <ControlPanel />
        </div>
      </div>
    </div>
  );
}

/* 移动端站位/章节浮层（可折叠） */
function MobileInfoCard() {
  const [open, setOpen] = useState(true);
  return (
    <div className="mobile-card-wrap">
      <button
        type="button"
        className="mobile-card-toggle"
        aria-expanded={open}
        aria-controls="mobile-card"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="mct-dot" aria-hidden="true" />
        {open ? '收起信息' : '查看信息'}
      </button>
      {open && (
        <div id="mobile-card" className="mobile-card">
          <InfoPanel compact />
        </div>
      )}
    </div>
  );
}

function MobileChrome() {
  return (
    <>
      <MobileNotice />
      <MobileInfoCard />
      <ControlDrawer />
    </>
  );
}

function DesktopChrome() {
  return (
    <>
      <aside className="panel panel-left">
        <header className="panel-head">
          <h1 className="app-title">喷气发动机 3D 互动教具</h1>
          <p className="app-sub">涡喷发动机 · 工作原理与热力参数教学</p>
        </header>
        <ControlPanel />
      </aside>
      <aside className="panel panel-right">
        <InfoPanel />
      </aside>
    </>
  );
}

export default function App() {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const reduceMotion = usePrefersReducedMotion();
  const running = useEngineStore((s) => s.running);
  const setThrottle = useEngineStore((s) => s.setThrottle);
  const toggleRunning = useEngineStore((s) => s.toggleRunning);

  /* 键盘无障碍：Space 启动/停车，↑/↓ 调节油门 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggleRunning();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        const s = useEngineStore.getState();
        setThrottle(Math.min(100, s.throttle + 5));
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const s = useEngineStore.getState();
        setThrottle(Math.max(0, s.throttle - 5));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setThrottle, toggleRunning]);

  return (
    <div className={`app is-${isMobile ? 'mobile' : 'desktop'}`}>
      <main className="canvas-stage" role="application" aria-label="喷气发动机 3D 教学模型，可用鼠标或触控旋转与缩放">
        <Scene reduceMotion={reduceMotion} />
      </main>
      <div className="sr-only" role="status" aria-live="polite">
        {running ? '发动机已启动' : '发动机已停车'}
      </div>
      {isMobile ? <MobileChrome /> : <DesktopChrome />}
    </div>
  );
}
