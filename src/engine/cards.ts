import type { Card } from './types'

export const cards: Card[] = [
  { id: 'rocks', question: 'Collect Moon rocks outside?', go: 'Go: more science, a little danger', stay: 'Stay: safe, no science', science: 2, power: -4, air: 0, radiation: 6 },
  { id: 'dust', question: 'Brush the dust off the solar panels?', go: 'Go: a clean panel, a little science', stay: 'Stay: panels stay dusty', science: 1, power: -2, air: 0, radiation: 4 },
  { id: 'crater', question: 'Take photos of the nearby crater?', go: 'Go: new photos for scientists', stay: 'Stay: no photos today', science: 1, power: -2, air: 0, radiation: 5 },
  { id: 'ice', question: 'Dig for Moon ice?', go: 'Go: big science, uses power', stay: 'Stay: keep the power', science: 2, power: -5, air: 0, radiation: 6 },
  { id: 'rover', question: 'Drive the rover to a new spot?', go: 'Go: find new things, uses power', stay: 'Stay: rover rests', science: 2, power: -6, air: 0, radiation: 5 },
  { id: 'quake', question: 'Put out a Moonquake sensor?', go: 'Go: science, a longer walk', stay: 'Stay: no sensor today', science: 2, power: -3, air: 0, radiation: 7 },
  { id: 'earthrise', question: 'Step out to watch Earth rise?', go: 'Go: a little science, a lovely view', stay: 'Stay: watch from the window', science: 1, power: 0, air: 0, radiation: 2 },
  { id: 'soil', question: 'Test the Moon soil for the plants?', go: 'Go: science for the greenhouse', stay: 'Stay: no soil test', science: 1, power: -1, air: 0, radiation: 3 },
  { id: 'cave', question: 'Look inside a cave?', go: 'Go: the best science, the most danger', stay: 'Stay: leave the cave alone', science: 3, power: -4, air: -2, radiation: 8 },
  { id: 'antenna', question: 'Fix the antenna outside?', go: 'Go: a tidy antenna, a little science', stay: 'Stay: leave it as it is', science: 1, power: -3, air: 0, radiation: 4 },
]
