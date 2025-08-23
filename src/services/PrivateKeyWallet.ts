import { ethers } from 'ethers';

// Storage keys
const STORAGE_KEYS = {
  walletType: 'seilor_wallet_type', // 'pk' | 'mnemonic'
  privateKey: 'seilor_pk',
  mnemonic: 'seilor_mnemonic',
  rpc: 'seilor_rpc_url'
} as const;

const DEFAULT_RPC = (import.meta as any)?.env?.VITE_SEI_TESTNET_RPC || 'https://evm-rpc-testnet.sei-apis.com';

export class PrivateKeyWallet {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet | null = null;
  private seiPriceUsd = 0.834;

  constructor() {
    const rpcUrl = this.getStoredRpc() || DEFAULT_RPC;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.initializeWallet();
  }

  private getStoredRpc(): string | null {
    try { return localStorage.getItem(STORAGE_KEYS.rpc); } catch { return null; }
  }

  private setStoredRpc(rpcUrl: string) {
    try { localStorage.setItem(STORAGE_KEYS.rpc, rpcUrl); } catch {}
  }

  private initializeWallet() {
    // Load from storage first
    const type = this.safeGet(STORAGE_KEYS.walletType);
    if (type === 'pk') {
      const pk = this.safeGet(STORAGE_KEYS.privateKey);
      if (pk) {
        this.wallet = new ethers.Wallet(pk, this.provider);
        return;
      }
    }
    if (type === 'mnemonic') {
      const m = this.safeGet(STORAGE_KEYS.mnemonic);
      if (m) {
        this.wallet = ethers.Wallet.fromPhrase(m).connect(this.provider);
        return;
      }
    }
    // Fallback to env
    const envPk = (import.meta as any)?.env?.VITE_SEILOR_PK || (typeof process !== 'undefined' ? process.env.PRIVATE_KEY : undefined);
    if (envPk && /^0x[0-9a-fA-F]{64}$/.test(envPk)) {
      this.persistPrivateKey(envPk);
      this.wallet = new ethers.Wallet(envPk, this.provider);
      return;
    }
    // As last resort, create an in-memory random wallet (not persisted)
    const random = ethers.Wallet.createRandom();
    this.wallet = random.connect(this.provider);
  }

  private safeGet(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  private persistPrivateKey(pk: string) {
    try {
      localStorage.setItem(STORAGE_KEYS.walletType, 'pk');
      localStorage.setItem(STORAGE_KEYS.privateKey, pk);
    } catch {}
  }

  private persistMnemonic(mnemonic: string) {
    try {
      localStorage.setItem(STORAGE_KEYS.walletType, 'mnemonic');
      localStorage.setItem(STORAGE_KEYS.mnemonic, mnemonic);
    } catch {}
  }

  setRpcUrl(rpcUrl: string) {
    this.setStoredRpc(rpcUrl);
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    if (this.wallet) {
      this.wallet = this.wallet.connect(this.provider);
    }
  }

  isConnected(): boolean {
    return !!this.wallet;
  }

  getAddress(): string {
    if (!this.wallet) throw new Error('Wallet not initialized');
    return this.wallet.address;
  }

  getSigner(): ethers.Wallet {
    if (!this.wallet) throw new Error('Wallet not initialized');
    return this.wallet;
  }

  // Import methods
  importPrivateKey(pk: string) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) throw new Error('Invalid private key');
    this.persistPrivateKey(pk);
    this.wallet = new ethers.Wallet(pk, this.provider);
    return this.getAddress();
  }

  importMnemonic(mnemonic: string) {
    const w = ethers.Wallet.fromPhrase(mnemonic).connect(this.provider);
    this.persistMnemonic(mnemonic);
    this.wallet = w;
    return this.getAddress();
  }

  createNewWallet(persist = true): { address: string; privateKey: string; mnemonic?: string } {
    const w = ethers.Wallet.createRandom();
    this.wallet = w.connect(this.provider);
    if (persist) {
      this.persistMnemonic(w.mnemonic?.phrase || '');
      this.persistPrivateKey(w.privateKey);
    }
    return { address: w.address, privateKey: w.privateKey, mnemonic: w.mnemonic?.phrase };
  }

  clearStoredWallet() {
    try {
      localStorage.removeItem(STORAGE_KEYS.walletType);
      localStorage.removeItem(STORAGE_KEYS.privateKey);
      localStorage.removeItem(STORAGE_KEYS.mnemonic);
    } catch {}
  }

  // Balances
  async getSeiBalance(): Promise<{ sei: string; usd: number }> {
    if (!this.wallet) throw new Error('Wallet not initialized');
    const balance = await this.provider.getBalance(this.wallet.address);
    const sei = parseFloat(ethers.formatEther(balance));
    return { sei: sei.toFixed(4), usd: sei * this.seiPriceUsd };
  }

  async getUSDCBalance(): Promise<{ balance: string; usd: number }> {
    if (!this.wallet) throw new Error('Wallet not initialized');
    const USDC = (import.meta as any)?.env?.VITE_SEI_TESTNET_USDC || '0x3894085ef7ff0f0aedf52e2a2704928d1ec074f1';
    try {
      const erc20 = new ethers.Contract(USDC, [
        'function balanceOf(address) view returns (uint256)',
        'function decimals() view returns (uint8)'
      ], this.provider);
      const [bal, dec] = await Promise.all([
        erc20.balanceOf(this.wallet.address),
        erc20.decimals()
      ]);
      const formatted = parseFloat(ethers.formatUnits(bal, dec));
      return { balance: formatted.toFixed(2), usd: formatted };
    } catch {
      return { balance: '0.00', usd: 0 };
    }
  }

  async getTokenBalance(tokenAddress: string): Promise<{ balance: string; symbol: string; name: string }>{
    if (!this.wallet) throw new Error('Wallet not initialized');
    const erc20 = new ethers.Contract(tokenAddress, [
      'function balanceOf(address) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)',
      'function name() view returns (string)'
    ], this.provider);
    const [bal, dec, sym, name] = await Promise.all([
      erc20.balanceOf(this.wallet.address),
      erc20.decimals(),
      erc20.symbol(),
      erc20.name()
    ]);
    return { balance: parseFloat(ethers.formatUnits(bal, dec)).toFixed(4), symbol: sym, name };
  }

  // Token ops
  async transferTokens(tokenAddress: string, to: string, amount: string) {
    if (!this.wallet) throw new Error('Wallet not initialized');
    const erc20 = new ethers.Contract(tokenAddress, [
      'function transfer(address to, uint256 amount) returns (bool)',
      'function decimals() view returns (uint8)'
    ], this.wallet);
    const dec = await erc20.decimals();
    const amt = ethers.parseUnits(amount, dec);
    const tx = await erc20.transfer(to, amt);
    await tx.wait();
    return { success: true, txHash: tx.hash };
  }

  async sendSei(to: string, amount: string) {
    if (!this.wallet) throw new Error('Wallet not initialized');
    const tx = await this.wallet.sendTransaction({ to, value: ethers.parseEther(amount) });
    await tx.wait();
    return { success: true, txHash: tx.hash };
  }

  // Token registry helpers (unchanged behavior)
  getMyTokens(): Array<{ address: string; name: string; symbol: string; supply: string; creator: string }> {
    try {
      const saved = localStorage.getItem('dev++_tokens');
      if (!saved) return [];
      const tokens = JSON.parse(saved);
      if (!this.wallet) return [];
      return tokens.filter((t: any) => t.creator && t.creator.toLowerCase() === this.wallet!.address.toLowerCase());
    } catch {
      return [];
    }
  }

  async isMyToken(tokenAddress: string): Promise<boolean> {
    if (!this.wallet) return false;
    try {
      const myList = this.getMyTokens();
      if (myList.some(t => t.address.toLowerCase() === tokenAddress.toLowerCase())) return true;
      const token = new ethers.Contract(tokenAddress, ['function owner() view returns (address)'], this.provider);
      const owner = await token.owner().catch(() => '0x');
      return owner.toLowerCase() === this.wallet.address.toLowerCase();
    } catch { return false; }
  }
}

export const privateKeyWallet = new PrivateKeyWallet();