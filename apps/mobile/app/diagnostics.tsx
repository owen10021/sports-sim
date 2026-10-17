import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  summarizeContract,
  verifySavedCareer,
  verifySavedReplay,
  type DiagnosticLine,
} from '../src/diagnostics/careerDiagnostics';
import { runGoldenOnDevice, type GoldenDiagnostics } from '../src/diagnostics/goldenDiagnostics';
import { useCareer } from '../src/lifecycle/CareerProvider';
import { runRecoveryContractOnDevice, runSqliteContractOnDevice } from '../src/persistence/runtimeContract';
import { Button, Card, Row, colors } from '../src/ui';

const tone = (line: DiagnosticLine | null) => (line === null ? undefined : line.ok ? ('good' as const) : ('bad' as const));
const text = (line: DiagnosticLine | null) => line?.text ?? 'not run';

export default function Diagnostics() {
  const { view, lifecycle } = useCareer();
  const [save, setSave] = useState<DiagnosticLine | null>(null);
  const [replay, setReplay] = useState<DiagnosticLine | null>(null);
  const [sqlite, setSqlite] = useState<DiagnosticLine | null>(null);
  const [recovery, setRecovery] = useState<DiagnosticLine | null>(null);
  const [golden, setGolden] = useState<GoldenDiagnostics | null>(null);
  const [goldenError, setGoldenError] = useState<DiagnosticLine | null>(null);
  const [running, setRunning] = useState(false);

  const verify = useCallback(async () => {
    if (lifecycle === null) return;
    await lifecycle.flush().catch(() => undefined);
    setSave(await verifySavedCareer(lifecycle));
    setReplay(await verifySavedReplay(lifecycle));
  }, [lifecycle]);

  useEffect(() => {
    void verify();
  }, [verify]);

  const runContracts = async () => {
    setRunning(true);
    try {
      setSqlite(summarizeContract(await runSqliteContractOnDevice()));
      setRecovery(summarizeContract(await runRecoveryContractOnDevice()));
    } finally {
      setRunning(false);
    }
  };

  const runGolden = async () => {
    setRunning(true);
    try {
      setGoldenError(null);
      setGolden(await runGoldenOnDevice());
    } catch (e) {
      setGolden(null);
      setGoldenError({ ok: false, text: `ERROR: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setRunning(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Card title="Career">
          <Row label="World ID" value={view?.worldId ?? '-'} />
          <Row label="Sim date" value={view?.simDate ?? '-'} />
          <Row label="Revision" value={String(view?.revision ?? '-')} />
          <Row label="Events" value={String(view?.eventCount ?? '-')} />
          <Row label="Fingerprint" value={view?.fingerprint ?? '-'} />
          <Row label="Event-chain head" value={view?.chainHead ?? '-'} />
          <Row label="Pending saves" value={String(view?.pendingCommits ?? '-')} />
          {view?.recovery != null && <Row label="Last recovery" value={`${view.recovery.action}: ${view.recovery.reasons.join('; ')}`} tone="bad" />}
        </Card>
        <Card title="Save verification">
          <Row label="Stored career" value={text(save)} tone={tone(save)} />
        </Card>
        <Card title="Replay verification">
          <Row label="Full-history replay" value={text(replay)} tone={tone(replay)} />
        </Card>
        <Card title="SQLite contract (on this runtime)">
          <Row label="CareerStore contract" value={text(sqlite)} tone={tone(sqlite)} />
          <Row label="Recovery + repair contract" value={text(recovery)} tone={tone(recovery)} />
        </Card>
        <Card title="Golden scenario (cross-runtime)">
          <Row label="Kernel vs Node" value={text(golden?.kernel ?? goldenError)} tone={tone(golden?.kernel ?? goldenError)} />
          <Row label="SQLite round trip" value={text(golden?.store ?? null)} tone={tone(golden?.store ?? null)} />
          <Row label="Fingerprint" value={golden?.fingerprint ?? '-'} />
          <Row label="Event-chain head" value={golden?.chainHead ?? '-'} />
        </Card>
        <Button label="Run golden scenario" disabled={running} onPress={() => void runGolden()} />
        <Button label="Re-verify saved career" disabled={running} onPress={() => void verify()} />
        <Button label={running ? 'Running...' : 'Run SQLite contracts'} disabled={running} onPress={() => void runContracts()} />
        <Text style={{ color: colors.dim, marginTop: 12 }}>
          Runs against the real expo-sqlite engine in this app runtime.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}