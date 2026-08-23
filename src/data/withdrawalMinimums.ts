// Saque mínimo por moeda, coletado manualmente da tela in-game do jogador
// (não há API pública pra isso, mesmo padrão de blockTimes.ts). Atualizar
// manualmente se o jogo mudar esses valores.
export const WITHDRAWAL_MINIMUMS: Record<string, number> = {
  DOGE: 220,
  POL: 300,
  ETH: 0.014,
  BNB: 0.06,
  XRP: 40.0,
  BTC: 0.00085,
  SOL: 0.6,
  TRX: 300,
  LTC: 5.0,
}
