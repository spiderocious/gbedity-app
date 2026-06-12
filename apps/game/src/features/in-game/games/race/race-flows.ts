import { makeRaceFlow } from './race-flow.tsx';

// Concrete race-by-closeness flows, each built from the shared factory with its prompt + action.

export const ScrambledWordFlow = makeRaceFlow({
  gameId: 'scrambled_word',
  promptField: 'scrambled',
  promptLabel: 'Unscramble',
  actionType: 'scrambled_word.guess',
  mono: true,
  placeholder: 'Type the word…',
  fallbackTitle: 'Scrambled Word',
});

export const DefinitionRaceFlow = makeRaceFlow({
  gameId: 'definition_race',
  promptField: 'definition',
  promptLabel: 'Name the word being defined',
  actionType: 'definition_race.guess',
  placeholder: 'Type the word…',
  fallbackTitle: 'Definition Race',
});

export const SynonymsFlow = makeRaceFlow({
  gameId: 'synonyms',
  promptField: 'prompt',
  promptLabel: 'Type a synonym of',
  actionType: 'synonyms.submit',
  placeholder: 'A word that means the same…',
  fallbackTitle: 'Synonyms',
});

export const AntonymsFlow = makeRaceFlow({
  gameId: 'antonyms',
  promptField: 'prompt',
  promptLabel: 'Type an antonym of',
  actionType: 'antonyms.submit',
  placeholder: 'A word that means the opposite…',
  fallbackTitle: 'Antonyms',
});
