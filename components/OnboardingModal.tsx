/**
 * OnboardingModal — first-connect popup for new wallets (v2.1, 2026-06-05).
 *
 * 3 steps:
 *   1. Age 18+ + ToS confirmation
 *   2. Referral code entry (pre-filled if ?ref=X was captured in App.tsx),
 *      with SKIP option
 *   3. Username (auto-suggests {seekerDomain}.skr if user is a Seeker holder)
 *
 * On completion, calls completeOnboarding() which stamps age_verified_at +
 * tos_accepted_at + onboarded_at on player_profiles AND registers the
 * referral if provided. After success, the modal closes and the user lands
 * in the app's normal home view.
 *
 * Gate logic lives in App.tsx — this component just renders the steps and
 * fires the submit handler. Caller decides when to show/hide.
 */
import React, { useEffect, useState } from 'react';
import { completeOnboarding, checkUsernameAvailable } from '../src/utils/api';

interface OnboardingModalProps {
  walletAddress: string;
  /** Seeker .skr domain if user is verified, null otherwise. Used to
   *  auto-suggest the username on step 3. */
  seekerDomain?: string | null;
  /** Captured referral code from `?ref=X` URL (if any). Pre-fills step 2. */
  initialReferralCode?: string | null;
  /** Called after a successful submit. Parent should refresh profile state
   *  and dismiss the modal. */
  onComplete: (result: { username: string; referralRegistered: boolean }) => void;
  /** Optional: tap "I'm under 18" closes the app gracefully. Defaults to a
   *  no-op (modal stays open) since the user shouldn't be playing. */
  onAbort?: () => void;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({
  walletAddress,
  seekerDomain,
  initialReferralCode,
  onComplete,
  onAbort,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [age18, setAge18] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);

  // Step 2
  const [refInput, setRefInput] = useState(initialReferralCode?.trim() || '');
  const [refSkipped, setRefSkipped] = useState(false);

  // Step 3
  const seekerSuggestion = seekerDomain ? `${seekerDomain}.skr` : '';
  const [username, setUsername] = useState(seekerSuggestion);
  // Track whether the user has the Seeker domain so we can offer "use as
  // display" by default and skip them past manual editing if they want.
  const isSeeker = !!seekerDomain;

  // Submit + error state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 → 2 gate
  const canAdvanceStep1 = age18 && tosAccepted;

  // Live username validation. Server enforces the same rules later via the
  // update-profile EF; this is just for instant feedback.
  const usernameTrim = username.trim();
  const usernameTooShort = usernameTrim.length > 0 && usernameTrim.length < 2;
  const usernameTooLong = usernameTrim.length > 24;
  const usernameFormatOk = usernameTrim.length >= 2 && usernameTrim.length <= 24;

  // Live availability check (debounced 350ms). Hits the player_profiles
  // table case-insensitively. Server has a UNIQUE index, so this is just
  // for instant feedback — the EF is still the source of truth.
  const [availability, setAvailability] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  useEffect(() => {
    if (!usernameFormatOk) {
      setAvailability('idle');
      return;
    }
    setAvailability('checking');
    const timer = setTimeout(() => {
      let cancelled = false;
      checkUsernameAvailable(usernameTrim)
        .then((ok) => {
          if (!cancelled) setAvailability(ok ? 'available' : 'taken');
        })
        .catch(() => {
          if (!cancelled) setAvailability('idle');
        });
      return () => { cancelled = true; };
    }, 350);
    return () => clearTimeout(timer);
  }, [usernameTrim, usernameFormatOk]);

  // Final submit gate: format ok AND either confirmed available or still
  // checking (we'll let the EF do the final say on borderline timing).
  const usernameOk = usernameFormatOk && availability !== 'taken';

  // Referral validation (mirrors set-referral-code rules: 4-20 alphanumeric).
  const refNormalized = refInput.trim().toUpperCase();
  const refOk = refNormalized.length === 0 || (refNormalized.length >= 4 && refNormalized.length <= 20 && /^[A-Z0-9]+$/.test(refNormalized));

  const handleNext = () => {
    setError(null);
    if (step === 1 && canAdvanceStep1) setStep(2);
    else if (step === 2) setStep(3);
  };

  const handleBack = () => {
    setError(null);
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const handleSkipReferral = () => {
    setError(null);
    setRefInput('');
    setRefSkipped(true);
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!usernameOk) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await completeOnboarding(walletAddress, {
        username: usernameTrim,
        referralCode: refNormalized.length > 0 ? refNormalized : null,
        useSkrAsDisplay: isSeeker && usernameTrim.toLowerCase() === seekerSuggestion.toLowerCase(),
        skrDomain: isSeeker ? seekerDomain : null,
      });
      if (!result.success) {
        setError(result.error || 'Could not finish setup. Try again.');
        return;
      }
      // Surface referral errors as a soft warning — onboarding still succeeded.
      if (result.referralError) {
        // eslint-disable-next-line no-console
        console.warn('Onboarding referral hint:', result.referralError);
      }
      onComplete({
        username: result.username || usernameTrim,
        referralRegistered: result.referralRegistered === true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-focus username when entering step 3 (unless a seeker name is
  // already pre-filled — let the user just hit FINISH).
  useEffect(() => {
    if (step === 3 && !seekerSuggestion) {
      const el = document.getElementById('onboarding-username-input');
      if (el) (el as HTMLInputElement).focus();
    }
  }, [step, seekerSuggestion]);

  const dotStyle = (active: boolean, complete: boolean): React.CSSProperties => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: complete ? '#14F195' : active ? '#14F195' : 'rgba(255,255,255,0.18)',
    transition: 'background 0.2s',
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(6px)' }} />
      <div
        className="rounded-2xl"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 480,
          background: '#0A0A0A',
          border: '1.5px solid rgba(20,241,149,0.45)',
          boxShadow: '0 30px 80px -30px rgba(20,241,149,0.6)',
          overflow: 'hidden',
        }}
      >
        {/* Solana gradient strip at the top — visual brand cue */}
        <div
          style={{
            height: 4,
            background: 'linear-gradient(90deg,#14F195 0%,#7C8DFF 50%,#9945FF 100%)',
          }}
        />

        {/* Step indicator + back arrow */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={dotStyle(step === 1, step > 1)} />
            <span style={dotStyle(step === 2, step > 2)} />
            <span style={dotStyle(step === 3, false)} />
          </div>
          {step > 1 && !submitting && (
            <button
              onClick={handleBack}
              className="font-black italic uppercase active:opacity-90"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#71717a',
                fontSize: 10,
                letterSpacing: '0.14em',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              ← BACK
            </button>
          )}
        </div>

        {/* Step content */}
        {step === 1 && (
          <div style={{ padding: '4px 22px 12px' }}>
            <div className="font-black italic uppercase" style={{ fontSize: 10, color: '#14F195', letterSpacing: '0.18em' }}>
              WELCOME TO SOL TRIVIA
            </div>
            <div className="font-black italic uppercase text-white mt-2" style={{ fontSize: 26, letterSpacing: '-0.02em', lineHeight: 1 }}>
              Quick setup
            </div>
            <p className="text-zinc-400 mt-3" style={{ fontSize: 13, lineHeight: 1.55 }}>
              Before you play for SOL prizes, we need two quick confirmations. Takes 30 seconds.
            </p>

            <label
              className="flex items-start gap-3 mt-5 cursor-pointer"
              style={{
                background: age18 ? 'rgba(20,241,149,0.06)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${age18 ? '#14F195' : 'rgba(255,255,255,0.08)'}`,
                padding: '12px 14px',
                borderRadius: 12,
              }}
            >
              <input
                type="checkbox"
                checked={age18}
                onChange={(e) => setAge18(e.target.checked)}
                style={{ marginTop: 3, width: 16, height: 16, accentColor: '#14F195', cursor: 'pointer' }}
              />
              <span className="text-white" style={{ fontSize: 13, lineHeight: 1.4 }}>
                I am <span className="font-black">18 or older</span> and legally allowed to participate in real-money games where I live.
              </span>
            </label>

            <label
              className="flex items-start gap-3 mt-3 cursor-pointer"
              style={{
                background: tosAccepted ? 'rgba(20,241,149,0.06)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${tosAccepted ? '#14F195' : 'rgba(255,255,255,0.08)'}`,
                padding: '12px 14px',
                borderRadius: 12,
              }}
            >
              <input
                type="checkbox"
                checked={tosAccepted}
                onChange={(e) => setTosAccepted(e.target.checked)}
                style={{ marginTop: 3, width: 16, height: 16, accentColor: '#14F195', cursor: 'pointer' }}
              />
              <span className="text-white" style={{ fontSize: 13, lineHeight: 1.4 }}>
                I accept the <a href="/terms" target="_blank" rel="noreferrer" className="font-black" style={{ color: '#14F195' }}>Terms of Service</a> and <a href="/privacy" target="_blank" rel="noreferrer" className="font-black" style={{ color: '#14F195' }}>Privacy Policy</a>.
              </span>
            </label>

            {onAbort && (
              <button
                onClick={onAbort}
                className="font-black italic uppercase active:opacity-90"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#52525b',
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  cursor: 'pointer',
                  padding: '8px 0 0',
                  marginTop: 6,
                }}
              >
                I'm under 18 — exit
              </button>
            )}
          </div>
        )}

        {step === 2 && (
          <div style={{ padding: '4px 22px 12px' }}>
            <div className="font-black italic uppercase" style={{ fontSize: 10, color: '#14F195', letterSpacing: '0.18em' }}>
              REFERRAL CODE
            </div>
            <div className="font-black italic uppercase text-white mt-2" style={{ fontSize: 26, letterSpacing: '-0.02em', lineHeight: 1 }}>
              Got a referral?
            </div>
            <p className="text-zinc-400 mt-3" style={{ fontSize: 13, lineHeight: 1.55 }}>
              {initialReferralCode
                ? <>We caught a referral code from your link. Confirm or replace it before continuing.</>
                : <>Enter a friend's code so they earn rewards when you play. Or skip — no pressure.</>}
            </p>

            <div className="mt-5">
              <div className="font-black italic uppercase mb-2" style={{ fontSize: 9, color: '#71717a', letterSpacing: '0.16em' }}>
                CODE (OPTIONAL)
              </div>
              <input
                type="text"
                value={refInput}
                onChange={(e) => {
                  const filtered = e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 20);
                  setRefInput(filtered);
                }}
                placeholder="e.g. TRIVIANERD"
                maxLength={20}
                className="rounded-lg"
                style={{
                  width: '100%',
                  background: '#000',
                  border: `1px solid ${refInput.length > 0 ? (refOk ? '#14F195' : 'rgba(255,49,49,0.55)') : 'rgba(255,255,255,0.10)'}`,
                  padding: '12px 14px',
                  fontFamily: 'JetBrains Mono, Menlo, monospace',
                  fontSize: 16,
                  letterSpacing: '0.18em',
                  color: '#fff',
                  outline: 'none',
                }}
              />
              <div className="mt-2" style={{ fontSize: 10 }}>
                <span
                  className="font-black italic uppercase"
                  style={{
                    color: refInput.length === 0 ? '#52525b' : refOk ? '#14F195' : '#FF7676',
                    letterSpacing: '0.14em',
                  }}
                >
                  {refInput.length === 0
                    ? 'leave blank to skip'
                    : refOk
                      ? '✓ valid format'
                      : '4-20 letters or numbers'}
                </span>
              </div>
            </div>

            {refSkipped && (
              <p className="text-zinc-500 mt-3" style={{ fontSize: 11 }}>
                Referral skipped. You can still add one later via someone's invite link, but you can never replace it once set.
              </p>
            )}
          </div>
        )}

        {step === 3 && (
          <div style={{ padding: '4px 22px 12px' }}>
            <div className="font-black italic uppercase" style={{ fontSize: 10, color: '#14F195', letterSpacing: '0.18em' }}>
              PICK A USERNAME
            </div>
            <div className="font-black italic uppercase text-white mt-2" style={{ fontSize: 26, letterSpacing: '-0.02em', lineHeight: 1 }}>
              How should we call you?
            </div>
            <p className="text-zinc-400 mt-3" style={{ fontSize: 13, lineHeight: 1.55 }}>
              {isSeeker
                ? <>We detected your Seeker domain. We pre-filled it for you, but you can change it anytime from your profile.</>
                : <>2-24 characters. You can change it anytime from your profile.</>}
            </p>

            <div className="mt-5">
              <div className="font-black italic uppercase mb-2" style={{ fontSize: 9, color: '#71717a', letterSpacing: '0.16em' }}>
                USERNAME
              </div>
              <input
                id="onboarding-username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.slice(0, 24))}
                placeholder="@you"
                maxLength={24}
                className="rounded-lg"
                style={{
                  width: '100%',
                  background: '#000',
                  border: `1px solid ${username.length > 0 ? (usernameOk ? '#14F195' : 'rgba(255,49,49,0.55)') : 'rgba(255,255,255,0.10)'}`,
                  padding: '12px 14px',
                  fontSize: 18,
                  color: '#fff',
                  outline: 'none',
                  fontWeight: 700,
                }}
              />
              <div className="flex justify-between mt-2" style={{ fontSize: 10 }}>
                <span
                  className="font-black italic uppercase"
                  style={{
                    color: username.length === 0
                      ? '#52525b'
                      : !usernameFormatOk
                        ? '#FF7676'
                        : availability === 'taken'
                          ? '#FF7676'
                          : availability === 'available'
                            ? '#14F195'
                            : '#71717a',
                    letterSpacing: '0.14em',
                  }}
                >
                  {username.length === 0
                    ? 'pick anything memorable'
                    : usernameTooShort
                      ? 'too short (2-24)'
                      : usernameTooLong
                        ? 'too long (2-24)'
                        : availability === 'checking'
                          ? 'checking…'
                          : availability === 'taken'
                            ? '✗ already taken'
                            : availability === 'available'
                              ? '✓ available'
                              : '✓ looks good'}
                </span>
                <span style={{ color: '#52525b', fontVariantNumeric: 'tabular-nums' }}>
                  {usernameTrim.length}/24
                </span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: '0 22px 12px' }}>
            <div
              className="rounded-lg"
              style={{ background: 'rgba(255,49,49,0.10)', border: '1px solid rgba(255,49,49,0.35)', padding: '10px 12px', fontSize: 11, color: '#FF7676' }}
            >
              {error}
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div style={{ padding: '8px 14px 14px', display: 'flex', gap: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {step === 1 && (
            <button
              onClick={handleNext}
              disabled={!canAdvanceStep1}
              className="flex-1 font-black italic uppercase rounded-xl active:opacity-90"
              style={{
                appearance: 'none',
                background: canAdvanceStep1 ? '#14F195' : 'rgba(20,241,149,0.20)',
                border: 'none',
                color: canAdvanceStep1 ? '#000' : 'rgba(255,255,255,0.5)',
                padding: '12px 0',
                fontSize: 12,
                letterSpacing: '0.14em',
                cursor: canAdvanceStep1 ? 'pointer' : 'not-allowed',
              }}
            >
              CONTINUE →
            </button>
          )}

          {step === 2 && (
            <>
              <button
                onClick={handleSkipReferral}
                disabled={submitting}
                className="flex-1 font-black italic uppercase rounded-xl active:opacity-90"
                style={{
                  appearance: 'none',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: '#fff',
                  padding: '12px 0',
                  fontSize: 12,
                  letterSpacing: '0.14em',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                SKIP
              </button>
              <button
                onClick={handleNext}
                disabled={!refOk || submitting || refInput.length === 0}
                className="flex-1 font-black italic uppercase rounded-xl active:opacity-90"
                style={{
                  appearance: 'none',
                  background: refOk && refInput.length > 0 && !submitting ? '#14F195' : 'rgba(20,241,149,0.20)',
                  border: 'none',
                  color: refOk && refInput.length > 0 && !submitting ? '#000' : 'rgba(255,255,255,0.5)',
                  padding: '12px 0',
                  fontSize: 12,
                  letterSpacing: '0.14em',
                  cursor: refOk && refInput.length > 0 && !submitting ? 'pointer' : 'not-allowed',
                }}
              >
                APPLY →
              </button>
            </>
          )}

          {step === 3 && (
            <button
              onClick={handleSubmit}
              disabled={!usernameOk || submitting}
              className="flex-1 font-black italic uppercase rounded-xl active:opacity-90"
              style={{
                appearance: 'none',
                background: usernameOk && !submitting ? '#14F195' : 'rgba(20,241,149,0.20)',
                border: 'none',
                color: usernameOk && !submitting ? '#000' : 'rgba(255,255,255,0.5)',
                padding: '12px 0',
                fontSize: 12,
                letterSpacing: '0.14em',
                cursor: usernameOk && !submitting ? 'pointer' : 'not-allowed',
              }}
            >
              {submitting ? 'FINISHING…' : 'ENTER SOL TRIVIA →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
