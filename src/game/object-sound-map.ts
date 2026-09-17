/** Approved pack33 sample IDs. POP is deliberately event-only, never double-triggered. */
const toys = ['donut', 'rubber-duck', 'robot', 'dino', null, 'penguin', 'taxi', 'race-car', 'banana', 'space-shuttle', 'letter-block', 'plastic-brick', 'gummy-bear'] as const;
export const OBJECT_SAMPLES: Record<string, string> = {
  ...Object.fromEntries(toys.flatMap((sound, i) => sound ? [[`bumper-${i}`, sound], [`swing-toy-${i}`, sound]] : [])),
  ...Object.fromEntries(['keys', 'bottle-opener', 'disco-ball', 'rubber-duck', 'bead-lanyard', 'carabiner-whistle', 'wind-chime', 'baby-shoe', 'scissors', 'measuring-spoons', 'souvenir-spoon', 'fishing-lure'].map(id => [`swing-${id}`, id])),
  'swing-snack': 'lemon', 'swing-travel': 'trail', 'swing-doodle': 'star',
  ...Object.fromEntries(['clock', 'pinwheel', 'thermometer', 'fidget-spinner'].map(id => [`rotor-${id}`, id])),
  'rotor-snack': 'alphabet-rotor', 'rotor-travel': 'alphabet-rotor', 'rotor-doodle': 'alphabet-rotor',
};
