import { describe, it, expect } from 'vitest';

import { descriptorFor, KIND_DESCRIPTORS } from '../content-kinds.ts';
import { emptyRecord, recordFromJson, recordToPayload, validateRecord, recordLabel } from '../content-values.ts';
import { buildSample } from '../schema-template.ts';
import type { KindDescriptor } from '../field-types.ts';

const quiz = descriptorFor('quiz_deck') as KindDescriptor;
const word = descriptorFor('word') as KindDescriptor;
const investigation = descriptorFor('investigation_case') as KindDescriptor;

describe('emptyRecord', () => {
  it('seeds every field, defaulting numbers/selects', () => {
    const rec = emptyRecord(word);
    expect(rec.word).toBe('');
    expect(rec.difficulty).toBe('1'); // default 1
    expect(rec.aliases).toEqual([]);
    expect(rec.tags).toEqual([]);
  });
});

describe('recordFromJson → validate → payload round-trip', () => {
  it('accepts a valid quiz deck and serialises numbers as numbers', () => {
    const json = {
      key: 'gen-1',
      title: 'General Knowledge',
      category: 'general',
      ratingTier: 'family',
      tags: [],
      questions: [{ prompt: 'Capital of Nigeria?', options: ['Abuja', 'Lagos', 'Kano', 'Jos'], answerIdx: 0, difficulty: 2 }],
    };
    const rec = recordFromJson(quiz, json);
    expect(validateRecord(quiz, rec)).toEqual({});
    const payload = recordToPayload(quiz, rec);
    expect(payload.title).toBe('General Knowledge');
    const questions = payload.questions as { answerIdx: number; difficulty: number; options: string[] }[];
    expect(questions[0]?.answerIdx).toBe(0); // number, not string
    expect(questions[0]?.difficulty).toBe(2);
    expect(questions[0]?.options).toHaveLength(4);
  });

  it('flags a quiz with the wrong number of options and a missing required field', () => {
    const json = {
      title: 'Bad',
      ratingTier: 'family',
      questions: [{ prompt: 'Q', options: ['a', 'b'], answerIdx: 0 }],
    };
    const rec = recordFromJson(quiz, json);
    const errors = validateRecord(quiz, rec);
    expect(errors.key).toBe('Required.');
    expect(errors.category).toBe('Required.');
    expect(errors['questions.0.options']).toBe('Exactly 4.');
  });

  it('requires a rating tier (a missing tier is a filter hole)', () => {
    const rec = recordFromJson(word, { word: 'aba', category: 'places', startsWith: 'a' });
    const errors = validateRecord(word, rec);
    expect(errors.ratingTier).toBe('Required.');
  });

  it('enforces single-character startsWith', () => {
    const rec = recordFromJson(word, { word: 'aba', category: 'places', startsWith: 'ab', ratingTier: 'family' });
    expect(validateRecord(word, rec).startsWith).toBe('Max 1 character.');
  });

  it('omits blank optional fields from the payload but keeps empty arrays', () => {
    const rec = recordFromJson(word, { word: 'aba', category: 'places', startsWith: 'a', ratingTier: 'family' });
    const payload = recordToPayload(word, rec);
    expect(payload.aliases).toEqual([]);
    expect('playersMaxOverride' in payload).toBe(false);
  });

  it('enforces minItems on object arrays (investigation needs 2 suspects)', () => {
    const rec = recordFromJson(investigation, {
      key: 'case-1',
      title: 'The Missing Jollof',
      brief: 'A pot vanished.',
      suspects: [{ id: 's1', name: 'Ada', profile: 'cook' }],
      evidence: [{ id: 'e1', label: 'spoon', detail: 'still warm' }],
      solutionSuspectId: 's1',
      ratingTier: 'family',
    });
    expect(validateRecord(investigation, rec).suspects).toBe('At least 2.');
  });
});

describe('self-reference + uniqueness (investigation)', () => {
  const validCase = {
    key: 'case-1',
    title: 'The Missing Jollof',
    brief: 'A pot vanished.',
    suspects: [
      { id: 's1', name: 'Ada', profile: 'cook' },
      { id: 's2', name: 'Tunde', profile: 'guest' },
    ],
    evidence: [{ id: 'e1', label: 'spoon', detail: 'still warm' }],
    solutionSuspectId: 's2',
    ratingTier: 'family',
  };

  it('accepts a guilty id that matches a suspect', () => {
    const rec = recordFromJson(investigation, validCase);
    expect(validateRecord(investigation, rec).solutionSuspectId).toBeUndefined();
  });

  it('rejects a guilty id that matches no suspect, and lists the valid ids', () => {
    const rec = recordFromJson(investigation, { ...validCase, solutionSuspectId: 's9' });
    const err = validateRecord(investigation, rec).solutionSuspectId;
    expect(err).toContain('suspects[].id');
    expect(err).toContain('s1, s2');
  });

  it('flags duplicate suspect ids', () => {
    const rec = recordFromJson(investigation, {
      ...validCase,
      suspects: [
        { id: 's1', name: 'Ada', profile: 'cook' },
        { id: 's1', name: 'Tunde', profile: 'guest' },
      ],
      solutionSuspectId: 's1',
    });
    const errors = validateRecord(investigation, rec);
    expect(errors['suspects.0.id']).toBe('Duplicate — must be unique.');
    expect(errors['suspects.1.id']).toBe('Duplicate — must be unique.');
  });
});

describe('buildSample produces a valid, self-consistent item for every kind', () => {
  it.each(KIND_DESCRIPTORS.map((d) => [d.kind, d] as const))('%s sample validates clean', (_kind, desc) => {
    const sample = buildSample(desc);
    const rec = recordFromJson(desc, sample);
    expect(validateRecord(desc, rec)).toEqual({});
  });
});

describe('recordLabel', () => {
  it('uses the kind titleField', () => {
    const rec = recordFromJson(quiz, { title: 'My Deck' });
    expect(recordLabel(quiz, rec)).toBe('My Deck');
  });
  it('falls back when the title field is blank', () => {
    const rec = recordFromJson(word, { word: 'banana' });
    expect(recordLabel(word, rec)).toBe('banana');
  });
});
