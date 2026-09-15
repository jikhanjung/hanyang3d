const response = await fetch(`http://127.0.0.1:${process.env.WALK_PORT || 2567}/healthz`, { signal: AbortSignal.timeout(3000) });
const health = await response.json();
if (!response.ok || health.status !== 'ok' || health.npcCount !== 130 ||
    (process.env.HANYANG_VERSION && health.version !== process.env.HANYANG_VERSION)) process.exit(1);
console.log(JSON.stringify(health));
