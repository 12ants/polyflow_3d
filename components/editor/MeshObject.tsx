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
    if (!geom) {
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
    if (!selectedVertexIndices || selectedVertexIndices.length === 0 || !geom) return null;
    
    const weights: Record<number, number> = {};
    const pos = geom.attributes.position;
    const origPos = geom.userData.originalPosition as THREE.BufferAttribute;
    
    // Always include selected vertices with full weight
    selectedVertexIndices.forEach(idx => {
      weights[idx] = 1;
    });

    if (!softSelectionEnabled) return weights;

    const selectedPoints = selectedVertexIndices.map(idx => {
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

  useFrame(() => {
    // Check for isSelecting transition from true to false
    if (wasSelecting.current && !isSelecting && (editMode === 'vertex' || editMode === 'edge' || editMode === 'face') && isSelected && geom) {
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
      if (!g.userData.originalPosition) {
        g.userData.originalPosition = g.attributes.position.clone();
      }
      setGeom(g);
    }
  });

  // Apply geometry offsets
  useEffect(() => {
    if (!geom || !geom.userData.originalPosition) return;
    const pos = geom.attributes.position;
    const orig = geom.userData.originalPosition;

    pos.array.set(orig.array);

    if (object.vertexOffsets) {
      Object.entries(object.vertexOffsets).forEach(([idxStr, offset]) => {
        const i = parseInt(idxStr, 10);
        if (i * 3 + 2 < pos.array.length) {
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
    if ((editMode === 'vertex' || editMode === 'edge' || editMode === 'face') && isSelected && selectedVertexIndices && selectedVertexIndices.length > 0 && vertexControlRef.current && geom?.userData.originalPosition) {
       const pos = geom.attributes.position;
       const orig = geom.userData.originalPosition;
       
       // Calculate median position including existing project offsets
       const avgPos = new THREE.Vector3(0, 0, 0);
       selectedVertexIndices.forEach(idx => {
         const off = (object.vertexOffsets && object.vertexOffsets[idx]) ? object.vertexOffsets[idx] : [0,0,0];
         avgPos.x += orig.getX(idx) + off[0];
         avgPos.y += orig.getY(idx) + off[1];
         avgPos.z += orig.getZ(idx) + off[2];
       });
       avgPos.divideScalar(selectedVertexIndices.length);
       
       vertexControlRef.current.position.copy(avgPos);
    }
  }, [selectedVertexIndices, editMode, isSelected, geom, object.vertexOffsets]);

  const handleTransformChange = () => {
    if (!geom || !geom.userData.originalPosition || !selectedVertexIndices || !vertexControlRef.current) return;
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
    const avgOrigPos = new THREE.Vector3(0, 0, 0);
    selectedVertexIndices.forEach(idx => {
      avgOrigPos.x += orig.getX(idx);
      avgOrigPos.y += orig.getY(idx);
      avgOrigPos.z += orig.getZ(idx);
    });
    avgOrigPos.divideScalar(selectedVertexIndices.length);

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
    pos.array.set(orig.array);
    if (object.vertexOffsets) {
      Object.entries(object.vertexOffsets).forEach(([idxStr, off]) => {
        const i = parseInt(idxStr, 10);
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
        pos.array[i * 3] += finalOffsetX * weight;
        pos.array[i * 3 + 1] += finalOffsetY * weight;
        pos.array[i * 3 + 2] += finalOffsetZ * weight;
      });
    } else {
      selectedVertexIndices.forEach((i) => {
        pos.array[i * 3] += finalOffsetX;
        pos.array[i * 3 + 1] += finalOffsetY;
        pos.array[i * 3 + 2] += finalOffsetZ;
      });
    }

    pos.needsUpdate = true;
  };

  const handleTransformMouseUp = () => {
    if (!selectedVertexIndices || !vertexControlRef.current || !geom) return;
    const tempPos = vertexControlRef.current.position;
    const pos = geom.attributes.position;
    const orig = geom.userData.originalPosition;
    
    const avgOrigPos = new THREE.Vector3(0, 0, 0);
    selectedVertexIndices.forEach(idx => {
      avgOrigPos.x += orig.getX(idx);
      avgOrigPos.y += orig.getY(idx);
      avgOrigPos.z += orig.getZ(idx);
    });
    avgOrigPos.divideScalar(selectedVertexIndices.length);

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
        newOffsets[i] = [offsetX, offsetY, offsetZ];
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
             if (faceHit && faceHit.faceIndex !== undefined) {
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
          if (editMode === 'face' && e.faceIndex !== undefined) {
             setHoveredFace({ objectId: object.id, index: e.faceIndex });
          }
        }}
        onPointerOut={() => {
           if (editMode === 'face') setHoveredFace(null);
        }}
      >
        <Geometry type={object.type} params={object.params} customModel={object.customModel} />
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

    if (highlightIndices.length === 0) return null;

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

  return (
    <meshPhysicalMaterial 
      color={object.color} 
      map={texture} 
      roughness={object.roughness}
      metalness={object.metalness}
      reflectivity={object.reflectivity}
      envMapIntensity={1}
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
