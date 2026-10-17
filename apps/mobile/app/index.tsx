import { Link } from 'expo-router';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCareer } from '../src/lifecycle/CareerProvider';
import { Button, Card, Row, colors } from '../src/ui';

export default function Home() {
  const career = useCareer();
  const { view } = career;
  const writable = view?.status === 'ready';
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Card title="Synthetic career">
          {!career.ready ? (
            <Text style={{ color: colors.dim }}>Opening storage...</Text>
          ) : view?.status === 'empty' ? (
            <Text style={{ color: colors.dim }}>No career yet. Create a synthetic one to begin.</Text>
          ) : (
            <>
              <Row label="Status" value={view?.status ?? '-'} tone={writable ? 'good' : 'bad'} />
              <Row label="Sim date" value={view?.simDate ?? '-'} />
              <Row label="Revision" value={String(view?.revision ?? '-')} />
              <Row label="Saved revision" value={String(view?.savedRevision ?? '-')} />
            </>
          )}
          {career.error !== null && <Row label="Error" value={career.error} tone="bad" />}
        </Card>
        {view?.status === 'empty' && <Button label="Create synthetic career" disabled={career.busy} onPress={() => void career.create()} />}
        {writable && (
          <>
            <Button label="Advance 1 day" disabled={career.busy} onPress={() => void career.advance(1)} />
            <Button label="Advance 7 days" disabled={career.busy} onPress={() => void career.advance(7)} />
          </>
        )}
        <Button label="Reload from storage" disabled={career.busy || !career.ready} onPress={() => void career.reload()} />
        <Link href="/diagnostics" asChild>
          <Button label="Diagnostics" onPress={() => undefined} />
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}