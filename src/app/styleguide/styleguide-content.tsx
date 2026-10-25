"use client";

import type { ReactNode } from "react";
import { CheckIcon, CircleIcon, XIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { toast } from "sonner";

import { ThemeToggle } from "@/components/theme-toggle";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { strings } from "@/copy/strings";

const brandSwatches = [
  { name: "ink", className: "bg-ink" },
  { name: "paper", className: "bg-paper ring-1 ring-line" },
  { name: "surface", className: "bg-surface ring-1 ring-line" },
  { name: "line", className: "bg-line" },
  { name: "slate", className: "bg-slate" },
  { name: "pine", className: "bg-pine" },
  { name: "pine-hover", className: "bg-pine-hover" },
  { name: "pine-50", className: "bg-pine-50 ring-1 ring-line" },
  { name: "marigold", className: "bg-marigold" },
  { name: "marigold-100", className: "bg-marigold-100 ring-1 ring-line" },
  { name: "marigold-700", className: "bg-marigold-700" },
  { name: "clay", className: "bg-clay" },
] as const;

const chartData = [
  { month: "Jan", tailored: 4 },
  { month: "Feb", tailored: 7 },
  { month: "Mar", tailored: 5 },
  { month: "Apr", tailored: 9 },
];

const chartConfig = {
  tailored: {
    label: "Tailored",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-serif text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function StyleguideContent() {
  return (
    <div className="min-h-full bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div>
            <p className="font-serif text-lg font-semibold">
              {strings.brand.name}
            </p>
            <h1 className="text-sm text-muted-foreground">
              {strings.styleguide.title}
            </h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-10 sm:px-8">
        <p className="max-w-2xl text-muted-foreground">
          {strings.styleguide.intro}
        </p>

        <Section title={strings.styleguide.sectionColors}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {brandSwatches.map((swatch) => (
              <div key={swatch.name} className="flex flex-col gap-2">
                <div
                  className={`h-14 rounded-card ${swatch.className}`}
                  aria-hidden
                />
                <span className="font-mono text-xs text-muted-foreground">
                  {swatch.name}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 text-pine">
              <CheckIcon className="size-4" aria-hidden />
              {strings.status.met}
            </span>
            <span className="inline-flex items-center gap-1.5 text-marigold-700">
              <CircleIcon className="size-4" aria-hidden />
              {strings.status.partial}
            </span>
            <span className="inline-flex items-center gap-1.5 text-clay">
              <XIcon className="size-4" aria-hidden />
              {strings.status.missing}
            </span>
          </div>
        </Section>

        <Section title={strings.styleguide.sectionType}>
          <div className="flex flex-col gap-3">
            <h3 className="font-serif text-3xl font-semibold leading-[1.15]">
              {strings.styleguide.sampleHeading}
            </h3>
            <p className="max-w-xl text-base leading-normal">
              {strings.styleguide.sampleBody}
            </p>
            <p className="text-sm text-muted-foreground tabular-nums">
              12 applications · 3 interviews · match 78
            </p>
          </div>
        </Section>

        <Section title={strings.styleguide.sectionComponents}>
          <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center gap-2">
              <Button>{strings.actions.tailorResume}</Button>
              <Button variant="secondary">{strings.actions.addJob}</Button>
              <Button variant="outline">{strings.actions.exportPdf}</Button>
              <Button variant="ghost">{strings.common.edit}</Button>
              <Button variant="destructive">{strings.common.delete}</Button>
              <Button variant="link">{strings.common.continue}</Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge>{strings.status.met}</Badge>
              <Badge variant="secondary">{strings.strength.strong}</Badge>
              <Badge variant="outline">{strings.nav.jobs}</Badge>
              <Badge variant="destructive">{strings.status.missing}</Badge>
            </div>

            <Card className="max-w-md">
              <CardHeader>
                <CardTitle>{strings.nav.library}</CardTitle>
                <CardDescription>
                  Experience library — entries, bullets, and skills.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="styleguide-title">Title</Label>
                  <Input id="styleguide-title" placeholder="Product designer" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="styleguide-notes">Notes</Label>
                  <Textarea
                    id="styleguide-notes"
                    placeholder="Add a note about this role."
                    rows={3}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="styleguide-current" />
                  <Label htmlFor="styleguide-current">Current role</Label>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-2 max-w-xs">
              <Label>Status</Label>
              <Select defaultValue="applied">
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="saved">Saved</SelectItem>
                  <SelectItem value="applied">Applied</SelectItem>
                  <SelectItem value="interview">Interview</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Tabs defaultValue="overview" className="max-w-md">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="text-sm text-muted-foreground">
                Requirements, keywords, and posting details.
              </TabsContent>
              <TabsContent value="documents" className="text-sm text-muted-foreground">
                Tailored resumes and cover letters.
              </TabsContent>
              <TabsContent value="timeline" className="text-sm text-muted-foreground">
                Status changes and reminders.
              </TabsContent>
            </Tabs>

            <div className="flex flex-wrap gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">Dialog</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit profile</DialogTitle>
                    <DialogDescription>
                      Update the details recruiters see on your resume.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline">{strings.common.cancel}</Button>
                    <Button>{strings.common.save}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">Alert dialog</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes the entry and its bullets from your library.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{strings.common.cancel}</AlertDialogCancel>
                    <AlertDialogAction>{strings.common.delete}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline">Sheet</Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>{strings.nav.settings}</SheetTitle>
                    <SheetDescription>
                      Account and preference controls will live here.
                    </SheetDescription>
                  </SheetHeader>
                </SheetContent>
              </Sheet>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Menu</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>{strings.actions.newJob}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>{strings.common.edit}</DropdownMenuItem>
                  <DropdownMenuItem>{strings.actions.exportPdf}</DropdownMenuItem>
                  <DropdownMenuItem variant="destructive">
                    {strings.common.delete}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">Popover</Button>
                </PopoverTrigger>
                <PopoverContent className="text-sm">
                  Keyword coverage updates as you edit.
                </PopoverContent>
              </Popover>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline">Tooltip</Button>
                </TooltipTrigger>
                <TooltipContent>
                  {strings.strength.fixes.metric(strings.strength.strong)}
                </TooltipContent>
              </Tooltip>

              <Button
                variant="outline"
                onClick={() => toast.success(strings.styleguide.toastMessage)}
              >
                {strings.styleguide.toastDemo}
              </Button>
            </div>

            <div className="flex max-w-md flex-col gap-2">
              <Label>Progress</Label>
              <Progress value={62} />
            </div>

            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>

            <Separator />

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Northwind</TableCell>
                  <TableCell>Product designer</TableCell>
                  <TableCell>{strings.status.met}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Contoso</TableCell>
                  <TableCell>Design lead</TableCell>
                  <TableCell>{strings.status.partial}</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <ChartContainer config={chartConfig} className="max-w-md min-h-48">
              <BarChart accessibilityLayer data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  tickMargin={8}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="tailored" fill="var(--color-tailored)" radius={4} />
              </BarChart>
            </ChartContainer>
          </div>
        </Section>
      </main>
    </div>
  );
}
