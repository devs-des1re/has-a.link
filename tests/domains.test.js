import t from "ava";
import fs from "fs-extra";
import path from "path";

import { domainsPath, files, getDomainData } from "./helpers.js";

t("Nested subdomains should not exist without a parent subdomain", (t) => {
  files.forEach((file) => {
    const subdomain = file.replace(/\.json$/, "");
    const parts = subdomain.split(".");

    for (let i = 1; i < parts.length; i++) {
      const parent = parts.slice(i).join(".");
      if (parent.startsWith("_")) continue;

      t.true(files.includes(`${parent}.json`), `${file}: Parent subdomain "${parent}" does not exist`);
    }
  });

  t.pass();
});

t("Nested subdomains should be owned by the parent subdomain's owner", (t) => {
  files.forEach((file) => {
    const subdomain = file.replace(/\.json$/, "");
    const parentDomain = subdomain.split(".").reverse()[0];

    if (parentDomain !== subdomain) {
      const data = getDomainData(file);
      const parentData = getDomainData(`${parentDomain}.json`);

      t.true(
        data.owner.username.toLowerCase() === parentData.owner.username.toLowerCase(),
        `${file}: Owner does not match the parent subdomain`
      );
    }
  });

  t.pass();
});

t("Users are limited to one single character subdomain", (t) => {
  const results = [];

  files.forEach((file) => {
    const subdomain = file.replace(/\.json$/, "");
    const data = getDomainData(file);

    if (subdomain.length === 1 && data.owner.username.toLowerCase() !== "has-a.link") {
      results.push({
        subdomain,
        owner: data.owner.username.toLowerCase()
      });
    }
  });

  const duplicates = results.filter((result) => results.filter((r) => r.owner === result.owner).length > 1);

  t.is(duplicates.length, 0, duplicates.map((d) => `${d.owner} - ${d.subdomain}.has-a.link`).join("\n"));

  t.pass();
});
