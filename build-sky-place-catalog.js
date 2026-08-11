"use strict";

const fs = require("fs");
const path = require("path");

const [sourcePath, outputPath] = process.argv.slice(2);

if (!sourcePath || !outputPath) {
  throw new Error(
    "Usage: node build-sky-place-catalog.js <cities15000.txt> <output.json>"
  );
}

const source = fs.readFileSync(
  path.resolve(sourcePath),
  "utf8"
);

const records = source
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line, index) => {
    const columns = line.split("\t");
    const geonameId = Number(columns[0]);
    const name = columns[1];
    const asciiName = columns[2];
    const latitude = Number(columns[4]);
    const longitude = Number(columns[5]);
    const countryCode = columns[8];
    const admin1Code = columns[10] || "";
    const population = Number(columns[14]) || 0;
    const timezoneId = columns[17];

    if (
      !Number.isInteger(geonameId) ||
      !name ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !countryCode ||
      !timezoneId
    ) {
      throw new Error(
        `Invalid GeoNames record at line ${index + 1}`
      );
    }

    return [
      geonameId,
      name,
      asciiName === name ? "" : asciiName,
      latitude,
      longitude,
      countryCode,
      admin1Code,
      population,
      timezoneId
    ];
  });

const catalog = {
  version: "geonames-cities15000-package-1.0.1",
  source: "GeoNames cities15000",
  sourceUrl: "https://www.geonames.org/",
  license: "CC BY 4.0",
  licenseUrl:
    "https://creativecommons.org/licenses/by/4.0/",
  fields: [
    "geonameId",
    "name",
    "asciiName",
    "latitude",
    "longitude",
    "countryCode",
    "admin1Code",
    "population",
    "timezoneId"
  ],
  records
};

fs.writeFileSync(
  path.resolve(outputPath),
  JSON.stringify(catalog)
);

console.log(
  JSON.stringify({
    output: path.resolve(outputPath),
    records: records.length,
    bytes: fs.statSync(path.resolve(outputPath)).size
  })
);
