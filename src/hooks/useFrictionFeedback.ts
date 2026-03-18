import { useEffect, useRef, useState } from 'react';
import { FrictionDetector, type FrictionEvent } from '../lib/FrictionDetector';
import { FeedbackStore } from '../lib/FeedbackStore';

export type WidgetStatus = 'idle' | 'visible' | 'submitted' | 'dismissed';

export interface FrictionFeedbackState {
  status: WidgetStatus;
  event: FrictionEvent | null;
  selectedOption: string | null;
  pointsEarned: number;
  submit: (option: string, socialProofPct?: number) => void;
  dismiss: () => void;
}

const AUTO_DISMISS_MS = 5_000;

export function useFrictionFeedback(): FrictionFeedbackState {
  const [status, setStatus] = useState<WidgetStatus>('idle');
  const [event, setEvent] = useState<FrictionEvent | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [pointsEarned, setPointsEarned] = useState(0);

  const detectorRef = useRef<FrictionDetector | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const detector = new FrictionDetector();
    detectorRef.current = detector;

    detector.init({
      timeStallMs: 8_000,
      scrollStallPct: 40,
      scrollStallIdleMs: 4_000,
      noActionMs: 12_000,
    });

    detector.on('friction_detected', (e) => {
      setStatus((prev) => {
        if (prev === 'visible' || prev === 'submitted') return prev;
        setEvent(e);
        return 'visible';
      });
    });

    return () => {
      detector.destroy();
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  const submit = (option: string, socialProofPct = 65) => {
    setSelectedOption(option);
    setStatus('submitted');

    // Persist to FeedbackStore and surface points earned
    const entry = FeedbackStore.save({
      trigger: event?.trigger ?? 'unknown',
      option,
      timestamp: Date.now(),
      pageId: window.location.pathname,
      sessionId: event?.metadata.session_id as string ?? 'anon',
      socialProofPct,
    });
    setPointsEarned(entry.pointsEarned);

    dismissTimer.current = setTimeout(() => setStatus('dismissed'), AUTO_DISMISS_MS);
  };

  const dismiss = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setStatus('dismissed');
  };

  return { status, event, selectedOption, pointsEarned, submit, dismiss };
}
