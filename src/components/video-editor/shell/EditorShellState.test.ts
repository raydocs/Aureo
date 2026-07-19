import { describe, expect, it } from "vitest";

import { deriveEditorShellState } from "./EditorShellState";

describe("deriveEditorShellState", () => {
	it.each([
		{
			name: "empty",
			input: {
				currentProjectPath: null,
				currentSourcePath: null,
				hasVideo: false,
				hasUnsavedChanges: false,
				saveOperation: { status: "idle" as const },
			},
			expected: {
				status: "empty",
				projectName: "Untitled",
				canSave: false,
				shouldConfirmClose: false,
				canExport: false,
			},
		},
		{
			name: "dirty",
			input: {
				currentProjectPath: null,
				currentSourcePath: "/recordings/Launch demo.mp4",
				hasVideo: true,
				hasUnsavedChanges: true,
				saveOperation: { status: "idle" as const },
			},
			expected: {
				status: "dirty",
				projectName: "Launch demo",
				canSave: true,
				shouldConfirmClose: true,
				canExport: true,
			},
		},
		{
			name: "source before video readiness",
			input: {
				currentProjectPath: null,
				currentSourcePath: "/recordings/Launch demo.mp4",
				hasVideo: false,
				hasUnsavedChanges: true,
				saveOperation: { status: "idle" as const },
			},
			expected: {
				status: "dirty",
				projectName: "Launch demo",
				canSave: false,
				shouldConfirmClose: true,
				canExport: false,
			},
		},
		{
			name: "saving",
			input: {
				currentProjectPath: "/projects/Launch demo.aureo",
				currentSourcePath: "/recordings/Launch demo.mp4",
				hasVideo: true,
				hasUnsavedChanges: true,
				saveOperation: { status: "saving" as const },
			},
			expected: {
				status: "saving",
				projectName: "Launch demo",
				canSave: false,
				shouldConfirmClose: true,
				canExport: true,
			},
		},
		{
			name: "not saved yet",
			input: {
				currentProjectPath: null,
				currentSourcePath: "/recordings/Launch demo.mp4",
				hasVideo: true,
				hasUnsavedChanges: false,
				saveOperation: { status: "idle" as const },
			},
			expected: {
				status: "not-saved",
				projectName: "Launch demo",
				canSave: true,
				shouldConfirmClose: false,
				canExport: true,
			},
		},
		{
			name: "saved",
			input: {
				currentProjectPath: "/projects/Launch demo.aureo",
				currentSourcePath: "/recordings/Launch demo.mp4",
				hasVideo: true,
				hasUnsavedChanges: false,
				saveOperation: { status: "idle" as const },
			},
			expected: {
				status: "saved",
				projectName: "Launch demo",
				canSave: true,
				shouldConfirmClose: false,
				canExport: true,
			},
		},
		{
			name: "save error",
			input: {
				currentProjectPath: "/projects/Launch demo.aureo",
				currentSourcePath: "/recordings/Launch demo.mp4",
				hasVideo: true,
				hasUnsavedChanges: true,
				saveOperation: { status: "error" as const, message: "Disk is full" },
			},
			expected: {
				status: "error",
				projectName: "Launch demo",
				canSave: true,
				shouldConfirmClose: true,
				canExport: true,
				errorMessage: "Disk is full",
			},
		},
	])("derives the $name shell contract", ({ input, expected }) => {
		expect(deriveEditorShellState({ ...input, untitledName: "Untitled" })).toEqual(expected);
	});
});
