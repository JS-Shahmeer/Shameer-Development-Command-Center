"use server";

import { revalidatePath } from "next/cache";
import { createAction } from "@/lib/action";
import { changeRoleInput, inviteIdInput, inviteInput, setActiveInput } from "./schemas";
import * as service from "./service";

const refresh = () => revalidatePath("/settings/users");

export const createInviteAction = createAction(inviteInput, async (input, actor) => {
  const invite = await service.createInvite(actor, input);
  refresh();
  return { email: invite.email };
});

export const revokeInviteAction = createAction(inviteIdInput, async ({ id }, actor) => {
  await service.revokeInvite(actor, id);
  refresh();
});

export const changeRoleAction = createAction(changeRoleInput, async ({ userId, role }, actor) => {
  await service.changeUserRole(actor, userId, role);
  refresh();
});

export const setUserActiveAction = createAction(setActiveInput, async ({ userId, active }, actor) => {
  await service.setUserActive(actor, userId, active);
  refresh();
});
