// The class tree: links come from the library's unlock rules, the tree shows the classes you have and the next step from
// each, dead ends are marked, and every class keeps one lane across the tier bands so a link runs straight across; a gold thread follows
// the character's own path.
import { describe, expect, it } from 'vitest';
import { classLinks } from '../../src/ui/classTree';
import { CL } from '../../src/library/classIds';

describe('class tree', () => {
  it('links come from the unlock rules: Commoner opens A Nobody, Trader opens Merchant, both at its top level', () => {
    const links = classLinks();
    expect(links).toContainEqual(expect.objectContaining({ from: CL.commoner, to: CL.a_nobody }));
    expect(links).toContainEqual(expect.objectContaining({ from: CL.trader, to: CL.merchant }));
    for (const l of links.filter((x) => x.from === CL.trader || x.from === CL.commoner)) expect(l.via).toBe('its top level');
    for (const l of links) expect(l.via, `${l.from} → ${l.to}`).toMatch(/^(its top level|level \d+)$/); // capstones never unlock classes
  });

});
