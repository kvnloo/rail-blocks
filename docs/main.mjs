import {createWorld} from './scene.mjs';
import {stage,shotIds} from './shots.mjs';
const params=new URLSearchParams(location.search), id=params.get('shot');
const canvas=document.querySelector('#world');
if(id!==null){
  document.body.classList.add('film');
  const w=createWorld(canvas,{film:true,quality:params.get('quality')!=='draft'});
  w.resize(innerWidth,innerHeight);
  const name=shotIds.includes(id)?id:shotIds[Number(id)-1];
  const render=stage(w,name);
  const grading=[{"x":1.6,"y":1.15,"fov":6,"layout":0.78,"light":1.42,"palette":0.72},{"x":1.6,"y":1.15,"layout":0.78,"light":1.42,"palette":0.72},{"x":-1.6,"y":1.15,"aim":-0.55,"fov":-6,"layout":0.78,"light":1.42,"palette":0.72},{"x":1.6,"y":1.15,"aim":-0.55,"fov":6,"layout":0.78,"light":1.42,"palette":0.72},{"y":1.15,"aim":-0.55,"light":0.8,"palette":0.72},{"x":1.6,"aim":-0.55,"fov":6,"layout":0.78,"light":1.42,"palette":0.72},{"x":-1.6,"y":-1.15,"aim":0.55,"fov":-6,"light":0.8,"palette":0.72}];
  globalThis.RBShot={id:name,render:(t,fit=grading[shotIds.indexOf(name)])=>render(Math.max(0,Number(t)||0),fit)};
  RBShot.render(params.get('t'));
  if(params.has('capture'))globalThis.RBShot.png=(t,fit)=>{RBShot.render(t,fit);return canvas.toDataURL('image/png').split(',')[1];};
}else{
  try{const {play}=await import('./play.mjs');play(canvas);}
  catch(e){document.querySelector('#toast').textContent='Rail Blocks needs WebGL 2. Try a current Chrome, Firefox, or Safari.';throw e;}
}
