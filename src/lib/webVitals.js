import { onLCP, onCLS, onFCP, onTTFB, onINP } from 'web-vitals';
import { supabase } from '@/lib/supabaseClient';

let _userId = null;
let _empresaId = null;

export function initWebVitals(user) {
  if (!user?.id) return;
  _userId = user.id;
  _empresaId = user.empresa_id || null;

  const send = async (metric) => {
    try {
      await supabase.from('performance_log').insert({
        metric_name: metric.name,
        metric_value: metric.value,
        rating: metric.rating,
        page_path: window.location.pathname,
        navigation_type: metric.navigationType || null,
        connection_type: navigator?.connection?.effectiveType || null,
        user_id: _userId,
        empresa_id: _empresaId,
      });
    } catch (_) {
      // silently ignore — never block the app
    }
  };

  onLCP(send);
  onCLS(send);
  onFCP(send);
  onTTFB(send);
  onINP(send);
}
