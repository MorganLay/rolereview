"use client";

import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { strings } from "@/copy/strings";
import { updatePreferences } from "@/features/account/actions";
import { timeZoneChoices, type AccountPreferences } from "@/features/account/preferences";

const copy = strings.settings.preferences;

export function PreferencesForm({ preferences }: { preferences: AccountPreferences }) {
  const [timezone, setTimezone] = useState(preferences.timezone);
  const [reminders, setReminders] = useState(preferences.emailRemindersEnabled);
  const [digest, setDigest] = useState(preferences.weeklyDigestEnabled);
  const [marketing, setMarketing] = useState(preferences.marketingConsent);
  const [pending, setPending] = useState(false);
  const timeZones = useMemo(
    () => timeZoneChoices(preferences.timezone),
    [preferences.timezone],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const result = await updatePreferences({
      timezone,
      emailRemindersEnabled: reminders,
      weeklyDigestEnabled: digest,
      marketingConsent: marketing,
    });
    setPending(false);
    if (result.ok) {
      toast.success(copy.saved);
      return;
    }
    toast.error(result.error.code === "VALIDATION" ? copy.invalid : copy.error);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="timezone">{copy.timezoneLabel}</Label>
        <select
          id="timezone"
          name="timezone"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-ink outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {timeZones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex min-h-11 items-center justify-between gap-4">
          <Label htmlFor="reminders">{copy.reminders}</Label>
          <Switch
            id="reminders"
            checked={reminders}
            onCheckedChange={setReminders}
          />
        </div>
        <div className="flex min-h-11 items-center justify-between gap-4">
          <Label htmlFor="digest">{copy.digest}</Label>
          <Switch id="digest" checked={digest} onCheckedChange={setDigest} />
        </div>
        <p className="text-sm text-slate">{copy.later}</p>
      </div>

      <div className="flex min-h-11 items-start gap-3">
        <Checkbox
          id="marketing"
          checked={marketing}
          onCheckedChange={(value) => setMarketing(value === true)}
          className="mt-0.5"
        />
        <Label htmlFor="marketing" className="text-sm leading-5 font-normal">
          {copy.marketing}
        </Label>
      </div>

      <Button type="submit" disabled={pending} className="min-h-11 w-fit">
        {pending ? copy.saving : copy.save}
      </Button>
    </form>
  );
}
