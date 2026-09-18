import { CounsellorProfile, Service } from '@/src/api/types';
import { Answers, directionFor, Professional, rankProfessionals } from '@/src/diagnosis/model';

const answers = (overrides: Partial<Answers>): Answers => ({
  now: 'job', goal: 'find_job', tried: [], stuck: 'interview', barriers: [], ...overrides,
});

const professional = (id: string, introduction: string, expertise: string[], overallRating: number, serviceTitle: string): Professional => ({
  profile: {
    id, displayName: id, photoUrl: null, linkedinUrl: '', introduction, background: '', experience: '',
    qualifications: [], expertise, languages: ['English'], baseLocation: null, defaultModality: 'online',
    verificationStatus: 'verified', overallRating, reviewCount: 10,
  } satisfies CounsellorProfile,
  services: [{ title: serviceTitle, description: '' } as Service],
});

const people = [
  professional('migrants', 'Helps skilled migrants into Australian roles.', ['Overseas qualifications'], 4.7, 'Market strategy'),
  professional('linkedin', 'Personal branding coach.', ['LinkedIn'], 4.9, 'Profile makeover'),
  professional('interview', 'Coach for graduates.', ['Behavioural questions'], 4.2, 'Interview confidence coaching'),
  professional('resume', 'Former recruiter.', ['Resume writing'], 4.5, 'Cover letter review'),
];
const order = (ranked: ReturnType<typeof rankProfessionals>) => ranked.map((r) => [r.professional.profile.id, r.match]);

describe('the Yoir Direction', () => {
  test('the main challenge decides the area to work on', () => {
    expect(directionFor(answers({ stuck: 'ksc' })).area).toBe('Resume and applications');
    expect(directionFor(answers({ stuck: 'interview' })).area).toBe('Interview skills');
  });

  test('"Not sure" falls back to the goal, then to the situation', () => {
    expect(directionFor(answers({ stuck: 'not_sure', goal: 'linkedin' })).area).toBe('Networking and LinkedIn');
    expect(directionFor(answers({ stuck: 'not_sure', goal: 'other', now: 'study' })).area).toBe('Study and upskilling pathway');
    expect(directionFor(answers({ stuck: 'not_sure', goal: 'other', now: 'other' })).area).toBe('Career direction');
  });

  test('barriers add their own next steps, and what they tried changes the advice', () => {
    const direction = directionFor(answers({ tried: ['interview'], barriers: ['work_rights', 'not_sure'] }));
    expect(direction.steps).toHaveLength(4);
    expect(direction.steps[3]).toMatch(/visa/);
    expect(direction.summary).toMatch(/already put work into this/);
    expect(directionFor(answers({})).summary).not.toMatch(/already/);
  });
});

describe('best matches', () => {
  test('put the Career Professionals who fit the direction first', () => {
    expect(order(rankProfessionals(people, directionFor(answers({ stuck: 'interview' }))))).toEqual([
      ['interview', true], ['linkedin', false], ['migrants', false], ['resume', false],
    ]);
  });

  test('a barrier brings in related people without outranking the main area', () => {
    const ranked = rankProfessionals(people, directionFor(answers({ stuck: 'interview', barriers: ['work_rights'] })));
    expect(order(ranked).slice(0, 2)).toEqual([['interview', true], ['migrants', true]]);
  });

  test('without a diagnosis, rank by rating and claim no match', () => {
    expect(order(rankProfessionals(people, null))).toEqual([
      ['linkedin', false], ['migrants', false], ['resume', false], ['interview', false],
    ]);
  });
});
