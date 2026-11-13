const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const header = document.querySelector('.header');
const mobileMenu = document.querySelector('.nav__mobile');

if (!document.body.classList.contains('subpage')) {
  const updateHeader = () => header.classList.toggle('is-stuck', scrollY > 24);
  updateHeader();
  addEventListener('scroll', updateHeader, { passive: true });

  if ('IntersectionObserver' in window) {
    const links = [...header.querySelectorAll('a[href^="#"]:not(.brand)')];
    const spy = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const link of links) {
          const active = link.hash === '#' + entry.target.id;
          link.classList.toggle('is-active', active);
          if (active) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        }
      }
    }, { rootMargin: '-35% 0px -55% 0px' });
    for (const id of new Set(links.map(link => link.hash.slice(1)))) {
      const section = document.getElementById(id);
      if (section) spy.observe(section);
    }
  }
}

if (mobileMenu) {
  const summary = mobileMenu.querySelector('summary');
  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!mobileMenu.open) return;
    if (!mobileMenu.contains(event.target) || link) mobileMenu.open = false;
    if (link && link.hash && link.pathname === location.pathname) {
      document.getElementById(link.hash.slice(1))?.focus({ preventScroll: true });
    }
  });
  mobileMenu.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !mobileMenu.open) return;
    mobileMenu.open = false;
    summary.focus();
  });
}

const intro = document.querySelector('[data-intro]');
if (intro && typeof intro.showModal === 'function') {
  const launch = document.querySelector('[data-intro-open]');
  const video = intro.querySelector('video');
  const status = intro.querySelector('[role="status"]');
  launch.hidden = false;
  launch.addEventListener('click', () => {
    const vertical = matchMedia('(orientation: portrait) and (max-width: 1024px)').matches;
    const compact = matchMedia('(max-width: 900px), (max-height: 560px)').matches;
    video.poster = vertical ? '/assets/intro-poster-vertical.jpg' : '/assets/intro-poster.jpg';
    video.src = vertical ? '/assets/intro-vertical.mp4' : compact ? '/assets/intro-720.mp4' : '/assets/intro-1080.mp4';
    status.textContent = '';
    intro.showModal();
    if (!reducedMotion.matches && !navigator.connection?.saveData) {
      video.play().catch(() => {});
    }
  });
  intro.querySelector('button').addEventListener('click', () => intro.close());
  video.addEventListener('error', () => {
    if (intro.open) status.textContent = 'El video no está disponible en este momento.';
  });
  intro.addEventListener('close', () => {
    video.pause();
    video.removeAttribute('src');
    video.load();
    if (!intro.open) launch.focus({ preventScroll: true });
  });
}

const edge = document.querySelector('[data-edge]');
if (edge) {
  const updateEdge = () => {
    const travel = document.documentElement.scrollHeight - innerHeight;
    edge.style.setProperty('--edge-position', (travel > 0 ? Math.min(1, Math.max(0, scrollY / travel)) : 0) * 70 + 'svh');
  };
  updateEdge();
  addEventListener('scroll', updateEdge, { passive: true });
  addEventListener('resize', updateEdge);
}

const hero = document.querySelector('.hero');
const heroImage = hero?.querySelector('img');
if (heroImage && matchMedia('(hover:hover) and (pointer:fine)').matches) {
  hero.addEventListener('pointermove', event => {
    if (reducedMotion.matches || event.pointerType !== 'mouse') return;
    const bounds = hero.getBoundingClientRect();
    const x = (0.5 - (event.clientX - bounds.left) / bounds.width) * 14;
    const y = (0.5 - (event.clientY - bounds.top) / bounds.height) * 8;
    heroImage.style.transform = 'scale(1.035) translate(' + x + 'px,' + y + 'px)';
  });
  hero.addEventListener('pointerleave', () => heroImage.style.removeProperty('transform'));
}
