import * as THREE from 'three';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';

export function createCheckerTexture(size: number = 8) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d')!;
  
  const step = 256 / size;
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      context.fillStyle = (i + j) % 2 === 0 ? '#ffffff' : '#000000';
      context.fillRect(i * step, j * step, step, step);
    }
  }
  
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createNoiseTexture(scale: number = 10, offset: number = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d')!;
  
  const imgData = context.getImageData(0, 0, 256, 256);
  const data = imgData.data;
  const perlin = new ImprovedNoise();
  
  for (let x = 0; x < 256; x++) {
    for (let y = 0; y < 256; y++) {
      const px = (x / 256) * scale;
      const py = (y / 256) * scale;
      
      // perlin base is usually -1 to 1, we map to 0 to 1
      let value = perlin.noise(px, py, offset) * 0.5 + 0.5;
      value = Math.max(0, Math.min(1, value)); // clamp just in case
      
      const c = value * 255;
      const pos = (x + y * 256) * 4;
      data[pos] = c;
      data[pos+1] = c;
      data[pos+2] = c;
      data[pos+3] = 255;
    }
  }
  
  context.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}
