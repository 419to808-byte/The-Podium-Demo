/* The Podium — store. localStorage persistence; re-seeds deterministically.
   Collections: citizens, cycles, posts, votes ("voterId:postId"), briefingItems. */
var PodiumStore = (function () {
  "use strict";

  var KEY = "podium.v1";

  /* Current voting cycle follows the calendar date (cycle rollover):
     the cycle whose voting window contains today's ET date (inclusive).
     Past all windows, the latest started cycle (the feed never empties);
     before all windows, the earliest cycle. Pure over state + clock, like
     replayCycles — callers pass the app's ET now (etNow). When no clock is
     available the legacy frozen cycle is used so behavior cannot regress. */
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function etDay(nowEt) {
    return nowEt.getFullYear() + "-" + pad2(nowEt.getMonth() + 1) + "-" + pad2(nowEt.getDate());
  }
  var ET_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  /* Naive ET wall-clock stamp ("YYYY-MM-DDTHH:MM:SS"), the seed's format, so
     plain string comparison orders user posts with seed posts correctly —
     including across the ET midnight boundary. */
  function etStamp(nowEt) {
    return etDay(nowEt) + "T" + pad2(nowEt.getHours()) + ":" + pad2(nowEt.getMinutes()) + ":" + pad2(nowEt.getSeconds());
  }
  /* Display date derived at render time so a user post ages after reload
     instead of reading "just now" forever. Seed posts carry frozen dates
     and render unchanged. */
  function displayDateFor(p, nowEt) {
    if (!p || (p.displayDate && p.displayDate !== "just now")) return p ? p.displayDate : "";
    var created = p.createdAt || "";
    var day = "", mon = 0, mday = 0;
    if (/Z$/.test(created)) {
      /* Legacy UTC stamps (pre-naive-format saves): convert the instant to ET wall time. */
      var d = new Date(new Date(created).toLocaleString("en-US", { timeZone: "America/New_York" }));
      if (isNaN(d.getTime())) return "just now";
      day = etDay(d); mon = d.getMonth(); mday = d.getDate();
    } else {
      var m = /^(\d{4})-(\d{2})-(\d{2})T/.exec(created);
      if (!m) return "just now";
      day = m[1] + "-" + m[2] + "-" + m[3]; mon = Number(m[2]) - 1; mday = Number(m[3]);
    }
    if (!nowEt || day === etDay(nowEt)) return "just now";
    return ET_MONTHS[mon] + " " + mday;
  }
  function currentCycleId(s, nowEt) {
    var cycles = (s && s.cycles) || [];
    if (!nowEt || !cycles.length) {
      /* No clock (or no cycles): fall back to the latest-started cycle, so a
         clock-free caller still lands on the newest feed rather than a
         hardcoded id. */
      var latest = null, i;
      for (i = 0; i < cycles.length; i++) {
        if (cycles[i].votingStart && (!latest || cycles[i].votingStart > latest.votingStart)) latest = cycles[i];
      }
      return latest ? latest.id : (cycles.length ? cycles[0].id : null);
    }
    var today = etDay(nowEt), i, c;
    for (i = 0; i < cycles.length; i++) {
      c = cycles[i];
      if (c.votingStart && c.votingEnd && c.votingStart <= today && today <= c.votingEnd) return c.id;
    }
    var past = null;
    for (i = 0; i < cycles.length; i++) {
      c = cycles[i];
      if (c.votingStart && c.votingStart <= today) past = c.id;
    }
    if (past) return past;
    return cycles[0].id;
  }

  /* Post integrity (TY, Nov 3): real SHA-256, computed locally — no
     network, no dependency. Compact synchronous implementation so hashes
     are stamped at seed/publish and recomputed at display without async
     plumbing. Verified against the "abc" test vector (ba7816bf...15ad).
     Real-product hook: swap this primitive for the platform crypto module
     (SubtleCrypto now, a FIPS 140-3 validated module in the hosted
     product); the hash INPUT format below stays the same. */
  function utf8Bytes(str) {
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) { out.push(c); continue; }
      if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F)); continue; }
      if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) {
        var d = str.charCodeAt(i + 1);
        if (d >= 0xDC00 && d <= 0xDFFF) {
          var cp = 0x10000 + ((c - 0xD800) << 10) + (d - 0xDC00);
          out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
          i++; continue;
        }
      }
      out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
    }
    return out;
  }
  function sha256Hex(str) {
    function rr(v, n) { return (v >>> n) | (v << (32 - n)); }
    var K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    var b = utf8Bytes(str);
    var bitLen = b.length * 8;
    b.push(0x80);
    while ((b.length % 64) !== 56) b.push(0);
    var hi = Math.floor(bitLen / 0x100000000), lo = bitLen >>> 0;
    b.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255,
      (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
    var w = new Array(64), off, i;
    for (off = 0; off < b.length; off += 64) {
      for (i = 0; i < 16; i++) w[i] = (b[off + i * 4] << 24) | (b[off + i * 4 + 1] << 16) | (b[off + i * 4 + 2] << 8) | b[off + i * 4 + 3];
      for (i = 16; i < 64; i++) {
        var s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        var s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = H[0], bb = H[1], cc = H[2], dd = H[3], ee = H[4], ff = H[5], gg = H[6], hh = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = rr(ee, 6) ^ rr(ee, 11) ^ rr(ee, 25);
        var ch = (ee & ff) ^ ((~ee) & gg);
        var t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
        var S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
        var mj = (a & bb) ^ (a & cc) ^ (bb & cc);
        var t2 = (S0 + mj) | 0;
        hh = gg; gg = ff; ff = ee; ee = (dd + t1) | 0; dd = cc; cc = bb; bb = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + bb) | 0; H[2] = (H[2] + cc) | 0; H[3] = (H[3] + dd) | 0;
      H[4] = (H[4] + ee) | 0; H[5] = (H[5] + ff) | 0; H[6] = (H[6] + gg) | 0; H[7] = (H[7] + hh) | 0;
    }
    var out = "";
    for (i = 0; i < 8; i++) out += ("00000000" + (H[i] >>> 0).toString(16)).slice(-8);
    return out;
  }
  /* Hash input, exactly: body + "|" + authorName + "|" + authorState +
     "|" + createdAt + "|" + ref. authorName is the citizen display name
     (authorId lookup) or the inline author (generated demo posts carry
     `author`, not `authorId`). Stored as post.hash at seed/publish time;
     recomputed at display; a mismatch is tampering. */
  function postAuthorName(s, p) {
    if (p.authorId) {
      var c = citizenById(s, p.authorId);
      if (c && c.name && c.name !== "Unknown citizen") return c.name;
    }
    return p.author || "Unknown citizen";
  }
  function hashPost(s, p) {
    return sha256Hex([(p && p.body) || "", postAuthorName(s, p), (p && p.authorState) || "", (p && p.createdAt) || "", (p && p.ref) || ""].join("|"));
  }
  /* Hash-chained audit log (TY, Nov 3): every listed action appends an
     entry {t, ev, ref, d, prev, h} where
       h = sha256(prev + "|" + t + "|" + ev + "|" + ref + "|" + d)
     and prev is the previous entry's h (64 zeros for genesis).
     Recomputing the chain detects any edit, reorder, or deletion.
     Entries live in the saved state (state.audit) beside votes and posts;
     verifyAudit re-checks the whole chain at display. */
  var GENESIS_PREV = "0000000000000000000000000000000000000000000000000000000000000000";
  function auditHash(prev, t, ev, ref, d) {
    return sha256Hex([prev, t, ev, ref, d].join("|"));
  }
  function chainPush(log, t, ev, ref, d) {
    var prev = log.length ? log[log.length - 1].h : GENESIS_PREV;
    var e = { t: t, ev: ev, ref: ref || "", d: d || "", prev: prev };
    e.h = auditHash(e.prev, e.t, e.ev, e.ref, e.d);
    log.push(e);
    return e;
  }
  function auditAppend(s, ev, ref, d, nowEt) {
    if (!s.audit) s.audit = [];
    var e = chainPush(s.audit, etStamp(nowEt || new Date()), ev, ref, d);
    save(s);
    return e;
  }
  /* Seeded history: genesis first, then one "post" entry per post
     (t = createdAt), one "draw" entry per drawn cycle (t = drawAt),
     one "approve" entry per briefing item with an answer
     (t = briefingAt, ref = post ref + "-A"), and one "update" entry per
     seeded status update (t = cycle year + update date, ref + "-Un").
     Deterministic order: posts in state order, then cycles, then items. */
  function buildAudit(posts, cycles, items) {
    var log = [];
    chainPush(log, "genesis", "genesis", "podium", "audit log genesis");
    (posts || []).forEach(function (p) {
      if (!p || !p.id) return;
      chainPush(log, p.createdAt || "undated", "post", p.ref || p.id, p.id);
    });
    var refByPostId = {};
    (posts || []).forEach(function (p) { if (p && p.id) refByPostId[p.id] = p.ref || p.id; });
    var cycById = {};
    (cycles || []).forEach(function (c) { if (c && c.id) cycById[c.id] = c; });
    function yearOf(cycleId) {
      var c = cycById[cycleId];
      var m = c && /^(\d{4})-\d{2}-\d{2}$/.exec(c.votingStart || "");
      return m ? m[1] : "2026";
    }
    (cycles || []).forEach(function (c) {
      if (!c || !c.id || !(c.poolSize > 0)) return;
      chainPush(log, c.drawAt || "undrawn", "draw", c.id, "pool " + c.poolSize + " position " + c.position);
    });
    (items || []).forEach(function (b) {
      if (!b || !b.postId) return;
      var ref = refByPostId[b.postId] || b.postId;
      var c = cycById[b.cycleId];
      var bat = (c && c.briefingAt) || "unbriefed";
      if (b.answer) chainPush(log, bat, "approve", ref + "-A", b.trackerStatus || "");
      (b.updates || []).forEach(function (u, i) {
        if (!u) return;
        chainPush(log, yearOf(b.cycleId) + " " + (u.date || "undated"), "update", ref + "-U" + (i + 1), u.status || "");
      });
    });
    return log;
  }
  function verifyAudit(audit) {
    var prev = GENESIS_PREV;
    for (var i = 0; i < (audit || []).length; i++) {
      var e = audit[i];
      if (!e || e.prev !== prev) return { ok: false, index: i + 1 };
      if (e.h !== auditHash(e.prev, e.t, e.ev, e.ref, e.d)) return { ok: false, index: i + 1 };
      prev = e.h;
    }
    return { ok: true, index: 0 };
  }

  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }
  function pad4(n) {
    var s = String(n);
    while (s.length < 4) s = "0" + s;
    return s;
  }
  /* Topic letter from the topics-list order (A, B, C, ...). Frozen per post
     at publish time and stored on the post; never recomputed afterward. */
  function refLetter(topics, topic) {
    var i = topics.indexOf(topic);
    if (i < 0 || i > 25) return "Z";
    return String.fromCharCode(65 + i);
  }

  function refNumber(ref) {
    var m = /^[A-Z]-(\d+)$/.exec(ref || "");
    return m ? parseInt(m[1], 10) : 0;
  }

  function seedState() {
    var s = deepCopy(PODIUM_SEED);
    /* Reference codes are permanent: seed posts carry their frozen codes, so
       retained posts keep the same code on a fresh load as in migrated
       state. Only posts without a code are numbered, continuing the
       platform-wide counter past the highest frozen number. */
    var ordered = s.posts.slice().sort(function (a, b) {
      if (a.createdAt < b.createdAt) return -1;
      if (a.createdAt > b.createdAt) return 1;
      return a.id < b.id ? -1 : 1;
    });
    var seq = 0;
    ordered.forEach(function (p) {
      seq = Math.max(seq, refNumber(p.ref));
    });
    ordered.forEach(function (p) {
      if (!p.ref) {
        seq += 1;
        p.ref = refLetter(s.topics, p.topic) + "-" + pad4(seq);
      }
    });
    var out = {
      version: s.version,
      citizens: s.citizens,
      topics: s.topics,
      cycles: s.cycles,
      posts: s.posts,
      briefingItems: s.briefingItems,
      votes: {}, /* "voterId:postId" -> true */
      currentUserId: null,
      demoVote: null, /* {cycleId, voterId, postId}: one vote per weekly cycle per browser (demo cap) */
      userSeq: 0,
      refSeq: seq,
      audit: []
    };
    /* Post-integrity stamps + seeded audit history, so a fresh profile is
       verifiable and non-empty on first load. */
    out.posts.forEach(function (p) { if (p && !p.hash) p.hash = hashPost(out, p); });
    out.audit = buildAudit(out.posts, out.cycles, out.briefingItems);
    return out;
  }

  /* Defensive backfill for partially-written same-version state: fill only
     fields that are entirely missing, never overwrite present data. Keeps a
     truncated save from crashing later derefs (citizens, votes, refSeq). */
  function normalizeState(s) {
    /* The seed copy (all 217 posts, sorted for numbering) is built lazily:
       each branch below pre-scans for work first, so a complete save never
       pays for the copy. needSeed memoizes — at most one copy per call. */
    var seed = null;
    function needSeed() { if (!seed) seed = seedState(); return seed; }
    var filled = false;
    if (!s.citizens) { s.citizens = needSeed().citizens; filled = true; }
    if (!s.topics) { s.topics = needSeed().topics; filled = true; }
    if (!s.briefingItems) { s.briefingItems = needSeed().briefingItems; filled = true; }
    /* Seed-answer migration (TY, Oct 28): Ana's w1 answer changed from
       "will fund" to "will ask for funds … allocate the funds …". Saved
       states pin the old string, so refresh it — but only where it is
       still byte-identical to the old seed wording (w1 Ana only); anything
       a session may have altered is left alone. Drafts and approvals live
       outside saved state, so this cannot clobber committee work. */
    var OLD_W1_ANA = "Sample committee response: the committee will fund a two-year pilot of quarterly mobile cardiac screening in twelve rural counties, with schedules published one year ahead, routed through the Department of Health and Human Services and state health departments.";
    var needsAna = (s.briefingItems || []).some(function (b) { return b && b.postId === "p-w1-05" && b.answer === OLD_W1_ANA; });
    if (needsAna) {
      var seedAna = null;
      needSeed().briefingItems.forEach(function (b) { if (b.postId === "p-w1-05") seedAna = b; });
      if (seedAna) {
        (s.briefingItems || []).forEach(function (b) {
          if (b && b.postId === "p-w1-05" && b.answer === OLD_W1_ANA) { b.answer = seedAna.answer; filled = true; }
        });
      }
    }
    /* Same pattern for the Week 3 finals (TY, Oct 28, F1): saved states
       pin the old "(in preparation; briefing Nov 4)" placeholders, so
       refresh each — but only where still byte-identical to its old seed
       wording; a diverged (user-edited) answer is left alone. */
    var OLD_W3 = {
      "p-w3-01": "Sample committee response (in preparation; briefing Nov 4): the committee is formulating a three-year phase-in plan for the twenty-five-student classroom maximum, routed through the Department of Education and state education agencies.",
      "p-w3-09": "Sample committee response (in preparation; briefing Nov 4): the committee is drafting the plain-language juror guide for mailing with every summons, routed through the Administrative Office of the Courts and state court administrators."
    };
    var needsW3 = (s.briefingItems || []).some(function (b) { return b && OLD_W3[b.postId] && b.answer === OLD_W3[b.postId]; });
    if (needsW3) {
      var seedW3 = {};
      needSeed().briefingItems.forEach(function (b) { if (OLD_W3[b.postId]) seedW3[b.postId] = b; });
      (s.briefingItems || []).forEach(function (b) {
        if (b && OLD_W3[b.postId] && b.answer === OLD_W3[b.postId] && seedW3[b.postId]) { b.answer = seedW3[b.postId].answer; filled = true; }
      });
    }
    /* Citations backfill: saved items predate the citations lists, so copy
       the seed citations where the save has none yet. Never overwritten
       where present. */
    var needsCite = (s.briefingItems || []).some(function (b) { return b && b.citations === undefined; });
    if (needsCite) {
      var seedCite = {};
      needSeed().briefingItems.forEach(function (b) { if (b && b.postId) seedCite[b.postId] = b.citations; });
      (s.briefingItems || []).forEach(function (b) {
        if (b && b.citations === undefined && seedCite[b.postId]) { b.citations = deepCopy(seedCite[b.postId]); filled = true; }
      });
    }
    /* Seed-answer refresh for the six replaced answers (TY, Nov 3): the
       seed replacement swapped all six briefing-item answers for fresh
       Wonder drafts, with derived citations and a new agencyRequest per
       item. Saved states pin the old wording, so refresh where the stored
       answer still carries a distinctive substring of the old text -- a
       pinned answer may be a summary or the full text, so an exact match
       would miss variants. Also completes items whose answer already
       matches the seed but whose citations/agencyRequest are stale or
       missing (e.g. after the older exact-text refreshes). Anything else
       (including a diverged answer) is left alone; votes, refs, statuses,
       updates, and the draw are untouched. */
    var OLD_ANSWER_MARK = {
      "p-w1-16": "issue guidance encouraging potassium bicarbonate",
      "p-w1-05": "two-year pilot of quarterly mobile cardiac screening",
      "p-w2-01": "monthly cash-price posting",
      "p-w2-06": "twenty-year published schedule",
      "p-w3-01": "three-year phase-in",
      "p-w3-09": "plain-language juror guide mailed with every jury summons nationwide"
    };
    /* Returning-visitor S6 dates (TY, Nov 4): a save created AFTER the 4147313
       seed replacement holds the new answer text with the OLD S6 transmit
       dates — none of the OLD_ANSWER_MARK substrings match it, so the answer
       migration above never fires for it. The old transmit date appears in
       each old answer and in none of the new seed texts; a stored answer
       containing its OLD_DATE_MARK is stale and gets the same
       answer/citations/agencyRequest replacement. Updates and trackerStatus
       are untouched here (the updates migration owns those); seed version
       stays 13; votes, refs, and the draw are untouched. */
    var OLD_DATE_MARK = {
      "p-w1-05": "June 12, 2026",
      "p-w2-01": "August 19, 2026",
      "p-w3-09": "July 24, 2026"
    };
    var seedAns = {};
    needSeed().briefingItems.forEach(function (b) { if (b && OLD_ANSWER_MARK[b.postId]) seedAns[b.postId] = b; });
    function staleSeedAnswer(b) {
      var sd = (b && OLD_ANSWER_MARK[b.postId]) ? seedAns[b.postId] : null;
      if (!b || !sd) return false;
      if (typeof b.answer === "string" && b.answer.indexOf(OLD_ANSWER_MARK[b.postId]) !== -1 && b.answer !== sd.answer) return true;
      var dm = OLD_DATE_MARK[b.postId];
      if (dm && typeof b.answer === "string" && b.answer.indexOf(dm) !== -1 && b.answer !== sd.answer) return true;
      return b.answer === sd.answer &&
        (JSON.stringify(b.citations) !== JSON.stringify(sd.citations) || b.agencyRequest !== sd.agencyRequest);
    }
    /* Updates refresh (TY, Nov 4): the seed replacement swapped answers but left
       updates describing the old answers. A save holding the NEW answer
       (migrated earlier, or created after the replacement) still carries the
       old updates — and so does a save still holding an old answer. When a
       briefing item's stored updates contain its old-update substring, replace
       that item's updates AND trackerStatus verbatim from the current seed.
       Same-version saves flow through normalizeState on every load, exactly
       like the answer migration; votes, refs, other statuses, the draw, and
       the seed version (stays 13) are untouched. */
    var OLD_UPDATE_MARK = {
      "p-w1-16": "Final guidance issued to bottled-water producers",
      "p-w1-05": "two-year pilot",
      "p-w2-01": "cash-price posting rule in drafting",
      "p-w2-06": "replacement-schedule framework published",
      "p-w3-01": "Funding request prepared for the three-year phase-in",
      "p-w3-09": "Juror guide draft completed"
    };
    function staleSeedUpdates(b) {
      var sd = (b && OLD_UPDATE_MARK[b.postId]) ? seedAns[b.postId] : null;
      if (!b || !sd) return false;
      var mark = OLD_UPDATE_MARK[b.postId];
      return (b.updates || []).some(function (u) { return u && typeof u.text === "string" && u.text.indexOf(mark) !== -1; });
    }
    var needsAns = (s.briefingItems || []).some(staleSeedAnswer);
    if (needsAns) {
      (s.briefingItems || []).forEach(function (b) {
        var sd = (b && OLD_ANSWER_MARK[b.postId]) ? seedAns[b.postId] : null;
        if (b && sd && staleSeedAnswer(b)) {
          b.answer = sd.answer;
          b.citations = deepCopy(sd.citations);
          b.agencyRequest = sd.agencyRequest;
          filled = true;
        }
      });
    }
    var needsUpd = (s.briefingItems || []).some(staleSeedUpdates);
    if (needsUpd) {
      (s.briefingItems || []).forEach(function (b) {
        var sd2 = (b && OLD_UPDATE_MARK[b.postId]) ? seedAns[b.postId] : null;
        if (b && sd2 && staleSeedUpdates(b)) {
          b.updates = deepCopy(sd2.updates);
          b.trackerStatus = sd2.trackerStatus;
          filled = true;
        }
      });
    }
    /* Backfill voting windows onto saved cycles (the rollover needs them).
       Seed values only, never overwritten where present. */
    var needsWindows = (s.cycles || []).some(function (c) { return !c.votingStart || !c.votingEnd; });
    if (needsWindows) {
      var seedCyc = {};
      needSeed().cycles.forEach(function (c) { seedCyc[c.id] = c; });
      (s.cycles || []).forEach(function (c) {
        var sc = seedCyc[c.id];
        if (sc) {
          if (!c.votingStart && sc.votingStart) { c.votingStart = sc.votingStart; filled = true; }
          if (!c.votingEnd && sc.votingEnd) { c.votingEnd = sc.votingEnd; filled = true; }
        }
      });
    }
    /* Backfill demo states by id, only where blank: new seed assignments
       reach old saves with no reseed and no data loss. User-chosen states
       and frozen post states are preserved. */
    var needsStates = (s.citizens || []).some(function (c) { return !c.state; }) ||
      (s.posts || []).some(function (p) { return !p.authorState; });
    if (needsStates) {
      var seedCit = {};
      needSeed().citizens.forEach(function (c) { seedCit[c.id] = c; });
      (s.citizens || []).forEach(function (c) {
        if (!c.state && seedCit[c.id] && seedCit[c.id].state) { c.state = seedCit[c.id].state; filled = true; }
      });
      var seedPost = {};
      needSeed().posts.forEach(function (p) { seedPost[p.id] = p; });
      (s.posts || []).forEach(function (p) {
        if (!p.authorState && seedPost[p.id] && seedPost[p.id].authorState) { p.authorState = seedPost[p.id].authorState; filled = true; }
      });
    }
    /* Language-tag backfill (multilingual step 1): old saves predate the
       frozen lang tag, and all old content is English. Never overwritten
       where present. */
    (s.posts || []).forEach(function (p) {
      if (p && !p.lang) { p.lang = "en"; filled = true; }
    });
    /* Post-integrity backfill for pre-feature saves: stamp hashes computed
       from the current bytes (missing only â€” a stored hash is never
       recomputed here, so a later mismatch at display still flags
       tampering). */
    (s.posts || []).forEach(function (p) {
      if (p && !p.hash) { p.hash = hashPost(s, p); filled = true; }
    });
    /* Audit-log backfill for pre-feature saves: build the seeded history
       from the merged state (includes the visitor's own posts). Saves that
       already carry a log keep their chain untouched. */
    if (!s.audit) { s.audit = buildAudit(s.posts, s.cycles, s.briefingItems); filled = true; }
    /* Committee help-box system issues (TY, Nov 4): tracked reports from
       serving members live beside the audit log. Default only; existing
       issues are never touched. */
    if (!s.systemIssues) { s.systemIssues = []; filled = true; }
    /* One-time stamp migration: user posts saved with ISO-UTC createdAt
       predate the naive ET-wall format. Convert in place so string ordering
       matches seed posts; the instant is preserved. */
    s.posts.forEach(function (p) {
      if (p && typeof p.id === "string" && p.id.indexOf("u-") === 0 && typeof p.createdAt === "string" && /Z$/.test(p.createdAt)) {
        var inst = new Date(p.createdAt);
        if (!isNaN(inst.getTime())) {
          p.createdAt = etStamp(new Date(inst.toLocaleString("en-US", { timeZone: "America/New_York" })));
          filled = true;
        }
      }
    });
    if (!s.votes) { s.votes = {}; filled = true; }
    if (!("demoVote" in s)) { s.demoVote = null; filled = true; }
    if (typeof s.refSeq !== "number" || !(s.refSeq >= 0)) {
      filled = true;
      var maxRef = needSeed().refSeq;
      s.posts.forEach(function (p) {
        var m = /-(\d+)$/.exec(p.ref || "");
        if (m && Number(m[1]) > maxRef) maxRef = Number(m[1]);
      });
      s.refSeq = maxRef;
    }
    return { state: s, filled: filled };
  }

  /* Forward seed migration: a saved state whose version is older than the
     seed gains the seed content added since the save — posts, briefing
     updates, and citizens — without losing anything the visitor created
     or voted on. Existing entries are never removed, modified, or
     re-ordered (except trackerStatus, which follows its seed item's
     newest update, the ref counter, and the version stamp). Every merge
     step dedups, so re-running changes nothing: idempotent. */
  function updateDayNum(u) {
    var m = /^([A-Za-z]{3})\s+(\d{1,2})/.exec((u && u.date) || "");
    if (!m) return null;
    var mi = ET_MONTHS.indexOf(m[1]);
    if (mi < 0) return null;
    return (mi + 1) * 100 + Number(m[2]);
  }
  function sameSeedUpdate(a, b) { return !!(a && b && a.date === b.date && a.text === b.text); }
  function migrateSeedVersion(s) {
    var seed = seedState();
    /* Posts: add seed ids missing from the save, appended in seed order.
       Saved posts (including the visitor's own) keep their order and bytes. */
    var havePost = {};
    (s.posts || []).forEach(function (p) { if (p && p.id) havePost[p.id] = true; });
    seed.posts.forEach(function (p) {
      if (p && p.id && !havePost[p.id]) { s.posts.push(deepCopy(p)); havePost[p.id] = true; }
    });
    /* Briefing items: merge updates by (date + text), in date order, then
       follow the seed trackerStatus; add wholly missing items as-is. */
    var byPostId = {};
    (s.briefingItems || []).forEach(function (b) { if (b && b.postId) byPostId[b.postId] = b; });
    var savedPostByRef = {};
    (s.posts || []).forEach(function (p) { if (p && p.ref) savedPostByRef[p.ref] = p; });
    var seedPostById = {};
    seed.posts.forEach(function (p) { if (p && p.id) seedPostById[p.id] = p; });
    seed.briefingItems.forEach(function (sb) {
      var match = (sb.postId && byPostId[sb.postId]) || null;
      if (!match && sb.postId && seedPostById[sb.postId] && seedPostById[sb.postId].ref) {
        var sp = savedPostByRef[seedPostById[sb.postId].ref];
        if (sp && byPostId[sp.id]) match = byPostId[sp.id];
      }
      if (!match) { s.briefingItems.push(deepCopy(sb)); return; }
      if (!match.updates) match.updates = [];
      (sb.updates || []).forEach(function (su) {
        var already = match.updates.some(function (eu) { return sameSeedUpdate(eu, su); });
        if (already) return;
        var at = match.updates.length, nd = updateDayNum(su);
        if (nd !== null) {
          for (var i = 0; i < match.updates.length; i++) {
            var ed = updateDayNum(match.updates[i]);
            if (ed !== null && ed > nd) { at = i; break; }
          }
        }
        match.updates.splice(at, 0, deepCopy(su));
      });
      if (match.trackerStatus !== sb.trackerStatus) match.trackerStatus = sb.trackerStatus;
    });
    /* Citizens: add seed ids missing from the save, appended in seed order. */
    var haveCit = {};
    (s.citizens || []).forEach(function (c) { if (c && c.id) haveCit[c.id] = true; });
    seed.citizens.forEach(function (c) {
      if (c && c.id && !haveCit[c.id]) { s.citizens.push(deepCopy(c)); haveCit[c.id] = true; }
    });
    /* Keep the derived ref counter ahead of every assigned ref. */
    var maxRef = (typeof s.refSeq === "number" && s.refSeq >= 0) ? s.refSeq : 0;
    s.posts.forEach(function (p) {
      var m = /-(\d+)$/.exec((p && p.ref) || "");
      if (m && Number(m[1]) > maxRef) maxRef = Number(m[1]);
    });
    s.refSeq = maxRef;
    s.version = PODIUM_SEED.version;
    return { state: s, filled: true };
  }
  var BACKUP_KEY = KEY + ".bak";
  /* Salvage path for saves the current version cannot load (old version or
     shape drift): carry user posts (u- ids), their votes, and the user id
     into a fresh seed. Seed-shaped content always comes from the seed.
     Returns a state object, or null when nothing is salvageable. */
  function migrateLegacy(raw) {
    var old = null;
    try { old = JSON.parse(raw); } catch (e) { return null; }
    if (!old || typeof old !== "object") return null;
    var fresh = seedState();
    var have = false;
    var seen = {};
    fresh.posts.forEach(function (p) { seen[p.id] = true; });
    (Array.isArray(old.posts) ? old.posts : []).forEach(function (p) {
      if (!p || typeof p.id !== "string" || seen[p.id]) return;
      if (p.id.indexOf("u-") !== 0) return;
      fresh.posts.push(p); seen[p.id] = true; have = true;
    });
    /* Salvaged user posts predate the audit log: record their publication
       from their own timestamps so the chain covers them too. */
    fresh.posts.forEach(function (p) {
      if (p && p.id && p.id.indexOf("u-") === 0) {
        if (!p.hash) p.hash = hashPost(fresh, p);
        chainPush(fresh.audit, p.createdAt || "undated", "post", p.ref || p.id, p.id);
      }
    });
    var keepIds = {};
    fresh.posts.forEach(function (p) { keepIds[p.id] = true; });
    fresh.votes = {};
    if (old.votes && typeof old.votes === "object") {
      Object.keys(old.votes).forEach(function (k) {
        var pid = k.slice(k.indexOf(":") + 1);
        if (keepIds[pid]) { fresh.votes[k] = old.votes[k]; have = true; }
      });
    }
    if (old.currentUserId && citizenById(fresh, old.currentUserId)) {
      fresh.currentUserId = old.currentUserId; have = true;
    }
    if (typeof old.userSeq === "number" && old.userSeq > fresh.userSeq) fresh.userSeq = old.userSeq;
    var maxRef = fresh.refSeq;
    fresh.posts.forEach(function (p) {
      var m = /-(\d+)$/.exec(p.ref || "");
      if (m && Number(m[1]) > maxRef) maxRef = Number(m[1]);
    });
    fresh.refSeq = maxRef;
    return have ? fresh : null;
  }
  function load(nowEt) {
    var raw = null;
    try {
      raw = window.localStorage.getItem(KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.posts && s.cycles) {
          if (s.version === PODIUM_SEED.version) {
            var norm = normalizeState(s);
            var out = cleanupClosedCycles(norm.state, nowEt);
            collapseExtraVotes(out, nowEt); /* one vote per citizen per cycle */
            if (norm.filled) save(out); /* persist the migration exactly once */
            return out;
          }
          if (typeof s.version === "number" && s.version < PODIUM_SEED.version) {
            /* Older seed: merge new posts, updates, and citizens forward.
               Votes, own posts, tab, language, and draft are untouched. */
            var mig = migrateSeedVersion(s);
            var mnorm = normalizeState(mig.state);
            var mout = cleanupClosedCycles(mnorm.state, nowEt);
            collapseExtraVotes(mout, nowEt);
            save(mout); /* version stamp + merged content, exactly once */
            return mout;
          }
        }
        /* Version mismatch or shape drift: never silently wipe the user's
           posts and votes. Preserve the exact old payload under a backup
           key, then migrate what can be migrated into a fresh seed. */
        try { window.localStorage.setItem(BACKUP_KEY, raw); } catch (e) {}
        var migrated = migrateLegacy(raw);
        if (migrated) {
          if (typeof console !== "undefined" && console.warn) console.warn("Podium: saved state version mismatch; user posts/votes migrated, original preserved under " + BACKUP_KEY + ".");
          var mnorm = normalizeState(migrated);
          var mout = cleanupClosedCycles(mnorm.state, nowEt);
          collapseExtraVotes(mout, nowEt);
          save(mout);
          return mout;
        }
        if (typeof console !== "undefined" && console.warn) console.warn("Podium: saved state unreadable or empty; starting fresh, original preserved under " + BACKUP_KEY + ".");
      }
    } catch (e) { /* corrupted or unavailable: back up, then reseed below */ }
    if (raw) {
      /* Unparseable payload: preserve the exact bytes under the backup key
         before reseeding, so nothing is ever silently destroyed. */
      try { window.localStorage.setItem(BACKUP_KEY, raw); } catch (e) { /* backup-only */ }
      if (typeof console !== "undefined" && console.warn) console.warn("Podium: saved state unparseable; starting fresh, original preserved under " + BACKUP_KEY + ".");
    }
    var fresh = seedState();
    save(fresh);
    return fresh;
  }

  /* Real-product hook: encrypted off-site backups replicate the payload
     written below (envelope-encrypted with a KMS/HSM data key, FedRAMP-
     authorized object store, WORM retention) â€” never plaintext copies. */
  function save(s) {
    try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode: session-only */ }
  }

  /* Standing cutoff rule: a post from a past cycle survives only if it was
     selected for a briefing (the top-voted winner or the random draw pick)
     or is a flagged seeded demonstration copy. Posts from cycles that are
     not fully processed yet (voting still open, or briefing not yet aired)
     are never touched — so the rollover itself never deletes: the incoming
     cycle is current, and the outgoing cycle is still unbriefed. Votes on
     deleted posts are dropped with them. Runs on every load; this IS the
     cutoff job. */
  function isRetained(s, p, nowEt) {
    if (p.demoCopy) return true; /* seeded demonstration copies are exempt */
    if (p.cycleId === currentCycleId(s, nowEt)) return true;
    var c = cycleById(s, p.cycleId);
    if (!c) return true; /* unknown cycle: keep, never delete blindly */
    if (p.id === c.topPostId || p.id === c.randomPostId) return true;
    if (!nowEt) return true; /* no clock: keep, never delete blindly */
    if (!c.votingEnd || !(c.votingEnd < etDay(nowEt))) return true;
    var cy = cycleYear(c);
    var bAt = cycleDateTime(c.briefingAt, cy === null ? nowEt.getFullYear() : cy);
    if (!bAt || !(bAt <= nowEt)) return true;
    return false;
  }
  function cleanupClosedCycles(s, nowEt) {
    var keep = {};
    s.posts.forEach(function (p) { if (isRetained(s, p, nowEt)) keep[p.id] = true; });
    if (s.posts.every(function (p) { return keep[p.id]; })) return s;
    s.posts = s.posts.filter(function (p) { return keep[p.id]; });
    if (!s.votes) s.votes = {};
    Object.keys(s.votes).forEach(function (k) {
      var pid = k.slice(k.indexOf(":") + 1);
      if (!keep[pid]) delete s.votes[k];
    });
    save(s);
    return s;
  }

  /* ---- queries (pure over state) ---- */
  function citizenById(s, id) {
    for (var i = 0; i < s.citizens.length; i++) {
      if (s.citizens[i].id === id) return s.citizens[i];
    }
    return { id: id, name: "Unknown citizen" };
  }
  function postById(s, id) {
    for (var i = 0; i < s.posts.length; i++) {
      if (s.posts[i].id === id) return s.posts[i];
    }
    return null;
  }
  function postByRef(s, ref) {
    var want = String(ref).toUpperCase();
    for (var i = 0; i < s.posts.length; i++) {
      if (s.posts[i].ref && s.posts[i].ref.toUpperCase() === want) return s.posts[i];
    }
    return null;
  }
  function cycleById(s, id) {
    for (var i = 0; i < s.cycles.length; i++) {
      if (s.cycles[i].id === id) return s.cycles[i];
    }
    return null;
  }
/* Voting/posting window (TY, Nov 4): a cycle stays open through its votingEnd
     day (Sunday 11:59 PM ET). Missing cycle, window, or clock means open —
     never block blindly; display callers decide what to show. */
  function cycleVotingOpen(s, cycleId, nowEt) {
    var c = cycleById(s, cycleId);
    if (!c || !c.votingEnd || !nowEt) return true;
    return !(c.votingEnd < etDay(nowEt));
  }
  function briefingItemFor(s, postId) {
    for (var i = 0; i < s.briefingItems.length; i++) {
      if (s.briefingItems[i].postId === postId) return s.briefingItems[i];
    }
    return null;
  }
  function itemsForCycle(s, cycleId) {
    return s.briefingItems.filter(function (b) { return b.cycleId === cycleId; });
  }
  function postsForCycle(s, cycleId) {
    return s.posts.filter(function (p) { return p.cycleId === cycleId; });
  }
  /* Exact-text lookup within one cycle. Leading/trailing whitespace ignored,
     comparison is case-insensitive. */
  function findExactInCycle(s, cycleId, body) {
    var want = body.trim().toLowerCase();
    var found = null;
    postsForCycle(s, cycleId).forEach(function (p) {
      if (!found && p.body.trim().toLowerCase() === want) found = p;
    });
    return found;
  }
  function userPostInCycle(s, userId, cycleId) {
    for (var i = 0; i < s.posts.length; i++) {
      if (s.posts[i].authorId === userId && s.posts[i].cycleId === cycleId) return s.posts[i];
    }
    return null;
  }
  function hasVoted(s, voterId, postId) {
    return !!s.votes[voterId + ":" + postId];
  }

  /* ---- replay timing (TY, Oct 28; pure over state + clock) ----
     A cycle's replay becomes available at the same post-briefing flip as
     This Week and its briefing record: once its briefing datetime has
     passed on the America/New_York clock, never before. Derived from
     briefing datetimes and the clock, never from seed statuses. */
  var REPLAY_MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  /* Year anchor (TY, Oct 28): briefing/draw strings carry no year, so every
     caller anchors the year to the cycle's own votingStart (full year),
     never to the current clock year — otherwise old briefings vanish or
     "air" again in January. Null when the window is missing; callers then
     fall back to the clock year (previous behavior). */
  function cycleYear(c) {
    var m = /^(\d{4})-\d{2}-\d{2}$/.exec((c && c.votingStart) || "");
    return m ? Number(m[1]) : null;
  }
  function cycleDateTime(str, year) {
    var m = /([A-Z][a-z]{2}) (\d+), (\d+):(\d+) (AM|PM)/.exec(str || "");
    if (!m || REPLAY_MONTHS[m[1]] === undefined) return null;
    var hour = (Number(m[3]) % 12) + (m[5] === "PM" ? 12 : 0);
    return new Date(year, REPLAY_MONTHS[m[1]], Number(m[2]), hour, Number(m[4]));
  }
  function replayCycles(s, nowEt) {
    var clockYear = nowEt.getFullYear();
    var bat = function (c) {
      var y = cycleYear(c);
      return cycleDateTime(c.briefingAt, y === null ? clockYear : y);
    };
    var out = s.cycles.filter(function (c) {
      if (!c.topPostId) return false;
      var bAt = bat(c);
      return !!bAt && bAt <= nowEt;
    });
    /* Newest briefing first. */
    out.sort(function (a, b) {
      return bat(b) - bat(a);
    });
    return out;
  }
  /* Real-product video attachment. Cycles carrying replaySrc (w1) play the
     real video; the rest play the simulated slate. Only an explicit opt-out
     marks a briefed cycle as still processing (replayReady === false or
     replaySrc === null), which renders the "Replay processing, available
     soon" placeholder. */
  function replayReady(c) {
    return !(c && (c.replayReady === false || c.replaySrc === null));
  }

  /* ---- mutations (save after each) ---- */
  /* One vote per citizen per weekly cycle (TY, Oct 28): a citizen holds at
     most one vote per cycle. Voting a different post in the same cycle
     MOVES the vote immediately (old post -1, new post +1); clicking the
     voted post again removes it. Upvote-only; no downvotes. */
  function userVoteInCycle(s, voterId, cycleId) {
    var prefix = voterId + ":";
    var found = null;
    Object.keys(s.votes || {}).forEach(function (k) {
      if (k.slice(0, prefix.length) !== prefix) return;
      var p = postById(s, k.slice(prefix.length));
      if (p && p.cycleId === cycleId) found = p.id; /* last cast wins */
    });
    return found;
  }
  function castVote(s, voterId, postId, nowEt) {
    var p = postById(s, postId);
    if (!p) return null;
    if (!s.votes) s.votes = {};
    /* Demo session cap (TY, Nov 3): one vote per weekly cycle per browser,
       regardless of which demo citizen is picked. A different citizen voting
       in a capped cycle is blocked ("capped", nothing recorded); the same
       citizen keeps the normal vote/move/remove behavior. */
    /* Sunday 11:59 PM ET cutoff (TY, Nov 4): a past-votingEnd cycle is closed — the vote is rejected and nothing is recorded. Callers pass the app ET now; a missing clock fails open. */
    if (!cycleVotingOpen(s, p.cycleId, nowEt || null)) return "closed";
    if (s.demoVote && s.demoVote.cycleId === p.cycleId && s.demoVote.voterId !== voterId) return "capped";
    var key = voterId + ":" + postId;
    if (s.votes[key]) {
      delete s.votes[key];
      p.votes = Math.max(0, p.votes - 1);
      if (s.demoVote && s.demoVote.postId === postId && s.demoVote.cycleId === p.cycleId) s.demoVote = null;
      save(s);
      return "removed";
    }
    var moved = false;
    var prefix = voterId + ":";
    Object.keys(s.votes).forEach(function (k) {
      if (k.slice(0, prefix.length) !== prefix) return;
      var q = postById(s, k.slice(prefix.length));
      if (q && q.cycleId === p.cycleId) {
        delete s.votes[k];
        q.votes = Math.max(0, q.votes - 1);
        moved = true;
      }
    });
    s.votes[key] = true; /* delete + set refreshes cast order */
    p.votes += 1;
    s.demoVote = { cycleId: p.cycleId, voterId: voterId, postId: postId };
    save(s);
    return moved ? "moved" : "voted";
  }
  /* Migration for pre-change saves: if a citizen holds multiple votes in
     the current cycle, keep only the most recently cast one (vote keys are
     inserted in cast order, so the last key wins; ties are impossible to
     order and any single one is kept) and decrement each removed post by
     1 so displayed totals stay consistent. Runs on every load. */
  function collapseExtraVotes(s, nowEt) {
    if (!s.votes) return false;
    var current = currentCycleId(s, nowEt);
    var byUser = {};
    Object.keys(s.votes).forEach(function (k) {
      var i = k.indexOf(":");
      var q = postById(s, k.slice(i + 1));
      if (q && q.cycleId === current) {
        (byUser[k.slice(0, i)] = byUser[k.slice(0, i)] || []).push(k);
      }
    });
    var changed = false;
    Object.keys(byUser).forEach(function (u) {
      var keys = byUser[u];
      for (var i = 0; i < keys.length - 1; i++) {
        var q = postById(s, keys[i].slice(keys[i].indexOf(":") + 1));
        if (q) q.votes = Math.max(0, q.votes - 1);
        delete s.votes[keys[i]];
        changed = true;
      }
    });
    if (changed) save(s);
    return changed;
  }

  function publishPost(s, userId, cycleId, topic, body, nowEt, lang) {
    if (userPostInCycle(s, userId, cycleId)) return null;
    /* Sunday 11:59 PM ET cutoff (TY, Nov 4): posting into a past-votingEnd cycle is rejected, same as voting. */
    if (!cycleVotingOpen(s, cycleId, nowEt || null)) return null;
    s.userSeq += 1;
    s.refSeq += 1;
    var now = new Date();
    var post = {
      id: "u-" + now.getTime().toString(36) + "-" + s.userSeq,
      ref: refLetter(s.topics, topic) + "-" + pad4(s.refSeq),
      cycleId: cycleId,
      authorId: userId,
      topic: topic,
      body: body,
      lang: (typeof lang === "string" && lang) ? lang : "und",
      authorState: (citizenById(s, userId).state || ""),
      votes: 0,
      createdAt: etStamp(nowEt || now),
      displayDate: "just now"
    };
    post.hash = hashPost(s, post);
    s.posts.push(post);
    save(s);
    return post;
  }

  /* "We can't do this" determinations and "Why can't we do this?" challenges.
     All records live on the briefing item and persist with the normal state
     save. No post or answer text is ever modified here. Every mutator returns
     {ok:true,...} or {ok:false,reason:...} and leaves the item untouched on
     failure. A determination is identified by determinationId, bumped each
     time a "We can't do this" verdict is newly recorded, so one appeal per
     determination is enforceable. */
  function setNoAction(item, f) {
    f = f || {};
    if (!item) return { ok: false, reason: "no-item" };
    if (!String(f.citedAuthority || "").trim()) return { ok: false, reason: "need-authority" };
    if (!String(f.whatWouldChange || "").trim()) return { ok: false, reason: "need-path" };
    if (!String(f.redirectTo || "").trim()) return { ok: false, reason: "need-redirect" };
    if (f.committeeVote !== true) return { ok: false, reason: "need-vote" };
    item.trackerStatus = "No Action";
    item.citedAuthority = String(f.citedAuthority);
    item.whatWouldChange = String(f.whatWouldChange);
    item.redirectTo = String(f.redirectTo);
    item.committeeVote = true;
    item.determinationId = (item.determinationId || 0) + 1;
    return { ok: true, determinationId: item.determinationId };
  }
  function openAppeal(item) {
    if (!item) return null;
    var det = item.determinationId || 0;
    var ap = item.appeals || [];
    for (var i = 0; i < ap.length; i++) {
      if (ap[i] && ap[i].determinationId === det && !ap[i].outcome) return ap[i];
    }
    return null;
  }
  function appealFor(item, det) {
    var ap = (item && item.appeals) || [];
    for (var i = 0; i < ap.length; i++) {
      if (ap[i] && ap[i].determinationId === det) return ap[i];
    }
    return null;
  }
  function fileAppeal(item, f) {
    if (!item) return { ok: false, reason: "no-item" };
    if (item.trackerStatus !== "No Action") return { ok: false, reason: "not-noaction" };
    if (!f || !f.by) return { ok: false, reason: "need-citizen" };
    var det = item.determinationId || 0;
    var ap = item.appeals || (item.appeals = []);
    if (appealFor(item, det)) return { ok: false, reason: "already-appealed" };
    var a = { determinationId: det, by: f.by, name: f.name || "", date: f.date || "", text: String(f.text || ""), outcome: null };
    ap.push(a);
    item.trackerStatus = "In Progress";
    return { ok: true, appeal: a };
  }
  function reviewAppeal(item, outcome) {
    if (!item) return { ok: false, reason: "no-item" };
    var a = openAppeal(item);
    if (!a) return { ok: false, reason: "no-open-appeal" };
    var d = (outcome && outcome.decision) || "";
    if (d !== "upheld" && d !== "reinstated") return { ok: false, reason: "need-decision" };
    a.outcome = { decision: d, note: String((outcome && outcome.note) || ""), date: (outcome && outcome.date) || "" };
    if (d === "reinstated") {
      item.trackerStatus = "No Action";
      item.determinationId = (item.determinationId || 0) + 1;
    }
    return { ok: true, appeal: a };
  }
  function raiseChallenge(item, f) {
    if (!item) return { ok: false, reason: "no-item" };
    if (!f || !f.by) return { ok: false, reason: "need-citizen" };
    if (!String(f.solution || "").trim()) return { ok: false, reason: "need-solution" };
    var ch = item.challenges || (item.challenges = []);
    var c = { id: "ch" + (ch.length + 1), raisedBy: f.by, raisedName: f.name || "", date: f.date || "",
      solution: String(f.solution), status: "open", answer: null };
    ch.push(c);
    return { ok: true, challenge: c };
  }
  function answerChallenge(item, challengeId, f) {
    if (!item) return { ok: false, reason: "no-item" };
    var ch = item.challenges || [], c = null, i;
    for (i = 0; i < ch.length; i++) { if (ch[i] && ch[i].id === challengeId) { c = ch[i]; break; } }
    if (!c) return { ok: false, reason: "no-challenge" };
    if (c.status !== "open") return { ok: false, reason: "already-answered" };
    if (!String(f.text || "").trim()) return { ok: false, reason: "need-answer" };
    if (!String(f.citedAuthority || "").trim()) return { ok: false, reason: "need-authority" };
    if (!String(f.whatWouldChange || "").trim()) return { ok: false, reason: "need-path" };
    if (!String(f.redirectTo || "").trim()) return { ok: false, reason: "need-redirect" };
    c.answer = { text: String(f.text), citedAuthority: String(f.citedAuthority),
      whatWouldChange: String(f.whatWouldChange), redirectTo: String(f.redirectTo), date: f.date || "" };
    c.status = "answered";
    return { ok: true, challenge: c };
  }
  function addResponse(item, f) {
    if (!item) return { ok: false, reason: "no-item" };
    if (!f || !f.by) return { ok: false, reason: "need-citizen" };
    if (!String(f.text || "").trim()) return { ok: false, reason: "need-text" };
    if (["record", "challenge", "update"].indexOf(f.kind) < 0) return { ok: false, reason: "need-target" };
    var rs = item.responses || (item.responses = []);
    for (var i = 0; i < rs.length; i++) {
      if (rs[i] && rs[i].by === f.by && rs[i].kind === f.kind && String(rs[i].id) === String(f.id)) {
        return { ok: false, reason: "already-responded" };
      }
    }
    var r = { by: f.by, name: f.name || "", date: f.date || "", text: String(f.text), kind: f.kind, id: String(f.id) };
    rs.push(r);
    return { ok: true, response: r };
  }

  return {
    currentCycleId: currentCycleId,
    load: load,
    save: save,
    citizenById: citizenById,
    postById: postById,
    postByRef: postByRef,
    cycleById: cycleById,
    briefingItemFor: briefingItemFor,
    itemsForCycle: itemsForCycle,
    postsForCycle: postsForCycle,
    findExactInCycle: findExactInCycle,
    userPostInCycle: userPostInCycle,
    hasVoted: hasVoted,
    userVoteInCycle: userVoteInCycle,
    cycleVotingOpen: cycleVotingOpen,
    castVote: castVote,
    cycleDateTime: cycleDateTime,
    cycleYear: cycleYear,
    displayDateFor: displayDateFor,
    replayCycles: replayCycles,
    replayReady: replayReady,
    publishPost: publishPost,
    sha256: sha256Hex,
    hashPost: hashPost,
    etStamp: etStamp,
    auditAppend: auditAppend,
    setNoAction: setNoAction,
    openAppeal: openAppeal,
    appealFor: appealFor,
    fileAppeal: fileAppeal,
    reviewAppeal: reviewAppeal,
    raiseChallenge: raiseChallenge,
    answerChallenge: answerChallenge,
    addResponse: addResponse,
    verifyAudit: verifyAudit
  };
})();
