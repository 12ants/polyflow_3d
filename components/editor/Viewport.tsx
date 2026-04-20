'use client';

import { useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './Scene';
import { useEditorStore } from '@/store/useEditorStore';

export function Viewport() {
  const { 
    selectObject, editMode, setSelectionBox, setIsSelecting, isSelecting, selectionBox, activeTool, selectVertex,
    lassoPath, setLassoPath, selectionShape,
    selectedId, selectedVertexIndices, selectedEdgeIndices, selectedFaceIndices,
    clearAllSubSelections, selectEdge, setSelectionMode
  } = useEditorStore();
  const containerRef = useRef<HTMLDivElement>(null);

  const totalSelectedVertices = Object.values(selectedVertexIndices).reduce((acc, curr) => acc + curr.length, 0);
  const totalSelectedEdges = Object.values(selectedEdgeIndices).reduce((acc, curr) => acc + curr.length, 0);
  const totalSelectedFaces = Object.values(selectedFaceIndices).reduce((acc, curr) => acc + curr.length, 0);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only trigger box selection if:
    // 1. Left click
    // 2. Not clicking on a gizmo (TransformControls usually handles its own events)
    // 3. Either "selection" tool is active OR Shift key is held
    const isSelectionIntended = activeTool === 'select' || e.shiftKey;
    
    if (e.button !== 0 || !isSelectionIntended) return;
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    
    setSelectionBox({ start: { x: startX, y: startY }, end: { x: startX, y: startY } });
    if (selectionShape === 'lasso') {
      setLassoPath([{ x: startX, y: startY }]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!selectionBox) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    // Check threshold for starting selection visual
    if (!isSelecting) {
      const dist = Math.sqrt(Math.pow(currentX - selectionBox.start.x, 2) + Math.pow(currentY - selectionBox.start.y, 2));
      if (dist > 5) {
        let mode: 'add' | 'subtract' | 'replace' = 'replace';
        if (e.shiftKey) mode = 'add';
        else if (e.ctrlKey || e.metaKey) mode = 'subtract';
        
        setSelectionMode(mode);
        setIsSelecting(true);
      }
    }
    
    if (isSelecting) {
      if (selectionShape === 'box') {
        setSelectionBox({ ...selectionBox, end: { x: currentX, y: currentY } });
      } else {
        setLassoPath([...(lassoPath || []), { x: currentX, y: currentY }]);
      }
    }
  };

  const handlePointerUp = () => {
    if (isSelecting) {
      setIsSelecting(false);
    }
    // Always clear these so selection doesn't get stuck if drag was < 5px
    setTimeout(() => {
      setSelectionBox(null);
      setLassoPath(null);
    }, 50);
  };

  return (
    <div 
      ref={containerRef}
      className={`absolute inset-0 w-full h-full outline-none overflow-hidden select-none ${
        activeTool === 'select' ? 'cursor-cell' : 'cursor-grab active:cursor-grabbing'
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <Canvas
        camera={{ position: [5, 5, 5], fov: 50 }}
        shadows
        raycaster={{ params: { Points: { threshold: 0.15 }, Line: { threshold: 0.15 } } } as any}
        onPointerMissed={(e) => {
          if (!isSelecting) {
            // Blender style: click empty space deselects unless Shift held
            if (!e.shiftKey) {
              selectObject(null);
              clearAllSubSelections();
            }
          }
        }}
      >
        <Scene />
      </Canvas>

      {/* Selection HUD */}
      {(selectedId || totalSelectedVertices > 0 || totalSelectedEdges > 0 || totalSelectedFaces > 0) && (
        <div className="absolute top-5 right-5 bg-panel/80 backdrop-blur-sm border border-border-dim rounded-md px-3 py-2 pointer-events-none">
          <div className="text-[10px] uppercase font-bold text-text-dim mb-1">Selection</div>
          <div className="flex flex-col gap-0.5">
            {selectedId && (
              <div className="text-xs text-text-main flex justify-between gap-4">
                <span>Object</span>
                <span className="font-mono text-accent">1 Selected</span>
              </div>
            )}
            {totalSelectedVertices > 0 && (
              <div className="text-xs text-text-main flex justify-between gap-4 border-t border-border-dim/50 mt-1 pt-1">
                <span>Vertices</span>
                <span className="font-mono text-accent">{totalSelectedVertices} Selected</span>
              </div>
            )}
            {totalSelectedEdges > 0 && (
              <div className="text-xs text-text-main flex justify-between gap-4 border-t border-border-dim/50 mt-1 pt-1">
                <span>Edges</span>
                <span className="font-mono text-accent">{totalSelectedEdges} Selected</span>
              </div>
            )}
            {totalSelectedFaces > 0 && (
              <div className="text-xs text-text-main flex justify-between gap-4 border-t border-border-dim/50 mt-1 pt-1">
                <span>Faces</span>
                <span className="font-mono text-accent">{totalSelectedFaces} Selected</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selection Box Visual */}
      {isSelecting && selectionBox && (
        <div 
          style={{
            position: 'absolute',
            left: Math.min(selectionBox.start.x, selectionBox.end.x),
            top: Math.min(selectionBox.start.y, selectionBox.end.y),
            width: Math.abs(selectionBox.start.x - selectionBox.end.x),
            height: Math.abs(selectionBox.start.y - selectionBox.end.y),
            border: '1px solid var(--accent)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            pointerEvents: 'none',
            zIndex: 100
          }}
        />
      )}

      {/* Lasso Path Visual */}
      {isSelecting && selectionShape === 'lasso' && lassoPath && (
        <svg 
          className="absolute inset-0 w-full h-full pointer-events-none z-[100]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polyline 
            points={lassoPath.map(p => `${p.x},${p.y}`).join(' ')}
            fill="rgba(59, 130, 246, 0.1)"
            stroke="var(--accent)"
            strokeWidth="1.5"
            strokeDasharray="4 2"
          />
        </svg>
      )}

      <div className="absolute bottom-5 left-5 text-[10px] font-bold text-[#ff4444]">X</div>
      <div className="absolute bottom-10 left-5 text-[10px] font-bold text-[#44ff44]">Y</div>
      <div className="absolute bottom-5 left-10 text-[10px] font-bold text-[#4444ff]">Z</div>
      <div className="absolute top-5 left-5 text-[12px] text-[rgba(255,255,255,0.4)] pointer-events-none">
        Perspective View | {editMode === 'vertex' ? 'Vertex Mode' : editMode === 'edge' ? 'Edge Mode' : editMode === 'face' ? 'Face Mode' : 'Object Mode'}
      </div>
    </div>
  );
}
