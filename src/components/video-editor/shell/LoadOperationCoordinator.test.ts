import { describe, expect, it } from "vitest";

import { createLoadOperationCoordinator } from "./LoadOperationCoordinator";

function createDeferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((resolvePromise) => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}

describe("LoadOperationCoordinator", () => {
	it("serializes operations so main and renderer commits cannot diverge", async () => {
		const coordinator = createLoadOperationCoordinator();
		const firstGate = createDeferred();
		const commits: string[] = [];

		const first = coordinator.run(async ({ isCurrent }) => {
			await firstGate.promise;
			if (isCurrent()) commits.push("first");
		});
		const second = coordinator.run(async ({ isCurrent }) => {
			if (isCurrent()) commits.push("second");
		});

		await Promise.resolve();
		expect(commits).toEqual([]);

		firstGate.resolve();
		await Promise.all([first, second]);

		expect(commits).toEqual(["first", "second"]);
	});

	it("invalidates a pending operation during teardown", async () => {
		const coordinator = createLoadOperationCoordinator();
		const gate = createDeferred();
		let committed = false;
		const pending = coordinator.run(async ({ isCurrent }) => {
			await gate.promise;
			if (isCurrent()) committed = true;
		});

		coordinator.invalidate();
		gate.resolve();
		await pending;

		expect(committed).toBe(false);
	});

	it("settles loading when the latest queued operation is canceled", async () => {
		const coordinator = createLoadOperationCoordinator();
		const initialGate = createDeferred();
		let loading = true;
		const initial = coordinator.run(async () => {
			await initialGate.promise;
		});
		const canceledImport = coordinator.run(async () => undefined, {
			onCurrentSettled: () => {
				loading = false;
			},
		});

		initialGate.resolve();
		await Promise.all([initial, canceledImport]);

		expect(loading).toBe(false);
	});
});
