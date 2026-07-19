export type ProjectSaveOperation =
	| { status: "idle" }
	| { status: "saving" }
	| { status: "error"; message: string };

interface EditorShellStateInput {
	currentProjectPath: string | null;
	currentSourcePath: string | null;
	hasVideo: boolean;
	hasUnsavedChanges: boolean;
	saveOperation: ProjectSaveOperation;
	untitledName: string;
}

interface EditorShellStateBase {
	projectName: string;
	canSave: boolean;
	shouldConfirmClose: boolean;
	canExport: boolean;
}

export type EditorShellState =
	| (EditorShellStateBase & { status: "empty" })
	| (EditorShellStateBase & { status: "dirty" })
	| (EditorShellStateBase & { status: "saving" })
	| (EditorShellStateBase & { status: "not-saved" })
	| (EditorShellStateBase & { status: "saved" })
	| (EditorShellStateBase & { status: "error"; errorMessage: string });

function deriveProjectName(
	currentProjectPath: string | null,
	currentSourcePath: string | null,
	untitledName: string,
) {
	const fileName =
		currentProjectPath?.split(/[\\/]/).pop() ?? currentSourcePath?.split(/[\\/]/).pop() ?? "";
	const withoutExtension = fileName.replace(/\.aureo$/i, "").replace(/\.[^.]+$/, "");
	return withoutExtension || untitledName;
}

export function deriveEditorShellState({
	currentProjectPath,
	currentSourcePath,
	hasVideo,
	hasUnsavedChanges,
	saveOperation,
	untitledName,
}: EditorShellStateInput): EditorShellState {
	const projectName = deriveProjectName(currentProjectPath, currentSourcePath, untitledName);
	const hasSource = Boolean(currentSourcePath);
	const common = {
		projectName,
		shouldConfirmClose: hasUnsavedChanges,
		canExport: hasVideo,
	};

	if (!hasSource) {
		return { status: "empty", ...common, canSave: false, canExport: false };
	}

	if (saveOperation.status === "saving") {
		return { status: "saving", ...common, canSave: false };
	}

	if (saveOperation.status === "error") {
		return {
			status: "error",
			...common,
			canSave: hasVideo,
			errorMessage: saveOperation.message,
		};
	}

	if (hasUnsavedChanges) {
		return { status: "dirty", ...common, canSave: hasVideo };
	}

	if (!currentProjectPath) {
		return { status: "not-saved", ...common, canSave: hasVideo };
	}

	return { status: "saved", ...common, canSave: hasVideo };
}
