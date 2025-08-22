import { ethers } from 'ethers';

const DEFAULT_RPC = import.meta.env.VITE_SEI_TESTNET_RPC || 'https://evm-rpc-testnet.sei-apis.com';
const USDC_ADDRESS = (import.meta.env.VITE_SEI_TESTNET_USDC || '0x3894085ef7ff0f0aedf52e2a2704928d1ec074f1').toLowerCase();
const ROUTER_ADDRESS = (import.meta.env.VITE_SEI_TESTNET_ROUTER || '').toLowerCase();

const ROUTER_ABI = [
	'function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)',
	'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)',
	'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)'
];

const ERC20_ABI = [
	'function decimals() view returns (uint8)',
	'function approve(address spender, uint256 amount) returns (bool)',
	'function allowance(address owner, address spender) view returns (uint256)'
];

export class SwapService {
	private provider: ethers.JsonRpcProvider;

	constructor() {
		this.provider = new ethers.JsonRpcProvider(DEFAULT_RPC);
	}

	getUsdcAddress(): string {
		return USDC_ADDRESS;
	}

	isRouterConfigured(): boolean {
		return ROUTER_ADDRESS.length === 42;
	}

	private async getSigner(): Promise<ethers.Signer> {
		if (typeof window === 'undefined' || !window.ethereum) {
			throw new Error('No wallet available');
		}
		const browserProvider = new ethers.BrowserProvider(window.ethereum);
		return await browserProvider.getSigner();
	}

	private async getTokenDecimals(token: string): Promise<number> {
		if (!token || token === 'native' || token.toLowerCase() === 'sei') return 18;
		const erc20 = new ethers.Contract(token, ERC20_ABI, this.provider);
		return Number(await erc20.decimals());
	}

	async quote(amountInStr: string, path: string[]): Promise<{ amounts: string[]; simulated: boolean }>{
		if (!this.isRouterConfigured()) {
			// Fallback: simulate 2% price impact
			const amounts = [amountInStr];
			const out = (parseFloat(amountInStr) * 0.98).toFixed(6);
			amounts.push(out);
			return { amounts, simulated: true };
		}
		const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, this.provider);
		const [inDecimals, outDecimals] = await Promise.all([
			this.getTokenDecimals(path[0]),
			this.getTokenDecimals(path[path.length - 1])
		]);
		const amountIn = ethers.parseUnits(amountInStr, inDecimals);
		const amounts = await router.getAmountsOut(amountIn, path);
		return {
			amounts: [
				ethers.formatUnits(amounts[0], inDecimals),
				ethers.formatUnits(amounts[amounts.length - 1], outDecimals)
			],
			simulated: false
		};
	}

	async swapSeiToToken(toToken: string, amountSei: string, slippageBps = 500): Promise<{ txHash: string; simulated: boolean }>{
		if (!this.isRouterConfigured()) {
			// Simulate
			const txHash = '0x' + Math.random().toString(16).slice(2).padEnd(64, '0');
			return { txHash, simulated: true };
		}
		const signer = await this.getSigner();
		const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);
		const path = [ethers.ZeroAddress, toToken];
		// Quote
		const quote = await this.quote(amountSei, path);
		const outMin = (parseFloat(quote.amounts[1]) * (1 - slippageBps / 10000)).toString();
		const outDecimals = await this.getTokenDecimals(toToken);
		const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
		const tx = await router.swapExactETHForTokens(
			ethers.parseUnits(outMin, outDecimals),
			path,
			await signer.getAddress(),
			deadline,
			{ value: ethers.parseEther(amountSei) }
		);
		await tx.wait();
		return { txHash: tx.hash, simulated: false };
	}

	async swapTokenToToken(tokenIn: string, tokenOut: string, amountInStr: string, slippageBps = 500): Promise<{ txHash: string; simulated: boolean }>{
		if (!this.isRouterConfigured()) {
			const txHash = '0x' + Math.random().toString(16).slice(2).padEnd(64, '0');
			return { txHash, simulated: true };
		}
		const signer = await this.getSigner();
		const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);
		const inDecimals = await this.getTokenDecimals(tokenIn);
		const outDecimals = await this.getTokenDecimals(tokenOut);
		const amountIn = ethers.parseUnits(amountInStr, inDecimals);
		const owner = await signer.getAddress();
		// Approve if needed
		const erc20 = new ethers.Contract(tokenIn, ERC20_ABI, signer);
		const currentAllowance: bigint = await erc20.allowance(owner, ROUTER_ADDRESS);
		if (currentAllowance < amountIn) {
			const approveTx = await erc20.approve(ROUTER_ADDRESS, amountIn);
			await approveTx.wait();
		}
		const path = [tokenIn, tokenOut];
		const quote = await this.quote(amountInStr, path);
		const outMin = (parseFloat(quote.amounts[1]) * (1 - slippageBps / 10000)).toString();
		const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
		const tx = await router.swapExactTokensForTokens(
			amountIn,
			ethers.parseUnits(outMin, outDecimals),
			path,
			owner,
			deadline
		);
		await tx.wait();
		return { txHash: tx.hash, simulated: false };
	}
}

export const swapService = new SwapService();