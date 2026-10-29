"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Select, Textarea } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { useServerAction } from "@/hooks/use-server-action";
import { updateProfileAction } from "../actions";
import { SKILL_LEVELS } from "../schemas";

type Skill = { name: string; level: number };

export function ProfileDialog({
  user,
  canSetCapacity,
  knownSkills,
}: {
  user: {
    id: string;
    name: string | null;
    title: string | null;
    bio: string | null;
    capacityHours: number;
    skills: Skill[];
  };
  canSetCapacity: boolean;
  knownSkills: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [skills, setSkills] = useState<Skill[]>(user.skills);
  const [newSkill, setNewSkill] = useState("");
  const { run, pending, fieldErrors } = useServerAction(updateProfileAction);

  const addSkill = () => {
    const name = newSkill.trim();
    if (!name || skills.some((s) => s.name.toLowerCase() === name.toLowerCase())) return;
    setSkills([...skills, { name, level: 3 }]);
    setNewSkill("");
  };

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setSkills(user.skills);
          setOpen(true);
        }}
      >
        <Pencil /> Edit profile
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Edit profile" className="max-w-xl">
          <form
            noValidate
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const ok = await run(
                {
                  userId: user.id,
                  name: String(f.get("name") ?? ""),
                  title: String(f.get("title") ?? ""),
                  bio: String(f.get("bio") ?? ""),
                  capacityHours: canSetCapacity ? Number(f.get("capacityHours")) : undefined,
                  skills,
                },
                { success: "Profile saved" },
              );
              if (ok) {
                setOpen(false);
                router.refresh();
              }
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="p-name" label="Name" required error={fieldErrors.name}>
                <Input
                  id="p-name"
                  name="name"
                  defaultValue={user.name ?? ""}
                  aria-invalid={Boolean(fieldErrors.name)}
                />
              </FormField>
              <FormField id="p-title" label="Title" error={fieldErrors.title}>
                <Input
                  id="p-title"
                  name="title"
                  defaultValue={user.title ?? ""}
                  placeholder="Full-stack developer"
                />
              </FormField>
            </div>
            <FormField id="p-bio" label="About" error={fieldErrors.bio}>
              <Textarea id="p-bio" name="bio" rows={3} defaultValue={user.bio ?? ""} />
            </FormField>
            {canSetCapacity && (
              <FormField
                id="p-capacity"
                label="Weekly capacity (hours)"
                error={fieldErrors.capacityHours}
                hint="Hours a week available for project work."
              >
                <Input
                  id="p-capacity"
                  name="capacityHours"
                  type="number"
                  min={0}
                  max={80}
                  defaultValue={user.capacityHours}
                  className="w-32"
                />
              </FormField>
            )}

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Skills</legend>
              {skills.length > 0 && (
                <ul className="space-y-1.5">
                  {skills.map((s, i) => (
                    <li key={s.name} className="flex items-center gap-2">
                      <span className="flex-1 truncate text-sm">{s.name}</span>
                      <Select
                        aria-label={`${s.name} level`}
                        className="h-8 w-36 text-xs"
                        value={s.level}
                        onChange={(e) =>
                          setSkills(
                            skills.map((x, j) => (j === i ? { ...x, level: Number(e.target.value) } : x)),
                          )
                        }
                      >
                        {Object.entries(SKILL_LEVELS).map(([v, label]) => (
                          <option key={v} value={v}>
                            {v} · {label}
                          </option>
                        ))}
                      </Select>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove ${s.name}`}
                        onClick={() => setSkills(skills.filter((_, j) => j !== i))}
                      >
                        <X />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Input
                  list="known-skills"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  placeholder="Add a skill, e.g. React Native"
                  aria-label="New skill"
                  maxLength={40}
                />
                <datalist id="known-skills">
                  {knownSkills.map((k) => (
                    <option key={k} value={k} />
                  ))}
                </datalist>
                <Button type="button" variant="secondary" onClick={addSkill}>
                  <Plus /> Add
                </Button>
              </div>
              {fieldErrors.skills && <p className="text-danger text-xs">{fieldErrors.skills[0]}</p>}
            </fieldset>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                Save profile
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
