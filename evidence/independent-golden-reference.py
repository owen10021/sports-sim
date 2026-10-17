#!/usr/bin/env python3
"""
Independent re-computation of the Package A golden scenario.

Written in Python from the *specification* of the pieces (canonical JSON, SHA-256,
splitmix32 seeding, xoshiro128**, civil-date arithmetic, event/world layout). It shares no
code with the TypeScript implementation. Agreement of the final fingerprint and event-chain
head with the TypeScript/Node output is evidence against a shared implementation bug.
"""
import hashlib
import json
import datetime

M = 0xFFFFFFFF


def canonical(v):
    return json.dumps(v, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(v):
    return hashlib.sha256(canonical(v).encode("utf-8")).hexdigest()


# ---- fixtures (copied verbatim from fixtures/*.json) --------------------------------
PROV = {
    "sourceId": "sport-sim-synthetic-package-a",
    "sourceKind": "synthetic",
    "retrievedAt": "2026-10-16T00:00:00Z",
    "effectiveAsOf": "2026-10-16",
    "validationStatus": "synthetic",
    "note": "Synthetic Package A fixture. Contains no real league data.",
}
RULESET_BODY = {
    "schemaVersion": 1,
    "rulesetId": "synthetic-minimal",
    "rulesetVersion": 1,
    "displayName": "Synthetic Minimal Ruleset (Package A)",
    "provenance": [PROV],
    "rules": {"maxAdvanceDaysPerCommand": 30},
}
RULESET_HASH_FIXTURE = "0776311417c64397f948efe719cbf0ad6648b2011e5c227a62158ee6cb3712ae"
SEED_BODY = {
    "schemaVersion": 1,
    "seedId": "synthetic-empty",
    "seedVersion": 1,
    "ruleset": {
        "rulesetId": "synthetic-minimal",
        "rulesetVersion": 1,
        "contentHash": RULESET_HASH_FIXTURE,
    },
    "rngSeed32": 20261016,
    "startDate": "2026-10-16",
    "provenance": [PROV],
    "initialEntities": [],
}
SEED_HASH_FIXTURE = "95b75c540916552ad18c05fd50e158b218254ac909edf8a84d82e26ecc4bf98f"

# ---- manifest hashes: try the plausible sealing conventions ---------------------------
def find_convention(body, expected):
    candidates = {
        "sha256(canonical(body))": sha(body),
        "sha256(canonical({domain,body}))": None,
    }
    if candidates["sha256(canonical(body))"] == expected:
        return "sha256(canonical(body))"
    return None


# ---- RNG ------------------------------------------------------------------------------
def imul(a, b):
    return (a * b) & M


def rotl(x, k):
    return ((x << k) | (x >> (32 - k))) & M


def splitmix32(state):
    a = (state + 0x9E3779B9) & M
    t = a ^ (a >> 16)
    t = imul(t, 0x21F0AAAD)
    t ^= t >> 15
    t = imul(t, 0x735A2D97)
    return a, (t ^ (t >> 15)) & M


class Xoshiro128ss:
    def __init__(self, seed):
        words = []
        cur = seed
        for _ in range(4):
            cur, v = splitmix32(cur)
            words.append(v)
        if not any(words):
            words[0] = 1
        self.s = words
        self.draws = 0

    def next(self):
        s0, s1, s2, s3 = self.s
        result = imul(rotl(imul(s1, 5), 7), 9)
        t = (s1 << 9) & M
        s2 ^= s0
        s3 ^= s1
        s1 ^= s2
        s0 ^= s3
        s2 ^= t
        s3 = rotl(s3, 11)
        self.s = [s0 & M, s1 & M, s2 & M, s3 & M]
        self.draws += 1
        return result

    def state(self):
        return {
            "algorithm": "xoshiro128ss-v1",
            "s0": self.s[0],
            "s1": self.s[1],
            "s2": self.s[2],
            "s3": self.s[3],
            "draws": self.draws,
        }


# ---- world / events --------------------------------------------------------------------
GENESIS = "0" * 64
ACTOR = {"kind": "test_harness", "id": "golden-harness"}


def fingerprint(world):
    return sha({"domain": "sport-sim/world-fingerprint", "version": 1, "world": world})


def chain(prev, body):
    return sha({"previousHash": prev, "body": body})


def main():
    out = {}
    out["rulesetConvention"] = find_convention(RULESET_BODY, RULESET_HASH_FIXTURE)
    out["seedConvention"] = find_convention(SEED_BODY, SEED_HASH_FIXTURE)

    rng = Xoshiro128ss(SEED_BODY["rngSeed32"])
    world = {
        "schemaVersion": 1,
        "worldId": "world-golden-1",
        "ruleset": {
            "rulesetId": "synthetic-minimal",
            "rulesetVersion": 1,
            "contentHash": RULESET_HASH_FIXTURE,
        },
        "seed": {"seedId": "synthetic-empty", "seedVersion": 1, "contentHash": SEED_HASH_FIXTURE},
        "simDate": SEED_BODY["startDate"],
        "revision": 0,
        "rng": rng.state(),
        "nextIds": {"event": 1},
        "entities": [],
    }
    head = GENESIS
    steps = []
    # Only the three accepted commands change anything; the four rejected ones are no-ops by
    # specification, so the independent model simply asserts "no change" for them.
    plan = [("advance-1", 1, 1), ("advance-6", 2, 6), ("advance-7", 3, 7)]
    events = []
    for label, n, days in plan:
        start = datetime.date.fromisoformat(world["simDate"])
        rolls = []
        for i in range(1, days + 1):
            rolls.append({"date": (start + datetime.timedelta(days=i)).isoformat(), "roll": rng.next()})
        to = (start + datetime.timedelta(days=days)).isoformat()
        revision = world["revision"] + 1
        body = {
            "eventId": "evt-%06d" % world["nextIds"]["event"],
            "revision": revision,
            "simDate": to,
            "actor": ACTOR,
            "commandId": "cmd-%06d" % n,
            "type": "DaysAdvanced",
            "payload": {"fromDate": world["simDate"], "toDate": to, "days": days, "dayRolls": rolls},
        }
        head = chain(head, body)
        events.append(head)
        world = {
            **world,
            "simDate": to,
            "revision": revision,
            "rng": rng.state(),
            "nextIds": {"event": world["nextIds"]["event"] + 1},
        }
        steps.append({"label": label, "revision": revision, "rngDraws": rng.draws, "fingerprint": fingerprint(world), "chainHead": head})

    out["finalSimDate"] = world["simDate"]
    out["revision"] = world["revision"]
    out["rngDraws"] = rng.draws
    out["fingerprint"] = fingerprint(world)
    out["eventChainHead"] = head
    out["steps"] = steps
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
