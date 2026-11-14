/* Empire of Clouds / Test 03 - Static world-tracked chamber, 8th Wall SLAM. */
(() => {
  const $ = (id) => document.getElementById(id);
  let xrStarted = false, sceneReady = false, trackingNormal = false;
  let scene = null, camera = null, chamber = null, chamberTexture = null, chamberMaterial = null;
  const GLYPHS = [
    "⸜","⸝","⸠","⸡","⸢","⸣","⸤","⸥","⸦","⸧","⸨","⸩","⸪","⸫","⸬","⸭","⸮","ⸯ",
    "⸰","⸱","⸲","⸳","⸴","⸵","⸶","⸷","⸸","⸹","⸺","⸻",
    "※","⁂","⁑","⁕","⁜","⁘","⁙","⁚","⁛","⁝",
    "⟆","⟇","⟈","⟉","⟊","⟋","⟌","⟍","⟎","⟏",
    "⧖","⧗","⧘","⧙","⧚","⧛","⧜","⧝","⧞","⧟",
    "⧠","⧡","⧢","⧣","⧤","⧥","⧦","⧧","⧨","⧩",
    "Ⳁ","ⳁ","Ⳃ","ⳃ","Ⳅ","ⳅ","Ⳇ","ⳇ","Ⳉ","ⳉ",
    "Ⳋ","ⳋ","Ⳍ","ⳍ","Ⳏ","ⳏ","Ⳑ","ⳑ","Ⳓ","ⳓ",
    "Ⳕ","ⳕ","Ⳗ","ⳗ","Ⳙ","ⳙ","Ⳛ","ⳛ","Ⳝ","ⳝ",
    "꙳","꙰","꙱","꙲","ꙴ","ꙵ","ꙶ","ꙷ","ꙸ","ꙹ","ꙺ","ꙻ","꙼","꙽","꙾","ꙿ",
    "⟐","⟑","⟒","⟓","⟔","⟕","⟖","⟗","⟘","⟙",
    "∴","∵","∷","∺","∻","∽","≋","≈",
    "⟜","⟝","⟞","⟟","⟠","⟡","⟢","⟣",
    "⍜","⍝","⍞","⍟","⍠","⍡","⍢","⍣","⍤","⍥","⍦","⍧","⍨","⍩","⍪","⍫","⍬","⍭","⍮","⍯"
  ];
  const setStatus = (message) => {
    $('tracking').textContent = message;
    $('tracking').classList.toggle('ready', trackingNormal);
  };
  const fail = (message) => {
    $('error').hidden = false; $('error').textContent = message; console.error(message);
  };
  window.addEventListener('error', e => fail('JavaScript error: ' + e.message));
  window.addEventListener('unhandledrejection', e => fail('Tracking startup failed: ' + (e.reason?.message || e.reason)));

  // A texture atlas means hundreds of symbols can share one material and one draw call.
  // Their symbols stay STATIC: no animation, shader motion or camera-facing billboards.
  const ATLAS_COLS = 16, ATLAS_ROWS = Math.ceil(GLYPHS.length / ATLAS_COLS), TILE = 80;
  function makeAtlas() {
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_COLS * TILE;
    canvas.height = ATLAS_ROWS * TILE;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#e6ffef';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '49px "Noto Sans Symbols 2","Noto Sans",Arial Unicode MS,serif';
    for (let i = 0; i < GLYPHS.length; i++) {
      const col = i % ATLAS_COLS, row = Math.floor(i / ATLAS_COLS);
      ctx.fillText(GLYPHS[i], col * TILE + TILE / 2, row * TILE + TILE / 2 + 2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace || tex.colorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }

  function chamberGeometry() {
    const vertices = [], uv = [], colors = [], indices = [];
    const W = 3.4, H = 2.7, D = 3.4;
    let count = 0;
    // Geometry is centered on the phone's place of activation, not updated each frame.
    // 4 walls: 12 columns x 9 rows. Ceiling: 12 x 12. No floor, for clear movement.
    const add = (cx,cy,cz,ux,uy,uz,vx,vy,vz,k) => {
      const size = k === 0 ? 0.115 : 0.105;
      const corners = [-1,-1, 1,-1, 1,1, -1,1];
      const start = vertices.length / 3;
      for(let q=0;q<4;q++) {
        const a = corners[q*2]*size/2, b = corners[q*2+1]*size/2;
        vertices.push(cx+ux*a+vx*b,cy+uy*a+vy*b,cz+uz*a+vz*b);
      }
      // Deterministic choice: lattice is stable across all frames and sessions.
      const cell = (count * 67 + 13) % GLYPHS.length;
      const col=cell%ATLAS_COLS, row=Math.floor(cell/ATLAS_COLS);
      const pad=.12;
      const left=(col+pad)/ATLAS_COLS, right=(col+1-pad)/ATLAS_COLS;
      const top=1-(row+pad)/ATLAS_ROWS, bottom=1-(row+1-pad)/ATLAS_ROWS;
      uv.push(left,bottom,right,bottom,right,top,left,top);
      // 80% chalk-white, some dim green and very rare mint signals.
      const tint = count % 23 === 0 ? [0.45,1,0.75] :
                   count % 6 === 0 ? [0.48,0.62,0.58] : [0.85,0.98,0.91];
      for(let q=0;q<4;q++) colors.push(...tint);
      indices.push(start,start+1,start+2,start,start+2,start+3);
      count++;
    };
    for(let wall=0;wall<4;wall++) {
      for(let row=0;row<9;row++) for(let col=0;col<12;col++) {
        // Sparse predictable gaps for visual breathing room, not moving noise.
        if((col*11+row*7+wall*17)%19===0) continue;
        const across = (col+.5)/12-.5;
        const y=(row+.5)/9*H-H/2;
        if(wall===0) add(across*W,y,-D/2,1,0,0,0,1,0,0);
        if(wall===1) add(across*W,y,D/2,1,0,0,0,1,0,0);
        if(wall===2) add(-W/2,y,across*D,0,0,1,0,1,0,0);
        if(wall===3) add(W/2,y,across*D,0,0,1,0,1,0,0);
      }
    }
    // A lighter ceiling, explicitly leaving the floor open.
    for(let z=0;z<10;z++) for(let x=0;x<10;x++) {
      if((x*3+z*5)%4===0) continue;
      add(((x+.5)/10-.5)*W,H/2,((z+.5)/10-.5)*D,1,0,0,0,0,1,1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    return {geo,count,W,H,D};
  }
  function placeChamber() {
    if(!sceneReady || !trackingNormal || !camera) return;
    if(chamber) {
      scene.remove(chamber);
      chamber.geometry.dispose();
      chamber = null;
    }
    if(!chamberTexture) chamberTexture=makeAtlas();
    if(!chamberMaterial) chamberMaterial=new THREE.MeshBasicMaterial({
      map:chamberTexture,transparent:true,alphaTest:.08,side:THREE.DoubleSide,
      depthWrite:false,vertexColors:true,blending:THREE.AdditiveBlending
    });
    const {geo,count,W,H,D}=chamberGeometry();
    chamber=new THREE.Mesh(geo,chamberMaterial);
    // Camera is INSIDE; room is created around the user at their current location.
    // Fixed world-space transform: never copied from camera in onUpdate.
    chamber.position.copy(camera.position);
    // Place ceiling roughly 1.35m above the phone and floor 1.35m below it.
    const forward=new THREE.Vector3();
    camera.getWorldDirection(forward);
    const yaw=Math.atan2(-forward.x,-forward.z);
    chamber.rotation.y=yaw;
    scene.add(chamber);
    $('instruction').textContent='Turn slowly, then step sideways. You are INSIDE a fixed cubic lattice.';
    $('detail').textContent=count+' static glyphs · '+W+'m × '+D+'m × '+H+'m · four walls and ceiling';
    $('place').hidden=true; $('reset').hidden=false;
    setStatus('CHAMBER FORMED · TRACKING NORMAL');
  }
  function sceneModule() {
    return {
      name:'empire-anchor-scene',
      onStart: () => {
        ({scene,camera}=XR8.Threejs.xrScene());
        camera.position.set(0,1.6,0);
        sceneReady=true;
        $('instruction').textContent='Move your phone slowly to let the camera map the room.';
      },
      onUpdate: ({processCpuResult}) => {
        const reality=processCpuResult?.reality;
        if(!reality) return;
        const normal=reality.trackingStatus==='NORMAL';
        if(normal!==trackingNormal) {
          trackingNormal=normal;
          $('place').disabled=!normal;
          $('reset').disabled=!normal;
          setStatus(normal?'TRACKING NORMAL · READY TO FORM CHAMBER':
            'TRACKING '+(reality.trackingStatus||'INITIALIZING')+' · '+(reality.trackingReason||''));
        }
      }
    };
  }
  function prepareCanvas() {
    const canvas=$('camerafeed'), viewport=window.visualViewport;
    const w=Math.round(viewport?.width||window.innerWidth);
    const h=Math.round(viewport?.height||window.innerHeight);
    const dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.style.width=w+'px';canvas.style.height=h+'px';
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  }
  function startXR() {
    if(xrStarted) return;
    if(!window.isSecureContext){fail('HTTPS is required for camera access.');return;}
    if(!window.THREE){fail('Three.js did not load. Check your connection.');return;}
    if(!window.XR8){fail('8th Wall engine has not loaded. Reload and try again.');return;}
    if(!XR8.XrController||!XR8.Threejs){fail('8th Wall SLAM or Three.js module unavailable.');return;}
    xrStarted=true;
    prepareCanvas();
    $('gate').hidden=true;$('gate').style.display='none';$('hud').hidden=false;
    try{
      XR8.XrController.configure({disableWorldTracking:false});
      XR8.addCameraPipelineModules([
        XR8.GlTextureRenderer.pipelineModule(),
        XR8.Threejs.pipelineModule(),
        XR8.XrController.pipelineModule(),
        ...(window.XRExtras?.FullWindowCanvas?[XRExtras.FullWindowCanvas.pipelineModule()]:[]),
        {name:'empire-camera-status',onCameraStatusChange:({status})=>{
          if(status==='failed')fail('Camera failed to start. Check permissions.');
          else if(status==='hasVideo')setStatus('CAMERA ACTIVE · MAPPING SPACE');
        }},
        sceneModule()
      ]);
      const result=XR8.run({canvas:$('camerafeed'),allowedDevices:XR8.XrConfig.device().ANY});
      if(result?.catch)result.catch(e=>fail('XR8.run failed: '+(e.message||e)));
    }catch(e){fail('Engine initialization failed: '+(e.stack||e.message));}
  }
  $('start').addEventListener('click',()=>{
    $('start').disabled=true;$('start').textContent='LOADING SLAM ENGINE…';
    if(window.XR8)startXR();
    else{
      window.addEventListener('xrloaded',startXR,{once:true});
      setTimeout(()=>{if(!xrStarted){$('start').disabled=false;$('start').textContent='RETRY WORLD TRACKING';fail('8th Wall engine did not become ready.');}},15000);
    }
  });
  $('place').addEventListener('click',placeChamber);
  $('reset').addEventListener('click',placeChamber);
})();
