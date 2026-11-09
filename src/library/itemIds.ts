// Item IDs: every library item's ID is fixed (type prefix IT + a number), never its name, so renaming an item touches
// only its name in the library. Code refers to items through IT; data and saves store the ID. A minted or improvised
// item's story ID is built from its base item's ID. Never reuse or renumber an ID; a new item takes the next free number.
export const IT = {
  dagger: 'IT1', arming_sword: 'IT2', greataxe: 'IT3', spear: 'IT4', shortbow: 'IT5',
  longbow: 'IT6', crossbow: 'IT7', hidden_blade: 'IT8', crude_clothes: 'IT9', cudgel: 'IT10',
  rusty_knife: 'IT11', gambeson: 'IT12', mail_hauberk: 'IT13', plate_harness: 'IT14', round_shield: 'IT15',
  signet_ring: 'IT16', lucky_charm: 'IT17', lockpicks: 'IT18', healing_draught: 'IT19', improvised_light: 'IT20',
  improvised_medium: 'IT21', improvised_heavy: 'IT22', curio: 'IT23', bandage: 'IT24', coin: 'IT25',
} as const;
