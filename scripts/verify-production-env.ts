import { inspectProductionEnvironment } from "../src/lib/production-env";

const result = inspectProductionEnvironment();
if (result.missing.length) console.error(`Missing required variables: ${result.missing.join(", ")}`);
for (const warning of result.warnings) console.error(`Configuration warning: ${warning}`);
if (!result.valid) process.exit(1);
console.log("Production environment validation passed.");
