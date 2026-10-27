/* ============================================================
   Muñeco articulado — acompaña la lectura
   Un dibujante de croquis: esqueleto con articulaciones, volúmenes
   en trazo doble y una acción distinta en cada sección. Cuando la
   sección cambia de lado, camina hasta el otro borde.
   Decorativo: aria-hidden, sin eventos, apagado con "reducir movimiento"
   y oculto en pantallas angostas (no hay margen libre).
   Vista previa de una pose: añadir ?mu=saludo (o dibuja, observa, senala,
   mide, estira, agacha, telefono, camina) a la URL.
   ============================================================ */
(function(){
  'use strict';
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var NS = 'http://www.w3.org/2000/svg', D = Math.PI/180, root = document.documentElement;
  var forced = (location.search.match(/[?&]mu=([a-z]+)/) || [])[1] || null;

  /* ---------- medidas del muñeco (unidades de dibujo; mide ~100) ---------- */
  var L = { torso:30, neck:3, hr:7.2, ua:15, fa:14, th:22, sh:21 };

  function dn(a){ a *= D; return [Math.sin(a), Math.cos(a)]; }     /* 0 = hacia abajo, 90 = hacia adelante */
  function upv(a){ a *= D; return [Math.sin(a), -Math.cos(a)]; }   /* 0 = hacia arriba */
  function add(p,v,k){ return [p[0]+v[0]*k, p[1]+v[1]*k]; }
  function lerp(a,b,t){ return a+(b-a)*t; }

  /* ---------- cinemática directa: ángulos -> puntos ---------- */
  function skel(P){
    var J = {};
    J.hip = [0,0];
    J.sh  = add(J.hip, upv(P.lean), L.torso);
    J.neck = add(J.sh, upv(P.lean + P.head*0.4), L.neck);
    J.head = add(J.neck, upv(P.lean + P.head), L.hr);
    ['F','B'].forEach(function(s){
      var o = s === 'F' ? 0.8 : -0.8;
      var sh = [J.sh[0]+o, J.sh[1]];
      var el = add(sh, dn(P['ua'+s]), L.ua);
      var ha = add(el, dn(P['ua'+s] + P['ea'+s]), L.fa);
      var hp = [o, 0];
      var kn = add(hp, dn(P['t'+s]), L.th);
      var sa = P['t'+s] - P['k'+s];
      var an = add(kn, dn(sa), L.sh);
      var fa = P['f'+s];
      J['sh'+s]=sh; J['el'+s]=el; J['ha'+s]=ha; J['hp'+s]=hp; J['kn'+s]=kn; J['an'+s]=an;
      J['he'+s] = add(add(an, dn(fa), -2.6), [0,1], 1.9);
      J['to'+s] = add(add(an, dn(fa), 7),    [0,1], 1.9);
    });
    /* el punto más bajo de los pies apoya en el suelo (y = 0) */
    var low = Math.max(J.heF[1], J.toF[1], J.heB[1], J.toB[1]) + 1.5;
    var dy = -low - P.lift;
    for(var k in J){ if(J.hasOwnProperty(k)) J[k] = [J[k][0], J[k][1] + dy]; }
    return J;
  }

  /* ---------- cinemática inversa de 2 huesos (brazos) ---------- */
  function ik(S, T){
    var l1 = L.ua, l2 = L.fa, dx = T[0]-S[0], dy = T[1]-S[1];
    var d = Math.sqrt(dx*dx+dy*dy);
    d = Math.min(Math.max(d, Math.abs(l1-l2)+0.01), l1+l2-0.01);
    var base = Math.atan2(dx, dy);
    var A = Math.acos(Math.max(-1, Math.min(1, (l1*l1 + d*d - l2*l2)/(2*l1*d))));
    var a1 = base - A;                                   /* codo hacia abajo / atrás */
    var E = [S[0] + Math.sin(a1)*l1, S[1] + Math.cos(a1)*l1];
    var a2 = Math.atan2(T[0]-E[0], T[1]-E[1]);
    return [a1/D, (a2 - a1)/D];
  }

  /* ---------- poses ---------- */
  var DEF = { lean:3, head:0, tF:5, kF:5, fF:90, tB:-5, kB:5, fB:90,
              uaF:8, eaF:20, uaB:-6, eaB:18, lift:0 };

  var ACT = {
    descansa: function(P,t){ P.head = 3*Math.sin(t*0.8); },

    saludo: function(P,t){                              /* brazo en alto, antebrazo que va y viene */
      P.lean = -2; P.head = 4 + 2*Math.sin(t*1.3);
      P.uaF = 142; P.eaF = 24 + 30*Math.sin(t*9);
      P.uaB = -4;  P.eaB = 14;
      P.tF = 7; P.kF = 3; P.tB = -6; P.kB = 2;
    },
    observa: function(P,t){                             /* mano de visera, mira alrededor */
      P.lean = 5; P.head = -6 + 7*Math.sin(t*0.9);
      P.tF = 11; P.kF = 3; P.tB = -10; P.kB = 3;
      P.hF = function(J){ return [J.head[0] + 8.5, J.head[1] - 3.2]; };
      P.uaB = -30; P.eaB = 78;
    },
    dibuja: function(P,t){                              /* traza en el aire; queda la línea */
      P.lean = 9; P.head = 12;
      P.tF = 9; P.kF = 3; P.tB = -8; P.kB = 4;
      P.hF = function(J){ return [J.shF[0] + 25 + 7*Math.sin(t*4.1), J.shF[1] + 4 + 8*Math.sin(t*2.7)]; };
      P.hB = function(J){ return [J.shB[0] + 15, J.shB[1] + 11 + 1.5*Math.sin(t*2.7)]; };
      P.flag = 'trail';
    },
    senala: function(P,t){                              /* señala hacia el contenido */
      P.lean = 4; P.head = -4;
      P.tF = 9; P.kF = 3; P.tB = -7; P.kB = 3;
      P.hF = function(J){ return [J.shF[0] + 29, J.shF[1] - 9 + 3*Math.sin(t*2.6)]; };
      P.uaB = -26; P.eaB = 72;
      P.lift = 0.9*Math.abs(Math.sin(t*2.6));
      P.flag = 'point';
    },
    mide: function(P,t){                                /* cinta métrica entre las manos */
      var a = 0.5 + 0.5*Math.sin(t*1.5);
      P.lean = 6; P.head = 6;
      P.tF = 10; P.kF = 3; P.tB = -9; P.kB = 3;
      P.hF = function(J){ return [J.shF[0] + 24 + 14*a, J.shF[1] + 6]; };
      P.hB = function(J){ return [J.shB[0] + 8 - 1*a, J.shB[1] + 6]; };
      P.flag = 'dim';
    },
    estira: function(P,t){                              /* brazos arriba, en puntas de pie */
      var s = 0.5 + 0.5*Math.sin(t*2.1);
      P.lean = -7; P.head = -10;
      P.uaF = 152 + 5*Math.sin(t*2.1); P.eaF = 6; P.uaB = 143 + 5*Math.sin(t*2.1 + 1); P.eaB = 8;
      P.tF = 2; P.kF = 0; P.tB = -2; P.kB = 0;
      P.fF = 90 - 38*s; P.fB = 90 - 38*s; P.lift = 0.4 + 2.4*s;
    },
    agacha: function(P,t){                              /* en cuclillas, abrazando las rodillas */
      P.lean = 30 + 1.5*Math.sin(t*1.4); P.head = -12 + 3*Math.sin(t*0.9);
      P.tF = 98; P.kF = 112; P.tB = 92; P.kB = 106; P.fF = 94; P.fB = 94;
      P.hF = function(J){ return [J.knF[0] + 1, J.knF[1] + 4.5]; };
      P.hB = function(J){ return [J.knB[0] - 1, J.knB[1] + 5.5]; };
    },
    telefono: function(P,t){                            /* "hablemos": mano en la oreja */
      P.lean = 2; P.head = -2 + 3*Math.sin(t*2.6);
      P.tF = 8; P.kF = 2; P.tB = -3; P.kB = 15;
      P.hF = function(J){ return [J.head[0] - 1.6, J.head[1] + 3]; };
      P.uaB = 14; P.eaB = 104;
    },
    camina: function(P,t){
      var ph = t*2*Math.PI*3.4, s = Math.sin(ph), c = Math.cos(ph);
      P.lean = 9; P.head = -3;
      P.tF = 34*s;  P.tB = -34*s;
      P.kF = 5 + 52*Math.pow(Math.max(0, c), 1.4);
      P.kB = 5 + 52*Math.pow(Math.max(0, -c), 1.4);
      P.fF = 90 + 0.5*(P.tF - P.kF); P.fB = 90 + 0.5*(P.tB - P.kB);
      P.uaF = -32*s; P.eaF = 28; P.uaB = 32*s; P.eaB = 28;
    }
  };

  function build(name, t){
    var P = {}; for(var k in DEF) P[k] = DEF[k];
    P.hF = null; P.hB = null; P.flag = '';
    (ACT[name] || ACT.descansa)(P, t);
    P.lean += 0.5*Math.sin(t*1.7);                      /* respiración */
    if(P.hF || P.hB){
      var J = skel(P);
      ['F','B'].forEach(function(s){
        var h = P['h'+s]; if(!h) return;
        var r = ik(J['sh'+s], h(J)); P['ua'+s] = r[0]; P['ea'+s] = r[1];
      });
    }
    return P;
  }
  function mix(A, B, e){
    var P = {}; for(var k in DEF) P[k] = lerp(A[k], B[k], e);
    return P;
  }

  /* ---------- dibujo ---------- */
  var BIGSEED = [ .31,-.42,.18,.37,-.26,.44,-.15,.29,-.38,.21,-.33,.4,.12,-.45,.27,-.19,.35,-.3,.16,.41,-.22,.34 ];
  var svg, el = {}, trail = [], lastMode = '';

  function mk(tag, attrs, parent){
    var n = document.createElementNS(NS, tag);
    for(var k in attrs) n.setAttribute(k, attrs[k]);
    (parent || svg).appendChild(n); return n;
  }
  /* cápsula afinada p0 -> p1, con radios r0 y r1 */
  function cap(p0, p1, r0, r1, jit, seed){
    var j = jit ? BIGSEED : null, i = seed || 0;
    if(j){
      p0 = [p0[0] + j[i % 22]*1.5, p0[1] + j[(i+3) % 22]*1.5];
      p1 = [p1[0] + j[(i+7) % 22]*1.5, p1[1] + j[(i+11) % 22]*1.5];
      r0 += j[(i+5) % 22]*.5; r1 += j[(i+9) % 22]*.5;
    }
    var dx = p1[0]-p0[0], dy = p1[1]-p0[1], len = Math.sqrt(dx*dx+dy*dy) || 1, ux = dx/len, uy = dy/len, nx = -uy, ny = ux;
    function f(v){ return Math.round(v*10)/10; }
    return 'M'+f(p0[0]+nx*r0)+' '+f(p0[1]+ny*r0)+
           'L'+f(p1[0]+nx*r1)+' '+f(p1[1]+ny*r1)+
           'A'+f(r1)+' '+f(r1)+' 0 0 0 '+f(p1[0]-nx*r1)+' '+f(p1[1]-ny*r1)+
           'L'+f(p0[0]-nx*r0)+' '+f(p0[1]-ny*r0)+
           'A'+f(r0)+' '+f(r0)+' 0 0 0 '+f(p0[0]+nx*r0)+' '+f(p0[1]+ny*r0)+'Z';
  }
  function circ(c, r){
    function f(v){ return Math.round(v*10)/10; }
    return 'M'+f(c[0]-r)+' '+f(c[1])+'a'+r+' '+r+' 0 1 0 '+f(2*r)+' 0a'+r+' '+r+' 0 1 0 '+f(-2*r)+' 0Z';
  }

  /* cada pieza: un trazo firme y otro más suave, apenas corrido (doble línea de croquis) */
  function piece(layer, back){
    var o = back ? .5 : 1;
    return {
      a: mk('path', { 'class':'mu-l1', 'stroke-opacity':o }, layer),
      b: mk('path', { 'class':'mu-l2', 'stroke-opacity':o*.55 }, layer)
    };
  }
  function setPiece(p, d1, d2){ p.a.setAttribute('d', d1); p.b.setAttribute('d', d2); }

  function init(){
    var wrap = document.createElement('div');
    wrap.className = 'munieco'; wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = '<svg viewBox="-56 -116 112 128" focusable="false"><defs><filter id="mu-lapiz" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.7" xChannelSelector="R" yChannelSelector="G"/></filter></defs><g class="mu-flip" filter="url(#mu-lapiz)"></g></svg>';
    document.body.appendChild(wrap);
    svg = wrap.querySelector('.mu-flip');
    el.wrap = wrap; el.flip = svg;

    /* suelo: línea corrida y unos rayitos */
    var g = mk('path', { 'class':'mu-ground', d:'M-30 1.2C-12 .2 8 1.9 33 .7M-22 3.6C-10 3 0 4 12 3.2M-26 1.8l-3 4M-18 1.6l-3 4M-8 1.8l-3 4M4 1.8l-3 4M16 1.4l-3 4M26 1.3l-3 4' });
    el.ground = g;

    var back = mk('g', { 'class':'mu-back' }), mid = mk('g', {}), front = mk('g', {}), extra = mk('g', {});
    el.armB = [piece(back,1), piece(back,1), piece(back,1)];                     /* brazo, antebrazo, mano */
    el.legB = [piece(back,1), piece(back,1), piece(back,1)];                     /* muslo, pierna, pie */
    el.torso = piece(mid); el.hatch = mk('path', { 'class':'mu-l2', 'stroke-opacity':.6 }, mid); el.chest = mk('path', { 'class':'mu-l2', 'stroke-opacity':.4 }, mid);
    el.legF = [piece(front), piece(front), piece(front)];
    el.neck = piece(front);
    el.joints = mk('path', { 'class':'mu-joint' }, front);
    el.head = mk('g', {}, front);
    mk('ellipse', { 'class':'mu-l1', cx:0, cy:0, rx:6.1, ry:L.hr }, el.head);
    mk('ellipse', { 'class':'mu-l2', cx:.3, cy:-.2, rx:5.7, ry:7.5, 'stroke-opacity':.5 }, el.head);
    mk('path', { 'class':'mu-l1', d:'M5.9 .4L8.1 2.9L5.7 3.5' }, el.head);                  /* nariz */
    mk('path', { 'class':'mu-hair', d:'M-5.9 1.2C-7 -6.6 -1.6 -9.2 4.6 -6.6' }, el.head);   /* pelo */
    mk('circle', { 'class':'mu-hair', cx:-6.3, cy:-5.4, r:2.7 }, el.head);                   /* rodete */
    mk('path', { 'class':'mu-l2', d:'M-1.4 .8c1 -1 2.2 -.6 2.3 .8' }, el.head);              /* oreja */
    mk('circle', { 'class':'mu-eye', cx:3.1, cy:-.9, r:.62 }, el.head);
    mk('path', { 'class':'mu-l2', d:'M3.4 4.5c.9 .4 1.7 .3 2.4 -.2' }, el.head);              /* boca */
    el.armF = [piece(front), piece(front), piece(front)];
    el.finger = mk('path', { 'class':'mu-l1' }, extra);
    el.dim = mk('path', { 'class':'mu-dim' }, extra);
    el.trail = mk('path', { 'class':'mu-trail' }, extra);
  }

  function render(P, ctx){
    var J = skel(P), i;
    /* piernas */
    ['B','F'].forEach(function(s, n){
      var set = s === 'B' ? el.legB : el.legF, sd = n*5;
      setPiece(set[0], cap(J['hp'+s], J['kn'+s], 5.4, 3.7), cap(J['hp'+s], J['kn'+s], 5.4, 3.7, 1, sd+1));
      setPiece(set[1], cap(J['kn'+s], J['an'+s], 3.6, 2.4), cap(J['kn'+s], J['an'+s], 3.6, 2.4, 1, sd+2));
      setPiece(set[2], cap(J['he'+s], J['to'+s], 2.1, 1.6), cap(J['he'+s], J['to'+s], 2.1, 1.6, 1, sd+3));
    });
    /* tronco */
    setPiece(el.torso, cap(J.hip, J.sh, 6.0, 7.0), cap(J.hip, J.sh, 6.0, 7.0, 1, 13));
    var mid = [lerp(J.hip[0], J.sh[0], .62), lerp(J.hip[1], J.sh[1], .62)];
    el.chest.setAttribute('d', 'M'+(mid[0]-5.2).toFixed(1)+' '+mid[1].toFixed(1)+'Q'+(mid[0]+.5).toFixed(1)+' '+(mid[1]+2.2).toFixed(1)+' '+(mid[0]+5.4).toFixed(1)+' '+(mid[1]-.4).toFixed(1));
    var hd = '';
    for(i = 0; i < 5; i++){
      var q = .2 + i*.15, c0 = [lerp(J.hip[0], J.sh[0], q), lerp(J.hip[1], J.sh[1], q)], w = lerp(6.0, 7.0, q) - 1.4;
      var tn = [-Math.cos(P.lean*D), -Math.sin(P.lean*D)];                        /* hacia la espalda */
      var a0 = [c0[0] + tn[0]*w, c0[1] + tn[1]*w], a1 = [a0[0] - tn[0]*3.2 + 1.6, a0[1] - tn[1]*3.2 + 2.6];
      hd += 'M'+a0[0].toFixed(1)+' '+a0[1].toFixed(1)+'L'+a1[0].toFixed(1)+' '+a1[1].toFixed(1);
    }
    el.hatch.setAttribute('d', hd);
    /* cuello y cabeza */
    var nb = J.sh, nt = add(J.head, upv(P.lean + P.head), -L.hr + .6);
    setPiece(el.neck, cap(nb, nt, 2.4, 2.1), cap(nb, nt, 2.4, 2.1, 1, 17));
    el.head.setAttribute('transform', 'translate('+J.head[0].toFixed(1)+' '+J.head[1].toFixed(1)+') rotate('+(P.lean + P.head).toFixed(1)+')');
    /* brazos */
    ['B','F'].forEach(function(s, n){
      var set = s === 'B' ? el.armB : el.armF, sd = n*4 + 2;
      setPiece(set[0], cap(J['sh'+s], J['el'+s], 3.5, 2.6), cap(J['sh'+s], J['el'+s], 3.5, 2.6, 1, sd));
      setPiece(set[1], cap(J['el'+s], J['ha'+s], 2.6, 1.9), cap(J['el'+s], J['ha'+s], 2.6, 1.9, 1, sd+4));
      var hh = add(J['ha'+s], dn(P['ua'+s] + P['ea'+s]), 1.6);
      setPiece(set[2], circ(hh, 2.1), circ(hh, 2.1));
    });
    /* círculos de articulación (muñeco de dibujo) */
    var jd = '';
    ['kn','el','sh'].forEach(function(k){ ['F'].forEach(function(s){ jd += circ(J[k+s], 1.15); }); });
    jd += circ(J.hip, 1.3);
    el.joints.setAttribute('d', jd);

    /* extras de cada acción */
    var cur = ctx.flag, prev = ctx.prevFlag, e = ctx.e;
    function amt(name){ return cur === name ? e : (prev === name ? 1 - e : 0); }
    var hf = J.haF, ang = P.uaF + P.eaF;
    var fa = amt('point');
    el.finger.style.opacity = fa;
    if(fa > 0){ var tip = add(hf, dn(P.uaF + P.eaF), 7.5); el.finger.setAttribute('d', 'M'+hf[0].toFixed(1)+' '+hf[1].toFixed(1)+'L'+tip[0].toFixed(1)+' '+tip[1].toFixed(1)); }
    var da = amt('dim');
    el.dim.style.opacity = da;
    if(da > 0){
      var a = J.haF, b = J.haB, dxm = b[0]-a[0], dym = b[1]-a[1], l = Math.sqrt(dxm*dxm+dym*dym) || 1, nx = -dym/l*3.4, ny = dxm/l*3.4;
      el.dim.setAttribute('d', 'M'+a[0].toFixed(1)+' '+a[1].toFixed(1)+'L'+b[0].toFixed(1)+' '+b[1].toFixed(1)+
        'M'+(a[0]-nx+ny*.0).toFixed(1)+' '+(a[1]-ny).toFixed(1)+'L'+(a[0]+nx).toFixed(1)+' '+(a[1]+ny).toFixed(1)+
        'M'+(b[0]-nx).toFixed(1)+' '+(b[1]-ny).toFixed(1)+'L'+(b[0]+nx).toFixed(1)+' '+(b[1]+ny).toFixed(1)+
        'M'+(a[0]-nx*.5+ny*.7).toFixed(1)+' '+(a[1]-ny*.5-nx*.7).toFixed(1)+'L'+(a[0]+nx*.5-ny*.7).toFixed(1)+' '+(a[1]+ny*.5+nx*.7).toFixed(1)+
        'M'+(b[0]-nx*.5+ny*.7).toFixed(1)+' '+(b[1]-ny*.5-nx*.7).toFixed(1)+'L'+(b[0]+nx*.5-ny*.7).toFixed(1)+' '+(b[1]+ny*.5+nx*.7).toFixed(1));
    }
    var ta = amt('trail');
    el.trail.style.opacity = ta;
    if(cur === 'trail' && e > .5){
      trail.push([hf[0], hf[1]]); if(trail.length > 46) trail.shift();
      var d = ''; for(i = 0; i < trail.length; i++) d += (i ? 'L' : 'M') + trail[i][0].toFixed(1) + ' ' + trail[i][1].toFixed(1);
      el.trail.setAttribute('d', d);
    } else if(cur !== 'trail' && ta <= 0){ trail.length = 0; }
  }

  /* ---------- secciones, lados y movimiento ---------- */
  var secs = [], W = 0, VW = 0, VH = 0;
  var side = 'R', x = -999, tx = -999, face = -1, faceT = -1;
  var curMode = 'descansa', prevMode = 'descansa', k = 1, time = 0, cur = null, started = false, lastTs = 0, acc = 0, hidden = false;
  var SPEED = 480;
  var FLAGMAP = { dibuja:'trail', senala:'point', mide:'dim' };

  function config(){
    var out = [];
    function one(sel, act, s){ var n = document.querySelector(sel); if(n) out.push({ el:n, act:act, side:s }); }
    if(document.querySelector('.masthead')){
      one('.masthead', 'saludo', 'R');
      var cycle = ['mide','observa','estira','dibuja','senala','agacha','telefono'], i = 0;
      [].forEach.call(document.querySelectorAll('.proj'), function(n){
        out.push({ el:n, act:cycle[i % cycle.length], side:(i % 2 === 0 ? 'L' : 'R') }); i++;
      });
      one('.pdf', 'senala', 'L');
    } else {
      one('.hero', 'saludo', 'R'); one('#criterio', 'observa', 'L'); one('#servicios', 'dibuja', 'R');
      one('#proyectos', 'senala', 'L'); one('#sobre-mi', 'agacha', 'R'); one('#contacto', 'telefono', 'L');
    }
    return out;
  }
  function darkBg(n){
    while(n && n !== document.documentElement){
      var c = getComputedStyle(n).backgroundColor.match(/[\d.]+/g);
      if(c && (c.length < 4 || parseFloat(c[3]) > .5)) return (0.299*c[0] + 0.587*c[1] + 0.114*c[2]) < 110;
      n = n.parentNode;
    }
    return false;
  }
  function measure(){
    VW = root.clientWidth; VH = window.innerHeight;
    W = el.wrap.offsetWidth;
    hidden = VW < 900;
    var pad = Math.min(88, Math.max(20, VW*.052));
    var cL = Math.max(pad*.5, W*.34), cR = VW - Math.max(pad*.5 + 10, W*.34 + 12);
    el.cx = { L:cL, R:cR };
    tx = el.cx[side] - W/2;
  }
  function pick(){
    if(forced) return { act:forced === 'camina' ? 'descansa' : forced, side:'L', el:document.body };
    var mid = VH*.55, c = secs[0], i, r;
    for(i = 0; i < secs.length; i++){ if(secs[i].el.getBoundingClientRect().top <= mid) c = secs[i]; }
    /* una franja corta (p. ej. el botón "Ver proyectos" o el pie) manda mientras se la ve entera */
    for(i = 0; i < secs.length; i++){
      r = secs[i].el.getBoundingClientRect();
      if(r.height < VH*.5 && r.top >= -2 && r.bottom <= VH + 1) c = secs[i];
    }
    return c;
  }
  function onScroll(){
    if(!started) return;
    var c = pick();
    if(c !== cur){
      cur = c; side = c.side; tx = el.cx[side] - W/2;
      el.wrap.classList.toggle('is-light', darkBg(c.el));
    }
  }

  function frame(ts){
    requestAnimationFrame(frame);
    if(!started || document.hidden || hidden) return;
    var dt = Math.min(.1, (ts - lastTs)/1000); lastTs = ts;
    acc += dt; if(acc < 1/32) return;               /* ~30 cuadros: se siente a mano y cuesta poco */
    var st = acc; acc = 0; time += st;

    var dx = tx - x, moving = Math.abs(dx) > 2;
    if(moving){ var sg = dx > 0 ? 1 : -1; x += sg*Math.min(Math.abs(dx), SPEED*st); faceT = sg; }
    else faceT = side === 'L' ? 1 : -1;
    face += (faceT - face)*Math.min(1, st*16);

    var mode = forced === 'camina' ? 'camina' : (moving ? 'camina' : cur.act);
    if(mode !== curMode){ prevMode = curMode; curMode = mode; k = 0; }
    k = Math.min(1, k + st/.38); var e = k*k*(3 - 2*k);

    var A = build(prevMode, time), B = build(curMode, time), P = mix(A, B, e);
    el.wrap.style.transform = 'translate3d('+x.toFixed(1)+'px,0,0)';
    el.flip.setAttribute('transform', 'scale('+face.toFixed(3)+' 1)');
    render(P, { flag:FLAGMAP[curMode] || '', prevFlag:FLAGMAP[prevMode] || '', e:e });
  }

  function start(){
    if(started) return;
    measure(); cur = pick(); side = cur.side;
    tx = el.cx[side] - W/2;
    x = forced ? tx : (side === 'L' ? -W - 30 : VW + 30);      /* entra caminando desde el borde */
    el.wrap.classList.toggle('is-light', darkBg(cur.el));
    el.wrap.classList.add('is-on');
    started = true;
  }

  function boot(){
    secs = config(); init(); measure();
    window.addEventListener('scroll', onScroll, { passive:true });
    window.addEventListener('resize', function(){ measure(); if(started) x = Math.max(-W-30, Math.min(VW+30, x)); }, { passive:true });
    requestAnimationFrame(frame);
    /* espera a que termine la intro en video */
    function go(){ setTimeout(start, 500); }
    if(root.classList.contains('intro-on')){
      var mo = new MutationObserver(function(){ if(!root.classList.contains('intro-on')){ mo.disconnect(); go(); } });
      mo.observe(root, { attributes:true, attributeFilter:['class'] });
    } else go();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
