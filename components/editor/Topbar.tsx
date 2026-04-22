'use client';

import { useEditorStore } from '@/store/useEditorStore';
import { MousePointer2, Move, RotateCcw, Scaling, Trash2, Download, Upload, ChevronDown, Undo2, Redo2 } from 'lucide-react';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import * as THREE from 'three';
import { useIsMobile } from '@/hooks/use-mobile';

export function Topbar() {
  const { transformMode, setTransformMode, clearScene, addImportedObject, editMode, setEditMode, selectVertex, selectFace, undo, redo, past, future } = useEditorStore();
  const isMobile = useIsMobile();

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name;
    const extension = fileName.split('.').pop()?.toLowerCase();
    const reader = new FileReader();

    reader.onload = (event) => {
      const contents = event.target?.result;
      if (!contents) return;

      try {
        if (extension === 'obj') {
          const loader = new OBJLoader();
          const object = loader.parse(contents as string);
          addImportedObject(object, fileName);
        } else if (extension === 'fbx') {
          const loader = new FBXLoader();
          const object = loader.parse(contents as ArrayBuffer, '');
          addImportedObject(object, fileName);
        } else {
          alert('Unsupported file format. Please use OBJ or FBX.');
        }
      } catch (err) {
        console.error('Error importing file:', err);
        alert('Failed to parse the file.');
      }
    };

    if (extension === 'fbx') {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }

    // Reset input
    e.target.value = '';
  };

  const handleExportObj = () => {
    // The main group containing our objects is registered on window.__polyflow_scene
    // We do this to decouple the React UI from the WebGL context easily.
    const sceneGroup = (window as any).__polyflow_scene;
    if (!sceneGroup) return;

    const exporter = new OBJExporter();
    const result = exporter.parse(sceneGroup);
    
    // Download
    const blob = new Blob([result as string], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'model.obj';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportGLTF = () => {
    const sceneGroup = (window as any).__polyflow_scene;
    if (!sceneGroup) return;

    const exporter = new GLTFExporter();
    exporter.parse(
      sceneGroup,
      (gltf) => {
        const output = JSON.stringify(gltf, null, 2);
        const blob = new Blob([output], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'model.gltf';
        link.click();
        URL.revokeObjectURL(url);
      },
      (error) => console.error('An error happened during parsing', error),
      { binary: false } // Export standard glTF
    );
  };

  return (
    <div className="h-14 md:h-12 bg-panel border-b border-border-dim flex items-center justify-between px-3 md:px-4 z-10 sticky top-0">
      <div className="flex items-center gap-1 md:gap-2">
        {!isMobile && (
          <h1 className="text-[16px] font-bold tracking-[1px] text-accent flex items-center shrink-0">
            POLY<span className="text-white ml-1">FORM</span>
          </h1>
        )}
        
        <div className={`flex items-center border-border-dim gap-1 md:gap-2 ${isMobile ? '' : 'ml-4 pl-4 border-l'}`}>
          <button
             onClick={() => { setEditMode('object'); selectVertex(null); }}
             className={`px-2 md:px-3 py-1 text-[10px] md:text-[11px] font-semibold rounded-[3px] uppercase tracking-[0.5px] md:tracking-[1px] transition-colors ${editMode === 'object' ? 'bg-accent text-white' : 'text-text-dim hover:text-white'}`}
          >
             {isMobile ? 'Obj' : 'Object'}
          </button>
          <button
             onClick={() => setEditMode('vertex')}
             className={`px-2 md:px-3 py-1 text-[10px] md:text-[11px] font-semibold rounded-[3px] uppercase tracking-[0.5px] md:tracking-[1px] transition-colors ${editMode === 'vertex' ? 'bg-accent text-white' : 'text-text-dim hover:text-white'}`}
          >
             {isMobile ? 'Vtx' : 'Vertex'}
          </button>
          <button
             onClick={() => setEditMode('edge')}
             className={`px-2 md:px-3 py-1 text-[10px] md:text-[11px] font-semibold rounded-[3px] uppercase tracking-[0.5px] md:tracking-[1px] transition-colors ${editMode === 'edge' ? 'bg-accent text-white' : 'text-text-dim hover:text-white'}`}
          >
             {isMobile ? 'Edg' : 'Edge'}
          </button>
          <button
             onClick={() => setEditMode('face')}
             className={`px-2 md:px-3 py-1 text-[10px] md:text-[11px] font-semibold rounded-[3px] uppercase tracking-[0.5px] md:tracking-[1px] transition-colors ${editMode === 'face' ? 'bg-accent text-white' : 'text-text-dim hover:text-white'}`}
          >
             {isMobile ? 'Fac' : 'Face'}
          </button>
        </div>

        {!isMobile && (
          <div className="flex p-0 rounded-md gap-2 ml-4">
            <ToolButton 
              active={transformMode === 'translate'} 
              onClick={() => setTransformMode('translate')} 
              icon={<Move size={14} />} 
              tooltip="Translate (T)" 
            />
            <ToolButton 
              active={transformMode === 'rotate'} 
              onClick={() => setTransformMode('rotate')} 
              icon={<RotateCcw size={14} />} 
              tooltip="Rotate (R)" 
            />
            <ToolButton 
              active={transformMode === 'scale'} 
              onClick={() => setTransformMode('scale')} 
              icon={<Scaling size={14} />} 
              tooltip="Scale (S)" 
            />

            <div className="w-[1px] h-6 bg-border-dim mx-1 mt-1"></div>

            <button
              onClick={undo}
              disabled={past.length === 0}
              title="Undo (Ctrl+Z)"
              className={`p-2 w-8 h-8 flex items-center justify-center text-[12px] rounded-[4px] border border-border-dim bg-[#252525] transition-colors ${past.length > 0 ? 'text-text-main hover:text-white hover:border-text-dim' : 'text-text-dim/30 cursor-not-allowed hidden'}`}
            >
              <Undo2 size={14} />
            </button>
            <button
              onClick={redo}
              disabled={future.length === 0}
              title="Redo (Ctrl+Y)"
              className={`p-2 w-8 h-8 flex items-center justify-center text-[12px] rounded-[4px] border border-border-dim bg-[#252525] transition-colors ${future.length > 0 ? 'text-text-main hover:text-white hover:border-text-dim' : 'text-text-dim/30 cursor-not-allowed hidden'}`}
            >
              <Redo2 size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 md:gap-3">
        {!isMobile && <span className="text-[12px] text-text-dim mr-2 shrink-0">v2.4.0-stable</span>}
        
        <label className="bg-accent text-white border-none p-1.5 md:py-[6px] md:px-[12px] rounded-[4px] text-[12px] font-semibold cursor-pointer hover:bg-blue-600 flex items-center gap-1">
          <Upload size={14} /> <span className="hidden md:inline">Import</span>
          <input type="file" accept=".obj,.fbx" className="hidden" onChange={handleImportFile} />
        </label>

        <button 
          onClick={clearScene}
          className="bg-[#252525] border border-border-dim text-[#ff4444] p-1.5 md:py-[6px] md:px-[12px] rounded-[4px] text-[12px] font-semibold cursor-pointer hover:bg-[#333] transition-colors flex items-center gap-1"
          title="Clear Scene"
        >
          <Trash2 size={14} /> <span className="hidden md:inline">Clear</span>
        </button>

        <div className="flex items-center gap-1">
          <button 
            onClick={handleExportObj}
            className="bg-accent/80 text-white border-none py-[6px] px-[8px] md:px-[12px] rounded-[4px] text-[10px] md:text-[12px] font-semibold cursor-pointer hover:bg-accent transition-colors shrink-0"
          >
            OBJ
          </button>
          {!isMobile && (
            <button 
              onClick={handleExportGLTF}
              className="bg-accent/80 text-white border-none py-[6px] px-[12px] rounded-[4px] text-[12px] font-semibold cursor-pointer hover:bg-accent transition-colors shrink-0"
            >
              GLTF
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolButton({ active, onClick, icon, tooltip }: { active: boolean, onClick: () => void, icon: React.ReactNode, tooltip: string }) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`p-2 w-8 h-8 flex items-center justify-center text-[12px] rounded-[4px] cursor-default border ${active ? 'border-accent bg-[rgba(59,130,246,0.1)] text-accent' : 'border-border-dim bg-[#252525] text-text-dim hover:text-white hover:border-text-dim'}`}
    >
      {icon}
    </button>
  );
}
