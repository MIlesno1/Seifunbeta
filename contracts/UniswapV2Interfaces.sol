// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IUniswapV2Factory {
	function createPair(address tokenA, address tokenB) external returns (address pair);
	function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IUniswapV2Router02 {
	function factory() external view returns (address);
	function WETH() external view returns (address);
	function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
	function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts);
	function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts);
}

interface IWSEI {
	function deposit() external payable;
	function withdraw(uint) external;
}