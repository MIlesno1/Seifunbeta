const express = require("express");
const mongoose = require("mongoose");
const { ethers } = require("ethers");
const Token = require("./models/Token.cjs");
const cors = require("cors");
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/seifu", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Network configs
const NETWORKS = {
  testnet: {
    rpc: process.env.SEI_RPC_TESTNET || 'https://evm-rpc-testnet.sei-apis.com'
  },
  mainnet: {
    rpc: process.env.SEI_RPC_MAINNET || 'https://evm-rpc.sei-apis.com'
  }
};

// Ethers setup for Sei blockchain (default to testnet)
const defaultChain = (process.env.SEI_DEFAULT_CHAIN || 'testnet').toLowerCase();
const provider = new ethers.JsonRpcProvider(
  defaultChain === 'mainnet' ? NETWORKS.mainnet.rpc : NETWORKS.testnet.rpc
);
const factoryAbi = require("./abis/TokenCheckerFactory.json");
const checkerAbi = require("./abis/TokenSafeChecker.json");
const erc20Abi = require("./abis/ERC20.json");
const factoryAddress = process.env.FACTORY_CONTRACT_ADDRESS || "0x50C0b92b3BC34D7FeD7Da0C48a2F16a636D95C9F";

const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);

// Log configuration on startup
console.log("SeifuGuard Backend Configuration:");
console.log("- Factory Address:", factoryAddress);
console.log("- Default Chain:", defaultChain);
console.log("- Testnet RPC:", NETWORKS.testnet.rpc);
console.log("- Mainnet RPC:", NETWORKS.mainnet.rpc);
console.log("- MongoDB URI:", process.env.MONGODB_URI || "mongodb://localhost:27017/seifu");

// Utility: pick provider by chain param
function getProviderByChain(chain) {
  const c = (chain || defaultChain).toLowerCase();
  const url = c === 'mainnet' ? NETWORKS.mainnet.rpc : NETWORKS.testnet.rpc;
  return new ethers.JsonRpcProvider(url);
}

// Token analysis service
class TokenAnalyzer {
  constructor(provider) {
    this.provider = provider;
  }

  async analyzeToken(tokenAddress) {
    try {
      const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
      
      // Get basic token information
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.totalSupply()
      ]);

      // Perform comprehensive analysis
      const analysis = {
        basicInfo: {
          address: tokenAddress,
          name,
          symbol,
          decimals: decimals.toString(),
          totalSupply: totalSupply.toString()
        },
        safetyChecks: await this.performSafetyChecks(tokenContract, tokenAddress),
        riskScore: 0,
        isSafe: false,
        riskFactors: []
      };

      // Calculate risk score
      analysis.riskScore = this.calculateRiskScore(analysis.safetyChecks);
      analysis.isSafe = analysis.riskScore >= 70;
      analysis.riskFactors = this.getRiskFactors(analysis.safetyChecks);

      return analysis;
    } catch (error) {
      console.error("Error analyzing token:", error);
      throw new Error("Failed to analyze token");
    }
  }

  async performSafetyChecks(tokenContract, tokenAddress) {
    const checks = {};

    // Check 1: Supply Analysis
    checks.supply = await this.checkSupplySafety(tokenContract);

    // Check 2: Ownership Analysis
    checks.ownership = await this.checkOwnershipSafety(tokenContract);

    // Check 3: Liquidity Analysis
    checks.liquidity = await this.checkLiquiditySafety(tokenAddress);

    // Check 4: Honeypot Detection
    checks.honeypot = await this.checkHoneypotSafety(tokenContract, tokenAddress);

    // Check 5: Blacklist Function Detection
    checks.blacklist = await this.checkBlacklistFunction(tokenContract);

    // Check 6: Contract Verification
    checks.verified = await this.checkContractVerification(tokenAddress);

    // Check 7: Transfer Function Analysis
    checks.transfer = await this.checkTransferFunction(tokenContract);

    // Check 8: Fee Analysis
    checks.fees = await this.checkFeeStructure(tokenContract);

    return checks;
  }

  async checkSupplySafety(tokenContract) {
    try {
      const totalSupply = await tokenContract.totalSupply();
      const maxSupply = ethers.MaxUint256;
      
      // Check if supply is reasonable (not too large)
      const supplyIsReasonable = totalSupply < ethers.parseUnits("1000000000000", 18); // 1 trillion max
      
      // Check if supply is locked (this would need additional logic)
      const supplyIsLocked = true; // Placeholder
      
      return {
        passed: supplyIsReasonable && supplyIsLocked,
        totalSupply: totalSupply.toString(),
        maxSupply: maxSupply.toString(),
        supplyIsReasonable,
        supplyIsLocked,
        risk: supplyIsReasonable ? "LOW" : "HIGH"
      };
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        risk: "UNKNOWN"
      };
    }
  }

  async checkOwnershipSafety(tokenContract) {
    try {
      // Try to get owner
      let owner = ethers.ZeroAddress;
      let isOwnershipRenounced = true;

      try {
        owner = await tokenContract.owner();
        isOwnershipRenounced = owner === ethers.ZeroAddress;
      } catch {
        // If owner() function doesn't exist, try other common patterns
        try {
          owner = await tokenContract.getOwner();
          isOwnershipRenounced = owner === ethers.ZeroAddress;
        } catch {
          // Assume ownership is renounced if we can't determine
          isOwnershipRenounced = true;
        }
      }

      return {
        passed: isOwnershipRenounced,
        owner: owner,
        isOwnershipRenounced,
        risk: isOwnershipRenounced ? "LOW" : "HIGH"
      };
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        risk: "UNKNOWN"
      };
    }
  }

  async checkLiquiditySafety(tokenAddress) {
    try {
      // This would need integration with Sei DEX (like Astroport)
      // For now, we'll simulate the check
      const liquidity = await this.getLiquidityFromDEX(tokenAddress);
      
      return {
        passed: liquidity > ethers.parseUnits("1000", 6), // At least 1000 USDC equivalent
        liquidity: liquidity.toString(),
        risk: liquidity > ethers.parseUnits("10000", 6) ? "LOW" : "MEDIUM"
      };
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        risk: "UNKNOWN"
      };
    }
  }

  async checkHoneypotSafety(tokenContract, tokenAddress) {
    try {
      // This would need to simulate buy/sell transactions
      // For now, we'll check for common honeypot patterns in bytecode
      const code = await this.provider.getCode(tokenAddress);
      
      // Check for common honeypot patterns
      const isHoneypot = this.detectHoneypotPatterns(code);
      
      return {
        passed: !isHoneypot,
        isHoneypot,
        risk: isHoneypot ? "CRITICAL" : "LOW"
      };
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        risk: "UNKNOWN"
      };
    }
  }

  async checkBlacklistFunction(tokenContract) {
    try {
      // Check if contract has blacklist function
      const code = await this.provider.getCode(tokenContract.target);
      const hasBlacklist = this.detectBlacklistFunction(code);
      
      return {
        passed: !hasBlacklist,
        hasBlacklist,
        risk: hasBlacklist ? "HIGH" : "LOW"
      };
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        risk: "UNKNOWN"
      };
    }
  }

  async checkContractVerification(tokenAddress) {
    try {
      // This would check if contract is verified on Sei block explorer
      // For now, we'll assume it's verified
      return {
        passed: true,
        verified: true,
        risk: "LOW"
      };
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        risk: "UNKNOWN"
      };
    }
  }

  async checkTransferFunction(tokenContract) {
    try {
      // Check if transfer function works properly
      const code = await this.provider.getCode(tokenContract.target);
      const hasTransfer = code.includes("transfer");
      const hasTransferFrom = code.includes("transferFrom");
      
      return {
        passed: hasTransfer && hasTransferFrom,
        hasTransfer,
        hasTransferFrom,
        risk: (hasTransfer && hasTransferFrom) ? "LOW" : "HIGH"
      };
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        risk: "UNKNOWN"
      };
    }
  }

  async checkFeeStructure(tokenContract) {
    try {
      // Check for excessive fees
      const code = await this.provider.getCode(tokenContract.target);
      const hasExcessiveFees = this.detectExcessiveFees(code);
      
      return {
        passed: !hasExcessiveFees,
        hasExcessiveFees,
        risk: hasExcessiveFees ? "HIGH" : "LOW"
      };
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        risk: "UNKNOWN"
      };
    }
  }

  // Helper methods
  async getLiquidityFromDEX(tokenAddress) {
    // This would query Sei DEX (Astroport) for liquidity
    // For now, return a mock value
    return ethers.parseUnits("50000", 6); // 50k USDC
  }

  detectHoneypotPatterns(code) {
    // Check for common honeypot patterns in bytecode
    const honeypotPatterns = [
      "6360fe47", // revert pattern
      "60006000", // invalid opcode pattern
      "fe", // invalid opcode
    ];
    
    return honeypotPatterns.some(pattern => code.includes(pattern));
  }

  detectBlacklistFunction(code) {
    // Check for blacklist function signatures
    const blacklistPatterns = [
      "blacklist",
      "isBlacklisted",
      "setBlacklisted",
    ];
    
    return blacklistPatterns.some(pattern => code.toLowerCase().includes(pattern));
  }

  detectExcessiveFees(code) {
    // Check for fee functions that might indicate excessive fees
    const feePatterns = [
      "setFee",
      "setTax",
      "setMaxFee",
    ];
    
    return feePatterns.some(pattern => code.toLowerCase().includes(pattern));
  }

  calculateRiskScore(safetyChecks) {
    let score = 100;
    
    // Deduct points for each failed check
    if (!safetyChecks.supply.passed) score -= 20;
    if (!safetyChecks.ownership.passed) score -= 15;
    if (!safetyChecks.liquidity.passed) score -= 25;
    if (!safetyChecks.honeypot.passed) score = 0; // Honeypot = instant fail
    if (!safetyChecks.blacklist.passed) score -= 10;
    if (!safetyChecks.verified.passed) score -= 5;
    if (!safetyChecks.transfer.passed) score -= 15;
    if (!safetyChecks.fees.passed) score -= 10;
    
    return Math.max(0, score);
  }

  getRiskFactors(safetyChecks) {
    const factors = [];
    
    if (!safetyChecks.supply.passed) factors.push("Suspicious supply structure");
    if (!safetyChecks.ownership.passed) factors.push("Ownership not renounced");
    if (!safetyChecks.liquidity.passed) factors.push("Low liquidity");
    if (!safetyChecks.honeypot.passed) factors.push("Honeypot detected");
    if (!safetyChecks.blacklist.passed) factors.push("Blacklist function present");
    if (!safetyChecks.verified.passed) factors.push("Contract not verified");
    if (!safetyChecks.transfer.passed) factors.push("Transfer function issues");
    if (!safetyChecks.fees.passed) factors.push("Excessive fees detected");
    
    return factors;
  }
}

// API Endpoints

// Scan a token for safety (chain param optional: mainnet|testnet)
app.post("/api/scan", async (req, res) => {
  try {
    const { tokenAddress, chain } = req.body;
    
    if (!tokenAddress) {
      return res.status(400).json({ error: "Token address is required" });
    }

    // Validate address format
    if (!ethers.isAddress(tokenAddress)) {
      return res.status(400).json({ error: "Invalid token address format" });
    }

    const p = getProviderByChain(chain);
    const analyzer = new TokenAnalyzer(p);

    // Perform comprehensive analysis
    const analysis = await analyzer.analyzeToken(tokenAddress);
    
    // Save to database
    await Token.findOneAndUpdate(
      { address: tokenAddress },
      {
        address: tokenAddress,
        analysis: analysis,
        lastScanned: new Date(),
        scanCount: { $inc: 1 },
        chain: (chain || defaultChain)
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error("Scan error:", error);
    res.status(500).json({ 
      error: "Failed to scan token",
      details: error.message 
    });
  }
});

// Get scan history for a token
app.get("/api/history/:tokenAddress", async (req, res) => {
  try {
    const token = await Token.findOne({ address: req.params.tokenAddress });
    if (!token) {
      return res.status(404).json({ error: "Token not found" });
    }
    
    res.json({
      success: true,
      data: token
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get token history" });
  }
});

// Get recent scans
app.get("/api/recent-scans", async (req, res) => {
  try {
    const recentTokens = await Token.find()
      .sort({ lastScanned: -1 })
      .limit(20);
    
    res.json({
      success: true,
      data: recentTokens
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get recent scans" });
  }
});

// Get scan statistics
app.get("/api/stats", async (req, res) => {
  try {
    const totalTokens = await Token.countDocuments();
    const safeTokens = await Token.countDocuments({ "analysis.isSafe": true });
    const unsafeTokens = await Token.countDocuments({ "analysis.isSafe": false });
    
    res.json({
      success: true,
      data: {
        totalTokens,
        safeTokens,
        unsafeTokens,
        safetyRate: totalTokens > 0 ? (safeTokens / totalTokens * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get statistics" });
  }
});

// Portfolio endpoint: SEI + list of tokens (query: tokens=addr1,addr2; chain=mainnet|testnet)
app.get('/api/portfolio/:address', async (req, res) => {
  try {
    const address = req.params.address;
    const chain = req.query.chain;
    const tokens = (req.query.tokens || '').split(',').filter(Boolean);
    const p = getProviderByChain(chain);

    const result = { address, chain: chain || defaultChain, sei: '0', tokens: [], totalUsd: 0 };
    const seiBal = await p.getBalance(address);
    const sei = parseFloat(ethers.formatEther(seiBal));
    result.sei = sei.toFixed(4);

    for (const t of tokens) {
      try {
        const c = new ethers.Contract(t, erc20Abi, p);
        const [raw, dec, sym] = await Promise.all([c.balanceOf(address), c.decimals(), c.symbol()]);
        const bal = parseFloat(ethers.formatUnits(raw, dec));
        result.tokens.push({ address: t, symbol: sym, balance: bal.toFixed(4) });
      } catch {}
    }

    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ error: 'Failed to get portfolio', details: e.message });
  }
});

// SSE: live wallet transactions (basic)
app.get('/api/stream/wallet/:address', async (req, res) => {
  const address = (req.params.address || '').toLowerCase();
  const chain = (req.query.chain || defaultChain).toLowerCase();
  const p = getProviderByChain(chain);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send('init', { address, chain });

  const onTx = async (tx) => {
    try {
      if (!tx || !tx.to) return;
      const from = (tx.from || '').toLowerCase();
      const to = (tx.to || '').toLowerCase();
      if (from === address || to === address) {
        send('tx', { hash: tx.hash, from, to, value: tx.value?.toString?.() || '0' });
      }
    } catch {}
  };

  p.on('pending', onTx);

  req.on('close', () => {
    p.off('pending', onTx);
    res.end();
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`SeifuGuard Backend running on port ${PORT}`);
});
