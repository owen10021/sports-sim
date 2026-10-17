import { runCli } from './cli';

runCli(process.argv.slice(2), {
  out: (line) => console.log(line),
  err: (line) => console.error(line),
}).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(
      error instanceof Error ? (error.stack ?? error.message) : String(error),
    );
    process.exit(3);
  },
);
