import { ethers } from 'ethers';
import { tradingDataService } from '../utils/tradingDataService';

const RPC = import.meta.env.VITE_SEI_TESTNET_RPC || 'https://evm-rpc-testnet.sei-apis.com';

const ERC20_ABI = [
	'function balanceOf(address) view returns (uint256)',
	'function decimals() view returns (uint8)',
	'function symbol() view returns (string)',
	'function name() view returns (string)'
];

export interface PortfolioToken {
	address: string;
	symbol: string;
	name: string;
	balance: string;
	usd?: number;
}

export class PortfolioService {
	private provider = new ethers.JsonRpcProvider(RPC);

	async getSeiBalance(address: string): Promise<{ sei: string; usd: number }>{
		const seiPriceUsd = 0.83; // simple static; could be fetched later
		const bal = await this.provider.getBalance(address);
		const sei = parseFloat(ethers.formatEther(bal));
		return { sei: sei.toFixed(4), usd: parseFloat((sei * seiPriceUsd).toFixed(2)) };
	}

	async getTokenBalance(address: string, token: string): Promise<PortfolioToken | null> {
		try {
			const c = new ethers.Contract(token, ERC20_ABI, this.provider);
			const [raw, dec, sym, name] = await Promise.all([
				c.balanceOf(address), c.decimals(), c.symbol(), c.name()
			]);
			const balance = parseFloat(ethers.formatUnits(raw, dec));
			return { address: token, symbol: sym, name, balance: balance.toFixed(4) };
		} catch {
			return null;
		}
	}

	async getPortfolio(address: string, trackedTokens: string[] = []): Promise<{
		sei: { sei: string; usd: number };
		tokens: PortfolioToken[];
		totalUsd: number;
	}>{
		const sei = await this.getSeiBalance(address);
		const tokens: PortfolioToken[] = [];
		for (const t of trackedTokens) {
			const b = await this.getTokenBalance(address, t);
			if (b) tokens.push(b);
		}
		const totalUsd = tokens.reduce((s, t) => s + (t.usd || 0), 0) + sei.usd;
		return { sei, tokens, totalUsd: parseFloat(totalUsd.toFixed(2)) };
	}
}

export const portfolioService = new PortfolioService();