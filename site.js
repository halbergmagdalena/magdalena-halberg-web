/* ============================================================
   Línea editorial — elemento gráfico permanente
   No es un indicador de carga ni de progreso.
   ============================================================ */
(function(){
  var el = document.querySelector('[data-edge]');
  if(!el) return;
  var line = el.querySelector('.edge__line'),
      dot  = el.querySelector('.edge__dot'),
      reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var BASE = 0.30,   // altura de reposo, en fracción de viewport
      MAX  = 0.48,   // nunca más de la mitad de la pantalla
      MIN  = 0.26;

  var cur = 0, target = 0, h = 0, curH = BASE, lastScroll = 0, vel = 0;

  // continuidad entre páginas: retoma la posición anterior en vez de reiniciar
  try {
    var saved = sessionStorage.getItem('mh-edge');
    if(saved !== null) cur = parseFloat(saved);
  } catch(e){}

  function progress(){
    var max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  }

  function frame(){
    var vh = window.innerHeight;
    target = progress();

    // la altura respira levemente con la velocidad del scroll
    var want = Math.min(MAX, Math.max(MIN, BASE + Math.min(Math.abs(vel) / 2600, 0.18)));
    curH += (want - curH) * 0.06;
    vel *= 0.90;

    // inercia: la línea persigue al scroll, nunca lo copia
    cur += (target - cur) * (reduce ? 1 : 0.055);

    h = curH * vh;
    var travel = vh - h;
    var y = cur * travel;

    line.style.height = h + 'px';
    line.style.transform = 'translate3d(0,' + y + 'px,0)';
    dot.style.transform  = 'translate3d(0,' + (y + h) + 'px,0)';

    requestAnimationFrame(frame);
  }

  window.addEventListener('scroll', function(){
    vel = window.scrollY - lastScroll;
    lastScroll = window.scrollY;
    try { sessionStorage.setItem('mh-edge', String(progress())); } catch(e){}
  }, {passive:true});

  lastScroll = window.scrollY;
  requestAnimationFrame(frame);
})();

/* ============================================================
   Profundidad del hero — sólo el render responde al cursor.
   Tipografía, logo y navegación permanecen inmóviles.
   ============================================================ */
(function(){
  var img = document.querySelector('.hero__media img');
  if(!img) return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if(!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;

  var MAX = 7;                    // desplazamiento máximo, en píxeles
  var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;

  function loop(){
    cx += (tx - cx) * 0.045;      // seguimiento lento: nunca acompaña al cursor
    cy += (ty - cy) * 0.045;
    img.style.transform = 'scale(1.028) translate3d(' + cx.toFixed(2) + 'px,' + cy.toFixed(2) + 'px,0)';
    if(Math.abs(tx-cx) > 0.02 || Math.abs(ty-cy) > 0.02){ raf = requestAnimationFrame(loop) }
    else { raf = null }
  }
  function start(){ if(!raf) raf = requestAnimationFrame(loop) }

  window.addEventListener('mousemove', function(e){
    var w = window.innerWidth, h = window.innerHeight;
    tx = ((e.clientX / w) - 0.5) * -2 * MAX;
    ty = ((e.clientY / h) - 0.5) * -2 * (MAX * 0.6);
    start();
  }, {passive:true});

  window.addEventListener('mouseleave', function(){ tx = 0; ty = 0; start() });
})();

/* ============================================================
   Profundidad del hero — el render responde apenas al cursor.
   Sólo la imagen se mueve. Tipografía, logo y menú quedan fijos.
   ============================================================ */
(function(){
  var img = document.querySelector('.hero__media img');
  if(!img) return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if(!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;

  var MAX = 7;                     // desplazamiento máximo, en píxeles
  var tx=0, ty=0, cx=0, cy=0, raf=null, active=false;

  function onMove(e){
    var w = window.innerWidth, h = window.innerHeight;
    tx = ((e.clientX / w) - 0.5) * -2 * MAX;
    ty = ((e.clientY / h) - 0.5) * -2 * (MAX * 0.6);
    if(!raf) raf = requestAnimationFrame(frame);
  }

  function frame(){
    cx += (tx - cx) * 0.045;       // seguimiento lento: sugiere masa, no reacción
    cy += (ty - cy) * 0.045;
    img.style.transform = 'scale(1.028) translate3d(' + cx.toFixed(2) + 'px,' + cy.toFixed(2) + 'px,0)';
    if(Math.abs(tx-cx) > 0.05 || Math.abs(ty-cy) > 0.05){
      raf = requestAnimationFrame(frame);
    } else { raf = null; }
  }

  // sólo mientras el hero está en pantalla
  var hero = document.querySelector('.hero');
  if(hero && 'IntersectionObserver' in window){
    new IntersectionObserver(function(es){
      es.forEach(function(e){
        if(e.isIntersecting && !active){ active=true; window.addEventListener('mousemove', onMove, {passive:true}) }
        else if(!e.isIntersecting && active){ active=false; window.removeEventListener('mousemove', onMove) }
      });
    },{threshold:0.05}).observe(hero);
  } else {
    window.addEventListener('mousemove', onMove, {passive:true});
  }
})();

/* ============================================================
   Profundidad del hero — el render responde levemente al cursor.
   Sólo la imagen. Tipografía, logo y navegación quedan fijos.
   ============================================================ */
(function(){
  var wrap = document.querySelector('[data-depth]');
  if(!wrap) return;
  var img = wrap.querySelector('img');
  if(!img) return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if(!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;

  var MAX = 7;                    // desplazamiento máximo, en píxeles
  var tx=0, ty=0, cx=0, cy=0, live=false;

  window.addEventListener('mousemove', function(e){
    tx = ((e.clientX / window.innerWidth)  - 0.5) * -2 * MAX;
    ty = ((e.clientY / window.innerHeight) - 0.5) * -2 * MAX;
    if(!live){ live=true; requestAnimationFrame(loop) }
  }, {passive:true});

  function loop(){
    cx += (tx - cx) * 0.045;      // seguimiento lento: da peso, no reacción
    cy += (ty - cy) * 0.045;
    img.style.transform = 'scale(1.035) translate3d(' + cx.toFixed(2) + 'px,' + cy.toFixed(2) + 'px,0)';
    if(Math.abs(tx-cx) > 0.05 || Math.abs(ty-cy) > 0.05){ requestAnimationFrame(loop) } else { live=false }
  }
})();
