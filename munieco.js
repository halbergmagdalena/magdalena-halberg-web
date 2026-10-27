/* ============================================================
   Tipitos — figuras humanas en trazo de croquis
   Como la escala humana de una lámina: cada uno está posado sobre
   un elemento de la página (una línea, una imagen, un botón, el piso
   de una sección), se mueve con él y hace su propia acción. Los que
   están junto a un botón reaccionan cuando se pasa el mouse. Los que
   van arriba o abajo de una imagen eligen la postura según el espacio
   libre que haya (parado, agachado, sentado, acostado).
   Decorativos: aria-hidden, sin eventos de puntero. Con "reducir
   movimiento" quedan quietos. Solo se animan los que están a la vista.
   ============================================================ */
(function(){
  'use strict';
  var NS = 'http://www.w3.org/2000/svg', D = Math.PI/180;
  var REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- medidas (unidades de dibujo; el tipito mide ~100) ---------- */
  var L = { torso:30, neck:3, hr:7.2, ua:15, fa:14, th:22, sh:21 };
  var VB = { x:-56, y:-116, w:112, h:128 };      /* el suelo (o el asiento) es y = 0 */

  function dn(a){ a *= D; return [Math.sin(a), Math.cos(a)]; }     /* 0 = abajo, 90 = adelante */
  function upv(a){ a *= D; return [Math.sin(a), -Math.cos(a)]; }   /* 0 = arriba */
  function add(p,v,k){ return [p[0]+v[0]*k, p[1]+v[1]*k]; }
  function lerp(a,b,t){ return a+(b-a)*t; }
  function f1(v){ return (Math.round(v*10)/10).toString(); }
  function pulse(t, f, sharp){ return Math.pow(Math.max(0, Math.sin(t*f)), sharp); }   /* gesto que aparece cada tanto */

  /* ---------- cinemática directa ---------- */
  function skel(P, seat){
    var J = { hip:[0,0] };
    J.sh   = add(J.hip, upv(P.lean), L.torso);
    J.neck = add(J.sh, upv(P.lean + P.head*0.4), L.neck);
    J.head = add(J.neck, upv(P.lean + P.head), L.hr);
    ['F','B'].forEach(function(s){
      var o = s === 'F' ? 0.8 : -0.8;
      var sh = [J.sh[0]+o, J.sh[1]];
      var el = add(sh, dn(P['ua'+s]), L.ua);
      var ha = add(el, dn(P['ua'+s] + P['ea'+s]), L.fa);
      var hp = [o, 0];
      var kn = add(hp, dn(P['t'+s]), L.th);
      var an = add(kn, dn(P['t'+s] - P['k'+s]), L.sh);
      var fa = P['f'+s];
      J['sh'+s]=sh; J['el'+s]=el; J['ha'+s]=ha; J['hp'+s]=hp; J['kn'+s]=kn; J['an'+s]=an;
      J['he'+s] = add(add(an, dn(fa), -2.6), [0,1], 1.9);
      J['to'+s] = add(add(an, dn(fa), 7),    [0,1], 1.9);
    });
    /* apoyo en y = 0 — 'stand': el pie más bajo · 'sit': la cadera (sentado en un borde) ·
       'floor': la parte más baja del cuerpo, contando su grosor (acostado, gateando, en el piso) */
    var low;
    if(seat === 'sit' || seat === true) low = 5.2;
    else if(seat === 'floor'){
      low = -99;
      [['hpF',5.4],['hpB',5.4],['knF',3.7],['knB',3.7],['anF',2.4],['anB',2.4],['heF',2.1],['heB',2.1],['toF',1.6],['toB',1.6],
       ['elF',2.6],['elB',2.6],['haF',3.2],['haB',3.2],['sh',7],['hip',6],['head',7.4]].forEach(function(r){ low = Math.max(low, J[r[0]][1] + r[1]); });
    } else if(seat === 'hang'){                            /* colgado: las manos toman el borde (y = 0) */
      var hF = add(J.haF, dn(P.uaF + P.eaF), 1.6), hB = add(J.haB, dn(P.uaB + P.eaB), 1.6);
      low = Math.min(hF[1], hB[1]) - 1.2;
    } else low = Math.max(J.heF[1], J.toF[1], J.heB[1], J.toB[1]) + 1.5;
    var dy = seat === 'hang' ? -low : -low - P.lift;
    for(var k in J){ if(J.hasOwnProperty(k)) J[k] = [J[k][0], J[k][1] + dy]; }
    return J;
  }

  /* ---------- cinemática inversa de los brazos ---------- */
  function ik(S, T){
    var l1 = L.ua, l2 = L.fa, dx = T[0]-S[0], dy = T[1]-S[1];
    var d = Math.sqrt(dx*dx+dy*dy);
    d = Math.min(Math.max(d, Math.abs(l1-l2)+0.01), l1+l2-0.01);
    var base = Math.atan2(dx, dy);
    var A = Math.acos(Math.max(-1, Math.min(1, (l1*l1 + d*d - l2*l2)/(2*l1*d))));
    var a1 = base - A;
    var E = [S[0] + Math.sin(a1)*l1, S[1] + Math.cos(a1)*l1];
    return [a1/D, (Math.atan2(T[0]-E[0], T[1]-E[1]) - a1)/D];
  }

  /* ---------- poses ----------
     Cada acción recibe P (ángulos), t (segundos) y g (geometría del lugar:
     g.dx = distancia al botón, g.top = alto del botón, en unidades). */
  var DEF = { lean:3, head:0, tF:5, kF:5, fF:90, tB:-5, kB:5, fB:90,
              uaF:8, eaF:20, uaB:-6, eaB:18, lift:0 };

  function piernasSentado(P, t, k){                    /* piernas colgando de un borde */
    k = k || 1;
    P.tF = 84 + 3*Math.sin(t*1.1); P.kF = 82 + 16*k*Math.sin(t*2.6);
    P.tB = 80 + 3*Math.sin(t*1.1 + 1); P.kB = 82 + 16*k*Math.sin(t*2.6 + Math.PI);
    P.fF = 66; P.fB = 66;
  }
  function piernasEnElPiso(P, t){                      /* una estirada, la otra con la rodilla arriba */
    P.tF = 88; P.kF = 4; P.fF = 168;
    P.tB = 124 + 5*Math.sin(t*1.2); P.kB = P.tB - 48; P.fB = 96;
  }
  function manoEnElBorde(P, s, x){ P['h'+s] = function(J){ return [x, J.hip[1] + 5.2 - .6]; }; }
  function manoEnLaCadera(P, s){ P['ua'+s] = -28; P['ea'+s] = 80; }

  var ACT = {
    descansa: function(P,t){ P.head = 3*Math.sin(t*0.8); },

    /* ----- de pie ----- */
    saludo: function(P,t){
      P.lean = -2; P.head = 4 + 2*Math.sin(t*1.3);
      P.uaF = 142; P.eaF = 24 + 30*Math.sin(t*9);
      P.uaB = -4;  P.eaB = 14;
      P.tF = 7; P.kF = 3; P.tB = -6; P.kB = 2;
    },
    senalaNombre: function(P,t){                        /* señala hacia arriba y adelante (el nombre) */
      var b = Math.sin(t*2.4);
      P.lean = -4; P.head = -16 + 3*Math.sin(t*0.9);
      P.tF = 9; P.kF = 3; P.tB = -7; P.kB = 3;
      P.hF = function(J){ return [J.shF[0] + 20, J.shF[1] - 21 + 2.2*b]; };
      manoEnLaCadera(P, 'B');
      P.lift = 0.9*Math.abs(b);
      P.flag = 'point';
    },
    observa: function(P,t){
      P.lean = 5; P.head = -6 + 7*Math.sin(t*0.9);
      P.tF = 11; P.kF = 3; P.tB = -10; P.kB = 3;
      P.hF = function(J){ return [J.head[0] + 8.5, J.head[1] - 3.2]; };
      manoEnLaCadera(P, 'B');
    },
    mide: function(P,t){
      var a = 0.5 + 0.5*Math.sin(t*1.5);
      P.lean = 6; P.head = 6;
      P.tF = 10; P.kF = 3; P.tB = -9; P.kB = 3;
      P.hF = function(J){ return [J.shF[0] + 24 + 14*a, J.shF[1] + 6]; };
      P.hB = function(J){ return [J.shB[0] + 8 - a, J.shB[1] + 6]; };
      P.flag = 'dim';
    },
    estira: function(P,t){
      var s = 0.5 + 0.5*Math.sin(t*2.1);
      P.lean = -7; P.head = -10;
      P.uaF = 152 + 5*Math.sin(t*2.1); P.eaF = 6; P.uaB = 143 + 5*Math.sin(t*2.1 + 1); P.eaB = 8;
      P.tF = 2; P.kF = 0; P.tB = -2; P.kB = 0;
      P.fF = 90 - 38*s; P.fB = 90 - 38*s; P.lift = 0.4 + 2.4*s;
    },
    equilibrio: function(P,t){                          /* en una pierna, brazos como alas */
      var w = Math.sin(t*1.6), w2 = Math.sin(t*2.7);
      P.lean = 24 + 5*w; P.head = -22 - 4*w;
      P.tF = -2 + 2*w2; P.kF = 3; P.fF = 90;
      P.tB = -58 - 8*w; P.kB = 14; P.fB = 40;
      P.uaF = 96 + 12*w2; P.eaF = 6; P.uaB = -96 - 12*w2; P.eaB = -6;
    },
    agacha: function(P,t){
      P.lean = 30 + 1.5*Math.sin(t*1.4); P.head = -12 + 3*Math.sin(t*0.9) - 14*pulse(t, .7, 8);
      P.tF = 98; P.kF = 112; P.tB = 92; P.kB = 106; P.fF = 94; P.fB = 94;
      P.hF = function(J){ return [J.knF[0] + 1, J.knF[1] + 4.5]; };
      P.hB = function(J){ return [J.knB[0] - 1, J.knB[1] + 5.5]; };
    },
    telefono: function(P,t){
      P.lean = 2; P.head = -2 + 3*Math.sin(t*2.6);
      P.tF = 8; P.kF = 2; P.tB = -3; P.kB = 15;
      P.hF = function(J){ return [J.head[0] - 1.6, J.head[1] + 3]; };
      P.uaB = 14; P.eaB = 104;
    },
    festeja: function(P,t){
      var s = Math.max(0, Math.sin(t*7.5));
      P.lean = -3; P.head = -8;
      P.uaF = 158 + 8*Math.sin(t*7.5); P.eaF = 12; P.uaB = 148 - 8*Math.sin(t*7.5); P.eaB = 14;
      P.tF = 6; P.kF = 6 + 10*s; P.tB = -6; P.kB = 6 + 10*s;
      P.fF = 90 - 30*s; P.fB = 90 - 30*s; P.lift = 4.5*s*s;
    },
    paseo: function(P,t){                               /* camina tranquilo (el lugar lo desplaza) */
      var ph = t*2*Math.PI*1.5, s = Math.sin(ph), c = Math.cos(ph);
      P.lean = 4; P.head = -2 + 2*Math.sin(t*0.6);
      P.tF = 22*s; P.tB = -22*s;
      P.kF = 5 + 34*Math.pow(Math.max(0, c), 1.4);
      P.kB = 5 + 34*Math.pow(Math.max(0, -c), 1.4);
      P.fF = 90 + 0.5*(P.tF - P.kF); P.fB = 90 + 0.5*(P.tB - P.kB);
      P.uaF = -18*s; P.eaF = 22; P.uaB = 18*s; P.eaB = 22;
    },

    /* ----- junto a un botón ----- */
    empuja: function(P,t,g){
      var e = Math.sin(t*2.4);
      P.lean = 34 + 2.5*e; P.head = -22;
      P.tF = 22; P.kF = 34; P.tB = -30 - 2*e; P.kB = 2; P.fF = 92; P.fB = 66;
      P.hF = function(){ return [g.dx - .4 + .6*e, -(g.top - 6)]; };
      P.hB = function(){ return [g.dx - .4 + .6*e, -(g.top - 12)]; };
    },
    tira: function(P,t,g){                              /* tira del botón hacia sí, con todo el cuerpo */
      var e = Math.sin(t*2.2);
      P.lean = -24 - 4*e; P.head = 14;
      P.tF = 30 + 2*e; P.kF = 4; P.fF = 104; P.tB = -4; P.kB = 30; P.fB = 90;
      P.hF = function(){ return [g.dx - .6, -(g.top*.5 + 1)]; };
      P.hB = function(){ return [g.dx - 2.4, -(g.top*.5 - 1.5)]; };
    },
    apoyado: function(P,t,g){
      P.lean = 5; P.head = 5 + 3*Math.sin(t*1.1);
      P.tF = -5; P.kF = 9; P.fF = 74; P.tB = 5; P.kB = 2;
      P.hF = function(){ return [g.dx - 1.2, -(g.top + .4)]; };
      manoEnLaCadera(P, 'B');
    },

    /* ----- sentados en un borde ----- */
    sentadoDibuja: function(P,t){                       /* dibuja y cada tanto levanta la vista */
      var up = pulse(t, .55, 6);
      P.lean = 12 - 8*up; P.head = 22 - 34*up + 2*Math.sin(t*0.7);
      piernasSentado(P, t, .9);
      P.hF = function(J){ return [J.knF[0] - 3 + 5*Math.sin(t*4.1)*(1-up), J.knF[1] - 6.5 + 3.2*Math.sin(t*2.7)*(1-up) - 4*up]; };
      P.hB = function(J){ return [J.knB[0] - 7, J.knB[1] - 4]; };
      P.flag = 'trail';
    },
    sentadoObserva: function(P,t){
      P.lean = 4; P.head = -8 + 7*Math.sin(t*0.9);
      piernasSentado(P, t, .6);
      P.hF = function(J){ return [J.head[0] + 8.5, J.head[1] - 3.2]; };
      manoEnElBorde(P, 'B', -5);
    },
    sentadoPatea: function(P,t){
      P.lean = -9 + 1.5*Math.sin(t*1.3); P.head = 6 + 4*Math.sin(t*0.8);
      piernasSentado(P, t, 1.4);
      manoEnElBorde(P, 'F', -7); manoEnElBorde(P, 'B', -9);
    },
    sentadoSaluda: function(P,t){
      P.lean = -4; P.head = 6;
      piernasSentado(P, t, 1.1);
      P.uaF = 146; P.eaF = 22 + 32*Math.sin(t*9);
      manoEnElBorde(P, 'B', -7);
    },
    sentadoSenala: function(P,t){
      var b = Math.sin(t*2.4);
      P.lean = -2; P.head = -18;
      piernasSentado(P, t, .9);
      P.hF = function(J){ return [J.shF[0] + 18, J.shF[1] - 22 + 2*b]; };
      manoEnElBorde(P, 'B', -7);
      P.flag = 'point';
    },

    /* ----- en el piso / acostados ----- */
    abraza: function(P,t){                              /* sentado en el piso abrazando las rodillas */
      var r = Math.sin(t*1.2);
      P.lean = 22 + 3*r; P.head = -14 + 5*Math.sin(t*.8);
      P.tF = 128; P.kF = 85; P.fF = 95; P.tB = 124; P.kB = 80; P.fB = 95;
      P.hF = function(J){ return [J.knF[0] + 1.5, J.knF[1] + 7]; };
      P.hB = function(J){ return [J.knB[0] - .5, J.knB[1] + 8]; };
    },
    gatea: function(P,t){                               /* gatea (el lugar lo desplaza) */
      var ph = t*2*Math.PI*1.1, s = Math.sin(ph);
      P.lean = 84 + 2*Math.sin(ph*2); P.head = -64 + 4*Math.sin(t*.9);
      P.tF = 4 + 14*s; P.tB = 4 - 14*s; P.kF = 88 + 8*s; P.kB = 88 - 8*s; P.fF = -90; P.fB = -90;
      P.hF = function(J){ return [J.sh[0] + 4 - 6*s, -2.1 - 2.5*Math.max(0, -Math.cos(ph))]; };
      P.hB = function(J){ return [J.sh[0] + 4 + 6*s, -2.1 - 2.5*Math.max(0,  Math.cos(ph))]; };
    },
    flexiones: function(P,t){                           /* hace flexiones */
      var s = 0.5 + 0.5*Math.sin(t*2.6);
      P.lean = 72 + 10*s; P.head = 4 - 6*s;
      P.tF = -P.lean; P.kF = 0; P.tB = -P.lean + 2; P.kB = 0; P.fF = 12; P.fB = 12;
      P.hF = function(J){ return [J.sh[0] + 1.5, -2.1]; };
      P.hB = function(J){ return [J.sh[0] - .5, -2.1]; };
    },
    lee: function(P,t){                                 /* sentado en el piso leyendo; da vuelta la página */
      var pg = pulse(t, .5, 10);
      P.lean = 6 + 2*Math.sin(t*0.6); P.head = 24 - 10*pulse(t, .31, 8);
      piernasEnElPiso(P, t);
      P.hF = function(J){ return [J.sh[0] + 11 - 6*pg, J.sh[1] + 12 - 3*pg]; };
      P.hB = function(J){ return [J.sh[0] + 8.5, J.sh[1] + 13]; };
      P.flag = 'book';
    },
    colgado: function(P,t){                             /* colgado del borde, se balancea y patalea */
      var sw = 5*Math.sin(t*1.5);
      P.lean = sw; P.head = 6 - sw + 4*Math.sin(t*.8);
      P.uaF = 178 + sw; P.eaF = 0; P.uaB = 172 + sw; P.eaB = 4;
      P.tF = 80 + 10*Math.sin(t*2.6) + sw; P.kF = 132 + 8*Math.sin(t*2.6);     /* rodillas recogidas */
      P.tB = 74 - 10*Math.sin(t*2.6) + sw; P.kB = 128 - 8*Math.sin(t*2.6);
      P.fF = 60; P.fB = 60;
    },
    bocaAbajo: function(P,t){                           /* boca abajo, el mentón en las manos, pateando */
      P.lean = 78 + 2*Math.sin(t*.8); P.head = -66 + 4*Math.sin(t*.9);
      P.tF = -84; P.kF = 80 + 22*Math.sin(t*2.4); P.fF = -150;
      P.tB = -80; P.kB = 80 + 22*Math.sin(t*2.4 + Math.PI); P.fB = -150;
      P.hF = function(J){ return [J.head[0] + 2.5, J.head[1] + 7.5]; };
      P.hB = function(J){ return [J.head[0] + 1, J.head[1] + 8]; };
    },
    siesta: function(P,t){                              /* boca arriba, las manos en la nuca */
      P.lean = -86 + 1.5*Math.sin(t*.7); P.head = 74;
      P.tF = 88; P.kF = 3; P.fF = 170;
      P.tB = 118 + 4*Math.sin(t*.6); P.kB = P.tB - 48; P.fB = 96;
      P.hF = function(J){ return [J.head[0] - 3.5, J.head[1] - 1]; };
      P.hB = function(J){ return [J.head[0] - 4.5, J.head[1] + 1.5]; };
    },
    acostado: function(P,t){                            /* acostado de costado, la cabeza en la mano */
      P.lean = -72 + 2*Math.sin(t*0.9); P.head = 66 + 5*Math.sin(t*0.7);
      piernasEnElPiso(P, t);
      P.tB = 122 + 8*Math.sin(t*1.3); P.kB = P.tB - 48;
      P.hB = function(J){ return [J.head[0] + 1.5, J.head[1] + 6.2]; };
      P.hF = function(J){ return [J.hip[0] - 7, J.hip[1] - 5 + 1.2*Math.sin(t*1.1)]; };
    }
  };

  /* alto aproximado de cada postura sobre su apoyo, en unidades (para ver si entra) */
  /* medidos sobre el dibujo (unidades): alto sobre el apoyo y ancho [atrás, adelante] */
  var ALTO = { paseo:95, saludo:106, telefono:94, equilibrio:93, estira:114, observa:94, mide:104,
               agacha:67, lee:57, abraza:54, gatea:50, flexiones:45, acostado:37, bocaAbajo:35, siesta:29, colgado:90 };   /* colgado: largo debajo del borde */
  var EXT  = { paseo:[-26,24], saludo:[-11,23], telefono:[-14,21], equilibrio:[-46,49], estira:[-15,18],
               observa:[-15,22], agacha:[-7,28], lee:[-8,47], abraza:[-7,42], gatea:[-35,44],
               flexiones:[-46,48], acostado:[-41,47], bocaAbajo:[-42,43], siesta:[-43,47], colgado:[-11,27], mide:[-14,37] };
  var MODO = { lee:'floor', acostado:'floor', abraza:'floor', gatea:'floor', flexiones:'floor', bocaAbajo:'floor', siesta:'floor', colgado:'hang' };
  function modo(act){ return MODO[act] || (/^sentado/.test(act) ? 'sit' : 'stand'); }
  var PASO = { paseo:92, gatea:34 };                  /* los que se desplazan, en unidades por segundo */

  function build(name, t, g, seat){
    var P = {}; for(var k in DEF) P[k] = DEF[k];
    P.hF = null; P.hB = null; P.flag = '';
    (ACT[name] || ACT.descansa)(P, t, g);
    P.lean += 0.5*Math.sin(t*1.7);
    if(P.hF || P.hB){
      var J = skel(P, seat);
      ['F','B'].forEach(function(s){
        var h = P['h'+s]; if(!h) return;
        var r = ik(J['sh'+s], h(J)); P['ua'+s] = r[0]; P['ea'+s] = r[1];
      });
    }
    return P;
  }
  function mix(A, B, e){ var P = {}; for(var k in DEF) P[k] = lerp(A[k], B[k], e); return P; }

  /* ---------- dibujo ---------- */
  var JIT = [ .31,-.42,.18,.37,-.26,.44,-.15,.29,-.38,.21,-.33,.4,.12,-.45,.27,-.19,.35,-.3,.16,.41,-.22,.34 ];
  function cap(p0, p1, r0, r1, jit, i){
    if(jit){
      i = i || 0;
      p0 = [p0[0] + JIT[i % 22]*1.5, p0[1] + JIT[(i+3) % 22]*1.5];
      p1 = [p1[0] + JIT[(i+7) % 22]*1.5, p1[1] + JIT[(i+11) % 22]*1.5];
      r0 += JIT[(i+5) % 22]*.5; r1 += JIT[(i+9) % 22]*.5;
    }
    var dx = p1[0]-p0[0], dy = p1[1]-p0[1], len = Math.sqrt(dx*dx+dy*dy) || 1, nx = -dy/len, ny = dx/len;
    return 'M'+f1(p0[0]+nx*r0)+' '+f1(p0[1]+ny*r0)+'L'+f1(p1[0]+nx*r1)+' '+f1(p1[1]+ny*r1)+
           'A'+f1(r1)+' '+f1(r1)+' 0 0 0 '+f1(p1[0]-nx*r1)+' '+f1(p1[1]-ny*r1)+
           'L'+f1(p0[0]-nx*r0)+' '+f1(p0[1]-ny*r0)+'A'+f1(r0)+' '+f1(r0)+' 0 0 0 '+f1(p0[0]+nx*r0)+' '+f1(p0[1]+ny*r0)+'Z';
  }
  function circ(c, r){ return 'M'+f1(c[0]-r)+' '+f1(c[1])+'a'+r+' '+r+' 0 1 0 '+f1(2*r)+' 0a'+r+' '+r+' 0 1 0 '+f1(-2*r)+' 0Z'; }
  function mk(tag, attrs, parent){
    var n = document.createElementNS(NS, tag);
    for(var k in attrs) n.setAttribute(k, attrs[k]);
    parent.appendChild(n); return n;
  }
  function piece(layer, back){
    var o = back ? .5 : 1;
    return { a: mk('path', { 'class':'mu-l1', 'stroke-opacity':o }, layer),
             b: mk('path', { 'class':'mu-l2', 'stroke-opacity':o*.55 }, layer) };
  }
  function setPiece(p, d1, d2){ p.a.setAttribute('d', d1); p.b.setAttribute('d', d2); }

  function makeFigure(host, cls){
    var wrap = document.createElement('div');
    wrap.className = 'mu' + (cls ? ' ' + cls : ''); wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = '<svg viewBox="'+VB.x+' '+VB.y+' '+VB.w+' '+VB.h+'" focusable="false"><g class="mu-flip" filter="url(#mu-lapiz)"></g></svg>';
    host.appendChild(wrap);
    var g = wrap.querySelector('.mu-flip'), e = { wrap:wrap, flip:g };
    e.ground = mk('path', { 'class':'mu-ground', d:'M-30 1.2C-12 .2 8 1.9 33 .7M-26 1.8l-3 4M-16 1.6l-3 4M-6 1.8l-3 4M6 1.8l-3 4M18 1.4l-3 4' }, g);
    var back = mk('g', {}, g), mid = mk('g', {}, g), front = mk('g', {}, g), extra = mk('g', {}, g);
    e.armB = [piece(back,1), piece(back,1), piece(back,1)];
    e.legB = [piece(back,1), piece(back,1), piece(back,1)];
    e.torso = piece(mid);
    e.hatch = mk('path', { 'class':'mu-l2', 'stroke-opacity':.6 }, mid);
    e.chest = mk('path', { 'class':'mu-l2', 'stroke-opacity':.4 }, mid);
    e.legF = [piece(front), piece(front), piece(front)];
    e.neck = piece(front);
    e.joints = mk('path', { 'class':'mu-joint' }, front);
    e.head = mk('g', {}, front);
    mk('ellipse', { 'class':'mu-l1', cx:0, cy:0, rx:6.1, ry:L.hr }, e.head);
    mk('ellipse', { 'class':'mu-l2', cx:.3, cy:-.2, rx:5.7, ry:7.5, 'stroke-opacity':.5 }, e.head);
    mk('path', { 'class':'mu-l1', d:'M5.9 .4L8.1 2.9L5.7 3.5' }, e.head);
    mk('path', { 'class':'mu-hair', d:'M-5.9 1.2C-7 -6.6 -1.6 -9.2 4.6 -6.6' }, e.head);
    mk('circle', { 'class':'mu-hair', cx:-6.3, cy:-5.4, r:2.7 }, e.head);
    mk('path', { 'class':'mu-l2', d:'M-1.4 .8c1 -1 2.2 -.6 2.3 .8' }, e.head);
    mk('circle', { 'class':'mu-eye', cx:3.1, cy:-.9, r:.62 }, e.head);
    mk('path', { 'class':'mu-l2', d:'M3.4 4.5c.9 .4 1.7 .3 2.4 -.2' }, e.head);
    e.armF = [piece(front), piece(front), piece(front)];
    e.finger = mk('path', { 'class':'mu-l1' }, extra);
    e.dim = mk('path', { 'class':'mu-dim' }, extra);
    e.trail = mk('path', { 'class':'mu-trail' }, extra);
    e.book = mk('path', { 'class':'mu-l1' }, extra);
    return e;
  }

  function render(fig, P, cur, prev, e){
    var E = fig.e, J = skel(P, fig.seat), i;
    ['B','F'].forEach(function(s, n){
      var set = s === 'B' ? E.legB : E.legF, sd = n*5;
      setPiece(set[0], cap(J['hp'+s], J['kn'+s], 5.4, 3.7), cap(J['hp'+s], J['kn'+s], 5.4, 3.7, 1, sd+1));
      setPiece(set[1], cap(J['kn'+s], J['an'+s], 3.6, 2.4), cap(J['kn'+s], J['an'+s], 3.6, 2.4, 1, sd+2));
      setPiece(set[2], cap(J['he'+s], J['to'+s], 2.1, 1.6), cap(J['he'+s], J['to'+s], 2.1, 1.6, 1, sd+3));
    });
    setPiece(E.torso, cap(J.hip, J.sh, 6.0, 7.0), cap(J.hip, J.sh, 6.0, 7.0, 1, 13));
    var hd = '', tn = [-Math.cos(P.lean*D), -Math.sin(P.lean*D)];
    for(i = 0; i < 5; i++){
      var q = .2 + i*.15, c0 = [lerp(J.hip[0], J.sh[0], q), lerp(J.hip[1], J.sh[1], q)], w = lerp(6.0, 7.0, q) - 1.4;
      var a0 = [c0[0] + tn[0]*w, c0[1] + tn[1]*w];
      hd += 'M'+f1(a0[0])+' '+f1(a0[1])+'L'+f1(a0[0] - tn[0]*3.2 + 1.6)+' '+f1(a0[1] - tn[1]*3.2 + 2.6);
    }
    E.hatch.setAttribute('d', hd);
    var md = [lerp(J.hip[0], J.sh[0], .62), lerp(J.hip[1], J.sh[1], .62)];
    E.chest.setAttribute('d', 'M'+f1(md[0]-5.2)+' '+f1(md[1])+'Q'+f1(md[0]+.5)+' '+f1(md[1]+2.2)+' '+f1(md[0]+5.4)+' '+f1(md[1]-.4));
    var nt = add(J.head, upv(P.lean + P.head), -L.hr + .6);
    setPiece(E.neck, cap(J.sh, nt, 2.4, 2.1), cap(J.sh, nt, 2.4, 2.1, 1, 17));
    E.head.setAttribute('transform', 'translate('+f1(J.head[0])+' '+f1(J.head[1])+') rotate('+f1(P.lean + P.head)+')');
    ['B','F'].forEach(function(s, n){
      var set = s === 'B' ? E.armB : E.armF, sd = n*4 + 2;
      setPiece(set[0], cap(J['sh'+s], J['el'+s], 3.5, 2.6), cap(J['sh'+s], J['el'+s], 3.5, 2.6, 1, sd));
      setPiece(set[1], cap(J['el'+s], J['ha'+s], 2.6, 1.9), cap(J['el'+s], J['ha'+s], 2.6, 1.9, 1, sd+4));
      var hh = add(J['ha'+s], dn(P['ua'+s] + P['ea'+s]), 1.6);
      setPiece(set[2], circ(hh, 2.1), circ(hh, 2.1));
    });
    E.joints.setAttribute('d', circ(J.knF,1.15) + circ(J.elF,1.15) + circ(J.shF,1.15) + circ(J.hip,1.3));

    function amt(n){ return cur === n ? e : (prev === n ? 1 - e : 0); }
    var hf = J.haF, fa = amt('point'), da = amt('dim'), ta = amt('trail'), ba = amt('book');
    E.finger.style.opacity = fa;
    if(fa > 0){ var tip = add(hf, dn(P.uaF + P.eaF), 7.5); E.finger.setAttribute('d', 'M'+f1(hf[0])+' '+f1(hf[1])+'L'+f1(tip[0])+' '+f1(tip[1])); }
    E.dim.style.opacity = da;
    if(da > 0){
      var a = J.haF, b = J.haB, dx = b[0]-a[0], dy = b[1]-a[1], l = Math.sqrt(dx*dx+dy*dy) || 1, nx = -dy/l*3.4, ny = dx/l*3.4;
      E.dim.setAttribute('d', 'M'+f1(a[0])+' '+f1(a[1])+'L'+f1(b[0])+' '+f1(b[1])+
        'M'+f1(a[0]-nx)+' '+f1(a[1]-ny)+'L'+f1(a[0]+nx)+' '+f1(a[1]+ny)+'M'+f1(b[0]-nx)+' '+f1(b[1]-ny)+'L'+f1(b[0]+nx)+' '+f1(b[1]+ny)+
        'M'+f1(a[0]-nx*.5+ny*.7)+' '+f1(a[1]-ny*.5-nx*.7)+'L'+f1(a[0]+nx*.5-ny*.7)+' '+f1(a[1]+ny*.5+nx*.7)+
        'M'+f1(b[0]-nx*.5+ny*.7)+' '+f1(b[1]-ny*.5-nx*.7)+'L'+f1(b[0]+nx*.5-ny*.7)+' '+f1(b[1]+ny*.5+nx*.7));
    }
    E.book.style.opacity = ba;
    if(ba > 0){                                            /* libro abierto entre las manos */
      var c = [(J.haF[0] + J.haB[0])/2 + 1, (J.haF[1] + J.haB[1])/2 - 2.2];
      E.book.setAttribute('d', 'M'+f1(c[0])+' '+f1(c[1])+'L'+f1(c[0]-5)+' '+f1(c[1]-3.4)+'L'+f1(c[0]-5.4)+' '+f1(c[1]+1.6)+'L'+f1(c[0])+' '+f1(c[1]+4)+'Z'+
        'M'+f1(c[0])+' '+f1(c[1])+'L'+f1(c[0]+3.6)+' '+f1(c[1]-4.4)+'L'+f1(c[0]+4.4)+' '+f1(c[1]+.6)+'L'+f1(c[0])+' '+f1(c[1]+4));
    }
    E.trail.style.opacity = ta;
    if(cur === 'trail' && e > .5){
      fig.trail.push([hf[0], hf[1]]); if(fig.trail.length > 46) fig.trail.shift();
      var d = ''; for(i = 0; i < fig.trail.length; i++) d += (i ? 'L' : 'M') + f1(fig.trail[i][0]) + ' ' + f1(fig.trail[i][1]);
      E.trail.setAttribute('d', d);
    } else if(cur !== 'trail' && ta <= 0) fig.trail.length = 0;
  }

  /* ---------- dónde va cada tipito ----------
     Un lugar define host (contenedor donde se inserta) y, o bien un modo
     simple ('stand' / 'sit' sobre el borde superior del ancla, 'right' de pie
     a la derecha de un botón, mirándolo), o una función pos(rel, u, host) que
     devuelve { x, y, face, act?, seat?, pace?, range? } en px relativos al host. */
  function q(sel, ctx){ return (ctx || document).querySelector(sel); }

  function spotsHome(narrow){
    /* portada: en la esquina inferior derecha, parado sobre el piso de la imagen, señalando hacia el nombre */
    var hero = { host:'.hero', anchor:'.hero__inner', act: narrow ? 'saludo' : 'senalaNombre', cls:'mu--hero',
      pos:function(rel, u, host){
        var pad = Math.min(88, Math.max(20, host.clientWidth*.052));
        return { x: host.clientWidth - pad - 22*u, y: host.clientHeight - Math.max(12, pad*.32), face:-1 };
      } };
    return [
      hero,
      { host:'.criterio__plate', anchor:'.criterio__plate img', mode:'sit',
        at: narrow ? .84 : 1, off: narrow ? 0 : -4, face:1, act:'sentadoDibuja' },
      { host:'.svc-plate', anchor:'.svc-plate img', mode:'sit', at: narrow ? .5 : .56, face:-1, act:'acostado' },
      { host:'.pf__side', anchor:'.pf__side .btn', mode:'right', gap:21, act:'empuja', hover:'festeja' },
      { host:'.about__cta', anchor:'.about__cta .btn', mode:'sit', at:1, off:-6, face:1, act:'sentadoPatea', hover:'sentadoSaluda' },
      { host:'.form__send', anchor:'.form__send', mode:'right', gap:15, act:'apoyado', hover:'festeja', hostUp:true, quiet:'#form-note' }
    ];
  }

  function spotsProyectos(narrow){
    /* Un tipito fijo por proyecto (sin elección automática), uno para computadora y
       otro para celular. Lugares:
         arriba  : parado sobre el borde superior de la imagen
         esquina : sentado en una esquina superior de la imagen (lado 1 = la que da al texto)
         texto   : sentado o parado sobre la última línea de la ficha
         linea   : parado sobre la primera línea de la ficha
         titulo  : sobre el número naranja ("03 / Residencial")
         colgado : colgado del borde inferior derecho de la imagen
         abajo   : debajo de la imagen — en computadora sobre la línea de abajo del
                   proyecto; en celular justo debajo de la imagen, antes del texto      */
    var PC = [
      { k:'arriba',  at:.4,  face:-1, act:'equilibrio' },       /* 01 */
      { k:'texto',   at:.88, act:'sentadoObserva' },            /* 02 */
      { k:'titulo',  at:.66, act:'acostado' },                  /* 03 */
      { k:'colgado', act:'colgado' },                           /* 04 */
      { k:'abajo',   at:.5,  face:1,  act:'flexiones' },        /* 05 */
      { k:'linea',   at:.9,  act:'mide' },                      /* 06 */
      { k:'arriba',  at:.6,  face:1,  act:'estira' },           /* 07 */
      { k:'titulo',  at:.7,  act:'flexiones' },                 /* 08 */
      { k:'abajo',   at:.45, face:1,  act:'siesta' },           /* 09 */
      { k:'esquina', lado:0, act:'sentadoSaluda' }              /* 10 */
    ];
    var CEL = [
      { k:'esquina', lado:1, act:'sentadoDibuja' },             /* 01 */
      { k:'texto',   at:.86, act:'sentadoObserva' },            /* 02 */
      { k:'titulo',  at:.66, act:'acostado' },                  /* 03 */
      { k:'colgado', act:'colgado' },                           /* 04 */
      { k:'abajo',   at:.72, face:1,  act:'flexiones' },        /* 05 */
      { k:'linea',   at:.94, act:'mide' },                      /* 06 */
      { k:'texto',   at:.86, act:'sentadoSaluda' },             /* 07 */
      { k:'titulo',  at:.7,  act:'flexiones' },                 /* 08 */
      { k:'esquina', lado:1, act:'sentadoSenala' },             /* 09 */
      { k:'texto',   at:.88, act:'saludo' }                     /* 10 */
    ];
    var plan = narrow ? CEL : PC, out = [];
    [].forEach.call(document.querySelectorAll('.proj'), function(sec, i){
      var p = plan[i % plan.length], flip = sec.classList.contains('proj--flip');
      var media = q('.proj__media', sec), win = q('.car__win', sec) || media, body = q('.proj__body', sec);
      var rows = body.querySelectorAll('.meta__row'), linea = rows.length ? rows[rows.length-1] : body;
      var meta = q('.meta', body) || body, num = q('.proj__num', body) || body;
      /* del lado del texto mira hacia la imagen; en celular, hacia el margen libre */
      var haciaImagen = narrow ? 1 : (flip ? 1 : -1);
      function arribaEn(el, ancestro){                         /* distancia vertical hasta el ancestro, sin transformaciones */
        var y = 0; while(el && el !== ancestro){ y += el.offsetTop; el = el.offsetParent; } return y;
      }
      function textoDe(el, host){                              /* la caja del texto (no del bloque) */
        var rg = document.createRange(); rg.selectNodeContents(el);
        var tb = rg.getBoundingClientRect(), hb = host.getBoundingClientRect();
        return { x: tb.left - hb.left, y: tb.top - hb.top, w: tb.width, h: tb.height };
      }
      var spot;
      if(p.k === 'esquina'){
        var interior = p.lado === 1, derecha = narrow ? interior : (flip ? !interior : interior);
        spot = { hostEl:media, anchorEl:win, mode:'sit', act:p.act,
          at: narrow ? (derecha ? .84 : .16) : (derecha ? 1 : 0), off: narrow ? 0 : (derecha ? -4 : 4), face: derecha ? 1 : -1 };
      } else if(p.k === 'texto'){
        spot = { hostEl:body, anchorEl:linea, act:p.act,
          pos:function(rel, u){ var l = rel(linea); return encuadre({ x: l.x + l.w*p.at, y: l.y + l.h, face:haciaImagen, act:p.act }, l, u); } };
      } else if(p.k === 'linea'){
        spot = { hostEl:body, anchorEl:meta, act:p.act,
          pos:function(rel, u){ var m = rel(meta); return encuadre({ x: m.x + m.w*p.at, y: m.y, face:haciaImagen, act:p.act }, m, u); } };
      } else if(p.k === 'titulo'){
        spot = { hostEl:body, anchorEl:num, act:p.act,
          pos:function(rel, u, host){ var t = textoDe(num, host); return encuadre({ x: t.x + t.w*p.at, y: t.y, face:haciaImagen, act:p.act }, t, u); } };
      } else if(p.k === 'colgado'){
        spot = { hostEl:media, anchorEl:win, act:p.act,
          pos:function(rel, u){ var w = rel(win); return encuadre({ x: w.x + w.w - 18*u, y: w.y + w.h, face:-1, act:p.act }, w, u); } };
      } else if(p.k === 'arriba'){
        spot = { hostEl:media, anchorEl:win, act:p.act,
          pos:function(rel, u){ var w = rel(win); return encuadre({ x: w.x + w.w*p.at, y: w.y, face:p.face, act:p.act }, w, u); } };
      } else if(narrow){
        /* abajo, en celular: justo debajo de la imagen, apoyado en la altura del número naranja */
        spot = { hostEl:media, anchorEl:win, act:p.act,
          pos:function(rel, u){
            var w = rel(win), piso = arribaEn(num, sec) - arribaEn(media, sec);          /* sin la animación de entrada */
            return encuadre({ x: w.x + w.w*p.at, y: piso, face:p.face, act:p.act }, w, u);
          } };
      } else {
        /* abajo, en computadora: sobre la línea de abajo del proyecto, debajo de la imagen */
        spot = { hostEl:media, anchorEl:win, act:p.act,
          pos:function(rel, u){
            var w = rel(win), piso = sec.clientHeight - media.offsetTop;
            return encuadre({ x: w.x + w.w*p.at, y: piso, face:p.face, act:p.act }, w, u);
          } };
      }
      spot.k = p.k; out.push(spot);
    });
    /* el botón del portfolio: tira de él */
    if(q('.pdf__side .btn')) out.push({ host:'.pdf__side', anchor:'.pdf__side .btn', mode:'right', gap:26, act:'tira', hover:'festeja' });
    return out;
  }

  /* mantiene el cuerpo entero dentro del tramo de apoyo (no queda colgando del borde).
     Todos los tipitos tienen la misma escala. */
  function encuadre(o, span, u){
    var ex = EXT[o.act] || [-14, 14], m = 3*u;
    var izq = (o.face === 1 ? -ex[0] : ex[1])*u, der = (o.face === 1 ? ex[1] : -ex[0])*u;    /* lo que ocupa a cada lado */
    var lo = span.x + izq + m, hi = span.x + span.w - der - m;
    if(PASO[o.act]){
      var r = Math.max(ex[1], -ex[0])*u;
      lo = span.x + r + m; hi = span.x + span.w - r - m;
      o.range = Math.max(0, Math.min(o.x - lo, hi - o.x, (hi - lo)/2));
      o.pace = o.range > 8;
    }
    o.x = hi < lo ? span.x + span.w/2 : Math.min(hi, Math.max(lo, o.x));
    o.mode = modo(o.act);
    return o;
  }

  /* ---------- armado ---------- */
  var figs = [], last = 0, acc = 0;

  function setupDefs(){
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('aria-hidden', 'true'); s.setAttribute('width', '0'); s.setAttribute('height', '0');
    s.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    s.innerHTML = '<defs><filter id="mu-lapiz" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.7" xChannelSelector="R" yChannelSelector="G"/></filter></defs>';
    document.body.appendChild(s);
  }

  function setBase(f, act, m){
    if(f.base === act && f.seat === m) return;
    f.base = act; f.seat = m; f.cur = act; f.prev = act; f.k = 1; f.trail.length = 0;
  }

  function place(f, avoid){
    var H = f.e.wrap.offsetHeight; if(!H) return;
    var u = H/VB.h, hr = f.host.getBoundingClientRect(), sp = f.spot, x, y;
    function rel(el){ var r = el.getBoundingClientRect(); return { x:r.left-hr.left, y:r.top-hr.top, w:r.width, h:r.height }; }
    f.pace = false; f.range = 0; f.sc = 1;
    if(sp.pos){
      var o = sp.pos(rel, u, f.host, avoid);
      x = o.x; y = o.y; f.face = o.face || 1; f.g = { dx:0, top:0 }; f.sc = o.sc || 1;
      if(o.act) setBase(f, o.act, o.mode || modo(o.act));
      f.pace = !!o.pace; f.range = o.range || 0;
    } else {
      var a = rel(f.anchor);
      if(sp.mode === 'right'){
        x = a.x + a.w + sp.gap*u; y = a.y + a.h;
        f.face = -1; f.g = { dx:sp.gap, top:a.h/u };
      } else {
        x = a.x + a.w*sp.at + (sp.off || 0)*u; y = a.y;
        f.face = sp.face || 1; f.g = { dx:0, top:0 };
      }
    }
    f.u = u;
    f.e.wrap.style.left = (x + VB.x*u).toFixed(1) + 'px';
    f.e.wrap.style.top  = (y + VB.y*u).toFixed(1) + 'px';
    f.e.ground.style.display = sp.mode === 'right' ? '' : 'none';
    f.e.wrap.style.transformOrigin = '50% ' + (-VB.y/VB.h*100).toFixed(2) + '%';    /* el punto de apoyo */
    if(!f.pace) f.px = 0;
    f.e.wrap.style.transform = mover(f);
    f.e.flip.setAttribute('transform', 'scale(' + (f.pace ? f.dir : f.face) + ' 1)');
  }

  function mover(f){ return (f.px ? 'translateX(' + f.px.toFixed(1) + 'px) ' : '') + (f.sc !== 1 ? 'scale(' + f.sc.toFixed(3) + ')' : ''); }

  function create(spot, i){
    var anchor = spot.anchorEl || q(spot.anchor);
    var host = spot.hostEl || q(spot.host);
    if(!anchor || !host) return null;
    if(spot.hostUp) host = host.parentElement;            /* un <button> no puede alojar al tipito */
    if(getComputedStyle(host).position === 'static') host.style.position = 'relative';
    var f = { spot:spot, host:host, anchor:anchor, e:makeFigure(host, spot.cls), trail:[], seat: spot.mode === 'sit' ? 'sit' : modo(spot.act),
              base:spot.act, cur:spot.act, prev:spot.act, k:1, hover:false, visible:false, t0:i*1.37,
              face:1, dir:(i % 2 ? -1 : 1), px:0, pace:false, range:0, u:1, g:{dx:0,top:0} };
    if(spot.hover){
      ['mouseenter','focus'].forEach(function(ev){ anchor.addEventListener(ev, function(){ f.hover = true; }); });
      ['mouseleave','blur'].forEach(function(ev){ anchor.addEventListener(ev, function(){ f.hover = false; }); });
    }
    if(spot.quiet){
      var note = q(spot.quiet);
      if(note) new MutationObserver(function(){ f.e.wrap.classList.toggle('is-quiet', !!note.textContent.trim()); })
        .observe(note, { childList:true, characterData:true, subtree:true });
    }
    return f;
  }

  function draw(f, time, st){
    var mode = f.hover && f.spot.hover ? f.spot.hover : f.base;
    if(mode !== f.cur){ f.prev = f.cur; f.cur = mode; f.k = 0; }
    var e = f.k*f.k*(3 - 2*f.k), t = time + f.t0;
    if(f.pace && st){                                      /* camina de un lado al otro debajo de la imagen */
      f.px += f.dir * (PASO[f.base] || 60)*f.u*f.sc * st;
      if(f.px >  f.range){ f.px =  f.range; f.dir = -1; }
      if(f.px < -f.range){ f.px = -f.range; f.dir =  1; }
      f.e.wrap.style.transform = mover(f);
      f.e.flip.setAttribute('transform', 'scale(' + f.dir + ' 1)');
    }
    var A = build(f.prev, t, f.g, f.seat), B = build(f.cur, t, f.g, f.seat);
    render(f, mix(A, B, e), B.flag, f.k < 1 ? A.flag : '', e);
  }

  function frame(ts){
    requestAnimationFrame(frame);
    var dt = Math.min(.1, (ts - last)/1000); last = ts;
    if(document.hidden) return;
    acc += dt; if(acc < 1/32) return;                      /* ~30 cuadros por segundo */
    var st = acc; acc = 0;
    for(var i = 0; i < figs.length; i++){
      var f = figs[i]; if(!f.visible) continue;
      f.time = (f.time || 0) + st;
      f.k = Math.min(1, f.k + st/.38);
      draw(f, f.time, st);
    }
  }

  var MQ_N = window.matchMedia('(max-width: 899px)');
  var io = null, ro = null, booted = false;
  function layout(){                                      /* en orden, para no repetir la actividad del anterior */
    var prev = null;
    figs.forEach(function(f){ place(f, f.spot.hover ? null : prev); prev = f.base; });
  }

  function mount(){
    var spots = document.querySelector('.proj') ? spotsProyectos(MQ_N.matches) : spotsHome(MQ_N.matches);
    spots.forEach(function(s, i){ var f = create(s, i); if(f) figs.push(f); });
    if(!figs.length) return;
    layout();
    if(window.ResizeObserver){
      ro = new ResizeObserver(layout);
      figs.forEach(function(f){ ro.observe(f.host); ro.observe(f.anchor); });
    }
    if(REDUCE){ figs.forEach(function(f){ f.time = 1.2; draw(f, 1.2, 0); }); return; }
    if('IntersectionObserver' in window){
      io = new IntersectionObserver(function(es){
        es.forEach(function(en){ for(var i = 0; i < figs.length; i++) if(figs[i].e.wrap === en.target) figs[i].visible = en.isIntersecting; });
      }, { rootMargin:'120px 0px' });
      figs.forEach(function(f){ io.observe(f.e.wrap); });
    } else figs.forEach(function(f){ f.visible = true; });
    figs.forEach(function(f){ f.time = 0; draw(f, 0, 0); });
  }
  function unmount(){
    if(io) io.disconnect(); if(ro) ro.disconnect(); io = ro = null;
    figs.forEach(function(f){ f.e.wrap.remove(); });
    figs = [];
  }
  function remount(){ unmount(); mount(); }

  function boot(){
    if(booted) return; booted = true;
    setupDefs(); mount();
    window.addEventListener('load', layout);
    window.addEventListener('resize', layout, { passive:true });
    document.addEventListener('animationend', layout);     /* el nombre y el rol entran animados */
    document.addEventListener('transitionend', function(ev){ if(ev.target.classList && ev.target.classList.contains('rise') && ev.propertyName === 'transform') layout(); });
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    if(MQ_N.addEventListener) MQ_N.addEventListener('change', remount); else if(MQ_N.addListener) MQ_N.addListener(remount);
    if(!REDUCE) requestAnimationFrame(frame);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
