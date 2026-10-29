"use server";

import { revalidatePath } from "next/cache";
import { createAction } from "@/lib/action";
import { clientInput, deleteClientInput, updateClientInput } from "./schemas";
import * as service from "./service";

export const createClientAction = createAction(clientInput, async (input, actor) => {
  const client = await service.createClient(actor, input);
  revalidatePath("/clients");
  return { id: client.id, name: client.name };
});

export const updateClientAction = createAction(updateClientInput, async ({ id, data }, actor) => {
  await service.updateClient(actor, id, data);
  revalidatePath("/clients");
  revalidatePath("/projects", "layout");
});

export const deleteClientAction = createAction(deleteClientInput, async ({ id }, actor) => {
  await service.deleteClient(actor, id);
  revalidatePath("/clients");
  revalidatePath("/projects", "layout");
});
