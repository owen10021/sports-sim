import {
  SYNTHETIC_RULESET,
  SYNTHETIC_SEED,
  entityId,
} from '@sport-sim/sim-core';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { ExpoSqliteDatabase } from '../persistence/expoSqliteDatabase';
import { SqliteCareerStore } from '../persistence/sqliteCareerStore';
import { platformIdSource } from '../platform/idSource';
import { CareerLifecycle, type CareerView } from './careerLifecycle';

export interface CareerApi {
  readonly ready: boolean;
  readonly busy: boolean;
  readonly error: string | null;
  readonly view: CareerView | null;
  readonly lifecycle: CareerLifecycle | null;
  create(): Promise<void>;
  advance(days: number): Promise<void>;
  reload(): Promise<void>;
}

const CareerContext = createContext<CareerApi | null>(null);

export const useCareer = (): CareerApi => {
  const api = useContext(CareerContext);
  if (api === null)
    throw new Error('useCareer must be used inside <CareerProvider>');
  return api;
};

/** Owns the single CareerLifecycle for the app and forwards AppState changes to it. */
export function CareerProvider({ children }: { children: ReactNode }) {
  const lifeRef = useRef<CareerLifecycle | null>(null);
  const [view, setView] = useState<CareerView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guarded = useCallback(
    async (work: (life: CareerLifecycle) => Promise<void>) => {
      const life = lifeRef.current;
      if (life === null) return;
      setBusy(true);
      setError(null);
      try {
        await work(life);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setView(life.view());
        setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const db = await ExpoSqliteDatabase.open('sport-sim.db');
        const life = new CareerLifecycle({
          store: new SqliteCareerStore(db),
          ruleset: SYNTHETIC_RULESET,
          seed: SYNTHETIC_SEED,
          idSource: platformIdSource,
          actor: { kind: 'human_gm', id: entityId('local-gm') },
        });
        await life.open();
        if (cancelled) return;
        lifeRef.current = life;
        setView(life.view());
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    const subscription = AppState.addEventListener('change', (state) => {
      const life = lifeRef.current;
      if (life === null) return;
      if (
        state === 'active' ||
        state === 'inactive' ||
        state === 'background'
      ) {
        void life.handleLifecycle(state).then(() => setView(life.view()));
      }
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const api = useMemo<CareerApi>(
    () => ({
      ready: view !== null,
      busy,
      error,
      view,
      // eslint-disable-next-line react-hooks/refs -- lifecycle is created once in an effect; the memo is recomputed whenever `view` changes, which follows every lifecycle change.
      lifecycle: lifeRef.current,
      create: () => guarded((life) => life.createCareer()),
      advance: (days: number) =>
        guarded(async (life) => {
          const result = await life.advance(days);
          if (!result.ok) throw new Error(`Rejected: ${result.rejection.code}`);
          if (!result.saved)
            throw new Error(
              `Committed but not saved yet: ${result.saveError ?? 'unknown'}`,
            );
        }),
      reload: () => guarded(async (life) => void (await life.open())),
    }),
    [view, busy, error, guarded],
  );

  // eslint-disable-next-line react-hooks/refs -- `api` is the memo above; the ref read is intentional (see the note there).
  return (
    <CareerContext.Provider value={api}>{children}</CareerContext.Provider>
  );
}
