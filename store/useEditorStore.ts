import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export type EditMode = 'object' | 'vertex' | 'edge' | 'face';
export type ObjectType = 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'imported' | 'terrain' | 'torusKnot' | 'tree';
export type MaterialType = 'solid' | 'checker' | 'noise';

export interface SceneObject {
  id: string;
  type: ObjectType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  name: string;
  customModel?: any; // THREE.Object3D
  materialType?: MaterialType;
  materialParams?: any;
  params?: any;
  vertexOffsets?: Record<number, [number, number, number]>;
  roughness: number;
  metalness: number;
  reflectivity: number;
}

export type TransformMode = 'translate' | 'rotate' | 'scale';

interface EditorState {
  objects: SceneObject[];
  selectedId: string | null;
  transformMode: TransformMode;
  editMode: EditMode;
  selectedVertexIndices: Record<string, number[]>;
  selectedEdgeIndices: Record<string, [number, number][]>;
  selectedFaceIndices: Record<string, number[]>;
  selectionBox: { start: { x: number, y: number }, end: { x: number, y: number } } | null;
  lassoPath: { x: number, y: number }[] | null;
  isSelecting: boolean;
  activeTool: 'orbit' | 'select';
  selectionShape: 'box' | 'lasso';
  hoveredVertexIndex: { objectId: string, index: number } | null;
  hoveredEdgeIndex: { objectId: string, edge: [number, number] } | null;
  hoveredFaceIndex: { objectId: string, index: number } | null;
  selectionMode: 'replace' | 'add' | 'subtract' | 'toggle';
  softSelectionEnabled: boolean;
  softSelectionRadius: number;
  snappingEnabled: boolean;
  snapIncrement: number;
  vertexSnappingEnabled: boolean;
  
  // Actions
  setTransformMode: (mode: TransformMode) => void;
  setEditMode: (mode: EditMode) => void;
  setSelectionMode: (mode: 'replace' | 'add' | 'subtract' | 'toggle') => void;
  selectVertex: (indices: number[] | null, objectId?: string) => void;
  selectEdge: (edges: [number, number][] | null, objectId?: string) => void;
  selectFace: (indices: number[] | null, objectId?: string) => void;
  setHoveredVertex: (data: { objectId: string, index: number } | null) => void;
  setHoveredEdge: (data: { objectId: string, edge: [number, number] } | null) => void;
  setHoveredFace: (data: { objectId: string, index: number } | null) => void;
  setActiveTool: (tool: 'orbit' | 'select') => void;
  setSoftSelectionEnabled: (enabled: boolean) => void;
  setSoftSelectionRadius: (radius: number) => void;
  setSelectionBox: (box: { start: { x: number, y: number }, end: { x: number, y: number } } | null) => void;
  setLassoPath: (path: { x: number, y: number }[] | null) => void;
  setSelectionShape: (shape: 'box' | 'lasso') => void;
  setIsSelecting: (selecting: boolean) => void;
  setSnappingEnabled: (enabled: boolean) => void;
  setSnapIncrement: (increment: number) => void;
  setVertexSnappingEnabled: (enabled: boolean) => void;
  
  gridColor: string;
  setGridColor: (color: string) => void;
  cameraResetTrigger: number;
  triggerCameraReset: () => void;

  sceneStats: { vertices: number; edges: number; faces: number; objects: number; selectedVertices: number; selectedEdges: number; selectedFaces: number; } | null;
  setSceneStats: (stats: { vertices: number; edges: number; faces: number; objects: number; selectedVertices: number; selectedEdges: number; selectedFaces: number; } | null) => void;

  past: SceneObject[][];
  future: SceneObject[][];
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  addObject: (type: ObjectType) => void;
  addImportedObject: (model: any, name: string) => void;
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
  removeObject: (id: string) => void;
  selectObject: (id: string | null) => void;
  clearScene: () => void;
  clearAllSubSelections: () => void;
}

const cloneObjects = (objs: SceneObject[]) => objs.map(o => ({
  ...o,
  position: [...o.position] as [number, number, number],
  rotation: [...o.rotation] as [number, number, number],
  scale: [...o.scale] as [number, number, number],
  params: o.params ? JSON.parse(JSON.stringify(o.params)) : o.params,
  materialParams: o.materialParams ? JSON.parse(JSON.stringify(o.materialParams)) : o.materialParams,
  vertexOffsets: o.vertexOffsets ? JSON.parse(JSON.stringify(o.vertexOffsets)) : o.vertexOffsets 
}));

const DEFAULT_COLORS: Record<string, string> = {
  box: '#3b82f6', // blue
  sphere: '#ef4444', // red
  cylinder: '#10b981', // green
  cone: '#f59e0b', // yellow
  torus: '#8b5cf6', // purple
  terrain: '#aaaaaa',
  torusKnot: '#ec4899',
};

export const useEditorStore = create<EditorState>((set) => ({
  objects: [],
  selectedId: null,
  transformMode: 'translate',
  editMode: 'object',
  selectedVertexIndices: {},
  selectedEdgeIndices: {},
  selectedFaceIndices: {},
  selectionBox: null,
  lassoPath: null,
  isSelecting: false,
  activeTool: 'orbit',
  selectionShape: 'box',
  hoveredVertexIndex: null,
  hoveredEdgeIndex: null,
  hoveredFaceIndex: null,
  selectionMode: 'replace',
  softSelectionEnabled: false,
  softSelectionRadius: 1.0,
  snappingEnabled: true,
  snapIncrement: 0.1,
  vertexSnappingEnabled: true,
  gridColor: '#404040',
  cameraResetTrigger: 0,
  sceneStats: null,
  past: [],
  future: [],

  pushHistory: () => set((state) => {
    // Check if we hit a limit to prevent memory bloat
    const newPast = [...state.past, cloneObjects(state.objects)].slice(-50);
    return {
      past: newPast,
      future: []
    };
  }),

  undo: () => set((state) => {
    if (state.past.length === 0) return {};
    const previous = state.past[state.past.length - 1];
    const newPast = state.past.slice(0, state.past.length - 1);
    return {
      past: newPast,
      future: [cloneObjects(state.objects), ...state.future],
      objects: cloneObjects(previous)
    };
  }),

  redo: () => set((state) => {
    if (state.future.length === 0) return {};
    const next = state.future[0];
    const newFuture = state.future.slice(1);
    return {
      past: [...state.past, cloneObjects(state.objects)],
      future: newFuture,
      objects: cloneObjects(next)
    };
  }),

  setSceneStats: (stats) => set({ sceneStats: stats }),
  setTransformMode: (mode) => set({ transformMode: mode }),
  setEditMode: (mode) => set({ 
    editMode: mode, 
    selectedVertexIndices: {}, 
    selectedEdgeIndices: {},
    selectedFaceIndices: {},
    hoveredVertexIndex: null,
    hoveredEdgeIndex: null,
    hoveredFaceIndex: null 
  }),
  setSelectionMode: (mode) => set({ selectionMode: mode }),
  selectVertex: (indices, objectId) => set((state) => {
    const targetId = objectId || state.selectedId;
    if (!targetId) return {};

    if (!indices) {
      const nextRecords = { ...state.selectedVertexIndices };
      delete nextRecords[targetId];
      return { selectedVertexIndices: nextRecords };
    }
    
    let currentIndices = state.selectedVertexIndices[targetId] || [];
    let nextIndices = [...currentIndices];
    const mode = state.selectionMode;
    
    if (mode === 'replace') {
      nextIndices = indices;
    } else if (mode === 'add') {
      nextIndices = Array.from(new Set([...nextIndices, ...indices]));
    } else if (mode === 'subtract') {
       const subtractSet = new Set(indices);
       nextIndices = nextIndices.filter(idx => !subtractSet.has(idx));
    } else if (mode === 'toggle') {
       const toggleSet = new Set(indices);
       const toAdd = indices.filter(idx => !nextIndices.includes(idx));
       const filtered = nextIndices.filter(idx => !toggleSet.has(idx));
       nextIndices = [...filtered, ...toAdd];
    }
    
    return { 
      selectedVertexIndices: { 
        ...state.selectedVertexIndices, 
        [targetId]: nextIndices.length > 0 ? nextIndices : [] 
      } 
    };
  }),
  selectEdge: (edges, objectId) => set((state) => {
    const targetId = objectId || state.selectedId;
    if (!targetId) return {};

    if (!edges) {
      const nextRecords = { ...state.selectedEdgeIndices };
      delete nextRecords[targetId];
      return { selectedEdgeIndices: nextRecords };
    }
    
    // Helper to normalize edge for comparison
    const edgeKey = (e: [number, number]) => Math.min(e[0], e[1]) + "-" + Math.max(e[0], e[1]);
    
    let currentEdges = state.selectedEdgeIndices[targetId] || [];
    let nextEdges = [...currentEdges];
    const mode = state.selectionMode;
    
    if (mode === 'replace') {
      nextEdges = edges;
    } else if (mode === 'add') {
      const existingKeys = new Set(nextEdges.map(edgeKey));
      const toAdd = edges.filter(e => !existingKeys.has(edgeKey(e)));
      nextEdges = [...nextEdges, ...toAdd];
    } else if (mode === 'subtract') {
      const subtractKeys = new Set(edges.map(edgeKey));
      nextEdges = nextEdges.filter(e => !subtractKeys.has(edgeKey(e)));
    } else if (mode === 'toggle') {
      const incomingKeys = new Set(edges.map(edgeKey));
      const existingKeys = new Set(nextEdges.map(edgeKey));
      
      const filtered = nextEdges.filter(e => !incomingKeys.has(edgeKey(e)));
      const toAdd = edges.filter(e => !existingKeys.has(edgeKey(e)));
      nextEdges = [...filtered, ...toAdd];
    }
    
    // When edges are selected, also update selectedVertexIndices to include all vertices of selected edges
    const vIndices = new Set<number>();
    nextEdges.forEach(e => { vIndices.add(e[0]); vIndices.add(e[1]); });
    
    return { 
      selectedEdgeIndices: {
        ...state.selectedEdgeIndices,
        [targetId]: nextEdges.length > 0 ? nextEdges : []
      },
      selectedVertexIndices: {
        ...state.selectedVertexIndices,
        [targetId]: vIndices.size > 0 ? Array.from(vIndices) : []
      }
    };
  }),
  selectFace: (indices, objectId) => set((state) => {
    const targetId = objectId || state.selectedId;
    if (!targetId) return {};

    if (!indices) {
      const nextRecords = { ...state.selectedFaceIndices };
      delete nextRecords[targetId];
      return { selectedFaceIndices: nextRecords };
    }
    
    let currentIndices = state.selectedFaceIndices[targetId] || [];
    let nextIndices = [...currentIndices];
    const mode = state.selectionMode;
    
    if (mode === 'replace') {
      nextIndices = indices;
    } else if (mode === 'add') {
      nextIndices = Array.from(new Set([...nextIndices, ...indices]));
    } else if (mode === 'subtract') {
       const subtractSet = new Set(indices);
       nextIndices = nextIndices.filter(idx => !subtractSet.has(idx));
    } else if (mode === 'toggle') {
       const toggleSet = new Set(indices);
       const toAdd = indices.filter(idx => !nextIndices.includes(idx));
       const filtered = nextIndices.filter(idx => !toggleSet.has(idx));
       nextIndices = [...filtered, ...toAdd];
    }
    
    return { 
      selectedFaceIndices: { 
        ...state.selectedFaceIndices, 
        [targetId]: nextIndices.length > 0 ? nextIndices : [] 
      } 
    };
  }),
  setHoveredVertex: (data) => set({ hoveredVertexIndex: data }),
  setHoveredEdge: (data) => set({ hoveredEdgeIndex: data }),
  setHoveredFace: (data) => set({ hoveredFaceIndex: data }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setSoftSelectionEnabled: (enabled) => set({ softSelectionEnabled: enabled }),
  setSoftSelectionRadius: (radius) => set({ softSelectionRadius: radius }),
  setSelectionBox: (box) => set({ selectionBox: box }),
  setLassoPath: (path) => set({ lassoPath: path }),
  setSelectionShape: (shape) => set({ selectionShape: shape }),
  setIsSelecting: (selecting) => set({ isSelecting: selecting }),
  setSnappingEnabled: (enabled) => set({ snappingEnabled: enabled }),
  setSnapIncrement: (increment) => set({ snapIncrement: increment }),
  setVertexSnappingEnabled: (enabled) => set({ vertexSnappingEnabled: enabled }),
  setGridColor: (color) => set({ gridColor: color }),
  triggerCameraReset: () => set((state) => ({ cameraResetTrigger: state.cameraResetTrigger + 1 })),

  addObject: (type) =>
    set((state) => {
      let params = {};
      
      // Default parameters for procedural objects
      if (type === 'terrain') {
        params = { width: 5, height: 5, segments: 32, amplitude: 1, scale: 2 };
      } else if (type === 'torusKnot') {
        params = { radius: 0.5, tube: 0.15, p: 2, q: 3 };
      } else if (type === 'tree') {
        params = { 
          levels: 3, 
          height: 2, 
          branchFactor: 2, 
          angle: 0.5, 
          seed: Math.floor(Math.random() * 10000), 
          foliage: true, 
          foliageSize: 0.5,
          foliageDensity: 1.0,
          foliageOffset: 0.0,
          foliageType: 'quad',
          foliageFruit: false,
          foliageSnow: false,
          foliageAnimate: false,
          gnarl: 0.2,
          windSpeed: 1.0,
          distribution: 'random',
          count: 1,
          spread: 2.0,
          preset: 'default',
          branchColor: '#4d2d11',
          foliageColor: '#2d5a27',
          trunkThickness: 0.05,
          taper: 0.7,
          randomness: 0.2
        };
      }

      const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');

      const newObj: SceneObject = {
        id: uuidv4(),
        type,
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${state.objects.filter(o => o.type === type).length + 1}`,
        position: [0, 0, 0],
        rotation: type === 'terrain' ? [-Math.PI/2, 0, 0] : [0, 0, 0],
        scale: [1, 1, 1],
        color: type !== 'imported' ? randomColor : '#ffffff',
        materialType: 'solid',
        materialParams: { scale: 8 },
        params,
        roughness: 0.4,
        metalness: 0,
        reflectivity: 0.5,
      };
      return {
        past: [...state.past, cloneObjects(state.objects)].slice(-50),
        future: [],
        objects: [...state.objects, newObj],
        selectedId: newObj.id,
      };
    }),

  addImportedObject: (model, name) => 
    set((state) => {
      const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
      const newObj: SceneObject = {
        id: uuidv4(),
        type: 'imported',
        name: name,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color: randomColor,
        customModel: model,
        materialType: 'solid',
        roughness: 0.4,
        metalness: 0,
        reflectivity: 0.5,
      };
      return {
        past: [...state.past, cloneObjects(state.objects)].slice(-50),
        future: [],
        objects: [...state.objects, newObj],
        selectedId: newObj.id,
      };
    }),

  updateObject: (id, updates) =>
    set((state) => ({
      objects: state.objects.map((obj) =>
        obj.id === id ? { ...obj, ...updates } : obj
      ),
    })),

  removeObject: (id) =>
    set((state) => ({
      past: [...state.past, cloneObjects(state.objects)].slice(-50),
      future: [],
      objects: state.objects.filter((obj) => obj.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    })),

  selectObject: (id) => set((state) => ({ 
    selectedId: id, 
  })),
  
  clearScene: () => set((state) => ({ 
    past: [...state.past, cloneObjects(state.objects)].slice(-50),
    future: [],
    objects: [], 
    selectedId: null, 
    selectedVertexIndices: {}, 
    selectedEdgeIndices: {},
    selectedFaceIndices: {},
    editMode: 'object' 
  })),

  clearAllSubSelections: () => set({
    selectedVertexIndices: {},
    selectedEdgeIndices: {},
    selectedFaceIndices: {}
  })
}));
