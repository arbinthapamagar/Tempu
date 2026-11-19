import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';
import { fonts } from '../theme/type';

// Row of one-digit boxes for an SMS code. Controlled: `digits` is an array of
// single characters ('' when empty).
//
// Typing into a box that already holds a digit hands onChangeText both
// characters (the old one and the new one, in either order depending on the
// cursor). That used to be treated as a paste and dropped, and pasting a full
// code into a filled box shifted it by one. Both cases are resolved here.
function OtpInput({ digits, onChange, error, length = digits.length }, ref) {
  const refs = useRef([]);

  useImperativeHandle(ref, () => ({
    focus: (i = 0) => refs.current[i]?.focus(),
  }));

  const setFrom = (index, chars) => {
    const next = [...digits];
    for (let k = 0; k < chars.length && index + k < length; k++) next[index + k] = chars[k];
    onChange(next);
    const last = Math.min(index + chars.length, length - 1);
    refs.current[last]?.focus();
  };

  const handleText = (raw, index) => {
    let v = raw.replace(/\D/g, '');
    const old = digits[index];

    if (v.length <= 1) {
      const next = [...digits];
      next[index] = v;
      onChange(next);
      if (v) refs.current[index + 1]?.focus();
      return;
    }

    // The previous digit is still in the field: strip it from whichever end.
    if (old && v.length === 2) {
      v = v.startsWith(old) ? v.slice(1) : v.slice(0, 1);
      const next = [...digits];
      next[index] = v;
      onChange(next);
      refs.current[index + 1]?.focus();
      return;
    }
    if (old && v.length === length + 1) {
      // The cursor normally sits after the old digit, so the paste follows it.
      v = v.startsWith(old) ? v.slice(1) : v.slice(0, length);
    }

    // A paste: a whole code fills from the first box; a partial one fills
    // forward from this box.
    if (v.length >= length) setFrom(0, v.slice(0, length).split(''));
    else setFrom(index, v.split(''));
  };

  const handleKey = (key, index) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      onChange(next);
      refs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.row}>
      {digits.map((d, i) => (
        <TextInput
          key={i}
          ref={(r) => (refs.current[i] = r)}
          value={d}
          onChangeText={(v) => handleText(v, i)}
          onKeyPress={({ nativeEvent }) => handleKey(nativeEvent.key, i)}
          style={[styles.box, d && styles.boxFilled, error && styles.boxError]}
          keyboardType="number-pad"
          maxLength={length + 1}
          selectTextOnFocus
          textContentType="oneTimeCode"
          autoComplete={i === 0 ? 'sms-otp' : 'off'}
          accessibilityLabel={`Digit ${i + 1}`}
        />
      ))}
    </View>
  );
}

export default forwardRef(OtpInput);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 24,
  },
  box: {
    flex: 1,
    // On web each box is an <input>, which has a ~150px intrinsic width that
    // flex won't shrink below without these — six of them overflowed the screen.
    flexBasis: 0,
    minWidth: 0,
    width: 0,
    maxWidth: 56,
    aspectRatio: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontFamily: fonts.displayBold,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  boxFilled: {
    borderColor: colors.primary,
  },
  boxError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
});
