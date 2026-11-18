import {Vector3, Matrix4, Quaternion} from './vendor/three.module.min.js';
export const V=(x=0,y=0,z=0)=>new Vector3(x,y,z);
export const AXES=[V(1),V(-1),V(0,1),V(0,-1),V(0,0,1),V(0,0,-1)];
export const UP=AXES[2], key=p=>p.toArray().map(x=>Math.round(x)).join(','), palette=[0xf94345,0xff791b,0xffcf22,0x53c42c,0x168ae0,0xa552df];
const vec=a=>Array.isArray(a)?V(...a):a.clone();
export function piece(p,a,b,n=UP,c=0){return {p:vec(p),a:vec(a),b:vec(b),n:vec(n),c};}
export const length=b=>b.a.dot(b.b)>.5?1:Math.PI/4;
export function sample(b,u){
  let {a,n,p}=b, d=b.b;
  if(a.dot(d)>.5) return {p:p.clone().addScaledVector(a,u-.5),d:a.clone(),n:n.clone()};
  const axis=a.clone().cross(d), q=u*Math.PI/2;
  return {p:p.clone().addScaledVector(a,(Math.sin(q)-1)/2).addScaledVector(d,(1-Math.cos(q))/2),d:a.clone().applyAxisAngle(axis,q),n:n.clone().applyAxisAngle(axis,q)};
}
export const attitude=({d,n})=>new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(n.clone().cross(d),n,d));
export function buildRoute(points,{closed=false,n=UP,colors=[0,1,2,3,4,5]}={}){
  const p=points.map(x=>V(...x)), out=[]; let normal=n.clone();
  for(let i=closed?0:1;i<p.length-(closed?0:1);i++){
    const a=p[i].clone().sub(p[(i+p.length-1)%p.length]), b=p[(i+1)%p.length].clone().sub(p[i]);
    if(Math.abs(a.lengthSq()-1)>0.001||Math.abs(b.lengthSq()-1)>0.001||a.dot(b)<-.5||Math.abs(a.dot(normal))>.001) throw new Error('Invalid track at '+p[i].toArray());
    const block=piece(p[i],a,b,normal,colors[out.length%colors.length]); out.push(block); normal=sample(block,1).n;
  }
  return out;
}
export function line(points){
  const r=[points[0]];
  for(const target of points.slice(1)){
    const cur=r.at(-1).slice();
    for(let i=0;i<3;i++){const delta=target[i]-cur[i], start=cur[i];for(let j=1;j<=Math.round(Math.abs(delta));j++){cur[i]=j===Math.round(Math.abs(delta))?target[i]:start+j*Math.sign(delta);r.push(cur.slice());}}
  }
  return r;
}
const make=(name,desc,anchors,gaps,stars)=>{
  const route=buildRoute(line(anchors));
  return {name,desc,fixed:route.filter((_,i)=>!gaps.includes(i)),solution:gaps.map(i=>route[i]),start:route[0],goal:route.at(-1),stars:stars.map(i=>key(route[i].p)),route};
};
export const levels=[
  make('First click','Bridge the two blueprints and ride to the station.',[[-4,0,0],[4,0,0]],[2,3],[3]),
  make('Table bend','Turn the corner and catch both stars.',[[-4,0,1],[-1,0,1],[-1,0,-2],[3,0,-2]],[2,3,5],[3,5]),
  make('Wall ride','Stack the blueprints. The magnet does the rest.',[[-4,0,0],[0,0,0],[0,3,0],[-4,3,0]],[3,4,6,7],[4,6,8]),
  make('Over the edge','Take the train off the desk and back underneath.',[[-3,0,0],[5,0,0],[5,-3,0],[0,-3,0]],[3,6,7,9,10],[6,9,11])
];
function fromEnd(block,reverse,u){const s=sample(block,reverse?1-u:u);if(reverse)s.d.negate();return s;}
export function simulate(l,blocks){
  const map=new Map(blocks.map(b=>[key(b.p),b])), path=[]; const seen=new Set(), collected=new Set();
  let block=l.start, reverse=false, dist=0;
  while(block){
    const k=key(block.p), id=k+reverse;
    if(seen.has(id))return {path,dist,stars:collected.size,result:'loop'};
    seen.add(id); if(l.stars.includes(k))collected.add(k);
    const end=dist+length(block); path.push({block,reverse,start:dist,end});dist=end;
    if(l.goal && k===key(l.goal.p))return {path,dist,stars:collected.size,result:'goal'};
    const exit=fromEnd(block,reverse,1), next=map.get(key(block.p.clone().add(exit.d)));
    const backwards=next?.b.dot(exit.d)<-.999;
    if(!next||(!backwards&&next.a.dot(exit.d)<.999)||fromEnd(next,backwards,0).n.dot(exit.n)<.999)break;
    block=next; reverse=backwards;
  }
  return {path,dist,stars:collected.size,result:'derail'};
}
export function at(run,d){
  if(run.result==='loop') d=((d%run.dist)+run.dist)%run.dist;
  d=Math.max(0,Math.min(d,run.dist));
  const s=run.path.find(s=>d<=s.end)||run.path.at(-1);return fromEnd(s.block,s.reverse,(d-s.start)/(s.end-s.start));
}
export const savePiece=b=>[b.p.toArray(),b.a.toArray(),b.b.toArray(),b.n.toArray(),b.c];
