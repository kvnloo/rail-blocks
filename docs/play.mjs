import * as T from './vendor/three.module.min.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {V,UP,piece,key,palette,levels,simulate,at,savePiece,buildRoute,line} from './track.mjs';
import {createWorld,block,train,poseTrain,badge,plastic} from './scene.mjs';
const $=id=>document.getElementById(id), X=V(1), Z=V(0,0,1);
const names=['Straight','Left bend','Right bend','Climb','Drop'], icons=['━','┓','┏','↗','↘'];
const storage='rail-blocks-3d-v1', depot=piece([-3,0,0],X,X,UP,0), bench={name:'Free build',desc:'Place rails on any layer. Turn, tilt and roll them to mate the grooves.',fixed:[depot],start:depot,stars:[],solution:[]};
const exampleLoop=buildRoute(line([[-3,0,0],[2,0,0],[2,4,0],[-4,4,0],[-4,0,0],[-3,0,0]]).slice(0,-1),{closed:true}).slice(1);
function read(){try{return JSON.parse(localStorage.getItem(storage))||{};}catch{return {};}}
function sound(){
  let ctx, motor, muted=false;
  function open(){if(muted)return;try{ctx??=new AudioContext();ctx.resume();return ctx;}catch{}}
  function click(f=420){const a=open();if(!a)return;const o=a.createOscillator(),g=a.createGain(),t=a.currentTime;o.type='triangle';o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*.42,t+.07);g.gain.setValueAtTime(.15,t);g.gain.exponentialRampToValueAtTime(.001,t+.095);o.connect(g).connect(a.destination);o.start();o.stop(t+.1);}
  function stop(){if(motor){motor[0].stop();motor=null;}}
  return {click,stop,begin(){stop();const a=open();if(!a)return;const o=a.createOscillator(),g=a.createGain();o.type='triangle';o.frequency.value=58;g.gain.value=.027;o.connect(g).connect(a.destination);o.start();motor=[o,g];},rev(s){if(motor)motor[0].frequency.setTargetAtTime(58+s*20,ctx.currentTime,.08);},mute(m){muted=m;if(m)stop();}};
}
export function play(canvas){
  const w=createWorld(canvas), {scene,camera,things}=w, audio=sound();
  let store=read(), index=Math.min(levels.length,Math.max(0,store.index||0)), l, tiles, rail, ghost, car, grid, bounds, markers, running, state='build', toastTimer, moves, selected=0, erase=false, layer=0, orb=false, axes=new T.Quaternion(), drag=null;
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.minDistance=4.5;controls.maxDistance=35;controls.maxPolarAngle=Math.PI*.87;controls.enabled=false;
  const ray=new T.Raycaster(), plane=new T.Plane(UP,0), cursor=V(), ndc=new T.Vector2();
  const parts=$('parts'), levelBar=$('levels'), dock=$('dock');
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
    const free=l===bench, s=l.solution.length, count=l.solution.filter(b=>tiles.has(key(b.p))).length;
    [...levelBar.children].forEach((b,i)=>{b.setAttribute('aria-current',String(index===i));b.textContent=i===levels.length?'Free build':`${String(i+1).padStart(2,'0')}${store.wins?.[i]?' ★':''}`;});
    $('mission-label').textContent=free?'OPEN PLAY':`CHALLENGE ${String(index+1).padStart(2,'0')} / ${String(levels.length).padStart(2,'0')}`;
    $('title').textContent=l.name;$('brief').textContent=l.desc;$('meta').textContent=free?`${tiles.size} blocks on the desk`:`${count}/${s} sockets filled   ·   ${l.stars.length} ${l.stars.length===1?'star':'stars'}`;
    $('adjust').hidden=!free;$('hint').textContent=free?'Sample loop':'Hint';$('layer').value=`Y ${layer}`;$('tip').textContent=free?'Pick a part, then tap the grid':'Drag a part or tap a blueprint';
    $('erase').setAttribute('aria-pressed',String(erase));[...parts.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===selected&&!erase)));$('hint').disabled=state!=='build';$('go').innerHTML=state==='run'?'■ Stop train':'<span>▶</span> Run train';
  }
  function view(){
    const small=innerWidth<670, over=index===3, wall=index===2, free=l===bench, high=free?Math.max(0,...[...tiles.values()].map(b=>b.p.y)):0;
    controls.target.set(over?1:high?-.7:0,over?-1:wall?1.2:high*.42+.05,0);
    camera.position.copy(controls.target).add(V(over?4.8:3.1,over?5.6:7.6,(small?18.5:11.3)+high*.43));
    camera.fov=small?47:36;camera.updateProjectionMatrix();controls.update();
  }
  function orbit(on){orb=on;controls.enabled=on;$('orbit').setAttribute('aria-pressed',String(on));}
  function size(){w.resize(canvas.clientWidth,canvas.clientHeight,Math.min(devicePixelRatio,innerWidth<670?1.35:1.75));view();}
  function makeGrid(){if(grid){scene.remove(grid);grid.geometry.dispose();grid.material.dispose();}grid=new T.GridHelper(11,11,0x240e05,0x240e05);grid.position.set(0,layer-.362,0);grid.material.transparent=true;grid.material.opacity=layer===0?.22:.32;grid.visible=l===bench;scene.add(grid);}
  function load(i,reset=false){
    if($('result').open)$('result').close();audio.stop();index=i;l=levels[i]||bench;state='build';running=null;drag=null;orbit(false);selected=0;erase=false;layer=0;axes.identity();moves=0;
    tiles=new Map((reset?[]:store.builds?.[i]||[]).map(x=>{const b=piece(...x);return [key(b.p),b];}));
    things.traverse(o=>{if(o.isMesh&&(o.material?.wireframe||o.userData.oneOff))o.material.dispose();});things.clear();
    bounds=w.setDesk(i===3?{w:8.8,d:7.4,x:-.38}:{w:11,d:7.4});rail=new T.Group();ghost=new T.Group();things.add(rail,ghost);
    car=train(things);markers=new Map();
    for(const b of l.fixed)block(b,things);
    for(const [b,kind,color] of [[l.start,'start',0xffba46],...(l.goal?[[l.goal,'goal',0xffffff]]:[])])badge(things,b.p.clone().add(V(0,.38,-.25)),color,kind);
    for(const k of l.stars){const b=l.route.find(b=>key(b.p)===k);markers.set(k,badge(things,b.p.clone().add(V(0,.63,.03)),0xffbf21,'star'));}
    poseTrain(car,at(simulate(l,[...l.fixed]),.26));makeGrid();rebuild();save();view();
  }
  function rebuild(){
    rail.clear();ghost.traverse(o=>{if(o.isMesh)o.material.dispose();});ghost.clear();
    for(const b of tiles.values())block(b,rail);
    for(const b of l.solution)if(!tiles.has(key(b.p)))block(b,ghost,true);
    update();
  }
  function place(p){
    if(!p||state!=='build')return;const k=key(p);
    if(l.fixed.some(b=>key(b.p)===k))return;
    if(erase){if(!tiles.delete(k))return;}
    else if(l!==bench){const b=l.solution.find(b=>key(b.p)===k);if(!b||tiles.has(k))return;tiles.set(k,b);}
    else{
      const dest=[X,V(0,0,-1),Z,UP,V(0,-1)][selected];
      const a=X.clone().applyQuaternion(axes).round(), b=dest.clone().applyQuaternion(axes).round(), n=UP.clone().applyQuaternion(axes).round();tiles.set(k,piece(p,a,b,n,tiles.size%6));
    }
    moves++;rebuild();save();audio.click(465+(moves%4)*90);const o=rail.children.find(o=>key(o.userData.cell.p)===k);if(o){o.userData.drop=performance.now();o.position.y+=.42;}
  }
  function screen(p){const r=canvas.getBoundingClientRect(), v=p.clone().project(camera);return [r.left+(v.x+1)*r.width/2,r.top+(1-v.y)*r.height/2];}
  function pick(x,y){
    if(document.elementFromPoint(x,y)!==canvas)return;
    if(l!==bench){
      let nearest, best=innerWidth<670?29:38;
      for(const b of l.solution){if(tiles.has(key(b.p)))continue;const [sx,sy]=screen(b.p),d=Math.hypot(sx-x,sy-y);if(d<best){nearest=b.p;best=d;}}
      return nearest;
    }
    const r=canvas.getBoundingClientRect();ndc.set((x-r.left)/r.width*2-1,1-(y-r.top)/r.height*2);ray.setFromCamera(ndc,camera);plane.constant=-layer;
    const p=ray.ray.intersectPlane(plane,cursor)?.round();return p&&Math.abs(p.x)<=7&&Math.abs(p.z)<=5?p.clone():null;
  }
  function down(e){if(orb||state!=='build'||e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,tray:false};canvas.setPointerCapture(e.pointerId);}
  function move(e){if(!drag||e.pointerId!==drag.id)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6)drag.moved=true;if(drag.moved){const p=pick(e.clientX,e.clientY);canvas.style.cursor=p?'grabbing':'default';if(p&&!drag.tray&&l!==bench)place(p);}}
  function up(e){if(drag?.id!==e.pointerId)return;const x=e.clientX,y=e.clientY;if(!drag.tray||drag.moved)place(pick(x,y));drag=null;canvas.style.cursor='';}
  canvas.addEventListener('pointerdown',down);window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',e=>{if(drag?.id===e.pointerId)drag=null;});
  function rotate(axis){axes.premultiply(new T.Quaternion().setFromAxisAngle(axis,Math.PI/2));audio.click(680);toast('Part rotated');}
  const setLayer=delta=>{layer=Math.max(-4,Math.min(7,layer+delta));makeGrid();update();};
  function go(){if(state==='run'){audio.stop();running=null;state='build';update();return;}const route=simulate(l,[...l.fixed,...tiles.values()]);running={route,d:.2,speed:.9,phase:'rail',seen:new Set()};for(const o of markers.values())o.visible=true;state='run';orbit(false);audio.begin();update();}
  function finish(outcome){
    state='build';audio.stop();update();
    if(outcome==='goal'){store.wins??={};store.wins[index]=true;save();update();audio.click(1100);}
    $('result-tag').textContent=outcome==='goal'?'CHALLENGE COMPLETE':'TRACK CHECK';
    $('result-title').textContent=outcome==='goal'?'Station reached':'Derailed';
    $('result-copy').textContent=outcome==='goal'?`Perfect run. ${running.route.stars}/${l.stars.length} stars collected.`:'The rail ends here. Add a block or turn the next piece so the grooves line up.';
    $('next').hidden=outcome!=='goal';$('result').showModal();running=null;
  }
  function step(dt){
    if(!running)return;const a=running;
    if(a.phase==='rail'){
      a.speed=Math.min(4.7,a.speed+dt*3.3);audio.rev(a.speed);a.d+=dt*a.speed;const s=at(a.route,a.d);poseTrain(car,s);
      const q=a.route.path.find(p=>a.d<p.end)?.block, k=q&&key(q.p);
      if(markers.has(k)&&!a.seen.has(k)){a.seen.add(k);markers.get(k).visible=false;audio.click(970);}
      if(a.d>=a.route.dist&&a.route.result!=='loop'){
        if(a.route.result==='goal'){finish('goal');return;}
        a.phase='air';a.v=s.d.clone().multiplyScalar(a.speed);a.t=0;a.spin=V(.59,.32,.74).normalize();audio.stop();audio.click(198);
      }
    }else{
      a.t+=dt;a.v.y-=13*dt;const old=car.position.y;car.position.addScaledVector(a.v,dt);car.rotateOnWorldAxis(a.spin,dt*5.6/(1+a.t));
      const {min,max,front,back,floor}=bounds,p=car.position;
      const onDesk=p.x>min&&p.x<max&&p.z<front&&p.z>back&&old>-.16,surface=onDesk?-.15:floor+.19;
      if(p.y<surface&&a.v.y<0){p.y=surface;a.v.y*= -.34;a.v.x*=.61;a.v.z*=.61;if(a.v.y>.45)audio.click(168+a.v.y*60);}
      if(a.t>1.65)finish('derail');
    }
  }
  $('result').addEventListener('close',()=>{if($('result').returnValue==='next'){ $('result').returnValue='';load(Math.min(index+1,levels.length));}});
  $('go').onclick=go;$('reset').onclick=()=>load(index,true);$('hint').onclick=()=>{if(l===bench){if(tiles.size){toast('Clear your build before loading the sample');return;}for(const b of exampleLoop)tiles.set(key(b.p),b);rebuild();save();view();audio.click(620);toast('Ready for an upside-down lap');return;}const b=l.solution.find(b=>!tiles.has(key(b.p)));if(b){place(b.p);toast('One block snapped in');}else toast('The track is ready');};
  $('orbit').onclick=()=>orbit(!orb);$('view').onclick=view;$('mute').onclick=e=>{const on=e.target.getAttribute('aria-pressed')!=='true';e.target.setAttribute('aria-pressed',String(on));e.target.textContent=on?'♪̸':'♪';audio.mute(on);};
  $('higher').onclick=()=>setLayer(1);$('lower').onclick=()=>setLayer(-1);$('yaw').onclick=()=>rotate(UP);$('pitch').onclick=()=>rotate(Z);$('roll').onclick=()=>rotate(X);$('erase').onclick=()=>{erase=!erase;update();};
  window.addEventListener('keydown',e=>{if(e.target.matches('button')||$('result').open)return;if(e.code==='Space'){e.preventDefault();go();}if(e.key==='o')orbit(!orb);if(e.key==='Escape')load(index);if(l===bench){if(e.key==='r')rotate(UP);if(e.key==='t')rotate(Z);if(e.key==='f')rotate(X);if(e.key==='[')setLayer(-1);if(e.key===']')setLayer(1);}});
  window.addEventListener('resize',size);load(index);size();let last=performance.now(),acc=0;
  function frame(t){acc+=Math.min(.25,(t-last)/1000);last=t;while(acc>=1/120){step(1/120);acc-=1/120;}for(const o of rail.children)if(o.userData.drop!==undefined){const b=o.userData.cell,r=Math.max(0,1-(t-o.userData.drop)/190);o.position.y=b.p.y+.42*r*r;if(r===0)delete o.userData.drop;}for(const o of markers.values())o.rotation.y=t*.0014;w.draw();requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
  globalThis.RB={screen,cells:()=>l.solution.map(b=>b.p.toArray()),snapshot:()=>({level:index,mode:state,blocks:tiles.size,outcome:running?.route.result,phase:running?.phase,train:car.position.toArray()}),solutions:()=>levels.map(l=>{const r=simulate(l,[...l.fixed,...l.solution]);return {name:l.name,outcome:r.result,stars:r.stars,total:l.stars.length,empty:simulate(l,l.fixed).result};})};
}
