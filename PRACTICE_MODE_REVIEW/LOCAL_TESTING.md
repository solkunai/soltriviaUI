# Local Testing Guide

## 🎯 Goal

Test practice mode locally WITHOUT committing changes until Rush approves.

---

## 📋 Prerequisites

1. **Backend deployed** (Rush needs to do this first):
   - Deploy `practice-game` edge function
   - Deploy `get-practice-questions` edge function
   - Create `practice_questions` table
   - Import 250 questions

2. **Verify backend works:**
   ```bash
   # Test practice-game endpoint
   curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/practice-game \
     -H "apikey: YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{}'

   # Should return: {"practice_session_id": "...", "question_ids": [...], ...}
   ```

---

## 🧪 Local Testing Steps

### Option 1: Temporary Changes (Recommended)

**Make changes directly in your local files to test, but DON'T commit:**

1. **Copy new component:**
   ```bash
   cp PRACTICE_MODE_REVIEW/frontend-components/PracticeResultsView.tsx components/
   ```

2. **Apply changes from INTEGRATION_GUIDE.md manually:**
   - Edit `types.ts` - add PRACTICE views
   - Edit `src/utils/api.ts` - add practice functions
   - Edit `components/PlayView.tsx` - add practice button
   - Edit `components/QuizView.tsx` - add practice mode support
   - Edit `App.tsx` - add routing

3. **Test locally:**
   ```bash
   npm run dev
   ```

4. **Test flow:**
   - Navigate to `/play`
   - Click "TRY FREE PRACTICE"
   - Complete practice quiz
   - Verify results screen shows
   - Click "PLAY FOR REAL SOL"
   - Verify it prompts wallet connection

5. **Revert changes when done testing:**
   ```bash
   git checkout types.ts src/utils/api.ts components/PlayView.tsx components/QuizView.tsx App.tsx
   rm components/PracticeResultsView.tsx
   ```

---

### Option 2: Use Git Stash (Cleaner)

1. **Apply all changes:**
   ```bash
   # Copy new component
   cp PRACTICE_MODE_REVIEW/frontend-components/PracticeResultsView.tsx components/

   # Make all code changes from INTEGRATION_GUIDE.md
   ```

2. **Test locally:**
   ```bash
   npm run dev
   ```

3. **Stash changes (save without committing):**
   ```bash
   git add .
   git stash save "Practice mode - for testing"
   ```

4. **Later, when Rush approves, restore and commit:**
   ```bash
   git stash pop
   git add .
   git commit -m "Add practice mode"
   ```

---

### Option 3: Feature Branch (Safest)

1. **Create test branch:**
   ```bash
   git checkout -b feature/practice-mode-test
   ```

2. **Apply all changes** from INTEGRATION_GUIDE.md

3. **Copy new component:**
   ```bash
   cp PRACTICE_MODE_REVIEW/frontend-components/PracticeResultsView.tsx components/
   ```

4. **Commit to test branch only:**
   ```bash
   git add .
   git commit -m "Practice mode - for local testing only"
   ```

5. **Test locally:**
   ```bash
   npm run dev
   ```

6. **Switch back to main when done:**
   ```bash
   git checkout main
   ```

7. **Delete test branch OR keep for Rush to review:**
   ```bash
   # Delete:
   git branch -D feature/practice-mode-test

   # Or push for Rush to review:
   git push -u origin feature/practice-mode-test
   ```

---

## ✅ Testing Checklist

**Practice Mode:**
- [ ] "TRY FREE PRACTICE" button appears on `/play`
- [ ] Clicking button starts practice quiz
- [ ] 10 questions load correctly
- [ ] Timer counts down from 7s per question
- [ ] Correct answers show green
- [ ] Wrong answers show red
- [ ] Timeout submits as wrong
- [ ] Quiz completes after 10 questions

**Practice Results Screen:**
- [ ] Shows performance level (CHAD ENERGY, WAGMI, etc.)
- [ ] Shows accuracy percentage
- [ ] Shows correct count
- [ ] Shows time taken
- [ ] "PLAY FOR REAL SOL" button works
- [ ] "TRY AGAIN" restarts practice
- [ ] "MAIN MENU" goes to home

**Integration:**
- [ ] Practice mode doesn't break paid mode
- [ ] Can switch between practice and paid
- [ ] Wallet prompt works for paid mode
- [ ] No console errors

---

## 🐛 Troubleshooting

**"Failed to start practice game"**
- Backend not deployed yet
- Edge functions not accessible
- CORS issues (check Supabase settings)

**"No questions available"**
- `practice_questions` table not created
- Questions not imported
- Edge function can't access table

**QuizView errors**
- Check `mode` prop is passed correctly
- Verify `practiceQuestionIds` is array of strings
- Check console for detailed error

---

## 📝 Notes

- Local changes won't affect production until committed and deployed
- Backend needs to be deployed before frontend testing
- Keep PRACTICE_MODE_REVIEW folder - Rush will review from there
- Don't commit until Rush approves

---

**Ready to test?** Follow Option 1 or 3 above!
