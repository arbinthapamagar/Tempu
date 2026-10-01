import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

// Pull-to-refresh for the web build. react-native-web's RefreshControl renders
// nothing and never calls onRefresh, so lists could not be refreshed in the
// browser at all. ScrollView hands this component its scroller as `children`
// (the same way RNW's own one is used), so we listen on the wrapper:
//   - touch: drag down while already at the top, release past PULL_TRIGGER
//   - mouse/trackpad: keep scrolling up while already at the top
const PULL_TRIGGER = 70; // px of (damped) drag
const PULL_MAX = 110;
const WHEEL_TRIGGER = 240; // accumulated wheel delta at the top
const WHEEL_SETTLE_MS = 400; // a wheel burst that just reached the top doesn't count

export default function RefreshControl({ refreshing, onRefresh, enabled = true, tintColor, style, children }) {
  const wrapRef = useRef(null);
  const [pull, setPull] = useState(0);
  const live = useRef({});
  live.current = { refreshing, onRefresh, enabled };

  useEffect(() => {
    const wrap = wrapRef.current;
    const scroller = wrap?.lastElementChild; // the ScrollView, after the spinner
    if (!wrap || !scroller) return undefined;
    const atTop = () => scroller.scrollTop <= 0;
    const canPull = () => live.current.enabled && !live.current.refreshing && live.current.onRefresh;
    const fire = () => live.current.onRefresh?.();

    let startY = null;
    let dist = 0;
    const onTouchStart = (e) => {
      startY = canPull() && atTop() ? e.touches[0].clientY : null;
      dist = 0;
    };
    const onTouchMove = (e) => {
      if (startY == null) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0 || !atTop()) { dist = 0; setPull(0); return; }
      dist = Math.min(dy * 0.5, PULL_MAX);
      setPull(dist);
    };
    const onTouchEnd = () => {
      if (startY != null && dist >= PULL_TRIGGER) fire();
      startY = null;
      dist = 0;
      setPull(0);
    };

    let acc = 0;
    let lastAway = 0;
    let settle = null;
    const onWheel = (e) => {
      if (!atTop() || e.deltaY >= 0) { lastAway = Date.now(); acc = 0; setPull(0); return; }
      if (!canPull() || Date.now() - lastAway < WHEEL_SETTLE_MS) { lastAway = Date.now(); return; }
      acc += -e.deltaY;
      setPull(Math.min((acc / WHEEL_TRIGGER) * PULL_TRIGGER, PULL_MAX));
      clearTimeout(settle);
      settle = setTimeout(() => {
        if (acc >= WHEEL_TRIGGER) fire();
        acc = 0;
        setPull(0);
      }, 200);
    };

    wrap.addEventListener('touchstart', onTouchStart, { passive: true });
    wrap.addEventListener('touchmove', onTouchMove, { passive: true });
    wrap.addEventListener('touchend', onTouchEnd);
    wrap.addEventListener('touchcancel', onTouchEnd);
    wrap.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      clearTimeout(settle);
      wrap.removeEventListener('touchstart', onTouchStart);
      wrap.removeEventListener('touchmove', onTouchMove);
      wrap.removeEventListener('touchend', onTouchEnd);
      wrap.removeEventListener('touchcancel', onTouchEnd);
      wrap.removeEventListener('wheel', onWheel);
    };
  }, []);

  const shown = refreshing || pull > 0;
  return (
    <View ref={wrapRef} style={[style, styles.wrap]}>
      <View
        pointerEvents="none"
        style={[styles.spinner, { opacity: refreshing ? 1 : Math.min(pull / PULL_TRIGGER, 1), transform: [{ translateY: refreshing ? 16 : pull / 2 }] }, !shown && styles.hidden]}
      >
        <ActivityIndicator color={tintColor || colors.primary} animating={shown} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  spinner: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    alignItems: 'center',
  },
  hidden: { display: 'none' },
});
