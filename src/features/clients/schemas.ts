import { z } from "zod";
import { id, optionalEmail, optionalText, requiredText } from "@/lib/validation";

export const clientInput = z.object({
  name: requiredText("Client name", 120),
  company: optionalText(120),
  contactName: optionalText(120),
  email: optionalEmail(),
  phone: optionalText(40),
  notes: optionalText(5000),
});

export type ClientInput = z.infer<typeof clientInput>;
export type ClientFormValues = z.input<typeof clientInput>;

export const updateClientInput = z.object({ id: id(), data: clientInput });
export const deleteClientInput = z.object({ id: id() });
