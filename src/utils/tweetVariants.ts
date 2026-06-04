/**
 * Tweet variant rotation module.
 *
 * Every share-on-X button across Sol Trivia pulls its tweet copy from a
 * randomized variant bank keyed by share-moment type. On tap,
 * `pickTweet(moment, vars)` picks one at random and interpolates {placeholders}.
 *
 * Voice rules ([[feedback-voice-edge-keep-spice]] + [[feedback-no-em-dashes]]):
 *  - lowercase (founder voice intentional)
 *  - NO em dashes anywhere
 *  - keep edge / Ansem-irreverent
 *  - @SolTrivia_app handle in every tweet
 *  - soltrivia.app (or specific deep link) at the end
 *  - memetic phrases preserved: WAGMI, NGMI, REKT, gm, ser, kek, cooked, etc.
 *
 * Native port: this module is pure JS, copy-paste safe. SolTriviaNative
 * gets the same banks. No platform-specific code.
 */

export type ShareMoment =
  | 'daily_round_wagmi'
  | 'daily_round_almost'
  | 'daily_round_ngmi'
  | 'daily_round_rekt'
  | 'daily_round_claim'
  | 'duel_lobby_invite'
  | 'duel_win'
  | 'duel_loss'
  | 'duel_claim'
  | 'custom_game_lobby'
  | 'custom_game_played'
  | 'custom_game_won'
  | 'custom_game_claim'
  | 'referral_invite';

type TemplateVars = Record<string, string | number | undefined>;

// Variant banks. 4-6 per moment. {placeholders} get interpolated.
//
// Duel-specific placeholders:
//   {wager}      e.g. "0.05 SOL" or "100 NERD" — caller pre-formats
//   {opponent}   e.g. "@jupwhale" or "0xab..cd" — caller pre-formats
//   {prize}      e.g. "0.1 SOL" or "200 NERD" — caller pre-formats
//   {score}      raw points (4-digit)
//   {correct}    e.g. "4/5"
//   {url}        shareable URL (duel lobby link or soltrivia.app)
//
// New banks: drop them in here, no component change needed.

const BANKS: Record<ShareMoment, string[]> = {
  // ── DUELS ────────────────────────────────────────────

  duel_lobby_invite: [
    "1v1 me on @SolTrivia_app for {wager}.\ntrivia. on-chain. winner takes all.\nyou're ngmi if you dodge this.\n\n{url}",
    "open duel up on @SolTrivia_app. {wager} on the line.\nwho's smart enough to humble me?\n\n{url}",
    "ser, fancy a {wager} 1v1 on @SolTrivia_app?\nfive questions, one winner, full pot.\n\n{url}",
    "no notes. just trivia.\n{wager} duel up on @SolTrivia_app.\ngrab the bag or get clipped.\n\n{url}",
    "anyone want smoke? {wager} duel on @SolTrivia_app.\nif you actually know things, prove it.\n\n{url}",
  ],

  duel_win: [
    "just mogged someone in a {wager} 1v1 on @SolTrivia_app.\ncollected {prize}. trivia degen szn.\nwho wants smoke next?\n\nsoltrivia.app",
    "took {prize} off some ngmi on @SolTrivia_app.\nfive questions. four correct. one pot.\nstill learning ser.\n\nsoltrivia.app",
    "another one in the W column on @SolTrivia_app.\n{score} points. {correct} correct. {prize} mine.\nkeep them coming.\n\nsoltrivia.app",
    "trivia clip on @SolTrivia_app. {prize} extracted.\nopponent thought they had it. they did not.\nwagmi.\n\nsoltrivia.app",
    "just won {prize} answering five questions on @SolTrivia_app.\neasiest pay of the day.\nrematch? you know where to find me.\n\nsoltrivia.app",
    "{prize} richer thanks to @SolTrivia_app duels.\nactually learn the product. or stay rekt.\n\nsoltrivia.app",
  ],

  duel_loss: [
    "got rekt in a @SolTrivia_app duel.\nnot gonna lie that stings.\nneed a rematch immediately. who's in?\n\nsoltrivia.app",
    "cooked on @SolTrivia_app for {wager}.\noff day. it happens. coming back stronger.\n\nsoltrivia.app",
    "lost a {wager} duel on @SolTrivia_app.\nlmao i thought i knew this stuff. apparently not.\nrematch me.\n\nsoltrivia.app",
    "well that was humbling.\ndown {wager} on @SolTrivia_app to someone who actually studies.\nback to the books ser.\n\nsoltrivia.app",
    "ngmi update: just lost a duel on @SolTrivia_app.\ngonna learn from this and keep grinding.\nwho wants the next one?\n\nsoltrivia.app",
    "took an L on @SolTrivia_app. five questions of pain.\nopponent printed. respect.\nmy turn next.\n\nsoltrivia.app",
  ],

  duel_claim: [
    "just claimed {prize} from a duel win on @SolTrivia_app.\non-chain payouts hit different.\nwho's next?\n\nsoltrivia.app",
    "{prize} just landed in my wallet from @SolTrivia_app.\nplay trivia. earn sol. simple.\n\nsoltrivia.app",
    "duel pot claimed. {prize} secured.\n@SolTrivia_app makes you feel something.\n\nsoltrivia.app",
    "bag claimed: {prize} from beating someone at trivia.\nonly on @SolTrivia_app.\n\nsoltrivia.app",
    "pot's in the wallet. {prize}.\ndegen game theory: be smarter than the other guy.\n@SolTrivia_app.\n\nsoltrivia.app",
  ],

  // ── ROUNDS ──────────────────────────────────────────

  daily_round_wagmi: [
    "just placed #{rank} in the @SolTrivia_app daily round.\n{correct}/10 in {time}. unreal.\nothers are still reading whitepapers. i'm getting paid.\n\nsoltrivia.app",
    "top {rank} in today's @SolTrivia_app round. wagmi.\n{correct}/10. learning real things, banking real sol.\n\nsoltrivia.app",
    "{rank} on @SolTrivia_app today. on-chain payout incoming.\ntrivia is the alpha you weren't ready for.\n\nsoltrivia.app",
    "podium hit on @SolTrivia_app. {correct}/10 questions slammed.\nplay daily. learn daily. earn daily.\n\nsoltrivia.app",
  ],

  daily_round_almost: [
    "OOF. {rank} in today's @SolTrivia_app round. just outside the bag.\n{correct}/10. back tomorrow.\n\nsoltrivia.app",
    "NEAR W on @SolTrivia_app. {rank} place.\none more question and i was eating tonight.\n\nsoltrivia.app",
    "THIS CLOSE to printing on @SolTrivia_app.\n{rank} finish. {correct}/10. gotta study harder ser.\n\nsoltrivia.app",
    "ALMOST WAGMI on @SolTrivia_app.\n{rank}. so close. rematch tomorrow.\n\nsoltrivia.app",
  ],

  daily_round_ngmi: [
    "mid finish on @SolTrivia_app today. {correct}/10.\nat least i learned something. that counts.\n\nsoltrivia.app",
    "average round on @SolTrivia_app. {rank}.\nnot a w not an L. just trivia.\n\nsoltrivia.app",
    "logged in, did the round, got humbled.\n{correct}/10 on @SolTrivia_app.\nbetter tomorrow.\n\nsoltrivia.app",
    "ngmi take: i thought i knew solana lore.\n@SolTrivia_app says otherwise. {correct}/10.\n\nsoltrivia.app",
  ],

  daily_round_rekt: [
    "got fully REKT in today's @SolTrivia_app round.\n{correct}/10 is a war crime.\nback tomorrow because i'm built different.\n\nsoltrivia.app",
    "cooked. {correct}/10 in the @SolTrivia_app round.\nstudy ser. genuinely.\n\nsoltrivia.app",
    "L taken with grace. {correct}/10.\n@SolTrivia_app keeps me humble.\n\nsoltrivia.app",
    "bottom tier finish on @SolTrivia_app today.\nguess i'll touch grass and try again.\n\nsoltrivia.app",
  ],

  daily_round_claim: [
    "just claimed {prize} from yesterday's @SolTrivia_app round.\non-chain. instant. easy.\n\nsoltrivia.app",
    "{prize} in the bag from a top finish on @SolTrivia_app.\ncan't believe i'm paid to know things.\n\nsoltrivia.app",
    "round payout claimed. {prize} for being slightly less rekt than the rest.\n@SolTrivia_app printing.\n\nsoltrivia.app",
    "trivia bag secured: {prize}.\ndaily round on @SolTrivia_app does it again.\n\nsoltrivia.app",
  ],

  // ── CUSTOM GAMES ────────────────────────────────────

  custom_game_lobby: [
    "i made a trivia game on @SolTrivia_app. winner gets the bag.\ncome get clipped.\n\n{url}",
    "custom trivia room up on @SolTrivia_app.\ntopic is {topic}. think you know it? prove it.\n\n{url}",
    "open trivia game on @SolTrivia_app. {wager} entry.\nbring friends or come solo. winner takes all.\n\n{url}",
    "ser, i built a quiz on @SolTrivia_app.\nare you smart enough to claim the pot?\n\n{url}",
  ],

  custom_game_won: [
    "topped the @SolTrivia_app {topic} leaderboard.\nrank #1. {correct} questions deep.\nwho's coming for me?\n\n{url}",
    "ranked #1 in {topic} trivia on @SolTrivia_app.\nturns out i actually know things.\nbeat that.\n\n{url}",
    "first place on {topic} custom trivia, @SolTrivia_app.\n{score} XP. ngmi if you can't catch up.\n\n{url}",
    "top of the leaderboard on @SolTrivia_app for {topic}.\nname a more powerful flex. you can't.\n\n{url}",
    "i'm currently #1 on a @SolTrivia_app custom game.\n{topic} ftw. catch me if you can.\n\n{url}",
    "absolutely cooking on @SolTrivia_app right now.\n#1 in {topic}. {score} XP and counting.\n\n{url}",
  ],

  custom_game_played: [
    "just played {topic} trivia on @SolTrivia_app.\n{correct}/10 on weird community knowledge.\nplay yours: {url}",
    "took a swing at {topic} trivia on @SolTrivia_app.\nscored {score}. niche knowledge actually pays.\n\nsoltrivia.app",
    "knocked out a {topic} custom game on @SolTrivia_app.\nfun fact: i did NOT know this much about {topic}.\n\nsoltrivia.app",
    "custom trivia ✓ {topic} round complete on @SolTrivia_app.\nfeeling smarter and slightly poorer.\n\nsoltrivia.app",
  ],

  custom_game_claim: [
    "just claimed {prize} from a {topic} custom game on @SolTrivia_app.\ncommunity trivia pays. who knew.\n\nsoltrivia.app",
    "{prize} won on @SolTrivia_app from a custom trivia game.\nniche topics, real payouts.\n\nsoltrivia.app",
    "bag claimed from a {topic} round on @SolTrivia_app: {prize}.\nplay community-made trivia for sol.\n\nsoltrivia.app",
  ],

  // ── REFERRALS ───────────────────────────────────────

  referral_invite: [
    "use my @SolTrivia_app referral and we both eat.\ntrivia. on-chain. real sol.\n\n{url}",
    "sign up to @SolTrivia_app with my code. you get a bonus, i get a bonus, we're both wagmi.\n\n{url}",
    "play on-chain trivia with me on @SolTrivia_app.\nuse my link, we both get a kick.\n\n{url}",
    "trivia degen szn is here. join @SolTrivia_app with my referral, get paid to learn.\n\n{url}",
  ],
};

/**
 * Pick a tweet from the variant bank for this share moment and interpolate
 * the {placeholder} values from `vars`. Missing keys interpolate as empty
 * strings (so a placeholder without a matching var disappears silently
 * rather than emitting `{name}` to X).
 */
export function pickTweet(moment: ShareMoment, vars: TemplateVars = {}): string {
  const bank = BANKS[moment];
  if (!bank || bank.length === 0) {
    return `play on-chain trivia on @SolTrivia_app.\n\nsoltrivia.app`;
  }
  const template = bank[Math.floor(Math.random() * bank.length)];
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null ? '' : String(v);
  });
}

/**
 * Helper: encode a tweet for the X intent URL.
 * Use when Web Share API isn't available and we fall back to the X intent URL.
 */
export function xIntentUrl(text: string): string {
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
