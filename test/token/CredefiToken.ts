import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { CredefiToken } from "../../typechain/CredefiToken";
import { shouldBehaveLikeErc20 } from "./CredefiToken.behavior";
import { Signers } from "../types";

describe("Credefi Token", function () {
  before(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    this.signers = {} as Signers;
    this.signers.admin = signers[0];
    this.signers.sender = signers[1];
    this.signers.receiver = signers[2];

    const initialMinter: string = this.signers.admin.address;

    const credefiTokenFactory = await ethers.getContractFactory("CredefiToken");
    this.crediToken = <CredefiToken>await credefiTokenFactory.deploy(initialMinter);
  });

  shouldBehaveLikeErc20();
});
