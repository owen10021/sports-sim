import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  summarizeContract,
  verifySavedCareer,
  verifySavedReplay,
  type DiagnosticLine,
} from '../src/diagnostics/careerDiagnostics';
import {
  runGoldenOnDevice,
  runPackageBOnDevice,
  runPackageCOnDevice,
  runPackageDOnDevice,
  type GoldenDiagnostics,
  type PackageBDiagnostics,
  type PackageCDiagnostics,
  type PackageDDiagnostics,
} from '../src/diagnostics/goldenDiagnostics';
import { useCareer } from '../src/lifecycle/CareerProvider';
import {
  runRecoveryContractOnDevice,
  runSqliteContractOnDevice,
} from '../src/persistence/runtimeContract';
import { Button, Card, Row, colors } from '../src/ui';

const tone = (line: DiagnosticLine | null) =>
  line === null ? undefined : line.ok ? ('good' as const) : ('bad' as const);
const text = (line: DiagnosticLine | null) => line?.text ?? 'not run';

export default function Diagnostics() {
  const { view, lifecycle } = useCareer();
  const [save, setSave] = useState<DiagnosticLine | null>(null);
  const [replay, setReplay] = useState<DiagnosticLine | null>(null);
  const [sqlite, setSqlite] = useState<DiagnosticLine | null>(null);
  const [recovery, setRecovery] = useState<DiagnosticLine | null>(null);
  const [golden, setGolden] = useState<GoldenDiagnostics | null>(null);
  const [goldenError, setGoldenError] = useState<DiagnosticLine | null>(null);
  const [packageB, setPackageB] = useState<PackageBDiagnostics | null>(null);
  const [packageBError, setPackageBError] = useState<DiagnosticLine | null>(
    null,
  );
  const [packageC, setPackageC] = useState<PackageCDiagnostics | null>(null);
  const [packageCError, setPackageCError] = useState<DiagnosticLine | null>(
    null,
  );
  const [packageD, setPackageD] = useState<PackageDDiagnostics | null>(null);
  const [packageDError, setPackageDError] = useState<DiagnosticLine | null>(
    null,
  );
  const [running, setRunning] = useState(false);

  const verify = useCallback(async () => {
    if (lifecycle === null) return;
    await lifecycle.flush().catch(() => undefined);
    setSave(await verifySavedCareer(lifecycle));
    setReplay(await verifySavedReplay(lifecycle));
  }, [lifecycle]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- verify() is async; state is set after awaiting storage, not synchronously.
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
      setGoldenError({
        ok: false,
        text: `ERROR: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setRunning(false);
    }
  };

  const runPackageB = async () => {
    setRunning(true);
    try {
      setPackageBError(null);
      setPackageB(await runPackageBOnDevice());
    } catch (e) {
      setPackageB(null);
      setPackageBError({
        ok: false,
        text: `ERROR: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setRunning(false);
    }
  };

  const runPackageC = async () => {
    setRunning(true);
    try {
      setPackageCError(null);
      setPackageC(await runPackageCOnDevice());
    } catch (e) {
      setPackageC(null);
      setPackageCError({
        ok: false,
        text: `ERROR: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setRunning(false);
    }
  };

  const runPackageD = async () => {
    setRunning(true);
    try {
      setPackageDError(null);
      setPackageD(await runPackageDOnDevice());
    } catch (e) {
      setPackageD(null);
      setPackageDError({
        ok: false,
        text: `ERROR: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={['bottom', 'left', 'right']}
    >
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Card title="Career">
          <Row label="World ID" value={view?.worldId ?? '-'} />
          <Row label="Sim date" value={view?.simDate ?? '-'} />
          <Row label="Revision" value={String(view?.revision ?? '-')} />
          <Row label="Events" value={String(view?.eventCount ?? '-')} />
          <Row label="Fingerprint" value={view?.fingerprint ?? '-'} />
          <Row label="Event-chain head" value={view?.chainHead ?? '-'} />
          <Row
            label="Pending saves"
            value={String(view?.pendingCommits ?? '-')}
          />
          {view?.recovery != null && (
            <Row
              label="Last recovery"
              value={`${view.recovery.action}: ${view.recovery.reasons.join('; ')}`}
              tone="bad"
            />
          )}
        </Card>
        <Card title="Save verification">
          <Row label="Stored career" value={text(save)} tone={tone(save)} />
        </Card>
        <Card title="Replay verification">
          <Row
            label="Full-history replay"
            value={text(replay)}
            tone={tone(replay)}
          />
        </Card>
        <Card title="SQLite contract (on this runtime)">
          <Row
            label="CareerStore contract"
            value={text(sqlite)}
            tone={tone(sqlite)}
          />
          <Row
            label="Recovery + repair contract"
            value={text(recovery)}
            tone={tone(recovery)}
          />
        </Card>
        <Card title="Golden scenario (cross-runtime)">
          <Row
            label="Kernel vs Node"
            value={text(golden?.kernel ?? goldenError)}
            tone={tone(golden?.kernel ?? goldenError)}
          />
          <Row
            label="SQLite round trip"
            value={text(golden?.store ?? null)}
            tone={tone(golden?.store ?? null)}
          />
          <Row label="Fingerprint" value={golden?.fingerprint ?? '-'} />
          <Row label="Event-chain head" value={golden?.chainHead ?? '-'} />
        </Card>
        <Card title="Package B scenario (organizations)">
          <Row
            label="Kernel vs Node"
            value={text(packageB?.kernel ?? packageBError)}
            tone={tone(packageB?.kernel ?? packageBError)}
          />
          <Row
            label="SQLite round trip"
            value={text(packageB?.store ?? null)}
            tone={tone(packageB?.store ?? null)}
          />
          <Row label="Fingerprint" value={packageB?.fingerprint ?? '-'} />
          <Row label="Event-chain head" value={packageB?.chainHead ?? '-'} />
        </Card>
        <Card title="Package D scenario (development + medical)">
          <Row
            label="Kernel vs Node/Hermes"
            value={text(packageD?.kernel ?? packageDError)}
            tone={tone(packageD?.kernel ?? packageDError)}
          />
          <Row
            label="SQLite round trip"
            value={text(packageD?.store ?? null)}
            tone={tone(packageD?.store ?? null)}
          />
          <Row label="Fingerprint" value={packageD?.fingerprint ?? '-'} />
          <Row label="Event-chain head" value={packageD?.chainHead ?? '-'} />
          <Row label="RNG draws" value={String(packageD?.rngDraws ?? '-')} />
        </Card>
        <Card title="Package C scenario (GM acquisition)">
          <Row
            label="Kernel vs Node"
            value={text(packageC?.kernel ?? packageCError)}
            tone={tone(packageC?.kernel ?? packageCError)}
          />
          <Row
            label="SQLite round trip"
            value={text(packageC?.store ?? null)}
            tone={tone(packageC?.store ?? null)}
          />
          <Row label="Fingerprint" value={packageC?.fingerprint ?? '-'} />
          <Row label="Event-chain head" value={packageC?.chainHead ?? '-'} />
        </Card>
        <Button
          label="Run Package D scenario"
          disabled={running}
          onPress={() => void runPackageD()}
        />
        <Button
          label="Run Package C scenario"
          disabled={running}
          onPress={() => void runPackageC()}
        />
        <Button
          label="Run Package B scenario"
          disabled={running}
          onPress={() => void runPackageB()}
        />
        <Button
          label="Run golden scenario"
          disabled={running}
          onPress={() => void runGolden()}
        />
        <Button
          label="Re-verify saved career"
          disabled={running}
          onPress={() => void verify()}
        />
        <Button
          label={running ? 'Running...' : 'Run SQLite contracts'}
          disabled={running}
          onPress={() => void runContracts()}
        />
        <Text style={{ color: colors.dim, marginTop: 12 }}>
          Runs against the real expo-sqlite engine in this app runtime.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
