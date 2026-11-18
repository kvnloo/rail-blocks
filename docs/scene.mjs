import * as T from './vendor/three.module.min.js';
import {V, palette, sample, attitude, piece} from './track.mjs';
export const plastic=(color,roughness=.31)=>new T.MeshStandardMaterial({color,roughness});
const box=new Map();
function rounded(w,h,d,r){
  const id=[w,h,d,r].join(); if(box.has(id))return box.get(id);
  const g=new T.BoxGeometry(2,2,2,7,7,7), a=g.attributes.position, n=g.attributes.normal;
  for(let i=0;i<a.count;i++){
    const v=V(a.getX(i),a.getY(i),a.getZ(i)), b=v.clone().multiply(V(w/2,h/2,d/2));
    const center=V(...b.toArray().map((x,j)=>T.MathUtils.clamp(x,-[w,h,d][j]/2+r,[w,h,d][j]/2-r)));
    const normal=b.sub(center).normalize();b.copy(center).addScaledVector(normal,r);
    a.setXYZ(i,...b.toArray()); n.setXYZ(i,...normal.toArray());
  }
  box.set(id,g);return g;
}
export function mesh(g,m,parent,p=V(),shadows=true){const o=new T.Mesh(g,m);o.position.copy(p);o.castShadow=shadows;o.receiveShadow=shadows;parent.add(o);return o;}
export const cube=(w,h,d,r,m,parent,p,shadow)=>mesh(rounded(w,h,d,r),m,parent,p,shadow);
const dim=new T.CircleGeometry(.051,12), pin=new T.CircleGeometry(.032,12);
const mats=palette.map(c=>[plastic(c),plastic(new T.Color(c).multiplyScalar(.61)),plastic(new T.Color(c).multiplyScalar(.22))]);
const baseColors=mats.map(a=>a.map(m=>m.color.clone()));
export function gradePalette(s){for(let i=0;i<mats.length;i++)for(let j=0;j<3;j++){const c=baseColors[i][j],l=.2126*c.r+.7152*c.g+.0722*c.b;mats[i][j].color.copy(c).lerp(new T.Color(l,l,l),1-s);}}
const trackGeo=new Map(), forward=V(0,0,1), up=V(0,1,0), right=V(1);
function sweep(b,profile){
  const points=[], idx=[], rows=b.a.dot(b.b)>.5?5:15, stride=profile.length;
  for(let i=0;i<=rows;i++){
    const {p,d,n}=sample(b,.028+i/rows*.944), s=n.clone().cross(d);
    for(const [x,y] of profile)points.push(...p.clone().addScaledVector(s,x).addScaledVector(n,y).toArray());
  }
  const end=rows*stride;
  for(let j=1;j<stride-1;j++)idx.push(0,j+1,j,end,end+j,end+j+1);
  for(let i=0;i<rows;i++)for(let j=0;j<stride;j++){
    const a=i*stride+j,k=i*stride+(j+1)%stride;idx.push(a,k,a+stride,k,k+stride,a+stride);
  }
  const g=new T.BufferGeometry();g.setIndex(idx);g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.computeVertexNormals();return g;
}
export function block(b,parent,ghost=false){
  const o=new T.Group(), q=attitude({d:b.a,n:b.n}), local=b.b.clone().applyQuaternion(q.clone().invert()), id=local.toArray().map(Math.round).join();
  o.position.copy(b.p);o.quaternion.copy(q);parent.add(o);
  const canonical=piece(V(),forward,local,up,b.c), tight=Math.abs(local.x)>.9&&Math.abs(local.y)<.1;
  if(!trackGeo.has(id)){
    const w=tight?.345:.426;
    // Convex strips, leaving the recessed magnetic channel open between the rims.
    trackGeo.set(id,[
      sweep(canonical,[[-w+.05,-.37],[w-.05,-.37],[w,-.32],[w,-.03],[w-.035,.025],[-w+.035,.025],[-w,-.03],[-w,-.32]]),
      ...[-1,1].map(s=>{const a=[[.19,.011],[w-.016,.011],[w-.025,.135],[w-.065,.182],[.25,.182],[.208,.135]];return sweep(canonical,a.map(([x,y])=>[s*x,y])[s>0?'slice':'reverse']());}),
      sweep(canonical,[[-.115,.027],[.115,.027],[.105,.038],[-.105,.038]])
    ]);
  }
  const [m,dark,hole]=mats[b.c%6];
  const ghostMat=new T.MeshBasicMaterial({color:0x79eeff,wireframe:true,opacity:.24,transparent:true,depthWrite:false});
  trackGeo.get(id).forEach((g,i)=>mesh(g,ghost?ghostMat:i===3?dark:m,o,V(),!ghost));
  if(!ghost){
    ghostMat.dispose();
    for(const u of [.34,.66]){
      const s=sample(canonical,u), x=s.n.clone().cross(s.d), w=tight?.346:.427;
      for(const side of [-1,1]){
        const n=x.clone().multiplyScalar(side), p=s.p.clone().addScaledVector(n,w+.002).addScaledVector(s.n,-.16);
        const cap=mesh(dim,dark,o,p,false); cap.quaternion.setFromUnitVectors(forward,n);
        const pit=mesh(pin,hole,o,p.clone().addScaledVector(n,.002),false);pit.quaternion.copy(cap.quaternion);
      }
    }
  }
  o.userData.cell=b;return o;
}
export function train(parent){
  const o=new T.Group();parent.add(o);
  const white=plastic(0xf9f7e9,.23), blue=plastic(0x174e9d,.26), red=plastic(0xe2403a), black=plastic(0x132639), light=new T.MeshStandardMaterial({color:0xfff3ae,emissive:0xffbd52,emissiveIntensity:2.1});
  const sphere=new T.SphereGeometry(1,20,12);
  function oval(x,y,z,sx,sy,sz,m){const o2=mesh(sphere,m,o,V(x,y,z));o2.scale.set(sx,sy,sz);return o2;}
  oval(0,.13,0,.171,.121,.5,white);
  oval(0,.105,0,.174,.049,.45,blue);
  oval(0,.069,0,.168,.022,.423,red);
  oval(0,.201,.255,.113,.048,.159,black).rotation.x=.21;
  for(const x of [-.149,.149]){
    for(const z of [-.22,-.089,.042])cube(.022,.064,.086,.01,black,o,V(x,.168,z));
    oval(x*.39,.143,.454,.033,.022,.016,light);
  }
  cube(.251,.059,.67,.018,black,o,V(0,.042));return o;
}
export function poseTrain(o,s){o.position.copy(s.p).addScaledVector(s.n,.061);o.quaternion.copy(attitude(s));}
function grain(){
  const c=document.createElement('canvas');c.width=1024;c.height=768;const x=c.getContext('2d');
  let seed=228;const rand=()=>((seed=Math.imul(1664525,seed)+1013904223|0)>>>0)/4294967296;
  for(let row=0;row<8;row++){
    const base=176+rand()*28;x.fillStyle=`rgb(${base+35} ${base+11} ${base-28})`; x.fillRect(0,row*96,1024,96);
    x.fillStyle='#65432d55'; x.fillRect(0,row*96,1024,1.3);
    for(let i=0;i<840;i++){
      let y=row*96+rand()*96,z=rand()*1030,l=15+rand()*240;
      x.strokeStyle=rand()<.53?`rgba(100,58,22,${rand()*.075})`:`rgba(255,241,213,${rand()*.14})`;
      x.beginPath();x.moveTo(z,y);x.bezierCurveTo(z+l*.29,y+rand()*3,z+l*.68,y-rand()*3,z+l,y+rand()*2);x.stroke();
    }
  }
  const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;return tex;
}
export function createWorld(canvas,{film=false,quality=true}={}){
  const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:film});
  renderer.shadowMap.enabled=quality;renderer.shadowMap.type=T.PCFShadowMap;
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.11;
  const scene=new T.Scene(), camera=new T.PerspectiveCamera(36,1,.045,95), desk=new T.Group(), things=new T.Group();scene.add(desk,things);
  scene.background=new T.Color(0xd9d5c9);
  const hemi=new T.HemisphereLight(0xfff6e7,0xaaa0a7,2.1);scene.add(hemi);
  const sun=new T.DirectionalLight(0xffedcf,2.3);sun.position.set(-5,10,6);sun.castShadow=quality;
  Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:.3,far:32});
  sun.shadow.mapSize.set(film?1024:2048,film?1024:2048);sun.shadow.normalBias=.035;sun.shadow.bias=-.0003;scene.add(sun,sun.target);
  const bounce=new T.DirectionalLight(0xb6ddff,.55);bounce.position.set(6,5,-7);scene.add(bounce);
  const wood=new T.MeshStandardMaterial({map:grain(),roughness:.59});
  function setDesk({white=false,w=11,d=7.4,x=0,z=0,bg=0xd9d5c9,floor=-4.5,legs=!white}={}){
    desk.clear();scene.background.set(bg);
    const body=plastic(white?0xf5f4ef:0xac764c,.68), top=white?body:wood;
    cube(w,.36,d,.067,body,desk,V(x,-.55,z));
    const surface=mesh(new T.PlaneGeometry(w-.074,d-.074),top,desk,V(x,-.366,z));surface.rotation.x=-Math.PI/2;
    if(legs)for(const a of [-1,1])for(const b of [-1,1])cube(.43,4.4,.52,.06,body,desk,V(x+a*(w/2-.56),-2.8,z+b*(d/2-.42)));
    const ground=mesh(new T.PlaneGeometry(300,300),plastic(bg,.95),desk,V(0,floor,0));ground.rotation.x=-Math.PI/2;
    return {min:x-w/2,max:x+w/2,front:z+d/2,back:z-d/2,floor};
  }
  function resize(w,h,dpr=1){renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  return {renderer,scene,camera,desk,things,hemi,sun,setDesk,resize,draw:()=>renderer.render(scene,camera)};
}
export function badge(parent,p,color,kind){
  const g=new T.Group();parent.add(g);g.position.copy(p);
  if(kind==='star'){
    const s=new T.Shape();for(let i=0;i<10;i++){
      const a=Math.PI*i/5,r=i%2?.118:.24,x=r*Math.sin(a),y=r*Math.cos(a);i?s.lineTo(x,y):s.moveTo(x,y);
    }
    s.closePath();mesh(new T.ExtrudeGeometry(s,{depth:.047,bevelSize:.021,bevelThickness:.02,bevelSegments:2,steps:1,curveSegments:1}),plastic(color,.2),g);
  }else{
    const m=plastic(color);cube(.042,.55,.042,.012,m,g,V(-.16,.13));cube(.37,.23,.055,.02,m,g,V(.013,.33));
    if(kind==='goal')for(let y=0;y<2;y++)for(let x=0;x<4;x++)if((x+y)%2)cube(.083,.093,.064,.008,plastic(0x1b2633),g,V(-.11+x*.083,.282+y*.09));
  }
  return g;
}
