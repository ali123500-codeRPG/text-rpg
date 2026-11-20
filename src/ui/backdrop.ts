// PS-486 to PS-489, M-75: the picture behind the play screen. The page starts plain; a picture is fetched only when a
// shown turn names it, decoded, then faded in over the one before it (which stays until the new one is ready).
// Two fixed layers sit behind everything; each carries the veil over its picture, so text contrast never changes.

const URL_OF = (id: string) => `assets/backdrops/${id}.webp`;
let layers: [HTMLElement, HTMLElement] | null = null;
let front = 0;
let shown: string | undefined;
let wanted: string | undefined;

function ensureLayers(): [HTMLElement, HTMLElement] {
  if (layers) return layers;
  const make = () => Object.assign(document.createElement('div'), { className: 'backdrop', ariaHidden: 'true' });
  layers = [make(), make()];
  document.body.prepend(...layers);
  return layers;
}

/** show this picture (none: the plain page colour); called each time the screen redraws, so a repeat does nothing */
export function showBackdrop(id: string | undefined): void {
  if (id === wanted) return;
  wanted = id;
  const [a, b] = ensureLayers();
  if (!id) { a.classList.remove('on'); b.classList.remove('on'); shown = undefined; return; }
  const img = new Image();
  img.src = URL_OF(id);
  img.decode().then(() => {
    if (wanted !== id || shown === id) return; // a later turn asked for another picture meanwhile
    const next = front === 0 ? b : a, prev = front === 0 ? a : b;
    next.style.setProperty('--backdrop', `url("${img.src}")`);
    next.classList.add('on', 'top'); // the new one fades in on top; the old one goes only once it is covered
    prev.classList.remove('top');
    next.addEventListener('transitionend', () => { if (next.classList.contains('top')) prev.classList.remove('on'); }, { once: true });
    front = 1 - front;
    shown = id;
  }).catch(() => undefined); // a file that fails to load leaves the picture before it (or the plain colour)
}
