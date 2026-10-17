import { StyleSheet, Text, View } from 'react-native';

// Task 1 shell only. The create/load career flow arrives in Task 11.
export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sport Sim</Text>
      <Text style={styles.sub}>Package A foundation shell</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  sub: { marginTop: 8, fontSize: 15, opacity: 0.7 },
});
