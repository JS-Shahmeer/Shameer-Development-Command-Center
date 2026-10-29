"use server";

import { revalidatePath } from "next/cache";
import { createAction } from "@/lib/action";
import { profileInput } from "./schemas";
import * as service from "./service";

export const updateProfileAction = createAction(profileInput, async (input, actor) => {
  await service.updateProfile(actor, input);
  revalidatePath("/team", "layout");
});
