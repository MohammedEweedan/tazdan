require('@nomicfoundation/hardhat-ethers');

/** Local chain only: LYDT is not deployed anywhere until the CBL authorises it. */
module.exports = {
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun' },
  },
};
