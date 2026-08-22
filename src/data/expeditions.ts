export interface Expedition {
  slug: string
  name: string
  durationHours: number
  difficulty: number
  rewardsValue: number
  rewardsAmount: number
}

export const EXPEDITIONS: Expedition[] = [
  { slug: 'lost-shrine', name: 'Lost Shrine', durationHours: 30, difficulty: 10, rewardsValue: 10, rewardsAmount: 10 },
  { slug: 'tousland', name: 'Tousland', durationHours: 12, difficulty: 4, rewardsValue: 5, rewardsAmount: 5 },
  { slug: 'valhalla-trail', name: 'Valhalla Trail', durationHours: 18, difficulty: 8, rewardsValue: 7, rewardsAmount: 8 },
  { slug: 'dark-valleys', name: 'Dark Valleys', durationHours: 24, difficulty: 7, rewardsValue: 8, rewardsAmount: 9 },
  { slug: 'beach-walk', name: 'Beach Walk', durationHours: 24, difficulty: 8, rewardsValue: 9, rewardsAmount: 6 },
  { slug: 'deep-forest', name: 'Deep Forest', durationHours: 3, difficulty: 2, rewardsValue: 2, rewardsAmount: 4 },
]
