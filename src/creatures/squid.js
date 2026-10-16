import * as THREE from 'three';
import { U as ENVU } from '../world/env.js';

/* The colossal squid — hero centrepiece.
   Built from Nyenz's Squid part 1 (procedural lathe geometry + Verlet limb chains skinned in the
   vertex shader), corrected against the reference model:
   - plump red mantle, wide flared collar around a deep dark opening, small head with a big eye
   - large diamond fin with see-through veined margins that folds down during jets
   - pale teal-white arms with pink bands and hooked edges; long banded tentacles with serrated clubs
   - swim modes from the reference: idle (arms open, tentacles coil), start, cruise, jet, agitated
   It lives in "sim space" and is shown through a holder that keeps it framed (a treadmill), so the
   limbs trail from real motion while the squid stays in view. */

const cl = (x, a, b) => (x < a ? a : x > b ? b : x), lp = (a, b, t) => a + (b - a) * t, rr = (a, b) => a + (b - a) * Math.random();
const ss = (a, b, x) => { const t = cl((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const k1 = (dt, r) => 1 - Math.exp(-dt * r);
const V3 = THREE.Vector3;
function cr(tab, s) {
  let i = 0; while (i < tab.length - 2 && tab[i + 1][0] < s) i++;
  const p0 = tab[Math.max(0, i - 1)], p1 = tab[i], p2 = tab[i + 1], p3 = tab[Math.min(tab.length - 1, i + 2)], h = p2[0] - p1[0], t = cl((s - p1[0]) / h, 0, 1);
  const m1 = (p2[1] - p0[1]) / ((p2[0] - p0[0]) || 1) * h, m2 = (p3[1] - p1[1]) / ((p3[0] - p1[0]) || 1) * h, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
}

/* ---------------------------------------------------------------- geometry */
function buildGeometry() {
  const B = { P: [], K: [], A: [], Q: [], I: [] }, F = { P: [], K: [], A: [], Q: [], I: [] };
  // row: [axial, ry, rz, part, p0..p3, q1..q3]; parts 0 mantle 1 fin 2 head 3 arm 4 tentacle 5 eye 6 sucker
  function lathe(o, prof, NR, fn) {
    const b = o.P.length / 3;
    for (const r of prof) for (let j = 0; j < NR; j++) {
      const a = j / NR * 6.2832;
      o.P.push(...fn(r[0], r[1] * Math.cos(a), r[2] * Math.sin(a), a, r)); o.K.push(r[3]); o.A.push(r[4], r[5], r[6], r[7]); o.Q.push(a, r[8] || 0, r[9] || 0, r[10] || 0);
    }
    for (let i = 0; i < prof.length - 1; i++) for (let j = 0; j < NR; j++) { const a = b + i * NR + j, c = b + i * NR + (j + 1) % NR; o.I.push(a, a + NR, c, c, a + NR, c + NR); }
  }
  // mantle: rounder, plumper bulb; tail narrows into the fin keel
  const RT = [[0, .2], [.03, .232], [.09, .258], [.18, .266], [.28, .242], [.37, .185], [.45, .125], [.52, .085], [.62, .066], [.76, .05], [.9, .032], [1, .007]];
  const rad = (s) => cr(RT, cl(s, 0, 1));
  // collar: a wide lip flaring outward around a deep cavity (the dark gap around the head)
  const mp = [[-.2, 0, 0, 0, 0, 1, 0, 0], [-.17, .06, .06, 0, 0, 1, 0, 0], [-.12, .12, .12, 0, 0, 1, 0, 0], [-.05, .155, .155, 0, 0, 1, 0, 0], [-.005, .17, .17, 0, 0, .9, 0, 0],
    [.018, .186, .188, 0, 0, .4, 0, 0], [.03, .2, .202, 0, 0, .4, 0, 0], [.02, .21, .212, 0, 0, .4, 0, 0]];
  for (let i = 0; i <= 80; i++) { const s = i / 80, r = rad(s); mp.push([-s, r * .95, r, 0, s, 0, 0, 0]); }
  mp.push([-1.004, 0, 0, 0, 1, 0, 0, 0]);
  lathe(B, mp, 52, (ax, y, z, a, r) => {
    const inn = r[5] > .3, s = r[4], cd = Math.cos(a), aw = a > 3.1416 ? a - 6.2832 : a;
    let sh = inn ? ss(-.2, -.005, ax) : 1 - ss(0, .2, s);
    sh *= cd > 0 ? .02 * Math.pow(cd, 1.3) : -.12 * Math.pow(-cd, 1.0);   // ventral side of the collar opens further
    if (!inn) y += .03 * Math.exp(-aw * aw / .05) * ss(.03, .2, s) * (1 - ss(.9, 1, s)); // dorsal ridge / keel
    return [ax + sh, y, z];
  });
  // head: small and narrow, set deep inside the collar
  lathe(B, [[-.16, .06], [-.06, .076], [.02, .088], [.08, .094], [.13, .09], [.17, .08], [.2, .062], [.215, .032], [.22, 0]].map((r) => [r[0], r[1] * .88, r[1], 2, r[0], 0, 0, 0]), 36, (a, y, z) => [a, y, z]);
  // eyes: big, dark, slightly bulging
  for (const sd of [1, -1]) {
    const R0 = .03, c = new V3(.07, -.002, sd * .082), pr = [];
    for (let j = 0; j <= 18; j++) { const f = j / 18 * Math.PI; pr.push([R0 * Math.cos(f), R0 * Math.sin(f), R0 * Math.sin(f), 5, c.x, c.y, c.z, f / Math.PI]); }
    lathe(B, pr, 22, (a, y, z) => [c.x + y * 1.1, c.y + z, c.z + sd * a * .6]);
  }

  // limbs (skinned onto simulated chains)
  const LM = { P: [], K: [], A: [], Q: [], I: [] }, NJA = 18, NJT = 30, TC0 = .8;
  const ARMS = [[.42, .46, .3], [-.36, .5, .32], [1.1, .5, .26], [-.98, .55, .29], [1.82, .57, .24], [-1.92, .52, .27], [2.7, .6, .21], [-2.55, .58, .24]];
  const TENT = [[2.25, 1.32, .1], [-2.25, 1.32, .1]];
  const lv = (x, y, z, k, id, u, nj, L, a, rho, rn) => { LM.P.push(x, y, z); LM.K.push(k); LM.A.push(id, u, nj, L); LM.Q.push(a, id, rho, rn); return LM.P.length / 3 - 1; };
  function lq(rows, NR, flip) { for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < NR; j++) { const a = rows[i][j], b = rows[i][(j + 1) % NR], c = rows[i + 1][j], d = rows[i + 1][(j + 1) % NR]; if (flip) LM.I.push(a, c, b, b, c, d); else LM.I.push(a, b, c, b, d, c); } }
  function buildArm(id, L) {
    const NS = 110, NR = 14, w0 = .034 * L, Wd = (t) => w0 * (1 - .55 * t) * (1 - .93 * Math.pow(Math.max(0, (t - .78) / .22), 1.35)) + .0022,
      Ht = (t) => 1.1 * Wd(t) + .0003, pit = (t) => .62 * Wd(t) + .0011, rows = [], PH = [0];
    for (let i = 0; i <= NS; i++) {
      const t = i / NS, w = Wd(t), h = Ht(t), x = t * L, row = [];
      if (i > 0) PH.push(PH[i - 1] + (L / NS) / pit(t));
      const sc1 = Math.pow(Math.abs(2 * (PH[i] % 1) - 1), 1.6), sc2 = Math.pow(Math.abs(2 * ((PH[i] + .5) % 1) - 1), 1.6);
      for (let j = 0; j < NR; j++) {
        const a = j / NR * 6.2832, ca = Math.cos(a), sa = Math.sin(a), yy = ca > 0 ? h * ca : .55 * h * ca, scl = 1 - (sa > 0 ? sc1 : sc2);
        // hooks: the oral edge gets a saw-tooth silhouette (colossal squid arms carry hooks)
        const hook = Math.max(0, -ca) * Math.pow(Math.abs(2 * ((PH[i] * 0.5) % 1) - 1), 6) * .5 * Math.min(1, t * 8) * (1 - t);
        const sw = 1 + .52 * scl * (.15 + .85 * Math.max(0, .45 - ca) / 1.45) * Math.min(1, t * 12) * (1 - .4 * t) + hook;
        row.push(lv(x, yy * (1 + hook * .6), w * sa * sw, 3, id, t, NJA, L, a, 0, id * .137));
      }
      rows.push(row);
    }
    lq(rows, NR, false);
    const prof = [[0, -.22], [.45, -.16], [.7, .12], [.9, .3], [1.1, .16], [1.36, -.1]], NS2 = 8;
    const tOf = (ph) => { let i = 0; while (i < NS - 1 && PH[i + 1] < ph) i++; return (i + (ph - PH[i]) / (PH[i + 1] - PH[i] || 1)) / NS; };
    for (let r = 0; r < 2; r++) {
      const sd = r ? -1 : 1;
      for (let k = 1; ; k++) {
        const ph = k + (r ? .5 : 0); if (ph > PH[NS] - .4) break;
        const t = tOf(ph), x = t * L, w = Wd(t), h = Ht(t), rs = .14 * w + .0002, zc = sd * .52 * w, yc = -.5 * h, rw = [];
        for (const [rho, hg] of prof) {
          const row = [];
          for (let j = 0; j < NS2; j++) {
            const f = j / NS2 * 6.2832, dx = rho * rs * Math.cos(f), dy = -hg * rs, dz = rho * rs * Math.sin(f), ag = -sd * .5, c = Math.cos(ag), sn = Math.sin(ag), y2 = dy * c - dz * sn, z2 = dy * sn + dz * c;
            row.push(lv(x + dx, yc + y2, zc + z2, 6, id, t, NJA, L, f, rho, id * .137 + t));
          }
          rw.push(row);
        }
        lq(rw, NS2, true);
      }
    }
  }
  function buildTent(id, L) {
    const NR = 12, N1 = 44, N2 = 76, rows = [], rs = (t) => .0105 * (1 - .25 * t) + .0004;
    for (let i = 0; i <= N1 + N2; i++) {
      const t = i <= N1 ? TC0 * i / N1 : TC0 + (1 - TC0) * (i - N1) / N2, row = [];
      let ry = rs(t), rz = rs(t), sw = 0;
      if (t > TC0) {
        // leaf-shaped club, wider than before
        const s = (t - TC0) / (1 - TC0), bw = .032 * Math.pow(Math.max(0, Math.sin(3.1416 * Math.pow(s, 1.05))), .85), m = Math.min(1, s * 5);
        rz = rs(t) + bw; ry = rs(t) * (1 - m) + (.0036 + .003 * Math.sin(3.1416 * s)) * m; sw = s;
      }
      if (i === N1 + N2) { ry = rz = .0012; }
      const x = t * L;
      for (let j = 0; j < NR; j++) {
        const a = j / NR * 6.2832, ca = Math.cos(a), sa = Math.sin(a), tri = Math.abs(((sw * 22) % 1) * 2 - 1), tooth = sw > 0 ? 1 + .18 * (1 - tri) * Math.min(1, sw * 6) * Math.abs(sa) : 1;
        row.push(lv(x, ry * ca, rz * sa * tooth, 4, id, t, NJT, L, a, 0, id * .211));
      }
      rows.push(row);
    }
    lq(rows, NR, false);
  }
  ARMS.forEach(([, L], i) => buildArm(i, L));
  TENT.forEach(([, L], i) => buildTent(8 + i, L));

  // fins: a large diamond (leaf) pair hung on the keel; widest past the middle, pointed tip
  const FW = [[0, .13], [.06, .2], [.16, .27], [.3, .325], [.45, .345], [.6, .32], [.74, .255], [.86, .16], [.95, .07], [1, .008]];
  for (const sd of [1, -1]) {
    const b = F.P.length / 3;
    for (let i = 0; i <= 60; i++) {
      const v = i / 60, w = cr(FW, v), s = .36 + .64 * v;
      for (let j = 0; j <= 16; j++) {
        const u = j / 16, r = rad(s) * .7, ww = Math.max(w - r, .004);
        F.P.push(-s, rad(s) * .5 + .04 * Math.pow(u, .8) - .07 * u * u * (.45 + .55 * v), sd * (r + u * ww)); F.K.push(1); F.A.push(sd, u, v, s); F.Q.push(0, 0, 0, 0);
      }
    }
    for (let i = 0; i < 60; i++) for (let j = 0; j < 16; j++) { const a = b + i * 17 + j; F.I.push(a, a + 17, a + 1, a + 1, a + 17, a + 18); }
  }
  const mk = (o) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(o.P, 3));
    g.setAttribute('aK', new THREE.Float32BufferAttribute(o.K, 1));
    g.setAttribute('aP', new THREE.Float32BufferAttribute(o.A, 4));
    g.setAttribute('aQ', new THREE.Float32BufferAttribute(o.Q, 4));
    g.setIndex(o.I); g.computeVertexNormals();
    g.boundingSphere = new THREE.Sphere(new V3(), 4);
    return g;
  };
  return { body: mk(B), fins: mk(F), limbs: mk(LM), ARMS, TENT, NJA, NJT, TC0 };
}

/* ---------------------------------------------------------------- shaders */
const VS = /* glsl */`attribute float aK;attribute vec4 aP,aQ;uniform float uT,uPh,uAmp,uFin,uBend,uJet,uBr,uFold;uniform vec2 uEye;
varying vec3 vWP,vN,vR;varying vec4 vP,vQ;varying float vK;
float lat(float x){float s=max(-x,0.);return uAmp*(.05+.95*s*s)*sin(s*4.2-uPh)+uBend*(s-.3)*(s-.3);}
void main(){vec3 p=position,n=normal;float k=aK;vR=position;vP=aP;vQ=aQ;vK=k;
 float s0=clamp(-position.x,0.,1.),jp=smoothstep(0.,.25,s0)*(1.-smoothstep(.5,1.,s0)),kk=1.-jp*(.05*(.5+.5*sin(uBr))+.16*uJet);
 if(k<.5){p.yz*=kk;}
 else if(abs(k-1.)<.5){float u=aP.y,v=aP.z;p.z*=kk;
  p.y+=uFin*(pow(u,1.4)*sin(7.5*v-uPh)+.5*u*u*sin(.5*uPh+1.4*v))+.004*u*u*sin(23.*v-1.3*uPh+5.*u);
  // jets: the fin lobes fold down and hug the mantle
  float f=uFold*pow(u,1.2); p.y-=f*.22*(.6+.4*v); p.z*=1.-f*.38;}
 else if(abs(k-5.)<.5){vec3 c=aP.xyz,q=p-c;float sd=sign(c.z),a=uEye.x*sd,ca=cos(a),sa=sin(a);q.xz=mat2(ca,-sa,sa,ca)*q.xz;n.xz=mat2(ca,-sa,sa,ca)*n.xz;p=c+q;}
 p.z+=lat(p.x);vec4 wp=modelMatrix*vec4(p,1.);vWP=wp.xyz;vN=normalize(mat3(modelMatrix)*n);gl_Position=projectionMatrix*viewMatrix*wp;}`;

const VSL = /* glsl */`attribute float aK;attribute vec4 aP,aQ;uniform highp sampler2D uChain;
varying vec3 vWP,vN,vR;varying vec4 vP,vQ;varying float vK;
vec3 CP(int j,int c){return texelFetch(uChain,ivec2(j,c*2),0).xyz;}
vec3 CN(int j,int c){return texelFetch(uChain,ivec2(j,c*2+1),0).xyz;}
void main(){float id=aP.x,u=clamp(aP.y,0.,1.),L=aP.w;int c=int(id+.5),jm=int(aP.z+.5)-1;
 float fj=u*float(jm);int j0=min(int(floor(fj)),jm-1),j1=j0+1;float f=fj-float(j0);
 vec3 P0=CP(j0,c),P1=CP(j1,c),N0=CN(j0,c),N1=CN(j1,c);
 vec3 T0=normalize(P1-CP(max(j0-1,0),c)),T1=normalize(CP(min(j1+1,jm),c)-P0);
 vec3 T=normalize(mix(T0,T1,f)),P=mix(P0,P1,f),N=mix(N0,N1,f);N=normalize(N-T*dot(T,N));vec3 B=cross(T,N);
 vec3 o=vec3(position.x-u*L,position.y,position.z);
 vec3 p=P+T*o.x+N*o.y+B*o.z,n=normalize(T*normal.x+N*normal.y+B*normal.z);
 vK=aK;vP=aP;vQ=aQ;vR=position+vec3(0.,id*.371,id*.529);
 vec4 wp=modelMatrix*vec4(p,1.);vWP=wp.xyz;vN=normalize(mat3(modelMatrix)*n);gl_Position=projectionMatrix*viewMatrix*wp;}`;

const FS = (TC0) => /* glsl */`uniform vec3 uSunD,uCamPos,uCursorDir,uFog,uTop;uniform float uT,uFogD,uTorch,uRim;
varying vec3 vWP,vN,vR;varying vec4 vP,vQ;varying float vK;
float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){return .55*vn(p)+.3*vn(p*2.1+5.)+.15*vn(p*4.3+11.);}
vec3 bumpN(float h,vec3 N,vec3 P){vec3 dpx=dFdx(P),dpy=dFdy(P);float dhx=dFdx(h),dhy=dFdy(h);vec3 r1=cross(dpy,N),r2=cross(N,dpx);float det=dot(dpx,r1);vec3 g=sign(det)*(dhx*r1+dhy*r2);return normalize(abs(det)*N-g);}
void main(){vec3 V=normalize(uCamPos-vWP),N=normalize(vN),L=normalize(uSunD),H=normalize(L+V);float k=vK;
 bool fin=abs(k-1.)<.5,eye=abs(k-5.)<.5,head=abs(k-2.)<.5,arm=abs(k-3.)<.5,ten=abs(k-4.)<.5,suc=abs(k-6.)<.5,limb=arm||ten||suc;
 if(fin){N=normalize(cross(dFdx(vWP),dFdy(vWP)));if(dot(N,V)<0.)N=-N;}else if(!gl_FrontFacing)N=-N;
 if(limb){float hb=(.6*vn(vR*vec3(75.))+.4*vn(vR*vec3(190.)+2.))*(ten?.0006:.0014);N=bumpN(hb,N,vWP);}
 float nl=dot(N,L),tx=fbm(vR*7.);
 float sp=smoothstep(.64,.7,fbm(vR*vec3(34.,60.,60.)+4.)),bl=smoothstep(.66,.76,fbm(vR*vec3(10.,18.,18.)+9.));
 vec3 RED=vec3(.68,.07,.15),MAU=vec3(.46,.06,.18),CRM=vec3(.9,.78,.8),TEAL=vec3(.03,.26,.32),col=RED;float al=1.;
 if(k<.5){float s=vP.x;col=mix(RED,MAU,.3*tx);
  float edge=(1.-.7*smoothstep(0.,.4,s))*smoothstep(-.3,.2,cos(vQ.x));
  col=mix(col,CRM,clamp(.6*sp*(1.-.3*s)+.7*bl*edge,0.,1.));
  col=mix(col,CRM*.78,(1.-smoothstep(0.,.09,s+.06*(tx-.5)))*.7);                                  // pale collar rim
  col=mix(col,CRM,.75*smoothstep(.55,.8,fbm(vR*vec3(6.,12.,12.)+2.))*(1.-smoothstep(.02,.32,s))*smoothstep(.3,-.4,cos(vQ.x)));
  col=mix(col,vec3(.45,.05,.12),.5*(1.-smoothstep(.002,.014,abs(vR.z+.004*(tx-.5))))*step(0.,vR.y)*smoothstep(.15,.3,s)*(1.-smoothstep(.85,.95,s))); // dorsal keel line
  col=mix(col,vec3(.008,.03,.04),smoothstep(.4,.6,vP.y));                                     // the dark cavity inside the collar
  col=mix(col,vec3(.05,.16,.2)*(.6+.8*tx),.85*smoothstep(-.1,-.7,cos(vQ.x))*(1.-.35*sp));}     // dark underside
 else if(head){float x=vR.x;col=mix(RED,MAU,.3*tx);col=mix(col,CRM,.75*sp+.3*bl);
  col=mix(col,TEAL*1.1,smoothstep(-.1,-.8,cos(vQ.x))*.7);vec3 ec=vec3(.07,-.002,sign(vR.z)*.082),dq=vR-ec;
  col=mix(col,vec3(.07,.3,.3),1.-smoothstep(.034,.08,length(vec3(dq.x*.6,dq.y,dq.z))));
  col=mix(col,vec3(.8,.72,.74),.55*smoothstep(.168,.19,x)*(1.-smoothstep(.19,.206,x)));col=mix(col,vec3(.02,.07,.09),smoothstep(.195,.218,x));}
 else if(limb){float t=vP.y,id=vP.x,L2=vP.w,a=vQ.x,ca=cos(a),sa=sin(a);
  if(arm||suc){float ab=smoothstep(-.35,.45,ca),strk=fbm(vR*vec3(14.,150.,150.)+id*3.1);
   // arms: red at the base fading to pale teal-white, pink bands, white sucker rings
   col=mix(RED,MAU,.35*tx);col=mix(col,vec3(.93,.84,.86),smoothstep(.56,.74,strk)*.8);col=mix(col,CRM,.7*sp);
   col=mix(col,vec3(.86,.92,.92),smoothstep(.2,.8,t)*.85*(.65+.35*tx));
   col=mix(col,vec3(.9,.42,.5),.45*smoothstep(.6,1.,sin(t*L2*42.+tx*3.))*smoothstep(.15,.4,t)*ab);   // pink bands
   col=mix(mix(vec3(.2,.42,.48),vec3(.7,.87,.87),smoothstep(.12,.95,t))*(.84+.3*tx),col,ab);
   col=mix(col,vec3(.86,.93,.92),.5*smoothstep(.5,.0,abs(ca))*step(.01,t));
   if(suc){float rho=vQ.z;col=mix(vec3(.45,.58,.64),vec3(.82,.9,.92),smoothstep(.5,.72,rho)*(1.-smoothstep(1.05,1.32,rho)));col=mix(col,vec3(.3,.46,.5),1.-smoothstep(.3,.5,rho));}}
  else{float cm=smoothstep(${TC0}-.012,${TC0}+.03,t),lc=clamp((t-${TC0})/(1.-${TC0}),0.,1.),bn=.65*vn(vec3(t*L2*26.,id*3.,1.5))+.35*vn(vec3(t*L2*70.,a*2.,id)),nz=fbm(vec3(lc*8.,a*1.5,id));
   vec3 stalk=mix(vec3(.9,.84,.84),vec3(.86,.32,.42),.9*smoothstep(.45,.55,bn));                    // pink-white bands
   vec3 club=mix(vec3(.9,.66,.68),vec3(.82,.3,.38),smoothstep(.45,.75,nz));
   float eg=smoothstep(.55,.95,abs(sa));club=mix(club,vec3(.97,.92,.92),.7*eg);club=mix(club,vec3(.85,.25,.34),.55*(1.-smoothstep(.0,.3,abs(sa)))*smoothstep(.04,.3,lc)*(1.-smoothstep(.7,1.,lc)));
   col=mix(stalk,club,cm);}}
 else if(eye){float e=vP.w;col=vec3(.02,.14,.15);float ring=smoothstep(.14,.17,e)*(1.-smoothstep(.34,.4,e));col=mix(col,vec3(.22,.46,.46)*(.75+.5*tx),ring);
  col=mix(col,vec3(.75,.85,.8),.22*smoothstep(.09,.11,e)*(1.-smoothstep(.12,.14,e)));col=mix(col,vec3(.003),1.-smoothstep(.085,.1,e));}
 else if(fin){float u=vP.y,v=vP.z,nz=fbm(vec3(u*7.,v*16.,1.)),ed=smoothstep(.36,.86,u+.2*(nz-.4));
  if(u+.05*(nz-.5)+.02*sin(v*60.+nz*4.)>.992)discard;
  col=mix(RED*(.9+.16*fbm(vec3(v*34.,u*5.,2.))),MAU,.3*u+.2*nz);
  float vein=smoothstep(.86,1.,sin((v*1.4-u*.35)*95.+nz*2.))*smoothstep(.08,.5,u);                  // fine radiating veins
  col=mix(col,RED*.62,vein*.5);
  col=mix(col,mix(vec3(.85,.5,.56),CRM*.9,smoothstep(.8,.97,u)),clamp(.7*ed+.4*sp+.3*bl*(1.-u),0.,1.));
  col=mix(col,vec3(.42,.06,.14),.6*(1.-smoothstep(0.,.06,u)));                                     // keel joint
  al=mix(1.,.38,smoothstep(.55,1.,u)*(.55+.45*nz));}                                               // see-through margin
 if(!eye&&!suc)col*=.92+.16*vn(vR*vec3(150.)+3.);
 vec3 shadeC=mix(col*vec3(.42,.36,.48),vec3(.03,.12,.17),.3),lav=mix(col,vec3(.2,.16,.26),.22)*.95;
 vec3 c=mix(shadeC,lav,smoothstep(-.3,.15,nl));c=mix(c,col*1.1,smoothstep(.1,.65,nl));
 if(limb){float up=.5+.5*N.y;vec3 amb=mix(vec3(.1,.22,.28),vec3(.3,.4,.47),up);float key=smoothstep(-.1,.75,nl);c=col*(amb+vec3(.62,.56,.58)*key*(.5+.5*up)+.08*max(dot(N,V),0.));}
 if(fin)c+=col*.4*pow(max(dot(-N,L),0.),1.5)+uTop*.12*(1.-al);                                    // light through the fin
 float fr=pow(1.-max(dot(N,V),0.),2.4);c+=vec3(.06,.32,.38)*fr*(.25+.3*clamp(N.y,0.,1.))*uRim;
 if(limb){float thin=ten?1.:smoothstep(.25,.9,vP.y);c+=col*.4*thin*pow(max(dot(-N,L),0.),1.2);c+=vec3(.55,.85,.9)*pow(1.-max(dot(N,V),0.),2.2)*(ten?.22:.3);
  float gl=step(.9,vn(vR*vec3(300.)+floor(uT*4.+vP.x)*1.7))*pow(max(dot(N,H),0.),6.)*(.4+.6*fr);c+=gl*.55*vec3(.9,1.,1.);}
 float spc=pow(max(dot(N,H),0.),eye?140.:(suc?70.:45.));c+=spc*(eye?1.8:(suc?.9:.14))*(1.-.6*sp)*vec3(1.,.95,.95);if(limb)c+=pow(max(dot(N,H),0.),26.)*(ten?.22:.3)*vec3(.9,1.,1.);
 // the cursor torch: a cool spotlight that follows the pointer
 vec3 Tl=uCamPos-vWP;float td=length(Tl);Tl/=td;float spot=pow(max(dot(-Tl,uCursorDir),0.),14.);
 c+=col*vec3(.55,.9,1.)*max(dot(N,Tl),0.)*spot*uTorch*2.4+vec3(.5,.9,1.)*fr*spot*uTorch*.8;
 c=mix(c,uFog,1.-exp(-td*uFogD*.32));
 gl_FragColor=vec4(c,al);}`;

/* ---------------------------------------------------------------- creature */
export function createSquid() {
  const G = buildGeometry();
  const { ARMS, TENT, NJA, NJT } = G;
  const CHW = 30;
  const U = {
    uT: { value: 0 }, uPh: { value: 0 }, uAmp: { value: .02 }, uFin: { value: .05 }, uBend: { value: 0 }, uJet: { value: 0 }, uBr: { value: 0 }, uFold: { value: 0 },
    uEye: { value: new THREE.Vector2() }, uSunD: { value: new V3(.45, .8, .6).normalize() }, uRim: { value: 1 },
    uCamPos: ENVU.uCamPos, uCursorDir: ENVU.uCursorDir, uFog: ENVU.uFog, uFogD: ENVU.uFogD, uTop: ENVU.uTop, uTorch: { value: 0.3 },
  };
  const CH = [];
  function mkChain(id, ten, th, L, al) {
    const n = ten ? NJT : NJA, rc = new V3(0, Math.cos(th), Math.sin(th));
    return { id, ten, th, L, al, n, seg: L / (n - 1), rc, root: new V3(.2, 0, 0).addScaledVector(rc, ten ? .02 : .05),
      P: new Float32Array(n * 3), O: new Float32Array(n * 3), V: new Float32Array(n * 3), Rl: new Float32Array(n * 3), Tw: new Float32Array(n * 3), Lp: new Float32Array(n * 3), nB: new V3(),
      k: Float32Array.from({ length: n }, (_, j) => { const s = j / (n - 1); return ten ? (s < .2 ? 70 * Math.pow(1 - s / .2, 2) : 0) + 7.5 : 130 * Math.pow(1 - s, 1.3) + 3.5; }), ph: id * 1.37 + .4, flick: 0 };
  }
  ARMS.forEach(([th, L, al], i) => CH.push(mkChain(i, 0, th, L, al)));
  TENT.forEach(([th, L, al], i) => CH.push(mkChain(8 + i, 1, th, L, al)));
  const CHD = new Float32Array(CHW * CH.length * 2 * 4);
  const CHT = new THREE.DataTexture(CHD, CHW, CH.length * 2, THREE.RGBAFormat, THREE.FloatType);
  CHT.minFilter = CHT.magFilter = THREE.NearestFilter; CHT.generateMipmaps = false; CHT.needsUpdate = true;

  const fsrc = FS(G.TC0);
  const mat = (opts) => new THREE.ShaderMaterial(Object.assign({ uniforms: U, vertexShader: VS, fragmentShader: fsrc, side: THREE.DoubleSide }, opts));
  const body = new THREE.Mesh(G.body, mat());
  const fins = new THREE.Mesh(G.fins, mat({ transparent: true, depthWrite: false }));
  fins.renderOrder = 3;
  const LU = Object.assign({}, U, { uChain: { value: CHT } });
  const limbs = new THREE.Mesh(G.limbs, new THREE.ShaderMaterial({ uniforms: LU, vertexShader: VSL, fragmentShader: fsrc, side: THREE.DoubleSide }));
  [body, fins, limbs].forEach((m) => (m.frustumCulled = false));
  const sq = new THREE.Group(); sq.add(body, fins, limbs);
  const holder = new THREE.Group(); holder.add(sq);

  /* ------------------------------------------------ behaviour (swim modes) */
  const Q = { p: new V3(), h: -.25, pitch: .72, roll: -1.25, sp: .25, tr: 0, pr: 0, ph: 0, fin: .05, amp: .015, bend: 0, jet: 0, br: 0, sprd: .4, fold: 0, coil: 0,
    mode: 'cruise', modeT: 0, cy: 1.2, ey: 0, eT: 1, eTY: 0, t: 0, agit: 0, center: new V3() };
  const SPEED = 1.35;

  function setMode(m) { if (Q.mode !== m) { Q.mode = m; Q.modeT = 0; } }

  function step(dt, ctx) {
    const f = Q; f.t += dt; f.modeT += dt; const t = f.t;
    // ---- choose the mode
    if (ctx.idle > 7 && f.mode !== 'idle') setMode('idle');
    if (f.mode === 'idle' && ctx.idle < 0.3) setMode('start');
    if (f.mode === 'start' && f.modeT > 1.2) setMode('cruise');
    f.agit = lp(f.agit, ctx.agitate, k1(dt, ctx.agitate > f.agit ? 6 : 0.8));
    const idle = f.mode === 'idle', start = f.mode === 'start';

    // ---- heading: mostly upward, weaving gently; leans toward the cursor (curious), darts away when agitated
    const curious = ctx.pointerX * .5 * (1 - f.agit) - ctx.pointerX * .9 * f.agit;
    const yawT = -.25 + .3 * Math.sin(t * .23) + .18 * Math.sin(t * .51 + 1.3) + curious;
    const pitchT = (idle ? .35 : .72) + .12 * Math.sin(t * .31 + .5) + ctx.pointerY * .15 + .05 * f.jet;
    const h0 = f.h; f.h = lp(f.h, yawT, k1(dt, .8)); f.tr = (f.h - h0) / Math.max(dt, 1e-3);
    const p0 = f.pitch; f.pitch = lp(f.pitch, pitchT, k1(dt, .9)); f.pr = lp(f.pr, (f.pitch - p0) / Math.max(dt, 1e-3), k1(dt, 4));
    f.roll = lp(f.roll, -1.25 + .3 * Math.sin(t * .29 + 2) - .2 * ctx.pointerX - f.tr * .15, k1(dt, .7));

    // ---- jets: squeeze, fold fins, bundle limbs, burst forward; glide between
    f.cy -= dt * (1 + f.agit * 1.5);
    if (!idle && f.cy <= 0) { f.jet = 1; f.cy = rr(2.0, 2.9); }
    if (idle && f.cy <= 0) f.cy = 0.5;
    f.jet *= Math.exp(-dt * (1.6 - f.agit * .4));
    const thrust = idle ? .02 : (start ? .14 : .18) + f.jet * .7 + f.agit * .25;
    f.sp = Math.max(0, f.sp + (thrust - 1.1 * f.sp) * dt);
    const cp = Math.cos(f.pitch);
    const vx = cp * Math.cos(f.h) * f.sp * SPEED, vy = Math.sin(f.pitch) * f.sp * SPEED, vz = -cp * Math.sin(f.h) * f.sp * SPEED;
    f.p.x += vx * dt; f.p.y += vy * dt; f.p.z += vz * dt;
    f.vel = Math.hypot(vx, vy, vz);
    f.vy = vy;

    // ---- body rhythm
    f.fold = lp(f.fold, Math.min(1, f.jet * 1.4), k1(dt, f.jet > f.fold ? 9 : 2.5));
    f.fin = lp(f.fin, idle ? .085 : (.06 + f.sp * .05) * (1 - f.fold * .6) + f.agit * .04, k1(dt, 3));
    f.amp = lp(f.amp, .012 + Math.min(.04, Math.abs(f.tr) * .03) + f.jet * .015 + f.agit * .01, k1(dt, 3.5));
    f.ph += dt * 6.283 * (idle ? .45 : .7 + f.sp * 1.4 + f.agit * 1.2);
    f.br += dt * (idle ? 1.4 : 1.8 + f.sp * 3);
    f.bend = lp(f.bend, cl(-f.tr * .2, -.25, .25), k1(dt, 4));
    // arms: open like a flower when idle, streamlined while jetting
    const spT = idle ? .95 : cl(.5 - f.jet * .5 - f.sp * .5 + f.agit * .2, .1, .8);
    f.sprd = lp(f.sprd, spT, k1(dt, idle ? .6 : 1.4));
    f.coil = lp(f.coil, idle ? 1 : 0, k1(dt, idle ? .45 : 1.6));
    // eye: follows the cursor, with small saccades
    f.eT -= dt; if (f.eT < 0) { f.eT = rr(.6, 2.4); f.eTY = rr(-.12, .12); }
    f.ey = lp(f.ey, cl(ctx.pointerX * .35 + f.eTY, -.4, .4), k1(dt, 10));
  }

  function apply() {
    U.uT.value = Q.t; U.uPh.value = Q.ph; U.uAmp.value = Q.amp; U.uFin.value = Q.fin; U.uJet.value = Q.jet; U.uBr.value = Q.br;
    U.uBend.value = Q.bend; U.uFold.value = Q.fold; U.uEye.value.set(Q.ey, 0);
    sq.position.copy(Q.p); sq.rotation.set(Q.roll, Q.h + Math.PI, -Q.pitch, 'YZX');
  }

  /* ------------------------------------------------ limb physics (from part 1, tentacles can coil) */
  const _bn = new V3(), _m = new THREE.Matrix4(), _mi = new THREE.Matrix4(), _v = new V3(), _w = new V3(), _a = new V3(), _b = new V3(), _c = new V3(), _n = new V3();
  function restT(c, t, latH) {
    const n = c.n, seg = c.seg, rc = c.rc; let al = c.al, A = 0, C = 0;
    if (!c.ten) { al *= .18 + 3.0 * Math.pow(Q.sprd, 2.2); const kf = .5 + .5 * Q.sprd; A = (.5 + .24 * Math.sin(.27 * t + c.ph * 1.9)) * kf; C = (1.5 + .7 * Math.sin(.35 * t + c.ph)) * kf; }
    else { C = Q.coil * (3.2 + .6 * Math.sin(.3 * t + c.ph)); A = Q.coil * .8; al *= 1 + Q.coil * 4; }
    const d = _a.set(Math.cos(al), rc.y * Math.sin(al) * .5, rc.z * Math.sin(al) * 1.4).normalize(), nn = _b.copy(rc).addScaledVector(d, -rc.dot(d)).normalize(), bb = _c.crossVectors(d, nn); c.nB.copy(nn);
    const gS = c.ten ? 0 : (c.th > 0 ? 1 : -1) * (.55 + .45 * Math.sin(.17 * t + c.ph)), cG = Math.cos(gS), sG = Math.sin(gS); _bn.copy(nn).multiplyScalar(cG).addScaledVector(bb, sG);
    let px = c.root.x, py = c.root.y, pz = c.root.z + latH;
    for (let j = 0; j < n; j++) {
      const s = j / (n - 1);
      if (j > 0) { const sm = (j - .5) / (n - 1), th = A * Math.sin(2.83 * sm) - C * sm * sm * sm, ct = Math.cos(th), st = Math.sin(th); px += seg * (ct * d.x + st * _bn.x); py += seg * (ct * d.y + st * _bn.y); pz += seg * (ct * d.z + st * _bn.z); }
      const fk = c.ten ? 1 + 2.4 * c.flick * Math.sin(3.1416 * Math.min(1, s * 1.6)) : 1;
      const w = c.ten ? .24 * fk * (1 - Q.coil * .6) * Math.sin((.8 + .9 * c.flick) * t - 4.6 * s + c.ph) * s : .045 * (c.L / .5) * Math.sin(3.1 * t - 5 * s + c.ph) * s * s;
      const ar = c.ten ? .26 * Math.sin(3.1416 * s) * Math.sin(.33 * t + c.ph * 2.) : 0;
      c.Rl[j * 3] = px + bb.x * w + c.nB.x * ar; c.Rl[j * 3 + 1] = py + bb.y * w + c.nB.y * ar; c.Rl[j * 3 + 2] = pz + bb.z * w + c.nB.z * ar;
    }
  }
  const latHead = () => U.uAmp.value * .05 * Math.sin(-U.uPh.value) + U.uBend.value * .09;
  function limbStep(dt, t) {
    sq.updateMatrix(); _m.copy(sq.matrix);   // sim space (the holder's framing offset must not shake the limbs)
    const nS = Math.max(1, Math.ceil(dt * 90)), h = dt / nS, lh = latHead();
    for (const c of CH) {
      if (c.ten) { if (c.flick < .05 && Math.random() < dt / (5 - Q.agit * 4)) c.flick = 1; c.flick *= Math.exp(-dt * .7); }
      restT(c, t, lh);
      const n = c.n, P = c.P, V = c.V, O = c.O, Tw = c.Tw, seg = c.seg, ten = c.ten;
      for (let j = 0; j < n; j++) { _v.set(c.Rl[j * 3], c.Rl[j * 3 + 1], c.Rl[j * 3 + 2]).applyMatrix4(_m); Tw[j * 3] = _v.x; Tw[j * 3 + 1] = _v.y; Tw[j * 3 + 2] = _v.z; }
      const dpar = ten ? .4 : 3, dperp = ten ? 1.4 : 8, nz = ten ? .12 : .07;
      for (let s = 0; s < nS; s++) {
        P[0] = Tw[0]; P[1] = Tw[1]; P[2] = Tw[2]; V[0] = V[1] = V[2] = 0;
        for (let j = 1; j < n; j++) {
          const i = j * 3, a = (j - 1) * 3, b = Math.min(j + 1, n - 1) * 3; O[i] = P[i]; O[i + 1] = P[i + 1]; O[i + 2] = P[i + 2];
          const k = c.k[j] * (ten ? 1 + Q.coil * 5 : 1);
          let vx = V[i] + k * (Tw[i] - P[i]) * h, vy = V[i + 1] + k * (Tw[i + 1] - P[i + 1]) * h, vz = V[i + 2] + k * (Tw[i + 2] - P[i + 2]) * h;
          const ph = t * .8 + j * .35 + c.ph; vx += nz * Math.sin(ph * 1.1 + P[i + 1] * 2.1) * h; vy += nz * Math.sin(ph * .9 + P[i + 2] * 1.7 + 1.3) * h; vz += nz * Math.sin(ph * 1.3 + P[i] * 1.9 + 2.1) * h;
          let tx = P[b] - P[a], ty = P[b + 1] - P[a + 1], tz = P[b + 2] - P[a + 2]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
          const vp = vx * tx + vy * ty + vz * tz, fp = Math.exp(-dpar * h), fq = Math.exp(-dperp * h);
          vx = tx * vp * fp + (vx - tx * vp) * fq; vy = ty * vp * fp + (vy - ty * vp) * fq; vz = tz * vp * fp + (vz - tz * vp) * fq;
          P[i] += vx * h; P[i + 1] += vy * h; P[i + 2] += vz * h;
        }
        for (let it = 0; it < (ten ? 6 : 3); it++) for (let j = 0; j < n - 1; j++) {
          const i = j * 3, q = i + 3; let dx = P[q] - P[i], dy = P[q + 1] - P[i + 1], dz = P[q + 2] - P[i + 2]; const l = Math.hypot(dx, dy, dz) || 1e-6, f = (l - seg) / l;
          if (j === 0) { P[q] -= dx * f; P[q + 1] -= dy * f; P[q + 2] -= dz * f; } else { dx *= f * .5; dy *= f * .5; dz *= f * .5; P[i] += dx; P[i + 1] += dy; P[i + 2] += dz; P[q] -= dx; P[q + 1] -= dy; P[q + 2] -= dz; }
        }
        for (let j = 1; j < n; j++) { const i = j * 3; let vx = (P[i] - O[i]) / h, vy = (P[i + 1] - O[i + 1]) / h, vz = (P[i + 2] - O[i + 2]) / h; const vl = Math.hypot(vx, vy, vz); if (vl > 3) { vx *= 3 / vl; vy *= 3 / vl; vz *= 3 / vl; } V[i] = vx; V[i + 1] = vy; V[i + 2] = vz; }
      }
    }
  }
  function limbUpload(t) {
    _mi.copy(sq.matrix).invert();
    for (const c of CH) {
      const n = c.n, Lp = c.Lp, r1 = (c.id * 2) * CHW * 4, r2 = (c.id * 2 + 1) * CHW * 4;
      for (let j = 0; j < n; j++) { _v.set(c.P[j * 3], c.P[j * 3 + 1], c.P[j * 3 + 2]).applyMatrix4(_mi); Lp[j * 3] = _v.x; Lp[j * 3 + 1] = _v.y; Lp[j * 3 + 2] = _v.z; CHD[r1 + j * 4] = _v.x; CHD[r1 + j * 4 + 1] = _v.y; CHD[r1 + j * 4 + 2] = _v.z; }
      _n.copy(c.nB); let px = 0, py = 0, pz = 0;
      for (let j = 0; j < n; j++) {
        const a = Math.max(j - 1, 0) * 3, b = Math.min(j + 1, n - 1) * 3; _w.set(Lp[b] - Lp[a], Lp[b + 1] - Lp[a + 1], Lp[b + 2] - Lp[a + 2]).normalize();
        if (j > 0) { _b.set(px, py, pz).cross(_w); const sn = _b.length(), cs = _w.x * px + _w.y * py + _w.z * pz; if (sn > 1e-5) { _b.multiplyScalar(1 / sn); _n.applyAxisAngle(_b, Math.atan2(sn, cs)); } }
        _n.addScaledVector(_w, -_n.dot(_w)).normalize(); px = _w.x; py = _w.y; pz = _w.z;
        const s = j / (n - 1), tw = c.ten ? s * s * (.5 * Math.sin(.21 * t + c.ph) + (c.id === 8 ? .15 : -.15)) + (s > .78 ? .35 * Math.sin(1.7 * t + c.ph * 2.) : 0) : s * .4 * Math.sin(.5 * t + c.ph);
        _c.copy(_n).applyAxisAngle(_w, tw); CHD[r2 + j * 4] = _c.x; CHD[r2 + j * 4 + 1] = _c.y; CHD[r2 + j * 4 + 2] = _c.z;
      }
    }
    CHT.needsUpdate = true;
  }
  function limbReset(t) {
    sq.updateMatrix(); _m.copy(sq.matrix); const lh = latHead();
    for (const c of CH) { restT(c, t, lh); for (let j = 0; j < c.n; j++) { _v.set(c.Rl[j * 3], c.Rl[j * 3 + 1], c.Rl[j * 3 + 2]).applyMatrix4(_m); c.P[j * 3] = _v.x; c.P[j * 3 + 1] = _v.y; c.P[j * 3 + 2] = _v.z; } c.V.fill(0); }
    limbUpload(t);
  }

  // prime: swim for a few seconds before the first frame so the limbs already trail naturally
  const ctx0 = { idle: 0, pointerX: 0, pointerY: 0, agitate: 0 };
  apply(); limbReset(0);
  for (let i = 0; i < 180; i++) { step(1 / 60, ctx0); apply(); limbStep(1 / 60, Q.t); }
  limbUpload(Q.t);
  Q.center.copy(Q.p);

  const tmpA = new V3(), proj = new V3();
  return {
    group: holder,
    state: Q,
    /** ctx: { anchor: Vector3 (where the squid should sit in the world), idle, pointerX, pointerY, pointerPx, pointerPy, pointerSpeed, camera, exit (0..1) } */
    update(dt, ctx) {
      // agitation: a fast cursor close to the squid on screen
      proj.copy(Q.p).sub(Q.center).add(ctx.anchor).project(ctx.camera);
      const sx = (proj.x * .5 + .5) * innerWidth, sy = (-proj.y * .5 + .5) * innerHeight;
      const near = Math.max(0, 1 - Math.hypot(ctx.pointerPx - sx, ctx.pointerPy - sy) / 320);
      const agitate = cl((ctx.pointerSpeed - 1.2) / 3, 0, 1) * near;
      step(dt, { idle: ctx.idle, pointerX: ctx.pointerX, pointerY: ctx.pointerY, agitate });
      apply();
      limbStep(dt, Q.t);
      limbUpload(Q.t);
      // treadmill: the frame follows the squid with a lag, so it surges on jets and falls back on glides
      Q.center.x = lp(Q.center.x, Q.p.x, k1(dt, 1.2));
      Q.center.z = lp(Q.center.z, Q.p.z, k1(dt, 1.2));
      Q.center.y = lp(Q.center.y, Q.p.y - .15, k1(dt, 1.6));
      // on exit (scrolling down) the squid is allowed to swim away upward
      holder.position.copy(ctx.anchor).sub(Q.center);
      holder.position.y += ctx.exit * ctx.exit * 9;
      U.uTorch.value = ENVU.uTorch.value * 1.4 + .15;
      // the lighting direction follows the cursor a little
      tmpA.set(.45 + ctx.pointerX * .5, .8 + ctx.pointerY * .3, .6).normalize();
      U.uSunD.value.lerp(tmpA, k1(dt, 2));
    },
    /** world-space speed the water should stream past (for particles) */
    flow() { return Q.vy || 0; },
    dispose() { G.body.dispose(); G.fins.dispose(); G.limbs.dispose(); CHT.dispose(); },
  };
}
