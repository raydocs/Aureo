import { spawn } from "node:child_process";
import type { AreaCaptureLayout } from "./areaGeometry";

export type AreaCompositionLayout = Pick<AreaCaptureLayout, "outputSize" | "segments">;

function evenFloor(value: number): number {
	return Math.max(2, Math.floor(value / 2) * 2);
}

export function constrainAreaCompositionLayout(
	layout: AreaCaptureLayout,
	maxWidth?: number,
	maxHeight?: number,
): AreaCompositionLayout {
	const widthLimit = Math.max(2, maxWidth ?? layout.outputSize.width);
	const heightLimit = Math.max(2, maxHeight ?? layout.outputSize.height);
	const scale = Math.min(
		1,
		widthLimit / layout.outputSize.width,
		heightLimit / layout.outputSize.height,
	);
	const outputSize = {
		width: evenFloor(layout.outputSize.width * scale),
		height: evenFloor(layout.outputSize.height * scale),
	};
	const scaleX = outputSize.width / layout.outputSize.width;
	const scaleY = outputSize.height / layout.outputSize.height;

	return {
		outputSize,
		segments: layout.segments.map((segment) => {
			const x = Math.round(segment.outputRect.x * scaleX);
			const y = Math.round(segment.outputRect.y * scaleY);
			const right = Math.round((segment.outputRect.x + segment.outputRect.width) * scaleX);
			const bottom = Math.round((segment.outputRect.y + segment.outputRect.height) * scaleY);
			return {
				...segment,
				outputRect: {
					x,
					y,
					width: Math.max(1, Math.min(outputSize.width - x, right - x)),
					height: Math.max(1, Math.min(outputSize.height - y, bottom - y)),
				},
			};
		}),
	};
}

export function buildAreaCompositionArgs({
	inputPaths,
	layout,
	outputPath,
	frameRate,
}: {
	inputPaths: readonly string[];
	layout: AreaCompositionLayout;
	outputPath: string;
	frameRate: number;
}): string[] {
	if (inputPaths.length === 0 || inputPaths.length !== layout.segments.length) {
		throw new Error("Area composition requires one input per capture segment");
	}

	const args = inputPaths.flatMap((inputPath) => ["-i", inputPath]);
	const filters: string[] = [
		`color=c=black:s=${layout.outputSize.width}x${layout.outputSize.height}:r=${Math.max(1, frameRate)}[base0]`,
	];

	layout.segments.forEach((segment, index) => {
		const { x, y, width, height } = segment.outputRect;
		filters.push(
			`[${index}:v]setpts=PTS-STARTPTS,scale=${width}:${height}:flags=lanczos,setsar=1[segment${index}]`,
			`[base${index}][segment${index}]overlay=x=${x}:y=${y}:shortest=1:eof_action=endall[base${index + 1}]`,
		);
	});

	filters.push(`[base${layout.segments.length}]format=yuv420p[video]`);
	return [
		...args,
		"-filter_complex",
		filters.join(";"),
		"-map",
		"[video]",
		"-map",
		"0:a?",
		"-c:v",
		"libx264",
		"-preset",
		"veryfast",
		"-crf",
		"18",
		"-c:a",
		"copy",
		"-movflags",
		"+faststart",
		"-y",
		outputPath,
	];
}

export function composeNativeAreaSegments({
	ffmpegPath,
	inputPaths,
	layout,
	outputPath,
	frameRate,
}: {
	ffmpegPath: string;
	inputPaths: readonly string[];
	layout: AreaCompositionLayout;
	outputPath: string;
	frameRate: number;
}): Promise<void> {
	const args = buildAreaCompositionArgs({ inputPaths, layout, outputPath, frameRate });
	return new Promise((resolve, reject) => {
		const process = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
		let output = "";
		process.stdout.on("data", (chunk: Buffer) => {
			output += chunk.toString();
		});
		process.stderr.on("data", (chunk: Buffer) => {
			output += chunk.toString();
		});
		process.once("error", reject);
		process.once("close", (code) => {
			if (code === 0) {
				resolve();
				return;
			}
			reject(
				new Error(
					output.trim() ||
						`FFmpeg area composition exited with code ${code ?? "unknown"}`,
				),
			);
		});
	});
}
