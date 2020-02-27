const { readJsonFile, renderFile } = require("..");

const releaseNoteData = {
  date: "2020-02-26T02:48:30.741Z",
  version: "5.1.0-rc.20200215",
  notes: {
    level: "minor",
    "Bug fixes": [
      "Bucket tag updates are now recorded in CMDB properly.",
      "Bucket policy statements will not be checked for approval until the bucket's resource data is in CMDB."
    ],
    Security: ["First security notice", "Second security notice", "Third security notice"],
    Warning: [],
    "What's new?": ["Woof"],
    invalidNotes: []
  },
  details: {
    level: "major",
    "Resource Type": {
      added: [
        { "Item Type": "Resource Type", Path: "AWS > S3 > Object" },
        { "Item Type": "Resource Type", Path: "AWS > S3 > Account" }
      ],
      removed: [],
      renamed: [{ "Item Type": "Resource Type", Path: "AWS > S3 > Bucket", OldPath: "AWS > S3 > Old Bucket" }]
    },
    "Control Type": {
      added: [],
      removed: [
        { "Item Type": "Control Type", Path: "AWS > S3 > Old Bucket > CMDB" },
        { "Item Type": "Control Type", Path: "AWS > S3 > Old Bucket > Discovery" },
        { "Item Type": "Control Type", Path: "AWS > S3 > Old Bucket > Approved" }
      ],
      renamed: []
    },
    "Action Type": {
      added: [],
      removed: [],
      renamed: []
    },
    "Policy Type": {
      added: [
        { "Item Type": "Control Type", Path: "AWS > S3 > Bucket > CMDB" },
        { "Item Type": "Control Type", Path: "AWS > S3 > Bucket > Discovery" },
        { "Item Type": "Control Type", Path: "AWS > S3 > Bucket > Approved" }
      ],
      removed: [
        { "Item Type": "Control Type", Path: "AWS > S3 > Old Bucket > CMDB" },
        { "Item Type": "Control Type", Path: "AWS > S3 > Old Bucket > Discovery" },
        { "Item Type": "Control Type", Path: "AWS > S3 > Old Bucket > Approved" }
      ],
      renamed: []
    }
  }
};

const renderData = {};
renderData.releaseNotes = [];
renderData.releaseNotes.push(releaseNoteData);
renderData.releaseNotes.push(releaseNoteData);

let result;

console.log("renderFile - base");
result = renderFile("template.md", renderData);
console.log(result + "\n");
