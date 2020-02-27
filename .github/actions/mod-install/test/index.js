const yaml = require("js-yaml");
const { doInstall } = require("../install");

testInstall();

async function testInstall() {
  const credentials = {
    pixie: {
      accessKey: "750299d5-051b-40ab-8e90-a954fff7d8bf",
      secretKey: "90fc8da7-8489-4d0f-a2a3-c0b0de3f3c0b",
      workspace: "pixie-turbot.putney.turbot.io"
    },
    staging: {
      accessKey: "b68c6d38-7fa0-4728-95ee-35d673b418ab",
      secretKey: "6d09198c-a90a-42de-a47e-d64e5a985096",
      workspace: "zaphod-turbot.cloud.turbot-stg.com"
    }
  };
  const res = await doInstall("aws-s3", "5.1.2", credentials.pixie, 900);
  console.log(`final result ${yaml.safeDump(res)}`);
}
