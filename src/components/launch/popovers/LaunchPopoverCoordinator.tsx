import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import type { LaunchPopoverId } from "@/lib/launchPopoverIds";

export interface LaunchPopoverCoordinatorValue {
	openId: LaunchPopoverId | null;
	requestOpen: (id: LaunchPopoverId) => void;
	requestClose: (id: LaunchPopoverId) => void;
	isOpen: (id: LaunchPopoverId) => boolean;
}

const LaunchPopoverCoordinatorContext = createContext<LaunchPopoverCoordinatorValue | null>(null);

export { LaunchPopoverCoordinatorContext };

export function LaunchPopoverCoordinatorProvider({ children }: { children: ReactNode }) {
	const [openId, setOpenId] = useState<LaunchPopoverId | null>(null);

	const requestOpen = useCallback((id: LaunchPopoverId) => {
		setOpenId(id);
	}, []);

	const requestClose = useCallback((id: LaunchPopoverId) => {
		setOpenId((currentId) => (currentId === id ? null : currentId));
	}, []);

	const isOpen = useCallback((id: LaunchPopoverId) => openId === id, [openId]);

	useEffect(() => {
		const handleBlur = () => setOpenId(null);
		window.addEventListener("blur", handleBlur);
		return () => window.removeEventListener("blur", handleBlur);
	}, []);

	const value = useMemo(
		() => ({
			openId,
			requestOpen,
			requestClose,
			isOpen,
		}),
		[isOpen, openId, requestClose, requestOpen],
	);

	return (
		<LaunchPopoverCoordinatorContext.Provider value={value}>
			{children}
		</LaunchPopoverCoordinatorContext.Provider>
	);
}

export function useLaunchPopoverCoordinator() {
	const context = useContext(LaunchPopoverCoordinatorContext);
	if (!context) {
		throw new Error(
			"useLaunchPopoverCoordinator must be used within LaunchPopoverCoordinatorProvider",
		);
	}
	return context;
}
