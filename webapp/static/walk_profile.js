import * as THREE from 'three';
import { normalizePlayerName } from './player_name.js';

export function addPlayerNameTag(group, name) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = '28px sans-serif';
  canvas.width = Math.ceil(ctx.measureText(name).width) + 32; canvas.height = 56;
  ctx.fillStyle = '#173d35dd'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff'; ctx.font = '28px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(name, canvas.width / 2, 38);
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: true }));
  tag.name = 'player-name'; tag.userData.name = name;
  tag.position.y = 2.05; tag.scale.set(canvas.width / canvas.height * .22, .22, 1); group.add(tag);
  group.userData.playerName = name;
  return tag;
}

// The walking name is the logged-in account name: entering first person asks for the account (name and password)
// through the shop's account dialog, and walking together receives the name from a signed walk ticket.
export function createWalkProfile({ account }) {
  const positions = new Map();
  const currentName = () => (account.state.loggedIn ? normalizePlayerName(account.state.name) : null);
  function requestName({ force = false, message = '' } = {}) {
    return account.requireLogin({ force, message });
  }
  function positionKey(world) {
    return `hanyang3d-walk-position:${encodeURIComponent(currentName().toLowerCase())}:${world.alignment}`;
  }
  function readPosition(world) {
    if (!currentName()) return null;
    const key = positionKey(world);
    let raw = positions.get(key);
    if (raw === undefined) { try { raw = localStorage.getItem(key); } catch {} }
    try {
      const value = JSON.parse(raw);
      if (value.schema !== 1 || value.routeKey !== world.routeKey) return null;
      const { x, z, yaw } = value;
      if (![x, z, yaw].every(Number.isFinite) || Math.abs(x) > 30000 || Math.abs(z) > 30000) return null;
      return { x, z, yaw };
    } catch { return null; }
  }
  function savePosition(world, pose) {
    if (!currentName()) return;
    const { x, z, yaw } = pose;
    if (![x, z, yaw].every(Number.isFinite) || Math.abs(x) > 30000 || Math.abs(z) > 30000) return;
    const key = positionKey(world);
    const raw = JSON.stringify({ schema: 1, routeKey: world.routeKey, x, z, yaw: Math.atan2(Math.sin(yaw), Math.cos(yaw)) });
    if (positions.get(key) === raw) return;
    positions.set(key, raw);
    try { localStorage.setItem(key, raw); } catch {}
  }
  return { requestName, readPosition, savePosition, get name() { return currentName(); } };
}
