const { expect } = require('chai');
const { ethers, network } = require('hardhat');

const DAY = 24 * 3600;
const LYD = (n) => BigInt(Math.round(n * 1000)); // millimes

/** Hardhat reports custom errors by name in the revert message. */
async function reverts(promise, name) {
  try {
    await promise;
  } catch (err) {
    expect(String(err.message)).to.include(name);
    return;
  }
  expect.fail(`expected revert ${name}`);
}

async function now() {
  return (await ethers.provider.getBlock('latest')).timestamp;
}

async function travel(seconds) {
  await network.provider.send('evm_increaseTime', [seconds]);
  await network.provider.send('evm_mine');
}

describe('LYDT', () => {
  let token, cbl, tazdan, alice, bob, mallory;

  beforeEach(async () => {
    [cbl, tazdan, alice, bob, mallory] = await ethers.getSigners();
    const LYDT = await ethers.getContractFactory('LYDT');
    token = await LYDT.deploy(cbl.address, tazdan.address, 2 * DAY, LYD(10_000));
    await token.connect(tazdan).setVerified(alice.address, true);
    await token.connect(tazdan).setVerified(bob.address, true);
  });

  const attest = async (amount, ageSeconds = 3600) =>
    token.connect(cbl).attestReserve(LYD(amount), (await now()) - ageSeconds, `CBL-STMT-${amount}`);

  it('is a 3-decimal dinar token with the CBL as admin', async () => {
    expect(await token.symbol()).to.equal('LYDT');
    expect(await token.decimals()).to.equal(3n);
    expect(await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), cbl.address)).to.equal(true);
    expect(await token.hasRole(await token.ISSUER_ROLE(), tazdan.address)).to.equal(true);
    expect(await token.hasRole(await token.SUPERVISOR_ROLE(), tazdan.address)).to.equal(false);
  });

  it('issues nothing before the CBL attests a reserve', async () => {
    await reverts(token.connect(tazdan).issue(alice.address, LYD(10), 'X'), 'StaleAttestation');
  });

  it('only the CBL can attest the reserve, and never with a future date', async () => {
    await reverts(token.connect(tazdan).attestReserve(LYD(1000), await now(), 'X'), 'AccessControlUnauthorizedAccount');
    await reverts(token.connect(cbl).attestReserve(LYD(1000), (await now()) + 3600, 'X'), 'FutureStatement');
  });

  it('never issues beyond the attested reserve', async () => {
    await attest(1000);
    await token.connect(tazdan).issue(alice.address, LYD(600.5), 'ISS-1');
    expect(await token.balanceOf(alice.address)).to.equal(LYD(600.5));
    await reverts(token.connect(tazdan).issue(bob.address, LYD(400), 'ISS-2'), 'ExceedsReserve');
    await token.connect(tazdan).issue(bob.address, LYD(399.5), 'ISS-3');
    expect(await token.totalSupply()).to.equal(LYD(1000));
  });

  it('stops issuing on a stale statement', async () => {
    await attest(1000);
    await travel(3 * DAY);
    await reverts(token.connect(tazdan).issue(alice.address, LYD(1), 'X'), 'StaleAttestation');
  });

  it('only tazdan issues, and only to verified holders', async () => {
    await attest(1000);
    await reverts(token.connect(mallory).issue(mallory.address, LYD(1), 'X'), 'AccessControlUnauthorizedAccount');
    await reverts(token.connect(tazdan).issue(mallory.address, LYD(1), 'X'), 'NotVerified');
  });

  it('moves between verified holders only', async () => {
    await attest(1000);
    await token.connect(tazdan).issue(alice.address, LYD(100), 'ISS');
    await token.connect(alice).transfer(bob.address, LYD(25.25));
    expect(await token.balanceOf(bob.address)).to.equal(LYD(25.25));
    await reverts(token.connect(alice).transfer(mallory.address, LYD(1)), 'NotVerified');
  });

  it('a frozen holder cannot send, receive or redeem', async () => {
    await attest(1000);
    await token.connect(tazdan).issue(alice.address, LYD(100), 'ISS');
    await reverts(token.connect(tazdan).setFrozen(alice.address, true, 'x'), 'AccessControlUnauthorizedAccount');
    await token.connect(cbl).setFrozen(alice.address, true, 'court order');
    await reverts(token.connect(alice).transfer(bob.address, LYD(1)), 'Frozen');
    await reverts(token.connect(alice).redeem(LYD(1), 'R'), 'Frozen');
    await token.connect(cbl).setFrozen(bob.address, true, 'review');
    await token.connect(cbl).setFrozen(alice.address, false, 'cleared');
    await reverts(token.connect(alice).transfer(bob.address, LYD(1)), 'Frozen');
  });

  it('pausing stops issuance and transfers, never redemption', async () => {
    await attest(1000);
    await token.connect(tazdan).issue(alice.address, LYD(100), 'ISS');
    await token.connect(cbl).pause();
    await reverts(token.connect(tazdan).issue(alice.address, LYD(1), 'X'), 'EnforcedPause');
    await reverts(token.connect(alice).transfer(bob.address, LYD(1)), 'EnforcedPause');
    await token.connect(alice).redeem(LYD(40), 'to tazdan wallet');
    expect(await token.balanceOf(alice.address)).to.equal(LYD(60));
    expect(await token.totalSupply()).to.equal(LYD(60));
  });

  it('a holder whose verification lapsed can still redeem', async () => {
    await attest(1000);
    await token.connect(tazdan).issue(alice.address, LYD(50), 'ISS');
    await token.connect(tazdan).setVerified(alice.address, false);
    await reverts(token.connect(alice).transfer(bob.address, LYD(1)), 'NotVerified');
    await token.connect(alice).redeem(LYD(50), 'R');
    expect(await token.balanceOf(alice.address)).to.equal(0n);
  });

  it('enforces the per-holder cap the CBL sets', async () => {
    await attest(50_000);
    await reverts(token.connect(tazdan).issue(alice.address, LYD(10_000.001), 'X'), 'ExceedsHoldingCap');
    await token.connect(tazdan).issue(alice.address, LYD(9_000), 'ISS');
    await token.connect(tazdan).issue(bob.address, LYD(9_000), 'ISS');
    await reverts(token.connect(alice).transfer(bob.address, LYD(1_500)), 'ExceedsHoldingCap');
    await token.connect(cbl).setHoldingCap(0);
    await token.connect(alice).transfer(bob.address, LYD(1_500));
  });

  it('the CBL can take over issuance — the CBDC path', async () => {
    await attest(1000);
    const ISSUER = await token.ISSUER_ROLE();
    await reverts(token.connect(tazdan).grantRole(await token.SUPERVISOR_ROLE(), tazdan.address), 'AccessControlUnauthorizedAccount');
    await token.connect(cbl).grantRole(ISSUER, cbl.address);
    await token.connect(cbl).revokeRole(ISSUER, tazdan.address);
    await reverts(token.connect(tazdan).issue(alice.address, LYD(1), 'X'), 'AccessControlUnauthorizedAccount');
    await token.connect(cbl).issue(alice.address, LYD(10), 'CBL-ISS-1');
    expect(await token.balanceOf(alice.address)).to.equal(LYD(10));
  });
});
