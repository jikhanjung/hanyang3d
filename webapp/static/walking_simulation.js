// Pure world data and movement rules, shared by Node and the offline viewer.
export function buildWalkingRoutes(data, project) {
  return data.routes.map(route => {
    const raw = route.pixel_points.map(p => project(...p)), points = [];
    for (let i = 0; i < raw.length - 1; i++) {
      const a = raw[i], b = raw[i + 1], steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z));
      for (let j = 0; j < steps; j++) points.push({ x: a.x + (b.x - a.x) * j / steps, z: a.z + (b.z - a.z) * j / steps });
    }
    points.push({ x: raw.at(-1).x, z: raw.at(-1).z });
    let length = 0;
    points.forEach((p, i) => { if (i) length += Math.hypot(p.x - points[i-1].x, p.z - points[i-1].z); p.distance = length; });
    return { ...route, points, length };
  });
}

export function sampleWalkingRoute(route, distance) {
  const points = route.points;
  let lo = 0, hi = points.length - 1;
  while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (points[mid].distance <= distance) lo = mid; else hi = mid; }
  const a = points[lo], b = points[hi], t = (distance - a.distance) / (b.distance - a.distance || 1);
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, dx: b.x - a.x, dz: b.z - a.z, a, b };
}

// A compatibility key, not a security hash. Reject mismatched map projections.
export function walkingRouteKey(routes) {
  let hash = 2166136261;
  const text = routes.map(r => `${r.id}:${r.count}:` + r.points.map(p => `${p.x.toFixed(3)},${p.z.toFixed(3)}`).join(';')).join('|');
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}

export function createWalkingSimulation(routes) {
  let elapsed = 0;
  const walkers = routes.flatMap(route => Array.from({ length: route.count }, (_, i) => ({
    id: `${route.id}:${i}`, route, phase: (i + .35) / route.count * route.length * 2,
    speed: .8 + (i * 17 % 50) / 100, seed: i, costume: i % 2 ? 'female' : 'male',
    position: { x: 0, z: 0 }, dodge: 0,
  })));
  function step(dt = 0, avoidPoints = []) {
    dt = Math.max(0, Math.min(dt, .1)); elapsed += dt;
    for (const w of walkers) {
      const phase = (w.phase + elapsed * w.speed) % (2 * w.route.length), forward = phase <= w.route.length;
      const distance = forward ? phase : 2 * w.route.length - phase, p = sampleWalkingRoute(w.route, distance);
      const direction = forward ? 1 : -1, len = Math.hypot(p.dx, p.dz) || 1;
      const lane = .35 * direction * Math.min(1, distance / 3, (w.route.length - distance) / 3) + w.dodge;
      w.nx = -p.dz / len; w.nz = p.dx / len;
      w.position.x = p.x + w.nx * lane; w.position.z = p.z + w.nz * lane;
      w.distance = distance; w.yaw = Math.atan2(p.dx * direction, p.dz * direction);
    }
    const ease = Math.min(1, dt * 4);
    if (ease) for (const w of walkers) {
      let push = 0;
      for (const other of walkers) {
        if (other === w) continue;
        const dx = w.position.x - other.position.x, dz = w.position.z - other.position.z, dist = Math.hypot(dx, dz);
        if (dist < 1.1) push += (Math.sign(dx * w.nx + dz * w.nz) || (w.seed % 2 ? 1 : -1)) * (1.1 - dist) * 1.4;
      }
      for (const point of avoidPoints) {
        const dx = w.position.x - point.x, dz = w.position.z - point.z, dist = Math.hypot(dx, dz);
        if (dist < 2.2) push += (Math.sign(dx * w.nx + dz * w.nz) || 1) * (2.2 - dist) * 1.6;
      }
      w.dodge += (Math.max(-1.8, Math.min(1.8, push)) - w.dodge) * ease;
    }
  }
  step();
  return { walkers, step, get elapsed() { return elapsed; }, seek(time) { elapsed = time; },
    snapshot() { return walkers.map(w => [w.id, w.position.x, w.position.z, w.yaw, w.distance, w.dodge]); } };
}
