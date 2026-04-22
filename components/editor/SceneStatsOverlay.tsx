'use client';

import { useEffect } from 'react';
import * as THREE from 'three';
import { useEditorStore } from '@/store/useEditorStore';
import { Layers, Box, Activity, Hash, MoreHorizontal } from 'lucide-react';

export function SceneStatsOverlay() {
  const { sceneStats, setSceneStats, objects, selectedId, selectedVertexIndices, selectedEdgeIndices, selectedFaceIndices } = useEditorStore();

  useEffect(() => {
    const interval = setInterval(() => {
      const sceneGrp = (window as any).__polyflow_scene as THREE.Group | undefined;
      if (!sceneGrp) return;
      
      let vertices = 0;
      let edges = 0; 
      let faces = 0;

      sceneGrp.traverse((child) => {
        if (child instanceof THREE.Mesh && child.visible) {
          const geom = child.geometry;
          if (geom && geom.attributes && geom.attributes.position) {
            if (geom.index) {
              faces += geom.index.count / 3;
            } else {
              faces += geom.attributes.position.count / 3;
            }
            vertices += geom.attributes.position.count;
          }
        }
      });

      edges = Math.floor(faces * 1.5);

      let selVerts = 0;
      let selEdges = 0;
      let selFaces = 0;
      if (selectedId) {
        selVerts = selectedVertexIndices[selectedId]?.length || 0;
        selEdges = selectedEdgeIndices[selectedId]?.length || 0;
        selFaces = selectedFaceIndices[selectedId]?.length || 0;
      }

      setSceneStats({
        vertices,
        edges,
        faces,
        objects: objects.length,
        selectedVertices: selVerts,
        selectedEdges: selEdges,
        selectedFaces: selFaces
      });
    }, 1000); 

    return () => clearInterval(interval);
  }, [objects, selectedId, selectedVertexIndices, selectedEdgeIndices, selectedFaceIndices, setSceneStats]);

  if (!sceneStats) return null;

  return (
    <div className="absolute top-4 left-4 bg-panel/80 backdrop-blur-md border border-border-dim rounded-md shadow-lg p-3 text-[11px] text-text-dim flex gap-6 z-10 pointer-events-none select-none">
      <div className="flex flex-col gap-1.5">
         <div className="text-text-main font-medium mb-1 flex items-center gap-1.5"><Layers size={12} className="text-accent" /> Scene Stats</div>
         <div className="flex justify-between gap-4"><span>Objects:</span> <span className="text-white font-mono">{sceneStats.objects.toLocaleString()}</span></div>
         <div className="flex justify-between gap-4"><span>Vertices:</span> <span className="text-white font-mono">{sceneStats.vertices.toLocaleString()}</span></div>
         <div className="flex justify-between gap-4"><span>Edges:</span> <span className="text-white font-mono">~{sceneStats.edges.toLocaleString()}</span></div>
         <div className="flex justify-between gap-4"><span>Faces:</span> <span className="text-white font-mono">{sceneStats.faces.toLocaleString()}</span></div>
      </div>
      
      {selectedId && (
        <>
          <div className="w-[1px] bg-border-dim/50 my-1 pb-1"></div>
          <div className="flex flex-col gap-1.5">
            <div className="text-text-main font-medium mb-1 flex items-center gap-1.5"><Box size={12} className="text-accent" /> Selection Info</div>
            <div className="flex justify-between gap-4"><span>Verts Selected:</span> <span className="text-white font-mono">{sceneStats.selectedVertices.toLocaleString()}</span></div>
            <div className="flex justify-between gap-4"><span>Edges Selected:</span> <span className="text-white font-mono">{sceneStats.selectedEdges.toLocaleString()}</span></div>
            <div className="flex justify-between gap-4"><span>Faces Selected:</span> <span className="text-white font-mono">{sceneStats.selectedFaces.toLocaleString()}</span></div>
          </div>
        </>
      )}
    </div>
  );
}
