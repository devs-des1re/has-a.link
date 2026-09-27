import t from "ava";

import { files, getDomainData } from "./helpers.js";

const requiredRecordsToProxy = new Set(["A", "AAAA", "CNAME"]);

function validateProxiedRecords(t, data, file) {
  const recordTypes = Array.from(requiredRecordsToProxy).join(", ");

  if (file === "raw.json") {
    t.true(!data.proxied, `${file}: raw.has-a.link cannot be proxied`);
    return;
  }

  if (data.proxied) {
    const hasProxiedRecord = Object.keys(data.records).some((key) => requiredRecordsToProxy.has(key));

    t.true(
      hasProxiedRecord,
      `${file}: Proxied is true but there are no records that can be proxied (${recordTypes} expected)`
    );
  }
}

t("Domains with proxy enabled must have at least one proxy-able record", (t) => {
  files.forEach((file) => {
    const data = getDomainData(file);
    validateProxiedRecords(t, data, file);
  });
});
