// Runs the Package C golden scenario inside the Hermes JavaScript engine (standalone CLI).
// Bundled for Hermes by scripts/hermes-golden.mjs --scenario package-c. `print` is Hermes' console.
import {
  PACKAGE_C_EXPECTED,
  diffPackageC,
  runPackageCScenario,
} from '../../packages/sim-core/src/index';

declare const print: (text: string) => void;
declare const HermesInternal:
  { getRuntimeProperties?: () => Record<string, string> } | undefined;

const result = runPackageCScenario();
const diffs = diffPackageC(result, PACKAGE_C_EXPECTED);
const properties =
  typeof HermesInternal !== 'undefined' &&
  HermesInternal !== undefined &&
  HermesInternal.getRuntimeProperties
    ? HermesInternal.getRuntimeProperties()
    : null;

print(
  JSON.stringify({
    engine: properties === null ? 'unknown (no HermesInternal)' : 'hermes',
    runtime: properties,
    match: diffs.length === 0,
    diffs,
    fingerprint: result.fingerprint,
    eventChainHead: result.eventChainHead,
    finalSimDate: result.finalSimDate,
    revision: result.revision,
    eventCount: result.eventCount,
    rngDraws: result.rngDraws,
    keyRecordIds: result.keyRecordIds,
  }),
);
