import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// Sei wallet types and interfaces
interface SeiWallet {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getAccounts(): Promise<string[]>;
  signTransaction(tx: any): Promise<any>;
  isConnected(): boolean;
}

interface KeplrWallet {
  enable(chainId: string): Promise<void>;
  getOfflineSigner(chainId: string): any;
  getKey(chainId: string): Promise<{
    name: string;
    algo: string;
    pubKey: Uint8Array;
    address: Uint8Array;
    bech32Address: string;
  }>;
}

declare global {
  interface Window {
    sei?: SeiWallet;
    compass?: SeiWallet;
    keplr?: KeplrWallet;
    ethereum?: any;
  }
}

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  balance: string | null;
  isConnecting: boolean;
  error: string | null;
  walletType: string | null;
}

export const useSeiWallet = () => {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    address: null,
    balance: null,
    isConnecting: false,
    error: null,
    walletType: null
  });

  // Check for available wallets on component mount
  useEffect(() => {
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    try {
      const availableWallets = getAvailableWallets();
      
      if (availableWallets.length > 0) {
        // Try to reconnect to previously connected wallet
        const savedWalletType = localStorage.getItem('seifu_wallet_type');
        if (savedWalletType && availableWallets.includes(savedWalletType)) {
          await connectToWallet(savedWalletType);
        }
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
    }
  };

  const getAvailableWallets = (): string[] => {
    const wallets: string[] = [];
    
    // Check for Sei wallets with better error handling
    try {
      if (window.sei && typeof window.sei.connect === 'function') wallets.push('sei');
      if (window.compass && typeof window.compass.connect === 'function') wallets.push('compass');
      if (window.keplr && typeof window.keplr.enable === 'function') wallets.push('keplr');
      if (window.ethereum && typeof window.ethereum.request === 'function') wallets.push('metamask');
    } catch (error) {
      console.warn('Error detecting wallets:', error);
    }
    
    return wallets;
  };

  const connectWallet = async (walletType?: string) => {
    setWalletState(prev => ({ ...prev, isConnecting: true, error: null }));
    
    try {
      const availableWallets = getAvailableWallets();
      
      if (availableWallets.length === 0) {
        // Provide helpful guidance instead of just error
        const helpMessage = `No Sei-compatible wallets detected. Please:

1. 📱 Install a Sei wallet:
   • Sei Wallet: https://sei.io/wallet
   • Compass Wallet: https://compass.keplr.app/
   • Keplr: https://keplr.app/
   • MetaMask: https://metamask.io/

2. 🔄 Refresh this page after installation

3. 🔗 Make sure your wallet is unlocked

Need help? Visit our docs for detailed setup instructions.`;
        
        setWalletState(prev => ({
          ...prev,
          isConnecting: false,
          error: helpMessage
        }));
        return;
      }

      // Use specified wallet or show selection if multiple available
      const targetWallet = walletType || availableWallets[0];
      
      if (!availableWallets.includes(targetWallet)) {
        throw new Error(`${targetWallet} wallet not found. Available wallets: ${availableWallets.join(', ')}`);
      }

      await connectToWallet(targetWallet);
      
    } catch (error) {
      console.error('Wallet connection error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
      
      // Provide more helpful error messages
      let helpfulMessage = errorMessage;
      if (errorMessage.includes('User rejected') || errorMessage.includes('user rejected')) {
        helpfulMessage = 'Connection was cancelled. Please try again and approve the connection in your wallet.';
      } else if (errorMessage.includes('not found') || errorMessage.includes('not installed')) {
        helpfulMessage = `${errorMessage}\n\nPlease install the wallet extension and refresh the page.`;
      } else if (errorMessage.includes('already processing')) {
        helpfulMessage = 'Wallet connection already in progress. Please wait a moment and try again.';
      } else if (errorMessage.includes('network') || errorMessage.includes('chain')) {
        helpfulMessage = 'Network connection issue. Please check your internet connection and try again.';
      }
      
      setWalletState(prev => ({
        ...prev,
        isConnecting: false,
        error: helpfulMessage
      }));
    }
  };

  const connectToWallet = async (walletType: string) => {
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout. Please try again.')), 30000); // 30 second timeout
    });

    const connectionPromise = (async () => {
      switch (walletType) {
        case 'sei':
          await connectSeiWallet();
          break;
        case 'compass':
          await connectCompassWallet();
          break;
        case 'keplr':
          await connectKeplrWallet();
          break;
        case 'metamask':
          await connectMetaMaskWallet();
          break;
        default:
          throw new Error(`Unsupported wallet type: ${walletType}`);
      }
    })();

    await Promise.race([connectionPromise, timeoutPromise]);
  };

  const connectSeiWallet = async () => {
    if (!window.sei) {
      throw new Error('Sei Wallet not found. Please install Sei Wallet extension.');
    }

    try {
      await window.sei.connect();
      const accounts = await window.sei.getAccounts();
      
      if (accounts.length === 0) {
        throw new Error('No accounts found in Sei Wallet');
      }

      const address = accounts[0];
      const balance = await fetchBalance(address);
      
      setWalletState({
        isConnected: true,
        address,
        balance,
        isConnecting: false,
        error: null,
        walletType: 'sei'
      });

      localStorage.setItem('seifu_wallet_type', 'sei');
      localStorage.setItem('seifu_wallet_address', address);
      
    } catch (error) {
      throw new Error(`Sei Wallet connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const connectCompassWallet = async () => {
    if (!window.compass) {
      throw new Error('Compass Wallet not found. Please install Compass Wallet extension.');
    }

    try {
      await window.compass.connect();
      const accounts = await window.compass.getAccounts();
      
      if (accounts.length === 0) {
        throw new Error('No accounts found in Compass Wallet');
      }

      const address = accounts[0];
      const balance = await fetchBalance(address);
      
      setWalletState({
        isConnected: true,
        address,
        balance,
        isConnecting: false,
        error: null,
        walletType: 'compass'
      });

      localStorage.setItem('seifu_wallet_type', 'compass');
      localStorage.setItem('seifu_wallet_address', address);
      
    } catch (error) {
      throw new Error(`Compass Wallet connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const connectKeplrWallet = async () => {
    if (!window.keplr) {
      throw new Error('Keplr Wallet not found. Please install Keplr extension.');
    }

    try {
      // Enable Sei chain in Keplr (testnet)
      await window.keplr.enable('atlantic-2'); // Sei testnet chain ID
      
      const key = await window.keplr.getKey('atlantic-2');
      const address = key.bech32Address;
      const balance = await fetchBalance(address);
      
      setWalletState({
        isConnected: true,
        address,
        balance,
        isConnecting: false,
        error: null,
        walletType: 'keplr'
      });

      localStorage.setItem('seifu_wallet_type', 'keplr');
      localStorage.setItem('seifu_wallet_address', address);
      
    } catch (error) {
      throw new Error(`Keplr Wallet connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const connectMetaMaskWallet = async () => {
    if (!window.ethereum) {
      throw new Error('MetaMask not found. Please install MetaMask extension.');
    }

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length === 0) {
        throw new Error('No accounts found in MetaMask');
      }

      // Add Sei Testnet to MetaMask
      await addSeiNetwork();

      const address = accounts[0];
      const balance = await fetchBalance(address);
      
      setWalletState({
        isConnected: true,
        address,
        balance,
        isConnecting: false,
        error: null,
        walletType: 'metamask'
      });

      localStorage.setItem('seifu_wallet_type', 'metamask');
      localStorage.setItem('seifu_wallet_address', address);
      
    } catch (error) {
      throw new Error(`MetaMask connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const addSeiNetwork = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x530', // 1328 in hex (Sei testnet)
          chainName: 'Sei Testnet',
          nativeCurrency: {
            name: 'Sei',
            symbol: 'SEI',
            decimals: 18
          },
          rpcUrls: ['https://evm-rpc-testnet.sei-apis.com'],
          blockExplorerUrls: ['https://seitrace.com/?chain=sei-testnet']
        }]
      });
    } catch (error) {
      console.warn('Failed to add Sei network to MetaMask:', error);
    }
  };

  const fetchBalance = async (address: string): Promise<string> => {
    try {
      // Use Sei testnet RPC to fetch real balance
      const rpcUrl = import.meta.env.VITE_SEI_TESTNET_RPC || 'https://evm-rpc-testnet.sei-apis.com';
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const balance = await provider.getBalance(address);
      const balanceInSei = ethers.formatEther(balance);
      return parseFloat(balanceInSei).toFixed(4);
    } catch (error) {
      console.error('Error fetching balance:', error);
      return '0.0000';
    }
  };

  const disconnectWallet = async () => {
    try {
      // Clear stored wallet info
      localStorage.removeItem('seifu_wallet_type');
      localStorage.removeItem('seifu_wallet_address');
      
      // Reset state
      setWalletState({
        isConnected: false,
        address: null,
        balance: null,
        isConnecting: false,
        error: null,
        walletType: null
      });
      
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      setWalletState(prev => ({
        ...prev,
        error: 'Failed to disconnect wallet'
      }));
    }
  };

  const switchWallet = async (newWalletType: string) => {
    await disconnectWallet();
    await connectWallet(newWalletType);
  };

  const clearError = () => {
    setWalletState(prev => ({ ...prev, error: null }));
  };

  return {
    ...walletState,
    connectWallet,
    disconnectWallet,
    switchWallet,
    clearError,
    availableWallets: getAvailableWallets()
  };
};