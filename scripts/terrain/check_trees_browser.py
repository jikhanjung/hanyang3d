"""Check woodland placement, visible-ground attachment, toggles and scene integration."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path='/home/jikhanjung/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
        headless=True, args=['--no-sandbox', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1080})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:8000/gis/terrain/3d/', wait_until='domcontentloaded')
    page.wait_for_function('window.terrain3d?.ready', timeout=300000)
    result = page.evaluate('''()=>{
      const t=terrain3d,trees=t.trees,regions={},m=t.camera.matrix.clone();
      t.renderer.setAnimationLoop(null);t.controls.enableDamping=false;
      for(const [i,r] of trees.records.entries()){
        regions[r.region]=(regions[r.region]||0)+1;
        for(const mesh of trees.group.children){mesh.getMatrixAt(i,m);if(!m.elements.every(Number.isFinite))throw Error('Invalid tree transform');}
        const water=ChannelTerrain.nearest(r.x,r.z,t.channelState.path);
        if(water.distance<water.width+r.radius+8)throw Error('Tree in water');
        for(const b of t.buildings.children)if(Math.hypot(r.x-b.position.x,r.z-b.position.z)<Math.hypot(b.userData.feature.symbol_size_m[0],b.userData.feature.symbol_size_m[2])/2+r.radius+10)throw Error('Tree in building');
        for(let j=0;j<i;j++){const q=trees.records[j];if(Math.hypot(r.x-q.x,r.z-q.z)<r.radius+q.radius+2)throw Error('Overlapping crowns');}
      }
      return {count:trees.records.length,regions,drawCalls:trees.group.children.length,houses:t.settlement.visibleCount,people:t.pedestrians.walkers.length,stages:terrainLoading.history.map(s=>s.stage)};
    }''')
    assert result['count'] > 500 and len(result['regions']) == 8, result
    assert result['drawCalls'] == 4 and result['houses'] == 2540 and result['people'] == 130, result
    assert result['stages'] == list(range(9)), result
    print(result, flush=True)

    def check_ground():
        result = page.evaluate('''async()=>{
          const T=await import('/webapp/static/vendor/three/three.module.js'),t=terrain3d,m=new T.Matrix4();
          const meshes=t.historical.material.opacity>0?[t.terrain,t.historical]:[t.terrain];
          meshes.forEach(mesh=>mesh.updateMatrixWorld(true));
          const samples=[...new Set(t.trees.records.map(r=>r.region))].map(id=>t.trees.records.findIndex(r=>r.region===id));
          let maxError=0;
          for(const i of samples){const r=t.trees.records[i],ray=new T.Raycaster(new T.Vector3(r.x,10000,r.z),new T.Vector3(0,-1,0));
            const hit=ray.intersectObjects(meshes,false)[0];if(!hit)throw Error('Tree off terrain');
            t.trees.group.getObjectByName('tree-trunks').getMatrixAt(i,m);
            const bottom=m.elements[13]-Math.abs(m.elements[5])*.5;
            maxError=Math.max(maxError,Math.abs(bottom-hit.point.y));
            if(Math.abs(m.elements[5]-r.h*.6)>.001)throw Error('Tree height exaggerated');
          }
          return {groundError:maxError};
        }''')
        assert result['groundError'] < 1, result
        print(result, flush=True)

    check_ground()
    page.evaluate('terrain3d.updateBuildingNames();terrain3d.renderer.render(terrain3d.scene,terrain3d.camera)')
    page.locator('#scene').screenshot(path='/tmp/hanyang-trees-overview.png')
    page.locator('#trees-focus').click()
    page.evaluate('terrain3d.updateBuildingNames();terrain3d.renderer.render(terrain3d.scene,terrain3d.camera)')
    page.locator('#scene').screenshot(path='/tmp/hanyang-trees-palace.png')
    page.locator('#trees3d').uncheck()
    assert page.evaluate('!terrain3d.trees.group.visible')
    page.locator('#trees3d').check()
    page.locator('#height3d').select_option('2')
    check_ground()
    page.locator('#opacity3d').fill('0')
    check_ground()
    page.locator('#carve3d').uncheck()
    check_ground()
    page.locator('#carve3d').check()
    page.locator('#opacity3d').fill('90')
    page.locator('#height3d').select_option('1')
    check_ground()
    assert not errors, errors
    print('Passed: woodland, clearances, ground, visibility, height/map/channel switches', flush=True)
    browser.close()
