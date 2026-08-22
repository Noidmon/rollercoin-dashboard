// Lista mantida manualmente com as moedas que NÃO podem ser sacadas do jogo.
// Todas as outras moedas são consideradas sacáveis por padrão. Pode precisar de
// atualização se a RollerCoin mudar as regras de saque (mesmo padrão do blockTimes.ts).
export const NON_WITHDRAWABLE_SYMBOLS: string[] = ['USDT', 'ALGO']

export function isWithdrawable(symbol: string): boolean {
  return !NON_WITHDRAWABLE_SYMBOLS.includes(symbol)
}
