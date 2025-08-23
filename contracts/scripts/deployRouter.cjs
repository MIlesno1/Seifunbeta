const { ethers } = require('hardhat');

async function main() {
  const FACTORY = process.env.UNI_FACTORY_ADDRESS;
  const ROUTER = process.env.UNI_ROUTER_ADDRESS;
  const WSEI = process.env.WSEI_ADDRESS;
  if (!FACTORY || !ROUTER || !WSEI) {
    throw new Error('Set UNI_FACTORY_ADDRESS, UNI_ROUTER_ADDRESS, and WSEI_ADDRESS');
  }
  const Registry = await ethers.getContractFactory('DeployableRouterRegistry');
  const registry = await Registry.deploy(FACTORY, ROUTER, WSEI);
  await registry.waitForDeployment();
  const addr = await registry.getAddress();
  console.log('Registry deployed:', addr);
  console.log('FACTORY=', FACTORY);
  console.log('ROUTER=', ROUTER);
  console.log('WSEI=', WSEI);
}

main().catch((e) => { console.error(e); process.exit(1); });