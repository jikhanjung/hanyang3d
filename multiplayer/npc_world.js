import {createMap1907Transform} from '../webapp/static/map1907_transform.js';
import { readFileSync } from 'node:fs';
import '../webapp/static/tps.js';
import { buildWalkingRoutes, walkingRouteKey } from '../webapp/static/walking_simulation.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const experiment = read('../gis/control_points/doseong_modern_preview.json');
const manifest = read('../gis/control_points/seoul_terrain_manifest.json');
const data = read('../gis/roads/doseong_walking_routes.json');
if (data.source_sha256 !== experiment.input_sha256) throw Error('NPC routes and map source do not match');
const cache = new Map();
let live1907=null;
export async function loadSceneRoutes(url){
  if(!url)return;
  const response=await fetch(url,{headers:{Host:'localhost'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Scene route fetch failed: '+response.status);
  const value=await response.json(),config=read('../gis/control_points/seoul1907.json');
  if(value.source_sha256!==config.image_sha256||!Array.isArray(value.routes)||!value.routes.length)throw Error('Invalid live 1907 routes');
  const transform=createMap1907Transform(config,manifest.bounds_3857),routes=buildWalkingRoutes(value,transform.sourceXZ);
  if(!routes.length||routes.some(r=>!Number.isInteger(r.count)||r.count<0||r.points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.z))))throw Error('Invalid live route geometry');
  live1907=value;cache.delete('seoul1907');
}


export function npcWorld(alignment = 'mountains') {
  if (!['mountains', 'base', 'seoul1907'].includes(alignment)) throw Error('Unknown map alignment');
  if (cache.has(alignment)) return cache.get(alignment);
  if(alignment==='seoul1907'){
    const config=read('../gis/control_points/seoul1907.json'),data1907=live1907??read('../gis/roads/seoul1907_walking_routes.json');
    if(data1907.source_sha256!==config.image_sha256)throw Error('1907 routes and map source do not match');
    const transform=createMap1907Transform(config,manifest.bounds_3857),routes=buildWalkingRoutes(data1907,transform.sourceXZ);
    const world={routes,routeKey:walkingRouteKey(routes)};cache.set(alignment,world);return world;
  }
  const R = 6378137, project = (lon, lat) => [R * lon * Math.PI / 180, R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))];
  const anchors = [...experiment.landmarks, ...experiment.suggested_anchors];
  const warp = globalThis.DoseongWarp.fitTerrainTPS(anchors.map(p => p.pixel), anchors.map(p => project(p.lon, p.lat)), alignment === 'base' ? null : experiment.terrain_alignment);
  const [xmin, ymin, xmax, ymax] = manifest.bounds_3857, cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2;
  const ground = Math.cos(2 * Math.atan(Math.exp(cy / R)) - Math.PI / 2), [iw, ih] = experiment.image_size;
  // Match the browser's Float32 map mesh and its triangle interpolation exactly.
  const cols = 128, rows = 112, grid = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const [x, y] = warp(i / cols * iw, j / rows * ih);
    grid.push([Math.fround((x - cx) * ground), Math.fround(-(y - cy) * ground)]);
  }
  const sourceXZ = (px, py) => {
    const u = px / iw * cols, v = py / ih * rows, i = Math.min(cols - 1, Math.floor(u)), j = Math.min(rows - 1, Math.floor(v)), a = u - i, b = v - j;
    const k = j * (cols + 1) + i, ids = a >= b ? [k, k + 1, k + cols + 2] : [k, k + cols + 1, k + cols + 2];
    const weights = a >= b ? [1 - a, a - b, b] : [1 - b, b - a, a];
    let x = 0, z = 0;
    ids.forEach((id, c) => { x += grid[id][0] * weights[c]; z += grid[id][1] * weights[c]; });
    return { x, z };
  };
  const routes = buildWalkingRoutes(data, sourceXZ), world = { routes, routeKey: walkingRouteKey(routes) };
  cache.set(alignment, world);
  return world;
}
