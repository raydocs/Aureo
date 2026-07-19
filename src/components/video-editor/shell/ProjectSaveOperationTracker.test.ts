import { describe, expect, it } from "vitest";

import { createProjectSaveOperationTracker } from "./ProjectSaveOperationTracker";

function createDeferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((resolvePromise) => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}

describe("ProjectSaveOperationTracker", () => {
	it("ignores a late save completion after project identity replacement", async () => {
		const tracker = createProjectSaveOperationTracker();
		const oldIdentity = tracker.currentIdentity();
		const oldSaveToken = tracker.claimOperation(oldIdentity);
		const oldSave = createDeferred();
		let shellStatus = "saving";
		const completion = oldSave.promise.then(() => {
			if (oldSaveToken) {
				tracker.commitOperation(oldSaveToken, () => {
					shellStatus = "error";
				});
			}
		});

		tracker.invalidateIdentity();
		shellStatus = "idle";
		oldSave.resolve();
		await completion;

		expect(shellStatus).toBe("idle");
	});

	it("rejects a pending callback that claims after its identity was replaced", () => {
		const tracker = createProjectSaveOperationTracker();
		const pendingCallbackIdentity = tracker.currentIdentity();

		tracker.invalidateIdentity();

		expect(tracker.claimOperation(pendingCallbackIdentity)).toBeNull();
	});

	it("keeps a running save current until the next queued save actually starts", () => {
		const tracker = createProjectSaveOperationTracker();
		const identity = tracker.currentIdentity();
		const runningSave = tracker.claimOperation(identity);
		const queuedRequestIdentity = identity;

		expect(runningSave && tracker.isOperationCurrent(runningSave)).toBe(true);
		expect(tracker.isIdentityCurrent(queuedRequestIdentity)).toBe(true);

		const queuedSave = tracker.claimOperation(queuedRequestIdentity);
		expect(runningSave && tracker.isOperationCurrent(runningSave)).toBe(false);
		expect(queuedSave && tracker.isOperationCurrent(queuedSave)).toBe(true);
	});

	it("lets only the newest overlapping operation update shell state", () => {
		const tracker = createProjectSaveOperationTracker();
		const identity = tracker.currentIdentity();
		const firstSaveToken = tracker.claimOperation(identity);
		const secondSaveToken = tracker.claimOperation(identity);
		const committedStates: string[] = [];

		if (firstSaveToken) {
			tracker.commitOperation(firstSaveToken, () =>
				committedStates.push("first-save-complete"),
			);
		}
		if (secondSaveToken) {
			tracker.commitOperation(secondSaveToken, () =>
				committedStates.push("second-save-complete"),
			);
		}

		expect(committedStates).toEqual(["second-save-complete"]);
	});
});
