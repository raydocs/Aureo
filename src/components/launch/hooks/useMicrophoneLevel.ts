import { useCallback, useEffect, useRef, useState } from "react";

const clampMeterLevel = (level: number) => Math.min(1, Math.max(0, level));

// Raw speech RMS rarely exceeds ~0.3; boost so the meter reads at conversational volume.
const METER_GAIN = 3;
const INPUT_ACTIVE_THRESHOLD = 0.06;
const INPUT_SILENT_DELAY_MS = 1500;

export function advanceMeterLevel(previous: number, target: number) {
	const clampedPrevious = clampMeterLevel(previous);
	const clampedTarget = clampMeterLevel(target);
	const smoothing = clampedTarget > clampedPrevious ? 0.5 : 0.08;

	return clampMeterLevel(clampedPrevious + (clampedTarget - clampedPrevious) * smoothing);
}

export type MicrophoneInputStatus = "off" | "checking" | "active" | "silent" | "error";

export function useMicrophoneLevel({
	enabled,
	deviceId,
}: {
	enabled: boolean;
	deviceId: string | undefined;
}): {
	attachMeter: (el: HTMLElement | null) => () => void;
	inputStatus: MicrophoneInputStatus;
} {
	const meterElementsRef = useRef(new Set<HTMLElement>());
	const [inputStatus, setInputStatus] = useState<MicrophoneInputStatus>(
		enabled ? "checking" : "off",
	);
	const inputStatusRef = useRef(inputStatus);
	const levelRef = useRef(0);
	const hasWarnedRef = useRef(false);

	const updateInputStatus = useCallback((status: MicrophoneInputStatus) => {
		if (inputStatusRef.current === status) {
			return;
		}
		inputStatusRef.current = status;
		setInputStatus(status);
	}, []);

	const writeLevel = useCallback((level: number) => {
		levelRef.current = level;
		for (const element of meterElementsRef.current) {
			element.style.transform = `scaleX(${level})`;
		}
	}, []);

	const attachMeter = useCallback((element: HTMLElement | null) => {
		if (!element) {
			return () => undefined;
		}

		meterElementsRef.current.add(element);
		element.style.transform = `scaleX(${levelRef.current})`;

		return () => {
			meterElementsRef.current.delete(element);
		};
	}, []);

	useEffect(() => {
		writeLevel(0);
		if (!enabled) {
			updateInputStatus("off");
			return;
		}

		updateInputStatus("checking");
		let cancelled = false;
		let animationFrameId: number | undefined;
		let stream: MediaStream | undefined;
		let audioContext: AudioContext | undefined;

		const startMeter = async () => {
			try {
				stream = await navigator.mediaDevices.getUserMedia({
					audio: deviceId ? { deviceId: { exact: deviceId } } : true,
				});
				if (cancelled) {
					stream.getTracks().forEach((track) => track.stop());
					return;
				}

				audioContext = new AudioContext();
				const analyser = audioContext.createAnalyser();
				analyser.fftSize = 512;
				audioContext.createMediaStreamSource(stream).connect(analyser);
				const samples = new Uint8Array(analyser.fftSize);
				let lastActiveAt = performance.now();

				const updateMeter = () => {
					analyser.getByteTimeDomainData(samples);
					let sumOfSquares = 0;
					for (const sample of samples) {
						const normalizedSample = (sample - 128) / 128;
						sumOfSquares += normalizedSample * normalizedSample;
					}
					const rms = Math.sqrt(sumOfSquares / samples.length);
					const meterLevel = advanceMeterLevel(levelRef.current, rms * METER_GAIN);
					writeLevel(meterLevel);
					const now = performance.now();
					if (meterLevel >= INPUT_ACTIVE_THRESHOLD) {
						lastActiveAt = now;
						updateInputStatus("active");
					} else if (now - lastActiveAt >= INPUT_SILENT_DELAY_MS) {
						updateInputStatus("silent");
					}
					animationFrameId = requestAnimationFrame(updateMeter);
				};

				animationFrameId = requestAnimationFrame(updateMeter);
			} catch (error) {
				stream?.getTracks().forEach((track) => track.stop());
				if (audioContext) {
					void audioContext.close();
				}
				writeLevel(0);
				if (!cancelled) {
					updateInputStatus("error");
					if (!hasWarnedRef.current) {
						hasWarnedRef.current = true;
						console.warn("Unable to start microphone level meter:", error);
					}
				}
			}
		};

		void startMeter();

		return () => {
			cancelled = true;
			if (animationFrameId !== undefined) {
				cancelAnimationFrame(animationFrameId);
			}
			stream?.getTracks().forEach((track) => track.stop());
			if (audioContext) {
				void audioContext.close();
			}
			writeLevel(0);
		};
	}, [deviceId, enabled, updateInputStatus, writeLevel]);

	return { attachMeter, inputStatus };
}
