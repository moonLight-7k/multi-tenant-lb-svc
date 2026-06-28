import "./instrument.js";
import { app, env } from "@/index";
import { logger } from "@/utils/logger";

app.listen(env.PORT, () => {
  logger.info(`betterLeaderboard listening on port ${env.PORT}`);
});
