# Flow Patterns — Design Lifecycle

[PLAYBOOK] — the per-flow-type pattern library the flow-architect draws on. Each pattern is a SPINE, not a template — the architect adapts it to the product's real events and activation window.

## The shared spine rule

Every flow, regardless of type, obeys: **entry trigger → N event-gated steps inside the window → exits at every step**. The differences below are the *intent* of each step, not a change to that contract.

---

## 0. Find the activation event (before any onboarding or activation flow)

When the activation metric is not already measured, find it before you design steps:

1. Set the realistic use frequency for this category (daily for messaging, weekly or less for travel or reviews).
2. Find the users who reach that frequency. Compare their first-window actions with those of users who stopped.
3. Name the one action and count that best separates the two groups. Confirm it on a second cohort before it becomes the flow's activation metric.
4. If very few users ever reach the expected frequency, stop: the product or the audience needs work before a flow can help. Route to `diagnose` or `position`.

Without behavior data, label the activation event `assumed` and state the query that would confirm it.

---

## 1. Onboarding (signup → activation)

**Entry:** signup / first login. **Job:** reach the activation metric. **Window:** the empirical activation window (the time by which most users who ever activate have activated — typically 7–14 days; measure, don't guess).

| Step intent | Typical trigger | Fires only if |
|-------------|-----------------|---------------|
| Welcome + the ONE next action | signup + 0–1h | always (entry) |
| Value-moment nudge | created account but not the activation event, +24–48h | not yet activated |
| Friction removal | started the activation path, didn't finish, +behavior | stalled mid-path |
| Social / teammate pull (if multi-player) | core action done, +1–2d | activation event still open |
| Last-chance + human-touch offer | end of window, not activated | not activated, not unsubscribed |

**Step rules:**
- Drive the user along the path to the activation action. Remove any step that does not lead there.
- Right after the first reward, ask for one small investment that stores value (content, data, connections, preferences) and sets up the next reason to return. Never ask for it before the reward.
- Ask for notification or email permission only after the user has seen the value those messages will deliver. A permission request on the first screen is an anti-pattern.

**Suppression:** activated (the headline exit) · converted to paid · unsubscribed · frequency cap. The activation exit is the most important — the day-5 "still stuck?" must NOT reach a user who activated on day 1.

**Falsifiable anti-pattern:** any step that can fire after the activation event. Detection: scan each step's "fires only if" against the activation exit.

---

## 2. Activation (stalled before the "aha")

**Entry:** signed up but stalled at a known threshold before the value moment. **Job:** cross that specific threshold. **Window:** short — a stalled user cools fast.

| Step intent | Typical trigger |
|-------------|-----------------|
| Diagnose the stall point (name it) | stalled at X for +Nh |
| Targeted unblock (the 1 thing) | still stalled at X |
| Alternative path to the same value | unblock didn't land |
| Human-touch offer (call / concierge) | still stalled at window end |

**Suppression:** crossed the threshold · churned · unsubscribed. **Anti-pattern:** generic re-onboarding instead of unblocking the *specific* stall — wastes the diagnostic the activation flow exists for.

---

## 3. Winback (dormant → reactivate)

**Entry:** dormant N days past the user's *normal* usage cadence (cadence-relative, not a fixed calendar). **Job:** reactivate a lapsed — not churned — user. **Window:** 2–3 touches, then stop; a 6-email winback to a dead address hurts deliverability.

| Step intent | Typical trigger |
|-------------|-----------------|
| "We noticed" + the value moment they're missing | dormant N days |
| What's new since they left (specific) | no return after step 1 |
| Re-onboard the value moment / final pulse | no return after step 2 |

**Before you write winback copy,** sort known churn reasons into those the product or message can fix and those it cannot (moved away, need ended, price out of reach). Send fixable reasons to the flow; route the others to the product or offer owner instead of messaging them.

**Suppression:** returned (used the product) · unsubscribed · marked dead. **Falsifiable anti-pattern:** leading with a discount. Detection: step-1 CTA is a coupon → flag. Discount-led winback teaches users to lapse for discounts and erodes price integrity. A discount, if used at all, comes last, not first.

---

## 4. Churn-save (cancel/downgrade → reverse or soften)

**Entry:** cancellation or downgrade event. **Job:** reverse or soften the cancel. **Window:** immediate — the save window closes fast after the decision.

| Step intent | Typical trigger |
|-------------|-----------------|
| Acknowledge + the no-guilt exit door | cancel/downgrade fired |
| Surface the specific unrealized value OR the specific friction | acknowledged, not re-engaged |
| Targeted save offer — **downgrade before discount** | still leaving |
| Graceful exit + win-back seed | left anyway |

**Suppression:** reversed the cancel · completed the leave · unsubscribed. **Anti-pattern:** the reflexive discount as step 1. Order of save offers: pause/downgrade plan → resolve the specific friction → (only then) discount. Guilt-tripping ("are you sure you want to lose all this?") confirms the cancel; never use it.

---

## 5. Habit (post-activation)

**Entry:** activated. **Job:** make the next return come from the user's own need, not from the message. **Window:** the product's natural use cycle.

- **Write the habit sentence:** "Each time the user [feels or faces situation X], they [take first action Y]." Time each external trigger to just before that situation. A trigger with no tie to a core-value event is overhead; cut it.
- **Match the reward to the product:** social (recognition from others), resource (finding something useful), or mastery (progress, completion). Keep some variety in what the user finds so repeat visits stay worth it.
- **Respect frequency.** Do not try to build a daily habit for a product people need rarely. For low-frequency products, aim to be the default choice when the need comes up: a timely reminder at the known need moment, not a streak.
- **Ongoing onboarding:** introduce the next feature only after the user has used the previous one, one at a time. Do not announce many features in one message.

**Suppression:** churned · unsubscribed · frequency cap. **Falsifiable anti-pattern:** a send whose trigger is the calendar, not a user state or a known need moment.

---

## Cross-pattern rules

- **One activation metric per flow.** Don't bolt a winback onto an onboarding flow.
- **Exits before sends.** Enumerate the four standing exits first, then add steps.
- **Cadence-relative dormancy** for winback — a daily-active user dormant 7 days is lapsing; a monthly user at 7 days is fine.
- **Downgrade beats discount** in churn-save — a downgraded user is retained; a discounted user is a margin loss who often still churns.
