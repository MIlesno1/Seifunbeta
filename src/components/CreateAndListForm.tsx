import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Upload, 
  Rocket, 
  Shield, 
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Droplet,
  Plus,
  Zap,
  Target
} from 'lucide-react';
import { ethers } from 'ethers';
import { useReownWallet } from '../utils/reownWalletConnection';
import { usePrivateKeyWallet } from '../utils/privateKeyWallet';
import { TokenSpotlight } from './TokenSpotlight';
// import { useTokenImage } from '../utils/tokenImageGenerator';
// import { useLogoUpload } from '../utils/ipfsUpload';
// import { useTokenMetadata } from '../utils/tokenMetadata';
import { useTokenMetadata } from '../utils/tokenMetadata';

interface TokenFormData {
  name: string;
  symbol: string;
  description: string;
  website: string;
  github: string;
  telegram: string;
  twitter: string;
  discord: string;
  tokenImage: string;
  logoFile: File | null;
  totalSupply: string;
  launchType: 'fair' | 'presale';
  maxWallet: string;
  lpPercentage: string;
  burnPercentage: string;
  teamPercentage: string;
  lockLp: boolean;
  lockDuration: string;
  daoEnabled: boolean;
  teamWallets: string;
  // Basic liquidity features (no locking - not available on Sei)
  initialLiquidityETH: string;
  addLiquidity: boolean;
  decimals?: number;
}

interface CreateAndListFormProps {
  onBack: () => void;
}

const CreateAndListForm: React.FC<CreateAndListFormProps> = ({ onBack }) => {
  const useTestnet = import.meta.env.VITE_USE_TESTNET_FOR_SEILIST === 'true';
  const devWallet = import.meta.env.VITE_DEV_WALLET;
  
  // Use private key wallet for testing
  const privateKeyWallet = usePrivateKeyWallet();
  
  // Use ReOWN wallet for production
  const reownWallet = useReownWallet();
  
  // Metadata helpers
  const { createAndUploadMetadata, storeMetadataReference } = useTokenMetadata();

  // Use ReOWN wallet for consistent connection across app, fallback to private key for dev
  const isConnected = reownWallet.isConnected || privateKeyWallet.isConnected;
  const address = reownWallet.address || privateKeyWallet.address;
  const connectWallet = async () => {
    if (reownWallet.error) {
      reownWallet.clearError();
    }
    if (!reownWallet.isConnected) {
      await reownWallet.connectWallet();
    }
  };
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verified' | 'failed' | null>(null);
  const [createdTokenAddress, setCreatedTokenAddress] = useState<string | null>(null);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [showTokenSpotlight, setShowTokenSpotlight] = useState(false);
  const [createdTokenData, setCreatedTokenData] = useState<any>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string>('');
  
  // Generate unique token image based on symbol and name
  const generateTokenImage = (symbol: string, name: string) => {
    if (!symbol && !name) return '/Seifun.png'; // Only fallback if no data
    
    // Create a unique color based on the token symbol
    let hash = 0;
    const text = symbol + name;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    
    // Generate SVG with token symbol
    const svg = `
      <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:hsl(${hue}, 70%, 50%);stop-opacity:1" />
            <stop offset="100%" style="stop-color:hsl(${(hue + 60) % 360}, 70%, 40%);stop-opacity:1" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="32" fill="url(#grad)" />
        <text x="32" y="38" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">
          ${symbol.slice(0, 3).toUpperCase()}
        </text>
      </svg>
    `;
    
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  };
  
  // Logo upload functionality - improved
  const uploadLogo = async (file: File): Promise<string> => {
    try {
      // For now, use local URL - can be replaced with IPFS later
      const localUrl = URL.createObjectURL(file);
      console.log('✅ Logo uploaded locally:', localUrl);
      return localUrl;
    } catch (error) {
      console.error('❌ Logo upload failed:', error);
      throw error;
    }
  };
  
  const validateFile = (file: File): string | null => {
    if (file.size > 5 * 1024 * 1024) return 'File size too large (max 5MB)';
    if (!file.type.startsWith('image/')) return 'File must be an image';
    return null;
  };
  
  // Metadata management - improved
  const createTokenMetadata = (tokenData: TokenFormData, tokenAddress: string) => {
    const logoUrl = tokenData.tokenImage || logoPreviewUrl || generateTokenImage(tokenData.symbol, tokenData.name);
    
    return {
      // Standard ERC20 metadata
      name: tokenData.name,
      symbol: tokenData.symbol,
      description: tokenData.description || `${tokenData.name} (${tokenData.symbol}) - Created on SeiList by Seifun`,
      image: logoUrl,
      decimals: 18,
      
      // Extended metadata for better recognition
      external_url: tokenData.website || 'https://seifun.io',
      home_url: tokenData.website || 'https://seifun.io',
      logo: logoUrl,
      logoURI: logoUrl,
      
      // Social links
      social_links: {
        website: tokenData.website || 'https://seifun.io',
        github: tokenData.github,
        telegram: tokenData.telegram,
        twitter: tokenData.twitter,
        discord: tokenData.discord
      },
      
      // Contract information
      contract_address: tokenAddress,
      address: tokenAddress,
      chainId: 1329, // Sei Pacific testnet
      chain: 'sei-testnet',
      network: 'sei',
      
      // Token details
      total_supply: tokenData.totalSupply,
      totalSupply: tokenData.totalSupply,
      
      // Platform information
      created_by: address,
      creator: address,
      created_at: new Date().toISOString(),
      timestamp: new Date().toISOString(),
      verified: true,
      
      // Standards and platform
      token_standard: 'ERC20',
      standard: 'ERC20',
      platform: 'SeiList by Seifun',
      source: 'SeiList',
      
      // Tags for better categorization
      tags: ['meme', 'community', 'sei', 'seifun'],
      category: 'meme',
      
      // Version
      version: '1.0.0'
    };
  };
  
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState<TokenFormData>({
    name: '',
    symbol: '',
    description: '',
    website: '',
    github: '',
    telegram: '',
    twitter: '',
    discord: '',
    tokenImage: '',
    logoFile: null,
    totalSupply: '1000000000',
    launchType: 'fair',
    maxWallet: '2',
    lpPercentage: '80',
    burnPercentage: '0',
    teamPercentage: '10',
    lockLp: true,
    lockDuration: '365',
    daoEnabled: false,
    teamWallets: '',
    // Basic liquidity features (no locking - not available on Sei)
    initialLiquidityETH: '1',
    addLiquidity: false,
    decimals: 18
  });

  // URL parameter support for AI-created tokens
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const aiCreated = urlParams.get('aiCreated');
    
    if (aiCreated === 'true') {
      const prefillData: Partial<TokenFormData> = {};
      
      // Extract all possible parameters
      const name = urlParams.get('name');
      const symbol = urlParams.get('symbol');
      const description = urlParams.get('description');
      const totalSupply = urlParams.get('totalSupply');
      const website = urlParams.get('website');
      const twitter = urlParams.get('twitter');
      const telegram = urlParams.get('telegram');
      
      if (name) prefillData.name = decodeURIComponent(name);
      if (symbol) prefillData.symbol = decodeURIComponent(symbol).toUpperCase();
      if (description) prefillData.description = decodeURIComponent(description);
      if (totalSupply) prefillData.totalSupply = totalSupply;
      if (website) prefillData.website = decodeURIComponent(website);
      if (twitter) prefillData.twitter = decodeURIComponent(twitter);
      if (telegram) prefillData.telegram = decodeURIComponent(telegram);
      
      // Only update if we have data to prefill
      if (Object.keys(prefillData).length > 0) {
        setFormData(prev => ({ ...prev, ...prefillData }));
        
        // Show a notification that the form was pre-filled by AI
        setShowTokenSpotlight(true);
        setTimeout(() => {
          alert('🤖 AI Token Data Loaded!\n\nYour token details have been pre-filled from the AI Tools interface. Review and adjust as needed before creating your token.');
        }, 500);
      }
      
      // Clean up URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  const steps = [
    { number: 1, title: 'Token Details', icon: Upload },
    { number: 2, title: 'Launch Settings', icon: Rocket },
    { number: 3, title: 'Review & Create', icon: Shield },
    { number: 4, title: 'Success & Liquidity', icon: CheckCircle }
  ];

  const handleInputChange = (field: keyof TokenFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const createAndListToken = async () => {
    if (!isConnected) {
      setCreationError('Please connect your wallet first');
      return;
    }

    setIsSubmitting(true);
    setCreationError(null);
    setCreatedTokenAddress(null);
    
    try {
      let provider, signer;
      
      if (useTestnet) {
        // For testnet: create real tokens using private key wallet
        console.log('🧪 Using testnet mode with private key wallet');
        const rpcUrl = import.meta.env.VITE_SEI_TESTNET_RPC || 'https://evm-rpc-testnet.sei-apis.com';
        provider = new ethers.JsonRpcProvider(rpcUrl);
        
        console.log('🔑 Using private key wallet for REAL token creation on testnet');
        
        try {
          // Get signer from private key wallet
          const signer = privateKeyWallet.getSigner();
          
          // Verify wallet address matches
          if (signer.address.toLowerCase() !== address?.toLowerCase()) {
            throw new Error('Private key wallet address mismatch');
          }
            
            // Create factory contract instance with fallback
            const FACTORY_ADDRESS = import.meta.env.VITE_FACTORY_ADDRESS_TESTNET || '0x46287770F8329D51004560dC3BDED879A6565B9A';
            const FACTORY_ABI = [
              'function createToken(string name, string symbol, uint256 totalSupply, uint8 decimals, string tokenURI) external payable returns (address)',
              'function creationFee() external view returns (uint256)',
              'event TokenCreated(address indexed tokenAddress, string name, string symbol, uint256 totalSupply, address indexed creator, string tokenURI)'
            ];
            
            const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
            
            // Get creation fee
            const fee = await factory.creationFee();
            console.log(`💰 Creation fee: ${ethers.formatEther(fee)} SEI`);
            
            // Create the token with real transaction
            setVerificationStatus('pending');
            console.log('📝 Sending transaction to blockchain...');
            const decimals = Number(formData.decimals ?? 18);
            const totalSupplyWei = ethers.parseUnits(formData.totalSupply, decimals);
            // Prepare metadata first to pass tokenURI
            const tempTokenAddress = '0x0000000000000000000000000000000000000000';
            const metadataUrl = await createAndUploadMetadata({ ...formData, decimals }, tempTokenAddress, address);
            const tx = await factory.createToken(
              formData.name,
              formData.symbol,
              totalSupplyWei,
              decimals,
              metadataUrl,
              { value: fee }
            );
            
            console.log(`⏳ Transaction sent: ${tx.hash}`);
            console.log('⏳ Waiting for confirmation...');
            
            // Wait for transaction confirmation
            const receipt = await tx.wait();
            console.log('✅ Transaction confirmed!');
            
            // Extract token address from event logs
            const tokenCreatedEvent = receipt.logs.find(log => {
              try {
                const decoded = factory.interface.parseLog(log);
                return decoded.name === 'TokenCreated';
              } catch {
                return false;
              }
            });
            
            let tokenAddress;
            if (tokenCreatedEvent) {
              const decoded = factory.interface.parseLog(tokenCreatedEvent);
              tokenAddress = decoded.args[0];
            } else {
              tokenAddress = receipt.logs[0]?.address || receipt.contractAddress;
            }
            
            if (!tokenAddress) {
              throw new Error('Could not determine token address from transaction');
            }

            // Upload metadata to IPFS and store reference
            console.log('📤 Uploading token metadata to IPFS...');
            try {
              const finalMetadataUrl = await createAndUploadMetadata({ ...formData, decimals }, tokenAddress, address);
              await storeMetadataReference(tokenAddress, finalMetadataUrl, signer);
              console.log('✅ Token metadata stored on IPFS:', metadataUrl);
            } catch (metadataError) {
              console.warn('⚠️ Metadata upload failed (token still created):', metadataError);
              // Continue even if metadata upload fails
            }
            
            setVerificationStatus('verified');
            setCreatedTokenAddress(tokenAddress);
            setTransactionHash(tx.hash);
            
            // Prepare token data for spotlight
            setCreatedTokenData({
              name: formData.name,
              symbol: formData.symbol,
              address: tokenAddress,
              totalSupply: formData.totalSupply,
              decimals,
              description: formData.description,
              website: formData.website,
              twitter: formData.twitter,
              telegram: formData.telegram,
              tokenImage: formData.tokenImage || logoPreviewUrl || generateTokenImage(formData.symbol, formData.name)
            });
            
            // Show the spotlight after a brief delay for effect
            setTimeout(() => {
              setShowTokenSpotlight(true);
            }, 1000);
            
            console.log('🎉 REAL TOKEN CREATED AND LISTED SUCCESSFULLY!');
            console.log(`📍 Token Address: ${tokenAddress}`);
            console.log(`🔗 Transaction: ${tx.hash}`);
            console.log(`🌐 View on SeiTrace: https://seitrace.com/address/${tokenAddress}?chain=sei-testnet`);
            
        } catch (error) {
          console.error('❌ Private key wallet token creation failed:', error);
          throw error; // Re-throw to be caught by outer try-catch
        }
        
        // Token creation completed successfully
        setIsSubmitting(false);
        
        // Move to success step
        setTimeout(() => {
          setCurrentStep(4);
        }, 1000);
        
        return;
      }
      
      // Real implementation using connected wallet (production)
      if (reownWallet.isConnected && window.ethereum) {
        // Use ReOWN wallet connection
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
      } else if (privateKeyWallet.isConnected) {
        // Fallback to private key wallet for development
        signer = privateKeyWallet.getSigner();
        provider = signer.provider;
      } else {
        throw new Error('Please install MetaMask or use a compatible wallet. Alternatively, enable testnet mode for seamless testing.');
      }
      
      // Factory address with fallback to deployed address
      const FACTORY_ADDRESS = import.meta.env.VITE_FACTORY_ADDRESS_MAINNET || 
                               import.meta.env.VITE_FACTORY_ADDRESS_TESTNET || 
                               '0x46287770F8329D51004560dC3BDED879A6565B9A'; // Deployed factory address
      
      console.log('🏭 Environment variables:', {
        VITE_FACTORY_ADDRESS_MAINNET: import.meta.env.VITE_FACTORY_ADDRESS_MAINNET,
        VITE_FACTORY_ADDRESS_TESTNET: import.meta.env.VITE_FACTORY_ADDRESS_TESTNET,
        FACTORY_ADDRESS: FACTORY_ADDRESS
      });
      
      if (!FACTORY_ADDRESS) {
        throw new Error('Token factory contract address not configured. Please check environment variables.');
      }
      
      const FACTORY_ABI = [
        'function createToken(string name, string symbol, uint256 totalSupply, uint8 decimals, string tokenURI) external payable returns (address)',
        'function creationFee() external view returns (uint256)',
        'event TokenCreated(address indexed tokenAddress, string name, string symbol, uint256 totalSupply, address indexed creator, string tokenURI)'
      ];
      
      console.log('Using factory address:', FACTORY_ADDRESS);
      const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);

      // Get creation fee
      const fee = await factory.creationFee();
      
      // Prepare metadata and arguments
      const decimals = Number(formData.decimals ?? 18);
      const totalSupplyWei = ethers.parseUnits(formData.totalSupply, decimals);
      const metadataUrl = await createAndUploadMetadata({ ...formData, decimals }, '0x0000000000000000000000000000000000000000', address);

      // Create token
      const tx = await factory.createToken(
        formData.name,
        formData.symbol,
        totalSupplyWei,
        decimals,
        metadataUrl,
        { value: fee }
      );

      setVerificationStatus('verified');
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      const tokenCreatedEvent = receipt.logs.find(log => {
        try {
          const decoded = factory.interface.parseLog(log);
          return decoded.name === 'TokenCreated';
        } catch {
          return false;
        }
      });
      const tokenAddress = tokenCreatedEvent ? factory.interface.parseLog(tokenCreatedEvent).args[0] : (receipt.logs[0]?.address || receipt.contractAddress);
      
      setCreatedTokenAddress(tokenAddress);
      setTransactionHash(tx.hash);
      
      // Prepare token data for spotlight
      setCreatedTokenData({
        name: formData.name,
        symbol: formData.symbol,
        address: tokenAddress,
        totalSupply: formData.totalSupply,
        decimals,
        description: formData.description,
        website: formData.website,
        twitter: formData.twitter,
        telegram: formData.telegram,
        tokenImage: formData.tokenImage || logoPreviewUrl || generateTokenImage(formData.symbol, formData.name)
      });
      
      // Add to DevPlus tracking
      const trackingData = {
        address: tokenAddress,
        name: formData.name,
        symbol: formData.symbol,
        totalSupply: formData.totalSupply,
        decimals: decimals,
        creator: address,
        createdAt: new Date(),
        verified: false,
        securityScore: 75, // Good initial score for newly created tokens
        holders: 1
      };
      
      // Store in localStorage for Dev++ to access
      const existingTokens = JSON.parse(localStorage.getItem('dev++_tokens') || '[]');
      existingTokens.unshift(trackingData);
      localStorage.setItem('dev++_tokens', JSON.stringify(existingTokens));
      
      // Show the spotlight after a brief delay for effect
      setTimeout(() => {
        setShowTokenSpotlight(true);
      }, 1000);
      
             console.log('✅ Token created and added to Dev++ tracking:', tokenAddress);
      
    } catch (error: any) {
      console.error('Token creation failed:', error);
      setCreationError(error.message || 'Failed to create and list token');
      setVerificationStatus('failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <h3 className="app-heading-md app-text-primary mb-6">Token Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block app-text-primary text-sm font-medium mb-2">
                  Token Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="app-input"
                  placeholder="e.g., My Token"
                  required
                />
              </div>
              
              <div>
                <label className="block app-text-primary text-sm font-medium mb-2">
                  Token Symbol *
                </label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => handleInputChange('symbol', e.target.value.toUpperCase())}
                  className="app-input"
                  placeholder="e.g., MTK"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block app-text-primary text-sm font-medium mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="app-input"
                rows={4}
                placeholder="Describe your token and its purpose..."
              />
            </div>

            {/* Logo Upload Section */}
            <div>
              <label className="block app-text-primary text-sm font-medium mb-2">
                Token Logo
              </label>
              <div className="space-y-4">
                {/* File Upload */}
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0] || null;
                        if (file) {
                          // Validate file first
                          const validationError = validateFile(file);
                          if (validationError) {
                            alert(validationError);
                            e.target.value = ''; // Clear the input
                            return;
                          }
                          
                          handleInputChange('logoFile', file);
                          
                          // Show immediate preview with local URL
                          const localUrl = URL.createObjectURL(file);
                          setLogoPreviewUrl(localUrl);
                          handleInputChange('tokenImage', localUrl);
                          
                          // Upload in background (for future IPFS integration)
                          try {
                            console.log('📤 Processing logo...');
                            const processedUrl = await uploadLogo(file);
                            console.log('✅ Logo processed:', processedUrl);
                            setLogoPreviewUrl(processedUrl);
                            handleInputChange('tokenImage', processedUrl);
                          } catch (error) {
                            console.error('❌ Logo processing failed:', error);
                            // Keep using local URL as fallback
                          }
                        } else {
                          handleInputChange('logoFile', null);
                          handleInputChange('tokenImage', '');
                          setLogoPreviewUrl('');
                        }
                      }}
                      className="app-input file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-500 file:text-white hover:file:bg-blue-600"
                    />
                  </div>
                                      {/* Logo Preview */}
                    <div className="w-16 h-16 rounded-full border-2 border-gray-300 overflow-hidden">
                      <img
                        src={
                          formData.tokenImage || 
                          logoPreviewUrl || 
                          generateTokenImage(formData.symbol, formData.name)
                        }
                        alt="Token logo preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to generated image if everything fails
                          e.currentTarget.src = generateTokenImage(formData.symbol, formData.name);
                        }}
                      />
                    </div>
                </div>
                <p className="text-sm text-gray-400">
                  Upload a logo for your token (PNG, JPG, GIF - max 5MB). If no logo is uploaded, a unique one will be generated automatically.
                </p>
              </div>
            </div>

            <div>
              <label className="block app-text-primary text-sm font-medium mb-2">
                Total Supply *
              </label>
              <input
                type="number"
                value={formData.totalSupply}
                onChange={(e) => handleInputChange('totalSupply', e.target.value)}
                className="app-input"
                placeholder="1000000000"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block app-text-primary text-sm font-medium mb-2">
                  Website
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  className="app-input"
                  placeholder="https://yourproject.com"
                />
              </div>
              
              <div>
                <label className="block app-text-primary text-sm font-medium mb-2">
                  Twitter
                </label>
                <input
                  type="text"
                  value={formData.twitter}
                  onChange={(e) => handleInputChange('twitter', e.target.value)}
                  className="app-input"
                  placeholder="@yourproject"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <h3 className="app-heading-md app-text-primary mb-6">Launch Settings</h3>
            
            <div>
              <label className="block app-text-primary text-sm font-medium mb-2">
                Launch Type
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleInputChange('launchType', 'fair')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.launchType === 'fair'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'app-border hover:border-blue-300'
                  }`}
                >
                  <div className="text-center">
                    <div className="app-text-primary font-medium">Fair Launch</div>
                    <div className="app-text-muted text-sm mt-1">Equal opportunity for all</div>
                  </div>
                </button>
                
                <button
                  type="button"
                  onClick={() => handleInputChange('launchType', 'presale')}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    formData.launchType === 'presale'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'app-border hover:border-blue-300'
                  }`}
                >
                  <div className="text-center">
                    <div className="app-text-primary font-medium">Presale</div>
                    <div className="app-text-muted text-sm mt-1">Early access for investors</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block app-text-primary text-sm font-medium mb-2">
                  LP Percentage (%)
                </label>
                <input
                  type="number"
                  value={formData.lpPercentage}
                  onChange={(e) => handleInputChange('lpPercentage', e.target.value)}
                  className="app-input"
                  min="0"
                  max="100"
                />
              </div>
              
              <div>
                <label className="block app-text-primary text-sm font-medium mb-2">
                  Team Percentage (%)
                </label>
                <input
                  type="number"
                  value={formData.teamPercentage}
                  onChange={(e) => handleInputChange('teamPercentage', e.target.value)}
                  className="app-input"
                  min="0"
                  max="100"
                />
              </div>
              
              <div>
                <label className="block app-text-primary text-sm font-medium mb-2">
                  Burn Percentage (%)
                </label>
                <input
                  type="number"
                  value={formData.burnPercentage}
                  onChange={(e) => handleInputChange('burnPercentage', e.target.value)}
                  className="app-input"
                  min="0"
                  max="100"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="lockLp"
                checked={formData.lockLp}
                onChange={(e) => handleInputChange('lockLp', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <label htmlFor="lockLp" className="app-text-primary text-sm font-medium">
                Lock Liquidity Pool
              </label>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <h3 className="app-heading-md app-text-primary mb-6">Review & Create Token</h3>
            
            {/* STUNNING TOKEN PREVIEW WITH SPOTLIGHT EFFECT */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-pink-900/20 p-8 border border-blue-500/30">
              {/* Animated Background Effects */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-pink-600/10 animate-pulse"></div>
              <div className="absolute top-0 left-0 w-full h-full">
                <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl animate-bounce"></div>
                <div className="absolute top-3/4 right-1/4 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl animate-bounce delay-1000"></div>
                <div className="absolute bottom-1/4 left-1/2 w-20 h-20 bg-pink-500/20 rounded-full blur-xl animate-bounce delay-2000"></div>
              </div>
              
              {/* Spotlight Effect */}
              <div className="absolute inset-0 bg-gradient-radial from-transparent via-white/5 to-transparent opacity-50"></div>
              
              {/* Main Token Display */}
              <div className="relative z-10 text-center">
                {/* Token Logo with Glow Effect */}
                <div className="relative mx-auto mb-6">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur-xl opacity-50 animate-pulse scale-110"></div>
                  <div className="relative w-32 h-32 mx-auto rounded-full border-4 border-white/20 overflow-hidden shadow-2xl">
                    <img
                      src={
                        formData.tokenImage || 
                        logoPreviewUrl || 
                        generateTokenImage(formData.symbol, formData.name)
                      }
                      alt="Token logo"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = generateTokenImage(formData.symbol, formData.name);
                      }}
                    />
                  </div>
                  {/* Rotating Ring Effect */}
                  <div className="absolute inset-0 w-32 h-32 mx-auto border-2 border-gradient-to-r from-blue-400 to-purple-400 rounded-full animate-spin opacity-30"></div>
                </div>
                
                {/* Token Name & Symbol */}
                <div className="mb-6">
                  <h2 className="text-4xl font-bold bg-gradient-to-r from-white via-blue-200 to-purple-200 bg-clip-text text-transparent mb-2">
                    {formData.name || 'Your Token'}
                  </h2>
                  <div className="inline-flex items-center px-4 py-2 bg-white/10 rounded-full border border-white/20">
                    <span className="text-xl font-mono text-blue-300">${formData.symbol || 'SYMBOL'}</span>
                  </div>
                </div>
                
                {/* Token Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <div className="text-2xl font-bold text-white mb-1">
                      {parseInt(formData.totalSupply || '0').toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-300">Total Supply</div>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <div className="text-2xl font-bold text-green-400 mb-1">
                      {formData.lpPercentage || '0'}%
                    </div>
                    <div className="text-sm text-gray-300">Liquidity</div>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <div className="text-2xl font-bold text-yellow-400 mb-1">
                      {formData.teamPercentage || '0'}%
                    </div>
                    <div className="text-sm text-gray-300">Team</div>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                    <div className="text-2xl font-bold text-red-400 mb-1">
                      {formData.burnPercentage || '0'}%
                    </div>
                    <div className="text-sm text-gray-300">Burn</div>
                  </div>
                </div>
                
                {/* Launch Type Badge */}
                <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full text-white font-medium mb-6 shadow-lg">
                  <Zap className="w-5 h-5 mr-2" />
                  {formData.launchType === 'fair' ? 'Fair Launch' : 'Presale Launch'}
                </div>
                
                {/* Dev++ Connection Status */}
                <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-green-300 font-medium">Connected to Dev++</span>
                  </div>
                  <p className="text-sm text-green-200 mt-1">
                    Your token will be automatically monitored and managed through Dev++
                  </p>
                </div>
              </div>
              
              {/* Particle Effects */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-10 left-10 w-2 h-2 bg-blue-400 rounded-full opacity-70 animate-ping"></div>
                <div className="absolute top-20 right-20 w-1 h-1 bg-purple-400 rounded-full opacity-60 animate-ping delay-500"></div>
                <div className="absolute bottom-20 left-20 w-1.5 h-1.5 bg-pink-400 rounded-full opacity-80 animate-ping delay-1000"></div>
                <div className="absolute bottom-10 right-10 w-1 h-1 bg-yellow-400 rounded-full opacity-50 animate-ping delay-1500"></div>
              </div>
            </div>
            
            {/* Custom Naming Feature */}
            <div className="app-bg-tertiary rounded-lg p-6 border border-blue-500/20">
              <h4 className="app-text-primary font-medium mb-4 flex items-center">
                <Target className="w-5 h-5 mr-2 text-blue-400" />
                🎯 Custom Naming (Seifu Style)
              </h4>
              <p className="app-text-secondary text-sm mb-4">
                Add a custom suffix to your token launch page URL, making it uniquely yours on seifu.fun
              </p>
              
              <div className="flex items-center space-x-2">
                <span className="text-gray-400 font-mono">seifu.fun/</span>
                <input
                  type="text"
                  value={formData.symbol.toLowerCase()}
                  onChange={(e) => handleInputChange('symbol', e.target.value.toUpperCase())}
                  className="app-input flex-1 font-mono"
                  placeholder="your-token"
                  pattern="[a-z0-9-]+"
                />
              </div>
              <p className="text-sm text-gray-400 mt-1 font-mono">
                Your token will be accessible at: seifu.fun/{formData.symbol.toLowerCase() || 'your-token'}
              </p>
            </div>

            {verificationStatus === 'pending' && (
              <div className="flex items-center space-x-3 text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                <span>Creating and listing token...</span>
              </div>
            )}

            {verificationStatus === 'failed' && creationError && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-red-500 font-medium">Creation Failed</div>
                    <div className="text-red-400 text-sm mt-1">{creationError}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 text-white rounded-full mb-4">
                <CheckCircle className="w-8 h-8" />
              </div>
              
              <h3 className="app-heading-lg app-text-primary mb-2">Token Created Successfully!</h3>
              <p className="app-text-secondary mb-6">
                Your token has been deployed and is now listed on SeiList
              </p>
            </div>

            {/* Token Information */}
            {createdTokenAddress && (
              <div className="app-bg-tertiary rounded-lg p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block app-text-muted text-sm mb-2">Token Address</label>
                    <div className="flex items-center space-x-2">
                      <code className="app-text-primary font-mono text-sm bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded flex-1">
                        {createdTokenAddress}
                      </code>
                      <button
                        onClick={() => copyToClipboard(createdTokenAddress)}
                        className="app-btn app-btn-secondary p-2"
                        title="Copy address"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => window.open(`https://seitrace.com/address/${createdTokenAddress}`, '_blank')}
                        className="app-btn app-btn-secondary p-2"
                        title="View on Explorer"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Liquidity Setup Section - Post Creation */}
            {createdTokenAddress && (
              <div className="app-bg-tertiary rounded-lg p-6">
                <h4 className="app-text-primary font-medium mb-4 flex items-center">
                  <Droplet className="w-5 h-5 mr-2 text-blue-500" />
                  Add Liquidity (Optional)
                </h4>
                <p className="app-text-secondary text-sm mb-4">
                  Make your token tradeable by adding liquidity. This is optional but recommended for immediate trading.
                </p>

                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="addLiquidityPost"
                      checked={formData.addLiquidity}
                      onChange={(e) => handleInputChange('addLiquidity', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <label htmlFor="addLiquidityPost" className="app-text-primary text-sm font-medium">
                      Add Initial Liquidity Now
                    </label>
                  </div>
                  
                  {formData.addLiquidity && (
                    <div className="space-y-4 mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block app-text-primary text-sm font-medium mb-2">
                            SEI Amount
                          </label>
                          <input
                            type="number"
                            value={formData.initialLiquidityETH}
                            onChange={(e) => handleInputChange('initialLiquidityETH', e.target.value)}
                            className="app-input"
                            min="0.1"
                            step="0.1"
                            placeholder="1.0"
                          />
                        </div>

                        <div>
                          <label className="block app-text-primary text-sm font-medium mb-2">
                            Token Percentage (%)
                          </label>
                          <input
                            type="number"
                            value={formData.lpPercentage}
                            onChange={(e) => handleInputChange('lpPercentage', e.target.value)}
                            className="app-input"
                            min="10"
                            max="90"
                          />
                        </div>
                      </div>

                      

                      {/* Liquidity Preview */}
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                        <h5 className="text-blue-400 font-medium mb-2 flex items-center">
                          <Plus className="w-4 h-4 mr-1" />
                          Liquidity Preview
                        </h5>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">SEI:</span>
                            <span className="text-blue-400">{formData.initialLiquidityETH} SEI</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Tokens:</span>
                            <span className="text-blue-400">
                              {((parseInt(formData.totalSupply) * parseInt(formData.lpPercentage)) / 100).toLocaleString()} {formData.symbol}
                            </span>
                          </div>
                                                     <div className="flex justify-between col-span-2">
                             <span className="text-gray-400">Est. Initial Price:</span>
                             <span className="text-blue-400">
                               {formData.initialLiquidityETH && formData.lpPercentage ? 
                                 (parseFloat(formData.initialLiquidityETH) / ((parseInt(formData.totalSupply) * parseInt(formData.lpPercentage)) / 100)).toFixed(8)
                                 : '0'
                               } SEI per {formData.symbol}
                             </span>
                           </div>
                           <div className="col-span-2 text-xs text-gray-500 mt-2">
                             *Price will be determined by market once liquidity is added to a DEX
                           </div>
                        </div>
                      </div>

                                             <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                         <h6 className="text-blue-400 font-medium mb-2">📝 Manual Liquidity Addition</h6>
                         <p className="text-sm text-gray-400 mb-3">
                           Liquidity must be added manually on Sei DEXes. Here's how:
                         </p>
                         <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
                           <li>Go to <strong>Astroport</strong> or <strong>Dragonswap</strong></li>
                           <li>Find "Add Liquidity" or "Pool" section</li>
                           <li>Select your token and SEI as the pair</li>
                           <li>Enter the amounts you want to provide</li>
                           <li>Confirm the transaction</li>
                         </ol>
                         <div className="flex space-x-2 mt-3">
                           <button
                             onClick={() => window.open('https://astroport.fi', '_blank')}
                             className="app-btn app-btn-secondary text-xs px-3 py-1"
                           >
                             Open Astroport
                           </button>
                           <button
                             onClick={() => window.open('https://dragonswap.app', '_blank')}
                             className="app-btn app-btn-secondary text-xs px-3 py-1"
                           >
                             Open Dragonswap
                           </button>
                         </div>
                       </div>
                    </div>
                  )}

                  {!formData.addLiquidity && (
                                         <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                       <div className="flex items-start space-x-2">
                         <AlertTriangle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                         <div>
                           <div className="text-blue-500 font-medium">Ready for Manual Liquidity</div>
                           <div className="text-blue-400 text-sm mt-1">
                             Your token is created! Add liquidity on DEXes like Astroport or Dragonswap to make it tradeable.
                           </div>
                           <div className="flex space-x-2 mt-2">
                             <button
                               onClick={() => window.open('https://astroport.fi', '_blank')}
                               className="text-xs text-blue-400 hover:text-blue-300 underline"
                             >
                               Astroport
                             </button>
                             <button
                               onClick={() => window.open('https://dragonswap.app', '_blank')}
                               className="text-xs text-blue-400 hover:text-blue-300 underline"
                             >
                               Dragonswap
                             </button>
                           </div>
                         </div>
                       </div>
                     </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-center space-x-4">
              <button
                onClick={() => window.location.reload()}
                className="app-btn app-btn-secondary"
              >
                Create Another Token
              </button>
              <button
                onClick={() => window.open('/app/dev-plus', '_blank')}
                className="app-btn app-btn-primary flex items-center space-x-2"
              >
                <BarChart3 className="w-4 h-4" />
                <span>Open Dev++ Dashboard</span>
              </button>
              <button
                onClick={onBack}
                className="app-btn app-btn-secondary"
              >
                Back to SeiList
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="app-bg-primary min-h-screen">
      {/* Header */}
      <div className="app-bg-secondary border-b app-border">
        <div className="app-container py-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="app-btn app-btn-secondary"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to SeiList
            </button>
            <div>
              <h1 className="app-heading-lg app-text-primary">Create & List Token</h1>
              <p className="app-text-muted">Deploy a new token and list it on SeiList</p>
            </div>
          </div>
        </div>
      </div>

      <div className="app-container py-8">
        <div className="max-w-4xl mx-auto">
          {/* Progress Steps */}
          <div className="flex items-center justify-between mb-12">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  currentStep >= step.number 
                    ? 'bg-blue-500 text-white' 
                    : 'app-bg-tertiary app-text-muted'
                }`}>
                  {currentStep > step.number ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                <div className="ml-3">
                  <div className={`text-sm font-medium ${
                    currentStep >= step.number ? 'app-text-primary' : 'app-text-muted'
                  }`}>
                    {step.title}
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-0.5 ml-6 ${
                    currentStep > step.number ? 'bg-blue-500' : 'app-bg-tertiary'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* Form Content */}
          <div className="app-card p-8">
            {!isConnected ? (
              <div className="text-center py-12">
                <Shield className="w-16 h-16 app-text-muted mx-auto mb-4" />
                <h3 className="app-heading-md app-text-primary mb-4">Connect Your Wallet</h3>
                <p className="app-text-muted mb-6">
                  Connect your wallet to create and list tokens on SeiList
                </p>
                
                {reownWallet.error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-red-700">
                      <strong>Connection Error:</strong> {reownWallet.error}
                    </p>
                    <button
                      onClick={reownWallet.clearError}
                      className="text-xs text-red-600 underline mt-1"
                    >
                      Clear Error
                    </button>
                  </div>
                )}
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-blue-700">
                    <strong>SeiList:</strong> Connect your wallet to create real tokens on Sei testnet.
                    Your wallet will be used for transactions and token ownership.
                  </p>
                </div>
                
                <button
                  onClick={connectWallet}
                  disabled={reownWallet.isConnecting}
                  className="app-btn app-btn-primary"
                >
                  {reownWallet.isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
                
                {/* Dev wallet info */}
                <div className="mt-4 text-xs text-slate-500">
                  <p>Development fallback available for testing</p>
                </div>
              </div>
            ) : (
              <>
                {renderStepContent()}
                
                {/* Navigation Buttons */}
                {currentStep < 4 && (
                  <div className="flex justify-between mt-8 pt-6 border-t app-border">
                    <button
                      onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                      disabled={currentStep === 1}
                      className="app-btn app-btn-secondary"
                    >
                      Previous
                    </button>
                    
                    {currentStep === 3 ? (
                      <button
                        onClick={createAndListToken}
                        disabled={isSubmitting || !formData.name || !formData.symbol}
                        className="app-btn app-btn-primary"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            Creating & Listing...
                          </>
                        ) : (
                          <>
                            <Rocket className="w-4 h-4 mr-2" />
                            Create & List Token
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => setCurrentStep(Math.min(4, currentStep + 1))}
                        disabled={currentStep === 1 && (!formData.name || !formData.symbol)}
                        className="app-btn app-btn-primary"
                      >
                        Next
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Token Spotlight Modal */}
      {showTokenSpotlight && createdTokenData && (
        <TokenSpotlight
          isOpen={showTokenSpotlight}
          onClose={() => setShowTokenSpotlight(false)}
          tokenData={createdTokenData}
          transactionHash={transactionHash || undefined}
        />
      )}
    </div>
  );
};

export default CreateAndListForm;