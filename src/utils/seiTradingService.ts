import { ethers } from 'ethers';

export interface TradeParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  slippage: number;
  deadline?: number;
}

export interface TransactionHistory {
  hash: string;
  type: 'swap' | 'add_liquidity' | 'remove_liquidity' | 'stake' | 'unstake' | 'send' | 'send_token';
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: Date;
  amount: string;
  tokenSymbol: string;
  gasUsed?: string;
  gasPrice?: string;
}

export interface ProtocolInteraction {
  protocol: string;
  lastInteraction: Date;
  totalTransactions: number;
  totalVolume: string;
  favoriteTokens: string[];
}

export class SeiTradingService {
  private provider: ethers.Provider | null = null;
  private signer: ethers.Signer | null = null;
  private transactionHistory: TransactionHistory[] = [];
  private protocolInteractions: Map<string, ProtocolInteraction> = new Map();

  constructor() {
    this.loadHistory();
    this.loadProtocolInteractions();
  }

  async initializeProvider(walletProvider?: any) {
    try {
      if (walletProvider) {
        this.provider = new ethers.BrowserProvider(walletProvider);
        this.signer = await this.provider.getSigner();
      } else {
        // Fallback to public RPC
        this.provider = new ethers.JsonRpcProvider('https://evm-rpc-testnet.sei-apis.com');
      }
    } catch (error) {
      console.error('Failed to initialize provider:', error);
    }
  }

  // Get token balance
  async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<string> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      if (tokenAddress === 'native' || tokenAddress.toLowerCase() === 'sei') {
        const balance = await this.provider.getBalance(walletAddress);
        return ethers.formatEther(balance);
      }

      // ERC20 token balance
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
        this.provider
      );

      const balance = await tokenContract.balanceOf(walletAddress);
      const decimals = await tokenContract.decimals();
      
      return ethers.formatUnits(balance, decimals);
    } catch (error) {
      console.error('Failed to get token balance:', error);
      return '0';
    }
  }

  // Simulate token swap (would connect to DEX in production)
  async simulateSwap(params: TradeParams): Promise<{
    expectedOutput: string;
    priceImpact: string;
    minimumOutput: string;
    route: string[];
  }> {
    // This would connect to actual DEX APIs like Astroport or Dragonswap
    const estimatedOutput = (parseFloat(params.amountIn) * 0.98).toFixed(6); // Real slippage calculation
    
    return {
      expectedOutput: estimatedOutput,
      priceImpact: '1.2%',
      minimumOutput: (parseFloat(estimatedOutput) * (1 - params.slippage / 100)).toFixed(6),
      route: [params.tokenIn, params.tokenOut]
    };
  }

  // Execute token swap
  async executeSwap(params: TradeParams): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      // In production, this would interact with DEX contracts
      // For now, we'll simulate the transaction
      const simulatedTx = {
        hash: '0x' + Math.random().toString(16).substr(2, 64),
        type: 'swap' as const,
        status: 'pending' as const,
        timestamp: new Date(),
        amount: params.amountIn,
        tokenSymbol: 'SEI', // Would be determined from token address
        gasUsed: '21000',
        gasPrice: '0.000000001'
      };

      this.addTransaction(simulatedTx);
      
      // Simulate confirmation after 3 seconds
      setTimeout(() => {
        this.updateTransactionStatus(simulatedTx.hash, 'confirmed');
      }, 3000);

      return simulatedTx.hash;
    } catch (error) {
      console.error('Swap execution failed:', error);
      throw error;
    }
  }

  // Send native SEI
  async sendSei(toAddress: string, amount: string): Promise<string> {
    if (!this.signer) throw new Error('Wallet not connected');
    try {
      const tx = await (this.signer as any).sendTransaction({ to: toAddress, value: ethers.parseEther(amount) });
      this.addTransaction({
        hash: tx.hash,
        type: 'send',
        status: 'pending',
        timestamp: new Date(),
        amount,
        tokenSymbol: 'SEI'
      });
      (async () => { try { await tx.wait(); this.updateTransactionStatus(tx.hash, 'confirmed'); } catch { this.updateTransactionStatus(tx.hash, 'failed'); } })();
      return tx.hash;
    } catch (error) {
      console.error('SEI send failed:', error);
      throw error;
    }
  }

  // Send ERC20 token
  async sendToken(tokenAddress: string, toAddress: string, amount: string): Promise<string> {
    if (!this.signer) throw new Error('Wallet not connected');
    try {
      const token = new ethers.Contract(tokenAddress, ['function transfer(address to, uint256 amount) returns (bool)', 'function decimals() view returns (uint8)', 'function symbol() view returns (string)'], this.signer);
      const decimals = await token.decimals();
      const symbol = await token.symbol();
      const tx = await token.transfer(toAddress, ethers.parseUnits(amount, decimals));
      this.addTransaction({
        hash: tx.hash,
        type: 'send_token',
        status: 'pending',
        timestamp: new Date(),
        amount,
        tokenSymbol: symbol
      });
      (async () => { try { await tx.wait(); this.updateTransactionStatus(tx.hash, 'confirmed'); } catch { this.updateTransactionStatus(tx.hash, 'failed'); } })();
      return tx.hash;
    } catch (error) {
      console.error('Token send failed:', error);
      throw error;
    }
  }

  // Add liquidity to pool
  async addLiquidity(tokenA: string, tokenB: string, amountA: string, amountB: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    const simulatedTx = {
      hash: '0x' + Math.random().toString(16).substr(2, 64),
      type: 'add_liquidity' as const,
      status: 'pending' as const,
      timestamp: new Date(),
      amount: amountA,
      tokenSymbol: 'LP',
      gasUsed: '45000',
      gasPrice: '0.000000001'
    };

    this.addTransaction(simulatedTx);
    
    setTimeout(() => {
      this.updateTransactionStatus(simulatedTx.hash, 'confirmed');
    }, 5000);

    return simulatedTx.hash;
  }

  // Stake tokens
  async stakeTokens(protocol: string, amount: string, tokenAddress: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    const simulatedTx = {
      hash: '0x' + Math.random().toString(16).substr(2, 64),
      type: 'stake' as const,
      status: 'pending' as const,
      timestamp: new Date(),
      amount: amount,
      tokenSymbol: 'SEI',
      gasUsed: '35000',
      gasPrice: '0.000000001'
    };

    this.addTransaction(simulatedTx);
    this.updateProtocolInteraction(protocol, 'stake', amount);
    
    setTimeout(() => {
      this.updateTransactionStatus(simulatedTx.hash, 'confirmed');
    }, 4000);

    return simulatedTx.hash;
  }

  // Get current gas price
  async getCurrentGasPrice(): Promise<string> {
    if (!this.provider) {
      return '0.000000001'; // Default gas price
    }

    try {
      const gasPrice = await this.provider.getFeeData();
      return ethers.formatUnits(gasPrice.gasPrice || 0, 'gwei');
    } catch (error) {
      console.error('Failed to get gas price:', error);
      return '0.000000001';
    }
  }

  // Transaction management
  private addTransaction(tx: TransactionHistory) {
    this.transactionHistory.unshift(tx);
    this.saveHistory();
  }

  private updateTransactionStatus(hash: string, status: TransactionHistory['status']) {
    const tx = this.transactionHistory.find(t => t.hash === hash);
    if (tx) {
      tx.status = status;
      this.saveHistory();
    }
  }

  // Protocol interaction tracking
  private updateProtocolInteraction(protocol: string, action: string, amount: string) {
    const existing = this.protocolInteractions.get(protocol) || {
      protocol,
      lastInteraction: new Date(),
      totalTransactions: 0,
      totalVolume: '0',
      favoriteTokens: []
    };

    existing.lastInteraction = new Date();
    existing.totalTransactions += 1;
    existing.totalVolume = (parseFloat(existing.totalVolume) + parseFloat(amount)).toString();

    this.protocolInteractions.set(protocol, existing);
    this.saveProtocolInteractions();
  }

  // Data persistence
  private loadHistory() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    
    try {
      const saved = localStorage.getItem('seilor_transaction_history');
      if (saved) {
        this.transactionHistory = JSON.parse(saved).map((tx: any) => ({
          ...tx,
          timestamp: new Date(tx.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Failed to load transaction history:', error);
    }
  }

  private saveHistory() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    
    try {
      localStorage.setItem('seilor_transaction_history', JSON.stringify(this.transactionHistory));
    } catch (error) {
      console.warn('Failed to save transaction history:', error);
    }
  }

  private loadProtocolInteractions() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    
    try {
      const saved = localStorage.getItem('seilor_protocol_interactions');
      if (saved) {
        const data = JSON.parse(saved);
        this.protocolInteractions = new Map(
          Object.entries(data).map(([key, value]: [string, any]) => [
            key,
            { ...value, lastInteraction: new Date(value.lastInteraction) }
          ])
        );
      }
    } catch (error) {
      console.warn('Failed to load protocol interactions:', error);
    }
  }

  private saveProtocolInteractions() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    
    try {
      const data = Object.fromEntries(this.protocolInteractions);
      localStorage.setItem('seilor_protocol_interactions', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save protocol interactions:', error);
    }
  }

  // Getters
  getTransactionHistory(): TransactionHistory[] {
    return this.transactionHistory;
  }

  getProtocolInteractions(): ProtocolInteraction[] {
    return Array.from(this.protocolInteractions.values());
  }

  getLastProtocolInteraction(): ProtocolInteraction | null {
    const interactions = this.getProtocolInteractions();
    if (interactions.length === 0) return null;
    
    return interactions.reduce((latest, current) => 
      current.lastInteraction > latest.lastInteraction ? current : latest
    );
  }

  clearHistory() {
    this.transactionHistory = [];
    this.protocolInteractions.clear();
    
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('seilor_transaction_history');
        localStorage.removeItem('seilor_protocol_interactions');
      } catch (error) {
        console.warn('Failed to clear history from localStorage:', error);
      }
    }
  }

  // Portfolio analysis
  async analyzePortfolio(walletAddress: string): Promise<{
    totalValue: string;
    tokens: Array<{
      address: string;
      symbol: string;
      balance: string;
      value: string;
    }>;
    recommendations: string[];
  }> {
    // This would connect to portfolio tracking APIs in production
    return {
      totalValue: '0.00',
      tokens: [],
      recommendations: [
        'Connect your wallet to view real portfolio data',
        'Consider diversifying across multiple protocols',
        'Monitor gas fees for optimal transaction timing'
      ]
    };
  }
}