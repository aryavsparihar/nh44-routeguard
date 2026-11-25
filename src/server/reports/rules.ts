// The report trust rules (BUILD_PROMPT section 9) from
// config/report-rules.json. The database functions get the same object
// (p_rules), so the numbers live in one place.
import rules from "@/config/report-rules.json";

export const REPORT_RULES = rules;
export const REPORT_RULES_JSON = JSON.stringify(rules);
