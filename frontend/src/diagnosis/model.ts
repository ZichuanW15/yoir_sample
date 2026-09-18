import { CounsellorProfile, Service } from '@/src/api/types';

/**
 * The Yoir Diagnosis: five questions that lead to a direction (the sixth step).
 * Question and option wording is the client's, word for word.
 */

export type QuestionId = 'now' | 'goal' | 'tried' | 'stuck' | 'barriers';

export interface Question {
  id: QuestionId;
  title: string;
  hint: string;
  multiple: boolean;
  options: { id: string; label: string }[];
}

export interface Answers {
  now: string;
  goal: string;
  tried: string[];
  stuck: string;
  barriers: string[];
}

export const questions: Question[] = [
  {
    id: 'now', title: 'Where are you now?', multiple: false,
    hint: 'Choose the one that best describes your situation today.',
    options: [
      { id: 'job', label: 'Looking for a job' },
      { id: 'change', label: 'Thinking about changing careers' },
      { id: 'study', label: 'Looking to upskill or study' },
      { id: 'returning', label: 'Returning to work' },
      { id: 'direction', label: 'Not sure what career direction to take' },
      { id: 'other', label: 'Something else' },
    ],
  },
  {
    id: 'goal', title: 'What are you trying to achieve?', multiple: false,
    hint: 'Pick your most immediate goal.',
    options: [
      { id: 'find_job', label: 'Find a job' },
      { id: 'more_interviews', label: 'Get more interviews' },
      { id: 'resume', label: 'Improve my resume/application' },
      { id: 'interview', label: 'Prepare for interviews' },
      { id: 'options', label: 'Understand my career options' },
      { id: 'course', label: 'Find the right course or study pathway' },
      { id: 'recognition', label: 'Get overseas qualifications/skills recognised' },
      { id: 'network', label: 'Build my professional network' },
      { id: 'linkedin', label: 'Improve my LinkedIn' },
      { id: 'other', label: 'Something else' },
    ],
  },
  {
    id: 'tried', title: 'What have you tried so far?', multiple: true,
    hint: 'Choose any that apply, or none if you are just starting.',
    options: [
      { id: 'applications', label: 'Job applications' },
      { id: 'resume', label: 'Resume/application changes' },
      { id: 'interview', label: 'Interview preparation' },
      { id: 'study', label: 'Study/course research' },
      { id: 'networking', label: 'Networking' },
      { id: 'linkedin', label: 'LinkedIn' },
      { id: 'recognition', label: 'Skills/qualification recognition' },
      { id: 'other', label: 'Other' },
    ],
  },
  {
    id: 'stuck', title: 'Where are you getting stuck?', multiple: false,
    hint: 'Pick the main challenge holding you back.',
    options: [
      { id: 'direction', label: 'Career direction' },
      { id: 'search', label: 'Job search' },
      { id: 'resume', label: 'Resume' },
      { id: 'cover_letter', label: 'Cover letter/application' },
      { id: 'ksc', label: 'Key Selection Criteria' },
      { id: 'interview', label: 'Interview' },
      { id: 'market', label: 'Australian job market' },
      { id: 'recognition', label: 'Overseas experience/qualification recognition' },
      { id: 'networking', label: 'Networking' },
      { id: 'linkedin', label: 'LinkedIn' },
      { id: 'study', label: 'Course/study choice' },
      { id: 'not_sure', label: 'Not sure' },
    ],
  },
  {
    id: 'barriers', title: 'Are there any barriers affecting your next step?', multiple: true,
    hint: 'Choose any that apply.',
    options: [
      { id: 'work_rights', label: 'Work rights' },
      { id: 'recognition', label: 'Qualification recognition' },
      { id: 'licensing', label: 'Registration/licensing' },
      { id: 'market', label: 'Understanding the Australian job market' },
      { id: 'local_network', label: 'Australian experience/network' },
      { id: 'other', label: 'Other' },
      { id: 'not_sure', label: 'Not sure' },
    ],
  },
];

type AreaId = 'direction' | 'search' | 'applications' | 'interview' | 'recognition' | 'network' | 'study';

interface Area {
  title: string;
  summary: string;
  steps: string[];
  /** Matched as word prefixes against what a Career Professional says they do. */
  keywords: string[];
  /** The "tried so far" answer that means the person has already worked on this. */
  tried: string[];
}

const areas: Record<AreaId, Area> = {
  direction: {
    title: 'Career direction',
    summary: 'Get clear on the roles that fit your skills, interests and circumstances before you put more time into applications.',
    steps: [
      'List the roles you have enjoyed and the skills you used in them.',
      'Shortlist two or three directions worth exploring.',
      'Talk them through with a Career Professional who can test the options with you.',
    ],
    keywords: ['career', 'strategy', 'direction', 'transition', 'plan'],
    tried: [],
  },
  search: {
    title: 'Job search strategy',
    summary: 'Turn your job search into a focused plan so the effort you put in leads to interviews.',
    steps: [
      'Choose a short list of target roles and employers.',
      'Set a weekly rhythm for applications, networking and follow-ups.',
      'Review what has and has not worked with a Career Professional.',
    ],
    keywords: ['job search', 'search', 'plan', 'applications', 'networking', 'follow'],
    tried: ['applications'],
  },
  applications: {
    title: 'Resume and applications',
    summary: 'Make your resume, cover letters and selection criteria responses show clearly why you fit the role.',
    steps: [
      'Tailor your resume to one target role at a time.',
      'Show results, not just duties, for each role you have held.',
      'Get detailed feedback on a real application before you send the next one.',
    ],
    keywords: ['resume', 'cover letter', 'application', 'selection criteria', 'recruiter'],
    tried: ['resume', 'applications'],
  },
  interview: {
    title: 'Interview skills',
    summary: 'Build confidence and clear, structured answers so your interviews turn into offers.',
    steps: [
      'Prepare five or six examples from your experience using the STAR method.',
      'Practise answering out loud, ideally in a mock interview.',
      'Ask for specific feedback on both what you say and how you say it.',
    ],
    keywords: ['interview', 'behavioural', 'mock', 'screening', 'confidence'],
    tried: ['interview'],
  },
  recognition: {
    title: 'Getting your experience recognised',
    summary: 'Make sure employers understand, and value, the qualifications and experience you bring from elsewhere.',
    steps: [
      'Check whether your occupation needs a skills assessment, registration or licence.',
      'Describe your experience in the role titles and terms local employers use.',
      'Get advice from a Career Professional who works with people moving countries or industries.',
    ],
    keywords: ['migrant', 'overseas', 'qualification', 'recognition', 'licensing'],
    tried: ['recognition'],
  },
  network: {
    title: 'Networking and LinkedIn',
    summary: 'Grow the professional network and online presence that lead to opportunities.',
    steps: [
      'Update your LinkedIn headline and About section for the roles you want.',
      'Reach out to two people a week who work in your target field.',
      'Have your profile reviewed for search and recruiter appeal.',
    ],
    keywords: ['linkedin', 'networking', 'profile', 'headline', 'brand'],
    tried: ['networking', 'linkedin'],
  },
  study: {
    title: 'Study and upskilling pathway',
    summary: 'Choose a course or pathway that leads to the work you want, not just to a qualification.',
    steps: [
      'Note the skills employers ask for in the roles you are aiming for.',
      'Compare courses on outcomes, time and cost.',
      'Talk to a Career Professional before you enrol.',
    ],
    keywords: ['study', 'course', 'upskill', 'career', 'plan'],
    tried: ['study'],
  },
};

const areaForStuck: Record<string, AreaId> = {
  direction: 'direction', search: 'search', resume: 'applications', cover_letter: 'applications',
  ksc: 'applications', interview: 'interview', market: 'search', recognition: 'recognition',
  networking: 'network', linkedin: 'network', study: 'study',
};
const areaForGoal: Record<string, AreaId> = {
  find_job: 'search', more_interviews: 'applications', resume: 'applications', interview: 'interview',
  options: 'direction', course: 'study', recognition: 'recognition', network: 'network', linkedin: 'network',
};
const areaForNow: Record<string, AreaId> = {
  job: 'search', change: 'direction', study: 'study', returning: 'search', direction: 'direction',
};

const barrierSteps: Record<string, string> = {
  work_rights: 'Confirm the work conditions of your visa, so you target roles you are eligible for.',
  recognition: 'Find out which body assesses qualifications in your field and start early, as it can take time.',
  licensing: 'Check whether your occupation needs registration or a licence where you want to work.',
  market: 'Learn how hiring works in your target industry and location.',
  local_network: 'Build local experience and contacts through volunteering, industry events or short contracts.',
};
/** What each barrier adds to the matching, alongside its own next step. */
const areaForBarrier: Record<string, AreaId> = {
  work_rights: 'recognition', recognition: 'recognition', licensing: 'recognition', market: 'search', local_network: 'network',
};

export interface Direction {
  area: string;
  summary: string;
  steps: string[];
  /** Keyword → weight, for ranking services. The main area outweighs everything else combined. */
  weights: Record<string, number>;
}

/** Step six: the main area to work on, and what to do next. */
export function directionFor(answers: Answers): Direction {
  // The main challenge decides; the goal, then the situation, stand in for "Not sure".
  const main = areaForStuck[answers.stuck] ?? areaForGoal[answers.goal] ?? areaForNow[answers.now] ?? 'direction';
  const area = areas[main];
  const weights: Record<string, number> = {};
  const add = (id: AreaId | undefined, weight: number) => {
    if (!id) return;
    for (const keyword of areas[id].keywords) weights[keyword] = Math.max(weights[keyword] ?? 0, weight);
  };
  add(areaForGoal[answers.goal], 1);
  for (const barrier of answers.barriers) add(areaForBarrier[barrier], 1);
  add(main, 10);

  const alreadyTried = area.tried.some((t) => answers.tried.includes(t));
  return {
    area: area.title,
    summary: alreadyTried
      ? `${area.summary} You have already put work into this, so expert feedback is the fastest way forward.`
      : area.summary,
    steps: [...area.steps, ...answers.barriers.flatMap((b) => barrierSteps[b] ?? []).slice(0, 2)],
    weights,
  };
}

/** A Career Professional with the services they offer. */
export interface Professional { profile: CounsellorProfile; services: Service[] }

function score({ profile, services }: Professional, weights: Record<string, number>): number {
  // What they say they do: their introduction, expertise and the services they sell.
  const text = [
    profile.introduction, ...profile.expertise, ...services.flatMap((s) => [s.title, s.description]),
  ].join(' ').toLowerCase();
  return Object.entries(weights).reduce(
    (total, [keyword, weight]) => total + (new RegExp(`\\b${keyword}`).test(text) ? weight : 0),
    0,
  );
}

/** Best match first; ties, and everyone when there is no direction, go to the better rated. */
export function rankProfessionals(
  professionals: Professional[], direction: Direction | null,
): { professional: Professional; match: boolean }[] {
  return professionals
    .map((professional) => ({ professional, points: direction ? score(professional, direction.weights) : 0 }))
    .sort((a, b) => b.points - a.points
      || (b.professional.profile.overallRating ?? 0) - (a.professional.profile.overallRating ?? 0))
    .map(({ professional, points }) => ({ professional, match: points > 0 }));
}
