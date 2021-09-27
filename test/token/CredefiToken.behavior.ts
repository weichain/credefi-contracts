import { expect } from "chai";

import { keccak256 } from "@ethersproject/keccak256";
import { splitSignature, hexlify } from "@ethersproject/bytes";
import { BigNumber } from "@ethersproject/bignumber";
import { defaultAbiCoder } from "@ethersproject/abi";
import { toUtf8Bytes } from "@ethersproject/strings";
import { AddressZero, MaxUint256 } from "@ethersproject/constants";
import { expandTo18Decimals, getPermitData } from "./utils";

const MINT_AMOUNT = expandTo18Decimals(10000);
const TEST_AMOUNT = expandTo18Decimals(100);

export function shouldBehaveLikeErc20(): void {
  it("name, symbol, decimals, totalSupply, DOMAIN_SEPARATOR, PERMIT_TYPEHASH", async function () {
    const tokenVersion = "1";
    const name = await this.crediToken.name();
    const chainId = await this.crediToken.getChainId();

    expect(name).to.eq("Credi");
    expect(await this.crediToken.symbol()).to.eq("CREDI");
    expect(await this.crediToken.decimals()).to.eq(18);
    expect(await this.crediToken.totalSupply()).to.eq(0);
    expect(await this.crediToken.getDomainSeparator()).to.eq(
      keccak256(
        defaultAbiCoder.encode(
          ["bytes32", "bytes32", "bytes32", "uint256", "address"],
          [
            keccak256(
              toUtf8Bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            ),
            keccak256(toUtf8Bytes(name)),
            keccak256(toUtf8Bytes(tokenVersion)),
            chainId.toNumber(),
            this.crediToken.address,
          ],
        ),
      ),
    );
    expect(await this.crediToken.PERMIT_TYPEHASH()).to.eq(
      keccak256(toUtf8Bytes("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)")),
    );
  });

  it("mint", async function () {
    const { admin, sender } = this.signers;

    await expect(this.crediToken.connect(admin).mint(sender.address, MINT_AMOUNT))
      .to.emit(this.crediToken, "Transfer")
      .withArgs(AddressZero, sender.address, MINT_AMOUNT);

    expect(await this.crediToken.totalSupply()).to.eq(MINT_AMOUNT);
    expect(await this.crediToken.balanceOf(sender.address)).to.eq(MINT_AMOUNT);
  });

  it("approve", async function () {
    const { sender, receiver } = this.signers;

    await expect(this.crediToken.connect(sender).approve(receiver.address, TEST_AMOUNT))
      .to.emit(this.crediToken, "Approval")
      .withArgs(sender.address, receiver.address, TEST_AMOUNT);
    expect(await this.crediToken.allowance(sender.address, receiver.address)).to.eq(TEST_AMOUNT);
  });

  it("transfer", async function () {
    const { sender, receiver } = this.signers;

    await expect(this.crediToken.connect(sender).transfer(receiver.address, TEST_AMOUNT))
      .to.emit(this.crediToken, "Transfer")
      .withArgs(sender.address, receiver.address, TEST_AMOUNT);
    expect(await this.crediToken.balanceOf(sender.address)).to.eq(MINT_AMOUNT.sub(TEST_AMOUNT));
    expect(await this.crediToken.balanceOf(receiver.address)).to.eq(TEST_AMOUNT);
  });

  it("transfer:fail", async function () {
    const { sender, receiver } = this.signers;
    const senderBalance = await this.crediToken.balanceOf(sender.address);
    const receiverBalance = await this.crediToken.balanceOf(receiver.address);

    await expect(this.crediToken.connect(sender).transfer(receiver.address, senderBalance.add(1))).to.be.reverted; // ds-math-sub-underflow
    await expect(this.crediToken.connect(receiver).transfer(sender.address, receiverBalance.add(1))).to.be.reverted; // ds-math-sub-underflow
  });

  it("transferFrom", async function () {
    const { sender, receiver } = this.signers;

    const senderBalance = await this.crediToken.balanceOf(sender.address);
    const receiverBalance = await this.crediToken.balanceOf(receiver.address);

    await this.crediToken.approve(receiver.address, TEST_AMOUNT);
    await expect(this.crediToken.connect(receiver).transferFrom(sender.address, receiver.address, TEST_AMOUNT))
      .to.emit(this.crediToken, "Transfer")
      .withArgs(sender.address, receiver.address, TEST_AMOUNT);

    expect(await this.crediToken.allowance(sender.address, receiver.address)).to.eq(0);
    expect(await this.crediToken.balanceOf(sender.address)).to.eq(senderBalance.sub(TEST_AMOUNT));
    expect(await this.crediToken.balanceOf(receiver.address)).to.eq(receiverBalance.add(TEST_AMOUNT));
  });

  it("transferFrom:max", async function () {
    const { sender, receiver } = this.signers;

    const senderBalance = await this.crediToken.balanceOf(sender.address);
    const receiverBalance = await this.crediToken.balanceOf(receiver.address);

    await this.crediToken.connect(sender).approve(receiver.address, MaxUint256);
    await expect(this.crediToken.connect(receiver).transferFrom(sender.address, receiver.address, TEST_AMOUNT))
      .to.emit(this.crediToken, "Transfer")
      .withArgs(sender.address, receiver.address, TEST_AMOUNT);
    expect(await this.crediToken.allowance(sender.address, receiver.address)).to.eq(MaxUint256);
    expect(await this.crediToken.balanceOf(sender.address)).to.eq(senderBalance.sub(TEST_AMOUNT));
    expect(await this.crediToken.balanceOf(receiver.address)).to.eq(receiverBalance.add(TEST_AMOUNT));
  });

  it("permit", async function () {
    const { sender, receiver } = this.signers;

    const nonce = await this.crediToken.nonces(sender.address);
    const deadline = MaxUint256;

    const permitData = await getPermitData(
      this.crediToken,
      { owner: sender.address, spender: receiver.address, value: TEST_AMOUNT },
      nonce,
      deadline,
    );

    const signature = await sender._signTypedData(permitData.domain, permitData.types, permitData.value);
    const { v, r, s } = splitSignature(signature);

    await expect(
      this.crediToken.permit(sender.address, receiver.address, TEST_AMOUNT, deadline, v, hexlify(r), hexlify(s)),
    )
      .to.emit(this.crediToken, "Approval")
      .withArgs(sender.address, receiver.address, TEST_AMOUNT);

    expect(await this.crediToken.allowance(sender.address, receiver.address)).to.eq(TEST_AMOUNT);
    expect(await this.crediToken.nonces(sender.address)).to.eq(BigNumber.from(1));
  });
}
