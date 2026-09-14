import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { sha256 } from "../src/canonical.ts";
import {
  createActionGateRecord,
  createReviewPacket,
  validatePlaybookReviewPacket,
} from "../src/gates.ts";
import {
  type AuthenticationProof,
  authorizationSubjectDigest,
  type QualifiedReviewVerdictV1,
  qualifyReviewVerdict,
  renderReviewPacketText,
  REVIEW_CONTRACT_VERSION,
  type ReviewPacketV1,
  ReviewTransitionState,
  seal,
  validateActionAuthorization,
  validateLearning,
  validateObservation,
  validateReceipt,
  validateReviewPacket,
  validateVerdict,
  verdictSubjectDigest,
} from "../src/review-contract.ts";
import {
  REVIEW_EVENT_VERSION,
  validateReviewEvent,
  validateReviewEventStream,
} from "../src/review-events.ts";
import {
  buildReviewEventFixture,
  buildReviewPacketFixture,
} from "../fixtures/review-contract-fixture.ts";
const t0 = "2026-08-21T00:00:00.000Z",
  t1 = "2026-08-21T00:01:00.000Z",
  t2 = "2026-08-21T00:02:00.000Z",
  t3 = "2026-08-21T00:03:00.000Z",
  t4 = "2026-08-21T00:04:00.000Z",
  t5 = "2026-08-21T00:05:00.000Z",
  expiry = "2026-08-21T01:00:00.000Z";
const proof = (
  role: "reviewer" | "operator",
  authority: string,
  subjectDigest: `sha256:${string}`,
  principalId = role === "reviewer" ? "fixture-reviewer" : "fixture-operator",
): AuthenticationProof => {
  const b = {
    principalId,
    role,
    method: "deterministic-fixture",
    verifier: "implementation-test-only",
    verifiedAt: role === "reviewer" ? t1 : t2,
    authority,
    subjectDigest,
  };
  return { ...b, proofDigest: sha256(b) };
};
const verify = (p: AuthenticationProof, c: any) =>
    p.verifier === "implementation-test-only" &&
    p.principalId ===
      (c.role === "reviewer" ? "fixture-reviewer" : "fixture-operator") &&
    p.role === c.role && p.authority === c.authority &&
    p.proofDigest ===
      sha256({
        principalId: p.principalId,
        role: p.role,
        method: p.method,
        verifier: p.verifier,
        verifiedAt: p.verifiedAt,
        authority: p.authority,
        subjectDigest: p.subjectDigest,
      }) &&
    p.subjectDigest === c.subjectDigest,
  ctx = (now = t2) => ({ now, verifyAuthentication: verify });
const artifact = {
  artifactId: "artifact-1",
  revision: 1,
  digest: sha256("artifact"),
  state: "finished" as const,
};
function packet(): ReviewPacketV1 {
  return buildReviewPacketFixture({
    artifactDigest: artifact.digest,
    artifactBody: "Fixture work.",
    unresolvedLimitations: ["No real output."],
  });
}
function reviewEvents(p = packet()) {
  return buildReviewEventFixture(p);
}
function verdict(
  outcome: any = "accept",
  principalId = "fixture-reviewer",
): any {
  const p = packet();
  const basis = {
    schemaVersion: REVIEW_CONTRACT_VERSION,
    kind: "review-verdict",
    verdictId: `verdict-${outcome}`,
    outcome,
    packetId: p.packetId,
    packetDigest: p.digest,
    artifactId: artifact.artifactId,
    artifactRevision: 1,
    artifactDigest: artifact.digest,
    actionPayloadDigest: p.actionProposal!.payloadDigest,
    sessionId: "session-1",
    runId: "run-1",
    candidateId: null,
    evidenceId: null,
    decidedAt: t1,
    expiryPolicy: "expires",
    expiresAt: expiry,
    singleUse: true,
  } as const;
  const subjectDigest = verdictSubjectDigest(p, basis);
  return seal({
    ...basis,
    authentication: proof(
      "reviewer",
      "content-review",
      subjectDigest,
      principalId,
    ),
  });
}
function authorization(): any {
  const p = packet(), v = verdict();
  const basis = {
    schemaVersion: REVIEW_CONTRACT_VERSION,
    kind: "action-authorization",
    authorizationId: "auth-1",
    verdictId: v.verdictId,
    verdictDigest: v.digest,
    packetId: p.packetId,
    packetDigest: p.digest,
    sessionId: "session-1",
    runId: "run-1",
    candidateId: null,
    artifact,
    allowed: {
      authority: "provider.fixture",
      operation: "draft",
      connectionRef: "connection.fixture",
      payloadDigest: p.actionProposal!.payloadDigest,
    },
    authorizedAt: t2,
    expiresAt: expiry,
    singleUse: true,
  } as const;
  const subjectDigest = authorizationSubjectDigest(basis);
  return seal({
    ...basis,
    authentication: proof("operator", "consequential-action", subjectDigest),
  });
}
function receipt(): any {
  const a = authorization();
  return seal({
    schemaVersion: REVIEW_CONTRACT_VERSION,
    kind: "action-receipt",
    receiptId: "receipt-1",
    authorizationId: a.authorizationId,
    authorizationDigest: a.digest,
    sessionId: "session-1",
    runId: "run-1",
    candidateId: null,
    artifact,
    authority: a.allowed.authority,
    operation: a.allowed.operation,
    connectionRef: a.allowed.connectionRef,
    payloadDigest: a.allowed.payloadDigest,
    status: "succeeded",
    startedAt: t3,
    finishedAt: t3,
    redactionApplied: true,
    terminal: true,
  });
}
describe("closed review authority", () => {
  it("exports no bare-string review or action authorization helper", () => {
    const legacyPacket = createReviewPacket({
      runId: "run-1",
      gateId: "review-gate",
      requestedOutcome: "fixture",
      deliverables: [{
        kind: "artifact",
        content: "artifacts/fixture.md",
        digest: sha256("fixture file"),
      }],
      boundArtifacts: [{
        artifactId: "fixture-artifact",
        path: "artifacts/fixture.md",
        contentDigest: sha256("fixture content"),
      }],
      actionProposals: [],
      createdAt: t0,
    });
    expect(() =>
      validatePlaybookReviewPacket({
        ...legacyPacket,
        outcome: "accept",
        decidedAt: t1,
      })
    ).toThrow(/undeclared field/);
    expect(() =>
      (createActionGateRecord as any)({
        runId: "run-1",
        gateId: "action-gate",
        afterGate: "review-gate",
        mutationClass: "draft",
        packet: { ...legacyPacket, outcome: "accept", decidedAt: t1 },
        operationId: "fixture.operation",
        createdAt: t2,
      })
    ).toThrow();
  });
  it("deep clones and freezes nested values", () => {
    const input: any = structuredClone(packet());
    delete input.digest;
    const sealed: any = seal(input);
    input.actionProposal.payload.items[0] = 99;
    expect(sealed.actionProposal.payload.items[0]).toBe(1);
    expect(Object.isFrozen(sealed.actionProposal.payload.items)).toBe(true);
    expect(() => {
      sealed.actionProposal.payload.items[0] = 9;
    }).toThrow();
  });
  it("renders network-free text", () =>
    expect(renderReviewPacketText(packet())).toContain(
      "Human verdict: pending",
    ));
  it("records typed optional review evidence with no decision authority", () => {
    const p = packet(), events = reviewEvents(p);
    expect(() => validateReviewEventStream(events, p)).not.toThrow();
    expect(events.map((event) => event.eventType)).toEqual([
      "packet.presented",
      "annotation.created",
      "suggestion.created",
      "companion.failed",
    ]);
    for (const event of events) {
      expect(event.schemaVersion).toBe(REVIEW_EVENT_VERSION);
      expect(Object.values(event.authority).every((value) => value === false))
        .toBe(true);
      expect(event.packetDigest).toBe(p.digest);
      expect(event.artifact).toEqual(p.artifact);
    }
    expect(events.at(-1)).toMatchObject({
      payload: {
        fallback: "plain-text",
        canonicalReviewAvailable: true,
        hostVerdictRequired: true,
      },
    });
  });
  it("rejects review event escalation, wrong bindings, bad payloads, and secrets", () => {
    const p = packet(), events = reviewEvents(p);
    const mutateEvent = (index: number, change: (event: any) => void) => {
      const event: any = structuredClone(events[index]);
      delete event.digest;
      change(event);
      return seal(event);
    };
    expect(() =>
      validateReviewEvent(
        mutateEvent(1, (event) => event.authority.accept = true),
        p,
      )
    ).toThrow(/authority must be none/);
    expect(() =>
      validateReviewEvent(
        mutateEvent(1, (event) => event.packetId = "other-packet"),
        p,
      )
    ).toThrow(/packet mismatch/);
    expect(() =>
      validateReviewEvent(
        mutateEvent(1, (event) => event.artifact.digest = sha256("other")),
        p,
      )
    ).toThrow(/artifact mismatch/);
    expect(() =>
      validateReviewEvent(
        mutateEvent(2, (event) => event.payload.extra = true),
        p,
      )
    ).toThrow(/payload fields are not closed/);
    expect(() =>
      validateReviewEvent(
        mutateEvent(1, (event) => event.actor = { kind: "system", id: null }),
        p,
      )
    ).toThrow(/human or agent actor/);
    expect(() =>
      validateReviewEvent(
        mutateEvent(3, (event) => event.payload.fallback = "blocked"),
        p,
      )
    ).toThrow(/fall back to plain text/);
    expect(() =>
      validateReviewEvent(
        mutateEvent(1, (event) => event.payload.body = "api_key=abcdefghijk"),
        p,
      )
    ).toThrow(/secret material/);
    expect(() =>
      validateReviewEvent(
        mutateEvent(1, (event) => event.extra = true),
        p,
      )
    ).toThrow(/fields are not closed/);
  });
  it("requires a contiguous stream starting with canonical host plain text", () => {
    const p = packet(), events = reviewEvents(p);
    expect(() => validateReviewEventStream(events.slice(1), p)).toThrow(
      /sequence|canonical host plain text/,
    );
    const gap = events.map((event) => structuredClone(event));
    gap[1] = (() => {
      const event: any = gap[1];
      delete event.digest;
      event.sequence = 3;
      return seal(event);
    })();
    expect(() => validateReviewEventStream(gap, p)).toThrow(/contiguous/);
    const backwards = events.map((event) => structuredClone(event));
    backwards[2] = (() => {
      const event: any = backwards[2];
      delete event.digest;
      event.createdAt = t0;
      return seal(event);
    })();
    expect(() => validateReviewEventStream(backwards, p)).toThrow(
      /stream chronology/,
    );
    const wrongDigest: any = structuredClone(events[0]);
    delete wrongDigest.digest;
    wrongDigest.payload.presentationDigest = sha256("different text");
    expect(() => validateReviewEventStream([seal(wrongDigest)], p)).toThrow(
      /presentation digest does not bind canonical packet text/,
    );
    const unsupportedFormat: any = structuredClone(events[0]);
    delete unsupportedFormat.digest;
    unsupportedFormat.payload.format = "markdown";
    expect(() => validateReviewEvent(seal(unsupportedFormat), p)).toThrow(
      /format invalid/,
    );
  });
  it.each(["accept", "revise", "reject", "cancel"])(
    "validates %s",
    (o) =>
      expect(() => validateVerdict(verdict(o), packet(), ctx())).not.toThrow(),
  );
  it("rejects a friendly model identity without host attestation", () =>
    expect(() =>
      validateVerdict(
        verdict("accept", "friendly-reviewer"),
        packet(),
        ctx(),
      )
    ).toThrow(/host authentication/));
  it("consumes verdict and authorization once across calls", () => {
    const p = packet(),
      v = verdict(),
      a = authorization(),
      r = receipt(),
      s = new ReviewTransitionState();
    s.authorize(a, p, v, ctx());
    expect(() => s.authorize(a, p, v, ctx())).toThrow(/already consumed/);
    s.recordReceipt(r, a);
    expect(() => s.recordReceipt(r, a)).toThrow(/already consumed/);
  });
  it("binds attestations to subjects and preserves consumption after rehydration", () => {
    const p = packet();
    const original = verdict();
    const copiedProof: any = structuredClone(original);
    delete copiedProof.digest;
    copiedProof.verdictId = "fresh-verdict-id";
    expect(() => validateVerdict(seal(copiedProof), p, ctx())).toThrow(
      /authentication subject mismatch/,
    );

    const authorizationRecord = authorization();
    const first = new ReviewTransitionState();
    first.authorize(authorizationRecord, p, original, ctx());
    const rehydrated = new ReviewTransitionState(first.snapshot());
    const conflicting: any = structuredClone(original);
    delete conflicting.digest;
    conflicting.verdictId = "conflicting-verdict-id";
    conflicting.authentication = proof(
      "reviewer",
      "content-review",
      verdictSubjectDigest(p, conflicting),
    );
    expect(() => rehydrated.consumeVerdict(p, seal(conflicting), ctx()))
      .toThrow(/already consumed|terminal verdict/);
    const receiptRecord = receipt();
    first.recordReceipt(receiptRecord, authorizationRecord);
    const receiptRehydrated = new ReviewTransitionState(first.snapshot());
    expect(() =>
      receiptRehydrated.recordReceipt(receiptRecord, authorizationRecord)
    ).toThrow(/already consumed/);
  });
  it("validates receipt, unknown observation and learning chronology", () => {
    const a = authorization(), r = receipt();
    validateReceipt(r, a);
    const o = seal({
      schemaVersion: REVIEW_CONTRACT_VERSION,
      kind: "result-observation",
      observationId: "obs-1",
      receiptId: r.receiptId,
      receiptDigest: r.digest,
      status: "unknown",
      measures: null,
      observedAt: t4,
    });
    validateObservation(o, r);
    const l = seal({
      schemaVersion: REVIEW_CONTRACT_VERSION,
      kind: "learning-record",
      learningId: "learn-1",
      observationId: o.observationId,
      observationDigest: o.digest,
      status: "unknown",
      claim: null,
      createdAt: t5,
    });
    validateLearning(l, o);
  });
  it("aligns every runtime kind with the closed JSON Schema", () => {
    const schema = JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, "../schemas/review-contract.schema.json"),
        "utf8",
      ),
    );
    const credentialSchema = JSON.parse(
      readFileSync(
        resolve(
          import.meta.dirname,
          "../schemas/credential-detector.schema.json",
        ),
        "utf8",
      ),
    );
    const ajv = new Ajv2020({
        strict: false,
        formats: { "date-time": true },
      });
    ajv.addSchema(credentialSchema);
    const
      check = ajv.compile(schema),
      p = packet(),
      v = verdict(),
      a = authorization(),
      r = receipt(),
      o = seal({
        schemaVersion: REVIEW_CONTRACT_VERSION,
        kind: "result-observation",
        observationId: "obs-1",
        receiptId: r.receiptId,
        receiptDigest: r.digest,
        status: "unknown",
        measures: null,
        observedAt: t4,
      }),
      l = seal({
        schemaVersion: REVIEW_CONTRACT_VERSION,
        kind: "learning-record",
        learningId: "learn-1",
        observationId: o.observationId,
        observationDigest: o.digest,
        status: "unknown",
        claim: null,
        createdAt: t5,
      });
    const events = reviewEvents(p);
    for (const record of [p, ...events, v, a, r, o, l]) {
      expect(check(record), JSON.stringify(check.errors)).toBe(true);
    }
    const mutate = (record: any, change: (value: any) => void) => {
      const value = structuredClone(record);
      delete value.digest;
      change(value);
      return seal(value);
    };
    for (const credential of [
      "sk-abcdefghijklmnop",
      "github_pat_11aa22bb33cc44dd55ee",
      "ghp_1234567890abcdefghij",
    ]) {
      const event = mutate(events[1], (candidate) => {
        candidate.payload.body = credential;
      });
      expect(() => validateReviewEvent(event, p)).toThrow(/secret material/);
      expect(check(event), JSON.stringify(check.errors)).toBe(false);

      const identifier = mutate(p, (candidate) => {
        candidate.packetId = credential;
      });
      expect(() => validateReviewPacket(identifier)).toThrow(
        /credentials|secret material/,
      );
      expect(check(identifier), JSON.stringify(check.errors)).toBe(false);

      const prose = mutate(p, (candidate) => {
        candidate.strategicBet = `Bound prose ${credential}`;
      });
      expect(() => validateReviewPacket(prose)).toThrow(/secret material/);
      expect(check(prose), JSON.stringify(check.errors)).toBe(false);

      const authenticated = mutate(v, (candidate) => {
        candidate.authentication.method = credential;
      });
      expect(() => validateVerdict(authenticated, p, ctx())).toThrow(
        /credentials|secret material/,
      );
      expect(check(authenticated), JSON.stringify(check.errors)).toBe(false);

      const nestedPayload = mutate(p, (candidate) => {
        candidate.actionProposal.payload = {
          nested: { credential },
        };
        candidate.actionProposal.payloadDigest = sha256(
          candidate.actionProposal.payload,
        );
      });
      expect(() => validateReviewPacket(nestedPayload)).toThrow(
        /secret material/,
      );
      expect(check(nestedPayload), JSON.stringify(check.errors)).toBe(false);
    }
    for (const [record, runtime] of [
      [mutate(p, (candidate) => {
        candidate.evidence[0].provenance =
          "github_pat_11aa22bb33cc44dd55ee";
      }), validateReviewPacket],
      [mutate(o, (candidate) => {
        candidate.status = "known";
        candidate.measures = {
          nested: { token: "sk-abcdefghijklmnop" },
        };
      }), (candidate: unknown) => validateObservation(candidate, r)],
      [mutate(events[1], (candidate) => {
        candidate.source.id = "ghp_1234567890abcdefghij";
      }), (candidate: unknown) => validateReviewEvent(candidate, p)],
    ] as const) {
      expect(() => runtime(record)).toThrow(/credentials|secret material/);
      expect(check(record), JSON.stringify(check.errors)).toBe(false);
    }
    const relationalCases: Array<{
      value: any;
      runtime: (value: any) => void;
    }> = [
      {
        value: seal({
          ...(() => {
            const value: any = structuredClone(p);
            delete value.digest;
            value.producer.playbookId = "fixture-playbook";
            return value;
          })(),
        }),
        runtime: validateReviewPacket,
      },
      {
        value: seal({
          ...(() => {
            const value: any = structuredClone(p);
            delete value.digest;
            value.artifact.state = "partial";
            return value;
          })(),
        }),
        runtime: validateReviewPacket,
      },
      {
        value: seal({
          ...(() => {
            const value: any = structuredClone(p);
            delete value.digest;
            value.work.partialReason = "unexpected";
            return value;
          })(),
        }),
        runtime: validateReviewPacket,
      },
      {
        value: mutate(o, (value) => value.measures = { count: 1 }),
        runtime: (value) => validateObservation(value, r),
      },
      {
        value: mutate(o, (value) => value.status = "known"),
        runtime: (value) => validateObservation(value, r),
      },
      {
        value: mutate(l, (value) => value.claim = "fabricated"),
        runtime: (value) => validateLearning(value, o as any),
      },
      {
        value: mutate(l, (value) => value.status = "recorded"),
        runtime: (value) => validateLearning(value, o as any),
      },
    ];
    for (const [index, relational] of relationalCases.entries()) {
      expect(
        check(relational.value),
        `relational ${index}: ${JSON.stringify(check.errors)}`,
      ).toBe(false);
      expect(() => relational.runtime(relational.value)).toThrow();
    }
    for (const bindingMismatch of [
      mutate(events[1], (value) => value.packetId = "other-packet"),
      mutate(events[2], (value) => value.artifact.digest = sha256("other")),
    ]) {
      expect(check(bindingMismatch), JSON.stringify(check.errors)).toBe(true);
      expect(() => validateReviewEvent(bindingMismatch, p)).toThrow(
        /packet mismatch|artifact mismatch/,
      );
    }
    expect(JSON.stringify(schema)).not.toContain("authenticatedHuman");
    const drift: any = structuredClone(v);
    drift.authentication.authenticatedHuman = true;
    expect(check(drift)).toBe(false);
    const nonCanonicalTime: any = structuredClone(p);
    nonCanonicalTime.createdAt = "2026-08-21T00:00:00Z";
    expect(check(nonCanonicalTime)).toBe(false);
    for (const invalid of [
      mutate(events[1], (value) => value.authority.accept = true),
      mutate(events[1], (value) => value.payload.extra = true),
      mutate(events[1], (value) => value.actor = { kind: "system", id: null }),
      mutate(events[1], (value) => value.payload.body = "api_key=abcdefghijk"),
    ]) expect(check(invalid), JSON.stringify(check.errors)).toBe(false);
  });
  it("rejects re-sealed semantic mutations for intended reasons", () => {
    const p: any = structuredClone(packet());
    delete p.digest;
    p.artifact.state = "partial";
    p.work = { state: "partial", summary: "partial", partialReason: null };
    expect(() => validateReviewPacket(seal(p))).toThrow(/ambiguous/);
    const q: any = structuredClone(packet());
    delete q.digest;
    q.producer.extra = true;
    expect(() => validateReviewPacket(seal(q))).toThrow(/producer fields/);
    const fv: any = structuredClone(verdict());
    delete fv.digest;
    fv.decidedAt = t3;
    fv.authentication = proof(
      "reviewer",
      "content-review",
      verdictSubjectDigest(packet(), fv),
    );
    expect(() => validateVerdict(seal(fv), packet(), ctx(t2))).toThrow(
      /chronology/,
    );
    const ea: any = structuredClone(authorization());
    delete ea.digest;
    ea.authorizedAt = t0;
    ea.authentication = proof(
      "operator",
      "consequential-action",
      authorizationSubjectDigest(ea),
    );
    expect(() =>
      validateActionAuthorization(seal(ea), packet(), verdict(), ctx())
    ).toThrow(/chronology/);
    const er: any = structuredClone(receipt());
    delete er.digest;
    er.startedAt = t1;
    er.finishedAt = t1;
    expect(() => validateReceipt(seal(er), authorization())).toThrow(
      /chronology/,
    );
  });
  it("keeps stale digest separate", () =>
    expect(() => validateReviewPacket({ ...packet(), strategicBet: "changed" }))
      .toThrow(/digest mismatch/));
  it("rejects non-JSON payload ambiguity and numeric values", () => {
    expect(sha256(new Map())).toBe(sha256({}));
    for (
      const payload of [
        new Map([["body", "fixture"]]),
        { body: undefined },
        { amount: Number.POSITIVE_INFINITY },
        { amount: Number.NaN },
      ]
    ) {
      const value = structuredClone(packet()) as Record<string, unknown>;
      delete value.digest;
      value.actionProposal = {
        authority: "provider.fixture",
        operation: "draft",
        connectionRef: "connection.fixture",
        payload,
        payloadDigest: sha256(payload),
      };
      expect(() => validateReviewPacket(seal(value as never))).toThrow(
        /non-plain object|non-JSON value|non-finite number/,
      );
    }
    const sparse: unknown[] = [];
    sparse.length = 1;
    const custom = Object.create({ inherited: true });
    custom.body = "fixture";
    for (
      const payload of [
        new Set(["fixture"]),
        new Date(t0),
        custom,
        { body: 1n },
        { body: Symbol("fixture") },
        { body: () => "fixture" },
        sparse,
      ]
    ) {
      const value = structuredClone(packet()) as Record<string, unknown>;
      value.actionProposal = {
        authority: "provider.fixture",
        operation: "draft",
        connectionRef: "connection.fixture",
        payload,
        payloadDigest: sha256("placeholder"),
      };
      expect(() => validateReviewPacket(value)).toThrow(
        /non-plain object|non-JSON value|array hole/,
      );
    }
    const r = receipt();
    for (const measures of [{ lift: undefined }, { lift: Infinity }]) {
      const observation = seal({
        schemaVersion: REVIEW_CONTRACT_VERSION,
        kind: "result-observation",
        observationId: "invalid-observation",
        receiptId: r.receiptId,
        receiptDigest: r.digest,
        status: "known",
        measures,
        observedAt: t4,
      });
      expect(() => validateObservation(observation, r)).toThrow(
        /non-JSON value|non-finite number/,
      );
    }
  });
});

describe("release claim qualification seam", () => {
  it("qualifies only a canonically valid pair and binds exact provenance", () => {
    const p = packet(), v = verdict();
    const q: QualifiedReviewVerdictV1 = qualifyReviewVerdict(v, p, ctx());
    expect(q).toEqual({
      schemaVersion: REVIEW_CONTRACT_VERSION,
      verdictId: v.verdictId,
      verdictDigest: v.digest,
      packetId: p.packetId,
      packetDigest: p.digest,
      artifactDigest: p.artifact.digest,
      reviewerPrincipalId: "fixture-reviewer",
      reviewerAuthSubjectDigest: v.authentication.subjectDigest,
      candidateId: null,
      evidenceId: null,
      outcome: "accept",
      decidedAt: t1,
      expiresAt: expiry,
      unresolvedLimitations: ["No real output."],
    });
    expect(Object.isFrozen(q)).toBe(true);
    expect(Object.isFrozen(q.unresolvedLimitations)).toBe(true);
    expect(() => {
      (q as any).verdictId = "mutated";
    }).toThrow();
    expect(() =>
      qualifyReviewVerdict({ ...v, verdictId: "forged" }, p, ctx())
    ).toThrow();
  });
  it.each(["revise", "reject", "cancel"] as const)(
    "qualifies a canonical %s verdict as structurally valid",
    (outcome) => {
      const p = packet();
      expect(qualifyReviewVerdict(verdict(outcome), p, ctx()).outcome)
        .toBe(outcome);
    },
  );
});
