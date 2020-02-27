const {
  getNewModVersion,
  releaseLevelFromIssues,
  getInspectData,
  resolveReleaseLevel,
  parseIssueNumbers,
  getReleaseNoteIssueNumbers,
  getReleaseNoteData
} = require("..");

let result;

console.log("getNumbers - base");
result = parseIssueNumbers("#123 #45 #6 #789");
console.log(result + "\n");

console.log("getNewModVersion - no current version");
result = getNewModVersion("1.0.0", "1.0.0-blah", "minor");
console.log(result + "\n");

console.log("releaseLevelFromIssues - minor type");
result = releaseLevelFromIssues([{ levels: ["patch"] }, { levels: ["minor"] }, { levels: ["patch"] }]);
console.log(result + "\n");

console.log("getInspectData - base");
result = getInspectData(
  [
    {
      "Item Type": "Policy Type",
      Path: "AWS > ACM > Certificate > CMDB",
      Uri: "tmod:@turbot/aws-acm/policy/types/certificateCmdb"
    },
    {
      "Item Type": "Control Type",
      Path: "AWS > ACM > Certificate > Active",
      Uri: "tmod:@turbot/aws-acm/control/types/certificateActive"
    },
    {
      "Item Type": "Control Type",
      Path: "AWS > ACM > Certificate > CMDB",
      Uri: "tmod:@turbot/aws-acm/control/types/certificateCmdb"
    },
    {
      "Item Type": "Resource Type",
      Path: "AWS > ACM > Certificate",
      Uri: "tmod:@turbot/aws-acm/resource/types/certificate"
    }
  ],
  [
    {
      "Item Type": "Policy Type",
      Path: "AWS > ACM > Certificate > CMDB",
      Uri: "tmod:@turbot/aws-acm/policy/types/certificateCmdb"
    },
    {
      "Item Type": "Policy Type",
      Path: "AWS > ACM > Certificate > Old CMDB",
      Uri: "tmod:@turbot/aws-acm/policy/types/certificateOldCmdb"
    },
    {
      "Item Type": "Resource Type",
      Path: "AWS > ACM > Cert",
      Uri: "tmod:@turbot/aws-acm/resource/types/certificate"
    }
  ]
);
console.log(result + "\n");

console.log("resolveReleaseLevel - minor type");
result = resolveReleaseLevel(["patch", "minor", "minor"]);
console.log(result + "\n");
