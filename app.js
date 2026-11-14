/* World Anchor / test 01. REAL 8th Wall SLAM; not a simulated gyro overlay. */
(() => {
  const $ = (id) => document.getElementById(id);
  let xrStarted = false, sceneReady = false, trackingNormal = false, glyph = null;
  let scene = null, camera = null;
  const setStatus = (message) => { $('tracking').textContent = message; $('tracking').classList.toggle('ready', trackingNormal); };
  const fail = (message) => { $('error').hidden = false; $('error').textContent = message; console.error(message); };
  window.addEventListener('error', e => fail(`JavaScript error: ${e.message}`));
  window.addEventListener('unhandledrejection', e => fail(`Tracking startup failed: ${e.reason?.message || e.reason}`));

  function makeGlyphTexture() {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512;
    const x = c.getContext('2d');
    x.clearRect(0,0,512,512);
    x.strokeStyle = 'rgba(220,255,235,.27)'; x.lineWidth = 4;
    x.strokeRect(44,44,424,424);
    x.strokeStyle = 'rgba(220,255,235,.15)'; x.lineWidth = 1;
    for(let i=0;i<7;i++){let v=70+i*62;x.beginPath();x.moveTo(v,40);x.lineTo(v,472);x.stroke();x.beginPath();x.moveTo(40,v);x.lineTo(472,v);x.stroke();}
    x.font = '270px serif'; x.fillStyle = '#e7fff0'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = '#66ffbc'; x.shadowBlur = 24; x.fillText('⟐',256,258);
    const t = new THREE.CanvasTexture(c); t.needsUpdate = true;
    return t;
  }
  function placeGlyph(){
    if(!sceneReady || !trackingNormal || !camera) return;
    if(glyph){scene.remove(glyph);glyph.geometry.dispose();glyph.material.map.dispose();glyph.material.dispose();}
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    glyph = new THREE.Mesh(new THREE.PlaneGeometry(0.75,0.75),new THREE.MeshBasicMaterial({map:makeGlyphTexture(),transparent:true,side:THREE.DoubleSide,depthWrite:false}));
    glyph.position.copy(camera.position).addScaledVector(direction,1.8);
    glyph.quaternion.copy(camera.quaternion); // fixed orientation at placement time, NOT updated thereafter
    scene.add(glyph);
    $('instruction').textContent='Now WALK SIDEWAYS. The glyph should stay in the same physical place.';
    $('place').hidden=true; $('reset').hidden=false;
    setStatus('ANCHOR PLACED · TRACKING '+(trackingNormal?'NORMAL':'LIMITED'));
  }
  function sceneModule(){
    return {
      name:'empire-anchor-scene',
      onStart: () => {
        ({scene, camera} = XR8.Threejs.xrScene());
        camera.position.set(0,1.6,0);
        sceneReady=true;
        $('instruction').textContent='Move the phone slowly to let the camera map the room.';
      },
      onUpdate: ({processCpuResult}) => {
        const reality = processCpuResult?.reality;
        if(!reality) return;
        const normal = reality.trackingStatus === 'NORMAL';
        if(normal !== trackingNormal){
          trackingNormal=normal;
          $('place').disabled=!trackingNormal;
          setStatus(normal?'TRACKING NORMAL · READY TO PLACE':`TRACKING ${reality.trackingStatus || 'INITIALIZING'} · ${reality.trackingReason || ''}`);
        }
      }
    };
  }
  // Size the WebGL buffer for portrait mobile before the XR engine starts.
  // The old HTML default was 300 x 150, despite full-screen CSS.
  function prepareCanvas() {
    const canvas = $('camerafeed');
    const viewport = window.visualViewport;
    const w = Math.round(viewport?.width || window.innerWidth);
    const h = Math.round(viewport?.height || window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }

  function startXR(){
    if(xrStarted) return;
    if(!window.isSecureContext){fail('HTTPS is required for camera access.');return;}
    if(!window.THREE){fail('Three.js did not load. Check network access to jsDelivr.');return;}
    if(!window.XR8){fail('8th Wall engine has not loaded. Check network access to jsDelivr and reload.');return;}
    if(!XR8.XrController || !XR8.Threejs){fail('8th Wall SLAM or Three.js module unavailable.');return;}
    xrStarted=true;
    prepareCanvas();
    $('gate').hidden = true; $('gate').style.display='none'; $('hud').hidden=false;
    try {
      XR8.XrController.configure({disableWorldTracking:false});
      XR8.addCameraPipelineModules([
        XR8.GlTextureRenderer.pipelineModule(),
        XR8.Threejs.pipelineModule(),
        XR8.XrController.pipelineModule(),
        ...(window.XRExtras?.FullWindowCanvas
          ? [XRExtras.FullWindowCanvas.pipelineModule()]
          : []),
        {
          name:'empire-camera-status',
          onCameraStatusChange: ({status}) => {
            if(status==='failed') fail('Camera failed to start. Check permissions and reload.');
            else if(status==='hasVideo') setStatus('CAMERA ACTIVE · MAPPING SPACE');
          }
        },
        sceneModule()
      ]);
      const result = XR8.run({canvas:$('camerafeed'),allowedDevices:XR8.XrConfig.device().ANY});
      if(result?.catch) result.catch(e=>fail(`XR8.run failed: ${e.message || e}`));
    } catch(e){fail(`Engine initialization failed: ${e.stack || e.message}`);}
  }
  $('start').addEventListener('click', () => {
    $('start').disabled=true; $('start').textContent='LOADING SLAM ENGINE…';
    if(window.XR8) startXR();
    else {
      window.addEventListener('xrloaded',startXR,{once:true});
      setTimeout(()=>{if(!xrStarted) { $('start').disabled=false; $('start').textContent='RETRY WORLD TRACKING'; fail('The 8th Wall engine did not become ready. Check external script access on this network.');}},15000);
    }
  });
  $('place').addEventListener('click',placeGlyph);
  $('reset').addEventListener('click',()=>{ $('reset').hidden=true; $('place').hidden=false;placeGlyph(); });
})();
