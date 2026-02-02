// Sound effects using Web Audio API
// Generates sounds programmatically (no external files needed)

class SoundManager {
  private audioContext: AudioContext | null = null;

  constructor() {
    // Initialize audio context on user interaction
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  private ensureAudioContext() {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Resume if suspended (required for autoplay policies)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  // Play a tone with given frequency, duration, and type
  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume: number = 0.3
  ) {
    if (!this.audioContext) return;

    this.ensureAudioContext();

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  // Correct answer sound - ascending pleasant chime
  playCorrect() {
    if (!this.audioContext) return;
    
    this.ensureAudioContext();
    
    // Play a pleasant ascending chord
    const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5 (C major chord)
    frequencies.forEach((freq, index) => {
      setTimeout(() => {
        this.playTone(freq, 0.3, 'sine', 0.2);
      }, index * 50);
    });
  }

  // Wrong answer sound - descending harsh tone
  playWrong() {
    if (!this.audioContext) return;
    
    this.ensureAudioContext();
    
    // Play a descending harsh tone
    this.playTone(200, 0.2, 'sawtooth', 0.25);
    setTimeout(() => {
      this.playTone(150, 0.3, 'sawtooth', 0.2);
    }, 100);
  }

  // Click/tap sound
  playClick() {
    if (!this.audioContext) return;
    
    this.ensureAudioContext();
    this.playTone(800, 0.05, 'sine', 0.1);
  }
}

// Export singleton instance
export const soundManager = new SoundManager();

// Helper functions for easy access
export const playCorrectSound = () => soundManager.playCorrect();
export const playWrongSound = () => soundManager.playWrong();
export const playClickSound = () => soundManager.playClick();
