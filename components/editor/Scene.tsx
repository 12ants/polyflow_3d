'use client';

import { useEffect, useRef } from 'react';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEditorStore } from '@/store/useEditorStore';
import { MeshObject } from './MeshObject';
import * as THREE from 'three';

export function Scene() {
  const { objects, selectedId, isSelecting, activeTool, selectionBox, gridColor, cameraResetTrigger } = useEditorStore();
  const groupRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  
  // Expose the group reference to window for the exporter
  useEffect(() => {
    if (groupRef.current) {
      (window as any).__polyflow_scene = groupRef.current;
    }
  }, []);

  useEffect(() => {
    if (cameraResetTrigger > 0) {
      camera.position.set(5, 5, 5);
      camera.lookAt(0, 0, 0);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
    }
  }, [cameraResetTrigger, camera]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow shadow-bias={-0.0001} />
      <directionalLight position={[-10, 10, -5]} intensity={0.5} />

      {/* Main objects group */}
      <group ref={groupRef}>
        {objects.map((obj) => (
          <MeshObject key={obj.id} object={obj} />
        ))}
      </group>

      <Grid fadeDistance={30} infiniteGrid sectionColor={gridColor} cellColor={new THREE.Color(gridColor).multiplyScalar(0.6).getStyle()} />
      <Environment preset="city" />
      
      <OrbitControls 
        ref={controlsRef}
        makeDefault 
        enabled={activeTool === 'orbit' && !isSelecting && !selectionBox}
      />
    </>
  );
}
