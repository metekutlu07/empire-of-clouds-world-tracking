/* Empire of Clouds / Test 05 - Static world-tracked chamber, 8th Wall SLAM. */
(() => {
  const $ = (id) => document.getElementById(id);
  let xrStarted = false, sceneReady = false, trackingNormal = false;
  let scene = null, camera = null, chamber = null, chamberTexture = null, chamberMaterial = null, cameraShade = null;
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
  const ATLAS_COLS = 16, ATLAS_ROWS = Math.ceil(GLYPHS.length / ATLAS_COLS), TILE = 112;
  function makeAtlas() {
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_COLS * TILE;
    canvas.height = ATLAS_ROWS * TILE;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '60px "Noto Sans Symbols 2","Noto Sans",Arial Unicode MS,serif';
    for (let i = 0; i < GLYPHS.length; i++) {
      const col = i % ATLAS_COLS, row = Math.floor(i / ATLAS_COLS);
      const x=col*TILE+TILE/2,y=row*TILE+TILE/2+2;
      // Soft glow is baked into the atlas. The same glyph also gets a crisp core.
      ctx.shadowColor = 'rgba(255,255,255,0.92)';
      ctx.shadowBlur = 17;
      ctx.fillText(GLYPHS[i],x,y);
      ctx.shadowBlur = 7;
      ctx.fillText(GLYPHS[i],x,y);
      ctx.shadowBlur = 0;
      ctx.fillText(GLYPHS[i],x,y);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace || tex.colorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }

  // A full-view black plane at the camera draws AFTER the video but BEFORE
  // all translucent glyphs. The surrounding world is darkened by 50%,
  // while the white glyphs and grid do not receive that darkening.
  function installCameraShade() {
    const mat = new THREE.MeshBasicMaterial({
      color:0x000000, transparent:true, opacity:0.50,
      depthTest:false, depthWrite:false, side:THREE.DoubleSide
    });
    cameraShade = new THREE.Mesh(new THREE.PlaneGeometry(1,1),mat);
    cameraShade.position.set(0,0,-0.25);
    cameraShade.renderOrder = -100;
    cameraShade.frustumCulled = false;
    camera.add(cameraShade);
    updateCameraShade();
  }
  function updateCameraShade() {
    if(!cameraShade || !camera) return;
    // The XR engine controls the camera's projection matrix each frame.
    const p = camera.projectionMatrix.elements;
    if(!p[0]||!p[5]) return;
    // 0.25 is distance from camera, doubled to avoid edge gaps in portrait.
    cameraShade.scale.set(Math.abs(2*0.25/p[0])*1.04,
                          Math.abs(2*0.25/p[5])*1.04, 1);
  }

  const WIDTH=2.4, DEPTH=2.4, HEIGHT=2.3, COLS=13, ROWS=13;
  function chamberGeometry() {
    const vertices = [], uv = [], colors = [], indices = [];
    let count = 0;
    const add = (cx,cy,cz,ux,uy,uz,vx,vy,vz,ceiling) => {
      const size = ceiling ? .109 : .124;
      const corners=[-1,-1,1,-1,1,1,-1,1];
      const start=vertices.length/3;
      for(let q=0;q<4;q++) {
        const a=corners[q*2]*size/2, b=corners[q*2+1]*size/2;
        vertices.push(cx+ux*a+vx*b,cy+uy*a+vy*b,cz+uz*a+vz*b);
      }
      const cell=(count*67+13)%GLYPHS.length;
      const col=cell%ATLAS_COLS, row=Math.floor(cell/ATLAS_COLS);
      const pad=.12;
      const left=(col+pad)/ATLAS_COLS, right=(col+1-pad)/ATLAS_COLS;
      const top=1-(row+pad)/ATLAS_ROWS, bottom=1-(row+1-pad)/ATLAS_ROWS;
      uv.push(left,bottom,right,bottom,right,top,left,top);
      // Clear color hierarchy inspired by the original website:
      // chalk-white majority, luminous jade green, occasional pink.
      const tint=count%13===0?[1.0,.24,.72]:
        count%4===0?[.14,1.0,.53]:[1.0,1.0,1.0];
      for(let q=0;q<4;q++)colors.push(...tint);
      indices.push(start,start+1,start+2,start,start+2,start+3);
      count++;
    };

    // Four continuous wall panels, 13 x 13 cells each.
    for(let wall=0;wall<4;wall++) {
      for(let row=0;row<ROWS;row++)for(let col=0;col<COLS;col++) {
        if((col*11+row*7+wall*17)%19===0)continue;
        const across=(col+.5)/COLS-.5;
        const y=((row+.5)/ROWS-.5)*HEIGHT;
        if(wall===0)add(across*WIDTH,y,-DEPTH/2,1,0,0,0,1,0,false);
        if(wall===1)add(across*WIDTH,y, DEPTH/2,1,0,0,0,1,0,false);
        if(wall===2)add(-WIDTH/2,y,across*DEPTH,0,0,1,0,1,0,false);
        if(wall===3)add( WIDTH/2,y,across*DEPTH,0,0,1,0,1,0,false);
      }
    }
    // Ceiling is lighter; no floor lattice, so walking remains comfortable.
    for(let z=0;z<COLS;z++)for(let x=0;x<COLS;x++) {
      if((x*3+z*5)%4===0)continue;
      add(((x+.5)/COLS-.5)*WIDTH,HEIGHT/2,((z+.5)/COLS-.5)*DEPTH,
          1,0,0,0,0,1,true);
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    return {geo,count};
  }

  function gridGeometry() {
    const pts=[];
    const line=(a,b,c,x,y,z)=>pts.push(a,b,c,x,y,z);
    // Both directions on every vertical wall: actual square cell boundaries.
    for(let wall=0;wall<4;wall++) {
      for(let col=0;col<=COLS;col++) {
        const across=(col/COLS-.5);
        if(wall===0||wall===1) {
          const z=wall===0?-DEPTH/2:DEPTH/2;
          line(across*WIDTH,-HEIGHT/2,z,across*WIDTH,HEIGHT/2,z);
        } else {
          const x=wall===2?-WIDTH/2:WIDTH/2;
          line(x,-HEIGHT/2,across*DEPTH,x,HEIGHT/2,across*DEPTH);
        }
      }
      for(let row=0;row<=ROWS;row++) {
        const y=(row/ROWS-.5)*HEIGHT;
        if(wall===0||wall===1) {
          const z=wall===0?-DEPTH/2:DEPTH/2;
          line(-WIDTH/2,y,z,WIDTH/2,y,z);
        } else {
          const x=wall===2?-WIDTH/2:WIDTH/2;
          line(x,y,-DEPTH/2,x,y,DEPTH/2);
        }
      }
    }
    // Ceiling lattice, 13 x 13 rectangular cells.
    for(let i=0;i<=COLS;i++) {
      const x=(i/COLS-.5)*WIDTH,z=(i/COLS-.5)*DEPTH;
      line(x,HEIGHT/2,-DEPTH/2,x,HEIGHT/2,DEPTH/2);
      line(-WIDTH/2,HEIGHT/2,z,WIDTH/2,HEIGHT/2,z);
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
    return geo;
  }

  function disposeChamber() {
    if(!chamber)return;
    scene.remove(chamber);
    chamber.traverse(o=>{ if(o.geometry)o.geometry.dispose(); });
    chamber=null;
  }
  function placeChamber() {
    if(!sceneReady||!trackingNormal||!camera)return;
    disposeChamber();
    if(!chamberTexture)chamberTexture=makeAtlas();
    if(!chamberMaterial)chamberMaterial=new THREE.MeshBasicMaterial({
      map:chamberTexture,transparent:true,alphaTest:.08,side:THREE.DoubleSide,
      depthWrite:false,vertexColors:true,blending:THREE.AdditiveBlending
    });
    const {geo,count}=chamberGeometry();
    chamber=new THREE.Group();
    const lines=new THREE.LineSegments(gridGeometry(),
      new THREE.LineBasicMaterial({
        color:0xffffff,transparent:true,opacity:.25,
        depthWrite:false,depthTest:true,blending:THREE.NormalBlending
      }));
    lines.renderOrder=5;
    chamber.add(lines);
    const glyphs=new THREE.Mesh(geo,chamberMaterial);
    glyphs.renderOrder=10;
    chamber.add(glyphs);

    // Center is exactly the tracked PHONE position when placed.
    // No ground-plane hit test, no forward shift, and no continuous movement.
    chamber.position.copy(camera.position);
    const forward=new THREE.Vector3();
    camera.getWorldDirection(forward);
    chamber.rotation.y=Math.atan2(-forward.x,-forward.z);
    scene.add(chamber);
    $('instruction').textContent='Turn through the room. The GRID and GLYPHS stay fixed in space.';
    $('detail').textContent=count+' static glyphs · 13 × 13 cells per wall · 2.4 × 2.4 × 2.3 m';
    $('place').hidden=true;
    $('reset').hidden=false;
    setStatus('CHAMBER FORMED · TRACKING NORMAL');
  }
  function sceneModule() {
    return {
      name:'empire-anchor-scene',
      onStart: () => {
        ({scene,camera}=XR8.Threejs.xrScene());
        camera.position.set(0,1.6,0);
        installCameraShade();
        sceneReady=true;
        $('instruction').textContent='Move your phone slowly to let the camera map the room.';
      },
      onUpdate: ({processCpuResult}) => {
        updateCameraShade();
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
