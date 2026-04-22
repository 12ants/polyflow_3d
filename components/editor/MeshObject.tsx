/* eslint-disable react-hooks/immutability, react-hooks/refs */
'use client';

import { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import { SceneObject, useEditorStore } from '@/store/useEditorStore';
import * as THREE from 'three';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';
import { createCheckerTexture, createNoiseTexture } from '@/lib/procedural';

export function MeshObject({ object }: { object: SceneObject }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const vertexControlRef = useRef<THREE.Mesh>(null);
  const { camera, gl } = useThree();
  
  const { 
    selectedId, selectObject, transformMode, updateObject, 
    editMode, selectedVertexIndices: allSelectedVertices, selectVertex,
    selectedEdgeIndices: allSelectedEdges, selectEdge,
    selectedFaceIndices: allSelectedFaces, selectFace,
    isSelecting, selectionBox, selectionMode, setSelectionMode,
    lassoPath, selectionShape,
    hoveredVertexIndex, setHoveredVertex,
    hoveredEdgeIndex, setHoveredEdge,
    hoveredFaceIndex, setHoveredFace,
    softSelectionEnabled, softSelectionRadius,
    snappingEnabled, snapIncrement, vertexSnappingEnabled, objects: allObjects
  } = useEditorStore();

  const selectedVertexIndices = useMemo(() => allSelectedVertices[object.id] || [], [allSelectedVertices, object.id]);
  const selectedEdgeIndices = useMemo(() => allSelectedEdges[object.id] || [], [allSelectedEdges, object.id]);
  const selectedFaceIndices = useMemo(() => allSelectedFaces[object.id] || [], [allSelectedFaces, object.id]);

  const isPointInPolygon = (point: { x: number, y: number }, polygon: { x: number, y: number }[]) => {
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) isInside = !isInside;
    }
    return isInside;
  };
  
  const isSelected = selectedId === object.id;
  const wasSelecting = useRef(false);

  const [geom, setGeom] = useState<THREE.BufferGeometry | null>(null);
  const uniqueEdgesRef = useRef<[number, number][]>([]);

  // Update unique edges when geometry changes
  useEffect(() => {
    if (!geom || !geom.attributes || !geom.attributes.position) {
      uniqueEdgesRef.current = [];
      return;
    }
    const edgesGeom = new THREE.EdgesGeometry(geom);
    const pos = edgesGeom.attributes.position;
    const mainPos = geom.attributes.position;
    const edges: [number, number][] = [];
    
    // Build a map of positions to main vertex indices for faster lookup
    const posMap = new Map<string, number>();
    for (let j = 0; j < mainPos.count; j++) {
      const key = `${mainPos.getX(j).toFixed(3)},${mainPos.getY(j).toFixed(3)},${mainPos.getZ(j).toFixed(3)}`;
      if (!posMap.has(key)) posMap.set(key, j);
    }

    for (let i = 0; i < pos.count; i += 2) {
      const key1 = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
      const key2 = `${pos.getX(i+1).toFixed(3)},${pos.getY(i+1).toFixed(3)},${pos.getZ(i+1).toFixed(3)}`;
      
      const mIdx1 = posMap.get(key1);
      const mIdx2 = posMap.get(key2);

      if (mIdx1 !== undefined && mIdx2 !== undefined) {
        edges.push([mIdx1, mIdx2]);
      }
    }
    uniqueEdgesRef.current = edges;
  }, [geom]);

  // Selection/Soft selection weights
  const influenceWeights = useMemo(() => {
    if (!selectedVertexIndices || selectedVertexIndices.length === 0 || !geom || !geom.attributes || !geom.attributes.position) return null;
    
    const weights: Record<number, number> = {};
    const pos = geom.attributes.position;
    const origPos = geom.userData.originalPosition as THREE.BufferAttribute;
    
    // Always include selected vertices with full weight
    selectedVertexIndices.forEach(idx => {
      weights[idx] = 1;
    });

    if (!softSelectionEnabled) return weights;

    const selectedPoints = selectedVertexIndices
      .filter(idx => idx < origPos.count)
      .map(idx => {
        return new THREE.Vector3(origPos.getX(idx), origPos.getY(idx), origPos.getZ(idx));
      });

    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      if (weights[i] !== undefined) continue; // Already handled (selected)

      v.set(origPos.getX(i), origPos.getY(i), origPos.getZ(i));
      
      let minDist = Infinity;
      selectedPoints.forEach(p => {
        const d = p.distanceTo(v);
        if (d < minDist) minDist = d;
      });

      if (minDist < softSelectionRadius) {
        const t = minDist / softSelectionRadius;
        weights[i] = 0.5 * (Math.cos(Math.PI * t) + 1);
      }
    }
    return weights;
  }, [softSelectionEnabled, softSelectionRadius, selectedVertexIndices, geom]);

  useFrame((state) => {
    // Check for isSelecting transition from true to false
    if (wasSelecting.current && !isSelecting && (editMode === 'vertex' || editMode === 'edge' || editMode === 'face') && isSelected && geom && geom.attributes && geom.attributes.position) {
        const canSelect = selectionShape === 'box' ? !!selectionBox : !!lassoPath;
        if (!canSelect) return;


        const pos = geom.attributes.position;
        const newSelectedVertexIndices: number[] = [];
        const canvas = gl.domElement;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const vector = new THREE.Vector3();
        const matrix = new THREE.Matrix4();
        
        if (meshRef.current) {
          meshRef.current.updateMatrixWorld();
          matrix.copy(meshRef.current.matrixWorld);
        }

        const rect = selectionShape === 'box' && selectionBox ? {
            left: Math.min(selectionBox.start.x, selectionBox.end.x),
            top: Math.min(selectionBox.start.y, selectionBox.end.y),
            right: Math.max(selectionBox.start.x, selectionBox.end.x),
            bottom: Math.max(selectionBox.start.y, selectionBox.end.y),
        } : null;

        const checkInside = (index: number) => {
          vector.set(pos.getX(index), pos.getY(index), pos.getZ(index));
          vector.applyMatrix4(matrix);
          vector.project(camera);
          const x = (vector.x * 0.5 + 0.5) * width;
          const y = (-(vector.y * 0.5) + 0.5) * height;
          
          if (selectionShape === 'box' && rect) {
            return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom && vector.z < 1;
          } else if (selectionShape === 'lasso' && lassoPath) {
            return isPointInPolygon({ x, y }, lassoPath) && vector.z < 1;
          }
          return false;
        };

        if (editMode === 'vertex') {
          for (let i = 0; i < pos.count; i++) {
            if (checkInside(i)) {
               newSelectedVertexIndices.push(i);
            }
          }

          if (newSelectedVertexIndices.length > 0) {
             const fullIndices: number[] = [];
             const seenPos = new Set<string>();
             newSelectedVertexIndices.forEach(idx => {
               const px = pos.getX(idx).toFixed(4);
               const py = pos.getY(idx).toFixed(4);
               const pz = pos.getZ(idx).toFixed(4);
               const key = `${px},${py},${pz}`;
               if (!seenPos.has(key)) {
                  seenPos.add(key);
                  for (let j = 0; j < pos.count; j++) {
                     if (pos.getX(j).toFixed(4) === px && pos.getY(j).toFixed(4) === py && pos.getZ(j).toFixed(4) === pz) {
                        fullIndices.push(j);
                     }
                  }
               }
             });
             selectVertex(fullIndices, object.id);
          }
        } else if (editMode === 'edge') {
          const newSelectedEdges: [number, number][] = [];
          uniqueEdgesRef.current.forEach(edge => {
            if (checkInside(edge[0]) && checkInside(edge[1])) {
              newSelectedEdges.push(edge);
            }
          });
          
          if (newSelectedEdges.length > 0) {
            selectEdge(newSelectedEdges, object.id);
          }
        } else if (editMode === 'face') {
          const newSelectedFaces: number[] = [];
          const count = geom.index ? geom.index.count / 3 : pos.count / 3;
          for (let i = 0; i < count; i++) {
            // Check if any vertex of the face is inside
            const idx1 = geom.index ? geom.index.getX(i * 3) : i * 3;
            const idx2 = geom.index ? geom.index.getX(i * 3 + 1) : i * 3 + 1;
            const idx3 = geom.index ? geom.index.getX(i * 3 + 2) : i * 3 + 2;

            if (checkInside(idx1) || checkInside(idx2) || checkInside(idx3)) {
              newSelectedFaces.push(i);
            }
          }
          if (newSelectedFaces.length > 0) {
            selectFace(newSelectedFaces, object.id);
          }
        }
    }
    wasSelecting.current = isSelecting;

    if (meshRef.current?.geometry && meshRef.current.geometry !== geom) {
      const g = meshRef.current.geometry;
      if (!g.userData.originalPosition && g.attributes && g.attributes.position) {
        g.userData.originalPosition = g.attributes.position.clone();
      }
      setGeom(g);
    }
  });

  // Apply geometry offsets
  useEffect(() => {
    if (!geom || !geom.attributes || !geom.attributes.position || !geom.userData.originalPosition) return;
    const pos = geom.attributes.position;
    const orig = geom.userData.originalPosition;

    if (pos.array.length === (orig as THREE.BufferAttribute).array.length) {
      pos.array.set((orig as THREE.BufferAttribute).array as any);
    }

    if (object.vertexOffsets) {
      Object.entries(object.vertexOffsets).forEach(([idxStr, offset]) => {
        const i = parseInt(idxStr, 10);
        if (i < pos.count && i * 3 + 2 < pos.array.length) {
          pos.array[i * 3] += offset[0];
          pos.array[i * 3 + 1] += offset[1];
          pos.array[i * 3 + 2] += offset[2];
        }
      });
    }
    
    pos.needsUpdate = true;
    geom.computeVertexNormals();
  }, [geom, object.vertexOffsets, object.params]);

  useEffect(() => {
    if ((editMode === 'vertex' || editMode === 'edge' || editMode === 'face') && isSelected && selectedVertexIndices && selectedVertexIndices.length > 0 && vertexControlRef.current && geom?.attributes?.position && geom?.userData.originalPosition) {
       const pos = geom.attributes.position;
       const orig = geom.userData.originalPosition;
       
        // Calculate median position including existing project offsets
        let count = 0;
        const avgPos = new THREE.Vector3(0, 0, 0);
        selectedVertexIndices.forEach(idx => {
          if (idx < (orig as THREE.BufferAttribute).count) {
            const off = (object.vertexOffsets && object.vertexOffsets[idx]) ? object.vertexOffsets[idx] : [0,0,0];
            avgPos.x += (orig as THREE.BufferAttribute).getX(idx) + off[0];
            avgPos.y += (orig as THREE.BufferAttribute).getY(idx) + off[1];
            avgPos.z += (orig as THREE.BufferAttribute).getZ(idx) + off[2];
            count++;
          }
        });
        if (count > 0) avgPos.divideScalar(count);
       
       vertexControlRef.current.position.copy(avgPos);
    }
  }, [selectedVertexIndices, editMode, isSelected, geom, object.vertexOffsets]);

  const handleTransformChange = () => {
    if (!geom || !geom.attributes || !geom.attributes.position || !geom.userData.originalPosition || !selectedVertexIndices || !vertexControlRef.current) return;
    const tempPos = vertexControlRef.current.position;
    const pos = geom.attributes.position;
    const orig = geom.userData.originalPosition;
    
    // In vertex/edge mode, we move vertices. 
    // If editMode is face, moving the gizmo affects vertices belonging to those faces.
    // However, our existing indices-based system already populates selectedVertexIndices when selecting edges.
    // If face selection is implemented, it should also populate selectedVertexIndices for transformation ease.
    
    // Calculate delta from current gizmo position vs starting median position
    // Since we re-sync on every state update, the gizmo position effectively tracks displacement.
    // For simplicity during live drag, we calculate displacement from the median of original positions.
    let count = 0;
    const avgOrigPos = new THREE.Vector3(0, 0, 0);
    selectedVertexIndices.forEach(idx => {
      if (idx < (orig as THREE.BufferAttribute).count) {
        avgOrigPos.x += (orig as THREE.BufferAttribute).getX(idx);
        avgOrigPos.y += (orig as THREE.BufferAttribute).getY(idx);
        avgOrigPos.z += (orig as THREE.BufferAttribute).getZ(idx);
        count++;
      }
    });
    if (count > 0) avgOrigPos.divideScalar(count);

    const offsetX = tempPos.x - avgOrigPos.x;
    const offsetY = tempPos.y - avgOrigPos.y;
    const offsetZ = tempPos.z - avgOrigPos.z;

    // Snapping Logic
    let finalOffsetX = offsetX;
    let finalOffsetY = offsetY;
    let finalOffsetZ = offsetZ;

    if (snappingEnabled) {
      if (vertexSnappingEnabled) {
        // Collect candidate vertices for snapping in local space
        const worldToLocal = new THREE.Matrix4();
        if (meshRef.current) {
          worldToLocal.copy(meshRef.current.matrixWorld).invert();
        }

        let bestSnapPos: THREE.Vector3 | null = null;
        let minDistanceSq = 0.04; // 0.2 units threshold squared

        // Global vertex snapping search
        allObjects.forEach(otherObj => {
          // Find the mesh for this object in the THREE.js scene if it exists
          // For now, we can iterate over the scene if we expose it, or just use the store positions
          // As a robust alternative, we can snap to other object origins or their basic vertices
        });

        // Search within current object's other vertices (not selected)
        if (geom && geom.userData.originalPosition) {
          const mainPos = geom.attributes.position;
          const v = new THREE.Vector3();
          const targetLocal = new THREE.Vector3(avgOrigPos.x + offsetX, avgOrigPos.y + offsetY, avgOrigPos.z + offsetZ);
          
          for (let i = 0; i < mainPos.count; i++) {
            if (selectedVertexIndices.includes(i)) continue;
            v.set(mainPos.getX(i), mainPos.getY(i), mainPos.getZ(i));
            
            // Add offsets if they exist for this non-selected vertex
            if (object.vertexOffsets && object.vertexOffsets[i]) {
                v.x += object.vertexOffsets[i][0];
                v.y += object.vertexOffsets[i][1];
                v.z += object.vertexOffsets[i][2];
            }

            const dSq = v.distanceToSquared(targetLocal);
            if (dSq < minDistanceSq) {
              minDistanceSq = dSq;
              bestSnapPos = v.clone();
            }
          }
        }

        if (bestSnapPos) {
          finalOffsetX = bestSnapPos.x - avgOrigPos.x;
          finalOffsetY = bestSnapPos.y - avgOrigPos.y;
          finalOffsetZ = bestSnapPos.z - avgOrigPos.z;
        } else {
          // Fallback to grid snapping if no vertex found
          finalOffsetX = Math.round(offsetX / snapIncrement) * snapIncrement;
          finalOffsetY = Math.round(offsetY / snapIncrement) * snapIncrement;
          finalOffsetZ = Math.round(offsetZ / snapIncrement) * snapIncrement;
        }
        
        // Update tempPos for visual feedback of snapping
        tempPos.x = avgOrigPos.x + finalOffsetX;
        tempPos.y = avgOrigPos.y + finalOffsetY;
        tempPos.z = avgOrigPos.z + finalOffsetZ;
      } else {
        finalOffsetX = Math.round(offsetX / snapIncrement) * snapIncrement;
        finalOffsetY = Math.round(offsetY / snapIncrement) * snapIncrement;
        finalOffsetZ = Math.round(offsetZ / snapIncrement) * snapIncrement;
        
        tempPos.x = avgOrigPos.x + finalOffsetX;
        tempPos.y = avgOrigPos.y + finalOffsetY;
        tempPos.z = avgOrigPos.z + finalOffsetZ;
      }
    }

    // Layer base + other offsets without writing to Zustand immediately
    if (pos.array.length === (orig as THREE.BufferAttribute).array.length) {
      pos.array.set((orig as THREE.BufferAttribute).array as any);
    }

    if (object.vertexOffsets) {
      Object.entries(object.vertexOffsets).forEach(([idxStr, off]) => {
        const i = parseInt(idxStr, 10);
        if (i >= pos.count) return;
        
        // If soft selection is enabled, we'll re-apply all offsets but scaled if needed.
        // Actually, for real-time dragging, we just want to know how the CURRENT transformation affects everything.
        const isCurrentlyAffected = softSelectionEnabled ? (influenceWeights && (influenceWeights[i] !== undefined)) : selectedVertexIndices.includes(i);
        
        if (!isCurrentlyAffected) {
          pos.array[i * 3] += off[0];
          pos.array[i * 3 + 1] += off[1];
          pos.array[i * 3 + 2] += off[2];
        }
      });
    }

    // Apply strict offset to selected grouping or weighted offset to influence group
    if (softSelectionEnabled && influenceWeights) {
      Object.entries(influenceWeights).forEach(([idxStr, weight]) => {
        const i = parseInt(idxStr, 10);
        if (i < pos.count) {
          pos.array[i * 3] += finalOffsetX * weight;
          pos.array[i * 3 + 1] += finalOffsetY * weight;
          pos.array[i * 3 + 2] += finalOffsetZ * weight;
        }
      });
    } else {
      selectedVertexIndices.forEach((i) => {
        if (i < pos.count) {
          pos.array[i * 3] += finalOffsetX;
          pos.array[i * 3 + 1] += finalOffsetY;
          pos.array[i * 3 + 2] += finalOffsetZ;
        }
      });
    }

    pos.needsUpdate = true;
  };

  const handleTransformMouseUp = () => {
    if (!selectedVertexIndices || !vertexControlRef.current || !geom || !geom.attributes || !geom.attributes.position) return;
    const tempPos = vertexControlRef.current.position;
    const pos = geom.attributes.position;
    const orig = geom.userData.originalPosition;
    
    let count = 0;
    const avgOrigPos = new THREE.Vector3(0, 0, 0);
    selectedVertexIndices.forEach(idx => {
      if (idx < (orig as THREE.BufferAttribute).count) {
        avgOrigPos.x += (orig as THREE.BufferAttribute).getX(idx);
        avgOrigPos.y += (orig as THREE.BufferAttribute).getY(idx);
        avgOrigPos.z += (orig as THREE.BufferAttribute).getZ(idx);
        count++;
      }
    });
    if (count > 0) avgOrigPos.divideScalar(count);

    let offsetX = tempPos.x - avgOrigPos.x;
    let offsetY = tempPos.y - avgOrigPos.y;
    let offsetZ = tempPos.z - avgOrigPos.z;

    if (snappingEnabled) {
      offsetX = Math.round(offsetX / snapIncrement) * snapIncrement;
      offsetY = Math.round(offsetY / snapIncrement) * snapIncrement;
      offsetZ = Math.round(offsetZ / snapIncrement) * snapIncrement;
    }

    const newOffsets = { ...(object.vertexOffsets || {}) };
    
    if (softSelectionEnabled && influenceWeights) {
      Object.entries(influenceWeights).forEach(([idxStr, weight]) => {
        const i = parseInt(idxStr, 10);
        newOffsets[i] = [offsetX * weight, offsetY * weight, offsetZ * weight];
      });
    } else {
      selectedVertexIndices.forEach(i => {
        if (i < pos.count) {
          newOffsets[i] = [offsetX, offsetY, offsetZ];
        }
      });
    }
    
    updateObject(object.id, { vertexOffsets: newOffsets });
    geom.computeVertexNormals();
  };

  return (
    <>
      {isSelected && editMode === 'object' && meshRef.current ? (
        <TransformControls
          object={meshRef.current as any}
          mode={transformMode}
          onMouseDown={() => useEditorStore.getState().pushHistory()}
          onMouseUp={(e) => {
            if (meshRef.current) {
              updateObject(object.id, {
                position: meshRef.current.position.toArray(),
                rotation: [
                  meshRef.current.rotation.x,
                  meshRef.current.rotation.y,
                  meshRef.current.rotation.z
                ],
                scale: meshRef.current.scale.toArray(),
              });
            }
          }}
        />
      ) : null}

      {isSelected && (editMode === 'vertex' || editMode === 'edge' || editMode === 'face') && selectedVertexIndices && selectedVertexIndices.length > 0 && vertexControlRef.current ? (
        <TransformControls
          object={vertexControlRef.current as any}
          mode={transformMode}
          onMouseDown={() => useEditorStore.getState().pushHistory()}
          onChange={handleTransformChange}
          onMouseUp={handleTransformMouseUp}
        />
      ) : null}

      <mesh
        ref={meshRef}
        position={object.position}
        rotation={object.rotation}
        scale={object.scale}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          
          // If a box selection was just active (dragging), ignore this click
          if (selectionBox && Math.abs(selectionBox.start.x - selectionBox.end.x) > 5) {
             return;
          }

          if (!isSelected) {
            selectObject(object.id);
            return;
          }
           if (editMode === 'vertex') {
            const pointsHit = e.intersections.find((i: any) => i.object.isPoints);
            if (pointsHit && pointsHit.index !== undefined) {
               const idx = pointsHit.index;
               if (!geom || !geom.userData.originalPosition) return;
               const orig = geom.userData.originalPosition;
               const x = orig.getX(idx);
               const y = orig.getY(idx);
               const z = orig.getZ(idx);
               const indices: number[] = [];
               for (let i = 0; i < orig.count; i++) {
                 const dx = Math.abs(orig.getX(i) - x);
                 const dy = Math.abs(orig.getY(i) - y);
                 const dz = Math.abs(orig.getZ(i) - z);
                 if (dx < 0.0001 && dy < 0.0001 && dz < 0.0001) indices.push(i);
               }
                setSelectionMode(e.shiftKey ? 'toggle' : 'replace');
               selectVertex(indices, object.id);
               return;
            }
            if (!e.shiftKey) {
               setSelectionMode('replace');
               selectVertex(null, object.id);
            }
          } else if (editMode === 'edge') {
            const lineHit = e.intersections.find((i: any) => i.object.isLineSegments);
            if (lineHit && lineHit.index !== undefined) {
               const lineSegments = lineHit.object as THREE.LineSegments;
               const lineGeom = lineSegments.geometry;
               const pos = lineGeom.attributes.position;
               
               // For LineSegments (non-indexed), an edge segment is (i, i+1)
               // e.index in raycast usually points to the start of the segment
               const idx1 = lineHit.index;
               const idx2 = lineHit.index + 1;
               
               if (idx1 < pos.count && idx2 < pos.count) {
                 const v1 = new THREE.Vector3(pos.getX(idx1), pos.getY(idx1), pos.getZ(idx1));
                 const v2 = new THREE.Vector3(pos.getX(idx2), pos.getY(idx2), pos.getZ(idx2));
                 
                 if (geom) {
                   const mainPos = geom.attributes.position;
                   let mIdx1 = -1;
                   let mIdx2 = -1;
                   
                   for (let i = 0; i < mainPos.count; i++) {
                     const mv = new THREE.Vector3(mainPos.getX(i), mainPos.getY(i), mainPos.getZ(i));
                     if (mIdx1 === -1 && mv.distanceTo(v1) < 0.001) mIdx1 = i;
                     if (mIdx2 === -1 && mv.distanceTo(v2) < 0.001) mIdx2 = i;
                     if (mIdx1 !== -1 && mIdx2 !== -1) break;
                   }
                   
                   if (mIdx1 !== -1 && mIdx2 !== -1) {
                     setSelectionMode(e.shiftKey ? 'toggle' : 'replace');
                     selectEdge([[mIdx1, mIdx2]], object.id);
                     return;
                   }
                 }
               }
            }
            if (!e.shiftKey) {
               setSelectionMode('replace');
               selectEdge(null, object.id);
            }
          } else if (editMode === 'face') {
             const faceHit = e.intersections.find((i: any) => i.object === meshRef.current && i.faceIndex !== undefined);
             if (faceHit && typeof faceHit.faceIndex === 'number') {
                setSelectionMode(e.shiftKey ? 'toggle' : 'replace');
                
                // Get vertices of this face to add to selectedVertexIndices
                const faceIdx = faceHit.faceIndex;
                const indices: number[] = [];
                if (geom) {
                   const idx1 = geom.index ? geom.index.getX(faceIdx * 3) : faceIdx * 3;
                   const idx2 = geom.index ? geom.index.getX(faceIdx * 3 + 1) : faceIdx * 3 + 1;
                   const idx3 = geom.index ? geom.index.getX(faceIdx * 3 + 2) : faceIdx * 3 + 2;
                   indices.push(idx1, idx2, idx3);
                   
                   // Find co-located vertices as well (common positions)
                   const mainPos = geom.attributes.position;
                   const targetIndices: number[] = [];
                   const positions = [
                     new THREE.Vector3(mainPos.getX(idx1), mainPos.getY(idx1), mainPos.getZ(idx1)),
                     new THREE.Vector3(mainPos.getX(idx2), mainPos.getY(idx2), mainPos.getZ(idx2)),
                     new THREE.Vector3(mainPos.getX(idx3), mainPos.getY(idx3), mainPos.getZ(idx3)),
                   ];

                   for (let i = 0; i < mainPos.count; i++) {
                     const v = new THREE.Vector3(mainPos.getX(i), mainPos.getY(i), mainPos.getZ(i));
                     if (positions.some(p => p.distanceTo(v) < 0.0001)) {
                       targetIndices.push(i);
                     }
                   }

                   selectFace([faceIdx], object.id);
                   // Also select vertices for transformation
                   selectVertex(targetIndices, object.id);
                }
                return;
             }
             if (!e.shiftKey) {
                setSelectionMode('replace');
                selectFace(null, object.id);
             }
          }
        }}
        onPointerMove={(e) => {
          if (editMode === 'face' && typeof e.faceIndex === 'number') {
             setHoveredFace({ objectId: object.id, index: e.faceIndex });
          }
        }}
        onPointerOut={() => {
           if (editMode === 'face') setHoveredFace(null);
        }}
      >
        <Geometry key={JSON.stringify(object.params || {})} type={object.type} params={object.params} customModel={object.customModel} />
        {object.type !== 'imported' && (
          <ProceduralMaterial object={object} />
        )}

        {(editMode === 'edge' || editMode === 'vertex') && geom && (
          <Edges 
            objectId={object.id}
            geometry={geom} 
            selectedEdges={selectedEdgeIndices}
            weights={isSelected ? influenceWeights : null}
            hoveredEdge={hoveredEdgeIndex && hoveredEdgeIndex.objectId === object.id ? hoveredEdgeIndex.edge : null}
            onHover={(edge) => setHoveredEdge(edge ? { objectId: object.id, edge } : null)}
            vertexOffsets={object.vertexOffsets}
          />
        )}

        {editMode === 'vertex' && geom && (
          <Points 
             geometry={geom}
             weights={isSelected ? influenceWeights : null}
             hoveredIndex={hoveredVertexIndex && hoveredVertexIndex.objectId === object.id ? hoveredVertexIndex.index : null}
             onHover={(idx) => setHoveredVertex(idx !== null ? { objectId: object.id, index: idx } : null)}
          />
        )}

        {(editMode === 'face') && geom && (
          <Faces 
            geometry={geom}
            selectedFaces={selectedFaceIndices}
            hoveredFace={hoveredFaceIndex && hoveredFaceIndex.objectId === object.id ? hoveredFaceIndex.index : null}
          />
        )}

        {isSelected && (editMode === 'vertex' || editMode === 'edge' || editMode === 'face') && (
          <mesh ref={vertexControlRef} visible={false}>
            <boxGeometry args={[0.01, 0.01, 0.01]} />
          </mesh>
        )}
      </mesh>
    </>
  );
}

function Faces({ 
  geometry, 
  selectedFaces, 
  hoveredFace 
}: { 
  geometry: THREE.BufferGeometry, 
  selectedFaces: number[] | null,
  hoveredFace: number | null
}) {
  const selectedKeys = useMemo(() => new Set(selectedFaces || []), [selectedFaces]);

  const highlightGeom = useMemo(() => {
    // Create a geometry for selected/hovered faces
    const pos = geometry.attributes.position;
    const index = geometry.index;
    
    // We only create vertices for the highlighted faces
    const highlightIndices: number[] = [];
    selectedKeys.forEach(fIdx => {
      highlightIndices.push(fIdx * 3, fIdx * 3 + 1, fIdx * 3 + 2);
    });
    
    if (hoveredFace !== null && !selectedKeys.has(hoveredFace)) {
      highlightIndices.push(hoveredFace * 3, hoveredFace * 3 + 1, hoveredFace * 3 + 2);
    }

    if (highlightIndices.length === 0 || !geometry.attributes || !geometry.attributes.position) return null;

    const g = new THREE.BufferGeometry();
    const vertices = new Float32Array(highlightIndices.length * 3);
    const colors = new Float32Array(highlightIndices.length * 3);
    
    const highlightColor = new THREE.Color('#3b82f6'); // Blue for selected
    const hoverColor = new THREE.Color('#ffffff'); // White for hovered
    
    highlightIndices.forEach((hIdx, i) => {
      const vIdx = index ? index.getX(hIdx) : hIdx;
      vertices[i * 3] = pos.getX(vIdx);
      vertices[i * 3 + 1] = pos.getY(vIdx);
      vertices[i * 3 + 2] = pos.getZ(vIdx);
      
      const faceIdx = Math.floor(hIdx / 3);
      const isHovered = faceIdx === hoveredFace;
      const c = isHovered ? hoverColor : highlightColor;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    });

    g.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [geometry, selectedKeys, hoveredFace]);

  if (!highlightGeom) return null;

  return (
    <mesh geometry={highlightGeom} raycast={() => null}>
      <meshBasicMaterial 
        vertexColors 
        transparent 
        opacity={0.4} 
        side={THREE.DoubleSide} 
        depthTest={false}
      />
    </mesh>
  );
}

function Edges({ 
  objectId,
  geometry, 
  selectedEdges, 
  weights,
  hoveredEdge, 
  onHover,
  vertexOffsets // Adding this to track movement
}: { 
  objectId: string,
  geometry: THREE.BufferGeometry, 
  selectedEdges: [number, number][] | null,
  weights: Record<number, number> | null,
  hoveredEdge: [number, number] | null,
  onHover: (edge: [number, number] | null) => void,
  vertexOffsets?: Record<number, [number, number, number]>
}) {
  // Re-create the wireframe geometry when vertices take new positions
  const edgesGeom = useMemo(() => {
    // We use vertexOffsets as a dependency to force re-calculation when vertices move
    // but the geometry reference stays the same.
    const _ = vertexOffsets; 
    return new THREE.EdgesGeometry(geometry);
  }, [geometry, vertexOffsets]);
  
  const edgeKey = (e: [number, number]) => Math.min(e[0], e[1]) + "-" + Math.max(e[0], e[1]);
  const selectedKeys = useMemo(() => new Set(selectedEdges?.map(edgeKey) || []), [selectedEdges]);
  const hoveredKey = hoveredEdge ? edgeKey(hoveredEdge) : null;

  const posMap = useMemo(() => {
    const mainPos = geometry.attributes.position;
    const map = new Map<string, number>();
    for (let j = 0; j < mainPos.count; j++) {
      const key = `${mainPos.getX(j).toFixed(3)},${mainPos.getY(j).toFixed(3)},${mainPos.getZ(j).toFixed(3)}`;
      if (!map.has(key)) map.set(key, j);
    }
    return map;
  }, [geometry]);

  useEffect(() => {
    const count = edgesGeom.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();
    const pos = edgesGeom.attributes.position;

    const getColorForVertex = (mIdx: number | undefined, isHovered: boolean, isSelected: boolean) => {
      const weight = (mIdx !== undefined && weights && weights[mIdx] !== undefined) ? weights[mIdx] : 0;
      
      if (isHovered) return color.set('#ffffff');
      if (isSelected) return color.set('#ffcc00'); 
      
      if (weight > 0) {
        return color.setHSL(0.1 + 0.1 * weight, 1, 0.5);
      }
      return color.set('#444444');
    };

    for (let i = 0; i < count; i += 2) {
      const key1 = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
      const key2 = `${pos.getX(i+1).toFixed(3)},${pos.getY(i+1).toFixed(3)},${pos.getZ(i+1).toFixed(3)}`;
      
      const mIdx1 = posMap.get(key1);
      const mIdx2 = posMap.get(key2);

      const isEdgeSelected = (mIdx1 !== undefined && mIdx2 !== undefined) && selectedKeys.has(edgeKey([mIdx1, mIdx2]));
      const isEdgeHovered = (mIdx1 !== undefined && mIdx2 !== undefined) && edgeKey([mIdx1, mIdx2]) === hoveredKey;

      getColorForVertex(mIdx1, isEdgeHovered, isEdgeSelected);
      colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;

      getColorForVertex(mIdx2, isEdgeHovered, isEdgeSelected);
      colors[(i + 1) * 3] = color.r; colors[(i + 1) * 3 + 1] = color.g; colors[(i + 1) * 3 + 2] = color.b;
    }
    
    edgesGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    edgesGeom.attributes.color.needsUpdate = true;
  }, [edgesGeom, selectedKeys, hoveredKey, posMap, weights]);

  return (
    <lineSegments 
      geometry={edgesGeom}
      onPointerMove={(e) => {
        e.stopPropagation();
        if (e.index !== undefined) {
           const pos = edgesGeom.attributes.position;
           const key1 = `${pos.getX(e.index).toFixed(3)},${pos.getY(e.index).toFixed(3)},${pos.getZ(e.index).toFixed(3)}`;
           const key2 = `${pos.getX(e.index+1).toFixed(3)},${pos.getY(e.index+1).toFixed(3)},${pos.getZ(e.index+1).toFixed(3)}`;
           
           const mIdx1 = posMap.get(key1);
           const mIdx2 = posMap.get(key2);
           if (mIdx1 !== undefined && mIdx2 !== undefined) onHover([mIdx1, mIdx2]);
        }
      }}
      onPointerOut={() => onHover(null)}
    >
      <lineBasicMaterial vertexColors linewidth={2} depthTest={false} transparent opacity={1} />
    </lineSegments>
  );
}

function Points({   geometry, 
  weights, 
  hoveredIndex, 
  onHover 
}: { 
  geometry: THREE.BufferGeometry, 
  weights: Record<number, number> | null,
  hoveredIndex: number | null,
  onHover: (idx: number | null) => void
}) {
  const { raycaster } = useThree();

  useEffect(() => {
    const count = geometry.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();
    
    for (let i = 0; i < count; i++) {
      const weight = weights && weights[i] !== undefined ? weights[i] : 0;
      
      if (i === hoveredIndex) {
        color.set('#ffffff'); // Hovered
      } else if (weight === 1) {
        color.set('#00ff88'); // Selected
      } else if (weight > 0) {
        color.setHSL(0.1 + 0.1 * weight, 1, 0.5); 
      } else {
        color.set('#444444'); // Unaffected
      }
      
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.attributes.color.needsUpdate = true;
  }, [geometry, weights, hoveredIndex]);

  return (
    <points 
      geometry={geometry}
      onPointerMove={(e) => {
        // e.index gives the vertex index for points objects
        if (e.index !== undefined) {
           onHover(e.index);
        }
      }}
      onPointerOut={() => onHover(null)}
    >
      <pointsMaterial 
        size={10} 
        vertexColors 
        sizeAttenuation={false} 
        depthTest={false} 
        transparent 
        opacity={1} 
      />
    </points>
  );
}

function ProceduralMaterial({ object }: { object: SceneObject }) {
  const texture = useMemo(() => {
    if (object.materialType === 'checker') {
      return createCheckerTexture(object.materialParams?.scale || 8);
    }
    if (object.materialType === 'noise') {
      return createNoiseTexture(object.materialParams?.scale || 10, object.id.length);
    }
    return null;
  }, [object.materialType, object.materialParams?.scale, object.id]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uWindIntensity: { value: object.type === 'tree' && object.params?.foliageAnimate ? (object.params?.windSpeed || 1.0) : 0.0 }
  }), [object.type, object.params?.foliageAnimate, object.params?.windSpeed]);

  useFrame((state) => {
    if (uniforms.uWindIntensity.value > 0) {
       uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  const onBeforeCompile = useMemo(() => (shader: any) => {
    if (object.type !== 'tree' || !object.params?.foliageAnimate) return;
    
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWindIntensity = uniforms.uWindIntensity;
    
    shader.vertexShader = `
      uniform float uTime;
      uniform float uWindIntensity;
      ${shader.vertexShader}
    `;
    
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      
      if (uWindIntensity > 0.0) {
        // Evaluate tree vertex height (starts around 0)
        float h = max(0.0, transformed.y);
        
        // Sway parameters. We use the instance/model matrix to give each tree a slightly different wind phase
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        float localPhaseOffset = worldPosition.x * 0.1 + worldPosition.z * 0.1;
        
        float speed = uTime * 1.5 + localPhaseOffset;
        
        // Primary bend (affects trunk more linearly)
        // We use pow(h, 1.5) so the bend curve is gentle at base and pronounced at top
        float bendCurve = pow(h, 1.2) * 0.03;
        float swayX = sin(speed) * bendCurve * uWindIntensity;
        float swayZ = cos(speed * 0.8) * bendCurve * uWindIntensity;
        
        // Secondary flutter (branch & foliage ripple)
        // Offset phase based on spatial position to make branches sway independently
        float flutterX = sin(speed * 2.5 + transformed.x * 3.0 + transformed.y * 2.0) * 0.02 * h * uWindIntensity;
        float flutterZ = cos(speed * 3.0 + transformed.z * 3.0 + transformed.y * 2.0) * 0.02 * h * uWindIntensity;
        
        transformed.x += swayX + flutterX;
        transformed.z += swayZ + flutterZ;
        
        // Slight vertical dipping to offset horizontal stretch
        transformed.y -= (abs(swayX) + abs(swayZ)) * 0.2;
      }
      `
    );
  }, [uniforms, object.type, object.params?.foliageAnimate]);

  return (
    <meshPhysicalMaterial 
      color={object.type === 'tree' ? '#ffffff' : object.color} 
      map={texture} 
      roughness={object.roughness}
      metalness={object.metalness}
      reflectivity={object.reflectivity}
      envMapIntensity={1}
      vertexColors={object.type === 'tree'}
      onBeforeCompile={onBeforeCompile}
      customProgramCacheKey={() => object.type + '_' + (object.params?.foliageAnimate ? 'animate' : 'static')}
    />
  );
}

function Geometry({ type, params, customModel }: { type: SceneObject['type'], params?: any, customModel?: any }) {
  if (type === 'imported' && customModel) {
    return <primitive object={customModel} />;
  }
  
  if (type === 'terrain') {
    return <TerrainGeometry params={params} />;
  }

  switch (type) {
    case 'box':
      return <boxGeometry args={[1, 1, 1]} />;
    case 'sphere':
      return <sphereGeometry args={[0.5, 32, 16]} />;
    case 'cylinder':
      return <cylinderGeometry args={[0.5, 0.5, 1, 32]} />;
    case 'cone':
      return <coneGeometry args={[0.5, 1, 32]} />;
    case 'torus':
      return <torusGeometry args={[0.4, 0.15, 16, 50]} />;
    case 'torusKnot':
      return (
        <torusKnotGeometry 
          args={[
            params?.radius || 0.5, 
            params?.tube || 0.15, 
            64, 
            16, 
            params?.p || 2, 
            params?.q || 3
          ]} 
        />
      );
    case 'tree':
      return <TreeGeometry params={params} />;
    default:
      return <boxGeometry args={[1, 1, 1]} />;
  }
}

function TerrainGeometry({ params }: { params: any }) {
  const geomRef = useRef<THREE.PlaneGeometry>(null);
  
  useEffect(() => {
    if (geomRef.current && params) {
      const { scale = 2, amplitude = 1 } = params;
      const pos = geomRef.current.attributes.position;
      const perlin = new ImprovedNoise();
      
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = perlin.noise(x * scale, y * scale, 0) * amplitude;
        pos.setZ(i, z);
      }
      
      geomRef.current.computeVertexNormals();
      pos.needsUpdate = true;
    }
  }, [params]);

  return (
    <planeGeometry 
      ref={geomRef} 
      args={[
        params?.width || 5, 
        params?.height || 5, 
        params?.segments || 32, 
        params?.segments || 32
      ]} 
    />
  );
}

function TreeGeometry({ params }: { params: any }) {
  const { 
    levels = 3, 
    height = 2, 
    branchFactor = 2, 
    angle = 0.5, 
    seed = 123, 
    foliage = true, 
    foliageSize = 0.5,
    foliageDensity = 1.0,
    foliageOffset = 0.0,
    foliageCross = false,
    foliageJitter = 0.2,
    foliageType = 'quad',
    foliageFruit = false,
    foliageSnow = false,
    foliageAnimate = false,
    gnarl = 0.2,
    distribution = 'random',
    count = 1,
    spread = 2.0,
    branchColor = '#4d2d11',
    foliageColor = '#2d5a27',
    trunkThickness = 0.05,
    taper = 0.7,
    randomness = 0.2
  } = params || {};

  const bCol = useMemo(() => new THREE.Color(branchColor), [branchColor]);
  const fCol = useMemo(() => new THREE.Color(foliageColor), [foliageColor]);

  const geometryData = useMemo(() => {
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];

    // Simple deterministic random generator
    let currentSeed = seed;
    const rand = () => {
      currentSeed = (currentSeed * 16807) % 2147483647;
      return (currentSeed - 1) / 2147483646;
    };

    const addBranch = (
      start: THREE.Vector3,
      direction: THREE.Vector3,
      length: number,
      thickness: number,
      currentLevel: number
    ) => {
      // Add Gnarl (jitter the direction slightly)
      const gnarledDir = direction.clone();
      if (gnarl > 0) {
        gnarledDir.add(new THREE.Vector3(
          (rand() - 0.5) * gnarl * 2,
          (rand() - 0.5) * gnarl,
          (rand() - 0.5) * gnarl * 2
        )).normalize();
      }

      const segments = Math.max(3, Math.floor(8 / (levels - currentLevel + 1))); 
      const startIdx = vertices.length / 3;
      const end = start.clone().add(gnarledDir.clone().multiplyScalar(length));

      // Ambient Occlusion Factor (darken near base/inside)
      const aoFactor = currentLevel / (levels + 1);
      const levelCol = bCol.clone().multiplyScalar(0.4 + aoFactor * 0.6);

      const axis = gnarledDir.clone().normalize();
      const perp1 = new THREE.Vector3(1, 0, 0);
      if (Math.abs(axis.dot(perp1)) > 0.9) perp1.set(0, 1, 0);
      const perp2 = new THREE.Vector3().crossVectors(axis, perp1).normalize();
      perp1.crossVectors(perp2, axis).normalize();

      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);

        const v1 = start.clone().add(perp1.clone().multiplyScalar(cos * thickness)).add(perp2.clone().multiplyScalar(sin * thickness));
        vertices.push(v1.x, v1.y, v1.z);
        const n1 = v1.clone().sub(start).normalize();
        normals.push(n1.x, n1.y, n1.z);
        colors.push(levelCol.r, levelCol.g, levelCol.b);

        const v2 = end.clone().add(perp1.clone().multiplyScalar(cos * thickness * taper)).add(perp2.clone().multiplyScalar(sin * thickness * taper));
        vertices.push(v2.x, v2.y, v2.z);
        const n2 = v2.clone().sub(end).normalize();
        normals.push(n2.x, n2.y, n2.z);
        colors.push(levelCol.r, levelCol.g, levelCol.b);

        if (i < segments) {
          const base = startIdx + i * 2;
          indices.push(base, base + 1, base + 2);
          indices.push(base + 1, base + 3, base + 2);
        }
      }

      // Add roots at base
      if (currentLevel === levels && thickness > 0.1) {
        for (let r = 0; r < 4; r++) {
          const rootAngle = (r / 4) * Math.PI * 2 + rand() * 0.5;
          const rootDir = new THREE.Vector3(Math.cos(rootAngle), -0.2, Math.sin(rootAngle)).normalize();
          addBranch(start, rootDir, length * 0.4, thickness * 0.7, 1); // Small single level roots
        }
      }

      if (currentLevel <= 1) {
        if (foliage) {
          const baseLeafCount = 4;
          const leafCount = Math.floor(baseLeafCount * foliageDensity);
          
          for (let l = 0; l < leafCount; l++) {
            const leafIdx = vertices.length / 3;
            const size = foliageSize * (0.8 + rand() * 0.4);
            
            const lDir = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
            const lPerp = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).cross(lDir).normalize();
            const lSide = new THREE.Vector3().crossVectors(lDir, lPerp).normalize();
            
            // Apply foliage offset (shifting leaves along the branch direction or randomly)
            const leafPos = end.clone().add(gnarledDir.clone().multiplyScalar((rand() - 0.5) * foliageOffset));
            
            // Foliage AO: darker inside
            const distFromTop = 1.0 - (currentLevel / levels);
            const lColAO = fCol.clone().multiplyScalar(0.7 + distFromTop * 0.3);
            const jitterCol = lColAO.clone().multiplyScalar(1.0 - foliageJitter + rand() * (foliageJitter * 2));
            
            if (foliageType === 'cloud') {
              // Generate a more detailed cloud shape using multiple smaller puffs
              const subPuffCount = 3 + Math.floor(rand() * 3); // 3 to 5 sub-puffs per cluster
              const clusterBound = size * 1.2;
              
              for (let p = 0; p < subPuffCount; p++) {
                const puffIdx = vertices.length / 3;
                
                // Offset each sub-puff randomly within a small bounds
                const pOffset = new THREE.Vector3(
                  (rand() - 0.5) * clusterBound,
                  (rand() - 0.5) * clusterBound,
                  (rand() - 0.5) * clusterBound
                );
                
                // Vary sub-puff size
                const pSize = size * (0.6 + rand() * 1.0);
                
                // 6 vertices of an octahedron
                const pvs = [
                  new THREE.Vector3(0, pSize, 0), new THREE.Vector3(0, -pSize, 0),
                  new THREE.Vector3(pSize, 0, 0), new THREE.Vector3(-pSize, 0, 0),
                  new THREE.Vector3(0, 0, pSize), new THREE.Vector3(0, 0, -pSize)
                ];
                
                pvs.forEach(v => {
                  const finalPos = leafPos.clone().add(pOffset).add(v);
                  vertices.push(finalPos.x, finalPos.y, finalPos.z);
                  const n = v.clone().normalize();
                  normals.push(n.x, n.y, n.z);
                  colors.push(jitterCol.r, jitterCol.g, jitterCol.b);
                });
                
                const faces = [
                  0, 2, 4,  0, 4, 3,  0, 3, 5,  0, 5, 2,
                  1, 4, 2,  1, 3, 4,  1, 5, 3,  1, 2, 5
                ];
                faces.forEach(f => indices.push(puffIdx + f));
              }

              // Add fruit if enabled (one or two fruits per cluster is enough for detail)
              if (foliageFruit && rand() > 0.6) {
                const fruitCount = 1 + Math.floor(rand() * 2);
                for (let fc = 0; fc < fruitCount; fc++) {
                  const fruitIdx = vertices.length / 3;
                  const fruitSize = size * 0.4;
                  const fruitColor = new THREE.Color(0xff2211);
                  const fOffset = new THREE.Vector3((rand() - 0.5) * size, -size * 0.5, (rand() - 0.5) * size);
                  
                  const fvs = [
                    new THREE.Vector3(0, fruitSize, 0), new THREE.Vector3(0, -fruitSize, 0),
                    new THREE.Vector3(fruitSize, 0, 0), new THREE.Vector3(-fruitSize, 0, 0),
                    new THREE.Vector3(0, 0, fruitSize), new THREE.Vector3(0, 0, -fruitSize)
                  ].map(v => v.add(fOffset));
                  
                  fvs.forEach(v => {
                    const finalPos = leafPos.clone().add(v);
                    vertices.push(finalPos.x, finalPos.y, finalPos.z);
                    normals.push(v.x, v.y, v.z);
                    colors.push(fruitColor.r, fruitColor.g, fruitColor.b);
                  });
                  const faces = [
                    0, 2, 4,  0, 4, 3,  0, 3, 5,  0, 5, 2,
                    1, 4, 2,  1, 3, 4,  1, 5, 3,  1, 2, 5
                  ];
                  faces.forEach(f => indices.push(fruitIdx + f));
                }
              }

              // Add snow if enabled (a larger cap for the cluster)
              if (foliageSnow) {
                const snowIdx = vertices.length / 3;
                const snowSize = size * 1.8;
                const snowColor = new THREE.Color(0xffffff);
                
                const svs = [
                  new THREE.Vector3(0, snowSize, 0), new THREE.Vector3(0, 0, 0),
                  new THREE.Vector3(snowSize, 0, 0), new THREE.Vector3(-snowSize, 0, 0),
                  new THREE.Vector3(0, 0, snowSize), new THREE.Vector3(0, 0, -snowSize)
                ].map(v => v.add(new THREE.Vector3(0, size * 1.2, 0)));
                
                svs.forEach(v => {
                  const finalPos = leafPos.clone().add(v);
                  vertices.push(finalPos.x, finalPos.y, finalPos.z);
                  normals.push(0, 1, 0);
                  colors.push(snowColor.r, snowColor.g, snowColor.b);
                });
                const faces = [
                  0, 2, 4,  0, 4, 3,  0, 3, 5,  0, 5, 2,
                  1, 4, 2,  1, 3, 4,  1, 5, 3,  1, 2, 5
                ];
                faces.forEach(f => indices.push(snowIdx + f));
              }

            } else if (foliageType === 'realistic') {
              // Generate realistic bushy foliage using icosahedrons clustered together
              const subPuffCount = 2 + Math.floor(rand() * 3);
              const clusterBound = size * 0.8;
              
              const phi = (1.0 + Math.sqrt(5.0)) / 2.0;
              const icoVerts = [
                [-1,  phi,  0], [ 1,  phi,  0], [-1, -phi,  0], [ 1, -phi,  0],
                [ 0, -1,  phi], [ 0,  1,  phi], [ 0, -1, -phi], [ 0,  1, -phi],
                [ phi,  0, -1], [ phi,  0,  1], [-phi,  0, -1], [-phi,  0,  1]
              ].map(v => new THREE.Vector3(v[0], v[1], v[2]).normalize());

              const icoFaces = [
                [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
                [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
                [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
                [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
              ];
              
              for (let p = 0; p < subPuffCount; p++) {
                const puffIdx = vertices.length / 3;
                
                const pOffset = new THREE.Vector3(
                  (rand() - 0.5) * clusterBound,
                  (rand() - 0.5) * clusterBound,
                  (rand() - 0.5) * clusterBound
                );
                
                const pSize = size * (0.8 + rand() * 0.5);
                
                // Add vertices
                icoVerts.forEach(v => {
                  const finalPos = leafPos.clone().add(pOffset).add(v.clone().multiplyScalar(pSize));
                  vertices.push(finalPos.x, finalPos.y, finalPos.z);
                  normals.push(v.x, v.y, v.z);
                  colors.push(jitterCol.r, jitterCol.g, jitterCol.b);
                });
                
                // Add faces
                icoFaces.forEach(f => {
                  indices.push(puffIdx + f[0], puffIdx + f[1], puffIdx + f[2]);
                });
              }
              
              // Fruit
              if (foliageFruit && rand() > 0.6) {
                const fruitCount = 1 + Math.floor(rand() * 2);
                for (let fc = 0; fc < fruitCount; fc++) {
                  const fruitIdx = vertices.length / 3;
                  const fruitSize = size * 0.3;
                  const fruitColor = new THREE.Color(0xff2211);
                  const fOffset = new THREE.Vector3((rand() - 0.5) * size, -size * 0.5, (rand() - 0.5) * size);
                  
                  icoVerts.forEach(v => {
                    const finalPos = leafPos.clone().add(fOffset).add(v.clone().multiplyScalar(fruitSize));
                    vertices.push(finalPos.x, finalPos.y, finalPos.z);
                    normals.push(v.x, v.y, v.z);
                    colors.push(fruitColor.r, fruitColor.g, fruitColor.b);
                  });
                  icoFaces.forEach(f => {
                    indices.push(fruitIdx + f[0], fruitIdx + f[1], fruitIdx + f[2]);
                  });
                }
              }

            } else if (foliageType === 'box') {
              // Generate clean, voxel/chunky foliage clusters
              const subBoxCount = 2 + Math.floor(rand() * 3); // 2 to 4 sub-boxes per cluster
              const clusterBound = size * 0.8;
              
              for (let p = 0; p < subBoxCount; p++) {
                // Keep the core box centered, offset the others slightly
                const bOffset = new THREE.Vector3(0, 0, 0);
                if (p > 0) {
                  bOffset.set(
                    (rand() - 0.5) * clusterBound,
                    (rand() - 0.2) * clusterBound * 0.8, // bias slightly upwards
                    (rand() - 0.5) * clusterBound
                  );
                }
                
                // Vary sub-box size - making them chunky, solid blocks
                const bSize = p === 0 ? size * 1.4 : size * (0.7 + rand() * 0.5);
                const s = bSize / 2;
                
                const boxFaces = [
                  { verts: [[-s,-s,s], [s,-s,s], [s,s,s], [-s,s,s]], norm: [0,0,1] }, // front
                  { verts: [[s,-s,-s], [-s,-s,-s], [-s,s,-s], [s,s,-s]], norm: [0,0,-1] }, // back
                  { verts: [[-s,s,s], [s,s,s], [s,s,-s], [-s,s,-s]], norm: [0,1,0] }, // top
                  { verts: [[-s,-s,-s], [s,-s,-s], [s,-s,s], [-s,-s,s]], norm: [0,-1,0] }, // bottom
                  { verts: [[s,-s,s], [s,-s,-s], [s,s,-s], [s,s,s]], norm: [1,0,0] }, // right
                  { verts: [[-s,-s,-s], [-s,-s,s], [-s,s,s], [-s,s,-s]], norm: [-1,0,0] } // left
                ];

                boxFaces.forEach(face => {
                  const baseIdx = vertices.length / 3;
                  
                  face.verts.forEach(vArr => {
                    const localV = new THREE.Vector3(vArr[0], vArr[1], vArr[2]);
                    const finalPos = leafPos.clone().add(bOffset).add(localV);
                    vertices.push(finalPos.x, finalPos.y, finalPos.z);
                    normals.push(face.norm[0], face.norm[1], face.norm[2]);
                    colors.push(jitterCol.r, jitterCol.g, jitterCol.b);
                  });
                  
                  indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
                  indices.push(baseIdx, baseIdx + 2, baseIdx + 3);
                });
              }

              // Add fruit if enabled
              if (foliageFruit && rand() > 0.6) {
                const fruitCount = 1 + Math.floor(rand() * 2);
                for (let fc = 0; fc < fruitCount; fc++) {
                  const fOffset = new THREE.Vector3((rand() - 0.5) * size, -size * 0.5, (rand() - 0.5) * size);
                  const fruitSize = size * 0.4;
                  const s = fruitSize / 2;
                  const fruitColor = new THREE.Color(0xff2211);
                  
                  const boxFaces = [
                    { verts: [[-s,-s,s], [s,-s,s], [s,s,s], [-s,s,s]], norm: [0,0,1] },
                    { verts: [[s,-s,-s], [-s,-s,-s], [-s,s,-s], [s,s,-s]], norm: [0,0,-1] },
                    { verts: [[-s,s,s], [s,s,s], [s,s,-s], [-s,s,-s]], norm: [0,1,0] },
                    { verts: [[-s,-s,-s], [s,-s,-s], [s,-s,s], [-s,-s,s]], norm: [0,-1,0] },
                    { verts: [[s,-s,s], [s,-s,-s], [s,s,-s], [s,s,s]], norm: [1,0,0] },
                    { verts: [[-s,-s,-s], [-s,-s,s], [-s,s,s], [-s,s,-s]], norm: [-1,0,0] }
                  ];

                  boxFaces.forEach(face => {
                    const baseIdx = vertices.length / 3;
                    face.verts.forEach(vArr => {
                      const localV = new THREE.Vector3(vArr[0], vArr[1], vArr[2]);
                      const finalPos = leafPos.clone().add(fOffset).add(localV);
                      vertices.push(finalPos.x, finalPos.y, finalPos.z);
                      normals.push(face.norm[0], face.norm[1], face.norm[2]);
                      colors.push(fruitColor.r, fruitColor.g, fruitColor.b);
                    });
                    indices.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3);
                  });
                }
              }

              // Add snow if enabled
              if (foliageSnow) {
                const snowSize = size * 1.8;
                const s = snowSize / 2;
                const snowColor = new THREE.Color(0xffffff);
                const sOffset = new THREE.Vector3(0, size * 0.6, 0); // rest on top
                
                const boxFaces = [
                  { verts: [[-s,s,s], [s,s,s], [s,s,-s], [-s,s,-s]], norm: [0,1,0] }, // top face only
                  { verts: [[-s,-s,s], [s,-s,s], [s,s,s], [-s,s,s]], norm: [0,0,1] }, // front
                  { verts: [[s,-s,-s], [-s,-s,-s], [-s,s,-s], [s,s,-s]], norm: [0,0,-1] }, // back
                  { verts: [[s,-s,s], [s,-s,-s], [s,s,-s], [s,s,s]], norm: [1,0,0] }, // right
                  { verts: [[-s,-s,-s], [-s,-s,s], [-s,s,s], [-s,s,-s]], norm: [-1,0,0] } // left
                ];

                boxFaces.forEach(face => {
                  const baseIdx = vertices.length / 3;
                  face.verts.forEach((vArr, vi) => {
                    // flatten bottom vertices to make a cap
                    const y = (vi < 2 && face.norm[1] !== 1) ? -s/4 : s/2; 
                    const localV = new THREE.Vector3(vArr[0], y, vArr[2]);
                    const finalPos = leafPos.clone().add(sOffset).add(localV);
                    vertices.push(finalPos.x, finalPos.y, finalPos.z);
                    normals.push(face.norm[0], face.norm[1], face.norm[2]);
                    colors.push(snowColor.r, snowColor.g, snowColor.b);
                  });
                  indices.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3);
                });
              }

            } else {
              // Standard Quads
              const p1 = leafPos.clone().add(lSide.clone().multiplyScalar(-size)).add(lPerp.clone().multiplyScalar(-size));
              const p2 = leafPos.clone().add(lSide.clone().multiplyScalar(size)).add(lPerp.clone().multiplyScalar(-size));
              const p3 = leafPos.clone().add(lSide.clone().multiplyScalar(size)).add(lPerp.clone().multiplyScalar(size));
              const p4 = leafPos.clone().add(lSide.clone().multiplyScalar(-size)).add(lPerp.clone().multiplyScalar(size));

              vertices.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z, p4.x, p4.y, p4.z);
              
              const n = lDir;
              normals.push(n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z);
              colors.push(jitterCol.r, jitterCol.g, jitterCol.b, jitterCol.r, jitterCol.g, jitterCol.b, jitterCol.r, jitterCol.g, jitterCol.b, jitterCol.r, jitterCol.g, jitterCol.b);
              
              indices.push(leafIdx, leafIdx + 1, leafIdx + 2);
              indices.push(leafIdx, leafIdx + 2, leafIdx + 3);

              if (foliageCross) {
                const crossIdx = vertices.length / 3;
                const c_p1 = leafPos.clone().add(lDir.clone().multiplyScalar(-size)).add(lPerp.clone().multiplyScalar(-size));
                const c_p2 = leafPos.clone().add(lDir.clone().multiplyScalar(size)).add(lPerp.clone().multiplyScalar(-size));
                const c_p3 = leafPos.clone().add(lDir.clone().multiplyScalar(size)).add(lPerp.clone().multiplyScalar(size));
                const c_p4 = leafPos.clone().add(lDir.clone().multiplyScalar(-size)).add(lPerp.clone().multiplyScalar(size));

                vertices.push(c_p1.x, c_p1.y, c_p1.z, c_p2.x, c_p2.y, c_p2.z, c_p3.x, c_p3.y, c_p3.z, c_p4.x, c_p4.y, c_p4.z);
                normals.push(lSide.x, lSide.y, lSide.z, lSide.x, lSide.y, lSide.z, lSide.x, lSide.y, lSide.z, lSide.x, lSide.y, lSide.z);
                colors.push(jitterCol.r, jitterCol.g, jitterCol.b, jitterCol.r, jitterCol.g, jitterCol.b, jitterCol.r, jitterCol.g, jitterCol.b, jitterCol.r, jitterCol.g, jitterCol.b);

                indices.push(crossIdx, crossIdx + 1, crossIdx + 2);
                indices.push(crossIdx, crossIdx + 2, crossIdx + 3);
              }
            }
          }
        }
        return;
      }

      for (let i = 0; i < branchFactor; i++) {
        const nextDir = gnarledDir.clone();
        const angleVar = (rand() - 0.5) * randomness;
        const spreadVar = (rand() - 0.5) * randomness * 2;
        const spreadRay = perp1.clone().applyAxisAngle(axis, (i / branchFactor) * Math.PI * 2 + spreadVar);
        
        let childLength = length * (0.6 + rand() * 0.2);
        let childThickness = thickness * taper;
        
        // Apical dominance: The first branch acts as a leader branch, bending less and staying thicker
        if (i === 0 && branchFactor > 1 && rand() > 0.3) {
          nextDir.applyAxisAngle(spreadRay, (angle + angleVar) * 0.4);
          childLength = length * (0.8 + rand() * 0.2);
          childThickness = thickness * (taper + 0.1);
        } else {
          nextDir.applyAxisAngle(spreadRay, angle + angleVar);
        }
        
        // Phototropism: branches tend to curl upwards
        const upwardBias = 0.15 * (1.0 - (currentLevel - 1) / levels);
        if (upwardBias > 0) {
          nextDir.lerp(new THREE.Vector3(0, 1, 0), upwardBias).normalize();
        }

        addBranch(end, nextDir, childLength, childThickness, currentLevel - 1);
      }
    };

    // Generate multiple trees
    for (let t = 0; t < count; t++) {
      let offsetX = 0;
      let offsetZ = 0;

      if (distribution === 'random') {
        offsetX = (rand() - 0.5) * spread;
        offsetZ = (rand() - 0.5) * spread;
      } else if (distribution === 'grid') {
        const side = Math.ceil(Math.sqrt(count));
        const col = t % side;
        const row = Math.floor(t / side);
        offsetX = (col / (side - 1 || 1) - 0.5) * spread;
        offsetZ = (row / (side - 1 || 1) - 0.5) * spread;
      } else if (distribution === 'circle') {
        const theta = (t / count) * Math.PI * 2;
        const radius = spread * 0.5;
        offsetX = Math.cos(theta) * radius;
        offsetZ = Math.sin(theta) * radius;
      }

      const basePos = new THREE.Vector3(offsetX, 0, offsetZ);
      const treeHeight = height * (0.8 + rand() * 0.4);
      const treeThickness = trunkThickness * (0.9 + rand() * 0.2);
      addBranch(basePos, new THREE.Vector3(0, 1, 0), treeHeight * 0.4, treeThickness, levels);
    }

    return {
      vertices: new Float32Array(vertices),
      indices: new Uint32Array(indices),
      normals: new Float32Array(normals),
      colors: new Float32Array(colors)
    };
  }, [levels, height, branchFactor, angle, seed, foliage, foliageSize, foliageDensity, foliageOffset, foliageCross, foliageJitter, foliageType, foliageFruit, foliageSnow, gnarl, distribution, count, spread, bCol, fCol, trunkThickness, taper, randomness]);

  const geom = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(geometryData.vertices, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(geometryData.normals, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(geometryData.colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(geometryData.indices, 1));
    geometry.computeBoundingSphere();
    return geometry;
  }, [geometryData]);

  useEffect(() => {
    return () => {
      geom.dispose();
    };
  }, [geom]);

  return <primitive object={geom} attach="geometry" />;
}
