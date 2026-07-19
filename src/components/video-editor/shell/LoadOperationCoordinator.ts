export interface LoadOperationContext {
	isCurrent(): boolean;
}

export interface LoadOperationOptions {
	onCurrentSettled?(): void;
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
					const isCurrent = () =>
						operationEpoch === invalidationEpoch && operationGeneration === generation;
					if (!isCurrent()) return;
					try {
						await operation({ isCurrent });
					} finally {
						if (isCurrent()) options?.onCurrentSettled?.();
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
