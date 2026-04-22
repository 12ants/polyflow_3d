'use client';

import { useEditorStore, ObjectType } from '@/store/useEditorStore';
import { Box, Circle, Cylinder, Triangle, CircleDashed, Mountain, Infinity as InfinityIcon, Move, MousePointer2, Lasso, Square, Hash, Magnet, TreeDeciduous } from 'lucide-react';

export function Toolbar() {
  const { 
    addObject, activeTool, setActiveTool, selectionShape, setSelectionShape,
    snappingEnabled, setSnappingEnabled, snapIncrement, setSnapIncrement,
    vertexSnappingEnabled, setVertexSnappingEnabled
  } = useEditorStore();

  return (
    <div className="w-full h-full bg-panel flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-border-dim">
        <div className="text-[10px] uppercase tracking-[1px] text-text-dim mb-3 font-semibold">Tools</div>
        <div className="grid grid-cols-2 gap-2">
          <ToolbarButton 
             icon={<Move size={16} strokeWidth={1.5} />} 
             label="Orbit" 
             active={activeTool === 'orbit'} 
             onClick={() => setActiveTool('orbit')} 
          />
          <ToolbarButton 
             icon={<MousePointer2 size={16} strokeWidth={1.5} />} 
             label="Select" 
             active={activeTool === 'select'} 
             onClick={() => setActiveTool('select')} 
          />
        </div>
        
        {activeTool === 'select' && (
          <div className="mt-3 flex gap-2 p-1 bg-[#1a1a1a] rounded-md">
            <button 
              onClick={() => setSelectionShape('box')}
              className={`flex-1 flex items-center justify-center p-1.5 rounded ${selectionShape === 'box' ? 'bg-accent text-white' : 'text-text-dim hover:text-white'}`}
              title="Box Select"
            >
              <Square size={14} />
            </button>
            <button 
              onClick={() => setSelectionShape('lasso')}
              className={`flex-1 flex items-center justify-center p-1.5 rounded ${selectionShape === 'lasso' ? 'bg-accent text-white' : 'text-text-dim hover:text-white'}`}
              title="Lasso Select"
            >
              <Lasso size={14} />
            </button>
          </div>
        )}
      </div>

      <div className="p-4 border-b border-border-dim">
        <div className="text-[10px] uppercase tracking-[1px] text-text-dim mb-3 font-semibold">Snapping</div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[12px] text-text-main">
              <Hash size={14} className={snappingEnabled ? 'text-accent' : 'text-text-dim'} />
              Grid Snap
            </div>
            <button 
              onClick={() => setSnappingEnabled(!snappingEnabled)}
              className={`w-8 h-4 rounded-full relative transition-colors ${snappingEnabled ? 'bg-accent' : 'bg-[#333]'}`}
            >
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${snappingEnabled ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[12px] text-text-main">
              <Magnet size={14} className={vertexSnappingEnabled ? 'text-accent' : 'text-text-dim'} />
              Vertex Snap
            </div>
            <button 
              onClick={() => setVertexSnappingEnabled(!vertexSnappingEnabled)}
              className={`w-8 h-4 rounded-full relative transition-colors ${vertexSnappingEnabled ? 'bg-accent' : 'bg-[#333]'}`}
            >
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${vertexSnappingEnabled ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1 mt-1">
            {[0.1, 0.5, 1.0].map((val) => (
              <button
                key={val}
                onClick={() => setSnapIncrement(val)}
                className={`py-1 text-[10px] font-mono rounded border transition-colors ${snapIncrement === val ? 'bg-accent border-accent text-white' : 'bg-[#222] border-border-dim text-text-dim hover:border-text-dim'}`}
              >
                {val.toFixed(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 border-b border-border-dim">
        <div className="text-[10px] uppercase tracking-[1px] text-text-dim mb-3 font-semibold">Primitives</div>
        <div className="grid grid-cols-2 gap-2">
          <ToolbarButton icon={<Box size={16} strokeWidth={1.5} />} label="Cube" onClick={() => addObject('box')} />
          <ToolbarButton icon={<Circle size={16} strokeWidth={1.5} />} label="Sphere" onClick={() => addObject('sphere')} />
          <ToolbarButton icon={<Cylinder size={16} strokeWidth={1.5} />} label="Cylinder" onClick={() => addObject('cylinder')} />
          <ToolbarButton icon={<Triangle size={16} strokeWidth={1.5} />} label="Cone" onClick={() => addObject('cone')} />
          <ToolbarButton icon={<CircleDashed size={16} strokeWidth={1.5} />} label="Torus" onClick={() => addObject('torus')} />
        </div>
      </div>
      
      <div className="p-4 border-b border-border-dim">
        <div className="text-[10px] uppercase tracking-[1px] text-text-dim mb-3 font-semibold">Generators</div>
        <div className="grid grid-cols-2 gap-2">
          <ToolbarButton icon={<Mountain size={16} strokeWidth={1.5} />} label="Terrain" onClick={() => addObject('terrain')} />
          <ToolbarButton icon={<InfinityIcon size={16} strokeWidth={1.5} />} label="Knot" onClick={() => addObject('torusKnot')} />
          <ToolbarButton icon={<TreeDeciduous size={16} strokeWidth={1.5} />} label="Tree" onClick={() => addObject('tree')} />
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({ icon, label, onClick, active }: { icon: React.ReactNode, label: string, onClick: () => void, active?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`bg-[#252525] border p-2 text-center rounded-[4px] text-[12px] cursor-default transition-colors flex flex-col items-center gap-1.5 ${
        active 
          ? 'border-accent text-accent bg-[rgba(59,130,246,0.1)]' 
          : 'border-border-dim text-text-main hover:border-accent hover:text-accent'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
