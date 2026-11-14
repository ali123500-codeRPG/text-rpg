// The rpg-map skill's geometry checker (MAP-51), as the skill gives it: run in the page after the map renders, on the live
// SVG, since it measures the browser's real text sizes. Each finding names its rule. The map runs it after every to-scale
// render in dev views (?fake= or ?mapcheck) and logs every finding (MAP-53).
export function checkMap(svg: SVGSVGElement): string[] {
  const out: string[] = [];
  const els = Array.from(svg.querySelectorAll<SVGElement>("[data-role]")).map((el) => {
    const b = el.getBoundingClientRect();
    return { el, role: el.dataset.role, id: el.dataset.id, b };
  });
  const by = (r: string) => els.filter((e) => e.role === r);
  const hit = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const inside = (a: DOMRect, b: DOMRect, pad = 0) => a.left >= b.left + pad && a.right <= b.right - pad && a.top >= b.top + pad && a.bottom <= b.bottom - pad;
  const box = svg.getBoundingClientRect();
  const zones = by('zone');
  // MAP-11: zones may not partially overlap
  for (let i = 0; i < zones.length; i++) for (let j = i + 1; j < zones.length; j++) {
    const a = zones[i], b = zones[j];
    if (hit(a.b, b.b) && !inside(a.b, b.b) && !inside(b.b, a.b)) out.push(`MAP-11 zones ${a.id} and ${b.id} partially overlap`);
  }
  // MAP-20: inside labels must fit their zone with padding
  for (const l of by('label')) {
    const z = zones.find((x) => x.id === l.el.dataset.for);
    if (l.el.dataset.placement === 'inside' && z && !inside(l.b, z.b, 6)) out.push(`MAP-20 label ${l.id} does not fit zone ${z.id}`);
  }
  // MAP-22, MAP-31: labels, tokens and icons must not overlap each other
  const marks = [...by('label'), ...by('token'), ...by('icon')];
  for (let i = 0; i < marks.length; i++) for (let j = i + 1; j < marks.length; j++) {
    const a = marks[i], b = marks[j];
    if (hit(a.b, b.b)) out.push(`MAP-22/31 ${a.role} ${a.id} overlaps ${b.role} ${b.id}`);
  }
  // MAP-32: every exit names its target
  for (const x of by('exit')) if (!x.el.dataset.target) out.push(`MAP-32 exit ${x.id} has no target`);
  // Nothing may render outside the map
  for (const e of els) if (!inside(e.b, box)) out.push(`MAP-50 ${e.role} ${e.id} extends past the map edge`);
  return out;
}
