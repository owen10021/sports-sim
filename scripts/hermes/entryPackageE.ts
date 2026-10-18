// Runs the Package E golden scenario inside the Hermes JavaScript engine (standalone CLI).
// Bundled for Hermes by scripts/hermes-golden.mjs --scenario package-e. `print` is Hermes' console.
import {
  PACKAGE_E_EXPECTED,
  diffPackageE,
  runPackageEScenario,
} from '../../packages/sim-core/src/index';

declare const print: (text: string) => void;
declare const HermesInternal:
  { getRuntimeProperties?: () => Record<string, string> } | undefined;

const result = runPackageEScenario();
const diffs = diffPackageE(result, PACKAGE_E_EXPECTED);
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
    rngState: result.rngState,
    game: result.game,
    keyRecordIds: result.keyRecordIds,
  }),
);
