import { logger } from "@/utils/logger";

/** Scan pipeline results for per-entry errors. Logs each, returns error count. */
export function checkPipelineErrors(
  results: [Error | null, unknown][] | null,
  context: string,
): number {
  if (!results) {
    logger.error("pipeline returned null", { context });
    return 1;
  }
  let errors = 0;
  for (let i = 0; i < results.length; i++) {
    if (results[i][0]) {
      errors++;
      logger.error("pipeline command failed", {
        context,
        index: i,
        error: results[i][0]!.message,
      });
    }
  }
  return errors;
}
