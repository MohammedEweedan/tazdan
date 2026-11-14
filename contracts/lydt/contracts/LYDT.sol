// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title LYDT — one token per Libyan dinar held at the Central Bank of Libya.
/// @notice Designed for a permissioned network the CBL operates. tazdan issues;
///         the CBL supervises and can take issuance over (the CBDC path).
///
/// Roles
///   DEFAULT_ADMIN_ROLE  CBL. Grants and revokes every role, including
///                       ISSUER_ROLE: granting it to itself and revoking it
///                       from tazdan turns LYDT into a CBL-issued dinar.
///   SUPERVISOR_ROLE     CBL. Pauses issuance and transfers, freezes holders,
///                       sets the per-holder cap and the statement age limit.
///   ATTESTER_ROLE       CBL. Records the reserve account balance.
///   ISSUER_ROLE         tazdan. Issues within the attested reserve and
///                       registers verified (KYC'd) holders.
///
/// Guarantees enforced on every state change
///   - supply never exceeds the latest attested reserve, and nothing is issued
///     on a statement older than maxAttestationAge
///   - only verified, unfrozen holders receive; frozen holders cannot move
///     or redeem
///   - no holder exceeds holdingCap (0 = no cap)
///   - pausing stops issuance and transfers, never redemption
contract LYDT is ERC20, AccessControl, Pausable {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant SUPERVISOR_ROLE = keccak256("SUPERVISOR_ROLE");
    bytes32 public constant ATTESTER_ROLE = keccak256("ATTESTER_ROLE");

    /// Reserve balance in millimes (3 decimals, like the token).
    uint256 public attestedReserve;
    /// Time of the statement behind attestedReserve.
    uint64 public attestedAt;
    uint64 public maxAttestationAge;
    uint256 public holdingCap;

    mapping(address => bool) public verified;
    mapping(address => bool) public frozen;

    event ReserveAttested(uint256 balance, uint64 statementTime, string ref);
    event HolderVerified(address indexed holder, bool verified);
    event HolderFrozen(address indexed holder, bool frozen, string reason);
    event HoldingCapSet(uint256 cap);
    event MaxAttestationAgeSet(uint64 maxAge);
    event Issued(address indexed to, uint256 amount, string ref);
    event Redeemed(address indexed from, uint256 amount, string ref);

    error NotVerified(address holder);
    error Frozen(address holder);
    error ExceedsReserve(uint256 supplyAfter, uint256 reserve);
    error StaleAttestation(uint64 attestedAt);
    error FutureStatement(uint64 statementTime);
    error ExceedsHoldingCap(address holder, uint256 balanceAfter, uint256 cap);

    constructor(address centralBank, address issuer, uint64 maxAgeSeconds, uint256 cap)
        ERC20("Libyan Dinar Token", "LYDT")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, centralBank);
        _grantRole(SUPERVISOR_ROLE, centralBank);
        _grantRole(ATTESTER_ROLE, centralBank);
        _grantRole(ISSUER_ROLE, issuer);
        maxAttestationAge = maxAgeSeconds;
        holdingCap = cap;
    }

    /// Dinars have 1,000 millimes.
    function decimals() public pure override returns (uint8) {
        return 3;
    }

    // ── Reserve ────────────────────────────────────────────────────────
    function attestReserve(uint256 balance, uint64 statementTime, string calldata ref)
        external
        onlyRole(ATTESTER_ROLE)
    {
        if (statementTime > block.timestamp) revert FutureStatement(statementTime);
        attestedReserve = balance;
        attestedAt = statementTime;
        emit ReserveAttested(balance, statementTime, ref);
    }

    // ── Issuance and redemption ────────────────────────────────────────
    function issue(address to, uint256 amount, string calldata ref)
        external
        onlyRole(ISSUER_ROLE)
        whenNotPaused
    {
        if (attestedAt == 0 || block.timestamp - attestedAt > maxAttestationAge) revert StaleAttestation(attestedAt);
        uint256 supplyAfter = totalSupply() + amount;
        if (supplyAfter > attestedReserve) revert ExceedsReserve(supplyAfter, attestedReserve);
        _mint(to, amount);
        emit Issued(to, amount, ref);
    }

    /// The holder returns tokens; the issuer pays the same dinars against
    /// `ref` (the holder's tazdan account or bank details).
    function redeem(uint256 amount, string calldata ref) external {
        _burn(msg.sender, amount);
        emit Redeemed(msg.sender, amount, ref);
    }

    // ── Holder registry ────────────────────────────────────────────────
    function setVerified(address holder, bool isVerified) external onlyRole(ISSUER_ROLE) {
        verified[holder] = isVerified;
        emit HolderVerified(holder, isVerified);
    }

    // ── Supervisor powers ──────────────────────────────────────────────
    function setFrozen(address holder, bool isFrozen, string calldata reason) external onlyRole(SUPERVISOR_ROLE) {
        frozen[holder] = isFrozen;
        emit HolderFrozen(holder, isFrozen, reason);
    }

    function setHoldingCap(uint256 cap) external onlyRole(SUPERVISOR_ROLE) {
        holdingCap = cap;
        emit HoldingCapSet(cap);
    }

    function setMaxAttestationAge(uint64 maxAge) external onlyRole(SUPERVISOR_ROLE) {
        maxAttestationAge = maxAge;
        emit MaxAttestationAgeSet(maxAge);
    }

    function pause() external onlyRole(SUPERVISOR_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(SUPERVISOR_ROLE) {
        _unpause();
    }

    // ── Rules on every balance change ─────────────────────────────────
    function _update(address from, address to, uint256 value) internal override {
        bool redemption = to == address(0);
        // Pausing stops issuance and transfers; redemption always works.
        if (!redemption && paused()) revert EnforcedPause();
        if (from != address(0)) {
            if (frozen[from]) revert Frozen(from);
            // A holder whose verification lapsed can still redeem, not send.
            if (!redemption && !verified[from]) revert NotVerified(from);
        }
        if (!redemption) {
            if (!verified[to]) revert NotVerified(to);
            if (frozen[to]) revert Frozen(to);
        }
        super._update(from, to, value);
        if (!redemption && holdingCap != 0 && balanceOf(to) > holdingCap) {
            revert ExceedsHoldingCap(to, balanceOf(to), holdingCap);
        }
    }
}
