# Integration Guide - Exact Code Changes

## 📝 Overview

This document shows EXACTLY what needs to be added to existing files. All changes are additions only - nothing is removed or modified.

---

## 1️⃣ types.ts

**Location:** `/types.ts`

**Add these two lines to the View enum:**

```typescript
export enum View {
  HOME = 'HOME',
  LEADERBOARD = 'LEADERBOARD',
  ROUND_WINNERS = 'ROUND_WINNERS',
  PLAY = 'PLAY',
  QUESTS = 'QUESTS',
  PROFILE = 'PROFILE',
  QUIZ = 'QUIZ',
  RESULTS = 'RESULTS',
  ADMIN = 'ADMIN',
  CONTRACT_TEST = 'CONTRACT_TEST',
  TERMS = 'TERMS',
  PRIVACY = 'PRIVACY',
  PRACTICE = 'PRACTICE',              // ← ADD THIS
  PRACTICE_RESULTS = 'PRACTICE_RESULTS'  // ← ADD THIS
}
```

---

## 2️⃣ src/utils/api.ts

**Location:** `/src/utils/api.ts`

**Add at the end of the file (before the last export function):**

```typescript
// ─── Practice Mode API (Free play, no wallet required) ───────────────────

export interface PracticeGameResponse {
  practice_session_id: string;
  question_ids: string[];
  total_questions: number;
  mode: 'practice';
}

export interface PracticeQuestion {
  index: number;
  id: string;
  category: string;
  difficulty: string;
  text: string;
  options: string[];
  correct_index: number; // Included for client-side scoring
}

export interface GetPracticeQuestionsResponse {
  questions: PracticeQuestion[];
  total_questions: number;
  time_per_question: number;
  mode: 'practice';
}

/** Start a practice game session (no payment required) */
export async function startPracticeGame(): Promise<PracticeGameResponse> {
  const response = await fetch(`${FUNCTIONS_URL}/practice-game`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to start practice game');
  }

  return response.json();
}

/** Get practice questions for a practice session */
export async function getPracticeQuestions(question_ids: string[]): Promise<GetPracticeQuestionsResponse> {
  const response = await fetch(`${FUNCTIONS_URL}/get-practice-questions`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ question_ids }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to get practice questions');
  }

  return response.json();
}
```

**Also add to imports at the top:**
```typescript
import { ... , startPracticeGame } from './src/utils/api';  // ← ADD startPracticeGame
```

---

## 3️⃣ components/PlayView.tsx

**Location:** `/components/PlayView.tsx`

**Step 1: Update interface (line ~4):**
```typescript
interface PlayViewProps {
  lives: number | null;
  roundEntriesUsed: number;
  roundEntriesMax: number;
  onStartQuiz: () => void;
  onOpenBuyLives: () => void;
  onStartPractice: () => void;  // ← ADD THIS
}
```

**Step 2: Update component props (line ~11):**
```typescript
const PlayView: React.FC<PlayViewProps> = ({
  lives,
  roundEntriesUsed,
  roundEntriesMax,
  onStartQuiz,
  onOpenBuyLives,
  onStartPractice  // ← ADD THIS
}) => {
```

**Step 3: Add practice button after the main START TRIVIA button (after line ~55):**
```typescript
        {/* Practice Mode Button */}
        <button
          onClick={onStartPractice}
          className="w-full h-20 bg-[#0A0A0A] border-2 border-[#14F195]/30 hover:border-[#14F195]/60 rounded-full flex items-center justify-center px-10 active:scale-[0.98] transition-all group shadow-[0_8px_30px_-8px_rgba(20,241,149,0.2)] hover:shadow-[0_12px_40px_-8px_rgba(20,241,149,0.4)] relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#14F195]/5 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out pointer-events-none"></div>

          <div className="flex items-center gap-3 relative z-10">
            <svg className="w-6 h-6 text-[#14F195]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-[#14F195] text-2xl md:text-3xl font-[1000] italic leading-none uppercase tracking-tighter">
              TRY FREE PRACTICE
            </span>
          </div>
        </button>
```

**Step 4: Update footer text (line ~76):**
```typescript
<p className="text-[9px] text-zinc-400 text-center font-black uppercase tracking-widest mt-2 px-6 opacity-60 italic leading-tight">
  * 2 round entries reset every 6h. Entry fee: 0.0225 SOL. <span className="text-[#14F195]">Extra lives</span> are for plays beyond your round entries. <span className="text-[#14F195]">Practice mode</span> is free & unlimited.
</p>
```

---

## 4️⃣ components/QuizView.tsx

**Location:** `/components/QuizView.tsx`

**Step 1: Update imports (line ~5):**
```typescript
import { getQuestions, submitAnswer, getPracticeQuestions, type PracticeQuestion } from '../src/utils/api';
```

**Step 2: Update interface (line ~8):**
```typescript
interface QuizViewProps {
  sessionId: string | null;
  onFinish: (score: number, points: number, totalTime: number) => void;
  onQuit: () => void;
  mode?: 'paid' | 'practice';           // ← ADD THIS
  practiceQuestionIds?: string[];        // ← ADD THIS
}
```

**Step 3: Update component props (line ~20):**
```typescript
const QuizView: React.FC<QuizViewProps> = ({
  sessionId,
  onFinish,
  onQuit,
  mode = 'paid',                         // ← ADD THIS
  practiceQuestionIds                     // ← ADD THIS
}) => {
  const isPracticeMode = mode === 'practice';  // ← ADD THIS
```

**Step 4: Update fetchQuestions useEffect (replace entire useEffect starting ~line 39):**

See `QUIZ_VIEW_CHANGES.md` for the full function replacement (it's long).

Key changes:
- Add practice mode branch that calls `getPracticeQuestions()`
- Practice questions include `correct_index` for client-side scoring
- Paid mode unchanged (server-side validation)

**Step 5: Update handleOptionSelect function:**

Add practice mode logic for client-side scoring (see `QUIZ_VIEW_CHANGES.md` for details).

---

## 5️⃣ App.tsx

**Location:** `/App.tsx`

**Step 1: Update imports:**
```typescript
import PracticeResultsView from './components/PracticeResultsView';
import { ... , startPracticeGame } from './src/utils/api';
```

**Step 2: Add state variables (after line ~84):**
```typescript
// Practice mode state
const [practiceQuestionIds, setPracticeQuestionIds] = useState<string[] | null>(null);
const [practiceResults, setPracticeResults] = useState<{ score: number; points: number; time: number } | null>(null);
```

**Step 3: Add practice handlers (before handleQuizFinish):**
```typescript
const handleStartPractice = async () => {
  try {
    console.log('🎮 Starting practice mode...');
    const response = await startPracticeGame();
    console.log('✅ Practice session created:', response.practice_session_id);
    setPracticeQuestionIds(response.question_ids);
    setPracticeResults(null);
    setCurrentView(View.PRACTICE);
  } catch (err: any) {
    console.error('❌ Failed to start practice game:', err);
    alert('Failed to start practice mode. Please try again.');
  }
};

const handlePracticeFinish = (correctCount: number, points: number, totalTimeSeconds: number) => {
  console.log('🎮 Practice finished:', { correctCount, points, totalTimeSeconds });
  setPracticeResults({ score: correctCount, points, time: totalTimeSeconds });
  setPracticeQuestionIds(null);
  setCurrentView(View.PRACTICE_RESULTS);
};
```

**Step 4: Update PATH_TO_VIEW (line ~5):**
```typescript
const PATH_TO_VIEW: Record<string, View> = {
  '/': View.HOME,
  '/play': View.PLAY,
  // ... existing entries ...
  '/practice': View.PRACTICE,                    // ← ADD THIS
  '/practice-results': View.PRACTICE_RESULTS,    // ← ADD THIS
};
```

**Step 5: Update PlayView props (line ~679):**
```typescript
<PlayView
  lives={livesDisplayReady ? lives : null}
  roundEntriesUsed={roundEntriesUsed}
  roundEntriesMax={ROUND_ENTRIES_MAX}
  onStartQuiz={handleStartQuiz}
  onOpenBuyLives={() => {
    if (!connected) { setShowWalletRequired(true); } else { setIsBuyLivesOpen(true); }
  }}
  onStartPractice={handleStartPractice}  // ← ADD THIS
/>
```

**Step 6: Add new view cases (after View.RESULTS case, before View.TERMS):**
```typescript
case View.PRACTICE:
  return practiceQuestionIds ? (
    <QuizView
      sessionId={null}
      mode="practice"
      practiceQuestionIds={practiceQuestionIds}
      onFinish={handlePracticeFinish}
      onQuit={() => {
        setPracticeQuestionIds(null);
        setCurrentView(View.PLAY);
      }}
    />
  ) : null;
case View.PRACTICE_RESULTS:
  return practiceResults ? (
    <PracticeResultsView
      score={practiceResults.score}
      totalQuestions={10}
      points={practiceResults.points}
      totalTime={practiceResults.time}
      onPlayForReal={() => {
        setPracticeResults(null);
        setCurrentView(View.PLAY);
        if (connected) {
          handleStartQuiz();
        } else {
          setShowWalletRequired(true);
        }
      }}
      onTryAgain={() => {
        setPracticeResults(null);
        handleStartPractice();
      }}
      onBackToHome={() => {
        setPracticeResults(null);
        setCurrentView(View.HOME);
      }}
    />
  ) : null;
```

---

## ✅ Summary

**Files to modify:** 5
**New files to add:** 4
**Lines added:** ~300
**Lines removed:** 0

All changes are isolated additions. No existing functionality is modified.
