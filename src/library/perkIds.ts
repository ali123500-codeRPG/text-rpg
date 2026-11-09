// Perk IDs: every perk's ID is fixed (type prefix PK + a number), never its name, so renaming a perk touches only its
// name in the library. Code refers to perks through PK; data and saves store the ID. Never reuse or renumber an ID;
// a new perk takes the next free number.
export const PK = {
  hidden_strike: 'PK1', turn_the_blade: 'PK2', shield_breaker: 'PK3', point_blank: 'PK4', hunters_mark: 'PK5',
  leg_bolt: 'PK6', open_hand_guard: 'PK7', hold: 'PK8', dirt_in_the_eyes: 'PK9', make_them_stumble: 'PK10',
  cover_ally: 'PK11', iron_frame: 'PK12', read_wounds: 'PK13', keen_ear: 'PK14', quick_word: 'PK15',
  threaten_for_answers: 'PK16', haggler: 'PK17', soft_tread: 'PK18', melt_away: 'PK19', slip_the_blow: 'PK20',
  quiet_mail: 'PK21', turn_aside: 'PK22', in_and_out: 'PK23', unblinking: 'PK24', set_them_up: 'PK25',
  one_two: 'PK26', answer_the_blow: 'PK27', blade_wall: 'PK28', keen_edge: 'PK29', guard_drill: 'PK30',
  heavy_hand: 'PK31', sharp_eyes: 'PK32', steady_draw: 'PK33', armor_piercer: 'PK34', street_fighter: 'PK35',
  iron_grip: 'PK36', brawlers_eye: 'PK37', light_feet: 'PK38', braced: 'PK39', quick_mend: 'PK40',
  marksmans_eye: 'PK41', soft_step: 'PK42', opening_strike: 'PK43', counter: 'PK44', fighters_frame: 'PK45',
  steady_guard: 'PK46', unerring: 'PK47', volley: 'PK48', past_the_cover: 'PK49', hunters_eye: 'PK50',
  hard_to_hold: 'PK51', iron_knuckles: 'PK52', bare_handed_guard: 'PK53', second_wind: 'PK54', dodgy: 'PK55',
  thick_hide: 'PK56', spotter: 'PK57', curiouser: 'PK58', night_eyes: 'PK59', strike_and_fade: 'PK60',
  child_of_night: 'PK61', hushed_steps: 'PK62', soft_landing: 'PK63', easy_speaker: 'PK64', silver_words: 'PK65',
  nobody_special: 'PK66', every_fall_a_lesson: 'PK67', as_far_as_the_road_goes: 'PK68', write_your_own_ending: 'PK69', no_road_closed: 'PK70',
  quick_study: 'PK71',
} as const;
/** a perk ID: PK + a number */
export type PerkId = `PK${number}`;
