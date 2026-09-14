import type { OperationBridge } from "./operation-bridge.ts";
import { createOperatorHumanAuth } from "./human-auth.ts";
import { DEFAULT_SKILLS_ROOT } from "./skill-assets.ts";
import { readFileSync } from "node:fs";

import { ApiV1 } from "./api.ts";
import { parseConfigYaml } from "./config.ts";
import type { ConquistadorConfig } from "./contracts.ts";
import { loadRuntimeCorpus } from "./corpus.ts";
import { createHttpServer, type HttpServerOptions } from "./http.ts";
import type { JudgmentProvider } from "./judgment.ts";
import { createOidcVerifier } from "./oidc.ts";
import { createProvider } from "./providers.ts";
import type { HostAuthenticationVerifier } from "./review-contract.ts";
import {
  createServedJudgmentProvider,
  SERVED_JUDGMENT_BINDING,
} from "./served-judgment.ts";
import {
  DurableServedRuntime,
  type DurableServedRuntimeOptions,
} from "./served-runtime.ts";

export function loadConfigFile(path: string): ConquistadorConfig {
  return parseConfigYaml(readFileSync(path, "utf8"));
}

export type Readiness = Readonly<{
  ready: boolean;
  blockers: readonly string[];
}>;

export function inspectReadiness(
  config: ConquistadorConfig,
  env: Record<string, string | undefined> = process.env,
): Readiness {
  const required = new Set([
    config.models.primary.credentialEnv,
    config.models.fast.credentialEnv,
    config.models.judge.credentialEnv,
  ]);

  if (config.server.auth.mode === "bearer") required.add(config.server.auth.tokenEnv);

  const blockers = [...required]
    .filter((name) => !env[name])
    .sort()
    .map((name) => `missing environment credential: ${name}`);

  return Object.freeze({ ready: blockers.length === 0, blockers: Object.freeze(blockers) });
}

export function buildService(options: {
  config: ConquistadorConfig;
  env?: Record<string, string | undefined>;
  skillsRoot?: string;
  verifyOidc?: HttpServerOptions["verifyOidc"];
  authenticateHumanReview?: HttpServerOptions["authenticateHumanReview"];
  verifyAuthentication?: HostAuthenticationVerifier;
  judgment?: JudgmentProvider;
  operationBridge?: OperationBridge;
}) {
  const readiness = inspectReadiness(options.config, options.env);

  if (!readiness.ready) {
    throw new Error(`[conquistador.service] startup is blocked: ${readiness.blockers.join(", ")}`);
  }

  const env = options.env ?? process.env;
  const humanAuth = createOperatorHumanAuth(env, [
    ...[options.config.models.primary, options.config.models.fast, options.config.models.judge].map((model) => env[model.credentialEnv]),
    options.config.server.auth.mode === "bearer" ? env[options.config.server.auth.tokenEnv] : undefined,
  ].filter((secret): secret is string => Boolean(secret)));
  const provider = createProvider(options.config.models.primary, { env: options.env });

  const corpus = loadRuntimeCorpus(
    options.skillsRoot ?? DEFAULT_SKILLS_ROOT,
  );

  const judgment = options.judgment ??
    createServedJudgmentProvider(
      provider,
      options.config.models.primary,
      SERVED_JUDGMENT_BINDING,
      {
        maximumTokensPerRun: options.config.limits.tokensPerRun,
        timeoutSeconds: options.config.limits.timeoutSeconds,
      },
    );

  const runtimeOptions: DurableServedRuntimeOptions = {
    dataDir: options.config.data.dir,
    instanceId: options.config.instance.id,
    judgment,
    operationBridge: options.operationBridge,
    maximumSessions: options.config.limits.activeSessions,
    maximumQueuedMessages: options.config.limits.queuedMessages,
    maximumTokensPerRun: options.config.limits.tokensPerRun,
  };

  if (options.verifyAuthentication || humanAuth) {
    runtimeOptions.verifyAuthentication = options.verifyAuthentication ?? humanAuth!.verify;
  }

  const runtime = new DurableServedRuntime(runtimeOptions);
  const api = new ApiV1(runtime);

  const ownedOidc = options.config.server.auth.mode === "oidc"
    ? createOidcVerifier(options.config.server.auth)
    : undefined;

  const verifyOidc = options.verifyOidc ?? ownedOidc;

  const httpOptions: HttpServerOptions = {
    api,
    config: options.config,
    env: options.env,
  };

  if (verifyOidc) {
    httpOptions.verifyOidc = verifyOidc;
  }

  if (options.authenticateHumanReview || humanAuth) {
    httpOptions.authenticateHumanReview = options.authenticateHumanReview ?? humanAuth!.authenticate;
  }

  const server = createHttpServer(httpOptions);

  return {
    api,
    corpus,
    runtime,
    server,
    async shutdown(): Promise<void> {
      await runtime.shutdown();

      if (!server.listening) return;
      await new Promise<void>((resolvePromise, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolvePromise();
        });
      });
    },
  };
}
