/* The Podium — UI wiring. No framework, no network calls. */
(function () {
  "use strict";

  /* Scroll behavior (TY, Oct 28): every full load starts at the top,
     regardless of where the user was scrolled before refreshing. Belt
     and braces for this static app: disable browser scroll restoration
     and scroll to top on load, timed so a late restoration cannot
     override it. Deep-link loads (#post/...) are exempt — the app scrolls
     those to the linked post by design. Tab-click scrolling is untouched. */
  try {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  } catch (e) { /* older engine: the load handler below still applies */ }
  function startAtTop() {
    if (/^#post\//.test(window.location.hash || "")) return;
    window.scrollTo(0, 0);
  }
  window.addEventListener("load", function () {
    startAtTop();
    if (window.requestAnimationFrame) window.requestAnimationFrame(startAtTop);
    setTimeout(startAtTop, 0);
  });

  var state = PodiumStore.load(etNow());
  var currentView = "feed";

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function excerpt(body, n) {
    if (body.length <= n) return body;
    return body.slice(0, n).replace(/\s\S*$/, "") + "\u2026";
  }
  function votesLabel(n) {
    return n + " " + (n === 1 ? T("vote.one") : T("vote.many"));
  }
  /* Frozen author state (display metadata only; empty means none shown). */
  function stateSuffix(p) {
    return p && p.authorState ? " \u00b7 " + esc(p.authorState) : "";
  }
  /* Frozen language tag, step 1 of the multilingual slice: rendered beside
     the author/state line in the existing muted meta style. "und" (and a
     missing tag) renders nothing. Guarded: without Intl, or for a code
     Intl does not know, the raw code shows. */
  var langDisplayNames = null;
  try {
    if (typeof Intl !== "undefined" && Intl.DisplayNames) {
      langDisplayNames = new Intl.DisplayNames(["en"], { type: "language" });
    }
  } catch (e) { langDisplayNames = null; }
  function langName(p) {
    var code = p && typeof p.lang === "string" ? p.lang : "";
    if (!code || code === "und") return "";
    if (langDisplayNames) {
      try {
        var n = langDisplayNames.of(code);
        if (n) return n;
      } catch (e) { /* unknown code: show it raw below */ }
    }
    return code;
  }
  function langSuffix(p) {
    var n = langName(p);
    return n ? ' \u00b7 <span class="hint">' + esc(n) + "</span>" : "";
  }
  /* ---------- interface language (multilingual slice, step 3) ----------
     All user-visible chrome renders through the strings table
     (js/strings.js, exposed as PodiumStrings): en values are the verbatim
     pre-existing English; es values translate. Every es branch is gated
     on the stored language. Post bodies, names, states, refs, votes,
     numbers, and dates never pass through here.
     The test runner does not load js/strings.js, so when PodiumStrings is
     absent the helpers fall back to EN_CHROME below: a mechanical copy of
     the table en column (verified identical), English-only. No test file
     is touched for this. */
  var EN_CHROME = {
    /* document */
    "doc.title": "The Podium \u2014 A Civic Portal",
    "skip.main": "Skip to main content",
    "gov.text": "An official website of the United States government",
    "gov.how": "Here\u2019s how you know.",
    "gov.h1": "Official websites use .gov",
    "gov.b1": "A .gov website belongs to an official government organization in the United States.",
    "gov.h2": "Secure .gov websites use HTTPS",
    "gov.b2": "A lock {lock} or https:// means you\u2019ve safely connected to the .gov website. Share sensitive information only on official, secure websites.",
    /* header */
    "brand.sub": "The purpose of this platform is to ensure that every citizen has the opportunity to be heard by the nation.",
    "citizen.signedout": "Not signed in",
    "citizen.signin": "Sign in",
    "citizen.signedin": "Signed in as",
    "citizen.switch": "Switch citizen",
    "citizen.current": " (current)",
    "citizen.verified": "\u2713 Verified (demo)",
    "citizen.verified.chip": "\u2713 Verified citizen (demo)",
    "citizen.verified.small": "\u2713 verified (demo)",
    "citizen.verified.title": "Simulated verification for demo",
    "lang.label": "Language",
    /* tabs */
    "tab.feed": "Live Feed",
    "tab.briefing": "The Weekly Briefing",
    "tab.prior": "Prior Posts & Answers",
    "tab.status": "Status Updates",
    "tab.watch": "Watch Live",
    "tab.post": "Submit Post",
    "tab.committee": "Committee",
    /* committee roster */
    "committee.aria": "Citizen committee roster",
    "committee.lede": "The committee is 12 ordinary verified citizens, chosen by random draw, serving 12-week terms, with one new citizen joining every week. The committee works for the citizen whose post was selected \u2014 it reviews and approves the answers, and follows through until the issue is resolved. It does not fund; it asks for and allocates funds.",
    "committee.week": "Week {n} of 12",
    "committee.terms": "Term start: {start} \u00b7 Cycles out: {out}",
    "committee.joined": "Joined this week",
    "committee.cycling": "Cycles out next week",
    "committee.draw": "Selected by random draw",
    "committee.draw.beacon": "Beacon timestamp",
    "committee.draw.value": "Beacon value",
    "committee.draw.pool": "Pool size",
    "committee.draw.pos": "Draw position",
    "committee.note": "One citizen cycles out and one new citizen joins every week, so the committee is always 12 people with a mix of experience.",
    "committee.rules.summary": "Committee rules \u2014 selection, pay, structure & schedule",
    "committee.rules.selection.heading": "How members are selected",
    "committee.rules.selection.body": "Twelve ordinary verified citizens, chosen by random draw from a national pool using the NIST Randomness Beacon \u2014 the same method as the post draw, proof against rigging. Selection is a summons, not a draft: if your name comes up, you agree to serve or decline and the next citizen is drawn. To serve you must be a verified citizen, 18 or older, with no post in the current cycle, not a government employee, and not currently incarcerated or on parole or probation \u2014 a past felony does not exclude you; eligibility returns 5 years after the sentence is fully complete. Terms are 12 weeks, one new citizen joins every week, and after cycling out you sit out 12 weeks. No more than 2 terms per year. No committee member can submit a post while serving on the committee, for the whole 12-week term.",
    "committee.rules.pay.heading": "Pay",
    "committee.rules.pay.body": "Members are paid $150 per day, for Friday and Saturday ($300 a week). The solo thinking days are not separately paid. Travel, hotel, and meals for the weekly in-person meeting are covered separately at government rates and booked directly \u2014 members never pay out of pocket \u2014 plus childcare support for in-person days. The pay is $150 flat, no top-up. The plan isn't for committee members to get rich off this \u2014 it's more of a public service.",
    "committee.rules.structure.heading": "Structure",
    "committee.rules.structure.body": "Twelve members, each holding an equal share of the decision-making power. Government agency liaisons advise only and do not vote. Each week the committee receives the selected posts and the AI-drafted answers and votes on whether to follow the AI suggestions. A split vote means no action on that post this week and the post reverts to shine light \u2014 it is still read aloud and tracked, never buried. The narrator and the committee spokesperson are permanent salaried roles who present only: the narrator reads posts word-for-word and the spokesperson presents the committee's approved answers. Neither has any authority over posts or answers. If either quits or is fired, the committee hires a replacement \u2014 hired by the committee, fired by the committee by vote, against public criteria.",
    "committee.rules.schedule.heading": "Weekly schedule",
    "committee.rules.schedule.body": "Members receive the selected posts as soon as they are selected and have 3 days on their own to think about them. They all meet in person on Friday to deliberate and vote, and on Saturday to send the agency requests and set tracking in motion. The agency's response arrives Wednesday morning by video call, and the narrator and the committee spokesperson make the script and record live at 1:00 PM ET. The Podium funds a round-trip ticket and a hotel for every member every week.",
    /* answer approver (answerer of record) */
    "approver.prefix": "Reviewed and approved by",
    "approver.suffix": "civilian committee member, Week {week} of 12",
    "approver.bycommittee": "Reviewed and approved by the committee.",
    "approver.committee": "the committee",
    "tab.watchlive.badge": "LIVE",
    "tab.watchlive.airing": "Watch Live, briefing on air now",
    "nav.primary": "Primary",
    /* verbatim rule card */
    "rule.heading": "The Verbatim Rule",
    "rule.reminder": "Reminder of the rule",
    "rule.p1": "By the rules of this portal, the highest-voted post <strong>MUST</strong> be read aloud \u2014 word for word, exactly as its author wrote it \u2014 and discussed, by a representative of the United States, in front of the entire country. Another post, drawn at random, must be read and discussed the same way.",
    "rule.p2": "AI will be used to detect profanity and errors, correct grammar, and suggest clearer formatting. It will never steer you: your topic, your position, or your meaning. And once your post is published, it is final.",
    "rule.p3": "Keep in mind that your post may be read in front of the entire nation. Write in your most professional manner. Profanity, slang, and ridicule will not post. State your idea or concern plainly and professionally. You are not posting a comment. You are addressing the nation \u2014 speaking to and for every American. Treat it with the seriousness it deserves.",
    "rule.p4": "Even if the committee cannot resolve an issue, it has at least brought light to the concern. That is the fundamental purpose of this platform: to shine a light on concerns and ideas, and to seek to resolve them or implement helpful changes.",
    "rule.readfull": "Read the full rule",
    /* fine print */
    "fine.summary": "Fine print (official register)",
    "fine.lede": "All submissions are subject to automated pre-publication review. Submissions containing profanity, slurs, or personal attacks shall not be published. Submissions containing slang or errors materially affecting comprehensibility shall be held pending correction by the submitting party, with suggested revisions provided for consideration; no submission shall be altered by the System without the submitting party\u2019s express action. Weekly selections shall consist of (i) the submission receiving the highest number of votes during the applicable period and (ii) one (1) submission selected by random drawing from among all eligible published submissions. Selected submissions shall be read aloud in their entirety, verbatim, and discussed in the weekly briefing. A published submission is final and shall not be edited or redacted.",
    "fine.statements": "Statements of policy, principles, and fundamentals",
    "fine.purpose": "The purpose of this platform is to ensure that every citizen has the opportunity to be heard by the nation. Citizens will address the nation and speak on its behalf.",
    "fine.li1": "The highest-voted post and one randomly drawn post are read aloud in full, word for word, by a representative of the United States and discussed in the weekly briefing. No editor stands between author and nation. Nothing is edited after posting.",
    "fine.li2": "AI detects problems and suggests wording only before publication. It never steers a post's topic, position, or meaning, and never changes, substitutes, or declines a post on its own.",
    "fine.li3": "Profanity, slurs, and personal attacks are blocked outright and never publish. Slang, misspellings, grammar, and unclear text are held with suggested rewording; the author accepts the suggestion or retypes the text, and AI never changes text silently. Held drafts are not published, do not enter the draw, and do not use the citizen's one-post slot.",
    "fine.li4": "Once published, a post is final. It cannot be deleted, withdrawn, archived, or hidden.",
    "fine.li5": "Voting is upvote-only. Each citizen casts one vote per weekly cycle, switchable until voting closes Sunday at 11:59 PM ET.",
    "fine.li6": "Each citizen may submit one post per weekly cycle.",
    "fine.li7": "Posts are limited to 630 words.",
    "fine.li8": "The random draw is proof against rigging: the eligible pool is frozen in a fixed published order at the cutoff, and the position is the NIST Randomness Beacon value modulo the pool size, plus one. The draw is internal only, with no button, replay, or re-roll.",
    "fine.li9": "The committee prepares answers only. It never alters, substitutes, delays, or declines a selection. It reviews selections one week in advance and routes each answer to the correct branch and level.",
    "fine.li10": "The committee does not fund. It asks for funds and allocates funds.",
    "fine.li11": "Committee answers begin as AI drafts that the committee votes on as written \u2014 never edited \u2014 and approves as the committee, the answerer of record; no individual member is named. AI never delivers a final answer alone and never touches a citizen post. The drafts are public: the public sees the drafts and the vote, not only approved answers.",
    "fine.li12": "An exact-duplicate post in the same cycle does not create a new post; the citizen is offered an upvote on the existing post, with no option to post it anyway. The draw pool excludes the winner and any post exactly matching the winner. Similar-but-distinct posts are advisory only.",
    "fine.li13": "The Live Feed shows the current cycle only. Posts from past cycles that were never selected are deleted; selected posts are kept as the briefing record.",
    "fine.li14": "Posting and voting run from Monday 12:00 AM to Sunday 11:59 PM ET. The pool freezes at the Sunday cutoff, the draw is Monday at 12:00 PM ET, the committee has the week plus a Monday–Tuesday buffer, and the briefing airs Wednesdays at 1:00 PM ET as the fixed opening segment.",
    "fine.li15": "This Week shows only the most recently aired briefing. Next Week shows the next briefing's selections. A briefing's replay is published when that briefing airs. Prior Posts & Answers and Status Updates list aired selections only.",
    "fine.li16": "Participation is limited to verified citizens; in this demo, verification is simulated only, and no real identification is collected or stored.",
    "fine.li17": "Language: a citizen may post in any language. The original post is the official record and is read aloud verbatim in the author's language. Translations are machine aids for readers and never replace the original.",
    "fine.li18": "Live activity: when \u2018Simulate live activity\u2019 is enabled, the feed shows AI-generated demonstration posts, clearly labeled. They are never voted on, never drawn, and never briefed.",
    "fine.li19": "Mock accounts: signing up stores a local profile in this browser only, with no real identity verification.",
    "fine.li20": "Real sign-in/sign-up: shown as a preview; the backend and text verification are not yet built.",
    "fine.li21": "Security: every post carries a SHA-256 hash, and every action is recorded in a hash-chained audit log.",
    /* feed */
    "feed.aria": "Feed of citizen posts",
    "feed.order": "Feed order",
    "feed.order.aria": "Feed order",
    "watch.demo.aria": "Preview broadcast state",
    "feed.recent": "Recent",
    "feed.top": "Top Voted",
    "feed.needs": "Needs Votes",
    "feed.discover": "Discover",
    "feed.topic": "Topic",
    "feed.alltopics": "All topics",
    "feed.topicfilter.aria": "Filter by topic",
    "feed.search": "Keyword search",
    "feed.search.ph": "e.g. bridges, school lunches",
    "feed.perpage": "Per page",
    "feed.voterule": "Each citizen casts one vote per weekly cycle, switchable until voting closes Sunday at 11:59 PM ET.",
    "feed.prev": "\u2190 Prev",
    "feed.next": "Next \u2192",
    "feed.page": "Page",
    "feed.page.of": "of",
    "feed.opened.open": "You opened a shared post. Sign in to upvote it. ",
    "feed.opened.past": "You opened a shared post from a past week. Voting is closed on past weeks\u2019 posts. ",
    "feed.showfull": "Show full feed",
    "feed.gone": "This post is no longer available. Posts that are not selected for a weekly briefing are removed when their cycle closes. ",
    "feed.gone.li": "This post is no longer available. Posts that are not selected for a weekly briefing are removed when their cycle closes.",
    "feed.nocode": "No item with code {code}.",
    "feed.nocode.li": "No post, answer, or update carries that code.",
    "feed.code.thread": "Code {code}: jumping to that item in the thread.",
    "feed.code.record": "Code {code}: post plus its answer and updates.",
    "feed.note.top": "Highest-voted first. This week\u2019s leader becomes the top-voted briefing pick.",
    "feed.note.needs": "Least-voted first, so unseen posts surface. These are this week\u2019s posts \u2014 voting is open on all of them.",
    "feed.note.discover": "Shuffled for discovery \u2014 re-pick Discover for a fresh shuffle. These are this week\u2019s posts \u2014 voting is open on all of them.",
    "feed.note.results.one": "1 result(s).",
    "feed.note.results.many": "{n} result(s).",
    "feed.note.recent": "Newest first. These are this week\u2019s posts \u2014 voting is open on all of them.",
    "feed.note.filtered": " Filtered to topic \u201c{topic}\u201d ({n}).",
    "feed.empty": "No posts here yet.",
    "livefeed.toggle": "Simulate live activity",
    "livefeed.note": "Generated demonstration posts \u2014 simulated live activity. They are never voted on, drawn, or briefed.",
    "livefeed.badge": "Live demo",
    "livefeed.cap": "The simulation has shown 10 demonstration posts.",
    "autotranslate.toggle": "Auto-translate to {language}",
    "translate.progress": "Translating\u2026",
    "autotranslate.nokey": "Auto-translate needs an API key in the footer.",
    "feed.fullrecord": "See full record",
    "feed.fullrecord.ref": "Full record: {ref}",
    /* votes */
    "vote.up": "\u25b3 Upvote",
    "vote.upvoted": "\u25b2 Upvoted",
    "vote.one": "vote",
    "vote.many": "votes",
    "vote.yours": " \u00b7 Your vote",
    "vote.closed": " \u00b7 voting closed",
    "vote.upvoteit": "Upvote it instead",
    "vote.upvoted.check": "Upvoted \u2713",
    "vote.closedweek": "Voting closed (past week)",
    "vote.simulated": " \u00b7 Simulated votes \u2014 demo only",
    "share.button": "Share",
    "share.copied": "Link copied \u2713",
    "share.failed": "Copy failed",
    "cycle.voting": "voting now",
    "date.now": "just now",
    /* badges + selection words */
    "badge.top": "Top-voted",
    "badge.random": "Random pick",
    "selbadge.top": "TOP-VOTED",
    "selbadge.random": "RANDOM DRAW",
    "selbadge.position": "position",
    "selbadge.of": "of",
    "lib.top": "Top-voted",
    "lib.random": "Random draw",
    "thread.top": "top-voted",
    "thread.random": "random draw",
    "seltitle.top": "Top-voted selection",
    "seltitle.random": "Random-draw selection",
    "pipe.top": "top-voted",
    "pipe.random": "random pick",
    "pipe.none": "not yet selected",
    "stage.selected": "Selected",
    "stage.committee": "In Committee Review",
    "stage.briefed": "Briefed",
    "stage.aria": "Pipeline stage: {stage}",
    "stage.inline.selected": "selected",
    "stage.inline.committee": "in committee",
    "stage.inline.briefed": "briefed",
    /* thread */
    "thread.answer": "Official Answer",
    "thread.update": "Update",
    "thread.thispost": "this post",
    "translate.button": "Translate",
    "translate.label": "Machine translation to English \u2014 the original above is the official record.",
    "translate.unavailable": "Translation unavailable right now.",
    /* composer */
    "post.aria": "Post composer",
    "post.rule.applies": "The Verbatim Rule applies.",
    "post.rule.text": "Your post may be read aloud, word for word, in front of the entire nation. Profanity, slang, and ridicule will not post. Once published, it is final.",
    "post.rule.reminder": "Your post may be read aloud, word for word, in front of the entire nation. Profanity, slang, and ridicule will not post. Once published, it is final.",
    "notice.signin": "<strong>Sign in to post.</strong> Pick a demo citizen to address the nation. ",
    "notice.published.a": "<strong>Each citizen may submit one post per weekly cycle.</strong> You already published this week (",
    "notice.published.b": "). You can still vote on this week\u2019s posts.",
    "post.topic": "Topic",
    "post.topic.hint": "Pick a topic, or accept the single AI suggestion at review.",
    "post.timer.hint": "read-aloud time \u00b7 max 630 words",
    "post.address": "Your address to the nation",
    "post.text.ph": "State your idea or concern plainly and professionally\u2026",
    "ai.live": "AI: live (Muse Spark)",
    "ai.stub": "AI: local fallback",
    "gate.overlimit": "Too long for the national reading: {n} of 630 words maximum. Shorten your post to fit the 4:30 read-aloud slot.",
    "gate.hard": "<strong>Cannot publish:</strong> this draft contains {spans}, which counts as profanity, a slur, or a personal attack. Such posts are never published. Remove it and keep your address professional.",
    "gate.soft": "<strong>Held for your correction:</strong> {n} wording issue(s) do not meet the formal standard for a national address. Accept a suggestion or retype the word yourself \u2014 nothing changes without your action.",
    "chip.use": "Use \u201c{sug}\u201d",
    "chip.remove": "Remove it",
    "chip.aria.replace": "Replace {w} with {s}",
    "chip.aria.remove": "Replace {w} by removing it",
    "gate.punct": "Punctuation and spacing need a touch-up \u2014 one click fixes double spaces, spaces before punctuation, and the final period. ",
    "gate.punct.fix": "Fix punctuation and spacing",
    "gate.unclear": "<strong>Held so you can be heard clearly:</strong> this draft is hard to understand as written, so it cannot publish yet. This is not a refusal \u2014 your post is not declined. Use the help below, or fix the draft yourself; you can return and publish at any time.",
    "gate.ok": "Wording check passed. Your topic, position, and meaning are yours alone \u2014 the check never touches them.",
    "reason.live": "Live wording check.",
    "offer.built": "Built only from your answers:",
    "offer.proposed": "Proposed version \u2014 same meaning, clearer words:",
    "offer.until": " Nothing publishes until you click \u201cUse this version.\u201d",
    "offer.yours": "Your words:",
    "offer.version": "Proposed version:",
    "offer.use": "Use this version",
    "offer.keep": "Keep my words",
    "offer.hear": "Hear the proposed version",
    "offer.novoice": "Your browser cannot read aloud; please read the proposed version above before approving.",
    "prompts.title": "Help us understand \u2014 answer in your own words:",
    "prompts.nooffer": " no rewrite is offered because no clear position could be found in the draft. Nothing is invented: a draft is built only from your answers, and only with your approval.",
    "prompts.what": "What happened?",
    "prompts.want": "What do you want fixed or changed?",
    "prompts.who": "Who should fix it?",
    "prompts.build": "Build my draft from these answers",
    "prompts.needone": "Answer at least one question above, in your own words.",
    "prompts.badwords": "These answers cannot be used as written: they contain wording that can never publish. Change the flagged words and try again.",
    "hear.draft": "Hear this draft",
    "hear.novoice": "Your browser cannot read text aloud.",
    "preview.hear": "Hear it as the nation will",
    "preview.publish": "Publish (final)",
    "preview.back": "Back to editing",
    "preview.title": "Weekly briefing \u2014 verbatim reading",
    "preview.words": "words",
    "preview.readaloud": "read aloud",
    "preview.suggest.a": "AI topic suggestion, shown once at review \u2014 yours to accept or ignore: <strong>",
    "preview.suggest.b": "</strong> ",
    "preview.usetopic": "Use this topic",
    "publish.note": "Publishing is final: posts cannot be edited or redacted. The AI checks wording only \u2014 never your topic, position, or meaning.",
    "publish.done": "Published \u2014 final. Your post cannot be edited or redacted. It now stands for this week\u2019s vote.",
    "voiced.title": "Already voiced",
    "voiced.dismiss": "\u00d7 Dismiss",
    "voiced.dismiss.aria": "Dismiss this suggestion",
    "voiced.reminder": "A conflicting post may divide votes and reduce the likelihood of your concern being heard.",
    "voiced.instead": "Vote for theirs instead",
    "voiced.both": "Post mine and vote theirs too",
    "voiced.asis": "Post mine as-is",
    "copy.exists": "This post already exists in this cycle \u2014 upvote it to add your voice.",
    "copy.existing": "<strong>Existing post:</strong> \u201c{quote}\u201d",
    /* citizen modal */
    "citizens.title": "Switch demo citizen",
    "citizens.hint": "Simulated sign-in. No real identity is used. Pick any demo citizen to post and vote as them.",
    "citizens.vote": "Sign in to vote \u2014 pick a demo citizen. No sign-in, no vote.",
    "citizens.post": "Sign in to post \u2014 pick a demo citizen.",
    "citizens.cancel": "Cancel",
    "mock.demopath": "Try as a demo citizen",
    "mock.ownpath": "Or use your own local account",
    "mock.name": "Display name",
    "mock.email": "Email",
    "mock.password": "Password",
    "mock.state": "State",
    "mock.state.unset": "State not set",
    "mock.signin": "Sign in",
    "mock.signup": "Sign up",
    "mock.tosignin": "Back to sign in",
    "mock.forgot": "Forgot password?",
    "mock.forgotnote": "This demo cannot email you a reset link. To start over, clear this site's data in your browser.",
    "mock.nomatch": "Email or password doesn't match an account in this browser.",
    "mock.incomplete": "Fill in every field to create the account.",
    "mock.exists": "An account already exists in this browser. Sign in with it, or clear this site's data to start over.",
    "mock.verify": "Verify identity",
    "mock.verifynote": "In the real product, your identity is verified (SSN) before you can post. This demo does not collect SSNs.",
    "mock.browsernote": "This account lives only in this browser. No real verification, no server.",
    "mock.signout": "Sign out",
    "real.heading": "Real account \u2014 coming soon",
    "real.note": "Preview only \u2014 the real sign-in/sign-up needs a backend and a texting service, which are not yet built. Nothing here is saved or sent.",
    "real.phone": "Phone number",
    "real.sendcode": "Send verification code",
    "real.code": "6-digit code",
    "real.smsnote": "The real product texts a 6-digit code to your phone. Enter it here to verify. This demo cannot send texts \u2014 the backend and texting service are not yet built.",
    "real.incode": "Send me a sign-in code",
    "real.innote": "Sign in with your password plus a texted code, or with a texted code alone.",
    /* briefing */
    "briefing.aria": "Weekly briefing",
    "briefing.title": "This week\u2019s briefing \u2014 {date}",
    "briefing.lede1": "Two posts take the majority of the segment: the highest-voted post and one post drawn at random. Both are read aloud verbatim and answered. Follow-ups on earlier posts get only a brief live mention; the full record lives under Prior Posts & Answers and Status Updates.",
    "briefing.lede2": "The locked weekly schedule (all times ET): posting and voting week Monday 00:00 \u2192 Sunday 23:59; cutoff Sunday 23:59, when the eligible pool is frozen and published; draw Monday 12:00, pre-announced; committee week Monday \u2192 Sunday to evaluate both selected posts and formulate both answers \u2014 answers ONLY, it can never alter, substitute, delay, or decline a selection; briefing Wednesday 1:00 PM. The Podium segment is the fixed opening segment of the Wednesday briefing: if no regular briefing is scheduled that Wednesday, the segment still runs standalone at the same time, same room, same cameras.",
    "briefing.watch": "Watch Live \u2192",
    "briefing.watch.hint": "Attend the airing of this briefing.",
    "briefing.next": "Next Week",
    "briefing.next.hint": "Selected posts in committee review. Answers are still being formulated \u2014 never presented as final. These selections are published after the Monday draw, once the draw has selected the posts: the full posts for the next briefing appear here from the draw onward, in full, with answers coming on the briefing date.",
    "briefing.draw": "The random draw \u2014 verifiably fair",
    "briefing.draw.lede": "The eligible pool is frozen and published <em>first</em> (all gate-passed posts since the last draw, minus the top-voted winner). The system runs the draw at the pre-announced time: <code>position = beacon value modulo the pool size + 1</code>. Random selection is conducted using the NIST Randomness Beacon.",
    "briefing.draw.excluded": "Excluded from the pool",
    "briefing.draw.readonly": "Read-only record: pool size, beacon timestamp and value, computed position, and the drawn post. The draw is an internal system function \u2014 nothing here re-runs it.",
    "briefing.draw.worked": "Worked example",
    "briefing.draw.worked.body": "Pool of 12, beacon value ending \u20264839 \u2192 4839 mod 12 = 3 \u2192 +1 = <strong>post #4</strong>.",
    "briefing.draw.committee": "Committee rule: the committee prepares answers ONLY. It can never alter, substitute, delay, or decline a selected post. It has one week to formulate an answer and route the topic to the right branch or level of government.",
    "draw.cycle": "Cycle",
    "draw.frozen": "Pool frozen",
    "draw.frozen.val": "{cutoff} \u2014 {n} eligible posts (winner and winner-matching copies excluded), published before the draw",
    "draw.beacon": "Beacon pulse",
    "draw.beacon.val": "{time} \u2014 value {hex} (numeric excerpt {num})",
    "draw.computation": "Computation",
    "draw.computation.val": "{num} mod {size} = {r} \u2192 +1 = post #{pos}",
    "draw.selected": "Selected",
    "draw.winner": "already has the briefing\u2019s top slot",
    "draw.dupe": "anti-flood deduplication (content matches the winner\u2019s)",
    "draw.readfull": "Read full post",
    "draw.collapse": "Collapse",
    "zone.post.excerpt": "Citizen Post \u2014 excerpt, verbatim",
    "zone.post.full": "Citizen Post \u2014 in full, verbatim",
    "zone.post.read": "Read verbatim in full",
    "zone.answer.excerpt": "Official Answer \u2014 excerpt",
    "zone.answer.full": "Official Answer \u2014 in full",
    "zone.answer.read": "Read answer in full",
    "zone.summary": "Show summary",
    "zone.post.screening": "Citizen Post \u2014 verbatim",
    "zone.answer.screening": "Committee Answer \u2014 verbatim",
    "zone.post.next": "Citizen Post \u2014 verbatim in full",
    "zone.post.final": "Citizen Post \u2014 verbatim, final",
    "next.selectedfor": "\u2014 {name} \u00b7 selected for next week\u2019s briefing",
    "next.answercoming": "Answer coming {date}. The committee is still formulating it.",
    "wonder.draft": "Draft answer with Wonder",
    "wonder.visibility": "Drafts are public: the public sees the drafts and the vote, not only approved answers. Drafts are never edited: the committee votes on each draft as written and approves as the committee, with no individual member named.",
    "wonder.simulated": "Demo only: in the real product the committee reviews and approves drafts; approval here is simulated and changes only what is displayed.",
    "wonder.pending": "AI-drafted by Muse Wonder \u2014 pending committee review",
    "wonder.approve": "Approve draft",
    "wonder.decline": "Decline draft",
    "wonder.declined.note": "Declined by the committee. This post reverts to shine light: it will still be read aloud at the briefing and tracked, never buried.",
    "wonder.drafting": "Drafting with Muse Wonder ({model})...",
    "wonder.retrying": "Retrying the Muse Wonder draft request...",
    "wonder.unavailable": "Muse Wonder is unavailable (no session key, or the call failed) \u2014 the seeded answer above stands. Answers are never drafted by Spark.",
    "wonder.err.timeout": "Muse Wonder timed out after repeated tries \u2014 the seeded answer above stands. Answers are never drafted by Spark.",
    "wonder.err.network": "Muse Wonder could not be reached (network failure) \u2014 the seeded answer above stands. Answers are never drafted by Spark.",
    "wonder.err.http": "Muse Wonder returned an error (HTTP {status}) \u2014 the seeded answer above stands. Answers are never drafted by Spark.",
    "wonder.approved": "Approved by committee (demo)",
    "wonder.nocites": "This draft carries no citations and no \u201cNo commitments in this answer\u201d declaration, so it cannot be approved.",
    "wonder.request": "Agency request \u2014 ready to send.",
    "wonder.copy": "Copy request",
    "wonder.notapproval": "An AI suggestion is not a government approval.",
    "frame.suggest": "Part 1 \u2014 AI suggestion: what was suggested",
    "frame.decide": "Part 2 \u2014 Committee decision: what was decided",
    "frame.commit": "Part 3 \u2014 Government commitments: what has been done or will be done",
    "cite.legend": "Citations",
    "cite.commitment": "Commitment",
    "cite.source": "Source",
    "cite.add": "Add citation",
    "cite.remove": "Remove",
    "cite.nocommit": "No commitments in this answer",
    "cite.commitment.ph": "Short quote of the commitment\u2026",
    "cite.source.ph": "Agency or authority\u2026",
    "cite.date": "Date",
    "cite.date.ph": "Date (e.g. Oct 28, 2026)",
    "cite.via": "via",
    "cite.liaison": "Liaison name + agency (optional)",
    "cite.liaison.ph": "e.g. J. Rivera, FDA liaison",
    "advice.legend": "Liaison advice shaping this answer",
    "advice.liaison": "Liaison name + agency",
    "advice.liaison.ph": "e.g. J. Rivera, FDA liaison",
    "advice.claim": "The claim",
    "advice.claim.ph": "Short text of the advice\u2026",
    "advice.authority": "Authority cited",
    "advice.authority.ph": "Regulation, statute, or policy + reference\u2026",
    "advice.date": "Date",
    "advice.date.ph": "Date (e.g. Oct 28, 2026)",
    "advice.outcome": "What the committee did",
    "advice.outcome.followed": "Followed",
    "advice.outcome.second": "Second opinion requested",
    "advice.outcome.notfollowed": "Not followed",
    "advice.add": "Record advice",
    /* prior + status */
    "prior.aria": "Prior posts and answers archive",
    "prior.lede": "The archive of past briefing selections: each item shows the original post, verbatim, plus the committee\u2019s answer. Check anytime \u2014 this is not part of the live show.",
    "thread.selected": "Selected post",
    "prior.updatelatest": "Most recent update",
    "prior.status": "Status:",
    "prior.tostatus": "Status updates for {ref} \u2192",
    "status.aria": "Status updates follow-through record",
    "status.lede": "The follow-through record: each item shows the dated progress updates plus the current status. Check anytime \u2014 this is not part of the live show.",
    "status.dated": "Dated progress updates",
    "status.toprior": "\u2190 Post and answer for {ref}",
    "sec.tamper": "This post does not match its recorded hash.",
    "audit.heading": "Audit log",
    "audit.lede": "Every action is recorded in a hash-chained log, newest first.",
    "audit.intact": "Audit log intact.",
    "audit.broken": "Audit log does not verify â€” entry {n}.",
    "audit.ev.genesis": "Log started",
    "audit.ev.post": "Post published",
    "audit.ev.vote": "Vote cast",
    "audit.ev.draw": "Draw run",
    "audit.ev.draft": "Answer drafted",
    "audit.ev.approve": "Answer approved",
    "audit.ev.decline": "Answer declined",
    "audit.ev.update": "Status update posted",
    "audit.ev.signin": "Sign-in",
    "audit.ev.signout": "Sign-out",
    "audit.ev.signup": "Mock sign-up",
    "audit.ev.liaisonAdvice": "Liaison advice",
    "noaction.label": "We can't do this.",
    "noaction.authority": "Cited authority",
    "noaction.change": "What would need to change",
    "noaction.redirect": "Who can do it instead",
    "noaction.vote": "Decided by committee vote",
    "noaction.authority.required": "A cited authority is required — name the regulation, statute, budget line, or jurisdiction.",
    "form.required": "This field is required.",
    "appeal.button": "I don't think this is right — appeal.",
    "appeal.by": "Appeal by {name} on {date}",
    "appeal.awaiting": "Awaiting committee re-review",
    "rereview.legend": "Committee re-review",
    "rereview.uphold": "Uphold appeal — back under review",
    "rereview.reject": "Reject appeal — determination stands",
    "rereview.outcome.upheld": "Appeal upheld — back under review",
    "rereview.outcome.rejected": "Appeal rejected — determination stands",
    "rereview.note.ph": "Re-review note (optional)",
    "challenge.legend": "Why did the committee decline?",
    "challenge.name": "Why did the committee decline?",
    "challenge.raise": "Record answer",
    "challenge.solution.label": "The committee's answer",
    "challenge.solution.ph": "Why the committee declined\u2026",
    "challenge.by": "Challenged by {name} on {date}",
    "challenge.awaiting": "Awaiting government answer",
    "challenge.answer.legend": "Government answer",
    "challenge.answer.ph": "The government's specific answer…",
    "challenge.answer.submit": "Record government answer",
    "response.legend": "Citizen response",
    "response.submit": "Respond",
    "response.ph": "Write your response…",
    "response.done": "You already responded here.",
    "demo.tracker.note": "Demo: committee and government responses are entered here for evaluation.",
    "audit.ev.appeal": "Appeal filed",
    "audit.ev.rereview": "Re-review recorded",
    "audit.ev.challenge": "Challenge raised",
    "audit.ev.challengeanswer": "Government answer recorded",
    "audit.ev.response": "Citizen response posted",
    /* watch */
    "watch.aria": "Watch live broadcast",
    "watch.lede": "Attend the weekly briefing broadcast. The Weekly Briefing tab holds the record of what was and will be discussed; this tab is the airing itself.",
    "watch.demo": "<strong>Demo only:</strong> preview states on demand. The real product follows the clock.",
    "watch.auto": "Auto (clock)",
    "watch.upcoming": "Upcoming",
    "watch.live": "Live",
    "watch.replay": "Replay",
    "watch.live.title": "Live \u2014 This Week\u2019s Briefing",
    "watch.replay.title": "Replay \u2014 {cycle}",
    "watch.live.badge": "LIVE",
    "watch.replay.badge": "REPLAY",
    "watch.slate.live.aria": "Live broadcast picture (demo simulation)",
    "watch.slate.replay.aria": "Replay picture (demo simulation)",
    "watch.slate.text": "Demo simulation of the weekly briefing broadcast. No real stream.",
    "watch.slate.demo": "DEMO SIMULATION \u2014 no real stream",
    "watch.unmute": "Tap to unmute \u2014 join with sound",
    "watch.sound.live": "Live with sound.",
    "watch.sound.blocked": "Sound blocked by the browser: picture is live, audio is muted.",
    "watch.sound.unavailable": "Audio unavailable in this browser.",
    "watch.sound.starting": "Starting\u2026",
    "watch.onair": "The briefing is on air now",
    "watch.next": "Next briefing: {label}, 1:00 PM ET",
    "watch.noagenda": "Agenda to be announced after the next draw.",
    "watch.noselect": "Selections for this briefing have not been drawn yet.",
    "watch.draw": "Draw: {date}.",
    "watch.onbill": "On the air bill ({cycle} selections):",
    "watch.hint": "For a live stream or a pre-recorded screening, whichever is next. If you are on this tab when the briefing airs, the stream starts automatically.",
    "watch.screening": "Screening",
    "watch.nowreading": "Now reading ({i} of {n})",
    "watch.noitems": "Agenda to be announced.",
    "watch.library": "Pre-recorded screenings",
    "watch.library.empty": "No past briefings yet.",
    "watch.library.aired": "aired",
    "watch.play.video": "Play video",
    "watch.play.screening": "Play this screening",
    "watch.processing": "Replay processing, available soon",
    "watch.processing.full": "Replay processing, available soon \u2014 {cycle} aired {date}.",
    "watch.stop": "Stop replay",
    "watch.back": "\u2190 Briefing record",
    "watch.simnote": "Demo simulation: the player stands in for the real briefing stream. Broadcast logic (schedule, autoplay, sound) is real.",
    /* footer */
    "footer.about": "About",
    "footer.process": "The Process",
    "footer.process.chain": "1. A citizen posts an idea or concern \u2014 630 words max, gate-checked, final once published. 2. The community votes \u2014 each citizen casts one vote per weekly cycle, switchable until voting closes Sunday at 11:59 PM ET. 3. At the cutoff the pool freezes; Monday at 12:00 PM ET the NIST Randomness Beacon draw picks one post at random. 4. The committee prepares answers and routes each selection to the correct branch and level. 5. Wednesday at 1:00 PM ET the briefing airs \u2014 the highest-voted post and the drawn post are read aloud word-for-word and discussed. 6. Approved answers are published, and follow-through is tracked in Status Updates until Answered, Action Promised, In Progress, Resolved \u2014 or No Action, with an official reason.",
    "footer.notices": "Notices",
    "footer.security": "Security",
    "footer.security.note": "Demo: every post carries a SHA-256 hash, and every action is recorded in a hash-chained audit log. The real product is planned to verify identity through Login.gov and use phishing-resistant sign-in, designed to meet federal security standards. The backend items are not yet built.",
    "footer.demonotice": "<strong>Demo notice:</strong> sign-in is simulated; no real personal data is collected, requested, or stored. AI checks run locally until a Model API key is provided for the session. Answers shown are demonstration content \u2014 seeded sample responses and live Muse Wonder drafts.",
    "footer.key": "Model API key",
    "footer.key.hint": "(demo session only \u2014 kept in sessionStorage, cleared when the tab closes; never committed)",
    "footer.key.ph": "Paste key for this session",
    "footer.key.save": "Save key",
    "footer.key.clear": "Clear",
    "preview.close": "Back to editing",
  };
  var PS_NONE = { LANG_KEY: "podium.v1.lang",
    t: function (id) { return EN_CHROME[id] || id; },
    tf: function (id, map) { var s = EN_CHROME[id] || id; if (map) Object.keys(map).forEach(function (k) { s = s.split("{" + k + "}").join(String(map[k])); }); return s; },
    tes: function (s) { return s; }, topicEs: function (s) { return s; }, statusEs: function (s) { return s; },
    get: function () { return "en"; }, set: function () { /* English only */ }, sync: function () { return "en"; } };
  function PS() { return (typeof PodiumStrings !== "undefined") ? PodiumStrings : PS_NONE; }
  function T(id) { return PS().t(id); }
  function Tf(id, map) { return PS().tf(id, map); }
  function Tes(s) { return PS().tes(s); }
  function Ttopic(s) { return PS().topicEs(s); }
  function Tstatus(s) { return PS().statusEs(s); }
  function uiLang() { return PS().get(); }
  /* Display dates: store values pass through untouched; only the computed
     "just now" label translates. */
  function dateShown(p) {
    var d = PodiumStore.displayDateFor(p, etNow());
    return d === "just now" ? T("date.now") : d;
  }
  /* Read-aloud timer: local deterministic format, translated by fixed
     replacement in es mode; en passes through byte-identical. */
  function timerShown(text) {
    var s = PodiumAI.formatTimer(text);
    if (uiLang() !== "es") return s;
    return s.replace("read-aloud time", "tiempo de lectura").replace(" of ", " de ");
  }
  /* Lowercase inline pipeline stage for meta lines. */
  function inlineStage(shown) {
    if (shown === "committee") return T("stage.inline.committee");
    if (shown === "selected") return T("stage.inline.selected");
    return T("stage.inline.briefed");
  }
  /* Inline stage for the Already-voiced line, where English shows the bare
     pipeline word ("top-voted, committee"). */
  function pipeStage(shown) {
    if (uiLang() !== "es") return shown;
    return T("stage.inline." + shown);
  }

  /* ---------- tabs ---------- */
  /* Active-tab persistence (TY, Oct 28): the current view id is written to
     sessionStorage on every view change, so a reload restores the same tab
     (a fresh tab has empty sessionStorage and boots to Live Feed as
     before). Deep links win over the saved tab; see init. */
  var TAB_KEY = "podium.v1.tab";
  var VALID_VIEWS = { feed: 1, post: 1, briefing: 1, watch: 1, prior: 1, status: 1, committee: 1 };
  function saveView(name) {
    try { window.sessionStorage.setItem(TAB_KEY, name); } catch (e) { /* session-only */ }
  }
  function savedView() {
    try {
      var v = window.sessionStorage.getItem(TAB_KEY);
      return (v && VALID_VIEWS[v]) ? v : null;
    } catch (e) { return null; }
  }
  var tabs = document.querySelectorAll(".main-nav .tab");
  function showView(name) {
    if (typeof PodiumAI !== "undefined" && PodiumAI && typeof PodiumAI.wonderCancel === "function") { PodiumAI.wonderCancel(); }
    clearWonderRetryTimer();
    tabs.forEach(function (t) {
      var on = t.getAttribute("data-view") === name;
      t.classList.toggle("is-active", on);
      if (on) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current");
    });
    currentView = name;
    saveView(name);
    ["feed", "post", "briefing", "watch", "prior", "status", "committee"].forEach(function (v) {
      $("view-" + v).hidden = (v !== name);
    });
    if (name === "feed") renderFeed();
    if (name === "briefing") renderBriefing();
    if (name === "prior") renderPrior();
    if (name === "status") renderStatus();
    if (name === "committee") renderCommittee();
    if (name === "watch") { renderWatch(); } else { stopWatchPlayback(); }
    if (name === "post") renderComposerGate();
    window.scrollTo(0, 0);
  }
  tabs.forEach(function (t) {
    t.addEventListener("click", function () { showView(t.getAttribute("data-view")); });
  });
  $("readFullRule").addEventListener("click", function (e) {
    e.preventDefault();
    window.scrollTo(0, 0);
  });

  /* ---------- citizen ---------- */
  function currentUser() {
    return state.currentUserId ? PodiumStore.citizenById(state, state.currentUserId) : null;
  }
  function renderCitizen() {
    var chip = $("citizenChip");
    if (!state.currentUserId) {
      chip.textContent = T("citizen.signedout");
      $("switchCitizenBtn").textContent = T("citizen.signin");
    } else {
      var me = currentUser();
      chip.innerHTML = esc(T("citizen.signedin")) + " <strong>" + esc(me.name) + "</strong>" +
        (me.state ? " \u00b7 " + esc(me.state) : "") +
        ' <span class="verified" title="' + esc(T("citizen.verified.title")) + '">' + esc(T("citizen.verified.chip")) + "</span>";
      $("switchCitizenBtn").textContent = T("citizen.switch");
    }
  }
  /* ---------- modal focus management ---------- */
  var modalReturnFocus = null;
  function modalFocusables(box) {
    return Array.prototype.slice.call(box.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])"))
      .filter(function (el) { return el.offsetParent !== null; });
  }
  function openModal(box) {
    modalReturnFocus = document.activeElement;
    box.hidden = false;
    var f = modalFocusables(box);
    if (f.length) f[0].focus();
  }
  function closeModal(box) {
    box.hidden = true;
    if (modalReturnFocus && modalReturnFocus.focus) modalReturnFocus.focus();
    modalReturnFocus = null;
  }

  /* reason: "vote" | "post" | undefined (plain switch) */
  function openCitizens(reason) {
    var pr = $("citizenPrompt");
    if (reason === "vote") {
      pr.textContent = T("citizens.vote");
      pr.hidden = false;
    } else if (reason === "post") {
      pr.textContent = T("citizens.post");
      pr.hidden = false;
    } else {
      pr.hidden = true;
    }
    var ul = $("citizenList");
    ul.innerHTML = "";
    state.citizens.forEach(function (c) {
      /* Mock accounts live only in the sign-in form below: the seeded list
         never shows them (they carry the u-c- mock id prefix). */
      if (c.id.indexOf("u-c-") === 0) return;
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = c.name + (c.state ? " \u00b7 " + c.state : "") + (c.id === state.currentUserId ? T("citizen.current") : "") + "  " + T("citizen.verified");
      b.addEventListener("click", function () {
        state.currentUserId = c.id;
        PodiumStore.save(state);
        audit("signin", c.name, "");
        renderCitizen(); renderFeed(); updateOnePostNotice();
        closeModal($("citizenModal"));
      });
      li.appendChild(b);
      ul.appendChild(li);
    });
    renderMockBox();
    openModal($("citizenModal"));
  }
  $("switchCitizenBtn").addEventListener("click", openCitizens);
  $("citizenClose").addEventListener("click", function () { closeModal($("citizenModal")); });

  /* ---------- mock local account (demo sign-up / sign-in) ---------- */
  /* A visitor-created profile stored in this browser only under its own key
     (PROFILE_KEY) — never the seed, and never the main-state shape beyond
     the citizen row and the citizen's posts/votes. The citizen row lets the
     existing one-post / one-vote rules apply unchanged. Mock-grade: the
     password is a non-crypto hash, never plaintext; no real verification. */
  var PROFILE_KEY = "podium.v1.profile";
  var MOCK_STATES = ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "District of Columbia", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"];
  var mockView = "signin"; /* "signin" | "signup" */
  function hashPw(s) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57, i, ch;
    s = String(s);
    for (i = 0; i < s.length; i++) {
      ch = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }
  function loadProfile() {
    try {
      var raw = window.localStorage.getItem(PROFILE_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (p && typeof p.id === "string" && typeof p.email === "string" && typeof p.pw === "string") return p;
      return null;
    } catch (e) { return null; }
  }
  function saveProfile(p) {
    try { window.localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch (e) {}
  }
  function currentIsMock() {
    var p = loadProfile();
    return !!(p && state.currentUserId === p.id);
  }
  function ensureMockCitizen(p) {
    /* NOTE: citizenById never returns null (it fabricates an "Unknown
       citizen"), so the presence check must scan the array directly. */
    for (var i = 0; i < state.citizens.length; i++) {
      if (state.citizens[i].id === p.id) return;
    }
    state.citizens.push({ id: p.id, name: p.name, state: p.state || "" });
    PodiumStore.save(state);
  }
  function mockSignInAs(p) {
    ensureMockCitizen(p);
    state.currentUserId = p.id;
    PodiumStore.save(state);
    audit("signin", p.name, "");
    renderCitizen(); renderFeed(); updateOnePostNotice();
    closeModal($("citizenModal"));
  }
  function renderMockBox() {
    setText("demoPathHeading", T("mock.demopath"));
    setText("mockPathHeading", T("mock.ownpath"));
    setText("mockEmailLabel", T("mock.email"));
    setText("mockPassLabel", T("mock.password"));
    setText("mockSigninBtn", T("mock.signin"));
    setText("mockForgotLink", T("mock.forgot"));
    setText("mockForgotNote", T("mock.forgotnote"));
    setText("mockShowSignup", T("mock.signup"));
    setText("mockNameLabel", T("mock.name"));
    setText("mockNewEmailLabel", T("mock.email"));
    setText("mockNewPassLabel", T("mock.password"));
    setText("mockStateLabel", T("mock.state"));
    setText("mockVerifyBtn", T("mock.verify"));
    setText("mockVerifyNote", T("mock.verifynote"));
    setText("mockSignupBtn", T("mock.signup"));
    setText("mockExistsNote", T("mock.exists"));
    setText("mockBrowserNote", T("mock.browsernote"));
    setText("mockShowSignin", T("mock.tosignin"));
    setText("mockSignoutBtn", T("mock.signout"));
    setText("realPathHeading", T("real.heading"));
    setText("realNote", T("real.note"));
    setText("realNameLabel", T("mock.name"));
    setText("realEmailLabel", T("mock.email"));
    setText("realPassLabel", T("mock.password"));
    setText("realPhoneLabel", T("real.phone"));
    setText("realVerifyBtn", T("mock.verify"));
    setText("realVerifyNote", T("mock.verifynote"));
    setText("realSendCodeBtn", T("real.sendcode"));
    setText("realCodeLabel", T("real.code"));
    setText("realSmsNote", T("real.smsnote"));
    setText("realInEmailLabel", T("mock.email"));
    setText("realInPassLabel", T("mock.password"));
    setText("realInCodeBtn", T("real.incode"));
    setText("realInNote", T("real.innote"));
    var sel = $("mockStateSel");
    if (sel) {
      var cur = sel.value;
      sel.innerHTML = "";
      var o0 = document.createElement("option");
      o0.value = "";
      o0.textContent = T("mock.state.unset");
      sel.appendChild(o0);
      MOCK_STATES.forEach(function (nm) {
        var o = document.createElement("option");
        o.value = nm;
        o.textContent = nm;
        sel.appendChild(o);
      });
      sel.value = cur;
    }
    var si = $("mockSigninForm"), su = $("mockSignupForm");
    if (si) si.hidden = mockView !== "signin";
    if (su) su.hidden = mockView !== "signup";
    var xn = $("mockExistsNote");
    if (xn) xn.hidden = !(mockView === "signup" && !!loadProfile());
    var so = $("mockSignoutBtn");
    if (so) so.hidden = !currentIsMock();
  }
  function wireMockBox() {
    var sif = $("mockSigninForm");
    if (sif) sif.addEventListener("submit", function (e) {
      e.preventDefault();
      var em = $("mockEmail").value.trim().toLowerCase();
      var pw = $("mockPass").value;
      var err = $("mockError");
      var p = loadProfile();
      if (p && p.email === em && p.pw === hashPw(pw)) {
        if (err) err.hidden = true;
        mockView = "signin";
        mockSignInAs(p);
        return;
      }
      if (err) { err.textContent = T("mock.nomatch"); err.hidden = false; }
    });
    var suf = $("mockSignupForm");
    if (suf) suf.addEventListener("submit", function (e) {
      e.preventDefault();
      var nm = $("mockName").value.trim();
      var em = $("mockNewEmail").value.trim().toLowerCase();
      var pw = $("mockNewPass").value;
      var st = $("mockStateSel").value;
      var err = $("mockSignupError");
      if (loadProfile()) {
        /* single-profile mock: never overwrite — sign in instead, or clear
           site data to start over (see the forgot-password note) */
        if (err) { err.textContent = T("mock.exists"); err.hidden = false; }
        return;
      }
      if (!nm || em.indexOf("@") < 0 || !pw) {
        if (err) { err.textContent = T("mock.incomplete"); err.hidden = false; }
        return;
      }
      if (err) err.hidden = true;
      var p = { id: "u-c-" + Date.now().toString(36), name: nm, email: em, pw: hashPw(pw), state: st };
      saveProfile(p);
      audit("signup", nm, "");
      mockView = "signin";
      mockSignInAs(p);
    });
    var fl = $("mockForgotLink");
    if (fl) fl.addEventListener("click", function (e) {
      e.preventDefault();
      var n = $("mockForgotNote");
      if (n) n.hidden = !n.hidden;
    });
    var ss = $("mockShowSignup");
    if (ss) ss.addEventListener("click", function (e) {
      e.preventDefault();
      mockView = "signup";
      renderMockBox();
    });
    var sb = $("mockShowSignin");
    if (sb) sb.addEventListener("click", function (e) {
      e.preventDefault();
      mockView = "signin";
      renderMockBox();
    });
    var so = $("mockSignoutBtn");
    if (so) so.addEventListener("click", function () {
      var soUser = currentUser();
      state.currentUserId = null;
      PodiumStore.save(state);
      audit("signout", (soUser && soUser.name) ? soUser.name : "", "");
      renderCitizen(); renderFeed(); updateOnePostNotice();
      closeModal($("citizenModal"));
    });
  }
  /* GOVERNMENT-MODEL BACKEND HOOKS (TY, Nov 3 — structure only, nothing
     below is implemented; the demo stays a static site with no backend):
     - Identity proofing (IAL2, NIST SP 800-63): hook a Login.gov / ID.me
       integration where the real sign-up collects identity (see the
       disabled real-preview section and its TODOs) — photo ID + SSN +
       selfie/facial match, or in-person at a Post Office. The demo never
       collects SSNs (see mock.verifynote / real section note).
     - Sign-in (AAL2): hook FIDO2/passkey + security-key (WebAuthn) and
       authenticator-app MFA where the real sign-in verifies the session;
       SMS text-back is NIST-"restricted" — fallback only, with a warning.
     - SSN field-level encryption: hook envelope encryption (KMS/HSM data
       keys) at any point that would persist an SSN — no such point exists
       in the demo (SSN fields are disabled and unwired by design).
     - Hosting: FedRAMP-authorized cloud behind WAF + DDoS protection;
       hook at deploy/infra, not in this client code.
     - Backups: encrypted off-site replicas hook at PodiumStore.save
       (see the save() hook note in js/store.js) — WORM retention.
     - Domain: .gov domain + DNSSEC + HSTS preload; hook at hosting/DNS.
     - Crypto: FIPS 140-3 validated module replaces the local SHA-256
       primitive (see the js/store.js hook); TLS 1.2 minimum / 1.3
       preferred for all transports (same endpoint helper, footer key).
     - Email: SPF/DKIM/DMARC p=reject + MTA-STS for any product mail
       (verification codes ride SMS in the real product, email stays
       transactional) — hook at the mail sender, none exists here.
     - Monitoring: FISMA continuous monitoring (audit logging, vuln
       scanning, incident response) — the client-side hash-chained audit
       log in this demo is the visible model, not the compliance control. */
  wireMockBox();

  /* ---------- feed ---------- */
  /* Feed scale (TY, Oct 28, part 1 of 2): DISPLAY-ONLY pagination and sorts.
     Pagination/sorts/filters never change which posts exist, which post is
     top-voted, or which posts are in a cycle's draw pool. The ordered list
     is snapshotted (frozen): page turns use the frozen id list, votes
     update counts in place without re-sorting, and re-sorting happens only
     when the user changes sort, topic, search, or page size. */
  var subtabs = document.querySelectorAll(".subtab");
  var FEED_SORTS = { recent: 1, top: 1, needs: 1, discover: 1 };
  var FEED_PAGE_SIZES = [10, 20, 50];
  var FEED_STATE_KEY = "podium.v1.feed";
  var feedSort = "recent";   /* recent | top | needs | discover */
  var feedTopic = "";        /* "" = all topics */
  var feedPageSize = 20;
  var feedPage = 1;
  var feedList = null;       /* frozen array of post ids in display order */
  var feedListKey = "";      /* sort|topic|query|size the frozen list was built for */
  var feedFreeze = false;    /* storage-event path: prune only, never add posts */
  function feedQuery() { return $("searchInput").value.trim(); }
  function isCodeSearch() {
    return /^([A-Z])-(\d+)(?:-(A|U\d+))?$/i.test(feedQuery());
  }
  function feedKey() {
    return feedSort + "|" + feedTopic + "|" + feedQuery().toLowerCase() + "|" + feedPageSize;
  }
  function saveFeedState() {
    try {
      window.sessionStorage.setItem(FEED_STATE_KEY,
        JSON.stringify({ sort: feedSort, topic: feedTopic, page: feedPage }));
    } catch (e) { /* session-only */ }
  }
  function restoreFeedState() {
    try {
      var s = JSON.parse(window.sessionStorage.getItem(FEED_STATE_KEY) || "null");
      if (!s) return;
      if (FEED_SORTS[s.sort]) feedSort = s.sort;
      if (typeof s.topic === "string" && state.topics.indexOf(s.topic) !== -1) feedTopic = s.topic;
      var p = parseInt(s.page, 10);
      feedPage = (p >= 1) ? p : 1;
    } catch (e) { /* fresh or corrupt session: defaults stand */ }
  }
  function setFeedSort(mode, forceRebuild) {
    if (linkedPostId || linkMissing) { linkedPostId = null; linkedSuffix = null; linkMissing = false; }
    feedSort = mode;
    feedPage = 1;
    if (forceRebuild) feedList = null; /* explicit sort pick always rebuilds (Discover reshuffles) */
    saveFeedState();
    renderFeed();
  }
  function setFeedTopic(t) {
    if (linkedPostId || linkMissing) { linkedPostId = null; linkedSuffix = null; linkMissing = false; }
    feedTopic = t || "";
    feedPage = 1;
    saveFeedState();
    renderFeed();
  }
  subtabs.forEach(function (t, i) {
    t.addEventListener("click", function () { setFeedSort(t.getAttribute("data-feed"), true); });
    t.tabIndex = t.classList.contains("is-active") ? 0 : -1;
    t.addEventListener("keydown", function (e) {
      var j = null;
      if (e.key === "ArrowRight") j = (i + 1) % subtabs.length;
      else if (e.key === "ArrowLeft") j = (i - 1 + subtabs.length) % subtabs.length;
      else if (e.key === "Home") j = 0;
      else if (e.key === "End") j = subtabs.length - 1;
      if (j === null) return;
      e.preventDefault();
      setFeedSort(subtabs[j].getAttribute("data-feed"), true);
      subtabs[j].focus();
    });
  });
  function fillTopics(sel, withAll) {
    sel.innerHTML = "";
    if (withAll) {
      var o = document.createElement("option");
      o.value = ""; o.textContent = T("feed.alltopics");
      sel.appendChild(o);
    }
    state.topics.forEach(function (t) {
      var op = document.createElement("option");
      op.value = t; op.textContent = Ttopic(t);
      sel.appendChild(op);
    });
  }
  fillTopics($("topicFilter"), true);
  fillTopics($("composerTopic"), false);
  $("composerTopic").addEventListener("change", saveDraft);
  $("topicFilter").addEventListener("change", function () { setFeedTopic($("topicFilter").value); });
  /* Search re-renders the whole feed per keystroke, so it waits for a
     short pause (same clear-then-set style as the draft-save debounce). */
  var SEARCH_DEBOUNCE_MS = 300;
  var searchTimer = null;
  $("searchInput").addEventListener("input", function () {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = null;
    searchTimer = setTimeout(function () {
      searchTimer = null;
      if (linkedPostId || linkMissing) { linkedPostId = null; linkedSuffix = null; linkMissing = false; }
      feedPage = 1;
      saveFeedState();
      renderFeed();
    }, SEARCH_DEBOUNCE_MS);
  });
  $("pageSizeSel").addEventListener("change", function () {
    var n = parseInt($("pageSizeSel").value, 10);
    feedPageSize = (FEED_PAGE_SIZES.indexOf(n) !== -1) ? n : 20;
    feedPage = 1;
    saveFeedState();
    renderFeed();
  });
  $("prevPage").addEventListener("click", function () {
    if (feedPage > 1) { feedPage -= 1; saveFeedState(); renderFeed(); scrollFeedIntoView(); }
  });
  $("nextPage").addEventListener("click", function () {
    feedPage += 1; saveFeedState(); renderFeed(); scrollFeedIntoView();
  });
  /* ---------- simulated live activity (demo feed toggle) ----------
     In-memory demonstration posts only: generated while the toggle is on,
     merged into the Live Feed render, never written to the store or to
     localStorage (podium.v1). The toggle persists in sessionStorage
     (podium.v1.livefeed); default off on every fresh visit.
     Cadence: the first post generates immediately on toggle-on, then one
     every 120 seconds — but only while the Live Feed tab is the active tab
     AND the document is visible. Pausing (tab switch, hidden page) skips
     ticks without backfilling. Cap: 10 generated posts per session, then
     the loop stops and the feed note says so. */
  var LIVE_TICK_MS = 120000;
  var LIVE_MAX = 10;
  var LIVE_KEY = "podium.v1.livefeed";
  var liveGen = [];       /* in-memory generated posts, newest first */
  var liveGenOn = false;
  var liveGenTimer = null;
  var liveGenCount = 0;   /* session total, never reset: refs never reused */
  var liveGenCapped = false;
  var liveBankIdx = 0;
  var liveStreetIdx = 0;
  var liveRefBase = 0;    /* max seed ref number, computed on first use */
  function isGenId(id) { return typeof id === "string" && id.indexOf("g-") === 0; }
  function genById(id) {
    for (var gi = 0; gi < liveGen.length; gi++) {
      if (liveGen[gi].id === id) return liveGen[gi];
    }
    return null;
  }
  /* Any-context post lookup: the store first, then the in-memory generated
     posts. Used everywhere the feed renders or resolves a card, so generated
     posts behave like full posts in feed views only. */
  function findPostAny(id) { return PodiumStore.postById(state, id) || genById(id); }
  function postRefAny(ref) {
    var p = PodiumStore.postByRef(state, ref);
    if (p) return p;
    var want = String(ref).toUpperCase();
    for (var i = 0; i < liveGen.length; i++) {
      if (liveGen[i].ref && liveGen[i].ref.toUpperCase() === want) return liveGen[i];
    }
    return null;
  }
  /* Template fallback bank: 12 pre-written stems across the 11 topics
     (Infrastructure twice). {street} is filled from a rotating street list.
     Served round-robin, so consecutive picks never repeat. Every stem is
     written to pass the local gate (clean wording, capitalized sentences,
     one clear ask). */
  var LIVE_BANK = [
    { t: "Infrastructure", n: "Dana W.", s: "Ohio", b: "The potholes on {street} have grown so deep that drivers swerve into the bike lane to avoid them. I have watched two near collisions this month alone. I propose that the city publish a repair schedule for {street} within thirty days and complete the resurfacing before winter. Our neighborhood deserves safe roads." },
    { t: "Healthcare", n: "Priya N.", s: "Texas", b: "My mother waits four months for a specialist appointment, and her condition keeps getting worse while we wait. The clinic says the schedule is simply full. I propose evening and weekend specialist hours twice a month so working families can actually get seen. Nobody should have to choose between a paycheck and medical care." },
    { t: "Public Health", n: "Marcus T.", s: "Georgia", b: "The corner store near the elementary school sells nothing but soda and chips, and the nearest grocery with fresh produce is two bus rides away. I propose a mobile produce market that visits our block every Saturday morning. Our kids deserve real food close to home." },
    { t: "Education", n: "Elena R.", s: "Arizona", b: "Our school library closes at three in the afternoon, exactly when students who share bedrooms at home need a quiet place to study. I propose keeping the library open until seven on school nights with one supervising aide. Learning should not end at the final bell." },
    { t: "Environment", n: "Sam K.", s: "Oregon", b: "The creek behind {street} fills with plastic bottles after every rain, and the smell in summer is terrible. Volunteers clean it twice a year but the trash always returns. I propose storm-drain filters at the three outfalls upstream plus monthly city pickup. Clean water should not depend on volunteers alone." },
    { t: "Economy", n: "Grace L.", s: "Michigan", b: "Three storefronts on {street} have sat empty for over a year while new businesses say the permit process takes six months. I propose a thirty-day fast-track permit for small retail spaces under two thousand square feet. Empty shops help nobody." },
    { t: "Public Safety", n: "Andre B.", s: "Louisiana", b: "The streetlights on {street} have been out since spring, and neighbors now avoid walking there after dark. I reported the outage twice and heard nothing back. I propose a public dashboard tracking every outage report with a repair deadline. Darkness should not decide where we feel safe." },
    { t: "Transportation", n: "Nina P.", s: "Illinois", b: "The crosstown bus runs every forty minutes, so missing one connection makes riders late for their shifts. We stand in the rain because the shelter lost its roof last winter. I propose fifteen-minute service during rush hours and a repaired shelter this fall. Reliable transit keeps jobs within reach." },
    { t: "Housing", n: "Victor H.", s: "Colorado", b: "Rents on my block rose twenty percent this year while wages stayed flat, and two neighbor families already moved in with relatives. I propose that the council require a public impact review before approving any rent increase above ten percent. People should not be priced out of their own streets." },
    { t: "Technology", n: "June C.", s: "Washington", b: "The public library computers run an operating system that no longer receives security updates, and the wait for a terminal is over an hour. I propose replacing the twelve oldest machines this year and adding evening tech-help hours. Internet access is a necessity, not a luxury." },
    { t: "Civic Process", n: "Omar F.", s: "Virginia", b: "The last town hall about the {street} rezoning was announced with two days notice at an hour working parents cannot attend. Only eleven residents showed up. I propose a minimum fourteen-day notice for zoning hearings plus one evening session. Decisions about our streets need our voices in the room." },
    { t: "Infrastructure", n: "Rosa D.", s: "New Mexico", b: "The crosswalk signal at {street} gives pedestrians six seconds to cross four lanes, and seniors in our building cannot make it in time. I propose a countdown signal with at least twenty seconds and a raised curb ramp on both corners. Crossing the street should not be a sprint." }
  ];
  var LIVE_STREETS = ["Maple Street", "5th Avenue", "Cedar Lane", "Main Street", "Oak Drive", "River Road"];
  function liveTemplate() {
    var e = LIVE_BANK[liveBankIdx % LIVE_BANK.length];
    liveBankIdx += 1;
    var street = LIVE_STREETS[liveStreetIdx % LIVE_STREETS.length];
    liveStreetIdx += 1;
    return { topic: e.t, name: e.n, state: e.s, body: e.b.split("{street}").join(street) };
  }
  /* Max numeric ref across the posts in the store — on a fresh profile that
     is exactly the seed posts (file-frozen codes plus load-time numbering).
     The session counter starts at 1 above it. A taken number is skipped,
     so a ref is never reused within the session. */
  function liveSeedMaxRef() {
    var max = 0;
    (state.posts || []).forEach(function (p) {
      var m = /-(\d+)$/.exec(p.ref || "");
      if (m && Number(m[1]) > max) max = Number(m[1]);
    });
    return max;
  }
  function livePad4(n) {
    var s = String(n);
    while (s.length < 4) s = "0" + s;
    return s;
  }
  function liveNextRef(topic) {
    if (!liveRefBase) liveRefBase = liveSeedMaxRef();
    var i = state.topics.indexOf(topic);
    var letter = (i >= 0 && i <= 25) ? String.fromCharCode(65 + i) : "Z";
    var n = liveRefBase + liveGenCount;
    var ref = letter + "-" + livePad4(n);
    while (postRefAny(ref)) { n += 1; ref = letter + "-" + livePad4(n); }
    return ref;
  }
  /* The existing LOCAL gate only (wording + clarity, no live call): hard or
     soft wording hits, a punct fix, an unclear verdict, or an over-limit
     body all fail the candidate. */
  function liveLocalPass(body) {
    var res = PodiumAI.checkText(body);
    if (!res || res.hard.length || res.soft.length || res.punctFix) return false;
    var c = PodiumAI.clarityOf(body);
    if (!c || c.unclear) return false;
    if (PodiumAI.countWords(body) > PodiumAI.WORD_LIMIT) return false;
    return true;
  }
  function buildLivePost(cand) {
    if (!cand || state.topics.indexOf(cand.topic) === -1) return null;
    if (!liveLocalPass(cand.body)) return null;
    liveGenCount += 1;
    var post = {
      id: "g-" + Date.now(),
      ref: liveNextRef(cand.topic),
      cycleId: currentCycle(),
      topic: cand.topic,
      body: cand.body,
      lang: "en",
      author: cand.name,
      authorState: cand.state,
      votes: 0,
      createdAt: new Date().toISOString(),
      generated: true
    };
    post.hash = PodiumStore.hashPost(state, post);
    return post;
  }
  function liveCap() {
    liveGenCapped = true;
    if (liveGenTimer) { clearInterval(liveGenTimer); liveGenTimer = null; }
    feedList = null;
    renderFeed();
  }
  function liveTick() {
    if (!liveGenOn || liveGenCapped) return;
    /* Pause while the feed is not the active tab or the page is hidden:
       ticks are skipped, never backfilled. */
    if (currentView !== "feed" || (typeof document !== "undefined" && document.hidden)) return;
    if (liveGenCount >= LIVE_MAX) { liveCap(); return; }
    var done = function (cand) {
      if (!liveGenOn || liveGenCapped) return;
      var post = buildLivePost(cand);
      if (!post) return; /* gate failed: skip this tick, try again next tick */
      liveGen.unshift(post);
      if (liveGenCount >= LIVE_MAX) { liveCap(); return; }
      feedList = null; /* rebuild so the new post leads page 1 */
      renderFeed();
    };
    if (PodiumAI.getKey()) {
      PodiumAI.generateDemoPost().then(function (cand) {
        done(cand || liveTemplate()); /* live failure or timeout: template */
      });
    } else {
      done(liveTemplate()); /* no key: template fallback */
    }
  }
  function syncLiveUi() {
    var box = $("liveFeedToggle");
    if (box) box.checked = liveGenOn;
    var note = $("liveFeedNote");
    if (note) {
      note.hidden = !liveGenOn;
      if (liveGenOn) note.textContent = T("livefeed.note");
    }
  }
  function setLiveGen(on, immediate) {
    liveGenOn = !!on;
    try {
      if (liveGenOn) window.sessionStorage.setItem(LIVE_KEY, "1");
      else window.sessionStorage.removeItem(LIVE_KEY);
    } catch (e) { /* session-only */ }
    if (liveGenTimer) { clearInterval(liveGenTimer); liveGenTimer = null; }
    if (liveGenOn && !liveGenCapped) {
      liveGenTimer = setInterval(liveTick, LIVE_TICK_MS);
      if (immediate) liveTick();
    }
    feedList = null; /* show or hide the generated posts */
    syncLiveUi();
    renderFeed();
  }
  /* Toggle UI, injected into the feed controls (null-safe: the committed
     test runner loads app.js against a partial DOM). */
  (function buildLiveToggle() {
    var host = document.querySelector("#view-feed .feed-controls");
    if (!host || document.getElementById("liveFeedToggle")) return;
    var row = document.createElement("div");
    row.className = "livefeed-row";
    var lab = document.createElement("label");
    lab.className = "livefeed-toggle";
    var box = document.createElement("input");
    box.type = "checkbox";
    box.id = "liveFeedToggle";
    var span = document.createElement("span");
    span.id = "liveFeedToggleLabel";
    lab.appendChild(box);
    lab.appendChild(span);
    var note = document.createElement("p");
    note.className = "hint";
    note.id = "liveFeedNote";
    note.hidden = true;
    row.appendChild(lab);
    row.appendChild(note);
    host.appendChild(row);
    box.addEventListener("change", function () { setLiveGen(box.checked, true); });
  })();
  /* A reload keeps the toggle within the session: resume the interval, but
     do not backfill missed ticks and do not generate on boot. */
  try {
    if (window.sessionStorage.getItem(LIVE_KEY) === "1") {
      liveGenOn = true;
      liveGenTimer = setInterval(liveTick, LIVE_TICK_MS);
    }
  } catch (e) { /* default off */ }
  /* ---------- auto-translate (feed toggle) ----------
     When on, every visible feed-page post whose lang differs from the UI
     language is translated automatically through the same Spark path as the
     per-post button (30s timeout, no retry, shared session cache), and shown
     exactly like an on-demand translation below the original. Only the
     current page is translated (max 3 calls at a time, in display order);
     page/filter/search/language changes re-translate the newly visible posts
     from cache or fresh. Toggle state persists in sessionStorage
     (podium.v1.autotranslate); default off. Turning it off removes every
     auto-translation (cards re-render originals-only). Manual Translate
     buttons are independent and keep working on or off. */
  var AUTO_KEY = "podium.v1.autotranslate";
  var autoTransOn = true;
  function autoTransLangName() { return uiLang() === "es" ? "Espa\u00f1ol" : "English"; }
  function syncAutoUi() {
    var box = $("autoTransToggle");
    if (box) box.checked = autoTransOn;
    var lbl = $("autoTransToggleLabel");
    if (lbl) lbl.textContent = Tf("autotranslate.toggle", { language: autoTransLangName() });
    syncAutoNote();
  }
  function syncAutoNote() {
    var note = $("autoTransNote");
    if (!note) return;
    var show = autoTransOn && !PodiumAI.getKey();
    note.hidden = !show;
    if (show) note.textContent = T("autotranslate.nokey");
  }
  function setAutoTrans(on) {
    autoTransOn = !!on;
    try {
      if (autoTransOn) window.sessionStorage.removeItem(AUTO_KEY);
      else window.sessionStorage.setItem(AUTO_KEY, "0");
    } catch (e) { /* session-only */ }
    feedList = null; /* rebuild so auto-translations appear or disappear */
    syncAutoUi();
    renderFeed();
  }
  /* Toggle UI, injected into the feed controls next to the search/filter row
     (null-safe: the committed test runner loads app.js against a partial DOM). */
  (function buildAutoToggle() {
    var host = document.querySelector("#view-feed .feed-controls");
    if (!host || document.getElementById("autoTransToggle")) return;
    var row = document.createElement("div");
    row.className = "livefeed-row";
    var lab = document.createElement("label");
    lab.className = "livefeed-toggle";
    var box = document.createElement("input");
    box.type = "checkbox";
    box.id = "autoTransToggle";
    var span = document.createElement("span");
    span.id = "autoTransToggleLabel";
    lab.appendChild(box);
    lab.appendChild(span);
    var note = document.createElement("p");
    note.className = "hint";
    note.id = "autoTransNote";
    note.hidden = true;
    row.appendChild(lab);
    row.appendChild(note);
    host.appendChild(row);
    box.addEventListener("change", function () { setAutoTrans(box.checked); });
  })();
  try {
    if (window.sessionStorage.getItem(AUTO_KEY) === "0") autoTransOn = false;
  } catch (e) { /* default on */ }
  /* Translate one rendered feed page. Cards carry data-autotranslate with the
     post id (set in renderFeed); posts already in the target language are
     left alone; cached translations render immediately with no call. */
  function autoTranslatePage(posts) {
    syncAutoNote();
    if (!autoTransOn || !PodiumAI.getKey()) return;
    var target = uiLang();
    var queue = [];
    posts.forEach(function (p) {
      if (!needsTranslation(p) || p.lang === target) return;
      var li = document.querySelector('#postList [data-autotranslate="' + p.id + '"]');
      if (!li) return;
      var key = p.id + "|" + target;
      var body = li.querySelector(".post-body");
      if (!body) return;
      if (translateCache.has(key)) {
        var done = document.createElement("div");
        done.className = "auto-translate-slot";
        done.appendChild(translateBox(translateCache.get(key)));
        body.parentNode.insertBefore(done, body.nextSibling);
        return;
      }
      var prog = document.createElement("p");
      prog.className = "hint auto-translate-slot";
      prog.textContent = T("translate.progress");
      body.parentNode.insertBefore(prog, body.nextSibling);
      queue.push({ post: p, prog: prog });
    });
    var active = 0, idx = 0;
    (function next() {
      if (!autoTransOn || uiLang() !== target) return;
      while (active < 3 && idx < queue.length) {
        var job = queue[idx++];
        if (!job.prog.parentNode) continue; /* card re-rendered: the fresh loop owns it */
        active += 1;
        (function (jb) {
          fetchTranslation(jb.post, target).then(function (text) {
            active -= 1;
            if (!jb.prog.parentNode) { next(); return; } /* card gone: drop it */
            var box = document.createElement("div");
            box.className = "auto-translate-slot";
            if (text) {
              box.appendChild(translateBox(text));
            } else {
              var note = document.createElement("p");
              note.className = "hint";
              note.textContent = T("translate.unavailable");
              box.appendChild(note);
            }
            jb.prog.parentNode.replaceChild(box, jb.prog);
            next();
          });
        })(job);
      }
    })();
  }
  /* "Here's how you know" banner dropdown (USWDS pattern): the button toggles
     the two-section panel below the banner bar. Items are built once here
     (null-safe for the committed test runner); applyStaticChrome fills the
     copy in both languages, with the {lock} token in gov.b2 replaced by the
     inline lock icon. The panel is closed on every load. */
  var GOV_LOCK_SVG = '<svg class="lock-inline" viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="7" width="10" height="7" fill="currentColor"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  var GOV_BANK_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 14.5v-9L8 2.5l6.5 3v9" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4.5 14.5v-4h2v4M7 14.5v-4h2v4M9.5 14.5v-4h2v4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
  var GOV_ITEMS = [
    { icon: GOV_BANK_SVG, h: "gov.h1", b: "gov.b1" },
    { icon: GOV_LOCK_SVG, h: "gov.h2", b: "gov.b2" }
  ];
  function renderGovPanel() {
    var panel = $("govPanel");
    if (!panel) return;
    if (!panel.firstChild) {
      var grid = document.createElement("div");
      grid.className = "gov-panel-items";
      GOV_ITEMS.forEach(function (it) {
        var item = document.createElement("div");
        item.className = "gov-panel-item";
        var ic = document.createElement("span");
        ic.className = "item-icon";
        ic.setAttribute("aria-hidden", "true");
        ic.innerHTML = it.icon;
        var tx = document.createElement("div");
        var h = document.createElement("strong");
        h.setAttribute("data-gov", it.h);
        var p = document.createElement("p");
        p.setAttribute("data-gov", it.b);
        tx.appendChild(h);
        tx.appendChild(p);
        item.appendChild(ic);
        item.appendChild(tx);
        grid.appendChild(item);
      });
      panel.appendChild(grid);
    }
    Array.prototype.forEach.call(panel.querySelectorAll("[data-gov]"), function (el) {
      var key = el.getAttribute("data-gov");
      if (key === "gov.b2") el.innerHTML = esc(T(key)).split("{lock}").join(GOV_LOCK_SVG);
      else el.textContent = T(key);
    });
  }
  (function wireGovHow() {
    var btn = $("govHow");
    if (!btn || btn.getAttribute("data-gov-wired")) return;
    btn.setAttribute("data-gov-wired", "1");
    btn.addEventListener("click", function () {
      var open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", open ? "false" : "true");
      var panel = $("govPanel");
      if (panel) panel.hidden = open;
    });
  })();
  function scrollFeedIntoView() {
    var list = $("postList");
    if (list && list.scrollIntoView) list.scrollIntoView();
  }
  function matchingPostIds() {
    var ids = [];
    var q = feedQuery().toLowerCase();
    PodiumStore.postsForCycle(state, currentCycle()).forEach(function (p) {
      if (feedTopic && p.topic !== feedTopic) return;
      if (q) {
        /* Keyword search covers the body AND the author name AND the topic,
           so "Lisa" or "Housing" finds posts a body-only search would miss. */
        var author = PodiumStore.citizenById(state, p.authorId);
        var hay = (p.body + " " + (author ? author.name : "") + " " + p.topic).toLowerCase();
        if (hay.indexOf(q) === -1) return;
      }
      ids.push(p.id);
    });
    /* Simulated live activity: generated posts live in memory only and join
       the feed render (current cycle, same filters) while the toggle is on.
       They never enter the store, so votes, draw, and one-post rules — all
       store queries — never see them. */
    if (liveGenOn) {
      liveGen.forEach(function (gp) {
        if (gp.cycleId !== currentCycle()) return;
        if (feedTopic && gp.topic !== feedTopic) return;
        if (q) {
          var ghay = (gp.body + " " + gp.author + " " + gp.topic).toLowerCase();
          if (ghay.indexOf(q) === -1) return;
        }
        ids.push(gp.id);
      });
    }
    return ids;
  }
  function sortFeedIds(ids) {
    /* Generated demo posts follow the active sort, with one exception:
       in Recent they are pinned to the top (newest generated first),
       above all seed posts regardless of date — a live post is the
       newest by definition; the seed's future-dated posts are the
       artifact. Top Voted treats generated posts like any other post
       (0 votes — never voted on, below every seed); Fewest Votes ranks
       by votes with live posts winning equal-vote ties; Discover
       shuffles them in. With no
       generated posts present the legacy comparators run untouched, so
       the seed-only feed is byte-identical to before. */
    var hasGen = false;
    for (var k = 0; k < ids.length; k++) {
      if (isGenId(ids[k])) { hasGen = true; break; }
    }
    function byId(id) { return PodiumStore.postById(state, id); }
    function anyById(id) { return isGenId(id) ? genById(id) : PodiumStore.postById(state, id); }
    if (!hasGen) {
      var seed = ids.slice();
      if (feedSort === "top") {
        seed.sort(function (a, b) { return byId(b).votes - byId(a).votes; });
      } else if (feedSort === "needs") {
        seed.sort(function (a, b) { return byId(a).votes - byId(b).votes; });
      } else if (feedSort === "discover") {
        for (var i = seed.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var t = seed[i]; seed[i] = seed[j]; seed[j] = t;
        }
      } else {
        seed.sort(function (a, b) { return byId(a).createdAt < byId(b).createdAt ? 1 : -1; });
      }
      return seed;
    }
    var all = ids.slice();
    if (feedSort === "top") {
      /* Votes desc; ties keep incoming (seed-first) order, so the 0-vote
         generated posts sit below every 0-vote seed post — at the bottom. */
      all.sort(function (a, b) { return anyById(b).votes - anyById(a).votes; });
    } else if (feedSort === "needs") {
      /* Votes asc; a live post wins equal-vote ties (it is the newest by
         definition — same future-date artifact as Recent). Vote ranks are
         untouched: generated posts hold 0 votes, the global minimum. */
      all.sort(function (a, b) {
        var pa = anyById(a), pb = anyById(b);
        if (pa.votes !== pb.votes) return pa.votes - pb.votes;
        var ga = isGenId(a), gb = isGenId(b);
        if (ga !== gb) return ga ? -1 : 1;
        return pa.createdAt < pb.createdAt ? 1 : (pa.createdAt > pb.createdAt ? -1 : 0);
      });
    } else if (feedSort === "discover") {
      for (var m = all.length - 1; m > 0; m--) {
        var n = Math.floor(Math.random() * (m + 1));
        var u = all[m]; all[m] = all[n]; all[n] = u;
      }
    } else {
      /* Recent: generated posts lead (newest generated first); seed posts
         keep their exact Recent order below. */
      var gens = [], rest = [];
      all.forEach(function (id) { (isGenId(id) ? gens : rest).push(id); });
      gens.sort(function (a, b) { return anyById(a).createdAt < anyById(b).createdAt ? 1 : -1; });
      rest.sort(function (a, b) { return anyById(a).createdAt < anyById(b).createdAt ? 1 : -1; });
      all = gens.concat(rest);
    }
    return all;
  }
  function ensureFeedList(forceRebuild) {
    var key = feedKey();
    if (!forceRebuild && feedList && feedListKey === key) {
      var ids = matchingPostIds();
      var pruned = feedList.filter(function (id) { return ids.indexOf(id) !== -1; });
      if (pruned.length === feedList.length && pruned.length === ids.length) return feedList;
      if (feedFreeze || pruned.length) {
        feedList = feedFreeze ? pruned : sortFeedIds(ids);
        feedListKey = key;
        feedFreeze = false;
        return feedList;
      }
      /* fell through: mass delete plus additions with an empty survivor
         set — rebuild so the view is never wrongly empty */
    }
    feedFreeze = false;
    feedList = sortFeedIds(matchingPostIds());
    feedListKey = key;
    return feedList;
  }
  function syncFeedControls() {
    subtabs.forEach(function (x) {
      var on = x.getAttribute("data-feed") === feedSort;
      x.classList.toggle("is-active", on);
      x.setAttribute("aria-selected", on ? "true" : "false");
      x.tabIndex = on ? 0 : -1;
    });
    $("topicFilter").value = feedTopic;
    $("pageSizeSel").value = String(feedPageSize);
  }
  function renderTopicList() {
    var box = $("topicList");
    box.innerHTML = "";
    var counts = {};
    state.topics.forEach(function (t) { counts[t] = 0; });
    var total = 0;
    PodiumStore.postsForCycle(state, currentCycle()).forEach(function (p) {
      if (counts[p.topic] === undefined) counts[p.topic] = 0;
      counts[p.topic] += 1;
      total += 1;
    });
    function addBtn(label, topic, count) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn btn-small topic-btn";
      b.textContent = label + " (" + count + ")";
      b.setAttribute("aria-pressed", (feedTopic === topic) ? "true" : "false");
      b.addEventListener("click", function () { setFeedTopic(topic); });
      box.appendChild(b);
    }
    addBtn(T("feed.alltopics"), "", total);
    state.topics.forEach(function (t) { addBtn(Ttopic(t), t, counts[t] || 0); });
  }
  function renderPager(total, totalPages) {
    var pager = $("feedPager");
    pager.hidden = totalPages <= 1;
    $("pageInfo").textContent = T("feed.page") + " " + feedPage + " " + T("feed.page.of") + " " + totalPages;
    $("prevPage").disabled = feedPage <= 1;
    $("nextPage").disabled = feedPage >= totalPages;
  }
  function refreshVoteButtons(pid) {
    if (!pid) return;
    var p = findPostAny(pid);
    if (!p) return;
    var voted = browserHasVoted(pid);
    var open = p.cycleId === currentCycle();
    document.querySelectorAll('.vote-btn[data-post="' + pid + '"]').forEach(function (b) {
      b.setAttribute("aria-pressed", voted ? "true" : "false");
      b.textContent = voted ? T("vote.upvoted") : T("vote.up");
      var li = b.closest("li");
      var count = li ? li.querySelector(".vote-count") : null;
      if (count) {
        count.textContent = votesLabel(p.votes) + (voted ? T("vote.yours") : "") +
          (open ? "" : T("vote.closed")) + T("vote.simulated");
      }
    });
  }

  function statusChip(postId) {
    var b = PodiumStore.briefingItemFor(state, postId);
    if (!b) return "";
    var shown = displayPipeline(PodiumStore.cycleById(state, b.cycleId), b.pipeline);
    var stage = inlineStage(shown);
    if (b.selection === "top") return '<span class="post-status top">' + esc(T("badge.top")) + " \u00b7 " + esc(stage) + "</span>";
    return '<span class="post-status random">' + esc(T("badge.random")) + " \u00b7 " + esc(stage) + "</span>";
  }

  var linkedPostId = null;
  var linkedSuffix = null;
  var lastCodeJump = null;
  var linkMissing = false;

  /* On-demand post translation (multilingual slice, step 4): a reader aid,
     never the record. The control appears on full-post views (thread view,
     briefing cards, Prior cards) only when the post's frozen lang differs
     from the current UI language. The original is never altered, hidden,
     or replaced; the translation renders in a separate labeled box below
     it. Translations cache in memory for the session (post id + target
     language); a reload clears them. One attempt per click; failures show
     the unavailable note and disable the button (no retry loop). */
  var translateCache = new Map();
  function needsTranslation(p) {
    var pl = p && p.lang;
    return !!pl && pl !== "und" && pl !== uiLang();
  }
  function translateBox(text) {
    var box = document.createElement("div");
    box.className = "zone zone-post";
    box.innerHTML = '<span class="zone-label">' + esc(T("translate.label")) + "</span>" +
      "<blockquote>" + esc(text) + "</blockquote>";
    return box;
  }
  /* Shared translation fetch behind one per-post cache (post id + target
     language): a post translated once — by hand or automatically — is never
     re-called in the session. Resolves the text, or null when unavailable. */
  var transInflight = {};
  function fetchTranslation(post, target) {
    var key = post.id + "|" + target;
    if (translateCache.has(key)) return Promise.resolve(translateCache.get(key));
    if (transInflight[key]) return transInflight[key];
    var pr = PodiumAI.translatePost(post.body, post.lang, target).then(function (text) {
      delete transInflight[key];
      if (!text) return null;
      translateCache.set(key, text);
      return text;
    }, function () {
      delete transInflight[key];
      return null;
    });
    transInflight[key] = pr;
    return pr;
  }
  function mountTranslateSlot(slot, post) {
    if (slot.getAttribute("data-mounted")) return;
    slot.setAttribute("data-mounted", "true");
    if (!needsTranslation(post)) { if (slot.parentNode) slot.parentNode.removeChild(slot); return; }
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-small";
    btn.textContent = T("translate.button");
    btn.addEventListener("click", function () {
      var target = uiLang();
      var key = post.id + "|" + target;
      if (translateCache.has(key)) {
        if (!slot.querySelector(".zone")) slot.appendChild(translateBox(translateCache.get(key)));
        return;
      }
      btn.disabled = true;
      fetchTranslation(post, target).then(function (text) {
        if (!text) {
          var note = document.createElement("p");
          note.className = "hint";
          note.textContent = T("translate.unavailable");
          slot.appendChild(note);
          return; /* button stays disabled: no retry loop */
        }
        slot.appendChild(translateBox(text));
        btn.disabled = false;
      });
    });
    slot.appendChild(btn);
  }
  function translateSlotHtml(p) {
    return '<div class="translate-slot" data-post="' + esc(p.id) + '"></div>';
  }
  function mountTranslateSlots(root) {
    Array.prototype.forEach.call(root.querySelectorAll(".translate-slot"), function (slot) {
      var p = findPostAny(slot.getAttribute("data-post"));
      if (p) mountTranslateSlot(slot, p);
      else if (slot.parentNode) slot.parentNode.removeChild(slot);
    });
  }

  /* Demo cap display: the browser's already-cast vote shows as voted even
     after switching demo citizen, so the control reflects the cast vote. */
  function browserHasVoted(pid) {
    if (!state.currentUserId) return false;
    if (PodiumStore.hasVoted(state, state.currentUserId, pid)) return true;
    var p = findPostAny(pid), dv = state.demoVote;
    return !!(p && dv && dv.cycleId === p.cycleId && dv.postId === pid);
  }
  function postLi(p, linked) {
    var li = document.createElement("li");
    li.className = "post" + (linked ? " is-linked" : "");
    if (linked) li.id = "linkedPost";
    var author = PodiumStore.citizenById(state, p.authorId);
    var open = (p.cycleId === currentCycle());
    var voted = browserHasVoted(p.id);
    var cycle = PodiumStore.cycleById(state, p.cycleId);
    var html = '<div class="post-meta"><span class="post-author">' + esc(p.author || author.name) +
      "</span>" + stateSuffix(p) + langSuffix(p) + '<span title="' + esc(T("citizen.verified.title")) + '">' + esc(T("citizen.verified.small")) + "</span>" +
      '<span class="post-topic">' + esc(Ttopic(p.topic)) + "</span>" +
      '<span class="ref-code">' + esc(p.ref || "") + "</span>" +
      (p.generated ? '<span class="post-status live">' + esc(T("livefeed.badge")) + "</span>" : "") +
      "<span>" + esc(dateShown(p)) + " \u00b7 " + esc(cycleLabel(cycle)) + "</span>" +
      statusChip(p.id) + "</div>" +
      '<p class="post-body">' + esc(p.body) + "</p>" + sealHtml(p) +
      '<div class="post-actions">';
    /* Generated demonstration posts carry no upvote control: they are never
       voted on. */
    if (open && !p.generated) {
      html += '<button type="button" class="vote-btn" data-post="' + esc(p.id) + '" aria-pressed="' + (voted ? "true" : "false") + '">' +
        (voted ? T("vote.upvoted") : T("vote.up")) + "</button>";
    }
    html += '<button type="button" class="share-btn" data-share="' + esc(p.id) + '">' + esc(T("share.button")) + "</button>";
    html += '<span class="vote-count">' + votesLabel(p.votes) +
      (voted ? T("vote.yours") : "") +
      (open ? "" : T("vote.closed")) + esc(T("vote.simulated")) + "</span></div>";
    li.innerHTML = html;
    return li;
  }

  function attachCardButtons(list) {
    list.querySelectorAll(".vote-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!state.currentUserId) { openCitizens("vote"); return; }
        /* One vote per cycle, frozen pages: update the affected counts in
           place — no re-sort, no re-page, no snapshot rebuild. */
        var pid = btn.getAttribute("data-post");
        var prev = PodiumStore.userVoteInCycle(state, state.currentUserId, currentCycle());
        var vres = PodiumStore.castVote(state, state.currentUserId, pid);
        if (vres && vres !== "capped") { var vp = findPostAny(pid); audit("vote", vp ? (vp.ref || pid) : pid, vres); }
        if (vres === "capped" && state.demoVote) refreshVoteButtons(state.demoVote.postId);
        refreshVoteButtons(prev);
        refreshVoteButtons(pid);
      });
    });
    list.querySelectorAll(".share-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var p = findPostAny(btn.getAttribute("data-share"));
        if (p) doShare(p, btn);
      });
    });
  }

  function firstSentence(body) {
    var m = /^(.+?[.!?])(\s|$)/.exec(body);
    return m ? m[1] : body.slice(0, 120);
  }
  function answerCode(post) { return (post.ref || "") + "-A"; }
  function updateCode(post, i) { return (post.ref || "") + "-U" + (i + 1); }
  /* Displayed committee answers lose the seeded "Sample committee response"
     data label at render time — plain ("Sample committee response: ...")
     and parenthetical ("Sample committee response (...): ...") forms —
     and the remainder's first letter is capitalized so the record reads
     finished. Stored text is never touched; Wonder drafts carry no prefix,
     so the strip is a no-op there. */
  function displayAnswer(a) {
    var s = String(a == null ? "" : a).replace(/^Sample committee response(\s*\([^)]*\))?:\s*/, "");
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  /* Post-integrity display (TY, Nov 3): recompute the stored hash at
     display time. Match → short fingerprint (first 12 hex chars).
     Mismatch (or a missing recorded hash) → tamper warning instead of a
     verified fingerprint. Display-only; never mutates the post. */
  function sealHtml(p) {
    if (!p) return "";
    var recomputed = PodiumStore.hashPost(state, p);
    if (p.hash && p.hash === recomputed) {
      return '<p class="hint">SHA-256 <span class="seal-code">' + esc(recomputed.slice(0, 12)) + "</span></p>";
    }
    return '<p class="gate-error">' + esc(T("sec.tamper")) + "</p>";
  }
  /* Audit logging (TY, Nov 3): every listed action appends a hash-chained
     entry via the store; the chain is verified at display on the Status
     tab. Log-only: a logging failure must never break the action. */
  function audit(ev, ref, detail) {
    try { PodiumStore.auditAppend(state, ev, ref || "", detail || "", etNow()); } catch (e) { /* log-only */ }
  }
  function adviceOutcomeLabel(o) { var k = "advice.outcome." + (o || ""); try { var s = T(k); return (s === k || !s) ? String(o || "") : s; } catch (e) { return String(o || ""); } }
  function auditEvLabel(ev) {
    var k = "audit.ev." + ev, s = T(k);
    return (s === k || !s) ? ev : s;
  }

  /* Thread view: the post plus its answer and updates, each with its code.
     Used for deep links and code search. highlight is null | "A" | "U<n>". */
  function renderThread(list, post, highlight) {
    var pli = postLi(post, true);
    list.appendChild(pli);
    var pbody = pli.querySelector(".post-body");
    if (pbody) {
      var tslot = document.createElement("div");
      tslot.className = "translate-slot";
      tslot.setAttribute("data-post", post.id);
      pbody.parentNode.insertBefore(tslot, pbody.nextSibling);
    }
    mountTranslateSlots(list);
    var b = PodiumStore.briefingItemFor(state, post.id);
    if (!b) return;
    var ans = document.createElement("li");
    ans.className = "card zone-answer" + (highlight === "A" ? " thread-hl" : "");
    if (highlight === "A") ans.id = "threadTarget";
    ans.innerHTML = '<span class="zone-label">' + esc(T("thread.answer")) + "</span>" +
      '<p><span class="ref-code">' + esc(answerCode(post)) + "</span></p>" +
      "<p>" + esc(displayAnswer(b.answer)) + "</p>";
    list.appendChild(ans);
    b.updates.forEach(function (u, i) {
      var hl = highlight === ("U" + (i + 1));
      var li = document.createElement("li");
      li.className = "card zone-answer" + (hl ? " thread-hl" : "");
      if (hl) li.id = "threadTarget";
      li.innerHTML = '<span class="zone-label">' + esc(T("thread.update")) + " U" + (i + 1) + "</span>" +
        '<p><span class="ref-code">' + esc(updateCode(post, i)) + "</span> <strong>" + esc(u.date) + "</strong></p>" +
        "<p>" + esc(u.text) + "</p>";
      list.appendChild(li);
    });
  }
  function scrollThreadTarget() {
    var t = $("threadTarget") || $("linkedPost");
    if (t && t.scrollIntoView) t.scrollIntoView();
  }

  function renderFeed() {
    var list = $("postList");
    list.innerHTML = "";
    if (linkedPostId) {
      var lp = findPostAny(linkedPostId);
      if (lp) {
        var noteEl = $("feedNote");
        var lpOpen = (lp.cycleId === currentCycle());
        noteEl.textContent = lpOpen ? T("feed.opened.open") : T("feed.opened.past");
        if (!lpOpen && PodiumStore.briefingItemFor(state, lp.id)) {
          noteEl.appendChild(fullRecordButton(lp.id));
          noteEl.appendChild(document.createTextNode(" "));
        }
        var back = document.createElement("button");
        back.type = "button";
        back.className = "btn btn-small";
        back.textContent = T("feed.showfull");
        back.addEventListener("click", clearDeepLink);
        noteEl.appendChild(back);
        renderThread(list, lp, linkedSuffix);
        attachCardButtons(list);
        scrollThreadTarget();
        return;
      }
      linkedPostId = null;
      linkedSuffix = null;
    }
    if (linkMissing) {
      var noteEl = $("feedNote");
      noteEl.textContent = T("feed.gone");
      var back = document.createElement("button");
      back.type = "button";
      back.className = "btn btn-small";
      back.textContent = T("feed.showfull");
      back.addEventListener("click", clearDeepLink);
      noteEl.appendChild(back);
      var liGone = document.createElement("li");
      liGone.className = "post";
      liGone.textContent = T("feed.gone.li");
      list.appendChild(liGone);
      return;
    }
    /* Live Feed = current cycle only: the posts citizens can vote on now.
       Reference-code search jumps to a thread (unpaginated, as before);
       every other list below is the frozen, paginated snapshot. */
    var raw = $("searchInput").value.trim();
    var cm = /^([A-Z])-(\d+)(?:-(A|U\d+))?$/i.exec(raw);
    if (cm) {
      var base = cm[1].toUpperCase() + "-" + (cm[2].length > 4 ? cm[2] : ("0000" + cm[2]).slice(-4));
      var suffix = cm[3] ? cm[3].toUpperCase() : null;
      if (suffix === "U0") suffix = null; /* updates start at U1 */
      var found = postRefAny(base);
      if (!found) {
        $("feedNote").textContent = Tf("feed.nocode", { code: raw.toUpperCase() });
        var liNone = document.createElement("li");
        liNone.className = "post";
        liNone.textContent = T("feed.nocode.li");
        list.appendChild(liNone);
        return;
      }
      $("feedNote").textContent = suffix
        ? Tf("feed.code.thread", { code: base + "-" + suffix })
        : Tf("feed.code.record", { code: base });
      renderThread(list, found, suffix);
      attachCardButtons(list);
      if (base + (suffix || "") !== lastCodeJump) {
        lastCodeJump = base + (suffix || "");
        scrollThreadTarget();
      }
      return;
    }
    lastCodeJump = null;
    var ids = ensureFeedList(false);
    var totalPages = Math.max(1, Math.ceil(ids.length / feedPageSize));
    if (feedPage > totalPages) { feedPage = totalPages; saveFeedState(); }
    if (feedPage < 1) feedPage = 1;
    var note = "";
    if (feedSort === "top") {
      note = T("feed.note.top");
    } else if (feedSort === "needs") {
      note = T("feed.note.needs");
    } else if (feedSort === "discover") {
      note = T("feed.note.discover");
    } else if (raw) {
      note = ids.length === 1 ? T("feed.note.results.one") : Tf("feed.note.results.many", { n: ids.length });
    } else {
      note = T("feed.note.recent");
    }
    if (feedTopic) note += Tf("feed.note.filtered", { topic: Ttopic(feedTopic), n: ids.length });
    if (liveGenOn && liveGenCapped) note = T("livefeed.cap");
    $("feedNote").textContent = note;
    syncFeedControls();
    renderTopicList();
    renderPager(ids.length, totalPages);
    if (!ids.length) {
      var li0 = document.createElement("li");
      li0.className = "post";
      li0.textContent = T("feed.empty");
      list.appendChild(li0);
      return;
    }
    var renderedPage = [];
    ids.slice((feedPage - 1) * feedPageSize, feedPage * feedPageSize).forEach(function (id) {
      var p = findPostAny(id);
      if (!p) return;
      var card = postLi(p, false);
      card.setAttribute("data-autotranslate", p.id);
      list.appendChild(card);
      renderedPage.push(p);
    });
    attachCardButtons(list);
    autoTranslatePage(renderedPage);
  }

  /* ---------- composer ---------- */
  var composerText = $("composerText");
  var publishBtn = $("publishBtn");
  var gateState = { hard: [], soft: [], punctFix: null, clarityHold: false, overLimit: false };

  function updateOnePostNotice() {
    var box = $("onePostNotice");
    if (!state.currentUserId) {
      box.hidden = false;
      box.innerHTML = T("notice.signin");
      var sb = document.createElement("button");
      sb.type = "button";
      sb.className = "btn btn-small";
      sb.textContent = T("citizen.signin");
      sb.addEventListener("click", function () { openCitizens("post"); });
      box.appendChild(sb);
      $("composerForm").style.display = "none";
      return;
    }
    var existing = PodiumStore.userPostInCycle(state, state.currentUserId, currentCycle());
    if (existing) {
      box.hidden = false;
      box.innerHTML = T("notice.published.a") +
        esc(excerpt(existing.body, 90)) + T("notice.published.b");
      $("composerForm").style.display = "none";
    } else {
      box.hidden = true;
      $("composerForm").style.display = "";
    }
  }

  function renderComposerGate(fast) {
    var text = composerText.value;
    /* Last-seen text for the sentence-ender fast path (below): every caller
       that sets the composer value programmatically renders right after,
       so syncing here keeps the keystroke diff exact with no per-site edits. */
    composerPrevText = text;
    /* A wholly replaced draft (new opening) is a new draft: guided answers
       given for the old opening must not leak into its help panel. */
    var headNow = text.slice(0, 24);
    if (promptHead !== null && headNow !== promptHead) promptAnswers = { what: "", want: "", who: "" };
    promptHead = headNow;
    var words = PodiumAI.countWords(text);

    gateState.overLimit = words > PodiumAI.WORD_LIMIT;
    var timer = $("readTimer");
    timer.textContent = timerShown(text);
    timer.classList.toggle("over", gateState.overLimit);

    var res = PodiumAI.checkText(text);
    if (liveGateCache && liveGateCache.text === text) {
      res = { hard: unionHard(res.hard, liveGateCache.hard), soft: unionSoft(res.soft, liveGateCache.soft), punctFix: res.punctFix };
    }
    gateState.hard = res.hard;
    gateState.soft = res.soft;
    gateState.punctFix = res.punctFix || null;
    /* Comprehensibility hold: local verdict stands; live may only add a hold,
       never lift one. Live proposal wins when verified, else the tidy. */
    var localClarity = PodiumAI.clarityOf(text);
    var clarity = localClarity;
    var proposal = null;
    scheduleClarityLive(text, res.hard.length > 0, fast);
    if (liveClarityCache && liveClarityCache.text === text) {
      if (liveClarityCache.unclear && !localClarity.unclear) {
        clarity = { unclear: true, hasSentence: localClarity.hasSentence, topic: localClarity.topic, ask: localClarity.ask, words: localClarity.words };
      }
      if (clarity.unclear && liveClarityCache.proposal) proposal = verifyProposal(liveClarityCache.proposal, text, clarity);
    }
    /* Live-clear override for non-English posts: the local clarity check
       uses English-based topic/ask heuristics and systematically flags
       clean non-English drafts unclear. When the live gate has detected a
       non-English language for this exact text and live clarity judges it
       clear, the local unclear must not hold the post on its own.
       English, unknown ("und"), missing/stale language, a live unclear
       verdict, or no live verdict at all keep the current behavior. */
    var gateLang = (liveGateCache && liveGateCache.text === text && liveGateCache.lang) ? liveGateCache.lang : "und";
    var liveClearOverride = gateLang !== "und" && gateLang !== "en" && gateLang.indexOf("en-") !== 0 &&
      liveClarityCache && liveClarityCache.text === text && liveClarityCache.unclear === false;
    if (liveClearOverride) {
      clarity = { unclear: false, hasSentence: localClarity.hasSentence, topic: localClarity.topic, ask: localClarity.ask, words: localClarity.words };
      proposal = null;
    }
    if (!proposal && localClarity.unclear && !res.hard.length && !liveClearOverride) {
      proposal = verifyProposal(PodiumAI.tidyDraft(text), text, localClarity);
    }
    gateState.clarityHold = clarity.unclear;
    var gm = $("gateMessages");
    gm.innerHTML = "";
    var sf = $("softFlags");
    sf.innerHTML = "";

    scheduleLiveGate(text, fast);
    if (!text.trim()) {
      publishBtn.disabled = true;
      clarityDismissedFor = null;
      renderVoiced(null);
      renderClarityPanel("", res, { unclear: false }, null);
      return;
    }
    if (gateState.overLimit) {
      var d0 = document.createElement("div");
      d0.className = "gate-error";
      d0.textContent = Tf("gate.overlimit", { n: words });
      gm.appendChild(d0);
    }
    if (res.hard.length) {
      var d1 = document.createElement("div");
      d1.className = "gate-error";
      d1.innerHTML = Tf("gate.hard", { spans: esc(res.hard.join(", ")) });
      gm.appendChild(d1);
    }
    if (!res.hard.length && res.soft.length) {
      var d2 = document.createElement("div");
      d2.className = "gate-hold";
      d2.innerHTML = Tf("gate.soft", { n: res.soft.length });
      gm.appendChild(d2);
      res.soft.forEach(function (f) {
        var chip = document.createElement("span");
        chip.className = "flag-chip";
        var label = "\u201c" + f.word + "\u201d \u2014 " + Tes(f.reason) + " ";
        chip.textContent = label;
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = f.suggestion ? Tf("chip.use", { sug: f.suggestion }) : T("chip.remove");
        b.setAttribute("aria-label", f.suggestion ? Tf("chip.aria.replace", { w: f.word, s: f.suggestion }) : Tf("chip.aria.remove", { w: f.word }));
        b.addEventListener("click", function () {
          var re = new RegExp("\\b" + f.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", f.caseSensitive ? "g" : "gi");
          composerText.value = composerText.value.replace(re, f.suggestion).replace(/ {2,}/g, " ");
          renderComposerGate();
          composerText.focus();
        });
        chip.appendChild(b);
        sf.appendChild(chip);
      });
    }
    if (!res.hard.length && res.punctFix) {
      var pf = document.createElement("div");
      pf.className = "gate-hold";
      pf.textContent = T("gate.punct");
      var fixBtn = document.createElement("button");
      fixBtn.type = "button";
      fixBtn.textContent = T("gate.punct.fix");
      fixBtn.addEventListener("click", function () {
        composerText.value = res.punctFix;
        renderComposerGate();
      });
      pf.appendChild(fixBtn);
      gm.appendChild(pf);
    }
    if (!res.hard.length && clarity.unclear) {
      var ch = document.createElement("div");
      ch.className = "gate-hold";
      ch.innerHTML = T("gate.unclear");
      gm.appendChild(ch);
    }
    renderClarityPanel(text, res, clarity, proposal);
    if (!res.hard.length && !res.soft.length && !gateState.overLimit && !res.punctFix && !clarity.unclear) {
      var d3 = document.createElement("div");
      d3.className = "gate-ok";
      d3.textContent = T("gate.ok");
      gm.appendChild(d3);
    }
    var blocked = res.hard.length > 0 || res.soft.length > 0 || res.punctFix || clarity.unclear || gateState.overLimit;
    publishBtn.disabled = blocked;

  }
  /* Live gate merge: local result (above) always stands; live may only add.
     The cache is keyed by exact draft text, so stale results never apply. */
  var liveGateCache = null;
  var liveGateTimer = null;
  var liveGateSnap = null; /* latest text for the armed run */
  var liveGateSeq = 0; /* in-flight guard: only the newest run may render or flip the AI mode */
  function unionHard(a, b) {
    var out = (a || []).slice(), seen = {};
    out.forEach(function (x) { seen[x] = true; });
    (b || []).forEach(function (x) { if (!seen[x]) { seen[x] = true; out.push(x); } });
    return out;
  }
  /* First-wins: local's casing-correct suggestion keeps its slot when live
     flags the same word, so the chip text never flickers on merge. A live
     capitalised suggestion still upgrades a local lowercase one. */
  function unionSoft(a, b) {
    var out = [], seen = {};
    (a || []).forEach(function (f) {
      if (f && f.word && !seen[String(f.word).toLowerCase()]) {
        seen[String(f.word).toLowerCase()] = true;
        out.push({ word: f.word, suggestion: f.suggestion, reason: f.reason, caseSensitive: f.caseSensitive });
      }
    });
    (b || []).forEach(function (f) {
      if (f && f.word && !seen[String(f.word).toLowerCase()]) {
        seen[String(f.word).toLowerCase()] = true;
        out.push({ word: f.word, suggestion: f.suggestion, reason: f.reason || T("reason.live"), caseSensitive: f.caseSensitive });
      }
    });
    out.forEach(function (f) {
      var g = (b || []).filter(function (x) { return x && String(x.word).toLowerCase() === String(f.word).toLowerCase(); })[0];
      if (g && !/^[A-Z]/.test(String(f.suggestion || "")) && /^[A-Z]/.test(String(g.suggestion || "")) && String(f.suggestion).toLowerCase() === String(g.suggestion).toLowerCase()) {
        f.suggestion = g.suggestion;
      }
    });
    return out;
  }
  /* Sentence-ender fast path: typing . ? or ! runs the live gate check on
     a short debounce instead of waiting for the full pause. Slow keystrokes
     refresh the armed run's snapshot but keep its deadline; a punct keystroke
     shortens a pending pause wait. Commas and other mid-sentence punctuation
     never qualify, so they keep the pause path. */
  var SENT_END_RE = /[.?!]/;
  var composerPrevText = "";
  function endsSentenceNew(cur, e) {
    /* Synthetic input events carry no data: diff against the last-seen text
       (synced at the top of renderComposerGate) and inspect the net insertion.
       Deletions and net-zero replacements keep the pause path. */
    if (e && typeof e.data === "string" && e.data) return SENT_END_RE.test(e.data);
    if (cur.length <= composerPrevText.length) return false;
    var i = 0;
    while (i < composerPrevText.length && cur.charCodeAt(i) === composerPrevText.charCodeAt(i)) i++;
    return SENT_END_RE.test(cur.slice(i, i + (cur.length - composerPrevText.length)));
  }
  function scheduleLiveGate(text, fast) {
    if (!text.trim()) {
      if (liveGateTimer) { clearTimeout(liveGateTimer); liveGateTimer = null; }
      liveGateCache = null; liveGateSnap = null; return;
    }
    if (liveGateCache && liveGateCache.text === text) {
      if (liveGateTimer) { clearTimeout(liveGateTimer); liveGateTimer = null; }
      return; /* cached; merges on render */
    }
    liveGateSnap = text;
    if (liveGateTimer) {
      if (!fast) return; /* armed: snapshot refreshed above, deadline stands */
      clearTimeout(liveGateTimer); liveGateTimer = null; /* punct: shorten the wait */
    }
    liveGateTimer = setTimeout(function () {
      liveGateTimer = null;
      var snapshot = liveGateSnap;
      var seq = ++liveGateSeq;
      PodiumAI.checkTextLive(snapshot, { isCurrent: function () { return seq === liveGateSeq; } }).then(function (live) {
        if (!live) return; /* fallback: local stands, cache untouched */
        liveGateCache = { text: snapshot, hard: live.hard || [], soft: live.soft || [], lang: live.lang || "und" };
        if (seq !== liveGateSeq) return; /* stale: a newer run started */
        if (composerText.value !== snapshot) return; /* stale */
        renderComposerGate();
      });
    }, fast ? PUNCT_DEBOUNCE_MS : LIVE_DEBOUNCE_MS);
  }
  composerText.addEventListener("input", function (e) {
    var fast = endsSentenceNew(composerText.value, e);
    renderComposerGate(fast);
    scheduleVoiced();
    saveDraft();
  });

  /* ---------- comprehensibility hold + wording help ---------- */
  /* A held draft is never a published post: it lives only in the composer
     (persisted below), never in state.posts, so it cannot enter the draw
     pool or count toward one post per cycle. Nothing here publishes: the
     "Use this version" click loads the approved words and runs the normal
     publish path, which re-verifies everything. */
  var DRAFT_KEY = "podium.v1.draft";
  var draftSaveTimer = null;
  function saveDraft() {
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(function () {
      draftSaveTimer = null;
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ text: composerText.value, topic: $("composerTopic").value }));
      } catch (e) { /* private mode: the draft simply does not persist */ }
    }, 500);
  }
  function restoreDraft() {
    var raw = null;
    try { raw = localStorage.getItem(DRAFT_KEY); } catch (e) { return; }
    if (!raw) return;
    try {
      var d = JSON.parse(raw);
      if (d && typeof d.text === "string" && d.text && !composerText.value) {
        composerText.value = d.text.slice(0, 9000);
        if (d.topic) $("composerTopic").value = d.topic;
      }
    } catch (e) { /* corrupt draft: start fresh */ }
  }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }

  function canSpeak() { return ("speechSynthesis" in window) && ("SpeechSynthesisUtterance" in window); }
  function speak(text) {
    if (!canSpeak()) return false;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      return true;
    } catch (e) { return false; }
  }
  function stopSpeak() { if (canSpeak()) { try { window.speechSynthesis.cancel(); } catch (e) {} } }

  /* A proposal is offerable only when hard-clean, clear, within the cap, and
     different from the draft. Topic must not drift when both detect one. */
  function verifyProposal(proposal, draftText, draftClarity) {
    if (typeof proposal !== "string") return null;
    var p = proposal.trim();
    if (!p || p === String(draftText).trim()) return null;
    if (PodiumAI.countWords(p) > PodiumAI.WORD_LIMIT) return null;
    if (PodiumAI.checkText(p).hard.length) return null;
    var c = PodiumAI.clarityOf(p);
    if (c.unclear) return null;
    if (draftClarity && draftClarity.ask && !c.ask) return null; /* an approved rewrite must keep the author's ask */
    if (draftClarity && draftClarity.topic && c.topic && c.topic !== draftClarity.topic) return null;
    return p;
  }

  var liveClarityCache = null;
  var liveClarityTimer = null;
  var liveClaritySnap = null;
  var liveClaritySeq = 0; /* same in-flight guard as the wording channel */
  function scheduleClarityLive(text, skip, fast) {
    if (!text.trim()) {
      if (liveClarityTimer) { clearTimeout(liveClarityTimer); liveClarityTimer = null; }
      liveClarityCache = null; liveClaritySnap = null; return;
    }
    if (skip) return;
    if (liveClarityCache && liveClarityCache.text === text) {
      if (liveClarityTimer) { clearTimeout(liveClarityTimer); liveClarityTimer = null; }
      return; /* cached; merges on render */
    }
    liveClaritySnap = text;
    if (liveClarityTimer) {
      if (!fast) return; /* armed: snapshot refreshed above, deadline stands */
      clearTimeout(liveClarityTimer); liveClarityTimer = null;
    }
    liveClarityTimer = setTimeout(function () {
      liveClarityTimer = null;
      var snapshot = liveClaritySnap;
      var seq = ++liveClaritySeq;
      PodiumAI.checkClarityLive(snapshot, { isCurrent: function () { return seq === liveClaritySeq; } }).then(function (live) {
        if (!live) return; /* fallback: local stands, cache untouched */
        liveClarityCache = { text: snapshot, unclear: live.unclear, proposal: live.proposal || null };
        if (seq !== liveClaritySeq) return; /* stale: a newer run started */
        if (composerText.value !== snapshot) return; /* stale */
        renderComposerGate();
      });
    }, fast ? PUNCT_DEBOUNCE_MS : LIVE_DEBOUNCE_MS);
  }

  var clarityDismissedFor = null; /* snapshot whose rewrite offer was declined */
  var promptAnswers = { what: "", want: "", who: "" };
  var promptHead = null; /* opening snapshot the current prompt answers were given for */
  var builtOffer = null; /* { text, built } answer-composed proposal awaiting approval */
  var clarityRenderKey = null;
  function renderClarityPanel(text, res, clarity, proposal) {
    var panel = $("clarityPanel");
    if (builtOffer && builtOffer.text !== text) builtOffer = null;
    var showHelp = !res.hard.length && clarity.unclear && !!text.trim() && text !== clarityDismissedFor;
    var useBuilt = !!(showHelp && builtOffer && builtOffer.text === text);
    var effProposal = useBuilt ? builtOffer.built : (showHelp ? proposal : null);
    var key = showHelp ? ((useBuilt ? "B" : "C") + text + "\n" + (effProposal || "")) : "off";
    if (key === clarityRenderKey) return;
    clarityRenderKey = key;
    panel.innerHTML = "";
    if (!showHelp) { panel.hidden = true; return; }
    panel.hidden = false;
    if (effProposal) renderOffer(panel, text, effProposal, useBuilt);
    else renderPrompts(panel);
  }

  function renderOffer(panel, text, proposal, built) {
    var wrap = document.createElement("div");
    wrap.className = "gate-hold";
    var title = built ? T("offer.built") : T("offer.proposed");
    var t = document.createElement("div");
    t.innerHTML = "<strong>" + esc(title) + "</strong>" + esc(T("offer.until"));
    wrap.appendChild(t);
    var cols = document.createElement("div");
    cols.style.display = "flex";
    cols.style.flexWrap = "wrap";
    cols.style.gap = "8px";
    cols.style.margin = "8px 0";
    [[T("offer.yours"), String(text).trim()], [T("offer.version"), proposal]].forEach(function (pair) {
      var cell = document.createElement("div");
      cell.style.flex = "1 1 220px";
      var lab = document.createElement("div");
      lab.textContent = pair[0];
      var q = document.createElement("blockquote");
      q.textContent = pair[1];
      q.style.margin = "4px 0";
      cell.appendChild(lab);
      cell.appendChild(q);
      cols.appendChild(cell);
    });
    wrap.appendChild(cols);
    var row = document.createElement("div");
    var useBtn = document.createElement("button");
    useBtn.type = "button";
    useBtn.className = "btn btn-small";
    useBtn.textContent = T("offer.use");
    useBtn.addEventListener("click", function () { useProposal(proposal); });
    row.appendChild(useBtn);
    row.appendChild(document.createTextNode(" "));
    var keepBtn = document.createElement("button");
    keepBtn.type = "button";
    keepBtn.className = "btn btn-small";
    keepBtn.textContent = T("offer.keep");
    keepBtn.addEventListener("click", function () {
      clarityDismissedFor = composerText.value;
      builtOffer = null;
      promptAnswers = { what: "", want: "", who: "" };
      clarityRenderKey = null;
      renderComposerGate();
      composerText.focus();
    });
    row.appendChild(keepBtn);
    if (canSpeak()) {
      row.appendChild(document.createTextNode(" "));
      var hearBtn = document.createElement("button");
      hearBtn.type = "button";
      hearBtn.className = "btn btn-small";
      hearBtn.textContent = T("offer.hear");
      hearBtn.addEventListener("click", function () { speak(proposal); });
      row.appendChild(hearBtn);
    } else {
      var nn = document.createElement("div");
      nn.className = "hint";
      nn.textContent = T("offer.novoice");
      wrap.appendChild(nn);
    }
    wrap.appendChild(row);
    panel.appendChild(wrap);
  }

  function useProposal(proposal) {
    stopSpeak();
    var p = verifyProposal(proposal, composerText.value, PodiumAI.clarityOf(composerText.value));
    if (!p) { clarityRenderKey = null; renderComposerGate(); return; } /* stale offer: re-evaluate */
    composerText.value = p;
    builtOffer = null;
    clarityDismissedFor = null;
    renderComposerGate();
    if (!PodiumAI.getKey()) {
      /* Publishes only when fully clean; otherwise the approved words stay
         in the composer with the remaining holds shown for fixing. */
      tryPublish(true);
      return;
    }
    /* A key is set: Spark gets the last word on the approved text before it
       can publish. Any live detection stands; the author then fixes and
       publishes. A failed call falls back silently, as everywhere. */
    PodiumAI.checkTextLive(p).then(function (live) {
      if (composerText.value !== p) return; /* author moved on */
      if (live && ((live.hard && live.hard.length) || (live.soft && live.soft.length))) {
        liveGateCache = { text: p, hard: live.hard || [], soft: live.soft || [], lang: live.lang || "und" };
        renderComposerGate();
        return;
      }
      PodiumAI.checkClarityLive(p).then(function (cl) {
        if (composerText.value !== p) return;
        if (cl && cl.unclear) {
          liveClarityCache = { text: p, unclear: true, proposal: cl.proposal || null };
          clarityRenderKey = null;
          renderComposerGate();
          return;
        }
        tryPublish(true);
      });
    });
  }

  function renderPrompts(panel) {
    var wrap = document.createElement("div");
    wrap.className = "gate-hold";
    var t = document.createElement("div");
    t.innerHTML = "<strong>" + esc(T("prompts.title")) + "</strong>" + esc(T("prompts.nooffer"));
    wrap.appendChild(t);
    [["what", T("prompts.what")], ["want", T("prompts.want")], ["who", T("prompts.who")]].forEach(function (pair) {
      var fd = document.createElement("div");
      fd.className = "field";
      var lab = document.createElement("label");
      lab.textContent = pair[1];
      var inp = document.createElement("input");
      inp.type = "text";
      inp.value = promptAnswers[pair[0]];
      (function (key, el) {
        el.addEventListener("input", function () { promptAnswers[key] = el.value; });
      })(pair[0], inp);
      lab.appendChild(inp);
      fd.appendChild(lab);
      wrap.appendChild(fd);
    });
    var msg = document.createElement("div");
    msg.className = "hint";
    wrap.appendChild(msg);
    var buildBtn = document.createElement("button");
    buildBtn.type = "button";
    buildBtn.className = "btn btn-small";
    buildBtn.textContent = T("prompts.build");
    buildBtn.addEventListener("click", function () { buildFromAnswers(panel, msg); });
    wrap.appendChild(buildBtn);
    panel.appendChild(wrap);
  }

  /* Compose a draft from the author's answers only: each answer becomes one
     sentence (first letter capitalized, terminal period added). No other
     words are added, and the result still faces the hard screen and the
     clarity check before any approval can publish it. */
  function buildFromAnswers(panel, msg) {
    var sents = [];
    ["what", "want", "who"].forEach(function (k) {
      var a = promptAnswers[k].trim();
      if (!a) return;
      a = a.charAt(0).toUpperCase() + a.slice(1);
      if (!/[.!?]$/.test(a)) a += ".";
      sents.push(a);
    });
    if (!sents.length) { msg.textContent = T("prompts.needone"); return; }
    var built = sents.join(" ");
    if (PodiumAI.checkText(built).hard.length) {
      msg.textContent = T("prompts.badwords");
      return;
    }
    var bc = PodiumAI.clarityOf(built);
    if (bc.unclear) {
      /* Still unclear: show the composed words in the composer for fixing. */
      composerText.value = built;
      clarityRenderKey = null;
      renderComposerGate();
      composerText.focus();
      return;
    }
    builtOffer = { text: composerText.value, built: built };
    clarityRenderKey = null;
    renderComposerGate();
  }

  function wireHearUi() {
    var hb = $("hearDraftBtn");
    if (!hb) return;
    if (!canSpeak()) {
      var note = document.createElement("span");
      note.className = "hint";
      note.id = "hearNoVoice";
      note.textContent = T("hear.novoice");
      hb.parentNode.replaceChild(note, hb);
      return;
    }
    hb.addEventListener("click", function () {
      var text = composerText.value.trim();
      if (!text) { composerText.focus(); return; }
      speak(text);
    });
  }

  function pipelineLabel(postId) {
    var b = PodiumStore.briefingItemFor(state, postId);
    if (!b) return T("pipe.none");
    return (b.selection === "top" ? T("pipe.top") : T("pipe.random")) + ", " + pipeStage(displayPipeline(PodiumStore.cycleById(state, b.cycleId), b.pipeline));
  }

  var voicedTimer = null;
  var voicedShown = false;
  var voicedDismissed = false;
  var voicedForText = null; /* draft lineage the box state belongs to */
  /* Generic live-AI debounce: the live gate, live clarity, and Already-voiced
     checks all wait this long after typing stops before calling out. */
  var LIVE_DEBOUNCE_MS = 2500;
  /* Sentence-ender fast path: typing . ? or ! re-runs the live gate and live
     clarity checks this soon — clearly sooner than the pause, long enough to
     coalesce rapid punctuation ("?!", "..", two quick sentences). */
  var PUNCT_DEBOUNCE_MS = 600;

  /* The box appears only after the user STOPS typing for a few seconds, and
     only once per draft. It sits below the composer and never blocks input. */
  function scheduleVoiced() {
    if (voicedTimer) clearTimeout(voicedTimer);
    voicedTimer = null;
    if (!composerText.value.trim()) {
      voicedShown = false;
      voicedDismissed = false;
      voicedForText = null;
      renderVoiced(null);
      return;
    }
    /* A wholly replaced draft (new opening) is a new draft: the once-per-draft
       box may appear for it. Edits keeping the opening keep the manners. */
    var curHead = composerText.value.slice(0, 24);
    if (voicedForText !== null && curHead !== voicedForText.slice(0, 24)) {
      voicedShown = false;
      voicedDismissed = false;
    }
    if (voicedShown || voicedDismissed) return;
    voicedTimer = setTimeout(function () {
      voicedTimer = null;
      if (voicedShown || voicedDismissed) return;
      var snapshot = composerText.value;
      var scope = PodiumStore.postsForCycle(state, currentCycle());
      var local = PodiumAI.findTopSimilar(snapshot, scope);
      renderVoiced(local);
      PodiumAI.findTopSimilarLive(snapshot, scope).then(function (livePost) {
        if (!livePost) return; /* fallback: local stands */
        if (composerText.value !== snapshot || voicedDismissed) return; /* stale */
        var pool = [];
        if (local) pool.push(local);
        if (!local || livePost.id !== local.id) pool.push(livePost);
        pool.sort(function (a, b) { return b.votes - a.votes; });
        if (pool.length && (!local || pool[0].id !== local.id)) renderVoiced(pool[0]);
      });
    }, LIVE_DEBOUNCE_MS);
  }

  function renderVoiced(match) {
    var panel = $("voicedPanel");
    panel.innerHTML = "";
    if (!match) { panel.hidden = true; return; }
    voicedShown = true;
    voicedForText = composerText.value;
    panel.hidden = false;
    var head = document.createElement("div");
    head.className = "voiced-head";
    var h = document.createElement("h3");
    h.textContent = T("voiced.title");
    var x = document.createElement("button");
    x.type = "button";
    x.className = "voiced-close";
    x.textContent = T("voiced.dismiss");
    x.setAttribute("aria-label", T("voiced.dismiss.aria"));
    x.addEventListener("click", function () {
      voicedDismissed = true;
      voicedForText = composerText.value;
      panel.hidden = true;
    });
    head.appendChild(h);
    head.appendChild(x);
    panel.appendChild(head);
    var author = PodiumStore.citizenById(state, match.authorId);
    var mp = document.createElement("p");
    mp.innerHTML = "<strong>" + esc(author.name) + "</strong> (" + votesLabel(match.votes) +
      " \u00b7 " + esc(pipelineLabel(match.id)) + "): " +
      esc(excerpt(match.body, 220));
    panel.appendChild(mp);
    var rem = document.createElement("p");
    rem.className = "reminder";
    rem.textContent = T("voiced.reminder");
    panel.appendChild(rem);
    var exits = document.createElement("div");
    exits.className = "exits";
    var insteadBtn = document.createElement("button");
    insteadBtn.type = "button";
    insteadBtn.className = "btn btn-small";
    insteadBtn.textContent = (state.currentUserId && PodiumStore.hasVoted(state, state.currentUserId, match.id))
      ? T("vote.upvoted.check") : T("voiced.instead");
    insteadBtn.addEventListener("click", function () {
      if (!state.currentUserId) { openCitizens("vote"); return; }
      if (match.cycleId !== currentCycle()) {
        insteadBtn.textContent = T("vote.closedweek");
        insteadBtn.disabled = true;
        return;
      }
      if (!PodiumStore.hasVoted(state, state.currentUserId, match.id)) {
        PodiumStore.castVote(state, state.currentUserId, match.id);
      }
      insteadBtn.textContent = PodiumStore.hasVoted(state, state.currentUserId, match.id) ? T("vote.upvoted.check") : T("voiced.instead");
      renderFeed();
    });
    var bothBtn = document.createElement("button");
    bothBtn.type = "button";
    bothBtn.className = "btn btn-small";
    bothBtn.textContent = T("voiced.both");
    bothBtn.addEventListener("click", function () {
      if (!state.currentUserId) { openCitizens("vote"); return; }
      if (match.cycleId === currentCycle() && !PodiumStore.hasVoted(state, state.currentUserId, match.id)) {
        PodiumStore.castVote(state, state.currentUserId, match.id);
      }
      renderFeed();
      publishBtn.focus();
    });
    var asisBtn = document.createElement("button");
    asisBtn.type = "button";
    asisBtn.className = "btn btn-small";
    asisBtn.textContent = T("voiced.asis");
    asisBtn.addEventListener("click", function () { publishBtn.focus(); });
    exits.appendChild(insteadBtn);
    exits.appendChild(bothBtn);
    exits.appendChild(asisBtn);
    panel.appendChild(exits);
  }

  /* Layer 1 anti-flood: exact copy of a current-cycle post. Hard gate, with
     no option to post it anyway. The draft is kept; the citizen can upvote instead. */
  function showCopyRedirect(dup) {
    var gm = $("gateMessages");
    gm.innerHTML = "";
    var d = document.createElement("div");
    d.className = "gate-error";
    var msg = document.createElement("p");
    msg.textContent = T("copy.exists");
    d.appendChild(msg);
    var quote = document.createElement("p");
    quote.innerHTML = Tf("copy.existing", { quote: esc(excerpt(dup.body, 200)) });
    d.appendChild(quote);
    var vb = document.createElement("button");
    vb.type = "button";
    vb.className = "btn btn-small";
    vb.textContent = PodiumStore.hasVoted(state, state.currentUserId, dup.id) ? T("vote.upvoted.check") : T("vote.upvoteit");
    vb.addEventListener("click", function () {
      if (!PodiumStore.hasVoted(state, state.currentUserId, dup.id)) {
        PodiumStore.castVote(state, state.currentUserId, dup.id);
      }
      vb.textContent = PodiumStore.hasVoted(state, state.currentUserId, dup.id) ? T("vote.upvoted.check") : T("vote.upvoteit");
      renderFeed();
    });
    d.appendChild(vb);
    gm.appendChild(d);
    publishBtn.disabled = true;
  }

  function tryPublish(fromPreview) {
    if (!state.currentUserId) { openCitizens("post"); return; }
    renderComposerGate();
    if (publishBtn.disabled && !fromPreview) return;
    var text = composerText.value.trim();
    if (!text) return;
    if (gateState.hard.length || gateState.soft.length || gateState.punctFix || gateState.clarityHold || gateState.overLimit) return;
    var dup = PodiumStore.findExactInCycle(state, currentCycle(), text);
    if (dup) { showCopyRedirect(dup); return; }
    /* The frozen language tag comes from the live gate's language verdict
       for this exact text; without one (offline, stub, stale) it is "und"
       and no label renders. Never edited after publishing. */
    var detectedLang = (liveGateCache && liveGateCache.text === text && liveGateCache.lang) ? liveGateCache.lang : "und";
    var post = PodiumStore.publishPost(state, state.currentUserId, currentCycle(), $("composerTopic").value, text, etNow(), detectedLang);
    if (!post) { updateOnePostNotice(); return; }
    audit("post", post.ref, post.id);
    composerText.value = "";
    clearDraft();
    stopSpeak();
    promptAnswers = { what: "", want: "", who: "" };
    builtOffer = null;
    clarityDismissedFor = null;
    clarityRenderKey = null;
    if (voicedTimer) clearTimeout(voicedTimer);
    voicedTimer = null;
    voicedShown = false;
    voicedDismissed = false;
    voicedForText = null;
    renderVoiced(null);
    closeModal($("previewModal"));
    renderComposerGate();
    updateOnePostNotice();
    feedSort = "recent";
    feedTopic = "";
    $("searchInput").value = "";
    feedPage = 1;
    feedList = null; /* rebuild so the new post leads page 1 */
    saveFeedState();
    showView("feed");
    renderFeed();
    $("feedNote").textContent = T("publish.done");
  }
  $("composerForm").addEventListener("submit", function (e) {
    e.preventDefault();
    tryPublish(false);
  });

  /* ---------- preview ---------- */
  function showTopicSuggestion(sug) {
    var pt = $("previewTopic");
    pt.hidden = false;
    pt.innerHTML = T("preview.suggest.a") + esc(Ttopic(sug)) + T("preview.suggest.b");
    var useBtn = document.createElement("button");
    useBtn.type = "button";
    useBtn.className = "btn btn-small";
    useBtn.textContent = T("preview.usetopic");
    useBtn.addEventListener("click", function () {
      $("composerTopic").value = sug;
      pt.hidden = true;
      saveDraft();
    });
    pt.appendChild(useBtn);
  }
  $("previewBtn").addEventListener("click", function () {
    if (!state.currentUserId) { openCitizens("post"); return; }
    var text = composerText.value.trim();
    if (!text) { composerText.focus(); return; }
    $("previewMeta").textContent = currentUser().name + " \u00b7 " + Ttopic($("composerTopic").value) + " \u00b7 " +
      PodiumAI.countWords(text) + " " + T("preview.words") + " \u00b7 " + timerShown(text) + " " + T("preview.readaloud");
    $("previewBody").textContent = text;
    var pt = $("previewTopic");
    var sug = PodiumAI.suggestTopic(text);
    if (sug && sug !== $("composerTopic").value) {
      showTopicSuggestion(sug);
    } else {
      pt.hidden = true;
      pt.innerHTML = "";
      var snapText = text, snapTopic = $("composerTopic").value;
      PodiumAI.suggestTopicLive(text).then(function (liveSug) {
        if (!liveSug) return; /* fallback: nothing to add */
        if ($("previewModal").hidden) return; /* stale */
        if (composerText.value.trim() !== snapText || $("composerTopic").value !== snapTopic) return;
        if (!$("previewTopic").hidden) return; /* first-shown wins */
        showTopicSuggestion(liveSug);
      });
    }
    openModal($("previewModal"));
  });
  $("previewClose").addEventListener("click", function () { closeModal($("previewModal")); });
  $("previewPublish").addEventListener("click", function () { tryPublish(true); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (!$("previewModal").hidden) { closeModal($("previewModal")); return; }
      if (!$("citizenModal").hidden) { closeModal($("citizenModal")); return; }
      return;
    }
    if (e.key !== "Tab") return;
    var box = !$("previewModal").hidden ? $("previewModal") : (!$("citizenModal").hidden ? $("citizenModal") : null);
    if (!box) return;
    var f = modalFocusables(box);
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!box.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  });

  /* ---------- briefing ---------- */
  /* Pipeline stage is displayed from the clock, never from frozen seed flags:
     once the cycle's briefing datetime has passed the stage is "Briefed",
     otherwise the stored pipeline value stands. Stored values are untouched. */
  function displayPipeline(cycle, pipeline) {
    var bAt = cycle && cycleDateTimeFor(cycle, cycle.briefingAt);
    if (bAt && bAt <= etNow()) return "briefed";
    return pipeline;
  }
  function stageHtml(pipeline) {
    var steps = [["selected", T("stage.selected")], ["committee", T("stage.committee")], ["briefed", T("stage.briefed")]];
    var order = { selected: 0, committee: 1, briefed: 2 };
    var cur = order[pipeline] !== undefined ? order[pipeline] : 0;
    return '<div class="stage" role="img" aria-label="' + esc(Tf("stage.aria", { stage: steps[cur][1] })) + '">' + steps.map(function (s, i) {
      return (i > 0 ? '<span class="stage-arrow" aria-hidden="true">\u2192</span>' : "") +
        '<span class="stage-step' + (i <= cur ? " done" : "") + '">' + esc(s[1]) + "</span>";
    }).join("") + "</div>";
  }

  function selectionBadge(cycle, item, p) {
    var poolLen = cycle.poolSize;
    if (item.selection === "top") {
      return '<span class="badge-top">' + esc(T("selbadge.top")) + " \u00b7 " + esc(votesLabel(p.votes)) + esc(T("vote.simulated")) + "</span>";
    }
    return '<span class="badge-random">' + esc(T("selbadge.random")) + " \u00b7 " + esc(T("selbadge.position")) + " " + cycle.position + " " + esc(T("selbadge.of")) + " " + poolLen + "</span>";
  }
  /* Verbatim excerpt only: the author's exact words (first sentence, capped
     at ~200 chars). Never a paraphrase — the Verbatim Rule forbids editors. */
  function briefExcerpt(text) {
    var s = firstSentence(text);
    if (s.length <= 200) return s;
    return excerpt(text, 200);
  }
  /* One box's own expansion button, placed directly under that box.
     Expansion extends the EXISTING box in place: the toggle swaps that same
     box's blockquote between excerpt and full text, so the card never gains
     a second box. "Verbatim" belongs to the citizen post only — the
     answer's button says "answer", never "verbatim", so the two zones
     stay distinct. Labels and button texts stay as they are. */
  function zoneExpander(zoneClass, labelText, fullLabelText, excerptHtml, fullHtml, buttonLabel) {
    var wrap = document.createElement("div");
    var box = document.createElement("div");
    box.className = "zone " + zoneClass;
    box.innerHTML = '<span class="zone-label">' + labelText + "</span><blockquote>" + excerptHtml + "</blockquote>";
    wrap.appendChild(box);
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "btn btn-small";
    toggle.textContent = buttonLabel;
    toggle.setAttribute("aria-expanded", "false");
    toggle.addEventListener("click", function () {
      var expanded = toggle.getAttribute("aria-expanded") === "true";
      box.querySelector("blockquote").innerHTML = expanded ? excerptHtml : fullHtml;
      box.querySelector(".zone-label").textContent = expanded ? labelText : fullLabelText;
      toggle.setAttribute("aria-expanded", String(!expanded));
      toggle.textContent = expanded ? buttonLabel : T("zone.summary");
    });
    wrap.appendChild(toggle);
    return wrap;
  }
  function briefingSummaryCard(cycle, item) {
    var p = PodiumStore.postById(state, item.postId);
    var author = PodiumStore.citizenById(state, p.authorId);
    var li = document.createElement("li");
    li.className = "card";
    var head = document.createElement("div");
    head.innerHTML = "<p>" + selectionBadge(cycle, item, p) + "</p>" +
      '<p class="hint">' + esc(cycleLabel(cycle)) + "</p>" +
      stageHtml(displayPipeline(cycle, item.pipeline)) +
      '<p><span class="ref-code">' + esc(p.ref || "") + "</span> <strong>" + esc(author.name) + "</strong>" + stateSuffix(p) + langSuffix(p) + " \u00b7 " + esc(Ttopic(p.topic)) + " \u00b7 " + esc(votesLabel(p.votes)) + "</p>";
    li.appendChild(head);
    var postExpander = zoneExpander("zone-post", T("zone.post.excerpt"), T("zone.post.full"),
      esc(briefExcerpt(p.body)), esc(p.body), T("zone.post.read"));
    li.appendChild(postExpander);
    var postSeal = document.createElement("div");
    postSeal.innerHTML = sealHtml(p);
    li.appendChild(postSeal);
    var translateSlot = document.createElement("div");
    translateSlot.className = "translate-slot";
    translateSlot.setAttribute("data-post", p.id);
    li.appendChild(translateSlot);
    mountTranslateSlots(li);
    var frameS = document.createElement("div");
    frameS.innerHTML = frameLabelHtml("frame.suggest");
    li.appendChild(frameS);
    li.appendChild(zoneExpander("zone-answer", T("zone.answer.excerpt"), T("zone.answer.full"),
      esc(briefExcerpt(displayAnswer(item.answer))), esc(displayAnswer(item.answer)), T("zone.answer.read")));
    var apHtml = approverHtml(item);
    var apw = document.createElement("div");
    apw.innerHTML = apHtml ? frameLabelHtml("frame.decide") + apHtml : "";
    wireApproverLinks(apw);
    while (apw.firstChild) li.appendChild(apw.firstChild);
    var citeDiv = document.createElement("div");
    citeDiv.innerHTML = (citationsFor(item, p).length ? frameLabelHtml("frame.commit") : "") + citationsHtml(item, p) + standingLabelHtml();
    while (citeDiv.firstChild) li.appendChild(citeDiv.firstChild);
    var seedReqB = seedAgencyBlock(item);
    if (seedReqB) li.appendChild(seedReqB);
    var row = document.createElement("div");
    row.className = "btn-row";
    var record = document.createElement("button");
    record.type = "button";
    record.className = "btn btn-small";
    record.textContent = T("feed.fullrecord");
    record.addEventListener("click", function () {
      threadSelect($("priorSelect"), renderPriorCard).value = p.id;
      showView("prior");
    });
    row.appendChild(record);
    li.appendChild(row);
    return li;
  }
  function briefingWednesday(cycle) {
    var m = /^Wed ([A-Za-z]+ \d+)/.exec(cycle.briefingAt || "");
    return m ? ("Wednesday, " + m[1]) : cycle.briefingAt;
  }
  /* Next Week preview: selected posts awaiting answers. NEVER shows answer
     text — the committee is still formulating it. */
  function nextWeekItem(cycle, item) {
    var p = PodiumStore.postById(state, item.postId);
    var author = PodiumStore.citizenById(state, p.authorId);
    var li = document.createElement("li");
    li.className = "card next-item";
    li.innerHTML = "<p>" + selectionBadge(cycle, item, p) + "</p>" + stageHtml(displayPipeline(cycle, item.pipeline)) +
      '<p><span class="ref-code">' + esc(p.ref || "") + "</span> <strong>" + esc(author.name) + "</strong>" + stateSuffix(p) + langSuffix(p) + " \u00b7 " + esc(Ttopic(p.topic)) + "</p>" +
      '<div class="zone zone-post"><span class="zone-label">' + esc(T("zone.post.next")) + "</span>" +
      "<blockquote>" + esc(p.body) + "</blockquote>" +
      '<p class="hint">' + esc(Tf("next.selectedfor", { name: author.name })) + "</p></div>" + sealHtml(p) +
      '<p class="hint">' + esc(Tf("next.answercoming", { date: briefingWednesday(cycle) })) + "</p>" +
      translateSlotHtml(p);
    li.appendChild(buildWonderZone(p));
    mountTranslateSlots(li);
    return li;
  }

  /* Wonder answer drafts (demo): session-only, never mutate any record.
     A draft displays separately until "Approve draft" is clicked; only
     then does the DISPLAYED text change (approved pill). The seeded
     record is never mutated. The zone lives under Next Week posts: the
     committee drafts during committee week, before the briefing airs. */
  var wonderDrafts = {};   /* postId -> draft envelope; persisted (podium.v1.wonderDrafts) so one draft per post holds across reloads and tabs */
  /* Preload stored drafts before the first render: a stored draft renders exactly like a live one, with no API call. */
  (function preloadWonderDrafts() {
    try {
      var saved = (typeof PodiumAI.loadStoredDrafts === "function") ? PodiumAI.loadStoredDrafts() : {};
      Object.keys(saved).forEach(function (ref) {
        var sp = PodiumStore.postByRef(state, ref);
        if (sp && !wonderDrafts[sp.id]) wonderDrafts[sp.id] = saved[ref];
      });
    } catch (e) {}
  })();
  var wonderApproved = {}; /* postId -> true once approved in this session */
  var wonderDeclined = {}; /* postId -> true once declined in this session (post reverts to shine light) */
  var wonderRetryTimer = null; /* interval id showing the "Retrying..." state while a Wonder retry loop runs */
  function clearWonderRetryTimer() { if (wonderRetryTimer) { clearInterval(wonderRetryTimer); wonderRetryTimer = null; } }
  var wonderLiaisonAdvice = {}; /* postId -> [{liaison, claim, authority, date, outcome}] recorded in the draft zone, logged on approval, session-only */
  /* Committee-only visibility (TY, Oct 28): in the real product drafts
     and editing are committee-only; the demo shows them publicly for
     evaluation. Display text only — never gates or hides the controls. */
  function wonderVisibilityNote() { return T("wonder.visibility"); }
  function wonderSimulatedNote() { return T("wonder.simulated"); }
  function buildWonderZone(p) {
    var wonderBox = document.createElement("div");
    wonderBox.className = "zone zone-answer";
    var draftBtn = document.createElement("button");
    draftBtn.type = "button";
    draftBtn.className = "btn btn-small";
    draftBtn.textContent = T("wonder.draft");
    var wonderVisibility = document.createElement("p");
    wonderVisibility.className = "hint";
    wonderVisibility.textContent = wonderVisibilityNote();
    var wonderStatus = document.createElement("p");
    wonderStatus.className = "hint";
    if (!draftEnvelope() && !wonderApproved[p.id] && !wonderDeclined[p.id]) wonderBox.appendChild(draftBtn);
    wonderBox.appendChild(wonderVisibility);
    wonderBox.appendChild(wonderStatus);
    function draftEnvelope() { return wonderDrafts[p.id] || null; }
    function draftGate(d) { return !!(d && (d.noCommitments || (d.citations && d.citations.length))); }
    function agencyRequestBlock(d) {
      if (!d || !d.agencyRequest) return null;
      var reqText = d.agencyRequest;
      var reqBlock = document.createElement("div");
      reqBlock.innerHTML = '<p><span class="zone-label">' + esc(T("wonder.request")) + '</span></p>' +
        '<p>' + esc(reqText).replace(/\n/g, '<br>') + '</p>';
      var copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "btn btn-small";
      copyBtn.textContent = T("wonder.copy");
      copyBtn.addEventListener("click", function () {
        copyText(reqText, function (ok) {
          copyBtn.textContent = ok ? T("share.copied") : T("share.failed");
          setTimeout(function () { copyBtn.textContent = T("wonder.copy"); }, 2000);
        });
      });
      reqBlock.appendChild(copyBtn);
      return reqBlock;
    }
    function showDraft() {
      var prior = wonderBox.querySelector("[data-wonder-pending]");
      if (prior) prior.remove();
      var draft = draftEnvelope();
      if (!draft || wonderApproved[p.id] || wonderDeclined[p.id]) return;
      var box = document.createElement("div");
      box.setAttribute("data-wonder-pending", "1");
      box.innerHTML = '<span class="zone-label">' + esc(T("wonder.pending")) + "</span>" +
        "<p>" + esc(draft.text) + "</p>" +
        '<p class="hint">' + esc(wonderVisibilityNote()) + "</p>" +
        '<p class="hint">' + esc(wonderSimulatedNote()) + "</p>";
      var reqPend = agencyRequestBlock(draft);
      if (reqPend) box.appendChild(reqPend);
      var approveBtn = document.createElement("button");
      approveBtn.type = "button";
      approveBtn.className = "btn btn-small";
      approveBtn.textContent = T("wonder.approve");
      approveBtn.addEventListener("click", function () {
        if (!draftGate(draftEnvelope())) { trackerMsg(box, "wonder.nocites"); return; }
        wonderApproved[p.id] = true;
        audit("approve", p.ref + "-A", "");
        (wonderLiaisonAdvice[p.id] || []).forEach(function (a) {
          audit("liaisonAdvice", p.ref, JSON.stringify({ liaison: a.liaison, claim: a.claim, authority: a.authority, date: a.date, outcome: a.outcome }));
        });
        renderBriefing();
      });
      var declineBtn = document.createElement("button");
      declineBtn.type = "button";
      declineBtn.className = "btn btn-small";
      declineBtn.textContent = T("wonder.decline");
      declineBtn.addEventListener("click", function () {
        wonderDeclined[p.id] = true;
        audit("decline", p.ref + "-A", "");
        renderBriefing();
      });
      if (!draftGate(draft)) {
        approveBtn.disabled = true;
        var gateHint = document.createElement("p");
        gateHint.className = "hint";
        gateHint.textContent = T("wonder.nocites");
        box.appendChild(gateHint);
      }
      var adviceSection = document.createElement("div");
      var ADVICE_OUTCOMES = ["followed", "second", "notfollowed"];
      function adviceVal(n) { var el = adviceSection.querySelector('[data-advice="' + n + '"]'); return el ? el.value : ""; }
      function renderAdvice() {
        var wasOpen = !!(adviceSection.querySelector("details") && adviceSection.querySelector("details").open);
        var list = wonderLiaisonAdvice[p.id] || [];
        var h = '<details><summary><span class="zone-label">' + esc(T("advice.legend")) + "</span></summary>";
        for (var j = 0; j < list.length; j++) {
          h += '<p class="hint">' + esc(list[j].liaison) + " \u2014 " + esc(list[j].claim) + " (" + esc(adviceOutcomeLabel(list[j].outcome)) + ")" +
            ' <button type="button" class="btn btn-small" data-advice-rm="' + j + '">' + esc(T("cite.remove")) + "</button></p>";
        }
        h += '<div class="field"><label>' + esc(T("advice.liaison")) + '</label><input type="text" data-advice="liaison" placeholder="' + esc(T("advice.liaison.ph")) + '"></div>' +
          '<div class="field"><label>' + esc(T("advice.claim")) + '</label><textarea data-advice="claim" rows="2" placeholder="' + esc(T("advice.claim.ph")) + '"></textarea></div>' +
          '<div class="field"><label>' + esc(T("advice.authority")) + '</label><textarea data-advice="authority" rows="2" placeholder="' + esc(T("advice.authority.ph")) + '"></textarea></div>' +
          '<div class="field"><label>' + esc(T("advice.date")) + '</label><input type="text" data-advice="date" placeholder="' + esc(T("advice.date.ph")) + '"></div>' +
          '<div class="field"><label>' + esc(T("advice.outcome")) + '</label><select data-advice="outcome">' +
          '<option value="followed">' + esc(T("advice.outcome.followed")) + "</option>" +
          '<option value="second">' + esc(T("advice.outcome.second")) + "</option>" +
          '<option value="notfollowed">' + esc(T("advice.outcome.notfollowed")) + "</option></select></div>" +
          '<div class="btn-row"><button type="button" class="btn btn-small" data-advice-add>' + esc(T("advice.add")) + "</button></div>" + "</details>";
        adviceSection.innerHTML = h;
        if (wasOpen) { var det = adviceSection.querySelector("details"); if (det) det.open = true; }
        var addBtn = adviceSection.querySelector("[data-advice-add]");
        if (addBtn) addBtn.addEventListener("click", function () {
          if (!adviceVal("liaison").trim() || !adviceVal("claim").trim() || !adviceVal("authority").trim() || !adviceVal("date").trim()) { trackerMsg(box, "form.required"); return; }
          if (ADVICE_OUTCOMES.indexOf(adviceVal("outcome")) < 0) { trackerMsg(box, "form.required"); return; }
          var l = wonderLiaisonAdvice[p.id] || (wonderLiaisonAdvice[p.id] = []);
          l.push({ liaison: adviceVal("liaison"), claim: adviceVal("claim"), authority: adviceVal("authority"), date: adviceVal("date"), outcome: adviceVal("outcome") });
          trackerMsg(box, null);
          renderAdvice();
        });
        Array.prototype.forEach.call(adviceSection.querySelectorAll("[data-advice-rm]"), function (btn) {
          btn.addEventListener("click", function () {
            var l = wonderLiaisonAdvice[p.id] || [];
            l.splice(Number(btn.getAttribute("data-advice-rm")), 1);
            renderAdvice();
          });
        });
      }
      box.appendChild(adviceSection);
      renderAdvice();
      box.appendChild(approveBtn);
      box.appendChild(document.createTextNode(" "));
      box.appendChild(declineBtn);
      wonderBox.appendChild(box);
    }
    draftBtn.addEventListener("click", function () {
      draftBtn.disabled = true;
      draftBtn.style.display = "none";
      wonderStatus.textContent = Tf("wonder.drafting", { model: PodiumAI.WONDER_MODEL });
      clearWonderRetryTimer();
      wonderRetryTimer = setInterval(function () {
        if (typeof PodiumAI.wonderRetrying === "function" && PodiumAI.wonderRetrying()) {
          wonderStatus.textContent = T("wonder.retrying");
        }
      }, 1000);
      PodiumAI.draftCommitteeEnvelope(p).then(function (draft) {
        clearWonderRetryTimer();
        draftBtn.disabled = false;
        if (!draft) {
          draftBtn.style.display = "";
          var werr = (typeof PodiumAI.wonderFailure === "function") ? PodiumAI.wonderFailure() : null;
          var wkind = werr && werr.kind;
          if (wkind === "timeout") wonderStatus.textContent = T("wonder.err.timeout");
          else if (wkind === "network") wonderStatus.textContent = T("wonder.err.network");
          else if (wkind === "http") wonderStatus.textContent = Tf("wonder.err.http", { status: (werr && werr.status) || "?" });
          else wonderStatus.textContent = T("wonder.unavailable");
          return;
        }
        wonderDrafts[p.id] = draft;
        delete wonderApproved[p.id];
        delete wonderLiaisonAdvice[p.id];
        wonderStatus.textContent = "";
        audit("draft", p.ref + "-A", "");
        showDraft();
      });
    });
    if (wonderDeclined[p.id]) {
      var dec = document.createElement("div");
      dec.innerHTML = '<p class="hint">' + esc(T("wonder.declined.note")) + '</p>';
      wonderBox.appendChild(dec);
    } else if (wonderApproved[p.id] && draftEnvelope()) {
      var done = document.createElement("div");
      done.innerHTML = '<p><span class="status-pill">' + esc(T("wonder.approved")) + "</span></p>" +
        frameLabelHtml("frame.suggest") + "<p>" + esc(draftEnvelope().text) + "</p>" + frameLabelHtml("frame.decide") + committeeLineHtml() + (citationsFor(null, p).length ? frameLabelHtml("frame.commit") : "") + citationsHtml(null, p) + standingLabelHtml();
      var reqDone = agencyRequestBlock(draftEnvelope());
      if (reqDone) done.appendChild(reqDone);
      wonderBox.appendChild(done);
    } else if (draftEnvelope()) {
      showDraft();
    }
    return wonderBox;
  }

  /* Settled timing (TY, Oct 28): This Week = the most recently AIRED
     briefing, and only that — it flips only after the Wednesday 1:00 PM ET
     airing. Next Week = the selections for the next briefing, published
     from the Monday draw onward. Derived from briefing datetimes and the
     clock (America/New_York), never from seed statuses. */
  function etNow() {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  }
  /* Derived current cycle, recomputed at every call so a tab left open
     across a week boundary rolls on re-render, not only on reload. */
  function currentCycle() { return PodiumStore.currentCycleId(state, etNow()); }
  /* Render-time "(voting now)" marker: the derived current cycle is the
     voting one; static labels carry no marker since the rollover. */
  function cycleLabel(c) { return c ? c.label + (c.id === currentCycle() ? " (" + T("cycle.voting") + ")" : "") : ""; }
  /* Single parsing implementation lives in PodiumStore (same flip as Replay).
     The year always comes from the cycle's own votingStart, never the clock. */
  function cycleDateTimeFor(c, str) {
    var y = PodiumStore.cycleYear(c);
    return PodiumStore.cycleDateTime(str, y === null ? etNow().getFullYear() : y);
  }
  function renderBriefing() {
    var nowEt = etNow();
    var thisWeek = null, next = null;
    state.cycles.forEach(function (c) {
      var bAt = cycleDateTimeFor(c, c.briefingAt);
      if (!bAt || !c.topPostId) return;
      if (bAt <= nowEt) thisWeek = c; /* cycles are chronological: last aired wins */
      var dAt = cycleDateTimeFor(c, c.drawAt);
      if (bAt > nowEt && (!dAt || dAt <= nowEt)) next = c; /* most recently drawn, unbriefed */
    });
    /* No stale-status fallback: before the first briefing airs, This Week is
       empty (the section renders nothing until a briefing datetime passes). */
    var pl = $("pipelineList");
    pl.innerHTML = "";
    if (thisWeek) {
      $("briefingTitle").textContent = Tf("briefing.title", { date: thisWeek.briefingAt });
      PodiumStore.itemsForCycle(state, thisWeek.id).forEach(function (item) {
        pl.appendChild(briefingSummaryCard(thisWeek, item));
      });
    }
    var nl = $("nextList");
    nl.innerHTML = "";
    $("nextSection").hidden = !next;
    if (next) {
      PodiumStore.itemsForCycle(state, next.id).forEach(function (item) {
        nl.appendChild(nextWeekItem(next, item));
      });
    }



    /* draw transparency: most recent completed draw */
    var drawn = next || thisWeek;
    var df = $("drawFacts");
    df.innerHTML = "";
    if (drawn && drawn.topPostId) {
      /* Historical record: stored values only, never a live recount — the
         cutoff removes unselected posts, so recounting would rewrite history. */
      var picked = PodiumStore.postById(state, drawn.randomPostId);
      var rows = [
        [T("draw.cycle"), cycleLabel(drawn) + " (" + drawn.range + ")"],
        [T("draw.frozen"), Tf("draw.frozen.val", { cutoff: drawn.cutoffAt, n: drawn.poolSize })],
        [T("draw.beacon"), Tf("draw.beacon.val", { time: drawn.beaconTime, hex: drawn.beaconHex, num: drawn.beaconNum })],
        [T("draw.computation"), Tf("draw.computation.val", { num: drawn.beaconNum, size: drawn.poolSize, r: drawn.position - 1, pos: drawn.position })],
        [T("draw.selected"), picked ? ("\u201c" + excerpt(picked.body, 80) + "\u201d") : "\u2014"]
      ];
      rows.forEach(function (r) {
        var dt = document.createElement("dt"); dt.textContent = r[0];
        var dd = document.createElement("dd"); dd.textContent = r[1];
        df.appendChild(dt); df.appendChild(dd);
      });
      var ex = $("excludedList");
      ex.innerHTML = "";
      var winner = PodiumStore.postById(state, drawn.topPostId);
      var winnerBody = winner.body.trim().toLowerCase();
      PodiumStore.postsForCycle(state, drawn.id)
        .filter(function (p) { return p.id === drawn.topPostId || p.body.trim().toLowerCase() === winnerBody; })
        .sort(function (a, b) { return a.createdAt < b.createdAt ? -1 : 1; })
        .forEach(function (p) {
          var li = document.createElement("li");
          var isWinner = p.id === drawn.topPostId;
          var by = PodiumStore.citizenById(state, p.authorId);
          li.innerHTML = "<strong>" + esc(by.name) + "</strong>" + stateSuffix(p) + " " +
            '<span class="ref-code">' + esc(p.ref || "") + "</span> \u201c" + esc(excerpt(p.body, 120)) + "\u201d \u2014 " +
            (isWinner ? T("draw.winner") : T("draw.dupe")) + " ";
          var full = document.createElement("div");
          full.hidden = true;
          full.innerHTML = "<blockquote>" + esc(p.body) + "</blockquote>";
          li.appendChild(full);
          var toggle = document.createElement("button");
          toggle.type = "button";
          toggle.className = "btn btn-small";
          toggle.textContent = T("draw.readfull");
          toggle.setAttribute("aria-expanded", "false");
          toggle.addEventListener("click", function () {
            full.hidden = !full.hidden;
            toggle.setAttribute("aria-expanded", String(!full.hidden));
            toggle.textContent = full.hidden ? T("draw.readfull") : T("draw.collapse");
          });
          li.appendChild(document.createTextNode(" "));
          li.appendChild(toggle);
          ex.appendChild(li);
        });
    }
  }

  /* ---------- prior posts & answers / status updates ---------- */
  /* Visibility gating (TY, Oct 28): Prior and Status list ONLY selections
     whose briefing has aired. Reuses the aired-cycle rule built for This
     Week / Replay (PodiumStore.replayCycles) — no second timing rule. */
  function airedCycleIds() {
    var ids = {};
    PodiumStore.replayCycles(state, etNow()).forEach(function (c) { ids[c.id] = true; });
    return ids;
  }
  function airedBriefingItems() {
    var ok = airedCycleIds();
    return state.briefingItems.filter(function (b) { return !!ok[b.cycleId]; });
  }
  function defaultAiredBriefing() {
    var items = airedBriefingItems();
    if (!items.length) return null;
    var cycles = PodiumStore.replayCycles(state, etNow()); /* newest first */
    for (var i = 0; i < cycles.length; i++) {
      var top = null, first = null;
      items.forEach(function (b) {
        if (b.cycleId === cycles[i].id) {
          if (!first) first = b;
          if (b.selection === "top") top = b;
        }
      });
      if (top || first) return top || first;
    }
    return items[0];
  }
  function fillThreadSelect(sel) {
    airedBriefingItems().forEach(function (b) {
      var c = PodiumStore.cycleById(state, b.cycleId);
      var p = PodiumStore.postById(state, b.postId);
      var o = document.createElement("option");
      o.value = b.postId;
      o.textContent = cycleLabel(c) + " \u00b7 " + (b.selection === "top" ? T("thread.top") : T("thread.random")) + " \u00b7 " + (p.ref || "") + " \u00b7 " + excerpt(p.body, 40);
      sel.appendChild(o);
    });
    var d = defaultAiredBriefing();
    if (d) sel.value = d.postId;
  }
  /* Dropdown options are rebuilt on every render (never filled once): after a
     briefing flip, new aired selections appear without a reload. The current
     selection is preserved when it still exists, else the default applies. */
  function threadSelect(sel, onChange) {
    var cur = sel.value;
    sel.innerHTML = "";
    fillThreadSelect(sel);
    var has = false;
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === cur) { has = true; break; }
    }
    if (has && cur) sel.value = cur;
    if (!sel.dataset.bound) { sel.dataset.bound = "1"; sel.addEventListener("change", onChange); }
    return sel;
  }
  function selectedBriefing(selId) {
    var b = PodiumStore.briefingItemFor(state, $(selId).value);
    if (b && airedCycleIds()[b.cycleId]) return b;
    return defaultAiredBriefing();
  }
  function selectionTitle(b) {
    var c = PodiumStore.cycleById(state, b.cycleId);
    return esc(cycleLabel(c)) + " \u00b7 " + (b.selection === "top" ? T("seltitle.top") : T("seltitle.random"));
  }
  /* Tracker: "We can't do this" + "Why can't we do this?" (TY).
     Display + record only. Stored status stays "No Action"; Tstatus renders
     it as "We can't do this." in both languages. All mutations go through the
     PodiumStore validators, persist via save, and append audit entries. */
  function todayShort() {
    try { return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }); }
    catch (e) { return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  }
  function isAuthor(p) { return !!(state.currentUserId && p && state.currentUserId === p.authorId); }
  function respondedBy(b, by, kind, id) {
    var rs = (b && b.responses) || [];
    for (var i = 0; i < rs.length; i++) {
      if (rs[i] && rs[i].by === by && rs[i].kind === kind && String(rs[i].id) === String(id)) return true;
    }
    return false;
  }
  function noActionHtml(b) {
    if (!b || b.trackerStatus !== "No Action") return "";
    return '<div class="zone zone-answer"><span class="zone-label">' + esc(T("noaction.label")) + "</span>" +
      "<p><strong>" + esc(T("noaction.authority")) + ":</strong> " + esc(b.citedAuthority || "") + "</p>" +
      "<p><strong>" + esc(T("noaction.change")) + ":</strong> " + esc(b.whatWouldChange || "") + "</p>" +
      "<p><strong>" + esc(T("noaction.redirect")) + ":</strong> " + esc(b.redirectTo || "") + "</p>" +
      (b.committeeVote ? '<p class="hint">' + esc(T("noaction.vote")) + "</p>" : "") + "</div>";
  }
  function appealsHtml(b, p) {
    var ap = (b && b.appeals) || [], out = "", i;
    for (i = 0; i < ap.length; i++) {
      var a = ap[i];
      out += '<div class="zone zone-answer"><span class="zone-label">' + esc(Tf("appeal.by", { name: a.name, date: a.date })) + "</span>";
      out += a.outcome
        ? "<p>" + esc(a.outcome.decision === "upheld" ? T("rereview.outcome.upheld") : T("rereview.outcome.rejected")) + (a.outcome.note ? " \u2014 " + esc(a.outcome.note) : "") + (a.outcome.date ? " (" + esc(a.outcome.date) + ")" : "") + "</p>"
        : '<p class="hint">' + esc(T("appeal.awaiting")) + "</p>" +
          '<div class="field"><label>' + esc(T("rereview.legend")) + "</label>" +
          '<textarea data-rr-note rows="2" placeholder="' + esc(T("rereview.note.ph")) + '"></textarea></div>' +
          '<div class="btn-row"><button type="button" class="btn btn-small" data-act="rereview-uphold">' + esc(T("rereview.uphold")) + "</button>" +
          '<button type="button" class="btn btn-small" data-act="rereview-reject">' + esc(T("rereview.reject")) + "</button></div>";
      out += "</div>";
    }
    if (b && b.trackerStatus === "No Action" && isAuthor(p) && !PodiumStore.appealFor(b, b.determinationId || 0)) {
      out += '<div class="btn-row"><button type="button" class="btn btn-small" data-act="appeal">' + esc(T("appeal.button")) + "</button></div>";
    }
    return out;
  }
  function responsesHtml(b, p, kind, id) {
    var rs = ((b && b.responses) || []).filter(function (r) { return r && r.kind === kind && String(r.id) === String(id); });
    var out = "";
    for (var i = 0; i < rs.length; i++) {
      out += '<p class="hint">' + esc(T("response.legend")) + " \u2014 " + esc(rs[i].name) + ", " + esc(rs[i].date) + ": " + esc(rs[i].text) + "</p>";
    }
    if (isAuthor(p)) {
      if (respondedBy(b, state.currentUserId, kind, id)) {
        out += '<p class="hint">' + esc(T("response.done")) + "</p>";
      } else {
        out += '<div class="field"><label>' + esc(T("response.legend")) + "</label>" +
          '<textarea data-field="response-text" data-kind="' + esc(kind) + '" data-id="' + esc(String(id)) + '" rows="2" placeholder="' + esc(T("response.ph")) + '"></textarea></div>' +
          '<div class="btn-row"><button type="button" class="btn btn-small" data-act="respond" data-kind="' + esc(kind) + '" data-id="' + esc(String(id)) + '">' + esc(T("response.submit")) + "</button></div>";
      }
    }
    return out;
  }
  function challengeHtml(b, p, ch) {
    var out = '<div class="zone zone-answer"><span class="zone-label">' + esc(T("challenge.name")) + "</span>" +
      "<p><strong>" + esc(T("challenge.solution.label")) + ":</strong> " + esc(ch.solution) + "</p>" +
      '<p class="hint">' + esc(Tf("challenge.by", { name: ch.raisedName, date: ch.date })) + "</p>";
    if (ch.status === "answered" && ch.answer) {
      out += '<p><span class="zone-label">' + esc(T("challenge.answer.legend")) + "</span></p>" +
        "<p>" + esc(ch.answer.text) + (ch.answer.date ? " (" + esc(ch.answer.date) + ")" : "") + "</p>" +
        "<p><strong>" + esc(T("noaction.authority")) + ":</strong> " + esc(ch.answer.citedAuthority || "") + "</p>" +
        "<p><strong>" + esc(T("noaction.change")) + ":</strong> " + esc(ch.answer.whatWouldChange || "") + "</p>" +
        "<p><strong>" + esc(T("noaction.redirect")) + ":</strong> " + esc(ch.answer.redirectTo || "") + "</p>";
    } else {
      out += '<p class="hint">' + esc(T("challenge.awaiting")) + "</p>" +
        '<div class="field"><label>' + esc(T("challenge.answer.legend")) + "</label>" +
        '<textarea data-ans="text" data-id="' + esc(ch.id) + '" rows="2" placeholder="' + esc(T("challenge.answer.ph")) + '"></textarea></div>' +
        '<div class="field"><label>' + esc(T("noaction.authority")) + "</label>" +
        '<textarea data-ans="citedAuthority" data-id="' + esc(ch.id) + '" rows="2"></textarea></div>' +
        '<div class="field"><label>' + esc(T("noaction.change")) + "</label>" +
        '<textarea data-ans="whatWouldChange" data-id="' + esc(ch.id) + '" rows="2"></textarea></div>' +
        '<div class="field"><label>' + esc(T("noaction.redirect")) + "</label>" +
        '<textarea data-ans="redirectTo" data-id="' + esc(ch.id) + '" rows="2"></textarea></div>' +
        '<div class="btn-row"><button type="button" class="btn btn-small" data-act="challenge-answer" data-id="' + esc(ch.id) + '">' + esc(T("challenge.answer.submit")) + "</button></div>";
    }
    out += responsesHtml(b, p, "challenge", ch.id) + "</div>";
    return out;
  }
  function challengesHtml(b, p) {
    var ch = (b && b.challenges) || [], out = "";
    out += '<p><span class="zone-label">' + esc(T("challenge.legend")) + "</span></p>";
    for (var i = 0; i < ch.length; i++) out += challengeHtml(b, p, ch[i]);
    out += '<div class="field"><label>' + esc(T("challenge.solution.label")) + "</label>" +
      '<textarea data-field="challenge-solution" rows="2" placeholder="' + esc(T("challenge.solution.ph")) + '"></textarea></div>' +
      '<div class="btn-row"><button type="button" class="btn btn-small" data-act="challenge-raise">' + esc(T("challenge.raise")) + "</button></div>";
    return out;
  }
  function trackerHtml(b, p) {
    if (!b || !p) return "";
    return '<p class="hint">' + esc(T("demo.tracker.note")) + "</p>" +
      noActionHtml(b) + appealsHtml(b, p) + challengesHtml(b, p) +
      responsesHtml(b, p, "record", "record");
  }
  function trackerMsg(root, key) {
    var m = root.querySelector(".tracker-msg");
    if (!m) {
      m = document.createElement("p");
      m.className = "hint tracker-msg";
      root.appendChild(m);
    }
    m.textContent = key ? T(key) : "";
  }
  function trackerVal(root, sel, idAttr, idVal) {
    var q = idVal == null ? sel : sel + '[' + idAttr + '="' + idVal + '"]';
    var el = root.querySelector(q);
    return el ? el.value : "";
  }
  function wireTracker(root, b, p, rerender) {
    if (!root || !b || !p) return;
    function fail(key) { trackerMsg(root, key); }
    function ok(rerun) {
      try { PodiumStore.save(state); } catch (e) { /* session-only fallback */ }
      trackerMsg(root, null);
      rerun();
    }
    var ap = root.querySelector('[data-act="appeal"]');
    if (ap) ap.addEventListener("click", function () {
      var me = PodiumStore.citizenById(state, state.currentUserId);
      var r = PodiumStore.fileAppeal(b, { by: state.currentUserId, name: me ? me.name : "", date: todayShort() });
      if (!r.ok) { fail("form.required"); return; }
      audit("appeal", p.ref || "", me ? me.name : "");
      ok(rerender);
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-act="rereview-uphold"], [data-act="rereview-reject"]'), function (btn) {
      btn.addEventListener("click", function () {
        var note = trackerVal(root, "[data-rr-note]");
        var r = PodiumStore.reviewAppeal(b, { decision: btn.getAttribute("data-act") === "rereview-uphold" ? "upheld" : "reinstated", note: note, date: todayShort() });
        if (!r.ok) { fail("form.required"); return; }
        audit("rereview", p.ref || "", r.appeal.outcome.decision);
        ok(rerender);
      });
    });
    var raise = root.querySelector('[data-act="challenge-raise"]');
    if (raise) raise.addEventListener("click", function () {
      var me = PodiumStore.citizenById(state, state.currentUserId);
      var sol = trackerVal(root, '[data-field="challenge-solution"]');
      if (!sol.trim()) { fail("form.required"); return; }
      var r = PodiumStore.raiseChallenge(b, { by: state.currentUserId, name: me ? me.name : "", date: todayShort(), solution: sol });
      if (!r.ok) { fail("form.required"); return; }
      audit("challenge", p.ref || "", r.challenge.id);
      ok(rerender);
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-act="challenge-answer"]'), function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-id");
        var f = {
          text: trackerVal(root, '[data-ans="text"]', "data-id", id),
          citedAuthority: trackerVal(root, '[data-ans="citedAuthority"]', "data-id", id),
          whatWouldChange: trackerVal(root, '[data-ans="whatWouldChange"]', "data-id", id),
          redirectTo: trackerVal(root, '[data-ans="redirectTo"]', "data-id", id),
          date: todayShort()
        };
        if (!f.citedAuthority.trim()) { fail("noaction.authority.required"); return; }
        if (!f.text.trim() || !f.whatWouldChange.trim() || !f.redirectTo.trim()) { fail("form.required"); return; }
        var r = PodiumStore.answerChallenge(b, id, f);
        if (!r.ok) { fail("form.required"); return; }
        audit("challenge-answer", p.ref || "", id);
        ok(rerender);
      });
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-act="respond"]'), function (btn) {
      btn.addEventListener("click", function () {
        var me = PodiumStore.citizenById(state, state.currentUserId);
        var kind = btn.getAttribute("data-kind"), id = btn.getAttribute("data-id");
        var ta = root.querySelector('[data-field="response-text"][data-kind="' + kind + '"][data-id="' + id + '"]');
        var text = ta ? ta.value : "";
        if (!text.trim()) { fail("form.required"); return; }
        var r = PodiumStore.addResponse(b, { by: state.currentUserId, name: me ? me.name : "", date: todayShort(), text: text, kind: kind, id: id });
        if (!r.ok) { fail(r.reason === "already-responded" ? "response.done" : "form.required"); return; }
        audit("response", p.ref || "", kind + ":" + id);
        ok(rerender);
      });
    });
  }

  function renderPrior() {
    threadSelect($("priorSelect"), renderPriorCard);
    renderPriorCard();
  }
  function renderPriorCard() {
    var b = selectedBriefing("priorSelect");
    var p = PodiumStore.postById(state, b.postId);
    var author = PodiumStore.citizenById(state, p.authorId);
    var card = $("priorCard");
    var html = "<h3>" + selectionTitle(b) + "</h3>" +
      stageHtml(displayPipeline(PodiumStore.cycleById(state, b.cycleId), b.pipeline)) +
      '<p><span class="ref-code">' + esc(p.ref || "") + "</span></p>" +
      '<div class="zone zone-post"><span class="zone-label">' + esc(T("zone.post.final")) + "</span>" +
      "<blockquote>" + esc(p.body) + "</blockquote>" +
      '<p class="hint">\u2014 ' + esc(author.name) + stateSuffix(p) + langSuffix(p) + " \u00b7 " + esc(Ttopic(p.topic)) + " \u00b7 " + votesLabel(p.votes) + "</p></div>" + sealHtml(p) +
      translateSlotHtml(p) +
      '<div class="zone zone-answer"><span class="zone-label">' + esc(T("thread.answer")) + "</span>" +
      '<p><span class="ref-code">' + esc(answerCode(p)) + "</span></p>" +
      frameLabelHtml("frame.suggest") + "<p>" + esc(displayAnswer(b.answer)) + "</p>" + (approverHtml(b) ? frameLabelHtml("frame.decide") + approverHtml(b) : "") + (citationsFor(b, p).length ? frameLabelHtml("frame.commit") : "") + citationsHtml(b, p) + standingLabelHtml() + "</div>";
    var last = b.updates[b.updates.length - 1];
    if (last) {
      html += '<div class="zone zone-answer"><span class="zone-label">' + esc(T("prior.updatelatest")) + "</span>" +
        '<p><span class="ref-code">' + esc(updateCode(p, b.updates.length - 1)) + "</span> <strong>" + esc(last.date) + "</strong></p>" +
        "<p>" + esc(last.text) + "</p>" +
        '<p>' + esc(T("prior.status")) + ' <span class="status-pill">' + esc(Tstatus(b.trackerStatus)) + "</span>" +
        (b.trackerStatus === "No Action" && b.officialReason ? " \u2014 " + esc(b.officialReason) : "") + "</p>" + responsesHtml(b, p, "update", b.updates.length - 1) + "</div>";
    }
    html += trackerHtml(b, p);
    card.innerHTML = html;
    var seedReqP = seedAgencyBlock(b);
    if (seedReqP) { var paz = card.querySelectorAll(".zone-answer"); if (paz.length) paz[0].appendChild(seedReqP); else card.appendChild(seedReqP); }
    wireTracker(card, b, p, renderPriorCard);
    mountTranslateSlots(card);
    wireApproverLinks(card);
    var link = document.createElement("button");
    link.type = "button";
    link.className = "btn btn-small";
    link.textContent = Tf("prior.tostatus", { ref: p.ref || T("thread.thispost") });
    link.addEventListener("click", function () {
      threadSelect($("statusSelect"), renderStatusCard).value = p.id;
      showView("status");
    });
    card.appendChild(link);
  }
  function renderStatus() {
    threadSelect($("statusSelect"), renderStatusCard);
    renderStatusCard();
    renderAudit();
  }
  /* Audit-log section (TY, Nov 3): newest entries first, each with its
     timestamp, event, ref, and short hash, plus the chain-integrity line.
     Display-only; the chain itself lives in the saved state. */
  function renderAudit() {
    var card = $("auditCard");
    if (!card) return;
    setText("auditHeading", T("audit.heading"));
    var v = PodiumStore.verifyAudit(state.audit);
    var html = "<p>" + esc(T("audit.lede")) + "</p>" +
      '<p class="hint">' + esc(v.ok ? T("audit.intact") : Tf("audit.broken", { n: v.index })) + "</p>" +
      '<ul class="updates">';
    (state.audit || []).slice().reverse().forEach(function (e) {
      html += "<li><strong>" + esc(e.t) + "</strong> · " + esc(auditEvLabel(e.ev)) +
        (e.ref ? ' · <span class="ref-code">' + esc(e.ref) + "</span>" : "") +
        ' · <span class="ref-code">' + esc(String(e.h || "").slice(0, 12)) + "</span>";
      if (e.ev === "liaisonAdvice") {
        var adv = null;
        try { adv = JSON.parse(e.d || ""); } catch (err) { adv = null; }
        if (adv) html += ' <span class="hint">' + esc(adv.liaison || "") + " \u2014 " + esc(adv.claim || "") + " (" + esc(adviceOutcomeLabel(adv.outcome)) + ")</span>";
      }
      html += "</li>";
    });
    html += "</ul>";
    card.innerHTML = html;
  }
  function renderStatusCard() {
    var b = selectedBriefing("statusSelect");
    var p = PodiumStore.postById(state, b.postId);
    var author = PodiumStore.citizenById(state, p.authorId);
    var card = $("statusCard");
    var html = "<h3>" + selectionTitle(b) + "</h3>" +
      '<p><span class="ref-code">' + esc(p.ref || "") + "</span> " + esc(author.name) + stateSuffix(p) + langSuffix(p) + " \u00b7 " + esc(T("prior.status")) + ' <span class="status-pill">' + esc(Tstatus(b.trackerStatus)) + "</span>" +
      (b.trackerStatus === "No Action" && b.officialReason ? " \u2014 " + esc(b.officialReason) : "") + "</p>" + sealHtml(p) +
      frameLabelHtml("frame.suggest") + "<p>" + esc(displayAnswer(b.answer)) + "</p>" + (approverHtml(b) ? frameLabelHtml("frame.decide") + approverHtml(b) : "") + (citationsFor(b, p).length ? frameLabelHtml("frame.commit") : "") + citationsHtml(b, p) + standingLabelHtml() +
      "<h4>" + esc(T("status.dated")) + "</h4>" + '<ul class="updates">' +
      b.updates.map(function (u, i) { return "<li><span class=\"ref-code\">" + esc(updateCode(p, i)) + "</span> <strong>" + esc(u.date) + ":</strong> " + esc(u.text) + responsesHtml(b, p, "update", i) + "</li>"; }).join("") +
      "</ul>" + trackerHtml(b, p);
    card.innerHTML = html;
    var seedReqS = seedAgencyBlock(b);
    if (seedReqS) { var sh = card.querySelector("h4"); if (sh) card.insertBefore(seedReqS, sh); else card.appendChild(seedReqS); }
    wireTracker(card, b, p, renderStatusCard);
    var back = document.createElement("button");
    wireApproverLinks(card);
    back.type = "button";
    back.className = "btn btn-small";
    back.textContent = Tf("status.toprior", { ref: p.ref || T("thread.thispost") });
    back.addEventListener("click", function () {
      threadSelect($("priorSelect"), renderPriorCard).value = p.id;
      showView("prior");
    });
    card.appendChild(back);
  }

  /* Committee roster (TY): 12 seeded civilian committee members (committeeMember),
     rendered term-week order. Display only; no vote/draw/answer logic here. */
  /* Answer approver (TY): which seeded committee member reviewed and approved
     each seeded answer (the answerer of record). Display only — answer text,
     votes, and draws are untouched. Names/states/weeks resolve live from the
     seeded citizens, so the roster stays the single source of truth. */
  var APPROVER_BY_POST = { "p-w1-16": "c-cm12", "p-w1-05": "c-cm11", "p-w2-01": "c-cm10",
    "p-w2-06": "c-cm09", "p-w3-01": "c-cm08", "p-w3-09": "c-cm07" };
  function approverFor(postId) {
    var m = PodiumStore.citizenById(state, APPROVER_BY_POST[postId || ""] || "");
    return (m && m.committeeMember) ? m : null;
  }
  function citationsFor(b, p) {
    var de = p && wonderDrafts[p.id];
    if (de && de.citations && de.citations.length) return de.citations;
    return (b && b.citations) || [];
  }
  function citationsHtml(b, p) {
    var c = citationsFor(b, p), out = "";
    for (var i = 0; i < c.length; i++) {
      out += '<p class="hint">' + esc(T("cite.commitment")) + ": " + esc(c[i].commitment) + " \u2014 " + esc(T("cite.source")) + ": " + esc(c[i].source) + ", " + esc(c[i].date) + "." + (c[i].liaison ? " \u2014 " + esc(T("cite.via")) + " " + esc(c[i].liaison) : "") + "</p>";
    }
    return out;
  }
  /* Seeded agency request (TY, Nov 3): briefing items carry the request
     verbatim from the draft envelope; render it with the same label and
     copy control as draft requests. Display-only. */
  function seedAgencyBlock(b) {
    if (!b || !b.agencyRequest) return null;
    var reqText = b.agencyRequest;
    var reqBlock = document.createElement("div");
    reqBlock.innerHTML = '<p><span class="zone-label">' + esc(T("wonder.request")) + '</span></p>' +
      '<p>' + esc(reqText).replace(/\n/g, '<br>') + '</p>';
    var copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn btn-small";
    copyBtn.textContent = T("wonder.copy");
    copyBtn.addEventListener("click", function () {
      copyText(reqText, function (ok) {
        copyBtn.textContent = ok ? T("share.copied") : T("share.failed");
        setTimeout(function () { copyBtn.textContent = T("wonder.copy"); }, 2000);
      });
    });
    reqBlock.appendChild(copyBtn);
    return reqBlock;
  }
  function committeeLineHtml() {
    var full = T("approver.bycommittee"), name = T("approver.committee"), i = full.indexOf(name), html;
    if (i < 0) html = esc(full);
    else html = esc(full.slice(0, i)) + '<button type="button" class="btn btn-small approver-link">' + esc(name) + "</button>" + esc(full.slice(i + name.length));
    return '<p class="hint">' + html + "</p>";
  }
  function standingLabelHtml() {
    return '<p class="hint">' + esc(T("wonder.notapproval")) + '</p>';
  }
  /* Three-part answer framing (TY, Nov 3): every answer display labels
     part 1 (AI suggestion), part 2 (committee decision), part 3 (cited
     government commitments). Display-only; the standing label is separate. */
  function frameLabelHtml(key) {
    return '<p><span class="zone-label">' + esc(T(key)) + "</span></p>";
  }
  function approverHtml(b) {
    var m = approverFor(b && b.postId);
    if (!m) return "";
    return committeeLineHtml();
  }
  function wireApproverLinks(root) {
    if (!root || !root.querySelectorAll) return;
    Array.prototype.forEach.call(root.querySelectorAll("button.approver-link"), function (btn) {
      btn.addEventListener("click", function () { showView("committee"); });
    });
  }
  var CM_WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var CM_MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  /* Cycle-out date: term start + 12 weeks (84 days), same weekday. UTC math
     so the date never shifts across time zones; stored dates stay untouched. */
  function committeeCycleOut(termStart) {
    var m = /^[A-Za-z]{3} ([A-Za-z]{3}) (\d{1,2}), (\d{4})$/.exec(termStart || "");
    if (!m) return "";
    var mi = CM_MO.indexOf(m[1]);
    if (mi < 0) return "";
    var d = new Date(Date.UTC(Number(m[3]), mi, Number(m[2]), 12) + 84 * 864e5);
    return CM_WD[d.getUTCDay()] + " " + CM_MO[d.getUTCMonth()] + " " + d.getUTCDate() + ", " + d.getUTCFullYear();
  }
  function renderCommittee() {
    setAttr("view-committee", "aria-label", T("committee.aria"));
    setText("committeeHeading", T("tab.committee"));
    setText("committeeLede", T("committee.lede"));
    setText("committeeNote", T("committee.note"));
    setText("committeeRulesSummary", T("committee.rules.summary"));
    setText("committeeRulesSelectionH", T("committee.rules.selection.heading"));
    setText("committeeRulesSelectionB", T("committee.rules.selection.body"));
    setText("committeeRulesPayH", T("committee.rules.pay.heading"));
    setText("committeeRulesPayB", T("committee.rules.pay.body"));
    setText("committeeRulesStructureH", T("committee.rules.structure.heading"));
    setText("committeeRulesStructureB", T("committee.rules.structure.body"));
    setText("committeeRulesScheduleH", T("committee.rules.schedule.heading"));
    setText("committeeRulesScheduleB", T("committee.rules.schedule.body"));
    var list = $("committeeList");
    if (!list) return;
    var members = (state.citizens || []).filter(function (c) { return c && c.committeeMember; })
      .sort(function (a, b) { return (a.termWeek || 99) - (b.termWeek || 99); });
    var html = "";
    members.forEach(function (c) {
      var dr = c.selectionDraw || {};
      var val = String(dr.beaconValue || "");
      var short = val.length > 12 ? val.slice(0, 12) + "\u2026" : val;
      var badge = "";
      if (c.termWeek === 1) badge = ' <span class="post-topic">' + esc(T("committee.joined")) + "</span>";
      if (c.termWeek === 12) badge = ' <span class="post-topic">' + esc(T("committee.cycling")) + "</span>";
      html += '<li class="card"><p class="post-meta"><span class="post-author">' + esc(c.name) + "</span>" +
        (c.state ? "<span>" + esc(c.state) + "</span>" : "") +
        ' <span class="post-topic">' + esc(Tf("committee.week", { n: c.termWeek })) + "</span>" + badge + "</p>" +
        "<p class=\"hint\">" + esc(Tf("committee.terms", { start: c.termStart || "", out: committeeCycleOut(c.termStart) })) + "</p>" +
        '<p><span class="zone-label">' + esc(T("committee.draw")) + "</span></p>" +
        '<dl class="draw-facts">' +
        "<dt>" + esc(T("committee.draw.beacon")) + "</dt><dd>" + esc(dr.beaconTimestamp || "") + "</dd>" +
        "<dt>" + esc(T("committee.draw.value")) + '</dt><dd><span class="ref-code">' + esc(short) + "</span></dd>" +
        "<dt>" + esc(T("committee.draw.pool")) + "</dt><dd>" + esc(String(dr.poolSize == null ? "" : dr.poolSize)) + "</dd>" +
        "<dt>" + esc(T("committee.draw.pos")) + "</dt><dd>" + esc(String(dr.position == null ? "" : dr.position)) + "</dd>" +
        "</dl></li>";
    });
    list.innerHTML = html;
  }

  /* ---------- share + deep links ---------- */
  function postUrl(id) {
    return window.location.href.split("#")[0] + "#post/" + id;
  }
  function copyText(text, done) {
    function fallback() {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        done(ok);
      } catch (e) { done(false); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    } else {
      fallback();
    }
  }
  function doShare(p, btn) {
    var url = postUrl(p.id);
    if (navigator.share) {
      /* Some environments expose share without ever settling it; fall back
         to copy so the control always completes. A real dismiss stays
         a no-op. */
      var settled = false;
      var shareTimer = setTimeout(function () {
        if (!settled) { settled = true; copyShareLink(url, btn); }
      }, 5000);
      navigator.share({ title: "The Podium", text: excerpt(p.body, 140), url: url })
        .then(function () { settled = true; clearTimeout(shareTimer); },
          function (e) {
            settled = true; clearTimeout(shareTimer);
            /* Genuine user cancel stays a no-op; any other failure (not
               allowed, not supported) falls back to copy. */
            if (!e || e.name !== "AbortError") copyShareLink(url, btn);
          });
      return;
    }
    copyShareLink(url, btn);
  }
  function copyShareLink(url, btn) {
    copyText(url, function (ok) {
      btn.textContent = ok ? T("share.copied") : T("share.failed");
      setTimeout(function () { btn.textContent = T("share.button"); }, 2000);
    });
  }
  function clearDeepLink() {
    linkedPostId = null;
    linkedSuffix = null;
    linkMissing = false;
    lastCodeJump = null;
    try {
      history.replaceState(null, document.title, window.location.pathname + window.location.search);
    } catch (e) { /* file:// may refuse: hash stays but view resets */ }
    renderFeed();
  }
  function handleDeepLink() {
    var m = /^#post\/([A-Za-z0-9-]+)/.exec(window.location.hash || "");
    if (!m) {
      if (linkedPostId || linkMissing) { linkedPostId = null; linkedSuffix = null; linkMissing = false; renderFeed(); }
      return;
    }
    var key = m[1];
    var post = findPostAny(key);
    var suffix = null;
    if (!post) {
      var cm = /^([A-Za-z])-(\d+)(?:-(A|U\d+))?$/.exec(key);
      if (cm) {
        var base = cm[1].toUpperCase() + "-" + (cm[2].length > 4 ? cm[2] : ("0000" + cm[2]).slice(-4));
        post = postRefAny(base);
        if (post && cm[3]) suffix = cm[3].toUpperCase();
        if (suffix === "U0") suffix = null; /* updates start at U1 */
      }
    }
    if (post) {
      linkedPostId = post.id;
      linkedSuffix = suffix;
      linkMissing = false;
      showView("feed");
      renderFeed();
    } else {
      linkedPostId = null;
      linkedSuffix = null;
      linkMissing = true;
      showView("feed");
      renderFeed();
    }
  }
  window.addEventListener("hashchange", handleDeepLink);

  /* ---------- watch live ---------- */
  var watchOverride = null; /* null = clock; "upcoming" | "live" | "replay" */
  var watchSticky = null; /* bar/tick marker for a library replay in flight */
  var watchShownState = null; /* state currently rendered, for clock transitions */
  var watchRAF = null;
  var liveCtx = null, liveGain = null, liveAnalyser = null;
  var LIVE_START_H = 13, LIVE_LEN_MIN = 30; /* Wed 1:00-1:30 PM ET */

  function etParts(when) {
    var parts = {};
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York",
      weekday: "short", hour: "numeric", minute: "numeric", hour12: false,
      month: "short", day: "numeric" })
      .formatToParts(when || new Date()).forEach(function (x) { parts[x.type] = x.value; });
    parts.hourNum = parseInt(parts.hour, 10) % 24;
    parts.minuteNum = parseInt(parts.minute, 10);
    return parts;
  }
  function clockIsLive(now) {
    var p = etParts(now);
    return p.weekday === "Wed" && p.hourNum === LIVE_START_H && p.minuteNum < LIVE_LEN_MIN;
  }
  function nextAiring() {
    var now = new Date();
    if (clockIsLive(now)) return { live: true, label: null };
    for (var i = 0; i < 8; i++) {
      var d = new Date(now.getTime() + i * 86400000);
      var p = etParts(d);
      if (p.weekday !== "Wed") continue;
      if (i === 0 && (p.hourNum > LIVE_START_H || (p.hourNum === LIVE_START_H && p.minuteNum >= LIVE_LEN_MIN))) continue;
      return { live: false, label: "Wednesday, " + p.month + " " + p.day };
    }
    /* Always returns: any 8 consecutive days contain a Wednesday, so the
       loop meets one by i === 7 at the latest and returns there. */
  }
  /* Watch agenda from datetimes, never frozen seed flags (TY, Oct 28):
     the briefing on air now is the latest briefing datetime at or before
     now (live window only, and only when that briefing is today); otherwise
     the bill is the next briefing datetime after now. Null when no future
     briefing exists — the view then says the agenda is to be announced.
     Seed statuses are ignored (kept in seed/saves only for compatibility). */
  function sameEtDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function agendaCycle() {
    var nowEt = etNow();
    var past = null, future = null;
    state.cycles.forEach(function (c) {
      var bAt = cycleDateTimeFor(c, c.briefingAt);
      if (!bAt) return;
      if (bAt <= nowEt) past = c; /* chronological: last aired-or-airing wins */
      else if (!future) future = c; /* chronological: first upcoming wins */
    });
    if (clockIsLive()) {
      if (!past) return null;
      var pAt = cycleDateTimeFor(past, past.briefingAt);
      return (pAt && sameEtDay(pAt, nowEt)) ? past : null;
    }
    return future;
  }
  function watchState() {
    if (watchOverride) return watchOverride;
    return clockIsLive() ? "live" : "upcoming";
  }
  function fullRecordButton(postId, label) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-small";
    b.textContent = label || T("feed.fullrecord");
    b.addEventListener("click", function () {
      threadSelect($("priorSelect"), renderPriorCard).value = postId;
      showView("prior");
    });
    return b;
  }

  function renderWatch() {
    stopWatchPlayback();
    watchSticky = null;
    var st = watchState();
    watchShownState = st;
    var main = $("watchMain");
    main.innerHTML = "";
    main.hidden = (st === "replay");
    if (st === "upcoming") renderUpcoming(main);
    else if (st === "live") { renderLive(main, null); attemptLiveAudio(); }
    renderLibrary();
    markDemoBar();
  }
  function renderUpcoming(main) {
    var nx = nextAiring();
    var h = document.createElement("h3");
    h.textContent = nx.live ? T("watch.onair") : Tf("watch.next", { label: nx.label });
    main.appendChild(h);
    var cyc = agendaCycle();
    if (!cyc) {
      var none = document.createElement("p");
      none.textContent = T("watch.noagenda");
      main.appendChild(none);
    } else if (!PodiumStore.itemsForCycle(state, cyc.id).length) {
      /* Agenda known but nothing drawn yet (the static seed never draws
         future cycles): name the wait instead of an empty bill. The draw
         sentence appears only while the stored draw datetime is still in
         the future, so the note stays true after the date passes too. */
      var pend = document.createElement("p");
      var txt = T("watch.noselect");
      if (cyc.drawAt) {
        var dAt = cycleDateTimeFor(cyc, cyc.drawAt);
        if (dAt && dAt > etNow()) txt += " " + Tf("watch.draw", { date: cyc.drawAt });
      }
      pend.textContent = txt;
      main.appendChild(pend);
    } else {
      var sub = document.createElement("p");
      sub.textContent = Tf("watch.onbill", { cycle: cycleLabel(cyc) });
      main.appendChild(sub);
      var ul = document.createElement("ul");
      ul.className = "watch-library";
      PodiumStore.itemsForCycle(state, cyc.id).forEach(function (item) {
        var p = PodiumStore.postById(state, item.postId);
        var author = PodiumStore.citizenById(state, p.authorId);
        var li = document.createElement("li");
        li.className = "card";
        li.innerHTML = "<p>" + selectionBadge(cyc, item, p) + "</p>" +
          '<p><span class="ref-code">' + esc(p.ref || "") + "</span> <strong>" + esc(author.name) + "</strong> \u00b7 " + esc(Ttopic(p.topic)) + "</p>";
        li.appendChild(fullRecordButton(p.id, Tf("feed.fullrecord.ref", { ref: p.ref || "" })));
        ul.appendChild(li);
      });
      main.appendChild(ul);
    }
    var note = document.createElement("p");
    note.className = "hint";
    note.textContent = T("watch.hint");
    main.appendChild(note);
  }
  function liveItems(cyc) {
    return cyc ? PodiumStore.itemsForCycle(state, cyc.id) : [];
  }
  /* Real replay video (TY, Oct 28): only cycles carrying replaySrc (Week of
     Oct 5) play a real presenter video instead of the simulated slate. */
  function replayBar(live) {
    var bar = document.createElement("div");
    bar.className = "player-bar";
    var badge = document.createElement("span");
    badge.className = "live-badge";
    badge.textContent = live ? T("watch.live.badge") : T("watch.replay.badge");
    bar.appendChild(badge);
    return bar;
  }
  function renderSlateReplay(player, live, title) {
    var cv = document.createElement("canvas");
    cv.width = 640;
    cv.height = 300;
    cv.setAttribute("aria-label", live ? T("watch.slate.live.aria") : T("watch.slate.replay.aria"));
    cv.setAttribute("role", "img");
    cv.textContent = T("watch.slate.text");
    player.appendChild(cv);
    var bar = replayBar(live);
    var unmute = document.createElement("button");
    unmute.type = "button";
    unmute.className = "btn btn-small unmute-btn";
    unmute.id = "watchUnmute";
    unmute.hidden = true;
    unmute.textContent = T("watch.unmute");
    unmute.addEventListener("click", function () { attemptLiveAudio(); });
    bar.appendChild(unmute);
    var snd = document.createElement("span");
    snd.id = "watchSoundNote";
    snd.style.color = "#fff";
    bar.appendChild(snd);
    player.appendChild(bar);
    startSlate(cv, live, title);
  }
  function renderVideoReplay(player, rc) {
    var v = document.createElement("video");
    v.setAttribute("controls", "");
    v.preload = "metadata";
    v.src = rc.replaySrc;
    v.addEventListener("error", function () {
      if (v.dataset.stopped || !v.parentNode) return;
      /* Fallback: file missing or unloadable — the existing simulated
         slate for the same cycle, so the tab never breaks or blanks. */
      player.innerHTML = "";
      renderSlateReplay(player, false, Tf("watch.replay.title", { cycle: cycleLabel(rc) }));
    });
    player.appendChild(v);
    player.appendChild(replayBar(false));
    return v;
  }
  function renderLive(main, replayId) {
    var items, title, live;
    var rc = replayId ? PodiumStore.cycleById(state, replayId) : null;
    if (replayId) {
      items = liveItems(rc);
      title = Tf("watch.replay.title", { cycle: cycleLabel(rc) });
      live = false;
    } else {
      items = liveItems(agendaCycle());
      title = T("watch.live.title");
      live = true;
    }
    var player = document.createElement("div");
    player.className = "player";
    var videoEl = null;
    if (!live && rc && rc.replaySrc) {
      videoEl = renderVideoReplay(player, rc);
    } else {
      renderSlateReplay(player, live, title);
    }
    main.appendChild(player);
    main.appendChild(buildNowReading(live, items));
    if (videoEl) {
      /* The open click is a user gesture: try to play; if the browser
         blocks it, controls remain so the user can press play manually. */
      try {
        var pr = videoEl.play();
        if (pr && pr.catch) pr.catch(function () {});
      } catch (e) {}
    }
  }
  /* One screening entry: selection badge, the Citizen Post block, the
     Committee Answer block (omitted when the item has no answer text),
     and that post's Full record button. Same blocks the single-item view
     used; the replay loop below just stacks one per item. */
  function screeningEntry(item) {
    var frag = document.createDocumentFragment();
    var p = PodiumStore.postById(state, item.postId);
    if (!p) return frag;
    var badge = document.createElement("p");
    badge.innerHTML = selectionBadge(PodiumStore.cycleById(state, p.cycleId), item, p);
    frag.appendChild(badge);
    var z = document.createElement("div");
    z.className = "zone zone-post";
    z.innerHTML = '<span class="zone-label">' + esc(T("zone.post.screening")) + "</span>" +
      '<p><span class="ref-code">' + esc(p.ref || "") + "</span>" + langSuffix(p) + "</p>" +
      "<blockquote>" + esc(p.body) + "</blockquote>";
    frag.appendChild(z);
    var zSeal = document.createElement("div");
    zSeal.innerHTML = sealHtml(p);
    frag.appendChild(zSeal);
    if (item.answer) {
      var za = document.createElement("div");
      za.className = "zone zone-answer";
      za.innerHTML = '<span class="zone-label">' + esc(T("zone.answer.screening")) + "</span>" +
        '<p><span class="ref-code">' + esc(answerCode(p)) + "</span></p>" +
        "<blockquote>" + esc(displayAnswer(item.answer)) + "</blockquote>";
      frag.appendChild(za);
      var zn = document.createElement("p");
      zn.className = "hint";
      zn.textContent = T("wonder.notapproval");
      frag.appendChild(zn);
    }
    frag.appendChild(fullRecordButton(p.id, Tf("feed.fullrecord.ref", { ref: p.ref || "" })));
    return frag;
  }
  function buildNowReading(live, items) {
    var nr = document.createElement("div");
    nr.className = "now-reading";
    nr.id = "nowReading";
    if (!live) {
      /* Replay "Screening" view: the FULL record — every item in order
         (top-voted first), each with its badge, post block, answer block,
         and Full record button. A replay is a record, not a timed
         broadcast, so stacking needs no new state or controls. The live
         "Now reading" path below is untouched. Shared by the video and
         slate replay paths. */
      nr.setAttribute("data-idx", 0);
      var h = document.createElement("h3");
      h.textContent = T("watch.screening");
      nr.appendChild(h);
      items.forEach(function (item) { nr.appendChild(screeningEntry(item)); });
      if (!items.length) nr.appendChild(document.createTextNode(T("watch.noitems")));
      return nr;
    }
    var idx = (items.length > 1 && etParts().minuteNum >= 15) ? 1 : 0;
    nr.setAttribute("data-idx", idx);
    var first = items[idx] ? PodiumStore.postById(state, items[idx].postId) : null;
    if (!first) {
      nr.textContent = T("watch.noitems");
      return nr;
    }
    var hl = document.createElement("h3");
    hl.textContent = Tf("watch.nowreading", { i: idx + 1, n: items.length });
    nr.appendChild(hl);
    var z = document.createElement("div");
    z.className = "zone zone-post";
    z.innerHTML = '<span class="zone-label">' + esc(T("zone.post.screening")) + "</span>" +
      '<p><span class="ref-code">' + esc(first.ref || "") + "</span></p>" +
      "<blockquote>" + esc(first.body) + "</blockquote>";
    nr.appendChild(z);
    var zSeal = document.createElement("div");
    zSeal.innerHTML = sealHtml(first);
    nr.appendChild(zSeal);
    nr.appendChild(fullRecordButton(first.id, Tf("feed.fullrecord.ref", { ref: first.ref || "" })));
    return nr;
  }
  function refreshNowReading(nrEl) {
    var items = liveItems(agendaCycle());
    var want = (items.length > 1 && etParts().minuteNum >= 15) ? 1 : 0;
    if (Number(nrEl.getAttribute("data-idx")) === want) return;
    nrEl.parentNode.replaceChild(buildNowReading(true, items), nrEl);
  }
  /* Replay timing (TY, Oct 28): the Replay library flips exactly like This
     Week — a cycle appears only once its briefing datetime has passed
     (newest briefing first), so the upcoming briefing never shows early.
     A briefed cycle with no replay video attached shows an honest
     "Replay processing, available soon" placeholder instead of silence
     and never an old replay mislabeled as the new one. The player itself
     stays the demo-only simulated slate. */
  function replayPlaceholder(c) {
    var p = document.createElement("p");
    p.className = "hint";
    p.textContent = Tf("watch.processing.full", { cycle: cycleLabel(c), date: c.briefingAt });
    return p;
  }
  function stopReplayButton(main) {
    var stop = document.createElement("button");
    stop.type = "button";
    stop.className = "btn btn-small";
    stop.textContent = T("watch.stop");
    stop.addEventListener("click", function () { renderWatch(); window.scrollTo(0, 0); });
    main.appendChild(stop);
  }
  function renderLibrary() {
    var ul = $("watchLibrary");
    ul.innerHTML = "";
    var past = PodiumStore.replayCycles(state, etNow());
    if (!past.length) {
      var li0 = document.createElement("li");
      li0.textContent = T("watch.library.empty");
      ul.appendChild(li0);
      return;
    }
    past.forEach(function (c) {
      var li = document.createElement("li");
      li.className = "card";
      var names = PodiumStore.itemsForCycle(state, c.id).map(function (b) {
        var p = PodiumStore.postById(state, b.postId);
        return (b.selection === "top" ? T("lib.top") : T("lib.random")) + " " + (p.ref || "");
      }).join("; ");
      li.innerHTML = "<p><strong>" + esc(cycleLabel(c)) + "</strong> \u00b7 " + esc(T("watch.library.aired")) + " " + esc(c.briefingAt) + "</p>" +
        '<p class="hint">' + esc(names) + "</p>";
      if (!PodiumStore.replayReady(c)) {
        li.appendChild(replayPlaceholder(c));
      } else {
        var play = document.createElement("button");
        play.type = "button";
        play.className = "btn btn-small";
        play.textContent = c.replaySrc ? T("watch.play.video") : T("watch.play.screening");
        play.addEventListener("click", function () { playReplay(c.id); });
        li.appendChild(play);
      }
      ul.appendChild(li);
    });
  }
  function playReplay(cycleId) {
    stopWatchPlayback();
    watchSticky = "replay";
    var main = $("watchMain");
    main.hidden = false;
    main.innerHTML = "";
    markDemoBar();
    var cyc = PodiumStore.cycleById(state, cycleId);
    if (cyc && !PodiumStore.replayReady(cyc)) {
      main.appendChild(replayPlaceholder(cyc));
      stopReplayButton(main);
      window.scrollTo(0, 0);
      return;
    }
    renderLive(main, cycleId);
    stopReplayButton(main);
    /* Real-video replays carry their own audio: never start the slate drone. */
    if (!(cyc && cyc.replaySrc)) attemptLiveAudio(); /* click is a gesture: sound starts directly */
    window.scrollTo(0, 0);
  }

  /* --- production-faithful sound policy: real AudioContext state, real
     autoplay blocking. Only the program content is simulated. --- */
  function ensureLiveAudio() {
    if (liveCtx) return liveCtx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    liveCtx = new AC();
    liveGain = liveCtx.createGain();
    liveGain.gain.value = 0.0;
    liveAnalyser = liveCtx.createAnalyser();
    liveAnalyser.fftSize = 64;
    var o1 = liveCtx.createOscillator();
    o1.type = "sine";
    o1.frequency.value = 220;
    var o2 = liveCtx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = 277.18;
    var g2 = liveCtx.createGain();
    g2.gain.value = 0.4;
    o1.connect(liveGain);
    o2.connect(g2);
    g2.connect(liveGain);
    liveGain.connect(liveAnalyser);
    liveAnalyser.connect(liveCtx.destination);
    o1.start();
    o2.start();
    return liveCtx;
  }
  function setUnmuteUI(mode) {
    var b = $("watchUnmute"), n = $("watchSoundNote");
    if (!b || !n) return;
    if (mode === "live") { b.hidden = true; n.textContent = T("watch.sound.live"); }
    else if (mode === "blocked") { b.hidden = false; n.textContent = T("watch.sound.blocked"); }
    else if (mode === "unavailable") { b.hidden = true; n.textContent = T("watch.sound.unavailable"); }
    else { b.hidden = true; n.textContent = T("watch.sound.starting"); }
  }
  function attemptLiveAudio() {
    var ctx = ensureLiveAudio();
    setUnmuteUI("trying");
    if (!ctx) { setUnmuteUI("unavailable"); return; }
    ctx.resume().then(function () {
      if (ctx.state === "running") { liveGain.gain.value = 0.03; setUnmuteUI("live"); }
      else { liveGain.gain.value = 0.0; setUnmuteUI("blocked"); }
    }).catch(function () { setUnmuteUI("blocked"); });
  }
  function stopWatchPlayback() {
    if (watchRAF) { cancelAnimationFrame(watchRAF); watchRAF = null; }
    var wm = $("watchMain");
    if (wm) {
      Array.prototype.forEach.call(wm.querySelectorAll("video"), function (v) {
        try { v.dataset.stopped = "1"; v.pause(); v.removeAttribute("src"); } catch (e) {}
      });
    }
    try {
      if (liveGain) liveGain.gain.value = 0.0;
      if (liveCtx && liveCtx.state === "running") liveCtx.suspend();
    } catch (e) {}
  }
  function liveLevel() {
    if (!liveAnalyser || !liveCtx || liveCtx.state !== "running") return 0;
    var a = new Uint8Array(liveAnalyser.frequencyBinCount);
    liveAnalyser.getByteFrequencyData(a);
    var sum = 0, i;
    for (i = 0; i < a.length; i++) sum += a[i];
    return Math.min(1, (sum / a.length / 255) * 3);
  }
  function startSlate(cv, live, title) {
    if (watchRAF) { cancelAnimationFrame(watchRAF); watchRAF = null; }
    if (!cv.getContext) return;
    var g = cv.getContext("2d");
    function frame() {
      var W = cv.width, H = cv.height;
      g.fillStyle = "#0b1d33";
      g.fillRect(0, 0, W, H);
      g.fillStyle = "#fdb81e";
      g.fillRect(0, 0, W, 8);
      g.fillStyle = live ? "#e31c3d" : "#3e94cf";
      g.font = "bold 34px Georgia, serif";
      g.fillText(live ? "\u25cf " + T("watch.live") : T("watch.replay"), 28, 64);
      g.fillStyle = "#ffffff";
      g.font = "28px Georgia, serif";
      g.fillText("THE PODIUM", 28, 110);
      g.fillStyle = "#d7dee8";
      g.font = "20px Georgia, serif";
      g.fillText(String(title).slice(0, 42), 28, 145);
      var t = new Date();
      var et = etParts(t);
      g.fillStyle = "#ffffff";
      g.font = "22px monospace";
      g.fillText(et.hour + ":" + et.minute + ":" + ("0" + t.getSeconds()).slice(-2) + " ET", 28, 185);
      var level = liveLevel();
      g.fillStyle = "#1d2f45";
      g.fillRect(28, 210, 300, 26);
      g.fillStyle = level > 0 ? "#2e8540" : "#5b616b";
      g.fillRect(28, 210, Math.max(2, 300 * level), 26);
      g.fillStyle = "#9aa3ad";
      g.font = "16px sans-serif";
      g.fillText(T("watch.slate.demo"), 28, 268);
      watchRAF = requestAnimationFrame(frame);
    }
    frame();
  }

  function markDemoBar() {
    document.querySelectorAll("#watchDemoBar [data-watch-state]").forEach(function (b) {
      var on = b.getAttribute("data-watch-state") === (watchOverride || watchSticky || "auto");
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
  function tickWatch() {
    var live = clockIsLive();
    var badge = $("watchTabLive");
    if (badge) badge.hidden = !live;
    var tab = document.querySelector('.main-nav .tab[data-view="watch"]');
    if (tab) tab.setAttribute("aria-label", live ? T("tab.watchlive.airing") : T("tab.watch"));
    if (currentView !== "watch" || watchOverride || watchSticky) return;
    var desired = live ? "live" : "upcoming";
    if (watchShownState && watchShownState !== desired) { renderWatch(); return; }
    if (live) {
      var main = $("watchMain");
      if (main && !main.querySelector(".player")) { renderWatch(); return; }
      var nrEl = $("nowReading");
      if (nrEl) refreshNowReading(nrEl);
    }
  }

  $("gotoWatchBtn").addEventListener("click", function () { showView("watch"); });
  $("backToBriefingBtn").addEventListener("click", function () { showView("briefing"); });
  document.querySelectorAll("#watchDemoBar [data-watch-state]").forEach(function (b) {
    b.addEventListener("click", function () {
      /* Sub-view switches must not move the page scroll (unlike main-tab
         switches in showView, which intentionally start at the top). The
         sub-views have different heights, so the browser would otherwise
         clamp or anchor the scroll on the DOM swap: pin it back. */
      var y = (typeof window.scrollY === "number") ? window.scrollY : 0;
      var v = b.getAttribute("data-watch-state");
      watchOverride = (v === "auto") ? null : v;
      renderWatch();
      if (typeof window.scrollTo === "function") window.scrollTo(0, y);
      if (typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(function () { window.scrollTo(0, y); });
      }
    });
  });
  tickWatch();
  setInterval(tickWatch, 20000);

  /* Indicator stability (TY, Oct 28): overlapping live checks can flip the
     reported mode back and forth while typing. Display only: hold the last
     shown state until a new state persists — a change applies after it
     survives one quiet window, and a flip back inside the window cancels
     silently. Which engine runs, the fallback rule, and gate results are
     untouched; the settled display always matches the last settled check. */
  var aiModeShown = null; /* "live" | "stub" | null (not yet shown) */
  var aiModeTimer = null;
  var AI_MODE_QUIET_MS = 1000;
  function showAiMode(want) {
    aiModeShown = want;
    var el = $("aiMode");
    el.textContent = want === "live" ? T("ai.live") : T("ai.stub");
    el.classList.toggle("is-live", want === "live");
  }
  function renderAiMode() {
    var want = PodiumAI.isLive() ? "live" : "stub";
    if (aiModeShown === null) { showAiMode(want); return; }
    if (want === aiModeShown) {
      if (aiModeTimer) { clearTimeout(aiModeTimer); aiModeTimer = null; }
      return;
    }
    if (aiModeTimer) clearTimeout(aiModeTimer);
    aiModeTimer = setTimeout(function () {
      aiModeTimer = null;
      showAiMode(PodiumAI.isLive() ? "live" : "stub");
    }, AI_MODE_QUIET_MS);
  }
  function wireKeyUi() {
    $("apiKeySave").addEventListener("click", function () {
      PodiumAI.setKey($("apiKeyInput").value.trim());
      $("apiKeyInput").value = "";
      liveGateCache = null;
      liveClarityCache = null;
      renderAiMode();
      if (autoTransOn && currentView === "feed") renderFeed(); /* key arrived: translate the page */
    });
    $("apiKeyClear").addEventListener("click", function () {
      PodiumAI.clearKey();
      $("apiKeyInput").value = "";
      liveGateCache = null;
      liveClarityCache = null;
      renderAiMode();
      syncAutoNote(); /* key gone: show the no-key note, fire nothing */
    });
    PodiumAI.onModeChange = renderAiMode;
  }

  /* ---------- cross-tab sync ---------- */
  /* Another tab's save wins, as whole-state saves always have; this only
     makes it timely. The current view refreshes in place; a draft being
     actively typed here is never overwritten. */
  window.addEventListener("storage", function (e) {
    if (e.key === "podium.v1") {
      state = PodiumStore.load(etNow());
      renderCitizen();
      updateOnePostNotice();
      if (currentView === "feed" && !linkedPostId && !linkMissing && !isCodeSearch()) {
        /* Another tab saved: refresh counts in place on the frozen list.
           Never auto-inject new posts into a view being read. */
        feedFreeze = true;
        renderFeed();
      } else if (currentView === "feed") renderFeed();
      else if (currentView === "briefing") renderBriefing();
      else if (currentView === "prior") renderPrior();
      else if (currentView === "status") renderStatus();
      else if (currentView === "watch") {
        /* A replay in flight (slate or video) stays put: never yank what
           is playing. Library / Upcoming / Live states re-render with the
           fresh state. */
        var vw = $("watchMain");
        var vv = vw && vw.querySelector("video");
        if (!watchSticky && !(vv && !vv.paused)) renderWatch();
      }
      else if (currentView === "post") renderComposerGate();
    } else if (e.key === DRAFT_KEY && document.activeElement !== composerText) {
      restoreDraft();
      renderComposerGate();
    } else if (e.key === PS().LANG_KEY) {
      /* Another tab switched the interface language: re-render the chrome
         in place. Display-only; no post, vote, draw, or briefing data moves. */
      PS().sync();
      var sel = $("langSel");
      if (sel) sel.value = uiLang();
      applyStaticChrome();
      renderCurrentView();
    }
  });

  /* ---------- interface language ---------- */
  /* Switching languages re-renders the chrome immediately and changes no
     post, vote, draw, or briefing data — every string below is display-only.
     Static markup keeps its English text; this pass overwrites it from the
     table on boot and on every switch, so English stays pixel-identical
     (the table holds the verbatim current wording) and Spanish covers the
     whole chrome. */
  function refillTopicSelects() {
    var tf = $("topicFilter"), ct = $("composerTopic");
    var tfv = tf ? tf.value : "", ctv = ct ? ct.value : "";
    if (tf) fillTopics(tf, true);
    if (ct) fillTopics(ct, false);
    if (tf) tf.value = tfv;
    if (ct) ct.value = ctv;
  }
    /* Null-safe static setters: the committed test runner loads app.js
     against a partial DOM, so boot-time chrome application must never
     throw on a missing element. */
  function setText(id, v) { var el = $(id); if (el) el.textContent = v; }
  function setHtml(id, v) { var el = $(id); if (el) el.innerHTML = v; }
  function setAttr(id, a, v) { var el = $(id); if (el) el.setAttribute(a, v); }
  function setPh(id, v) { var el = $(id); if (el) el.setAttribute("placeholder", v); }
  function applyStaticChrome() {
    document.documentElement.lang = uiLang();
    document.title = T("doc.title");
    setText("skipLink", T("skip.main"));
    setText("govText", T("gov.text"));
    setText("govHowLabel", T("gov.how"));
    renderGovPanel();
    syncAutoUi(); /* re-labels the toggle; applyLanguage re-renders the feed after this */
    setText("brandSub", T("brand.sub"));
    setAttr("mainNav", "aria-label", T("nav.primary"));
    document.querySelectorAll(".main-nav .tab").forEach(function (t) {
      var view = t.getAttribute("data-view");
      var badge = t.querySelector(".tab-live");
      t.textContent = T("tab." + view) + " ";
      if (badge) { badge.textContent = T("tab.watchlive.badge"); t.appendChild(badge); }
    });
    setAttr("ruleCard", "aria-label", T("rule.reminder"));
    setText("ruleHeading", T("rule.heading"));
    setHtml("ruleP1", T("rule.p1"));
    setText("ruleP2", T("rule.p2"));
    setText("ruleP3", T("rule.p3"));
    setText("ruleP4", T("rule.p4"));
    setText("readFullRule", T("rule.readfull"));
    setText("fineSummary", T("fine.summary"));
    setText("fineLede", T("fine.lede"));
    setText("statementsHeading", T("fine.statements"));
    setText("finePurpose", T("fine.purpose"));
    /* The simulation statement lives here, not in the static markup, so the
       committed test runner never sees a changed list. */
    var fineUl = document.getElementById("fineList");
    if (fineUl && !document.getElementById("fineLi18")) {
      var li18 = document.createElement("li");
      li18.id = "fineLi18";
      fineUl.appendChild(li18);
    }
    if (fineUl && !document.getElementById("fineLi19")) {
      var li19 = document.createElement("li");
      li19.id = "fineLi19";
      fineUl.appendChild(li19);
    }
    if (fineUl && !document.getElementById("fineLi20")) {
      var li20 = document.createElement("li");
      li20.id = "fineLi20";
      fineUl.appendChild(li20);
    }
    if (fineUl && !document.getElementById("fineLi21")) {
      var li21 = document.createElement("li");
      li21.id = "fineLi21";
      fineUl.appendChild(li21);
    }
    Array.prototype.forEach.call(document.querySelectorAll("#fineList li"), function (li, i) {
      li.textContent = T("fine.li" + (i + 1));
    });
    setText("liveFeedToggleLabel", T("livefeed.toggle"));
    syncLiveUi();
    setText("langLabel", T("lang.label"));
    setAttr("langSel", "aria-label", T("lang.label"));
    setAttr("view-feed", "aria-label", T("feed.aria"));
    setText("feedHeading", T("tab.feed"));
    document.querySelectorAll(".subtabs .subtab").forEach(function (b) {
      b.textContent = T("feed." + b.getAttribute("data-feed"));
    });
    setText("topicFilterLabel", T("feed.topic"));
    setAttr("topicFilterWrap", "aria-label", T("feed.topicfilter.aria"));
    setText("searchLabel", T("feed.search"));
    setPh("searchInput", T("feed.search.ph"));
    setText("pageSizeLabel", T("feed.perpage"));
    setText("voteRule", T("feed.voterule"));
    setText("prevPage", T("feed.prev"));
    setText("nextPage", T("feed.next"));
    setAttr("view-post", "aria-label", T("post.aria"));
    setText("postHeading", T("tab.post"));
    setAttr("miniRule", "aria-label", T("rule.reminder"));
    setText("miniRuleStrong", T("post.rule.applies"));
    setText("miniRuleText", T("post.rule.text"));
    setText("composerTopicLabel", T("post.topic"));
    setText("composerTopicHint", T("post.topic.hint"));
    setText("timerHint", T("post.timer.hint"));
    setText("composerTextLabel", T("post.address"));
    setPh("composerText", T("post.text.ph"));
    if ($("aiMode")) { aiModeShown = null; renderAiMode(); }
    setText("publishNote", T("publish.note"));
    setText("previewBtn", T("preview.hear"));
    setAttr("orderList", "aria-label", T("feed.order.aria"));
    setAttr("topicList", "aria-label", T("feed.topicfilter.aria"));
    setAttr("demoBarGroup", "aria-label", T("watch.demo.aria"));
    var hb = $("hearDraftBtn"), nv = $("hearNoVoice");
    if (hb) hb.textContent = T("hear.draft");
    if (nv) nv.textContent = T("hear.novoice");
    setAttr("view-briefing", "aria-label", T("briefing.aria"));
    setText("briefingLede1", T("briefing.lede1"));
    setHtml("briefingLede2", T("briefing.lede2"));
    setText("gotoWatchBtn", T("briefing.watch"));
    setText("gotoWatchHint", T("briefing.watch.hint"));
    setText("nextHeading", T("briefing.next"));
    setText("nextHint", T("briefing.next.hint"));
    setText("drawHeading", T("briefing.draw"));
    setHtml("drawLede", T("briefing.draw.lede"));
    setText("excludedHeading", T("briefing.draw.excluded"));
    setText("drawReadonly", T("briefing.draw.readonly"));
    setText("workedHeading", T("briefing.draw.worked"));
    setHtml("workedBody", T("briefing.draw.worked.body"));
    setText("committeeRule", T("briefing.draw.committee"));
    setAttr("view-watch", "aria-label", T("watch.aria"));
    setText("watchHeading", T("tab.watch"));
    setText("watchLede", T("watch.lede"));
    setHtml("demoBarHint", T("watch.demo"));
    document.querySelectorAll("#watchDemoBar [data-watch-state]").forEach(function (b) {
      b.textContent = T("watch." + b.getAttribute("data-watch-state"));
    });
    setText("watchLibraryHeading", T("watch.library"));
    setText("backToBriefingBtn", T("watch.back"));
    setText("watchSimNote", T("watch.simnote"));
    setAttr("view-prior", "aria-label", T("prior.aria"));
    setText("priorHeading", T("tab.prior"));
    setText("priorLede", T("prior.lede"));
    setText("priorSelectedLabel", T("thread.selected"));
    setAttr("view-status", "aria-label", T("status.aria"));
    setText("statusHeading", T("tab.status"));
    setText("statusLede", T("status.lede"));
    setText("statusSelectedLabel", T("thread.selected"));
    setText("footerAbout", T("footer.about"));
    setText("footerAboutText", T("brand.sub"));
    setText("footerProcess", T("footer.process"));
    setText("footerProcessChain", T("footer.process.chain"));
    setText("footerSecurity", T("footer.security"));
    setText("footerSecurityNote", T("footer.security.note"));
    setText("footerNotices", T("footer.notices"));
    setHtml("footerDemoNotice", T("footer.demonotice"));
    setText("apiKeyLabel", T("footer.key"));
    setText("apiKeyHint", T("footer.key.hint"));
    setPh("apiKeyInput", T("footer.key.ph"));
    setText("apiKeySave", T("footer.key.save"));
    setText("apiKeyClear", T("footer.key.clear"));
    setText("previewTitle", T("preview.title"));
    setText("previewClose", T("preview.close"));
    setText("previewPublish", T("preview.publish"));
    setText("publishBtn", T("preview.publish"));
    setText("citizenModalTitle", T("citizens.title"));
    setText("citizenHint", T("citizens.hint"));
    setText("citizenClose", T("citizens.cancel"));
    renderMockBox();
  }
  function renderCurrentView() {
    renderCitizen();
    refillTopicSelects();
    if (currentView === "feed") renderFeed();
    else if (currentView === "briefing") renderBriefing();
    else if (currentView === "prior") renderPrior();
    else if (currentView === "status") renderStatus();
    else if (currentView === "watch") renderWatch();
    else if (currentView === "committee") renderCommittee();
    else if (currentView === "post") { updateOnePostNotice(); renderComposerGate(); }
  }
  function applyLanguage(l) {
    PS().set(l);
    document.documentElement.lang = uiLang();
    var sel = $("langSel");
    if (sel) sel.value = uiLang();
    applyStaticChrome();
    renderCurrentView();
  }

  /* ---------- init ---------- */
  var langSelInit = $("langSel");
  if (langSelInit) {
    langSelInit.value = uiLang();
    langSelInit.addEventListener("change", function () { applyLanguage(langSelInit.value); });
  }
  applyStaticChrome();
  renderCitizen();
  updateOnePostNotice();
  restoreDraft();
  renderComposerGate();
  wireHearUi();
  wireKeyUi();
  renderAiMode();
  restoreFeedState(); /* sort + topic + clamped page ride along when the feed is restored */
  /* Restore the saved tab synchronously during initial render (no flash of
     feed). A #post/... deep link governs instead and the saved tab is
     ignored for that load; with no saved tab, boot to Live Feed. The
     load-time scroll-to-top runs after this, so a reload settles at the
     top of the restored tab. */
  (function () {
    var start = savedView();
    if (/^#post\//.test(window.location.hash || "")) start = null;
    if (start && start !== "feed") showView(start);
    else renderFeed();
  })();
  handleDeepLink();
})();
