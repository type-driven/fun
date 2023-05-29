import * as DNT from "https://deno.land/x/dnt@0.21.2/mod.ts";
import { parse } from "https://deno.land/x/semver@v1.4.0/mod.ts";
import { join } from "https://deno.land/std@0.146.0/path/mod.ts";
import * as T from "../async_either.ts";
import * as D from "../decoder.ts";
import * as A from "../array.ts";
import * as E from "../either.ts";
import { flow, pipe } from "../fn.ts";

// Defaults
const gitVersion = await new Deno.Command("git", {
  args: ["describe", "--abbrev=0", "--tags"],
})
  .output()
  .then((out) => new TextDecoder().decode(out.stdout).trim());

const version = parse(gitVersion) ?? parse("0.0.0")!;

const files = Array.from(Deno.readDirSync(Deno.cwd()))
  .filter((file) => file.name.endsWith(".ts"))
  .map((file) => file.name)
  .sort()
  .map((path) => ({
    name: path.replace(".ts", ""),
    path,
  }));

// console.log(files);

const defualts: [string, string][] = [
  ["NAME", "fun"],
  ["DESCRIPTION", "fun"],
  ["VERSION", version.toString()],
  ["BUILD_DIR", "npm"],
  ["ENTRYPOINTS", JSON.stringify(["mod.ts"])],
  ["ADDITIONAL_FILES", JSON.stringify(["README.md", "LICENSE"])],
];

defualts.forEach(([key, value]) => {
  if (!Deno.env.has(key)) {
    Deno.env.set(key, value);
  }
});

// Environment
const semver = pipe(
  D.string,
  D.compose((i) => {
    const semVer = parse(i);
    return semVer === null
      ? D.failure(i, "Semantic Version")
      : D.success(semVer);
  })
);

const Env = D.struct({
  NAME: D.string,
  DESCRIPTION: D.string,
  VERSION: semver,
  BUILD_DIR: D.string,
  ENTRYPOINTS: D.alt(D.json(D.array(D.string)))(
    D.json(D.array(D.struct({ name: D.string, path: D.string })))
  ),
  ADDITIONAL_FILES: D.json(D.array(D.string)),
});

type Env = typeof Env extends D.Decoder<infer I, infer O> ? O : never;

// Errors
type BuildError = { message: string; context: Record<string, unknown> };

const buildError = (
  message: string,
  context: Record<string, unknown> = {}
): BuildError => ({ message, context });

const printBuildError = ({ message, context }: BuildError) => {
  let msg = `BUILD ERROR: ${message}\n`;
  msg += Object.entries(context)
    .map(([key, value]) => {
      const val =
        typeof value === "string"
          ? value
          : value instanceof Error
          ? value
          : typeof value === "object" &&
            value !== null &&
            Object.hasOwn(value, "toString") &&
            typeof value.toString === "function"
          ? value.toString()
          : JSON.stringify(value, null, 2);
      return `Context - ${key}\n${val}`;
    })
    .join("\n");
  return msg;
};

// Functions
const createBuildOptions = ({
  NAME,
  DESCRIPTION,
  BUILD_DIR,
  VERSION,
  ENTRYPOINTS,
}: Env): DNT.BuildOptions => ({
  entryPoints: ENTRYPOINTS.slice(),
  outDir: BUILD_DIR,
  typeCheck: false,
  test: false,
  shims: {
    deno: true,
  },
  package: {
    name: NAME,
    version: VERSION.toString(),
    description: DESCRIPTION,
    license: "MIT",
    publishConfig: {
      "@type-driven:registry": "https://npm.pkg.github.com",
    },
    exports: {
      ".": {
        import: "./esm/mod.js",
        require: "./script/mod.js",
        types: "./types/mod.d.ts",
      },
      "./*": {
        import: "./esm/*.js",
        require: "./script/*.js",
        types: "./types/*.d.ts",
      },
    },
    typesVersions: {
      "<4.7": {
        // Maybe this won't be correct in the future (use "*" to apply for all TS versions)
        "index.d.ts": ["types/mod.d.ts"],
        ...files.reduce((acc, { name }) => {
          acc[`${name}.d.ts`] = [`types/${name}.d.ts`];
          return acc;
        }, <Record<string, string[]>>{}),
      },
    },
  },
});

const getEnv = T.tryCatch(Deno.env.toObject, (err, args) =>
  buildError("Unable to get environment.", { err, args })
)();

const parseEnv = flow(
  Env,
  D.extract,
  E.mapLeft((err) => buildError("Unable to parse environment.", { err })),
  T.fromEither
);

const emptyDir = T.tryCatch(DNT.emptyDir, (err, args) =>
  buildError("Unable to empty build directory.", { err, args })
);

const build = T.tryCatch(DNT.build, (err, args) =>
  buildError("Unable to build node package.", { err, args })
);

const copyFile = T.tryCatch(Deno.copyFile, (err, args) =>
  buildError("Unable to copy file.", { err, args })
);

const traverse = A.traverse(T.MonadAsyncEitherParallel);

const copy = ({ BUILD_DIR, ADDITIONAL_FILES }: Env) =>
  pipe(
    ADDITIONAL_FILES,
    traverse((file) => copyFile(file, join(BUILD_DIR, file)))
  );

const printComplete = (env: Env) =>
  `BUILD COMPLETE
${JSON.stringify(env, null, 2)}`;

export const run = pipe(
  getEnv,
  T.chain(parseEnv),
  T.chainFirst((env) => emptyDir(env.BUILD_DIR)),
  T.chainFirst((env) => build(createBuildOptions(env))),
  T.chainFirst(copy),
  T.match(
    flow(printBuildError, console.error),
    flow(printComplete, console.log)
  )
);

await run();
