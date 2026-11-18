import {V,UP,line,buildRoute,simulate,at,savePiece,piece} from './track.mjs';
import {block,cube,plastic,train,poseTrain,gradePalette} from './scene.mjs';
const c=(x,y,z)=>[x,y,z], clamp=x=>Math.max(0,Math.min(1,x)), smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export const shotIds=['coasters','edge','halfpipe','climb','spiral','layered','tower'];
const cameras=[
  {eye:[8.4,5.4,10.6],look:[0,1.24,0],fov:44},
  {eye:[3.25,1.55,6.8],look:[.1,-.77,-.05],fov:40},
  {eye:[2.4,2.65,6.35],look:[0,.57,.02],fov:37},
  {eye:[3,2.85,7.65],look:[.1,1.49,0],fov:39},
  {eye:[3.25,2.4,6.8],look:[.05,2.18,.2],fov:43},
  {eye:[5.9,3.7,8.6],look:[0,.94,0],fov:38},
  {eye:[3.7,3.1,7.4],look:[.25,2.43,0],fov:42},
];
export function stage(w,id){
  const i=shotIds.indexOf(id);if(i<0)throw new Error('Unknown shot: '+id);
  const camera=cameras[i], objects=[], trains=[], g=w.things;
  w.setDesk(i===1?{white:true,w:15,d:7,z:-3.65,bg:0x19191d,floor:-8}:i>=2&&i<6?{white:true,w:17,d:10,z:2.9,bg:0x17171b,floor:-8}:{w:12.5,d:9.2,bg:0x222023,legs:false,floor:-8});
  function add(b,when=0,offset=V(0,1.5,0)){
    const o=block(b,g);if(when!==0)objects.push({o,p:b.p.clone(),when,offset});return o;
  }
  function route(anchors,{closed=true,colors,n=UP,when=()=>0,offset,phase=0,speed=2.6,start=0,mode='wrap',motor=true}={}){
    const points=line(anchors); if(closed)points.pop();
    const blocks=buildRoute(points,{closed,colors,n});blocks.forEach((b,j)=>add(b,when(j,b),offset));
    if(motor)trains.push({o:train(g),run:simulate({start:blocks[0],stars:[]},blocks),phase,speed,start,mode});
  }
  function upright(x0,x1,y0,y1,z,opts){route([c(x0+1,y0,z),c(x1,y0,z),c(x1,y1,z),c(x0,y1,z),c(x0,y0,z),c(x0+1,y0,z)],opts);}
  function flat(x0,x1,z0,z1,y,opts){route([c(x0+1,y,z1),c(x1,y,z1),c(x1,y,z0),c(x0,y,z0),c(x0,y,z1),c(x0+1,y,z1)],opts);}
  function posts(xs,zs,h){const m=plastic(0xf8f1e7,.5);for(const x of xs)for(const z of zs)cube(.127,h,.137,.025,m,g,V(x,h/2-.35,z));}
  function trim(a,p,m){cube(...a,.04,m,g,V(...p));}
  function halfpipe(){
    route([[-1,2,0],[-1,0,0],[1,0,0],[1,2,0]],{closed:false,n:V(1),colors:[3],start:1.25,mode:'bounce',speed:1.57,when:(j)=>i===2?.31+j*.1:0,offset:V(jitter(i),0,0)});
    route([[-1,2,-1],[-1,0,-1],[1,0,-1],[1,2,-1]],{closed:false,n:V(1),colors:[3],motor:false,when:()=>i===2?2.72:0,offset:V(1.5,0,2.2)});
    route([[-1,1,-1],[-1,2,-1],[-1,3,-1],[-1,3,0],[-1,3,1],[-1,2,1]],{closed:false,n:V(1),colors:[3,1,3,1],motor:false,when:()=>i===2?3.49:0,offset:V(-1.6,.95,0)});
  }
  if(i===0){
    upright(-4,-1,0,3,1,{phase:1,speed:3.4});upright(1,4,0,4,1,{phase:6,speed:3.9});
    upright(-3,2,1,5,-2,{phase:3,speed:3.6});flat(-5,4,-3,3,0,{phase:1,speed:3.6});
    upright(3,5,0,2,-2,{motor:false,colors:[4,3,2,1,0,5]});posts([-2,1],[-2.35],4.1);
  }else if(i===1){
    route([[-1,0,-1],[2,0,-1],[2,0,0],[2,-2,0],[-2,-2,0],[-2,0,0],[-2,0,-1],[-1,0,-1]],{colors:[3,2,2,0,1,0,2,2,0,1,0,2],start:.04,phase:.6,speed:4.1});
  }else if(i===2||i===3){
    halfpipe();
    if(i===3){
      upright(1,3,0,3,-1,{colors:[3,2,0,2,0,0,0,2,2,4],when:(j,b)=>.32+Math.max(0,b.p.y)*.23,offset:V(.3,2.5,0),phase:1.2,start:.9,speed:2.45});
      w.camera.setViewOffset(720,720,0,0,720,720);
    }
  }else if(i===4){
    upright(-3,3,0,5,-1,{colors:[2,2,2,1,1,1,2,2,1,1,2,2,1],phase:2,speed:3.9});
    upright(-2,2,0,4,0,{colors:[2,2,1,2,2,1,1,2],motor:false});
    upright(-1,1,1,3,1,{colors:[3,3,5,4,3,5,3,4],phase:1.3,speed:3.45});
  }else if(i===5){
    flat(-3,3,-2,2,0,{colors:[2,2,2,1],phase:1,speed:3.8});
    flat(-2,2,-2,2,.48,{colors:[4,4,3,4,2],motor:false});
    upright(-2,2,.6,3.6,0,{colors:[4,4,3,3,2,2,2,4],phase:6.4,speed:3.2});
    upright(-1,1,.62,2.62,-1,{colors:[3,3,4,2],motor:false});
  }else{
    flat(-4,4,-3,3,0,{colors:[3,2,4,3,5],speed:3.5,phase:1.3});
    upright(-3,3,0,5,0,{colors:[3,3,4,4,1,2,4,5,3,4,0],speed:4.2,phase:4.5});
    upright(-4,-1,0,4,2,{colors:[2,3,2,4,0,0,1,0],speed:3.6,phase:4.72});
    upright(0,3,0,3,2,{colors:[1,3,4,0,1,0,0],motor:false});
    flat(-3,3,-2,1,3,{colors:[0,0,1,2,3,1,0,0],speed:3.5,phase:1.7});
    flat(-3,3,-2,1,4.5,{colors:[3,5,4,3,1,2],motor:false});posts([-3,-.5,2.65],[-2.24,.7],4.4);
  }
  function draw(t,fit={}){
    for(const {o,p,when,offset} of objects){
      const f=smooth((t-when)/.46);o.visible=t>=when-.02;o.position.copy(p).addScaledVector(offset,1-f);
      o.rotation.z=(1-f)*.22;
    }
    for(const {o,run,phase,speed,start,mode} of trains){
      const travel=Math.max(0,t-start)*speed+phase;let u=travel;
      o.visible=t>=start-.48;
      if(mode==='bounce')u=run.dist-Math.abs(travel%(2*run.dist)-run.dist);
      else if(run.result!=='loop')u=travel%run.dist;
      const s=at(run,u);if(mode==='bounce'&&travel%(2*run.dist)>run.dist)s.d.negate();
      poseTrain(o,s);if(t<start)o.position.y+=(1-smooth((t-start+.48)/.48))*.8;
    }
    const eye=V(...camera.eye), look=V(...camera.look);
    if(i===6)eye.lerp(V(7.55,4.4,10),smooth((t-.65)/1.35));
    if(i===3)eye.lerp(V(4.1,3.6,9.8),smooth((t-1.8)/1.3));
    if(i===0)eye.x-=t*.52;
    eye.x+=fit.x||0;eye.y+=fit.y||0;look.y+=fit.aim||0;
    w.camera.position.copy(eye);w.camera.lookAt(look);w.camera.fov=camera.fov+(fit.fov||0);w.camera.updateProjectionMatrix();
    w.renderer.toneMappingExposure=fit.light||1.11;g.scale.x=fit.layout||1;gradePalette(fit.palette||1);w.draw();
  }
  return draw;
}
function jitter(i){return i===2?1.3:0;}
