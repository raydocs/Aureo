import { Check, MagnifyingGlass } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
	type EditorCommandDefinition,
	type EditorCommandGroup,
	filterEditorCommands,
	moveCommandSelection,
} from "./commandMenuModel";

interface CommandMenuProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	commands: EditorCommandDefinition[];
	placeholder: string;
	emptyLabel: string;
	title: string;
	groupLabels: Record<EditorCommandGroup, string>;
	isMac: boolean;
}

export function CommandMenu({
	open,
	onOpenChange,
	commands,
	placeholder,
	emptyLabel,
	title,
	groupLabels,
	isMac,
}: CommandMenuProps) {
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(-1);
	const inputRef = useRef<HTMLInputElement>(null);
	const commandRefs = useRef(new Map<string, HTMLButtonElement>());
	const visibleCommands = useMemo(() => filterEditorCommands(commands, query), [commands, query]);

	useEffect(() => {
		if (!open) return;
		setQuery("");
		setSelectedIndex(moveCommandSelection(-1, 1, commands));
	}, [commands, open]);

	useEffect(() => {
		setSelectedIndex(moveCommandSelection(-1, 1, visibleCommands));
	}, [visibleCommands]);

	useEffect(() => {
		const command = visibleCommands[selectedIndex];
		if (!command) return;
		commandRefs.current.get(command.id)?.scrollIntoView({ block: "nearest" });
	}, [selectedIndex, visibleCommands]);

	const execute = (command: EditorCommandDefinition) => {
		if (command.disabled) return;
		onOpenChange(false);
		window.setTimeout(() => void command.run(), 0);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="top-[18%] max-w-[620px] translate-y-0 gap-0 overflow-hidden rounded-2xl border-foreground/10 bg-editor-surface/98 p-0 text-foreground shadow-[0_32px_100px_rgba(0,0,0,0.5)] backdrop-blur-2xl [&>button]:hidden"
				style={{ transform: "translate(-50%, 0)" }}
				onOpenAutoFocus={(event) => {
					event.preventDefault();
					inputRef.current?.focus();
				}}
				aria-describedby={undefined}
			>
				<DialogTitle className="sr-only">{title}</DialogTitle>
				<div className="flex h-14 items-center gap-3 border-b border-foreground/10 px-4">
					<MagnifyingGlass className="h-5 w-5 shrink-0 text-muted-foreground" />
					<input
						ref={inputRef}
						type="text"
						role="combobox"
						aria-expanded={true}
						aria-controls="aureo-command-menu-list"
						aria-activedescendant={
							selectedIndex >= 0
								? `aureo-command-${visibleCommands[selectedIndex]?.id}`
								: undefined
						}
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "ArrowDown" || event.key === "ArrowUp") {
								event.preventDefault();
								setSelectedIndex((current) =>
									moveCommandSelection(
										current,
										event.key === "ArrowDown" ? 1 : -1,
										visibleCommands,
									),
								);
								return;
							}
							if (event.key === "Enter") {
								event.preventDefault();
								const command = visibleCommands[selectedIndex];
								if (command) execute(command);
							}
						}}
						placeholder={placeholder}
						className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/65"
					/>
					<kbd className="rounded-md border border-foreground/10 bg-foreground/5 px-2 py-1 text-[10px] font-medium text-muted-foreground">
						Esc
					</kbd>
				</div>

				<div
					id="aureo-command-menu-list"
					role="listbox"
					className="max-h-[430px] overflow-y-auto p-2"
				>
					{visibleCommands.length === 0 ? (
						<div className="flex h-28 items-center justify-center text-sm text-muted-foreground">
							{emptyLabel}
						</div>
					) : (
						visibleCommands.map((command, index) => {
							const previous = visibleCommands[index - 1];
							const showGroup =
								query.trim().length === 0 && previous?.group !== command.group;
							const selected = selectedIndex === index;
							return (
								<div key={command.id}>
									{showGroup ? (
										<div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/65 first:pt-1">
											{groupLabels[command.group]}
										</div>
									) : null}
									<button
										ref={(element) => {
											if (element)
												commandRefs.current.set(command.id, element);
											else commandRefs.current.delete(command.id);
										}}
										id={`aureo-command-${command.id}`}
										type="button"
										role="option"
										aria-selected={selected}
										disabled={command.disabled}
										onPointerMove={() => {
											if (!command.disabled) setSelectedIndex(index);
										}}
										onClick={() => execute(command)}
										className={cn(
											"flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-colors",
											selected && "bg-[#2563EB]/14",
											!selected &&
												!command.disabled &&
												"hover:bg-foreground/[0.055]",
											command.disabled && "cursor-not-allowed opacity-35",
										)}
									>
										<div className="min-w-0 flex-1">
											<div className="truncate text-[13px] font-medium text-foreground">
												{command.label}
											</div>
											{command.description ? (
												<div className="mt-0.5 truncate text-[11px] text-muted-foreground">
													{command.description}
												</div>
											) : null}
										</div>
										{command.checked ? (
											<Check
												className="h-4 w-4 shrink-0 text-[#2563EB]"
												weight="bold"
											/>
										) : null}
										{command.shortcut ? (
											<kbd className="shrink-0 rounded-md border border-foreground/10 bg-foreground/5 px-2 py-1 text-[10px] font-medium text-muted-foreground">
												{command.shortcut}
											</kbd>
										) : null}
									</button>
								</div>
							);
						})
					)}
				</div>
				<div className="flex items-center justify-between border-t border-foreground/10 px-4 py-2 text-[10px] text-muted-foreground/70">
					<span aria-hidden="true">↑↓ · ↵</span>
					<span aria-hidden="true">{isMac ? "⌘ K" : "Ctrl K"}</span>
				</div>
			</DialogContent>
		</Dialog>
	);
}
