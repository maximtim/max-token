import * as hre from "hardhat";
import mnm from "minimist";

async function main() {
  var argv = mnm(process.argv.slice(2));

  await hre.run('compile');
  await hre.run('token-deploy', { 
    sender: argv['signer'] !== undefined ? argv['signer'].toString() : "0",
    supply: argv['supply'].toString(),
    name: argv['name'].toString(),
    symbol: argv['symbol'].toString(),
    decimals: argv['decimals'].toString()
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
