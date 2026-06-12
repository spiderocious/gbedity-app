// Curated common English words for the operational game_words collection, grouped by commonness
// tier (→ rank). Tier 5 = everyday/very common (picked most often); tier 2 = still common but a bit
// less frequent. All lowercase, single a–z, family-safe. The seed script assigns difficulty from
// length. This is the starting set — admins promote more from the reference collections.

// Tier 5 — extremely common everyday words.
export const TIER_5 = [
  'apple', 'house', 'water', 'happy', 'green', 'table', 'chair', 'phone', 'music', 'money',
  'light', 'night', 'world', 'house', 'small', 'large', 'sweet', 'sugar', 'bread', 'fruit',
  'house', 'plant', 'beach', 'river', 'ocean', 'cloud', 'storm', 'grass', 'stone', 'metal',
  'paper', 'pencil', 'school', 'friend', 'family', 'mother', 'father', 'sister', 'people', 'animal',
  'orange', 'banana', 'tomato', 'potato', 'pepper', 'garden', 'flower', 'forest', 'island', 'bridge',
  'doctor', 'nurse', 'driver', 'farmer', 'singer', 'player', 'market', 'street', 'church', 'office',
  'bottle', 'basket', 'pillow', 'mirror', 'window', 'kitchen', 'bedroom', 'morning', 'evening', 'holiday',
  'laugh', 'smile', 'dance', 'dream', 'sleep', 'drink', 'bread', 'plate', 'spoon', 'knife',
  'shirt', 'dress', 'shoes', 'socks', 'glove', 'scarf', 'jacket', 'pocket', 'button', 'zipper',
  'tiger', 'lion', 'zebra', 'horse', 'sheep', 'goat', 'mouse', 'snake', 'eagle', 'whale',
] as const;

// Tier 4 — common.
export const TIER_4 = [
  'travel', 'flight', 'ticket', 'camera', 'guitar', 'violin', 'castle', 'palace', 'cottage', 'village',
  'engine', 'wheel', 'rocket', 'planet', 'comet', 'galaxy', 'meteor', 'shadow', 'candle', 'lantern',
  'breeze', 'thunder', 'rainbow', 'sunset', 'sunrise', 'desert', 'jungle', 'meadow', 'valley', 'canyon',
  'pirate', 'sailor', 'knight', 'wizard', 'dragon', 'goblin', 'monster', 'puzzle', 'riddle', 'legend',
  'butter', 'cheese', 'yogurt', 'pepper', 'garlic', 'ginger', 'pickle', 'cookie', 'muffin', 'pancake',
  'leopard', 'panther', 'cheetah', 'dolphin', 'octopus', 'penguin', 'ostrich', 'peacock', 'sparrow', 'pigeon',
  'pillar', 'column', 'tunnel', 'ladder', 'fence', 'gate', 'porch', 'attic', 'closet', 'cellar',
  'orchard', 'harvest', 'meadow', 'pasture', 'stream', 'puddle', 'pebble', 'boulder', 'crystal', 'diamond',
  'compass', 'anchor', 'paddle', 'harbor', 'cargo', 'voyage', 'island', 'lagoon', 'reef', 'tide',
  'whisper', 'shout', 'giggle', 'sneeze', 'yawn', 'cough', 'sniff', 'wink', 'frown', 'grin',
] as const;

// Tier 3 — moderately common.
export const TIER_3 = [
  'amber', 'azure', 'crimson', 'scarlet', 'maroon', 'violet', 'indigo', 'turquoise', 'lavender', 'magenta',
  'gallop', 'wander', 'stumble', 'tiptoe', 'sprint', 'scurry', 'shuffle', 'stagger', 'saunter', 'trudge',
  'fragrant', 'savory', 'bitter', 'creamy', 'crispy', 'tender', 'juicy', 'spicy', 'salty', 'sour',
  'curious', 'gentle', 'clever', 'brave', 'humble', 'cheerful', 'grumpy', 'timid', 'eager', 'weary',
  'meadow', 'thicket', 'glade', 'grove', 'marsh', 'swamp', 'prairie', 'tundra', 'plateau', 'summit',
  'trumpet', 'clarinet', 'cello', 'flute', 'harp', 'banjo', 'fiddle', 'drum', 'cymbal', 'tambourine',
  'sapphire', 'emerald', 'ruby', 'pearl', 'opal', 'topaz', 'garnet', 'jade', 'quartz', 'amethyst',
  'cottage', 'mansion', 'cabin', 'lodge', 'shack', 'hut', 'igloo', 'tent', 'bungalow', 'chalet',
  'beetle', 'spider', 'cricket', 'firefly', 'ladybug', 'dragonfly', 'butterfly', 'caterpillar', 'grasshopper', 'mosquito',
  'lantern', 'torch', 'beacon', 'flicker', 'glimmer', 'sparkle', 'shimmer', 'radiance', 'twilight', 'dusk',
] as const;

// Tier 2 — still common but a little richer vocabulary.
export const TIER_2 = [
  'serene', 'tranquil', 'vibrant', 'radiant', 'luminous', 'graceful', 'elegant', 'majestic', 'splendid', 'dazzling',
  'ponder', 'marvel', 'cherish', 'embrace', 'venture', 'wander', 'explore', 'discover', 'imagine', 'create',
  'cascade', 'meadow', 'horizon', 'eclipse', 'aurora', 'mirage', 'oasis', 'summit', 'crevice', 'cavern',
  'mariner', 'voyager', 'nomad', 'wanderer', 'pioneer', 'explorer', 'merchant', 'craftsman', 'artisan', 'minstrel',
  'fragment', 'mosaic', 'tapestry', 'lattice', 'spiral', 'helix', 'vortex', 'prism', 'facet', 'contour',
  'whimsical', 'peculiar', 'mysterious', 'enchanted', 'fabled', 'mythical', 'ancient', 'timeless', 'eternal', 'fleeting',
] as const;

export const COMMON_WORD_TIERS: ReadonlyArray<{ rank: number; words: readonly string[] }> = [
  { rank: 5, words: TIER_5 },
  { rank: 4, words: TIER_4 },
  { rank: 3, words: TIER_3 },
  { rank: 2, words: TIER_2 },
];

// A curated subset gets hand-written, kid-friendly definitions (clearer than Webster's verbose ones)
// for Definition Race. The rest of game_definitions can be promoted from the dictionary.
export const SEED_DEFINITIONS: ReadonlyArray<{ word: string; definition: string; rank: number }> = [
  { word: 'apple', definition: 'A round fruit with red or green skin and crisp white flesh.', rank: 5 },
  { word: 'ocean', definition: 'A very large area of salt water covering much of the earth.', rank: 5 },
  { word: 'river', definition: 'A large natural stream of water flowing to the sea or a lake.', rank: 5 },
  { word: 'mountain', definition: 'A very tall, steep hill of rock rising high above the land.', rank: 5 },
  { word: 'doctor', definition: 'A person trained to treat people who are sick or injured.', rank: 5 },
  { word: 'teacher', definition: 'A person whose job is to help others learn at a school.', rank: 5 },
  { word: 'garden', definition: 'A piece of ground where flowers, fruit, or vegetables are grown.', rank: 5 },
  { word: 'rainbow', definition: 'A curved band of colours seen in the sky after rain.', rank: 4 },
  { word: 'thunder', definition: 'The loud rumbling sound that follows a flash of lightning.', rank: 4 },
  { word: 'castle', definition: 'A large strong building with thick walls, built long ago for defence.', rank: 4 },
  { word: 'dragon', definition: 'A large imaginary creature that can breathe fire.', rank: 4 },
  { word: 'compass', definition: 'A tool with a needle that always points north to show direction.', rank: 4 },
  { word: 'anchor', definition: 'A heavy metal object dropped to stop a boat from drifting.', rank: 4 },
  { word: 'lantern', definition: 'A portable light with a flame or bulb inside a clear case.', rank: 3 },
  { word: 'whisper', definition: 'To speak very softly so others can barely hear.', rank: 4 },
  { word: 'penguin', definition: 'A black-and-white sea bird that cannot fly but swims well.', rank: 4 },
  { word: 'dolphin', definition: 'A clever, friendly sea animal that breathes air and loves to leap.', rank: 4 },
  { word: 'volcano', definition: 'A mountain that can erupt, sending out hot melted rock.', rank: 3 },
  { word: 'desert', definition: 'A large dry area of land with little rain and few plants.', rank: 4 },
  { word: 'harvest', definition: 'The gathering of crops when they are ripe and ready.', rank: 3 },
  { word: 'eclipse', definition: 'When one object in space blocks the light of another.', rank: 2 },
  { word: 'mirage', definition: 'An illusion of water seen in a hot desert that is not really there.', rank: 2 },
  { word: 'oasis', definition: 'A green spot with water in the middle of a desert.', rank: 2 },
  { word: 'serene', definition: 'Calm, peaceful, and untroubled.', rank: 2 },
  { word: 'vibrant', definition: 'Full of energy, life, and bright colour.', rank: 2 },
];
