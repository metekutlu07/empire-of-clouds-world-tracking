/* Empire of Clouds / Test 07 - Prelude and Portal world-tracked chamber, 8th Wall SLAM. */
(() => {
  const $ = (id) => document.getElementById(id);
  let xrStarted = false, sceneReady = false, trackingNormal = false;
  let scene = null, camera = null, chamber = null, chamberTexture = null, chamberMaterial = null, cameraShade = null;
  let portalOpen = false, glyphMesh = null, gridMesh = null, portalFrame = null;
  let miniCube = null, stage = 'tracking', miniStart = 0, oracleTarget = null;
  let activeRaycaster = null, voiceToken=0;
  const BOOKS=['Eastern Winds','Cosmic Cryptography','Pigment Turbulence','The Crystal Matrix','Synthetic Minds'];
  let bookGroup=null,bookPath=null,bookMixer=null,bookDuration=0,bookIndex=0,
      bookOpening=false,bookOpened=false,bookStart=0,bookSerial=0,bookLoader=null;
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


  function clearStageTimer(){}
  function setPrompt(title, note, yes, no){
    $('portalTitle').textContent=title;
    $('portalNote').textContent=note||'';
    $('portalYes').textContent=yes;
    $('portalNo').textContent=no;
    $('portalPrompt').hidden=false;
  }
  function hidePrompt(){ $('portalPrompt').hidden=true; }

  function disposeMini(){
    if(!miniCube)return;
    scene.remove(miniCube);
    miniCube.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&&o.material!==chamberMaterial)o.material.dispose();});
    miniCube=null;
  }
  function showMini(){
    if(!sceneReady || !trackingNormal || !camera)return;
    stopVoice();clearStageTimer();disposeMini();disposeChamber();hidePrompt();
    stage='mini';portalOpen=false;
    if(!chamberTexture)chamberTexture=makeAtlas();
    if(!chamberMaterial)chamberMaterial=new THREE.MeshBasicMaterial({
      map:chamberTexture,transparent:true,alphaTest:.08,side:THREE.DoubleSide,
      depthWrite:false,vertexColors:true,blending:THREE.AdditiveBlending
    });
    miniCube=new THREE.Group();
    // Reuse the same lattice, scaled as one architectural artifact.
    const {geo}=chamberGeometry();
    miniCube.add(new THREE.Mesh(geo,chamberMaterial));
    miniCube.add(new THREE.LineSegments(gridGeometry(),new THREE.LineBasicMaterial({
      color:0xffffff,transparent:true,opacity:.4,depthWrite:false
    })));
    addCubeFrame(miniCube);
    miniCube.scale.setScalar(.14); // 34 cm wide
    const forward=new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y=0;
    if(forward.lengthSq()<.01)forward.set(0,0,-1);
    forward.normalize();
    miniCube.position.copy(camera.position).addScaledVector(forward,.48);
    miniCube.position.y+=.01;
    scene.add(miniCube);
    miniStart=performance.now();
    $('place').hidden=true;$('reset').hidden=false;
    $('instruction').textContent='触碰矩阵 · TOUCH THE MATRIX';
    $('detail').textContent='Tap the floating cube to awaken the voice.';
    $('oracleTrigger').hidden=false;
    $('oracleTrigger').textContent='触碰矩阵 · TOUCH THE MATRIX';
    setStatus('MINIATURE MATRIX · TRACKING NORMAL');
  }
  function expandToChamber(){
    if(!camera||!trackingNormal)return;
    stopVoice();clearStageTimer();hidePrompt();disposeMini();
    // The tiny artifact is replaced by a full-size chamber at the viewer's
    // current pose. No unstable SLAM-scale animation or tracking interruption.
    placeChamber();
    stage='chamber';hidePrompt();
    installOracleTarget();
    $('instruction').textContent='触碰发光的符号 · TOUCH THE GLOWING SYMBOLS';
    $('detail').textContent='Explore the chamber. A glowing symbol cluster awaits.';
    $('oracleTrigger').textContent='唤醒云 · AWAKEN THE CLOUD';
    setStatus('INSIDE THE MATRIX · TRACKING NORMAL');
  }
  function disposeChamber(){
    if(!chamber)return;
    disposeBooks();
    scene.remove(chamber);
    chamber.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material&&o.material!==chamberMaterial)o.material.dispose();});
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
    portalOpen=true;
    rebuildChamberContent();
    stage='portal';hidePrompt();
    $('oracleTrigger').hidden=true;
    $('instruction').textContent='PORTAL OPEN · The five books await.';
    setStatus('PORTAL OPEN · TRACKING NORMAL');
    beginBooks();
  }



  function disposeBooks(){
    bookSerial++;
    $('bookPanel').hidden=true;$('finalPanel').hidden=true;
    if(bookGroup&&chamber)chamber.remove(bookGroup);
    if(bookPath&&chamber)chamber.remove(bookPath);
    if(bookPath)bookPath.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});
    bookGroup=null;bookPath=null;bookMixer=null;bookOpening=false;bookOpened=false;
  }

  function makeBookPath(){
    // A short sideways curl of *glyphs*, not a corridor extending into the room.
    // Path occupies under 85 cm and requires no physical walking.
    bookPath=new THREE.Group();
    const mat=new THREE.MeshBasicMaterial({
      map:chamberTexture,color:0x9dffca,transparent:true,opacity:.9,
      side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending
    });
    for(let i=0;i<12;i++){
      const t=i/11;
      const geom=new THREE.PlaneGeometry(.12+t*.035,.12+t*.035);
      const id=(i*23+11)%GLYPHS.length;
      const col=id%ATLAS_COLS,row=Math.floor(id/ATLAS_COLS);
      const l=(col+.11)/ATLAS_COLS,r=(col+.89)/ATLAS_COLS;
      const bot=1-(row+.89)/ATLAS_ROWS,top=1-(row+.11)/ATLAS_ROWS;
      const uv=geom.attributes.uv;
      uv.setXY(0,l,top);uv.setXY(1,r,top);uv.setXY(2,l,bot);uv.setXY(3,r,bot);
      const symbol=new THREE.Mesh(geom,mat);
      symbol.position.set(-.35+.78*t, -.60+.34*t, -1.02-.16*Math.sin(t*Math.PI));
      symbol.rotation.x=-.36;
      symbol.renderOrder=12;
      bookPath.add(symbol);
    }
    chamber.add(bookPath);
  }
  function beginBooks(){
    disposeBooks();stage='books';bookIndex=0;
    $('oracleTrigger').hidden=true;
    makeBookPath();showBook(0);
  }
  function updateBookPanel(opened){
    $('bookPanel').hidden=false;
    $('bookCount').textContent='BOOK '+['I','II','III','IV','V'][bookIndex]+' / V';
    $('bookTitle').textContent=BOOKS[bookIndex].toUpperCase();
    $('bookHint').textContent=opened?'书已打开 · BOOK OPEN':'触碰书籍 · TAP THE BOOK TO OPEN';
    $('bookAction').textContent=opened?(bookIndex===4?'继续 · CONTINUE':'下一卷 · NEXT BOOK'):
      '打开书籍 · OPEN THE BOOK';
  }

  function mountBook(gltf,serial){
    if(serial!==bookSerial||stage!=='books'||!chamber)return;
    const model=gltf.scene;
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
    bookGroup.position.set(.34,.16,-.94);
    chamber.add(bookGroup);
    updateBookPanel(false);
    $('bookAction').disabled=false;
    $('instruction').textContent='BOOK '+(bookIndex+1)+' · LOOK TOWARD THE PORTAL';
    $('bookHint').textContent='触碰书籍 · TAP THE FLOATING BOOK TO OPEN';
  }
  async function getBookLoader(){
    if(bookLoader)return bookLoader;
    const mod=await import('https://cdn.jsdelivr.net/npm/three@0.146.0/examples/jsm/loaders/GLTFLoader.js');
    if(!bookLoader)bookLoader=new mod.GLTFLoader();
    return bookLoader;
  }
  async function showBook(index){
    if(stage!=='books'||!chamber)return;
    const serial=++bookSerial;
    if(bookGroup)chamber.remove(bookGroup);
    bookGroup=null;bookMixer=null;bookIndex=index;bookOpening=false;bookOpened=false;
    updateBookPanel(false);
    $('bookHint').textContent='正在加载 · LOADING BOOK…';
    $('bookAction').disabled=true;
    try{
      const loader=await getBookLoader();
      if(serial!==bookSerial||stage!=='books')return;
      // Original models hosted at the author's official site.
      const source='https://empireofclouds.com/3d/book-'+(index+1)+'.glb';
      const gltf=await loader.loadAsync(source);
      mountBook(gltf,serial);
    }catch(err){
      if(serial!==bookSerial)return;
      console.error('Book loading failed',err);
      $('bookHint').textContent='Could not load 3D book. Please check connection.';
      $('bookAction').disabled=true;
      // Visible diagnostic instead of silently leaving the visitor without a book.
      $('instruction').textContent='BOOK '+(index+1)+' COULD NOT LOAD';
    }
  }
  function finishBookOpening(){
    bookOpening=false;updateBookPanel(true);$('bookAction').disabled=false;
  }
  function tapBook(){
    if(stage!=='books'||!bookGroup||bookOpening)return;
    if(!bookOpened){
      bookOpened=true;bookOpening=true;bookStart=performance.now();
      $('bookHint').textContent='书正在打开 · BOOK OPENING…';
      $('bookAction').disabled=true;
      if(!bookMixer||!bookDuration)finishBookOpening();
    }else if(bookIndex<4){
      showBook(bookIndex+1);
    }else{
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
    setPrompt(LINES.enter,'ARE YOU READY TO ENTER THE MATRIX?','是 · YES','否 · NO');
    speak(LINES.enter);
  }
  function awakenCloud(){
    if(stage!=='chamber')return;
    stage='clouds';
    $('oracleTrigger').hidden=true;
    setPrompt(LINES.clouds,'CAN CLOUDS THINK?','会 · YES','不会 · NO');
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
    if(stage!=='mini'&&stage!=='chamber'&&stage!=='books')return;
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
    }else if(stage==='books'&&bookGroup){
      if(activeRaycaster.intersectObject(bookGroup,true).length)tapBook();
    }
  }
  $('camerafeed').addEventListener('pointerup',handleWorldTap);
  $('oracleTrigger').addEventListener('click',()=>{
    if(stage==='mini')awakenMini();
    else if(stage==='chamber')awakenCloud();
  });
  $('portalYes').addEventListener('click',()=>{
    if(stage==='ready')expandToChamber();
    else if(stage==='clouds')oracleResponse('yes');
  });
  $('portalNo').addEventListener('click',()=>{
    if(stage==='ready'){
      hidePrompt();stage='mini';stopVoice();
      $('instruction').textContent='触碰矩阵 · TOUCH THE MATRIX';
      $('oracleTrigger').textContent='触碰矩阵 · TOUCH THE MATRIX';
      $('oracleTrigger').hidden=false;
    }else if(stage==='clouds')oracleResponse('no');
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
        if(miniCube && (stage==='mini'||stage==='ready')){
          // The GROUP is fixed in world space; only its local orientation spins.
          miniCube.rotation.y=(performance.now()-miniStart)*0.00017;
        }
        if(oracleTarget?.userData.ring){
          oracleTarget.userData.ring.material.opacity=.22+.16*Math.sin(performance.now()*.003);
          oracleTarget.userData.ring.scale.setScalar(1+.075*Math.sin(performance.now()*.003));
        }
        if(bookOpening&&bookMixer&&bookDuration){
          const t=Math.min(1,(performance.now()-bookStart)/3200);
          bookMixer.setTime(bookDuration*t*t*(3-2*t));
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
  $('place').addEventListener('click',showMini);
  $('reset').addEventListener('click',showMini);
})();
