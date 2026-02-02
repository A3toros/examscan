import SpeakWithSanta from './SpeakWithSanta'
import BecomeSanta from './BecomeSanta'
import GiveSantaRide from './GiveSantaRide'
import DestroyChristmas from './DestroyChristmas'

export const activities = [
  {
    slug: 'speak-with-santa',
    title: 'Speak with Santa',
    description: 'Tell Santa what you want for Christmas and become his friend elf!',
    component: SpeakWithSanta,
  },
  {
    slug: 'become-santa',
    title: 'Become Santa',
    description: 'Share what Christmas means to you and transform into Santa!',
    component: BecomeSanta,
  },
  {
    slug: 'give-santa-ride',
    title: 'Give Santa a Ride',
    description: 'Share why giving presents is important and ride with Santa!',
    component: GiveSantaRide,
  },
  {
    slug: 'destroy-christmas',
    title: 'Destroy Christmas',
    description: 'Share why people should not celebrate Christmas and become a Christmas destroyer!',
    component: DestroyChristmas,
  },
] as const

export type ActivityConfig = (typeof activities)[number]

