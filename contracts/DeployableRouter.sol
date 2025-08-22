// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DeployableRouterRegistry {
	address public factory;
	address public router;
	address public wsei;
	address public owner;

	event RegistryUpdated(address factory, address router, address wsei);

	constructor(address _factory, address _router, address _wsei) {
		owner = msg.sender;
		factory = _factory;
		router = _router;
		wsei = _wsei;
		emit RegistryUpdated(factory, router, wsei);
	}

	function update(address _factory, address _router, address _wsei) external {
		require(msg.sender == owner, "not owner");
		factory = _factory;
		router = _router;
		wsei = _wsei;
		emit RegistryUpdated(factory, router, wsei);
	}
}