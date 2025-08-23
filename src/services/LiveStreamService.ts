const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL || '';

export type WalletTxEvent = {
	chain: string;
	address: string;
	hash: string;
	from: string;
	to: string;
	value: string;
};

class LiveStreamService {
	private sources: Map<string, EventSource> = new Map();

	getBackendUrl(): string {
		if (BACKEND_URL) return BACKEND_URL.replace(/\/$/, '');
		try {
			const { origin } = window.location;
			return origin.replace(/:\d+$/, ':3001');
		} catch {
			return 'http://localhost:3001';
		}
	}

	subscribeWallet(address: string, chain: 'mainnet' | 'testnet' = 'testnet', onEvent?: (evt: WalletTxEvent) => void) {
		const key = `${chain}:${address.toLowerCase()}`;
		if (this.sources.has(key)) return;
		const url = `${this.getBackendUrl()}/api/stream/wallet/${address}?chain=${chain}`;
		const es = new EventSource(url);
		es.addEventListener('init', () => {
			console.log('[SSE] wallet stream connected', { address, chain });
		});
		es.addEventListener('tx', (e: MessageEvent) => {
			try {
				const data = JSON.parse(e.data);
				const payload: WalletTxEvent = { chain, address, hash: data.hash, from: data.from, to: data.to, value: data.value };
				onEvent?.(payload);
				// Dispatch a browser event for UI listeners
				window.dispatchEvent(new CustomEvent('seifu:wallet-tx', { detail: payload }));
			} catch {}
		});
		es.onerror = () => {
			console.warn('[SSE] wallet stream error, closing');
			es.close();
			this.sources.delete(key);
		};
		this.sources.set(key, es);
	}

	unsubscribeWallet(address: string, chain: 'mainnet' | 'testnet' = 'testnet') {
		const key = `${chain}:${address.toLowerCase()}`;
		const es = this.sources.get(key);
		if (es) {
			es.close();
			this.sources.delete(key);
		}
	}
}

export const liveStreamService = new LiveStreamService();