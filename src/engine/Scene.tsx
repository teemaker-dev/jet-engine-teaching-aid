/**
 * 3D 场景：Canvas + 相机 + 灯光 + 平台 + 轨道控制
 */
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EngineModel } from './EngineModel';
import { Airflow } from './Airflow';
import { StationMarkers } from './StationMarkers';
import { useEngineStore } from '../store';

function Platform() {
  return (
    <group position={[0, -1.28, 0]}>
      {/* 实验台底盘 */}
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[2.6, 2.9, 0.12, 64]} />
        <meshStandardMaterial color={0x1b2436} metalness={0.6} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[2.45, 2.45, 0.04, 64]} />
        <meshStandardMaterial color={0x232e44} metalness={0.5} roughness={0.5} />
      </mesh>
      <gridHelper args={[16, 24, '#2c3d63', '#172338']} position={[0, 0.09, 0]} />
    </group>
  );
}

export function Scene({ reduceMotion = false }: { reduceMotion?: boolean }) {
  const autoRotate = useEngineStore((s) => s.autoRotate);
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [6.8, 3.4, 10.5], fov: 42, near: 0.1, far: 200 }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true;
      }}
    >
      <color attach="background" args={['#0a0e18']} />
      <fog attach="fog" args={['#0a0e18', 26, 48]} />

      <ambientLight intensity={0.55} />
      <directionalLight position={[7, 9, 5]} intensity={1.5} />
      <directionalLight position={[-7, -2, -5]} intensity={0.45} color="#7aa2ff" />
      <directionalLight position={[0, 3, -8]} intensity={0.5} color="#cfe3ff" />
      <hemisphereLight args={['#31415f', '#0a0e18', 0.5]} />

      <EngineModel />
      <Airflow reduceMotion={reduceMotion} />
      <StationMarkers />
      <Platform />

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        autoRotate={!reduceMotion && autoRotate}
        autoRotateSpeed={0.9}
        minDistance={4.5}
        maxDistance={26}
        maxPolarAngle={Math.PI * 0.55}
        enablePan={false}
      />
    </Canvas>
  );
}
