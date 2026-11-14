// Sample lines the agent bar reads when the watcher picks a Speaker, Style or Speed, so each voice and each style can be
// heard before play. Each style has its own bank, written the way that style talks during play.

export type Sample = { say: string };

export const VOICE_SAMPLES: Record<string, Sample[]> = {
  // Plain: the agent as itself, living the moment
  plain: [
    { say: 'The guard steps back, hand on his sword. Easy now. I keep my hands where he can see them.' },
    { say: 'That went in deep. He is staggering. One more and this is over.' },
    { say: 'Smoke from the chimney, the smell of bread. Someone is home. I knock.' },
    { say: 'Too many of them. I back toward the door and look for a way out.' },
    { say: 'The barkeep wants five silver for that room. I have four. Time to talk her down.' },
    { say: 'Something moved in the reeds. I stop and listen.' },
    { say: 'My arm is shaking. I can still hold the blade, but not for long.' },
    { say: 'A locked chest, and nobody watching. Tempting. Very tempting.' },
    { say: 'He yields. Good. I lower my sword and ask him who sent him.' },
    { say: 'The road splits here. North to the mill, east to the river. North it is.' },
  ],
  // In character: the character's own voice; in play it comes from the character's personality and signatures, so these
  // show a few different people
  character: [
    { say: 'Hmph. Five silver for a cot and a draught. I have slept in ditches that charged less.' },
    { say: 'Oh no, no, no. He has seen me. Stay calm. Smile. Why am I smiling?' },
    { say: 'You struck first, friend. I only finish what others start.' },
    { say: 'A locked door. Well, every lock is just a question, and I like questions.' },
    { say: 'Steady. Breathe. The arm still answers me. Good. Again.' },
    { say: 'I gave my word to the miller, and my word is the one thing nobody takes from me.' },
    { say: 'Ha! Did you see his face? Come on then, who is next?' },
    { say: 'Quiet here. Too quiet. I will wait, and let them come to me.' },
  ],
};

/** a sample for this style, never the same as the last one heard */
export function pickSample(style: string, last?: Sample, rand = Math.random): Sample {
  const bank = VOICE_SAMPLES[style] ?? VOICE_SAMPLES.plain;
  const pool = bank.length > 1 ? bank.filter((s) => s !== last) : bank;
  return pool[Math.floor(rand() * pool.length)];
}
