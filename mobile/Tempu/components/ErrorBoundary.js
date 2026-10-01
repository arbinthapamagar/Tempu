import { Component } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { reloadApp } from '../theme/reload';

// Without this, one render error anywhere unmounts the whole tree and the app
// is just a blank white screen. Shows what broke and offers a reload instead.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Something went wrong</Text>
        <ScrollView style={styles.box}>
          <Text style={styles.msg}>{String(error?.message || error)}</Text>
        </ScrollView>
        <Pressable style={styles.btn} onPress={() => (this.setState({ error: null }), reloadApp())}>
          <Text style={styles.btnText}>Reload app</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff', padding: 24, justifyContent: 'center', gap: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#000000' },
  box: { maxHeight: 200, backgroundColor: '#f4f4f4', borderRadius: 12, padding: 12 },
  msg: { fontFamily: 'monospace', fontSize: 12, color: '#b00020' },
  btn: { backgroundColor: '#000000', borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  btnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
});
