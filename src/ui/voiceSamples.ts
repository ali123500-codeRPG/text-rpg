// Sample lines the agent bar reads when the watcher picks a Speaker, Style or Speed, so each voice and each style can be
// heard before play. Each style has its own bank, written the way that style talks during play.

export type Sample = { say: string; ja?: string };

export const VOICE_SAMPLES: Record<string, Sample[]> = {
  // Plain: the agent as itself, living the moment, with no companion manner and no Japanese
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
  // AI companion: warm, lively, reacting beside the watcher; a Japanese word slips out now and then
  companion: [
    { say: 'Whoa, did you see that? He actually flinched! Okay, okay, my turn now!' },
    { say: 'Itai! That one stung. I am fine, I promise. Mostly fine.' },
    { say: 'Ooh, a market! Can we look? Just for a minute. I want to see everything.' },
    { say: 'Wait, wait, chotto matte. Something is off about that guard. Let me watch him first.' },
    { say: 'We did it! Yokatta. My hands are still shaking, but we did it!' },
    { say: 'Hmm, that innkeeper is smiling a little too much. I do not trust her. Do you?' },
    { say: 'Sasuga! Right in the arm. Let us keep going before he catches his breath.' },
    { say: 'Kowai… it is so dark down here. Stay close, okay?' },
    { say: 'Mou! He took my coin and ran. Hayaku, after him!' },
    { say: 'A real sword, in my hands! Ehehe, I feel like the hero of a story.' },
  ],
  // Speaks Japanese: the line is spoken in Japanese and shown in English under it
  japanese: [
    { ja: 'うそ！避けられた！もう一回いくよ！', say: 'No way, he dodged it! Here I go again!' },
    { ja: 'いたっ！大丈夫、まだ戦えるから。', say: 'Ow! I am okay, I can still fight.' },
    { ja: 'ちょっと待って。あの人、何か隠してる気がする。', say: 'Wait a moment. I feel like that person is hiding something.' },
    { ja: 'やった！勝ったよ！本当に勝ったんだ！', say: 'Yes! We won! We really won!' },
    { ja: 'ここ、暗くて怖いね。そばにいてね。', say: 'It is dark and scary here. Stay by my side.' },
    { ja: 'わあ、市場だ！ちょっとだけ見ていこうよ。', say: 'Wow, a market! Let us look around, just for a bit.' },
    { ja: 'さすが！腕に命中したよ。このまま押し切ろう！', say: 'Nice! Right in the arm. Let us push through!' },
    { ja: 'しまった、囲まれた…出口を探さなきゃ。', say: 'Oh no, we are surrounded. I need to find a way out.' },
    { ja: '五シルバー？高すぎるよ。もう少し安くならない？', say: 'Five silver? That is too much. Can you go a little lower?' },
    { ja: 'もう！財布を盗まれた！早く追いかけて！', say: 'Ugh! He stole my purse! Quick, after him!' },
  ],
};

/** a sample for this style, never the same as the last one heard */
export function pickSample(style: string, last?: Sample, rand = Math.random): Sample {
  const bank = VOICE_SAMPLES[style] ?? VOICE_SAMPLES.companion;
  const pool = bank.length > 1 ? bank.filter((s) => s !== last) : bank;
  return pool[Math.floor(rand() * pool.length)];
}
