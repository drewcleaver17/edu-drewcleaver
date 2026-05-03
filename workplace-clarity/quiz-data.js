// quiz-data.js
// Questions, answer choices, and how each answer feeds the six scores.
//
// Score dimensions:
//   payClarity         (0-100, HIGH = good)
//   roleClarity        (0-100, HIGH = good)
//   unpaidWork         (0-100, HIGH = concern)
//   classification     (0-100, HIGH = concern)
//   retaliation        (0-100, HIGH = concern)
//   collectiveReadiness(0-100, HIGH = open to collective action)
//
// Each Likert question has 5 answer choices. Each choice contributes to one
// or more dimensions. We accumulate weighted points and a max-possible total
// per dimension, then normalize to 0-100 at the end.
//
// Convention for Likert weights:
//   For "good" dimensions (payClarity, roleClarity), agreeing with a positive
//   statement adds points (5 = agree strongly = +4).
//   For "concern" dimensions, agreeing with a negative statement adds points.
//   Each question is mapped explicitly so there's no ambiguity.

const LIKERT = [
  { value: 1, label: "Strongly disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Unsure / mixed" },
  { value: 4, label: "Agree" },
  { value: 5, label: "Strongly agree" }
];

// Helper: positive Likert (agreeing = good for clarity)
// score = (value - 1), max = 4
function positive(dim) {
  return { type: "likert", weights: { [dim]: { positive: true, max: 4 } } };
}

// Helper: negative Likert (agreeing = concern)
function negative(dim) {
  return { type: "likert", weights: { [dim]: { positive: false, max: 4 } } };
}

// Helper: agreeing with this statement INCREASES the concern dimension.
// e.g. "I fear retaliation" — strong agree adds concern.
// (Same as `positive` mathematically: agreeing adds raw points.)
function concernIfAgree(dim) {
  return { type: "likert", weights: { [dim]: { positive: true, max: 4 } } };
}

// Helper: disagreeing with this statement increases the concern dimension.
// e.g. "I trust management to fix problems fairly" — strong disagree adds concern.
function concernIfDisagree(dim) {
  return { type: "likert", weights: { [dim]: { positive: false, max: 4 } } };
}

// Helper: dual — agreeing raises a clarity dim AND reduces a concern dim
// (so disagreeing raises the concern dim).
// e.g. "I am paid for meetings": agree -> +payClarity; disagree -> +unpaidWork concern.
function dual(positiveDim, negativeDim) {
  return {
    type: "likert",
    weights: {
      [positiveDim]: { positive: true, max: 4 },
      [negativeDim]: { positive: false, max: 4 }
    }
  };
}

const QUIZ = {
  sections: [
    {
      id: "role",
      title: "Role clarity",
      blurb: "What you were told the job is — and whether that matches reality.",
      questions: [
        {
          id: "role-1",
          prompt: "I clearly understand whether I am an employee, contractor, trainee, volunteer, partner, or applicant.",
          ...positive("roleClarity")
        },
        {
          id: "role-2",
          prompt: "My role and title were clearly explained to me.",
          ...positive("roleClarity")
        },
        {
          id: "role-3",
          prompt: "My actual day-to-day duties match what I was told the job would be.",
          ...positive("roleClarity")
        },
        {
          id: "role-4",
          prompt: "I have written terms (offer letter, contract, handbook, agreement) describing my role.",
          ...positive("roleClarity")
        }
      ]
    },
    {
      id: "pay",
      title: "Pay clarity",
      blurb: "Whether you understand exactly how you get paid.",
      questions: [
        {
          id: "pay-1",
          prompt: "I understand exactly how I am paid (hourly, salary, commission, tips, piece rate, etc.).",
          ...positive("payClarity")
        },
        {
          id: "pay-2",
          prompt: "I have written pay terms I can refer back to.",
          ...positive("payClarity")
        },
        {
          id: "pay-3",
          prompt: "I understand when commissions, bonuses, or other variable pay are considered earned.",
          ...positive("payClarity")
        },
        {
          id: "pay-4",
          prompt: "I understand when commissions, bonuses, or variable pay are actually paid out.",
          ...positive("payClarity")
        },
        {
          id: "pay-5",
          prompt: "I am paid for required meetings, training, admin work, route planning, travel, and other non-customer-facing tasks.",
          ...dual("payClarity", "unpaidWork")
        },
        {
          id: "pay-6",
          prompt: "I understand the rules for reimbursing my work expenses (mileage, supplies, phone, etc.).",
          ...positive("payClarity")
        }
      ]
    },
    {
      id: "work",
      title: "Work performed",
      blurb: "What you actually do in a typical week.",
      questions: [
        {
          id: "work-1",
          prompt: "I attend meetings or trainings as part of my job.",
          ...concernIfAgree("unpaidWork")
        },
        {
          id: "work-2",
          prompt: "I perform admin work, CRM updates, route planning, vendor or customer coordination, management support, or operations work.",
          ...concernIfAgree("unpaidWork")
        },
        {
          id: "work-3",
          prompt: "I use company tools, systems, scripts, uniforms, price sheets, or processes.",
          ...concernIfAgree("classification")
        },
        {
          id: "work-4",
          prompt: "My work benefits the company even when it does not directly produce a sale.",
          ...concernIfAgree("unpaidWork")
        },
        {
          id: "work-5",
          prompt: "I am expected to be available at certain times or days.",
          ...concernIfAgree("classification")
        }
      ]
    },
    {
      id: "control",
      title: "Control & classification signals",
      blurb: "Some questions about who decides how the work happens. These are factors agencies look at when figuring out if someone is an employee or a contractor — but they don't decide the answer on their own.",
      questions: [
        {
          id: "ctrl-1",
          prompt: "The company controls when, where, or how I do my work.",
          ...concernIfAgree("classification")
        },
        {
          id: "ctrl-2",
          prompt: "I was trained by the company.",
          ...concernIfAgree("classification")
        },
        {
          id: "ctrl-3",
          prompt: "I report to a supervisor or manager regularly.",
          ...concernIfAgree("classification")
        },
        {
          id: "ctrl-4",
          prompt: "I am disciplined, corrected, or directed by someone at the company.",
          ...concernIfAgree("classification")
        },
        {
          id: "ctrl-5",
          // Reverse-coded: agreeing means MORE contractor-like, REDUCES classification concern
          prompt: "I can negotiate my own prices or terms with customers.",
          ...concernIfDisagree("classification")
        },
        {
          id: "ctrl-6",
          prompt: "I have a meaningful opportunity for profit or loss based on my own decisions.",
          ...concernIfDisagree("classification")
        },
        {
          id: "ctrl-7",
          prompt: "I work for multiple clients or customers independently.",
          ...concernIfDisagree("classification")
        },
        {
          id: "ctrl-8",
          prompt: "I provide my own tools and run my own independent business.",
          ...concernIfDisagree("classification")
        }
      ]
    },
    {
      id: "safety",
      title: "Safety, retaliation, and trust",
      blurb: "How safe it feels to ask questions or raise concerns.",
      questions: [
        {
          id: "safe-1",
          prompt: "I feel safe asking questions about pay.",
          ...dual("payClarity", "retaliation")
        },
        {
          id: "safe-2",
          prompt: "I feel safe discussing wages or working conditions with coworkers.",
          ...concernIfDisagree("retaliation")
        },
        {
          id: "safe-3",
          prompt: "I fear retaliation if I raise concerns.",
          ...concernIfAgree("retaliation")
        },
        {
          id: "safe-4",
          prompt: "I trust management to fix problems fairly.",
          ...concernIfDisagree("retaliation")
        },
        {
          id: "safe-5",
          prompt: "I know who to contact at work about pay concerns.",
          ...positive("payClarity")
        },
        {
          id: "safe-6",
          prompt: "Workers seem to discuss pay or fairness privately because they don't feel heard.",
          ...concernIfAgree("retaliation")
        }
      ]
    },
    {
      id: "collective",
      title: "Shared concerns",
      blurb: "Whether your situation feels individual or shared.",
      questions: [
        {
          id: "col-1",
          prompt: "I think other workers may be experiencing similar confusion or concerns.",
          ...positive("collectiveReadiness")
        },
        {
          id: "col-2",
          prompt: "I would consider asking my employer for written clarification about pay or role.",
          ...positive("collectiveReadiness")
        },
        {
          id: "col-3",
          prompt: "I would consider talking with trusted coworkers about shared concerns.",
          ...positive("collectiveReadiness")
        },
        {
          id: "col-4",
          prompt: "I would consider contacting an attorney, government labor agency, worker center, or union organizer if issues continue.",
          ...positive("collectiveReadiness")
        }
      ]
    },
    {
      id: "narrative",
      title: "Optional notes",
      blurb: "Skip any of these. They stay on your device. They're used to personalize the AI prompt at the end.",
      questions: [
        {
          id: "narr-1",
          type: "text",
          prompt: "What feels unclear or unfair right now?",
          placeholder: "A few sentences is plenty. Skip if you'd rather not."
        },
        {
          id: "narr-2",
          type: "text",
          prompt: "What work have you done that may not have been paid?",
          placeholder: "e.g. unpaid training, off-the-clock prep, unpaid commissions, required meetings…"
        },
        {
          id: "narr-3",
          type: "text",
          prompt: "What outcome would feel fair?",
          placeholder: "e.g. clear written pay terms, back pay for X, a different role, just clarity…"
        },
        {
          id: "narr-4",
          type: "text",
          prompt: "What are you afraid might happen if you speak up?",
          placeholder: "Optional. Naming the fear sometimes helps shrink it."
        },
        {
          id: "employer-name",
          type: "text",
          prompt: "Employer or industry (optional)",
          placeholder: "Totally optional. Leave blank if you'd rather not. Your answers stay on your device either way."
        }
      ]
    }
  ],
  likert: LIKERT
};

// Educational explainers shown on the results page based on which scores are highest
const EXPLAINERS = {
  payClarity: {
    title: "Pay clarity",
    low: "When pay terms aren't written down or aren't clear, it's harder to know if you've actually been paid what was promised. Workers sometimes assume they're getting one thing and discover later the math worked out differently. Asking for written clarification is reasonable and usually not a big deal — and if it IS a big deal, that's information too."
  },
  roleClarity: {
    title: "Role clarity",
    low: "Job titles and labels (\"contractor,\" \"trainee,\" \"partner,\" \"manager\") describe what someone CALLED the job. They don't always describe what the job actually IS. When the duties drift far from the description — especially when you start doing work nobody mentioned upfront — that gap is worth tracking."
  },
  unpaidWork: {
    title: "Unpaid or under-paid work",
    high: "Common patterns include: unpaid training, unpaid required meetings, off-the-clock prep, unpaid admin or CRM work, unpaid commissions, illegal deductions, unpaid travel between job sites, and unpaid work expenses where the law or your contract requires reimbursement. Wage and hour rules vary by state and by whether you're an employee or a contractor — but writing down what you did, when, and who asked is useful no matter what."
  },
  classification: {
    title: "Employee-like signals (vs. contractor)",
    high: "Your answers describe a fairly employee-like working relationship: training, supervision, set hours, company tools and processes, limited ability to negotiate prices or serve other clients independently. If you're already classified and paid as an employee (W-2), this is just describing your job — nothing to flag. But if you're labeled as an \"independent contractor,\" \"1099,\" \"partner,\" or \"freelancer\" and your answers look like this, it's worth a conversation with someone qualified. Government agencies look at the actual relationship, not the label, when they decide who's an employee."
  },
  retaliation: {
    title: "Retaliation and safety",
    high: "Many private-sector workers in the US generally have the right to discuss wages, benefits, and working conditions with coworkers — that's protected by federal labor law in a lot of situations, though not all. Retaliation for protected activity is generally illegal, but \"generally\" is doing a lot of work in that sentence and the specifics matter. If you're afraid, slow down, document calmly, don't make threats, and talk to someone qualified before escalating."
  },
  collectiveReadiness: {
    title: "Shared concerns",
    high: "If multiple workers are running into the same confusion, that's a different situation than one person being unsure. Talking with coworkers about shared workplace concerns is often (not always) protected. A group request for written clarity is calmer and harder to retaliate against than one person raising it alone — but it's still worth getting qualified guidance before doing anything organized."
  }
};

const NEXT_STEPS_POOL = {
  always: [
    "Preserve what you already have. Don't delete texts, emails, schedules, paystubs, or screenshots — even if you're frustrated. Back them up to a personal device or personal email.",
    "Start a private time log on your own device. Note what you did, when, who asked, and roughly how long it took. Keep it factual."
  ],
  payClarity: [
    "Write down what you BELIEVE the pay terms are, in your own words. If you can, ask in writing (text or email) for confirmation — something like \"Just want to make sure I have this right: I'm paid X for Y, and commissions are earned when Z. Can you confirm?\""
  ],
  unpaidWork: [
    "List the specific work you've done that you're unsure was paid for. Dates, rough hours, what was done, who asked.",
    "Save anything that shows the work happened: calendar invites, Slack messages, CRM logs, photos, route history."
  ],
  classification: [
    "Note the facts on both sides: ways the company controls or directs your work, and ways you operate independently. The honest version, not the flattering one for either side."
  ],
  retaliation: [
    "Move slowly. Avoid public accusations, threats, or anything that could be framed as misconduct. Get qualified guidance before escalating.",
    "If you fear physical danger, that changes the situation — contact local authorities or a domestic/workplace violence resource."
  ],
  collectiveReadiness: [
    "If trusted coworkers seem to share your concerns, a group request for written clarification is usually calmer than going alone. Talk privately and avoid company channels for those conversations."
  ],
  closing: [
    "When you're ready, consider talking with a qualified employment attorney, your state or federal labor agency, a local worker center, or a union organizer. Many offer free initial consultations. None of them require you to commit to anything by asking questions."
  ]
};

const DOCUMENTATION_CHECKLIST = [
  "Texts and emails about pay, hours, schedule, or duties",
  "Call logs (dates and rough times, not recordings)",
  "Calendar events and meeting invites",
  "A time log of hours worked, by day",
  "Tasks performed and who requested them",
  "Pay promises (verbal or written) and when they were made",
  "Commission, bonus, or tip terms",
  "Screenshots of relevant chats, schedules, or systems",
  "Paystubs and any deductions",
  "Posted or assigned schedules",
  "Receipts for any work expenses you paid for",
  "Mileage or location history, if your work involves travel",
  "Names of witnesses, if appropriate (and only what you'd be willing to share with an attorney or agency)"
];

// Export to global scope (no module bundler — this is plain script tag land)
window.QUIZ_DATA = {
  QUIZ,
  EXPLAINERS,
  NEXT_STEPS_POOL,
  DOCUMENTATION_CHECKLIST,
  LIKERT
};
