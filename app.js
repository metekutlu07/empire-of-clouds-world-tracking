/* Empire of Clouds / Test 06 - Portal world-tracked chamber, 8th Wall SLAM. */
(() => {
  const $ = (id) => document.getElementById(id);
  let xrStarted = false, sceneReady = false, trackingNormal = false;
  let scene = null, camera = null, chamber = null, chamberTexture = null, chamberMaterial = null, cameraShade = null;
  let portalOpen = false, glyphMesh = null, gridMesh = null, portalFrame = null;
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
  // all translucent glyphs. The surrounding world is darkened by 70%,
  // while the white glyphs and grid do not receive that darkening.
  function installCameraShade() {
    const mat = new THREE.MeshBasicMaterial({
      color:0x000000, transparent:true, opacity:0.70,
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
  // Front wall is wall 0, facing the visitor on placement. Opening respects full cells.
  const PORTAL = {colStart:4,colEnd:8,rowStart:0,rowEnd:9};
  const inPortal = (wall,row,col) => wall===0 && col>=PORTAL.colStart && col<=PORTAL.colEnd && row>=PORTAL.rowStart && row<=PORTAL.rowEnd;
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
        if((col*11+row*7+wall*17)%19===0 || (portalOpen && inPortal(wall,row,col)))continue;
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
    const pts=[], seen=new Set();
    // Build individual cell boundaries, ensuring that portal cells have no interior
    // grid lines. Borders adjacent to the opening remain as the clean door jambs.
    const edge=(a,b)=>{
      const ka=a.map(n=>n.toFixed(5)).join(',');
      const kb=b.map(n=>n.toFixed(5)).join(',');
      const key=ka<kb?ka+'|'+kb:kb+'|'+ka;
      if(seen.has(key))return;
      seen.add(key);pts.push(...a,...b);
    };
    for(let wall=0;wall<4;wall++)for(let row=0;row<ROWS;row++)for(let col=0;col<COLS;col++){
      if(portalOpen&&inPortal(wall,row,col))continue;
      const u0=col/COLS-.5,u1=(col+1)/COLS-.5;
      const y0=(row/ROWS-.5)*HEIGHT,y1=((row+1)/ROWS-.5)*HEIGHT;
      const point=(u,y)=>wall===0?[u*WIDTH,y,-DEPTH/2]:
        wall===1?[u*WIDTH,y,DEPTH/2]:
        wall===2?[-WIDTH/2,y,u*DEPTH]:[WIDTH/2,y,u*DEPTH];
      const a=point(u0,y0),b=point(u1,y0),c=point(u1,y1),d=point(u0,y1);
      edge(a,b);edge(b,c);edge(c,d);edge(d,a);
    }
    for(let z=0;z<COLS;z++)for(let x=0;x<COLS;x++){
      const x0=(x/COLS-.5)*WIDTH,x1=((x+1)/COLS-.5)*WIDTH;
      const z0=(z/COLS-.5)*DEPTH,z1=((z+1)/COLS-.5)*DEPTH;
      const a=[x0,HEIGHT/2,z0],b=[x1,HEIGHT/2,z0];
      const c=[x1,HEIGHT/2,z1],d=[x0,HEIGHT/2,z1];
      edge(a,b);edge(b,c);edge(c,d);edge(d,a);
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
    return geo;
  }
  // Combined tube geometry makes the outer silhouette noticeably brighter while
  // retaining the thin internal white grid. Outer halo is translucent mint-white.
  function makeBeam(start,end,radius,color,opacity){
    const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),axis=b.clone().sub(a);
    const mesh=new THREE.Mesh(
      new THREE.CylinderGeometry(radius,radius,axis.length(),5,1),
      new THREE.MeshBasicMaterial({color,transparent:true,opacity,
        depthWrite:false,blending:THREE.AdditiveBlending}));
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize());
    return mesh;
  }
  function addFrame(group,segments,coreRadius=.006,haloRadius=.028){
    for(const [a,b] of segments){
      group.add(makeBeam(a,b,haloRadius,0x70ffcc,.13));
      group.add(makeBeam(a,b,coreRadius,0xe3fff1,.83));
    }
  }
  function addCubeFrame(parent){
    const x=WIDTH/2,y=HEIGHT/2,z=DEPTH/2;
    const seg=[];
    for(const xx of [-x,x])for(const zz of [-z,z])seg.push([[xx,-y,zz],[xx,y,zz]]);
    for(const yy of [-y,y]){
      for(const zz of [-z,z])seg.push([[-x,yy,zz],[x,yy,zz]]);
      for(const xx of [-x,x])seg.push([[xx,yy,-z],[xx,yy,z]]);
    }
    const group=new THREE.Group();addFrame(group,seg);
    parent.add(group);
  }
  function addPortalFrame(parent){
    if(!portalOpen)return;
    const left=(PORTAL.colStart/COLS-.5)*WIDTH;
    const right=((PORTAL.colEnd+1)/COLS-.5)*WIDTH;
    const bottom=-HEIGHT/2;
    const top=((PORTAL.rowEnd+1)/ROWS-.5)*HEIGHT;
    const z=-DEPTH/2-.008;
    portalFrame=new THREE.Group();
    addFrame(portalFrame,[
      [[left,bottom,z],[left,top,z]],[[left,top,z],[right,top,z]],
      [[right,top,z],[right,bottom,z]]
    ],.006,.024);
    parent.add(portalFrame);
  }
  function rebuildChamberContent(){
    if(!chamber)return;
    if(glyphMesh){chamber.remove(glyphMesh);glyphMesh.geometry.dispose();}
    if(gridMesh){chamber.remove(gridMesh);gridMesh.geometry.dispose();gridMesh.material.dispose();}
    if(portalFrame){
      chamber.remove(portalFrame);
      portalFrame.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});
      portalFrame=null;
    }
    const {geo,count}=chamberGeometry();
    gridMesh=new THREE.LineSegments(gridGeometry(),new THREE.LineBasicMaterial({
      color:0xffffff,transparent:true,opacity:.25,
      depthWrite:false,depthTest:true
    }));
    gridMesh.renderOrder=5;chamber.add(gridMesh);
    glyphMesh=new THREE.Mesh(geo,chamberMaterial);
    glyphMesh.renderOrder=10;chamber.add(glyphMesh);
    addPortalFrame(chamber);
    $('detail').textContent=count+' static glyphs · 13 × 13 cells per wall · 2.4 × 2.4 × 2.3 m';
  }

  function disposeChamber(){
    if(!chamber)return;
    scene.remove(chamber);
    chamber.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&&o.material!==chamberMaterial)o.material.dispose();});
    chamber=null;glyphMesh=null;gridMesh=null;portalFrame=null;
  }
  function placeChamber(){
    if(!sceneReady||!trackingNormal||!camera)return;
    $('portalPrompt').hidden=true;
    portalOpen=false;
    disposeChamber();
    if(!chamberTexture)chamberTexture=makeAtlas();
    if(!chamberMaterial)chamberMaterial=new THREE.MeshBasicMaterial({
      map:chamberTexture,transparent:true,alphaTest:.08,side:THREE.DoubleSide,
      depthWrite:false,vertexColors:true,blending:THREE.AdditiveBlending
    });
    chamber=new THREE.Group();
    rebuildChamberContent();
    addCubeFrame(chamber);
    // Use the tracked phone pose at placement. The front wall is local -Z.
    chamber.position.copy(camera.position);
    const forward=new THREE.Vector3();
    camera.getWorldDirection(forward);
    chamber.rotation.y=Math.atan2(-forward.x,-forward.z);
    scene.add(chamber);
    $('instruction').textContent='Turn inside the luminous chamber.';
    $('place').hidden=true;$('reset').hidden=false;
    $('portalPrompt').hidden=false;
    setStatus('CHAMBER FORMED · TRACKING NORMAL');
  }
  function openPortal(){
    if(!chamber||portalOpen)return;
    portalOpen=true;
    rebuildChamberContent();
    $('portalPrompt').hidden=true;
    $('instruction').textContent='PORTAL OPEN · A passage has appeared in the front wall.';
    setStatus('PORTAL OPEN · TRACKING NORMAL');
  }
  $('portalYes').addEventListener('click',openPortal);
  $('portalNo').addEventListener('click',()=>{
    $('portalPrompt').hidden=true;
    $('instruction').textContent='The matrix remains closed. You can re-form the chamber.';
  });
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
