/* Empire of Clouds / Test 07 - Prelude and Portal world-tracked chamber, 8th Wall SLAM. */
(() => {
  const $ = (id) => document.getElementById(id);
  let xrStarted = false, startRequested = false, sceneReady = false, trackingNormal = false;
  let scene = null, camera = null, chamber = null, chamberTexture = null, chamberMaterial = null, cameraShade = null;
  let portalOpen = false, glyphMesh = null, gridMesh = null, portalFrame = null;
  let miniCube = null, stage = 'tracking', miniStart = 0, oracleTarget = null;
  let activeRaycaster = null, voiceToken=0;
  const BOOKS=['Eastern Winds','Cosmic Cryptography','Pigment Turbulence','The Crystal Matrix','Synthetic Minds'];
  let bookGroup=null,bookPath=null,bookMixer=null,bookDuration=0,bookIndex=0,
      bookOpening=false,bookOpened=false,bookStart=0,bookSerial=0,bookLoader=null;
  let preloadedBook=null,preloadPromise=null;
  // Test 20: a second, volumetric matrix between the opened threshold and Book I.
  let lattice=null,latticeTarget=null,latticeGlow=null,latticeTimer=null;

  const LINES = {
    enter:'你准备好进入矩阵了吗？',
    clouds:'云会思考吗？',
    yes:'也许，思想本身就是一片云。',
    no:'那么，是谁在向你提问？'
  };
  function stopVoice(){
    voiceToken++;
    if('speechSynthesis' in window)window.speechSynthesis.cancel();
  }
  // Test voice uses on-device Mandarin TTS. Replace with authored audio files later.
  function speak(text,done){
    const token=++voiceToken;
    if(!window.speechSynthesis || !window.SpeechSynthesisUtterance){
      if(done)done(); return;
    }
    window.speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    u.lang='zh-CN';u.rate=.79;u.pitch=.77;
    const zh=window.speechSynthesis.getVoices().filter(v=>/^zh/i.test(v.lang));
    if(zh.length)u.voice=zh.find(v=>/zh-CN/i.test(v.lang))||zh[0];
    let completed=false;
    const finish=()=>{if(!completed&&token===voiceToken){completed=true;if(done)done();}};
    u.onend=finish;u.onerror=finish;
    window.speechSynthesis.speak(u);
    // Guard against browsers never emitting onend or blocking speech.
    setTimeout(finish,Math.max(5500,text.length*500));
  }
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
    $('tracking').classList.toggle('issue',/LIMITED|FAILED|ERROR|INITIALIZING|MAPPING|LOADING/i.test(message));
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

  const WIDTH=2.4, DEPTH=2.4, HEIGHT=2.3, COLS=15, ROWS=15;
  // Front wall is wall 0, facing the visitor on placement. Opening respects full cells.
  const PORTAL = {colStart:5,colEnd:10,rowStart:0,rowEnd:11};
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

    // Four continuous wall panels, 15 x 15 cells each.
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
    if(glyphMesh){unregisterFadingGlyphs(glyphMesh);chamber.remove(glyphMesh);glyphMesh.geometry.dispose();}
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
    glyphMesh=registerFadingGlyphs(new THREE.Mesh(geo,chamberMaterial));
    glyphMesh.renderOrder=10;chamber.add(glyphMesh);
    addPortalFrame(chamber);
    $('detail').textContent=count+' static glyphs · 15 × 15 cells per wall · 2.4 × 2.4 × 2.3 m';
  }


  function clearStageTimer(){}
  function setPrompt(title, note, yes, no){
    $('portalTitle').textContent=title;
    $('portalNote').textContent=note||'';
    // Chinese is the primary choice; English is a smaller supporting label.
    for(const [id,label] of [['portalYes',yes],['portalNo',no]]){
      const btn=$(id);
      btn.replaceChildren();
      const primary=document.createElement('span');
      primary.className='answerZh';
      primary.textContent=label;
      btn.append(primary);
    }
    $('portalPrompt').hidden=false;
  }
  function hidePrompt(){ $('portalPrompt').hidden=true; }


  function disposeLattice(){
    if(latticeTimer){clearTimeout(latticeTimer);latticeTimer=null;}
    if(!lattice)return;
    if(scene)scene.remove(lattice);
    lattice.traverse(o=>{
      unregisterFadingGlyphs(o);
      if(o.geometry)o.geometry.dispose();
      if(o.material && o.material!==chamberMaterial)o.material.dispose();
    });
    lattice=null;latticeTarget=null;latticeGlow=null;
  }


  // Test 21: triple horizontal samples in both X and Z, with 70% of the
  // previous cell spacing. One indexed mesh keeps the mobile draw count low.
  const LATTICE_X=18, LATTICE_Y=18, LATTICE_Z=18;
  const LATTICE_STEP_X=.40*.70, LATTICE_STEP_Y=.16, LATTICE_STEP_Z=.40*.70;

  // Each glyph fades independently. No per-glyph meshes or timers: a single
  // dynamic vertex-color buffer is refreshed at a modest rate on mobile.
  const fadingMeshes=new Set();
  function registerFadingGlyphs(mesh){
    if(!mesh?.geometry?.getAttribute('color'))return mesh;
    const colors=mesh.geometry.getAttribute('color');
    const base=new Float32Array(colors.array);
    const count=Math.floor(colors.count/4);
    const phases=new Float32Array(count);
    const speeds=new Float32Array(count);
    for(let i=0;i<count;i++){
      phases[i]=(i*.61803398875%1)*Math.PI*2;
      speeds[i]=.55+((i*37)%101)/101*.75;
    }
    mesh.userData.fadeData={base,phases,speeds,colors,count};
    fadingMeshes.add(mesh);
    return mesh;
  }
  function unregisterFadingGlyphs(mesh){
    if(mesh)fadingMeshes.delete(mesh);
  }
  let lastFadeUpdate=0;
  function animateFadingGlyphs(now){
    if(now-lastFadeUpdate<67)return;
    lastFadeUpdate=now;
    const seconds=now*.001;
    for(const mesh of fadingMeshes){
      if(!mesh.parent||!mesh.visible)continue;
      const f=mesh.userData.fadeData;
      if(!f)continue;
      const dest=f.colors.array;
      for(let i=0;i<f.count;i++){
        const wave=.5+.5*Math.sin(seconds*f.speeds[i]+f.phases[i]);
        // Smooth emergence and disappearance, but never all glyphs at once.
        const eased=wave*wave*(3-2*wave);
        const fade=.025+.975*eased;
        const offset=i*12;
        for(let k=0;k<12;k++)dest[offset+k]=f.base[offset+k]*fade;
      }
      f.colors.needsUpdate=true;
    }
  }


  // Scene-wide transitions are separate from each glyph's existing pulse.
  const sceneTransitions=[];
  function setGroupAlpha(group,alpha){
    group.userData.sceneAlpha=alpha;
    group.traverse(o=>{
      if(!o.material)return;
      const materials=Array.isArray(o.material)?o.material:[o.material];
      for(const m of materials){
        if(m.userData.sceneBaseOpacity===undefined)m.userData.sceneBaseOpacity=m.opacity;
        m.transparent=true;
        m.opacity=m.userData.sceneBaseOpacity*alpha;
        m.needsUpdate=true;
      }
    });
  }
  function transitionGroup(group,from,to,duration,onDone,scaleFrom,scaleTo){
    if(!group)return;
    // All meshes in a scene get their own materials, so the shared glyph
    // atlas material used by another stage cannot be dimmed accidentally.
    group.traverse(o=>{
      if(!o.material||o.userData.sceneMaterialCloned)return;
      o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();
      o.userData.sceneMaterialCloned=true;
    });
    sceneTransitions.push({group,from,to,duration,onDone,elapsed:0,
      scaleFrom:scaleFrom??1,scaleTo:scaleTo??1,baseScale:group.scale.clone()});
    setGroupAlpha(group,from);
    group.scale.copy(group.scale.clone().multiplyScalar(scaleFrom??1));
  }
  let lastSceneNow=performance.now();
  function updateSceneTransitions(now){
    const dt=Math.min(.08,Math.max(0,(now-lastSceneNow)/1000));lastSceneNow=now;
    for(let i=sceneTransitions.length-1;i>=0;i--){
      const tr=sceneTransitions[i];
      tr.elapsed+=dt;
      const t=Math.min(1,tr.elapsed/tr.duration);
      const ease=t*t*(3-2*t);
      setGroupAlpha(tr.group,tr.from+(tr.to-tr.from)*ease);
      tr.group.scale.copy(tr.baseScale).multiplyScalar(tr.scaleFrom+(tr.scaleTo-tr.scaleFrom)*ease);
      if(t>=1){
        sceneTransitions.splice(i,1);
        if(tr.onDone)tr.onDone();
      }
    }
    updateCipherMovement(dt);
  }
  function glyphCoordsFromIndex(glyphIndex){
    const cell=glyphIndex%GLYPHS.length;
    const col=cell%ATLAS_COLS,row=Math.floor(cell/ATLAS_COLS);
    const pad=.12;
    return [(col+pad)/ATLAS_COLS,(col+1-pad)/ATLAS_COLS,
      1-(row+pad)/ATLAS_ROWS,1-(row+1-pad)/ATLAS_ROWS];
  }
  function substituteGlyphs(mesh,number){
    const uv=mesh?.geometry?.getAttribute('uv');
    if(!uv)return;
    const n=Math.floor(uv.count/4);
    for(let i=0;i<number;i++){
      const g=Math.floor(Math.random()*n),[l,r,t,b]=glyphCoordsFromIndex(Math.random()*GLYPHS.length|0);
      const p=g*4;
      uv.setXY(p,l,b);uv.setXY(p+1,r,b);
      uv.setXY(p+2,r,t);uv.setXY(p+3,l,t);
    }
    uv.needsUpdate=true;
  }
  // Three selected horizontal belts circulate across the four wall faces,
  // crossing corners in discrete one-cell steps while the underlying grid stays fixed.
  const cipherBelts=[2,7,11];
  let miniCipherClock=0,latticeCipherClock=0,wallCipherClock=0;
  function circulateWallBands(){
    if(!glyphMesh||portalOpen)return;
    const uv=glyphMesh.geometry.getAttribute('uv');
    const pos=glyphMesh.geometry.getAttribute('position');
    const rows=[[],[],[]];
    const num=Math.floor(pos.count/4);
    for(let i=0;i<num;i++){
      const p=i*4;
      let x=0,y=0,z=0;
      for(let q=0;q<4;q++){x+=pos.getX(p+q)/4;y+=pos.getY(p+q)/4;z+=pos.getZ(p+q)/4;}
      const row=Math.floor((y/HEIGHT+.5)*ROWS);
      const belt=cipherBelts.indexOf(row);
      if(belt<0)continue;
      // Ignore ceiling glyphs and map every wall to a continuous ring.
      let order=-1;
      if(Math.abs(z+DEPTH/2)<.005)order=(x/WIDTH+.5)*COLS;
      else if(Math.abs(x-WIDTH/2)<.005)order=COLS+(z/DEPTH+.5)*COLS;
      else if(Math.abs(z-DEPTH/2)<.005)order=2*COLS+(1-(x/WIDTH+.5))*COLS;
      else if(Math.abs(x+WIDTH/2)<.005)order=3*COLS+(1-(z/DEPTH+.5))*COLS;
      if(order>=0)rows[belt].push({p,order});
    }
    for(let b=0;b<rows.length;b++){
      const cells=rows[b].sort((a,b)=>a.order-b.order);
      if(cells.length<2)continue;
      const saved=cells.map(({p})=>Array.from({length:4},(_,q)=>[uv.getX(p+q),uv.getY(p+q)]));
      const dir=b%2?1:-1;
      cells.forEach(({p},i)=>{
        const source=saved[(i-dir+cells.length)%cells.length];
        for(let q=0;q<4;q++)uv.setXY(p+q,...source[q]);
      });
    }
    uv.needsUpdate=true;
  }
  function updateCipherMovement(dt){
    if(stage==='mini'||stage==='ready'){
      miniCipherClock+=dt;
      if(miniCipherClock>.65){miniCipherClock=0;substituteGlyphs(miniCube?.children.find(o=>o.isMesh),3);}
    } else if(stage==='chamber'){
      wallCipherClock+=dt;
      if(wallCipherClock>1.27){wallCipherClock=0;circulateWallBands();}
    } else if(stage==='lattice'){
      latticeCipherClock+=dt;
      if(latticeCipherClock>.45){
        latticeCipherClock=0;
        substituteGlyphs(lattice?.children.find(o=>o.isMesh&&o.userData.fadeData),14);
      }
    }
  }
  function buildLatticeGlyphs(){
    const positions=[],uvs=[],colors=[],indices=[];
    let index=0;
    for(let z=0;z<LATTICE_Z;z++)
      for(let y=0;y<LATTICE_Y;y++)
        for(let x=0;x<LATTICE_X;x++){
          const px=(x-(LATTICE_X-1)/2)*LATTICE_STEP_X;
          const py=(y-(LATTICE_Y-1)/2)*LATTICE_STEP_Y;
          const pz=(z-(LATTICE_Z-1)/2)*LATTICE_STEP_Z;
          // Leave a small breathing space around the visitor's face.
          if(Math.abs(px)<.20&&Math.abs(py)<.18&&Math.abs(pz)<.20)continue;
          const cell=(x*31+y*53+z*17+11)%GLYPHS.length;
          const col=cell%ATLAS_COLS,row=Math.floor(cell/ATLAS_COLS);
          const pad=.14;
          const l=(col+pad)/ATLAS_COLS,r=(col+1-pad)/ATLAS_COLS;
          const top=1-(row+pad)/ATLAS_ROWS,bottom=1-(row+1-pad)/ATLAS_ROWS;
          const size=.108;
          const vert=positions.length/3;
          positions.push(
            px-size/2,py-size/2,pz,px+size/2,py-size/2,pz,
            px+size/2,py+size/2,pz,px-size/2,py+size/2,pz
          );
          uvs.push(l,bottom,r,bottom,r,top,l,top);
          const tint=index%15===0?[1,.30,.74]:index%4===0?[.25,1,.60]:[1,1,1];
          for(let k=0;k<4;k++)colors.push(...tint);
          indices.push(vert,vert+1,vert+2,vert,vert+2,vert+3);
          index++;
        }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    const mesh=new THREE.Mesh(geo,chamberMaterial);
    mesh.renderOrder=10;
    return registerFadingGlyphs(mesh);
  }

  function buildLatticeLines(){
    const pts=[];
    const minX=-(LATTICE_X-1)/2*LATTICE_STEP_X, maxX=-minX;
    const minY=-(LATTICE_Y-1)/2*LATTICE_STEP_Y, maxY=-minY;
    const minZ=-(LATTICE_Z-1)/2*LATTICE_STEP_Z, maxZ=-minZ;
    for(let x=0;x<LATTICE_X;x++)for(let y=0;y<LATTICE_Y;y++){
      const xx=minX+x*LATTICE_STEP_X,yy=minY+y*LATTICE_STEP_Y;
      pts.push(xx,yy,minZ,xx,yy,maxZ);
    }
    for(let x=0;x<LATTICE_X;x++)for(let z=0;z<LATTICE_Z;z++){
      const xx=minX+x*LATTICE_STEP_X,zz=minZ+z*LATTICE_STEP_Z;
      pts.push(xx,minY,zz,xx,maxY,zz);
    }
    for(let y=0;y<LATTICE_Y;y++)for(let z=0;z<LATTICE_Z;z++){
      const yy=minY+y*LATTICE_STEP_Y,zz=minZ+z*LATTICE_STEP_Z;
      pts.push(minX,yy,zz,maxX,yy,zz);
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
    const lines=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({
      color:0xc5ffe1,transparent:true,opacity:.125,depthWrite:false
    }));
    lines.renderOrder=5;
    return lines;
  }

  function makeLatticeKey(){
    // An enlarged constellation of three symbols near the center of view.
    // Tapping the constellation is more robust than hitting a single character.
    const keyGroup=new THREE.Group();
    const keyColor=[0x86ffbf,0xffffff,0xff6fc8];
    for(let i=0;i<3;i++){
      const cell=[148,31,45][i]%GLYPHS.length;
      const col=cell%ATLAS_COLS,row=Math.floor(cell/ATLAS_COLS);
      const geo=new THREE.PlaneGeometry(.20,.20);
      const pad=.10,l=(col+pad)/ATLAS_COLS,r=(col+1-pad)/ATLAS_COLS;
      const t=1-(row+pad)/ATLAS_ROWS,b=1-(row+1-pad)/ATLAS_ROWS;
      const uv=geo.attributes.uv;
      uv.setXY(0,l,t);uv.setXY(1,r,t);uv.setXY(2,l,b);uv.setXY(3,r,b);
      const glyph=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({
        map:chamberTexture,color:keyColor[i],transparent:true,
        blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide
      }));
      glyph.position.x=(i-1)*.23;
      glyph.renderOrder=16;
      keyGroup.add(glyph);
    }
    const hit=new THREE.Mesh(new THREE.PlaneGeometry(.94,.65),
      new THREE.MeshBasicMaterial({
        transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide
      }));
    hit.userData.isLatticeKey=true;
    keyGroup.add(hit);
    keyGroup.position.set(0,.06,-.80);
    lattice.add(keyGroup);
    latticeTarget=hit;
    latticeGlow=keyGroup;
  }

  function enterLattice(){
    latticeTimer=null;
    if(stage!=='portal'||!scene||!camera||!chamber)return;
    // Keep the chamber group in memory for its book placement, but remove
    // the walls from the scene. The visitor now inhabits a volumetric field.
    stage='latticeTransition';$('oracleTrigger').hidden=true;
    transitionGroup(chamber,chamber.userData.sceneAlpha??1,0,1.0,()=>{
      scene.remove(chamber);
      stage='lattice';
      $('oracleTrigger').hidden=false;
    });
    disposeLattice();
    lattice=new THREE.Group();
    lattice.add(buildLatticeLines());
    lattice.add(buildLatticeGlyphs());
    makeLatticeKey();
    lattice.position.copy(camera.position);
    const forward=new THREE.Vector3();
    camera.getWorldDirection(forward);
    lattice.rotation.y=Math.atan2(-forward.x,-forward.z);
    scene.add(lattice);
    transitionGroup(lattice,0,1,1.85,null,.32,1);
    $('oracleTrigger').textContent='触碰发光的符号';
    $('oracleTrigger').hidden=false;
    $('instruction').textContent='触碰发光的符号';
    setStatus('VOLUMETRIC MATRIX · TRACKING NORMAL');
  }

  function revealBookFromLattice(){
    if(stage!=='lattice'||!chamber)return;
    stage='bookTransition';$('oracleTrigger').hidden=true;
    transitionGroup(lattice,lattice.userData.sceneAlpha??1,0,1.15,()=>{
      disposeLattice();
      for(const child of chamber.children)child.visible=false;
      scene.add(chamber);
      beginBooks();
    });
  }

  function disposeMini(){
    if(!miniCube)return;
    scene.remove(miniCube);
    miniCube.traverse(o=>{unregisterFadingGlyphs(o);if(o.geometry)o.geometry.dispose();if(o.material&&o.material!==chamberMaterial)o.material.dispose();});
    miniCube=null;
  }
  function showMini(){
    if(!sceneReady || !trackingNormal || !camera)return;
    stopVoice();clearStageTimer();disposeLattice();disposeMini();disposeChamber();hidePrompt();
    stage='mini';portalOpen=false;
    if(!chamberTexture)chamberTexture=makeAtlas();
    if(!chamberMaterial)chamberMaterial=new THREE.MeshBasicMaterial({
      map:chamberTexture,transparent:true,alphaTest:.08,side:THREE.DoubleSide,
      depthWrite:false,vertexColors:true,blending:THREE.AdditiveBlending
    });
    miniCube=new THREE.Group();
    // Reuse the same lattice, scaled as one architectural artifact.
    const {geo}=chamberGeometry();
    miniCube.add(registerFadingGlyphs(new THREE.Mesh(geo,chamberMaterial)));
    miniCube.add(new THREE.LineSegments(gridGeometry(),new THREE.LineBasicMaterial({
      color:0xffffff,transparent:true,opacity:.4,depthWrite:false
    })));
    addCubeFrame(miniCube);
    miniCube.scale.setScalar(.098); // 70% of the previous 34 cm miniature; now ~23.5 cm wide
    const forward=new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y=0;
    if(forward.lengthSq()<.01)forward.set(0,0,-1);
    forward.normalize();
    miniCube.position.copy(camera.position).addScaledVector(forward,.48);
    miniCube.position.y+=.01;
    scene.add(miniCube);
    transitionGroup(miniCube,0,1,1.1);
    miniStart=performance.now();
    $('place').hidden=true;$('reset').hidden=false;
    $('instruction').textContent='触碰矩阵';
    $('detail').textContent='';
    $('oracleTrigger').hidden=false;
    $('oracleTrigger').textContent='触碰矩阵';
    setStatus('MINIATURE MATRIX · TRACKING NORMAL');
  }
  function expandToChamber(){
    if(!camera||!trackingNormal)return;
    stopVoice();clearStageTimer();hidePrompt();
    stage='transition';$('oracleTrigger').hidden=true;
    transitionGroup(miniCube,miniCube.userData.sceneAlpha??1,0,.95,()=>{
      disposeMini();
      placeChamber();
      stage='chamber';hidePrompt();
      installOracleTarget();
      transitionGroup(chamber,0,1,1.4);
      $('instruction').textContent='触碰发光的符号';
      $('detail').textContent='';
      $('oracleTrigger').hidden=false;
      $('oracleTrigger').textContent='触碰发光的符号';
      setStatus('INSIDE THE MATRIX · TRACKING NORMAL');
    });
  }
  function disposeChamber(){
    if(!chamber)return;
    disposeLattice();disposeBooks();
    scene.remove(chamber);
    chamber.traverse(o=>{unregisterFadingGlyphs(o);if(o.geometry)o.geometry.dispose();if(o.material&&o.material!==chamberMaterial)o.material.dispose();});
    chamber=null;glyphMesh=null;gridMesh=null;portalFrame=null;oracleTarget=null;
  }
  function placeChamber(){
    if(!sceneReady||!trackingNormal||!camera)return;
    hidePrompt();
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
    setStatus('CHAMBER FORMED · TRACKING NORMAL');
  }
  function openPortal(){
    if(!chamber||portalOpen)return;
    // Preserve the doorway's original glyphs as a separate overlay.
    // Their fade exposes the opening without suddenly deleting its pixels.
    const old=chamberGeometry().geo;
    const doorGeometry=new THREE.BufferGeometry();
    const oldPos=old.getAttribute('position'),oldUV=old.getAttribute('uv'),oldColor=old.getAttribute('color');
    const pp=[],uu=[],cc=[],ii=[];
    for(let g=0;g<oldPos.count/4;g++){
      let x=0,y=0,z=0;for(let q=0;q<4;q++){
        x+=oldPos.getX(g*4+q)/4;y+=oldPos.getY(g*4+q)/4;z+=oldPos.getZ(g*4+q)/4;
      }
      if(Math.abs(z+DEPTH/2)>.004||Math.abs(x)>WIDTH*(PORTAL.colEnd-PORTAL.colStart+1)/(2*COLS)||y>HEIGHT*.3)continue;
      const p=pp.length/3;
      for(let q=0;q<4;q++){
        const v=g*4+q;pp.push(oldPos.getX(v),oldPos.getY(v),oldPos.getZ(v)-.002);
        uu.push(oldUV.getX(v),oldUV.getY(v));
        cc.push(oldColor.getX(v),oldColor.getY(v),oldColor.getZ(v));
      }
      ii.push(p,p+1,p+2,p,p+2,p+3);
    }
    doorGeometry.setAttribute('position',new THREE.Float32BufferAttribute(pp,3));
    doorGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uu,2));
    doorGeometry.setAttribute('color',new THREE.Float32BufferAttribute(cc,3));
    doorGeometry.setIndex(ii);old.dispose();
    const disappearingDoor=new THREE.Group();
    disappearingDoor.add(new THREE.Mesh(doorGeometry,chamberMaterial.clone()));
    chamber.add(disappearingDoor);
    portalOpen=true;
    rebuildChamberContent();
    transitionGroup(disappearingDoor,1,0,1.25,()=>{
      chamber.remove(disappearingDoor);doorGeometry.dispose();
    });
    stage='portal';hidePrompt();
    $('oracleTrigger').hidden=true;
    // The discovery halo belongs to the question, not the book sequence.
    if(oracleTarget?.parent){
      const targetGroup=oracleTarget.parent;
      chamber.remove(targetGroup);
      targetGroup.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});
      oracleTarget=null;
    }
    $('instruction').textContent='通道已打开';
    setStatus('PORTAL OPEN · TRACKING NORMAL');
    // Hold the architectural opening for exactly three seconds, then reveal
    // the second, spatial matrix. This is cancellable via RESTART.
    if(latticeTimer)clearTimeout(latticeTimer);
    latticeTimer=setTimeout(enterLattice,3000);
  }



  function disposeBooks(){
    bookSerial++;
    $('bookPanel').hidden=true;$('finalPanel').hidden=true;
    if(bookGroup&&chamber)chamber.remove(bookGroup);
    if(bookPath&&chamber)chamber.remove(bookPath);
    if(bookPath)bookPath.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});
    bookGroup=null;bookPath=null;bookMixer=null;bookOpening=false;bookOpened=false;
  }

  function beginBooks(){
    disposeBooks();
    stage='books';bookIndex=0;
    $('oracleTrigger').hidden=true;
    showBook(0);
  }
  function updateBookPanel(opened){
    $('bookPanel').hidden=false;
    $('bookCount').textContent='第一卷';
    $('bookTitle').textContent='东方之风';
    $('bookHint').textContent=opened?'书已打开':'轻触书籍以打开';
    $('bookAction').textContent=opened?'继续':'轻触书籍以打开';
  }

  function mountBook(gltf,serial){
    if(serial!==bookSerial||stage!=='books'||!chamber)return;
    const model=gltf.scene;
    // Three.js renders opaque objects BEFORE transparent objects. The camera
    // shade is transparent, so opaque book materials were darkened by the 70%
    // camera plane even though its renderOrder was -100.
    // Render opaque-looking textured book surfaces in the transparent pass
    // AFTER the camera shade and BEFORE the AR interface, without changing
    // texture colors. This is the same basic textured look as the website.
    model.traverse(o=>{
      if(!o.isMesh)return;
      const convert=old=>{
        const texture=old.map||old.emissiveMap||null;
        if(texture){
          texture.colorSpace=THREE.SRGBColorSpace||texture.colorSpace;
          texture.needsUpdate=true;
        }
        return new THREE.MeshBasicMaterial({
          map:texture,color:0xffffff,side:THREE.DoubleSide,
          transparent:true,depthWrite:true,depthTest:true,
          alphaTest:old.alphaTest||0,opacity:old.opacity===undefined?1:old.opacity,
          toneMapped:false
        });
      };
      o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material);
      // Camera shade: -100; glyphs: 10. Book surfaces: 20.
      o.renderOrder=20;
    });
    // Start animation before computing bounds. Root and cover transforms are
    // animated, so the book's rest geometry must not be permanently recentered.
    if(gltf.animations?.length){
      const clip=gltf.animations[0];
      bookMixer=new THREE.AnimationMixer(model);
      bookMixer.clipAction(clip).play();
      bookDuration=clip.duration;bookMixer.setTime(0);
    }else{bookMixer=null;bookDuration=0;}
    model.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(model);
    const center=bounds.getCenter(new THREE.Vector3());
    const extent=bounds.getSize(new THREE.Vector3());
    // Inspection of the actual uploaded files: book-1 closed bounding box
    // ~0.233 × 0.272 × 0.175 model units, not already world-size metres.
    // Fit ~62 cm visually, with the native orientation of the GLB retained.
    const fit=.62/Math.max(extent.x,extent.y,extent.z,.001);
    bookGroup=new THREE.Group();
    const normalized=new THREE.Group();
    normalized.scale.setScalar(fit);
    normalized.position.copy(center).multiplyScalar(-fit);
    normalized.add(model);
    bookGroup.add(normalized);
    // In front of the portal, on the VISITOR'S side, rather than 58 cm behind it.
    // Following the short glyph curl toward the right; no walking required.
    // GLB is modeled flat on the XZ plane (Y is book thickness).
    // Rotate upright and face its front cover toward the viewer.
    // Match the original Book I model-viewer:
    // orientation='0deg 0deg 0deg', camera-orbit='0deg 82deg 0.85m'.
    // The GLB already contains a rotated root. Extra rotation inverted the cover.
    bookGroup.rotation.set(0,0,0);
    // Immediately at the threshold, slightly beyond its plane; viewer need
    // only look at the portal and need not move closer.
    bookGroup.position.set(0,.0,-1.24);
    chamber.add(bookGroup);
    transitionGroup(bookGroup,0,1,1.15);
    updateBookPanel(false);
    $('bookAction').disabled=false;
    $('instruction').textContent='轻触书籍以打开';
    $('bookHint').textContent='轻触书籍以打开';
  }


  function getBookLoader(){
    if(!THREE.GLTFLoader)throw new Error('GLTFLoader unavailable');
    if(!bookLoader)bookLoader=new THREE.GLTFLoader();
    return bookLoader;
  }
  function preloadBook(){
    if(preloadPromise)return preloadPromise;
    const source='https://empireofclouds.com/3d/book-1.glb';
    const fallback='https://raw.githubusercontent.com/metekutlu07/empire-of-clouds/main/3d/book-1.glb';
    preloadPromise=(async()=>{
      const loader=getBookLoader();
      try{return await loader.loadAsync(source);}
      catch(err){
        console.warn('Official book asset unavailable; trying GitHub',err);
        return await loader.loadAsync(fallback);
      }
    })();
    preloadPromise.then(gltf=>{preloadedBook=gltf;},e=>{console.warn('Book preloading failed',e);preloadPromise=null;});
    return preloadPromise;
  }
  async function showBook(){
    if(stage!=='books'||!chamber)return;
    const serial=++bookSerial;
    if(bookGroup)chamber.remove(bookGroup);
    bookGroup=null;bookMixer=null;bookIndex=0;bookOpening=false;bookOpened=false;
    updateBookPanel(false);
    $('bookHint').textContent='书籍正在加载…';
    $('bookAction').disabled=true;
    try{
      const gltf=preloadedBook||await preloadBook();
      if(serial!==bookSerial||stage!=='books')return;
      // Use one real model, never request Books II–V.
      mountBook(gltf,serial);
    }catch(err){
      if(serial!==bookSerial)return;
      console.error('Book I load failed',err);
      $('bookHint').textContent='书籍加载失败，请重试';
    }
  }
  function finishBookOpening(){
    bookOpening=false;updateBookPanel(true);$('bookAction').disabled=false;
  }
  function tapBook(){
    if(stage!=='books'||!bookGroup||bookOpening)return;
    if(!bookOpened){
      bookOpened=true;bookOpening=true;bookStart=performance.now();
      $('bookHint').textContent='书籍正在打开…';
      $('bookAction').disabled=true;
      if(!bookMixer||!bookDuration)finishBookOpening();
    }else{
      // Second tap ends the encounter with the book, it does not close it.
      if(bookGroup&&chamber)chamber.remove(bookGroup);
      bookGroup=null;bookMixer=null;
      stage='final';$('bookPanel').hidden=true;$('finalPanel').hidden=false;
      $('instruction').textContent='THE FINAL THRESHOLD';
      speak('想要发现隐藏的真相吗？只剩最后一步。');
    }
  }
  $('bookAction').addEventListener('click',tapBook);
  $('finalEnter').addEventListener('click',()=>{window.location.href='https://dreampixels.cloud/';});

  function awakenMini(){
    if(stage!=='mini')return;
    stage='ready';
    $('oracleTrigger').hidden=true;
    setPrompt(LINES.enter,'','是','否');
    speak(LINES.enter);
  }
  function awakenCloud(){
    if(stage!=='chamber')return;
    stage='clouds';
    $('oracleTrigger').hidden=true;
    setPrompt(LINES.clouds,'','会','不会');
    speak(LINES.clouds);
  }
  function oracleResponse(answer){
    if(stage!=='clouds')return;
    stage='response';
    hidePrompt();
    const phrase=answer==='yes'?LINES.yes:LINES.no;
    $('instruction').textContent=phrase;
    $('detail').textContent=answer==='yes'?'Perhaps thought itself is a cloud.':
      'Then who is asking you this question?';
    // Door is opened only when the Chinese reply has finished.
    speak(phrase,()=>{if(stage==='response')openPortal();});
  }
  function installOracleTarget(){
    if(!chamber)return;
    const group=new THREE.Group();
    // Visible illuminated halo with a generous invisible target, facing into chamber.
    const circle=new THREE.Mesh(
      new THREE.RingGeometry(.24,.31,48),
      new THREE.MeshBasicMaterial({color:0x94ffc5,transparent:true,opacity:.34,
        side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));
    circle.position.z=.006;circle.userData.oracleGlow=true;
    group.add(circle);
    const hit=new THREE.Mesh(new THREE.PlaneGeometry(.86,.86),
      new THREE.MeshBasicMaterial({transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));
    hit.userData.oracleHit=true;group.add(hit);
    group.position.set(0,.20,-DEPTH/2+.025);
    chamber.add(group);
    oracleTarget=hit;
    oracleTarget.userData.ring=circle;
  }
  function handleWorldTap(e){
    if(!trackingNormal||!camera||!scene||!e.isPrimary)return;
    if(stage!=='mini'&&stage!=='chamber'&&stage!=='lattice'&&stage!=='books')return;
    if(e.target!==$('camerafeed'))return;
    if(!activeRaycaster)activeRaycaster=new THREE.Raycaster();
    const ndc=new THREE.Vector2(e.clientX/window.innerWidth*2-1,
      -(e.clientY/window.innerHeight)*2+1);
    activeRaycaster.setFromCamera(ndc,camera);
    if(stage==='mini' && miniCube){
      // Local sphere at the cube origin is large enough for comfortable mobile tapping.
      const sphereCenter=new THREE.Vector3();miniCube.getWorldPosition(sphereCenter);
      const sphere=new THREE.Sphere(sphereCenter,.28);
      if(activeRaycaster.ray.intersectsSphere(sphere))awakenMini();
    }else if(stage==='chamber'&&oracleTarget){
      if(activeRaycaster.intersectObject(oracleTarget,false).length)awakenCloud();
    }else if(stage==='lattice'&&latticeTarget){
      if(activeRaycaster.intersectObject(latticeTarget,false).length)revealBookFromLattice();
    }else if(stage==='books'&&bookGroup){
      if(activeRaycaster.intersectObject(bookGroup,true).length)tapBook();
    }
  }
  $('camerafeed').addEventListener('pointerup',handleWorldTap);
  $('oracleTrigger').addEventListener('click',()=>{
    if(stage==='mini')awakenMini();
    else if(stage==='chamber')awakenCloud();
    else if(stage==='lattice')revealBookFromLattice();
  });
  $('portalYes').addEventListener('click',()=>{
    if(stage==='ready')expandToChamber();
    else if(stage==='clouds')oracleResponse('yes');
  });
  $('portalNo').addEventListener('click',()=>{
    if(stage==='ready'){
      hidePrompt();stage='mini';stopVoice();
      $('instruction').textContent='触碰矩阵';
      $('oracleTrigger').textContent='触碰矩阵';
      $('oracleTrigger').hidden=false;
    }else if(stage==='clouds')oracleResponse('no');
  });


  // A restrained visual interference on the miniature's first appearance:
  // brief, rare horizontal phase shifts. Tracking coordinates are untouched.
  // Three clipped copies of the entire introduction become horizontal
  // corruption bands; the real button remains the only interactive button.
  (function initGateInterference(){
    const gate=$('gate'), original=gate?.querySelector('.gateContent');
    if(!gate||!original)return;
    for(let i=0;i<3;i++){
      const band=original.cloneNode(true);
      band.classList.add('glitchBand','glitchBand'+(i+1));
      band.setAttribute('aria-hidden','true');
      band.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
      band.querySelectorAll('button').forEach(n=>{n.tabIndex=-1;n.disabled=true;});
      gate.appendChild(band);
    }
  })();

  function updateOpeningGlitch(now){
    if(stage!=='mini'||!miniCube)return;
    const phase=((now-miniStart)/1000)%7.5;
    const glitch=phase>.48&&phase<.64;
    miniCube.children.forEach((child,i)=>{
      if(child.isMesh)child.position.x=glitch?Math.sin(now*.11+i)*.008:0;
    });
  }
  function sceneModule() {
    return {
      name:'empire-anchor-scene',
      onStart: () => {
        ({scene,camera}=XR8.Threejs.xrScene());
        camera.position.set(0,1.6,0);
        installCameraShade();
        sceneReady=true;
        // Download the sole book once while the visitor explores the matrix.
        preloadBook().catch(e=>console.warn('Preload unavailable',e));
        $('instruction').textContent='Move your phone slowly to let the camera map the room.';
      },
      onUpdate: ({processCpuResult}) => {
        updateCameraShade();
        const now=performance.now();
        animateFadingGlyphs(now);
        updateSceneTransitions(now);
        updateOpeningGlitch(now);
        if(miniCube && (stage==='mini'||stage==='ready')){
          // The GROUP is fixed in world space; only its local orientation spins.
          miniCube.rotation.y=(now-miniStart)*0.00017;
          miniCube.position.y+=Math.sin(now*.018)*.000035;
        }
        if(latticeGlow && stage==='lattice'){
          const pulse=1+.075*Math.sin(performance.now()*.0025);
          latticeGlow.scale.setScalar(pulse);
        }
        if(oracleTarget?.userData.ring){
          oracleTarget.userData.ring.material.opacity=.22+.16*Math.sin(performance.now()*.003);
          oracleTarget.userData.ring.scale.setScalar(1+.075*Math.sin(performance.now()*.003));
        }
        if(bookOpening&&bookMixer&&bookDuration){
          const t=Math.min(1,(performance.now()-bookStart)/3200);
          bookMixer.setTime(bookDuration*.5*t*t*(3-2*t));
          if(t>=1)finishBookOpening();
        }
        const reality=processCpuResult?.reality;
        if(!reality) return;
        const normal=reality.trackingStatus==='NORMAL';
        if(normal!==trackingNormal) {
          trackingNormal=normal;
          $('place').disabled=!normal;
          $('reset').disabled=!normal;
          if(normal && stage==='tracking')showMini();
          else if(normal && stage!=='tracking' && stage!=='portal')
            setStatus(stage==='chamber'?'INSIDE THE MATRIX · TRACKING NORMAL':
              stage==='mini'||stage==='ready'?'MINIATURE MATRIX · TRACKING NORMAL':
              'MATRIX QUESTION · TRACKING NORMAL');
          else if(!normal) setStatus('TRACKING LIMITED · MOVE PHONE SLOWLY');
          /* Original status fallback intentionally disabled while scenes are active. */
          /* setStatus(normal?'TRACKING NORMAL · READY TO FORM CHAMBER':
            'TRACKING '+(reality.trackingStatus||'INITIALIZING')+' · '+(reality.trackingReason||'')); */
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
    const intro=$('gate');
    intro.classList.add('gateLeaving');
    document.body.classList.add('experienceStarted');
    setTimeout(()=>{intro.hidden=true;intro.style.display='none';},560);
    $('hud').hidden=false;
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
    if(startRequested)return;
    startRequested=true;
    $('start').disabled=true;
    // The opening splash is shown only once. Subsequent initialization
    // progress lives in the HUD, not a repeated full-screen intro.
    $('gate').hidden=true;$('gate').style.display='none';
    $('hud').hidden=false;
    setStatus('LOADING WORLD TRACKING…');
    if(window.XR8)startXR();
    else{
      window.addEventListener('xrloaded',startXR,{once:true});
      setTimeout(()=>{
        if(!xrStarted){
          startRequested=false;
          fail('World tracking engine did not become ready. Reload to retry.');
        }
      },15000);
    }
  });
  $('place').addEventListener('click',showMini);
  $('reset').addEventListener('click',showMini);
})();
