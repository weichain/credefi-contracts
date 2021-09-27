import { task } from "hardhat/config";
import { TaskArguments } from "hardhat/types";

import { CredefiToken, CredefiToken__factory, CredefiTimelock, CredefiTimelock__factory } from "../../typechain";

task("deploy:Token")
  .addParam("delay")
  .addParam("multisig")
  .setAction(async function (taskArguments: TaskArguments, { ethers }) {
    // Timelock
    const timelockFactory: CredefiTimelock__factory = await ethers.getContractFactory("CredefiTimelock");
    const timelock: CredefiTimelock = <CredefiTimelock>(
      await timelockFactory.deploy(taskArguments.delay, [taskArguments.multisig], [taskArguments.multisig])
    );
    await timelock.deployed();
    console.log("Timelock deployed to: ", timelock.address);

    // Token
    const tokenFactory: CredefiToken__factory = await ethers.getContractFactory("CredefiToken");
    const token: CredefiToken = <CredefiToken>await tokenFactory.deploy(timelock.address);
    await token.deployed();
    console.log("Token deployed to: ", token.address);
  });
