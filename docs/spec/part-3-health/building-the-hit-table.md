### Building the hit table

1. The general area takes its 30% minimum.
2. Every other part still in existence gets its size weight; a big general area also gets weight 4 on top of its minimum.
3. The remaining 70% is split in proportion to weight and rounded to whole numbers that sum to 100: each takes its whole share, and the points left go one each by largest remainder; ties go to the bigger weight, then to the later entry (this reproduces the tables below).
4. Parts are laid out in database order, general area last; a separate d100 location roll picks the band, read as rolled (a 37 hits the part whose band holds 37; no digit reversal).
5. When a part is Destroyed, the table is rebuilt from step 1 without it.
6. A shield is never on the hit table; it takes only hits routed to it by a block.

**Humanoid**

| Part | Size | Impact | Roles | Location roll |
| --- | --- | --- | --- | --- |
| Head | Small | Essential | Sense, Speech | 01–07 |
| Left arm | Normal | Normal | Grip | 08–22 |
| Right arm | Normal | Normal | Grip | 23–37 |
| Left leg | Normal | Normal | Move | 38–52 |
| Right leg | Normal | Normal | Move | 53–67 |
| Neck | Extra small | Essential | — | 68–70 |
| General (torso) | — | Normal | — | 71–00 |

Humanoids have a left and a right leg, each with its own pool (Ali, 07/11/2026). Move is a shared role, so one Damaged leg gives half the Move penalty; one Crippled leg (50% of the role's parts) does not stop running, one Destroyed leg (counted twice) does. Saves from schema v3 are converted: both legs start from the old legs pool, and armor that covered legs covers both.

The neck is adjacent to the head and the general area. Head and neck are separate in every calculation.

**Dragon (example)**

| Part | Size | Impact | Roles | Location roll |
| --- | --- | --- | --- | --- |
| Head | Normal | Essential | Sense, Strike, Speech | 01–09 |
| Left wing | Normal | Non-essential | Fly | 10–18 |
| Right wing | Normal | Non-essential | Fly | 19–27 |
| Forelegs | Normal | Normal | Move | 28–36 |
| Hind legs | Normal | Normal | Move | 37–46 |
| Tail | Small | Non-essential | Strike | 47–51 |
| General (body) | Big | Normal | — | 52–00 |

The dragon's big body gives its general area 49% (30% minimum + 19%). Crippling a wing hurts its flight without costing it any HP; destroying the tail removes it from the table, and the other parts' bands grow to fill the gap.
