export interface LoadOperationContext {
	isCurrent(): boolean;
	deadlineMs?: number;
}

export interface LoadOperationOptions {
	onCurrentSettled?(): void;
	onCurrentTimeout?(): void;
	timeoutMs?: number;
}

export interface LoadOperationCoordinator {
	run(
		operation: (context: LoadOperationContext) => Promise<void>,
		options?: LoadOperationOptions,
	): Promise<void>;
	invalidate(): void;
}

export function createLoadOperationCoordinator(): LoadOperationCoordinator {
	let generation = 0;
	let invalidationEpoch = 0;
	let tail: Promise<void> = Promise.resolve();

	return {
		run: (operation, options) => {
			const operationEpoch = invalidationEpoch;
			const previous = tail;
			const pending = previous
				.catch(() => undefined)
				.then(async () => {
					if (operationEpoch !== invalidationEpoch) return;
					const operationGeneration = ++generation;
					const deadlineMs =
						options?.timeoutMs && options.timeoutMs > 0
							? Date.now() + options.timeoutMs
							: undefined;
					const isCurrent = () =>
						operationEpoch === invalidationEpoch && operationGeneration === generation;
					if (!isCurrent()) return;
					let timeoutId: ReturnType<typeof setTimeout> | null = null;
					let timedOut = false;
					try {
						const operationPromise = operation({ isCurrent, deadlineMs });
						if (options?.timeoutMs && options.timeoutMs > 0) {
							await Promise.race([
								operationPromise,
								new Promise<void>((resolve) => {
									timeoutId = setTimeout(() => {
										timedOut = true;
										resolve();
									}, options.timeoutMs);
								}),
							]);
						} else {
							await operationPromise;
						}
					} finally {
						if (timeoutId) clearTimeout(timeoutId);
						const settledCurrent = isCurrent();
						if (timedOut && settledCurrent) {
							options?.onCurrentTimeout?.();
							generation += 1;
						}
						if (settledCurrent) options?.onCurrentSettled?.();
					}
				});
			tail = pending;
			return pending;
		},
		invalidate: () => {
			invalidationEpoch += 1;
			generation += 1;
		},
	};
}
