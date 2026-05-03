# edu.drewcleaver.com

Public, worker-first educational tools.

The first tool is the **Workplace Clarity Quiz** — a private, browser-only quiz that helps workers find language for what feels off at work, learn basic labor-rights concepts, and leave with a copy/paste AI prompt for deeper private thinking.

> **Educational only. Not legal advice.**

---

## Live site

https://edu.drewcleaver.com/workplace-clarity/

## Stack

- Pure static HTML / CSS / JS
- No build step, no dependencies, no backend
- Hosted on GitHub Pages with a custom domain (`CNAME` file in repo root)
- All quiz data is processed in the user's browser. Nothing is sent anywhere. `localStorage` is used only to preserve in-progress answers on the user's own device.

## File layout

```
.
├── CNAME                          # GitHub Pages custom domain
├── .nojekyll                      # disable Jekyll processing
├── index.html                     # root → redirects to /workplace-clarity/
├── README.md
└── workplace-clarity/
    ├── index.html                 # quiz page (intro / quiz / results screens)
    ├── styles.css                 # all styles
    ├── quiz-data.js               # questions, scoring weights, explainers, copy
    └── quiz.js                    # rendering, scoring, AI prompt generation
```

## Editing content

- **Change quiz questions or copy:** edit `workplace-clarity/quiz-data.js`. Each question has a `prompt` and a scoring weight that ties it to one or more dimensions. The dimensions are: `payClarity`, `roleClarity`, `unpaidWork`, `classification`, `retaliation`, `collectiveReadiness`.
- **Change explainer text on the results page:** edit the `EXPLAINERS` object in `quiz-data.js`.
- **Change the next-steps language:** edit the `NEXT_STEPS_POOL` object in `quiz-data.js`.
- **Change the documentation checklist:** edit the `DOCUMENTATION_CHECKLIST` array in `quiz-data.js`.
- **Change the AI prompt template:** edit `generateAIPrompt()` in `quiz.js`.
- **Change visual design:** edit `workplace-clarity/styles.css`. Colors live in `:root` CSS variables at the top.

## Deploy

GitHub Pages deploys automatically from the `main` branch. Push to `main` and the site updates in ~1–2 minutes.

```bash
git add .
git commit -m "Update workplace clarity quiz"
git push origin main
```

## Local preview

Open `workplace-clarity/index.html` directly in a browser, or run a one-line local server:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000/workplace-clarity/
```

## Ethics

This tool is built to give workers clarity, language, and courage — not to escalate them into action they don't want or aren't ready for. It does not collect or transmit personal data, does not name employers in its public copy, and explicitly avoids legal-advice claims, threats, accusations, or pressure to organize or sue.

If you find a way to make it more honest, calmer, or more useful — open an issue or a PR.

---

Built by Drew Cleaver. MIT licensed.
