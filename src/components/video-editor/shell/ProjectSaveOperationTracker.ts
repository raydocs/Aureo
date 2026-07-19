export interface ProjectIdentityToken {
	readonly revision: number;
}

export interface ProjectSaveOperationToken {
	readonly identityRevision: number;
	readonly operationRevision: number;
}

export interface ProjectSaveOperationTracker {
	currentIdentity(): ProjectIdentityToken;
	invalidateIdentity(): ProjectIdentityToken;
	isIdentityCurrent(token: ProjectIdentityToken): boolean;
	claimOperation(identity: ProjectIdentityToken): ProjectSaveOperationToken | null;
	isOperationCurrent(token: ProjectSaveOperationToken): boolean;
	commitOperation(token: ProjectSaveOperationToken, update: () => void): boolean;
}

export function createProjectSaveOperationTracker(): ProjectSaveOperationTracker {
	let identityRevision = 0;
	let operationRevision = 0;

	return {
		currentIdentity: () => ({ revision: identityRevision }),
		invalidateIdentity: () => {
			identityRevision += 1;
			operationRevision += 1;
			return { revision: identityRevision };
		},
		isIdentityCurrent: (token) => token.revision === identityRevision,
		claimOperation: (identity) => {
			if (identity.revision !== identityRevision) {
				return null;
			}
			return {
				identityRevision,
				operationRevision: ++operationRevision,
			};
		},
		isOperationCurrent: (token) =>
			token.identityRevision === identityRevision &&
			token.operationRevision === operationRevision,
		commitOperation: (token, update) => {
			if (
				token.identityRevision !== identityRevision ||
				token.operationRevision !== operationRevision
			) {
				return false;
			}
			update();
			return true;
		},
	};
}
