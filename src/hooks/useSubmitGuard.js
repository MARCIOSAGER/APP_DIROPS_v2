import { useState, useCallback } from 'react';

export default function useSubmitGuard() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const guardedSubmit = useCallback(async (fn) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await fn();
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting]);

  return { isSubmitting, guardedSubmit };
}
