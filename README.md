<div align="center">

# Sol Trivia

**Solana's competitive trivia game — play, earn, and win real SOL.**

[Play Now](https://soltrivia.app) | [X / Twitter](https://x.com/soltrivia_app)

Built on **Solana** | Powered by **Bags.fm**

</div>

---

## What is Sol Trivia?

Sol Trivia is a competitive trivia game built on Solana where players answer questions, climb leaderboards, and win real SOL prizes. Every round is on-chain, every payout is verifiable, and the game runs 24/7 with 4 rounds per day.

## Game Modes

### Compete (Ranked Rounds)
- Pay a 0.02 SOL entry fee to join a round
- Answer 10 timed trivia questions
- Score is based on accuracy + speed (up to 1,000 points per question)
- Top 5 players split the entire prize pool
- **4 rounds per day** — new round every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
- Up to 5 entries per round, 20 per day
- **2 lifetime free entries** per wallet — try it before you buy
- If fewer than 5 players finish, the round is refunded — no one loses

### Duels (1v1)
- Challenge another player to a head-to-head trivia battle
- Both players answer the same questions at the same time
- Winner takes the entire pot
- On-chain resolution — duel outcome is settled via the smart contract
- Loser gets nothing, winner gets it all

### Custom Games
- Create your own trivia game with fully customizable settings
- Choose categories, number of questions, time limits, and difficulty
- **Creator-funded mode** — the game creator funds the entire prize pool for their players (great for communities, DAOs, and promotions)
- **Player-funded mode** — players pay an entry fee and the pot grows as more people join
- Share via invite link — open to anyone or keep it private
- Full leaderboard and stats tracking per custom game
- Perfect for Twitter spaces, Discord events, or community competitions

### Practice Mode
- Free to play — no entry fee
- Practice your trivia skills with unlimited attempts
- No leaderboard or prizes, just learning

## $NERD Token

**$NERD** is the utility token for Sol Trivia, launched on [Bags.fm](https://bags.fm).

- **10% discount** on extra lives when paying with $NERD
- **10% discount** on Game Pass when paying with $NERD
- CA: `DEc6Gf57RfFJbjqGrzo4zeRBr5iQS8vTV8r11ZuyBAGS`

### In-App Token Swaps (Bags.fm Integration)

Sol Trivia integrates the **Bags.fm API** for seamless in-app token swaps:

- Swap **SOL to $NERD** and **$NERD to SOL** without leaving the app
- Powered by Bags.fm's **Dynamic Bonding Curve** for best pricing
- Auto slippage protection — no manual slippage settings needed
- Real-time quotes with price impact display
- Direct wallet signing — non-custodial, no middlemen
- Works on desktop, mobile browser, PWA, and Solana Seeker

## Game Pass & Lives

### Extra Lives
Run out of free entries? Purchase extra lives to keep playing:
- 3 lives — 0.03 SOL
- 15 lives — 0.10 SOL
- 35 lives — 0.25 SOL

### Seeker Holders (Solana Mobile)
Solana Seeker (SGT) holders get exclusive perks:
- Discounted lives (up to 33% off)
- +25% XP boost
- Seeker badge on leaderboard
- Auto .skr domain as username

## Features

- **On-chain verification** — all entries and payouts recorded on Solana
- **Speed bonus scoring** — faster answers earn more points
- **Daily streaks** — play every day to build your streak
- **Leaderboards** — global and per-round rankings
- **Quests** — complete challenges to earn rewards
- **Referral system** — invite friends and earn rewards
- **PWA support** — install on any device for an app-like experience
- **Seeker / MWA support** — native Solana mobile wallet integration
- **Multi-language** — English, Spanish, Portuguese, Japanese, Korean, Chinese, Turkish

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite 6 + Tailwind CSS
- **Backend:** Supabase (Edge Functions + Postgres)
- **Blockchain:** Solana (custom smart contract)
- **Hosting:** Render
- **Swaps:** Bags.fm API
- **RPC:** Helius + Alchemy

## How Rounds Work

1. **Entry** — Player pays 0.02 SOL entry fee (sent to on-chain vault PDA) + 0.0025 SOL platform fee
2. **Play** — Answer 10 timed trivia questions. Score = accuracy + speed (100 base + up to 900 speed bonus per question)
3. **Ranking** — Once 5+ players finish a round, rankings are calculated automatically
4. **Payouts** — Top 5 split 100% of the prize pool. Winners are posted on-chain and can claim their SOL directly
5. **Refunds** — If fewer than 5 players finish a round, the round is marked for refund and players can reclaim their entry fee on-chain

### Prize Distribution
| Place | Share |
|-------|-------|
| 1st | 50% |
| 2nd | 20% |
| 3rd | 15% |
| 4th | 10% |
| 5th | 5% |

> 100% of the prize pool goes to players. The platform fee (0.0025 SOL) is collected separately at entry, not from the pot.

## Smart Contract

Sol Trivia runs on a custom Solana program built with Anchor:
- **Program ID:** `A3CSWY7bJukyKgR8RXXq1jbRAvqTY5jYtArF5Xt9dhjE`
- **Entry** — SOL is held in a program-derived vault (PDA), not a wallet
- **Payouts** — Winners are posted on-chain and claim directly from the vault
- **Refunds** — Built-in refund instruction for rounds with insufficient players
- Fully auditable and verifiable on-chain via any Solana explorer

## Links

- **Play:** [soltrivia.app](https://soltrivia.app)
- **X:** [@soltrivia_app](https://x.com/soltrivia_app)
- **$NERD on Bags.fm:** [bags.fm/trade/DEc6Gf57RfFJbjqGrzo4zeRBr5iQS8vTV8r11ZuyBAGS](https://bags.fm/trade/DEc6Gf57RfFJbjqGrzo4zeRBr5iQS8vTV8r11ZuyBAGS)

---

<div align="center">

**Built on Solana. Powered by Bags.fm.**

</div>
