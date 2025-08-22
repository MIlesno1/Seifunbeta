const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deployer:', await deployer.getAddress());

  // Deploy UniswapV2Factory
  const Factory = await ethers.getContractFactory('UniswapV2Factory');
  const factory = await Factory.deploy(await deployer.getAddress());
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log('Factory:', factoryAddr);

  // Deploy WSEI9 (WETH9 compatible)
  const WSEI = await ethers.getContractFactory('WSEI9');
  const wsei = await WSEI.deploy();
  await wsei.waitForDeployment();
  const wseiAddr = await wsei.getAddress();
  console.log('WSEI:', wseiAddr);

  // Deploy UniswapV2Router02
  const Router = await ethers.getContractFactory('UniswapV2Router02');
  const router = await Router.deploy(factoryAddr, wseiAddr);
  await router.waitForDeployment();
  const routerAddr = await router.getAddress();
  console.log('Router:', routerAddr);

  // Deploy a simple ERC20 as USDC test token (use fully qualified name)
  const ERC20 = await ethers.getContractFactory('contracts/SimpleToken.sol:SimpleToken');
  const usdc = await ERC20.deploy('Test USDC', 'USDC', 6); // 6 decimals
  await usdc.waitForDeployment();
  const usdcAddr = await usdc.getAddress();
  console.log('USDC:', usdcAddr);

  console.log('\nENV exports:');
  console.log(`VITE_SEI_TESTNET_ROUTER=${routerAddr}`);
  console.log(`VITE_SEI_TESTNET_WSEI=${wseiAddr}`);
  console.log(`VITE_SEI_TESTNET_USDC=${usdcAddr}`);
}

main().catch((e) => { console.error(e); process.exit(1); });