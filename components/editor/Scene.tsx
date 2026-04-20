'use client';

import { useEffect, useRef } from 'react';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import { useEditorStore } from '@/store/useEditorStore';
import { MeshObject } from './MeshObject';
import * as THREE from 'three';

export function Scene() {
  const { objects, selectedId, isSelecting, activeTool, selectionBox } = useEditorStore();
  const groupRef = useRef<THREE.Group>(null);
  
  // Expose the group reference to window for the exporter
  useEffect(() => {
    if (groupRef.current) {
      (window as any).__polyflow_scene = groupRef.current;
    }
  }, []);

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

      <Grid fadeDistance={30} infiniteGrid sectionColor="#404040" cellColor="#262626" />
      <Environment preset="city" />
      
      <OrbitControls 
        makeDefault 
        enabled={activeTool === 'orbit' && !isSelecting && !selectionBox}
      />
    </>
  );
}
