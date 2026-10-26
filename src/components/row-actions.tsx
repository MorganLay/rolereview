"use client";

import { MoreHorizontalIcon } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export type RowAction = {
  id: string;
  label: string;
  ariaLabel: string;
  icon: Icon;
  disabled?: boolean;
  destructive?: boolean;
  onSelect: () => void;
};

/**
 * Icon buttons from the `md` breakpoint up. Under `md`, the same actions
 * are one menu so a row of controls does not stack under the text.
 */
export function RowActions({
  menuLabel,
  actions,
}: {
  menuLabel: string;
  actions: readonly RowAction[];
}) {
  return (
    <div className="flex shrink-0 items-center">
      <div className="hidden items-center md:flex">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.id}
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={action.ariaLabel}
              disabled={action.disabled}
              onClick={action.onSelect}
            >
              <Icon aria-hidden />
            </Button>
          );
        })}
      </div>
      <div className="md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={menuLabel}>
              <MoreHorizontalIcon aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-44">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <DropdownMenuItem
                  key={action.id}
                  disabled={action.disabled}
                  variant={action.destructive ? "destructive" : "default"}
                  onSelect={action.onSelect}
                >
                  <Icon aria-hidden />
                  {action.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
