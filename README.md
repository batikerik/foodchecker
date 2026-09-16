# FoodChecker 🔬

**Point your phone at an ingredient list. Get back a breakdown you can actually read.**

FoodChecker is a mobile web app that turns the fine print on the back of a package
into a clear verdict. Photograph the composition of anything — a chocolate bar, a
hair gel, a bottle of floor cleaner, an infant formula, a supplement — and within
seconds you get a safety score from 0 to 100, a plain-language summary, and a
line-by-line reading of what each component is and why it's there.

The point isn't a generic "is this bad for people." The point is *is this bad for
you*. Fill in a short profile — age, allergies and intolerances, chronic
conditions, pregnancy or breastfeeding, dietary restrictions — and the score is
recalculated against it, with a dedicated "personally for you" section that calls
out what matters in your case. A nut allergy turns an otherwise unremarkable
granola bar red. Pregnancy changes the verdict on a retinol cream.

### What you get back

Every scan returns a structured report, not a wall of text:

- **A score from 0 to 100** with a verdict band — *good / acceptable / with caution / bad* — on a calibrated scale, where 85+ is a clean composition and anything under 15 contains banned or seriously harmful substances.
- **A one-paragraph summary** in everyday language, no jargon.
- **Each key ingredient**, tagged *safe / neutral / caution / dangerous*, with a sentence or two on what it is and why it's in there.
- **The main concerns** with the composition as a whole.
- **Who should avoid it, and who's fine** — the contraindications spelled out.
- **Notes specific to your profile**, when you've filled one in.

If the photo is unreadable — glare, angle, a label that turns out not to be an
ingredient list at all — it says so and tells you what to re-shoot, rather than
inventing a plausible-looking answer.

### How it works

A photo goes to Google's Gemini, guided by a system prompt that casts the model as
a nutritionist, toxicologist and cosmetic chemist at once, and constrained by a
JSON schema so the response is always the same shape. The scoring bands, the risk
labels and the verdict values are all fixed by that schema — the model fills in the
judgment, not the format. It reads labels in any language and answers in Russian.

Sharp edges were taken seriously: the model name and reasoning depth are
environment variables with automatic fallbacks if Google renames a model or
rejects a thinking level; photos are downscaled in the browser to ~0.5 MB before
upload so phone cameras don't blow past the request-size ceiling; and raw API
errors are translated into something a human can act on ("your free quota ran out,
wait a minute") instead of leaking a stack trace.

### Privacy

Your profile never leaves your phone except as part of a scan. It lives in
`localStorage` in your browser — there is no account, no database, no server-side
storage of anything. Nothing is retained between scans.

### The stack

No framework, no build step, no dependencies beyond the Gemini SDK. The entire
interface is one hand-written HTML file — a dark, thumb-sized layout that installs
to a phone home screen and behaves like a native app. The analysis logic is shared
verbatim between a plain Node server for local use and a Vercel serverless
function for deployment.

> Not medical advice. For anything serious about your health, see a doctor.
