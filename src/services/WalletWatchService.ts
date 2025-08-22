import { tradingDataService } from '../utils/tradingDataService';

export class WalletWatchService {
	// Placeholder: integrate with indexer/DEX APIs later
	async getRecentDexActivity(chainId: string, pairAddress: string, limit = 10) {
		return tradingDataService.getRecentTrades(chainId, pairAddress, limit);
	}

	async getTokenPairs(chainId: string, tokenAddress: string) {
		return tradingDataService.getTokenPairsForToken(chainId, tokenAddress);
	}

	async getTrending(chainId = 'sei', limit = 10) {
		return tradingDataService.getTrendingPairs(chainId, limit);
	}
}

export const walletWatchService = new WalletWatchService();