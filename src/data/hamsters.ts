export interface Hamster {
  slug: string
  name: string
  stats: { health: number; strength: number; luck: number }
  survivalAbilityBonus: number
  abilitiesText: string[]
  ultimateText: string | null
  generation: 1 | 2 | 3
  levelCount: number
  imageUrl: (level: number) => string | null
}

// Imagens baixadas uma única vez para public/hamsters/, todas da mesma fonte
// (ariel-ruiz.github.io), pra manter estilo visual consistente entre os hamsters.
const local = (fileName: string | null) => () => (fileName ? `/hamsters/${fileName}` : null)

export const HAMSTERS: Hamster[] = [
  { slug: 'cowham', name: 'Cowham', stats: { health: 40, strength: 30, luck: 40 }, survivalAbilityBonus: 0, abilitiesText: ['10% Experiência'], ultimateText: null, generation: 1, levelCount: 6, imageUrl: local('cowham.gif') },
  { slug: 'guile', name: 'Guile', stats: { health: 50, strength: 30, luck: 20 }, survivalAbilityBonus: 5, abilitiesText: ['5% Sobrevivência'], ultimateText: null, generation: 1, levelCount: 6, imageUrl: local('guile.gif') },
  { slug: 'big-daddy', name: 'Big Daddy', stats: { health: 50, strength: 90, luck: 50 }, survivalAbilityBonus: 0, abilitiesText: ['-50% Descanso'], ultimateText: null, generation: 1, levelCount: 6, imageUrl: local('big-daddy.gif') },
  { slug: 'the-dracula', name: 'The Dracula', stats: { health: 10, strength: 50, luck: 90 }, survivalAbilityBonus: 0, abilitiesText: ['30% Experiência'], ultimateText: null, generation: 1, levelCount: 6, imageUrl: local('the-dracula.gif') },
  { slug: 'the-hamster', name: 'The Hamster', stats: { health: 20, strength: 10, luck: 20 }, survivalAbilityBonus: 0, abilitiesText: [], ultimateText: null, generation: 1, levelCount: 6, imageUrl: local('the-hamster.gif') },
  { slug: 'naughty-claus', name: 'Naughty Claus', stats: { health: 85, strength: 45, luck: 55 }, survivalAbilityBonus: 10, abilitiesText: ['10% Sobrevivência'], ultimateText: null, generation: 1, levelCount: 6, imageUrl: local('naughty-claus.gif') },
  { slug: 'uncle', name: 'Uncle', stats: { health: 85, strength: 85, luck: 30 }, survivalAbilityBonus: 0, abilitiesText: ['50% Recompensas Extras'], ultimateText: null, generation: 1, levelCount: 6, imageUrl: local('uncle.gif') },
  { slug: 'birthday-bob', name: 'Birthday Bob', stats: { health: 30, strength: 30, luck: 10 }, survivalAbilityBonus: 0, abilitiesText: ['-4% Descanso'], ultimateText: null, generation: 1, levelCount: 6, imageUrl: local('birthday-bob.gif') },
  { slug: 'valkirita', name: 'Valkirita', stats: { health: 90, strength: 90, luck: 25 }, survivalAbilityBonus: 0, abilitiesText: ['-50% Tempo de Expedição'], ultimateText: null, generation: 1, levelCount: 6, imageUrl: local('valkirita.gif') },
  { slug: 'banjo-walker', name: 'Banjo Walker', stats: { health: 65, strength: 30, luck: 80 }, survivalAbilityBonus: 0, abilitiesText: ['30% Experiência'], ultimateText: null, generation: 1, levelCount: 6, imageUrl: local('banjo-walker.gif') },
  { slug: 'dusty-mcuncle', name: 'Dusty McUncle', stats: { health: 80, strength: 80, luck: 40 }, survivalAbilityBonus: 0, abilitiesText: ['40% Recompensas Extras', '25% Voltar ao trabalho'], ultimateText: null, generation: 1, levelCount: 6, imageUrl: local('dusty-mcuncle.gif') },
  { slug: 'mamita', name: 'Mamita', stats: { health: 85, strength: 30, luck: 85 }, survivalAbilityBonus: 0, abilitiesText: ['-25% Descanso', '50% Experiência', '150%/20% Influencer'], ultimateText: null, generation: 1, levelCount: 6, imageUrl: local('mamita.gif') },
  { slug: 'mr-jack', name: 'Mr. Jack', stats: { health: 25, strength: 25, luck: 15 }, survivalAbilityBonus: 0, abilitiesText: [], ultimateText: null, generation: 1, levelCount: 1, imageUrl: local('mr-jack.gif') },
  { slug: 'plague-dancer', name: 'Plague Dancer', stats: { health: 25, strength: 90, luck: 80 }, survivalAbilityBonus: 15, abilitiesText: ['15% Sobrevivência', '-40% Descanso'], ultimateText: 'x3-5 baús se sobreviver', generation: 2, levelCount: 6, imageUrl: local('plague-dancer.gif') },
  { slug: 'anomaly', name: 'Anomaly', stats: { health: 60, strength: 60, luck: 40 }, survivalAbilityBonus: 0, abilitiesText: ['20% Recompensa Extra', '-20% Tempo de Expedição'], ultimateText: 'Todas as stats em 100 (Ultimate)', generation: 2, levelCount: 6, imageUrl: local('anomaly.gif') },
  { slug: 'lord-hexron', name: 'Lord Hexron', stats: { health: 85, strength: 85, luck: 35 }, survivalAbilityBonus: 0, abilitiesText: ['-50% Tempo de Expedição', '-50% Descanso'], ultimateText: 'Recompensa crypto se sobreviver', generation: 2, levelCount: 6, imageUrl: local('lord-hexron.gif') },
  { slug: 'sir-catch-a-lot', name: 'Sir Catch-a-Lot', stats: { health: 45, strength: 75, luck: 95 }, survivalAbilityBonus: 0, abilitiesText: ['25% Voltar ao trabalho', '30% Experiência'], ultimateText: 'x3-5 baús se sobreviver', generation: 2, levelCount: 6, imageUrl: local('sir-catch-a-lot.gif') },
  { slug: 'lucky-red', name: 'Lucky Red', stats: { health: 70, strength: 80, luck: 50 }, survivalAbilityBonus: 0, abilitiesText: ['25% Recompensa Extra', '150%/5% Influencer'], ultimateText: 'Sobrevive custe o que custar', generation: 2, levelCount: 6, imageUrl: local('lucky-red.gif') },
  { slug: 'partello', name: 'Partello', stats: { health: 20, strength: 35, luck: 35 }, survivalAbilityBonus: 0, abilitiesText: ['30% Experiência'], ultimateText: 'Traz peças comuns extras se sobreviver', generation: 2, levelCount: 1, imageUrl: local('partello.gif') },
  { slug: 'kitsumi', name: 'Kitsumi', stats: { health: 90, strength: 40, luck: 90 }, survivalAbilityBonus: 0, abilitiesText: ['25% Experiência', '-50% Desconto de recompra', 'x2% Bônus remoto'], ultimateText: 'Estudo Inteligente: sem descanso e +1 stat se sobreviver', generation: 2, levelCount: 6, imageUrl: local('kitsumi.gif') },
  { slug: 'hammy-hooks', name: 'Hammy Hooks', stats: { health: 80, strength: 80, luck: 45 }, survivalAbilityBonus: 10, abilitiesText: ['10% Sobrevivência', '-50% Descanso', 'x5 Poder remoto'], ultimateText: 'Modo impulso: todas as stats em 100', generation: 2, levelCount: 6, imageUrl: local('hammy-hooks.gif') },
  { slug: 'goodncle', name: 'Goodncle', stats: { health: 60, strength: 40, luck: 80 }, survivalAbilityBonus: 0, abilitiesText: ['50% Recompensas Extras', '-50% Desconto de recompra'], ultimateText: 'x3-5 baús se sobreviver', generation: 2, levelCount: 6, imageUrl: local('goodncle.gif') },
  { slug: 'badncle', name: 'Badncle', stats: { health: 60, strength: 80, luck: 40 }, survivalAbilityBonus: 0, abilitiesText: ['50% Recompensas Extras', '-50% Desconto de recompra'], ultimateText: 'x3-5 baús se sobreviver', generation: 2, levelCount: 6, imageUrl: local('badncle.gif') },
  { slug: 'joga-bonito', name: 'Joga Bonito', stats: { health: 70, strength: 90, luck: 50 }, survivalAbilityBonus: 5, abilitiesText: ['Extra Loot +15%', 'Tempo de expedição -15%', '5% Sobrevivência'], ultimateText: 'Speed Ups Chests', generation: 2, levelCount: 1, imageUrl: local('joga-bonito.gif') },
  { slug: 'eliza-bit', name: 'Eliza Bit', stats: { health: 80, strength: 20, luck: 80 }, survivalAbilityBonus: 0, abilitiesText: ['50% Experiência', 'Tempo de expedição -25%', '20% Influencer'], ultimateText: 'High Risk High Reward', generation: 2, levelCount: 1, imageUrl: local('eliza-bit.gif') },
  { slug: 'uncle-azoth', name: "Uncle'Azoth", stats: { health: 85, strength: 85, luck: 60 }, survivalAbilityBonus: 0, abilitiesText: [], ultimateText: 'Converte recompensas de expedição em RLT', generation: 3, levelCount: 6, imageUrl: local('uncle-azoth.gif') },
  { slug: 'captain-jack-pot', name: 'Captain Jack Pot', stats: { health: 65, strength: 60, luck: 95 }, survivalAbilityBonus: 0, abilitiesText: [], ultimateText: 'Estudo Inteligente: sem descanso e +1 stat se sobreviver', generation: 3, levelCount: 6, imageUrl: local('captain-jack-pot.png') },
  { slug: 'davy-coins', name: 'Davy Coins', stats: { health: 80, strength: 90, luck: 30 }, survivalAbilityBonus: 5, abilitiesText: ['5% Sobrevivência'], ultimateText: '50/50: risca recompensa, triplica ou some', generation: 2, levelCount: 1, imageUrl: local('davy-coins.gif') },
]
