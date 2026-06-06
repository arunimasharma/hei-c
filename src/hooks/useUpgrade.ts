import { useState, useCallback } from 'react';
import { usePass } from '../context/PassContext';
import { supabase } from '../lib/supabaseClient';

export function useUpgrade() {
  const { openCohort } = usePass();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = useCallback(async () => {
    if (!openCohort || !supabase) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ cohort_id: openCohort.id }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  }, [openCohort]);

  return { handleUpgrade, upgradeLoading: loading };
}
