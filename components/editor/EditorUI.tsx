'use client';

import { useState, useEffect } from 'react';
import { useEditorStore } from '@/store/useEditorStore';
import { Viewport } from './Viewport';
import { Toolbar } from './Toolbar';
import { PropertiesPanel } from './PropertiesPanel';
import { Topbar } from './Topbar';
import { SceneStatsOverlay } from './SceneStatsOverlay';
import { useIsMobile } from '@/hooks/use-mobile';
import { Menu, Settings2, X, Move, RotateCcw, Scaling } from 'lucide-react';

export function EditorUI() {
  const { transformMode, setTransformMode, undo, redo, past, future } = useEditorStore();
  const isMobile = useIsMobile();
  const [showToolbar, setShowToolbar] = useState(false);
  const [showProps, setShowProps] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  return (
    <div className="flex flex-col w-full h-full bg-app text-text-main font-sans overflow-hidden">
      <Topbar />
      
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Toolbar (Tools & Primitives) */}
        {!isMobile ? (
          <div className="w-[220px] border-r border-border-dim overflow-hidden">
            <Toolbar />
          </div>
        ) : (
          showToolbar && (
            <div className="absolute inset-y-0 left-0 z-50 w-[240px] bg-panel border-r border-border-dim flex flex-col animate-in slide-in-from-left duration-200">
              <div className="flex justify-end p-2 border-b border-border-dim">
                <button onClick={() => setShowToolbar(false)} className="p-2 text-text-dim hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <Toolbar />
              </div>
            </div>
          )
        )}
        
        {/* Center Viewport (3D Canvas) */}
        <div className="flex-1 relative viewport-bg overflow-hidden">
          <SceneStatsOverlay />
          <Viewport />
          
          {/* Mobile Overlay Controls */}
          {isMobile && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-40">
              <div className="flex bg-panel border border-border-dim rounded-full p-1 shadow-2xl">
                <button 
                  onClick={() => {
                    setShowToolbar(true);
                    setShowProps(false);
                  }}
                  className={`p-3 rounded-full hover:bg-[#333] transition-colors ${showToolbar ? 'text-accent' : 'text-text-dim'}`}
                >
                  <Menu size={20} />
                </button>
                
                <div className="w-[1px] bg-border-dim mx-1" />
                
                <button onClick={() => setTransformMode('translate')} className={`p-3 rounded-full transition-colors ${transformMode === 'translate' ? 'text-accent bg-accent/10' : 'text-text-dim'}`}><Move size={20} /></button>
                <button onClick={() => setTransformMode('rotate')} className={`p-3 rounded-full transition-colors ${transformMode === 'rotate' ? 'text-accent bg-accent/10' : 'text-text-dim'}`}><RotateCcw size={20} /></button>
                <button onClick={() => setTransformMode('scale')} className={`p-3 rounded-full transition-colors ${transformMode === 'scale' ? 'text-accent bg-accent/10' : 'text-text-dim'}`}><Scaling size={20} /></button>
                
                <div className="w-[1px] bg-border-dim mx-1" />

                <button 
                  onClick={() => {
                    setShowProps(true);
                    setShowToolbar(false);
                  }}
                  className={`p-3 rounded-full hover:bg-[#333] transition-colors ${showProps ? 'text-accent' : 'text-text-dim'}`}
                >
                  <Settings2 size={20} />
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Right Properties Panel */}
        {!isMobile ? (
          <div className="w-[260px] bg-panel border-l border-border-dim flex flex-col items-stretch overflow-y-auto">
            <PropertiesPanel />
          </div>
        ) : (
          showProps && (
            <div className="absolute inset-y-0 right-0 z-50 w-[280px] bg-panel border-l border-border-dim flex flex-col animate-in slide-in-from-right duration-200">
               <div className="flex justify-start p-2 border-b border-border-dim">
                <button onClick={() => setShowProps(false)} className="p-2 text-text-dim hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <PropertiesPanel />
              </div>
            </div>
          )
        )}

        {/* Backdrop for mobile overlays */}
        {isMobile && (showToolbar || showProps) && (
          <div 
            className="absolute inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
            onClick={() => {
              setShowToolbar(false);
              setShowProps(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
