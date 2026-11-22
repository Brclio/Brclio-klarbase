// The saved map holds { pos:{x, z, t}, explored:['cx,cz', ...] } (MAX 2000 chunks).
import { readProgress, writeProgress } from '../progress-storage.js';

const MAX = 2000;
export const loadMap = () => {
  const m = readProgress('map');
  if(!m || typeof m !== 'object') return { pos:null, explored:[], extra:{} };
  const { pos, explored, ...extra } = m;
  return { pos:pos && Number.isFinite(pos.x) && Number.isFinite(pos.z) ? { x:pos.x | 0, z:pos.z | 0, t:+pos.t || 0 } : null, explored:Array.isArray(explored) ? explored.filter(s => typeof s === 'string') : [], extra };
};
export function saveMap(pos, explored, extra = {}){
  const list = [...explored].slice(-MAX);
  writeProgress('map', { ...extra, pos:{ x:pos.x, z:pos.z, t:Date.now() }, explored:list });
}
