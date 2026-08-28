import { create } from 'zustand';

/** 全局交互状态（跨 Canvas 与 DOM UI） */
interface EngineStore {
  running: boolean;
  throttle: number; // 0~100
  exploded: boolean;
  cutaway: boolean;
  casingOpacity: number; // 0.05~1
  airflow: boolean;
  autoRotate: boolean;
  selectedStation: number; // 站位 id（默认 0）
  selectedChapter: string; // 章节 id
  infoTab: 'station' | 'chapter';
  mobileNoticeDismissed: boolean;

  toggleRunning: () => void;
  setThrottle: (v: number) => void;
  toggleExploded: () => void;
  toggleCutaway: () => void;
  setCasingOpacity: (v: number) => void;
  toggleAirflow: () => void;
  toggleAutoRotate: () => void;
  setStation: (id: number) => void;
  setChapter: (id: string) => void;
  setInfoTab: (t: 'station' | 'chapter') => void;
  dismissNotice: () => void;
}

export const useEngineStore = create<EngineStore>((set) => ({
  running: false,
  throttle: 55,
  exploded: false,
  cutaway: false,
  casingOpacity: 0.32,
  airflow: true,
  autoRotate: false,
  selectedStation: 0,
  selectedChapter: 'principle',
  infoTab: 'station',
  mobileNoticeDismissed:
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('jet-teaching-notice-dismissed') === '1'
      : false,

  toggleRunning: () =>
    set((s) => {
      // 启动时保证不低于慢车油门，避免"油门为零启动"
      const throttle = !s.running && s.throttle < 12 ? 12 : s.throttle;
      return { running: !s.running, throttle };
    }),
  setThrottle: (v) => set({ throttle: v }),
  toggleExploded: () => set((s) => ({ exploded: !s.exploded })),
  toggleCutaway: () => set((s) => ({ cutaway: !s.cutaway })),
  setCasingOpacity: (v) => set({ casingOpacity: v }),
  toggleAirflow: () => set((s) => ({ airflow: !s.airflow })),
  toggleAutoRotate: () => set((s) => ({ autoRotate: !s.autoRotate })),
  setStation: (id) => set({ selectedStation: id }),
  setChapter: (id) => set({ selectedChapter: id }),
  setInfoTab: (t) => set({ infoTab: t }),
  dismissNotice: () => {
    try {
      localStorage.setItem('jet-teaching-notice-dismissed', '1');
    } catch {
      /* 隐私模式等场景忽略 */
    }
    set({ mobileNoticeDismissed: true });
  },
}));
