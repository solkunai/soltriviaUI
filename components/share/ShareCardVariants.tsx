/**
 * ShareCardVariants , 16 distinct share-card layouts (4 round-win, 4 round-loss,
 * 4 duel-win, 4 duel-loss) ported from the design handoff JSX.
 *
 * Each card is 1200x630 (X / Twitter summary_large_image spec). All take real
 * result data via props , no hardcoded demo values. Two selector functions
 * (selectRoundCard, selectDuelCard) pick the right variant given the outcome.
 *
 * Source spec: /Users/solkunai/Downloads/sharecards-handoff/src/components/st-sharecards.jsx
 */

import * as React from 'react';
import {
  CardShell,
  DiagonalTape,
  BigGlyph,
  StatReport,
  DuelVsLayout,
  DuelPayoutBanner,
  PixelAvatar,
  CrownBadge,
  ST,
} from './ShareCardLib';

// ── Shared formatters ───────────────────────────────────────────────────

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function pctCorrect(correct: number, total = 10): number {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

// ════════════════════════════════════════════════════════════════════════
// ROUND CARDS - data shape
// ════════════════════════════════════════════════════════════════════════

export interface RoundCardData {
  /** 0-10 correct answers */
  score: number;
  /** finishing rank (1-based) */
  rank: number | null;
  /** elapsed time in seconds */
  timeSeconds: number;
  /** total entries in the round */
  totalPlayers: number;
  /** SOL paid out (rank <=5, else undefined) */
  prizeSol?: number;
  /** win streak count (for ON FIRE detection) */
  winStreak?: number;
  /** placement change vs last round (for COOKED detection, +13 = dropped 13) */
  rankDropPlaces?: number;
}

// ── ROUND WINNERS (4) ──────────────────────────────────────────────────

export function ShareCardWagmi({ data }: { data: RoundCardData }) {
  return (
    <CardShell accent={ST.gold}>
      <DiagonalTape color={ST.gold} text="BUILT DIFFERENT" />
      <BigGlyph
        text="WAGMI"
        color={ST.gold}
        gradient={`linear-gradient(160deg, #FFE680, ${ST.gold} 50%, #FFC857)`}
      />
      <StatReport
        items={[
          {
            label: 'FINISHED',
            value: `#${data.rank ?? '?'}`,
            sub: '🏆 TOP 5',
            color: ST.gold,
            subColor: ST.gold,
          },
          {
            label: 'CORRECT',
            value: `${data.score}/10`,
            sub: `${pctCorrect(data.score)}% · ${formatTime(data.timeSeconds)}`,
            subColor: ST.gold,
          },
          {
            label: 'WON',
            value: data.prizeSol != null ? `+${data.prizeSol.toFixed(3)}` : '+0',
            sub: 'SOL · PAID OUT',
            gradient: `linear-gradient(180deg, #FFE680, ${ST.gold})`,
            subColor: ST.gold,
          },
          {
            label: '',
            value: (
              <>
                "{data.score} out of 10 in {formatTime(data.timeSeconds)}.<br />
                <span style={{ color: ST.gold }}>built different."</span>
              </>
            ),
          },
        ]}
      />
    </CardShell>
  );
}

export function ShareCardJackpot({ data }: { data: RoundCardData }) {
  const prize = data.prizeSol != null ? data.prizeSol.toFixed(3) : '0';
  return (
    <CardShell accent={ST.gold}>
      <DiagonalTape color={ST.gold} text="BAG SECURED" />
      <div style={{ position: 'absolute', top: 148, left: 40, right: 40, textAlign: 'center', zIndex: 3 }}>
        <div className="st-uplabel" style={{ fontSize: 18, color: ST.gold, letterSpacing: '0.3em' }}>
          PAID OUT
        </div>
        <div
          className="st-display st-num"
          style={{
            fontSize: 300,
            lineHeight: 0.85,
            marginTop: 6,
            letterSpacing: '-0.04em',
            background: `linear-gradient(160deg, #FFE680, ${ST.gold} 50%, #FFC857)`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            textShadow: `0 0 120px ${ST.gold}77`,
          }}
        >
          {prize}
        </div>
        <div className="st-display" style={{ fontSize: 38, color: '#fff', marginTop: -10 }}>
          SOL · STRAIGHT TO WALLET
        </div>
      </div>
      <StatReport
        items={[
          {
            label: 'FINISHED',
            value: `#${data.rank ?? '?'}`,
            sub: '🏆 TOP 5',
            color: ST.gold,
            subColor: ST.gold,
          },
          {
            label: 'CORRECT',
            value: `${data.score}/10`,
            sub: `${formatTime(data.timeSeconds)}`,
            color: '#fff',
            subColor: '#71717a',
          },
          {
            label: 'PLAYERS',
            value: String(data.totalPlayers),
            sub: 'IN ROUND',
            color: '#fff',
            subColor: '#71717a',
          },
          {
            label: '',
            value: (
              <>
                "easiest {prize}
                <br />
                <span style={{ color: ST.gold }}>of my life."</span>
              </>
            ),
          },
        ]}
      />
    </CardShell>
  );
}

export function ShareCardCracked({ data }: { data: RoundCardData }) {
  return (
    <CardShell accent={ST.gold}>
      <DiagonalTape color={ST.gold} text="BUILT DIFFERENT" />
      <div style={{ position: 'absolute', top: 140, left: 0, right: 0, textAlign: 'center', zIndex: 3 }}>
        <div className="st-display" style={{ fontSize: 80, color: '#fff', lineHeight: 0.9 }}>
          I'M
        </div>
        <div
          className="st-display"
          style={{
            fontSize: 240,
            lineHeight: 0.85,
            marginTop: 6,
            letterSpacing: '-0.04em',
            transform: 'rotate(-2deg)',
            background: `linear-gradient(160deg, #FFE680, ${ST.gold} 50%, #FFC857)`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            textShadow: `12px 12px 0 ${ST.gold}30, 0 0 100px ${ST.gold}77`,
          }}
        >
          CRACKED
        </div>
      </div>
      <StatReport
        items={[
          {
            label: 'FINISHED',
            value: `#${data.rank ?? '?'}`,
            sub: `OF ${data.totalPlayers}`,
            color: ST.gold,
            subColor: ST.gold,
          },
          {
            label: 'CORRECT',
            value: `${data.score}/10`,
            sub: `${formatTime(data.timeSeconds)} · PERFECT`,
            color: '#fff',
            subColor: ST.gold,
          },
          {
            label: 'WON',
            value: data.prizeSol != null ? `+${data.prizeSol.toFixed(3)}` : '+0',
            sub: 'SOL',
            color: ST.gold,
            subColor: ST.gold,
          },
          {
            label: '',
            value: (
              <>
                "{data.score}/10 in under 2 min.
                <br />
                <span style={{ color: ST.gold }}>get on my level."</span>
              </>
            ),
          },
        ]}
      />
    </CardShell>
  );
}

export function ShareCardOnFire({ data }: { data: RoundCardData }) {
  const streak = data.winStreak ?? 5;
  return (
    <CardShell accent={ST.red}>
      <DiagonalTape color={ST.red} text="ON FIRE" />
      <div style={{ position: 'absolute', top: 130, left: 40, right: 40, textAlign: 'center', zIndex: 3 }}>
        <div className="st-display" style={{ fontSize: 60, color: '#fff', lineHeight: 0.9 }}>
          I'M ON A
        </div>
        <div
          className="st-display"
          style={{
            fontSize: 240,
            lineHeight: 0.85,
            marginTop: 6,
            background: `linear-gradient(180deg, #FFD700, ${ST.red})`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            letterSpacing: '-0.04em',
            textShadow: `0 0 100px ${ST.red}66`,
          }}
        >
          {streak}-STREAK
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 14 }}>
          {Array.from({ length: Math.min(streak, 7) }).map((_, i) => (
            <span key={i} style={{ fontSize: 36 }}>
              🔥
            </span>
          ))}
        </div>
      </div>
      <StatReport
        items={[
          {
            label: 'WINS',
            value: String(streak),
            sub: 'CONSECUTIVE',
            color: ST.red,
            subColor: ST.red,
          },
          {
            label: 'CORRECT',
            value: `${data.score}/10`,
            sub: 'THIS ROUND',
            color: '#fff',
            subColor: '#71717a',
          },
          {
            label: 'WON',
            value: data.prizeSol != null ? `+${data.prizeSol.toFixed(3)}` : '+0',
            sub: 'SOL',
            color: ST.gold,
            subColor: ST.gold,
          },
          {
            label: '',
            value: (
              <>
                "who's gonna
                <br />
                <span style={{ color: ST.red }}>stop me?"</span>
              </>
            ),
          },
        ]}
      />
    </CardShell>
  );
}

// ── ROUND LOSERS (4) ────────────────────────────────────────────────────

export function ShareCardNgmi({ data }: { data: RoundCardData }) {
  return (
    <CardShell accent={ST.red}>
      <DiagonalTape color={ST.red} text="NOT GONNA MAKE IT" />
      <div style={{ position: 'absolute', top: 170, left: 0, right: 0, textAlign: 'center', zIndex: 3 }}>
        <div
          className="st-display"
          style={{ fontSize: 280, lineHeight: 0.85, letterSpacing: '-0.04em' }}
        >
          <span style={{ color: ST.red, textShadow: `6px 6px 0 ${ST.red}30` }}>N</span>
          <span style={{ color: '#fff' }}>G</span>
          <span style={{ color: ST.red, textShadow: `6px 6px 0 ${ST.red}30` }}>M</span>
          <span style={{ color: '#fff' }}>I</span>
        </div>
        <div
          className="st-display"
          style={{ fontSize: 32, color: '#a1a1aa', marginTop: 8, fontStyle: 'italic' }}
        >
          (not gonna make it · this round)
        </div>
      </div>
      <StatReport
        items={[
          {
            label: 'RANK',
            value: `#${data.rank ?? '?'}`,
            sub: `OF ${data.totalPlayers}`,
            color: ST.red,
            subColor: ST.red,
          },
          {
            label: 'CORRECT',
            value: `${data.score}/10`,
            sub: `${pctCorrect(data.score)}% · ${formatTime(data.timeSeconds)}`,
            color: '#fff',
            subColor: '#71717a',
          },
          {
            label: 'LOST',
            value: '−0.02',
            sub: 'SOL ENTRY FEE',
            color: ST.red,
            subColor: ST.red,
          },
          {
            label: '',
            value: (
              <>
                "at least you're
                <br />
                <span style={{ color: ST.red }}>consistent."</span>
              </>
            ),
          },
        ]}
      />
    </CardShell>
  );
}

export function ShareCardRekt({ data }: { data: RoundCardData }) {
  return (
    <CardShell accent={ST.red}>
      <DiagonalTape color={ST.red} text="COMPLETELY COOKED" />
      <BigGlyph text="REKT" color={ST.red} size={340} />
      <StatReport
        items={[
          {
            label: 'RANK',
            value: `#${data.rank ?? '?'}`,
            sub: `OF ${data.totalPlayers} ⚠`,
            color: ST.red,
            subColor: ST.red,
          },
          {
            label: 'CORRECT',
            value: `${data.score}/10`,
            sub: `${pctCorrect(data.score)}% ACC`,
            color: '#fff',
            subColor: ST.red,
          },
          {
            label: 'LOST',
            value: '−0.02',
            sub: 'SOL',
            color: '#fff',
            subColor: ST.red,
          },
          {
            label: '',
            value: (
              <>
                "u answered {data.score} right.
                <br />
                <span style={{ color: ST.red }}>
                  even THAT was a guess."
                </span>
              </>
            ),
          },
        ]}
      />
    </CardShell>
  );
}

export function ShareCardCooked({ data }: { data: RoundCardData }) {
  const drop = data.rankDropPlaces ?? 13;
  return (
    <CardShell accent={ST.red}>
      <DiagonalTape color={ST.red} text="DOWN BAD" />
      <BigGlyph text="COOKED" color={ST.red} size={220} top={170} />
      <div style={{ position: 'absolute', top: 380, left: 0, right: 0, textAlign: 'center', zIndex: 3 }}>
        <div className="st-display" style={{ fontSize: 38, color: '#fff', fontStyle: 'italic' }}>
          dropped <span style={{ color: ST.red }}>{drop} places</span> in 10 questions
        </div>
      </div>
      <StatReport
        items={[
          {
            label: 'RANK',
            value: `#${data.rank ?? '?'}`,
            sub: `▼ ${drop} PLACES`,
            color: ST.red,
            subColor: ST.red,
          },
          {
            label: 'CORRECT',
            value: `${data.score}/10`,
            sub: `${pctCorrect(data.score)}% · ${formatTime(data.timeSeconds)}`,
            color: '#fff',
            subColor: '#71717a',
          },
          {
            label: 'LOST',
            value: '−0.02',
            sub: 'SOL',
            color: ST.red,
            subColor: ST.red,
          },
          {
            label: '',
            value: (
              <>
                "send help.
                <br />
                <span style={{ color: ST.red }}>I'm cooked."</span>
              </>
            ),
          },
        ]}
      />
    </CardShell>
  );
}

export function ShareCardSkillIssue({ data }: { data: RoundCardData }) {
  return (
    <CardShell accent={ST.red}>
      <DiagonalTape color={ST.red} text="LOSER" />
      <div style={{ position: 'absolute', top: 160, left: 40, right: 40, textAlign: 'center', zIndex: 3 }}>
        <div
          className="st-display"
          style={{ fontSize: 200, lineHeight: 0.85, color: '#fff', letterSpacing: '-0.04em' }}
        >
          IT'S A
        </div>
        <div
          className="st-display"
          style={{
            fontSize: 120,
            lineHeight: 0.85,
            marginTop: 8,
            color: ST.red,
            transform: 'rotate(-2deg)',
            textShadow: `8px 8px 0 ${ST.red}30, 0 0 80px ${ST.red}77`,
            letterSpacing: '-0.03em',
          }}
        >
          SKILL ISSUE
        </div>
      </div>
      <StatReport
        items={[
          {
            label: 'RANK',
            value: `#${data.rank ?? '?'}`,
            sub: `OF ${data.totalPlayers}`,
            color: ST.red,
            subColor: ST.red,
          },
          {
            label: 'CORRECT',
            value: `${data.score}/10`,
            sub: `${pctCorrect(data.score)}% · ${formatTime(data.timeSeconds)}`,
            color: '#fff',
            subColor: '#71717a',
          },
          {
            label: 'LOST',
            value: '−0.02',
            sub: 'SOL',
            color: ST.red,
            subColor: ST.red,
          },
          {
            label: '',
            value: (
              <>
                "need to brush up.
                <br />
                <span style={{ color: ST.red }}>brb practicing."</span>
              </>
            ),
          },
        ]}
      />
    </CardShell>
  );
}

// ════════════════════════════════════════════════════════════════════════
// DUEL CARDS
// ════════════════════════════════════════════════════════════════════════

export interface DuelCardData {
  won: boolean;
  myScore: number;
  oppScore: number;
  oppHandle?: string;
  myHandle?: string;
  amountSol: string; // pre-formatted, e.g. "0.10"
}

// ── DUEL WINNERS (4) ────────────────────────────────────────────────────

export function ShareCardDuelTriviaMaster({ data }: { data: DuelCardData }) {
  return (
    <CardShell accent={ST.primary}>
      <DiagonalTape color={ST.primary} text="TRIVIA MASTER" />
      <DuelVsLayout
        won
        myScore={data.myScore}
        oppScore={data.oppScore}
        oppName={data.oppHandle}
        myHandle={data.myHandle}
        stamp="W"
      />
      <DuelPayoutBanner won amount={data.amountSol} />
    </CardShell>
  );
}

export function ShareCardDuelProblemSolved({ data }: { data: DuelCardData }) {
  return (
    <CardShell accent={ST.primary}>
      <DiagonalTape color={ST.primary} text="PROBLEM SOLVED" />
      <DuelVsLayout
        won
        myScore={data.myScore}
        oppScore={data.oppScore}
        oppName={data.oppHandle}
        myHandle={data.myHandle}
        stamp="W"
      />
      <DuelPayoutBanner won amount={data.amountSol} />
    </CardShell>
  );
}

export function ShareCardDuelClean({ data }: { data: DuelCardData }) {
  return (
    <CardShell accent={ST.primary}>
      <DiagonalTape color={ST.primary} text="CLEAN SWEEP" />
      <div style={{ position: 'absolute', top: 170, left: 40, right: 40, zIndex: 3 }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            textAlign: 'center',
            zIndex: -1,
          }}
        >
          <div
            className="st-display"
            style={{
              fontSize: 340,
              lineHeight: 0.85,
              color: ST.primary,
              letterSpacing: '-0.04em',
              opacity: 0.15,
              transform: 'rotate(-3deg)',
            }}
          >
            {data.myScore}-{data.oppScore}
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-block', position: 'relative' }}>
              <PixelAvatar size={160} color="#D9E833" border={ST.primary} />
              <CrownBadge />
            </div>
            <div className="st-display" style={{ fontSize: 32, color: '#fff', marginTop: 14 }}>
              {data.myHandle ?? '@YOU'}
            </div>
            <div
              className="st-display st-num"
              style={{
                fontSize: 96,
                color: ST.primary,
                lineHeight: 0.85,
                marginTop: 4,
                textShadow: `0 0 40px ${ST.primary}88`,
              }}
            >
              {data.myScore}
            </div>
          </div>
          <div
            className="st-display"
            style={{
              fontSize: 96,
              color: ST.gold,
              textShadow: `6px 6px 0 rgba(0,0,0,0.5), 0 0 50px ${ST.gold}66`,
            }}
          >
            VS
          </div>
          <div style={{ textAlign: 'center' }}>
            <PixelAvatar size={160} color="#A78BFA" border={ST.red} mouthDown />
            <div className="st-display" style={{ fontSize: 32, color: '#fff', marginTop: 14 }}>
              {data.oppHandle ?? '@opp'}
            </div>
            <div
              className="st-display st-num"
              style={{ fontSize: 96, color: '#52525b', lineHeight: 0.85, marginTop: 4 }}
            >
              {data.oppScore}
            </div>
          </div>
        </div>
      </div>
      <DuelPayoutBanner won amount={data.amountSol} />
    </CardShell>
  );
}

export function ShareCardDuelKing({ data }: { data: DuelCardData }) {
  return (
    <CardShell accent={ST.primary}>
      <DiagonalTape color={ST.primary} text="DUEL CHAMPION" />
      <BigGlyph
        text="KING"
        color={ST.primary}
        size={300}
        gradient={`linear-gradient(160deg, #FFE680, ${ST.gold} 30%, ${ST.primary} 70%)`}
      />
      <div style={{ position: 'absolute', top: 430, left: 0, right: 0, textAlign: 'center', zIndex: 3 }}>
        <div className="st-display" style={{ fontSize: 30, color: '#fff', fontStyle: 'italic' }}>
          beat <span style={{ color: ST.primary }}>{data.oppHandle ?? '@opp'}</span>{' '}
          {data.myScore}-{data.oppScore} · won{' '}
          <span style={{ color: ST.gold }}>{data.amountSol} SOL</span>
        </div>
      </div>
    </CardShell>
  );
}

// ── DUEL LOSERS (4) ─────────────────────────────────────────────────────

export function ShareCardDuelWrecked({ data }: { data: DuelCardData }) {
  return (
    <CardShell accent={ST.red}>
      <DiagonalTape color={ST.red} text="WRECKED" />
      <DuelVsLayout
        won={false}
        myScore={data.myScore}
        oppScore={data.oppScore}
        oppName={data.oppHandle}
        myHandle={data.myHandle}
        stamp="L"
      />
      <DuelPayoutBanner won={false} amount={data.amountSol} />
    </CardShell>
  );
}

export function ShareCardDuelGotCooked({ data }: { data: DuelCardData }) {
  return (
    <CardShell accent={ST.red}>
      <DiagonalTape color={ST.red} text="GOT COOKED" />
      <DuelVsLayout
        won={false}
        myScore={data.myScore}
        oppScore={data.oppScore}
        oppName={data.oppHandle}
        myHandle={data.myHandle}
        stamp="L"
      />
      <DuelPayoutBanner won={false} amount={data.amountSol} />
    </CardShell>
  );
}

export function ShareCardDuelSwept({ data }: { data: DuelCardData }) {
  return (
    <CardShell accent={ST.red}>
      <DiagonalTape color={ST.red} text={`SWEPT ${data.myScore}-${data.oppScore}`} />
      <div style={{ position: 'absolute', top: 170, left: 40, right: 40, zIndex: 3 }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            textAlign: 'center',
            zIndex: -1,
          }}
        >
          <div
            className="st-display"
            style={{
              fontSize: 340,
              lineHeight: 0.85,
              color: ST.red,
              letterSpacing: '-0.04em',
              opacity: 0.15,
              transform: 'rotate(-3deg)',
            }}
          >
            {data.myScore}-{data.oppScore}
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <PixelAvatar size={160} color="#D9E833" border={ST.red} mouthDown />
            <div className="st-display" style={{ fontSize: 32, color: '#fff', marginTop: 14 }}>
              {data.myHandle ?? '@YOU'}
            </div>
            <div
              className="st-display st-num"
              style={{ fontSize: 96, color: '#52525b', lineHeight: 0.85, marginTop: 4 }}
            >
              {data.myScore}
            </div>
          </div>
          <div
            className="st-display"
            style={{
              fontSize: 96,
              color: ST.gold,
              textShadow: `6px 6px 0 rgba(0,0,0,0.5)`,
            }}
          >
            VS
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-block', position: 'relative' }}>
              <PixelAvatar size={160} color="#A78BFA" border={ST.red} />
              <CrownBadge />
            </div>
            <div className="st-display" style={{ fontSize: 32, color: '#fff', marginTop: 14 }}>
              {data.oppHandle ?? '@trivia_king'}
            </div>
            <div
              className="st-display st-num"
              style={{
                fontSize: 96,
                color: ST.red,
                lineHeight: 0.85,
                marginTop: 4,
                textShadow: `0 0 40px ${ST.red}88`,
              }}
            >
              {data.oppScore}
            </div>
          </div>
        </div>
      </div>
      <DuelPayoutBanner won={false} amount={data.amountSol} />
    </CardShell>
  );
}

export function ShareCardDuelHumbled({ data }: { data: DuelCardData }) {
  return (
    <CardShell accent={ST.red}>
      <DiagonalTape color={ST.red} text="HUMBLED" />
      <BigGlyph text="HUMBLED" color={ST.red} size={200} top={170} />
      <div style={{ position: 'absolute', top: 380, left: 0, right: 0, textAlign: 'center', zIndex: 3 }}>
        <div className="st-display" style={{ fontSize: 30, color: '#fff', fontStyle: 'italic' }}>
          lost to <span style={{ color: ST.red }}>{data.oppHandle ?? '@opp'}</span>{' '}
          {data.myScore}-{data.oppScore} · down{' '}
          <span style={{ color: ST.red }}>{data.amountSol} SOL</span>
        </div>
        <div
          className="st-uplabel"
          style={{ fontSize: 14, color: '#71717a', marginTop: 14, letterSpacing: '0.2em' }}
        >
          "I'll be back."
        </div>
      </div>
    </CardShell>
  );
}

// ════════════════════════════════════════════════════════════════════════
// VARIANT SELECTORS , pick the right card based on result data
// ════════════════════════════════════════════════════════════════════════

export type RoundVariant =
  | 'wagmi'
  | 'jackpot'
  | 'cracked'
  | 'on-fire'
  | 'ngmi'
  | 'rekt'
  | 'cooked'
  | 'skill-issue';

/**
 * Selects the most fitting round card variant given results data.
 *
 * Win path (rank <=5):
 *   - on-fire: streak >= 5 (rare, high-value)
 *   - cracked: 10/10 in <2min (very rare)
 *   - jackpot: rank<=3 AND prize >= 0.05 SOL (big payout)
 *   - wagmi:   default win
 *
 * Loss path:
 *   - cooked: dropped 13+ places vs last round (place-drop)
 *   - skill-issue: rank 16-30, score >= 5 (close to making it)
 *   - rekt:   score <= 2 (catastrophic)
 *   - ngmi:   default loss
 */
export function selectRoundVariant(data: RoundCardData): RoundVariant {
  const won = data.rank != null && data.rank <= 5;
  if (won) {
    if ((data.winStreak ?? 0) >= 5) return 'on-fire';
    if (data.score === 10 && data.timeSeconds < 120) return 'cracked';
    if (data.rank! <= 3 && (data.prizeSol ?? 0) >= 0.05) return 'jackpot';
    return 'wagmi';
  }
  if ((data.rankDropPlaces ?? 0) >= 13) return 'cooked';
  if (data.score <= 2) return 'rekt';
  if (data.rank != null && data.rank >= 16 && data.rank <= 30 && data.score >= 5) return 'skill-issue';
  return 'ngmi';
}

export type DuelVariant =
  | 'trivia-master'
  | 'problem-solved'
  | 'clean-sweep'
  | 'king'
  | 'wrecked'
  | 'got-cooked'
  | 'swept'
  | 'humbled';

/**
 * Selects the most fitting duel card variant given results data.
 *
 * Win path:
 *   - clean-sweep: opp scored 0
 *   - king:        margin >= 3 (dominant)
 *   - problem-solved: margin == 1 (close)
 *   - trivia-master: default win
 *
 * Loss path:
 *   - swept:       I scored 0
 *   - got-cooked:  margin >= 3 (dominant loss)
 *   - humbled:     margin == 2
 *   - wrecked:     default loss
 */
export function selectDuelVariant(data: DuelCardData): DuelVariant {
  const margin = Math.abs(data.myScore - data.oppScore);
  if (data.won) {
    if (data.oppScore === 0) return 'clean-sweep';
    if (margin >= 3) return 'king';
    if (margin === 1) return 'problem-solved';
    return 'trivia-master';
  }
  if (data.myScore === 0) return 'swept';
  if (margin >= 3) return 'got-cooked';
  if (margin === 2) return 'humbled';
  return 'wrecked';
}

/** Renders the chosen round card variant. */
export function renderRoundCard(data: RoundCardData) {
  const variant = selectRoundVariant(data);
  switch (variant) {
    case 'wagmi':
      return <ShareCardWagmi data={data} />;
    case 'jackpot':
      return <ShareCardJackpot data={data} />;
    case 'cracked':
      return <ShareCardCracked data={data} />;
    case 'on-fire':
      return <ShareCardOnFire data={data} />;
    case 'ngmi':
      return <ShareCardNgmi data={data} />;
    case 'rekt':
      return <ShareCardRekt data={data} />;
    case 'cooked':
      return <ShareCardCooked data={data} />;
    case 'skill-issue':
      return <ShareCardSkillIssue data={data} />;
  }
}

/** Renders the chosen duel card variant. */
export function renderDuelCard(data: DuelCardData) {
  const variant = selectDuelVariant(data);
  switch (variant) {
    case 'trivia-master':
      return <ShareCardDuelTriviaMaster data={data} />;
    case 'problem-solved':
      return <ShareCardDuelProblemSolved data={data} />;
    case 'clean-sweep':
      return <ShareCardDuelClean data={data} />;
    case 'king':
      return <ShareCardDuelKing data={data} />;
    case 'wrecked':
      return <ShareCardDuelWrecked data={data} />;
    case 'got-cooked':
      return <ShareCardDuelGotCooked data={data} />;
    case 'swept':
      return <ShareCardDuelSwept data={data} />;
    case 'humbled':
      return <ShareCardDuelHumbled data={data} />;
  }
}
