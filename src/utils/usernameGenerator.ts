export const SHORT_POSITIVE_ADJECTIVES = [
  'cozy', 'happy', 'bright', 'calm', 'swift', 'sunny', 'gentle', 'kind', 'warm', 'brave',
  'clever', 'joyful', 'eager', 'noble', 'snug', 'lively', 'mellow', 'spry', 'vital', 'zen',
  'cheerful', 'serene', 'chirpy', 'sweet', 'merry', 'jolly', 'peppy', 'dandy', 'glad', 'perky',
  'zippy', 'nifty', 'peachy', 'zesty', 'rosy', 'bouncy', 'breezy', 'fresh', 'giddy', 'smiley'
];

export const ANIMALS = [
  'raccoon', 'panda', 'otter', 'beaver', 'koala', 'fox', 'robin', 'badger', 'hedgehog', 'squirrel',
  'deer', 'penguin', 'sloth', 'owl', 'bear', 'seal', 'dolphin', 'rabbit', 'lynx', 'finch',
  'chipmunk', 'quokka', 'capybara', 'lemur', 'hare', 'wombat', 'puffin', 'marmot', 'meerkat',
  'weasel', 'skunk', 'possum', 'ferret', 'pika', 'wallaby', 'gibbon', 'wolf', 'moose', 'camel',
  'zebra', 'llama', 'alpaca', 'tiger', 'lion', 'hippo', 'rhino', 'falcon', 'toucan', 'hawk',
  'parrot', 'walrus', 'mole', 'swan'
];

/**
 * Generates a unique username checking against Supabase to ensure it doesn't already exist.
 */
export async function generateUniqueUsername(supabaseClient: any): Promise<string> {
  let isUnique = false;
  let finalUsername = '';
  
  while (!isUnique) {
    const adj = SHORT_POSITIVE_ADJECTIVES[Math.floor(Math.random() * SHORT_POSITIVE_ADJECTIVES.length)];
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const suffix = Math.floor(Math.random() * 899) + 100; // 3-digit incremental/random number
    finalUsername = `${adj}_${animal}${suffix}`;

    // Check if username already exists in database
    const { data, error } = await supabaseClient
      .from('users') // change to 'profiles' if your table name is profiles
      .select('username')
      .eq('username', finalUsername)
      .maybeSingle();

    if (!data) {
      isUnique = true; // Username is free!
    }
  }
  return finalUsername;
}
