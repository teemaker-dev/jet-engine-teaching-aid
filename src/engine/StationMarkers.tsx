/**
 * 3D 站位标记：可点击的小球 + 始终面向相机的编号标签
 * 点击某站位 → 选中并在右侧信息卡展示该站位参数
 */
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useEngineStore } from '../store';
import { STATIONS } from '../data/stations';

export function StationMarkers() {
  const selectedStation = useEngineStore((s) => s.selectedStation);
  const setStation = useEngineStore((s) => s.setStation);

  return (
    <>
      {STATIONS.map((st) => {
        const sel = selectedStation === st.id;
        return (
          <group key={st.id} position={[0, -0.28, st.posZ]}>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                setStation(st.id);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'auto';
              }}
            >
              <sphereGeometry args={[sel ? 0.12 : 0.085, 20, 20]} />
              <meshBasicMaterial color={st.color} />
            </mesh>
            {/* 选中光环 */}
            {sel && (
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.15, 0.19, 32]} />
                <meshBasicMaterial color={st.color} transparent opacity={0.7} side={THREE.DoubleSide} />
              </mesh>
            )}
            <Html position={[0, sel ? 0.38 : 0.32, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
              <div
                className={`st-label${sel ? ' sel' : ''}`}
                style={{
                  background: sel ? st.color : 'rgba(11,16,32,0.72)',
                  borderColor: st.color,
                  color: sel ? '#06101f' : st.color,
                }}
                aria-hidden="true"
              >
                {st.id}
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}
