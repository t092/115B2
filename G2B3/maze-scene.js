import * as THREE from './vendor/three.module.js';

export function createMazeScene(container, initial) {
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-label','立體古城迷宮：探險家、巡邏守護者與玉璽');
  const scene=new THREE.Scene();scene.background=new THREE.Color('#192c29');
  scene.fog=new THREE.Fog('#192c29',22,48);
  const camera=new THREE.OrthographicCamera(-8,8,6,-6,.1,80);
  scene.add(new THREE.HemisphereLight(0xfff1d1,0x425f58,2.6));
  const sun=new THREE.DirectionalLight(0xffe0a5,3.1);sun.position.set(-5,16,8);sun.castShadow=true;
  sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,far:45});sun.shadow.bias=-.002;scene.add(sun);
  const materials=new Map();
  function mat(color,extra={}){const key=color+JSON.stringify(extra);if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.8,...extra}));return materials.get(key);}
  function mesh(parent,geometry,color,x,y,z,extra={}){const m=new THREE.Mesh(geometry,mat(color,extra));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  function box(parent,w,h,d,color,x,y,z,extra){return mesh(parent,new THREE.BoxGeometry(w,h,d),color,x,y,z,extra);}
  function sphere(parent,r,color,x,y,z){return mesh(parent,new THREE.SphereGeometry(r,12,8),color,x,y,z);}
  function cylinder(parent,r1,r2,h,color,x,y,z){return mesh(parent,new THREE.CylinderGeometry(r1,r2,h,10),color,x,y,z);}
  const floor=box(scene,16,.4,12,'#a49b7a',7,-.3,5);floor.receiveShadow=true;
  const wallGeometry=new THREE.BoxGeometry(.96,.62,.96);
  const tileGeometry=new THREE.BoxGeometry(.96,.06,.96);
  initial.map.forEach((row,z)=>row.forEach((v,x)=>{
    if(v===1){mesh(scene,wallGeometry,(x+z)%3===0?'#6c7867':'#7f8771',x,.31,z);box(scene,.99,.08,.99,'#a3aa8c',x,.65,z);}
    else mesh(scene,tileGeometry,(x+z)%2?'#b5aa88':'#c1b391',x,-.04,z);
  }));
  // Torches illuminate the route without expensive per-torch shadow maps.
  [[0,1],[4,3],[6,5],[10,7],[14,9]].forEach(([x,z])=>{
    cylinder(scene,.06,.08,.5,'#574936',x,.95,z);
    const fire=sphere(scene,.12,'#ffd282',x,1.26,z);fire.material=mat('#ffca65',{emissive:'#ff9e32',emissiveIntensity:1});
  });
  function character(kind,color) {
    const root=new THREE.Group(),body=new THREE.Group();root.add(body);
    const robe=kind==='scholar';
    cylinder(body,robe?.19:.22,robe?.3:.23,.45,color,0,.56,0);
    box(body,.43,.07,.3,'#ba944f',0,.39,0);
    sphere(body,.205,'#e9bd8c',0,.98,0);
    sphere(body,.19,'#343e35',0,1.07,.045);
    sphere(body,.09,'#28362e',0,1.23,.06);
    box(body,.28,.19,.06,'#e9bd8c',0,.99,-.175);
    [-.075,.075].forEach(x=>sphere(body,.025,'#26332c',x,1.01,-.215));
    const legs=[box(body,.13,.26,.15,'#33443c',-.12,.2,0),box(body,.13,.26,.15,'#33443c',.12,.2,0)];
    box(body,.16,.1,.24,'#343c32',-.12,.06,-.04);box(body,.16,.1,.24,'#343c32',.12,.06,-.04);
    const armL=box(body,.13,.35,.14,color,-.29,.59,0),armR=box(body,.13,.35,.14,color,.29,.59,0);
    if(kind==='player') {
      const cape=box(body,.4,.5,.055,'#d58b48',0,.58,.22);cape.rotation.x=-.15;
      box(body,.19,.22,.15,'#6e5338',-.26,.43,.13);
      const strap=box(body,.065,.5,.04,'#72563d',0,.62,-.235);strap.rotation.z=-.5;
      box(body,.15,.19,.15,'#ffc76c',.37,.42,-.17,{emissive:'#f7a83b',emissiveIntensity:.6});
      cylinder(body,.015,.015,.26,'#735432',.37,.62,-.17);
    } else if(robe){
      for(let i=0;i<5;i++)box(body,.035,.29,.06,i%2?'#d9ba7c':'#ae8e50',-.09+i*.047,.58,-.29);
      armL.rotation.z=-.55;armR.rotation.z=.55;
    } else {
      cylinder(body,.21,.23,.17,kind==='zhou'?'#8a9c71':'#53615a',0,1.15,0);
      for(let i=0;i<3;i++)box(body,.4,.055,.04,kind==='zhou'?'#b1b78b':'#899584',0,.48+i*.095,-.22);
      if(kind==='zhou')box(body,.28,.44,.085,'#799e80',-.37,.55,-.15);
      else {cylinder(body,.018,.018,1.18,'#796346',.39,.7,0);box(body,.22,.045,.04,'#c3cbb7',.44,1.22,0);mesh(body,new THREE.ConeGeometry(.065,.21,4),'#c3cbb7',.39,1.4,0);}
    }
    scene.add(root);return {root,body,legs,armR,cheer:0};
  }
  const player=character('player','#49746b');player.root.position.set(initial.player.x,0,initial.player.y);
  const actors=new Map();
  initial.guardians.forEach((g,i)=>{
    const actor=character(['zhou','scholar','qin'][i],['#668f77','#aa8556','#394c46'][i]);actor.root.position.set(g.x,0,g.y);actors.set(g.id,actor);
    const halo=mesh(actor.root,new THREE.TorusGeometry(.38,.025,6,32),g.color,0,.035,0,{emissive:g.color,emissiveIntensity:.3});halo.rotation.x=Math.PI/2;actor.halo=halo;
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const c=canvas.getContext('2d');c.fillStyle=g.color;c.beginPath();c.arc(32,32,27,0,Math.PI*2);c.fill();c.fillStyle='#163c32';c.font='bold 36px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(i+1,32,34);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:false}));sprite.scale.set(.38,.38,1);sprite.position.y=1.7;actor.root.add(sprite);actor.marker=sprite;
  });
  const sealRoot=new THREE.Group();sealRoot.position.set(13,0,9);scene.add(sealRoot);
  box(sealRoot,.84,.16,.84,'#6c7763',0,.08,0);box(sealRoot,.66,.2,.66,'#8d9275',0,.26,0);
  const jade=new THREE.Group();jade.position.y=.55;sealRoot.add(jade);
  box(jade,.47,.22,.47,'#73c6a1',0,0,0,{metalness:.2,roughness:.25});
  box(jade,.49,.035,.49,'#d8c584',0,-.12,0);
  // Coiled dragon knob: jade coils, raised head, snout and paired horns.
  const coil=mesh(jade,new THREE.TorusGeometry(.13,.055,8,20),'#519f7b',0,.17,0);coil.rotation.x=Math.PI/2;
  sphere(jade,.085,'#73c6a1',.075,.24,-.065);box(jade,.095,.06,.12,'#73c6a1',.075,.22,-.13);
  [-.035,.035].forEach(dx=>mesh(jade,new THREE.ConeGeometry(.018,.08,5),'#d8c584',.075+dx,.32,-.06));
  const rings=[0,1,2].map(i=>{const ring=mesh(sealRoot,new THREE.TorusGeometry(.5+i*.09,.018,6,48),'#e8c878',0,.65+i*.17,0,{emissive:'#ba802c',emissiveIntensity:.3});ring.rotation.x=Math.PI/2;return ring;});
  const look=new THREE.Vector3(7,0,4);
  let width=0,height=0;
  function render(s,dt,time){
    const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;
    if(w!==width||h!==height){width=w;height=h;renderer.setSize(w,h,false);const half=4.8;camera.left=-half*w/h;camera.right=half*w/h;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();}
    const ease=s.reduced?1:1-Math.exp(-dt*14);
    function animate(actor,x,z,angle,solved=false){
      const moving=Math.abs(actor.root.position.x-x)+Math.abs(actor.root.position.z-z)>.025;
      actor.root.position.x=THREE.MathUtils.lerp(actor.root.position.x,x,ease);actor.root.position.z=THREE.MathUtils.lerp(actor.root.position.z,z,ease);
      actor.root.rotation.y=angle;
      actor.legs.forEach((leg,i)=>leg.rotation.x=moving&&!s.reduced?Math.sin(time*15+i*Math.PI)*.45:0);
      actor.body.position.y=moving&&!s.reduced?Math.abs(Math.sin(time*15))*.035:0;
      if(actor.marker){actor.marker.visible=!solved;actor.halo.visible=!solved;}
      if(actor.cheer>0){actor.cheer-=dt;actor.armR.rotation.z=-2.4;actor.body.position.y=s.reduced?0:Math.abs(Math.sin(time*8))*.12;}else if(solved)actor.armR.rotation.z=-.8;
    }
    animate(player,s.player.x,s.player.y,-s.player.facing);
    s.guardians.forEach(g=>animate(actors.get(g.id),g.x,g.y,Math.PI-g.facing,g.solved));
    rings.forEach((r,i)=>r.visible=i>=s.unlocked);
    jade.rotation.y=s.unlocked===3&&!s.reduced?time*.65:0;
    const marginX=Math.min(6.2,4.8*w/h-0.5);
    const desired=new THREE.Vector3(THREE.MathUtils.clamp(s.player.x,marginX,14-marginX),0,THREE.MathUtils.clamp(s.player.y,3.5,6.5));look.lerp(desired,s.reduced?1:1-Math.exp(-dt*5));
    // North remains up, matching the radar and the four directional controls.
    camera.position.set(look.x,11,look.z+8);camera.lookAt(look.x,0,look.z);
    renderer.render(scene,camera);
  }
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();document.getElementById('mazeRenderMode').textContent='顯示暫停 · 請重新整理恢復';});
  container.prepend(renderer.domElement);
  return {render,celebrate(id){const actor=actors.get(id);if(actor)actor.cheer=1.5;}};
}
