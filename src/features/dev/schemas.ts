import { z } from "zod";

import { SCENARIO_NAMES } from "../../../prisma/scenarios";

export const loadScenarioSchema = z.object({
  scenario: z.enum(SCENARIO_NAMES),
});
