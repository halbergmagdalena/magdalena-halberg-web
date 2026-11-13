(() => {
  const viewer = document.querySelector('[data-lb]');
  if (!viewer || typeof viewer.showModal !== 'function') return;
  const fullImage = viewer.querySelector('.lb__img');
  const fullCount = viewer.querySelector('[data-lb-count]');
  const fullCaption = viewer.querySelector('[data-lb-caption]');
  const fullError = viewer.querySelector('.lb__error');
  const previous = viewer.querySelector('.lb__nav--prev');
  const next = viewer.querySelector('.lb__nav--next');
  const close = viewer.querySelector('.lb__close');
  let active;

  const countText = (index, length) => [index + 1, length].map(number => String(number).padStart(2, '0')).join(' / ');

  function showFull() {
    const { index, images } = active.gallery;
    const image = images[index];
    fullError.textContent = '';
    fullImage.hidden = false;
    viewer.classList.add('is-loading');
    fullImage.alt = image.alt;
    fullImage.src = image.dataset.full || image.src;
    if (fullImage.complete && fullImage.naturalWidth) viewer.classList.remove('is-loading');
    fullCount.textContent = countText(index, images.length);
    fullCaption.textContent = image.alt;
    previous.disabled = index === 0;
    next.disabled = index === images.length - 1;
    if (document.activeElement?.disabled) (previous.disabled ? next : previous).focus();
  }

  function moveFull(step) {
    if (active && active.gallery.move(step)) showFull();
  }

  function onSwipe(element, move) {
    let start;
    let swallowClickUntil = 0;
    element.addEventListener('touchstart', event => {
      start = event.touches.length === 1 ? event.touches[0] : undefined;
    }, { passive: true });
    element.addEventListener('touchcancel', () => { start = undefined; }, { passive: true });
    element.addEventListener('touchend', event => {
      if (!start) return;
      const end = event.changedTouches[0];
      const x = end.clientX - start.clientX;
      const y = end.clientY - start.clientY;
      start = undefined;
      if (Math.abs(x) > 45 && Math.abs(x) > 1.3 * Math.abs(y)) {
        swallowClickUntil = performance.now() + 400;
        move(x < 0 ? 1 : -1);
      }
    }, { passive: true });
    element.addEventListener('click', event => {
      if (performance.now() < swallowClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    }, true);
  }

  fullImage.addEventListener('load', () => viewer.classList.remove('is-loading'));
  fullImage.addEventListener('error', () => {
    if (!viewer.open) return;
    viewer.classList.remove('is-loading');
    fullImage.hidden = true;
    fullError.textContent = 'No se pudo cargar esta imagen. Podés seguir recorriendo la galería.';
  });
  previous.addEventListener('click', () => moveFull(-1));
  next.addEventListener('click', () => moveFull(1));
  close.addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', event => {
    if (event.target.matches('.lb, .lb__stage')) viewer.close();
  });
  viewer.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    moveFull(event.key === 'ArrowLeft' ? -1 : 1);
  });
  viewer.addEventListener('close', () => {
    if (viewer.open || !active) return;
    const { gallery, fromImage, trigger } = active;
    active = undefined;
    fullImage.removeAttribute('src');
    (fromImage ? gallery.buttons[gallery.index] : trigger).focus({ preventScroll: true });
  });
  onSwipe(viewer.querySelector('.lb__stage'), moveFull);

  for (const carousel of document.querySelectorAll('[data-car]')) {
    const figure = carousel.closest('figure');
    const track = carousel.querySelector('.car__track');
    const images = [...track.querySelectorAll('img')];
    const back = carousel.querySelector('.car__btn--prev');
    const forward = carousel.querySelector('.car__btn--next');
    const counter = figure.querySelector('[data-car-count]');
    const description = figure.querySelector('[data-car-description]');
    const expand = figure.querySelector('[data-car-expand]');
    const gallery = { images, index: 0, buttons: [], move };

    function openViewer(trigger, fromImage) {
      active = { gallery, trigger, fromImage };
      viewer.showModal();
      showFull();
      close.focus({ preventScroll: true });
    }

    for (const [index, image] of images.entries()) {
      const button = document.createElement('button');
      button.className = 'car__slide';
      button.type = 'button';
      button.setAttribute('aria-label', 'Ampliar imagen ' + (index + 1) + ': ' + image.alt);
      image.replaceWith(button);
      button.append(image);
      button.addEventListener('click', () => openViewer(button, true));
      gallery.buttons.push(button);
    }

    function draw() {
      const { index } = gallery;
      track.style.transform = 'translateX(' + (-index * 100) + '%)';
      gallery.buttons.forEach((button, i) => {
        button.inert = i !== index;
      });
      back.disabled = index === 0;
      forward.disabled = index === images.length - 1;
      counter.textContent = countText(index, images.length);
      description.textContent = images[index].alt;
    }

    function move(step) {
      const target = gallery.index + step;
      if (target < 0 || target >= images.length) return false;
      const focused = document.activeElement;
      gallery.index = target;
      draw();
      if (focused === back && back.disabled) forward.focus();
      else if (focused === forward && forward.disabled) back.focus();
      return true;
    }

    back.addEventListener('click', () => move(-1));
    forward.addEventListener('click', () => move(1));
    expand.addEventListener('click', () => openViewer(expand, false));
    counter.setAttribute('aria-live', 'polite');
    expand.hidden = false;
    carousel.classList.add('car--ready');
    onSwipe(carousel, move);
    draw();
  }
})();
