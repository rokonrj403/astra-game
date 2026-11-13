import type { Card, CrewName, Option } from './types'

type Effects = Partial<Omit<Option, 'label'>>

const opt = (label: string, fx: Effects = {}): Option => ({
  label,
  science: fx.science ?? 0,
  power: fx.power ?? 0,
  air: fx.air ?? 0,
  radiation: fx.radiation ?? 0,
  food: fx.food ?? 0,
  ...(fx.carry ? { carry: fx.carry } : {}),
  ...(fx.slowWalk ? { slowWalk: true } : {}),
  ...(fx.slowPlants ? { slowPlants: true } : {}),
  ...(fx.failChance ? { failChance: fx.failChance } : {}),
})

const card = (id: string, question: string, who: CrewName[], a: Option, b: Option, needsEarth = false): Card => ({
  id,
  question,
  who,
  a,
  b,
  ...(needsEarth ? { needsEarth: true } : {}),
})

/**
 * The daily surprise deck: one situation a day, two choices. Each choice costs one thing to save another, so neither wins every time.
 * One block costs 3 power. "Tomorrow" effects land the next morning. Every line is 10 simple words or fewer.
 */
export const cards: Card[] = [
  card('dust', 'Dust covers the solar panels.', ['kofi'], opt('Brush them. It costs a block now.', { power: -3, carry: { power: 8 } }), opt('Ignore it. Less sun tomorrow.', { carry: { power: -4 } })),
  card('cough', 'Leo has a cough.', ['leo'], opt('Rest. The air machine works harder.', { air: 18, power: -6 }), opt('Keep working. Walks go slower.', { slowWalk: true })),
  card('pump', 'The air pump squeaks.', ['mei'], opt('Fix it now. It costs power.', { power: -4 }), opt('Wait. It may break tomorrow.', { failChance: 0.5 })),
  card('supply', 'A supply box landed nearby.', ['safia'], opt('Fetch it on foot. Some radiation.', { food: 14, air: 8, radiation: 5 }), opt('Leave it. Stay safe.')),
  card('earth', 'Earth is bright in the sky.', ['mei'], opt('Send a photo. It uses a radio block.', { science: 2, power: -3 }), opt('Skip the photo.'), true),
  card('cold', 'The night is very cold.', ['kofi'], opt('Heat the base. It costs power.', { power: -6 }), opt('Wear coats. Plants grow slower.', { slowPlants: true })),
  card('hatch', 'The hatch is stuck.', ['leo'], opt('Force it. A little air leaks.', { air: -5 }), opt('Mend it. It costs a block.', { power: -3 })),
  card('rock', 'Mei finds a shiny rock.', ['mei'], opt('Dig it up now. Some radiation.', { science: 3, radiation: 4 }), opt('Mark it. Dig it up tomorrow.', { carry: { science: 1 } })),
  card('lamp', 'A lamp flickers.', ['kofi'], opt('Swap the battery. It costs power.', { power: -8 }), opt('Live with dim light. Walks go slower.', { slowWalk: true })),
  card('birthday', 'It is Safia’s birthday.', ['safia'], opt('Make a treat. The crew smiles.', { science: 1, food: -3, power: -3 }), opt('Skip the party.')),
]
