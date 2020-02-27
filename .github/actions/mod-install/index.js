const core = require("@actions/core");
// const core = {
//   getInput: field => {
//     switch (field){
//       case "mod":
//         return "aws-ecs";
//       case "version":
//         return "5.0.1-rc.20200225085459811"
//       case "secretKey":
//         return "6d09198c-a90a-42de-a47e-d64e5a985096"
//       case "accessKey":
//         return "b68c6d38-7fa0-4728-95ee-35d673b418ab"
//       case "workspace":
//         return "zaphod-turbot.cloud.turbot-stg.com"
//     }
//   },
//   setFailed: ()=>{}
// }

const yaml = require("js-yaml");
const fs = require("fs-extra");
const path = require("path");
var exec = require("child-process-promise").exec;
const pluralize = require("pluralize");


const mod = core.getInput("mod");
const version = core.getInput("version");
const timeout = core.getInput("timeout") || 600;
const credentials = {
  secretKey: core.getInput("secretKey"),
  accessKey: core.getInput("accessKey"),
  workspace: core.getInput("workspace")
};

main(mod, version, credentials, timeout);

async function main(mod, version, credentials, timeout) {
  const res = await doInstall(mod, version, credentials, timeout);
  if (!res.success) {
    core.setFailed(res.error);
  }
}


async function doInstall(mod, version, credentials, timeout) {
  try {
    console.log("Starting install");
    const installResult = await installMod(mod, version, credentials, timeout);
    console.log("Mod installed, waiting for installed control");
    const waitResult = await waitForInstall(
      installResult.mod.turbot.id,
      version,
      credentials,
      timeout
    );
    console.log("waitForInstall returned")
    if (!waitResult || !waitResult.complete) {
      return {
        success: false,
        error: `Timed out. Following controls incomplete:\n\t${waitResult.incompleteControls.join(
          "\t\n"
        )}`
      };
    }
    if ((waitResult.failedControls || []).length > 0) {
      return {
        success: false,
        error: `Following controls failed:\n\t${waitResult.failedControls.map(c => yaml.safeDump(c)).join(
          "\t\n"
        )}`
      };
    }

    console.log("All controls complete! Mod is installed...");

    return { success: true };
  } catch (error) {
    console.log(`exception: ${error.message}`)
    return {
      success: false,
      error: error.message
    };
  }
}

async function installMod(mod, version, credentials) {
  const query = `
mutation InstallMod($input: InstallModInput!) 
{ 
  mod: installMod(input: $input) 
  { 
    turbot { 
      id 

    }
  }
}`;
  const variables = {
    input: {
      parent: "tmod:@turbot/turbot#/",
      org: "turbot",
      mod,
      version
    }
  };

  const queryPath = "/tmp/query";
  const variablesPath = "/tmp/variables.yml";
  await fs.writeFile(queryPath, query);
  await fs.writeFile(variablesPath, yaml.safeDump(variables));
  const { accessKey, secretKey, workspace } = credentials;

  const command = `/tmp/turbot graphql --query "${queryPath}" --variables "${
    variablesPath}" --access-key "${accessKey}" --secret-key "${secretKey}" --workspace "${workspace}"`;

  console.log(command)
  const result = await exec(command);

  console.log("Parsing result....")

  let parsedResult
  try {
    parsedResult = yaml.safeLoad(result.stdout);
  } catch (err){
    console.log(`failed to parse graphql output: ${result.stdout}`)
  }
  return parsedResult;
}

async function waitForInstall(modId, version, credentials, timeout = 600) {
  const intervalSecs = 5;
  let retries = timeout / intervalSecs;
  let result;
  while (retries--) {
    const modStatus = await getModInstallStatus(modId, credentials);
    result = modInstallComplete(modStatus.mod, version, credentials.workspace);
    if (result.complete) {
      return result;
    }
    const incomplete = result.incompleteControls.length;
    console.log(
      `${incomplete} ${pluralize(
        "control",
        incomplete
      )} incomplete - retrying for up to ${retries * intervalSecs} seconds`
    );
    await sleep(5000);
  }

  console.log(
    `Timed out after ${timeout} seconds waiting for query to return expected result. ${yaml.safeDump(
      result
    )}`
  );
  return {
    complete: false,
    incompleteControls: result.incompleteControls
  };
}

async function getModInstallStatus(modId, credentials) {
  const query = `
{
  mod: resource(id: "${modId}") {
    title: get(path: "title")
    version: get(path: "version")
    build: get(path: "build")
    turbot {
      createTimestamp
      updateTimestamp
    }
    modInstalled: control(uri: "tmod:@turbot/turbot#/control/types/modInstalled") {
      state
      type {
        title
      }
      turbot {
        id
      }
      lastProcess {
        turbot {
          createTimestamp
        }
        state
      }
    }
    controlInstalled: controls(filter: "controlType:controlInstalled limit:400") {
      items {
        state
        turbot {
          id 
        }
        lastProcess {
          turbot {
            createTimestamp
          }
          state
        }
      }
    }
  }
}
`;

  const queryPath = "/tmp/query";
  const variablesPath = "/tmp/variables.yml";
  await fs.writeFile(queryPath, query);

  const { accessKey, secretKey, workspace } = credentials;

  const result = (
    await exec(
      `/tmp/turbot graphql --query "${queryPath}" --variables "${variablesPath}" --access-key "${accessKey}" --secret-key "${secretKey}" --workspace "${workspace}"`
    )
  ).stdout;
  const parsedResult = yaml.safeLoad(result);
  return parsedResult;
}

function controlUrl(workspace, control) {
  if (!control) {
    throw Error("controlUrl null control");
  }
  return path.join(workspace, "control", control.turbot.id);
}

function modInstallComplete(modStatus, version, workspace) {
  // mod status looks as follows
  /*
{
  "title": "@turbot/aws-amplify",
  "version": "5.0.0-beta.4",
  "build": "20200218121059760",
  "modInstalled": {
    "state": "ok",
    "reason": null,
    "lastProcess": {
      "turbot": {
        "createTimestamp": "2020-02-18T12:13:17.382Z"
      },
      "state": "terminated"
    }
  },
  "controlInstalled": {
    "items": [
      {
        "state": "ok",
        "reason": null,
        "resource": {
          "type": {
            "title": "Policy Type"
          }
        },
        "lastProcess": {
          "turbot": {
            "createTimestamp": "2020-02-18T12:13:15.022Z"
          },
          "state": "terminated"
        }
      }
      ...
    ]
  }
}
   */

  /* Checks:
  1) Mod version is correct
  2) All 'installed' controls:
     - timestamp >= mod update timestamp
     - terminated
     - in OK state
   */

  // check all installed controls for completion
  if (!modStatus) {
    throw Error("No modStatus was returned");
  }


  // Mod version is correct
  if (modStatus.version !== version) {
    console.log(`Mod version has not been updated yet. Mod status version is ${modStatus.version}, we are waiting for ${version}`);
    console.log(modStatus.version);
    console.log(version);
    console.log(`modStatus.version !== version: ${modStatus.version !== version}`)
    console.log(yaml.safeDump(modStatus));
    return { complete: false, incompleteControls: [] };
  }

  console.log("Valid mod status returned")
  const modCreateTimestamp = new Date(modStatus.turbot.createTimestamp);
  const incompleteControls = [];
  const failedControls = [];
  for (const control of [
    modStatus.modInstalled,
    ...modStatus.controlInstalled.items
  ]) {
    const result = controlComplete(control, modCreateTimestamp, workspace);
    if (!result.complete) {
      incompleteControls.push({
        controlUrl: controlUrl(workspace, control)
      });
    }
    if (result.failedControl) {
      failedControls.push(result.failedControl);
    }
  }

  const complete = incompleteControls.length === 0;
  return { complete, incompleteControls, failedControls };
}

function controlComplete(control, modCreateTimestamp, workspace) {
  if (!control.lastProcess) {
    return { complete: false };
  }
  const controlTimestamp = new Date(control.lastProcess.turbot.createTimestamp);

  if (controlTimestamp < modCreateTimestamp) {
    return { complete: false };
  }
  if (control.lastProcess.state != "terminated") {
    return { complete: false };
  }
  if (control.state != "ok") {
    // this is fatal so set complete to true
    return {
      complete: true,
      failedControl: {
        controlState: control.state,
        controlUrl: controlUrl(workspace, control)
      }
    };
  }
  return { complete: true };
}
const sleep = milliseconds => {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
};
module.exports = { doInstall };
