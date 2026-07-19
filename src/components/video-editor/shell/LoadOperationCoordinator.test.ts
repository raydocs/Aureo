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

	it("lets a queued retry start after a hung operation times out", async () => {
		const coordinator = createLoadOperationCoordinator();
		let hungOperationIsCurrent: (() => boolean) | null = null;
		let timedOut = false;
		void coordinator.run(
			({ isCurrent }) => {
				hungOperationIsCurrent = isCurrent;
				return new Promise<void>(() => undefined);
			},
			{
				timeoutMs: 5,
				onCurrentTimeout: () => {
					timedOut = true;
				},
			},
		);
		let retryStarted = false;
		const retry = coordinator.run(async () => {
			retryStarted = true;
		});

		const outcome = await Promise.race([
			retry.then(() => "settled"),
			new Promise<string>((resolve) => setTimeout(() => resolve("blocked"), 30)),
		]);

		expect(outcome).toBe("settled");
		expect(retryStarted).toBe(true);
		expect(timedOut).toBe(true);
		expect(hungOperationIsCurrent?.()).toBe(false);
	});
});
