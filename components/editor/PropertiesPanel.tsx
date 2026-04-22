'use client';

import { useState, ReactNode } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import { ChevronDown, RefreshCcw } from 'lucide-react';

function CollapsibleSection({ title, children, defaultOpen = true }: { title: string, children: ReactNode, defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border-dim">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-panel hover:bg-[#252525] transition-colors"
      >
        <div className="text-[10px] uppercase tracking-[1px] text-text-dim font-semibold">{title}</div>
        <ChevronDown size={14} className={`text-text-dim transition-transform ${isOpen ? '' : '-rotate-90'}`} />
      </button>
      {isOpen && (
        <div className="p-4 pt-0">
          {children}
        </div>
      )}
    </div>
  );
}

export function PropertiesPanel() {
  const { 
    objects, selectedId, selectObject, updateObject, 
    editMode, softSelectionEnabled, setSoftSelectionEnabled, 
    softSelectionRadius, setSoftSelectionRadius,
    gridColor, setGridColor, triggerCameraReset
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
      <CollapsibleSection title="Scene Tree" defaultOpen={true}>
        <div className="flex flex-col gap-1 -mt-2">
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
      </CollapsibleSection>

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
          {selectedObj.type !== 'tree' && (
            <CollapsibleSection title="Appearance">
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
            </CollapsibleSection>
          )}

          <CollapsibleSection title="Transform">
            
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
          </CollapsibleSection>
    
          {/* Procedural Generation Settings */}
          {selectedObj.type === 'terrain' && (
             <CollapsibleSection title="Terrain Props">
               <ParamSlider label="Subdivisions" objId={selectedObj.id} params={selectedObj.params} paramKey="segments" value={selectedObj.params?.segments || 16} min={1} max={128} step={1} />
               <ParamSlider label="Amplitude" objId={selectedObj.id} params={selectedObj.params} paramKey="amplitude" value={selectedObj.params?.amplitude || 1} min={0} max={10} step={0.1} />
               <ParamSlider label="Noise Scale" objId={selectedObj.id} params={selectedObj.params} paramKey="scale" value={selectedObj.params?.scale || 0.5} min={0.01} max={5} step={0.01} />
             </CollapsibleSection>
          )}
          {selectedObj.type === 'torusKnot' && (
             <CollapsibleSection title="Knot Props">
               <ParamSlider label="P (Windings)" objId={selectedObj.id} params={selectedObj.params} paramKey="p" value={selectedObj.params?.p || 2} min={1} max={20} step={1} />
               <ParamSlider label="Q (Turns)" objId={selectedObj.id} params={selectedObj.params} paramKey="q" value={selectedObj.params?.q || 3} min={1} max={20} step={1} />
               <ParamSlider label="Radius" objId={selectedObj.id} params={selectedObj.params} paramKey="radius" value={selectedObj.params?.radius || 0.5} min={0.1} max={5} step={0.1} />
               <ParamSlider label="Tube" objId={selectedObj.id} params={selectedObj.params} paramKey="tube" value={selectedObj.params?.tube || 0.15} min={0.01} max={2} step={0.01} />
             </CollapsibleSection>
          )}
          {selectedObj.type === 'tree' && (
             <CollapsibleSection title="Tree Props">
               
               <div className="mb-4">
                 <div className="text-[11px] text-text-dim mb-2">Preset</div>
                 <select 
                   value={selectedObj.params?.preset || 'default'} 
                   onChange={(e) => {
                     const preset = e.target.value;
                     let newParams = { ...selectedObj.params, preset };
                     if (preset === 'oak') {
                        newParams = { 
                          ...newParams, 
                          levels: 4, height: 3, branchFactor: 3, angle: 0.6, 
                          foliageSize: 0.6, trunkThickness: 0.1, taper: 0.7, randomness: 0.3,
                          branchColor: '#4d2d11', foliageColor: '#2d5a27'
                        };
                     } else if (preset === 'pine') {
                        newParams = { 
                          ...newParams, 
                          levels: 5, height: 5, branchFactor: 2, angle: 0.3, 
                          foliageSize: 0.4, trunkThickness: 0.08, taper: 0.5, randomness: 0.1,
                          branchColor: '#2b1b0e', foliageColor: '#1d3a1a'
                        };
                     } else if (preset === 'baobab') {
                        newParams = { 
                          ...newParams, 
                          levels: 3, height: 2, branchFactor: 4, angle: 0.8, 
                          foliageSize: 0.3, trunkThickness: 0.3, taper: 0.8, randomness: 0.2,
                          branchColor: '#3d2b1f', foliageColor: '#4d6d3d'
                        };
                     } else if (preset === 'birch') {
                        newParams = { 
                          ...newParams, 
                          levels: 4, height: 4, branchFactor: 2, angle: 0.4, 
                          foliageSize: 0.4, trunkThickness: 0.05, taper: 0.7, randomness: 0.1,
                          branchColor: '#f0f0f0', foliageColor: '#7ba05b'
                        };
                     } else if (preset === 'willow') {
                        newParams = { 
                          ...newParams, 
                          levels: 4, height: 3, branchFactor: 3, angle: 1.2, 
                          foliageSize: 0.5, trunkThickness: 0.07, taper: 0.75, randomness: 0.4,
                          branchColor: '#36302a', foliageColor: '#a8b87d', foliageAnimate: true
                        };
                     } else if (preset === 'apple') {
                        newParams = { 
                          ...newParams, 
                          levels: 4, height: 2.5, branchFactor: 3, angle: 0.7, 
                          foliageSize: 0.5, trunkThickness: 0.1, taper: 0.75, randomness: 0.2,
                          branchColor: '#4d2d11', foliageColor: '#4e7a27', foliageFruit: true, foliageType: 'cloud'
                        };
                     } else if (preset === 'winter_pine') {
                        newParams = { 
                          ...newParams, 
                          levels: 5, height: 5, branchFactor: 2, angle: 0.3, 
                          foliageSize: 0.4, trunkThickness: 0.08, taper: 0.5, randomness: 0.1,
                          branchColor: '#2b1b0e', foliageColor: '#1d3a1a', foliageSnow: true
                        };
                     } else if (preset === 'sakura') {
                        newParams = { 
                          ...newParams, 
                          levels: 4, height: 3, branchFactor: 3, angle: 0.7, 
                          foliageSize: 0.6, trunkThickness: 0.1, taper: 0.7, randomness: 0.3,
                          branchColor: '#4d3011', foliageColor: '#ffb7c5', foliageType: 'cloud', foliageDensity: 1.5, foliageAnimate: true
                        };
                     } else if (preset === 'palm') {
                        newParams = { 
                          ...newParams, 
                          levels: 1, height: 6, branchFactor: 8, angle: 0.7, 
                          foliageSize: 1.2, trunkThickness: 0.15, taper: 0.9, randomness: 0.05,
                          branchColor: '#5c4033', foliageColor: '#458b00', foliageCross: true, foliageDensity: 1.5, foliageOffset: 0.5
                        };
                     } else if (preset === 'default') {
                        newParams = { 
                          ...newParams, 
                          levels: 3, height: 2, branchFactor: 2, angle: 0.5, 
                          foliageSize: 0.5, trunkThickness: 0.05, taper: 0.7, randomness: 0.2,
                          branchColor: '#4d2d11', foliageColor: '#2d5a27'
                        };
                     }
                     updateObject(selectedObj.id, { params: newParams });
                   }}
                   className="w-full bg-[#252525] border border-border-dim text-white text-[12px] p-2 rounded-[4px] outline-none focus:border-accent"
                 >
                   <option value="default">Default</option>
                   <option value="oak">Oak (Spread)</option>
                   <option value="pine">Pine (Tall)</option>
                   <option value="baobab">Baobab (Thick)</option>
                   <option value="birch">Birch (White)</option>
                   <option value="willow">Willow (Drooping)</option>
                   <option value="apple">Apple Tree (Fruit)</option>
                   <option value="winter_pine">Winter Pine (Snow)</option>
                   <option value="sakura">Sakura (Cloudy)</option>
                   <option value="palm">Palm (Tropical)</option>
                 </select>
               </div>

               <div className="space-y-4 mb-4 pt-2 border-t border-border-dim/50">
                 <div className="text-[10px] uppercase tracking-[1px] text-text-dim font-semibold mb-2">Colors</div>
                 <ParamColor label="Branch" objId={selectedObj.id} params={selectedObj.params} paramKey="branchColor" value={selectedObj.params?.branchColor || '#4d2d11'} />
                 <ParamColor label="Foliage" objId={selectedObj.id} params={selectedObj.params} paramKey="foliageColor" value={selectedObj.params?.foliageColor || '#2d5a27'} />
               </div>

               <div className="space-y-4 mb-4 pt-2 border-t border-border-dim/50">
                 <div className="text-[10px] uppercase tracking-[1px] text-text-dim font-semibold mb-2">Population</div>
                 <ParamSlider label="Tree Count" objId={selectedObj.id} params={selectedObj.params} paramKey="count" value={selectedObj.params?.count || 1} min={1} max={50} step={1} />
                 <ParamSlider label="Spread Radius" objId={selectedObj.id} params={selectedObj.params} paramKey="spread" value={selectedObj.params?.spread || 2} min={0} max={20} step={0.5} />
                 <div className="mb-2">
                   <div className="text-[11px] text-text-dim mb-2">Forest Layout</div>
                   <select 
                     value={selectedObj.params?.distribution || 'random'} 
                     onChange={(e) => updateObject(selectedObj.id, { params: { ...selectedObj.params, distribution: e.target.value } })}
                     className="w-full bg-[#252525] border border-border-dim text-white text-[12px] p-2 rounded-[4px] outline-none focus:border-accent"
                   >
                     <option value="random">Random Clusters</option>
                     <option value="grid">Ordered Grid</option>
                     <option value="circle">Circular Grove</option>
                   </select>
                 </div>
               </div>

               <div className="space-y-4 mb-4 pt-2 border-t border-border-dim/50">
                 <div className="text-[10px] uppercase tracking-[1px] text-text-dim font-semibold mb-2">Structure</div>
                 <ParamSlider label="Complexity (Levels)" objId={selectedObj.id} params={selectedObj.params} paramKey="levels" value={selectedObj.params?.levels || 3} min={1} max={6} step={1} />
                 <ParamSlider label="Initial Height" objId={selectedObj.id} params={selectedObj.params} paramKey="height" value={selectedObj.params?.height || 2} min={0.5} max={10} step={0.1} />
                 <ParamSlider label="Branch Angle" objId={selectedObj.id} params={selectedObj.params} paramKey="angle" value={selectedObj.params?.angle || 0.5} min={0.1} max={Math.PI / 2} step={0.05} />
                 <ParamSlider label="Gnarliness" objId={selectedObj.id} params={selectedObj.params} paramKey="gnarl" value={selectedObj.params?.gnarl || 0} min={0} max={1} step={0.05} />
                 <ParamSlider label="Branch Factor" objId={selectedObj.id} params={selectedObj.params} paramKey="branchFactor" value={selectedObj.params?.branchFactor || 2} min={1} max={8} step={1} />
                 <ParamSlider label="Trunk Thickness" objId={selectedObj.id} params={selectedObj.params} paramKey="trunkThickness" value={selectedObj.params?.trunkThickness || 0.05} min={0.01} max={0.5} step={0.01} />
                 <ParamSlider label="Taper Ratio" objId={selectedObj.id} params={selectedObj.params} paramKey="taper" value={selectedObj.params?.taper || 0.7} min={0.2} max={0.9} step={0.05} />
                 <ParamSlider label="Randomness" objId={selectedObj.id} params={selectedObj.params} paramKey="randomness" value={selectedObj.params?.randomness || 0.2} min={0} max={1} step={0.05} />
                 <ParamSlider label="Seed" objId={selectedObj.id} params={selectedObj.params} paramKey="seed" value={selectedObj.params?.seed || 123} min={0} max={10000} step={1} />
               </div>
               
               <div className="space-y-4 pt-2 border-t border-border-dim/50">
                 <div className="text-[10px] uppercase tracking-[1px] text-text-dim font-semibold mb-2">Foliage</div>
                 <div className="flex items-center justify-between mb-2">
                   <span className="text-[11px] text-text-dim">Enabled</span>
                   <button 
                     onClick={() => updateObject(selectedObj.id, { params: { ...selectedObj.params, foliage: !selectedObj.params?.foliage } })}
                     className={`w-8 h-4 rounded-full relative transition-colors ${selectedObj.params?.foliage ? 'bg-accent' : 'bg-[#333]'}`}
                   >
                     <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${selectedObj.params?.foliage ? 'right-0.5' : 'left-0.5'}`} />
                   </button>
                 </div>
                 
                 {selectedObj.params?.foliage && (
                   <>
                     <div className="mb-4">
                       <div className="text-[11px] text-text-dim mb-2">Foliage Style</div>
                       <select 
                         value={selectedObj.params?.foliageType || 'quad'} 
                         onChange={(e) => updateObject(selectedObj.id, { params: { ...selectedObj.params, foliageType: e.target.value } })}
                         className="w-full bg-[#252525] border border-border-dim text-white text-[12px] p-2 rounded-[4px] outline-none focus:border-accent"
                       >
                         <option value="quad">Quad (Sharp)</option>
                         <option value="cloud">Cloud (Soft)</option>
                         <option value="box">Voxel (Boxy)</option>
                         <option value="realistic">Realistic (Volume)</option>
                       </select>
                     </div>
                     <ParamSlider label="Size" objId={selectedObj.id} params={selectedObj.params} paramKey="foliageSize" value={selectedObj.params?.foliageSize || 0.5} min={0.1} max={3} step={0.1} />
                     <ParamSlider label="Density" objId={selectedObj.id} params={selectedObj.params} paramKey="foliageDensity" value={selectedObj.params?.foliageDensity || 1} min={0.1} max={5} step={0.1} />
                     <ParamSlider label="Leaf Position Offset" objId={selectedObj.id} params={selectedObj.params} paramKey="foliageOffset" value={selectedObj.params?.foliageOffset || 0} min={-2} max={2} step={0.1} />
                     <ParamSlider label="Color Variance" objId={selectedObj.id} params={selectedObj.params} paramKey="foliageJitter" value={selectedObj.params?.foliageJitter || 0.2} min={0} max={1} step={0.05} />
                     
                     <div className="space-y-3 py-2">
                       <div className="flex items-center justify-between">
                         <span className="text-[11px] text-text-dim">Fruit Bearing</span>
                         <button 
                           onClick={() => updateObject(selectedObj.id, { params: { ...selectedObj.params, foliageFruit: !selectedObj.params?.foliageFruit } })}
                           className={`w-8 h-4 rounded-full relative transition-colors ${selectedObj.params?.foliageFruit ? 'bg-accent' : 'bg-[#333]'}`}
                         >
                           <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${selectedObj.params?.foliageFruit ? 'right-0.5' : 'left-0.5'}`} />
                         </button>
                       </div>
                       
                       <div className="flex items-center justify-between">
                         <span className="text-[11px] text-text-dim">Snow Covered</span>
                         <button 
                           onClick={() => updateObject(selectedObj.id, { params: { ...selectedObj.params, foliageSnow: !selectedObj.params?.foliageSnow } })}
                           className={`w-8 h-4 rounded-full relative transition-colors ${selectedObj.params?.foliageSnow ? 'bg-white' : 'bg-[#333]'}`}
                         >
                           <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${selectedObj.params?.foliageSnow ? 'right-0.5 bg-accent shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'left-0.5'}`} />
                         </button>
                       </div>

                       <div className="flex items-center justify-between">
                         <span className="text-[11px] text-text-dim">Breeze Animation</span>
                         <button 
                           onClick={() => updateObject(selectedObj.id, { params: { ...selectedObj.params, foliageAnimate: !selectedObj.params?.foliageAnimate } })}
                           className={`w-8 h-4 rounded-full relative transition-colors ${selectedObj.params?.foliageAnimate ? 'bg-accent' : 'bg-[#333]'}`}
                         >
                           <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${selectedObj.params?.foliageAnimate ? 'right-0.5' : 'left-0.5'}`} />
                         </button>
                       </div>
                       {selectedObj.params?.foliageAnimate && (
                         <ParamSlider label="Sway Intensity" objId={selectedObj.id} params={selectedObj.params} paramKey="windSpeed" value={selectedObj.params?.windSpeed || 1.0} min={0} max={5} step={0.1} />
                       )}

                       <div className="flex items-center justify-between">
                         <span className="text-[11px] text-text-dim">Volumetric (Cross-Quad)</span>
                         <button 
                           onClick={() => updateObject(selectedObj.id, { params: { ...selectedObj.params, foliageCross: !selectedObj.params?.foliageCross } })}
                           className={`w-8 h-4 rounded-full relative transition-colors ${selectedObj.params?.foliageCross ? 'bg-accent' : 'bg-[#333]'}`}
                         >
                           <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${selectedObj.params?.foliageCross ? 'right-0.5' : 'left-0.5'}`} />
                         </button>
                       </div>
                     </div>
                   </>
                 )}
               </div>
             </CollapsibleSection>
          )}
    
          {selectedObj.type !== 'imported' && (
            <CollapsibleSection title="Material">
              
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
            </CollapsibleSection>
          )}
        </>
      ) : (
        <div className="flex-1 flex flex-col">
          <CollapsibleSection title="Scene Settings">
            <div className="space-y-4">
              <div>
                <div className="text-[11px] text-text-dim mb-2">Grid Color</div>
                <div className="flex items-center gap-2">
                  <input 
                    type="color" 
                    value={gridColor}
                    onChange={(e) => setGridColor(e.target.value)}
                    className="w-8 h-8 rounded border-none p-0 cursor-pointer bg-transparent"
                  />
                  <span className="text-[11px] font-mono text-white">{gridColor}</span>
                </div>
              </div>

              <div>
                <div className="text-[11px] text-text-dim mb-2">Camera</div>
                <button 
                  onClick={triggerCameraReset}
                  className="w-full flex items-center justify-center gap-2 bg-[#252525] hover:bg-[#333] text-white text-[11px] uppercase tracking-wider py-2 rounded transition-colors border border-border-dim/50"
                >
                  <RefreshCcw size={14} />
                  Reset Camera
                </button>
              </div>
            </div>
          </CollapsibleSection>
          <div className="flex-1 flex items-center justify-center text-text-dim text-[12px] p-4 text-center mt-10">
            Select an object to edit its properties
          </div>
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

function ParamColor({ label, objId, paramKey, params, value }: any) {
  const { updateObject } = useEditorStore();

  return (
    <div className="flex items-center justify-between">
      <label className="text-[11px] text-text-dim">{label}</label>
      <div className="flex items-center gap-2">
        <input 
          type="color"
          value={value}
          onChange={(e) => updateObject(objId, { params: { ...params, [paramKey]: e.target.value } })}
          className="w-6 h-6 rounded overflow-hidden border-none p-0 cursor-pointer bg-transparent"
        />
        <input 
          type="text" 
          value={value} 
          onChange={(e) => updateObject(objId, { params: { ...params, [paramKey]: e.target.value } })}
          className="bg-app border border-border-dim text-white text-[10px] font-mono p-1 w-16 rounded outline-none focus:border-accent"
        />
      </div>
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
