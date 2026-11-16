// Item IDs: every library item's ID is fixed (type prefix IT + a number), never its name, so renaming an item touches
// only its name in the library. Code refers to items through IT; data and saves store the ID. A minted or improvised
// item's story ID is built from its base item's ID. Never reuse or renumber an ID; a new item takes the next free number.
export const IT = {
  dagger: 'IT1', arming_sword: 'IT2', greataxe: 'IT3', spear: 'IT4', shortbow: 'IT5',
  longbow: 'IT6', crossbow: 'IT7', hidden_blade: 'IT8', crude_clothes: 'IT9', cudgel: 'IT10',
  rusty_knife: 'IT11', gambeson: 'IT12', mail_hauberk: 'IT13', plate_harness: 'IT14', round_shield: 'IT15',
  lucky_charm: 'IT17', lockpicks: 'IT18', healing_draught: 'IT19', improvised_light: 'IT20',
  improvised_medium: 'IT21', improvised_heavy: 'IT22', curio: 'IT23', bandage: 'IT24', coin: 'IT25',
  basket_hilt_sword: 'IT26', // IT16 (signet ring) retired: removed, never reused
  // starter pairs: a Common (25) and a Fine (50) piece for every gear class
  short_sword: 'IT27', hand_axe: 'IT28', woodsman_axe: 'IT29', greatsword: 'IT30', recurve_bow: 'IT31', flatbow: 'IT32',
  light_crossbow: 'IT33', stirrup_crossbow: 'IT34', boiled_leather: 'IT35', brigandine: 'IT36', lamellar_coat: 'IT37',
  half_plate: 'IT38', kite_shield: 'IT39',
  key: 'IT40', // BA3: a key; the instance names the barriers it opens (ItemInstance.opens)
  varos_loop: 'IT41', // D-218: the first Threadbound item, a charm, carried
  // CT1: containers
  pack: 'IT42', sack: 'IT43', chest: 'IT44', crate: 'IT45', // IT46 (belt with pouches), IT47 (bandolier) retired with pockets (PO4)
  // accessories
  spectacles: 'IT48', charmed_ring: 'IT49', ear_cup: 'IT50', amulet: 'IT51', hooded_cloak: 'IT52',
  // IR2: Superior pieces (need 75, real-world peak) and Masterwork pieces (need 100, past any real smith: tagged 'fantasy')
  rapier: 'IT53', longsword: 'IT54', turkish_bow: 'IT55', warbow: 'IT56', jack_of_plates: 'IT57', coat_of_plates: 'IT58', heater_shield: 'IT59',
  peerless_rapier: 'IT60', peerless_longsword: 'IT61', peerless_greatsword: 'IT62', peerless_composite_bow: 'IT63', peerless_warbow: 'IT64',
  peerless_crossbow: 'IT65', peerless_jack: 'IT66', peerless_coat_of_plates: 'IT67', peerless_plate: 'IT68', peerless_heater: 'IT69',
  // IR21: helmets, armor pieces that cover the head (some the neck), Common to Masterwork in each armor weight
  arming_cap: 'IT70', leather_cap: 'IT71', secret: 'IT72', peerless_cap: 'IT73',
  mail_coif: 'IT74', kettle_hat: 'IT75', sallet: 'IT76', peerless_sallet: 'IT77',
  nasal_helm: 'IT78', bascinet: 'IT79', great_helm: 'IT80', peerless_great_helm: 'IT81',
  // IR25-IR29: gauntlets, an unarmed weapon held in both grips, one pair per level
  leather_gloves: 'IT82', mail_mittens: 'IT83', plate_gauntlets: 'IT84', peerless_gauntlets: 'IT85',
} as const;
