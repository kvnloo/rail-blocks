import * as T from './vendor/three.module.min.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {V,UP,piece,key,palette,levels,sample,savePiece,attitude} from './track.mjs';
import {createWorld,block,train,poseTrain,badge,cube,plastic} from './scene.mjs';
import {countLatches,routeFor,startRun,PHYSICS_STEP} from './engineering.mjs';
import {depot,sampleLoop,sandboxPresets} from './presets.mjs';
const $=id=>document.getElementById(id), X=V(1), Z=V(0,0,1);
const names=['Straight','Left bend','Right bend','Climb','Drop'], icons=['━','┓','┏','↗','↘'];
const storage='rail-blocks-3d-v1';
const bench={name:'Free build',desc:'Place rails on any layer. Turn, tilt and roll them to mate the grooves.',fixed:[depot],start:depot,stars:[],solution:[]};
const audio = (type, data) => window.dispatchEvent(new CustomEvent('railblocks:audio',{detail:{type,...data}}));
function read(){try{return JSON.parse(localStorage.getItem(storage))||{};}catch{return {};}}
const savedTiles = blocks => new Map(blocks.map((b,i) => [`${key(b.p)}:${i}`,b]));
export function play(canvas){
  const w=createWorld(canvas), {scene,camera,things}=w;
  const blockMeshes=new Map();
  let store=read(), index=Math.min(levels.length,Math.max(0,store.index||0)), l, tiles, rail, ghost, car, grid, bounds, markers, running, preset, state='build', toastTimer, selected=0, erase=false, layer=0, orb=false, axes=new T.Quaternion(), drag=null;
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.minDistance=4.5;controls.maxDistance=35;controls.maxPolarAngle=Math.PI*.87;controls.enabled=false;
  const ray=new T.Raycaster(), plane=new T.Plane(UP,0), cursor=V(), ndc=new T.Vector2();
  const parts=$('parts'), levelBar=$('levels'), chooser=$('preset');
  const free=()=>index===levels.length;
  const all=()=>[...l.fixed,...tiles.values()];
  const tileAt=p=>[...tiles].filter(([,b])=>key(b.p)===key(p));
  for(const p of sandboxPresets)chooser.add(new Option(p.name,p.id));
  const save=()=>{store.index=index;store.builds??={};store.builds[index]=[...tiles.values()].map(savePiece);try{localStorage.setItem(storage,JSON.stringify(store));}catch{}};
  const toast=msg=>{clearTimeout(toastTimer);$('toast').textContent=msg;toastTimer=setTimeout(()=>$('toast').textContent='',1800);};
  const select=i=>{selected=i;erase=false;update();};
  for(const [i,name] of names.entries()){
    const b=document.createElement('button');b.innerHTML=`<span class="part-icon" style="--chip:#${palette[i].toString(16)}">${icons[i]}</span>${name}`;parts.append(b);
    b.addEventListener('pointerdown',e=>{if(state!=='build')return;select(i);drag={id:e.pointerId,x:e.clientX,y:e.clientY,tray:true};b.setPointerCapture(e.pointerId);});
    b.onclick=()=>select(i);
  }
  [...levels,bench].forEach((_,i)=>{const b=document.createElement('button');b.onclick=()=>load(i);levelBar.append(b);});
  function update(){
    const sandbox=free(), s=l.solution.length, count=l.solution.filter(b=>tileAt(b.p).length).length;
    [...levelBar.children].forEach((b,i)=>{b.setAttribute('aria-current',String(index===i));b.textContent=i===levels.length?'Free build':`${String(i+1).padStart(2,'0')}${store.wins?.[i]?' ★':''}`;});
    $('mission-label').textContent=sandbox?'OPEN PLAY':`CHALLENGE ${String(index+1).padStart(2,'0')} / ${String(levels.length).padStart(2,'0')}`;
    $('title').textContent=l.name;$('brief').textContent=l.desc;$('meta').textContent=sandbox?`${new Set(all().map(b=>key(b.p))).size} blocks on the desk`:`${count}/${s} sockets filled   ·   ${l.stars.length} ${l.stars.length===1?'star':'stars'}`;
    $('adjust').hidden=!sandbox;$('library').hidden=!sandbox;chooser.disabled=state!=='build';$('load-preset').disabled=state!=='build'||!chooser.value;
    $('hint').textContent=sandbox?'Sample loop':'Hint';$('desk').classList.toggle('sandbox',sandbox);$('layer').value=`Y ${layer}`;$('tip').textContent=sandbox?'Pick a part, then tap the grid':'Drag a part or tap a blueprint';
    $('erase').setAttribute('aria-pressed',String(erase));[...parts.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===selected&&!erase)));$('hint').disabled=state!=='build';$('go').innerHTML=state==='run'?'■ Stop train':'<span>▶</span> Run train';
  }
  function view(){
    const small=innerWidth<670, over=index===3, wall=index===2, high=free()?Math.max(0,...all().map(b=>b.p.y)):0;
    const span=preset?Math.max(...all().map(b=>Math.abs(b.p.x))):0;
    controls.target.set(over?1:high?-.7:0,over?-1:wall?1.2:high*.42+.05,0);
    camera.position.copy(controls.target).add(V(over?4.8:3.1,over?5.6:7.6,(small?18.5:11.3)+high*.55+Math.max(0,span-4)*(small?1.65:.5)));
    camera.fov=small?47:36;camera.updateProjectionMatrix();controls.update();
  }
  function orbit(on){orb=on;controls.enabled=on;$('orbit').setAttribute('aria-pressed',String(on));}
  function size(){w.resize(canvas.clientWidth,canvas.clientHeight,Math.min(devicePixelRatio,innerWidth<670?1.35:1.75));view();}
  function makeGrid(){if(grid){scene.remove(grid);grid.geometry.dispose();grid.material.dispose();}grid=new T.GridHelper(11,11,0x240e05,0x240e05);grid.position.set(0,layer-.362,0);grid.material.transparent=true;grid.material.opacity=layer===0?.22:.32;grid.visible=free();scene.add(grid);}
  function load(i, reset=false, chosen=null){
    if($('result').open)$('result').close();
    if(state==='run')audio('stop');
    index=i;state='build';running=null;drag=null;orbit(false);selected=0;erase=false;layer=0;axes.identity();
    if(free()&&(reset||chosen))store.preset=chosen?.id;
    preset=free()?sandboxPresets.find(p=>p.id===store.preset):null;
    l=levels[i]||(preset?{...bench,name:preset.name,desc:preset.description,start:preset.path[0],fixed:[preset.path[0]],supports:preset.supports}:bench);
    if(free())chooser.value=preset?.id||'';
    tiles=savedTiles(chosen?[...chosen.path.slice(1),...chosen.extra]:reset?[]:(store.builds?.[i]||[]).map(x=>piece(...x)));
    things.traverse(o=>{if(o.isMesh&&(o.material?.wireframe||o.userData.oneOff))o.material.dispose();});things.clear();
    bounds=w.setDesk(i===3?{w:8.8,d:7.4,x:-.38}:preset?{w:12.4,d:8.4}:{w:11,d:7.4});rail=new T.Group();ghost=new T.Group();things.add(rail,ghost);
    car=train(things);markers=new Map();
    for(const b of l.fixed)block(b,things);
    if(l.supports?.length){
      const material=plastic(0xf8f1e7,.45);
      for(const {x,z,height} of l.supports)cube(.24,height,.24,.04,material,things,V(x,height/2-.366,z)).userData.oneOff=true;
    }
    for(const [b,kind,color] of [[l.start,'start',0xffba46],...(l.goal?[[l.goal,'goal',0xffffff]]:[])])badge(things,b.p.clone().add(V(0,.38,-.25)),color,kind);
    for(const k of l.stars){const b=l.route.find(b=>key(b.p)===k);markers.set(k,badge(things,b.p.clone().add(V(0,.63,.03)),0xffbf21,'star'));}
    poseTrain(car,sample(l.start,.26));makeGrid();rebuild();save();view();
  }
  function rebuild(){
    rail.clear();blockMeshes.clear();ghost.traverse(o=>{if(o.isMesh)o.material.dispose();});ghost.clear();
    for(const b of tiles.values())blockMeshes.set(b,block(b,rail));
    for(const b of l.solution)if(!tileAt(b.p).length)block(b,ghost,true);
    update();
  }
  function place(p){
    if(!p||state!=='build')return;
    const k=key(p), existing=tileAt(p);
    if(l.fixed.some(b=>key(b.p)===k))return;
    if(erase){
      if(!existing.length)return;
      for(const [id] of existing)tiles.delete(id);
      rebuild();save();return;
    }
    if(existing.length){toast('Remove the existing part first');return;}
    let b;
    if(!free()){
      b=l.solution.find(b=>key(b.p)===k);
      if(!b)return;
    }else{
      const dest=[X,V(0,0,-1),Z,UP,V(0,-1)][selected];
      const a=X.clone().applyQuaternion(axes).round(), d=dest.clone().applyQuaternion(axes).round(), n=UP.clone().applyQuaternion(axes).round();
      b=piece(p,a,d,n,tiles.size%6);
    }
    const links=countLatches(b,all());
    tiles.set(k,b);rebuild();save();
    for(let i=0;i<links;i++)audio('latch');
    if(free()&&!links)toast('Loose part. Align a tab and socket to latch it.');
    const o=blockMeshes.get(b);o.userData.drop=performance.now();o.position.y+=.42;
  }
  function screen(p){const r=canvas.getBoundingClientRect(), v=p.clone().project(camera);return [r.left+(v.x+1)*r.width/2,r.top+(1-v.y)*r.height/2];}
  function pick(x,y){
    if(document.elementFromPoint(x,y)!==canvas)return;
    if(!free()){
      let nearest, best=innerWidth<670?29:38;
      for(const b of l.solution){if(tileAt(b.p).length)continue;const [sx,sy]=screen(b.p),d=Math.hypot(sx-x,sy-y);if(d<best){nearest=b.p;best=d;}}
      return nearest;
    }
    const r=canvas.getBoundingClientRect();ndc.set((x-r.left)/r.width*2-1,1-(y-r.top)/r.height*2);ray.setFromCamera(ndc,camera);plane.constant=-layer;
    const p=ray.ray.intersectPlane(plane,cursor)?.round();return p&&Math.abs(p.x)<=7&&Math.abs(p.z)<=5?p.clone():null;
  }
  function down(e){if(orb||state!=='build'||e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,tray:false};canvas.setPointerCapture(e.pointerId);}
  function move(e){if(!drag||e.pointerId!==drag.id)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6)drag.moved=true;if(drag.moved){const p=pick(e.clientX,e.clientY);canvas.style.cursor=p?'grabbing':'default';if(p&&!drag.tray&&!free()&&!tileAt(p).length)place(p);}}
  function up(e){if(drag?.id!==e.pointerId)return;const x=e.clientX,y=e.clientY;if(!drag.tray||drag.moved)place(pick(x,y));drag=null;canvas.style.cursor='';}
  canvas.addEventListener('pointerdown',down);window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',e=>{if(drag?.id===e.pointerId)drag=null;});
  function rotate(axis){axes.premultiply(new T.Quaternion().setFromAxisAngle(axis,Math.PI/2));toast('Part rotated');}
  const setLayer=delta=>{layer=Math.max(-4,Math.min(7,layer+delta));makeGrid();update();};
  function go(){
    if(state==='run'){
      audio('stop');running=null;state='build';rebuild();return;
    }
    running=startRun(l,all(),bounds);
    for(const o of markers.values())o.visible=true;
    for(const o of blockMeshes.values())delete o.userData.drop;
    state='run';orbit(false);poseTrain(car,running.pose);audio('seat');audio('start');update();
  }
  function finish(outcome){
    state='build';rebuild();
    if(outcome==='goal'){store.wins??={};store.wins[index]=true;save();update();audio('win');}
    const atEnd=preset&&running.reason==='end'&&running.route.path.at(-1).block.p.equals(preset.path.at(-1).p);
    $('result-tag').textContent=outcome==='goal'?'CHALLENGE COMPLETE':atEnd?'COURSE COMPLETE':'TRACK CHECK';
    $('result-title').textContent=outcome==='goal'?'Station reached':atEnd?'End of course':'Derailed';
    $('result-copy').textContent=outcome==='goal'?`Perfect run. ${running.stars}/${l.stars.length} stars collected.`:{
      retention:'The train pulled out of the guide on this bend.',
      latch:'A loaded joint popped open. Try another support or a shorter span.',
      guide:'The joint latches, but the grooves face different ways. Roll the next piece to line them up.',
      end:atEnd?'This preset has an open end. Add a return rail or choose another course.':'The rail ends here. Add a block or turn the next piece so the grooves line up.',
    }[running.reason];
    $('next').hidden=outcome!=='goal';$('result').showModal();running=null;
  }
  function step(){
    if(!running)return;
    let outcome;
    running.tick(event=>{
      const {type,...data}=event;
      if(type==='goal'||type==='derail'){outcome=type;return;}
      if(type==='star')markers.get(data.cell).visible=false;
      if(type!=='release')audio(type,data);
    });
    if(running.air){car.position.copy(running.air.p);car.quaternion.copy(running.air.q);}
    else poseTrain(car,running.pose);
    for(const [b,pose] of running.loose){
      const o=blockMeshes.get(b);o.position.copy(pose.p);o.quaternion.copy(pose.q);
    }
    if(outcome)finish(outcome);
  }
  $('result').addEventListener('close',()=>{if($('result').returnValue==='next'){ $('result').returnValue='';load(Math.min(index+1,levels.length));}});
  $('go').onclick=go;$('reset').onclick=()=>load(index,true);
  $('hint').onclick=()=>{
    if(free()){
      if(tiles.size){toast('Clear your build before loading the sample');return;}
      load(index,false,sampleLoop);audio('latch');return;
    }
    const next=l.solution.find(b=>!tileAt(b.p).length);
    if(next){place(next.p);toast('One block fitted');}else toast('The track is ready');
  };
  chooser.onchange=update;
  $('load-preset').onclick=()=>{
    const chosen=sandboxPresets.find(p=>p.id===chooser.value);
    if(chosen){load(index,false,chosen);audio('latch');}
  };
  $('orbit').onclick=()=>orbit(!orb);$('view').onclick=view;
  $('mute').onclick=e=>{const muted=e.target.getAttribute('aria-pressed')!=='true';e.target.setAttribute('aria-pressed',String(muted));e.target.textContent=muted?'♪̸':'♪';audio('mute',{muted});};
  $('higher').onclick=()=>setLayer(1);$('lower').onclick=()=>setLayer(-1);$('yaw').onclick=()=>rotate(UP);$('pitch').onclick=()=>rotate(Z);$('roll').onclick=()=>rotate(X);$('erase').onclick=()=>{erase=!erase;update();};
  window.addEventListener('keydown',e=>{if(e.target.matches('button, select')||$('result').open)return;if(e.code==='Space'){e.preventDefault();go();}if(e.key==='o')orbit(!orb);if(e.key==='Escape')load(index);if(free()){if(e.key==='r')rotate(UP);if(e.key==='t')rotate(Z);if(e.key==='f')rotate(X);if(e.key==='[')setLayer(-1);if(e.key===']')setLayer(1);}});
  window.addEventListener('resize',size);load(index);size();let last=performance.now(),acc=0;
  function frame(t){acc+=Math.min(.25,(t-last)/1000);last=t;while(acc>=PHYSICS_STEP){step();acc-=PHYSICS_STEP;}if(running?.phase==='rail')audio('motor',{speed:running.speed,load:running.load});for(const o of rail.children)if(o.userData.drop!==undefined){const b=o.userData.cell,r=Math.max(0,1-(t-o.userData.drop)/190);o.position.y=b.p.y+.42*r*r;if(r===0)delete o.userData.drop;}for(const o of markers.values())o.rotation.y=t*.0014;w.draw();requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
  globalThis.RB={
    screen,cells:()=>l.solution.map(b=>b.p.toArray()),
    snapshot:()=>({level:index,mode:state,blocks:tiles.size,preset:preset?.id,outcome:running?.route.result,
      phase:running?.phase,reason:running?.reason,laps:running?.laps,speed:running?.speed,train:car.position.toArray()}),
    solutions:()=>levels.map(l=>{
      const r=routeFor(l,[...l.fixed,...l.solution]);
      return {name:l.name,outcome:r.result,stars:r.stars,total:l.stars.length,empty:routeFor(l,l.fixed).result};
    }),
  };
}
