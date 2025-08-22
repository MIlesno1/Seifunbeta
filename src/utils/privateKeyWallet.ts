import { privateKeyWallet } from '../services/PrivateKeyWallet';

export const usePrivateKeyWallet = () => {
	return {
		address: privateKeyWallet.isConnected() ? privateKeyWallet.getAddress() : '',
		getBalance: () => privateKeyWallet.getSeiBalance().then(b => b.sei),
		getSigner: () => privateKeyWallet.getSigner(),
		sendTransaction: (tx: any) => privateKeyWallet.getSigner().sendTransaction(tx).then(t => t.hash),
		isConnected: privateKeyWallet.isConnected(),
		walletType: 'Private Key',
		importPrivateKey: (pk: string) => privateKeyWallet.importPrivateKey(pk),
		importMnemonic: (m: string) => privateKeyWallet.importMnemonic(m),
		createNewWallet: (persist = true) => privateKeyWallet.createNewWallet(persist),
		setRpcUrl: (rpc: string) => privateKeyWallet.setRpcUrl(rpc)
	};
};