import { readFileSync } from 'node:fs';

// The expected NPC count comes from the route data baked into the image, not a fixed number.
const routes = JSON.parse(readFileSync(new URL('../gis/roads/doseong_walking_routes.json', import.meta.url), 'utf8'));
const expectedNpcs = routes.routes.reduce((count, route) => count + route.count, 0);
const response = await fetch(`http://127.0.0.1:${process.env.WALK_PORT || 2567}/healthz`, { signal: AbortSignal.timeout(3000) });
const health = await response.json();
if (!response.ok || health.status !== 'ok' || health.npcCount !== expectedNpcs ||
    (process.env.HANYANG_VERSION && health.version !== process.env.HANYANG_VERSION)) process.exit(1);
console.log(JSON.stringify(health));
