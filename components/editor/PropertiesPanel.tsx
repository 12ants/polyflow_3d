'use client';

import { useEditorStore } from '@/store/useEditorStore';

export function PropertiesPanel() {
  const { 
    objects, selectedId, selectObject, updateObject, 
    editMode, softSelectionEnabled, setSoftSelectionEnabled, 
    softSelectionRadius, setSoftSelectionRadius 
  } = useEditorStore();
  
  const selectedObj = objects.find(o => o.id === selectedId);

  const handleVectorChange = (property: 'position' | 'rotation' | 'scale', index: 0|1|2, value: string) => {
    if (!selectedObj) return;
    const num = parseFloat(value);
    if (isNaN(num)) return;
    
    const newVec = [...selectedObj[property]] as [number, number, number];
    
    // For rotation, convert slider degrees to radians
    if (property === 'rotation') {
        newVec[index] = num * (Math.PI / 180);
    } else {
        newVec[index] = num;
    }
    
    updateObject(selectedObj.id, { [property]: newVec });
  };

  return (
    <div className="flex flex-col flex-1">
      {/* Scene Tree */}
      <div className="p-4 border-b border-border-dim">
        <div className="text-[10px] uppercase tracking-[1px] text-text-dim mb-3 font-semibold">Scene Tree</div>
        <div className="flex flex-col gap-1">
          {objects.length === 0 && <div className="text-[12px] text-text-dim px-3">Empty Scene</div>}
          {objects.map((obj) => (
            <div 
              key={obj.id}
              onClick={() => selectObject(obj.id)}
              className={`flex items-center px-3 py-1.5 text-[12px] cursor-pointer transition-colors ${
                obj.id === selectedId 
                   ? 'bg-[rgba(59,130,246,0.15)] text-white border-l-2 border-accent' 
                   : 'text-[#bbb] hover:bg-[#222] border-l-2 border-transparent'
              }`}
            >
              {obj.name}
            </div>
          ))}
        </div>
      </div>

      {(editMode === 'vertex' || editMode === 'edge') && selectedObj && (
         <div className="p-4 border-b border-border-dim">
            <div className="text-[10px] uppercase tracking-[1px] text-text-dim mb-3 font-semibold">
              {editMode === 'vertex' ? 'Vertex Editing' : 'Edge Editing'}
            </div>
            <div className="flex items-center justify-between mb-4">
               <span className="text-[12px] text-text-main">Soft Selection</span>
               <button 
                  onClick={() => setSoftSelectionEnabled(!softSelectionEnabled)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${softSelectionEnabled ? 'bg-accent' : 'bg-[#333]'}`}
               >
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${softSelectionEnabled ? 'right-1' : 'left-1'}`} />
               </button>
            </div>
            {softSelectionEnabled && (
               <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-text-dim">Influence Radius</label>
                    <span className="text-[11px] font-mono text-white">{softSelectionRadius.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min={0.1} 
                    max={10} 
                    step={0.1} 
                    value={softSelectionRadius}
                    onChange={(e) => setSoftSelectionRadius(parseFloat(e.target.value))}
                    className="w-full accent-accent bg-[#333] h-1.5 rounded-full appearance-none cursor-pointer"
                  />
               </div>
            )}
         </div>
      )}

      {selectedObj ? (
        <>
          {/* Color Selector */}
          <div className="p-4 border-b border-border-dim">
            <div className="text-[10px] uppercase tracking-[1px] text-text-dim mb-3 font-semibold">Appearance</div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {[
                  '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', 
                  '#8b5cf6', '#ec4899', '#f8fafc', '#94a3b8', '#0f172a'
                ].map((c) => (
                  <button
                    key={c}
                    onClick={() => updateObject(selectedObj.id, { color: c })}
                    className={`w-5 h-5 rounded-sm border transition-all ${
                      selectedObj.color.toLowerCase() === c.toLowerCase() 
                        ? 'border-white scale-110 shadow-sm' 
                        : 'border-white/10 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
                <div className="relative w-5 h-5 group">
                  <div className="w-full h-full rounded-sm border border-white/20 bg-gradient-to-tr from-red-500 via-green-500 to-blue-500" />
                  <input 
                    type="color" 
                    value={selectedObj.color}
                    onChange={(e) => updateObject(selectedObj.id, { color: e.target.value })}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="Custom Color"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between bg-[#1a1a1a] h-7 px-2 rounded border border-border-dim/30">
                <span className="text-[10px] font-mono text-text-dim uppercase">Hex code</span>
                <span className="text-[10px] font-mono text-accent uppercase select-all">{selectedObj.color}</span>
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-border-dim">
            <div className="text-[10px] uppercase tracking-[1px] text-text-dim mb-3 font-semibold">Transform</div>
            
            <div className="flex flex-col gap-0">
              <VectorInputGroup 
                label="Position" 
                values={selectedObj.position} 
                onChange={(idx, val) => handleVectorChange('position', idx, val)} 
                step={0.1}
              />
    
              <div className="h-3"></div>
    
              <VectorInputGroup 
                label="Rotation X" 
                values={[selectedObj.rotation[0] * (180 / Math.PI)]} 
                singleAxis={0}
                onChange={(idx, val) => handleVectorChange('rotation', idx, val)}
                step={1}
              />
              <VectorInputGroup 
                label="Rotation Y" 
                values={[selectedObj.rotation[1] * (180 / Math.PI)]} 
                singleAxis={1}
                onChange={(idx, val) => handleVectorChange('rotation', idx, val)}
                step={1}
              />
              <VectorInputGroup 
                label="Rotation Z" 
                values={[selectedObj.rotation[2] * (180 / Math.PI)]} 
                singleAxis={2}
                onChange={(idx, val) => handleVectorChange('rotation', idx, val)}
                step={1}
              />
    
              <div className="h-3"></div>
    
              <VectorInputGroup 
                label="Scale" 
                values={selectedObj.scale} 
                onChange={(idx, val) => handleVectorChange('scale', idx, val)}
                step={0.1}
              />
            </div>
          </div>
    
          {/* Procedural Generation Settings */}
          {selectedObj.type === 'terrain' && (
             <div className="p-4 border-b border-border-dim">
               <div className="text-[10px] uppercase tracking-[1px] text-text-dim mb-3 font-semibold">Terrain Props</div>
               <ParamSlider label="Subdivisions" objId={selectedObj.id} params={selectedObj.params} paramKey="segments" value={selectedObj.params?.segments || 16} min={1} max={128} step={1} />
               <ParamSlider label="Amplitude" objId={selectedObj.id} params={selectedObj.params} paramKey="amplitude" value={selectedObj.params?.amplitude || 1} min={0} max={10} step={0.1} />
               <ParamSlider label="Noise Scale" objId={selectedObj.id} params={selectedObj.params} paramKey="scale" value={selectedObj.params?.scale || 0.5} min={0.01} max={5} step={0.01} />
             </div>
          )}
          {selectedObj.type === 'torusKnot' && (
             <div className="p-4 border-b border-border-dim">
               <div className="text-[10px] uppercase tracking-[1px] text-text-dim mb-3 font-semibold">Knot Props</div>
               <ParamSlider label="P (Windings)" objId={selectedObj.id} params={selectedObj.params} paramKey="p" value={selectedObj.params?.p || 2} min={1} max={20} step={1} />
               <ParamSlider label="Q (Turns)" objId={selectedObj.id} params={selectedObj.params} paramKey="q" value={selectedObj.params?.q || 3} min={1} max={20} step={1} />
               <ParamSlider label="Radius" objId={selectedObj.id} params={selectedObj.params} paramKey="radius" value={selectedObj.params?.radius || 0.5} min={0.1} max={5} step={0.1} />
               <ParamSlider label="Tube" objId={selectedObj.id} params={selectedObj.params} paramKey="tube" value={selectedObj.params?.tube || 0.15} min={0.01} max={2} step={0.01} />
             </div>
          )}
    
          {selectedObj.type !== 'imported' && (
            <div className="p-4 flex flex-col flex-1">
              <div className="text-[10px] uppercase tracking-[1px] text-text-dim mb-3 font-semibold">Material</div>
              
              <select 
                value={selectedObj.materialType || 'solid'} 
                onChange={(e) => updateObject(selectedObj.id, { materialType: e.target.value as any })}
                className="w-full bg-[#252525] border border-border-dim text-white text-[12px] p-2 rounded-[4px] mb-4 outline-none focus:border-accent"
              >
                 <option value="solid">Solid Color</option>
                 <option value="checker">Procedural Checker</option>
                 <option value="noise">Procedural Noise</option>
              </select>

              {selectedObj.materialType && selectedObj.materialType !== 'solid' && (
                 <div className="mb-4">
                   <ParamSlider 
                      label="Texture Scale" 
                      objId={selectedObj.id} 
                      paramKey="scale" 
                      isMaterialParam 
                      params={selectedObj.materialParams}
                      value={selectedObj.materialParams?.scale || 8} 
                      min={1} 
                      max={64} 
                      step={1} 
                   />
                 </div>
              )}

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                     <span className="text-[11px] text-text-dim">Roughness</span>
                     <span className="text-[11px] font-mono text-white">{selectedObj.roughness.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" max="1" step="0.01" 
                    value={selectedObj.roughness} 
                    onChange={(e) => updateObject(selectedObj.id, { roughness: parseFloat(e.target.value) })}
                    className="w-full accent-accent bg-[#333] h-1.5 rounded-full appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                     <span className="text-[11px] text-text-dim">Metalness</span>
                     <span className="text-[11px] font-mono text-white">{selectedObj.metalness.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" max="1" step="0.01" 
                    value={selectedObj.metalness} 
                    onChange={(e) => updateObject(selectedObj.id, { metalness: parseFloat(e.target.value) })}
                    className="w-full accent-accent bg-[#333] h-1.5 rounded-full appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                     <span className="text-[11px] text-text-dim">Reflectivity</span>
                     <span className="text-[11px] font-mono text-white">{selectedObj.reflectivity.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" max="1" step="0.01" 
                    value={selectedObj.reflectivity} 
                    onChange={(e) => updateObject(selectedObj.id, { reflectivity: parseFloat(e.target.value) })}
                    className="w-full accent-accent bg-[#333] h-1.5 rounded-full appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-text-dim text-[12px] p-4 text-center">
          Select an object to edit its properties
        </div>
      )}
    </div>
  );
}

function ParamSlider({ label, objId, paramKey, params, isMaterialParam, value, min, max, step }: any) {
  const { updateObject } = useEditorStore();
  
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] text-text-dim">{label}</label>
        <span className="text-[11px] font-mono text-white">{Number(value).toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        step={step} 
        value={value}
        onChange={(e) => {
          const val = parseFloat(e.target.value);
          if (isMaterialParam) {
            updateObject(objId, { materialParams: { ...params, [paramKey]: val } });
          } else {
            updateObject(objId, { params: { ...params, [paramKey]: val }, vertexOffsets: {} });
          }
        }}
        className="w-full accent-accent bg-[#333] h-1.5 rounded-full appearance-none cursor-pointer"
      />
    </div>
  );
}

function VectorInputGroup({ 
  label, 
  values, 
  singleAxis,
  onChange,
  step = 1
}: { 
  label: string; 
  values: number[]; 
  singleAxis?: 0|1|2;
  onChange: (index: 0|1|2, value: string) => void;
  step?: number;
}) {
  const axes = ['X', 'Y', 'Z'];

  return (
    <>
      {values.map((v, i) => {
        const actualIndex = singleAxis !== undefined ? singleAxis : i;
        const displayLabel = singleAxis !== undefined ? label : `${label} ${axes[i]}`;
        
        return (
          <div key={i} className="flex items-center mb-2 text-[12px]">
            <span className="flex-1 text-text-dim">{displayLabel}</span>
            <input 
              type="number"
              value={v === 0 ? "0" : Number(v.toFixed(3))}
              step={step}
              onChange={(e) => onChange(actualIndex as 0|1|2, e.target.value)}
              className="w-[60px] bg-app border border-border-dim text-white py-[2px] px-[4px] font-mono text-[11px] rounded-[2px]"
            />
          </div>
        )
      })}
    </>
  );
}
